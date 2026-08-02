import { describe, expect, it } from "vitest";

import { SeasonalLearningHealth as health } from "../../../src/tool/app/seasonal-learning/health";

const ACTUAL_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];
const HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "是否美线带队", "培训类型", "日期", "期数", "身份"];

function row(
  sequence: number,
  employeeId: string,
  name: string,
  period: string | number,
  identity: string
): unknown[] {
  return [sequence, employeeId, name, "一分部", "777:C类机长", 0, 0, "换季学习", "2026-09-23", period, identity];
}

describe("seasonal learning workbook health", () => {
  it("summarizes matching rosters and keeps arbitrary identity values", () => {
    const total = [
      HEADERS,
      row(1, "100001", "甲", "", "临时观察员"),
      row(2, "100002", "乙", "", ""),
      row(3, "100003", "丙", "", "新身份类型")
    ];
    const actual = [
      HEADERS,
      row(1, "100001", "甲", 1, "临时观察员"),
      row(2, "100002", "乙", 2, ""),
      row(3, "100003", "丙", 3, "新身份类型")
    ];

    const result = health.buildWorkbookHealth(total, actual);

    expect(result.totalCount).toBe(3);
    expect(result.actualCount).toBe(3);
    expect(result.summary.error).toBe(0);
    expect(result.summary.warning).toBe(0);
    expect(result.totalTagged.map((person: any) => person.identity)).toEqual(["临时观察员", "新身份类型"]);
    expect(result.totalUntagged.map((person: any) => person.employeeId)).toEqual(["100002"]);
  });

  it("reports duplicates, missing and extra people, unassigned rows, and identity mismatches", () => {
    const total = [
      HEADERS,
      row(1, "100001", "甲", "", "身份甲"),
      row(2, "100001", "甲重复", "", "身份甲"),
      row(3, "100002", "乙", "", "身份乙")
    ];
    const actual = [
      HEADERS,
      row(1, "100001", "甲", 1, "另一个身份"),
      row(2, "100003", "多出人员", "", "")
    ];

    const result = health.buildWorkbookHealth(total, actual);
    const messages = result.items.map((item: any) => `${item.area}|${item.message}|${item.detail}`);

    expect(result.summary.error).toBeGreaterThan(0);
    expect(result.summary.warning).toBeGreaterThan(0);
    expect(messages.some((message: string) => message.includes("员工号 100001 重复出现"))).toBe(true);
    expect(messages.some((message: string) => message.includes("实际名单缺少 1 人"))).toBe(true);
    expect(messages.some((message: string) => message.includes("实际名单多出 1 人"))).toBe(true);
    expect(messages.some((message: string) => message.includes("有 1 人日期或期数不完整"))).toBe(true);
    expect(messages.some((message: string) => message.includes("有 1 人身份不一致"))).toBe(true);
  });

  it("reports an actual row with a blank date as pending even when its period remains", () => {
    const actualRow = row(1, "100001", "甲", 1, "公司领导");
    actualRow[8] = "";
    const result = health.buildWorkbookHealth([
      HEADERS,
      row(1, "100001", "甲", "", "公司领导")
    ], [HEADERS, actualRow]);

    expect(result.items.some((item: any) => (
      item.area === "实际排期"
      && item.message.includes("1 人")
      && item.message.includes("待分配")
    ))).toBe(true);
  });

  it("treats an empty actual sheet as a pending schedule", () => {
    const result = health.buildWorkbookHealth([
      HEADERS,
      row(1, "100001", "甲", "", "")
    ], [ACTUAL_HEADERS]);

    expect(result.summary.error).toBe(0);
    expect(result.summary.warning).toBe(0);
    expect(result.items.some((item: any) => item.message.includes("尚未生成实际安排"))).toBe(true);
  });

  it("includes every required workbook column in the health check", () => {
    const incompleteHeaders = HEADERS.filter((header) => header !== "技术信息" && header !== "日期");
    const result = health.buildWorkbookHealth([incompleteHeaders], [ACTUAL_HEADERS]);

    expect(result.summary.error).toBe(1);
    expect(result.items.some((item: any) => (
      item.area === "换季总名单"
      && item.message.includes("技术信息")
      && item.message.includes("日期")
    ))).toBe(true);
  });

  it("accepts the previous empty actual-sheet header while requiring the new total-roster column", () => {
    const result = health.buildWorkbookHealth([HEADERS], [ACTUAL_HEADERS]);

    expect(result.summary.error).toBe(0);
    expect(result.items.some((item: any) => item.message.includes("尚未生成实际安排"))).toBe(true);
  });
});
