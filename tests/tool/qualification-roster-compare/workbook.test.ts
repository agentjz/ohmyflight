import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import {
  normalizeEmployeeId,
  parsePersonnelWorkbook,
  parsePortalWorkbook
} from "../../../src/tool/app/qualification-roster-compare/workbook";

function buildWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return workbook;
}

describe("qualification roster workbook parsing", () => {
  it("normalizes numeric and textual employee ids without changing leading zeroes", () => {
    expect(normalizeEmployeeId(181524)).toBe("181524");
    expect(normalizeEmployeeId(181524.0)).toBe("181524");
    expect(normalizeEmployeeId("181524.0")).toBe("181524");
    expect(normalizeEmployeeId(" 00181524 ")).toBe("00181524");
  });

  it("finds the personnel table by headers instead of sheet name, row or column", () => {
    const workbook = buildWorkbook({
      首页: [["说明"]],
      自定义名单: [
        ["南货航飞行实力"],
        [],
        ["备注", "姓名", "EAMA", "员工号", "RAMA", "REUO"],
        ["", "张三", 1, 100001, "", 2],
        ["", "李四", 2, "001002", 1, ""],
        ["", "王五", "", "100003.0", "", "异常"]
      ]
    });

    const result = parsePersonnelWorkbook(XLSX, workbook);

    expect(result.sheetName).toBe("自定义名单");
    expect(result.headerRowNumber).toBe(3);
    expect(result.qualificationCodes).toEqual(["EAMA", "RAMA", "REUO"]);
    expect(result.records).toEqual([
      expect.objectContaining({ employeeId: "100001", name: "张三", qualificationCode: "EAMA", personnelRole: "机长", rowNumber: 4 }),
      expect.objectContaining({ employeeId: "100001", name: "张三", qualificationCode: "REUO", personnelRole: "副驾驶", rowNumber: 4 }),
      expect.objectContaining({ employeeId: "001002", name: "李四", qualificationCode: "EAMA", personnelRole: "副驾驶", rowNumber: 5 }),
      expect.objectContaining({ employeeId: "001002", name: "李四", qualificationCode: "RAMA", personnelRole: "机长", rowNumber: 5 })
    ]);
    expect(result.issues).toEqual([
      expect.objectContaining({ rowNumber: 6, qualificationCode: "REUO", kind: "invalid-role" })
    ]);
  });

  it("finds the portal roster by headers and deduplicates the same employee qualification", () => {
    const workbook = buildWorkbook({
      说明: [["导出说明"]],
      任意名称: [
        ["运行资质导出"],
        ["姓名", "资质类别", "员工号", "在职状态"],
        ["张三", " eama ", 100001, "在职"],
        ["张三", "EAMA", "100001.0", "在职"],
        ["李四", "REUO", "001002", "在职"],
        ["无工号", "RAMA", "", "在职"],
        ["王五", "不是代码", "100003", "在职"]
      ]
    });

    const result = parsePortalWorkbook(XLSX, workbook);

    expect(result.sheetName).toBe("任意名称");
    expect(result.headerRowNumber).toBe(2);
    expect(result.qualificationCodes).toEqual(["EAMA", "REUO"]);
    expect(result.records).toEqual([
      expect.objectContaining({ employeeId: "100001", name: "张三", qualificationCode: "EAMA", rowNumber: 3 }),
      expect.objectContaining({ employeeId: "001002", name: "李四", qualificationCode: "REUO", rowNumber: 5 })
    ]);
    expect(result.issues.map((issue) => issue.kind)).toEqual([
      "duplicate-qualification",
      "missing-employee-id",
      "invalid-qualification-code"
    ]);
  });

  it("deduplicates repeated personnel qualifications and reports the data issue", () => {
    const workbook = buildWorkbook({
      名单: [
        ["员工号", "姓名", "EAMA"],
        [100001, "张三", 1],
        ["100001.0", "张三", 1]
      ]
    });
    const result = parsePersonnelWorkbook(XLSX, workbook);
    expect(result.records).toHaveLength(1);
    expect(result.issues).toEqual([expect.objectContaining({ kind: "duplicate-qualification", employeeId: "100001", qualificationCode: "EAMA", rowNumber: 3 })]);
  });

  it("reports a clear error when no structural match exists", () => {
    const workbook = buildWorkbook({ Sheet1: [["姓名", "员工号"], ["张三", 1]] });

    expect(() => parsePersonnelWorkbook(XLSX, workbook)).toThrow("未找到人员信息表");
    expect(() => parsePortalWorkbook(XLSX, workbook)).toThrow("未找到飞行门户资质名册");
  });
});
