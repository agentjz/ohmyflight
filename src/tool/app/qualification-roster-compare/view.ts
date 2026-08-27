import type { QualificationComparisonResult, QualificationDetail, QualificationStatus } from "./models";

export interface QualificationViewState {
  result: QualificationComparisonResult | null;
  selectedCode: string;
  filter: "diff" | "all" | QualificationStatus;
  personnelFileName: string;
  portalFileName: string;
  statusMessage: string;
  statusKind: "" | "success" | "danger" | "info";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`页面缺少元素 ${id}`);
  return node as T;
}

export function renderQualificationView(state: QualificationViewState): void {
  element<HTMLButtonElement>("compareButton").disabled = !(state.personnelFileName && state.portalFileName);
  element<HTMLButtonElement>("exportButton").disabled = !state.result;
  element<HTMLElement>("personnelFileName").textContent = state.personnelFileName || "尚未选择";
  element<HTMLElement>("portalFileName").textContent = state.portalFileName || "尚未选择";
  const status = element<HTMLElement>("statusLine");
  status.textContent = state.statusMessage;
  status.className = `status-line${state.statusKind ? ` status-${state.statusKind}` : ""}`;
  const resultSection = element<HTMLElement>("resultSection");
  resultSection.hidden = !state.result;
  if (!state.result) return;
  const result = state.result;
  const totals = result.totals;
  element<HTMLElement>("summaryGrid").innerHTML = [
    ["资质项", totals.qualificationCount], ["双方一致", totals.matchedRelations], ["差异关系", totals.differenceRelations], ["涉及人员", totals.affectedPeople], ["数据问题", totals.issueCount]
  ].map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join("");
  const codeSelect = element<HTMLSelectElement>("qualificationSelect");
  codeSelect.innerHTML = result.summaries.map((summary) => `<option value="${summary.qualificationCode}">${summary.qualificationCode}（差异 ${summary.differenceCount}）</option>`).join("");
  codeSelect.value = state.selectedCode;
  const selected = result.summaries.find((summary) => summary.qualificationCode === state.selectedCode) || result.summaries[0];
  if (selected) {
    element<HTMLElement>("selectedSummary").textContent = `${selected.qualificationCode}：人员信息 ${selected.personnelCount}，门户 ${selected.portalCount}，一致 ${selected.matchedCount}，差异 ${selected.differenceCount}`;
  }
  const filtered = result.details.filter((detail) => detail.qualificationCode === state.selectedCode && (state.filter === "all" || state.filter === "diff" ? state.filter === "all" || detail.status !== "双方一致" : detail.status === state.filter));
  element<HTMLElement>("detailCount").textContent = String(filtered.length);
  element<HTMLElement>("detailBody").innerHTML = filtered.length ? filtered.map(renderDetailRow).join("") : `<tr><td colspan="8" class="empty-cell">没有符合条件的人员</td></tr>`;
  element<HTMLElement>("issueCount").textContent = String(result.issues.length);
  element<HTMLElement>("issueBody").innerHTML = result.issues.length ? result.issues.map((issue) => `<tr><td>${issue.source === "personnel" ? "人员信息" : "飞行门户"}</td><td>${escapeHtml(issue.kind)}</td><td>${escapeHtml(issue.message)}</td><td>${escapeHtml(issue.sheetName)} 第${issue.rowNumber || ""}行</td></tr>`).join("") : `<tr><td colspan="4" class="empty-cell">没有数据问题</td></tr>`;
}

function renderDetailRow(detail: QualificationDetail): string {
  const statusClass = detail.status === "双方一致" ? "status-match" : detail.status === "仅飞行门户" ? "status-portal" : "status-personnel";
  return `<tr><td><span class="status-tag ${statusClass}">${detail.status}</span></td><td>${escapeHtml(detail.employeeId)}</td><td>${escapeHtml(detail.personnelName || "-")}</td><td>${escapeHtml(detail.portalName || "-")}</td><td>${escapeHtml(detail.personnelRole || "-")}</td><td>${escapeHtml(detail.personnelSource || "-")}</td><td>${escapeHtml(detail.portalSource || "-")}</td><td>${detail.nameMismatch ? "姓名不一致" : ""}</td></tr>`;
}
