import { TrainingToolUtils } from "./utils";
import { TrainingXlsx as XLSX } from "./browser-vendors";
import type { TrainingToolWorkbook, TrainingWorkbenchResult, TrainingWorkbenchSelection } from "./models";

const Utils = TrainingToolUtils;

  function buildRows(result: TrainingWorkbenchResult): unknown[][] {
    return [
      result.detailColumns,
      ...result.detailRows.map((row) => [
        row.status,
        row.projectName,
        row.employeeId,
        row.name,
        row.expiry,
        row.dueMonth,
        row.dueDate,
        row.scheduledDate,
        row.source,
        row.reason
      ])
    ];
  }

  function buildSelectionRows(selection: TrainingWorkbenchSelection): unknown[][] {
    const rows = selection && selection.rows ? selection.rows : [];
    return [
      ["项目", "状态", "姓名", "员工号", "有效期截止日期", "最晚完成日期", "已排日期", "说明", "来源"],
      ...rows.map((row) => [
        row.projectName,
        row.status,
        row.name,
        row.employeeId,
        row.expiry,
        row.dueDate,
        row.scheduledDate,
        row.reason,
        row.source
      ])
    ];
  }

  function appendSheet(workbook: TrainingToolWorkbook, sheetName: string, rows: unknown[][]): void {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = Utils.computeSheetWidths(rows);
    Utils.centerAlignSheet(sheet);
    XLSX.utils.book_append_sheet(workbook, sheet, Utils.sanitizeSheetName(sheetName).slice(0, 31));
  }

  function buildWorkbook(result: TrainingWorkbenchResult): TrainingToolWorkbook {
    const workbook = XLSX.utils.book_new();
    appendSheet(workbook, "当前筛选总览", buildRows(result));
    return workbook;
  }

  function buildSelectionWorkbook(selection: TrainingWorkbenchSelection): TrainingToolWorkbook {
    const workbook = XLSX.utils.book_new();
    appendSheet(workbook, "当前人员明细", buildSelectionRows(selection));
    return workbook;
  }
  export const TrainingToolWorkbenchExport = {
    buildWorkbook,
    buildSelectionWorkbook
  };
