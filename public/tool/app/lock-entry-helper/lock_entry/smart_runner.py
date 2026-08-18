"""Smart serial lock-entry runner and interactive modes."""

from .common import *
from .smart_input import *
from .smart_router import *
from .smart_portal import *
from .smart_exporter import *
from .launcher import start_portal_session

def parse_single_record(text: str) -> dict:
    """解析单条记录"""
    result = {"员工号": None, "姓名": None, "请假类型": None, "开始日期": None, "结束日期": None}
    emp = re.search(r'\b(\d{6})\b', text)
    if emp:
        result["员工号"] = emp.group(1)
    name = re.search(r'\d{6}\s*([\u4e00-\u9fa5]{2,4})', text)
    if name:
        result["姓名"] = name.group(1)
    result["请假类型"] = parse_leave_type(text)
    dates = re.findall(r'\d{8}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', text)
    if dates:
        result["开始日期"] = normalize_date(dates[0])
        result["结束日期"] = normalize_date(dates[1]) if len(dates) > 1 else normalize_date(dates[0])
    return result


def split_continuous_text(text: str) -> list:
    """把连续粘贴的文本按员工号切分成多条记录"""
    # 按6位员工号切分
    parts = re.split(r'(?=\d{6}[\u4e00-\u9fa5])', text)
    return [p.strip() for p in parts if p.strip() and re.search(r'\d{6}', p)]


def parse_batch_input(text: str, whitelist: set = None) -> tuple:
    """解析批量输入"""
    records = []
    errors = []
    # 先按换行分，如果只有一行且很长，尝试按员工号切分
    lines = [line.strip() for line in text.strip().split('\n') if line.strip()]
    if len(lines) == 1 and len(lines[0]) > 100:
        lines = split_continuous_text(lines[0])
    for i, line in enumerate(lines, 1):
        record = parse_single_record(line)
        problem = validate_record(record)
        if problem:
            errors.append(f"第{i}条: {problem} [{line[:50]}]")
            continue
        if whitelist and record["员工号"] not in whitelist:
            continue
        records.append(record)
    return records, errors


def read_multiline(prompt, confirm_key='ok', cancel_key='c'):
    """读取多行输入,输入confirm_key确认,cancel_key取消"""
    print(prompt)
    lines = []
    while True:
        line = input()
        if line.lower() == cancel_key:
            return None
        if line.lower() == confirm_key:
            break
        if line:
            lines.append(line)
    if not lines:
        return None
    return '\n'.join(lines)


def set_whitelist():
    """设置白名单"""
    text = read_multiline(c_hint("请粘贴员工号列表(输入ok确认,c取消):"), 'ok', 'c')
    if text is None:
        print(c_warn("已取消"))
        return None
    wl = parse_whitelist(text)
    if not wl:
        print(c_err("未识别到有效员工号"))
        return None
    print(c_ok(f"已设置白名单,共{len(wl)}人"))
    return wl


def set_common_reason():
    """设置统一备注"""
    text = read_multiline(c_hint("请粘贴统一备注(输入OK确认,c取消):"), 'ok', 'c')
    if text is None:
        print(c_warn("本次不填写备注"))
        return None
    print(c_ok(f"已设置统一备注: {format_reason_preview(text, limit=30)}"))
    return text


def go_back_to_form(page):
    """从提交结果页或锁班查询页返回录入表单。"""
    if page.locator("#showIdshowNonproductionTaskImportPage").is_visible():
        return
    try:
        continue_button = page.get_by_role("button", name="继续录入", exact=True)
        if continue_button.is_visible():
            continue_button.click()
        else:
            return_to_import_from_query(page)
        page.locator("#showIdshowNonproductionTaskImportPage").wait_for()
    except Exception:
        pass


def print_failed_records(failed_records):
    """打印失败记录并写入日志文件"""
    if failed_records:
        print(c_err(f"本次失败{len(failed_records)}条:"))
        for r, reason in failed_records:
            print(c_err(f"  {format_record(r)} - {reason}"))
        # 写入日志文件
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"failed_{timestamp}.txt"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"失败记录 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"共{len(failed_records)}条\n")
                f.write("-" * 50 + "\n")
                for r, reason in failed_records:
                    f.write(f"{format_record(r)} - {reason}\n")
            filepath = os.path.abspath(filename)
            print(c_warn(f"失败记录已保存: {filepath}"))
        except Exception as e:
            print(c_warn(f"保存日志失败: {e}"))


def print_route_plan(record: dict, quotas: dict, segments: list):
    primary_type = record["请假类型"]
    if primary_type in SMART_LEAVE_TYPES:
        alternate_type = ALTERNATE_LEAVE_TYPE[primary_type]
        print(c_info(
            f"额度: {leave_type_name(primary_type)}{quotas[primary_type]}天 | "
            f"{leave_type_name(alternate_type)}{quotas[alternate_type]}天"
        ))
    else:
        print(c_info("该类型不参与额度路由，按输入类型和日期原样录入"))
    for segment_index, segment in enumerate(segments, start=1):
        print(c_ok(
            f"  片段{segment_index}: {leave_type_name(segment['请假类型'])} "
            f"{segment['开始日期']}~{segment['结束日期']} ({segment['计划天数']}天)"
        ))


def process_smart_record(
    page,
    record,
    original_sequence,
    output_file,
    common_reason,
    conflict_recovery=False,
) -> tuple:
    try:
        segments, quotas, route_error = preflight_route(page, record)
    except Exception as error:
        reason = f"录入预检失败: {error}"
        append_result_excel(
            output_file, original_sequence, 0, record, {}, {}, "预检异常", {}, reason
        )
        return False, reason

    if route_error:
        status = "额度不足" if "合计" in route_error else "预检失败"
        append_result_excel(
            output_file, original_sequence, 0, record, {}, quotas, status, {}, route_error
        )
        return False, route_error

    print_route_plan(record, quotas, segments)
    for segment_index, segment in enumerate(segments, start=1):
        attempt = 1
        unlocked_row = {}
        recovery_note = ""
        excel_note = ""
        print(c_info(
            f"提交片段{segment_index}/{len(segments)}: "
            f"{leave_type_name(segment['请假类型'])} "
            f"{segment['开始日期']}~{segment['结束日期']}"
        ))
        try:
            fill_form(
                page,
                segment["员工号"],
                segment["请假类型"],
                segment["开始日期"],
                segment["结束日期"],
                common_reason,
                segment.get("姓名"),
            )
            read_page_lock_days(page, segment["计划天数"])
            status, result_row, remark = submit_and_read_result(page, segment)
            append_result_excel(
                output_file,
                original_sequence,
                segment_index,
                record,
                segment,
                quotas,
                status,
                result_row,
                remark,
                attempt=attempt,
            )
            if status == "冲突" and conflict_recovery:
                print(c_warn("当前片段发生冲突，正在查询唯一重叠的已锁记录"))

                def persist_candidate(candidate):
                    append_result_excel(
                        output_file,
                        original_sequence,
                        segment_index,
                        record,
                        segment,
                        quotas,
                        "准备解锁",
                        result_row,
                        remark,
                        attempt=attempt,
                        recovery="已唯一定位旧记录，解锁前已落盘",
                        unlocked_row=candidate,
                    )

                recovered, unlocked_row, recovery_note = recover_conflicting_lock(
                    page,
                    segment,
                    before_unlock=persist_candidate,
                )
                unlocked_row = unlocked_row or {}
                if not recovered:
                    reason = f"冲突回退失败: {recovery_note}"
                    append_result_excel(
                        output_file,
                        original_sequence,
                        segment_index,
                        record,
                        segment,
                        quotas,
                        "冲突回退失败",
                        result_row,
                        f"{remark}; {reason}",
                        attempt=attempt,
                        recovery=reason,
                        unlocked_row=unlocked_row,
                    )
                    go_back_to_form(page)
                    append_unexecuted_segments(
                        output_file,
                        original_sequence,
                        record,
                        segments,
                        quotas,
                        segment_index,
                        f"前序片段未成功: {reason}",
                    )
                    return False, reason

                attempt = 2
                excel_note = format_unlocked_record_excel_note(unlocked_row)
                print(c_info(f"旧记录已解锁，重提片段{segment_index}"))
                fill_form(
                    page,
                    segment["员工号"],
                    segment["请假类型"],
                    segment["开始日期"],
                    segment["结束日期"],
                    common_reason,
                    segment.get("姓名"),
                )
                read_page_lock_days(page, segment["计划天数"])
                status, result_row, remark = submit_and_read_result(page, segment)
                append_result_excel(
                    output_file,
                    original_sequence,
                    segment_index,
                    record,
                    segment,
                    quotas,
                    status,
                    result_row,
                    remark,
                    attempt=attempt,
                    recovery=f"{recovery_note}; 已重提一次",
                    unlocked_row=unlocked_row,
                    excel_note=excel_note,
                )
            if status != "成功":
                reason = (
                    f"解锁旧记录后重提仍未成功: {remark or status}"
                    if attempt == 2
                    else remark or status
                )
                go_back_to_form(page)
                append_unexecuted_segments(
                    output_file,
                    original_sequence,
                    record,
                    segments,
                    quotas,
                    segment_index,
                    f"前序片段未成功: {reason}",
                )
                return False, reason
            print(c_ok(f"片段{segment_index}提交成功"))
        except Exception as error:
            reason = f"片段{segment_index}异常: {error}"
            append_result_excel(
                output_file,
                original_sequence,
                segment_index,
                record,
                segment,
                quotas,
                "异常",
                {},
                reason,
                attempt=attempt,
                recovery=recovery_note,
                unlocked_row=unlocked_row,
                excel_note=excel_note,
            )
            go_back_to_form(page)
            append_unexecuted_segments(
                output_file,
                original_sequence,
                record,
                segments,
                quotas,
                segment_index,
                f"前序片段异常: {reason}",
            )
            return False, reason
    return True, ""


def batch_mode(page, whitelist, common_reason, conflict_recovery):
    """批量粘贴模式。"""
    while True:
        print(f"{c_info('[智能路由批量]')} {whitelist_status(whitelist)} | {reason_status(common_reason)}")
        text = read_multiline(c_hint("请粘贴数据(输入ok确认,b返回):"), 'ok', 'b')
        if text is None:
            return
        records, errors = parse_batch_input(text, whitelist)
        if errors:
            print(c_err("解析错误:"))
            for err in errors:
                print(c_err(err))
        if not records:
            print(c_err("没有可处理的记录"))
            continue
        print(c_ok(f"共{len(records)}条有效数据:"))
        for i, r in enumerate(records, 1):
            print(f"{i}. {format_record(r)}")
        confirm = input(c_hint("y开始填写,n重新粘贴,b返回主菜单: ")).strip().lower()
        if confirm == 'b':
            return
        if confirm != 'y':
            continue
        result_file = create_result_excel("智能路由锁班批量")
        failed_records = process_record_list(
            page, records, result_file, common_reason, conflict_recovery
        )
        print(c_ok("批量处理完成"))
        if result_file:
            print(c_ok(f"结果Excel: {result_file}"))
        print_failed_records(failed_records)
        return


def manual_mode(page, whitelist, common_reason, conflict_recovery):
    """手动单条模式。"""
    result_file = None
    sequence = 0
    while True:
        print(f"{c_info('[手动模式]')} {whitelist_status(whitelist)} | {reason_status(common_reason)} | {c_hint('粘贴数据,b返回主菜单:')}")
        text = input().strip()
        if text.lower() == 'b':
            return
        if not text:
            continue
        record = parse_single_record(text)
        if whitelist and record["员工号"] and record["员工号"] not in whitelist:
            print(c_err("该员工不在白名单中"))
            continue
        problem = validate_record(record)
        if problem:
            print(c_err(problem))
            continue
        print(f"待处理: {format_record(record)}")
        confirm = input(c_hint("y确认智能路由并提交，其他键取消: ")).strip().lower()
        if confirm != 'y':
            continue
        if result_file is None:
            result_file = create_result_excel("智能路由锁班手动")
        sequence += 1
        success, reason = process_smart_record(
            page, record, sequence, result_file, common_reason, conflict_recovery
        )
        if not success:
            beep_error()
            print(c_err(reason))


def excel_mode(page, whitelist, common_reason, conflict_recovery):
    """Excel导入模式"""
    if not HAS_OPENPYXL:
        print(c_err("未安装openpyxl库，请运行: pip install openpyxl"))
        return

    failed_records = []
    while True:
        print(f"{c_info('[Excel导入]')} {whitelist_status(whitelist)} | {reason_status(common_reason)}")
        filepath = input(c_hint("请输入Excel文件路径(b返回): ")).strip()
        if filepath.lower() == 'b':
            print_failed_records(failed_records)
            return

        # 去除引号
        filepath = filepath.strip('"').strip("'")

        if not os.path.exists(filepath):
            print(c_err("文件不存在"))
            continue

        records, errors = parse_excel_file(filepath, whitelist)
        if errors:
            print(c_err("解析错误:"))
            for err in errors:
                print(c_err(f"  {err}"))

        if not records:
            print(c_err("没有可处理的记录"))
            continue

        print(c_ok(f"共{len(records)}条有效数据:"))
        for i, r in enumerate(records, 1):
            print(f"{i}. {format_record(r)}")

        confirm = input(c_hint("y开始填写,n重新选择,b返回主菜单: ")).strip().lower()
        if confirm == 'b':
            return
        if confirm != 'y':
            continue
        result_file = create_result_excel("智能路由锁班Excel")
        failed_records = process_record_list(
            page, records, result_file, common_reason, conflict_recovery
        )
        print(c_ok("Excel导入完成"))
        if result_file:
            print(c_ok(f"结果Excel: {result_file}"))
        print_failed_records(failed_records)
        return


def process_record_list(page, records, result_file, common_reason, conflict_recovery=False):
    failed_records = []
    for sequence, record in enumerate(records, start=1):
        print(f"{c_info(f'[{sequence}/{len(records)}]')} 预检: {format_record(record)}")
        success, reason = process_smart_record(
            page,
            record,
            sequence,
            result_file,
            common_reason,
            conflict_recovery,
        )
        if not success:
            beep_error()
            print(c_err(reason))
            failed_records.append((record, reason))
    return failed_records


def main():
    print(c_info("锁班皇帝 - 智能路由助手"))
    print(c_info("支持全部锁班类型；健康疗养与飞行员公休（订座）按可休天数自动分配"))
    if not HAS_OPENPYXL:
        print(c_err("缺少openpyxl，无法生成实时结果文件。请先运行: pip install -r requirements.txt"))
        return
    # 浏览器路径
    browser_path = input(c_hint("浏览器路径(回车用默认): ")).strip() or None
    if browser_path:
        print(c_ok(f"使用指定浏览器: {browser_path}"))
    else:
        print(c_ok("使用默认浏览器"))
    # 白名单
    whitelist = None
    use_wl = input(c_hint("是否预设白名单?(y/n): ")).strip().lower()
    if use_wl == 'y':
        whitelist = set_whitelist()
    else:
        print(c_ok("不设置白名单,处理所有员工"))
    common_reason = None
    use_reason = input(c_hint("是否填写统一备注?(y/n): ")).strip().lower()
    if use_reason == 'y':
        common_reason = set_common_reason()
    else:
        print(c_ok("本次不填写备注"))
    recovery_answer = input(c_hint(
        "是否启用冲突自动解锁并重提? 仅唯一匹配已锁记录时执行(y/n): "
    )).strip().lower()
    conflict_recovery = recovery_answer == 'y'
    if conflict_recovery:
        print(c_warn("已启用冲突回退：命中唯一已锁记录时会解锁旧整行并重提一次"))
    else:
        print(c_ok("本次不自动解锁冲突记录"))
    session = start_portal_session(browser_path, default_timeout=30000, login_timeout=120000)
    page = session.page
    print(c_ok("开始工作"))
    while True:
        print(f"{whitelist_status(whitelist)} | {reason_status(common_reason)} | {c_hint('1批量 2手动 3Excel导入 w设白名单 c清白名单 q退出')}")
        cmd = input(c_hint("选择: ")).strip().lower()
        if cmd == '1':
            batch_mode(page, whitelist, common_reason, conflict_recovery)
        elif cmd == '2':
            manual_mode(page, whitelist, common_reason, conflict_recovery)
        elif cmd == '3':
            excel_mode(page, whitelist, common_reason, conflict_recovery)
        elif cmd == 'w':
            new_wl = set_whitelist()
            if new_wl is not None:
                whitelist = new_wl
        elif cmd == 'c':
            whitelist = None
            print(c_ok("已清除白名单"))
        elif cmd == 'q':
            break
    session.close()
    print(c_info("结束"))
