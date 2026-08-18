import { describe, it } from "vitest";

import { runLockEntryPython } from "./python";

describe("lock entry smart routing", () => {
  it("keeps quota parsing and primary-first date segmentation", () => {
    runLockEntryPython(String.raw`
from lock_entry.smart_router import available_days_for_year, parse_quota_rows, route_record

headers = ["休假类型", "年份", "休假天数", "锁班天数", "解锁天数", "可休天数"]
parsed = parse_quota_rows(headers, [["健康疗养", "2026", "20", "6", "0", "3"]])
assert available_days_for_year(parsed, 2026) == 3
segments, error = route_record(
    {"员工号": "123456", "姓名": "示例人员", "请假类型": "RECU_LVE", "开始日期": "2026-06-13", "结束日期": "2026-06-20"},
    {"RECU_LVE": 3, "ALV_FD": 10},
)
assert error == "", error
assert [(item["请假类型"], item["计划天数"]) for item in segments] == [("RECU_LVE", 3), ("ALV_FD", 5)]
`);
  });

  it("only chooses one overlapping locked record", () => {
    runLockEntryPython(String.raw`
from lock_entry.smart_input import choose_unlock_candidate

record = {"员工号": "123456", "开始日期": "2026-06-13", "结束日期": "2026-06-20"}
rows = [{
    "序号": "1", "状态": "已锁", "员工号": "123456", "姓名": "示例人员",
    "开始日期": "2026-06-15 08:59:00", "结束日期": "2026-06-16 19:59:00",
}]
candidate, error = choose_unlock_candidate(rows, record)
assert error == "" and candidate["序号"] == "1", (candidate, error)
candidate, error = choose_unlock_candidate(rows + [dict(rows[0], 序号="2")], record)
assert candidate is None and "2条" in error, (candidate, error)
`);
  });
});
