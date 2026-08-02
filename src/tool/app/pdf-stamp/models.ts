export type PdfStampRuleMode = "all" | "odd" | "even" | "range";
export type PdfStampResizeDirection = "tl" | "tr" | "bl" | "br";

export interface PdfStampRule {
    id: number;
    mode: PdfStampRuleMode;
    rangeStr: string;
    xMm: number;
    yMm: number;
    wMm: number;
    hMm: number;
    opacity: number;
    lockRatio: boolean;
}

export interface PdfStampLogicApi {
    MM2PT: number;
    createRule(id: number, imgAspect: number, overrides?: Partial<PdfStampRule>): PdfStampRule;
    parsePageRange(rangeStr: string, maxPage: number): number[];
    ruleMatchesPage(rule: Pick<PdfStampRule, "mode" | "rangeStr">, pageNum: number, maxPage: number): boolean;
    getRulesForPage(rules: PdfStampRule[], pageNum: number, maxPage: number): PdfStampRule[];
    buildStampDrawOptions(rule: PdfStampRule, pageHeightPt: number): {
        x: number;
        y: number;
        width: number;
        height: number;
        opacity: number;
    };
    updateRuleField(rule: PdfStampRule, field: keyof PdfStampRule, value: unknown, imgAspect: number): PdfStampRule;
    buildOverlayStyle(rule: PdfStampRule, renderScale: number): {
        leftPx: number;
        topPx: number;
        widthPx: number;
        heightPx: number;
        opacity: string;
    };
    applyOverlayMove(rule: PdfStampRule, input: {
        dxPx: number;
        dyPx: number;
        startLeftPx: number;
        startTopPx: number;
        widthPx: number;
        heightPx: number;
        canvasWidthPx: number;
        canvasHeightPx: number;
        renderScale: number;
    }): PdfStampRule;
    applyOverlayResize(rule: PdfStampRule, input: {
        direction: PdfStampResizeDirection;
        dxPx: number;
        dyPx: number;
        startLeftPx: number;
        startTopPx: number;
        startWidthPx: number;
        startHeightPx: number;
        renderScale: number;
        imgAspect: number;
    }): PdfStampRule;
    buildExportPlan(rules: PdfStampRule[], totalPages: number): Array<{ pageNum: number; rules: PdfStampRule[] }>;
}

export interface PdfStampPdfJsPage {
    getViewport(options: { scale: number }): { width: number; height: number };
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): { promise: Promise<void> };
}

export interface PdfStampPdfJsDocument {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfStampPdfJsPage>;
}

export interface PdfStampPdfJsApi {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument(options: { data: ArrayBuffer }): {
        onProgress?: (progress: { loaded: number; total: number }) => void;
        promise: Promise<PdfStampPdfJsDocument>;
    };
}

interface PdfStampEmbeddedImage {}

interface PdfStampPdfLibDocument {
    embedPng(bytes: ArrayBuffer): Promise<PdfStampEmbeddedImage>;
    embedJpg(bytes: ArrayBuffer): Promise<PdfStampEmbeddedImage>;
    getPageCount(): number;
    getPage(index: number): {
        getSize(): { height: number };
        drawImage(image: PdfStampEmbeddedImage, options: ReturnType<PdfStampLogicApi["buildStampDrawOptions"]>): void;
    };
    save(): Promise<Uint8Array>;
}

export interface PdfStampPdfLibApi {
    PDFDocument: {
        load(buffer: ArrayBuffer): Promise<PdfStampPdfLibDocument>;
    };
}

export interface PdfStampState {
    pdfArrayBuffer: ArrayBuffer | null;
    pdfDoc: PdfStampPdfJsDocument | null;
    pageCount: number;
    currentPage: number;
    pageWidth: number;
    pageHeight: number;
    renderScale: number;
    imgDataUrl: string | null;
    imgAspect: number;
    pdfFileName: string;
    rules: PdfStampRule[];
    activeRuleId: number | null;
    nextRuleId: number;
    previewMode: boolean;
}

export interface PdfStampAppContext {
    pdfjsLib: PdfStampPdfJsApi;
    PDFLib: PdfStampPdfLibApi;
    logic: PdfStampLogicApi;
    state: PdfStampState;
    getElement<T extends HTMLElement>(id: string): T;
    getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D;
    showStatus(message: string, type: string, progress?: number): void;
    readAsDataUrl(file: File): Promise<string>;
    download(blob: Blob, filename: string): void;
    getActiveRule(): PdfStampRule | null;
    replaceRule(rule: PdfStampRule): void;
    refreshRulesAndOverlay(): void;
    updateExportBtn(): void;
}
