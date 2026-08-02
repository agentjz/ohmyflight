import { describe, expect, it } from "vitest";

import * as logic from "../../../src/tool/app/personnel-structure-stats/logic";
import type {
  PersonnelStatItem,
  PersonnelStatSection,
  PersonnelStructureResult
} from "../../../src/tool/app/personnel-structure-stats/models";

describe("personnel structure stats", () => {
  function buildRows(): unknown[][] {
    return [
      ["姓名", "员工号", "技术信息", "原单位", "检查员资格", "RAMA", "REUO", "RWAS", "EAMA", "EEUO", "EWAS", "是否运行"],
      ["教员甲", "100001", "777:飞行教员A", "总队777", "公司检查员", 1, 1, 1, 1, 1, 1, "否"],
      ["机长乙", "100002", "777:B类机长", "777返聘", "", "", "", "", 1, "", 1, "是"],
      ["机长丙", "100003", "777:Z类机长", "河南分公司", "", "", "", "", "", "", "", "是"],
      ["转机丁", "100004", "划转机长", "湖北分公司", "", "", "", "", "", "", "", "否"],
      ["副驾戊", "100005", "777:A2类副驾驶", "总队777", "", "", "", "", 1, 1, "", "是"],
      ["转机己", "100006", "划转副驾驶", "新疆分公司（借）", "", "", "", "", "", "", "", "否"],
      ["机长庚", "100007", "777:D类机长", "火星分公司", "", "", "", "", "", "", "", "否"],
      ["副驾辛", "100008", "777:E类副驾驶", "上海分公司（借）", "", "", "", "", "", 1, "", "否"]
    ];
  }

  function section(result: PersonnelStructureResult, title: string): PersonnelStatSection {
    const found = result.sections.find(item => item.title === title);
    expect(found).toBeTruthy();
    if (!found) throw new Error(`未找到统计表：${title}`);
    return found;
  }

  function itemOf(result: PersonnelStructureResult, title: string, label: string): PersonnelStatItem {
    const found = section(result, title).items.find(item => item.label === label);
    expect(found).toBeTruthy();
    if (!found) throw new Error(`未找到统计项：${title}/${label}`);
    return found;
  }

  function countOf(result: PersonnelStructureResult, title: string, label: string): number {
    return itemOf(result, title, label).count;
  }

  function categoryPercentTotal(sectionValue: PersonnelStatSection): number {
    return sectionValue.items
      .filter(item => !item.isSubset)
      .reduce((total, item) => total + Number.parseInt(item.percent, 10), 0);
  }

  it("parses personnel rows without management or run-state requirements", () => {
    const records = logic.parseRows(buildRows());

    expect(records).toHaveLength(8);
    expect(logic.REQUIRED_HEADERS).toEqual([
      "姓名",
      "技术信息",
      "RAMA",
      "REUO",
      "RWAS",
      "EAMA",
      "EEUO",
      "EWAS",
      "原单位",
      "检查员资格"
    ]);
    expect(records[0]).toMatchObject({
      employeeId: "100001",
      name: "教员甲",
      techInfo: "777:飞行教员A",
      origin: "总队777"
    });
    expect(records[0].qualifications.RAMA).toBe(true);
    expect(records[1].qualifications.RAMA).toBe(false);
  });

  it("calculates the eight report sections with one closed personnel hierarchy", () => {
    const result = logic.calculate(logic.parseRows(buildRows()));

    expect(result.structureCrewCount).toBe(8);
    expect(result.captainOrAboveCount).toBe(5);
    expect(result.firstOfficerCount).toBe(3);
    expect(result.sections.map(item => item.title)).toEqual([
      "教员、机长、副驾驶占比",
      "机长含以上各级别占比",
      "机长航线资格占比",
      "机长报务占比",
      "副驾驶级别占比",
      "副驾驶报务占比",
      "人员居住情况",
      "空勤人员原单位情况"
    ]);

    expect(countOf(result, "教员、机长、副驾驶占比", "教员")).toBe(1);
    expect(countOf(result, "教员、机长、副驾驶占比", "机长")).toBe(4);
    expect(countOf(result, "教员、机长、副驾驶占比", "副驾驶")).toBe(3);

    expect(countOf(result, "机长含以上各级别占比", "转机型机长")).toBe(1);
    expect(itemOf(result, "机长含以上各级别占比", "检查员").isSubset).toBe(true);
    expect(countOf(result, "机长航线资格占比", "其他")).toBe(1);
    expect(section(result, "机长航线资格占比").closure.denominator).toBe(4);
    expect(section(result, "机长报务占比").closure.denominator).toBe(4);

    expect(countOf(result, "副驾驶级别占比", "E类副驾驶")).toBe(1);
    expect(countOf(result, "副驾驶级别占比", "转机型副驾驶")).toBe(1);
    expect(section(result, "副驾驶级别占比").closure.denominator).toBe(3);
    expect(section(result, "副驾驶报务占比").closure.denominator).toBe(2);

    expect(section(result, "人员居住情况").closure.denominator).toBe(8);
    expect(section(result, "空勤人员原单位情况").closure.denominator).toBe(8);
    expect(countOf(result, "空勤人员原单位情况", "其他")).toBe(1);
  });

  it("keeps every section count and category percentage closed", () => {
    const result = logic.calculate(logic.parseRows(buildRows()));

    result.sections.forEach(sectionValue => {
      expect(sectionValue.closure.closed, sectionValue.title).toBe(true);
      expect(sectionValue.closure.total, sectionValue.title).toBe(sectionValue.closure.denominator);
      if (sectionValue.title !== "人员居住情况") {
        expect(categoryPercentTotal(sectionValue), sectionValue.title).toBe(100);
      }
    });

    const residence = section(result, "人员居住情况");
    const captainResidencePercent = residence.items
      .filter(item => item.label.startsWith("机长"))
      .reduce((total, item) => total + Number.parseInt(item.percent, 10), 0);
    const firstOfficerResidencePercent = residence.items
      .filter(item => item.label.startsWith("副驾驶"))
      .reduce((total, item) => total + Number.parseInt(item.percent, 10), 0);
    expect(captainResidencePercent).toBe(100);
    expect(firstOfficerResidencePercent).toBe(100);
  });

  it("does not let run-state values change the result", () => {
    const rows = buildRows();
    const toggledRows = rows.map((row, index) => index === 0
      ? row
      : row.map((value, column) => column === row.length - 1 ? (value === "是" ? "否" : "是") : value));

    expect(logic.calculate(logic.parseRows(toggledRows))).toEqual(logic.calculate(logic.parseRows(rows)));
  });
});
