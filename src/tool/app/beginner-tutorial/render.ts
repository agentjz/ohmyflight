import type {
    BeginnerTutorialData,
    TutorialEmbeddedRecord,
    TutorialModule,
    TutorialRecord,
    TutorialRecordBase,
    TutorialRecordLink,
    TutorialSection,
    TutorialSourceRef,
    TutorialStatus
} from "./types";

const statusLabels: Record<TutorialStatus, string> = {
    confirmed: "已核对",
    partial: "条件未完整给出",
    special: "特殊类别"
};

export function renderNavigation(data: BeginnerTutorialData, activeModuleId: string): string {
    return data.modules.map((module) => `
        <button class="tutorial-nav-item${module.id === activeModuleId ? " is-active" : ""}" type="button" data-module-id="${escapeHtml(module.id)}" aria-current="${module.id === activeModuleId ? "page" : "false"}">
            <strong>${escapeHtml(module.title)}</strong>
            <span>${escapeHtml(module.summary)}</span>
        </button>
    `).join("");
}

export function renderModule(module: TutorialModule): string {
    const body = module.body
        ? `<article class="tutorial-markdown">${marked.parse(module.body)}</article>${renderSources(module.sources || [])}`
        : "";
    const records = renderModuleRecords(module);
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

export function renderSearchResults(
    query: string,
    matches: Array<{ module: TutorialModule; record: TutorialRecord }>
): string {
    return `
        <section class="tutorial-module" aria-labelledby="searchResultTitle">
            <header class="module-heading">
                <h1 id="searchResultTitle">搜索结果</h1>
                <p>${escapeHtml(query)}</p>
            </header>
            <div class="record-list">
                ${matches.length
                    ? matches.map(({ module, record }) => `
                        <p class="result-module">${escapeHtml(module.title)}</p>
                        ${renderRecord(record, module.kind === "path", module.id)}
                    `).join("")
                    : '<div class="tutorial-empty">没有匹配的条目。</div>'}
            </div>
        </section>
    `;
}

export function recordSearchText(module: TutorialModule, record: TutorialRecord): string {
    const sources = record.sources.flatMap((source) => [source.manual, source.chapter, source.section]);
    const sections = flattenSections(record.sections);
    const embedded = (record.embeddedRecords || []).flatMap((item) => [
        item.title,
        item.summary,
        item.action,
        item.lifecycle,
        ...flattenSections(item.sections)
    ]);
    return [
        module.title,
        module.summary,
        record.title,
        record.category,
        record.audience,
        record.summary,
        record.action,
        record.lifecycle,
        ...sections,
        ...embedded,
        ...sources
    ].join(" ").toLocaleLowerCase("zh-CN");
}

function renderModuleRecords(module: TutorialModule): string {
    if (!module.records?.length) return "";
    const progression = module.progression
        ? `<p class="progression">${escapeHtml(module.progression)}</p>`
        : "";
    const groups = uniqueTracks(module.records);
    if (!groups.length) {
        return progression + `<div class="record-list">${module.records.map((record) =>
            renderRecord(record, module.kind === "path" || module.kind === "recovery", module.id)
        ).join("")}</div>`;
    }
    return progression + groups.map((track) => {
        const records = module.records?.filter((record) => record.track === track) || [];
        return `
            <section class="knowledge-group">
                <h2>${escapeHtml(track)}</h2>
                <div class="record-list">
                    ${records.map((record) =>
                        renderRecord(record, module.kind === "path" || module.kind === "recovery", module.id)
                    ).join("")}
                </div>
            </section>
        `;
    }).join("");
}

function renderRecord(record: TutorialRecord, open: boolean, moduleId: string): string {
    return `
        <details class="knowledge-record" id="record-${escapeHtml(record.id)}"${open ? " open" : ""}>
            <summary>
                <span class="record-heading-copy">
                    <span class="record-title-line">
                        <strong>${escapeHtml(record.title)}</strong>
                        <span class="record-status status-${escapeHtml(record.status)}">${escapeHtml(statusLabels[record.status])}</span>
                    </span>
                    <span>${escapeHtml(record.summary)}</span>
                </span>
                <span class="record-toggle" aria-hidden="true"></span>
            </summary>
            <div class="record-content">
                <dl class="record-meta">
                    <div><dt>适用对象</dt><dd>${escapeHtml(record.audience)}</dd></div>
                    <div><dt>业务类别</dt><dd>${escapeHtml(record.category)}</dd></div>
                </dl>
                ${renderPrimaryContent(record)}
                ${renderEmbeddedRecords(record.embeddedRecords || [])}
                ${renderRelatedRecords(record.relatedRecords || [], moduleId)}
                ${renderSources(record.sources)}
            </div>
        </details>
    `;
}

function renderPrimaryContent(record: TutorialRecordBase): string {
    const sections = record.sections?.length
        ? renderSections(record.sections, "record-sections")
        : renderActionAndLifecycle(record);
    return `<div class="record-primary">${sections}</div>`;
}

function renderActionAndLifecycle(record: TutorialRecordBase): string {
    const actionItems = splitActions(record.action);
    const lifecycleParts = splitLifecycle(record.lifecycle);
    return `
        <section class="record-block">
            <h3>条件与完整动作</h3>
            ${renderItems(actionItems)}
        </section>
        ${lifecycleParts.map((part) => `
            <section class="record-block">
                <h3>${escapeHtml(part.title)}</h3>
                ${renderItems([part.body])}
            </section>
        `).join("")}
    `;
}

function renderEmbeddedRecords(records: TutorialEmbeddedRecord[]): string {
    if (!records.length) return "";
    return `
        <section class="embedded-rules">
            <header>
                <h3>保持、失效与恢复</h3>
                <p>以下规则已按当前等级就地展开；各项资格分别有效，不会因恢复其中一项而自动恢复其他项目。</p>
            </header>
            ${records.map((record) => `
                <article class="embedded-rule">
                    <h4>${escapeHtml(record.title)}</h4>
                    <p>${escapeHtml(record.summary)}</p>
                    ${record.sections?.length
                        ? renderSections(record.sections, "embedded-sections")
                        : renderActionAndLifecycle(record)}
                    <button class="record-link" type="button" data-target-module="${escapeHtml(record.moduleId)}" data-target-record="${escapeHtml(record.id)}">
                        查看“${escapeHtml(record.title)}”完整条目
                    </button>
                </article>
            `).join("")}
        </section>
    `;
}

function renderSections(sections: TutorialSection[], className: string): string {
    return `<div class="${className}">${sections.map((section) => `
        <section class="record-block">
            <h3>${escapeHtml(section.title)}</h3>
            ${renderItems(section.items)}
        </section>
    `).join("")}</div>`;
}

function renderRelatedRecords(records: TutorialRecordLink[], currentModuleId: string): string {
    if (!records.length) return "";
    return `
        <nav class="related-records" aria-label="关联内容">
            <strong>关联内容</strong>
            <div>
                ${records.map((record) => `
                    <button class="record-link" type="button" data-target-module="${escapeHtml(record.moduleId || currentModuleId)}" data-target-record="${escapeHtml(record.targetId)}">
                        ${escapeHtml(record.title)}
                    </button>
                `).join("")}
            </div>
        </nav>
    `;
}

function renderItems(items: string[]): string {
    const meaningfulItems = items.map((item) => item.trim()).filter(Boolean);
    if (!meaningfulItems.length) return '<p class="checklist-missing">本条没有单独要求。</p>';
    return `<ul class="record-items">${meaningfulItems.map((item) => `
        <li><span class="check-box" aria-hidden="true"></span><span>${escapeHtml(item)}</span></li>
    `).join("")}</ul>`;
}

function splitActions(value: string): string[] {
    return value.split(/[；\n]+/u).map((item) => item.trim()).filter(Boolean);
}

function splitLifecycle(value: string): Array<{ title: string; body: string }> {
    if (!value.trim()) return [];
    const parts = value
        .split(/(?=(?:运行权限|下一状态|完成结果|保持|失效触发|失效|恢复|检查不合格|说明)：)/gu)
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.map((part) => {
        const separatorIndex = part.indexOf("：");
        return separatorIndex < 0
            ? { title: "状态说明", body: part }
            : { title: part.slice(0, separatorIndex), body: part.slice(separatorIndex + 1).trim() };
    });
}

function renderSources(sources: TutorialSourceRef[]): string {
    if (!sources.length) return "";
    const uniqueSources = Array.from(new Map(sources.map((source) => [source.id, source])).values());
    return `
        <p class="source-note">
            <span>来源</span>
            ${uniqueSources.map((source) =>
                `${escapeHtml(source.manual)} ${escapeHtml(source.chapter)} · ${escapeHtml(source.section)}`
            ).join("；")}
        </p>
    `;
}

function uniqueTracks(records: TutorialRecord[]): string[] {
    return Array.from(new Set(records.map((record) => record.track).filter((track): track is string => Boolean(track))));
}

function flattenSections(sections: TutorialSection[] | undefined): string[] {
    return (sections || []).flatMap((section) => [section.title, ...section.items]);
}

function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
