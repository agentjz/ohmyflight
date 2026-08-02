import { describe, expect, it, vi } from "vitest";

import { TrainingToolCrmExport as CrmExport } from "../../../src/tool/app/training-workbench/scripts/crm-export";
import * as XLSX from "xlsx-js-style";

describe("crm export", () => {
  it("exports only CRM missing people columns", () => {
    vi.stubGlobal("XLSX", XLSX);
    const workbook = CrmExport.buildMissingWorkbook({
      year: 2026,
      missingPeople: [
        {
          name: "张三",
          employeeId: "1001",
          department: "一分部",
          techInfo: "777:机长",
          remark: "不应导出"
        }
      ]
    });

    const sheet = workbook.Sheets["CRM未参加人员"];
    expect(sheet.A4.v).toBe("姓名");
    expect(sheet.B4.v).toBe("员工号");
    expect(sheet.C4.v).toBe("分部");
    expect(sheet.D4.v).toBe("技术信息");
    expect(sheet.A5.v).toBe("张三");
    expect(sheet.B5.v).toBe("1001");
    expect(sheet.C5.v).toBe("一分部");
    expect(sheet.D5.v).toBe("777:机长");
    expect(sheet.E5).toBeUndefined();
  });
});
