type SeasonalLearningCategory = "leader" | "captain" | "firstOfficer";

interface SeasonalLearningPerson {
    sequence: string | number;
    originalOrder: number;
    sourceRow: number;
    employeeId: string;
    name: string;
    department: string;
    technicalInfo: string;
    identity: string;
    isLeader: boolean;
    isUsLineLeader: boolean;
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
    operationalPendingCount: number;
    dimensions: Record<"total" | "usLineLeader" | SeasonalLearningCategory, SeasonalLearningDimensionReport>;
}

interface SeasonalLearningPeriodSummary {
    period: number;
    date: string;
    total: number;
    leader: number;
    captain: number;
    firstOfficer: number;
    usLineLeader: number;
    issues: string[];
}

interface SeasonalLearningAdjustmentEvent {
    employeeId: string;
    name: string;
    type: "move";
    text: string;
}

interface SeasonalLearningOperationResult {
    people: SeasonalLearningPerson[];
    events: SeasonalLearningAdjustmentEvent[];
}

interface SeasonalLearningAllocationQuotas {
    category: Record<SeasonalLearningCategory, number[]>;
    usLineLeader: Record<SeasonalLearningCategory, number[]>;
}

interface SeasonalLearningAllocationApi {
    buildBalancedQuotas(
        people: SeasonalLearningPerson[],
        periodCount: number
    ): SeasonalLearningAllocationQuotas;
}

interface SeasonalLearningBalanceFilterEntry {
    values: string[];
    reason: string;
}

type SeasonalLearningBalanceFilterDictionary = Partial<Record<
    keyof SeasonalLearningPerson,
    SeasonalLearningBalanceFilterEntry
>>;

interface SeasonalLearningBalanceFilterApi {
    BALANCE_FILTERS: SeasonalLearningBalanceFilterDictionary;
    shouldIgnoreOperational(person: SeasonalLearningPerson): boolean;
    getOperationalIgnoreReason(person: SeasonalLearningPerson): string;
}

type SeasonalLearningHealthLevel = "error" | "warning" | "info";

interface SeasonalLearningHealthPerson {
    employeeId: string;
    name: string;
    identity: string;
    rowNumber: number;
}

interface SeasonalLearningHealthItem {
    level: SeasonalLearningHealthLevel;
    area: string;
    message: string;
    detail: string;
}

interface SeasonalLearningHealthResult {
    summary: Record<SeasonalLearningHealthLevel, number>;
    items: SeasonalLearningHealthItem[];
    totalCount: number;
    actualCount: number;
    totalTagged: SeasonalLearningHealthPerson[];
    totalUntagged: SeasonalLearningHealthPerson[];
    actualTagged: SeasonalLearningHealthPerson[];
    actualUntagged: SeasonalLearningHealthPerson[];
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
}

interface SeasonalLearningExportApi {
    buildExportWorkbook(
        sourceWorkbook: import("xlsx-js-style").WorkBook,
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>
    ): import("xlsx-js-style").WorkBook;
    buildOutputFileName(sourceFileName: string): string;
}

interface SeasonalLearningHealthApi {
    buildWorkbookHealth(totalRows: unknown[][], actualRows: unknown[][]): SeasonalLearningHealthResult;
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
    pendingMoveIds: string[];
    health: SeasonalLearningHealthResult | null;
    chart: any;
}

interface SeasonalLearningAppContext {
    runtime: Window;
    logic: SeasonalLearningLogicApi;
    exporter: SeasonalLearningExportApi;
    health: SeasonalLearningHealthApi;
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
    renderHealth(context: SeasonalLearningAppContext): void;
    updateMoveButtons(context: SeasonalLearningAppContext): void;
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
    SeasonalLearningBalanceFilter: SeasonalLearningBalanceFilterApi;
    SeasonalLearningAllocation: SeasonalLearningAllocationApi;
    SeasonalLearningLogic: SeasonalLearningLogicApi;
    SeasonalLearningExport: SeasonalLearningExportApi;
    SeasonalLearningHealth: SeasonalLearningHealthApi;
    SeasonalLearningApp: SeasonalLearningAppNamespace;
}
