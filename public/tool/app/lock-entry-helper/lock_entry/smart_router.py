"""Smart leave quota validation and date segmentation."""

import re
from datetime import date, datetime, timedelta

from .common import (
    ALTERNATE_LEAVE_TYPE,
    QUOTA_REQUIRED_HEADERS,
    SMART_LEAVE_TYPES,
    normalize_date,
    normalize_text,
    parse_leave_type,
)
from .constants import LEAVE_CODE_TO_NAME, QUOTA_REQUIRED_HEADERS
from .smart_input import normalize_employee_id

def parse_iso_date(value, label: str = "日期") -> date:
    normalized = normalize_date(value)
    try:
        return datetime.strptime(normalized, "%Y-%m-%d").date()
    except (TypeError, ValueError) as error:
        raise ValueError(f"{label}格式错误 [{value or ''}]") from error


def validate_record(record: dict) -> str:
    employee_id = normalize_employee_id(record.get("员工号"))
    if not re.fullmatch(r"\d{6}", employee_id):
        return f"员工号格式错误 [{employee_id}]"
    leave_type = record.get("请假类型")
    if leave_type not in LEAVE_CODE_TO_NAME:
        return "未识别锁班类型"
    try:
        start = parse_iso_date(record.get("开始日期"), "开始日期")
        end = parse_iso_date(record.get("结束日期"), "结束日期")
    except ValueError as error:
        return str(error)
    if end < start:
        return "结束日期不得早于开始日期"
    if leave_type in SMART_LEAVE_TYPES and start.year != end.year:
        return "智能路由暂不处理跨自然年记录"
    return ""


def parse_quota_rows(headers: list, rows: list) -> list:
    normalized_headers = [normalize_text(value) for value in headers]
    missing = [header for header in QUOTA_REQUIRED_HEADERS if header not in normalized_headers]
    if missing:
        raise ValueError(f"休假限制表缺少表头: {', '.join(missing)}")

    parsed = []
    for row_index, values in enumerate(rows, start=1):
        normalized_values = [normalize_text(value) for value in values]
        if not any(normalized_values):
            continue
        if len(normalized_values) != len(normalized_headers):
            raise ValueError(
                f"休假限制表第{row_index}行列数异常: 表头{len(normalized_headers)}列，数据{len(normalized_values)}列"
            )
        parsed.append(dict(zip(normalized_headers, normalized_values)))
    return parsed


def parse_available_days(value) -> int:
    if isinstance(value, bool):
        raise ValueError(f"可休天数不是非负整数 [{value}]")
    if isinstance(value, int):
        if value < 0:
            raise ValueError(f"可休天数不是非负整数 [{value}]")
        return value
    text = normalize_text(value)
    if not re.fullmatch(r"\d+", text):
        raise ValueError(f"可休天数不是非负整数 [{text}]")
    return int(text)


def available_days_for_year(rows: list, year: int) -> int:
    matches = [row for row in rows if normalize_text(row.get("年份")) == str(year)]
    if not matches:
        raise ValueError(f"休假限制表没有{year}年数据")
    if len(matches) > 1:
        raise ValueError(f"休假限制表存在多条{year}年数据")
    return parse_available_days(matches[0].get("可休天数"))


def route_record(record: dict, available_by_type: dict) -> tuple:
    problem = validate_record(record)
    if problem:
        return [], problem

    primary_type = record["请假类型"]
    start = parse_iso_date(record["开始日期"], "开始日期")
    end = parse_iso_date(record["结束日期"], "结束日期")
    requested_days = (end - start).days + 1
    if primary_type not in SMART_LEAVE_TYPES:
        return [{
            "员工号": record.get("员工号"),
            "姓名": record.get("姓名"),
            "请假类型": primary_type,
            "开始日期": start.strftime("%Y-%m-%d"),
            "结束日期": end.strftime("%Y-%m-%d"),
            "计划天数": requested_days,
        }], ""

    alternate_type = ALTERNATE_LEAVE_TYPE[primary_type]
    try:
        primary_available = parse_available_days(available_by_type.get(primary_type, 0))
        alternate_available = parse_available_days(available_by_type.get(alternate_type, 0))
    except ValueError as error:
        return [], str(error)

    combined_available = primary_available + alternate_available
    if combined_available < requested_days:
        return [], (
            f"两类可休天数合计{combined_available}天，少于需要{requested_days}天；"
            f"{leave_type_name(primary_type)}{primary_available}天，"
            f"{leave_type_name(alternate_type)}{alternate_available}天"
        )

    primary_days = min(primary_available, requested_days)
    alternate_days = requested_days - primary_days
    segments = []
    cursor = start
    for leave_type, days in (
        (primary_type, primary_days),
        (alternate_type, alternate_days),
    ):
        if days <= 0:
            continue
        segment_end = cursor + timedelta(days=days - 1)
        segments.append({
            "员工号": record.get("员工号"),
            "姓名": record.get("姓名"),
            "请假类型": leave_type,
            "开始日期": cursor.strftime("%Y-%m-%d"),
            "结束日期": segment_end.strftime("%Y-%m-%d"),
            "计划天数": days,
        })
        cursor = segment_end + timedelta(days=1)
    return segments, ""
