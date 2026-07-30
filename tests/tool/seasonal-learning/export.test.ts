import * as XLSX from "xlsx-js-style";
import { beforeAll, describe, expect, it } from "vitest";

import { loadBrowserScripts } from "../../helpers/browser-context";

const ACTUAL_HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "培训类型", "日期", "期数", "身份"];
const HEADERS = ["序号", "员工号", "姓名", "分部", "技术信息", "是否带队", "是否美线带队", "培训类型", "日期", "期数", "身份"];

function workbookFixture() {
  const workbook = XLSX.utils.book_new();
  const actual = XLSX.utils.aoa_to_sheet([ACTUAL_HEADERS]);
  const total = XLSX.utils.aoa_to_sheet([
    HEADERS,
    [1, 100001, "甲", "一分部", "777:C类机长", 0, 1, "换季学习", "", "", "临时观察员"],
    [2, 100002, "乙", "二分部", "777:C类副驾驶", 0, 0, "换季学习", "", "", ""]
  ]);
  const everyone = XLSX.utils.aoa_to_sheet([
    ["员工号", "姓名", "分部", "技术信息", "REUO"],
    [100001, "甲", "一分部", "777:C类机长", ""]
  ]);
  XLSX.utils.book_append_sheet(workbook, actual, "换季实际");
  XLSX.utils.book_append_sheet(workbook, total, "换季总名单");
  XLSX.utils.book_append_sheet(workbook, everyone, "所有人");
  return workbook;
}

describe("seasonal learning export", () => {
  let logic: any;
  let exporter: any;

  beforeAll(() => {
    const context = loadBrowserScripts([
      "tool/app/seasonal-learning/data.js",
      "tool/app/seasonal-learning/allocation.js",
      "tool/app/seasonal-learning/logic.js",
      "tool/app/seasonal-learning/export.js"
    ], { XLSX });
    logic = context.SeasonalLearningLogic;
    exporter = context.SeasonalLearningExport;
  });

  it("replaces only the actual sheet, sorts rows, writes notes, and highlights adjusted rows", () => {
    const source = workbookFixture();
    const sourceTotalJson = JSON.stringify(source.Sheets["换季总名单"]);
    const sourceEveryoneJson = JSON.stringify(source.Sheets["所有人"]);
    const people = logic.readRosterRows(XLSX.utils.sheet_to_json(source.Sheets["换季总名单"], {
      header: 1,
      raw: true,
      defval: null
    }));

    people[0].period = 2;
    people[0].adjusted = true;
    people[0].adjustmentNotes = ["移动：第1期 → 第2期"];
    people[1].period = 1;

    const output = exporter.buildExportWorkbook(source, people, {
      1: "2026-09-02",
      2: "2026-09-01"
    });
    const actual = output.Sheets["换季实际"];

    expect(output).not.toBe(source);
    expect(output.SheetNames).toEqual(["换季实际", "换季总名单", "所有人"]);
    expect(actual.G1.v).toBe("是否美线带队");
    expect(actual.K1.v).toBe("身份");
    expect(actual.L1.v).toBe("调整说明");
    expect(actual.C2.v).toBe("乙");
    expect(actual.G2.v).toBe(0);
    expect(actual.J2.v).toBe(1);
    expect(actual.C3.v).toBe("甲");
    expect(actual.G3.v).toBe(1);
    expect(actual.J3.v).toBe(2);
    expect(actual.K3.v).toBe("临时观察员");
    expect(actual.L3.v).toBe("移动：第1期 → 第2期");
    expect(actual.A3.s.fill.fgColor.rgb).toBe("FFF2F2");
    expect(actual.L3.s.font.color.rgb).toBe("000000");
    expect(actual.I2.t).toBe("d");
    expect(actual.I2.z).toBe("yyyy-mm-dd");
    expect(JSON.stringify(source.Sheets["换季总名单"])).toBe(sourceTotalJson);
    expect(JSON.stringify(source.Sheets["所有人"])).toBe(sourceEveryoneJson);
    expect(source.Sheets["换季实际"].L1).toBeUndefined();
  });
});
