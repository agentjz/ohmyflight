import type { AuditKingAppContext } from "./app-context";

export function bindAuditActions(context: AuditKingAppContext): void {
        context.getElement<HTMLButtonElement>("addAuditCheckItemBtn").addEventListener("click", () => {
            context.runtime.State.addCheckItem(context.state, { code: "", name: "", keyword: "" });
            context.runtime.View.renderAll(context.state);
            context.runtime.View.scrollEvidenceToBottom();
        });
        document.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
            const action = target.dataset.action;
            const checkItemId = target.dataset.checkItemId || "";
            const evidenceId = target.dataset.evidenceId || "";
            if (action === "edit-audit-content") context.runtime.State.updateAuditEvidence(context.state, checkItemId, evidenceId, { content: target.value });
            else if (action === "edit-audit-note") context.runtime.State.updateAuditEvidence(context.state, checkItemId, evidenceId, { note: target.value });
        });
        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const actionTarget = target.closest<HTMLElement>("[data-action]");
            const action = actionTarget?.dataset.action;
            const checkItemId = actionTarget?.dataset.checkItemId || "";
            if (action === "add-audit-evidence") {
                context.runtime.State.addAuditEvidence(context.state, checkItemId, "", "");
                context.runtime.View.renderEvidence(context.state);
            } else if (action === "remove-audit-evidence") {
                context.runtime.State.removeAuditEvidence(context.state, checkItemId, actionTarget?.dataset.evidenceId || "");
                context.runtime.View.renderEvidence(context.state);
            }
        });
        context.getElement<HTMLButtonElement>("exportEvidenceBtn").addEventListener("click", () => {
            const groups = context.runtime.State.buildEvidenceGroups(context.state);
            if (!groups.length) return context.runtime.View.renderStatus("没有可导出的审计篮子内容。", "error");
            context.runtime.XLSX.writeFile(context.runtime.Export.buildEvidenceWorkbook(groups), `审计之王_审计篮子_${context.formatLocalDate(new Date())}.xlsx`);
        });
    }
