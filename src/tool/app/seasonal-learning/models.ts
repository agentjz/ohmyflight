export type SeasonalLearningCategory = "leader" | "captain" | "firstOfficer";

export interface SeasonalLearningPerson {
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

export interface SeasonalLearningRemovedPerson {
    employeeId: string;
    name: string;
    department: string;
    period: number | null;
}

export interface SeasonalLearningPreviousState {
    people: SeasonalLearningPerson[];
    periodDates: Record<number, string>;
    periodCount: number;
    scheduleReady: boolean;
}

export interface SeasonalLearningImportResult extends SeasonalLearningPreviousState {
    mode: "pending" | "actual" | "reimport";
    addedEmployeeIds: string[];
    removedPeople: SeasonalLearningRemovedPerson[];
}

export interface SeasonalLearningDimensionReport {
    counts: number[];
    minimum: number;
    maximum: number;
    balanced: boolean;
    outlierPeriods: number[];
}

export interface SeasonalLearningBalanceReport {
    balanced: boolean;
    pendingCount: number;
    operationalPendingCount: number;
    total: SeasonalLearningDimensionReport;
    groups: SeasonalLearningBalanceGroupReport[];
}

export type SeasonalLearningBalanceGroupKind = "hook" | "technical";

export interface SeasonalLearningBalanceGroupDefinition {
    id: string;
    label: string;
    kind: SeasonalLearningBalanceGroupKind;
    priority: number;
}

export interface SeasonalLearningBalanceGroupReport extends SeasonalLearningDimensionReport, SeasonalLearningBalanceGroupDefinition {
    memberCount: number;
}

export interface SeasonalLearningBalanceHookDefinition {
    id: string;
    label: string;
    priority: number;
    defaultEnabled: boolean;
    matches(person: SeasonalLearningPerson): boolean;
}

export interface SeasonalLearningBalanceRulesApi {
    HOOKS: SeasonalLearningBalanceHookDefinition[];
    DEFAULT_ENABLED_HOOK_IDS: string[];
    normalizeEnabledHookIds(enabledHookIds?: readonly string[]): string[];
    resolveBalanceGroup(
        person: SeasonalLearningPerson,
        enabledHookIds?: readonly string[]
    ): SeasonalLearningBalanceGroupDefinition | null;
}

export interface SeasonalLearningPeriodSummary {
    period: number;
    date: string;
    total: number;
    leader: number;
    captain: number;
    firstOfficer: number;
    usLineLeader: number;
    issues: string[];
}

export interface SeasonalLearningAdjustmentEvent {
    employeeId: string;
    name: string;
    type: "move";
    text: string;
}

export interface SeasonalLearningOperationResult {
    people: SeasonalLearningPerson[];
    events: SeasonalLearningAdjustmentEvent[];
}

export interface SeasonalLearningAllocationGroupInput {
    id: string;
    count: number;
}

export interface SeasonalLearningAllocationResult {
    groupCounts: Record<string, number[]>;
    neutralCounts: number[];
    totalCounts: number[];
}

export interface SeasonalLearningAllocationApi {
    buildDynamicQuotas(
        groups: SeasonalLearningAllocationGroupInput[],
        neutralCount: number,
        periodCount: number
    ): SeasonalLearningAllocationResult;
}

export interface SeasonalLearningBalanceFilterEntry {
    values: string[];
    reason: string;
}

export type SeasonalLearningBalanceFilterDictionary = Partial<Record<
    keyof SeasonalLearningPerson,
    SeasonalLearningBalanceFilterEntry
>>;

export interface SeasonalLearningBalanceFilterApi {
    BALANCE_FILTERS: SeasonalLearningBalanceFilterDictionary;
    shouldIgnoreOperational(person: SeasonalLearningPerson): boolean;
    getOperationalIgnoreReason(person: SeasonalLearningPerson): string;
}

export type SeasonalLearningHealthLevel = "error" | "warning" | "info";

export interface SeasonalLearningHealthPerson {
    employeeId: string;
    name: string;
    identity: string;
    rowNumber: number;
}

export interface SeasonalLearningHealthItem {
    level: SeasonalLearningHealthLevel;
    area: string;
    message: string;
    detail: string;
}

export interface SeasonalLearningHealthResult {
    summary: Record<SeasonalLearningHealthLevel, number>;
    items: SeasonalLearningHealthItem[];
    totalCount: number;
    actualCount: number;
    totalTagged: SeasonalLearningHealthPerson[];
    totalUntagged: SeasonalLearningHealthPerson[];
    actualTagged: SeasonalLearningHealthPerson[];
    actualUntagged: SeasonalLearningHealthPerson[];
}

export interface SeasonalLearningDataApi {
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

export interface SeasonalLearningLogicApi extends SeasonalLearningDataApi {
    buildInitialSchedule(
        people: SeasonalLearningPerson[],
        periodCount: number,
        enabledHookIds?: readonly string[]
    ): SeasonalLearningPerson[];
    checkBalance(
        people: SeasonalLearningPerson[],
        periodCount: number,
        enabledHookIds?: readonly string[]
    ): SeasonalLearningBalanceReport;
    buildPeriodSummaries(
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>,
        periodCount: number,
        enabledHookIds?: readonly string[]
    ): SeasonalLearningPeriodSummary[];
    movePeople(
        people: SeasonalLearningPerson[],
        employeeIds: string[],
        targetPeriod: number,
        periodCount: number
    ): SeasonalLearningOperationResult;
}

export interface SeasonalLearningExportApi {
    buildExportWorkbook(
        sourceWorkbook: import("xlsx-js-style").WorkBook,
        people: SeasonalLearningPerson[],
        periodDates: Record<number, string>
    ): import("xlsx-js-style").WorkBook;
    buildOutputFileName(sourceFileName: string): string;
}

export interface SeasonalLearningHealthApi {
    buildWorkbookHealth(totalRows: unknown[][], actualRows: unknown[][]): SeasonalLearningHealthResult;
}

export interface SeasonalLearningChart {
    setOption(options: unknown, notMerge?: boolean): void;
    resize(): void;
}

export interface SeasonalLearningEchartsApi {
    init(element: HTMLElement): SeasonalLearningChart;
}

export interface SeasonalLearningMoveModal {
    show(): void;
    hide(): void;
}

export interface SeasonalLearningModalApi {
    getOrCreateInstance(element: HTMLElement): SeasonalLearningMoveModal;
}

export interface SeasonalLearningAppState {
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
    enabledBalanceHookIds: string[];
    health: SeasonalLearningHealthResult | null;
    chart: SeasonalLearningChart | null;
}

export interface SeasonalLearningAppContext {
    xlsx: typeof import("xlsx-js-style");
    modalApi: SeasonalLearningModalApi | null;
    echarts: SeasonalLearningEchartsApi | null;
    logic: SeasonalLearningLogicApi;
    rules: SeasonalLearningBalanceRulesApi;
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

export interface SeasonalLearningViewApi {
    renderAll(context: SeasonalLearningAppContext): void;
    renderDateControls(context: SeasonalLearningAppContext): void;
    renderChart(context: SeasonalLearningAppContext): void;
    renderHealth(context: SeasonalLearningAppContext): void;
    updateMoveButtons(context: SeasonalLearningAppContext): void;
}
