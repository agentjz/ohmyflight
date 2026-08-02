import { createAppContext } from "./app-context";
import { bindCanvasActions } from "./canvas-actions";
import { bindExport } from "./export-actions";
import type { PdfStampPdfJsApi, PdfStampPdfLibApi } from "./models";
import { bindRuleActions } from "./rule-actions";
import { bindUploads } from "./upload-actions";

function init(): void {
        const browserWindow = window as typeof window & { pdfjsLib: unknown; PDFLib: unknown };
        const pdfjsLib = browserWindow.pdfjsLib as PdfStampPdfJsApi;
        const PDFLib = browserWindow.PDFLib as PdfStampPdfLibApi;
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../../../libs/pdf.worker.min.js';
        const context = createAppContext(pdfjsLib, PDFLib);
        bindUploads(context);
        bindRuleActions(context);
        bindCanvasActions(context);
        bindExport(context);
    }

document.addEventListener('DOMContentLoaded', init);
