import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolSmartSchedule as SmartSchedule } from "../../../src/tool/app/training-workbench/scripts/smart-schedule";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function projectSheet(projectName: string, rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ...rows.map((row) => [row[0], row[1], projectName, "否", row[2] || "", row[3] instanceof Date ? row[3] : row[2] || "", "", row[3] instanceof Date ? "" : row[3] || ""])
  ], { cellDates: true });
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "应急训练", "危险品", "TSA"],
    ["1001", "基准月已排", makeDate(2027, 6, 30), "", ""],
    ["1002", "基准月待排", makeDate(2027, 6, 30), "", ""],
    ["1003", "窗口待排甲", "", makeDate(2027, 6, 30), ""],
    ["1004", "窗口待排乙", "", makeDate(2027, 6, 30), ""],
    ["1005", "最新日期甲", "", "", makeDate(2027, 6, 30)],
    ["1006", "最新日期乙", "", "", makeDate(2027, 6, 30)],
    ["1007", "提前量不足", "", "", makeDate(2027, 1, 31)],
    ["1008", "已经过期", "", "", makeDate(2027, 1, 5)]
  ], { cellDates: true }), "人员信息表");
  XLSX.utils.book_append_sheet(workbook, projectSheet("应急训练", [
    ["1001", "基准月已排", makeDate(2027, 5, 12)]
  ]), "应急训练");
  XLSX.utils.book_append_sheet(workbook, projectSheet("危险品", []), "危险品");
  XLSX.utils.book_append_sheet(workbook, projectSheet("TSA", []), "TSA");
  return workbook;
}

describe("smart schedule", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("keeps window projects inside their protected range and balances person-days", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 2,
      today: makeDate(2027, 1, 10)
    });
    const items = new Map(result.items.map((item) => [`${item.name}/${item.projectName}`, item]));

    expect(items.get("基准月已排/应急训练")).toMatchObject({
      currentMonth: "2027-05",
      eligibleStartMonth: "2027-04",
      eligibleEndMonth: "2027-06"
    });
    expect(items.get("基准月待排/应急训练")?.recommendedMonth).toMatch(/^2027-0[4-6]$/);
    expect(items.get("窗口待排甲/危险品")?.recommendedMonth).toMatch(/^2027-0[3-6]$/);
    expect(items.get("窗口待排乙/危险品")?.recommendedMonth).toMatch(/^2027-0[3-6]$/);

    const usedLoads = result.monthRows.filter((row) => row.recommendedPersonDays > 0).map((row) => row.recommendedPersonDays);
    expect(Math.max(...usedLoads)).toBeLessThanOrEqual(2);
  });

  it("uses the configured fixed latest-date advance month and reports impossible work", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 2,
      today: makeDate(2027, 1, 10)
    });
    const latest = result.items.filter((item) => item.projectName === "TSA" && item.name.startsWith("最新日期"));

    expect(latest).toHaveLength(2);
    expect(latest.every((item) => item.recommendedMonth === "2027-04")).toBe(true);
    expect(result.items.find((item) => item.name === "提前量不足")).toMatchObject({
      status: "待排",
      recommendedMonth: "2027-01",
      reason: "固定提前月份已经错过，优先在到期前尽快安排。"
    });
    expect(result.items.find((item) => item.name === "已经过期")).toMatchObject({
      status: "无法安排",
      recommendedMonth: ""
    });
  });

  it("does not move a January deadline into the due month when its safe month belongs to the previous year", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 1,
      today: makeDate(2026, 8, 13)
    });

    expect(result.items.some((item) => item.name === "提前量不足")).toBe(false);
    expect(result.items.some((item) => item.name === "已经过期")).toBe(false);
  });

  it("places latest-date work one month before the due month when configured with one month", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 1,
      today: makeDate(2027, 1, 10)
    });
    const latest = result.items.filter((item) => item.projectName === "TSA" && item.name.startsWith("最新日期"));

    expect(latest).toHaveLength(2);
    expect(latest.every((item) => item.recommendedMonth === "2027-05")).toBe(true);
  });

  it("estimates person-days from the most common project duration in the workbook", () => {
    const workbook = buildWorkbook();
    const sheet = workbook.Sheets["应急训练"];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    rows.push(["9001", "样本两天甲", "应急训练", "否", makeDate(2027, 4, 1), makeDate(2027, 4, 2), "", ""]);
    rows.push(["9002", "样本两天乙", "应急训练", "否", makeDate(2027, 4, 1), makeDate(2027, 4, 2), "", ""]);
    workbook.Sheets["应急训练"] = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 2,
      today: makeDate(2027, 1, 10)
    });
    expect(result.items.find((item) => item.projectName === "应急训练")?.personDays).toBe(2);
  });

  it("filters the comparison and month totals by project", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 2,
      projectName: "危险品",
      today: makeDate(2027, 1, 10)
    });

    expect(result.selectedProject).toBe("危险品");
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.projectName === "危险品")).toBe(true);
    expect(result.monthRows.reduce((total, row) => total + row.recommendedPersonDays, 0)).toBe(2);
  });

  it("keeps fixed workbook load while replacing current-round work with recommendations", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = SmartSchedule.buildSmartSchedule(analysis, {
      year: 2027,
      latestAdvanceMonths: 2,
      today: makeDate(2027, 1, 10),
      currentLoadRows: Array.from({ length: 12 }, (_, index) => ({
        monthKey: `2027-${String(index + 1).padStart(2, "0")}`,
        personDays: index === 4 ? 20 : 5
      }))
    });
    const may = result.monthRows.find((row) => row.monthKey === "2027-05")!;
    const recommendedTotal = result.monthRows.reduce((total, row) => total + row.recommendedPersonDays, 0);

    expect(may.currentPersonDays).toBe(20);
    expect(may.recommendedPersonDays).toBeLessThan(20);
    expect(recommendedTotal).toBeGreaterThan(0);
  });
});
