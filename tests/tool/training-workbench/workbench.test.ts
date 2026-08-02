import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TrainingToolScanner as Scanner } from "../../../src/tool/app/training-workbench/scripts/scanner";
import { TrainingToolWorkbench as Workbench } from "../../../src/tool/app/training-workbench/scripts/workbench";
import { TrainingToolWorkbenchExport as WorkbenchExport } from "../../../src/tool/app/training-workbench/scripts/workbench-export";

function makeDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function simplifyStats(cards: Array<{ label: string; value: number }>) {
  return cards.map((card) => ({ label: card.label, value: card.value }));
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new();

  const peopleSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "危险品", "航空安保"],
    ["1001", "张三", makeDate(2026, 5, 20)],
    ["1002", "李四", makeDate(2026, 5, 31), ""],
    ["1003", "王五", makeDate(2026, 6, 15), ""],
    ["1004", "赵六", makeDate(2026, 4, 30), ""],
    ["1005", "孙七", "无效日期", ""],
    ["1006", "周八", makeDate(2026, 12, 31), ""],
    ["1007", "吴九", makeDate(2026, 5, 29), ""],
    ["1008", "郑十", makeDate(2026, 5, 30), ""],
    ["1009", "钱一", "", makeDate(2026, 6, 10)],
    ["1010", "提前两月安保", "", makeDate(2026, 8, 31)]
  ], { cellDates: true });

  const projectSheet = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"],
    ["1001", "张三", "危险品", "是", makeDate(2026, 4, 15), makeDate(2026, 4, 15), "", ""],
    ["1002", "李四", "危险品", "否", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", ""],
    ["1007", "吴九", "危险品", "否", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", "已取消"],
    ["1008", "郑十", "危险品", "是", makeDate(2026, 5, 10), makeDate(2026, 5, 10), "", "取消"]
  ], { cellDates: true });

  XLSX.utils.book_append_sheet(workbook, peopleSheet, "人员信息表");
  XLSX.utils.book_append_sheet(workbook, projectSheet, "危险品");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "项目名称", "培训信息是否录入", "培训开始日期", "培训结束日期", "有效期", "备注"]
  ], { cellDates: true }), "航空安保");
  return workbook;
}

describe("training-workbench workbench", () => {
  beforeAll(() => {
    vi.stubGlobal("XLSX", XLSX);
  });

  it("scans current records into operational statuses for daily training monitoring", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = Workbench.buildWorkbench(analysis, {
      today: makeDate(2026, 5, 8)
    });

    const byPersonProject = new Map<string, any>(result.detailRows.map((row: any) => [`${row.name}/${row.projectName}`, row]));
    const byName = new Map<string, any>(result.detailRows.map((row: any) => [row.name, row]));

    expect(byName.get("王五").status).toBe("必须排");
    expect(byName.get("王五").reason).toContain("未找到可覆盖本轮到期的安排");

    expect(byName.get("王五").reason).toContain("本月不处理就会过期");

    expect(byName.get("赵六").status).toBe("已过期");
    expect(byName.get("赵六").reason).toContain("当前有效期已过期");

    expect(byName.get("孙七").status).toBe("异常");
    expect(byName.get("孙七").reason).toContain("无法解析为日期");

    expect(byName.get("吴九").status).toBe("必须排");
    expect(byName.get("吴九").reason).toContain("未找到可覆盖本轮到期的安排");

    expect(byName.get("郑十").status).toBe("异常");
    expect(byName.get("郑十").reason).toContain("培训信息是否录入为“是”，但备注包含“取消”");
    expect(byName.has("张三")).toBe(false);
    expect(byName.has("李四")).toBe(false);
    expect(byName.has("周八")).toBe(false);
    expect(byPersonProject.get("钱一/航空安保").status).toBe("必须排");
    expect(byPersonProject.get("提前两月安保/航空安保").status).toBe("推荐排");

    expect(simplifyStats(result.statsCards)).toEqual([
      { label: "已过期", value: 1 },
      { label: "必须排", value: 3 },
      { label: "推荐排", value: 1 },
      { label: "已排未覆盖", value: 0 },
      { label: "异常", value: 2 },
      { label: "已过期已排补训", value: 0 }
    ]);
    expect(result.displayColumns).toEqual(["状态", "项目", "姓名", "当前有效期", "已排日期", "说明"]);
    expect(result.detailColumns).toEqual(["状态", "项目", "员工号", "姓名", "当前有效期", "到期月份", "最晚完成日期", "已排日期", "来源", "说明"]);

    const coveredView = Workbench.viewFromRows(result, {
      statuses: ["正常"]
    });
    expect(coveredView.detailRows.map((row: any) => `${row.name}/${row.projectName}`)).toContain("张三/危险品");
    expect(coveredView.detailRows.map((row: any) => `${row.name}/${row.projectName}`)).toContain("李四/危险品");
    expect(coveredView.detailRows.map((row: any) => `${row.name}/${row.projectName}`)).toContain("周八/危险品");
  });

  it("filters workbench rows in the workbench module and exports the current view", () => {
    const workbook = buildWorkbook();
    const analysis = Scanner.analyzeWorkbook(workbook);
    const result = Workbench.buildWorkbench(analysis, {
      today: makeDate(2026, 5, 8)
    });

    const view = Workbench.viewFromRows(result, {
      statuses: ["必须排"],
      searchText: "吴九"
    });

    expect(view.detailRows).toHaveLength(1);
    expect(view.detailRows[0].name).toBe("吴九");
    expect(simplifyStats(view.statsCards)).toEqual([
      { label: "已过期", value: 0 },
      { label: "必须排", value: 1 },
      { label: "推荐排", value: 0 },
      { label: "已排未覆盖", value: 0 },
      { label: "异常", value: 0 },
      { label: "已过期已排补训", value: 0 }
    ]);

    const exported = WorkbenchExport.buildWorkbook(view);
    expect(exported.SheetNames).toEqual(["当前筛选总览"]);
    const sheet = exported.Sheets["当前筛选总览"];
    expect(sheet.A1?.v).toBe("状态");
    expect(sheet.F1?.v).toBe("到期月份");
    expect(sheet.D2?.v).toBe("吴九");

    const selected = WorkbenchExport.buildSelectionWorkbook({
      projectName: "危险品",
      status: "必须排",
      rows: view.detailRows
    });
    expect(selected.SheetNames).toEqual(["当前人员明细"]);
    const selectedSheet = selected.Sheets["当前人员明细"];
    expect(selectedSheet.A1?.v).toBe("项目");
    expect(selectedSheet.C1?.v).toBe("姓名");
    expect(selectedSheet.C2?.v).toBe("吴九");
    expect(selectedSheet.H2?.v).toContain("未找到可覆盖本轮到期的安排");
    expect(selectedSheet.I2?.v).toBe("人员信息表 第8行");
  });
});
