const elements = {
  statusMessage: document.querySelector("#statusMessage"),
  statusBadge: document.querySelector("#statusBadge"),
  themeToggle: document.querySelector("#themeToggle"),
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
  resultsCount: document.querySelector("#resultsCount"),
  resultsViewport: document.querySelector("#resultsViewport"),
  resultsEmpty: document.querySelector("#resultsEmpty"),
  resultsTable: document.querySelector("#resultsTable"),
  originalDownload: document.querySelector("#originalDownload"),
  strippedDownload: document.querySelector("#strippedDownload"),
  logList: document.querySelector("#logList"),
};

const phaseLabels = {
  idle: "空闲",
  starting: "启动中",
  waiting_login: "等待扫码",
  prepared: "页面已就绪",
  checking_data: "检查数据",
  data_checked: "数据已检查",
  running: "运行中",
  stopping: "终止中",
  completed: "已完成",
  failed: "失败",
  terminated: "已终止",
};

let pollingFailed = false;
let followLog = true;
let followResults = true;
let lastLogsSignature = "";
let lastResultsSignature = "";

document.querySelectorAll('input[name="inputMode"]').forEach((input) => {
  input.addEventListener("change", syncInputMode);
});
document.querySelectorAll('input[name="scope"]').forEach((input) => {
  input.addEventListener("change", syncScopeSelection);
});
elements.prepareButton.addEventListener("click", prepareRun);
elements.dataCheckButton.addEventListener("click", checkData);
elements.runButton.addEventListener("click", runQuery);
elements.stopButton.addEventListener("click", stopRun);
elements.themeToggle.addEventListener("click", () => window.WatchdogTheme?.toggleTheme());
elements.logList.addEventListener("scroll", () => {
  followLog = isNearBottom(elements.logList);
});
elements.resultsViewport.addEventListener("scroll", () => {
  followResults = isNearBottom(elements.resultsViewport);
});

syncInputMode();
syncScopeSelection();
refreshStatus();
window.setInterval(refreshStatus, 800);

function selectedMode() {
  return document.querySelector('input[name="inputMode"]:checked')?.value || "excel";
}

function selectedScope() {
  const values = [...document.querySelectorAll('input[name="scope"]:checked')].map((input) => input.value);
  return values.includes("all") ? "all" : values;
}

function syncScopeSelection(event) {
  const inputs = [...document.querySelectorAll('input[name="scope"]')];
  const allInput = document.querySelector("#scopeAll");
  const individualInputs = inputs.filter((input) => input !== allInput);
  if (event?.target === allInput && allInput.checked) {
    individualInputs.forEach((input) => { input.checked = false; });
  } else if (event?.target !== allInput && event?.target?.checked) {
    allInput.checked = false;
  }
  if (!inputs.some((input) => input.checked)) allInput.checked = true;
  inputs.forEach((input) => {
    input.closest(".scope-option")?.classList.toggle("is-selected", input.checked);
  });
}

function syncInputMode() {
  const excelMode = selectedMode() === "excel";
  elements.excelPanel.hidden = !excelMode;
  elements.pastePanel.hidden = excelMode;
}

async function prepareRun() {
  try {
    const inputMode = selectedMode();
    const payload = { inputMode, scope: selectedScope(), pastedText: "", excelName: "", excelBase64: "" };
    if (inputMode === "excel") {
      const file = elements.excelFile.files[0];
      if (!file) throw new Error("请选择 Excel 文件");
      payload.excelName = file.name;
      payload.excelBase64 = await fileToBase64(file);
    } else {
      payload.pastedText = elements.pastedText.value.trim();
      if (!payload.pastedText) throw new Error("请粘贴查询数据");
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

async function runQuery() {
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

  elements.statusMessage.textContent = state.message || "";
  elements.statusBadge.textContent = phaseLabels[phase] || phase;
  elements.statusBadge.className = `status-badge is-${phase}`;
  elements.prepareButton.textContent = state.canReuseBrowser ? "重新准备下一批" : "进入查询页面";
  elements.prepareButton.disabled = !state.canPrepare;
  elements.dataCheckButton.disabled = !state.canCheckData;
  elements.runButton.disabled = !state.canRun;
  elements.stopButton.disabled = !state.canStop;
  document.querySelectorAll('input[name="inputMode"], input[name="scope"]').forEach((input) => {
    input.disabled = !state.canPrepare;
    input.closest(".scope-option")?.classList.toggle("is-disabled", !state.canPrepare);
  });
  elements.progressBar.style.width = `${percent}%`;
  elements.progress.setAttribute("aria-valuenow", String(percent));
  elements.progressText.textContent = `${completed} / ${total}`;
  elements.totalCount.textContent = String(total);
  elements.completedCount.textContent = String(completed);
  elements.successCount.textContent = String(progress.success || 0);
  elements.failedCount.textContent = String(progress.failed || 0);
  elements.currentRecord.textContent = progress.current || "-";
  renderCheck(elements.dataCheckResult, state.checks?.data);
  renderResults(state.results || []);
  syncDownload(elements.originalDownload, Boolean(state.downloads?.original));
  syncDownload(elements.strippedDownload, Boolean(state.downloads?.stripped));
  renderLogs(state.logs || []);
}

function renderCheck(element, check) {
  const value = check || { ok: false, message: "尚未检查" };
  const uncheckedMessages = new Set(["尚未检查", "尚未检查数据"]);
  const checked = Boolean(value.message && !uncheckedMessages.has(value.message));
  element.classList.toggle("is-ok", Boolean(value.ok));
  element.classList.toggle("is-error", checked && !value.ok);
  element.querySelector("strong").textContent = value.message || "尚未检查";
}

function syncDownload(link, available) {
  link.classList.toggle("disabled", !available);
  link.setAttribute("aria-disabled", String(!available));
  link.tabIndex = available ? 0 : -1;
  if (available) {
    link.href = `/api/download/${link.id === "originalDownload" ? "original" : "stripped"}`;
  } else {
    link.removeAttribute("href");
  }
}

function renderLogs(logs) {
  const signature = JSON.stringify(logs);
  if (signature === lastLogsSignature) return;
  lastLogsSignature = signature;
  if (!logs.length) {
    elements.logList.innerHTML = '<li class="is-muted">尚无运行记录</li>';
    if (followLog) elements.logList.scrollTop = elements.logList.scrollHeight;
    return;
  }
  elements.logList.replaceChildren(...logs.map((entry) => {
    const item = document.createElement("li");
    item.className = `is-${entry.level || "info"}`;
    item.textContent = entry.message || "";
    return item;
  }));
  if (followLog) elements.logList.scrollTop = elements.logList.scrollHeight;
}

function renderResults(results) {
  const signature = JSON.stringify(results);
  elements.resultsCount.textContent = `${results.length} 条`;
  if (signature === lastResultsSignature) return;
  lastResultsSignature = signature;
  if (!results.length) {
    elements.resultsEmpty.hidden = false;
    elements.resultsTable.hidden = true;
    elements.resultsTable.querySelector("thead").replaceChildren();
    elements.resultsTable.querySelector("tbody").replaceChildren();
    return;
  }

  const baseHeaders = ["员工号", "姓名", "开始日期", "结束日期", "查询状态"];
  const dynamicHeaders = [];
  results.forEach((result) => {
    (result.headers || []).forEach((header) => {
      if (!baseHeaders.includes(header) && !dynamicHeaders.includes(header)) dynamicHeaders.push(header);
    });
  });
  if (results.some((result) => result.error) && !dynamicHeaders.includes("错误说明")) {
    dynamicHeaders.push("错误说明");
  }
  const headers = baseHeaders.concat(dynamicHeaders);
  const head = elements.resultsTable.querySelector("thead");
  const body = elements.resultsTable.querySelector("tbody");
  head.replaceChildren();
  body.replaceChildren();
  const headerRow = document.createElement("tr");
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headerRow.append(cell);
  });
  head.append(headerRow);

  results.forEach((result) => {
    const row = document.createElement("tr");
    headers.forEach((header) => {
      const cell = document.createElement("td");
      let value = "";
      if (header === "员工号") value = result.employeeId || "";
      else if (header === "姓名") value = result.name || "";
      else if (header === "开始日期") value = result.startDate || "";
      else if (header === "结束日期") value = result.endDate || "";
      else if (header === "查询状态") value = result.status || "";
      else if (header === "错误说明") value = result.error || "";
      else value = result.values?.[header] || "";
      cell.textContent = value;
      if (header === "查询状态") cell.className = result.status === "成功" ? "is-success" : "is-failed";
      row.append(cell);
    });
    body.append(row);
  });
  elements.resultsEmpty.hidden = true;
  elements.resultsTable.hidden = false;
  if (followResults) {
    window.requestAnimationFrame(() => {
      elements.resultsViewport.scrollTop = elements.resultsViewport.scrollHeight;
    });
  }
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
