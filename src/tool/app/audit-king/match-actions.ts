import type { AuditKingAppContext } from "./app-context";

    function isNodeInside(parent: HTMLElement, node: Node): boolean {
        return node === parent || parent.contains(node);
    }
    function getSelectionInsideElement(element: HTMLElement): { start: number; end: number; text: string } | null {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!isNodeInside(element, range.startContainer) || !isNodeInside(element, range.endContainer)) return null;

        const selectedText = range.toString();
        if (!selectedText.trim()) return null;

        const sourceRange = document.createRange();
        sourceRange.selectNodeContents(element);
        sourceRange.setEnd(range.startContainer, range.startOffset);
        const rawStart = sourceRange.toString().length;
        sourceRange.setEnd(range.endContainer, range.endOffset);
        const rawEnd = sourceRange.toString().length;
        sourceRange.detach();

        const leadingWhitespace = selectedText.length - selectedText.replace(/^\s+/, "").length;
        const trailingWhitespace = selectedText.length - selectedText.replace(/\s+$/, "").length;
        const start = rawStart + leadingWhitespace;
        const end = Math.max(start, rawEnd - trailingWhitespace);
        const text = selectedText.trim();
        return end > start ? { start, end, text } : null;
    }

    function bindFiltersAndNavigation(context: AuditKingAppContext): void {
        context.getElement<HTMLSelectElement>("manualFilter").addEventListener("change", (event: Event) => {
            context.runtime.State.setDocumentFilter(context.state, (event.currentTarget as HTMLSelectElement).value);
            context.runtime.View.renderMatches(context.state);
        });
        context.getElement<HTMLButtonElement>("showAllCheckItemsBtn").addEventListener("click", () => {
            context.runtime.State.setCurrentCheckItem(context.state, "all");
            context.runtime.View.renderCheckItems(context.state);
            context.runtime.View.renderManualEvidences(context.state);
            context.runtime.View.renderMatches(context.state);
        });
        context.getElement<HTMLButtonElement>("prevMatchBtn").addEventListener("click", () => {
            context.focusMatch(context.state.currentMatchIndex - 1);
        });
        context.getElement<HTMLButtonElement>("nextMatchBtn").addEventListener("click", () => {
            context.focusMatch(context.state.currentMatchIndex + 1);
        });
    }

    function bindMatchAsManualEvidence(context: AuditKingAppContext, matchIndex: number): void {
        if (!context.state.currentCheckItemId || context.state.currentCheckItemId === "all") {
            context.runtime.View.renderStatus("请先选择一个检查项。", "error");
            return;
        }
        const keyword = context.state.checkItems.find((item) => item.id === context.state.currentCheckItemId);
        if (!keyword) {
            context.runtime.View.renderStatus("当前关键词不存在。", "error");
            return;
        }
        const matches = context.getFilteredMatches();
        const match = matches[Math.max(0, Math.min(matches.length - 1, matchIndex))] || null;
        if (!match) {
            context.runtime.View.renderStatus("请先选择一条手册命中。", "error");
            return;
        }
        if (match.checkItemId !== keyword.id) {
            context.runtime.View.renderStatus("当前命中不属于所选检查项。", "error");
            return;
        }
        const nextIndex = Math.max(0, Math.min(matches.length - 1, matchIndex));
        if (nextIndex !== context.state.currentMatchIndex) {
            context.runtime.State.resetMatchDetailContext(context.state);
        }
        context.state.currentMatchIndex = nextIndex;
        const evidence = context.runtime.SourceLocator.makeManualEvidence(match);
        context.runtime.State.addManualEvidence(context.state, keyword.id, evidence);
        context.runtime.View.renderCheckItems(context.state);
        context.runtime.View.renderMatches(context.state);
        context.runtime.View.renderManualEvidences(context.state);
        context.runtime.View.renderStatus(`已保存手册证据：${keyword.keyword}`, "success");
    }

    function addSelectedDetailManualEvidence(context: AuditKingAppContext): void {
        if (!context.state.currentCheckItemId || context.state.currentCheckItemId === "all") {
            context.runtime.View.renderStatus("请先选择一个检查项。", "error");
            return;
        }
        const keyword = context.state.checkItems.find((item) => item.id === context.state.currentCheckItemId);
        if (!keyword) {
            context.runtime.View.renderStatus("当前关键词不存在。", "error");
            return;
        }
        const match = context.getCurrentFilteredMatch();
        if (!match) {
            context.runtime.View.renderStatus("请先选择一条手册命中。", "error");
            return;
        }
        if (match.checkItemId !== keyword.id) {
            context.runtime.View.renderStatus("当前详情不属于所选检查项。", "error");
            return;
        }
        const detailText = document.getElementById("matchDetailOriginalText");
        if (!(detailText instanceof HTMLElement)) {
            context.runtime.View.renderStatus("当前详情原文尚未加载。", "error");
            return;
        }
        const selection = getSelectionInsideElement(detailText);
        if (!selection) {
            context.runtime.View.renderStatus("请先在全部详情原文中选中要加入的证据。", "error");
            return;
        }
        const windowStart = Number(detailText.dataset.windowStart || 0);
        if (!Number.isFinite(windowStart)) {
            context.runtime.View.renderStatus("当前详情缺少全文定位信息。", "error");
            return;
        }
        const documentItem = context.state.documents.find((item) => item.id === match.documentId);
        if (!documentItem) {
            context.runtime.View.renderStatus("当前命中对应的手册不存在。", "error");
            return;
        }
        const evidence = context.runtime.SourceLocator.makeManualEvidenceFromDocumentRange(
            documentItem,
            windowStart + selection.start,
            windowStart + selection.end,
            {
                sourceType: "selection",
                mode: match.mode
            }
        );
        context.runtime.State.addManualEvidence(context.state, keyword.id, evidence);
        window.getSelection()?.removeAllRanges();
        context.runtime.View.renderCheckItems(context.state);
        context.runtime.View.renderMatches(context.state);
        context.runtime.View.renderManualEvidences(context.state);
        context.runtime.View.renderStatus(`已把选中原文保存为手册证据：${keyword.keyword}`, "success");
    }

    function unbindMatchManualEvidence(context: AuditKingAppContext, matchIndex: number): void {
        if (!context.state.currentCheckItemId || context.state.currentCheckItemId === "all") {
            context.runtime.View.renderStatus("请先选择一个检查项。", "error");
            return;
        }
        const keyword = context.state.checkItems.find((item) => item.id === context.state.currentCheckItemId);
        if (!keyword) {
            context.runtime.View.renderStatus("当前关键词不存在。", "error");
            return;
        }
        const matches = context.getFilteredMatches();
        const match = matches[Math.max(0, Math.min(matches.length - 1, matchIndex))] || null;
        if (!match) {
            context.runtime.View.renderStatus("请先选择一条手册命中。", "error");
            return;
        }
        const selectedText = match.blockText.slice(match.start, match.end);
        const evidence = keyword.manualEvidences.find((item) => (
            item.documentName === match.documentName
            && item.blockId === match.blockId
            && Number(item.start) === match.start
            && Number(item.end) === match.end
            && item.text === selectedText
        ));
        if (!evidence?.id) {
            context.runtime.View.renderStatus("这条摘要尚未绑定到当前关键词。", "error");
            return;
        }
        const nextIndex = Math.max(0, Math.min(matches.length - 1, matchIndex));
        if (nextIndex !== context.state.currentMatchIndex) {
            context.runtime.State.resetMatchDetailContext(context.state);
        }
        context.state.currentMatchIndex = nextIndex;
        context.runtime.State.removeManualEvidence(context.state, keyword.id, evidence.id);
        context.runtime.View.renderCheckItems(context.state);
        context.runtime.View.renderMatches(context.state);
        context.runtime.View.renderManualEvidences(context.state);
        context.runtime.View.renderStatus("已解绑当前摘要的手册证据。", "success");
    }

    function removeCurrentKeywordManualEvidence(context: AuditKingAppContext, evidenceId: string): void {
        if (!context.state.currentCheckItemId || context.state.currentCheckItemId === "all") {
            context.runtime.View.renderStatus("请先选择一个检查项。", "error");
            return;
        }
        if (!evidenceId) return;
        context.runtime.State.removeManualEvidence(context.state, context.state.currentCheckItemId, evidenceId);
        context.runtime.View.renderCheckItems(context.state);
        context.runtime.View.renderMatches(context.state);
        context.runtime.View.renderManualEvidences(context.state);
        context.runtime.View.renderStatus("已解绑手册证据。", "success");
    }

export function bindMatchActions(context: AuditKingAppContext): void {
        bindFiltersAndNavigation(context);

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const actionTarget = target.closest<HTMLElement>("[data-action]");
            if (!actionTarget) return;
            const action = actionTarget.dataset.action;
            if (action === "focus-match") {
                context.focusMatch(Number(actionTarget.dataset.matchIndex || 0));
            } else if (action === "bind-match-evidence") {
                bindMatchAsManualEvidence(context, Number(actionTarget.dataset.matchIndex || 0));
            } else if (action === "unbind-match-evidence") {
                unbindMatchManualEvidence(context, Number(actionTarget.dataset.matchIndex || 0));
            } else if (action === "expand-match-detail") {
                context.runtime.State.expandMatchDetailContext(context.state);
                context.runtime.View.renderMatchDetail(context.state);
            } else if (action === "add-selected-manual-evidence") {
                addSelectedDetailManualEvidence(context);
            } else if (action === "remove-manual-evidence") {
                removeCurrentKeywordManualEvidence(context, actionTarget.dataset.evidenceId || "");
            } else if (action === "adopt-manual-evidence") {
                context.runtime.State.adoptManualEvidence(context.state, context.state.currentCheckItemId, actionTarget.dataset.evidenceId || "");
                context.runtime.View.renderManualEvidences(context.state);
                context.runtime.View.renderEvidence(context.state);
                context.runtime.View.renderStatus("已追加为审计依据。", "success");
            } else if (action === "remove-document") {
                context.runtime.State.removeDocument(context.state, actionTarget.dataset.documentId || "");
                context.recomputeSearch();
                context.refresh("手册已删除。", "info");
            } else if (action === "toggle-document") {
                const documentId = actionTarget.dataset.documentId || "";
                const documentItem = context.state.documents.find((item) => item.id === documentId);
                if (!documentItem) return;
                context.runtime.State.setDocumentEnabled(context.state, documentId, documentItem.enabled === false);
                context.recomputeSearch();
                context.refresh(documentItem.enabled === false ? "手册已停用。" : "手册已启用。", "info");
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.closest("button,input,select,textarea")) return;
            const matchItem = target.closest<HTMLElement>(".match-item[data-action='focus-match']");
            if (!matchItem) return;
            event.preventDefault();
            context.focusMatch(Number(matchItem.dataset.matchIndex || 0));
        });
    }
