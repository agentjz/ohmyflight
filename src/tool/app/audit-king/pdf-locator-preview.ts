import type { AuditKingPdfLocatorDocument, AuditKingPdfLocatorSlot } from "./models";
    const PREVIEW_SCALE = 1.15;
    const MAX_OUTPUT_SCALE = 2.5;

    function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Canvas 2D 不可用。");
        }
        return context;
    }

    function getPageRange(slot: AuditKingPdfLocatorSlot, documentItem: AuditKingPdfLocatorDocument): number[] {
        const startPage = Number(slot.startPage);
        const endPage = Number(slot.endPage);
        if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
            throw new Error("请先填写页码范围。");
        }
        const start = Math.max(1, Math.min(Math.trunc(startPage), Math.trunc(endPage)));
        const end = Math.min(documentItem.pageCount, Math.max(Math.trunc(startPage), Math.trunc(endPage)));
        const pages: number[] = [];
        for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
            pages.push(pageNumber);
        }
        return pages;
    }

    async function renderSlotPreview(
        slot: AuditKingPdfLocatorSlot,
        documents: AuditKingPdfLocatorDocument[],
        container: HTMLElement
    ): Promise<void> {
        const documentItem = documents.find((item) => item.id === slot.pdfId);
        if (!documentItem || !documentItem.pdf) {
            container.innerHTML = `<div class="empty-panel">选择 PDF 和页码后预览。</div>`;
            return;
        }
        const pages = getPageRange(slot, documentItem);
        container.innerHTML = "";
        for (const pageNumber of pages) {
            const page = await documentItem.pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale: PREVIEW_SCALE });
            const outputScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_OUTPUT_SCALE);
            const wrapper = document.createElement("div");
            wrapper.className = "pdf-preview-page";
            const label = document.createElement("div");
            label.className = "pdf-preview-label";
            label.textContent = `${documentItem.name} / 第 ${pageNumber} 页`;
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;
            wrapper.append(label, canvas);
            container.appendChild(wrapper);
            await page.render({
                canvasContext: getCanvasContext(canvas),
                viewport,
                transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
            }).promise;
        }
    }

export const AuditKingPdfLocatorPreview = {
        renderSlotPreview
    };
