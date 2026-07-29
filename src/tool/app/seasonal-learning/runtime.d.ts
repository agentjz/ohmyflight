type SeasonalLearningCategory = "leader" | "captain" | "firstOfficer";

interface SeasonalLearningPerson {
    sequence: string | number;
    originalOrder: number;
    sourceRow: number;
    employeeId: string;
    name: string;
    department: string;
    technicalInfo: string;
    isLeader: boolean;
    trainingType: string;
    sourceDate: string;
    category: SeasonalLearningCategory;
    period: number | null;
    adjusted: boolean;
    adjustmentNotes: string[];
}

interface SeasonalLearningRemovedPerson {
    employeeId: string;
    name: string;
    department: string;
    period: number | null;
}

interface SeasonalLearningPreviousState {
    people: SeasonalLearningPerson[];
    periodDates: Record<number, string>;
    periodCount: number;
    scheduleReady: boolean;
}

interface SeasonalLearningImportResult extends SeasonalLearningPreviousState {
    mode: "pending" | "actual" | "reimport";
    addedEmployeeIds: string[];
    removedPeople: SeasonalLearningRemovedPerson[];
}

interface SeasonalLearningDimensionReport {
    counts: number[];
    minimum: number;
    maximum: number;
    balanced: boolean;
    outlierPeriods: number[];
}

interface SeasonalLearningBalanceReport {
    balanced: boolean;
    pendingCount: number;
    dimensions: Record<"total" | SeasonalLearningCategory, SeasonalLearningDimensionReport>;
}

interface SeasonalLearningPeriodSummary {
    period: number;
    date: string;
    total: number;
    leader: number;
    captain: number;
    firstOfficer: number;
    issues: string[];
}

interface SeasonalLearningAdjustmentEvent {
    employeeId: string;
    name: string;
    type: "move" | "swap";
    text: string;
}

interface SeasonalLearningOperationResult {
    people: SeasonalLearningPerson[];
    events: SeasonalLearningAdjustmentEvent[];
}

interface SeasonalLearningDataApi {
    parseBusinessDate(value: unknown, options?: { date1904?: boolean }): string;
    normalizeEmployeeId(value: unknown): string;
    readRosterRows(rows: unknown[][], options?: { date1904?: boolean }): SeasonalLearningPerson[];
    buildImportResult(
        totalRows: unknown[][],
        actualRows: unknown[][],
        requestedPeriodCount: number,
        previousState: SeasonalLearningPreviousState | null,
        options?: { date1904?: boolean }
    ): SeasonalLearningImportResult;
    formatPeriod(period: number | null): string;
    categoryLabel(category: SeasonalLearningCategory): string;
}

interface SeasonalLearningLogicApi extends SeasonalLearningDataApi {
    buildInitialSchedule(people: SeasonalLearningPerson[], periodCount: number): SeasonalLearningPerson[];
    checkBalance(people: SeasonalLearningPerson[], periodCount: number): SeasonalLearningBalanceReport;
    buildPeriodSummaries(
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>,
        periodCount: number
    ): SeasonalLearningPeriodSummary[];
    movePeople(
        people: SeasonalLearningPerson[],
        employeeIds: string[],
        targetPeriod: number,
        periodCount: number
    ): SeasonalLearningOperationResult;
    swapGroups(
        people: SeasonalLearningPerson[],
        leftEmployeeIds: string[],
        rightEmployeeIds: string[]
    ): SeasonalLearningOperationResult;
}

interface SeasonalLearningExportApi {
    buildExportWorkbook(
        sourceWorkbook: import("xlsx-js-style").WorkBook,
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>
    ): import("xlsx-js-style").WorkBook;
    buildOutputFileName(sourceFileName: string): string;
}

interface SeasonalLearningAppState {
    sourceWorkbook: import("xlsx-js-style").WorkBook | null;
    sourceFileName: string;
    initialized: boolean;
    mode: "pending" | "actual" | "reimport" | null;
    scheduleReady: boolean;
    people: SeasonalLearningPerson[];
    periodDates: Record<number, string>;
    periodCount: number;
    addedEmployeeIds: string[];
    removedPeople: SeasonalLearningRemovedPerson[];
    adjustmentLog: string[];
    exchangeGroupA: string[];
    exchangeGroupB: string[];
    pendingMoveIds: string[];
    chart: any;
}

interface SeasonalLearningAppContext {
    runtime: Window;
    logic: SeasonalLearningLogicApi;
    exporter: SeasonalLearningExportApi;
    state: SeasonalLearningAppState;
    getElement<T extends HTMLElement>(id: string): T;
    escapeHtml(value: unknown): string;
    setStatus(message: string, type?: "muted" | "success" | "warning" | "danger"): void;
    setActionMessage(message: string, type?: "muted" | "success" | "warning" | "danger"): void;
    readWorkbook(file: File): Promise<import("xlsx-js-style").WorkBook>;
    sheetRows(workbook: import("xlsx-js-style").WorkBook, sheetName: string): unknown[][];
    workbookUses1904Dates(workbook: import("xlsx-js-style").WorkBook): boolean;
}

interface SeasonalLearningViewApi {
    renderAll(context: SeasonalLearningAppContext): void;
    renderDateControls(context: SeasonalLearningAppContext): void;
    renderChart(context: SeasonalLearningAppContext): void;
    renderSelectionCount(context: SeasonalLearningAppContext): void;
    renderExchangeTray(context: SeasonalLearningAppContext): void;
}

interface SeasonalLearningAppNamespace {
    AppContext?: { createAppContext(): SeasonalLearningAppContext };
    View?: SeasonalLearningViewApi;
    context?: SeasonalLearningAppContext;
}

interface Window {
    XLSX: typeof import("xlsx-js-style");
    echarts?: any;
    SeasonalLearningData: SeasonalLearningDataApi;
    SeasonalLearningLogic: SeasonalLearningLogicApi;
    SeasonalLearningExport: SeasonalLearningExportApi;
    SeasonalLearningApp: SeasonalLearningAppNamespace;
}
