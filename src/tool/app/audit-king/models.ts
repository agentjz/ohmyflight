export interface AuditKingTextBlock {
    id: string;
    documentId: string;
    documentName: string;
    blockIndex: number;
    title: string;
    text: string;
    pageNumber?: number;
}

export interface AuditKingDocument {
    id: string;
    name: string;
    blocks: AuditKingTextBlock[];
    enabled?: boolean;
    format?: "docx" | "pdf";
    pageCount?: number;
    sourceFile: File;
}

export interface AuditKingCheckItemSource {
    blockId?: string;
    blockIndex?: number;
    start?: number;
    end?: number;
    text?: string;
    beforeText?: string;
    afterText?: string;
}

export interface AuditKingManualEvidence {
    id?: string;
    sourceType?: "summary" | "selection" | "";
    documentId?: string;
    documentName: string;
    blockId?: string;
    blockIndex?: number;
    pageNumber?: number;
    title?: string;
    start?: number;
    end?: number;
    globalStart?: number;
    globalEnd?: number;
    text: string;
    beforeText?: string;
    afterText?: string;
    mode?: "exact" | "loose" | "";
    note?: string;
}

export interface AuditKingAuditEvidence {
    id: string;
    content: string;
    note: string;
    sourceEvidenceId?: string;
}

export interface AuditKingCheckItem {
    id: string;
    code: string;
    name: string;
    keyword: string;
    color: string;
    enabled: boolean;
    source?: AuditKingCheckItemSource;
    manualEvidences: AuditKingManualEvidence[];
    auditEvidences: AuditKingAuditEvidence[];
}

export interface AuditKingImportedCheckItem {
    id?: string;
    order?: number;
    code?: string;
    name?: string;
    keyword?: string;
    color?: string;
    enabled?: boolean;
    source?: AuditKingCheckItemSource;
    manualEvidences?: AuditKingManualEvidence[];
    auditEvidences?: AuditKingAuditEvidence[];
}

export interface AuditKingMatch {
    id: string;
    checkItemId: string;
    keywordText: string;
    keywordColor: string;
    documentId: string;
    documentName: string;
    blockId: string;
    blockIndex: number;
    pageNumber?: number;
    title: string;
    start: number;
    end: number;
    mode: "exact" | "loose";
    matchedText: string;
    blockText: string;
}

export interface AuditKingSearchResult {
    matches: AuditKingMatch[];
    countsByCheckItem: Record<string, number>;
}

export interface AuditKingIndexedBlock extends AuditKingTextBlock {
    looseText: string;
    looseOffsetMap: Array<{
        originalStart: number;
        originalEnd: number;
        normalizedText: string;
    }>;
}

export interface AuditKingDocumentIndex {
    documents: AuditKingDocument[];
    blocks: AuditKingIndexedBlock[];
    grams: Record<string, number[]>;
    flexIndex: any;
}

export interface AuditKingHighlightRange {
    checkItemId: string;
    color: string;
    start: number;
    end: number;
    kind?: "keyword" | "manual-evidence";
    evidenceId?: string;
}

export interface AuditKingEvidenceEntry {
    content: string;
    note: string;
}

export interface AuditKingEvidenceGroup {
    id: string;
    title: string;
    items: AuditKingEvidenceEntry[];
}

export interface AuditKingImportedAuditGroup {
    code: string;
    name: string;
    items: AuditKingEvidenceEntry[];
}

export interface AuditKingFolderScriptConfig {
    rangeText: string;
}

export interface AuditKingPdfLocatorPage {
    pdfId: string;
    pdfName: string;
    pageNumber: number;
    text: string;
}

export interface AuditKingPdfLocatorDocument {
    id: string;
    name: string;
    pageCount: number;
    arrayBuffer?: ArrayBuffer;
    pdf?: any;
    pages: AuditKingPdfLocatorPage[];
    sourceFile: File;
}

export interface AuditKingPdfLocatorTarget {
    sequence: string;
    title?: string;
    content: string;
    note?: string;
}

export interface AuditKingPdfLocatorResult {
    sequence: string;
    title: string;
    content: string;
    status: "trusted" | "review" | "miss" | "skip";
    pdfId?: string;
    pdfName?: string;
    startPage?: number;
    endPage?: number;
    coverage: number;
    orderRatio: number;
    score: number;
    matchedSegments: number;
    totalSegments: number;
    reason: string;
    snippets: string[];
    comparisons?: AuditKingPdfLocatorSegmentComparison[];
}

export interface AuditKingPdfLocatorSegmentComparison {
    text: string;
    matched: boolean;
}

export interface AuditKingPdfLocatorSlot {
    id: string;
    sequence: string;
    title: string;
    content: string;
    note: string;
    selected: boolean;
    pdfId: string;
    pdfName?: string;
    startPage: number | "";
    endPage: number | "";
    result?: AuditKingPdfLocatorResult;
}

export interface AuditKingPdfLocatorWorkspaceSnapshot {
    version: number;
    exportedAt: string;
    selectedSlotId: string;
    expandContextPages: boolean;
    slots: AuditKingPdfLocatorSlot[];
}

export interface AuditKingPdfLocatorExportTask {
    slotId: string;
    sequence: string;
    title: string;
    pdfId: string;
    pdfName: string;
    startPage: number;
    endPage: number;
    filename: string;
    skippedReason?: string;
}

export interface AuditKingPdfLocatorState {
    documents: AuditKingPdfLocatorDocument[];
    results: AuditKingPdfLocatorResult[];
    slots: AuditKingPdfLocatorSlot[];
    selectedSlotId: string;
    expandContextPages: boolean;
    summary: { trusted: number; review: number; miss: number; skip: number };
}

export interface AuditKingStateModel {
    checklistFile: File | null;
    checklistBlocks: AuditKingTextBlock[];
    documents: AuditKingDocument[];
    documentIndex: AuditKingDocumentIndex | null;
    checkItems: AuditKingCheckItem[];
    searchResult: AuditKingSearchResult;
    currentCheckItemId: string;
    documentFilterId: string;
    currentMatchIndex: number;
    currentDetailContextLength: number;
    pdfLocator: AuditKingPdfLocatorState;
}

export interface AuditProjectSourceMetadata {
    path: string;
    name: string;
    type: string;
}

export interface AuditProjectSnapshot {
    version: number;
    sources: {
        checklist: AuditProjectSourceMetadata;
        manuals: AuditProjectSourceMetadata[];
        locatorFiles: AuditProjectSourceMetadata[];
    };
    checkItems: AuditKingCheckItem[];
    pdfWorkspace: {
        slots: AuditKingPdfLocatorSlot[];
        selectedSlotId: string;
        expandContextPages: boolean;
    };
    view: {
        currentCheckItemId: string;
        documentFilterId: string;
    };
}

export interface AuditProjectBuildInput {
    checklistFile: File;
    manualFiles: File[];
    locatorFiles: File[];
    state: {
        checkItems: AuditKingCheckItem[];
        pdfWorkspace: AuditProjectSnapshot["pdfWorkspace"];
        view: AuditProjectSnapshot["view"];
    };
    workbook: Uint8Array;
    onProgress?: (message: string, completed: number, total: number) => void;
}

export interface AuditProjectReadResult {
    state: AuditProjectSnapshot;
    checklistFile: File;
    manualFiles: File[];
    locatorFiles: File[];
    workbook: Uint8Array;
}

export interface AuditProjectRestoreInput {
    checklistFile: File;
    checklistBlocks: AuditKingTextBlock[];
    documents: AuditKingDocument[];
    checkItems: AuditKingCheckItem[];
    locatorDocuments: AuditKingPdfLocatorDocument[];
    pdfWorkspace: AuditProjectSnapshot["pdfWorkspace"];
    view: AuditProjectSnapshot["view"];
}
