import type * as XLSX from "xlsx-js-style";

export type CrewRosterEntry = {
    id: string;
    name: string;
    department: string;
    techInfo: string;
    techLevel: string;
};

export type CrewMatchResult = CrewRosterEntry & {
    pos: number;
};

export type CrewExportColumn = {
    header: string;
    valuesByEmployeeId: Record<string, string>;
};

export type CrewCustomColumn = CrewExportColumn & {
    id: string;
};

export type CrewExportOptions = {
    includeTechLevel?: boolean;
};

export interface CrewMatchNameIdExporterApi {
    buildExcelWorkbook(entries: CrewRosterEntry[], customColumns: CrewExportColumn[], options?: CrewExportOptions): XLSX.WorkBook;
    exportExcel(entries: CrewRosterEntry[], customColumns: CrewExportColumn[], options?: CrewExportOptions): void;
    exportImage(
        entries: CrewRosterEntry[],
        customColumns: CrewExportColumn[],
        imageTitle: string,
        options?: CrewExportOptions
    ): Promise<void>;
}

export type Html2CanvasApi = (
    element: HTMLElement,
    options?: {
        backgroundColor?: string;
        logging?: boolean;
        scale?: number;
        useCORS?: boolean;
        windowWidth?: number;
    }
) => Promise<HTMLCanvasElement>;

export type StyledCrewCell = XLSX.CellObject & {
    s?: Record<string, unknown>;
};
