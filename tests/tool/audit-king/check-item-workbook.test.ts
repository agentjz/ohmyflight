import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";

import { createAuditKingCheckItemWorkbook } from "../../../src/tool/app/audit-king/check-item-workbook";

describe("audit-king check item workbook", () => {
  const api = createAuditKingCheckItemWorkbook(XLSX);

  it("round-trips current check items, candidate evidence and audit evidence", () => {
    const workbook = api.buildWorkbook([{
      id: "item-1", code: "1.1", name: "进入条件", keyword: "进入机长训练", color: "#f59e0b", enabled: true,
      source: { blockId: "c-b1", blockIndex: 1, start: 2, end: 8, text: "进入机长训练" },
      manualEvidences: [{ id: "m-1", documentName: "手册.pdf", pageNumber: 7, blockIndex: 12, text: "应满足资格要求", mode: "loose" }],
      auditEvidences: [{ id: "a-1", content: "应满足资格要求", note: "已复核", sourceEvidenceId: "m-1" }]
    }]);

    const parsed = api.parseWorkbook(workbook);
    const firstItem = parsed[0]!;

    expect(firstItem).toMatchObject({ code: "1.1", name: "进入条件", keyword: "进入机长训练", enabled: true });
    expect(firstItem.source).toMatchObject({ blockId: "c-b1", start: 2, end: 8 });
    expect(firstItem.manualEvidences![0]!).toMatchObject({ id: "m-1", documentName: "手册.pdf", pageNumber: 7, text: "应满足资格要求" });
    expect(firstItem.auditEvidences![0]!).toMatchObject({ content: "应满足资格要求", note: "已复核", sourceEvidenceId: "m-1" });
  });

  it("keeps missing code and name empty instead of inferring them", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      api.itemHeaders,
      [1, "", "", "定期复训", "是", "#123456"]
    ]), "检查项");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([api.manualHeaders]), "手册证据");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([api.auditHeaders]), "审计依据");

    expect(api.parseWorkbook(workbook)[0]).toMatchObject({ code: "", name: "", keyword: "定期复训" });
  });

  it("rejects old or incomplete workbook structures", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["关键词"], ["训练"]]), "关键词");

    expect(() => api.parseWorkbook(workbook)).toThrow("必须包含检查项、手册证据、审计依据三个工作表");
  });
});
