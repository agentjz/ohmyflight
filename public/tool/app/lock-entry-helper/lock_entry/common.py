# 锁班乞丐 - 智能路由助手

import re
import platform
import os
from datetime import date, datetime, timedelta
from colorama import init, Fore, Style

from .constants import *

init()  # 初始化colorama

def beep_error():
    """错误提示音"""
    try:
        if platform.system() == 'Windows':
            import winsound
            winsound.Beep(800, 300)
        else:
            os.system('paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga 2>/dev/null || true')
    except:
        pass


def parse_leave_type(text: str) -> str:
    """解析锁班类型，支持代码或中文名"""
    if not text:
        return None
    text = str(text).strip()
    # 直接是代码
    if text in LEAVE_CODE_TO_NAME:
        return text
    # 完整格式 "CODE-中文名"
    if text in LEAVE_TYPE_MAP:
        return LEAVE_TYPE_MAP[text]
    # 从整行文本里提取代码。
    code_match = LEAVE_CODE_PATTERN.search(text)
    if code_match:
        return code_match.group(1)
    # 从整行文本里提取完整格式，优先匹配更长的名称
    for key, code in sorted(LEAVE_TYPE_MAP.items(), key=lambda item: len(item[0]), reverse=True):
        if key in text:
            return code
    # 只有中文名，模糊匹配
    for key, code in sorted(LEAVE_TYPE_MAP.items(), key=lambda item: len(item[0]), reverse=True):
        name_part = key.split('-', 1)[1] if '-' in key else key
        if name_part in text or text in name_part:
            return code
    return None


def c_info(text):
    return f"{Fore.CYAN}{text}{Style.RESET_ALL}"


def c_ok(text):
    return f"{Fore.GREEN}{text}{Style.RESET_ALL}"


def c_err(text):
    return f"{Fore.RED}{text}{Style.RESET_ALL}"


def c_warn(text):
    return f"{Fore.YELLOW}{text}{Style.RESET_ALL}"


def c_hint(text):
    return f"{Fore.MAGENTA}{text}{Style.RESET_ALL}"


def parse_whitelist(text: str) -> set:
    """解析员工号白名单"""
    all_nums = re.findall(r'\d{6}', re.sub(r'\D', ' ', text))
    if all_nums:
        return set(all_nums)
    text = re.sub(r'\D', '', text)
    return set(text[i:i+6] for i in range(0, len(text), 6) if len(text[i:i+6]) == 6)


def normalize_text(value) -> str:
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def normalize_date(date_str) -> str:
    """把各种日期格式统一转成YYYY-MM-DD"""
    if date_str is None:
        return ""
    if isinstance(date_str, (datetime, date)):
        return date_str.strftime('%Y-%m-%d')
    date_str = str(date_str).strip()
    compact_date = re.fullmatch(r"(\d{4})(\d{2})(\d{2})", date_str)
    if compact_date:
        return "-".join(compact_date.groups())
    separated_date = re.fullmatch(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", date_str)
    if separated_date:
        year, month, day = separated_date.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return date_str


def leave_type_name(leave_type: str) -> str:
    display = LEAVE_CODE_TO_NAME.get(leave_type, leave_type or "")
    return display.split('-', 1)[1] if '-' in display else display


def normalize_person_name(name: str) -> str:
    text = normalize_text(name).upper()
    text = re.sub(r'[（(][^）)]*[）)]', '', text)
    return re.sub(r'\s+', ' ', text).strip()


def names_match(expected: str, actual: str) -> bool:
    if not expected or not actual:
        return True
    return normalize_person_name(expected) == normalize_person_name(actual)


def leave_types_match(expected_code: str, actual_text: str) -> bool:
    if not actual_text:
        return True
    actual_code = parse_leave_type(actual_text)
    if actual_code:
        return actual_code == expected_code
    expected_name = leave_type_name(expected_code)
    return bool(expected_name and expected_name in normalize_text(actual_text))


def same_day(left, right) -> bool:
    return normalize_date(str(left or '')[:10]) == normalize_date(str(right or '')[:10])


def is_row_number(value: str) -> bool:
    return bool(re.fullmatch(r'\d{1,4}', normalize_text(value)))


def align_table_values(headers: list, values: list) -> list:
    if headers and values and len(values) == len(headers) + 1 and is_row_number(values[0]) and headers[0] != "序号":
        return values[1:]
    return values


def table_headers(page, selector: str) -> list:
    cells = page.locator(selector)
    headers = []
    for index in range(cells.count()):
        try:
            text = normalize_text(cells.nth(index).inner_text(timeout=1000))
        except Exception:
            text = ""
        if text:
            headers.append(text)
    return headers


def table_rows(page, selector: str, headers: list) -> list:
    row_locs = page.locator(selector)
    rows = []
    for row_index in range(row_locs.count()):
        row = row_locs.nth(row_index)
        cell_locs = row.locator("td")
        values = []
        for cell_index in range(cell_locs.count()):
            try:
                values.append(normalize_text(cell_locs.nth(cell_index).inner_text(timeout=1000)))
            except Exception:
                values.append("")
        if not values:
            try:
                values = [normalize_text(row.inner_text(timeout=1000))]
            except Exception:
                values = []
        else:
            values = align_table_values(headers, values)
        row_map = {}
        for index, value in enumerate(values):
            key = headers[index] if index < len(headers) else f"列{index + 1}"
            row_map[key] = value
        row_map["_text"] = " | ".join(value for value in values if value)
        rows.append(row_map)
    return rows


def no_related_info(row: dict) -> bool:
    return "没有相关信息" in row.get("_text", "")


def result_row_matches_record(row: dict, record: dict) -> bool:
    if no_related_info(row):
        return False

    row_text = row.get("_text", "")
    employee_id = record.get("员工号", "")
    name = record.get("姓名", "")
    start_date = record.get("开始日期", "")
    end_date = record.get("结束日期", "")
    expected_type = record.get("请假类型", "")

    result_employee_id = row.get("员工号", "")
    result_name = row.get("姓名", "")
    result_start = row.get("开始日期", "")
    result_end = row.get("结束日期", "")
    result_type = row.get("锁班类型", "")

    if result_employee_id:
        if result_employee_id != employee_id:
            return False
    elif employee_id not in row_text:
        return False

    if name:
        if result_name:
            if not names_match(name, result_name):
                return False
        elif name not in row_text:
            return False

    if not leave_types_match(expected_type, result_type):
        return False
    if not result_type and leave_type_name(expected_type) not in row_text:
        return False

    if result_start:
        if not same_day(result_start, start_date):
            return False
    elif start_date not in row_text:
        return False

    if result_end:
        if not same_day(result_end, end_date):
            return False
    elif end_date not in row_text:
        return False

    return True


def first_matching_row(rows: list, record: dict) -> dict | None:
    for row in rows:
        if result_row_matches_record(row, record):
            return row
    return None


def format_record(r):
    """格式化记录显示"""
    name = r['姓名'] or '未知'
    return f"{r['员工号']} {name} {r['请假类型']} {r['开始日期']}~{r['结束日期']}"


def format_reason_preview(reason_text: str, limit: int = 18) -> str:
    """格式化备注预览文字"""
    preview = reason_text.replace('\n', ' / ')
    if len(preview) > limit:
        return preview[:limit] + "..."
    return preview


def whitelist_status(whitelist):
    """返回白名单状态文字"""
    if whitelist:
        return c_ok(f"白名单:{len(whitelist)}人")
    return c_warn("白名单:无")


def reason_status(reason_text):
    """返回统一备注状态文字"""
    if reason_text:
        return c_ok(f"备注:{format_reason_preview(reason_text)}")
    return c_warn("备注:无")
