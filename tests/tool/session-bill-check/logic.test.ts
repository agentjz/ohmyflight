import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { createSessionBillLogic } from "../../../src/tool/app/session-bill-check/logic";
import type { SessionBillCompareRow } from "../../../src/tool/app/session-bill-check/models";

const logic = createSessionBillLogic(XLSX);

function buildWorkbook(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return workbook;
}

describe("session bill check logic", () => {
  it("splits session names by Chinese and English comma and trims spaces", () => {
    expect(logic.splitNames("李宁, 刘镇毓，Shim Jae Hoon")).toEqual([
      "李宁",
      "刘镇毓",
      "Shim Jae Hoon"
    ]);
  });

  it("compares merged session roles with full-motion and theory bill names", () => {
    const sessionWorkbook = buildWorkbook({
      Sheet1: [
        ["标题"],
        [],
        ["序号", "学员", "教员", "检查员"],
        [1, "李宁,刘镇毓", "王强", ""],
        [2, "Shim Jae Hoon", "", "李宁"],
        [3, "", "王强", ""]
      ]
    });
    const billWorkbook = buildWorkbook({
      全动: [
        ["员工号", "姓名", "训练性质"],
        ["1", "李宁", "复训"],
        ["2", "刘镇毓", "复训"],
        ["3", "SHIM Jae Hoon", "复训"],
        ["4", "王强", "复训"]
      ],
      理论: [
        ["员工号", "身份证号", "姓名"],
        ["5", "", "李宁"],
        ["6", "", "王强"],
        ["7", "", "账单多的人"]
      ],
      账单: [["不参与"]],
      全动汇总: [["不参与"]],
      理论汇: [["不参与"]]
    });

    const session = logic.analyzeSessionWorkbook(sessionWorkbook);
    const bill = logic.analyzeBillWorkbook(billWorkbook);
    const result = logic.compareEntries(session.entries, bill.entries, {
      sessionSheetName: session.sheetName,
      billSheetNames: bill.sheetNames
    });

    const byName = new Map<string, SessionBillCompareRow>(result.rows.map(row => [row.name, row]));
    expect(byName.get("Shim Jae Hoon")?.status).toBe("一致");
    expect(byName.get("Shim Jae Hoon")?.sessionCount).toBe(1);
    expect(byName.get("Shim Jae Hoon")?.billCount).toBe(1);
    expect(byName.get("Shim Jae Hoon")?.matchedNames).toBe("Shim Jae Hoon / SHIM Jae Hoon");
    expect(session.entries[0].rowNumber).toBe(4);
    expect(byName.get("李宁")?.status).toBe("一致");
    expect(byName.get("王强")?.status).toBe("一致");
    expect(byName.get("账单多的人")?.status).toBe("仅账单有");
    expect(result.summary.sessionTotal).toBe(6);
    expect(result.summary.billTotal).toBe(7);
    expect(result.summary.mismatchNames).toBe(1);
  });

  it("exports the expected workbook sheets", () => {
    const result = logic.compareEntries(
      [{ name: "A", matchName: "a", source: "场次", sheetName: "Sheet1", rowNumber: 2 }],
      [{ name: "B", matchName: "b", source: "账单", sheetName: "全动", rowNumber: 2 }]
    );
    const workbook = logic.buildExportWorkbook(result);
    expect(workbook.SheetNames).toEqual(["核对汇总", "姓名差异明细", "场次拆分明细", "账单姓名明细"]);
    expect(workbook.Sheets["姓名差异明细"].A1.v).toBe("状态");
    expect(workbook.Sheets["场次拆分明细"].F1.v).toBe("日期");
    expect(workbook.Sheets["账单姓名明细"].I1.v).toBe("训练性质");
  });
});
