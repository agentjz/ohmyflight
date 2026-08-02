import type { PdfStampAppContext, PdfStampResizeDirection } from "./models";
import { renderRules } from "./rule-actions";

export async function tryShowEditor(context: PdfStampAppContext): Promise<void> {
        if (!context.state.pdfDoc) return;
        context.getElement<HTMLElement>('editorSection').classList.remove('hidden');
        context.updateExportBtn();
        await renderPage(context);
        updateOverlay(context);
    }
export async function renderPage(context: PdfStampAppContext): Promise<void> {
        if (!context.state.pdfDoc) return;
        const page = await context.state.pdfDoc.getPage(context.state.currentPage);
        const viewportBase = page.getViewport({ scale: 1 });
        context.state.pageWidth = viewportBase.width;
        context.state.pageHeight = viewportBase.height;
        const wrap = context.getElement<HTMLElement>('canvasWrap');
        const maxWidth = (wrap.parentElement?.clientWidth || viewportBase.width) - 30;
        context.state.renderScale = Math.min(maxWidth / viewportBase.width, 2);
        const viewport = page.getViewport({ scale: context.state.renderScale });
        const canvas = context.getElement<HTMLCanvasElement>('pdfCanvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context.getCanvasContext(canvas), viewport }).promise;
        context.getElement<HTMLInputElement>('pageJump').value = String(context.state.currentPage);
        context.getElement<HTMLInputElement>('pageJump').max = String(context.state.pageCount);
        context.getElement<HTMLElement>('pageTotal').textContent = String(context.state.pageCount);
        if (context.state.previewMode) renderPreviewOverlays(context);
    }

export function updateOverlay(context: PdfStampAppContext): void {
        const overlay = context.getElement<HTMLElement>('imgOverlay');
        if (context.state.previewMode) {
            overlay.classList.add('hidden');
            return;
        }

        const rule = context.getActiveRule();
        if (!rule || !context.state.imgDataUrl) {
            overlay.classList.add('hidden');
            return;
        }

        if (!context.logic.ruleMatchesPage(rule, context.state.currentPage, context.state.pageCount)) {
            overlay.classList.add('hidden');
            context.getElement<HTMLElement>('canvasHint').textContent = '当前规则不适用于第 ' + context.state.currentPage + ' 页';
            return;
        }

        overlay.classList.remove('hidden');
        context.getElement<HTMLElement>('canvasHint').textContent = '拖拽图片定位，拖拽角点缩放';

        const image = context.getElement<HTMLImageElement>('overlayImg');
        if (image.src !== context.state.imgDataUrl) image.src = context.state.imgDataUrl;

        const style = context.logic.buildOverlayStyle(rule, context.state.renderScale);
        overlay.style.left = style.leftPx + 'px';
        overlay.style.top = style.topPx + 'px';
        overlay.style.width = style.widthPx + 'px';
        overlay.style.height = style.heightPx + 'px';
        image.style.opacity = style.opacity;
    }

export function renderPreviewOverlays(context: PdfStampAppContext): void {
        clearPreviewOverlays();
        if (!context.state.imgDataUrl) return;
        const wrap = context.getElement<HTMLElement>('canvasWrap');
        const pageNum = context.state.currentPage;

        for (const rule of context.state.rules) {
            if (!context.logic.ruleMatchesPage(rule, pageNum, context.state.pageCount)) continue;
            const style = context.logic.buildOverlayStyle(rule, context.state.renderScale);
            const div = document.createElement('div');
            div.className = 'preview-overlay';
            div.style.left = style.leftPx + 'px';
            div.style.top = style.topPx + 'px';
            div.style.width = style.widthPx + 'px';
            div.style.height = style.heightPx + 'px';
            const image = document.createElement('img');
            image.src = context.state.imgDataUrl;
            image.style.opacity = style.opacity;
            image.alt = '';
            div.appendChild(image);
            wrap.appendChild(div);
        }
    }

export function clearPreviewOverlays(): void {
        document.querySelectorAll('#canvasWrap .preview-overlay').forEach(element => element.remove());
    }

    async function changePage(context: PdfStampAppContext, delta: number): Promise<void> {
        const next = context.state.currentPage + delta;
        if (next < 1 || next > context.state.pageCount) return;
        context.state.currentPage = next;
        await renderPage(context);
        updateOverlay(context);
    }

    async function onPageJump(context: PdfStampAppContext): Promise<void> {
        let value = Number.parseInt(context.getElement<HTMLInputElement>('pageJump').value, 10) || 1;
        value = Math.max(1, Math.min(value, context.state.pageCount));
        context.state.currentPage = value;
        await renderPage(context);
        updateOverlay(context);
    }

    function onPreviewToggle(context: PdfStampAppContext): void {
        context.state.previewMode = context.getElement<HTMLInputElement>('previewMode').checked;
        const overlay = context.getElement<HTMLElement>('imgOverlay');
        if (context.state.previewMode) {
            overlay.classList.add('hidden');
            renderPreviewOverlays(context);
        } else {
            clearPreviewOverlays();
            updateOverlay(context);
        }
    }

    function setupDrag(context: PdfStampAppContext): void {
        const wrap = context.getElement<HTMLElement>('canvasWrap');
        const overlay = context.getElement<HTMLElement>('imgOverlay');
        let mode: string | null = null;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let startWidth = 0;
        let startHeight = 0;

        overlay.addEventListener('mousedown', onStart);
        overlay.addEventListener('touchstart', onStart, { passive: false });

        function onStart(event: MouseEvent | TouchEvent): void {
            if (context.state.previewMode) return;
            event.preventDefault();
            const target = event.target as HTMLElement;
            mode = target.classList.contains('resize-handle') ? 'resize-' + target.dataset.dir : 'move';
            const position = getEventPosition(event);
            startX = position.x;
            startY = position.y;
            startLeft = Number.parseFloat(overlay.style.left) || 0;
            startTop = Number.parseFloat(overlay.style.top) || 0;
            startWidth = Number.parseFloat(overlay.style.width) || 50;
            startHeight = Number.parseFloat(overlay.style.height) || 50;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        }

        function onMove(event: MouseEvent | TouchEvent): void {
            if (!mode) return;
            event.preventDefault();
            const rule = context.getActiveRule();
            if (!rule) return;
            const position = getEventPosition(event);
            const dx = position.x - startX;
            const dy = position.y - startY;
            const canvas = context.getElement<HTMLCanvasElement>('pdfCanvas');
            const nextRule = mode === 'move'
                ? context.logic.applyOverlayMove(rule, {
                    dxPx: dx,
                    dyPx: dy,
                    startLeftPx: startLeft,
                    startTopPx: startTop,
                    widthPx: startWidth,
                    heightPx: startHeight,
                    canvasWidthPx: canvas.width,
                    canvasHeightPx: canvas.height,
                    renderScale: context.state.renderScale
                })
                : context.logic.applyOverlayResize(rule, {
                    direction: mode.split('-')[1] as PdfStampResizeDirection,
                    dxPx: dx,
                    dyPx: dy,
                    startLeftPx: startLeft,
                    startTopPx: startTop,
                    startWidthPx: startWidth,
                    startHeightPx: startHeight,
                    renderScale: context.state.renderScale,
                    imgAspect: context.state.imgAspect
                });
            context.replaceRule(nextRule);
            const style = context.logic.buildOverlayStyle(nextRule, context.state.renderScale);
            overlay.style.left = style.leftPx + 'px';
            overlay.style.top = style.topPx + 'px';
            overlay.style.width = style.widthPx + 'px';
            overlay.style.height = style.heightPx + 'px';
            renderRules(context);
        }

        function onEnd(): void {
            mode = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        }

        function getEventPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
            const rect = wrap.getBoundingClientRect();
            if ('touches' in event && event.touches.length > 0) {
                return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
            }
            const mouseEvent = event as MouseEvent;
            return { x: mouseEvent.clientX - rect.left, y: mouseEvent.clientY - rect.top };
        }
    }

export function bindCanvasActions(context: PdfStampAppContext): void {
        context.getElement<HTMLButtonElement>('prevPage').addEventListener('click', () => { void changePage(context, -1); });
        context.getElement<HTMLButtonElement>('nextPage').addEventListener('click', () => { void changePage(context, 1); });
        context.getElement<HTMLInputElement>('pageJump').addEventListener('change', () => { void onPageJump(context); });
        context.getElement<HTMLInputElement>('previewMode').addEventListener('change', () => onPreviewToggle(context));
        setupDrag(context);
    }
