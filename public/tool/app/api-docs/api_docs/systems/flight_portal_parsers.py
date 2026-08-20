from __future__ import annotations

import json
import re

from bs4 import BeautifulSoup, Tag

from .errors import ExecutionError


def _text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _element_text(element: Tag) -> str:
    return _text(element.get_text(" ", strip=True))


def _cell_text(cell: Tag) -> str:
    titled = cell.select_one("[title]")
    title = _text(titled.get("title")) if titled is not None else ""
    return title or _element_text(cell)


def validate_query_page(html: str, status_code: int, expected_action: str) -> None:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    form = soup.select_one("#showflyTimeExperienceQueryForm")
    if status_code != 200 or form is None or form.get("action") != expected_action:
        raise ExecutionError("Cookie 验证页没有返回有效的飞行经历查询表单")


def parse_lock_types(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    if soup.select_one("#nonproductionTaskImportForm") is None:
        raise ExecutionError("录入页没有返回有效表单")
    options: list[dict[str, str]] = []
    for option in soup.select("#lockType option[value]"):
        code = _text(option.get("value"))
        if not code:
            continue
        visible = _element_text(option)
        label = re.sub(rf"^【{re.escape(code)}】\s*", "", visible).strip() or visible
        classes = option.get("class") or []
        options.append({
            "value": code,
            "label": label,
            "displayLabel": visible,
            "limitFlag": str(classes[0] if classes else ""),
            "dateSplitFlag": _text(option.get("id")),
        })
    if not options:
        raise ExecutionError("录入页没有返回锁班类型")
    return options


def parse_employee_identity(body: str) -> dict[str, str]:
    try:
        payload = json.loads(str(body or ""))
    except json.JSONDecodeError as error:
        raise ExecutionError("员工校验没有返回有效 JSON") from error
    if not isinstance(payload, dict) or str(payload.get("permissionFlag", "")).lower() != "true":
        message = _text(payload.get("errorMsg") or payload.get("msg") or payload.get("message")) if isinstance(payload, dict) else ""
        raise ExecutionError(message or "员工校验未通过")
    name = _text(payload.get("nameInfo"))
    department = _text(payload.get("deptInfo"))
    if not name or not department:
        raise ExecutionError("员工校验响应缺少姓名或部门")
    return {"name": name, "department": department}


def _headers(root: Tag) -> list[str]:
    for selector in ("thead th", ".hDiv th", "tr th"):
        values = [_element_text(cell) for cell in root.select(selector)]
        if values and any(values):
            normalized = [value or ("选择" if index == 0 else f"列{index + 1}") for index, value in enumerate(values)]
            if len(set(normalized)) != len(normalized):
                raise ExecutionError("门户结果表存在重复表头")
            return normalized
    return []


def _rows(root: Tag, columns: list[str]) -> list[dict[str, str]]:
    nodes: list[Tag] = []
    for selector in (".bDiv tbody tr", "tbody.list tr", "tbody tr"):
        nodes = list(root.select(selector))
        if nodes:
            break
    rows: list[dict[str, str]] = []
    active: dict[int, tuple[str, int]] = {}
    for node in nodes:
        cells = node.select(":scope > td")
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
                raise ExecutionError("门户表格合并单元格参数异常") from error
            for offset in range(colspan):
                values.append(value)
                if rowspan > 1:
                    active[column + offset] = (value, rowspan - 1)
            column += colspan
        while column < len(columns):
            if column in active:
                consume_active()
            else:
                values.append("")
                column += 1
        if not values or "没有相关信息" in " | ".join(values):
            continue
        if len(values) == len(columns) + 1 and re.fullmatch(r"\d{1,5}", values[0] or ""):
            values = values[1:]
        if len(values) != len(columns):
            raise ExecutionError("门户结果表头与数据列数不一致")
        rows.append(dict(zip(columns, values)))
    return rows


def _table_data(root: Tag) -> tuple[list[str], list[dict[str, str]]]:
    columns = _headers(root)
    if not columns:
        return [], []
    return columns, _rows(root, columns)


def parse_flight_result(html: str, staff_number: str) -> dict[str, object]:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    parsed = next(
        (table for table in (_table_data(item) for item in soup.select("table")) if "员工号" in table[0]),
        None,
    )
    if parsed is None:
        raise ExecutionError("飞行经历响应没有返回有效结果表")
    columns, rows = parsed
    matches = [row for row in rows if row.get("员工号") == staff_number]
    if len(matches) != 1:
        raise ExecutionError("飞行经历结果无法按员工号唯一归属")
    return {
        "summary": {"recordCount": 1},
        "tables": [{
            "id": "flight-stats",
            "title": "飞行经历查询结果",
            "columns": columns,
            "rows": matches,
        }],
    }


def _section_data(soup: BeautifulSoup, selector: str) -> tuple[list[str], list[dict[str, str]]]:
    section = soup.select_one(selector)
    if section is None:
        raise ExecutionError(f"门户响应缺少结果区域 {selector}")
    columns, rows = _table_data(section)
    if not columns:
        raise ExecutionError(f"门户响应的结果区域 {selector} 缺少表头")
    return columns, rows


def parse_lock_result(html: str) -> dict[str, object]:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    results = _section_data(soup, "#showNonproductionTaskImportResultPage1")
    conflicts = _section_data(soup, "#showNonproductionTaskImportResultPage2")
    result_count = len(results[1])
    conflict_count = len(conflicts[1])
    outcome = "存在锁班冲突" if conflict_count else "已返回锁班结果" if result_count else "未返回锁班结果"
    return {
        "summary": {
            "resultCount": result_count,
            "conflictCount": conflict_count,
            "outcome": outcome,
        },
        "tables": [
            {"id": "results", "title": "普通结果", "columns": results[0], "rows": results[1]},
            {"id": "conflicts", "title": "冲突结果", "columns": conflicts[0], "rows": conflicts[1]},
        ],
    }


def parse_personnel_basic(body: str) -> dict[str, object]:
    try:
        payload = json.loads(str(body or ""))
    except json.JSONDecodeError as error:
        raise ExecutionError("基础信息接口未返回有效 JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("empDto"), dict):
        raise ExecutionError("基础信息接口返回结构异常")
    tables = []
    for key, title in (
        ("empDto", "基本信息"),
        ("eduList", "教育经历"),
        ("workList", "工作经历"),
        ("titleList", "职称信息"),
        ("relationList", "家庭信息"),
    ):
        value = payload.get(key)
        if isinstance(value, dict):
            rows = [value]
        elif isinstance(value, list):
            rows = [item for item in value if isinstance(item, dict)]
        else:
            rows = []
        columns = list(rows[0].keys()) if rows else []
        tables.append({"id": key, "title": title, "columns": columns, "rows": rows})
    return {"summary": {"sectionCount": len(tables), "recordCount": sum(len(table["rows"]) for table in tables)}, "tables": tables}


def parse_personnel_html(html: str, selector: str, table_id: str, title: str) -> dict[str, object]:
    columns, rows = _section_data(BeautifulSoup(str(html or ""), "html.parser"), selector)
    return {"summary": {"recordCount": len(rows)}, "tables": [{"id": table_id, "title": title, "columns": columns, "rows": rows}]}
