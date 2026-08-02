import type { AuditKingAppContext } from "./app-context";

export function bindWorkbookActions(context: AuditKingAppContext): void {
        const input = context.getElement<HTMLInputElement>("checkItemImportInput");
        context.getElement<HTMLButtonElement>("importCheckItemsBtn").addEventListener("click", () => input.click());
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            try {
                const workbook = context.runtime.XLSX.read(await file.arrayBuffer(), { type: "array" });
                context.runtime.State.replaceCheckItems(context.state, context.runtime.CheckItemWorkbook.parseWorkbook(workbook));
                context.recomputeSearch();
                context.refresh(`已导入 ${context.state.checkItems.length} 个检查项。`, "success");
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });
        context.getElement<HTMLButtonElement>("exportCheckItemsBtn").addEventListener("click", () => {
            if (!context.state.checkItems.length) return context.runtime.View.renderStatus("没有可导出的检查项。", "error");
            context.runtime.XLSX.writeFile(
                context.runtime.CheckItemWorkbook.buildWorkbook(context.state.checkItems),
                `审计之王_检查项_${context.formatLocalDate(new Date())}.xlsx`
            );
        });
    }
