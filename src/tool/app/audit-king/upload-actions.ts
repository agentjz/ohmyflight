import type { AuditKingAppContext } from "./app-context";
import type { AuditKingDocument } from "./models";

    async function handleChecklistFile(context: AuditKingAppContext, file: File): Promise<void> {
        try {
            context.runtime.View.renderStatus(`正在读取检查单：${file.name}`, "info");
            const documentItem = await context.runtime.DocumentReader.readFile(file, 0);
            context.state.checklistFile = file;
            context.runtime.State.setChecklistBlocks(context.state, documentItem.blocks);
            context.refresh(`检查单已读取：${file.name}（${documentItem.blocks.length} 段）。不会自动提取关键词。`, "success");
        } catch (error) {
            context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
        }
    }
    async function handleManualFiles(context: AuditKingAppContext, files: File[]): Promise<void> {
        try {
            context.runtime.View.renderStatus(`正在读取 ${files.length} 本手册...`, "info");
            const documents: AuditKingDocument[] = [];
            for (let index = 0; index < files.length; index += 1) {
                documents.push(await context.runtime.DocumentReader.readFile(files[index], context.state.documents.length + index));
            }
            context.runtime.State.appendDocuments(context.state, documents);
            context.recomputeSearch();
            context.refresh(`已追加 ${documents.length} 本手册，共 ${context.state.documents.length} 本。`, "success");
        } catch (error) {
            context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
        }
    }

export function bindUploads(context: AuditKingAppContext): void {
        const checklistInput = context.getElement<HTMLInputElement>("checklistInput");
        const manualInput = context.getElement<HTMLInputElement>("manualInput");

        checklistInput.addEventListener("change", () => {
            const file = checklistInput.files?.[0];
            checklistInput.value = "";
            if (file) void handleChecklistFile(context, file);
        });

        manualInput.addEventListener("change", () => {
            const files = Array.from(manualInput.files || []);
            manualInput.value = "";
            if (files.length) void handleManualFiles(context, files);
        });
    }
