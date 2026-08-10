import "../../support-shell";
import type {
    BeginnerTutorialData,
    TutorialModule,
    TutorialRecord,
    TutorialSourceRef,
    TutorialStatus
} from "./types";

const dataUrl = "../../beginner-tutorial-data.json";
const statusLabels: Record<TutorialStatus, string> = {
    confirmed: "已核对",
    partial: "条件未完整给出",
    special: "特殊类别"
};

const navigation = document.getElementById("tutorialNavigation");
const content = document.getElementById("tutorialContent");
const searchInput = document.getElementById("tutorialSearch");
const searchStatus = document.getElementById("tutorialSearchStatus");

let tutorialData: BeginnerTutorialData | null = null;
let activeModuleId = "";

void initialize();

async function initialize(): Promise<void> {
    if (!(navigation instanceof HTMLElement) || !(content instanceof HTMLElement)) return;

    try {
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error(`菜鸟教程加载失败：${response.status}`);
        const data = await response.json() as unknown;
        if (!isBeginnerTutorialData(data)) throw new Error("菜鸟教程数据格式无效。");
        tutorialData = data;
        activeModuleId = resolveInitialModule(data);
        renderNavigation(data);
        renderActiveModule();
        bindInteractions();
    } catch (error: unknown) {
        content.innerHTML = `<div class="tutorial-empty">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    }
}

function resolveInitialModule(data: BeginnerTutorialData): string {
    const hashId = decodeURIComponent(location.hash.replace(/^#/, ""));
    return data.modules.some((module) => module.id === hashId)
        ? hashId
        : data.modules[0]?.id || "";
}

function bindInteractions(): void {
    navigation?.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-module-id]") : null;
        if (!target || !tutorialData) return;
        activeModuleId = target.dataset.moduleId || activeModuleId;
        if (searchInput instanceof HTMLInputElement) searchInput.value = "";
        updateSearchStatus("");
        history.replaceState(null, "", `#${encodeURIComponent(activeModuleId)}`);
        renderNavigation(tutorialData);
        renderActiveModule();
    });

    searchInput?.addEventListener("input", () => {
        if (!(searchInput instanceof HTMLInputElement)) return;
        const query = searchInput.value.trim();
        if (query) renderSearchResults(query);
        else renderActiveModule();
    });
}

function renderNavigation(data: BeginnerTutorialData): void {
    if (!(navigation instanceof HTMLElement)) return;
    const modules = data.modules;
    navigation.innerHTML = modules.map((module) => `
        <button class="tutorial-nav-item${module.id === activeModuleId ? " is-active" : ""}" type="button" data-module-id="${escapeHtml(module.id)}" aria-current="${module.id === activeModuleId ? "page" : "false"}">
            <strong>${escapeHtml(module.title)}</strong>
            <span>${escapeHtml(module.summary)}</span>
        </button>
    `).join("");
}

function renderActiveModule(): void {
    if (!(content instanceof HTMLElement) || !tutorialData) return;
    const module = tutorialData.modules.find((candidate) => candidate.id === activeModuleId) || tutorialData.modules[0];
    if (!module) {
        content.innerHTML = '<div class="tutorial-empty">暂无教程内容。</div>';
        return;
    }

    content.innerHTML = renderModule(module);
    updateSearchStatus("");
}

function renderModule(module: TutorialModule): string {
    const body = module.body
        ? `<article class="tutorial-markdown">${marked.parse(module.body)}</article>${renderSources(module.sources || [])}`
        : "";
    const records = module.records?.length ? renderModuleRecords(module) : "";

    return `
        <section class="tutorial-module" aria-labelledby="moduleTitle">
            <header class="module-heading">
                <h1 id="moduleTitle">${escapeHtml(module.title)}</h1>
                <p>${escapeHtml(module.summary)}</p>
            </header>
            ${body}
            ${records}
        </section>
    `;
}

function renderModuleRecords(module: TutorialModule): string {
    if (!module.records?.length) return "";
    if (module.kind === "levels") {
        const groups = uniqueTracks(module.records);
        const progression = module.progression
            ? `<p class="progression">${escapeHtml(module.progression)}</p>`
            : "";
        if (!groups.length) return renderRecordsTable(module.records, module.kind);
        return progression + groups.map((track) => {
            const records = module.records?.filter((record) => record.track === track) || [];
            return `<section class="knowledge-group"><h2>${escapeHtml(track)}</h2>${renderRecordsTable(records, module.id)}</section>`;
        }).join("");
    }
    if (module.kind === "recovery") return renderRecoveryRecords(module);
    const groups = uniqueTracks(module.records);
    if (groups.length) {
        return groups.map((track) => {
            const records = module.records?.filter((record) => record.track === track) || [];
            return records.length ? `<section class="knowledge-group"><h2>${escapeHtml(track)}</h2>${renderRecordsTable(records, module.id)}</section>` : "";
        }).join("");
    }
    return renderRecordsTable(module.records, module.id);
}

function uniqueTracks(records: TutorialRecord[]): string[] {
    return Array.from(new Set(records.map((record) => record.track).filter((track): track is string => Boolean(track))));
}

function renderRecordsTable(records: TutorialRecord[], moduleId = ""): string {
    const lifecycleHeading = moduleId === "key-numbers" ? "保持、失效与依赖" : "保持与失效";
    return `
        <div class="tutorial-table-wrap">
            <table class="tutorial-table">
                <thead>
                    <tr><th>阶段/资质</th><th>条件与完整动作</th><th>${lifecycleHeading}</th><th>来源</th></tr>
                </thead>
                <tbody>${records.map((record) => renderRecordRow(record)).join("")}</tbody>
            </table>
        </div>
    `;
}

function renderRecoveryRecords(module: TutorialModule): string {
    if (!module.records?.length) return "";
    return `<div class="recovery-list">${module.records.map((record) => `
        <article class="recovery-entry" id="record-${escapeHtml(record.id)}">
            <header class="recovery-entry-heading">
                <div>
                    <h2>${escapeHtml(record.title)}</h2>
                    <p>${escapeHtml(record.summary)}</p>
                </div>
                <span class="record-status status-${escapeHtml(record.status)}">${escapeHtml(statusLabels[record.status])}</span>
            </header>
            <p class="recovery-audience"><strong>适用对象</strong>${escapeHtml(record.audience)}</p>
            ${renderRecoverySections(record.sections || [])}
            ${renderSources(record.sources)}
        </article>
    `).join("")}</div>`;
}

function renderRecoverySections(sections: NonNullable<TutorialRecord["sections"]>): string {
    return sections.length
        ? `<div class="recovery-sections">${sections.map((section) => `
            <section class="recovery-section">
                <h3>${escapeHtml(section.title)}</h3>
                <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
            </section>
        `).join("")}</div>`
        : `<p class="checklist-missing">本条没有可展开的分段清单。</p>`;
}

function renderRecordRow(record: TutorialRecord): string {
    return `
        <tr id="record-${escapeHtml(record.id)}">
            <th scope="row">
                <strong>${escapeHtml(record.title)}</strong>
                <span class="record-status status-${escapeHtml(record.status)}">${escapeHtml(statusLabels[record.status])}</span>
                <small>${escapeHtml(record.category)}</small>
                <small>${escapeHtml(record.audience)}</small>
            </th>
            <td>
                <p class="record-summary">${escapeHtml(record.summary)}</p>
                <p class="record-action">${escapeHtml(record.action)}</p>
            </td>
            <td>${renderLifecycle(record.lifecycle || (record.status === "partial" ? "本次两本手册未给出完整条件。" : "无单独要求。"))}</td>
            <td>${renderSources(record.sources)}</td>
        </tr>
    `;
}

function renderLifecycle(value: string): string {
    const parts = value
        .split(/(?=(?:保持|失效触发|失效|恢复|依赖|说明)：)/g)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return "";
    const lines = parts.map((part) => {
        const separatorIndex = part.indexOf("：");
        if (separatorIndex < 0) return escapeHtml(part);
        const label = part.slice(0, separatorIndex);
        const body = part.slice(separatorIndex + 1).trim();
        return `<strong>${escapeHtml(label)}：</strong>${escapeHtml(body)}`;
    });
    return `<p class="record-lifecycle">${lines.join("<br>")}</p>`;
}

function renderSources(sources: TutorialSourceRef[]): string {
    if (!sources.length) return "";
    const uniqueSources = Array.from(new Map(sources.map((source) => [source.id, source])).values());
    return `
        <p class="source-note">
            <span>来源</span>
            ${uniqueSources.map((source) => `${escapeHtml(source.manual)} ${escapeHtml(source.chapter)} · ${escapeHtml(source.section)}`).join("；")}
        </p>
    `;
}

function renderSearchResults(query: string): void {
    if (!(content instanceof HTMLElement) || !tutorialData) return;
    const normalizedQuery = query.toLocaleLowerCase("zh-CN");
    const matches: Array<{ module: TutorialModule; record: TutorialRecord }> = [];

    for (const module of tutorialData.modules) {
        for (const record of module.records || []) {
            if (recordSearchText(module, record).includes(normalizedQuery)) matches.push({ module, record });
        }
    }

    updateSearchStatus(`找到 ${matches.length} 项`);
    content.innerHTML = `
        <section class="tutorial-module" aria-labelledby="searchResultTitle">
            <header class="module-heading">
                <h1 id="searchResultTitle">搜索结果</h1>
                <p>${escapeHtml(query)}</p>
            </header>
            ${matches.length
                ? matches.map(({ module, record }) => `<p class="result-module">${escapeHtml(module.title)}</p>${renderRecordsTable([record])}`).join("")
                : '<div class="tutorial-empty">没有匹配的条目。</div>'}
        </section>
    `;
}

function recordSearchText(module: TutorialModule, record: TutorialRecord): string {
    const sources = record.sources.flatMap((source) => [source.manual, source.chapter, source.section]);
    const sections = (record.sections || []).flatMap((section) => [section.title, ...section.items]);
    return [module.title, module.summary, record.title, record.category, record.audience, record.summary, record.action, record.lifecycle, ...sections, ...sources]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
}

function updateSearchStatus(value: string): void {
    if (searchStatus instanceof HTMLElement) searchStatus.textContent = value;
}

function isBeginnerTutorialData(value: unknown): value is BeginnerTutorialData {
    if (!value || typeof value !== "object") return false;
    const data = value as Partial<BeginnerTutorialData>;
    return data.schemaVersion === 1
        && typeof data.title === "string"
        && typeof data.description === "string"
        && Array.isArray(data.sourceScope)
        && data.sourceScope.every(isSourceRef)
        && Array.isArray(data.modules)
        && data.modules.every(isModule);
}

function isModule(value: unknown): value is TutorialModule {
    if (!value || typeof value !== "object") return false;
    const module = value as Partial<TutorialModule>;
    return typeof module.id === "string"
        && typeof module.title === "string"
        && typeof module.kind === "string"
        && typeof module.summary === "string"
        && (module.progression === undefined || typeof module.progression === "string")
        && (module.body === undefined || typeof module.body === "string")
        && (module.sources === undefined || module.sources.every(isSourceRef))
        && (module.records === undefined || module.records.every(isRecord));
}

function isRecord(value: unknown): value is TutorialRecord {
    if (!value || typeof value !== "object") return false;
    const record = value as Partial<TutorialRecord>;
    const requiredStrings: Array<keyof TutorialRecord> = ["id", "title", "status", "category", "audience", "summary", "action", "lifecycle"];
    return requiredStrings.every((key) => typeof record[key] === "string")
        && Array.isArray(record.sources)
        && record.sources.every(isSourceRef)
        && (record.sections === undefined || record.sections.every(isSection));
}

function isSection(value: unknown): value is NonNullable<TutorialRecord["sections"]>[number] {
    if (!value || typeof value !== "object") return false;
    const section = value as { title?: unknown; items?: unknown };
    return typeof section.title === "string"
        && Array.isArray(section.items)
        && section.items.every((item) => typeof item === "string");
}

function isSourceRef(value: unknown): value is TutorialSourceRef {
    if (!value || typeof value !== "object") return false;
    const source = value as Partial<TutorialSourceRef>;
    return typeof source.id === "string"
        && typeof source.manual === "string"
        && typeof source.version === "string"
        && typeof source.chapter === "string"
        && typeof source.section === "string";
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
