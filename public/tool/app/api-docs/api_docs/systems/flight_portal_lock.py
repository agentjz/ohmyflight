from __future__ import annotations

import re
from calendar import monthrange
from datetime import datetime
from typing import Callable


def required(supplied: dict[str, object], name: str, label: str) -> str:
    value = str(supplied.get(name, "") or "").strip()
    if not value:
        raise ValueError(f"请填写{label}")
    return value


def _repeatable_values(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item for item in re.split(r"[,，\s]+", str(value or "").strip()) if item]


def _datetime(value: str) -> datetime:
    try:
        return datetime.strptime(value.replace("T", " "), "%Y-%m-%d %H:%M")
    except ValueError as error:
        raise ValueError("日期时间格式应为 YYYY-MM-DD HH:mm") from error


def _time(value: str) -> datetime:
    try:
        return datetime.strptime(value, "%H:%M")
    except ValueError as error:
        raise ValueError("时间格式应为 HH:mm") from error


def build_submit_form(
    supplied: dict[str, object],
    option: dict[str, str],
    identity: dict[str, str],
    random_value: Callable[[], str],
) -> list[tuple[str, str]]:
    staff_number = required(supplied, "staffnum", "员工号")
    lock_type = required(supplied, "lockType", "锁班类型")
    lock_mode = required(supplied, "lockTimeType", "时间模式")
    remark = required(supplied, "lockRemark", "锁班原因")
    if len(remark) > 60:
        raise ValueError("锁班原因不能超过 60 个字符")
    if lock_mode not in {"1", "2"}:
        raise ValueError("时间模式无效")
    if lock_mode == "2" and (option["limitFlag"] == "1" or lock_type in {"ALV_FD", "CRM"}):
        raise ValueError("当前锁班类型只支持按连续时间段")

    if lock_mode == "1":
        start = _datetime(required(supplied, "startDt", "开始日期时间"))
        end = _datetime(required(supplied, "endDt", "结束日期时间"))
        if end <= start:
            raise ValueError("结束日期时间必须晚于开始日期时间")
        schedule_fields = [
            ("startDt", start.strftime("%Y-%m-%d %H:%M")),
            ("endDt", end.strftime("%Y-%m-%d %H:%M")),
            ("lockDays", str((end.date() - start.date()).days + 1)),
            ("lockTimeType", "1"),
            ("lockYearAndMonth", ""),
            ("lockStartHourAndMinute", ""),
            ("lockEndHourAndMinute", ""),
        ]
    else:
        year_month = required(supplied, "lockYearAndMonth", "锁班月份")
        try:
            year, month = (int(part) for part in year_month.split("-", 1))
            last_day = monthrange(year, month)[1]
        except (TypeError, ValueError) as error:
            raise ValueError("锁班月份格式应为 YYYY-MM") from error
        days = _repeatable_values(supplied.get("lockDaysNum"))
        if not days:
            raise ValueError("请选择月份内日期")
        if any(not day.isdigit() or not 1 <= int(day) <= last_day for day in days):
            raise ValueError("月份内日期超出所选月份范围")
        start_time = _time(required(supplied, "lockStartHourAndMinute", "每日开始时间"))
        end_time = _time(required(supplied, "lockEndHourAndMinute", "每日结束时间"))
        if end_time <= start_time:
            raise ValueError("每日结束时间必须晚于开始时间")
        schedule_fields = [
            ("startDt", ""),
            ("endDt", ""),
            ("lockDays", str(len(days))),
            ("lockTimeType", "2"),
            ("lockYearAndMonth", f"{year:04d}-{month:02d}"),
            *(("lockDaysNum", str(int(day))) for day in days),
            ("lockStartHourAndMinute", start_time.strftime("%H:%M")),
            ("lockEndHourAndMinute", end_time.strftime("%H:%M")),
        ]

    return [
        ("staffnum", staff_number),
        ("lockType", lock_type),
        ("dateSplitFlag", option["dateSplitFlag"]),
        ("lockRemark", remark),
        *schedule_fields,
        ("lockTypeDesc", option["label"]),
        ("chnName", identity["name"]),
        ("orgUnitName", identity["department"]),
        ("random", random_value()),
    ]
