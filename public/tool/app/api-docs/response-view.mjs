import { escapeHtml } from "./catalog-view.mjs";

function activate(root, view) {
    root.querySelectorAll("[data-response-view]").forEach((button) => {
        const active = button.dataset.responseView === view;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
    });
    root.querySelectorAll("[data-response-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.responsePanel !== view;
    });
}

export function bindResponseTabs(root) {
    root.addEventListener("click", (event) => {
        const button = event.target.closest("[data-response-view]");
        if (button) activate(root, button.dataset.responseView || "table");
    });
}

function renderSummary(summary) {
    const entries = Object.entries(summary || {});
    if (!entries.length) return "";
    return `<dl class="response-summary">${entries.map(([name, value]) => `
        <div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>`;
}

function renderTables(data) {
    const tables = data?.tables || [];
    if (!tables.length) return `${renderSummary(data?.summary)}<p class="response-empty">响应没有结构化表格。</p>`;
    return `${renderSummary(data?.summary)}${tables.map((table) => {
        const columns = table.columns || [];
        const rows = table.rows || [];
        return `<section class="response-table-block">
            <h3>${escapeHtml(table.title || table.id || "结果")}</h3>
            <div class="response-table-shell"><table class="response-table">
                <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
                <tbody>${rows.length
                    ? rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`).join("")
                    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty-cell">没有数据行</td></tr>`}
                </tbody>
            </table></div>
        </section>`;
    }).join("")}`;
}

export function clearResponse(elements) {
    elements.responseMeta.textContent = "-";
    elements.responseTable.innerHTML = `<p class="response-empty">尚无响应</p>`;
    elements.responseJson.textContent = "尚无响应";
    elements.responseRaw.textContent = "尚无响应";
    elements.responseHeaders.textContent = "尚无响应";
    activate(elements.responseSection, "table");
}
export function renderResponse(elements, payload) {
    elements.responseMeta.textContent = `${payload.status} · ${payload.elapsedMilliseconds} ms`;
    elements.responseTable.innerHTML = renderTables(payload.data);
    elements.responseJson.textContent = JSON.stringify(payload.data || {}, null, 2);
    elements.responseRaw.textContent = String(payload.body || "<empty>");
    elements.responseHeaders.textContent = JSON.stringify(payload.headers || {}, null, 2);
    activate(elements.responseSection, "table");
}

export function renderResponseError(elements, message) {
    elements.responseMeta.textContent = "失败";
    elements.responseTable.innerHTML = `<p class="response-error">${escapeHtml(message)}</p>`;
    elements.responseJson.textContent = JSON.stringify({ error: message }, null, 2);
    elements.responseRaw.textContent = message;
    elements.responseHeaders.textContent = "{}";
    activate(elements.responseSection, "table");
}
