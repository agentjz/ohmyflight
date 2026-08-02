import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { createAuditKingExport } from "../../../src/tool/app/audit-king/export";

describe("audit-king evidence export", () => {
    const exportApi = createAuditKingExport(XLSX);

  it("builds an evidence workbook with one row per evidence entry", () => {
    const workbook = exportApi.buildEvidenceWorkbook([
      {
        id: "evidence-group-1",
        title: "1.1 进入条件",
        items: [
          {
            content: "机长转机型训练进入条件",
            note: "可作为 1.1 候选依据"
          },
          {
            content: "进入训练前应满足资格要求",
            note: ""
          }
        ]
      }
    ]);

    expect(workbook.SheetNames).toEqual(["审计篮子"]);
    const sheet = workbook.Sheets["审计篮子"];
    expect(sheet.A1?.v).toBe("条款名称");
    expect(sheet.B1?.v).toBe("依据序号");
    expect(sheet.C1?.v).toBe("依据内容");
    expect(sheet.D1?.v).toBe("备注");
    expect(sheet.A2?.v).toBe("1.1 进入条件");
    expect(sheet.B2?.v).toBe(1);
    expect(sheet.C2?.v).toBe("机长转机型训练进入条件");
    expect(sheet.D2?.v).toBe("可作为 1.1 候选依据");
    expect(sheet.A3?.v).toBe("1.1 进入条件");
    expect(sheet.B3?.v).toBe(2);
    expect(sheet.C3?.v).toBe("进入训练前应满足资格要求");
  });

  it("keeps empty audit basket groups when exporting", () => {
    const workbook = exportApi.buildEvidenceWorkbook([
      {
        id: "evidence-group-1",
        title: "1.1 进入条件",
        items: []
      }
    ]);

    const sheet = workbook.Sheets["审计篮子"];
    expect(sheet.A2?.v).toBe("1.1 进入条件");
    expect(sheet.B2?.v).toBe(0);
    expect(sheet.C2?.v).toBe("");
  });

});
