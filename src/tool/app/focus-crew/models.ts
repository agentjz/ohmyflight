import type * as XLSX from "xlsx-js-style";

export type FocusCrewWorkbook = XLSX.WorkBook;
export type FocusCrewWorksheet = XLSX.WorkSheet;
export type FocusCrewCategory = "重点关注" | "一般关注" | "预防性关注" | "三新人员（不上会）" | "长期关注";
export type FocusCrewJsonRow = unknown[];
export type FocusCrewCategoryTotals = Partial<Record<FocusCrewCategory, number>>;

export interface FocusSheetInfo {
    name: string;
    category: FocusCrewCategory;
    columns: string[];
    data: FocusCrewJsonRow[];
}

export interface FocusCrewCategoryConfigEntry {
    priority: number;
    color: string;
    label: string;
}

export interface FocusCrewCollectResult {
    focusData: Record<string, FocusCrewCategory[]>;
    focusNames: string[];
}

export interface FocusCrewHighlightResult {
    workbook: FocusCrewWorkbook;
    matchedCategories: FocusCrewCategoryTotals;
    sheetMatchCounts: Record<string, number>;
}

export interface FocusCrewLogicApi {
    CATEGORY_CONFIG: Record<FocusCrewCategory, FocusCrewCategoryConfigEntry>;
    detectCategory(sheetName: string): FocusCrewCategory | null;
    parseFocusWorkbook(workbook: FocusCrewWorkbook): FocusSheetInfo[];
    collectFocusData(focusSheets: FocusSheetInfo[], nameColumnBySheetIndex: Record<number, number>): FocusCrewCollectResult;
    buildHighlightedWorkbook(
        scheduleWorkbook: FocusCrewWorkbook,
        scheduleNameCol: number,
        focusData: Record<string, FocusCrewCategory[]>
    ): FocusCrewHighlightResult;
}

export interface FocusCrewElements {
    scheduleFile: HTMLInputElement;
    focusFile: HTMLInputElement;
    highlightBtn: HTMLButtonElement;
    exportBtn: HTMLButtonElement;
    scheduleStatus: HTMLElement;
    focusStatus: HTMLElement;
    scheduleConfigSection: HTMLElement;
    focusConfigSection: HTMLElement;
    focusSheetsConfig: HTMLElement;
    schedulePreview: HTMLTableElement;
    scheduleIdCol: HTMLSelectElement;
    scheduleNameCol: HTMLSelectElement;
    actionSection: HTMLElement;
    resultStats: HTMLElement;
}
