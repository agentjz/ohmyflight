import type { AuditKingHighlight } from "./highlight";
import type {
    AuditKingCheckItem,
    AuditKingHighlightRange,
    AuditKingManualEvidence,
    AuditKingMatch,
    AuditKingStateModel,
    AuditKingTextBlock
} from "./models";
import type { createAuditKingPdfLocatorView } from "./pdf-locator-view";
import type { createAuditKingSearchEngine } from "./search-engine";

interface AuditKingViewDependencies {
    Highlight: typeof AuditKingHighlight;
    SearchEngine: ReturnType<typeof createAuditKingSearchEngine>;
    PdfLocatorView: ReturnType<typeof createAuditKingPdfLocatorView>;
}

export function createAuditKingView({ Highlight, SearchEngine, PdfLocatorView }: AuditKingViewDependencies) {

    function escapeHtml(value: unknown): string {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
        }[char] || char));
    }

    function getElement<T extends HTMLElement>(id: string): T {
        const element = document.getElementById(id);
        if (!element) throw new Error(`Missing element: ${id}`);
        return element as T;
    }

    function renderStatus(message: string, type: "info" | "success" | "error" = "info"): void {
        const element = getElement<HTMLElement>("statusBar");
        element.textContent = message;
        element.className = `status-bar ${type}`;
    }

    function renderHighlightedText(text: string, ranges: AuditKingHighlightRange[]): string {
        const segments = Highlight.buildHighlightSegments(text, ranges);
        return segments.map((segment) => {
            if (!segment.colors.length) return escapeHtml(segment.text);
            const evidenceClass = segment.evidenceIds.length ? " ak-manual-evidence-highlight" : "";
            const style = segment.evidenceIds.length ? "background:#d1e7dd" : `background:${segment.colors[0]}`;
            const highlightKind = segment.keywordIds.length ? "keyword" : "evidence";
            return `<mark class="ak-highlight${evidenceClass}" style="${style}" data-highlight-kind="${highlightKind}" data-check-item-ids="${escapeHtml(segment.keywordIds.join(","))}" data-evidence-ids="${escapeHtml(segment.evidenceIds.join(","))}">${escapeHtml(segment.text)}</mark>`;
        }).join("");
    }

    function sourceIsLocated(item: AuditKingCheckItem, blocks: AuditKingTextBlock[]): boolean {
        if (!item.source?.blockId) return false;
        const block = blocks.find((candidate) => candidate.id === item.source?.blockId);
        const start = Number(item.source.start);
        const end = Number(item.source.end);
        return !!block && Number.isFinite(start) && Number.isFinite(end) && end > start
            && block.text.slice(start, end) === (item.source.text || item.keyword);
    }

    function renderChecklist(state: AuditKingStateModel): void {
        const container = getElement<HTMLElement>("checklistText");
        if (!state.checklistBlocks.length) {
            container.innerHTML = `<div class="empty-panel">尚未上传检查单。</div>`;
            return;
        }
        const current = state.checkItems.find((item) => item.id === state.currentCheckItemId);
        container.innerHTML = state.checklistBlocks.map((block) => {
            const ranges: AuditKingHighlightRange[] = [];
            if (current?.source?.blockId === block.id && sourceIsLocated(current, state.checklistBlocks)) {
                ranges.push({
                    checkItemId: current.id,
                    color: current.color,
                    start: Number(current.source.start),
                    end: Number(current.source.end)
                });
            }
            return `<p class="${ranges.length ? "active-source" : ""}" data-block-id="${escapeHtml(block.id)}" data-block-index="${block.blockIndex}">${renderHighlightedText(block.text, ranges)}</p>`;
        }).join("");
    }

    function focusChecklistHighlight(state: AuditKingStateModel): void {
        if (state.currentCheckItemId === "all") return;
        const container = getElement<HTMLElement>("checklistText");
        const block = container.querySelector<HTMLElement>(".active-source");
        if (block) container.scrollTop = Math.max(0, block.offsetTop - 70);
    }

    function renderDocuments(state: AuditKingStateModel): void {
        const list = getElement<HTMLElement>("manualList");
        const filter = getElement<HTMLSelectElement>("manualFilter");
        list.innerHTML = state.documents.length ? state.documents.map((documentItem) => `
            <div class="manual-row ${documentItem.enabled === false ? "muted" : ""}">
                <span>${escapeHtml(documentItem.name)} <small>${documentItem.blocks.length} 段${documentItem.pageCount ? ` / ${documentItem.pageCount} 页` : ""}</small></span>
                <button class="btn btn-sm btn-outline-secondary" data-action="toggle-document" data-document-id="${escapeHtml(documentItem.id)}">${documentItem.enabled === false ? "启用" : "停用"}</button>
                <button class="btn btn-sm btn-outline-danger" data-action="remove-document" data-document-id="${escapeHtml(documentItem.id)}">删除</button>
            </div>`).join("") : `<div class="empty-panel">尚未上传公司手册。</div>`;
        const enabled = state.documents.filter((item) => item.enabled !== false);
        filter.innerHTML = `<option value="all">全部手册</option>${enabled.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
        filter.value = enabled.some((item) => item.id === state.documentFilterId) ? state.documentFilterId : "all";
    }

    function renderCheckItems(state: AuditKingStateModel): void {
        const container = getElement<HTMLElement>("checkItemList");
        if (!state.checkItems.length) {
            container.innerHTML = `<div class="empty-panel">创建检查项后，在公司手册中检索候选依据。</div>`;
            return;
        }
        container.innerHTML = state.checkItems.map((item, index) => {
            const sourceStatus = sourceIsLocated(item, state.checklistBlocks) ? "已定位" : item.source ? "需确认" : "无来源";
            const count = state.searchResult.countsByCheckItem[item.id] || 0;
            return `<article class="check-item ${item.id === state.currentCheckItemId ? "active" : ""} ${item.enabled ? "" : "muted"}">
                <div class="check-item-row">
                    <input class="form-control form-control-sm check-item-order" type="number" min="1" value="${index + 1}" data-action="edit-check-item-order" data-check-item-id="${escapeHtml(item.id)}" title="顺序">
                    <button class="check-item-select" data-action="select-check-item" data-check-item-id="${escapeHtml(item.id)}">
                        <span class="check-item-color" style="background:${escapeHtml(item.color)}"></span>
                        <span><strong>${escapeHtml(item.code || "未编号")}</strong> ${escapeHtml(item.name || "未命名")}</span>
                        <small>${count} 命中 / ${item.manualEvidences.length} 证据 / ${item.auditEvidences.length} 依据</small>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="toggle-check-item" data-check-item-id="${escapeHtml(item.id)}">${item.enabled ? "停用" : "启用"}</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete-check-item" data-check-item-id="${escapeHtml(item.id)}">删除</button>
                </div>
                <div class="check-item-fields">
                    <input class="form-control form-control-sm" value="${escapeHtml(item.code)}" placeholder="检查编号" data-action="edit-check-item-code" data-check-item-id="${escapeHtml(item.id)}">
                    <input class="form-control form-control-sm" value="${escapeHtml(item.name)}" placeholder="检查项名称" data-action="edit-check-item-name" data-check-item-id="${escapeHtml(item.id)}">
                    <input class="form-control form-control-sm" value="${escapeHtml(item.keyword)}" placeholder="关键词" data-action="edit-check-item-keyword" data-check-item-id="${escapeHtml(item.id)}">
                    <span class="source-status">${sourceStatus}</span>
                </div>
            </article>`;
        }).join("");
    }

    function filteredMatches(state: AuditKingStateModel): AuditKingMatch[] {
        return SearchEngine.filterMatches(state.searchResult.matches, {
            checkItemId: state.currentCheckItemId,
            documentId: state.documentFilterId
        });
    }

    function findBoundEvidence(item: AuditKingCheckItem | undefined, match: AuditKingMatch): AuditKingManualEvidence | undefined {
        return item?.manualEvidences.find((evidence) => evidence.documentName === match.documentName
            && evidence.blockId === match.blockId && evidence.start === match.start && evidence.end === match.end);
    }

    function renderMatches(state: AuditKingStateModel): void {
        const matches = filteredMatches(state);
        const currentItem = state.checkItems.find((item) => item.id === state.currentCheckItemId);
        getElement<HTMLElement>("matchCount").textContent = `${matches.length} 条命中`;
        const list = getElement<HTMLElement>("matchList");
        list.innerHTML = matches.length ? matches.map((match, index) => {
            const bound = findBoundEvidence(currentItem, match);
            const location = match.pageNumber ? `第 ${match.pageNumber} 页` : `第 ${match.blockIndex} 段`;
            return `<article class="match-item ${index === state.currentMatchIndex ? "active" : ""} ${bound ? "bound-evidence" : ""}" data-action="focus-match" data-match-index="${index}" role="button" tabindex="0">
                <div><strong>${escapeHtml(match.keywordText)}</strong> <span>${escapeHtml(match.documentName)} / ${location}</span></div>
                <p>${escapeHtml(match.blockText)}</p>
                ${state.currentCheckItemId !== "all" ? `<button class="btn btn-sm ${bound ? "btn-outline-danger" : "btn-outline-success"}" data-action="${bound ? "unbind-match-evidence" : "bind-match-evidence"}" data-match-index="${index}">${bound ? "移出手册证据" : "保存为手册证据"}</button>` : ""}
            </article>`;
        }).join("") : `<div class="empty-panel">当前范围没有命中。</div>`;
        state.currentMatchIndex = Math.max(0, Math.min(state.currentMatchIndex, matches.length - 1));
        renderMatchDetail(state);
    }

    function renderMatchDetail(state: AuditKingStateModel): void {
        const match = filteredMatches(state)[state.currentMatchIndex];
        const container = getElement<HTMLElement>("matchDetail");
        const button = getElement<HTMLButtonElement>("addSelectedManualEvidenceBtn");
        if (!match) {
            container.innerHTML = `<div class="empty-panel">选择一条命中查看手册上下文。</div>`;
            getElement<HTMLElement>("matchDetailContextLabel").textContent = "";
            button.disabled = true;
            return;
        }
        const documentItem = state.documents.find((item) => item.id === match.documentId);
        const context = Highlight.buildBlockWindowContext(documentItem?.blocks || [], {
            blockId: match.blockId, matchStart: match.start, matchEnd: match.end, targetLength: state.currentDetailContextLength
        });
        const ranges: AuditKingHighlightRange[] = [{
            checkItemId: match.checkItemId, color: match.keywordColor, start: context.matchStart, end: context.matchEnd
        }];
        const item = state.checkItems.find((candidate) => candidate.id === match.checkItemId);
        item?.manualEvidences.filter((evidence) => evidence.documentId === match.documentId
            && evidence.globalStart !== undefined && evidence.globalEnd !== undefined
            && evidence.globalEnd > context.windowStart && evidence.globalStart < context.windowEnd)
            .forEach((evidence) => ranges.push({
                checkItemId: item.id, evidenceId: evidence.id, kind: "manual-evidence", color: "#d1e7dd",
                start: Math.max(0, Number(evidence.globalStart) - context.windowStart),
                end: Math.min(context.text.length, Number(evidence.globalEnd) - context.windowStart)
            }));
        container.innerHTML = `<div id="matchDetailOriginalText" class="detail-text" data-window-start="${context.windowStart}">${renderHighlightedText(context.text, ranges)}</div>`;
        focusMatchDetail(container);
        getElement<HTMLElement>("matchDetailContextLabel").textContent = `已加载约 ${state.currentDetailContextLength} 字`;
        const expand = getElement<HTMLButtonElement>("expandMatchDetailBtn");
        expand.disabled = !context.truncatedStart && !context.truncatedEnd;
        button.disabled = state.currentCheckItemId === "all" || match.checkItemId !== state.currentCheckItemId;
    }

    function focusMatchDetail(container: HTMLElement): void {
        const target = container.querySelector<HTMLElement>("[data-highlight-kind='keyword']");
        if (!target) {
            container.scrollTop = 0;
            return;
        }
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top - containerTop + container.scrollTop;
        container.scrollTop = Math.max(0, targetTop - 10);
    }

    function renderManualEvidences(state: AuditKingStateModel): void {
        const container = getElement<HTMLElement>("manualEvidenceList");
        const count = getElement<HTMLElement>("manualEvidenceCount");
        const item = state.checkItems.find((candidate) => candidate.id === state.currentCheckItemId);
        if (!item || state.currentCheckItemId === "all") {
            count.textContent = "未选择检查项";
            container.innerHTML = `<div class="empty-panel">选择检查项后查看候选手册证据。</div>`;
            return;
        }
        count.textContent = `${item.manualEvidences.length} 条手册证据`;
        container.innerHTML = item.manualEvidences.length ? item.manualEvidences.map((evidence) => {
            const adopted = item.auditEvidences.some((audit) => audit.sourceEvidenceId === evidence.id);
            const location = evidence.pageNumber ? `第 ${evidence.pageNumber} 页` : `第 ${evidence.blockIndex || "?"} 段`;
            return `<article class="manual-evidence-item">
                <div class="manual-evidence-head"><strong>${escapeHtml(evidence.documentName)} / ${location}</strong>${adopted ? `<span class="source-status located">已采纳</span>` : ""}</div>
                <div class="manual-evidence-text">${escapeHtml(evidence.text)}</div>
                <div class="manual-evidence-actions">
                    <button class="btn btn-sm btn-success" data-action="adopt-manual-evidence" data-evidence-id="${escapeHtml(evidence.id)}" ${adopted ? "disabled" : ""}>${adopted ? "已采纳" : "采纳为审计依据"}</button>
                    <button class="btn btn-sm btn-outline-danger" data-action="remove-manual-evidence" data-evidence-id="${escapeHtml(evidence.id)}">删除证据</button>
                </div>
            </article>`;
        }).join("") : `<div class="empty-panel">当前检查项还没有保存手册证据。</div>`;
    }

    function renderEvidence(state: AuditKingStateModel): void {
        const container = getElement<HTMLElement>("evidenceList");
        const total = state.checkItems.reduce((sum, item) => sum + item.auditEvidences.length, 0);
        getElement<HTMLElement>("evidenceCount").textContent = `${state.checkItems.length} 个检查项 / ${total} 条依据`;
        container.innerHTML = state.checkItems.length ? state.checkItems.map((item, index) => `
            <section class="audit-clause">
                <header><strong>${escapeHtml(item.code || "未编号")} ${escapeHtml(item.name || "未命名")}</strong><span>${escapeHtml(item.keyword || "无关键词")}</span><button class="btn btn-sm btn-outline-primary" data-action="add-audit-evidence" data-check-item-id="${escapeHtml(item.id)}">新增依据</button></header>
                ${item.auditEvidences.length ? item.auditEvidences.map((evidence, evidenceIndex) => `<div class="audit-evidence-row">
                    <span>${evidenceIndex + 1}</span>
                    <textarea class="form-control audit-evidence-content" data-action="edit-audit-content" data-check-item-id="${escapeHtml(item.id)}" data-evidence-id="${escapeHtml(evidence.id)}">${escapeHtml(evidence.content)}</textarea>
                    <input class="form-control form-control-sm" value="${escapeHtml(evidence.note)}" placeholder="备注" data-action="edit-audit-note" data-check-item-id="${escapeHtml(item.id)}" data-evidence-id="${escapeHtml(evidence.id)}">
                    <button class="btn btn-sm btn-outline-danger" data-action="remove-audit-evidence" data-check-item-id="${escapeHtml(item.id)}" data-evidence-id="${escapeHtml(evidence.id)}">删除</button>
                </div>`).join("") : `<div class="empty-panel">暂无审计依据。</div>`}
            </section>`).join("") : `<div class="empty-panel">尚未创建检查项。</div>`;
    }

    function scrollEvidenceToBottom(): void {
        const container = getElement<HTMLElement>("evidenceList");
        container.scrollTop = container.scrollHeight;
    }

    function renderAll(state: AuditKingStateModel): void {
        renderChecklist(state);
        renderDocuments(state);
        renderCheckItems(state);
        renderMatches(state);
        renderManualEvidences(state);
        renderEvidence(state);
        PdfLocatorView.renderPdfLocator(state.pdfLocator);
    }

    return {
        escapeHtml, getElement, renderStatus, renderHighlightedText, renderAll,
        renderChecklist, focusChecklistHighlight, renderDocuments, renderCheckItems,
        renderMatches, renderMatchDetail, renderManualEvidences, renderEvidence, scrollEvidenceToBottom
    };
}
