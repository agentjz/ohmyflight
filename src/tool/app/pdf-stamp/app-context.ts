import { updateOverlay } from "./canvas-actions";
import * as logic from "./logic";
import type { PdfStampAppContext, PdfStampPdfJsApi, PdfStampPdfLibApi, PdfStampRule, PdfStampState } from "./models";
import { renderRules } from "./rule-actions";

export function createAppContext(pdfjsLib: PdfStampPdfJsApi, PDFLib: PdfStampPdfLibApi): PdfStampAppContext {
        const state: PdfStampState = {
            pdfArrayBuffer: null,
            pdfDoc: null,
            pageCount: 0,
            currentPage: 1,
            pageWidth: 0,
            pageHeight: 0,
            renderScale: 1,
            imgDataUrl: null,
            imgAspect: 1,
            pdfFileName: '',
            rules: [],
            activeRuleId: null,
            nextRuleId: 1,
            previewMode: false
        };

        function getElement<T extends HTMLElement>(id: string): T {
            return document.getElementById(id) as T;
        }

        function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Canvas 2D context unavailable');
            }
            return context;
        }

        function showStatus(message: string, type: string, progress?: number): void {
            const statusBar = getElement<HTMLElement>('statusBar');
            getElement<HTMLElement>('statusText').textContent = message;
            statusBar.className = 'status-bar ' + (type || 'info');
            statusBar.classList.remove('hidden');

            const progressWrap = getElement<HTMLElement>('progressWrap');
            const progressBar = getElement<HTMLElement>('progressBar');
            if (progress !== undefined && progress >= 0) {
                progressWrap.classList.remove('hidden');
                progressBar.style.width = Math.min(100, Math.round(progress)) + '%';
            } else {
                progressWrap.classList.add('hidden');
            }
        }

        function readAsDataUrl(file: File): Promise<string> {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result !== 'string') {
                        reject(new Error('图片读取失败'));
                        return;
                    }
                    resolve(reader.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        function download(blob: Blob, filename: string): void {
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            URL.revokeObjectURL(url);
        }

        function getActiveRule(): PdfStampRule | null {
            return state.rules.find(rule => rule.id === state.activeRuleId) || null;
        }

        function replaceRule(rule: PdfStampRule): void {
            state.rules = state.rules.map(item => item.id === rule.id ? rule : item);
        }

        function refreshRulesAndOverlay(): void {
            renderRules(context);
            updateOverlay(context);
        }

        function updateExportBtn(): void {
            const button = getElement<HTMLButtonElement>('exportBtn');
            const hint = getElement<HTMLElement>('exportHint');
            if (!state.imgDataUrl) {
                button.disabled = true;
                hint.textContent = '请先上传图片';
            } else if (state.rules.length === 0) {
                button.disabled = true;
                hint.textContent = '请添加至少一条规则';
            } else {
                button.disabled = false;
                hint.textContent = state.rules.length + ' 条规则';
            }
        }

        const context: PdfStampAppContext = {
            pdfjsLib,
            PDFLib,
            logic,
            state,
            getElement,
            getCanvasContext,
            showStatus,
            readAsDataUrl,
            download,
            getActiveRule,
            replaceRule,
            refreshRulesAndOverlay,
            updateExportBtn
        };

        return context;
    }
