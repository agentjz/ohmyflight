import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolScheduledDistribution as ScheduledDistribution } from "../../../src/tool/app/training-workbench/scripts/scheduled-distribution";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "危险品", "英语能力"],
    ["1001", "张三", makeDate(2026, 6, 30), makeDate(2026, 6, 30)],
    ["1002", "李四", makeDate(2026, 6, 30), makeDate(2026, 7, 31)],
    ["1003", "王五", makeDate(2026, 7, 31), ""]
  ], { cellDates: true });
  const dangerSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["1001", "张三", "危险品", "否", makeDate(2026, 6, 10), makeDate(2026, 6, 10), "", "未录入也统计"],
    ["1002", "李四", "危险品", "是", makeDate(2026, 6, 11), makeDate(2026, 6, 11), "", ""],
    ["1003", "王五", "危险品", "否", makeDate(2026, 7, 12), makeDate(2026, 7, 12), "", "取消"]
  ], { cellDates: true });
  const englishSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["1002", "李四", "英语能力", "否", makeDate(2026, 7, 5), makeDate(2026, 7, 5), "", ""]
  ], { cellDates: true });

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, dangerSheet, "危险品");
  XLSX.utils.book_append_sheet(workbook, englishSheet, "英语能力");
  return workbook;
}

describe("scheduled distribution", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("counts active scheduled rows without using expiry coverage or recorded status", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook());
    const distribution = ScheduledDistribution.buildDistribution(analysis);

    expect(distribution.rows.map((row: any) => `${row.projectName}/${row.name}/${row.trainingDate}`)).toEqual([
      "危险品/张三/2026-06-10",
      "危险品/李四/2026-06-11",
      "英语能力/李四/2026-07-05"
    ]);
    expect(distribution.filterOptions.projects).toEqual(["危险品", "英语能力"]);
    expect(distribution.filterOptions.months).toEqual(["2026-06", "2026-07"]);
    expect(distribution.summary.projectRows.map((row: any) => `${row.label}/${row.total}`)).toEqual([
      "危险品/2",
      "英语能力/1"
    ]);

    const filtered = ScheduledDistribution.buildDistribution(analysis, {
      projectName: "危险品",
      monthKey: "2026-06"
    });
    expect(filtered.rows).toHaveLength(2);
    expect(filtered.summary.total).toBe(2);
  });
});
