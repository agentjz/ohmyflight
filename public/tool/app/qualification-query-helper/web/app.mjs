const elements = {
  statusMessage: document.querySelector("#statusMessage"),
  statusBadge: document.querySelector("#statusBadge"),
  themeToggle: document.querySelector("#themeToggle"),
  sessionStatus: document.querySelector("#sessionStatus"),
  credentials: document.querySelector("#credentials"),
  excelPanel: document.querySelector("#excelPanel"),
  pastePanel: document.querySelector("#pastePanel"),
  excelFile: document.querySelector("#excelFile"),
  pastedText: document.querySelector("#pastedText"),
  prepareButton: document.querySelector("#prepareButton"),
  dataCheckButton: document.querySelector("#dataCheckButton"),
  runButton: document.querySelector("#runButton"),
  stopButton: document.querySelector("#stopButton"),
  dataCheckResult: document.querySelector("#dataCheckResult"),
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
  idle: "空闲",
  starting: "进入页面中",
  prepared: "页面已就绪",
  checking_data: "检查数据",
  data_checked: "数据已检查",
  running: "查询中",
  completed: "已完成",
  stopping: "停止中",
  terminated: "已停止",
  failed: "失败",
};

let followLog = true;
let followResults = true;
let lastLogsSignature = "";
let lastResultsSignature = "";
let pollingFailed = false;

document.querySelectorAll('input[name="inputMode"]').forEach((input) => input.addEventListener("change", syncInputMode));
elements.prepareButton.addEventListener("click", prepare);
elements.dataCheckButton.addEventListener("click", () => postAndRender("/api/check-data", {}));
elements.runButton.addEventListener("click", () => postAndRender("/api/run", {}));
elements.stopButton.addEventListener("click", () => postAndRender("/api/stop", {}));
elements.themeToggle.addEventListener("click", () => window.WatchdogTheme?.toggleTheme());
elements.logList.addEventListener("scroll", () => { followLog = isNearBottom(elements.logList); });
elements.resultsViewport.addEventListener("scroll", () => { followResults = isNearBottom(elements.resultsViewport); });

syncInputMode();
refreshStatus();
window.setInterval(refreshStatus, 800);

function currentInputMode() {
  return document.querySelector('input[name="inputMode"]:checked')?.value || "excel";
}

function syncInputMode() {
  const excelMode = currentInputMode() === "excel";
  elements.excelPanel.hidden = !excelMode;
  elements.pastePanel.hidden = excelMode;
}

async function prepare() {
  try {
    const inputMode = currentInputMode();
    const payload = {
      credentials: elements.credentials.value.trim(),
      inputMode,
      excelName: "",
      excelBase64: "",
      pastedText: "",
    };
    if (inputMode === "excel") {
      const file = elements.excelFile.files[0];
      if (!file) throw new Error("请选择 Excel 文件");
      payload.excelName = file.name;
      payload.excelBase64 = await fileToBase64(file);
    } else {
      payload.pastedText = elements.pastedText.value.trim();
      if (!payload.pastedText) throw new Error("请粘贴查询人员");
    }
    render(await request("/api/prepare", payload));
  } catch (error) {
    showLocalError(error);
  }
}

async function postAndRender(path, payload) {
  try {
    render(await request(path, payload));
  } catch (error) {
    showLocalError(error);
  }
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error(`状态请求失败：${response.status}`);
    render(await response.json());
    pollingFailed = false;
  } catch (error) {
    if (!pollingFailed) showLocalError(error);
    pollingFailed = true;
  }
}

async function request(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `请求失败：${response.status}`);
  return data;
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = [];
  for (let index = 0; index < bytes.length; index += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
  }
  return window.btoa(parts.join(""));
}

function render(state) {
  const phase = state.phase || "idle";
  const progress = state.progress || {};
  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  elements.statusMessage.textContent = state.message || "";
  elements.statusBadge.textContent = phaseLabels[phase] || phase;
  elements.statusBadge.className = `status-badge is-${phase}`;
  elements.sessionStatus.textContent = state.session?.loaded ? "已导入本次浏览器" : "未导入";
  elements.prepareButton.textContent = state.canReuseBrowser ? "准备下一批" : "导入登录态并进入查询页面";
  elements.prepareButton.disabled = !state.canPrepare;
  elements.dataCheckButton.disabled = !state.canCheckData;
  elements.runButton.disabled = !state.canRun;
  elements.stopButton.disabled = !state.canStop;
  elements.credentials.disabled = Boolean(state.session?.loaded);
  document.querySelectorAll('input[name="inputMode"]').forEach((input) => { input.disabled = !state.canPrepare; });

  elements.progressBar.style.width = `${percent}%`;
  elements.progress.setAttribute("aria-valuenow", String(percent));
  elements.progressText.textContent = `${completed} / ${total}`;
  elements.totalCount.textContent = String(total);
  elements.completedCount.textContent = String(completed);
  elements.successCount.textContent = String(progress.success || 0);
  elements.failedCount.textContent = String(progress.failed || 0);
  elements.currentRecord.textContent = progress.current || "-";

  renderCheck(state.checks?.data);
  renderResults(state.results || []);
  renderLogs(state.logs || []);
  syncDownload(elements.excelDownload, Boolean(state.downloads?.excel), "excel");
  syncDownload(elements.reportDownload, Boolean(state.downloads?.report), "report");
}

function renderCheck(check) {
  const value = check || { ok: false, message: "尚未检查数据" };
  const checked = value.message && !["尚未检查", "尚未检查数据"].includes(value.message);
  elements.dataCheckResult.classList.toggle("is-ok", Boolean(value.ok));
  elements.dataCheckResult.classList.toggle("is-error", Boolean(checked && !value.ok));
  elements.dataCheckResult.querySelector("strong").textContent = value.message || "尚未检查";
}

function renderResults(results) {
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
  if (followResults) window.requestAnimationFrame(() => { elements.resultsViewport.scrollTop = elements.resultsViewport.scrollHeight; });
}

function renderLogs(logs) {
  const signature = JSON.stringify(logs);
  if (signature === lastLogsSignature) return;
  lastLogsSignature = signature;
  if (!logs.length) {
    elements.logList.innerHTML = '<li class="is-muted">尚无运行记录</li>';
    return;
  }
  elements.logList.replaceChildren(...logs.map((entry) => {
    const item = document.createElement("li");
    item.className = `is-${entry.level || "info"}`;
    item.textContent = `${entry.time ? `[${entry.time}] ` : ""}${entry.message || ""}`;
    return item;
  }));
  if (followLog) elements.logList.scrollTop = elements.logList.scrollHeight;
}

function syncDownload(link, available, kind) {
  link.classList.toggle("disabled", !available);
  link.setAttribute("aria-disabled", String(!available));
  if (available) link.href = `/api/download/${kind}`;
  else link.removeAttribute("href");
}

function isNearBottom(element) {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= 24;
}

function showLocalError(error) {
  const item = document.createElement("li");
  item.className = "is-error";
  item.textContent = error instanceof Error ? error.message : String(error);
  if (elements.logList.querySelector(".is-muted")) elements.logList.replaceChildren();
  elements.logList.append(item);
  if (followLog) elements.logList.scrollTop = elements.logList.scrollHeight;
}

