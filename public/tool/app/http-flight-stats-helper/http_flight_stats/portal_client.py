from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Callable
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from .credentials import credential_summary, parse_credentials
from .models import QueryRecord, TableResult


BASE_URL = "https://ieb.csair.com"
QUERY_PAGE_PATH = "/newieb/flytime/showFlytimeManyQuery"
QUERY_PATH = "/newieb/flytime/showFlytimeManyQueryList"


class PortalError(RuntimeError):
    pass


class PortalSessionExpired(PortalError):
    pass


def _clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _is_login_response(response: requests.Response) -> bool:
    path = urlparse(str(response.url or "")).path
    if path == "/login":
        return True
    soup = BeautifulSoup(str(response.text or ""), "html.parser")
    return bool(soup.select_one("#scanLogin"))


def parse_result_table(html: str, expected_employee_id: str, expected_name: str = "") -> TableResult:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    expected_name = _clean_text(expected_name)
    saw_headers = False
    for table in soup.find_all("table"):
        headers = [_clean_text(cell.get_text(" ", strip=True)) for cell in table.select("thead th")]
        if not headers:
            headers = [_clean_text(cell.get_text(" ", strip=True)) for cell in table.select("tr th")]
        if not headers:
            continue
        saw_headers = True
        if any(not header for header in headers):
            raise ValueError("结果表存在空白表头")
        if len(set(headers)) != len(headers):
            raise ValueError("结果表存在重复表头")
        if "员工号" not in headers:
            continue
        for row in table.select("tbody tr"):
            values = [_clean_text(cell.get_text(" ", strip=True)) for cell in row.find_all("td", recursive=False)]
            if not values:
                continue
            if len(values) != len(headers):
                raise ValueError("结果表表头和数据列数不一致")
            mapped = dict(zip(headers, values))
            if mapped.get("员工号") != str(expected_employee_id):
                continue
            if expected_name and mapped.get("姓名", "") != expected_name:
                raise ValueError(f"姓名不匹配：页面返回人员与输入姓名不一致")
            return TableResult(headers=headers, values=mapped)
    if not saw_headers:
        raise ValueError("结果表缺少可见表头")
    raise ValueError("员工号不匹配：结果中未找到当前查询人员")


def build_query_params(record: QueryRecord) -> dict[str, str]:
    return {
        "staffNum": record.employee_id,
        "activeStatusArray": "ZAIZHI",
        "fleetCdArray1": "",
        "fleetCdArray": "",
        "chnDescArray": "",
        "primaryBaseArray": "",
        "baseArray": "",
        "dateType": "5",
        "exportType": "1",
        "startStr": record.start_date.isoformat(),
        "endStr": record.end_date.isoformat(),
        "singlefleetCdArray": "",
        "chnDescArray1": "",
        "page": "1",
        "currentStr": str(time.time_ns()),
    }


class PortalClient:
    def __init__(
        self,
        session_factory: Callable[[], requests.Session] = requests.Session,
        timeout_seconds: int = 30,
    ):
        self.session_factory = session_factory
        self.timeout_seconds = timeout_seconds
        self.cookies: dict[str, str] = {}
        self.verified_at = ""
        self._verify_session: requests.Session | None = None

    @staticmethod
    def _configure_session(session: requests.Session, cookies: dict[str, str]) -> None:
        session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                "Accept": "text/html, */*; q=0.01",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": f"{BASE_URL}/index/index",
                "X-Requested-With": "XMLHttpRequest",
            }
        )
        for name, value in cookies.items():
            session.cookies.set(name, value, domain="ieb.csair.com", path="/")

    def load_credentials(self, source: str) -> dict[str, object]:
        cookies = parse_credentials(source)
        session = self.session_factory()
        self._configure_session(session, cookies)
        try:
            response = session.get(f"{BASE_URL}{QUERY_PAGE_PATH}", timeout=self.timeout_seconds)
        except requests.RequestException as error:
            session.close()
            raise PortalError("连接飞行门户失败") from error
        if _is_login_response(response):
            session.close()
            raise PortalSessionExpired("登录凭据已失效，请重新复制")
        soup = BeautifulSoup(str(response.text or ""), "html.parser")
        form = soup.select_one("#showflyTimeExperienceQueryForm")
        if response.status_code != 200 or form is None or form.get("action") != QUERY_PATH:
            session.close()
            raise PortalError("当前登录态无法打开飞行经历查询页面")
        if self._verify_session is not None:
            self._verify_session.close()
        self.cookies = cookies
        self.verified_at = datetime.now().isoformat(timespec="seconds")
        self._verify_session = session
        return {**credential_summary(cookies), "verifiedAt": self.verified_at}

    def require_credentials(self) -> None:
        if not self.cookies:
            raise PortalSessionExpired("请先验证登录凭据")

    def _query_session(self) -> requests.Session:
        self.require_credentials()
        if self._verify_session is None:
            raise PortalSessionExpired("请先验证登录凭据")
        return self._verify_session

    def query(self, record: QueryRecord) -> TableResult:
        session = self._query_session()
        try:
            response = session.get(
                f"{BASE_URL}{QUERY_PATH}",
                params=build_query_params(record),
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as error:
            raise PortalError("门户查询请求失败") from error
        if _is_login_response(response):
            raise PortalSessionExpired("登录凭据已失效，请重新复制")
        if response.status_code != 200:
            raise PortalError(f"门户查询返回 HTTP {response.status_code}")
        return parse_result_table(str(response.text or ""), record.employee_id, record.name)

    def clear_credentials(self) -> None:
        self.cookies = {}
        self.verified_at = ""
        if self._verify_session is not None:
            self._verify_session.close()
            self._verify_session = None

    def close(self) -> None:
        self.clear_credentials()
