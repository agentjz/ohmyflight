const elements = {
  modeLabel: document.querySelector("#modeLabel"),
  statusMessage: document.querySelector("#statusMessage"),
  statusBadge: document.querySelector("#statusBadge"),
  themeToggle: document.querySelector("#themeToggle"),
  excelPanel: document.querySelector("#excelPanel"),
  pastePanel: document.querySelector("#pastePanel"),
  excelFile: document.querySelector("#excelFile"),
  pastedText: document.querySelector("#pastedText"),
  whitelistText: document.querySelector("#whitelistText"),
  commonReason: document.querySelector("#commonReason"),
  smartOptions: document.querySelector("#smartOptions"),
  conflictRecovery: document.querySelector("#conflictRecovery"),
  browserPath: document.querySelector("#browserPath"),
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
  resultDownload: document.querySelector("#resultDownload"),
  resultsCount: document.querySelector("#resultsCount"),
  resultsViewport: document.querySelector("#resultsViewport"),
  resultsEmpty: document.querySelector("#resultsEmpty"),
  resultsTable: document.querySelector("#resultsTable"),
  logList: document.querySelector("#logList"),
};

const phaseLabels = {
  idle: "空闲",
  starting: "启动中",
  waiting_login: "等待扫码",
  prepared: "页面已就绪",
  checking_data: "检查数据",
  data_checked: "数据已检查",
  running: "录入中",
  stopping: "终止中",
  completed: "已完成",
  failed: "失败",
  terminated: "已终止",
};

let currentMode = "original";
let pollingFailed = false;
let followLog = true;
let followResults = true;
let lastLogsSignature = "";
let lastResultsSignature = "";

document.querySelectorAll('input[name="inputMode"]').forEach((input) => {
  input.addEventListener("change", syncInputMode);
});
elements.prepareButton.addEventListener("click", prepareRun);
elements.dataCheckButton.addEventListener("click", checkData);
elements.runButton.addEventListener("click", runEntries);
elements.stopButton.addEventListener("click", stopRun);
elements.themeToggle.addEventListener("click", () => window.WatchdogTheme?.toggleTheme());
elements.logList.addEventListener("scroll", () => {
  followLog = isNearBottom(elements.logList);
});
elements.resultsViewport.addEventListener("scroll", () => {
  followResults = isNearBottom(elements.resultsViewport);
});

syncInputMode();
refreshStatus();
window.setInterval(refreshStatus, 800);

function selectedInputMode() {
  return document.querySelector('input[name="inputMode"]:checked')?.value || "excel";
}

function syncInputMode() {
  const excelMode = selectedInputMode() === "excel";
  elements.excelPanel.hidden = !excelMode;
  elements.pastePanel.hidden = excelMode;
}

async function prepareRun() {
  try {
    const inputMode = selectedInputMode();
    const payload = {
      inputMode,
      pastedText: "",
      excelName: "",
      excelBase64: "",
      whitelistText: elements.whitelistText.value.trim(),
      commonReason: elements.commonReason.value.trim(),
      conflictRecovery: currentMode === "smart" && elements.conflictRecovery.checked,
      browserPath: elements.browserPath.value.trim(),
    };
    if (inputMode === "excel") {
      const file = elements.excelFile.files[0];
      if (!file) throw new Error("请选择 Excel 文件");
      payload.excelName = file.name;
      payload.excelBase64 = await fileToBase64(file);
    } else {
      payload.pastedText = elements.pastedText.value.trim();
      if (!payload.pastedText) throw new Error("请粘贴锁班数据");
    }
    render(await request("/api/prepare", payload));
  } catch (error) {
    showLocalError(error);
  }
}

async function checkData() {
  try {
    render(await request("/api/check-data", {}));
  } catch (error) {
    showLocalError(error);
  }
}

async function runEntries() {
  try {
    render(await request("/api/run", {}));
  } catch (error) {
    showLocalError(error);
  }
}

async function stopRun() {
  try {
    render(await request("/api/stop", {}));
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

async function request(url, payload) {
  const response = await fetch(url, {
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
  currentMode = state.mode || currentMode;

  elements.modeLabel.textContent = state.modeLabel || "串行工作台";
  elements.smartOptions.hidden = currentMode !== "smart";
  elements.statusMessage.textContent = state.message || "";
  elements.statusBadge.textContent = phaseLabels[phase] || phase;
  elements.statusBadge.className = `status-badge is-${phase}`;
  elements.prepareButton.textContent = state.canReuseBrowser ? "重新准备下一批" : "进入录入页面";
  elements.prepareButton.disabled = !state.canPrepare;
  elements.dataCheckButton.disabled = !state.canCheckData;
  elements.runButton.disabled = !state.canRun;
  elements.stopButton.disabled = !state.canStop;

  document.querySelectorAll(
    'input[name="inputMode"], #excelFile, #pastedText, #whitelistText, #commonReason, #conflictRecovery, #browserPath',
  ).forEach((input) => {
    input.disabled = !state.canPrepare;
  });

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
  syncDownload(Boolean(state.downloads?.result));
  renderLogs(state.logs || []);
}

function renderCheck(check) {
  const value = check || { ok: false, message: "尚未检查" };
  const uncheckedMessages = new Set(["尚未检查", "尚未检查数据"]);
  const checked = Boolean(value.message && !uncheckedMessages.has(value.message));
  elements.dataCheckResult.classList.toggle("is-ok", Boolean(value.ok));
  elements.dataCheckResult.classList.toggle("is-error", checked && !value.ok);
  elements.dataCheckResult.querySelector("strong").textContent = value.message || "尚未检查";
}

function syncDownload(available) {
  elements.resultDownload.classList.toggle("disabled", !available);
  elements.resultDownload.setAttribute("aria-disabled", String(!available));
  elements.resultDownload.tabIndex = available ? 0 : -1;
  if (available) elements.resultDownload.href = "/api/download/result";
  else elements.resultDownload.removeAttribute("href");
}

function renderLogs(logs) {
  const signature = JSON.stringify(logs);
  if (signature === lastLogsSignature) return;
  lastLogsSignature = signature;
  const previousTop = elements.logList.scrollTop;
  if (!logs.length) {
    elements.logList.innerHTML = '<li class="is-muted">尚无运行记录</li>';
  } else {
    elements.logList.replaceChildren(...logs.map((entry) => {
      const item = document.createElement("li");
      item.className = `is-${entry.level || "info"}`;
      item.textContent = entry.message || "";
      return item;
    }));
  }
  elements.logList.scrollTop = followLog ? elements.logList.scrollHeight : previousTop;
}

function renderResults(results) {
  const signature = JSON.stringify(results);
  elements.resultsCount.textContent = `${results.length} 条`;
  if (signature === lastResultsSignature) return;
  lastResultsSignature = signature;
  const previousTop = elements.resultsViewport.scrollTop;
  if (!results.length) {
    elements.resultsEmpty.hidden = false;
    elements.resultsTable.hidden = true;
    elements.resultsTable.querySelector("thead").replaceChildren();
    elements.resultsTable.querySelector("tbody").replaceChildren();
    return;
  }

  const columns = [
    ["序号", "index"],
    ["片段", "segmentIndex"],
    ["员工号", "employeeId"],
    ["姓名", "name"],
    ["输入锁班类型", "inputType"],
    ["输入开始日期", "inputStartDate"],
    ["输入结束日期", "inputEndDate"],
    ["实际锁班类型", "actualType"],
    ["实际开始日期", "actualStartDate"],
    ["实际结束日期", "actualEndDate"],
    ["处理状态", "status"],
    ["门户结果", "portalStatus"],
    ["尝试次数", "attempt"],
    ["冲突回退", "recovery"],
    ["备注", "remark"],
  ];
  const visibleColumns = currentMode === "smart"
    ? columns
    : columns.filter(([, key]) => !["segmentIndex", "attempt", "recovery"].includes(key));
  const head = elements.resultsTable.querySelector("thead");
  const body = elements.resultsTable.querySelector("tbody");
  const headerRow = document.createElement("tr");
  visibleColumns.forEach(([label]) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  });
  head.replaceChildren(headerRow);
  body.replaceChildren(...results.map((result) => {
    const row = document.createElement("tr");
    visibleColumns.forEach(([, key]) => {
      const cell = document.createElement("td");
      cell.textContent = result[key] ?? "";
      if (key === "status") {
        cell.className = result.status === "成功" ? "is-success" : "is-failed";
      }
      row.append(cell);
    });
    return row;
  }));
  elements.resultsEmpty.hidden = true;
  elements.resultsTable.hidden = false;
  window.requestAnimationFrame(() => {
    elements.resultsViewport.scrollTop = followResults
      ? elements.resultsViewport.scrollHeight
      : previousTop;
  });
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
