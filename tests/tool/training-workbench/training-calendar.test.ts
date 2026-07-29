import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it } from "vitest";

import { loadBrowserScripts } from "../../helpers/browser-context";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

const PROJECT_HEADERS = [
  "员工号",
  "姓名",
  "项目名称",
  "培训信息是否录入",
  "培训开始日期",
  "培训结束日期",
  "备注"
];

function appendProjectSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  rows: unknown[][]
) {
  const sheet = XLSX.utils.aoa_to_sheet([PROJECT_HEADERS, ...rows], { cellDates: true });
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();
  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "应急训练", "危险品", "航空安保", "TSA", "疲劳管理", "飞行作风", "英语能力", "汉语能力"],
    ["1001", "张三", "", "", "", "", "", "", "", ""]
  ], { cellDates: true });
  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");

  appendProjectSheet(workbook, "应急训练", [
    ["1001", "张三", "应急训练", "否", makeDate(2026, 8, 3), makeDate(2026, 8, 4), ""],
    ["1002", "李四", "应急训练", "是", makeDate(2026, 8, 3), makeDate(2026, 8, 4), ""],
    ["1003", "已取消", "应急训练", "否", makeDate(2026, 8, 5), makeDate(2026, 8, 5), "取消"]
  ]);
  appendProjectSheet(workbook, "危险品", [
    ["1004", "王五", "危险品", "否", makeDate(2026, 8, 2), makeDate(2026, 8, 2), ""]
  ]);
  appendProjectSheet(workbook, "航空安保", [
    ["1005", "赵六", "航空安保", "否", makeDate(2026, 8, 6), makeDate(2026, 8, 6), ""]
  ]);
  appendProjectSheet(workbook, "TSA", [
    ["1005", "赵六", "TSA", "否", makeDate(2026, 8, 6), makeDate(2026, 8, 6), ""],
    ["1006", "钱七", "TSA", "否", makeDate(2026, 8, 7), makeDate(2026, 8, 7), ""]
  ]);
  appendProjectSheet(workbook, "疲劳管理", [
    ["1007", "孙八", "疲劳管理", "否", makeDate(2026, 8, 8), makeDate(2026, 8, 8), ""]
  ]);
  appendProjectSheet(workbook, "飞行作风", [
    ["1008", "周九", "飞行作风", "否", makeDate(2026, 8, 9), makeDate(2026, 8, 9), ""]
  ]);
  appendProjectSheet(workbook, "英语能力", [
    ["1009", "英语", "英语能力", "否", makeDate(2026, 8, 2), makeDate(2026, 8, 2), ""]
  ]);
  appendProjectSheet(workbook, "汉语能力", [
    ["1010", "汉语", "汉语能力", "否", makeDate(2026, 8, 3), makeDate(2026, 8, 3), ""]
  ]);

  const crmSheet = XLSX.utils.aoa_to_sheet([
    PROJECT_HEADERS,
    ["1011", "CRM人员", "CRM", "否", makeDate(2026, 8, 1), makeDate(2026, 8, 1), ""],
    ["1012", "旧记录", "CRM", "是", makeDate(2026, 7, 31), makeDate(2026, 7, 31), ""]
  ], { cellDates: true });
  XLSX.utils.book_append_sheet(workbook, crmSheet, "CRM");

  return workbook;
}

describe("training calendar", () => {
  let Scanner: any;
  let TrainingCalendar: any;

  beforeAll(() => {
    const context = loadBrowserScripts([
      "tool/app/training-workbench/scripts/config.js",
      "tool/app/training-workbench/scripts/utils.js",
      "tool/app/training-workbench/scripts/training-record-policy.js",
      "tool/app/training-workbench/scripts/scanner.js",
      "tool/app/training-workbench/scripts/training-calendar-exclusions.js",
      "tool/app/training-workbench/scripts/training-calendar.js"
    ], { XLSX });

    const trainingTool = context.TrainingTool as {
      Scanner: any;
      TrainingCalendar: any;
    };
    Scanner = trainingTool.Scanner;
    TrainingCalendar = trainingTool.TrainingCalendar;
  });

  it("builds sessions, attendee details, exclusions, merged security dates, and reminders", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = TrainingCalendar.buildCalendar(workbook, analysis, Scanner, {
      today: makeDate(2026, 8, 1)
    });

    expect(result.sessions.map((session: any) => [
      session.projectName,
      session.startDate,
      session.endDate,
      session.attendeeNames
    ])).toEqual([
      ["CRM", "2026-07-31", "2026-07-31", []],
      ["CRM", "2026-08-01", "2026-08-01", []],
      ["危险品", "2026-08-02", "2026-08-02", []],
      ["应急训练", "2026-08-03", "2026-08-04", ["张三", "李四"]],
      ["航空安保 / TSA", "2026-08-06", "2026-08-06", []],
      ["TSA", "2026-08-07", "2026-08-07", []],
      ["疲劳管理", "2026-08-08", "2026-08-08", []],
      ["飞行作风", "2026-08-09", "2026-08-09", []]
    ]);

    expect(result.sessions.some((session: any) => session.projectName === "英语能力")).toBe(false);
    expect(result.sessions.some((session: any) => session.projectName === "汉语能力")).toBe(false);
    expect(result.sessions.some((session: any) => session.startDate === "2026-08-05")).toBe(false);

    const emergencyDays = result.dayEvents
      .filter((event: any) => event.projectName === "应急训练")
      .map((event: any) => `${event.date}/${event.attendeeNames.join("、")}`);
    expect(emergencyDays).toEqual([
      "2026-08-03/张三、李四",
      "2026-08-04/张三、李四"
    ]);
    expect(result.dayEvents
      .filter((event: any) => event.projectName !== "应急训练")
      .every((event: any) => event.attendeeNames.length === 0)).toBe(true);

    expect(result.reminders.map((reminder: any) => [
      reminder.projectName,
      reminder.startDate,
      reminder.message
    ])).toEqual([
      ["CRM", "2026-08-01", "请打印签到表"],
      ["危险品", "2026-08-02", "请打印签到表"],
      ["应急训练", "2026-08-03", "请打印签到表"],
      ["航空安保 / TSA", "2026-08-06", "请打印签到表"],
      ["TSA", "2026-08-07", "请打印签到表"]
    ]);
  });

  it("builds a stable Monday-first six-week month grid", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const calendar = TrainingCalendar.buildCalendar(workbook, analysis, Scanner, {
      today: makeDate(2026, 8, 1)
    });
    const month = TrainingCalendar.buildMonthView(calendar.dayEvents, "2026-08", makeDate(2026, 8, 1));

    expect(month.label).toBe("2026年8月");
    expect(month.days).toHaveLength(42);
    expect(month.days[0]).toMatchObject({ date: "2026-07-27", inCurrentMonth: false });
    expect(month.days[5]).toMatchObject({ date: "2026-08-01", inCurrentMonth: true, isToday: true });
    expect(month.days[5].events.map((event: any) => event.projectName)).toEqual(["CRM"]);
    expect(month.days[41]).toMatchObject({ date: "2026-09-06", inCurrentMonth: false });
  });
});
