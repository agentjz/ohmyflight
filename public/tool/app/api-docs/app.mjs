import {
    buildCurlExample,
    buildPythonExample,
    escapeHtml,
    renderCookieDocument,
    renderEndpointDocument
} from "./catalog-view.mjs";
import {
    collectParameters as collectParameterValues,
    editableParameters,
    renderParameterForm as renderParameterFields,
    updateParameterAvailability
} from "./parameter-form.mjs";
import {
    bindResponseTabs,
    clearResponse,
    renderResponse,
    renderResponseError
} from "./response-view.mjs";
import { buildApiDocsMarkdown, downloadMarkdown } from "./markdown-export.mjs";
import { createToast, renderEndpointNavigation, renderSessionStatus } from "./ui-shell.mjs";

const state = {
    modules: [],
    endpointRecords: new Map(),
    selectedView: "cookie",
    selectedId: "",
    search: "",
    backendAvailable: false,
    sessionReady: false,
    sessionStatus: null,
    savedCredentials: "",
    options: new Map(),
    codeLanguage: "curl"
};

const elements = {
    endpointList: document.getElementById("systemEndpointList"),
    cookieNav: document.getElementById("cookieNav"),
    systemDisclosure: document.getElementById("systemDisclosure"),
    document: document.getElementById("endpointDocument"),
    search: document.getElementById("endpointSearch"),
    exportMarkdownButton: document.getElementById("exportMarkdownButton"),
    themeToggle: document.getElementById("themeToggle"),
    sessionPanel: document.getElementById("sessionPanel"),
    endpointConsole: document.getElementById("endpointConsole"),
    credentialInput: document.getElementById("credentialInput"),
    loadSessionButton: document.getElementById("loadSessionButton"),
    clearSessionButton: document.getElementById("clearSessionButton"),
    credentialStatus: document.getElementById("credentialStatus"),
    credentialStatusText: document.getElementById("credentialStatusText"),
    credentialStatusDetail: document.getElementById("credentialStatusDetail"),
    savedCredentialPanel: document.getElementById("savedCredentialPanel"),
    savedCredentialText: document.getElementById("savedCredentialText"),
    copyCredentialButton: document.getElementById("copyCredentialButton"),
    sessionState: document.getElementById("sessionState"),
    sessionDetail: document.getElementById("sessionDetail"),
    manageSessionButton: document.getElementById("manageSessionButton"),
    parameterForm: document.getElementById("parameterForm"),
    sendRequestButton: document.getElementById("sendRequestButton"),
    responseSection: document.getElementById("responseSection"),
    responseMeta: document.getElementById("responseMeta"),
    responseTable: document.getElementById("responseTable"),
    responseJson: document.getElementById("responseJson"),
    responseRaw: document.getElementById("responseRaw"),
    responseHeaders: document.getElementById("responseHeaders"),
    toast: document.getElementById("toast")
};
const showToast = createToast(elements.toast);

async function fetchJson(path, options) {
    const response = await fetch(path, { cache: "no-store", ...options });
    let payload;
    try {
        payload = await response.json();
    } catch (_error) {
        throw new Error(`请求返回 HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(payload.error || `请求返回 HTTP ${response.status}`);
    return payload;
}

async function loadCatalog() {
    const index = await fetchJson("./catalog/index.json");
    state.modules = await Promise.all(index.modules.map(async (item) => {
        const source = String(item.source || "").replace(/^\.\//, "");
        const module = await fetchJson(`./catalog/${source}`);
        return { ...module, catalogSource: `./catalog/${source}` };
    }));
    state.endpointRecords.clear();
    state.modules.forEach((module) => {
        (module.endpoints || []).forEach((endpoint) => {
            const fullId = `${module.id}.${endpoint.id}`;
            state.endpointRecords.set(fullId, { module, endpoint, fullId });
        });
    });
}

function selectedRecord() {
    return state.endpointRecords.get(state.selectedId) || null;
}

function renderNavigation() {
    if (!(elements.endpointList instanceof HTMLElement)) return;
    renderEndpointNavigation(
        elements.endpointList,
        [...state.endpointRecords.values()],
        state.selectedId,
        state.search,
    );
    elements.cookieNav?.classList.toggle("is-active", state.selectedView === "cookie");
}

function renderParameterForm() {
    const record = selectedRecord();
    if (!record || !(elements.parameterForm instanceof HTMLElement)) return;
    renderParameterFields(elements.parameterForm, record, state.options, handleParameterChange);
    updateRuntimeControls();
}

function collectParameters() {
    return collectParameterValues(elements.parameterForm);
}

function handleParameterChange() {
    updateRuntimeControls();
    renderCodeExample();
}

function exportMarkdown() {
    if (!state.modules.length) return;
    downloadMarkdown(buildApiDocsMarkdown(state.modules));
    showToast("API 文档 Markdown 已导出");
}

function renderCodeExample() {
    const record = selectedRecord();
    const target = document.getElementById("codeExample");
    if (!record || !(target instanceof HTMLElement)) return;
    target.textContent = state.codeLanguage === "python"
        ? buildPythonExample(record, collectParameters())
        : buildCurlExample(record, collectParameters());
}

function renderDocument() {
    if (!(elements.document instanceof HTMLElement)) return;
    elements.document.innerHTML = state.selectedView === "cookie"
        ? renderCookieDocument(state.modules)
        : renderEndpointDocument(selectedRecord(), state.codeLanguage, collectParameters());
}

function applySessionStatus(status, notifyExpiry = false) {
    const wasReady = state.sessionReady;
    state.sessionStatus = status || null;
    state.sessionReady = status?.ready === true;
    if (wasReady && !state.sessionReady) {
        state.options.clear();
        if (notifyExpiry) showToast("飞行门户 Cookie 已失效", true);
    }
    if (!state.sessionReady) setSavedCredentials("");
    updateRuntimeControls();
}

function setSavedCredentials(credentials) {
    state.savedCredentials = String(credentials || "");
    if (elements.savedCredentialText) elements.savedCredentialText.value = state.savedCredentials;
    if (elements.savedCredentialPanel) elements.savedCredentialPanel.hidden = !state.savedCredentials;
}

function updateRuntimeControls() {
    if (elements.credentialInput) elements.credentialInput.disabled = !state.backendAvailable;
    if (elements.loadSessionButton) elements.loadSessionButton.disabled = !state.backendAvailable;
    if (elements.clearSessionButton) elements.clearSessionButton.disabled = !state.backendAvailable || !state.sessionReady;
    renderSessionStatus(elements, state.sessionStatus);
    updateParameterAvailability(elements.parameterForm, state.sessionReady);
    if (elements.sendRequestButton) elements.sendRequestButton.disabled = !state.sessionReady;
}

function showSelectedView() {
    const cookieSelected = state.selectedView === "cookie";
    if (elements.sessionPanel) elements.sessionPanel.hidden = !cookieSelected;
    if (elements.endpointConsole) elements.endpointConsole.hidden = cookieSelected;
}

function selectCookie() {
    state.selectedView = "cookie";
    state.selectedId = "";
    renderNavigation();
    showSelectedView();
    renderDocument();
}

async function selectEndpoint(endpointId) {
    if (!state.endpointRecords.has(endpointId)) return;
    state.selectedView = "endpoint";
    state.selectedId = endpointId;
    renderNavigation();
    showSelectedView();
    renderParameterForm();
    renderDocument();
    clearResponse(elements);
    const record = selectedRecord();
    elements.sendRequestButton?.classList.toggle("is-write", record?.endpoint.risk === "write");
    await ensureDynamicOptions();
}

async function ensureDynamicOptions() {
    const sources = [...new Set(editableParameters(selectedRecord()).map((item) => item.optionSource).filter(Boolean))];
    if (!state.sessionReady || !sources.length) return;
    try {
        for (const source of sources) {
            if (state.options.has(source)) continue;
            const payload = await fetchJson(`/api/options/${encodeURIComponent(source)}`);
            state.options.set(source, payload.options || []);
        }
        renderParameterForm();
        renderDocument();
    } catch (error) {
        showToast(error.message || String(error), true);
    }
}

async function detectBackend() {
    try {
        const health = await fetchJson("/api/health");
        state.backendAvailable = health.available === true;
        if (!state.backendAvailable) throw new Error("本地执行器不可用");
        const cleared = await fetchJson("/api/session", { method: "DELETE" });
        setSavedCredentials("");
        applySessionStatus(cleared);
        showToast("已连接本地执行器");
    } catch (_error) {
        state.backendAvailable = false;
        applySessionStatus(null);
    }
    updateRuntimeControls();
    await ensureDynamicOptions();
    if (state.backendAvailable) window.setInterval(refreshSessionStatus, 3000);
}

async function refreshSessionStatus() {
    try {
        const health = await fetchJson("/api/health");
        state.backendAvailable = health.available === true;
        applySessionStatus(health.session, true);
    } catch (_error) {
        state.backendAvailable = false;
        applySessionStatus(null);
    }
}

async function loadSession() {
    if (!state.backendAvailable || !(elements.credentialInput instanceof HTMLTextAreaElement)) return;
    try {
        elements.loadSessionButton.disabled = true;
        const payload = await fetchJson("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credentials: elements.credentialInput.value })
        });
        const { credentials, ...sessionStatus } = payload;
        applySessionStatus(sessionStatus);
        setSavedCredentials(credentials);
        state.options.clear();
        elements.credentialInput.value = "";
        updateRuntimeControls();
        showToast("飞行门户 Cookie 已验证");
        await ensureDynamicOptions();
    } catch (error) {
        applySessionStatus(null);
        showToast(error.message || String(error), true);
    } finally {
        updateRuntimeControls();
    }
}

async function clearSession() {
    if (!state.backendAvailable) return;
    try {
        const payload = await fetchJson("/api/session", { method: "DELETE" });
        applySessionStatus(payload);
        setSavedCredentials("");
        state.options.clear();
        showToast("飞行门户 Cookie 已清除");
    } catch (error) {
        showToast(error.message || String(error), true);
    }
}

async function sendRequest() {
    const record = selectedRecord();
    if (!record || !state.sessionReady || !elements.parameterForm?.reportValidity()) return;
    try {
        elements.sendRequestButton.disabled = true;
        elements.responseMeta.textContent = "请求中";
        const payload = await fetchJson("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpointId: record.fullId, parameters: collectParameters() })
        });
        renderResponse(elements, payload);
        showToast(`请求完成：HTTP ${payload.status}`);
    } catch (error) {
        const message = error.message || String(error);
        renderResponseError(elements, message);
        if (message.includes("Cookie")) applySessionStatus({ ready: false, keepAlive: { state: "expired" } });
        showToast(message, true);
    } finally {
        updateRuntimeControls();
    }
}

function bindEvents() {
    elements.cookieNav?.addEventListener("click", selectCookie);
    elements.endpointList?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-endpoint-id]");
        if (button) void selectEndpoint(button.dataset.endpointId || "");
    });
    elements.search?.addEventListener("input", () => {
        state.search = elements.search.value.trim().toLowerCase();
        renderNavigation();
    });
    elements.exportMarkdownButton?.addEventListener("click", exportMarkdown);
    elements.themeToggle?.addEventListener("click", () => window.WatchdogTheme?.toggleTheme());
    elements.loadSessionButton?.addEventListener("click", loadSession);
    elements.clearSessionButton?.addEventListener("click", clearSession);
    elements.copyCredentialButton?.addEventListener("click", async () => {
        const copied = state.savedCredentials
            ? await navigator.clipboard.writeText(state.savedCredentials).then(() => true).catch(() => false)
            : false;
        showToast(copied ? "Cookie 已复制" : "复制失败，请手动选择", !copied);
    });
    elements.manageSessionButton?.addEventListener("click", selectCookie);
    elements.sendRequestButton?.addEventListener("click", sendRequest);
    elements.document?.addEventListener("click", async (event) => {
        const languageButton = event.target.closest("[data-code-language]");
        if (languageButton) {
            state.codeLanguage = languageButton.dataset.codeLanguage || "curl";
            renderDocument();
            return;
        }
        if (event.target.closest("#copyCodeButton")) {
            const text = document.getElementById("codeExample")?.textContent || "";
            const copied = await navigator.clipboard.writeText(text).then(() => true).catch(() => false);
            showToast(copied ? "调用示例已复制" : "复制失败，请手动选择", !copied);
        }
    });
    bindResponseTabs(elements.responseSection);
}

async function initialize() {
    bindEvents();
    try {
        await loadCatalog();
        if (elements.exportMarkdownButton) elements.exportMarkdownButton.disabled = false;
        renderNavigation();
        selectCookie();
        clearResponse(elements);
    } catch (error) {
        elements.document.innerHTML = `<div class="document-loading">${escapeHtml(error.message || String(error))}</div>`;
        showToast(error.message || String(error), true);
        return;
    }
    await detectBackend();
}

initialize();
