import { tryShowEditor } from "./canvas-actions";
import type { PdfStampAppContext } from "./models";
import { addRule } from "./rule-actions";

    function setupUploadArea(
        context: PdfStampAppContext,
        areaId: string,
        inputId: string,
        handler: (file: File) => Promise<void>
    ): void {
        const area = context.getElement<HTMLElement>(areaId);
        const input = context.getElement<HTMLInputElement>(inputId);
        area.onclick = () => input.click();
        area.ondragover = event => {
            event.preventDefault();
            area.classList.add('dragover');
        };
        area.ondragleave = () => area.classList.remove('dragover');
        area.ondrop = event => {
            event.preventDefault();
            area.classList.remove('dragover');
            const file = event.dataTransfer?.files?.[0];
            if (file) void handler(file);
        };
        input.onchange = event => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) void handler(file);
            target.value = '';
        };
    }
    async function handlePdfFile(context: PdfStampAppContext, file: File): Promise<void> {
        context.showStatus('加载 PDF...', 'info', 0);
        try {
            context.state.pdfArrayBuffer = await file.arrayBuffer();
            const task = context.pdfjsLib.getDocument({ data: context.state.pdfArrayBuffer.slice(0) });
            task.onProgress = (progress: { loaded: number; total: number }) => {
                if (progress.total > 0) {
                    context.showStatus('加载 PDF... ' + Math.round(progress.loaded / progress.total * 100) + '%', 'info', progress.loaded / progress.total * 100);
                }
            };
            context.state.pdfDoc = await task.promise;
            context.state.pageCount = context.state.pdfDoc.numPages;
            context.state.currentPage = 1;
            context.state.pdfFileName = file.name.replace(/\.pdf$/i, '');
            const area = context.getElement<HTMLElement>('pdfUpload');
            area.classList.add('has-file');
            (area.querySelector('p') as HTMLElement).textContent = file.name;
            (area.querySelector('small') as HTMLElement).textContent = context.state.pageCount + ' 页';
            context.showStatus('PDF 已加载: ' + file.name + ' (' + context.state.pageCount + ' 页)', 'success');
            await tryShowEditor(context);
        } catch (error) {
            context.showStatus('PDF 加载失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    }

    async function handleImgFile(context: PdfStampAppContext, file: File): Promise<void> {
        try {
            const dataUrl = await context.readAsDataUrl(file);
            const image = new Image();
            image.onload = function () {
                context.state.imgDataUrl = dataUrl;
                context.state.imgAspect = image.naturalWidth / image.naturalHeight;
                const area = context.getElement<HTMLElement>('imgUpload');
                area.classList.add('has-file');
                (area.querySelector('p') as HTMLElement).textContent = file.name;
                (area.querySelector('small') as HTMLElement).textContent = image.naturalWidth + ' x ' + image.naturalHeight + ' px';
                context.showStatus('图片已加载', 'success');
                if (context.state.rules.length === 0) {
                    addRule(context);
                }
                context.updateExportBtn();
                void tryShowEditor(context);
            };
            image.src = dataUrl;
        } catch (error) {
            context.showStatus('图片加载失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    }

export function bindUploads(context: PdfStampAppContext): void {
        setupUploadArea(context, 'pdfUpload', 'pdfInput', file => handlePdfFile(context, file));
        setupUploadArea(context, 'imgUpload', 'imgInput', file => handleImgFile(context, file));
    }
