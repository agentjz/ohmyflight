import type { AuditKingAppContext } from "./app-context";
import type { AuditKingCheckItemSource, AuditKingImportedCheckItem } from "./models";

    function getChecklistSelection(context: AuditKingAppContext): { keyword: string; source?: AuditKingCheckItemSource } {
        const selection = window.getSelection();
        const keyword = selection?.toString().trim() || "";
        if (!selection || !keyword || selection.rangeCount === 0) return { keyword };
        const range = selection.getRangeAt(0);
        const startElement = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as Element;
        const endElement = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : range.endContainer as Element;
        const startBlock = startElement?.closest<HTMLElement>("[data-block-id]");
        const endBlock = endElement?.closest<HTMLElement>("[data-block-id]");
        if (!startBlock || startBlock !== endBlock) return { keyword };
        const sourceRange = document.createRange();
        sourceRange.selectNodeContents(startBlock);
        sourceRange.setEnd(range.startContainer, range.startOffset);
        const start = sourceRange.toString().length;
        sourceRange.setEnd(range.endContainer, range.endOffset);
        const end = sourceRange.toString().length;
        sourceRange.detach();
        const block = context.state.checklistBlocks.find((item) => item.id === startBlock.dataset.blockId);
        return { keyword, source: block ? context.runtime.SourceLocator.makeSource(block, start, end) : undefined };
    }

    function addCheckItem(context: AuditKingAppContext, input: Partial<AuditKingImportedCheckItem>): void {
        if (!String(input.code || "").trim() && !String(input.name || "").trim() && !String(input.keyword || "").trim()) {
            context.runtime.View.renderStatus("请填写检查编号、检查项名称或关键词。", "error");
            return;
        }
        context.runtime.State.addCheckItem(context.state, input, {
            afterCheckItemId: context.state.currentCheckItemId !== "all" ? context.state.currentCheckItemId : undefined
        });
        context.recomputeSearch();
        context.refresh("已新增检查项。", "success");
    }

    function bindCurrentSource(context: AuditKingAppContext): void {
        const item = context.state.checkItems.find((candidate) => candidate.id === context.state.currentCheckItemId);
        if (!item) return context.runtime.View.renderStatus("请先选择检查项。", "error");
        const selection = getChecklistSelection(context);
        if (!selection.source) return context.runtime.View.renderStatus("请在检查单原文中选中来源文字。", "error");
        context.runtime.State.updateCheckItemSource(context.state, item.id, selection.source);
        context.runtime.View.renderAll(context.state);
        context.runtime.View.focusChecklistHighlight(context.state);
        context.runtime.View.renderStatus("已更新检查单来源。", "success");
    }

export function bindCheckItemActions(context: AuditKingAppContext): void {
        context.getElement<HTMLButtonElement>("addCheckItemBtn").addEventListener("click", () => {
            const code = context.getElement<HTMLInputElement>("checkItemCodeInput");
            const name = context.getElement<HTMLInputElement>("checkItemNameInput");
            const keyword = context.getElement<HTMLInputElement>("keywordInput");
            addCheckItem(context, { code: code.value, name: name.value, keyword: keyword.value });
            code.value = ""; name.value = ""; keyword.value = "";
        });
        context.getElement<HTMLButtonElement>("addSelectedCheckItemBtn").addEventListener("click", () => {
            const selection = getChecklistSelection(context);
            addCheckItem(context, { keyword: selection.keyword, source: selection.source });
        });
        context.getElement<HTMLButtonElement>("bindSelectedSourceBtn").addEventListener("click", () => bindCurrentSource(context));
        context.getElement<HTMLButtonElement>("unbindSelectedSourceBtn").addEventListener("click", () => {
            if (context.state.currentCheckItemId === "all") return;
            context.runtime.State.clearCheckItemSource(context.state, context.state.currentCheckItemId);
            context.refresh("已清除检查单来源。", "info");
        });

        document.addEventListener("change", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const id = target.dataset.checkItemId || "";
            if (target.dataset.action === "edit-check-item-order") {
                context.runtime.State.moveCheckItemToPosition(context.state, id, Number(target.value));
                context.runtime.View.renderAll(context.state);
                return;
            }
            const field = target.dataset.action?.replace("edit-check-item-", "");
            if (!["code", "name", "keyword"].includes(field || "")) return;
            context.runtime.State.updateCheckItem(context.state, id, { [field as string]: target.value });
            if (field === "keyword") context.recomputeSearch();
            context.refresh("检查项已更新。", "success");
        });

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const actionTarget = target.closest<HTMLElement>("[data-action]");
            const action = actionTarget?.dataset.action;
            const id = actionTarget?.dataset.checkItemId || "";
            if (action === "select-check-item") {
                context.runtime.State.setCurrentCheckItem(context.state, id || "all");
                context.runtime.View.renderAll(context.state);
                context.runtime.View.focusChecklistHighlight(context.state);
            } else if (action === "delete-check-item") {
                context.runtime.State.removeCheckItem(context.state, id);
                context.recomputeSearch();
                context.refresh("检查项及其证据、依据已删除。", "info");
            } else if (action === "toggle-check-item") {
                const item = context.state.checkItems.find((candidate) => candidate.id === id);
                if (!item) return;
                context.runtime.State.updateCheckItem(context.state, id, { enabled: !item.enabled });
                context.recomputeSearch();
                context.refresh(item.enabled ? "检查项已启用。" : "检查项已停用。", "info");
            }
        });
    }
