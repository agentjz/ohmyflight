const elements = {
  modeLabel: document.querySelector("#modeLabel"),
  statusMessage: document.querySelector("#statusMessage"),
  statusBadge: document.querySelector("#statusBadge"),
  themeToggle: document.querySelector("#themeToggle"),
  credentials: document.querySelector("#credentials"),
  verifyButton: document.querySelector("#verifyButton"),
  sessionStatus: document.querySelector("#sessionStatus"),
  sessionVerified: document.querySelector("#sessionVerified"),
  sessionVerifiedAt: document.querySelector("#sessionVerifiedAt"),
  sessionTypeCount: document.querySelector("#sessionTypeCount"),
  sessionTypeVersion: document.querySelector("#sessionTypeVersion"),
  excelPanel: document.querySelector("#excelPanel"),
  pastePanel: document.querySelector("#pastePanel"),
  excelFile: document.querySelector("#excelFile"),
  pastedText: document.querySelector("#pastedText"),
  whitelistText: document.querySelector("#whitelistText"),
  commonReason: document.querySelector("#commonReason"),
  smartOptions: document.querySelector("#smartOptions"),
  conflictRecovery: document.querySelector("#conflictRecovery"),
  approveAfterSubmit: document.querySelector("#approveAfterSubmit"),
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
  resultDownload: document.querySelector("#resultDownload"),
  resultsCount: document.querySelector("#resultsCount"),
  resultsViewport: document.querySelector("#resultsViewport"),
  resultsEmpty: document.querySelector("#resultsEmpty"),
  resultsTable: document.querySelector("#resultsTable"),
  logList: document.querySelector("#logList"),
};

const phaseLabels = {
  waiting_credentials: "待验证",
  verifying_credentials: "验证中",
  credentials_ready: "凭据有效",
  checking_data: "检查数据",
  data_checked: "数据已检查",
  running: "录入中",
  stopping: "终止中",
  completed: "已完成",
  terminated: "已终止",
  failed: "失败",
};

let currentMode = "original";
let followLog = true;
let followResults = true;
let pollingFailed = false;
let lastLogsSignature = "";
let lastResultsSignature = "";

document.querySelectorAll('input[name="inputMode"]').forEach((input) => {
  input.addEventListener("change", syncInputMode);
});
elements.verifyButton.addEventListener("click", verifyCredentials);
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

async function verifyCredentials() {
  const credentials = elements.credentials.value.trim();
  if (!credentials) {
    showLocalError(new Error("请粘贴 cURL 或 Cookie Header"));
    return;
  }
  await withBusy(elements.verifyButton, "验证中", async () => {
    const state = await request("/api/session/verify", { credentials });
    elements.credentials.value = "";
    render(state);
  });
}

async function checkData() {
  await withBusy(elements.dataCheckButton, "检查中", async () => {
    render(await request("/api/check-data", await inputPayload()));
  });
}

async function runEntries() {
  await withBusy(elements.runButton, "启动中", async () => {
    render(await request("/api/run", await inputPayload()));
  });
}

async function stopRun() {
  await withBusy(elements.stopButton, "终止中", async () => {
    render(await request("/api/stop", {}));
  });
}

async function withBusy(button, busyText, action) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    await action();
  } catch (error) {
    showLocalError(error);
  } finally {
    button.textContent = originalText;
    await refreshStatus();
  }
}

async function inputPayload() {
  const inputMode = selectedInputMode();
  const payload = {
    inputMode,
    excelName: "",
    excelBase64: "",
    pastedText: "",
    whitelistText: elements.whitelistText.value.trim(),
    commonReason: elements.commonReason.value.trim(),
    conflictRecovery: currentMode === "smart" && elements.conflictRecovery.checked,
    approveAfterSubmit: elements.approveAfterSubmit.checked,
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
  return payload;
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = [];
  for (let index = 0; index < bytes.length; index += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
  }
  return window.btoa(parts.join(""));
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

function render(state) {
  const phase = state.phase || "waiting_credentials";
  const progress = state.progress || {};
  const session = state.session || {};
  const total = Number(progress.total || 0);
  const completed = Number(progress.completed || 0);
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  currentMode = state.mode || currentMode;

  elements.modeLabel.textContent = state.modeLabel || "串行工作台";
  elements.smartOptions.hidden = currentMode !== "smart";
  elements.statusMessage.textContent = state.message || "";
  elements.statusBadge.textContent = phaseLabels[phase] || phase;
  elements.statusBadge.className = `status-badge is-${phase}`;
  renderSession(session);

  elements.verifyButton.disabled = !state.canVerify;
  elements.dataCheckButton.disabled = !state.canCheckData;
  elements.runButton.disabled = !state.canRun;
  elements.stopButton.disabled = !state.canStop;
  const inputDisabled = Boolean(state.canStop);
  document.querySelectorAll(
    'input[name="inputMode"], #excelFile, #pastedText, #whitelistText, #commonReason, #conflictRecovery, #approveAfterSubmit',
  ).forEach((input) => {
    input.disabled = inputDisabled;
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
  renderLogs(state.logs || []);
  syncDownload(Boolean(state.downloads?.result));
}

function renderSession(session) {
  const verified = Boolean(session.verified);
  elements.sessionStatus.textContent = verified ? "当前 Session 可用" : "尚未验证";
  elements.sessionVerified.textContent = verified ? "有效" : "未验证";
  elements.sessionVerifiedAt.textContent = session.verifiedAt || "-";
  elements.sessionTypeCount.textContent = String(session.typeCount || 0);
  elements.sessionTypeVersion.textContent = session.typeVersion || "-";
}

function renderCheck(check) {
  const value = check || { checked: false, ok: false, validCount: 0, invalidCount: 0, errors: [] };
  const message = value.checked
    ? `有效 ${value.validCount || 0} 条，无效 ${value.invalidCount || 0} 条`
    : "尚未检查";
  elements.dataCheckResult.classList.toggle("is-ok", Boolean(value.checked && value.ok));
  elements.dataCheckResult.classList.toggle("is-error", Boolean(value.checked && !value.ok));
  elements.dataCheckResult.querySelector("strong").textContent = message;
  const errors = Array.isArray(value.errors) ? value.errors : [];
  elements.dataCheckErrors.hidden = !errors.length;
  elements.dataCheckErrors.replaceChildren(...errors.map((problem) => {
    const item = document.createElement("li");
    item.textContent = problem;
    return item;
  }));
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
    return;
  }
  const columns = [
    ["序号", "index"],
    ["片段", "segmentIndex"],
    ["员工号", "employeeId"],
    ["姓名", "name"],
    ["输入类型", "inputType"],
    ["实际类型", "actualType"],
    ["输入开始", "inputStartDate"],
    ["输入结束", "inputEndDate"],
    ["实际开始", "actualStartDateTime"],
    ["实际结束", "actualEndDateTime"],
    ["状态", "status"],
    ["门户结果", "portalStatus"],
    ["尝试", "attempt"],
    ["冲突回退", "recovery"],
    ["备注", "remark"],
    ["说明", "message"],
  ];
  const headRow = document.createElement("tr");
  for (const [label] of columns) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headRow.append(cell);
  }
  elements.resultsTable.querySelector("thead").replaceChildren(headRow);
  elements.resultsTable.querySelector("tbody").replaceChildren(...results.map((result) => {
    const row = document.createElement("tr");
    for (const [, key] of columns) {
      const cell = document.createElement("td");
      cell.textContent = result[key] ?? "";
      if (key === "status") {
        cell.className = result.status === "成功" ? "is-success" : "is-failed";
      }
      row.append(cell);
    }
    return row;
  }));
  elements.resultsEmpty.hidden = true;
  elements.resultsTable.hidden = false;
  window.requestAnimationFrame(() => {
    elements.resultsViewport.scrollTop = followResults ? elements.resultsViewport.scrollHeight : previousTop;
  });
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
      item.textContent = `${entry.time || ""} ${entry.message || ""}`.trim();
      return item;
    }));
  }
  elements.logList.scrollTop = followLog ? elements.logList.scrollHeight : previousTop;
}

function syncDownload(available) {
  elements.resultDownload.classList.toggle("disabled", !available);
  elements.resultDownload.setAttribute("aria-disabled", String(!available));
  elements.resultDownload.tabIndex = available ? 0 : -1;
  if (available) elements.resultDownload.href = "/api/download/result";
  else elements.resultDownload.removeAttribute("href");
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
