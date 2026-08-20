from __future__ import annotations

import random
import time
from threading import RLock
from typing import Callable
from urllib.parse import urlparse

import requests

from ..catalog import ApiCatalog, EndpointRecord
from ..credentials import credential_summary, format_credentials, parse_credentials
from .errors import ExecutionError, SessionExpiredError
from .flight_portal_lock import build_submit_form, required
from .flight_portal_parsers import (
    parse_employee_identity,
    parse_flight_result,
    parse_lock_result,
    parse_lock_types,
    parse_personnel_basic,
    parse_personnel_html,
    validate_query_page,
)
from .session_keepalive import SessionKeepAlive


def random_keepalive_interval() -> int:
    return random.randint(1, 60)


class FlightPortalAdapter:
    """维护飞行门户会话，并串行执行文档允许的请求。"""

    def __init__(
        self,
        catalog: ApiCatalog,
        session_factory: Callable[[], requests.Session] = requests.Session,
        timeout_seconds: int = 30,
        keepalive_interval_factory: Callable[[], int] = random_keepalive_interval,
    ) -> None:
        self.catalog = catalog
        self.session_factory = session_factory
        self.timeout_seconds = timeout_seconds
        self.keepalive_interval_factory = keepalive_interval_factory
        self.session: requests.Session | None = None
        self.cookies: dict[str, str] = {}
        self.option_cache: dict[str, list[dict[str, str]]] = {}
        self.request_lock = RLock()
        self.keepalive = SessionKeepAlive(keepalive_interval_factory, timeout_seconds)

    def load_credentials(self, source: str) -> dict[str, object]:
        cookies = parse_credentials(source)
        session = self.session_factory()
        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 Chrome/140 Safari/537.36"
            ),
        })
        for name, value in cookies.items():
            session.cookies.set(name, value, domain="ieb.csair.com", path="/")

        self.clear_credentials()
        with self.request_lock:
            self.cookies = cookies
            self.session = session
        try:
            request = self.catalog.get_internal_request("flight-stats.query-page")
            response = self._request(
                str(request.endpoint["method"]),
                request.url,
                headers=self._record_headers(request),
            )
            validate_query_page(
                str(response.text or ""),
                response.status_code,
                str(self.catalog.get_endpoint("flight-stats.query").endpoint["path"]),
            )
        except Exception:
            self.clear_credentials()
            raise
        self.keepalive.record_success()
        self.keepalive.start(self._check_session)
        return {
            **self.session_status(),
            "credentials": format_credentials(cookies),
        }

    def clear_credentials(self) -> None:
        self.keepalive.stop()
        with self.request_lock:
            self._clear_session_state()

    def session_status(self) -> dict[str, object]:
        with self.request_lock:
            summary = credential_summary(self.cookies)
            return {
                **summary,
                "keepAlive": self.keepalive.status(bool(self.cookies)),
            }

    def load_options(self, source: str) -> list[dict[str, str]]:
        if source != "lock-types":
            raise ValueError("选项来源不存在")
        if source in self.option_cache:
            return self.option_cache[source]
        request = self.catalog.get_internal_request("lock-entry.entry-page")
        response = self._request(
            str(request.endpoint["method"]),
            request.url,
            params=[("random", self._random_value())],
            headers=self._record_headers(request),
        )
        options = parse_lock_types(str(response.text or ""))
        self.option_cache[source] = options
        return options

    def execute(self, record: EndpointRecord, supplied: dict[str, object]) -> dict[str, object]:
        started = time.perf_counter()
        if record.full_id == "flight-stats.query":
            response = self._execute_flight_query(record, supplied)
            parser = lambda: parse_flight_result(
                str(response.text or ""),
                str(supplied.get("staffNum", "")).strip(),
            )
        elif record.full_id == "lock-entry.submit":
            response = self._execute_lock_submit(record, supplied)
            parser = lambda: parse_lock_result(str(response.text or ""))
        elif record.full_id == "personnel-info.basic":
            response = self._execute_personnel_basic(record, supplied)
            parser = lambda: parse_personnel_basic(str(response.text or ""))
        elif record.full_id == "personnel-info.technical":
            response = self._execute_personnel_form(record, supplied, "staffNum")
            parser = lambda: parse_personnel_html(str(response.text or ""), "#qualList", "technical", "技术等级")
        elif record.full_id == "personnel-info.operation":
            response = self._execute_personnel_form(record, supplied, "empid")
            parser = lambda: parse_personnel_html(str(response.text or ""), "#showSingleEmpOperQualList", "operation", "运行资格")
        elif record.full_id == "personnel-info.training-records":
            response = self._execute_personnel_form(record, supplied, "staffId")
            parser = lambda: parse_personnel_html(str(response.text or ""), "#showTrainingRecordListDiv", "training-records", "培训记录")
        elif record.full_id == "personnel-info.training-experiences":
            response = self._execute_personnel_form(record, supplied, "staffNum")
            parser = lambda: parse_personnel_html(str(response.text or ""), "#trainResultList, #empProfile_trainResultList", "training-experiences", "训练经历")
        else:
            raise ExecutionError("当前系统不支持该业务接口")

        if response.status_code != 200:
            data: dict[str, object] = {
                "summary": {"httpError": f"HTTP {response.status_code}"},
                "tables": [],
            }
        else:
            try:
                data = parser()
            except ExecutionError as error:
                data = {"summary": {"parseError": str(error)}, "tables": []}
        return self._response_payload(record, response, started, data)

    def _execute_flight_query(
        self,
        record: EndpointRecord,
        supplied: dict[str, object],
    ) -> requests.Response:
        return self._request(
            str(record.endpoint["method"]),
            record.url,
            params=self._build_catalog_parameters(record, supplied),
            headers=self._record_headers(record),
        )

    def _execute_lock_submit(
        self,
        record: EndpointRecord,
        supplied: dict[str, object],
    ) -> requests.Response:
        staff_number = required(supplied, "staffnum", "员工号")
        lock_type = required(supplied, "lockType", "锁班类型")
        option = next(
            (item for item in self.load_options("lock-types") if item["value"] == lock_type),
            None,
        )
        if option is None:
            raise ValueError("所选锁班类型已不存在，请重新载入 Cookie")
        identity = self._validate_employee(staff_number)
        form = build_submit_form(supplied, option, identity, self._random_value)
        return self._request(
            str(record.endpoint["method"]),
            record.url,
            data=form,
            headers=self._record_headers(record),
        )

    def _execute_personnel_basic(self, record: EndpointRecord, supplied: dict[str, object]) -> requests.Response:
        staff_number = required(supplied, "staffNum", "员工号")
        headers = self._record_headers(record)
        headers.pop("Content-Type", None)
        return self._request(
            str(record.endpoint["method"]),
            record.url,
            files={"staffNum": (None, staff_number)},
            headers=headers,
        )

    def _execute_personnel_form(
        self,
        record: EndpointRecord,
        supplied: dict[str, object],
        staff_field: str,
    ) -> requests.Response:
        values = self._build_catalog_parameters(record, supplied)
        if not any(name == staff_field and value for name, value in values):
            values = [(staff_field, required(supplied, staff_field, "员工号")), *values]
        return self._request(
            str(record.endpoint["method"]),
            record.url,
            data=values,
            headers=self._record_headers(record),
        )

    def _validate_employee(self, staff_number: str) -> dict[str, str]:
        request = self.catalog.get_internal_request("lock-entry.employee-validation")
        response = self._request(
            str(request.endpoint["method"]),
            request.url,
            data=[
                ("staffNum", staff_number),
                ("operationType", "1"),
                ("random", self._random_value()),
                ("flagType", "nonproductionTask"),
            ],
            headers=self._record_headers(request),
        )
        return parse_employee_identity(str(response.text or ""))

    def _build_catalog_parameters(
        self,
        record: EndpointRecord,
        supplied: dict[str, object],
    ) -> list[tuple[str, str]]:
        values: list[tuple[str, str]] = []
        definitions = record.endpoint.get("parameters", [])
        if not isinstance(definitions, list):
            raise ValueError("接口参数定义无效")
        for parameter in definitions:
            if not isinstance(parameter, dict):
                continue
            name = str(parameter.get("name", ""))
            raw_value = supplied.get(name, parameter.get("default", ""))
            automatic = str(parameter.get("auto", ""))
            if automatic == "timestamp":
                raw_value = str(time.time_ns())
            elif automatic == "random":
                raw_value = self._random_value()
            normalized = str(raw_value or "").strip()
            if parameter.get("required") and not normalized:
                raise ValueError(f"请填写{parameter.get('label', name)}")
            if normalized or parameter.get("includeWhenEmpty"):
                values.append((name, normalized))
        return values

    def _request(
        self,
        method: str,
        url: str,
        *,
        params: list[tuple[str, str]] | None = None,
        data: list[tuple[str, str]] | None = None,
        files: dict[str, tuple[None, str]] | None = None,
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        with self.request_lock:
            if self.session is None or not self.cookies:
                raise SessionExpiredError("请先载入有效 Cookie")
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    data=data,
                    files=files,
                    headers=headers or {},
                    timeout=self.timeout_seconds,
                    allow_redirects=True,
                )
            except requests.RequestException as error:
                raise ExecutionError("连接飞行门户失败") from error
            if self._is_login_response(response):
                self._clear_session_state()
                self.keepalive.mark_expired()
                raise SessionExpiredError("Cookie 已失效，请重新复制")
            return response

    def _check_session(self) -> None:
        request = self.catalog.get_internal_request("flight-stats.query-page")
        response = self._request(
            str(request.endpoint["method"]),
            request.url,
            headers=self._record_headers(request),
        )
        validate_query_page(
            str(response.text or ""),
            response.status_code,
            str(self.catalog.get_endpoint("flight-stats.query").endpoint["path"]),
        )

    def _clear_session_state(self) -> None:
        self.cookies = {}
        self.option_cache = {}
        if self.session is not None:
            self.session.close()
            self.session = None

    @staticmethod
    def _is_login_response(response: requests.Response) -> bool:
        if urlparse(str(response.url or "")).path == "/login":
            return True
        body = str(response.text or "")
        return 'id="scanLogin"' in body or "id='scanLogin'" in body

    @staticmethod
    def _record_headers(record: EndpointRecord) -> dict[str, str]:
        headers = {
            str(header.get("name")): str(header.get("value"))
            for header in [*record.module.get("commonHeaders", []), *record.endpoint.get("headers", [])]
            if isinstance(header, dict) and header.get("name")
        }
        if record.endpoint.get("method") == "POST":
            headers.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            headers.setdefault("Origin", str(record.module.get("baseUrl", "")).rstrip("/"))
        return headers

    @staticmethod
    def _random_value() -> str:
        return f"{random.random():.16f}".rstrip("0")

    @staticmethod
    def _response_payload(
        record: EndpointRecord,
        response: requests.Response,
        started: float,
        data: dict[str, object],
    ) -> dict[str, object]:
        headers = {
            name: value
            for name, value in response.headers.items()
            if name.lower() not in {"set-cookie", "cookie"}
        }
        return {
            "endpointId": record.full_id,
            "method": record.endpoint["method"],
            "status": response.status_code,
            "reason": response.reason,
            "elapsedMilliseconds": round((time.perf_counter() - started) * 1000),
            "finalUrl": str(response.url or record.url),
            "contentType": response.headers.get("Content-Type", ""),
            "headers": headers,
            "data": data,
            "body": str(response.text or ""),
        }

    def close(self) -> None:
        self.clear_credentials()


__all__ = [
    "ExecutionError",
    "FlightPortalAdapter",
    "SessionExpiredError",
    "random_keepalive_interval",
]
