import type { LocalManual, ManualUnit } from "./models";

    type PdfPageShell = { shell: HTMLElement; content: HTMLElement; pageNumber: number };

    class PdfDocumentView {
        private manualId = "";
        private manual: LocalManual | null = null;
        private pageShells = new Map<number, PdfPageShell>();
        private renderedPages = new Set<number>();
        private renderingPages = new Map<number, Promise<void>>();
        private requestId = 0;
        private renderScale = 1;
        private scrollFrame: number | null = null;
        private retainStart = 1;
        private retainEnd = 0;

        constructor(private readonly container: HTMLElement) {
            this.container.addEventListener("scroll", () => this.scheduleVisiblePages());
        }

        reset(): void {
            this.clearDocument();
        }

        async show(manual: LocalManual, focusUnits: ManualUnit[], emptyMessage: string): Promise<void> {
            if (manual.format !== "pdf" || !manual.pdfDocument) {
                this.container.innerHTML = '<div class="preview-empty">当前一侧不是 PDF 文档。</div>';
                this.clearDocument();
                return;
            }
            if (this.manualId !== manual.id) await this.renderDocumentShells(manual);
            const pageNumber = focusUnits.find((unit) => unit.pageNumber)?.pageNumber;
            if (!pageNumber) {
                if (!this.pageShells.size) this.container.innerHTML = `<div class="preview-empty">${escapeHtml(emptyMessage)}</div>`;
                return;
            }
            const requestId = ++this.requestId;
            const pageShell = this.pageShells.get(pageNumber);
            if (!pageShell) return;
            const containerRect = this.container.getBoundingClientRect();
            const pageRect = pageShell.shell.getBoundingClientRect();
            this.container.scrollTop = calculateTopAlignedScrollTop(
                this.container.scrollTop,
                containerRect.top,
                pageRect.top
            );
            await this.updatePageWindow(pageNumber);
            if (requestId !== this.requestId) return;
        }

        private async renderDocumentShells(manual: LocalManual): Promise<void> {
            this.clearDocument();
            this.manual = manual;
            this.manualId = manual.id;
            const startPage = manual.pdfStartPage || 1;
            const endPage = manual.pdfEndPage || manual.pageCount || startPage;
            const firstPage = await manual.pdfDocument.getPage(startPage);
            const baseViewport = firstPage.getViewport({ scale: 1 });
            const availableWidth = Math.max(280, this.container.clientWidth - 40);
            this.renderScale = Math.min(1.25, availableWidth / Math.max(1, baseViewport.width));
            const estimatedViewport = firstPage.getViewport({ scale: this.renderScale });
            const fragment = document.createDocumentFragment();
            for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
                const shell = document.createElement("section");
                shell.className = "pdf-page-shell";
                shell.dataset.pageNumber = String(pageNumber);
                const label = document.createElement("div");
                label.className = "pdf-page-label";
                label.textContent = `${manual.name} / 第 ${pageNumber} 页`;
                const content = document.createElement("div");
                content.className = "pdf-page-content";
                content.style.minHeight = `${Math.ceil(estimatedViewport.height)}px`;
                content.innerHTML = '<div class="pdf-page-loading">滚动到此页时加载</div>';
                shell.append(label, content);
                this.pageShells.set(pageNumber, { shell, content, pageNumber });
                fragment.appendChild(shell);
            }
            this.container.replaceChildren(fragment);
            this.container.scrollTop = 0;
            await this.updatePageWindow(startPage);
        }

        private scheduleVisiblePages(): void {
            if (!this.manual || this.scrollFrame !== null) return;
            this.scrollFrame = requestAnimationFrame(() => {
                this.scrollFrame = null;
                const centerPage = this.findCenterPage();
                if (centerPage) void this.updatePageWindow(centerPage);
            });
        }

        private findCenterPage(): number | null {
            const center = this.container.scrollTop + this.container.clientHeight / 2;
            let nearest: PdfPageShell | null = null;
            let nearestDistance = Number.POSITIVE_INFINITY;
            this.pageShells.forEach((pageShell) => {
                const pageCenter = pageShell.shell.offsetTop + pageShell.shell.offsetHeight / 2;
                const distance = Math.abs(pageCenter - center);
                if (distance >= nearestDistance) return;
                nearest = pageShell;
                nearestDistance = distance;
            });
            return nearest ? (nearest as PdfPageShell).pageNumber : null;
        }

        private async updatePageWindow(centerPage: number): Promise<void> {
            const manual = this.manual;
            if (!manual) return;
            const startPage = manual.pdfStartPage || 1;
            const endPage = manual.pdfEndPage || manual.pageCount || startPage;
            const relative = calculatePdfPageWindow(centerPage - startPage + 1, endPage - startPage + 1);
            const renderStart = relative.renderStart + startPage - 1;
            const renderEnd = relative.renderEnd + startPage - 1;
            const retainStart = relative.retainStart + startPage - 1;
            const retainEnd = relative.retainEnd + startPage - 1;
            this.retainStart = retainStart;
            this.retainEnd = retainEnd;
            Array.from(this.renderedPages).forEach((pageNumber) => {
                if (pageNumber >= retainStart && pageNumber <= retainEnd) return;
                this.releasePage(pageNumber);
            });
            const pending: Promise<void>[] = [];
            for (let pageNumber = renderStart; pageNumber <= renderEnd; pageNumber += 1) {
                pending.push(this.renderPage(pageNumber));
            }
            await Promise.all(pending);
        }

        private renderPage(pageNumber: number): Promise<void> {
            if (this.renderedPages.has(pageNumber)) return Promise.resolve();
            const running = this.renderingPages.get(pageNumber);
            if (running) return running;
            const manual = this.manual;
            const pageShell = this.pageShells.get(pageNumber);
            if (!manual?.pdfDocument || !pageShell) return Promise.resolve();
            const manualId = this.manualId;
            pageShell.content.innerHTML = '<div class="pdf-page-loading">正在读取原始页...</div>';
            const promise = (async () => {
                const page = await manual.pdfDocument.getPage(pageNumber);
                const viewport = page.getViewport({ scale: this.renderScale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext("2d");
            if (!context) throw new Error("无法创建 PDF 原页画布。 ");
            await page.render({ canvasContext: context, viewport }).promise;
                if (this.manualId !== manualId) {
                    canvas.width = 0;
                    canvas.height = 0;
                    return;
                }
                if (pageNumber < this.retainStart || pageNumber > this.retainEnd) {
                    canvas.width = 0;
                    canvas.height = 0;
                    return;
                }
                pageShell.content.style.minHeight = `${canvas.height}px`;
                pageShell.content.replaceChildren(canvas);
                this.renderedPages.add(pageNumber);
            })().catch((error) => {
                pageShell.content.innerHTML = `<div class="pdf-page-loading">${escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
            }).finally(() => {
                this.renderingPages.delete(pageNumber);
            });
            this.renderingPages.set(pageNumber, promise);
            return promise;
        }

        private releasePage(pageNumber: number): void {
            const pageShell = this.pageShells.get(pageNumber);
            if (!pageShell) return;
            pageShell.content.querySelectorAll("canvas").forEach((canvas) => {
                canvas.width = 0;
                canvas.height = 0;
            });
            pageShell.content.innerHTML = '<div class="pdf-page-loading">滚动到此页时加载</div>';
            this.renderedPages.delete(pageNumber);
        }

        private clearDocument(): void {
            this.requestId += 1;
            this.renderedPages.forEach((pageNumber) => this.releasePage(pageNumber));
            this.manual = null;
            this.manualId = "";
            this.pageShells.clear();
            this.renderingPages.clear();
            this.retainStart = 1;
            this.retainEnd = 0;
        }
    }

    function calculatePdfPageWindow(
        centerPage: number,
        pageCount: number,
        renderRadius = 1,
        retainRadius = 3
    ): { renderStart: number; renderEnd: number; retainStart: number; retainEnd: number } {
        const center = Math.max(1, Math.min(Math.trunc(centerPage) || 1, Math.max(1, pageCount)));
        return {
            renderStart: Math.max(1, center - renderRadius),
            renderEnd: Math.min(pageCount, center + renderRadius),
            retainStart: Math.max(1, center - retainRadius),
            retainEnd: Math.min(pageCount, center + retainRadius)
        };
    }

    function calculateTopAlignedScrollTop(
        currentScrollTop: number,
        containerTop: number,
        targetTop: number,
        padding = 10
    ): number {
        return Math.max(0, Math.round(currentScrollTop + targetTop - containerTop - padding));
    }


    function escapeHtml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

export { PdfDocumentView, calculatePdfPageWindow, calculateTopAlignedScrollTop };
