import type * as XLSX from "xlsx-js-style";

export type SessionBillWorkbook = XLSX.WorkBook;
export type SessionBillSheet = XLSX.WorkSheet;

export type SessionBillSheetRow = {
    sheetName: string;
    rowNumber: number;
    cells: unknown[];
};

export type SessionBillSourceEntry = {
    name: string;
    matchName: string;
    source: "场次" | "账单";
    sheetName: string;
    rowNumber: number;
    role?: string;
    sourceColumn?: string;
    dateText?: string;
    startText?: string;
    endText?: string;
    groupText?: string;
    natureText?: string;
    modelText?: string;
    deviceText?: string;
    quantityText?: string;
    amountText?: string;
};

export type SessionBillStatus = "一致" | "场次多" | "账单多" | "仅场次有" | "仅账单有";

export type SessionBillCompareRow = {
    key: string;
    status: SessionBillStatus;
    name: string;
    matchedNames: string;
    sessionCount: number;
    billCount: number;
    diff: number;
    sessionRefs: string;
    billRefs: string;
    note: string;
};

export type SessionBillSummary = {
    sessionTotal: number;
    sessionUnique: number;
    billTotal: number;
    billUnique: number;
    comparedNames: number;
    matchedNames: number;
    mismatchNames: number;
    statusCounts: Record<SessionBillStatus, number>;
};

export type SessionBillCompareResult = {
    summary: SessionBillSummary;
    rows: SessionBillCompareRow[];
    sessionEntries: SessionBillSourceEntry[];
    billEntries: SessionBillSourceEntry[];
    statusRows: { status: SessionBillStatus; total: number }[];
    sourceInfo: {
        sessionSheetName: string;
        billSheetNames: string[];
    };
    groupsByKey: Record<string, {
        sessionEntries: SessionBillSourceEntry[];
        billEntries: SessionBillSourceEntry[];
    }>;
};

export type SessionBillAnalysis = {
    entries: SessionBillSourceEntry[];
    sheetName: string;
    rowCount: number;
};

export type SessionBillBillAnalysis = {
    entries: SessionBillSourceEntry[];
    sheetNames: string[];
    rowCount: number;
};

export interface SessionBillLogicApi {
    splitNames(value: unknown): string[];
    analyzeSessionWorkbook(workbook: SessionBillWorkbook): SessionBillAnalysis;
    analyzeBillWorkbook(workbook: SessionBillWorkbook): SessionBillBillAnalysis;
    compareEntries(
        sessionEntries: SessionBillSourceEntry[],
        billEntries: SessionBillSourceEntry[],
        sourceInfo?: { sessionSheetName?: string; billSheetNames?: string[] }
    ): SessionBillCompareResult;
    buildExportWorkbook(result: SessionBillCompareResult): SessionBillWorkbook;
    buildOutputFileName(): string;
}

export interface SessionBillEcharts {
    init(element: HTMLElement): {
        setOption(option: unknown): void;
    };
}

export type SessionBillAppState = {
    sessionWorkbook: SessionBillWorkbook | null;
    billWorkbook: SessionBillWorkbook | null;
    sessionFileName: string;
    billFileName: string;
    sessionAnalysis: SessionBillAnalysis | null;
    billAnalysis: SessionBillBillAnalysis | null;
    result: SessionBillCompareResult | null;
    filter: string;
    selectedKey: string;
};

export interface SessionBillAppContext {
    XLSX: typeof XLSX;
    echarts: SessionBillEcharts | undefined;
    logic: SessionBillLogicApi;
    state: SessionBillAppState;
    getElement<T extends HTMLElement>(id: string): T;
    escapeHtml(value: unknown): string;
    setStatus(message: string, type?: "muted" | "success" | "danger"): void;
    readWorkbook(file: File): Promise<SessionBillWorkbook>;
    filteredRows(): SessionBillCompareRow[];
}
