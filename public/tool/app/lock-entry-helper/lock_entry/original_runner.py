"""Original serial lock-entry runner and interactive modes."""

from .common import *
from .input_data import *
from .portal import *
from .exporter import RESULT_HEADERS, create_result_excel, append_result_excel
from .launcher import start_portal_session

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
    """从结果页返回表单页"""
    try:
        page.get_by_role("button", name="继续录入").click()
        page.locator("#showIdshowNonproductionTaskImportPage").wait_for()
    except Exception:
        pass  # 如果已经在表单页就忽略


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


def batch_mode(page, whitelist, common_reason):
    """批量模式"""
    failed_records = []  # 记录失败的条目
    while True:
        print(f"{c_info('[批量模式]')} {whitelist_status(whitelist)} | {reason_status(common_reason)}")
        text = read_multiline(c_hint("请粘贴数据(输入ok确认,b返回):"), 'ok', 'b')
        if text is None:
            print_failed_records(failed_records)
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
        result_file = create_result_excel("原始锁班批量")
        i = 0
        while i < len(records):
            record = records[i]
            print(f"{c_info(f'[{i+1}/{len(records)}]')} 填写: {format_record(record)}")
            try:
                fill_form(page, record["员工号"], record["请假类型"], record["开始日期"], record["结束日期"], common_reason)
                print(c_ok("填表完成,提交中..."))
                status, result_row, remark = submit_and_read_result(page, record)
                append_result_excel(result_file, i + 1, record, status, result_row, remark)
                if status == "成功":
                    print(c_ok("提交成功"))
                    i += 1
                else:
                    beep_error()
                    print(c_err(f"{status}!"))
                    print(c_warn(remark if remark else "未知原因"))
                    failed_records.append((record, remark or status))
                    go_back_to_form(page)
                    i += 1
            except Exception as e:
                beep_error()
                print(c_err(f"失败: {e}"))
                failed_records.append((record, str(e)))
                append_result_excel(result_file, i + 1, record, "异常", {}, str(e))
                i += 1
        print(c_ok("批量处理完成"))
        if result_file:
            print(c_ok(f"结果Excel: {result_file}"))
        print_failed_records(failed_records)
        return


def manual_mode(page, whitelist, common_reason):
    """手动模式"""
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
        if not record["员工号"]:
            print(c_err("未识别员工号"))
            continue
        if not record["请假类型"]:
            print(c_err("未识别请假类型"))
            continue
        if not record["开始日期"]:
            print(c_err("未识别日期"))
            continue
        while True:
            print(f"填写: {format_record(record)}")
            if result_file is None:
                result_file = create_result_excel("原始锁班手动")
            sequence += 1
            try:
                fill_form(page, record["员工号"], record["请假类型"], record["开始日期"], record["结束日期"], common_reason)
                print(c_ok("填表完成,提交中..."))
                status, result_row, remark = submit_and_read_result(page, record)
                append_result_excel(result_file, sequence, record, status, result_row, remark)
                if status == "成功":
                    print(c_ok("提交成功"))
                    break
                else:
                    print(c_err(f"{status}!"))
                    print(c_warn(remark if remark else "未知原因"))
                    go_back_to_form(page)
                    break
            except Exception as e:
                beep_error()
                print(c_err(f"失败: {e}"))
                append_result_excel(result_file, sequence, record, "异常", {}, str(e))
                break


def excel_mode(page, whitelist, common_reason):
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
        result_file = create_result_excel("原始锁班Excel")
        
        i = 0
        while i < len(records):
            record = records[i]
            print(f"{c_info(f'[{i+1}/{len(records)}]')} 填写: {format_record(record)}")
            try:
                fill_form(page, record["员工号"], record["请假类型"], record["开始日期"], record["结束日期"], common_reason)
                print(c_ok("填表完成,提交中..."))
                status, result_row, remark = submit_and_read_result(page, record)
                append_result_excel(result_file, i + 1, record, status, result_row, remark)
                if status == "成功":
                    print(c_ok("提交成功"))
                    i += 1
                else:
                    beep_error()
                    print(c_err(f"{status}!"))
                    print(c_warn(remark if remark else "未知原因"))
                    failed_records.append((record, remark or status))
                    go_back_to_form(page)
                    i += 1
            except Exception as e:
                beep_error()
                print(c_err(f"失败: {e}"))
                failed_records.append((record, str(e)))
                append_result_excel(result_file, i + 1, record, "异常", {}, str(e))
                i += 1
        print(c_ok("Excel导入完成"))
        if result_file:
            print(c_ok(f"结果Excel: {result_file}"))
        print_failed_records(failed_records)
        return


def main():
    print(c_info("锁班乞丐"))
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
    session = start_portal_session(browser_path, default_timeout=0)
    page = session.page
    print(c_ok("开始工作"))
    while True:
        print(f"{whitelist_status(whitelist)} | {reason_status(common_reason)} | {c_hint('1批量 2手动 3Excel导入 w设白名单 c清白名单 q退出')}")
        cmd = input(c_hint("选择: ")).strip().lower()
        if cmd == '1':
            batch_mode(page, whitelist, common_reason)
        elif cmd == '2':
            manual_mode(page, whitelist, common_reason)
        elif cmd == '3':
            excel_mode(page, whitelist, common_reason)
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
