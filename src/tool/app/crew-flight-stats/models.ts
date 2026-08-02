import type * as XLSX from "xlsx-js-style";

export type CrewFlightWorkbook = XLSX.WorkBook;
export type CrewFlightStatsMap = Record<string, Record<string, number>>;

export type CrewFlightSheetRows = {
    sheetName: string;
    rows: unknown[][];
};

export type CrewFlightAnalyzeResult = {
    statsResult: CrewFlightStatsMap;
    routes: string[];
    unmatchedCells: string[];
};

export interface CrewFlightStatsElements {
    scheduleFile: HTMLInputElement;
    rosterFile: HTMLInputElement;
    rosterStatus: HTMLElement;
    scheduleStatus: HTMLElement;
    sheetSection: HTMLElement;
    sheetSelector: HTMLElement;
    selectAllBtn: HTMLButtonElement;
    selectNoneBtn: HTMLButtonElement;
    analyzeBtn: HTMLButtonElement;
    exportBtn: HTMLButtonElement;
    warningSection: HTMLElement;
    warningList: HTMLElement;
    resultSection: HTMLElement;
    resultHead: HTMLTableSectionElement;
    resultBody: HTMLTableSectionElement;
    resultInfo: HTMLElement;
    crewTableBody: HTMLTableSectionElement;
    extractAllBtn: HTMLButtonElement;
    clearAllBtn: HTMLButtonElement;
    addRowBtn: HTMLButtonElement;
}

export interface CrewFlightStatsState {
    scheduleWorkbook: CrewFlightWorkbook | null;
    rosterNames: string[];
    statsResult: CrewFlightStatsMap | null;
    routes: string[];
    selectedSheets: string[];
}

export interface CrewFlightStatsContext {
    XLSX: typeof XLSX;
    elements: CrewFlightStatsElements;
    state: CrewFlightStatsState;
    showStatus(id: "rosterStatus" | "scheduleStatus", message: string, type: "success" | "error" | "loading" | "hint"): void;
    checkReady(): void;
    getPeopleInRosterOrder(): string[];
}
