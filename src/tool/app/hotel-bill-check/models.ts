import type * as XLSX from "xlsx-js-style";

export type HotelBillWorkbookRow = Array<string | number | boolean | Date | null | undefined>;
export type HotelBillWorkSheet = XLSX.WorkSheet;
export type HotelBillWorkbook = XLSX.WorkBook;
export type HotelBillHyperlinkInfo = { url: string; display: string };
export type HotelBillHyperlinkMap = Record<number, Record<number, HotelBillHyperlinkInfo>>;
export type HotelBillMatchStatus = "matched" | "duplicate" | "unmatched";

export type HotelBillMatchResult = {
    status: HotelBillMatchStatus;
    billRow: HotelBillWorkbookRow;
    billIdx: number;
    checkinRow: HotelBillWorkbookRow | null;
    checkinIdx: number;
};

export type HotelBillProofLinkColumn = {
    header: string;
    link: HotelBillHyperlinkInfo | null;
};

export type HotelBillMatchInput = {
    billData: HotelBillWorkbookRow[];
    checkinData: HotelBillWorkbookRow[];
    billNameCol: number;
    billDateCol: number;
    checkinNameCol: number;
    checkinDateCol: number;
    tolerance: number;
};

export type HotelBillMatchOutput = {
    results: HotelBillMatchResult[];
    skippedBillLogs: Array<Record<string, unknown>>;
    candidateLogs: Array<Record<string, unknown>>;
};

export interface HotelBillState {
    billWorkbook: HotelBillWorkbook | null;
    checkinWorkbook: HotelBillWorkbook | null;
    billData: HotelBillWorkbookRow[];
    checkinData: HotelBillWorkbookRow[];
    billColumns: string[];
    checkinColumns: string[];
    billHyperlinks: HotelBillHyperlinkMap;
    checkinHyperlinks: HotelBillHyperlinkMap;
    matchResults: HotelBillMatchResult[];
}

export interface HotelBillContext {
    XLSX: typeof XLSX;
    state: HotelBillState;
    getInput(id: string): HTMLInputElement;
    getButton(id: string): HTMLButtonElement;
    getElement(id: string): HTMLElement;
}
