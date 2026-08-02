export type ManualRole = "my" | "reference";
export type ManualFormat = "docx" | "pdf";
export type ManualUnitKind = "paragraph" | "table-row" | "pdf-paragraph";
export type RevisionKind = "reference-added" | "reference-removed" | "modified" | "review";
export type DiffKind = "equal" | "added" | "removed";
export type RevisionDecision = "pending" | "included" | "excluded";
export type RevisionDecisionMap = Record<string, RevisionDecision>;

export interface RevisionDecisionSummary {
    pending: number;
    included: number;
    excluded: number;
}

export interface AlignmentMatch {
    myStart: number;
    myEnd: number;
    referenceStart: number;
    referenceEnd: number;
    exact: boolean;
    similarity: number;
}

export interface ManualUnit {
    id: string;
    manualId: string;
    index: number;
    kind: ManualUnitKind;
    text: string;
    title: string;
    pageNumber?: number;
}

export interface LocalManual {
    id: string;
    role: ManualRole;
    name: string;
    format: ManualFormat;
    units: ManualUnit[];
    sourceFile: File;
    pageCount?: number;
    pdfStartPage?: number;
    pdfEndPage?: number;
    pdfDocument?: any;
}

export interface WorkerManual {
    id: string;
    name: string;
    units: ManualUnit[];
}

export interface ComparisonSlice {
    id: string;
    manualId: string;
    index: number;
    unitId: string;
    unitIndex: number;
    text: string;
    normalized: string;
    grams: string[];
    tokens: string[];
    title: string;
    pageNumber?: number;
}

export interface DiffSegment {
    kind: DiffKind;
    text: string;
}

export interface RevisionContextAnchor {
    position: "before" | "after";
    mySliceId: string;
    referenceSliceId: string;
    myUnitId: string;
    referenceUnitId: string;
    myText: string;
    referenceText: string;
    myUnitIndex: number;
    referenceUnitIndex: number;
    myPageNumber?: number;
    referencePageNumber?: number;
    exact: boolean;
    similarity: number;
}

export interface RevisionEvent {
    id: string;
    kind: RevisionKind;
    title: string;
    mySliceIds: string[];
    referenceSliceIds: string[];
    myUnitIds: string[];
    referenceUnitIds: string[];
    myText: string;
    referenceText: string;
    myLocation: string;
    referenceLocation: string;
    similarity: number;
    myTokensOnly: string[];
    referenceTokensOnly: string[];
    myDiff: DiffSegment[];
    referenceDiff: DiffSegment[];
    contextAnchors: RevisionContextAnchor[];
    reason: string;
}

export interface RevisionNavigationEvent extends RevisionEvent {
    viewChapter?: string;
    searchScore?: number;
    matchedSide?: "title" | "my" | "reference" | "both";
    matchedExcerpt?: string;
}

export interface RevisionCategoryCount {
    kind: RevisionKind | "all";
    label: string;
    total: number;
    matched: number;
}

export interface RevisionSectionGroup {
    key: string;
    label: string;
    count: number;
    startEventId: string;
    events: RevisionNavigationEvent[];
}

export interface RevisionChapterGroup {
    key: string;
    label: string;
    count: number;
    sections: RevisionSectionGroup[];
}

export interface ReportTextRun {
    text: string;
    color: "000000" | "FF0000" | "00B0F0";
}

export interface RevisionReportRow {
    kind: RevisionKind;
    chapter: string;
    number: string;
    title: string;
    explanation: string;
    myLocation: string;
    referenceLocation: string;
    myRuns: ReportTextRun[];
    referenceRuns: ReportTextRun[];
}

export interface RevisionReportGroup {
    key: string;
    kind: RevisionKind;
    chapter: string;
    number: string;
    title: string;
    rows: RevisionReportRow[];
}

export interface ComparisonSummary {
    myManualName: string;
    referenceManualName: string;
    mySliceCount: number;
    referenceSliceCount: number;
    exactAnchorCount: number;
    sameSliceCount: number;
    referenceAddedCount: number;
    referenceRemovedCount: number;
    modifiedCount: number;
    reviewCount: number;
}

export interface ManualComparison {
    mySlices: ComparisonSlice[];
    referenceSlices: ComparisonSlice[];
    events: RevisionEvent[];
    summary: ComparisonSummary;
}

export interface ComparisonOptions {
    weakPhrases?: string[];
    minimumCandidateSimilarity?: number;
}

export interface ProofProjectManualMetadata {
    path: string;
    name: string;
    type: string;
    range: { startPage: number | ""; endPage: number | "" };
}

export interface ProofProjectViewState {
    filter: RevisionKind | "all";
    query: string;
    selectedId: string;
    expandedChapterKey: string;
    onlyIncluded?: boolean;
    scrollTop?: number;
}

export interface ProofProjectSnapshot {
    version: number;
    manuals: { my: ProofProjectManualMetadata; reference: ProofProjectManualMetadata };
    comparison: ManualComparison;
    decisions: RevisionDecisionMap;
    view: ProofProjectViewState;
}

export interface ProofProjectBuildInput {
    myFile: File;
    referenceFile: File;
    myRange: { startPage: number | ""; endPage: number | "" };
    referenceRange: { startPage: number | ""; endPage: number | "" };
    comparison: ManualComparison;
    decisions: RevisionDecisionMap;
    view: ProofProjectViewState;
    workbook: Uint8Array;
    onProgress?: (message: string, completed: number, total: number) => void;
}

export interface ProofProjectReadResult {
    state: ProofProjectSnapshot;
    myFile: File;
    referenceFile: File;
    workbook: Uint8Array;
}

export interface ProofWorkspaceProjectInput {
    myFile: File;
    referenceFile: File;
    myRange: { startPage: number | ""; endPage: number | "" };
    referenceRange: { startPage: number | ""; endPage: number | "" };
    comparison: ManualComparison;
    decisions: RevisionDecisionMap;
    view: ProofProjectViewState;
}

export interface ProofProjectActionsContext {
    getProjectInput(): ProofWorkspaceProjectInput | null;
    restoreProject(result: ProofProjectReadResult): Promise<void>;
    markProjectSaved(): void;
    setMessage(message: string, tone: "secondary" | "info" | "success" | "danger"): void;
}

export interface ManualProofHookConfig {
    ignoredNoisePhrases?: string[];
}

export interface ComparisonProgress {
    phase: string;
    completed: number;
    total: number;
}

export interface ComparisonWorkerRequest {
    type: "compare";
    requestId: number;
    myManual: WorkerManual;
    referenceManual: WorkerManual;
    options?: ComparisonOptions;
}

export interface ComparisonWorkerProgress {
    type: "progress";
    requestId: number;
    progress: ComparisonProgress;
}

export interface ComparisonWorkerSuccess {
    type: "success";
    requestId: number;
    comparison: ManualComparison;
}

export interface ComparisonWorkerFailure {
    type: "failure";
    requestId: number;
    message: string;
}

export interface PdfLineRecord {
    pageNumber: number;
    text: string;
    x: number;
    y: number;
    topRatio: number;
}

export interface VirtualWindow {
    start: number;
    end: number;
    offsetTop: number;
    totalHeight: number;
}
