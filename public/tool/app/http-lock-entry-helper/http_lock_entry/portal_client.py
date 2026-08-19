"""Authenticated HTTP client and parsers for IEB non-production tasks."""

from __future__ import annotations

import random
import re
from datetime import date, datetime
from typing import Iterable

import requests
from bs4 import BeautifulSoup, Tag

from .credentials import parse_credentials
from .metadata import normalize_lock_type, normalize_text, parse_portal_metadata
from .models import EmployeeIdentity, LockTypeMetadata, PortalMetadata, SubmitResult
from .routing import available_days_for_year, parse_quota_rows


BASE_URL = "https://ieb.csair.com"
ENTRY_PATH = "/newieb/nonproductionTask/showNonproductionTaskImportPage"
EMPLOYEE_PATH = "/newieb/nonproductionTask/vaildStaffNum"
QUOTA_PATH = "/newieb/nonproductionTask/showNonproductionHolidayRulesTips"
SUBMIT_PATH = "/newieb/nonproductionTask/showNonproductionTaskImportResultPage"
QUERY_PAGE_PATH = "/newieb/nonproductionTask/showNonproductionTaskPage"
QUERY_PATH = "/newieb/nonproductionTask/showLockListPage"

STATE_PATHS = {
    "approve": "/newieb/nonproductionTask/importNonproductionTaskLockListToSoc",
    "revoke": "/newieb/nonproductionTask/deleteNonproductionTaskLock",
    "unlock": "/newieb/nonproductionTask/unlockNonproductionTaskLock",
    "reject": "/newieb/nonproductionTask/rejectNonproductionTaskLock",
}

STATUS_CODES = {
    "已锁": "1",
    "待审批": "3",
    "已解锁": "5",
    "已撤销": "6",
    "已否决": "7",
}


class PortalError(RuntimeError):
    """A sanitized portal or response-contract failure."""


class PortalSessionExpired(PortalError):
    """The supplied browser session is no longer authenticated."""


def _random_value() -> str:
    return f"{random.random():.16f}"


def _is_login_response(response: object) -> bool:
    url = str(getattr(response, "url", "") or "").lower()
    text = str(getattr(response, "text", "") or "")
    if "/login" in url:
        return True
    soup = BeautifulSoup(text, "html.parser")
    return bool(
        soup.select_one("#scanLogin, form[action*='login'], input[name='password']")
        or re.search(r"<title>[^<]*(?:登录|login)[^<]*</title>", text, re.I)
    )


def _cell_texts(row: Tag) -> list[str]:
    return [normalize_text(cell.get_text(" ", strip=True)) for cell in row.select(":scope > th, :scope > td")]


def _align_values(headers: list[str], values: list[str]) -> list[str]:
    if len(values) == len(headers) + 1 and re.fullmatch(r"\d{1,5}", values[0] or ""):
        return values[1:]
    return values


def _table_headers(root: Tag) -> list[str]:
    selectors = ("thead th", ".hDiv th", "tr th")
    for selector in selectors:
        values = [normalize_text(cell.get_text(" ", strip=True)) for cell in root.select(selector)]
        values = [value for value in values if value]
        if values:
            return values
    return []


def _table_rows(root: Tag, headers: list[str]) -> list[dict[str, str]]:
    row_nodes: list[Tag] = []
    for selector in (".bDiv tbody tr", "tbody.list tr", "tbody tr"):
        row_nodes = list(root.select(selector))
        if row_nodes:
            break
    rows: list[dict[str, str]] = []
    for row_node in row_nodes:
        values = _align_values(headers, _cell_texts(row_node))
        row_text = " | ".join(value for value in values if value)
        if not values or "没有相关信息" in row_text:
            continue
        row = {
            headers[index] if index < len(headers) else f"列{index + 1}": value
            for index, value in enumerate(values)
        }
        checkbox = row_node.select_one("input[type='checkbox'][value]")
        if checkbox is not None:
            row["记录ID"] = normalize_text(checkbox.get("value"))
        row["_text"] = row_text
        rows.append(row)
    return rows


def _parse_section(soup: BeautifulSoup, selector: str) -> tuple[list[str], list[dict[str, str]]]:
    root = soup.select_one(selector)
    if root is None:
        raise PortalError(f"门户响应缺少结果区域 {selector}")
    headers = _table_headers(root)
    if not headers:
        raise PortalError(f"门户响应的结果区域 {selector} 缺少表头")
    return headers, _table_rows(root, headers)


def _field(row: dict[str, str], *aliases: str) -> str:
    for alias in aliases:
        value = normalize_text(row.get(alias))
        if value:
            return value
    return ""


def _normalize_portal_datetime(value: object) -> str:
    text = normalize_text(value)
    match = re.fullmatch(r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?", text)
    return f"{match.group(1)} {match.group(2)}" if match else ""


def _same_name(left: object, right: object) -> bool:
    def clean(value: object) -> str:
        return re.sub(r"\s+|[（(][^）)]*[）)]", "", normalize_text(value)).upper()

    return clean(left) == clean(right)


class PortalClient:
    def __init__(
        self,
        session: requests.Session | object | None = None,
        base_url: str = BASE_URL,
        timeout: int = 30,
    ):
        self.session = session or requests.Session()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.metadata: PortalMetadata | None = None
        self.verified_at = ""
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
                "Accept": "*/*",
                "Origin": self.base_url,
                "Referer": f"{self.base_url}/index/index",
                "X-Requested-With": "XMLHttpRequest",
            }
        )

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _check_response(self, response: object) -> object:
        try:
            response.raise_for_status()
        except Exception as error:
            status = getattr(response, "status_code", "未知")
            raise PortalError(f"飞行门户 HTTP 请求失败（状态 {status}）") from error
        if _is_login_response(response):
            raise PortalSessionExpired("登录凭据已失效，请重新从已登录门户复制凭据")
        return response

    def _get(self, path: str, *, params: dict[str, str] | None = None) -> object:
        try:
            response = self.session.get(self._url(path), params=params, timeout=self.timeout)
        except requests.RequestException as error:
            raise PortalError(f"无法连接飞行门户：{error.__class__.__name__}") from error
        return self._check_response(response)

    def _post(self, path: str, *, data: object) -> object:
        try:
            response = self.session.post(self._url(path), data=data, timeout=self.timeout)
        except requests.RequestException as error:
            raise PortalError(f"飞行门户请求失败：{error.__class__.__name__}") from error
        return self._check_response(response)

    def load_credentials(self, source: str) -> PortalMetadata:
        cookies = parse_credentials(source)
        self.session.cookies.clear()
        for name, value in cookies.items():
            self.session.cookies.set(name, value, domain="ieb.csair.com", path="/")
        response = self._get(ENTRY_PATH, params={"random": _random_value()})
        html = str(response.text or "")
        soup = BeautifulSoup(html, "html.parser")
        if soup.select_one("#nonproductionTaskImportForm") is None or soup.select_one("#lockType") is None:
            self.metadata = None
            raise PortalSessionExpired("凭据未进入非生产任务录入页，请重新复制已登录请求")
        self.metadata = parse_portal_metadata(html)
        self.verified_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return self.metadata

    def require_metadata(self) -> PortalMetadata:
        if self.metadata is None:
            raise PortalSessionExpired("尚未验证登录凭据")
        return self.metadata

    def validate_employee(self, employee_id: str) -> EmployeeIdentity:
        response = self._post(
            EMPLOYEE_PATH,
            data={
                "staffNum": employee_id,
                "operationType": "1",
                "random": _random_value(),
                "flagType": "nonproductionTask",
            },
        )
        try:
            payload = response.json()
        except Exception as error:
            raise PortalError("员工校验响应不是有效 JSON") from error
        if not isinstance(payload, dict):
            raise PortalError("员工校验响应结构异常")
        if str(payload.get("permissionFlag", "")).lower() != "true":
            message = normalize_text(payload.get("errorMsg") or payload.get("msg"))
            raise PortalError(message or f"员工号 {employee_id} 未通过门户校验")
        name = normalize_text(payload.get("nameInfo"))
        department = normalize_text(payload.get("deptInfo"))
        if not name or not department:
            raise PortalError("员工校验响应缺少姓名或部门")
        return EmployeeIdentity(employee_id=employee_id, name=name, department=department)

    def fetch_available_days(self, employee_id: str, lock_type: str, year: int) -> int:
        metadata = self.require_metadata()
        item = metadata.lock_types.get(lock_type)
        if item is None:
            raise PortalError(f"当前门户没有锁班类型 {lock_type}")
        response = self._post(
            QUOTA_PATH,
            data={
                "staffnum": employee_id,
                "holidayType": item.code,
                "holidayTypeDesc": item.description,
                "random": _random_value(),
            },
        )
        rows = self.parse_quota_result(str(response.text or ""))
        try:
            return available_days_for_year(rows, year)
        except ValueError as error:
            raise PortalError(str(error)) from error

    def parse_quota_result(self, html: str) -> list[dict[str, str]]:
        soup = BeautifulSoup(html, "html.parser")
        root = soup.select_one(".hDiv")
        body = soup.select_one(".bDiv")
        if root is None or body is None:
            raise PortalError("休假限制响应缺少表格")
        headers = _table_headers(root)
        if not headers:
            raise PortalError("休假限制响应缺少表头")
        wrapper = BeautifulSoup("<div></div>", "html.parser").div
        assert wrapper is not None
        wrapper.append(body)
        raw_rows = _table_rows(wrapper, headers)
        values = [[row.get(header, "") for header in headers] for row in raw_rows]
        try:
            return parse_quota_rows(headers, values)
        except ValueError as error:
            raise PortalError(str(error)) from error

    def resolve_reason(self, record: dict[str, object], common_reason: str) -> str:
        metadata = self.require_metadata()
        item = metadata.lock_types.get(str(record.get("请假类型", "")))
        if item is None:
            raise PortalError("当前记录的锁班类型不在动态类型列表中")
        reason = normalize_text(record.get("备注")) or normalize_text(common_reason)
        if not reason:
            reason = f"{metadata.default_reason_prefix}{item.description}"
        if not reason:
            raise PortalError("门户默认锁班原因不可用，请填写备注")
        if len(reason) > 60:
            raise PortalError("锁班原因不能超过60个字符")
        return reason

    def build_submit_data(
        self,
        record: dict[str, object],
        identity: EmployeeIdentity,
        item: LockTypeMetadata,
        reason: str,
    ) -> list[tuple[str, str]]:
        time_mode = int(record.get("时间模式", 1))
        common = [
            ("staffnum", identity.employee_id),
            ("lockType", item.code),
            ("dateSplitFlag", item.date_split_flag),
            ("lockRemark", reason),
        ]
        if time_mode == 1:
            start_date = str(record.get("开始日期", ""))
            end_date = str(record.get("结束日期", ""))
            start_time = str(record.get("开始时间", ""))
            end_time = str(record.get("结束时间", ""))
            lock_days = (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days + 1
            timing = [
                ("startDt", f"{start_date} {start_time}"),
                ("endDt", f"{end_date} {end_time}"),
                ("lockDays", str(lock_days)),
                ("lockTimeType", "1"),
                ("lockYearAndMonth", ""),
                ("lockStartHourAndMinute", ""),
                ("lockEndHourAndMinute", ""),
            ]
        elif time_mode == 2:
            selected_days = [int(value) for value in record.get("日期列表", [])]
            timing = [
                ("startDt", ""),
                ("endDt", ""),
                ("lockDays", str(len(selected_days))),
                ("lockTimeType", "2"),
                ("lockYearAndMonth", str(record.get("月份", ""))),
                *[("lockDaysNum", str(day)) for day in selected_days],
                ("lockStartHourAndMinute", str(record.get("开始时间", ""))),
                ("lockEndHourAndMinute", str(record.get("结束时间", ""))),
            ]
        else:
            raise PortalError(f"不支持的时间模式 {time_mode}")
        return common + timing + [
            ("lockTypeDesc", item.description),
            ("chnName", identity.name),
            ("orgUnitName", identity.department),
            ("random", _random_value()),
        ]

    def submit(self, body: list[tuple[str, str]]) -> SubmitResult:
        response = self._post(SUBMIT_PATH, data=body)
        return self.parse_submit_result(str(response.text or ""))

    def parse_submit_result(self, html: str) -> SubmitResult:
        soup = BeautifulSoup(html, "html.parser")
        _result_headers, result_rows = _parse_section(soup, "#showNonproductionTaskImportResultPage1")
        _conflict_headers, conflict_rows = _parse_section(soup, "#showNonproductionTaskImportResultPage2")
        return SubmitResult(result_rows=result_rows, conflict_rows=conflict_rows)

    def _expected_ranges(self, record: dict[str, object]) -> list[tuple[str, str]]:
        start_time = str(record.get("开始时间", ""))
        end_time = str(record.get("结束时间", ""))
        if int(record.get("时间模式", 1)) == 1:
            return [
                (
                    f"{record.get('开始日期', '')} {start_time}",
                    f"{record.get('结束日期', '')} {end_time}",
                )
            ]
        month = str(record.get("月份", ""))
        return [
            (f"{month}-{int(day):02d} {start_time}", f"{month}-{int(day):02d} {end_time}")
            for day in record.get("日期列表", [])
        ]

    def _row_matches(
        self,
        row: dict[str, str],
        record: dict[str, object],
        identity: EmployeeIdentity,
        expected_range: tuple[str, str],
    ) -> bool:
        metadata = self.require_metadata()
        if _field(row, "员工号", "员工编号") != identity.employee_id:
            return False
        if not _same_name(_field(row, "姓名"), identity.name):
            return False
        row_type = _field(row, "锁班类型", "锁班名称")
        expected_code = str(record.get("请假类型", ""))
        normalized_code = normalize_lock_type(row_type, metadata)
        if normalized_code:
            if normalized_code != expected_code:
                return False
        else:
            item = metadata.lock_types.get(expected_code)
            if item is None or normalize_text(item.description) not in normalize_text(row_type):
                return False
        return (
            _normalize_portal_datetime(_field(row, "开始日期", "开始时间")) == expected_range[0]
            and _normalize_portal_datetime(_field(row, "结束日期", "结束时间")) == expected_range[1]
        )

    def _attribute_rows(
        self,
        rows: Iterable[dict[str, str]],
        record: dict[str, object],
        identity: EmployeeIdentity,
        label: str,
    ) -> tuple[list[dict[str, str]], str]:
        remaining = list(rows)
        matched: list[dict[str, str]] = []
        for expected_range in self._expected_ranges(record):
            candidates = [
                row for row in remaining if self._row_matches(row, record, identity, expected_range)
            ]
            if len(candidates) != 1:
                return [], f"{label}无法按员工、类型和日期时间精确归属"
            match = candidates[0]
            matched.append(match)
            remaining.remove(match)
        return matched, ""

    def attribute_submit_result(
        self,
        result: SubmitResult,
        record: dict[str, object],
        identity: EmployeeIdentity,
    ) -> tuple[list[dict[str, str]], str]:
        if result.conflict_rows:
            return [], "门户返回冲突结果"
        if not result.result_rows:
            return [], "门户没有返回普通结果"
        return self._attribute_rows(result.result_rows, record, identity, "提交结果")

    def attribute_conflict_result(
        self,
        result: SubmitResult,
        record: dict[str, object],
        identity: EmployeeIdentity,
    ) -> tuple[list[dict[str, str]], str]:
        if not result.conflict_rows:
            return [], "门户没有返回冲突结果"
        return self._attribute_rows(result.conflict_rows, record, identity, "冲突结果")

    def _query_body(self, employee_id: str, status: str, page: int) -> dict[str, str]:
        status_code = STATUS_CODES.get(status, status)
        return {
            "staffnum": employee_id,
            "base": "",
            "primBase": "",
            "fleetCd": "",
            "lockType": "",
            "lockStatus": status_code,
            "startDt": "",
            "endDt": "",
            "orderByType": "",
            "entryStaffnum": "",
            "page": str(page),
            "random": _random_value(),
        }

    def parse_query_result(self, html: str) -> tuple[list[dict[str, str]], int]:
        soup = BeautifulSoup(html, "html.parser")
        root = soup.select_one(".flexigrid") or soup
        headers = _table_headers(root)
        if not headers:
            raise PortalError("锁班查询响应缺少表头")
        rows = _table_rows(root, headers)
        page_candidates = [1]
        for pattern in (
            r"(?:page=|changePage\s*\(\s*['\"]?)(\d+)",
            r"(?:共|总页数\s*[:：]?)\s*(\d+)\s*页?",
        ):
            page_candidates.extend(int(value) for value in re.findall(pattern, html, re.I))
        return rows, max(page_candidates)

    def query_records(self, employee_id: str, status: str) -> list[dict[str, str]]:
        first = self._post(QUERY_PATH, data=self._query_body(employee_id, status, 1))
        rows, page_count = self.parse_query_result(str(first.text or ""))
        for page in range(2, page_count + 1):
            response = self._post(QUERY_PATH, data=self._query_body(employee_id, status, page))
            page_rows, _ = self.parse_query_result(str(response.text or ""))
            rows.extend(page_rows)
        return rows

    @staticmethod
    def _same_query_identity(left: dict[str, str], right: dict[str, str]) -> bool:
        left_id = normalize_text(left.get("记录ID"))
        right_id = normalize_text(right.get("记录ID"))
        if left_id and right_id:
            return left_id == right_id
        fields = ("员工号", "姓名", "开始日期", "结束日期", "锁班类型", "录入时间")
        return all(normalize_text(left.get(field)) == normalize_text(right.get(field)) for field in fields)

    def perform_state_action(
        self,
        action: str,
        rows: list[dict[str, str]],
        reason: str,
    ) -> str:
        if action not in STATE_PATHS:
            raise PortalError(f"不支持的状态动作 {action}")
        if not rows:
            raise PortalError("状态动作缺少目标记录")
        ids = [normalize_text(row.get("记录ID")) for row in rows]
        if any(not record_id for record_id in ids):
            raise PortalError("目标记录缺少记录 ID")
        employee_id = normalize_text(rows[0].get("员工号"))
        data: list[tuple[str, str]] = [("ids", record_id) for record_id in ids]
        data.append(("approveRemark", reason))
        data.extend(self._query_body(employee_id, "", 1).items())
        response = self._post(STATE_PATHS[action], data=data)
        try:
            payload = response.json()
        except Exception as error:
            raise PortalError("状态动作响应不是有效 JSON") from error
        if not isinstance(payload, dict) or str(payload.get("success", "")).lower() != "true":
            message = normalize_text(payload.get("errorMsg") if isinstance(payload, dict) else "")
            raise PortalError(message or "门户状态动作失败")
        return normalize_text(payload.get("successMsg")) or "门户状态动作成功"

    def unlock_record(self, row: dict[str, str], reason: str) -> str:
        message = self.perform_state_action("unlock", [row], reason)
        employee_id = normalize_text(row.get("员工号"))
        locked_rows = self.query_records(employee_id, "已锁")
        if any(self._same_query_identity(candidate, row) for candidate in locked_rows):
            raise PortalError("门户提示解锁成功，但目标仍在已锁列表")
        unlocked_rows = self.query_records(employee_id, "已解锁")
        if not any(self._same_query_identity(candidate, row) for candidate in unlocked_rows):
            raise PortalError("解锁后未在已解锁列表中精确找到目标记录")
        return message
