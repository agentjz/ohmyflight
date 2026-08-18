"""Smart portal form, quota table, and conflict recovery actions."""

from .common import *
from .smart_input import *
from .smart_router import *
from .constants import LOCK_QUERY_REQUIRED_HEADERS

def clear_form(page):
    """清空表单"""
    page.locator("#showIdshowNonproductionTaskImportPage").fill("")
    page.locator("#lockStartTime").fill("")
    page.locator("#lockEndTime").fill("")
    clear_reason_field(page)


def clear_reason_field(page):
    """尽量清空备注框，避免沿用上一条记录的备注"""
    reason_input = page.locator("#lockReasonTxt")
    if reason_input.count() == 0:
        return
    try:
        reason_input.scroll_into_view_if_needed()
        reason_input.click()
        page.wait_for_timeout(100)
        reason_input.fill("")
        page.wait_for_timeout(100)
    except Exception:
        pass


def fill_reason_field(page, reason_text):
    """按门户校验要求填写备注"""
    if not reason_text:
        return
    try:
        print(c_info("正在填写备注..."))
        reason_input = page.locator("#lockReasonTxt")
        reason_input.wait_for(timeout=5000)
        reason_input.scroll_into_view_if_needed()
        reason_input.click()
        page.wait_for_timeout(100)
        reason_input.fill("")
        page.wait_for_timeout(100)
        reason_input.click()
        page.wait_for_timeout(100)
        reason_input.type(reason_text, delay=120)
    except Exception as error:
        raise RuntimeError(f"填写备注失败: {error}") from error


def fill_employee(page, emp_id, expected_name=None):
    emp_input = page.locator("#showIdshowNonproductionTaskImportPage")
    emp_input.click()
    emp_input.fill("")
    emp_input.type(str(emp_id), delay=10)
    page.evaluate("""
        const input = document.querySelector('#showIdshowNonproductionTaskImportPage');
        if (input) {
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    """)
    expected_normalized_name = normalize_person_name(expected_name) if expected_name else ""
    page.wait_for_function(
        r"""expected => {
            const hidden = document.querySelector('#nonproductionTaskImportStaffNumId');
            const name = document.querySelector('#nameInfo');
            const normalizeName = value => String(value || '')
                .toUpperCase()
                .replace(/[（(][^）)]*[）)]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            return hidden
                && hidden.value === expected.employeeId
                && name
                && name.value.trim()
                && (!expected.name || normalizeName(name.value) === expected.name);
        }""",
        arg={"employeeId": str(emp_id), "name": expected_normalized_name},
        timeout=15000,
    )
    result_employee_id = page.locator("#nonproductionTaskImportStaffNumId").input_value()
    result_name = page.locator("#nameInfo").input_value()
    if result_employee_id != str(emp_id):
        raise RuntimeError(f"页面员工号识别不一致: 输入{emp_id}，页面{result_employee_id}")
    if expected_name and not names_match(expected_name, result_name):
        raise RuntimeError(f"页面姓名识别不一致: 输入{expected_name}，页面{result_name}")
    return result_name


def select_leave_type(page, leave_type):
    if leave_type not in LEAVE_CODE_TO_NAME:
        raise ValueError(f"不支持锁班类型 [{leave_type}]")
    page.evaluate("""(leaveType) => {
        const select = document.querySelector('#showNonproductionTaskImportPage #lockType');
        if (select) {
            select.focus();
            select.value = leaveType;
            select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            select.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('blur', { bubbles: true }));
        }
    }""", leave_type)
    page.wait_for_function(
        "leaveType => document.querySelector('#showNonproductionTaskImportPage #lockType')?.value === leaveType",
        arg=leave_type,
        timeout=5000,
    )


def fill_dates(page, start_date, end_date):
    start_input = page.locator("#lockStartTime")
    end_input = page.locator("#lockEndTime")
    start_input.fill(start_date)
    start_input.dispatch_event("change")
    end_input.fill(end_date)
    end_input.dispatch_event("change")
    end_input.dispatch_event("blur")


def fill_form(page, emp_id, leave_type, start_date, end_date, reason_text=None, expected_name=None):
    """填写一个实际路由片段。"""
    clear_form(page)
    fill_employee(page, emp_id, expected_name)
    select_leave_type(page, leave_type)
    fill_dates(page, start_date, end_date)
    fill_reason_field(page, reason_text)


def lock_query_row_from_locator(row, headers: list) -> dict:
    cells = row.locator("td")
    if cells.count() != len(headers):
        text = normalize_text(row.inner_text(timeout=1000))
        if "没有相关信息" in text:
            return {"_text": text}
        raise RuntimeError(
            f"锁班查询表数据列数异常: 表头{len(headers)}列，数据{cells.count()}列"
        )
    values = []
    for cell_index in range(cells.count()):
        cell = cells.nth(cell_index)
        title = normalize_text(cell.get_attribute("title") or "")
        text = normalize_text(cell.inner_text(timeout=1000))
        values.append(title or text)
    result = {headers[index]: value for index, value in enumerate(values)}
    result["_text"] = " | ".join(value for value in values if value)
    return result


def read_lock_query_page_rows(page) -> list:
    table = page.locator("#showNonproductionTaskResultPage table")
    table.wait_for(state="visible", timeout=15000)
    header_cells = table.locator("thead th")
    headers = []
    for index in range(header_cells.count()):
        text = normalize_text(header_cells.nth(index).inner_text(timeout=1000))
        headers.append(text or ("选择" if index == 0 else f"列{index + 1}"))
    missing = [header for header in LOCK_QUERY_REQUIRED_HEADERS if header not in headers]
    if missing:
        raise RuntimeError(f"锁班查询表缺少表头: {', '.join(missing)}")

    page_input = page.locator("#showLockListResultPageDiv #userPage")
    page_number = int(page_input.input_value()) if page_input.count() else 1
    rows = []
    row_locators = table.locator("tbody.list tr")
    for row_index in range(row_locators.count()):
        row = lock_query_row_from_locator(row_locators.nth(row_index), headers)
        if "没有相关信息" in row.get("_text", ""):
            continue
        row["_page_number"] = page_number
        rows.append(row)
    return rows


def lock_query_total_pages(page) -> int:
    links = page.locator("#showLockListResultPageDiv .footer a")
    for index in range(links.count()):
        link = links.nth(index)
        if normalize_text(link.inner_text(timeout=1000)) != "最后一页":
            continue
        href = link.get_attribute("href") or ""
        match = re.search(r",\s*['\"]?(\d+)['\"]?\);?$", href)
        if not match:
            raise RuntimeError(f"无法识别锁班查询总页数 [{href}]")
        return int(match.group(1))
    return 1


def go_to_lock_query_page(page, page_number: int) -> None:
    current = page.locator("#showLockListResultPageDiv #userPage")
    if current.count() and current.input_value() == str(page_number):
        return
    with page.expect_response(
        lambda response: "/newieb/nonproductionTask/showLockListPage" in response.url,
        timeout=15000,
    ):
        page.evaluate(
            """pageNumber => window.goPageTwo(
                'showNonproductionTaskLockPage1',
                'queryFormId',
                'showLockListResultPageDiv',
                String(pageNumber)
            )""",
            page_number,
        )
    page.wait_for_function(
        "pageNumber => document.querySelector('#showLockListResultPageDiv #userPage')?.value === String(pageNumber)",
        arg=page_number,
        timeout=15000,
    )


def read_all_lock_query_rows(page) -> list:
    go_to_lock_query_page(page, 1)
    total_pages = lock_query_total_pages(page)
    rows = []
    for page_number in range(1, total_pages + 1):
        go_to_lock_query_page(page, page_number)
        rows.extend(read_lock_query_page_rows(page))
    return rows


def run_locked_record_query(page, employee_id: str) -> list:
    query_page = page.locator("#showNonproductionTaskLockPage1")
    query_page.wait_for(state="visible", timeout=15000)
    employee = query_page.locator("#showIdNonproductionTaskLock")
    employee.click()
    employee.fill("")
    employee.type(employee_id, delay=20)
    page.wait_for_function(
        "employeeId => document.querySelector('#staffnumNonproductionTaskLock')?.value === employeeId",
        arg=employee_id,
        timeout=15000,
    )
    query_page.locator("#lockStatus").select_option("1")
    query_page.locator("#lockStartTimeQuery").fill("")
    query_page.locator("#lockEndTimeQuery").fill("")
    with page.expect_response(
        lambda response: "/newieb/nonproductionTask/showLockListPage" in response.url,
        timeout=15000,
    ):
        query_page.get_by_role("button", name="查询", exact=True).click()
    page.locator("#showNonproductionTaskResultPage table").wait_for(state="visible", timeout=15000)
    return read_all_lock_query_rows(page)


def open_lock_query_from_conflict(page, record: dict) -> list:
    page.get_by_role("button", name="锁班查询", exact=True).click()
    page.locator("#showNonproductionTaskLockPage1").wait_for(state="visible", timeout=15000)
    return run_locked_record_query(page, record["员工号"])


def same_query_record(left: dict, right: dict) -> bool:
    identity_fields = (
        "员工号",
        "状态",
        "开始日期",
        "结束日期",
        "锁班类型",
        "锁班名称",
        "锁班原因",
        "录入人",
        "录入时间",
    )
    return all(normalize_text(left.get(field)) == normalize_text(right.get(field)) for field in identity_fields)


def find_unlock_row_locator(page, candidate: dict):
    go_to_lock_query_page(page, int(candidate.get("_page_number", 1)))
    table = page.locator("#showNonproductionTaskResultPage table")
    header_cells = table.locator("thead th")
    headers = []
    for index in range(header_cells.count()):
        text = normalize_text(header_cells.nth(index).inner_text(timeout=1000))
        headers.append(text or ("选择" if index == 0 else f"列{index + 1}"))

    matches = []
    row_locators = table.locator("tbody.list tr")
    for row_index in range(row_locators.count()):
        row_locator = row_locators.nth(row_index)
        row = lock_query_row_from_locator(row_locator, headers)
        if same_query_record(row, candidate):
            matches.append(row_locator)
    if len(matches) != 1:
        raise RuntimeError(f"解锁前同行复选框定位到{len(matches)}行，已停止")
    return matches[0]


def format_unlock_action_reason(candidate: dict, record: dict) -> str:
    old_start = parse_portal_business_date(candidate.get("开始日期", "")).strftime("%Y-%m-%d")
    old_end = parse_portal_business_date(candidate.get("结束日期", "")).strftime("%Y-%m-%d")
    return (
        f"自动冲突回退：解锁{candidate.get('序号', '')} "
        f"{candidate.get('锁班类型', '')} {old_start}~{old_end}，"
        f"重提{record.get('请假类型', '')} {record.get('开始日期', '')}~{record.get('结束日期', '')}"
    )[:200]


def unlock_query_candidate(page, candidate: dict, record: dict) -> str:
    row_locator = find_unlock_row_locator(page, candidate)
    checkbox = row_locator.locator("input.lockTaskListIds")
    if checkbox.count() != 1 or checkbox.is_disabled():
        raise RuntimeError("唯一候选行的复选框不可用，已停止")
    checkbox.check()
    page.locator("#showNonproductionTaskResultPage #importBtn").get_by_role(
        "button", name="解锁", exact=True
    ).click()

    remark = page.locator("#remark")
    remark.wait_for(state="visible", timeout=10000)
    remark_dialog = remark.locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' ui-dialog ')][1]"
    )
    operator_prefix = normalize_text(remark.input_value())
    action_reason = format_unlock_action_reason(candidate, record)
    remark.fill((operator_prefix + action_reason)[:200])
    print(c_info("已填写解锁原因，确认解锁"))
    remark_dialog.get_by_role("button", name="确定", exact=True).click()

    remark.wait_for(state="hidden", timeout=10000)
    page.locator(".ui-dialog:visible").last.wait_for(state="visible", timeout=15000)
    visible_dialogs = page.locator(".ui-dialog:visible")
    result_dialog = visible_dialogs.nth(visible_dialogs.count() - 1)
    result_message = normalize_text(result_dialog.inner_text())
    print(c_info(f"解锁结果: {result_message}"))
    result_dialog.get_by_role("button", name="确定", exact=True).click()
    if "成功" not in result_message:
        raise RuntimeError(f"门户未确认解锁成功: {result_message}")
    return result_message


def return_to_import_from_query(page) -> None:
    if page.locator("#showIdshowNonproductionTaskImportPage").is_visible():
        return
    page.locator("#showNonproductionTaskResultPage #importBtn").get_by_role(
        "button", name="录入", exact=True
    ).click()
    page.locator("#showIdshowNonproductionTaskImportPage").wait_for(state="visible", timeout=15000)


def dismiss_lock_query_dialogs(page) -> None:
    remark = page.locator("#remark")
    if remark.count() and remark.is_visible():
        dialog = remark.locator(
            "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' ui-dialog ')][1]"
        )
        cancel = dialog.get_by_role("button", name="取消", exact=True)
        if cancel.is_visible():
            cancel.click()
    for _ in range(3):
        dialogs = page.locator(".ui-dialog:visible")
        if dialogs.count() == 0:
            break
        dialog = dialogs.nth(dialogs.count() - 1)
        confirm = dialog.get_by_role("button", name="确定", exact=True)
        cancel = dialog.get_by_role("button", name="取消", exact=True)
        if confirm.count() and confirm.is_visible():
            confirm.click()
        elif cancel.count() and cancel.is_visible():
            cancel.click()
        else:
            break


def recover_conflicting_lock(page, record: dict, before_unlock=None) -> tuple:
    candidate = None
    try:
        rows = open_lock_query_from_conflict(page, record)
        candidate, error = choose_unlock_candidate(rows, record)
        if error:
            try:
                return_to_import_from_query(page)
            except Exception:
                pass
            return False, candidate, error
        if before_unlock:
            before_unlock(candidate)
        unlock_message = unlock_query_candidate(page, candidate, record)
        remaining_rows = run_locked_record_query(page, record["员工号"])
        if any(same_query_record(row, candidate) for row in remaining_rows):
            return False, candidate, "门户提示成功，但旧记录仍处于已锁查询结果"
        return_to_import_from_query(page)
        return True, candidate, unlock_message
    except Exception as error:
        try:
            dismiss_lock_query_dialogs(page)
            return_to_import_from_query(page)
        except Exception:
            pass
        return False, candidate, str(error)


def raw_table_rows(page, selector: str) -> list:
    rows = []
    row_locators = page.locator(selector)
    for row_index in range(row_locators.count()):
        cells = row_locators.nth(row_index).locator("th, td")
        values = []
        for cell_index in range(cells.count()):
            values.append(normalize_text(cells.nth(cell_index).inner_text(timeout=1000)))
        if any(values):
            rows.append(values)
    return rows


def read_quota_for_type(page, leave_type: str, year: int) -> int:
    quota_type_text = {
        "RECU_LVE": "健康疗养",
        "ALV_FD": "年假（公休假）",
    }[leave_type]
    select_leave_type(page, leave_type)
    page.locator("#nonproductionTaskRulesTipsDiv").wait_for(state="visible", timeout=15000)
    page.wait_for_function(
        """expectedText => {
            const body = document.querySelector('#nonproductionTaskRulesTipsDiv .bDiv table');
            return body && body.innerText.includes(expectedText);
        }""",
        arg=quota_type_text,
        timeout=15000,
    )
    headers = table_headers(page, "#nonproductionTaskRulesTipsDiv .hDiv table th")
    values = raw_table_rows(page, "#nonproductionTaskRulesTipsDiv .bDiv table tr")
    rows = parse_quota_rows(headers, values)
    return available_days_for_year(rows, year)


def read_page_lock_days(page, expected_days: int) -> int:
    page.wait_for_function(
        """days => document.querySelector('#lockDays1')?.value === String(days)""",
        arg=expected_days,
        timeout=10000,
    )
    value = normalize_text(page.locator("#lockDays1").input_value())
    if not re.fullmatch(r"\d+", value):
        raise RuntimeError(f"页面锁班天数异常 [{value}]")
    return int(value)


def preflight_route(page, record: dict) -> tuple:
    problem = validate_record(record)
    if problem:
        return [], {}, problem

    clear_form(page)
    fill_employee(page, record["员工号"], record.get("姓名"))
    primary_type = record["请假类型"]
    quotas = {}
    if primary_type in SMART_LEAVE_TYPES:
        year = parse_iso_date(record["开始日期"]).year
        alternate_type = ALTERNATE_LEAVE_TYPE[primary_type]
        for leave_type in (primary_type, alternate_type):
            quotas[leave_type] = read_quota_for_type(page, leave_type, year)

    start = parse_iso_date(record["开始日期"])
    end = parse_iso_date(record["结束日期"])
    expected_days = (end - start).days + 1
    select_leave_type(page, primary_type)
    fill_dates(page, record["开始日期"], record["结束日期"])
    page_days = read_page_lock_days(page, expected_days)
    if page_days != expected_days:
        return [], quotas, f"页面锁班天数{page_days}与日期计算{expected_days}不一致"

    segments, route_error = route_record(record, quotas)
    return segments, quotas, route_error


def read_submit_result(page, record: dict) -> tuple:
    result_headers = table_headers(page, "#showNonproductionTaskImportResultPage1 th")
    conflict_headers = table_headers(page, "#showNonproductionTaskImportResultPage2 th")
    result_rows = table_rows(page, "#showNonproductionTaskImportResultPage1 tbody.list tr", result_headers)
    conflict_rows = table_rows(page, "#showNonproductionTaskImportResultPage2 tbody.list tr", conflict_headers)
    real_results = [row for row in result_rows if not no_related_info(row)]
    real_conflicts = [row for row in conflict_rows if not no_related_info(row)]
    matching_result = first_matching_row(real_results, record)
    matching_conflict = first_matching_row(real_conflicts, record)

    if real_conflicts:
        if not matching_conflict:
            first_text = real_conflicts[0].get("_text", "") if real_conflicts else ""
            return "异常", {}, f"冲突结果未匹配当前人员: {record.get('员工号', '')} {record.get('姓名', '')}; 首行{first_text[:120]}"
        conflict = matching_conflict.get("冲突") or matching_conflict.get("_text", "")
        return "冲突", matching_conflict, conflict
    if real_results and any(no_related_info(row) for row in conflict_rows):
        if not matching_result:
            first_text = real_results[0].get("_text", "") if real_results else ""
            return "异常", {}, f"提交结果未匹配当前人员: {record.get('员工号', '')} {record.get('姓名', '')}; 首行{first_text[:120]}"
        return "成功", matching_result, ""
    if not real_results:
        return "失败", {}, "查询结果为空"
    if not matching_result:
        first_text = real_results[0].get("_text", "") if real_results else ""
        return "异常", {}, f"提交结果未匹配当前人员: {record.get('员工号', '')} {record.get('姓名', '')}; 首行{first_text[:120]}"
    note = "; ".join(row.get("_text", "") for row in conflict_rows if row.get("_text")) or "未知结果"
    return "失败", matching_result, note


def submit_and_read_result(page, record: dict) -> tuple:
    page.get_by_role("button", name="下一步").wait_for()
    page.get_by_role("button", name="下一步").click()
    page.get_by_role("button", name="继续录入").wait_for()
    status, row, remark = read_submit_result(page, record)
    if status == "成功":
        page.get_by_role("button", name="继续录入").click()
        page.locator("#showIdshowNonproductionTaskImportPage").wait_for()
    return status, row, remark


def submit_and_check(page):
    """提交并检查冲突,返回(成功, 冲突信息)"""
    # 点击下一步
    page.get_by_role("button", name="下一步").wait_for()
    page.get_by_role("button", name="下一步").click()
    # 等待继续录入按钮出现,说明页面加载完成
    page.get_by_role("button", name="继续录入").wait_for()
    # 检查查询结果是否有数据
    result_rows = page.locator("#showNonproductionTaskImportResultPage1 tbody.list tr")
    # 检查冲突列表的内容
    conflict_rows = page.locator("#showNonproductionTaskImportResultPage2 tbody.list tr")
    # 获取冲突列表的文本内容
    conflict_text = ""
    if conflict_rows.count() > 0:
        conflict_text = conflict_rows.first.inner_text()
    # 成功条件: 查询结果有数据 且 冲突列表显示"没有相关信息"
    if result_rows.count() > 0 and "没有相关信息" in conflict_text:
        # 没有冲突,点击继续录入
        page.get_by_role("button", name="继续录入").click()
        # 等待表单页面加载
        page.locator("#showIdshowNonproductionTaskImportPage").wait_for()
        return True, None
    else:
        # 有冲突或查询结果为空
        if result_rows.count() == 0:
            conflict_info = "查询结果为空"
        else:
            conflict_info = conflict_text
        return False, conflict_info
