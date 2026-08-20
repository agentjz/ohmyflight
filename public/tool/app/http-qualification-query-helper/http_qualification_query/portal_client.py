from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, Tag

from .credentials import credential_summary, parse_credentials
from .models import QueryRecord, QueryResult


BASE_URL = "https://ieb.csair.com"
VERIFY_PATH = "/newieb/basics/showEmpprofileCompositeListPageNew"
EMPLOYEE_PATH = "/newieb/basics/showEmpProfileCompositeResult"
BASIC_INFO_PATH = "/newieb/hrInfo/showEmpInfo"
TECHNICAL_PATH = "/newieb/basics/qualList"
OPERATION_PATH = "/newieb/basics/showSingleEmpOperQualListByempIdNew"
TRAINING_RECORD_PATH = "/newieb/basics/trainingRecordList"
TRAINING_EXPERIENCE_PATH = "/newieb/basics/trainResultList"
TECHNICAL_HEADERS = [
    "#", "技术等级代码", "技术等级", "水平等级", "机型", "生效时间", "失效时间", "对应检查记录", "数据来源",
]
OPERATION_HEADERS = ["类型", "运行资格代码", "运行资格", "水平等级", "机型", "生效时间", "失效时间", "备注"]
TRAINING_RECORD_HEADERS = [
    "选择", "培训科目", "培训机型", "培训课时", "培训地点", "经办人", "教员",
    "培训时间", "培训結束时间", "训练结果", "考试成绩", "上传",
]
TRAINING_EXPERIENCE_HEADERS = [
    "全选", "序号", "训练日期", "训练机型", "训练科目", "类型", "检查单",
    "结论", "上传", "审批过程", "证书下载",
]
BASIC_INFO_FIELDS = [
    ("出生日期", "birthDate"), ("出生地", "birthPlace"), ("籍贯", "nativePlace"),
    ("国籍", "nationality"), ("民族", "nation"), ("户籍地", "residence"),
    ("户口性质", "typeOfResidence"), ("参加工作", "dateOfWork"), ("工作单位", "orgUnitId"),
    ("进入南航时间", "dateOfHire"), ("工作岗位", "position"), ("职务级别", "appointRank"),
    ("合同到期", "enddate"), ("空勤资格", "qualification"), ("用工类型", "statusType"),
    ("政治面貌", "politicalStand"), ("入党时间", "partydate"), ("健康状况", "health"),
    ("婚姻状况", "marrigeStatus"), ("身份证号", "identityNum"), ("手机号码", "mobile"),
]
SECTION_FIELDS = {
    "教育经历": [("学校", "school"), ("开始时间", "beginDate"), ("结束时间", "endDate"), ("学历", "education"), ("专业", "major"), ("学习方式", "studymode")],
    "工作经历": [("部门", "workDept"), ("开始时间", "beginDate"), ("结束时间", "endDate"), ("岗位", "workPost")],
    "职称信息": [("职称名称", "techposttitle"), ("开始时间", "beginDate"), ("结束时间", "endDate"), ("职称等级", "titlerank"), ("获得成就", "achive")],
    "家庭信息": [("姓名", "memName"), ("与本人关系", "memRelation"), ("出生日期", "memBirthday"), ("政治面貌", "politics"), ("工作单位", "memCorp"), ("职务", "memJob")],
}
INTERACTIVE_TITLE_TAGS = {"a", "button", "input", "select", "textarea"}


class PortalError(RuntimeError):
    pass


class PortalSessionExpired(PortalError):
    pass


def _text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def _cell_text(cell: Tag) -> str:
    own_title = _text(cell.get("title"))
    if own_title:
        return own_title
    for titled in cell.select("[title]"):
        if titled.name in INTERACTIVE_TITLE_TAGS:
            continue
        nested_title = _text(titled.get("title"))
        if nested_title:
            return nested_title
    return _text(cell.get_text(" ", strip=True))


def _is_login_response(response: object) -> bool:
    path = urlparse(str(getattr(response, "url", "") or "")).path.lower()
    html = str(getattr(response, "text", "") or "")
    if path == "/login":
        return True
    soup = BeautifulSoup(html, "html.parser")
    return bool(soup.select_one("#scanLogin, form[action*='login'], input[name='password']"))


def _expanded_rows(table: Tag, cell_name: str, expected_columns: int = 0) -> list[list[str]]:
    active: dict[int, tuple[str, int]] = {}
    parsed: list[list[str]] = []
    for row in table.find_all("tr"):
        cells = row.find_all(cell_name, recursive=False)
        if not cells:
            continue
        values: list[str] = []
        column = 0

        def consume_active() -> None:
            nonlocal column
            value, rows_left = active[column]
            values.append(value)
            if rows_left <= 1:
                del active[column]
            else:
                active[column] = (value, rows_left - 1)
            column += 1

        for cell in cells:
            while column in active:
                consume_active()
            value = _cell_text(cell)
            try:
                rowspan = max(1, int(cell.get("rowspan") or 1))
                colspan = max(1, int(cell.get("colspan") or 1))
            except (TypeError, ValueError) as error:
                raise PortalError("门户表格合并单元格参数异常") from error
            for offset in range(colspan):
                values.append(value)
                if rowspan > 1:
                    active[column + offset] = (value, rowspan - 1)
            column += colspan

        limit = expected_columns or max([column, *(key + 1 for key in active)], default=column)
        while column < limit:
            if column in active:
                consume_active()
            else:
                values.append("")
                column += 1
        parsed.append(values)
    return parsed


def _table_data(root: Tag) -> tuple[list[str], list[dict[str, str]]]:
    tables = list(root.find_all("table"))
    header_table = next((table for table in tables if table.find("th") is not None), None)
    if header_table is None:
        return [], []
    header_rows = _expanded_rows(header_table, "th")
    headers = header_rows[0] if header_rows else []
    headers = [value or ("选择" if index == 0 else f"列{index + 1}") for index, value in enumerate(headers)]
    if not headers:
        return [], []
    if len(set(headers)) != len(headers):
        raise PortalError("门户表格存在重复表头")

    data_table = next((table for table in tables if table.find("td") is not None), None)
    if data_table is None:
        return headers, []
    rows: list[dict[str, str]] = []
    for values in _expanded_rows(data_table, "td", len(headers)):
        row_text = " | ".join(value for value in values if value)
        if not row_text or "没有相关信息" in row_text:
            continue
        if len(values) != len(headers):
            raise PortalError("门户表格表头与数据列数不一致")
        rows.append(dict(zip(headers, values)))
    return headers, rows


def _normalize_name(value: str) -> str:
    without_note = re.sub(r"[（(][^）)]*[）)]", "", str(value or ""))
    return re.sub(r"\s+", "", without_note)


def parse_employee_identity(html: str, employee_id: str, expected_name: str = "") -> dict[str, str]:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    roots = list(soup.select(".flexigrid")) or [soup]
    candidates: list[dict[str, str]] = []
    for root in roots:
        headers, rows = _table_data(root)
        if "员工号" not in headers or "姓名" not in headers:
            continue
        candidates.extend(row for row in rows if row.get("员工号") == employee_id)
    if len(candidates) != 1:
        raise PortalError("人员检索结果无法按员工号唯一归属")
    page_name = _text(candidates[0].get("姓名"))
    if not page_name:
        raise PortalError("人员检索结果缺少姓名")
    if expected_name and _normalize_name(expected_name) != _normalize_name(page_name):
        raise PortalError("姓名不匹配：页面返回人员与输入姓名不一致")
    return {"employeeId": employee_id, "name": page_name}


def parse_detail_table(
    html: str,
    selector: str,
    expected_headers: list[str] | None = None,
) -> list[dict[str, str]]:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    root = soup.select_one(selector)
    if root is None:
        raise PortalError(f"门户响应缺少结果区域 {selector}")
    headers, rows = _table_data(root)
    if not headers:
        raise PortalError(f"门户响应的结果区域 {selector} 缺少表头")
    if expected_headers is not None and headers != expected_headers:
        raise PortalError(f"门户响应的结果区域 {selector} 表头异常：{headers}")
    return rows


def _mapped_rows(payload: object, fields: list[tuple[str, str]], section: str) -> list[dict[str, str]]:
    if payload is None:
        return []
    if not isinstance(payload, list) or any(not isinstance(item, dict) for item in payload):
        raise PortalError(f"门户基础信息的{section}结构异常")
    return [
        {label: _text(item.get(source)) for label, source in fields}
        for item in payload
    ]


def parse_basic_payload(payload: object) -> dict[str, object]:
    if not isinstance(payload, dict) or not isinstance(payload.get("empDto"), dict):
        raise PortalError("门户基础信息响应结构异常")
    employee = payload["empDto"]
    return {
        "基本信息": {label: _text(employee.get(source)) for label, source in BASIC_INFO_FIELDS},
        "教育经历": _mapped_rows(payload.get("eduList"), SECTION_FIELDS["教育经历"], "教育经历"),
        "工作经历": _mapped_rows(payload.get("workList"), SECTION_FIELDS["工作经历"], "工作经历"),
        "职称信息": _mapped_rows(payload.get("titleList"), SECTION_FIELDS["职称信息"], "职称信息"),
        "家庭信息": _mapped_rows(payload.get("relationList"), SECTION_FIELDS["家庭信息"], "家庭信息"),
    }


def _reported_last_page(html: str) -> int:
    pages = [int(value) for value in re.findall(r"goPageTwo\([^)]*['\"](\d+)['\"]\s*,\s*true\)", html)]
    return max(pages, default=1)


def parse_training_record_pages(fetch_page: Any) -> list[dict[str, str]]:
    first_html = str(fetch_page(1) or "")
    last_page = _reported_last_page(first_html)
    rows: list[dict[str, str]] = []
    for page in range(1, last_page + 1):
        html = first_html if page == 1 else str(fetch_page(page) or "")
        page_rows = parse_detail_table(html, "#showTrainingRecordListDiv", TRAINING_RECORD_HEADERS)
        rows.extend({**row, "来源页码": str(page)} for row in page_rows)
    return rows


def build_employee_query_params(employee_id: str, current_str: str | None = None) -> list[tuple[str, str]]:
    return [
        ("personName", employee_id),
        ("staffNumAllDesc", ""),
        ("primaryBaseArray", ""),
        ("baseArray", ""),
        ("techBase", ""),
        ("bolMultiQualCd", ""),
        ("bolPriBase", ""),
        ("bolJCY", ""),
        ("activeStatusArray", "ZAIZHI"),
        ("activeStatusArray", "WAIBU"),
        ("fleetCdbranch", ""),
        ("isOperQual", "Y"),
        ("operQualArray", ""),
        ("page", "1"),
        ("currentStr", current_str or str(int(time.time() * 1000))),
    ]


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
        self.cookies: dict[str, str] = {}
        self.verified_at = ""
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
                "Accept": "text/html, */*; q=0.01",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Origin": self.base_url,
                "Referer": f"{self.base_url}/index/index",
                "X-Requested-With": "XMLHttpRequest",
            }
        )

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _check_response(self, response: object) -> object:
        try:
            response.raise_for_status()  # type: ignore[attr-defined]
        except Exception as error:
            status = getattr(response, "status_code", "未知")
            raise PortalError(f"飞行门户 HTTP 请求失败（状态 {status}）") from error
        if _is_login_response(response):
            raise PortalSessionExpired("登录凭据已失效，请重新从已登录门户复制凭据")
        return response

    def _get(self, path: str, *, params: object) -> object:
        try:
            response = self.session.get(self._url(path), params=params, timeout=self.timeout)
        except requests.RequestException as error:
            raise PortalError(f"无法连接飞行门户：{error.__class__.__name__}") from error
        return self._check_response(response)

    def _post(
        self,
        path: str,
        *,
        data: dict[str, str] | None = None,
        files: dict[str, tuple[None, str]] | None = None,
    ) -> object:
        try:
            response = self.session.post(self._url(path), data=data, files=files, timeout=self.timeout)
        except requests.RequestException as error:
            raise PortalError(f"飞行门户请求失败：{error.__class__.__name__}") from error
        return self._check_response(response)

    def load_credentials(self, source: str) -> dict[str, object]:
        cookies = parse_credentials(source)
        self.session.cookies.clear()
        for name, value in cookies.items():
            self.session.cookies.set(name, value, domain="ieb.csair.com", path="/")
        response = self._get(VERIFY_PATH, params={"random": str(time.time_ns())})
        soup = BeautifulSoup(str(getattr(response, "text", "") or ""), "html.parser")
        if soup.select_one("#showEmpProfileCompositeListPageForm") is None:
            self.cookies = {}
            raise PortalSessionExpired("凭据未进入技术资料查询页，请重新复制已登录请求")
        self.cookies = cookies
        self.verified_at = datetime.now().isoformat(timespec="seconds")
        return {**credential_summary(cookies), "verifiedAt": self.verified_at}

    def require_credentials(self) -> None:
        if not self.cookies:
            raise PortalSessionExpired("请先验证登录凭据")

    def query(self, record: QueryRecord) -> QueryResult:
        self.require_credentials()
        employee_response = self._get(EMPLOYEE_PATH, params=build_employee_query_params(record.employee_id))
        identity = parse_employee_identity(
            str(getattr(employee_response, "text", "") or ""),
            record.employee_id,
            record.name,
        )
        basic_response = self._post(BASIC_INFO_PATH, files={"staffNum": (None, record.employee_id)})
        try:
            basic_payload = basic_response.json()  # type: ignore[attr-defined]
        except Exception as error:
            raise PortalError("门户基础信息未返回有效 JSON") from error
        basic = parse_basic_payload(basic_payload)
        technical_response = self._post(
            TECHNICAL_PATH,
            data={"staffNum": record.employee_id, "currentStr": str(int(time.time() * 1000))},
        )
        operation_response = self._post(
            OPERATION_PATH,
            data={"empid": record.employee_id, "currentStr": str(int(time.time() * 1000))},
        )
        technical_rows = parse_detail_table(
            str(getattr(technical_response, "text", "") or ""),
            "#qualList",
            TECHNICAL_HEADERS,
        )
        operation_rows = parse_detail_table(
            str(getattr(operation_response, "text", "") or ""),
            "#showSingleEmpOperQualList",
            OPERATION_HEADERS,
        )
        training_rows = parse_training_record_pages(
            lambda page: str(getattr(self._post(
                TRAINING_RECORD_PATH,
                data={
                    "page": str(page), "staffId": record.employee_id, "fuzzyQuery": "true",
                    "newMachineId": "", "trainName": "",
                },
            ), "text", "") or "")
        )
        experience_response = self._post(
            TRAINING_EXPERIENCE_PATH,
            data={"staffNum": record.employee_id, "trainName": ""},
        )
        experience_rows = [
            {**row, "来源页码": "1"}
            for row in parse_detail_table(
                str(getattr(experience_response, "text", "") or ""),
                "#trainResultList, #empProfile_trainResultList",
                TRAINING_EXPERIENCE_HEADERS,
            )
        ]
        return QueryResult(
            page_name=identity["name"],
            technical_rows=technical_rows,
            operation_rows=operation_rows,
            basic_info=basic["基本信息"],
            education_rows=basic["教育经历"],
            work_rows=basic["工作经历"],
            title_rows=basic["职称信息"],
            family_rows=basic["家庭信息"],
            training_record_rows=training_rows,
            training_experience_rows=experience_rows,
        )

    def clear_credentials(self) -> None:
        self.cookies = {}
        self.verified_at = ""
        self.session.cookies.clear()

    def close(self) -> None:
        self.clear_credentials()
        self.session.close()
