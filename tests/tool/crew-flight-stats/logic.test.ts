import { describe, expect, it } from "vitest";

import * as logic from "../../../src/tool/app/crew-flight-stats/logic";

describe("crew flight stats logic", () => {
  it("parses roster names from the second column after the header row", () => {
    expect(logic.parseRosterRows([
      ["员工号", "姓名"],
      ["001", "张三"],
      ["002", " 李四 "],
      ["003", ""]
    ])).toEqual(["张三", "李四"]);
  });

  it("matches names by roster order but extracts names by text order", () => {
    const rosterNames = ["张三", "李四", "王五"];

    expect(logic.matchNamesInRosterOrder("李四 / 张三", rosterNames)).toEqual(["张三", "李四"]);
    expect(logic.extractNamesInTextOrder("李四 / 张三", rosterNames)).toEqual(["李四", "张三"]);
  });

  it("counts route flights across selected sheets and reports unmatched cells", () => {
    const result = logic.analyzeScheduleRows([
      {
        sheetName: "4月",
        rows: [
          ["航线", "1日", "2日"],
          ["广州-上海", "张三 李四", "未知人员"],
          ["北京-深圳", "李四", ""]
        ]
      },
      {
        sheetName: "5月",
        rows: [
          ["航线", "1日"],
          ["广州-上海", "王五 张三"]
        ]
      }
    ], ["张三", "李四", "王五"]);

    expect(result.routes).toEqual(["广州-上海", "北京-深圳"]);
    expect(result.statsResult).toEqual({
      张三: { "广州-上海": 2 },
      李四: { "广州-上海": 1, "北京-深圳": 1 },
      王五: { "广州-上海": 1 }
    });
    expect(result.unmatchedCells).toEqual(["[4月] 行2 广州-上海: 未知人员"]);
    expect(logic.buildCrewFlightExportRows(result.statsResult, result.routes, ["张三", "李四", "王五"])).toEqual([
      ["加分项", "广州-上海", "北京-深圳"],
      ["张三", 2, ""],
      ["李四", 1, 1],
      ["王五", 1, ""]
    ]);
  });
});
