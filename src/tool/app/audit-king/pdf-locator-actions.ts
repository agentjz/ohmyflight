import type { AuditKingAppContext } from "./app-context";
import type {
    AuditKingPdfLocatorExportTask,
    AuditKingPdfLocatorResult,
    AuditKingPdfLocatorSlot,
    AuditKingStateModel
} from "./models";

    function render(context: AuditKingAppContext): void {
        context.runtime.PdfLocatorView.renderPdfLocator(context.state.pdfLocator);
    }
    function currentSlot(state: AuditKingStateModel): AuditKingPdfLocatorSlot | null {
        return state.pdfLocator.slots.find((slot) => slot.id === state.pdfLocator.selectedSlotId)
            || state.pdfLocator.slots[0]
            || null;
    }

    function selectFirstSlotIfNeeded(state: AuditKingStateModel): void {
        if (!state.pdfLocator.selectedSlotId && state.pdfLocator.slots[0]) {
            state.pdfLocator.selectedSlotId = state.pdfLocator.slots[0].id;
        }
        if (state.pdfLocator.selectedSlotId && !state.pdfLocator.slots.some((slot) => slot.id === state.pdfLocator.selectedSlotId)) {
            state.pdfLocator.selectedSlotId = state.pdfLocator.slots[0]?.id || "";
        }
    }

    function downloadTextFile(filename: string, content: string): void {
        const blob = new Blob([content], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function formatTimestamp(date: Date): string {
        const pad = (value: number) => String(value).padStart(2, "0");
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
    }

    async function previewCurrentSlot(context: AuditKingAppContext): Promise<void> {
        const slot = currentSlot(context.state);
        const container = context.getElement<HTMLElement>("pdfLocatorPreview");
        if (!slot) {
            container.innerHTML = `<div class="empty-panel">选择 PDF 和页码后预览。</div>`;
            return;
        }
        await context.runtime.PdfLocatorPreview.renderSlotPreview(slot, context.state.pdfLocator.documents, container);
    }

    function setSlots(context: AuditKingAppContext, slots: AuditKingPdfLocatorSlot[], message: string): void {
        context.state.pdfLocator.slots = slots;
        context.state.pdfLocator.results = slots
            .map((slot) => slot.result)
            .filter((result): result is AuditKingPdfLocatorResult => result !== undefined);
        context.state.pdfLocator.summary = context.runtime.PdfLocatorModel.summarizeResults(context.state.pdfLocator.results);
        context.state.pdfLocator.selectedSlotId = slots[0]?.id || "";
        render(context);
        context.runtime.View.renderStatus(message, "success");
    }

    function syncExpandContextInput(context: AuditKingAppContext): void {
        context.getElement<HTMLInputElement>("pdfLocatorExpandContextInput").checked = context.state.pdfLocator.expandContextPages !== false;
    }

    function updateSlot(context: AuditKingAppContext, slotId: string, patch: Partial<AuditKingPdfLocatorSlot>): void {
        context.state.pdfLocator.slots = context.runtime.PdfLocatorModel.updateSlotField(context.state.pdfLocator.slots, slotId, patch);
        selectFirstSlotIfNeeded(context.state);
        context.state.pdfLocator.results = context.state.pdfLocator.slots
            .map((slot) => slot.result)
            .filter((result): result is AuditKingPdfLocatorResult => result !== undefined);
        context.state.pdfLocator.summary = context.runtime.PdfLocatorModel.summarizeResults(context.state.pdfLocator.results);
        render(context);
    }

export function bindPdfLocatorActions(context: AuditKingAppContext): void {
        const pdfInput = context.getElement<HTMLInputElement>("pdfLocatorPdfInput");
        const workspaceInput = context.getElement<HTMLInputElement>("pdfLocatorWorkspaceInput");
        syncExpandContextInput(context);

        context.getElement<HTMLButtonElement>("pdfLocatorUploadBtn").addEventListener("click", () => {
            pdfInput.click();
        });

        pdfInput.addEventListener("change", async () => {
            const files = Array.from(pdfInput.files || []);
            pdfInput.value = "";
            if (!files.length) return;
            try {
                const documents = await context.runtime.PdfLocatorReader.readPdfFiles(files);
                context.state.pdfLocator.documents.push(...documents);
                context.state.pdfLocator.slots = context.runtime.PdfLocatorModel.rebindWorkspaceSlotsToDocuments(
                    context.state.pdfLocator.slots,
                    context.state.pdfLocator.documents
                );
                render(context);
                context.runtime.View.renderStatus(`已读取 ${documents.length} 个 PDF。`, "success");
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });

        context.getElement<HTMLButtonElement>("pdfLocatorImportWorkspaceBtn").addEventListener("click", () => {
            workspaceInput.click();
        });

        workspaceInput.addEventListener("change", async () => {
            const file = workspaceInput.files?.[0];
            workspaceInput.value = "";
            if (!file) return;
            try {
                const text = await file.text();
                const restored = context.runtime.PdfLocatorModel.parseWorkspace(text, context.state.pdfLocator.documents);
                context.state.pdfLocator.slots = restored.slots;
                context.state.pdfLocator.selectedSlotId = restored.selectedSlotId;
                context.state.pdfLocator.expandContextPages = restored.expandContextPages;
                context.state.pdfLocator.results = restored.slots
                    .map((slot: AuditKingPdfLocatorSlot) => slot.result)
                    .filter((result): result is AuditKingPdfLocatorResult => result !== undefined);
                context.state.pdfLocator.summary = context.runtime.PdfLocatorModel.summarizeResults(context.state.pdfLocator.results);
                syncExpandContextInput(context);
                render(context);
                context.runtime.View.renderStatus(`已导入 PDF 工作区：${restored.slots.length} 个槽位。`, "success");
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });

        context.getElement<HTMLButtonElement>("pdfLocatorExportWorkspaceBtn").addEventListener("click", () => {
            if (!context.state.pdfLocator.slots.length) {
                context.runtime.View.renderStatus("当前 PDF 工作区没有可导出的槽位。", "error");
                return;
            }
            const json = context.runtime.PdfLocatorModel.serializeWorkspace(
                context.state.pdfLocator.slots,
                context.state.pdfLocator.documents,
                context.state.pdfLocator.selectedSlotId,
                context.state.pdfLocator.expandContextPages
            );
            downloadTextFile(`审计之王_PDF工作区_${formatTimestamp(new Date())}.json`, json);
            context.runtime.View.renderStatus("已导出 PDF 工作区。", "success");
        });

        context.getElement<HTMLInputElement>("pdfLocatorExpandContextInput").addEventListener("change", (event) => {
            context.state.pdfLocator.expandContextPages = (event.target as HTMLInputElement).checked;
        });

        context.getElement<HTMLButtonElement>("pdfLocatorBuildFromBasketBtn").addEventListener("click", () => {
            const evidenceGroups = context.runtime.State.buildEvidenceGroups(context.state);
            if (!evidenceGroups.length) {
                context.runtime.View.renderStatus("请先在审计篮子中导入或填写依据。", "error");
                return;
            }
            setSlots(
                context,
                context.runtime.PdfLocatorModel.buildSlotsFromEvidenceGroups(evidenceGroups),
                "已从审计篮子生成 PDF 证据槽。"
            );
        });

        context.getElement<HTMLButtonElement>("pdfLocatorBuildEmptyBtn").addEventListener("click", () => {
            try {
                const rangeText = context.getElement<HTMLInputElement>("pdfLocatorRangeInput").value;
                setSlots(
                    context,
                    context.runtime.PdfLocatorModel.buildEmptySlotsFromRange(rangeText),
                    "已生成空 PDF 证据槽。"
                );
            } catch (error) {
                context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
            }
        });

        context.getElement<HTMLButtonElement>("pdfLocatorRunBtn").addEventListener("click", () => {
            if (!context.state.pdfLocator.documents.length) {
                context.runtime.View.renderStatus("请先上传 PDF。", "error");
                return;
            }
            if (!context.state.pdfLocator.slots.length) {
                const evidenceGroups = context.runtime.State.buildEvidenceGroups(context.state);
                if (!evidenceGroups.length) {
                    context.runtime.View.renderStatus("请先从审计篮子生成槽位，或生成空槽。", "error");
                    return;
                }
                context.state.pdfLocator.slots = context.runtime.PdfLocatorModel.buildSlotsFromEvidenceGroups(evidenceGroups);
            }
            const slots = context.runtime.PdfLocatorModel.locateSlots(context.state.pdfLocator.slots, context.state.pdfLocator.documents, {
                expandContextPages: context.state.pdfLocator.expandContextPages
            });
            context.state.pdfLocator.slots = slots;
            context.state.pdfLocator.results = slots
                .map((slot: AuditKingPdfLocatorSlot) => slot.result)
                .filter((result): result is AuditKingPdfLocatorResult => result !== undefined);
            context.state.pdfLocator.summary = context.runtime.PdfLocatorModel.summarizeResults(context.state.pdfLocator.results);
            selectFirstSlotIfNeeded(context.state);
            render(context);
            context.runtime.View.renderStatus("PDF 证据槽自动识别完成，可人工调整 PDF 和页码。", "success");
        });

        context.getElement<HTMLButtonElement>("pdfLocatorClearBtn").addEventListener("click", () => {
            context.state.pdfLocator.documents = [];
            context.state.pdfLocator.results = [];
            context.state.pdfLocator.slots = [];
            context.state.pdfLocator.selectedSlotId = "";
            context.state.pdfLocator.expandContextPages = true;
            context.state.pdfLocator.summary = context.runtime.PdfLocatorModel.summarizeResults([]);
            syncExpandContextInput(context);
            render(context);
            context.getElement<HTMLElement>("pdfLocatorPreview").innerHTML = `<div class="empty-panel">选择 PDF 和页码后预览。</div>`;
            context.runtime.View.renderStatus("已清空 PDF 证据工作区。", "success");
        });

        context.getElement<HTMLButtonElement>("pdfLocatorExportSelectedBtn").addEventListener("click", async () => {
            await exportSlots(context, { onlySelected: true });
        });

        context.getElement<HTMLButtonElement>("pdfLocatorExportAllBtn").addEventListener("click", async () => {
            await exportSlots(context, {});
        });

        context.getElement<HTMLElement>("pdfLocatorResultList").addEventListener("click", async (event) => {
            const target = event.target as HTMLElement;
            const actionElement = target.closest<HTMLElement>("[data-action]");
            if (!actionElement) return;
            const action = actionElement.dataset.action || "";
            const slotId = actionElement.dataset.slotId || actionElement.closest<HTMLElement>("[data-slot-id]")?.dataset.slotId || "";
            if (!slotId) return;

            if (action === "select-pdf-slot") {
                context.state.pdfLocator.selectedSlotId = slotId;
                render(context);
                try {
                    await previewCurrentSlot(context);
                } catch (error) {
                    context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
                }
                return;
            }
            if (action === "export-pdf-slot") {
                await exportSlots(context, { slotId });
            }
        });

        context.getElement<HTMLElement>("pdfLocatorResultList").addEventListener("change", async (event) => {
            const target = event.target as HTMLInputElement | HTMLSelectElement;
            const action = target.dataset.action || "";
            const slotId = target.dataset.slotId || "";
            if (!slotId) return;
            context.state.pdfLocator.selectedSlotId = slotId;
            if (action === "edit-pdf-slot-selected") {
                updateSlot(context, slotId, { selected: (target as HTMLInputElement).checked });
            }
            if (action === "edit-pdf-slot-sequence") {
                updateSlot(context, slotId, { sequence: target.value.trim() });
            }
            if (action === "edit-pdf-slot-title") {
                updateSlot(context, slotId, { title: target.value.trim() });
            }
            if (action === "edit-pdf-slot-pdf") {
                const documentItem = context.state.pdfLocator.documents.find((item) => item.id === target.value);
                updateSlot(context, slotId, { pdfId: target.value, pdfName: documentItem?.name || "" });
            }
            if (action === "edit-pdf-slot-start") {
                updateSlot(context, slotId, { startPage: target.value ? Number(target.value) : "" });
            }
            if (action === "edit-pdf-slot-end") {
                updateSlot(context, slotId, { endPage: target.value ? Number(target.value) : "" });
            }
            if (["edit-pdf-slot-pdf", "edit-pdf-slot-start", "edit-pdf-slot-end"].includes(action)) {
                try {
                    await previewCurrentSlot(context);
                } catch (error) {
                    context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
                }
            }
        });
    }

    async function exportSlots(context: AuditKingAppContext, options: { onlySelected?: boolean; slotId?: string }): Promise<void> {
        try {
            const tasks = context.runtime.PdfLocatorModel.buildExportTasks(context.state.pdfLocator.slots, context.state.pdfLocator.documents, options);
            const skipped = tasks.filter((task: AuditKingPdfLocatorExportTask) => task.skippedReason);
            const result = await context.runtime.PdfLocatorExport.exportTasks(tasks, context.state.pdfLocator.documents);
            const skippedText = skipped.length ? `，跳过 ${skipped.length} 条` : "";
            context.runtime.View.renderStatus(`已导出 ${result.exported} 条 PDF 证据${skippedText}。`, "success");
        } catch (error) {
            context.runtime.View.renderStatus(error instanceof Error ? error.message : String(error), "error");
        }
    }
