import { describe, it } from "vitest";

import { runLockEntryPython } from "./python";

describe("lock entry portal matching and export", () => {
  it("matches the current portal row and writes the original result schema", () => {
    runLockEntryPython(String.raw`
from pathlib import Path
from openpyxl import load_workbook
from lock_entry.common import result_row_matches_record
from lock_entry.exporter import RESULT_HEADERS, append_result_excel, create_result_excel
from lock_entry.input_data import parse_single_record

record = parse_single_record("123456 示例人员 PARENT_LVE 2026-06-13 2026-06-20")
row = {
    "锁班结果": "待审批",
    "员工号": "123456",
    "姓名": "示例人员",
    "开始日期": "2026-06-13 08:59:00",
    "结束日期": "2026-06-20 19:59:00",
    "锁班类型": "探亲假-探父母",
    "_text": "待审批 | 123456 | 示例人员 | 2026-06-13 08:59:00 | 2026-06-20 19:59:00 | 探亲假-探父母",
}
assert result_row_matches_record(row, record)
output_file = create_result_excel("modular_original_test")
try:
    append_result_excel(output_file, 1, record, "成功", row, "")
    workbook = load_workbook(output_file)
    sheet = workbook.active
    assert [cell.value for cell in sheet[1]] == RESULT_HEADERS
    assert sheet[2][1].value == "123456"
    assert sheet[2][6].value == "成功"
    workbook.close()
finally:
    Path(output_file).unlink(missing_ok=True)
`);
  });
});
