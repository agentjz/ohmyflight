import { describe, it } from "vitest";

import { runLockEntryPython } from "./python";

describe("lock entry input modules", () => {
  it("keeps original pasted-input parsing and whitelist behavior", () => {
    runLockEntryPython(String.raw`
from lock_entry.input_data import parse_batch_input, parse_single_record

record = parse_single_record("123456 示例人员 PARENT_LVE 2026-06-13 2026-06-20")
assert record == {
    "员工号": "123456",
    "姓名": "示例人员",
    "请假类型": "PARENT_LVE",
    "开始日期": "2026-06-13",
    "结束日期": "2026-06-20",
}, record

records, errors = parse_batch_input(
    "123456 示例人员 PARENT_LVE 2026-06-13 2026-06-20\n654321 示例人员二 RECU_LVE 2026-06-21 2026-06-30",
    {"123456"},
)
assert len(records) == 1 and records[0]["员工号"] == "123456", records
assert errors == [], errors
`);
  });

  it("maps smart Excel columns by header aliases", () => {
    runLockEntryPython(String.raw`
from lock_entry.smart_input import excel_header_indexes, format_business_date

indexes, missing = excel_header_indexes(("日期", "工号", "姓名", "请假类型", "开始日期", "结束日期"))
assert not missing, missing
assert indexes["员工号"] == 1 and indexes["锁班类型"] == 3, indexes
assert format_business_date(20260613) == "2026-06-13"
`);
  });
});
