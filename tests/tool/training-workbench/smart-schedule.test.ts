import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolSmartSchedule as SmartSchedule } from "../../../src/tool/app/training-workbench/scripts/smart-schedule";
import { TrainingToolSmartScheduleOptimizer as SmartScheduleOptimizer } from "../../../src/tool/app/training-workbench/scripts/smart-schedule-optimizer";

function makeDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function projectSheet(projectName: string, rows: Array<{
  employeeId: string;
  name: string;
  start?: Date;
  end?: Date;
}>): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ...rows.map((row) => [
      row.employeeId,
      row.name,
      projectName,
      "否",
      row.start || "",
      row.end || row.start || "",
      "",
      ""
    ])
  ], { cellDates: true });
}

interface PersonSeed {
  employeeId: string;
  name: string;
  emergency?: Date;
  dangerousGoods?: Date;
  security?: Date;
  tsa?: Date;
}

type ProjectName = "应急训练" | "危险品" | "航空安保" | "TSA";
type ProjectSchedule = Array<{
  employeeId: string;
  name: string;
  start?: Date;
  end?: Date;
}>;

function buildWorkbook(
  people: PersonSeed[],
  schedules: Partial<Record<ProjectName, ProjectSchedule>> = {}
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "应急训练", "危险品", "航空安保", "TSA"],
    ...people.map((person) => [
      person.employeeId,
      person.name,
      person.emergency || "",
      person.dangerousGoods || "",
      person.security || "",
      person.tsa || ""
    ])
  ], { cellDates: true }), "人员信息表");
  const projectNames: ProjectName[] = ["应急训练", "危险品", "航空安保", "TSA"];
  projectNames.forEach((projectName) => {
    XLSX.utils.book_append_sheet(
      workbook,
      projectSheet(projectName, schedules[projectName] || []),
      projectName
    );
  });
  return workbook;
}

function monthKeys(startMonth: string, count: number): string[] {
  const [year, month] = startMonth.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const value = makeDate(year, month + index, 1);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  });
}

function zeroFixedRows(startMonth: string, count: number): Array<{ monthKey: string; personDays: number }> {
  return monthKeys(startMonth, count).map((monthKey) => ({ monthKey, personDays: 0 }));
}

describe("smart schedule", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("uses one continuous cross-year planning range", () => {
    const people = Array.from({ length: 18 }, (_, index): PersonSeed => ({
      employeeId: `10${String(index).padStart(2, "0")}`,
      name: `集中到期${index + 1}`,
      tsa: makeDate(2027, 5, 31)
    }));
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      startMonth: "2026-09",
      horizonMonths: 12,
      safetyLeadMonths: 0,
      avoidedMonths: [],
      today: makeDate(2026, 8, 14),
      fixedLoadRows: zeroFixedRows("2026-09", 12)
    });
    const view = SmartSchedule.buildView(plan);
    const scheduled = plan.items.filter((item) => item.schedulable);

    expect(plan.monthKeys).toEqual(monthKeys("2026-09", 12));
    expect(scheduled).toHaveLength(18);
    expect(new Set(scheduled.map((item) => item.recommendedMonth))).toEqual(new Set(
      monthKeys("2026-09", 9)
    ));
    expect(view.monthRows.map((row) => row.balancedPersonDays)).toEqual([
      2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0
    ]);
  });

  it("uses the recorded rolling defaults when optional parameters are omitted", () => {
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "1901", name: "默认参数", tsa: makeDate(2027, 5, 31) }
    ])), {
      today: makeDate(2026, 8, 14)
    });

    expect(plan).toMatchObject({
      startMonth: "2026-09",
      horizonMonths: 12,
      safetyLeadMonths: 2,
      avoidedMonths: [2, 7, 8]
    });
    expect(plan.monthKeys).toEqual(monthKeys("2026-09", 12));
  });

  it("keeps protected-window projects inside the rule window", () => {
    const people: PersonSeed[] = [
      { employeeId: "2001", name: "应急甲", emergency: makeDate(2027, 6, 30) },
      { employeeId: "2002", name: "应急乙", emergency: makeDate(2027, 6, 30) },
      { employeeId: "2003", name: "危险品甲", dangerousGoods: makeDate(2027, 6, 30) },
      { employeeId: "2004", name: "危险品乙", dangerousGoods: makeDate(2027, 6, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      startMonth: "2027-01",
      horizonMonths: 12,
      safetyLeadMonths: 2,
      avoidedMonths: [],
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-01", 12)
    });

    const emergency = plan.items.filter((item) => item.projectName === "应急训练");
    const dangerousGoods = plan.items.filter((item) => item.projectName === "危险品");
    expect(emergency).toHaveLength(2);
    expect(emergency.every((item) => item.eligibleStartMonth === "2027-04"
      && item.eligibleEndMonth === "2027-06"
      && item.recommendedMonth >= "2027-04"
      && item.recommendedMonth <= "2027-06")).toBe(true);
    expect(dangerousGoods).toHaveLength(2);
    expect(dangerousGoods.every((item) => item.eligibleStartMonth === "2027-03"
      && item.eligibleEndMonth === "2027-06"
      && item.recommendedMonth >= "2027-03"
      && item.recommendedMonth <= "2027-06")).toBe(true);
  });

  it("separates overdue, in-range, and later-round tasks at the rolling boundary", () => {
    const people: PersonSeed[] = [
      { employeeId: "3001", name: "开始前已逾期", tsa: makeDate(2026, 8, 31) },
      { employeeId: "3002", name: "范围内到期", tsa: makeDate(2027, 2, 28) },
      { employeeId: "3003", name: "范围外到期", tsa: makeDate(2027, 9, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      startMonth: "2026-09",
      horizonMonths: 12,
      today: makeDate(2026, 8, 14),
      fixedLoadRows: zeroFixedRows("2026-09", 12)
    });

    expect(plan.items.find((item) => item.name === "开始前已逾期")).toMatchObject({
      schedulable: false,
      recommendedMonth: ""
    });
    expect(plan.items.find((item) => item.name === "范围内到期")?.schedulable).toBe(true);
    expect(plan.items.some((item) => item.name === "范围外到期")).toBe(false);
  });

  it("keeps manual schedule facts as a separate plan projection", () => {
    const people: PersonSeed[] = [
      { employeeId: "3101", name: "未来已排", tsa: makeDate(2027, 6, 30) },
      { employeeId: "3102", name: "尚未排班", tsa: makeDate(2027, 6, 30) },
      { employeeId: "3103", name: "窗口外安排", tsa: makeDate(2027, 6, 30) },
      { employeeId: "3104", name: "晚于截止", tsa: makeDate(2027, 6, 30) },
      { employeeId: "3105", name: "范围前已排", tsa: makeDate(2027, 6, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people, {
      TSA: [
        { employeeId: "3101", name: "未来已排", start: makeDate(2027, 3, 10) },
        { employeeId: "3103", name: "窗口外安排", start: makeDate(2026, 1, 10) },
        { employeeId: "3104", name: "晚于截止", start: makeDate(2027, 7, 10) },
        { employeeId: "3105", name: "范围前已排", start: makeDate(2027, 1, 10) }
      ]
    })), {
      startMonth: "2027-02",
      horizonMonths: 12,
      safetyLeadMonths: 0,
      avoidedMonths: [],
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-02", 12)
    });
    const rows = new Map(plan.items.map((item) => [item.name, item]));

    expect(rows.get("未来已排")).toMatchObject({
      manualStatus: "已排班",
      scheduledDate: "2027-03-10",
      manualPlanMonth: "2027-03"
    });
    expect(rows.get("尚未排班")).toMatchObject({
      manualStatus: "未排班",
      scheduledDate: "",
      manualPlanMonth: "2027-06"
    });
    expect(rows.get("窗口外安排")).toMatchObject({
      manualStatus: "已排未覆盖",
      scheduledDate: "2026-01-10",
      manualPlanMonth: "2027-06"
    });
    expect(rows.get("晚于截止")).toMatchObject({
      manualStatus: "晚于截止日",
      scheduledDate: "2027-07-10",
      manualPlanMonth: "2027-06"
    });
    expect(rows.get("范围前已排")).toMatchObject({
      manualStatus: "已排班",
      scheduledDate: "2027-01-10",
      manualPlanMonth: "2027-06"
    });
    expect(rows.get("范围前已排")?.reason).toContain("实际月份不在观察范围");
    const view = SmartSchedule.buildView(plan);
    expect(view.monthRows.reduce((total, row) => total + row.originalDuePersonDays, 0)).toBe(5);
    expect(view.monthRows.reduce((total, row) => total + row.manualPlanPersonDays, 0)).toBe(5);
    expect(view.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(5);
  });

  it("projects an in-memory manual schedule without changing the ideal task", () => {
    const analysis = Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "3201", name: "模拟排班", tsa: makeDate(2027, 6, 30) }
    ]));
    const plan = SmartSchedule.buildPlan(analysis, {
      startMonth: "2027-01",
      horizonMonths: 12,
      safetyLeadMonths: 0,
      avoidedMonths: [],
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-01", 12),
      extraProjectRows: [{
        id: "simulation-1",
        projectName: "TSA",
        employeeId: "3201",
        name: "模拟排班",
        trainingStartDate: "2027-04-10",
        trainingEndDate: "2027-04-10"
      }]
    });

    expect(plan.items[0]).toMatchObject({
      manualStatus: "已排班",
      scheduledDate: "2027-04-10",
      manualPlanMonth: "2027-04",
      dueDate: "2027-06-30"
    });
  });

  it("locks peak load before optimizing the safety target", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02", "2027-03", "2027-04"],
      fixedLoads: new Map(),
      avoidedMonths: [],
      groups: [{
        id: "safety-first",
        projectName: "TSA",
        count: 2,
        personDays: 1,
        safetyTargetMonth: "2027-02",
        candidateMonths: ["2027-01", "2027-02", "2027-03", "2027-04"]
      }]
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(1);
    expect(result.safetyPenalty).toBe(0);
    expect([...result.assignments.get("safety-first")!.keys()].sort()).toEqual(["2027-01", "2027-02"]);
  });

  it("never raises the total peak to improve a lower-priority project shape", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02"],
      fixedLoads: new Map(),
      avoidedMonths: [],
      groups: [
        {
          id: "fixed-project",
          projectName: "固定项目",
          count: 1,
          personDays: 10,
          safetyTargetMonth: "2027-01",
          candidateMonths: ["2027-01"]
        },
        {
          id: "flexible-project",
          projectName: "可调项目",
          count: 2,
          personDays: 1,
          safetyTargetMonth: "2027-02",
          candidateMonths: ["2027-01", "2027-02"]
        }
      ]
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(10);
    expect(result.assignments.get("flexible-project")).toEqual(new Map([["2027-02", 2]]));
  });

  it("never worsens global deviation to improve a lower-priority project shape", () => {
    const monthKeys = ["2027-01", "2027-02", "2027-03"];
    const groups = [
      {
        id: "all-months",
        projectName: "全年可调项目",
        count: 3,
        personDays: 1,
        safetyTargetMonth: "2027-03",
        candidateMonths: monthKeys
      },
      {
        id: "early-window",
        projectName: "前两月项目",
        count: 4,
        personDays: 1,
        safetyTargetMonth: "2027-02",
        candidateMonths: monthKeys.slice(0, 2)
      }
    ];
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys,
      fixedLoads: new Map(),
      avoidedMonths: [],
      groups
    });
    const loads = new Map(monthKeys.map((monthKey) => [monthKey, 0]));
    groups.forEach((group) => {
      result.assignments.get(group.id)?.forEach((count, monthKey) => {
        loads.set(monthKey, (loads.get(monthKey) || 0) + count * group.personDays);
      });
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(3);
    expect(result.totalDeviation).toBeCloseTo(4 / 3);
    expect([...loads.values()].sort((left, right) => left - right)).toEqual([2, 2, 3]);
  });

  it("keeps the safety target ahead of a conflicting avoidance preference", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02"],
      fixedLoads: new Map(),
      avoidedMonths: [1],
      groups: [{
        id: "safety-before-avoidance",
        projectName: "TSA",
        count: 1,
        personDays: 1,
        safetyTargetMonth: "2027-01",
        candidateMonths: ["2027-01", "2027-02"]
      }]
    });

    expect(result.status).toBe("optimal");
    expect(result.safetyPenalty).toBe(0);
    expect(result.avoidedPersonDays).toBe(1);
    expect(result.assignments.get("safety-before-avoidance")).toEqual(new Map([["2027-01", 1]]));
  });

  it("uses the real deadline when the safety target cannot hold all work", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02", "2027-03"],
      fixedLoads: new Map(),
      avoidedMonths: [],
      groups: [{
        id: "deadline-fallback",
        projectName: "TSA",
        count: 4,
        personDays: 1,
        safetyTargetMonth: "2027-01",
        candidateMonths: ["2027-01", "2027-02", "2027-03"]
      }]
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(2);
    expect(result.assignments.get("deadline-fallback")).toEqual(new Map([
      ["2027-01", 2],
      ["2027-02", 2]
    ]));
  });

  it("avoids selected calendar months only after peak and safety are locked", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02", "2027-03"],
      fixedLoads: new Map(),
      avoidedMonths: [2],
      groups: [{
        id: "avoid-february",
        projectName: "TSA",
        count: 2,
        personDays: 1,
        safetyTargetMonth: "2027-03",
        candidateMonths: ["2027-01", "2027-02", "2027-03"]
      }]
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(1);
    expect(result.safetyPenalty).toBe(0);
    expect(result.avoidedPersonDays).toBe(0);
    expect(result.assignments.get("avoid-february")).toEqual(new Map([
      ["2027-01", 1],
      ["2027-03", 1]
    ]));
  });

  it("still schedules work when its only legal month is selected for avoidance", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-02"],
      fixedLoads: new Map(),
      avoidedMonths: [2],
      groups: [{
        id: "must-use-february",
        projectName: "应急训练",
        count: 1,
        personDays: 1,
        safetyTargetMonth: "2027-02",
        candidateMonths: ["2027-02"]
      }]
    });

    expect(result.status).toBe("optimal");
    expect(result.assignments.get("must-use-february")).toEqual(new Map([["2027-02", 1]]));
    expect(result.avoidedPersonDays).toBe(1);
  });

  it("uses the same one-time workload for original pressure and the balanced plan", () => {
    const people = Array.from({ length: 12 }, (_, index): PersonSeed => ({
      employeeId: `40${String(index).padStart(2, "0")}`,
      name: `一次任务${index + 1}`,
      tsa: makeDate(2027, 6, 30)
    }));
    const view = SmartSchedule.buildView(SmartSchedule.buildPlan(
      Scanner.analyzeWorkbook(buildWorkbook(people)),
      {
        startMonth: "2027-01",
        horizonMonths: 12,
        safetyLeadMonths: 0,
        avoidedMonths: [],
        today: makeDate(2027, 1, 1),
        fixedLoadRows: zeroFixedRows("2027-01", 12)
      }
    ));

    expect(view.monthRows.find((row) => row.monthKey === "2027-06")?.originalDuePersonDays).toBe(12);
    expect(view.monthRows.reduce((total, row) => total + row.originalDuePersonDays, 0)).toBe(12);
    expect(view.monthRows.reduce((total, row) => total + row.manualPlanPersonDays, 0)).toBe(12);
    expect(view.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(12);
    expect(Math.max(...view.monthRows.map((row) => row.balancedPersonDays))).toBe(2);
  });

  it("does not let future manual schedule months influence the ideal plan", () => {
    const people = Array.from({ length: 6 }, (_, index): PersonSeed => ({
      employeeId: `50${index}`,
      name: `独立方案${index + 1}`,
      tsa: makeDate(2027, 6, 30)
    }));
    const marchSchedules = people.map((person) => ({
      employeeId: person.employeeId,
      name: person.name,
      start: makeDate(2027, 3, 10)
    }));
    const maySchedules = people.map((person) => ({
      employeeId: person.employeeId,
      name: person.name,
      start: makeDate(2027, 5, 10)
    }));
    const options = {
      startMonth: "2027-01",
      horizonMonths: 12,
      safetyLeadMonths: 0,
      avoidedMonths: [] as number[],
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-01", 12)
    };
    const marchPlan = SmartSchedule.buildPlan(
      Scanner.analyzeWorkbook(buildWorkbook(people, { TSA: marchSchedules })),
      options
    );
    const mayPlan = SmartSchedule.buildPlan(
      Scanner.analyzeWorkbook(buildWorkbook(people, { TSA: maySchedules })),
      options
    );
    const recommendations = (items: typeof marchPlan.items) => items
      .map((item) => [item.employeeId, item.recommendedMonth])
      .sort(([left], [right]) => left.localeCompare(right));

    expect(recommendations(marchPlan.items)).toEqual(recommendations(mayPlan.items));
    expect(new Set(marchPlan.items.map((item) => item.manualPlanMonth))).toEqual(new Set(["2027-03"]));
    expect(new Set(mayPlan.items.map((item) => item.manualPlanMonth))).toEqual(new Set(["2027-05"]));
  });

  it("uses completed history once to schedule the next current round", () => {
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "6001", name: "历史顺延后仍到期", tsa: makeDate(2027, 5, 31) }
    ], {
      TSA: [{ employeeId: "6001", name: "历史顺延后仍到期", start: makeDate(2026, 6, 10) }]
    })), {
      startMonth: "2026-09",
      horizonMonths: 12,
      today: makeDate(2026, 8, 14),
      fixedLoadRows: zeroFixedRows("2026-09", 12)
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      name: "历史顺延后仍到期",
      dueDate: "2027-06-30",
      schedulable: true,
      manualStatus: "未排班",
      scheduledDate: "",
      manualPlanMonth: "2027-06"
    });
  });

  it("projects a selected project without changing the global recommendations", () => {
    const people: PersonSeed[] = [
      { employeeId: "7001", name: "应急项目", emergency: makeDate(2027, 6, 30) },
      { employeeId: "7002", name: "危险品项目", dangerousGoods: makeDate(2027, 6, 30) },
      { employeeId: "7003", name: "TSA项目", tsa: makeDate(2027, 6, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      startMonth: "2027-01",
      horizonMonths: 12,
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-01", 12)
    });
    const globalTsaMonth = plan.items.find((item) => item.projectName === "TSA")?.recommendedMonth;
    const tsaView = SmartSchedule.buildView(plan, { projectName: "TSA" });

    expect(tsaView.selectedProject).toBe("TSA");
    expect(tsaView.items).toHaveLength(1);
    expect(tsaView.items[0].recommendedMonth).toBe(globalTsaMonth);
    expect(tsaView.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(1);
  });

  it("adds fixed CRM load only to the all-project projection", () => {
    const fixedLoadRows = zeroFixedRows("2027-01", 12);
    fixedLoadRows[0].personDays = 5;
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "7501", name: "固定底座", tsa: makeDate(2027, 2, 28) }
    ])), {
      startMonth: "2027-01",
      horizonMonths: 12,
      safetyLeadMonths: 0,
      avoidedMonths: [],
      today: makeDate(2027, 1, 1),
      fixedLoadRows
    });
    const allProjects = SmartSchedule.buildView(plan);
    const tsaOnly = SmartSchedule.buildView(plan, { projectName: "TSA" });

    expect(allProjects.monthRows.reduce((total, row) => total + row.originalDuePersonDays, 0)).toBe(6);
    expect(allProjects.monthRows.reduce((total, row) => total + row.manualPlanPersonDays, 0)).toBe(6);
    expect(allProjects.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(6);
    expect(tsaOnly.monthRows.reduce((total, row) => total + row.originalDuePersonDays, 0)).toBe(1);
    expect(tsaOnly.monthRows.reduce((total, row) => total + row.manualPlanPersonDays, 0)).toBe(1);
    expect(tsaOnly.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(1);
  });

  it("estimates person-days from the most common active project duration", () => {
    const workbook = buildWorkbook([
      { employeeId: "8001", name: "待排人员", emergency: makeDate(2027, 6, 30) }
    ], {
      "应急训练": [
        { employeeId: "8901", name: "两天样本甲", start: makeDate(2026, 4, 1), end: makeDate(2026, 4, 2) },
        { employeeId: "8902", name: "两天样本乙", start: makeDate(2026, 5, 1), end: makeDate(2026, 5, 2) }
      ]
    });
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(workbook), {
      startMonth: "2027-01",
      horizonMonths: 12,
      today: makeDate(2027, 1, 1),
      fixedLoadRows: zeroFixedRows("2027-01", 12)
    });

    expect(plan.items.find((item) => item.projectName === "应急训练")?.personDays).toBe(2);
  });
});
