import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { buildInternationalFlightTemplateWorkbook } from "../../../src/tool/app/international-flight-reverse/template";

describe("international flight reverse template", () => {
  it("provides employee, airport mapping and instructions sheets", () => {
    const workbook = buildInternationalFlightTemplateWorkbook(XLSX);
    expect(workbook.SheetNames).toEqual(["员工信息", "机场三字代码", "填写说明"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["员工信息"], { header: 1 })[0]).toEqual(["员工号", "姓名", "地区", "反推日期"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["机场三字代码"], { header: 1 })[0]).toEqual(["地区", "机场", "三字代码"]);
    expect(workbook.Sheets["机场三字代码"].A2.v).toBe("北美");
    expect(workbook.Sheets["机场三字代码"].C2.v).toBe("LAX");
  });
});
