"""Portal form actions, result tables, and submit verification."""

from .common import (
    first_matching_row, no_related_info, table_headers, table_rows, c_info,
)

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


def fill_form(page, emp_id, leave_type, start_date, end_date, reason_text=None):
    """填写表单"""
    clear_form(page)
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
    page.wait_for_timeout(1000)
    # 用JS直接设置下拉框值并触发事件
    page.evaluate("""(leaveType) => {
        const select = document.querySelector('#lockType');
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
    page.wait_for_timeout(500)
    page.locator("#lockStartTime").fill(start_date)
    page.locator("#lockEndTime").fill(end_date)
    fill_reason_field(page, reason_text)


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
