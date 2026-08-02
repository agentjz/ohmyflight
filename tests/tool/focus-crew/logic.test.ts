import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { createFocusCrewLogic } from "../../../src/tool/app/focus-crew/logic";
import type { FocusSheetInfo } from "../../../src/tool/app/focus-crew/models";

const logic = createFocusCrewLogic(XLSX);

function makeWorkbook(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([sheetName, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  });
  return workbook;
}

describe("focus crew logic", () => {
  it("detects configured focus sheets and reads columns from the second row", () => {
    const workbook = makeWorkbook({
      "重点关注": [
        ["说明"],
        ["员工号", "姓名"],
        ["001", "张三"]
      ],
      "无关Sheet": [
        ["姓名"],
        ["李四"]
      ]
    });

    const sheets = logic.parseFocusWorkbook(workbook);

    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("重点关注");
    expect(sheets[0].category).toBe("重点关注");
    expect(sheets[0].columns).toEqual(["员工号", "姓名"]);
  });

  it("collects names by selected sheet columns and highlights schedule workbook by priority", () => {
    const focusSheets = [
      {
        name: "一般关注",
        category: "一般关注",
        columns: ["员工号", "姓名"],
        data: [["说明"], ["员工号", "姓名"], ["001", "张三"], ["002", "李四"]]
      },
      {
        name: "重点关注",
        category: "重点关注",
        columns: ["姓名"],
        data: [["说明"], ["姓名"], ["张三"]]
      }
    ] satisfies FocusSheetInfo[];
    const collected = logic.collectFocusData(focusSheets, { 0: 1, 1: 0 });
    const scheduleWorkbook = makeWorkbook({
      "审班": [
        ["员工号", "姓名"],
        ["001", "张三"],
        ["002", "李四"],
        ["003", "王五"]
      ]
    });

    const result = logic.buildHighlightedWorkbook(scheduleWorkbook, 1, collected.focusData);
    const sheet = result.workbook.Sheets["审班"];

    expect(collected.focusNames.sort()).toEqual(["张三", "李四"]);
    expect(sheet.B2.v).toBe("张三[重点][一般]");
    expect(sheet.B2.s.fill.fgColor.rgb).toBe("F6DADF");
    expect(sheet.B3.v).toBe("李四[一般]");
    expect(sheet.B4.v).toBe("王五");
    expect(result.matchedCategories).toEqual({ "重点关注": 1, "一般关注": 2 });
    expect(result.sheetMatchCounts).toEqual({ "审班": 2 });
  });
});
