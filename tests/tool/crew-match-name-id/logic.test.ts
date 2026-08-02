import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";

import { createCrewMatchNameIdExporter } from "../../../src/tool/app/crew-match-name-id/export";
import * as logic from "../../../src/tool/app/crew-match-name-id/logic";

describe("crew-match-name-id logic", () => {
  it("extracts tech level tokens from known tech info formats", () => {
    expect(logic.extractTechLevel("777:飞行教员C")).toBe("C");
    expect(logic.extractTechLevel("777:飞行教员A")).toBe("A");
    expect(logic.extractTechLevel("777:C类机长")).toBe("C");
    expect(logic.extractTechLevel("777:E类副驾驶")).toBe("E");
    expect(logic.extractTechLevel("777:A2类副驾驶")).toBe("A2");
    expect(logic.extractTechLevel("777:A1类副驾驶")).toBe("A1");
  });

  it("parses roster rows by header names and fills department and tech fields", () => {
    const rows = [
      ["姓名", "分部", "技术信息", "员工号"],
      ["张三", "一分部", "777:飞行教员C", "123456"],
      ["李四", "二分部", "777:A2类副驾驶", 654321],
      ["无工号", "三分部", "777:C类机长", ""],
      ["", "四分部", "777:E类副驾驶", "888888"]
    ];

    const parsed = logic.parseRosterRows(rows);
    expect(parsed).toEqual([
      { id: "123456", name: "张三", department: "一分部", techInfo: "777:飞行教员C", techLevel: "C" },
      { id: "654321", name: "李四", department: "二分部", techInfo: "777:A2类副驾驶", techLevel: "A2" }
    ]);
  });

  it("rejects roster rows without department header", () => {
    const rows = [
      ["姓名", "技术信息", "员工号"],
      ["张三", "777:飞行教员C", "123456"]
    ];

    expect(() => logic.parseRosterRows(rows)).toThrow("花名册表头必须包含：员工号、姓名、分部");
  });

  it("builds export rows in display order with custom columns mapped by employee id", () => {
    const rows = logic.buildExportRows([
      { id: "123456", name: "张三", department: "一分部", techInfo: "777:飞行教员C", techLevel: "C" },
      { id: "654321", name: "李四", department: "二分部", techInfo: "777:A2类副驾驶", techLevel: "A2" }
    ], [
      {
        header: "申请",
        valuesByEmployeeId: {
          "123456": "EEUO",
          "654321": "EAMA"
        }
      },
      {
        header: "备注",
        valuesByEmployeeId: {
          "654321": "待核对"
        }
      }
    ]);

    expect(rows).toEqual([
      ["员工号", "姓名", "分部", "技术信息", "申请", "备注"],
      ["123456", "张三", "一分部", "777:飞行教员C", "EEUO", ""],
      ["654321", "李四", "二分部", "777:A2类副驾驶", "EAMA", "待核对"]
    ]);
  });

  it("includes tech level only when export options request it", () => {
    const rows = logic.buildExportRows([
      { id: "123456", name: "张三", department: "一分部", techInfo: "777:飞行教员C", techLevel: "C" }
    ], [], { includeTechLevel: true });

    expect(rows).toEqual([
      ["员工号", "姓名", "分部", "技术信息", "技术等级"],
      ["123456", "张三", "一分部", "777:飞行教员C", "C"]
    ]);
  });

  it("normalizes an independent image title and falls back when it is empty", () => {
    expect(logic.resolveImageTitle("")).toBe("人员名单");
    expect(logic.resolveImageTitle(" 资质 ")).toBe("资质");
    expect(logic.resolveImageTitle("申请")).toBe("申请");
  });

  it("builds a styled workbook with custom columns", () => {
    const exporter = createCrewMatchNameIdExporter(XLSX, undefined);
    const workbook = exporter.buildExcelWorkbook([
      { id: "123456", name: "张三", department: "一分部", techInfo: "777:飞行教员C", techLevel: "C" }
    ], [{ header: "申请", valuesByEmployeeId: { "123456": "EEUO" } }]);
    const sheet = workbook.Sheets["匹配结果"];

    expect(workbook.SheetNames).toEqual(["匹配结果"]);
    expect(sheet.A1.v).toBe("员工号");
    expect(sheet.E1.v).toBe("申请");
    expect(sheet.A2.v).toBe("123456");
    expect(sheet.E2.v).toBe("EEUO");
    expect(sheet.A1.s.alignment).toMatchObject({ horizontal: "center", vertical: "center", wrapText: true });
    expect(sheet.A1.s.fill.fgColor.rgb).toBe("E8EFEA");
    expect(sheet.A2.s.border.top.style).toBe("thin");
    expect(sheet["!cols"]).toHaveLength(5);
    expect(sheet["!rows"]?.[0]?.hpt).toBe(28);
  });
});
