import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { compareQualificationRosters } from "../../../src/tool/app/qualification-roster-compare/comparison";
import { buildQualificationExportWorkbook } from "../../../src/tool/app/qualification-roster-compare/export";
import type { ParsedQualificationSource } from "../../../src/tool/app/qualification-roster-compare/models";

describe("qualification roster comparison export", () => {
  it("exports summary and differences from the comparison result", () => {
    const personnel: ParsedQualificationSource = {
      source: "personnel",
      sheetName: "人员信息",
      headerRowNumber: 1,
      qualificationCodes: ["EAMA"],
      issues: [],
      records: [
        { source: "personnel", employeeId: "100001", name: "张三", qualificationCode: "EAMA", personnelRole: "机长", sheetName: "人员信息", rowNumber: 2 },
        { source: "personnel", employeeId: "100002", name: "李四", qualificationCode: "EAMA", personnelRole: "副驾驶", sheetName: "人员信息", rowNumber: 3 }
      ]
    };
    const portal: ParsedQualificationSource = {
      source: "portal",
      sheetName: "门户名单",
      headerRowNumber: 1,
      qualificationCodes: ["EAMA"],
      issues: [],
      records: [
        { source: "portal", employeeId: "100001", name: "张三", qualificationCode: "EAMA", personnelRole: "", sheetName: "门户名单", rowNumber: 2 },
        { source: "portal", employeeId: "100003", name: "王五", qualificationCode: "EAMA", personnelRole: "", sheetName: "门户名单", rowNumber: 3 }
      ]
    };
    const result = compareQualificationRosters(personnel, portal);

    const workbook = buildQualificationExportWorkbook(XLSX, result);
    const summary = workbook.Sheets["资质汇总"];
    const differences = workbook.Sheets["差异明细"];

    expect(workbook.SheetNames).toEqual(["资质汇总", "差异明细", "数据问题"]);
    expect(summary.A1.v).toBe("资质");
    expect(summary.G2.v).toBe(2);
    expect(summary["!autofilter"]?.ref).toBe("A1:G2");
    expect(summary["!cols"]).toHaveLength(7);
    expect((summary as XLSX.WorkSheet & { "!freeze"?: { ySplit: number } })["!freeze"]?.ySplit).toBe(1);
    expect(differences.A1.v).toBe("资质");
    expect(differences.B1.v).toBe("差异类型");
    expect(differences.A2.v).toBe("EAMA");
    expect([differences.B2.v, differences.B3.v]).toEqual(["仅飞行门户", "仅人员信息"]);
    expect([differences.C2.v, differences.C3.v]).toEqual(["100003", "100002"]);
    expect(differences["!autofilter"]?.ref).toBe("A1:I3");
  });
});
