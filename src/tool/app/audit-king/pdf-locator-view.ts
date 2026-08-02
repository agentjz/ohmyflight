import type {
    AuditKingPdfLocatorResult,
    AuditKingPdfLocatorSegmentComparison,
    AuditKingPdfLocatorSlot,
    AuditKingPdfLocatorState
} from "./models";
import type { createAuditKingPdfLocatorModel } from "./pdf-locator-model";

export function createAuditKingPdfLocatorView(PdfLocatorModel: ReturnType<typeof createAuditKingPdfLocatorModel>) {

    function escapeHtml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getElement<T extends HTMLElement>(id: string): T {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`页面缺少必要元素：${id}`);
        }
        return element as T;
    }

    function statusText(status: AuditKingPdfLocatorResult["status"]): { text: string; className: string } {
        if (status === "trusted") return { text: "可信命中", className: "trusted" };
        if (status === "review") return { text: "需确认", className: "review" };
        if (status === "skip") return { text: "跳过", className: "skip" };
        return { text: "未命中", className: "miss" };
    }

    function confidenceBadge(result?: AuditKingPdfLocatorResult): { text: string; className: string } {
        if (!result) {
            return { text: "未识别", className: "skip" };
        }
        if (result.status === "skip") {
            return { text: "跳过", className: "skip" };
        }
        const status = statusText(result.status);
        return {
            text: `${status.text} · 可信度 ${formatPercent(result.score)} · 覆盖率 ${formatPercent(result.coverage)} · 片段 ${result.matchedSegments}/${result.totalSegments}`,
            className: result.status
        };
    }

    function formatPercent(value: number): string {
        return `${Math.round(Number(value || 0) * 100)}%`;
    }

    function renderDocuments(state: AuditKingPdfLocatorState): void {
        const container = getElement<HTMLElement>("pdfLocatorDocumentList");
        if (!state.documents.length) {
            container.innerHTML = `<span class="text-muted">未上传 PDF</span>`;
            return;
        }
        container.innerHTML = state.documents.map((documentItem) => `
            <span class="pdf-locator-doc-chip">${escapeHtml(documentItem.name)} / ${documentItem.pageCount} 页</span>
        `).join("");
    }

    function renderSummary(state: AuditKingPdfLocatorState): void {
        const total = state.results.length;
        const summary = state.summary || { trusted: 0, review: 0, miss: 0, skip: 0 };
        getElement<HTMLElement>("pdfLocatorSummary").textContent = `${state.documents.length} 个 PDF / ${total} 条依据 / 可信 ${summary.trusted} / 需确认 ${summary.review} / 未命中 ${summary.miss} / 跳过 ${summary.skip}`;
    }

    function pageText(slot: AuditKingPdfLocatorSlot): string {
        if (slot.startPage && slot.endPage) {
            return slot.startPage === slot.endPage ? String(slot.startPage) : `${slot.startPage}-${slot.endPage}`;
        }
        return "";
    }

    function renderSlots(state: AuditKingPdfLocatorState): void {
        const container = getElement<HTMLElement>("pdfLocatorResultList");
        if (!state.slots.length) {
            container.innerHTML = `<div class="empty-panel">从审计篮子生成槽位，或按编号范围生成空槽。</div>`;
            return;
        }
        container.innerHTML = state.slots.map((slot) => renderSlotCard(slot, state)).join("");
    }

    function renderSlotCard(slot: AuditKingPdfLocatorSlot, state: AuditKingPdfLocatorState): string {
        const result = slot.result;
        const status = confidenceBadge(result);
        const active = state.selectedSlotId === slot.id ? " active" : "";
        const documents = state.documents.map((documentItem) => `
            <option value="${escapeHtml(documentItem.id)}" ${documentItem.id === slot.pdfId ? "selected" : ""}>${escapeHtml(documentItem.name)}</option>
        `).join("");
        return `
            <article class="pdf-slot-card${active}" data-action="select-pdf-slot" data-slot-id="${escapeHtml(slot.id)}">
                <div class="pdf-slot-head">
                    <label class="pdf-slot-check">
                        <input type="checkbox" ${slot.selected ? "checked" : ""} data-action="edit-pdf-slot-selected" data-slot-id="${escapeHtml(slot.id)}">
                    </label>
                    <input class="form-control form-control-sm pdf-slot-sequence" value="${escapeHtml(slot.sequence)}" data-action="edit-pdf-slot-sequence" data-slot-id="${escapeHtml(slot.id)}" aria-label="编号">
                    <span class="pdf-locator-status ${status.className}">${status.text}</span>
                    <button class="btn btn-sm btn-outline-primary" data-action="export-pdf-slot" data-slot-id="${escapeHtml(slot.id)}">导出</button>
                </div>
                <input class="form-control form-control-sm mb-2" value="${escapeHtml(slot.title)}" data-action="edit-pdf-slot-title" data-slot-id="${escapeHtml(slot.id)}" aria-label="标题">
                <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-lg">
                        <select class="form-select form-select-sm" data-action="edit-pdf-slot-pdf" data-slot-id="${escapeHtml(slot.id)}">
                            <option value="">选择 PDF</option>
                            ${documents}
                        </select>
                    </div>
                    <div class="col-6 col-lg-2">
                        <input type="number" min="1" class="form-control form-control-sm" value="${escapeHtml(slot.startPage)}" data-action="edit-pdf-slot-start" data-slot-id="${escapeHtml(slot.id)}" aria-label="起始页">
                    </div>
                    <div class="col-6 col-lg-2">
                        <input type="number" min="1" class="form-control form-control-sm" value="${escapeHtml(slot.endPage)}" data-action="edit-pdf-slot-end" data-slot-id="${escapeHtml(slot.id)}" aria-label="结束页">
                    </div>
                </div>
                <div class="pdf-slot-meta">
                    <span>页码：${escapeHtml(pageText(slot) || "未设置")}</span>
                    ${result?.reason ? `<span>${escapeHtml(result.reason)}</span>` : ""}
                </div>
                <div class="pdf-slot-evidence">${escapeHtml(slot.content || "空槽位，可手工选择 PDF 和页码。")}</div>
            </article>
        `;
    }

    function renderSelectedSlot(state: AuditKingPdfLocatorState): void {
        const detail = getElement<HTMLElement>("pdfLocatorSlotDetail");
        const slot = state.slots.find((item) => item.id === state.selectedSlotId) || state.slots[0];
        if (!slot) {
            detail.innerHTML = `<div class="empty-panel">选择一个槽位后查看原文和切片对比。</div>`;
            getElement<HTMLElement>("pdfLocatorPreview").innerHTML = `<div class="empty-panel">选择 PDF 和页码后预览。</div>`;
            return;
        }
        const comparisons = PdfLocatorModel.buildSlotComparison(slot, state.documents);
        const matched = comparisons.filter((item: AuditKingPdfLocatorSegmentComparison) => item.matched).length;
        detail.innerHTML = `
            <div class="pdf-detail-title">
                <strong>${escapeHtml(slot.sequence)} ${escapeHtml(slot.title)}</strong>
                <span class="text-muted small">切片 ${matched}/${comparisons.length}</span>
            </div>
            <div class="pdf-compare-grid">
                <section>
                    <div class="pdf-compare-title">审计篮子原文</div>
                    <div class="pdf-original-text">${escapeHtml(slot.content || "空槽位暂无原文。")}</div>
                </section>
                <section>
                    <div class="pdf-compare-title">PDF切片识别</div>
                    <div class="pdf-segment-list">
                        ${comparisons.length ? comparisons.map((item: AuditKingPdfLocatorSegmentComparison) => `
                            <div class="pdf-segment ${item.matched ? "matched" : "missing"}">
                                <span>${item.matched ? "命中" : "缺失"}</span>
                                <em>${escapeHtml(item.text)}</em>
                            </div>
                        `).join("") : `<div class="empty-panel">没有可用于识别的有效切片。</div>`}
                    </div>
                </section>
            </div>
        `;
    }

    function renderPdfLocator(state: AuditKingPdfLocatorState): void {
        renderDocuments(state);
        renderSummary(state);
        renderSlots(state);
        renderSelectedSlot(state);
    }

    return {
        renderPdfLocator
    };
}
