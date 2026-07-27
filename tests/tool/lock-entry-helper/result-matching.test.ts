import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

function runPythonCheck(script: string) {
  expect(() =>
    execFileSync("python", ["-c", script], {
      cwd: resolveFromRoot(),
      stdio: "pipe"
    })
  ).not.toThrow();
}

describe("lock entry helper app.py original helper", () => {
  it("parses pasted lock records with employee, leave type and date range", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/app.py")
spec = importlib.util.spec_from_file_location("lock_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules["lock_app"] = module
spec.loader.exec_module(module)

record = module.parse_single_record("282119 陈坤淋 PARENT_LVE 2026-06-13 2026-06-20")

assert record["员工号"] == "282119", record
assert record["姓名"] == "陈坤淋", record
assert record["请假类型"] == "PARENT_LVE", record
assert record["开始日期"] == "2026-06-13", record
assert record["结束日期"] == "2026-06-20", record
`);
  });

  it("filters batch records by whitelist", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/app.py")
spec = importlib.util.spec_from_file_location("lock_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules["lock_app"] = module
spec.loader.exec_module(module)

text = "\n".join([
    "282119 陈坤淋 PARENT_LVE 2026-06-13 2026-06-20",
    "186640 郭岛 RECU_LVE 2026-06-21 2026-06-30",
])
records, errors = module.parse_batch_input(text, {"282119"})

assert len(records) == 1, records
assert records[0]["员工号"] == "282119", records
assert errors == [], errors
`);
  });

  it("matches portal results by current record and writes result Excel", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path
from openpyxl import load_workbook

path = Path("public/tool/app/lock-entry-helper/app.py")
spec = importlib.util.spec_from_file_location("lock_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules["lock_app"] = module
spec.loader.exec_module(module)

record = module.parse_single_record("282119 陈坤淋 PARENT_LVE 2026-06-13 2026-06-20")
good = {
    "锁班结果": "待审批",
    "员工号": "282119",
    "姓名": "陈坤淋",
    "开始日期": "2026-06-13 08:59:00",
    "结束日期": "2026-06-20 19:59:00",
    "锁班类型": "探亲假-探父母",
    "_text": "待审批 | 282119 | 陈坤淋 | 2026-06-13 08:59:00 | 2026-06-20 19:59:00 | 探亲假-探父母",
}
wrong = dict(good, 员工号="186640", 姓名="郭岛")

assert module.result_row_matches_record(good, record)
assert not module.result_row_matches_record(wrong, record)

output_file = module.create_result_excel("app_test")
try:
    module.append_result_excel(output_file, 1, record, "冲突", good, "已有锁班")
    workbook = load_workbook(output_file)
    sheet = workbook.active
    headers = [cell.value for cell in sheet[1]]
    row = [cell.value for cell in sheet[2]]
    workbook.close()
finally:
    Path(output_file).unlink(missing_ok=True)

assert headers == module.RESULT_HEADERS, headers
assert row[0] == 1, row
assert row[1] == "282119", row
assert row[6] == "冲突", row
assert row[12] == "已有锁班", row
assert row[14:18] == ["是", "是", "是", "是"], row
`);
  });

  it("accepts portal medical check display suffix and trimmed name notes", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/app.py")
spec = importlib.util.spec_from_file_location("lock_app", path)
module = importlib.util.module_from_spec(spec)
sys.modules["lock_app"] = module
spec.loader.exec_module(module)

record = module.parse_single_record("901785 张宇强(09.16转入) MEDL_CHK 2026-07-06 2026-07-06")
row = {
    "锁班结果": "待审批",
    "员工号": "901785",
    "姓名": "张宇强",
    "部门": "(CAN)飞行部",
    "开始日期": "2026-07-06 08:59:00",
    "结束日期": "2026-07-06 19:59:00",
    "锁班天数": "1",
    "锁班类型": "体检_临床(占值勤期类别)",
    "锁班原因": "张峻哲(295494):体检_临床(占值勤期类别)",
    "_text": "待审批 | 901785 | 张宇强 | (CAN)飞行部 | 2026-07-06 08:59:00 | 2026-07-06 19:59:00 | 1 | 体检_临床(占值勤期类别)",
}

assert module.result_row_matches_record(row, record)
assert module.names_match("张宇强(09.16转入)", "张宇强")
assert module.leave_types_match("MEDL_CHK", "体检_临床(占值勤期类别)")
`);
  });
});

describe("lock entry helper superapp.py concurrent helper", () => {
  it("filters Excel records by whitelist before concurrent processing", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
import tempfile
from pathlib import Path
from openpyxl import Workbook

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)

workbook = Workbook()
sheet = workbook.active
sheet.append(["员工号", "姓名", "锁班类型", "开始日期", "结束日期"])
sheet.append(["282119", "陈坤淋", "PARENT_LVE", "2026-06-13", "2026-06-20"])
sheet.append(["186640", "郭岛", "RECU_LVE", "2026-06-21", "2026-06-30"])
with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as file:
    temp_path = file.name
workbook.save(temp_path)
workbook.close()

records, errors = module.read_excel_records(temp_path, {"282119"})
Path(temp_path).unlink()

assert errors == [], errors
assert len(records) == 1, records
assert records[0].sequence == 1, records
assert records[0].employee_id == "282119", records
`);
  });

  it("aligns portal rows that include a visible sequence cell", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)

headers = ["锁班结果", "员工号", "姓名", "部门", "开始日期", "结束日期", "锁班天数", "锁班类型", "锁班原因"]
values = ["1", "待审批", "282119", "陈坤淋", "(CAN)飞行部", "2026-06-13 08:59:00", "2026-06-20 19:59:00", "8", "探亲假-探父母", "super test"]
aligned = module.align_table_values(headers, values)

assert aligned[0] == "待审批", aligned
assert aligned[1] == "282119", aligned
assert aligned[2] == "陈坤淋", aligned
`);
  });

  it("matches only the current person, leave type and date range", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)
record = module.LockRecord(1, "282119", "陈坤淋", "PARENT_LVE", "2026-06-13", "2026-06-20")

good = {
    "锁班结果": "待审批",
    "员工号": "282119",
    "姓名": "陈坤淋",
    "部门": "(CAN)飞行部",
    "开始日期": "2026-06-13 08:59:00",
    "结束日期": "2026-06-20 19:59:00",
    "锁班天数": "8",
    "锁班类型": "探亲假-探父母",
    "锁班原因": "super test",
    "_text": "待审批 | 282119 | 陈坤淋 | (CAN)飞行部 | 2026-06-13 08:59:00 | 2026-06-20 19:59:00 | 8 | 探亲假-探父母 | super test",
}
wrong_name = dict(good, 姓名="别人", _text=good["_text"].replace("陈坤淋", "别人"))
wrong_type = dict(good, 锁班类型="健康疗养", _text=good["_text"].replace("探亲假-探父母", "健康疗养"))
wrong_date = dict(good, 开始日期="2026-06-14 08:59:00", _text=good["_text"].replace("2026-06-13", "2026-06-14"))

assert module.result_row_matches_record(good, record)
assert not module.result_row_matches_record(wrong_name, record)
assert not module.result_row_matches_record(wrong_type, record)
assert not module.result_row_matches_record(wrong_date, record)
`);
  });

  it("accepts portal medical check display suffix and trimmed name notes", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)

record = module.LockRecord(1, "901785", "张宇强(09.16转入)", "MEDL_CHK", "2026-07-06", "2026-07-06")
row = {
    "锁班结果": "待审批",
    "员工号": "901785",
    "姓名": "张宇强",
    "部门": "(CAN)飞行部",
    "开始日期": "2026-07-06 08:59:00",
    "结束日期": "2026-07-06 19:59:00",
    "锁班天数": "1",
    "锁班类型": "体检_临床(占值勤期类别)",
    "锁班原因": "张峻哲(295494):体检_临床(占值勤期类别)",
    "_text": "待审批 | 901785 | 张宇强 | (CAN)飞行部 | 2026-07-06 08:59:00 | 2026-07-06 19:59:00 | 1 | 体检_临床(占值勤期类别)",
}

assert module.result_row_matches_record(row, record)
assert module.result_identity_problem(record, row) == ""
assert module.names_match("张宇强(09.16转入)", "张宇强")
assert module.leave_types_match("MEDL_CHK", "体检_临床(占值勤期类别)")
`);
  });

  it("archives swapped concurrent portal results to the correct records", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)

a = module.LockRecord(1, "282119", "陈坤淋", "PARENT_LVE", "2026-06-13", "2026-06-20")
b = module.LockRecord(2, "186640", "郭岛", "RECU_LVE", "2026-06-21", "2026-06-30")

row_a = {
    "锁班结果": "待审批",
    "员工号": "282119",
    "姓名": "陈坤淋",
    "部门": "(CAN)飞行部",
    "开始日期": "2026-06-13 08:59:00",
    "结束日期": "2026-06-20 19:59:00",
    "锁班天数": "8",
    "锁班类型": "探亲假-探父母",
    "锁班原因": "super test",
    "_text": "待审批 | 282119 | 陈坤淋 | 2026-06-13 08:59:00 | 2026-06-20 19:59:00 | 探亲假-探父母",
}
row_b = {
    "锁班结果": "待审批",
    "员工号": "186640",
    "姓名": "郭岛",
    "部门": "(CAN)飞行部",
    "开始日期": "2026-06-21 08:59:00",
    "结束日期": "2026-06-30 19:59:00",
    "锁班天数": "10",
    "锁班类型": "健康疗养",
    "锁班原因": "super test",
    "_text": "待审批 | 186640 | 郭岛 | 2026-06-21 08:59:00 | 2026-06-30 19:59:00 | 健康疗养",
}

portal_results = [
    module.PortalResult(1, a, "成功", row_b, "", "", 1, 6, 7),
    module.PortalResult(2, b, "成功", row_a, "", "", 1, 6, 7),
]
matched, pending, notes = module.match_portal_results([a, b], portal_results)

assert len(matched) == 2
assert pending == []
by_seq = {result.sequence: result for result in matched}
assert by_seq[1].row["员工号"] == "282119"
assert by_seq[2].row["员工号"] == "186640"
`);
  });

  it("keeps result Excel headers focused on human verification", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

expected = [
    "序号",
    "员工号",
    "姓名",
    "锁班类型",
    "开始日期",
    "结束日期",
    "处理状态",
    "锁班结果",
    "结果姓名",
    "结果锁班类型",
    "结果开始日期",
    "结果结束日期",
    "冲突",
    "备注",
    "员工号匹配",
    "姓名匹配",
    "日期匹配",
    "类型匹配",
    "处理时间",
]

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)
assert module.RESULT_HEADERS == expected, module.RESULT_HEADERS
`);
  });

  it("archives non-retryable info dialog errors without retrying", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/superapp.py")
spec = importlib.util.spec_from_file_location("superapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["superapp"] = module
spec.loader.exec_module(module)

record = module.LockRecord(1, "184790", "郭春阳", "RECU_LVE", "20026年6月12日", "2026-06-16")
portal_results = [
    module.PortalResult(1, record, "异常", {}, "", "下一步保存出错", 1, 1, 2, "下一步保存出错", False)
]
matched, pending, notes = module.match_portal_results([record], portal_results)

assert len(matched) == 1
assert pending == []
assert matched[0].status == "异常"
assert matched[0].remark == "下一步保存出错"
`);
  });
});

describe("lock entry helper smartapp.py quota router", () => {
  it("publishes the standalone smart helper from the tool page", () => {
    const html = readFileSync(
      resolveFromRoot("public/tool/app/lock-entry-helper/index.html"),
      "utf8"
    );

    expect(html).toContain('href="smartapp.py"');
    expect(html).toContain("智能路由助手 smartapp.py");
  });

  it("reads the target-year available days from split portal quota tables", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

headers = ["休假类型", "年份", "休假天数", "锁班天数", "解锁天数", "可休天数"]
rows = [
    ["健康疗养", "2026", "20", "6", "0", "14"],
    ["健康疗养", "2023", "20", "6", "0", "14"],
]
parsed = module.parse_quota_rows(headers, rows)

assert parsed[0] == {
    "休假类型": "健康疗养",
    "年份": "2026",
    "休假天数": "20",
    "锁班天数": "6",
    "解锁天数": "0",
    "可休天数": "14",
}, parsed
assert module.available_days_for_year(parsed, 2026) == 14
`);
  });

  it("passes Playwright wait arguments by keyword during employee recognition", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

class FakeLocator:
    def __init__(self, value=""):
        self.value = value
    def click(self):
        pass
    def fill(self, value):
        self.value = value
    def type(self, value, delay=None):
        self.value = value
    def input_value(self):
        return self.value

class FakePage:
    def __init__(self):
        self.employee = FakeLocator()
        self.wait_arg = None
    def locator(self, selector):
        if selector == "#showIdshowNonproductionTaskImportPage":
            return self.employee
        if selector == "#nonproductionTaskImportStaffNumId":
            return FakeLocator("123456")
        if selector == "#nameInfo":
            return FakeLocator("测试甲")
        raise AssertionError(selector)
    def evaluate(self, expression):
        pass
    def wait_for_function(self, expression, *, arg=None, timeout=None):
        self.wait_arg = arg

page = FakePage()
name = module.fill_employee(page, "123456", "测试甲")

assert name == "测试甲", name
assert page.wait_arg == {"employeeId": "123456", "name": "测试甲"}, page.wait_arg
`);
  });

  it("keeps non-routed leave types unchanged, including cross-year ranges", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = module.parse_single_record("282119 陈坤淋 PARENT_LVE 2026-12-31 2027-01-02")
segments, error = module.route_record(record, {})

assert error == "", error
assert [(item["请假类型"], item["开始日期"], item["结束日期"], item["计划天数"]) for item in segments] == [
    ("PARENT_LVE", "2026-12-31", "2027-01-02", 3),
], segments

annual_record = module.parse_single_record("123456 测试甲 ALV 2026-09-01 2026-09-01")
annual_segments, annual_error = module.route_record(annual_record, {})
assert annual_error == "", annual_error
assert annual_segments[0]["请假类型"] == "ALV", annual_segments
`);
  });

  it("allows configured non-routed leave types to be selected on the portal form", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

class FakePage:
    def __init__(self):
        self.evaluate_arg = None
        self.wait_arg = None
    def evaluate(self, expression, arg):
        self.evaluate_arg = arg
    def wait_for_function(self, expression, *, arg=None, timeout=None):
        self.wait_arg = arg

page = FakePage()
module.select_leave_type(page, "BS_STUDY")

assert page.evaluate_arg == "BS_STUDY", page.evaluate_arg
assert page.wait_arg == "BS_STUDY", page.wait_arg
`);
  });

  it("selects an unlock candidate only by employee, locked status and overlapping dates", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV",
    "开始日期": "2026-09-02",
    "结束日期": "2026-09-02",
}
rows = [
    {
        "序号": "9001",
        "状态": "已锁",
        "员工号": "123456",
        "开始日期": "2026-09-01 08:59:00",
        "结束日期": "2026-09-03 19:59:00",
        "锁班类型": "BS_STUDY",
        "锁班名称": "业务学习(占值勤期类别)",
        "锁班原因": "原业务学习备注",
        "录入人": "100001",
        "录入时间": "2026-07-27 14:54:41",
    },
    {
        "序号": "9002",
        "状态": "已解锁",
        "员工号": "123456",
        "开始日期": "2026-09-02 08:59:00",
        "结束日期": "2026-09-02 19:59:00",
    },
    {
        "序号": "9003",
        "状态": "已锁",
        "员工号": "654321",
        "开始日期": "2026-09-02 08:59:00",
        "结束日期": "2026-09-02 19:59:00",
    },
]

candidate, error = module.choose_unlock_candidate(rows, record)
assert error == "", error
assert candidate["序号"] == "9001", candidate

duplicate = dict(rows[0], 序号="9004")
candidate, error = module.choose_unlock_candidate(rows + [duplicate], record)
assert candidate is None, candidate
assert "2条" in error, error

candidate, error = module.choose_unlock_candidate(rows[1:], record)
assert candidate is None, candidate
assert "未找到" in error, error
`);
  });

  it("formats a complete Excel note for the unlocked old record", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

old_row = {
    "序号": "9001",
    "锁班类型": "BS_STUDY",
    "锁班名称": "业务学习(占值勤期类别)",
    "开始日期": "2026-09-01 08:59:00",
    "结束日期": "2026-09-03 19:59:00",
    "锁班原因": "一段很长的原始锁班原因，用来证明门户备注会按最大长度截断但关键身份不会丢失",
}
note = module.format_unlocked_record_excel_note(old_row)

assert "锁班名称业务学习(占值勤期类别)" in note, note
assert "锁班原因一段很长的原始锁班原因" in note, note
assert "开始日期2026-09-01 08:59:00" in note, note
assert "结束日期2026-09-03 19:59:00" in note, note
`);
  });

  it("uses the requested public leave first and routes the remaining date to recuperation", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV_FD",
    "开始日期": "2026-08-09",
    "结束日期": "2026-08-10",
}
segments, error = module.route_record(record, {"ALV_FD": 1, "RECU_LVE": 14})

assert error == "", error
assert [(item["请假类型"], item["开始日期"], item["结束日期"], item["计划天数"]) for item in segments] == [
    ("ALV_FD", "2026-08-09", "2026-08-09", 1),
    ("RECU_LVE", "2026-08-10", "2026-08-10", 1),
], segments
`);
  });

  it("routes a recuperation overflow to a public-leave tail segment", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "RECU_LVE",
    "开始日期": "2026-08-01",
    "结束日期": "2026-08-16",
}
segments, error = module.route_record(record, {"RECU_LVE": 14, "ALV_FD": 2})

assert error == "", error
assert [(item["请假类型"], item["开始日期"], item["结束日期"], item["计划天数"]) for item in segments] == [
    ("RECU_LVE", "2026-08-01", "2026-08-14", 14),
    ("ALV_FD", "2026-08-15", "2026-08-16", 2),
], segments
`);
  });

  it("routes the full range to the alternate type when requested quota is zero", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV_FD",
    "开始日期": "2026-08-09",
    "结束日期": "2026-08-10",
}
segments, error = module.route_record(record, {"ALV_FD": 0, "RECU_LVE": 14})

assert error == "", error
assert [(item["请假类型"], item["开始日期"], item["结束日期"], item["计划天数"]) for item in segments] == [
    ("RECU_LVE", "2026-08-09", "2026-08-10", 2),
], segments
`);
  });

  it("does not create partial segments when combined quota is insufficient", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV_FD",
    "开始日期": "2026-08-01",
    "结束日期": "2026-08-17",
}
segments, error = module.route_record(record, {"ALV_FD": 1, "RECU_LVE": 14})

assert segments == [], segments
assert "合计15天" in error, error
assert "需要17天" in error, error
`);
  });

  it("rejects cross-year records before quota routing", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "RECU_LVE",
    "开始日期": "2026-12-31",
    "结束日期": "2027-01-01",
}
segments, error = module.route_record(record, {"RECU_LVE": 14, "ALV_FD": 1})

assert segments == [], segments
assert "跨自然年" in error, error
`);
  });

  it("keeps original and routed segment fields in the smart result workbook", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path
from openpyxl import load_workbook

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

record = {
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV_FD",
    "开始日期": "2026-08-09",
    "结束日期": "2026-08-10",
}
segments, error = module.route_record(record, {"ALV_FD": 1, "RECU_LVE": 14})
assert error == "", error

output_file = module.create_result_excel("smart_test")
try:
    module.append_result_excel(
        output_file,
        1,
        1,
        record,
        segments[0],
        {"ALV_FD": 1, "RECU_LVE": 14},
        "成功",
        {
            "锁班结果": "待审批",
            "员工号": "123456",
            "姓名": "测试甲",
            "开始日期": "2026-08-09 08:59:00",
            "结束日期": "2026-08-09 19:59:00",
            "锁班类型": "飞行员公休（订座）",
        },
        "",
        attempt=2,
        recovery="已解锁旧记录并重提一次",
        unlocked_row={
            "序号": "9001",
            "状态": "已锁",
            "员工号": "123456",
            "姓名": "测试甲",
            "开始日期": "2026-09-01 08:59:00",
            "结束日期": "2026-09-03 19:59:00",
            "锁班天数": "3",
            "锁班类型": "BS_STUDY",
            "锁班名称": "业务学习(占值勤期类别)",
            "锁班原因": "原业务学习备注",
            "录入人": "100001",
            "录入时间": "2026-07-27 14:54:41",
        },
        excel_note="已解锁：锁班名称业务学习；锁班原因原业务学习备注；开始日期2026-09-01；结束日期2026-09-03",
    )
    workbook = load_workbook(output_file)
    sheet = workbook.active
    headers = [cell.value for cell in sheet[1]]
    row = [cell.value for cell in sheet[2]]
    workbook.close()
finally:
    Path(output_file).unlink(missing_ok=True)

assert headers == module.RESULT_HEADERS, headers
assert row[0:2] == [1, 1], row
assert row[4:7] == ["飞行员公休（订座）", "2026-08-09", "2026-08-10"], row
assert row[7:11] == ["飞行员公休（订座）", "2026-08-09", "2026-08-09", 1], row
assert row[11:13] == [1, 14], row
assert row[13] == "成功", row
by_header = dict(zip(headers, row))
assert by_header["尝试次数"] == 2, by_header
assert by_header["冲突回退"] == "已解锁旧记录并重提一次", by_header
assert by_header["解锁序号"] == "9001", by_header
assert by_header["解锁类型"] == "BS_STUDY", by_header
assert by_header["解锁原因"] == "原业务学习备注", by_header
assert by_header["备注"] == "已解锁：锁班名称业务学习；锁班原因原业务学习备注；开始日期2026-09-01；结束日期2026-09-03", by_header
`);
  });

  it("continues with the next record after a recoverable record failure", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
from pathlib import Path

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

records = [
    {"员工号": "123456", "姓名": "测试甲", "请假类型": "ALV", "开始日期": "2026-09-01", "结束日期": "2026-09-01"},
    {"员工号": "654321", "姓名": "测试乙", "请假类型": "GRD", "开始日期": "2026-09-02", "结束日期": "2026-09-02"},
]
calls = []

def fake_process(page, record, sequence, result_file, common_reason, conflict_recovery):
    calls.append((sequence, record["员工号"], conflict_recovery))
    return (False, "首条冲突回退失败") if sequence == 1 else (True, "")

module.process_smart_record = fake_process
module.beep_error = lambda: None
failed = module.process_record_list(None, records, None, None, True)

assert calls == [(1, "123456", True), (2, "654321", True)], calls
assert len(failed) == 1, failed
assert failed[0][0]["员工号"] == "123456", failed
`);
  });

  it("reads smart Excel input by headers and normalizes business dates", () => {
    runPythonCheck(String.raw`
import importlib.util
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from openpyxl import Workbook

path = Path("public/tool/app/lock-entry-helper/smartapp.py")
spec = importlib.util.spec_from_file_location("smartapp", path)
module = importlib.util.module_from_spec(spec)
sys.modules["smartapp"] = module
spec.loader.exec_module(module)

workbook = Workbook()
sheet = workbook.active
sheet.append(["姓名", "结束日期", "工号", "开始日期", "请假类型"])
sheet.append(["测试甲", "2026/8/10", 123456, datetime(2026, 8, 9), "飞行员公休（订座）"])
with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as file:
    temp_path = file.name
workbook.save(temp_path)
workbook.close()

try:
    records, errors = module.parse_excel_file(temp_path)
finally:
    Path(temp_path).unlink(missing_ok=True)

assert errors == [], errors
assert records == [{
    "员工号": "123456",
    "姓名": "测试甲",
    "请假类型": "ALV_FD",
    "开始日期": "2026-08-09",
    "结束日期": "2026-08-10",
}], records
`);
  });
});
