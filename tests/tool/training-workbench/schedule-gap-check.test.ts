import { describe, expect, it, vi } from "vitest";

import { TrainingToolScheduleGapCheck as gapCheck } from "../../../src/tool/app/training-workbench/scripts/schedule-gap-check";
import { TrainingToolUtils } from "../../../src/tool/app/training-workbench/scripts/utils";
import { TrainingToolWorkbench } from "../../../src/tool/app/training-workbench/scripts/workbench";
import type { TrainingToolAnalysis } from "../../../src/tool/app/training-workbench/scripts/models";

function row(overrides: Record<string, unknown> = {}) {
  return {
    status: "必须排",
    projectName: "危险品",
    employeeId: "100001",
    name: "测试人员",
    expiry: "2026-07-01",
    dueDate: "2026-07-01",
    scheduledDate: "",
    source: "人员信息表 第2行",
    reason: "未找到可覆盖本轮到期的安排。",
    ...overrides
  };
}

describe("training workbench schedule gap check", () => {
  const trainingTool = { Workbench: TrainingToolWorkbench, Utils: TrainingToolUtils };

  it("uses inclusive 30, 60, and 90 day boundaries and always keeps overdue gaps", () => {
    const rows = [
      row({ employeeId: "1", name: "已过期", expiry: "2026-05-31", dueDate: "2026-05-31", status: "已过期" }),
      row({ employeeId: "2", name: "基准日", expiry: "2026-06-01", dueDate: "2026-06-01" }),
      row({ employeeId: "3", name: "第30天", expiry: "2026-07-01", dueDate: "2026-07-01" }),
      row({ employeeId: "4", name: "第31天", expiry: "2026-07-02", dueDate: "2026-07-02" }),
      row({ employeeId: "5", name: "第60天", expiry: "2026-07-31", dueDate: "2026-07-31" }),
      row({ employeeId: "6", name: "第61天", expiry: "2026-08-01", dueDate: "2026-08-01" }),
      row({ employeeId: "7", name: "第90天", expiry: "2026-08-30", dueDate: "2026-08-30" }),
      row({ employeeId: "8", name: "第91天", expiry: "2026-08-31", dueDate: "2026-08-31" })
    ];

    const within30 = gapCheck.buildFromRows(rows, "2026-06-01", 30);
    expect(within30.rows.map((item: any) => item.name)).toEqual(["已过期", "基准日", "第30天"]);
    expect(within30.rows.map((item: any) => item.windowLabel)).toEqual(["已过期", "30 天内", "30 天内"]);
    expect(within30.endDate).toBe("2026-07-01");

    const within60 = gapCheck.buildFromRows(rows, "2026-06-01", 60);
    expect(within60.rows.map((item: any) => item.name)).toEqual(["已过期", "基准日", "第30天", "第31天", "第60天"]);
    expect(within60.rows.at(-1)!.windowLabel).toBe("31-60 天");

    const within90 = gapCheck.buildFromRows(rows, "2026-06-01", 90);
    expect(within90.rows.map((item: any) => item.name)).toEqual([
      "已过期", "基准日", "第30天", "第31天", "第60天", "第61天", "第90天"
    ]);
    expect(within90.rows.at(-1)!.windowLabel).toBe("61-90 天");
  });

  it("excludes covered and abnormal rows but keeps schedules that cannot cover the expiry", () => {
    const result = gapCheck.buildFromRows([
      row({ employeeId: "10", name: "正确覆盖", status: "正常" }),
      row({ employeeId: "11", name: "数据异常", status: "异常" }),
      row({ employeeId: "12", name: "已排错日期", status: "已排未覆盖", scheduledDate: "2026-04-01" }),
      row({ employeeId: "13", name: "过期后补训", status: "已过期已排补训", dueDate: "2026-05-01", expiry: "2026-05-01", scheduledDate: "2026-06-10" })
    ], "2026-06-01", 30);

    expect(result.rows.map((item: any) => item.name)).toEqual(["过期后补训", "已排错日期"]);
    expect(result.rows.every((item: any) => item.attentionLabel === "已排未覆盖")).toBe(true);
    expect(result.summary.scheduledButUncoveredCount).toBe(2);
  });

  it("deduplicates a person and project, sorts by urgency, and counts people separately from gaps", () => {
    const result = gapCheck.buildFromRows([
      row({ employeeId: "20", name: "同一人", projectName: "危险品", dueDate: "2026-06-20" }),
      row({ employeeId: "20", name: "同一人", projectName: "危险品", dueDate: "2026-07-15" }),
      row({ employeeId: "20", name: "同一人", projectName: "TSA", dueDate: "2026-07-10" }),
      row({ employeeId: "21", name: "另一人", projectName: "航空安保", dueDate: "2026-05-20", status: "已过期" })
    ], "2026-06-01", 60);

    expect(result.rows.map((item: any) => `${item.name}/${item.projectName}`)).toEqual([
      "另一人/航空安保",
      "同一人/危险品",
      "同一人/TSA"
    ]);
    expect(result.rows[1]!.latestCompletionDate).toBe("2026-06-20");
    expect(result.summary).toMatchObject({
      peopleCount: 2,
      itemCount: 3,
      expiredCount: 1,
      within30Count: 1,
      within60Count: 1,
      within90Count: 0
    });
  });

  it("builds from the public workbench assessment and forwards simulation rows", () => {
    const simulationRows = [{ id: "simulation-1" }];
    let receivedOptions: any = null;
    vi.spyOn(trainingTool.Workbench, "buildWorkbench").mockImplementation((_analysis: unknown, options: any) => {
        receivedOptions = options;
        return {
          allDetailRows: [
            row({ employeeId: "30", name: "仍需安排", dueDate: "2026-07-01" }),
            row({ employeeId: "31", name: "已经覆盖", dueDate: "2026-07-01", status: "正常" })
          ]
        } as any;
    });

    const result = gapCheck.build({} as TrainingToolAnalysis, {
      baseDate: "2026-06-01",
      horizonDays: 30,
      extraProjectRows: simulationRows
    });

    expect(trainingTool.Utils.formatDate(receivedOptions.today)).toBe("2026-06-01");
    expect(trainingTool.Utils.formatDate(receivedOptions.stageEnd)).toBe("2026-07-01");
    expect(receivedOptions.extraProjectRows).toBe(simulationRows);
    expect(result.rows.map((item: any) => item.name)).toEqual(["仍需安排"]);
  });
});
