import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolScheduleAssessment as ScheduleAssessment } from "../../../src/tool/app/training-workbench/scripts/schedule-assessment";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function simplifyStats(cards: Array<{ label: string; value: number }>) {
  return cards.map((card) => ({ label: card.label, value: card.value }));
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();

  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "危险品", "航空安保", "TSA", "英语能力", "飞行作风"],
    ["2001", "已过期", makeDate(2026, 4, 30), "", "", "", ""],
    ["2002", "必须排", makeDate(2026, 5, 31), "", "", "", ""],
    ["2003", "推荐排", makeDate(2026, 6, 30), "", "", "", ""],
    ["2004", "未录入有效安排", makeDate(2026, 5, 31), "", "", "", ""],
    ["2005", "已录入有效安排", makeDate(2026, 5, 31), "", "", "", ""],
    ["2006", "取消后必须排", makeDate(2026, 5, 31), "", "", "", ""],
    ["2007", "异常日期", "坏日期", "", "", "", ""],
    ["2008", "安保推荐", "", makeDate(2026, 6, 30), "", "", ""],
    ["2009", "过期已排补训", makeDate(2026, 5, 3), "", "", "", ""],
    ["2010", "程春林", "", makeDate(2026, 4, 30), makeDate(2026, 6, 30), "", ""],
    ["2011", "宋云龙", "", makeDate(2026, 4, 30), makeDate(2026, 6, 30), "", ""],
    ["2012", "TSA必须排", "", "", makeDate(2026, 6, 30), "", ""],
    ["2013", "TSA已排", "", "", makeDate(2026, 6, 30), "", ""],
    ["2014", "同日航空安保和TSA分别记录", "", makeDate(2026, 6, 30), makeDate(2026, 6, 30), "", ""],
    ["2015", "沈欣", makeDate(2026, 5, 31), makeDate(2026, 4, 30), makeDate(2026, 6, 30), "", ""],
    ["2016", "张鹏", "", makeDate(2026, 4, 30), makeDate(2026, 6, 30), "", ""],
    ["2017", "邢晓楠", "", makeDate(2026, 4, 30), makeDate(2026, 6, 30), makeDate(2026, 5, 31), ""],
    ["2018", "王峰", makeDate(2026, 5, 31), makeDate(2026, 4, 30), makeDate(2026, 6, 30), "", ""]
  ], { cellDates: true });

  const dangerousGoodsSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["2004", "未录入有效安排", "危险品", "否", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", ""],
    ["2005", "已录入有效安排", "危险品", "是", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", ""],
    ["2006", "取消后必须排", "危险品", "否", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", "取消"],
    ["2009", "过期已排补训", "危险品", "否", makeDate(2026, 5, 7), makeDate(2026, 5, 8), "", ""]
  ], { cellDates: true });

  const securitySheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["2014", "同日航空安保和TSA分别记录", "航空安保", "否", makeDate(2026, 6, 1), makeDate(2026, 6, 1), "", ""]
  ], { cellDates: true });

  const tsaSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["2013", "TSA已排", "TSA", "否", makeDate(2026, 6, 1), makeDate(2026, 6, 1), "", ""]
  ], { cellDates: true });

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, dangerousGoodsSheet, "危险品");
  XLSX.utils.book_append_sheet(workbook, securitySheet, "航空安保");
  XLSX.utils.book_append_sheet(workbook, tsaSheet, "TSA");
  XLSX.utils.book_append_sheet(workbook, securitySheet, "飞行作风");
  return workbook;
}

describe("schedule assessment", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("classifies daily scheduling statuses from expiry table and project sheets", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = ScheduleAssessment.buildResult(analysis, {
      today: makeDate(2026, 5, 8)
    });

    const visibleRows = new Map<string, any>(result.detailRows.map((row: any) => [`${row.name}/${row.projectName}`, row]));
    const allRows = new Map<string, any>(result.allDetailRows.map((row: any) => [`${row.name}/${row.projectName}`, row]));

    expect(visibleRows.get("已过期/危险品").status).toBe("已过期");
    expect(visibleRows.get("必须排/危险品").status).toBe("必须排");
    expect(visibleRows.get("推荐排/危险品").status).toBe("必须排");
    expect(visibleRows.get("取消后必须排/危险品").status).toBe("必须排");
    expect(visibleRows.get("异常日期/危险品").status).toBe("异常");
    expect(visibleRows.get("安保推荐/航空安保").status).toBe("必须排");
    expect(visibleRows.get("TSA必须排/TSA").status).toBe("必须排");
    expect(allRows.get("TSA已排/TSA").status).toBe("正常");
    expect(visibleRows.get("同日航空安保和TSA分别记录/TSA").status).toBe("必须排");
    expect(allRows.get("同日航空安保和TSA分别记录/航空安保").status).toBe("正常");
    expect(visibleRows.get("过期已排补训/危险品").status).toBe("已过期已排补训");
    expect(visibleRows.get("过期已排补训/危险品").scheduledDate).toBe("2026-05-07");
    expect(visibleRows.has("程春林/航空安保")).toBe(false);
    expect(visibleRows.has("程春林/TSA")).toBe(false);
    expect(visibleRows.has("宋云龙/航空安保")).toBe(false);
    expect(visibleRows.has("宋云龙/TSA")).toBe(false);
    expect(visibleRows.has("邢晓楠/航空安保")).toBe(false);
    expect(visibleRows.has("邢晓楠/TSA")).toBe(false);
    expect(visibleRows.has("邢晓楠/英语能力")).toBe(false);
    expect(visibleRows.has("沈欣/航空安保")).toBe(false);
    expect(visibleRows.has("沈欣/TSA")).toBe(false);
    expect(visibleRows.has("张鹏/航空安保")).toBe(false);
    expect(visibleRows.has("张鹏/TSA")).toBe(false);
    expect(visibleRows.has("王峰/航空安保")).toBe(false);
    expect(visibleRows.has("王峰/TSA")).toBe(false);
    expect(visibleRows.get("王峰/危险品").status).toBe("必须排");
    expect(visibleRows.get("沈欣/危险品").status).toBe("必须排");

    expect(allRows.get("未录入有效安排/危险品").status).toBe("正常");
    expect(allRows.get("已录入有效安排/危险品").status).toBe("正常");
    expect(result.detailRows.some((row: any) => row.name === "未录入有效安排")).toBe(false);
    expect(result.detailRows.some((row: any) => row.name === "已录入有效安排")).toBe(false);

    expect(simplifyStats(result.statsCards)).toEqual([
      { label: "已过期", value: 1 },
      { label: "必须排", value: 8 },
      { label: "推荐排", value: 0 },
      { label: "已排未覆盖", value: 0 },
      { label: "异常", value: 1 },
      { label: "已过期已排补训", value: 1 }
    ]);

    expect(result.chartData.statusRows).toEqual([
      { name: "已过期", value: 1 },
      { name: "已过期已排补训", value: 1 },
      { name: "必须排", value: 8 },
      { name: "已排未覆盖", value: 0 },
      { name: "推荐排", value: 0 },
      { name: "异常", value: 1 }
    ]);
    expect(result.chartData.projectRows).toEqual([
      { projectName: "危险品", expired: 1, expiredScheduled: 1, must: 5, uncoveredScheduled: 0, recommended: 0, abnormal: 1 },
      { projectName: "TSA", expired: 0, expiredScheduled: 0, must: 2, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { projectName: "航空安保", expired: 0, expiredScheduled: 0, must: 1, uncoveredScheduled: 0, recommended: 0, abnormal: 0 }
    ]);
    expect(result.chartData.monthRows).toEqual([
      { label: "2026-01", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-02", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-03", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-04", expired: 1, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-05", expired: 0, expiredScheduled: 1, must: 4, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-06", expired: 0, expiredScheduled: 0, must: 4, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-07", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-08", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-09", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-10", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-11", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 },
      { label: "2026-12", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0 }
    ]);
    expect(result.summaryData.projectSummaryRows.map((row: any) => ({
      projectName: row.projectName,
      expired: row.expired,
      expiredScheduled: row.expiredScheduled,
      must: row.must,
      uncoveredScheduled: row.uncoveredScheduled,
      recommended: row.recommended,
      abnormal: row.abnormal,
      total: row.total
    }))).toEqual([
      { projectName: "危险品", expired: 1, expiredScheduled: 1, must: 5, uncoveredScheduled: 0, recommended: 0, abnormal: 1, total: 8 },
      { projectName: "TSA", expired: 0, expiredScheduled: 0, must: 2, uncoveredScheduled: 0, recommended: 0, abnormal: 0, total: 2 },
      { projectName: "航空安保", expired: 0, expiredScheduled: 0, must: 1, uncoveredScheduled: 0, recommended: 0, abnormal: 0, total: 1 },
      { projectName: "飞行作风", expired: 0, expiredScheduled: 0, must: 0, uncoveredScheduled: 0, recommended: 0, abnormal: 0, total: 0 }
    ]);
    expect(result.summaryData.projectGroups.map((group: any) => `${group.projectName}/${group.status}/${group.total}`)).toContain("危险品/必须排/5");
    expect(result.summaryData.personRiskRows.map((row: any) => `${row.name}/${row.total}`)).toContain("取消后必须排/1");
  });

  it("uses temporary simulation rows as project sheet rows for workbench coverage only", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = ScheduleAssessment.buildResult(analysis, {
      today: makeDate(2026, 5, 8),
      extraProjectRows: [
        {
          projectName: "TSA",
          employeeId: "2012",
          name: "TSA必须排",
          trainingStartDate: makeDate(2026, 6, 1),
          trainingEndDate: makeDate(2026, 6, 1),
          remark: "模拟排班",
          source: "模拟排班 simulation-1"
        }
      ]
    });

    const allRows = new Map<string, any>(result.allDetailRows.map((row: any) => [`${row.name}/${row.projectName}`, row]));
    const visibleRows = new Map<string, any>(result.detailRows.map((row: any) => [`${row.name}/${row.projectName}`, row]));

    expect(allRows.get("TSA必须排/TSA").status).toBe("正常");
    expect(allRows.get("TSA必须排/TSA").source).toBe("模拟排班 simulation-1");
    expect(allRows.get("TSA必须排/TSA").scheduledDate).toBe("2026-06-01");
    expect(visibleRows.has("TSA必须排/TSA")).toBe(false);
  });

});
