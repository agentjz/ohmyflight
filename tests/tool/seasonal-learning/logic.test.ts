import { beforeAll, describe, expect, it } from "vitest";

import { loadBrowserScripts } from "../../helpers/browser-context";

const ACTUAL_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];
const HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "是否美线带队", "培训类型", "日期", "期数", "身份"];

function rosterRows(groups: { leader: number; captain: number; firstOfficer: number; usLineLeader?: number }): unknown[][] {
  const rows: unknown[][] = [HEADERS];
  let index = 1;
  let remainingUsLineLeaders = groups.usLineLeader || 0;

  const add = (count: number, technicalInfo: string, isLeader: number) => {
    for (let offset = 0; offset < count; offset += 1) {
      const isUsLineLeader = isLeader === 1 && remainingUsLineLeaders > 0 ? 1 : 0;
      rows.push([
        index,
        String(100000 + index),
        `人员${index}`,
        `${(index % 4) + 1}分部`,
        technicalInfo,
        isLeader,
        isUsLineLeader,
        "换季学习",
        "",
        "",
        ""
      ]);
      remainingUsLineLeaders -= isUsLineLeader;
      index += 1;
    }
  };

  add(groups.leader, "777:飞行教员A", 1);
  add(groups.captain, "777:C类机长", 0);
  add(groups.firstOfficer, "777:C类副驾驶", 0);
  return rows;
}

function technicalRosterRows(groups: Array<{
  technicalInfo: string;
  count: number;
  isLeader?: number;
  isUsLineLeader?: number;
  identity?: string;
}>): unknown[][] {
  const rows: unknown[][] = [HEADERS];
  let index = 1;
  groups.forEach((group) => {
    for (let offset = 0; offset < group.count; offset += 1) {
      rows.push([
        index,
        String(200000 + index),
        `等级人员${index}`,
        `${(index % 4) + 1}分部`,
        group.technicalInfo,
        group.isLeader || 0,
        group.isUsLineLeader || 0,
        "换季学习",
        "",
        "",
        group.identity || ""
      ]);
      index += 1;
    }
  });
  return rows;
}

describe("seasonal learning logic", () => {
  let logic: any;
  let rules: any;

  beforeAll(() => {
    const context = loadBrowserScripts([
      "tool/app/seasonal-learning/data.js",
      "tool/app/seasonal-learning/balance-filter.js",
      "tool/app/seasonal-learning/balance-rules.js",
      "tool/app/seasonal-learning/allocation.js",
      "tool/app/seasonal-learning/logic.js"
    ]);
    logic = context.SeasonalLearningLogic;
    rules = context.SeasonalLearningBalanceRules;
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
      [1, 100001, "带队", "一分部", "777:D类副驾驶", 1, 1, "换季学习", "", "", "临时观察员"],
      [2, 100002, "教员", "二分部", "777:飞行教员B", 0, 0, "换季学习", "", "", ""],
      [3, 100003, "机长", "三分部", "划转机长", 0, 0, "换季学习", "", "", ""],
      [4, 100004, "副驾驶", "四分部", "划转副驾驶", 0, 0, "换季学习", "2026-09-28", "", ""]
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
    expect(people[0].isUsLineLeader).toBe(true);
  });

  it("resolves the first enabled hook and falls back to the full technical level", () => {
    const [person] = logic.readRosterRows(technicalRosterRows([{
      technicalInfo: "777:飞行教员A",
      count: 1,
      isLeader: 1,
      isUsLineLeader: 1
    }]));

    expect(rules.resolveBalanceGroup(person, ["us-line-leader", "leader"]).id).toBe("hook:us-line-leader");
    expect(rules.resolveBalanceGroup(person, ["leader"]).id).toBe("hook:leader");
    expect(rules.resolveBalanceGroup(person, []).id).toBe("technical:777:飞行教员A");
  });

  it("balances every full technical level as its own dynamic group", () => {
    const people = logic.readRosterRows(technicalRosterRows([
      { technicalInfo: "777:A1类副驾驶", count: 7 },
      { technicalInfo: "777:A2类副驾驶", count: 5 },
      { technicalInfo: "777:C类机长", count: 8 },
      { technicalInfo: "划转副驾驶", count: 4 }
    ]));
    const scheduled = logic.buildInitialSchedule(people, 3, rules.DEFAULT_ENABLED_HOOK_IDS);
    const report = logic.checkBalance(scheduled, 3, rules.DEFAULT_ENABLED_HOOK_IDS);

    expect(report.total.maximum - report.total.minimum).toBeLessThanOrEqual(1);
    expect(report.groups.map((group: any) => group.label)).toEqual([
      "777:A1类副驾驶",
      "777:A2类副驾驶",
      "777:C类机长",
      "划转副驾驶"
    ]);
    expect(report.groups.every((group: any) => group.maximum - group.minimum <= 1)).toBe(true);
    expect(scheduled.every((person: any) => person.period !== null)).toBe(true);
  });

  it("uses company leaders only as total-headcount fillers", () => {
    const people = logic.readRosterRows(technicalRosterRows([
      { technicalInfo: "777:飞行教员A", count: 2, isLeader: 1, isUsLineLeader: 1 },
      { technicalInfo: "777:C类机长", count: 2 },
      { technicalInfo: "777:飞行教员B", count: 2, isLeader: 1, isUsLineLeader: 1, identity: "公司领导" }
    ]));
    const companyLeader = people.find((person: any) => person.identity === "公司领导");

    expect(rules.resolveBalanceGroup(companyLeader, rules.DEFAULT_ENABLED_HOOK_IDS)).toBeNull();
    const scheduled = logic.buildInitialSchedule(people, 2, rules.DEFAULT_ENABLED_HOOK_IDS);
    const report = logic.checkBalance(scheduled, 2, rules.DEFAULT_ENABLED_HOOK_IDS);

    expect(report.total.counts).toEqual([3, 3]);
    expect(report.groups.find((group: any) => group.id === "hook:us-line-leader").counts).toEqual([1, 1]);
    expect(report.groups.every((group: any) => !group.label.includes("公司领导"))).toBe(true);
  });

  it("rejects duplicate employee IDs and unrecognized technical information", () => {
    expect(() => logic.readRosterRows([
      HEADERS,
      [1, "100001", "甲", "一分部", "777:C类机长", 0, 0, "换季学习", "", "", ""],
      [2, 100001, "乙", "二分部", "777:C类副驾驶", 0, 0, "换季学习", "", "", ""]
    ])).toThrow("员工号重复");

    expect(() => logic.readRosterRows([
      HEADERS,
      [1, "100001", "甲", "一分部", "未识别等级", 0, 0, "换季学习", "", "", ""]
    ])).toThrow("无法归类");
  });

  it("builds a six-period baseline with dynamic group differences no greater than one", () => {
    const people = logic.readRosterRows(rosterRows({ leader: 81, captain: 49, firstOfficer: 113, usLineLeader: 60 }));
    const scheduled = logic.buildInitialSchedule(people, 6, rules.DEFAULT_ENABLED_HOOK_IDS);
    const report = logic.checkBalance(scheduled, 6, rules.DEFAULT_ENABLED_HOOK_IDS);

    expect(report.balanced).toBe(true);
    expect(report.pendingCount).toBe(0);
    expect(report.total.counts).toEqual([41, 41, 41, 40, 40, 40]);
    expect(report.groups.find((group: any) => group.id === "hook:us-line-leader").counts).toEqual([10, 10, 10, 10, 10, 10]);
    expect(report.groups.slice(0, 2).map((group: any) => group.id)).toEqual([
      "hook:us-line-leader",
      "hook:leader"
    ]);
    expect(new Set(report.groups.slice(2).map((group: any) => group.id))).toEqual(new Set([
      "technical:777:C类机长",
      "technical:777:C类副驾驶"
    ]));
    expect(report.groups.every((group: any) => group.maximum - group.minimum <= 1)).toBe(true);
    expect(scheduled.every((person: any) => person.adjusted === false && person.adjustmentNotes.length === 0)).toBe(true);
  });

  it("uses the higher-priority hook for people whose markers overlap", () => {
    const rows = rosterRows({ leader: 37, captain: 3, firstOfficer: 19 });
    rows.slice(1 + 37, 1 + 37 + 1).forEach((row) => { row[6] = 1; });
    rows.slice(1 + 37 + 3).forEach((row) => { row[6] = 1; });

    const scheduled = logic.buildInitialSchedule(logic.readRosterRows(rows), 10);
    const report = logic.checkBalance(scheduled, 10, rules.DEFAULT_ENABLED_HOOK_IDS);

    expect(report.balanced).toBe(true);
    expect(report.groups.find((group: any) => group.id === "hook:us-line-leader").counts).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("excludes only company leaders from operational quotas while balancing them in total headcount", () => {
    const rows = rosterRows({ leader: 4, captain: 2, firstOfficer: 2, usLineLeader: 4 });
    rows[1][10] = "领导";
    rows[2][10] = "公司领导";
    rows[3][10] = "公司领导";

    const scheduled = logic.buildInitialSchedule(logic.readRosterRows(rows), 2);
    const report = logic.checkBalance(scheduled, 2);
    const companyLeaders = scheduled.filter((person: any) => person.identity === "公司领导");

    expect(report.balanced).toBe(true);
    expect(report.total.counts).toEqual([4, 4]);
    expect(report.groups.find((group: any) => group.id === "hook:us-line-leader").counts).toEqual([1, 1]);
    expect(companyLeaders.map((person: any) => person.period).sort()).toEqual([1, 2]);
    expect(scheduled.find((person: any) => person.identity === "领导").period).not.toBeNull();
  });

  it("uses a five-person tolerance for total counts and checks dynamic groups without changing assignments", () => {
    const scheduled = logic.buildInitialSchedule(
      logic.readRosterRows(rosterRows({ leader: 6, captain: 6, firstOfficer: 6 })),
      6
    );
    scheduled[0].period = 2;
    const before = scheduled.map((person: any) => person.period);
    const report = logic.checkBalance(scheduled, 6);

    expect(report.balanced).toBe(false);
    expect(report.total.balanced).toBe(true);
    expect(report.groups.find((group: any) => group.id === "hook:leader").balanced).toBe(false);
    expect(scheduled.map((person: any) => person.period)).toEqual(before);
  });

  it("assigns every person deterministically for all supported period counts and hook selections", () => {
    const people = logic.readRosterRows(technicalRosterRows([
      { technicalInfo: "777:A1类副驾驶", count: 9 },
      { technicalInfo: "777:A2类副驾驶", count: 7 },
      { technicalInfo: "777:B类机长", count: 5 },
      { technicalInfo: "777:飞行教员A", count: 4, isLeader: 1 },
      { technicalInfo: "777:飞行教员B", count: 3, isLeader: 1, isUsLineLeader: 1 },
      { technicalInfo: "划转机长", count: 2, identity: "公司领导" }
    ]));
    const hookSelections = [rules.DEFAULT_ENABLED_HOOK_IDS, ["leader"], []];

    for (let periodCount = 1; periodCount <= 30; periodCount += 1) {
      hookSelections.forEach((enabledHookIds) => {
        const first = logic.buildInitialSchedule(people, periodCount, enabledHookIds);
        const second = logic.buildInitialSchedule(people, periodCount, enabledHookIds);
        expect(first.map((person: any) => person.period)).toEqual(second.map((person: any) => person.period));
        expect(first.every((person: any) => person.period >= 1 && person.period <= periodCount)).toBe(true);
        expect(new Set(first.map((person: any) => person.employeeId)).size).toBe(people.length);
        const report = logic.checkBalance(first, periodCount, enabledHookIds);
        expect(report.total.maximum - report.total.minimum).toBeLessThanOrEqual(1);
        expect(report.groups.every((group: any) => group.maximum - group.minimum <= 1)).toBe(true);
      });
    }
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
    total[1][10] = "临时观察员";
    const actual = [
      [...HEADERS, "调整说明"],
      [1, "100001", "人员1", "一分部", "777:飞行教员A", 1, 1, "换季学习", "2026-10-08", "第3期", "临时观察员", "移动：第1期 → 第3期"],
      [2, "100002", "人员2", "二分部", "777:C类机长", 0, 0, "换季学习", "2026-10-09", 4, "", ""]
    ];
    const restored = logic.buildImportResult(total, actual, 6, null);

    expect(restored.mode).toBe("actual");
    expect(restored.people.map((person: any) => person.period)).toEqual([3, 4, null]);
    expect(restored.people[0].adjusted).toBe(true);
    expect(restored.people[0].identity).toBe("临时观察员");
    expect(restored.periodDates).toMatchObject({ 3: "2026-10-08", 4: "2026-10-09" });
    expect(restored.addedEmployeeIds).toEqual(["100003"]);

    const pending = logic.buildImportResult(total, [ACTUAL_HEADERS], 2, null);
    expect(pending.mode).toBe("pending");
    expect(pending.scheduleReady).toBe(false);
    expect(pending.people.every((person: any) => person.period === null)).toBe(true);
    const baselinePeople = logic.buildInitialSchedule(pending.people, 2);
    const updatedTotal = [
      HEADERS,
      [...total[1].slice(0, 10), "更新身份"],
      total[3],
      [4, "100004", "新增人员", "四分部", "777:B类副驾驶", 0, 0, "换季学习", "", "", ""]
    ];
    const merged = logic.buildImportResult(updatedTotal, [ACTUAL_HEADERS], 2, {
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

  it("treats actual rows without dates as pending even when a period remains", () => {
    const total = rosterRows({ leader: 1, captain: 1, firstOfficer: 1 });
    const actual = [
      HEADERS,
      [1, "100001", "人员1", "一分部", "777:飞行教员A", 1, 0, "换季学习", "", 1, "公司领导"],
      [2, "100002", "人员2", "二分部", "777:C类机长", 0, 0, "换季学习", "2026-09-16", 2, ""]
    ];

    const restored = logic.buildImportResult(total, actual, 6, null);

    expect(restored.mode).toBe("actual");
    expect(restored.scheduleReady).toBe(true);
    expect(restored.people.map((person: any) => person.period)).toEqual([null, 2, null]);
    expect(restored.periodDates).toMatchObject({ 1: "", 2: "2026-09-16" });
    expect(restored.addedEmployeeIds).toEqual(["100003"]);
  });

  it("keeps an actual roster authoritative when every actual date is blank", () => {
    const total = rosterRows({ leader: 1, captain: 0, firstOfficer: 0 });
    const actual = [
      HEADERS,
      [1, "100001", "人员1", "一分部", "777:飞行教员A", 1, 0, "换季学习", "", 1, "公司领导"]
    ];

    const restored = logic.buildImportResult(total, actual, 6, null);

    expect(restored.mode).toBe("actual");
    expect(restored.scheduleReady).toBe(true);
    expect(restored.people[0].period).toBeNull();
  });
});
