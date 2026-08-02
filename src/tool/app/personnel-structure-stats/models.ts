import type * as XLSX from "xlsx-js-style";

export type PersonnelWorkbook = XLSX.WorkBook;
export type PersonnelWorksheet = XLSX.WorkSheet;

export type PersonnelRecord = {
    employeeId: string;
    name: string;
    techInfo: string;
    origin: string;
    inspectorQualification: string;
    qualifications: Record<string, boolean>;
};

export type PersonnelStatItem = {
    label: string;
    count: number;
    denominator: number;
    percent: string;
    rule: string;
    isSubset: boolean;
};

export type PersonnelStatClosure = {
    total: number;
    denominator: number;
    closed: boolean;
};

export type PersonnelStatSection = {
    title: string;
    denominatorLabel: string;
    items: PersonnelStatItem[];
    closure: PersonnelStatClosure;
};

export type PersonnelStructureResult = {
    structureCrewCount: number;
    captainOrAboveCount: number;
    firstOfficerCount: number;
    sections: PersonnelStatSection[];
    warnings: string[];
    unrecognized: {
        techInfo: string[];
        origin: string[];
    };
};

export type PersonnelStructureElements = {
    fileInput: HTMLInputElement;
    sheetSelect: HTMLSelectElement;
    analyzeBtn: HTMLButtonElement;
    exportBtn: HTMLButtonElement;
    fileStatus: HTMLElement;
    summary: HTMLElement;
    resultSection: HTMLElement;
    resultTables: HTMLElement;
    warningSection: HTMLElement;
    warningList: HTMLElement;
};
