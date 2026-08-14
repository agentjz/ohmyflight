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

function buildWorkbook(
  people: PersonSeed[],
  schedules: Partial<Record<"应急训练" | "危险品" | "航空安保" | "TSA", Array<{
    employeeId: string;
    name: string;
    start?: Date;
    end?: Date;
  }>>> = {}
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
  XLSX.utils.book_append_sheet(workbook, projectSheet("应急训练", schedules["应急训练"] || []), "应急训练");
  XLSX.utils.book_append_sheet(workbook, projectSheet("危险品", schedules["危险品"] || []), "危险品");
  XLSX.utils.book_append_sheet(workbook, projectSheet("航空安保", schedules["航空安保"] || []), "航空安保");
  XLSX.utils.book_append_sheet(workbook, projectSheet("TSA", schedules.TSA || []), "TSA");
  return workbook;
}

function zeroLoadRows(year: number): Array<{ monthKey: string; personDays: number }> {
  return Array.from({ length: 12 }, (_, index) => ({
    monthKey: `${year}-${String(index + 1).padStart(2, "0")}`,
    personDays: 0
  }));
}

describe("smart schedule", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("spreads a concentrated latest-date workload across every legal month", () => {
    const people = Array.from({ length: 12 }, (_, index): PersonSeed => ({
      employeeId: `10${String(index).padStart(2, "0")}`,
      name: `集中到期${index + 1}`,
      tsa: makeDate(2027, 6, 30)
    }));
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: zeroLoadRows(2027)
    });
    const view = SmartSchedule.buildView(plan);
    const scheduled = plan.items.filter((item) => item.schedulable);

    expect(plan.optimizationStatus).toBe("optimal");
    expect(scheduled).toHaveLength(12);
    expect(new Set(scheduled.map((item) => item.recommendedMonth))).toEqual(new Set([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06"
    ]));
    expect(scheduled.every((item) => item.recommendedMonth >= item.eligibleStartMonth
      && item.recommendedMonth <= item.eligibleEndMonth)).toBe(true);
    expect(view.monthRows.slice(0, 6).map((row) => row.balancedPersonDays)).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it("keeps window projects inside their protected range while balancing the global plan", () => {
    const people: PersonSeed[] = [
      { employeeId: "2001", name: "应急甲", emergency: makeDate(2027, 6, 30) },
      { employeeId: "2002", name: "应急乙", emergency: makeDate(2027, 6, 30) },
      { employeeId: "2003", name: "危险品甲", dangerousGoods: makeDate(2027, 6, 30) },
      { employeeId: "2004", name: "危险品乙", dangerousGoods: makeDate(2027, 6, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: zeroLoadRows(2027)
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

  it("fills low-load months before adding to an existing monthly peak", () => {
    const people = Array.from({ length: 12 }, (_, index): PersonSeed => ({
      employeeId: `25${String(index).padStart(2, "0")}`,
      name: `填谷任务${index + 1}`,
      tsa: makeDate(2027, 12, 31)
    }));
    const currentLoads = zeroLoadRows(2027);
    currentLoads[0].personDays = 2;
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: currentLoads
    });
    const view = SmartSchedule.buildView(plan);

    expect(plan.items.filter((item) => item.recommendedMonth === "2027-01")).toHaveLength(0);
    expect(Math.max(...view.monthRows.map((row) => row.balancedPersonDays))).toBe(2);
    expect(view.monthRows.find((row) => row.monthKey === "2027-01")?.balancedPersonDays).toBe(2);
  });

  it("never worsens the annual peak to improve a lower-priority project peak", () => {
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys: ["2027-01", "2027-02"],
      fixedLoads: new Map(),
      groups: [
        {
          id: "fixed-project",
          projectName: "固定项目",
          count: 1,
          personDays: 10,
          candidateMonths: ["2027-01"]
        },
        {
          id: "flexible-project",
          projectName: "可调项目",
          count: 2,
          personDays: 1,
          candidateMonths: ["2027-01", "2027-02"]
        }
      ]
    });

    expect(result.status).toBe("optimal");
    expect(result.peakPersonDays).toBe(10);
    expect(result.assignments.get("flexible-project")).toEqual(new Map([["2027-02", 2]]));
  });

  it("never worsens annual deviation to improve a lower-priority project shape", () => {
    const monthKeys = ["2027-01", "2027-02", "2027-03"];
    const groups = [
      {
        id: "annual-balance",
        projectName: "全年可调项目",
        count: 3,
        personDays: 1,
        candidateMonths: monthKeys
      },
      {
        id: "early-window",
        projectName: "前两月项目",
        count: 4,
        personDays: 1,
        candidateMonths: monthKeys.slice(0, 2)
      }
    ];
    const result = SmartScheduleOptimizer.optimizeSchedule({
      monthKeys,
      fixedLoads: new Map(),
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

  it("does not hide one project peak behind another project's low month", () => {
    const people: PersonSeed[] = [
      ...Array.from({ length: 12 }, (_, index): PersonSeed => ({
        employeeId: `27A${String(index).padStart(2, "0")}`,
        name: `安保均衡${index + 1}`,
        security: makeDate(2027, 12, 31)
      })),
      ...Array.from({ length: 12 }, (_, index): PersonSeed => ({
        employeeId: `27T${String(index).padStart(2, "0")}`,
        name: `TSA均衡${index + 1}`,
        tsa: makeDate(2027, 12, 31)
      }))
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: zeroLoadRows(2027)
    });
    const security = SmartSchedule.buildView(plan, { projectName: "航空安保" });
    const tsa = SmartSchedule.buildView(plan, { projectName: "TSA" });

    expect(security.monthRows.map((row) => row.balancedPersonDays)).toEqual(Array(12).fill(1));
    expect(tsa.monthRows.map((row) => row.balancedPersonDays)).toEqual(Array(12).fill(1));
  });

  it("does not let future manual schedule months influence the ideal plan", () => {
    const people = Array.from({ length: 6 }, (_, index): PersonSeed => ({
      employeeId: `30${index}`,
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
    const marchLoads = zeroLoadRows(2027);
    marchLoads[2].personDays = people.length;
    const mayLoads = zeroLoadRows(2027);
    mayLoads[4].personDays = people.length;

    const marchPlan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people, { TSA: marchSchedules })), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: marchLoads
    });
    const mayPlan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people, { TSA: maySchedules })), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: mayLoads
    });
    const recommendations = (items: typeof marchPlan.items) => items
      .map((item) => [item.employeeId, item.recommendedMonth])
      .sort(([left], [right]) => left.localeCompare(right));

    expect(recommendations(marchPlan.items)).toEqual(recommendations(mayPlan.items));
  });

  it("keeps completed history as fixed load without returning it as a recommendation", () => {
    const people: PersonSeed[] = [
      { employeeId: "4001", name: "已经完成", tsa: makeDate(2027, 6, 30) },
      { employeeId: "4002", name: "仍需安排", tsa: makeDate(2027, 6, 30) }
    ];
    const currentLoads = zeroLoadRows(2027);
    currentLoads[0].personDays = 1;
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people, {
      TSA: [{ employeeId: "4001", name: "已经完成", start: makeDate(2027, 1, 5) }]
    })), {
      year: 2027,
      today: makeDate(2027, 2, 1),
      currentLoadRows: currentLoads
    });
    const view = SmartSchedule.buildView(plan);

    expect(plan.items.some((item) => item.name === "已经完成")).toBe(false);
    expect(plan.items.some((item) => item.name === "仍需安排")).toBe(true);
    expect(view.monthRows.find((row) => row.monthKey === "2027-01")).toMatchObject({
      currentPersonDays: 1,
      balancedPersonDays: 1
    });
  });

  it("uses completed history to schedule the next round when it is still due in the planning year", () => {
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "4501", name: "历史顺延后仍到期", tsa: makeDate(2027, 5, 31) }
    ], {
      TSA: [{ employeeId: "4501", name: "历史顺延后仍到期", start: makeDate(2026, 6, 10) }]
    })), {
      year: 2027,
      today: makeDate(2026, 8, 14),
      currentLoadRows: zeroLoadRows(2027)
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      name: "历史顺延后仍到期",
      dueDate: "2027-06-30",
      schedulable: true
    });
  });

  it("reports work that already has no legal month", () => {
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook([
      { employeeId: "5001", name: "已经逾期", tsa: makeDate(2027, 1, 5) }
    ])), {
      year: 2027,
      today: makeDate(2027, 1, 10),
      currentLoadRows: zeroLoadRows(2027)
    });

    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({
      name: "已经逾期",
      schedulable: false,
      recommendedMonth: ""
    });
  });

  it("projects a selected project without changing the global recommendations", () => {
    const people: PersonSeed[] = [
      { employeeId: "6001", name: "应急项目", emergency: makeDate(2027, 6, 30) },
      { employeeId: "6002", name: "危险品项目", dangerousGoods: makeDate(2027, 6, 30) },
      { employeeId: "6003", name: "TSA项目", tsa: makeDate(2027, 6, 30) }
    ];
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(buildWorkbook(people)), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: zeroLoadRows(2027)
    });
    const globalTsaMonth = plan.items.find((item) => item.projectName === "TSA")?.recommendedMonth;
    const tsaView = SmartSchedule.buildView(plan, { projectName: "TSA" });

    expect(tsaView.selectedProject).toBe("TSA");
    expect(tsaView.items).toHaveLength(1);
    expect(tsaView.items[0].recommendedMonth).toBe(globalTsaMonth);
    expect(tsaView.monthRows.reduce((total, row) => total + row.balancedPersonDays, 0)).toBe(1);
  });

  it("estimates person-days from the most common project duration", () => {
    const people: PersonSeed[] = [
      { employeeId: "7001", name: "待排人员", emergency: makeDate(2027, 6, 30) }
    ];
    const workbook = buildWorkbook(people, {
      "应急训练": [
        { employeeId: "7901", name: "两天样本甲", start: makeDate(2026, 4, 1), end: makeDate(2026, 4, 2) },
        { employeeId: "7902", name: "两天样本乙", start: makeDate(2026, 5, 1), end: makeDate(2026, 5, 2) }
      ]
    });
    const plan = SmartSchedule.buildPlan(Scanner.analyzeWorkbook(workbook), {
      year: 2027,
      today: makeDate(2027, 1, 1),
      currentLoadRows: zeroLoadRows(2027)
    });

    expect(plan.items.find((item) => item.projectName === "应急训练")?.personDays).toBe(2);
  });

  it("exposes one annual average reference for the displayed plan", () => {
    const people = Array.from({ length: 24 }, (_, index): PersonSeed => ({
      employeeId: `80${String(index).padStart(2, "0")}`,
      name: `全年任务${index + 1}`,
      tsa: makeDate(2027, 12, 31)
    }));
    const view = SmartSchedule.buildView(SmartSchedule.buildPlan(
      Scanner.analyzeWorkbook(buildWorkbook(people)),
      { year: 2027, today: makeDate(2027, 1, 1), currentLoadRows: zeroLoadRows(2027) }
    ));

    expect(view.monthRows.map((row) => row.balancedPersonDays)).toEqual(Array(12).fill(2));
    expect(view.monthRows.map((row) => row.averagePersonDays)).toEqual(Array(12).fill(2));
  });
});
