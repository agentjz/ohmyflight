import { escapeHtml } from "./catalog-view.mjs";

export function createToast(element) {
    let timer = 0;
    return (message, isError = false) => {
        if (!(element instanceof HTMLElement)) return;
        window.clearTimeout(timer);
        element.textContent = message;
        element.classList.toggle("is-error", isError);
        element.hidden = false;
        timer = window.setTimeout(() => { element.hidden = true; }, 2600);
    };
}

export function renderEndpointNavigation(container, records, selectedId, search) {
    const visible = records.filter((record) => {
        if (!search) return true;
        const text = `${record.endpoint.name} ${record.endpoint.path} ${record.endpoint.summary}`.toLowerCase();
        return text.includes(search);
    });
    container.innerHTML = visible.length
        ? visible.map((record) => `<button class="endpoint-nav${record.fullId === selectedId ? " is-active" : ""}" type="button" data-endpoint-id="${escapeHtml(record.fullId)}">
            <span class="method${record.endpoint.method === "POST" ? " is-post" : ""}">${escapeHtml(record.endpoint.method)}</span>
            <span class="endpoint-nav-name">${escapeHtml(record.endpoint.name.replace(/接口$/, ""))}</span>
        </button>`).join("")
        : `<p class="empty-parameters">没有匹配接口</p>`;
}

function checkedTime(value) {
    const match = String(value || "").match(/T(\d{2}:\d{2}:\d{2})/);
    return match ? match[1] : "尚未检查";
}

export function renderSessionStatus(elements, status) {
    const keepAlive = status?.keepAlive || {};
    let statusText = "Cookie 未验证";
    let detailText = "验证后每 1-60 秒自动检查一次";
    let visualState = "idle";
    if (keepAlive.state === "expired") {
        statusText = "Cookie 已失效";
        detailText = `最近检查 ${checkedTime(keepAlive.lastCheckedAt)}`;
        visualState = "expired";
    } else if (status?.ready && keepAlive.state === "checking") {
        statusText = "正在验证 Cookie";
        detailText = `最近有效 ${checkedTime(keepAlive.lastCheckedAt)}`;
        visualState = "healthy";
    } else if (status?.ready && keepAlive.state === "error") {
        statusText = "自动验证请求异常";
        detailText = `${keepAlive.error || "连接飞行门户失败"}，将在下一轮重试`;
        visualState = "error";
    } else if (status?.ready) {
        statusText = "Cookie 有效";
        detailText = `最近验证 ${checkedTime(keepAlive.lastCheckedAt)} · 每 1-60 秒自动检查`;
        visualState = "healthy";
    }
    if (elements.credentialStatus) elements.credentialStatus.dataset.state = visualState;
    if (elements.credentialStatusText) elements.credentialStatusText.textContent = statusText;
    if (elements.credentialStatusDetail) elements.credentialStatusDetail.textContent = detailText;
    if (elements.sessionState) elements.sessionState.textContent = statusText;
    if (elements.sessionDetail) elements.sessionDetail.textContent = detailText;
}
