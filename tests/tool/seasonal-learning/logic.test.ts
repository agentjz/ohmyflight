import { beforeAll, describe, expect, it } from "vitest";

import { loadBrowserScripts } from "../../helpers/browser-context";

const HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];

function rosterRows(groups: { leader: number; captain: number; firstOfficer: number }): unknown[][] {
  const rows: unknown[][] = [HEADERS];
  let index = 1;

  const add = (count: number, technicalInfo: string, isLeader: number) => {
    for (let offset = 0; offset < count; offset += 1) {
      rows.push([
        index,
        String(100000 + index),
        `人员${index}`,
        `${(index % 4) + 1}分部`,
        technicalInfo,
        isLeader,
        "换季学习",
        "",
        "",
        ""
      ]);
      index += 1;
    }
  };

  add(groups.leader, "777:飞行教员A", 1);
  add(groups.captain, "777:C类机长", 0);
  add(groups.firstOfficer, "777:C类副驾驶", 0);
  return rows;
}

describe("seasonal learning logic", () => {
  let logic: any;

  beforeAll(() => {
    const context = loadBrowserScripts([
      "tool/app/seasonal-learning/data.js",
      "tool/app/seasonal-learning/logic.js"
    ]);
    logic = context.SeasonalLearningLogic;
  });

  it("parses Excel dates as unambiguous business dates", () => {
    expect(logic.parseBusinessDate(new Date(2026, 8, 28, 12))).toBe("2026-09-28");
    expect(logic.parseBusinessDate(46393)).toBe("2027-01-06");
    expect(logic.parseBusinessDate("20260928")).toBe("2026-09-28");
    expect(logic.parseBusinessDate(20260928)).toBe("2026-09-28");
    expect(logic.parseBusinessDate("2026/9/28")).toBe("2026-09-28");
    expect(logic.parseBusinessDate("2026年9月28日")).toBe("2026-09-28");
    expect(logic.parseBusinessDate("9/28/26")).toBe("");
    expect(logic.parseBusinessDate("")).toBe("");
  });

  it("classifies leaders first and treats non-leading instructors as captains", () => {
    const rows = [
      HEADERS,
      [1, 100001, "带队", "一分部", "777:D类副驾驶", 1, "换季学习", "", "", "临时观察员"],
      [2, 100002, "教员", "二分部", "777:飞行教员B", 0, "换季学习", "", "", ""],
      [3, 100003, "机长", "三分部", "划转机长", 0, "换季学习", "", "", ""],
      [4, 100004, "副驾驶", "四分部", "划转副驾驶", 0, "换季学习", "2026-09-28", "", ""]
    ];

    const people = logic.readRosterRows(rows);
    expect(people.map((person: any) => person.category)).toEqual([
      "leader",
      "captain",
      "captain",
      "firstOfficer"
    ]);
    expect(people[3].sourceDate).toBe("2026-09-28");
    expect(people[0].employeeId).toBe("100001");
    expect(people[0].identity).toBe("临时观察员");
  });

  it("rejects duplicate employee IDs and unrecognized technical information", () => {
    expect(() => logic.readRosterRows([
      HEADERS,
      [1, "100001", "甲", "一分部", "777:C类机长", 0, "换季学习", "", "", ""],
      [2, 100001, "乙", "二分部", "777:C类副驾驶", 0, "换季学习", "", "", ""]
    ])).toThrow("员工号重复");

    expect(() => logic.readRosterRows([
      HEADERS,
      [1, "100001", "甲", "一分部", "未识别等级", 0, "换季学习", "", "", ""]
    ])).toThrow("无法归类");
  });

  it("builds a six-period baseline with total and category differences no greater than one", () => {
    const people = logic.readRosterRows(rosterRows({ leader: 81, captain: 49, firstOfficer: 113 }));
    const scheduled = logic.buildInitialSchedule(people, 6);
    const report = logic.checkBalance(scheduled, 6);

    expect(report.balanced).toBe(true);
    expect(report.pendingCount).toBe(0);
    expect(report.dimensions.total.counts).toEqual([41, 41, 41, 40, 40, 40]);
    expect(Math.max(...report.dimensions.leader.counts) - Math.min(...report.dimensions.leader.counts)).toBeLessThanOrEqual(1);
    expect(Math.max(...report.dimensions.captain.counts) - Math.min(...report.dimensions.captain.counts)).toBeLessThanOrEqual(1);
    expect(Math.max(...report.dimensions.firstOfficer.counts) - Math.min(...report.dimensions.firstOfficer.counts)).toBeLessThanOrEqual(1);
    expect(scheduled.every((person: any) => person.adjusted === false && person.adjustmentNotes.length === 0)).toBe(true);
  });

  it("uses a five-person tolerance for total counts and checks categories without changing assignments", () => {
    const scheduled = logic.buildInitialSchedule(
      logic.readRosterRows(rosterRows({ leader: 6, captain: 6, firstOfficer: 6 })),
      6
    );
    scheduled[0].period = 2;
    const before = scheduled.map((person: any) => person.period);
    const report = logic.checkBalance(scheduled, 6);

    expect(report.balanced).toBe(false);
    expect(report.dimensions.total.balanced).toBe(true);
    expect(report.dimensions.leader.balanced).toBe(false);
    expect(scheduled.map((person: any) => person.period)).toEqual(before);
  });

  it("moves one or more people to the selected period", () => {
    const scheduled = logic.buildInitialSchedule(
      logic.readRosterRows(rosterRows({ leader: 2, captain: 2, firstOfficer: 2 })),
      2
    );
    const selected = scheduled.filter((person: any) => person.period === 1).slice(0, 2);

    const moved = logic.movePeople(scheduled, selected.map((person: any) => person.employeeId), 2, 2);
    expect(selected.every((person: any) => moved.people.find((item: any) => item.employeeId === person.employeeId).period === 2)).toBe(true);
    expect(moved.events).toHaveLength(2);
    expect(moved.people.find((person: any) => person.employeeId === selected[0].employeeId).adjusted).toBe(true);
    expect(moved.events[0].text).toContain("移动：");
  });

  it("restores actual assignments first and otherwise preserves the current schedule on re-import", () => {
    const total = rosterRows({ leader: 1, captain: 1, firstOfficer: 1 });
    total[1][9] = "临时观察员";
    const actual = [
      [...HEADERS, "调整说明"],
      [1, "100001", "人员1", "一分部", "777:飞行教员A", 1, "换季学习", "2026-10-08", "第3期", "临时观察员", "移动：第1期 → 第3期"],
      [2, "100002", "人员2", "二分部", "777:C类机长", 0, "换季学习", "2026-10-09", 4, "", ""]
    ];
    const restored = logic.buildImportResult(total, actual, 6, null);

    expect(restored.mode).toBe("actual");
    expect(restored.people.map((person: any) => person.period)).toEqual([3, 4, null]);
    expect(restored.people[0].adjusted).toBe(true);
    expect(restored.people[0].identity).toBe("临时观察员");
    expect(restored.periodDates).toMatchObject({ 3: "2026-10-08", 4: "2026-10-09" });
    expect(restored.addedEmployeeIds).toEqual(["100003"]);

    const pending = logic.buildImportResult(total, [HEADERS], 2, null);
    expect(pending.mode).toBe("pending");
    expect(pending.scheduleReady).toBe(false);
    expect(pending.people.every((person: any) => person.period === null)).toBe(true);
    const baselinePeople = logic.buildInitialSchedule(pending.people, 2);
    const updatedTotal = [
      HEADERS,
      [...total[1].slice(0, 9), "更新身份"],
      total[3],
      [4, "100004", "新增人员", "四分部", "777:B类副驾驶", 0, "换季学习", "", "", ""]
    ];
    const merged = logic.buildImportResult(updatedTotal, [HEADERS], 2, {
      people: baselinePeople,
      periodDates: { 1: "2026-09-01", 2: "2026-09-02" },
      periodCount: 2,
      scheduleReady: true
    });

    expect(merged.mode).toBe("reimport");
    expect(merged.people.find((person: any) => person.employeeId === "100001").period).toBe(
      baselinePeople.find((person: any) => person.employeeId === "100001").period
    );
    expect(merged.scheduleReady).toBe(true);
    expect(merged.people.find((person: any) => person.employeeId === "100001").identity).toBe("更新身份");
    expect(merged.people.find((person: any) => person.employeeId === "100004").period).toBeNull();
    expect(merged.addedEmployeeIds).toEqual(["100004"]);
    expect(merged.removedPeople.map((person: any) => person.employeeId)).toEqual(["100002"]);
    expect(merged.periodDates).toEqual({ 1: "2026-09-01", 2: "2026-09-02" });
  });
});
