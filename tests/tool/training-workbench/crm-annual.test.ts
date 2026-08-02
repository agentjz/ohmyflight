import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolCrmAnnual as CrmAnnual } from "../../../src/tool/app/training-workbench/scripts/crm-annual";
import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "分部", "技术信息", "是否运行", "备注"],
    ["1001", "张三", "一分部", "机长", "是", ""],
    ["1002", "李四", "二分部", "副驾驶", "是", ""],
    ["1003", "王五", "三分部", "机长", "是", ""],
    ["1004", "张雨", "教员组", "教员", "是", "CRM教员"],
    ["1006", "王军锋", "教员组", "教员", "是", "CRM教员"],
    ["1005", "赵六", "三分部", "副驾驶", "否", "不运行"],
    ["1007", "钱七", "一分部", "777:飞行教员A", "是", ""],
    ["1008", "孙八", "二分部", "777:A2类副驾驶", "是", ""],
    ["1009", "周九", "三分部", "转入待定", "是", ""]
  ], { cellDates: true });
  const oldCrmSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "培训信息是否录入", "教员", "备注"],
    ["1002", "李四", makeDate(2026, 1, 1), makeDate(2026, 1, 1), "是", "田鹏", ""]
  ], { cellDates: true });
  const crmSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "培训信息是否录入", "教员", "备注"],
    ["1001", "张三", makeDate(2026, 12, 31), makeDate(2026, 12, 31), "否", "张雨", ""],
    ["1001", "张三", makeDate(2026, 5, 1), makeDate(2026, 5, 1), "否", "田鹏", ""],
    ["1002", "李四", makeDate(2027, 1, 1), makeDate(2027, 1, 1), "否", "田鹏", ""],
    ["", "李四", makeDate(2026, 2, 1), makeDate(2026, 2, 1), "否", "田鹏", ""],
    ["1003", "王五", makeDate(2026, 6, 1), makeDate(2026, 6, 1), "是", "张雨", "取消"],
    ["1007", "钱七", makeDate(2026, 3, 2), makeDate(2026, 3, 2), "否", "张雨", "取消"],
    ["1007", "钱七", makeDate(2026, 3, 1), makeDate(2026, 3, 1), "否", "张雨", ""],
    ["1009", "周九", makeDate(2026, 4, 1), makeDate(2026, 4, 1), "否", "张雨", ""]
  ], { cellDates: true });

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, oldCrmSheet, "CRM2025(不参与统计)");
  XLSX.utils.book_append_sheet(workbook, crmSheet, "CRM");
  return workbook;
}

describe("crm annual check", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("checks CRM by calendar year from the exact CRM sheet only", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = CrmAnnual.buildAnnualCheck(workbook, analysis, Scanner, 2026);

    expect(result.hasCrmSheet).toBe(true);
    expect(result.requiredPeople.map((person: any) => person.name)).toEqual(["张三", "李四", "王五", "王军锋", "赵六", "钱七", "孙八", "周九"]);
    expect(result.attendedPeople.map((person: any) => person.name)).toEqual(["张三", "李四", "钱七", "周九"]);
    expect(result.missingPeople.map((person: any) => person.name)).toEqual(["王五", "王军锋", "赵六", "孙八"]);
    expect(result.stats).toMatchObject({
      required: 8,
      attended: 4,
      missing: 4,
      duplicates: 1,
      instructors: 5
    });
    expect(result.duplicateRows).toHaveLength(1);
    expect(result.duplicateRows[0]).toMatchObject({
      employeeId: "1001",
      name: "张三",
      count: 2,
      rowNumbers: [3, 2],
      dates: ["2026-05-01", "2026-12-31"],
      instructors: ["田鹏", "张雨"]
    });
    expect(result.participationRows).toEqual([
      { name: "已参加", value: 4, kind: "attended" },
      { name: "未参加", value: 4, kind: "missing" }
    ]);
    expect(result.monthlyRows[1]).toEqual({ label: "2月", count: 1, kind: "attended" });
    expect(result.monthlyRows[2]).toEqual({ label: "3月", count: 1, kind: "attended" });
    expect(result.monthlyRows[3]).toEqual({ label: "4月", count: 1, kind: "attended" });
    expect(result.monthlyRows[4]).toEqual({ label: "5月", count: 1, kind: "attended" });
    expect(result.monthlyRows[11]).toEqual({ label: "12月", count: 0, kind: "attended" });
    expect(result.monthlyRows[12]).toEqual({ label: "未参加", count: 4, kind: "missing" });
    expect(result.roleRows).toEqual([
      { role: "教员", required: 2, attended: 1, missing: 1, attendedRate: 0.5 },
      { role: "机长", required: 2, attended: 1, missing: 1, attendedRate: 0.5 },
      { role: "副驾驶", required: 3, attended: 1, missing: 2, attendedRate: 1 / 3 },
      { role: "未识别", required: 1, attended: 1, missing: 0, attendedRate: 1 }
    ]);
  });
});
