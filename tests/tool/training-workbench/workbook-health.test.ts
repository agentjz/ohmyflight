import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolWorkbookHealth as WorkbookHealth } from "../../../src/tool/app/training-workbench/scripts/workbook-health";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "分部", "技术信息", "应急训练", "危险品", "航空安保", "TSA", "疲劳管理", "飞行作风", "英语能力", "汉语能力", "是否运行", "备注"],
    ["1001", "张三", "一分部", "777:C类机长", makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), "是", ""],
    ["1001", "重复员工号", "一分部", "转入待定", makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), makeDate(2026, 5, 31), "是", ""]
  ], { cellDates: true });
  const projectHeaders = ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"];
  const normalProjectSheet = XLSX.utils.aoa_to_sheet([
    projectHeaders,
    ["1001", "张三", "应急训练", "是", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", "取消"],
    ["1002", "李四", "应急训练", "否", "不是日期", "", "", ""]
  ], { cellDates: true });
  const crmOldSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "培训信息是否录入", "教员", "备注"],
    ["1001", "张三", makeDate(2025, 1, 1), makeDate(2025, 1, 1), "是", "张雨", ""]
  ], { cellDates: true });
  const crmSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "培训信息是否录入", "教员", "备注"],
    ["1001", "张三", makeDate(2026, 3, 1), makeDate(2026, 3, 1), "否", "张雨", ""],
    ["1001", "张三", makeDate(2026, 9, 1), makeDate(2026, 9, 1), "否", "田鹏", ""]
  ], { cellDates: true });
  const ignoredSheet = XLSX.utils.aoa_to_sheet([
    ["随便写"],
    ["不参与监控"]
  ]);

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "应急训练");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "危险品");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "航空安保");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "TSA");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "疲劳管理");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "飞行作风");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "英语能力");
  XLSX.utils.book_append_sheet(workbook, normalProjectSheet, "汉语能力");
  XLSX.utils.book_append_sheet(workbook, crmOldSheet, "CRM2025(不参与统计)");
  XLSX.utils.book_append_sheet(workbook, crmSheet, "CRM");
  XLSX.utils.book_append_sheet(workbook, ignoredSheet, "新雇员培训");
  return workbook;
}

function buildSecurityTsaWorkbook(
  securityRows: unknown[][],
  tsaRows: unknown[][]
): XLSX.WorkBook {
  const workbook = buildWorkbook();
  const projectHeaders = ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"];

  workbook.Sheets["航空安保"] = XLSX.utils.aoa_to_sheet([
    projectHeaders,
    ...securityRows
  ], { cellDates: true });
  workbook.Sheets.TSA = XLSX.utils.aoa_to_sheet([
    projectHeaders,
    ...tsaRows
  ], { cellDates: true });
  return workbook;
}

describe("workbook health", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("reports current workbook structure and data health without duplicating business rules", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = WorkbookHealth.buildWorkbookHealth(workbook, analysis, Scanner, { crmYear: 2026 });
    const messages = result.items.map((item: any) => `${item.area}|${item.message}|${item.detail}`);

    expect(result.summary.warning).toBeGreaterThan(0);
    expect(messages).toContain("人员信息表|员工号 1001 重复出现。|行号：2、3");
    expect(messages.some((message: string) => message.includes("培训信息是否录入为“是”，但备注包含“取消”"))).toBe(true);
    expect(messages.some((message: string) => message.includes("培训日期无法解析"))).toBe(true);
    expect(messages.some((message: string) => message.includes("发现工作表“CRM2025(不参与统计)”，系统不会作为当年 CRM 核对来源。"))).toBe(true);
    expect(messages.some((message: string) => message.includes("2026 年 CRM 核对可生成。"))).toBe(true);
    expect(messages.some((message: string) => message.includes("2026 年 CRM 有 1 人重复安排。"))).toBe(true);
    expect(messages.some((message: string) => message.includes("工作表“新雇员培训”当前不参与培训皇帝监控。"))).toBe(true);
  });

  it("checks attendee consistency only for security and TSA sessions with the same date range", () => {
    const sameStart = makeDate(2026, 5, 10);
    const sameEnd = makeDate(2026, 5, 11);
    const workbook = buildSecurityTsaWorkbook([
      ["1001", "张三", "航空安保", "否", sameStart, sameEnd, "", ""],
      ["1002", "李四", "航空安保", "否", sameStart, sameEnd, "", ""],
      ["1005", "已取消", "航空安保", "否", sameStart, sameEnd, "", "取消"],
      ["1003", "日期不同", "航空安保", "否", makeDate(2026, 6, 1), makeDate(2026, 6, 1), "", ""]
    ], [
      ["1001", "张三", "TSA", "是", sameStart, sameEnd, "", ""],
      ["1004", "王五", "TSA", "否", sameStart, sameEnd, "", ""],
      ["1003", "日期不同", "TSA", "否", makeDate(2026, 6, 2), makeDate(2026, 6, 2), "", ""]
    ]);
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = WorkbookHealth.buildWorkbookHealth(workbook, analysis, Scanner, { crmYear: 2026 });
    const consistencyItems = result.items.filter((item: any) => item.area === "安保 / TSA 名单");

    expect(consistencyItems).toHaveLength(1);
    expect(consistencyItems[0].level).toBe("warning");
    expect(consistencyItems[0].message).toBe("2026-05-10 至 2026-05-11 名单不一致。");
    expect(consistencyItems[0].detail).toContain("仅航空安保：1002 / 李四（第3行）");
    expect(consistencyItems[0].detail).toContain("仅 TSA：1004 / 王五（第3行）");
    expect(consistencyItems[0].detail).not.toContain("已取消");
    expect(consistencyItems[0].detail).not.toContain("日期不同");
  });

  it("does not warn when security and TSA attendee lists match for the same date range", () => {
    const start = makeDate(2026, 7, 8);
    const end = makeDate(2026, 7, 9);
    const matchingRows = [
      ["1001", "张三", "", "否", start, end, "", ""],
      ["1002", "李四", "", "是", start, end, "", ""]
    ];
    const workbook = buildSecurityTsaWorkbook(
      matchingRows.map((row) => [...row.slice(0, 2), "航空安保", ...row.slice(3)]),
      matchingRows.map((row) => [...row.slice(0, 2), "TSA", ...row.slice(3)])
    );
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = WorkbookHealth.buildWorkbookHealth(workbook, analysis, Scanner, { crmYear: 2026 });

    expect(result.items.filter((item: any) => item.area === "安保 / TSA 名单")).toHaveLength(0);
  });
});
