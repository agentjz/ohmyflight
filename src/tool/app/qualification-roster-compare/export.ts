import type * as XLSX from "xlsx-js-style";
import type { QualificationComparisonResult } from "./models";

type WorkbookApi = typeof XLSX;

export function buildQualificationExportWorkbook(XLSXApi: WorkbookApi, result: QualificationComparisonResult): XLSX.WorkBook {
  const workbook = XLSXApi.utils.book_new();
  const summaryRows = [
    ["资质", "人员信息人数", "门户人数", "双方一致", "仅飞行门户", "仅人员信息", "差异人数"],
    ...result.summaries.map((summary) => [summary.qualificationCode, summary.personnelCount, summary.portalCount, summary.matchedCount, summary.portalOnlyCount, summary.personnelOnlyCount, summary.differenceCount])
  ];
  const detailRows = [
    ["资质", "差异类型", "员工号", "人员信息姓名", "门户姓名", "人员信息角色", "人员信息来源", "门户来源", "姓名提示"],
    ...result.details.filter((detail) => detail.status !== "双方一致").map((detail) => [detail.qualificationCode, detail.status, detail.employeeId, detail.personnelName, detail.portalName, detail.personnelRole, detail.personnelSource, detail.portalSource, detail.nameMismatch ? "姓名不一致" : ""])
  ];
  const issueRows = [["来源", "问题类型", "说明", "工作表", "行号", "员工号", "资质"], ...result.issues.map((item) => [item.source === "personnel" ? "人员信息" : "飞行门户", item.kind, item.message, item.sheetName, item.rowNumber || "", item.employeeId || "", item.qualificationCode || ""])];
  for (const [name, rows, width] of [["资质汇总", summaryRows, 7], ["差异明细", detailRows, 9], ["数据问题", issueRows, 7]] as const) {
    const sheet = XLSXApi.utils.aoa_to_sheet(rows);
    sheet["!autofilter"] = { ref: `A1:${String.fromCharCode(64 + width)}${Math.max(1, rows.length)}` };
    sheet["!freeze"] = { ySplit: 1 } as never;
    sheet["!cols"] = Array.from({ length: width }, (_, index) => ({ wch: index < 2 ? 16 : 18 }));
    XLSXApi.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}
