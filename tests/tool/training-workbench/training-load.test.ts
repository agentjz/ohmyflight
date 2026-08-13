import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolTrainingLoad as TrainingLoad } from "../../../src/tool/app/training-workbench/scripts/training-load";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function projectSheet(projectName: string, rows: unknown[][]) {
  return XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ...rows.map((row) => [row[0], row[1], projectName, "否", row[2], row[3], "", row[4] || ""])
  ], { cellDates: true });
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "航空安保", "TSA"],
    ["2001", "甲", makeDate(2026, 9, 30), makeDate(2026, 9, 30)],
    ["2002", "乙", makeDate(2026, 9, 30), makeDate(2026, 9, 30)]
  ], { cellDates: true }), "人员信息表");
  XLSX.utils.book_append_sheet(workbook, projectSheet("航空安保", [
    ["2001", "甲", makeDate(2026, 9, 1), makeDate(2026, 9, 1)],
    ["2002", "乙", makeDate(2026, 9, 1), makeDate(2026, 9, 1)]
  ]), "航空安保");
  XLSX.utils.book_append_sheet(workbook, projectSheet("TSA", [
    ["2001", "甲", makeDate(2026, 9, 1), makeDate(2026, 9, 1)],
    ["2002", "乙", makeDate(2026, 9, 1), makeDate(2026, 9, 1)],
    ["2003", "丙", makeDate(2026, 9, 2), makeDate(2026, 9, 2), "取消"]
  ]), "TSA");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "培训信息是否录入", "备注"],
    ["2001", "甲", makeDate(2026, 9, 2), makeDate(2026, 9, 2), "否", ""],
    ["2003", "丙", makeDate(2026, 9, 3), makeDate(2026, 9, 4), "否", ""],
    ["2004", "丁", makeDate(2026, 9, 5), makeDate(2026, 9, 5), "是", "取消"]
  ], { cellDates: true }), "CRM");
  return workbook;
}

describe("training load", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("counts person-days and joint security/TSA sessions while including CRM", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = TrainingLoad.buildLoad(workbook, analysis, { year: 2026 });

    expect(result.summary).toMatchObject({
      personDays: 5,
      sessionCount: 3,
      recordCount: 6,
      crmRecordCount: 2
    });
    expect(result.sessions.map((row) => `${row.projectName}/${row.startDate}/${row.attendeeCount}`)).toEqual([
      "航空安保 / TSA/2026-09-01/2",
      "CRM/2026-09-02/1",
      "CRM/2026-09-03/1"
    ]);
    expect(result.monthRows[8]).toEqual({
      monthKey: "2026-09",
      personDays: 5,
      sessionCount: 3,
      recordCount: 6
    });
    expect(result.projects).toEqual(["航空安保", "TSA", "CRM"]);
  });

  it("filters source records before calculating a single project's load", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);

    const security = TrainingLoad.buildLoad(workbook, analysis, {
      year: 2026,
      projectName: "航空安保"
    });
    expect(security.selectedProject).toBe("航空安保");
    expect(security.summary).toMatchObject({
      personDays: 2,
      sessionCount: 1,
      recordCount: 2,
      crmRecordCount: 0
    });
    expect(security.sessions).toEqual([{
      projectName: "航空安保",
      sourceProjects: ["航空安保"],
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      attendeeCount: 2
    }]);

    const crm = TrainingLoad.buildLoad(workbook, analysis, {
      year: 2026,
      projectName: "CRM"
    });
    expect(crm.summary.personDays).toBe(3);
    expect(crm.summary.sessionCount).toBe(2);
    expect(crm.summary.crmRecordCount).toBe(2);
  });
});
