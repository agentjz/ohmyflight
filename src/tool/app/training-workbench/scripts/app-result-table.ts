import { TrainingToolResultStatus } from "./result-status";
import type {
  TrainingAssessmentRow,
  TrainingTableCell,
  TrainingToolAppRuntime,
  TrainingValidityDetailRow,
  TrainingValiditySkippedRow
} from "./models";
import { TrainingToolUtils } from "./utils";

export function installTrainingAppResultTable(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const ResultStatus = TrainingToolResultStatus;
  const elements = runtime.elements;

  function getTableVariant(columns: string[]): string {
    const signature = columns.join("|");
    if (signature === "项目|项目 sheet|项目行号|员工号|姓名|旧有效期|新有效期|判断|处理结果|说明") {
      return "result-table-validity";
    }
    if (signature === "项目|姓名|状态|原因") {
      return "result-table-skipped";
    }
    return "";
  }

  function getTableVariantNormalized(columns: string[]): string {
    const signature = (columns || []).join("|");
    if (signature === "状态|项目|姓名|当前有效期|已排日期|说明") {
      return "result-table-workbench";
    }
    if (signature === "状态|项目|员工号|姓名|当前有效期|到期月份|最晚完成日期|已排日期|来源|说明") {
      return "result-table-workbench";
    }
    if (signature === "项目|项目 sheet|项目行号|员工号|姓名|旧有效期|新有效期|判断|处理结果|说明") {
      return "result-table-validity";
    }
    if (signature === "项目|姓名|状态|原因") {
      return "result-table-skipped";
    }
    return getTableVariant(columns || []);
  }

  function renderTable(headElement: HTMLTableSectionElement, bodyElement: HTMLTableSectionElement, columns: string[], rows: TrainingTableCell[][], emptyText: string): void {
    const tableElement = headElement.closest("table");
    if (tableElement) {
      tableElement.classList.remove(
        "result-table-validity",
        "result-table-workbench",
        "result-table-skipped"
      );
      const variantClassName = getTableVariantNormalized(columns || []);
      if (variantClassName) {
        tableElement.classList.add(variantClassName);
      }
    }

    if (!columns || !columns.length) {
      headElement.innerHTML = "";
      bodyElement.innerHTML = `<tr><td class="empty-block" colspan="1">${Utils.escapeHtml(emptyText)}</td></tr>`;
      return;
    }

    headElement.innerHTML = `<tr>${columns.map((column) => `<th>${Utils.escapeHtml(column)}</th>`).join("")}</tr>`;

    if (!rows.length) {
      bodyElement.innerHTML = `<tr><td class="empty-block" colspan="${columns.length}">${Utils.escapeHtml(emptyText)}</td></tr>`;
      return;
    }

    bodyElement.innerHTML = rows.map((row) => `
      <tr>${row.map((cell) => `<td>${renderTableCell(cell)}</td>`).join("")}</tr>
    `).join("");
  }

  function renderTableCell(cell: TrainingTableCell): string {
    const structuredCell = cell as { type?: unknown; tone?: unknown; text?: unknown } | null;
    if (structuredCell && typeof structuredCell === "object" && structuredCell.type === "badge") {
      return `<span class="badge ${Utils.escapeHtml(structuredCell.tone || "info")}">${Utils.escapeHtml(structuredCell.text)}</span>`;
    }
    return Utils.escapeHtml(cell);
  }

  function renderSkippedSummary(count: number): void {
    elements.skippedSummaryLabel.textContent = count
      ? `跳过 / 提示：${count} 条（默认折叠）`
      : "跳过 / 提示（默认折叠）";
    elements.skippedDetails.open = false;
  }

  function toValidityDetailRows(rows: TrainingValidityDetailRow[]): TrainingTableCell[][] {
    return rows.map((row) => [
      row.projectName,
      row.sheetName,
      row.rowNumber,
      row.employeeId,
      row.name,
      row.oldExpiry,
      row.newExpiry,
      ResultStatus.makeBadgeCell(row.judgement, ResultStatus.badgeToneForUpdateJudgement(row.judgement)),
      ResultStatus.makeBadgeCell(row.result, ResultStatus.badgeToneForUpdateResult(row.result)),
      row.reason
    ]);
  }

  function toValiditySkippedRows(rows: TrainingValiditySkippedRow[]): TrainingTableCell[][] {
    return rows.map((row) => [
      row.projectName,
      row.name,
      ResultStatus.makeBadgeCell(row.status, ResultStatus.badgeToneForSkippedStatus(row.status)),
      row.reason
    ]);
  }

  function toWorkbenchDetailRows(rows: TrainingAssessmentRow[]): TrainingTableCell[][] {
    return rows.map((row) => [
      ResultStatus.makeBadgeCell(row.status, ResultStatus.badgeToneForWorkbenchStatus(row.status)),
      row.projectName,
      row.name,
      row.expiry,
      row.scheduledDate,
      row.reason
    ]);
  }

  runtime.resultTable = {
    renderTable,
    renderSkippedSummary,
    toValidityDetailRows,
    toValiditySkippedRows,
    toWorkbenchDetailRows
  };
}
