const elements = {
  statusMessage: document.querySelector("#statusMessage"),
  statusBadge: document.querySelector("#statusBadge"),
  themeToggle: document.querySelector("#themeToggle"),
  credentials: document.querySelector("#credentials"),
  verifyButton: document.querySelector("#verifyButton"),
  sessionStatus: document.querySelector("#sessionStatus"),
  sessionVerified: document.querySelector("#sessionVerified"),
  sessionVerifiedAt: document.querySelector("#sessionVerifiedAt"),
  queryMode: document.querySelector("#queryMode"),
  excelPanel: document.querySelector("#excelPanel"),
  pastePanel: document.querySelector("#pastePanel"),
  excelFile: document.querySelector("#excelFile"),
  pastedText: document.querySelector("#pastedText"),
  dataCheckButton: document.querySelector("#dataCheckButton"),
  runButton: document.querySelector("#runButton"),
  stopButton: document.querySelector("#stopButton"),
  dataCheckResult: document.querySelector("#dataCheckResult"),
  dataCheckErrors: document.querySelector("#dataCheckErrors"),
  progress: document.querySelector(".progress"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  totalCount: document.querySelector("#totalCount"),
  completedCount: document.querySelector("#completedCount"),
  successCount: document.querySelector("#successCount"),
  failedCount: document.querySelector("#failedCount"),
  currentRecord: document.querySelector("#currentRecord"),
  excelDownload: document.querySelector("#excelDownload"),
  reportDownload: document.querySelector("#reportDownload"),
  resultsCount: document.querySelector("#resultsCount"),
  resultsViewport: document.querySelector("#resultsViewport"),
  resultsEmpty: document.querySelector("#resultsEmpty"),
  resultsTable: document.querySelector("#resultsTable"),
  logList: document.querySelector("#logList"),
};

const phaseLabels = {
  waiting_credentials: "待验证",
  verifying_credentials: "验证中",
  credentials_ready: "Cookie 有效",
  checking_data: "检查数据",
  data_checked: "数据已检查",
  running: "查询中",
  stopping: "停止中",
  completed: "已完成",
  terminated: "已停止",
  failed: "失败",
};

let followLog = true;
let followResults = true;
let lastLogsSignature = "";
let lastResultsSignature = "";
let pollingFailed = false;

function isNearBottom(element) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 20;
}

function currentInputMode() {
  return document.querySelector('input[name="inputMode"]:checked')?.value || "excel";
}

function syncInputMode() {
  const excel = currentInputMode() === "excel";
  elements.excelPanel.hidden = !excel;
  elements.pastePanel.hidden = excel;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取 Excel 文件失败"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.readAsDataURL(file);
  });
}

async function buildPayload() {
  const inputMode = currentInputMode();
  const payload = {
    inputMode,
    excelName: "",
    excelBase64: "",
    pastedText: elements.pastedText.value,
  };
  if (inputMode === "excel") {
    const file = elements.excelFile.files[0];
    if (!file) throw new Error("请选择 Excel 文件");
    payload.excelName = file.name;
    payload.excelBase64 = await readFileAsBase64(file);
  } else if (!payload.pastedText.trim()) {
    throw new Error("请粘贴查询人员");
  }
  return payload;
}

async function postJson(path, payload = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败：HTTP ${response.status}`);
  return data;
}

async function verifyCredentials() {
  const credentials = elements.credentials.value.trim();
  if (!credentials) throw new Error("请粘贴登录 Cookie");
  elements.verifyButton.disabled = true;
  try {
    const state = await postJson("/api/session/verify", { credentials });
    elements.credentials.value = "";
    renderState(state);
  } finally {
    elements.verifyButton.disabled = false;
  }
}

async function checkData() {
  renderState(await postJson("/api/check-data", await buildPayload()));
}

async function runQuery() {
  renderState(await postJson("/api/run", await buildPayload()));
}

async function stopQuery() {
  renderState(await postJson("/api/stop"));
}

function showActionError(error) {
  elements.statusMessage.textContent = error.message || String(error);
  elements.statusBadge.textContent = "操作失败";
  elements.statusBadge.className = "status-badge is-failed";
}

function renderCheck(check = {}) {
  const strong = elements.dataCheckResult.querySelector("strong");
  if (!check.checked) {
    elements.dataCheckResult.className = "health-check";
    strong.textContent = "尚未检查";
  } else {
    elements.dataCheckResult.className = `health-check ${check.ok ? "is-ok" : "is-error"}`;
    strong.textContent = `有效 ${check.validCount || 0}，无效 ${check.invalidCount || 0}`;
  }
  const errors = check.errors || [];
  elements.dataCheckErrors.hidden = errors.length === 0;
  elements.dataCheckErrors.replaceChildren(...errors.map((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    return item;
  }));
}

function renderLogs(logs = []) {
  const signature = JSON.stringify(logs);
  if (signature === lastLogsSignature) return;
  lastLogsSignature = signature;
  if (!logs.length) {
    const item = document.createElement("li");
    item.className = "is-muted";
    item.textContent = "尚无运行记录";
    elements.logList.replaceChildren(item);
    return;
  }
  elements.logList.replaceChildren(...logs.map((log) => {
    const item = document.createElement("li");
    item.className = `is-${log.level || "info"}`;
    item.textContent = `${log.time ? `[${log.time}] ` : ""}${log.message || ""}`;
    return item;
  }));
  if (followLog) elements.logList.scrollTop = elements.logList.scrollHeight;
}

function renderResults(results = []) {
  const signature = JSON.stringify(results);
  elements.resultsCount.textContent = `${results.length} 条`;
  if (signature === lastResultsSignature) return;
  lastResultsSignature = signature;
  elements.resultsEmpty.hidden = results.length > 0;
  elements.resultsTable.hidden = results.length === 0;
  const body = elements.resultsTable.querySelector("tbody");
  body.replaceChildren(...results.map((result) => {
    const row = document.createElement("tr");
    [
      result.employeeId,
      result.inputName,
      result.pageName,
      result.technicalCount,
      result.operationCount,
      result.status,
      result.error,
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      if (index === 5) cell.className = result.status === "成功" ? "is-success" : "is-failed";
      row.append(cell);
    });
    return row;
  }));
  if (followResults) elements.resultsViewport.scrollTop = elements.resultsViewport.scrollHeight;
}

function setDownload(link, enabled, kind) {
  link.classList.toggle("disabled", !enabled);
  link.setAttribute("aria-disabled", enabled ? "false" : "true");
  if (enabled) link.href = `/api/download/${kind}`;
  else link.removeAttribute("href");
}

function renderState(state) {
  const phase = state.phase || "waiting_credentials";
  const session = state.session || {};
  const progress = state.progress || {};
  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  elements.statusMessage.textContent = state.message || "";
  elements.statusBadge.textContent = phaseLabels[phase] || phase;
  elements.statusBadge.className = `status-badge is-${phase}`;
  elements.sessionStatus.textContent = session.verified ? "已验证" : "尚未验证";
  elements.sessionVerified.textContent = session.verified ? "有效" : "未验证";
  elements.sessionVerifiedAt.textContent = session.verifiedAt || "-";
  elements.queryMode.textContent = state.queryMode || "严格串行";
  elements.verifyButton.disabled = !state.canVerify;
  elements.credentials.disabled = !state.canVerify;
  elements.dataCheckButton.disabled = !state.canCheckData;
  elements.runButton.disabled = !state.canRun;
  elements.stopButton.disabled = !state.canStop;

  elements.progressBar.style.width = `${percent}%`;
  elements.progress.setAttribute("aria-valuenow", String(percent));
  elements.progressText.textContent = `${completed} / ${total}`;
  elements.totalCount.textContent = String(total);
  elements.completedCount.textContent = String(completed);
  elements.successCount.textContent = String(progress.success || 0);
  elements.failedCount.textContent = String(progress.failed || 0);
  elements.currentRecord.textContent = progress.current || "-";

  renderCheck(state.checks?.data || {});
  renderLogs(state.logs || []);
  renderResults(state.results || []);
  setDownload(elements.excelDownload, Boolean(state.downloads?.excel), "excel");
  setDownload(elements.reportDownload, Boolean(state.downloads?.report), "report");
}

async function pollStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderState(await response.json());
    pollingFailed = false;
  } catch (error) {
    if (!pollingFailed) showActionError(new Error(`状态连接失败：${error.message || error}`));
    pollingFailed = true;
  }
}

document.querySelectorAll('input[name="inputMode"]').forEach((input) => {
  input.addEventListener("change", syncInputMode);
});
elements.verifyButton.addEventListener("click", () => verifyCredentials().catch(showActionError));
elements.dataCheckButton.addEventListener("click", () => checkData().catch(showActionError));
elements.runButton.addEventListener("click", () => runQuery().catch(showActionError));
elements.stopButton.addEventListener("click", () => stopQuery().catch(showActionError));
elements.themeToggle.addEventListener("click", () => window.WatchdogTheme?.toggleTheme());
elements.logList.addEventListener("scroll", () => { followLog = isNearBottom(elements.logList); });
elements.resultsViewport.addEventListener("scroll", () => { followResults = isNearBottom(elements.resultsViewport); });

syncInputMode();
pollStatus();
window.setInterval(pollStatus, 800);
