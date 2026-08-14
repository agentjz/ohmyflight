import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolQualificationPressure as QualificationPressure } from "../../../src/tool/app/training-workbench/scripts/qualification-pressure";
import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function projectSheet(rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ...rows
  ], { cellDates: true });
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "应急训练", "危险品", "TSA", "飞行作风"],
    ["1001", "窗口保锚", makeDate(2026, 10, 31), makeDate(2026, 10, 31), "", ""],
    ["1002", "按日期重建", "", "", makeDate(2026, 10, 31), ""],
    ["1003", "逾期安排", "", "", makeDate(2026, 10, 31), ""],
    ["1004", "最早覆盖", "", "", "", makeDate(2026, 10, 31)],
    ["1005", "未安排", "", makeDate(2026, 11, 30), "", ""],
    ["1006", "宋云龙", "", "", makeDate(2026, 10, 31), ""],
    ["1007", "范围外", "", makeDate(2035, 11, 30), "", ""]
  ], { cellDates: true });

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, projectSheet([
    ["1001", "窗口保锚", "应急训练", "否", makeDate(2026, 9, 10), makeDate(2026, 9, 10), "", ""]
  ]), "应急训练");
  XLSX.utils.book_append_sheet(workbook, projectSheet([
    ["1001", "窗口保锚", "危险品", "否", makeDate(2026, 9, 15), makeDate(2026, 9, 15), "", ""]
  ]), "危险品");
  XLSX.utils.book_append_sheet(workbook, projectSheet([
    ["1002", "按日期重建", "TSA", "否", makeDate(2026, 9, 1), makeDate(2026, 9, 1), "", ""],
    ["1003", "逾期安排", "TSA", "否", makeDate(2026, 11, 1), makeDate(2026, 11, 1), "", ""],
    ["1006", "宋云龙", "TSA", "否", makeDate(2026, 9, 1), makeDate(2026, 9, 1), "", ""]
  ]), "TSA");
  XLSX.utils.book_append_sheet(workbook, projectSheet([
    ["1004", "最早覆盖", "飞行作风", "否", makeDate(2026, 9, 1), makeDate(2026, 9, 1), "", ""],
    ["1004", "最早覆盖", "飞行作风", "否", makeDate(2026, 9, 15), makeDate(2026, 9, 15), "", ""]
  ]), "飞行作风");
  return workbook;
}

describe("qualification pressure", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("predicts the next qualification pressure from the first covering schedule", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = QualificationPressure.buildPressure(analysis, {
      startMonth: "2026-09",
      horizonMonths: 36
    });
    const rows = new Map(result.items.map((row) => [`${row.name}/${row.projectName}`, row]));

    expect(rows.get("窗口保锚/应急训练")).toMatchObject({
      currentDueMonth: "2026-10",
      scheduledDate: "2026-09-10",
      forecastExpiry: "2028-10-31",
      forecastDueMonth: "2028-10",
      coverageStatus: "已覆盖"
    });
    expect(rows.get("窗口保锚/危险品")).toMatchObject({
      currentDueDate: "2026-10-30",
      forecastExpiry: "2028-10-31",
      forecastDueDate: "2028-10-30",
      coverageStatus: "已覆盖"
    });
    expect(rows.get("按日期重建/TSA")).toMatchObject({
      scheduledDate: "2026-09-01",
      forecastExpiry: "2027-09-30",
      forecastDueMonth: "2027-09",
      coverageStatus: "已覆盖"
    });
    expect(rows.get("最早覆盖/飞行作风")).toMatchObject({
      scheduledDate: "2026-09-01",
      forecastExpiry: "2028-09-30",
      forecastDueMonth: "2028-09"
    });
    expect(rows.get("逾期安排/TSA")).toMatchObject({
      forecastDueMonth: "2026-10",
      coverageStatus: "晚于截止日"
    });
    expect(rows.get("未安排/危险品")).toMatchObject({
      forecastDueMonth: "2026-11",
      coverageStatus: "未安排"
    });
    expect(rows.get("范围外/危险品")?.coverageStatus).toBe("未安排");
    expect([...rows.keys()].some((key) => key.includes("宋云龙"))).toBe(false);

    const forecastSeptember = result.monthRows.find((row) => row.monthKey === "2027-09");
    expect(forecastSeptember?.forecastByProject.TSA).toBe(1);
    expect(result.items.filter((row) => row.coverageStatus === "晚于截止日")).toHaveLength(1);
    expect(result.items.filter((row) => row.coverageStatus !== "已覆盖")).toHaveLength(3);
    for (const monthRow of result.monthRows) {
      expect(monthRow.currentTotal).toBe(
        Object.values(monthRow.currentByProject).reduce((total, count) => total + count, 0)
      );
      expect(monthRow.forecastTotal).toBe(
        Object.values(monthRow.forecastByProject).reduce((total, count) => total + count, 0)
      );
    }
  });

  it("filters items and month totals for a single-project pressure view", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const result = QualificationPressure.buildPressure(analysis, {
      startMonth: "2026-09",
      horizonMonths: 36,
      projectName: "TSA"
    });

    const currentOctober = result.monthRows.find((row) => row.monthKey === "2026-10");
    const forecastSeptember = result.monthRows.find((row) => row.monthKey === "2027-09");
    expect(result.selectedProject).toBe("TSA");
    expect(result.projects).toEqual(["TSA"]);
    expect(result.availableProjects).toEqual(["应急训练", "危险品", "TSA", "飞行作风"]);
    expect(currentOctober?.currentTotal).toBe(2);
    expect(currentOctober?.currentByProject.TSA).toBe(2);
    expect(forecastSeptember?.forecastTotal).toBe(1);
    expect(forecastSeptember?.forecastByProject.TSA).toBe(1);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((item) => item.projectName === "TSA")).toBe(true);
    for (const monthRow of result.monthRows) {
      expect(monthRow.currentTotal).toBe(
        Object.values(monthRow.currentByProject).reduce((total, count) => total + count, 0)
      );
      expect(monthRow.forecastTotal).toBe(
        Object.values(monthRow.forecastByProject).reduce((total, count) => total + count, 0)
      );
    }
  });
});
