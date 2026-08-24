import { TrainingToolUtils } from "./utils";
import { TrainingXlsx as XLSX } from "./browser-vendors";
import type { TrainingToolWorkbook } from "./models";

const Utils = TrainingToolUtils;

  const MISSING_COLUMNS = ["姓名", "员工号", "分部", "技术信息"];
  const DUPLICATE_COLUMNS = ["姓名", "员工号", "次数", "日期", "行号", "教员"];

  interface CrmMissingExportPerson {
    name?: string;
    employeeId?: string;
    department?: string;
    techInfo?: string;
    operation?: string;
    remark?: string;
  }

  interface CrmMissingExportResult {
    year: number;
    missingPeople: CrmMissingExportPerson[];
  }

  interface CrmDuplicateExportRow {
    name?: string;
    employeeId?: string;
    count?: number;
    dates?: string[];
    rowNumbers?: number[];
    instructors?: string[];
  }

  interface CrmDuplicateExportResult {
    year: number;
    duplicateRows: CrmDuplicateExportRow[];
  }

  function toMissingExportRows(missingPeople: CrmMissingExportPerson[]): unknown[][] {
    return (missingPeople || []).map((person) => [
      person.name || "",
      person.employeeId || "",
      person.department || "",
      person.techInfo || ""
    ]);
  }

  function buildMissingWorkbook(result: CrmMissingExportResult): TrainingToolWorkbook {
    const workbook = XLSX.utils.book_new();
    const rows = [
      [`CRM年度未参加人员：${result.year}`],
      [`导出时间：${new Date().toLocaleString()}`],
      [],
      MISSING_COLUMNS,
      ...toMissingExportRows(result.missingPeople)
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 26 }
    ];
    Utils.centerAlignSheet(sheet);
    XLSX.utils.book_append_sheet(workbook, sheet, "CRM未参加人员");
    return workbook;
  }

  function toDuplicateExportRows(duplicateRows: CrmDuplicateExportRow[]): unknown[][] {
    return (duplicateRows || []).map((row) => [
      row.name || "",
      row.employeeId || "",
      row.count || 0,
      (row.dates || []).join("、"),
      (row.rowNumbers || []).map((value) => `第${value}行`).join("、"),
      (row.instructors || []).join("、")
    ]);
  }

  function buildDuplicateWorkbook(result: CrmDuplicateExportResult): TrainingToolWorkbook {
    const workbook = XLSX.utils.book_new();
    const rows = [
      [`CRM年度重复人员：${result.year}`],
      [`导出时间：${new Date().toLocaleString()}`],
      [],
      DUPLICATE_COLUMNS,
      ...toDuplicateExportRows(result.duplicateRows)
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 28 },
      { wch: 24 },
      { wch: 24 }
    ];
    Utils.centerAlignSheet(sheet);
    XLSX.utils.book_append_sheet(workbook, sheet, "CRM重复人员");
    return workbook;
  }

  export const TrainingToolCrmExport = {
    MISSING_COLUMNS,
    DUPLICATE_COLUMNS,
    toMissingExportRows,
    buildMissingWorkbook,
    toDuplicateExportRows,
    buildDuplicateWorkbook
  };
