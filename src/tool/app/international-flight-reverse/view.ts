import type { AnalysisResult } from "./models";

export interface ReverseViewState {
  flightFileName: string;
  employeeFileName: string;
  flightStatus: string;
  employeeStatus: string;
  statusKind: "info" | "success" | "danger";
  statusMessage: string;
  result: AnalysisResult | null;
}

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`页面缺少元素 ${id}`);
  return node as T;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function renderSummary(result: AnalysisResult): void {
  const totals = result.totals;
  element<HTMLElement>("summaryGrid").innerHTML = [
    ["员工/地区任务", totals.taskCount],
    ["已找到最近航班", totals.matchedTasks],
    ["未找到或无配置", totals.noMatchTasks],
    ["近期航班总数", totals.recentFlightCount],
    ["数据问题", totals.issueCount]
  ].map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderTaskRows(result: AnalysisResult): void {
  const body = element<HTMLElement>("summaryBody");
  body.innerHTML = result.tasks.length ? result.tasks.map((task) => {
    const matched = [...new Set(task.recentFlights.flatMap((flight) => flight.matchedAirports))].join(",");
    const statusClass = task.status === "已找到" ? "status-success" : task.status === "未找到" ? "status-warning" : "status-danger";
    return `<tr><td>${escapeHtml(task.employeeId)}</td><td>${escapeHtml(task.name)}</td><td>${escapeHtml(task.region)}</td><td>${escapeHtml(task.reverseDate)}</td><td><span class="status-tag ${statusClass}">${task.status}</span></td><td>${escapeHtml(task.latestDate || "-")}</td><td>${escapeHtml(task.suggestedExpiryDate || "-")}</td><td>${task.recentFlights.length}</td><td>${escapeHtml(matched || "-")}</td><td>${escapeHtml(task.message)}</td></tr>`;
  }).join("") : `<tr><td colspan="10" class="empty-cell">没有可展示的任务</td></tr>`;
}

function renderFlightRows(result: AnalysisResult): void {
  const rows = result.tasks.flatMap((task) => task.airportRecentFlights.flatMap((group) => group.flights.map((flight) => ({ task, airport: group.airport, flight }))));
  element<HTMLElement>("detailBody").innerHTML = rows.length ? rows.map(({ task, airport, flight }) => `<tr><td>${escapeHtml(task.employeeId)}</td><td>${escapeHtml(task.name)}</td><td>${escapeHtml(task.region)}</td><td>${escapeHtml(airport)}</td><td>${flight.rank}</td><td>${escapeHtml(flight.date)}</td><td>${escapeHtml(flight.flightNumber || "-")}</td><td>${escapeHtml(flight.departure)}</td><td>${escapeHtml(flight.arrival)}</td><td>${escapeHtml(flight.stage || "-")}</td><td>${escapeHtml(flight.matchedAirports.join(","))}</td><td>${escapeHtml(`${flight.sourceSheet} 第${flight.sourceRow}行`)}</td></tr>`).join("") : `<tr><td colspan="12" class="empty-cell">没有符合条件的近期航班</td></tr>`;
}

function renderIssues(result: AnalysisResult): void {
  const body = element<HTMLElement>("issueBody");
  body.innerHTML = result.issues.length ? result.issues.map((issue) => `<tr><td>${escapeHtml(issue.source)}</td><td>${escapeHtml(issue.kind)}</td><td>${escapeHtml(issue.message)}</td><td>${escapeHtml(issue.sheetName || "")}</td><td>${issue.rowNumber || ""}</td><td>${escapeHtml(issue.employeeId || "")}</td><td>${escapeHtml(issue.region || "")}</td></tr>`).join("") : `<tr><td colspan="7" class="empty-cell">没有数据问题</td></tr>`;
}

export function renderReverseView(state: ReverseViewState): void {
  element<HTMLElement>("flightFileName").textContent = state.flightFileName || "尚未选择";
  element<HTMLElement>("employeeFileName").textContent = state.employeeFileName || "尚未选择";
  element<HTMLElement>("flightStatus").textContent = state.flightStatus;
  element<HTMLElement>("employeeStatus").textContent = state.employeeStatus;
  const status = element<HTMLElement>("statusLine");
  status.textContent = state.result ? "分析完成。" : state.statusMessage;
  status.className = `status-line status-${state.result ? "success" : state.statusKind}`;
  element<HTMLButtonElement>("analyzeButton").disabled = !state.flightFileName || !state.employeeFileName;
  element<HTMLButtonElement>("exportButton").disabled = !state.result;
  const resultSections = ["summarySection", "detailSection", "issueSection"];
  resultSections.forEach((id) => { element<HTMLElement>(id).hidden = !state.result; });
  if (!state.result) return;
  renderSummary(state.result);
  renderTaskRows(state.result);
  renderFlightRows(state.result);
  renderIssues(state.result);
}
