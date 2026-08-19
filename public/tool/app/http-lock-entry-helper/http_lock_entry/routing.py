"""Quota routing and exact old-lock selection."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from .input_data import normalize_employee_id
from .metadata import normalize_text


SMART_LEAVE_TYPES = ("RECU_LVE", "ALV_FD")
ALTERNATE_LEAVE_TYPE = {"RECU_LVE": "ALV_FD", "ALV_FD": "RECU_LVE"}
QUOTA_REQUIRED_HEADERS = ("休假类型", "年份", "休假天数", "锁班天数", "解锁天数", "可休天数")


def parse_portal_date(value: object) -> date:
    match = re.match(r"^(\d{4}-\d{2}-\d{2})(?:\s|$)", normalize_text(value))
    if not match:
        raise ValueError(f"门户日期格式异常 [{normalize_text(value)}]")
    return datetime.strptime(match.group(1), "%Y-%m-%d").date()


def parse_quota_rows(headers: list[str], rows: list[list[str]]) -> list[dict[str, str]]:
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


def available_days_for_year(rows: list[dict[str, str]], year: int) -> int:
    matches = [row for row in rows if normalize_text(row.get("年份")) == str(year)]
    if not matches:
        raise ValueError(f"休假限制表没有{year}年数据")
    if len(matches) > 1:
        raise ValueError(f"休假限制表存在多条{year}年数据")
    value = normalize_text(matches[0].get("可休天数"))
    if not re.fullmatch(r"\d+", value):
        raise ValueError(f"可休天数不是非负整数 [{value}]")
    return int(value)


def route_record(record: dict[str, object], available_by_type: dict[str, int]) -> tuple[list[dict[str, object]], str]:
    start = date.fromisoformat(str(record["开始日期"]))
    end = date.fromisoformat(str(record["结束日期"]))
    requested_days = (end - start).days + 1
    primary_type = str(record["请假类型"])
    if primary_type not in SMART_LEAVE_TYPES:
        segment = dict(record)
        segment["计划天数"] = requested_days
        return [segment], ""

    alternate_type = ALTERNATE_LEAVE_TYPE[primary_type]
    primary_available = available_by_type.get(primary_type, 0)
    alternate_available = available_by_type.get(alternate_type, 0)
    if primary_available + alternate_available < requested_days:
        return [], f"两类可休天数合计{primary_available + alternate_available}天，少于需要{requested_days}天"

    segments = []
    cursor = start
    for lock_type, days in (
        (primary_type, min(primary_available, requested_days)),
        (alternate_type, max(0, requested_days - primary_available)),
    ):
        if days <= 0:
            continue
        segment_end = cursor + timedelta(days=days - 1)
        segment = dict(record)
        segment.update(
            {
                "请假类型": lock_type,
                "开始日期": cursor.isoformat(),
                "结束日期": segment_end.isoformat(),
                "计划天数": days,
            }
        )
        segments.append(segment)
        cursor = segment_end + timedelta(days=1)
    return segments, ""


def date_ranges_overlap(first_start: object, first_end: object, second_start: object, second_end: object) -> bool:
    left_start = parse_portal_date(first_start)
    left_end = parse_portal_date(first_end)
    right_start = parse_portal_date(second_start)
    right_end = parse_portal_date(second_end)
    if left_end < left_start or right_end < right_start:
        raise ValueError("锁班结束日期早于开始日期")
    return left_start <= right_end and right_start <= left_end


def choose_unlock_candidate(rows: list[dict[str, str]], record: dict[str, object]) -> tuple[dict[str, str] | None, str]:
    employee_id = normalize_employee_id(record.get("员工号"))
    candidates = []
    for row in rows:
        if normalize_employee_id(row.get("员工号")) != employee_id:
            continue
        if normalize_text(row.get("状态")) != "已锁":
            continue
        try:
            overlaps = date_ranges_overlap(
                row.get("开始日期"), row.get("结束日期"), record.get("开始日期"), record.get("结束日期")
            )
        except ValueError as error:
            return None, f"已锁候选日期异常: {error}"
        if overlaps:
            candidates.append(row)
    if not candidates:
        return None, "未找到员工号一致、状态已锁且日期重叠的旧锁班"
    if len(candidates) != 1:
        return None, f"找到{len(candidates)}条日期重叠的已锁记录，无法唯一定位"
    return candidates[0], ""


def same_query_record(left: dict[str, str], right: dict[str, str]) -> bool:
    fields = ("序号", "状态", "员工号", "姓名", "开始日期", "结束日期", "锁班类型", "录入时间")
    return all(normalize_text(left.get(field)) == normalize_text(right.get(field)) for field in fields)


def unlocked_record_note(row: dict[str, str]) -> str:
    return (
        f"已解锁：锁班名称{normalize_text(row.get('锁班名称'))}；"
        f"锁班原因{normalize_text(row.get('锁班原因'))}；"
        f"开始日期{normalize_text(row.get('开始日期'))}；"
        f"结束日期{normalize_text(row.get('结束日期'))}"
    )
