import type { WorkBook, WorkSheet } from "xlsx-js-style";

export type TrainingToolWorkbook = WorkBook;
export type TrainingToolWorksheet = WorkSheet;

export interface TrainingProjectRule {
  canonical: string;
  aliases: string[];
  ruleType: string;
  validityValue: number;
  validityUnit: string;
  baseMonthFlex: number;
  rounding: string;
  enabled: boolean;
}

export interface TrainingToolSheetRow {
  rowNumber: number;
  cells: unknown[];
}

export interface TrainingToolSheetInfo {
  name: string;
  sheet: TrainingToolWorksheet | null;
  matrix: unknown[][];
  headers: string[];
  headerMap: Map<string, number>;
  rows: TrainingToolSheetRow[];
  sampleRowNumber?: number;
}

export type TrainingToolRecordedInfo = TrainingToolSheetInfo;

export interface TrainingToolPeopleInfo extends TrainingToolSheetInfo {
  sheet: TrainingToolWorksheet;
}

export interface TrainingToolPeopleIndex {
  employeeColumnIndex: number;
  nameColumnIndex: number;
  byName: Map<string, number[]>;
  byId: Map<string, number[]>;
}

export interface TrainingToolPendingSession {
  key: string;
  startDate: Date | null;
  endDate: Date | null;
}

export interface TrainingToolProjectAnalysis {
  canonical: string;
  rule: TrainingProjectRule;
  peopleColumnIndex: number;
  peopleHeader: string;
  sheetName: string;
  sheetInfo: TrainingToolSheetInfo;
  recordedInfo: TrainingToolRecordedInfo;
  pendingInfo: TrainingToolRecordedInfo;
  validityUpdateInfo: TrainingToolRecordedInfo;
  recordedMonths: string[];
  pendingMonths: string[];
  validityUpdateMonths: string[];
  availableMonths: string[];
  pendingRowCount: number;
  recordedRowCount: number;
  validityUpdateRowCount: number;
  pendingDefaultsByMonth: Map<string, Record<string, unknown>>;
  pendingGlobalDefaults: Record<string, unknown>;
  pendingSessionsByMonth: Map<string, TrainingToolPendingSession[]>;
}

export interface TrainingToolAnalysis {
  peopleInfo: TrainingToolPeopleInfo;
  peopleIndex: TrainingToolPeopleIndex;
  projects: TrainingToolProjectAnalysis[];
  availableMonths: string[];
  sheetNames: string[];
  projectMap: Map<string, TrainingToolProjectAnalysis>;
}

export interface TrainingRecordState {
  recorded: boolean;
  cancelled: boolean;
  active: boolean;
  abnormal: boolean;
  status: string;
  reason: string;
}

export interface TrainingValidityRecordState {
  markedForUpdate: boolean;
  cancelled: boolean;
  active: boolean;
  abnormal: boolean;
  status: string;
  reason: string;
}

export type TrainingWindowInfo =
  | {
      hasWindow: true;
      windowStart: Date;
      windowEnd: Date;
      tag: string;
      detail: string;
    }
  | {
      hasWindow: false;
      windowStart: null;
      windowEnd: null;
      tag: string;
      detail: string;
    };

export interface TrainingComputedExpiry {
  newExpiry: Date;
  reason: string;
}

export interface TrainingUpdateOutcome {
  result: string;
  shouldWrite: boolean;
  reason: string;
}

export interface TrainingPlanCoverage {
  covered: boolean;
  dueDate: Date | null;
  newExpiry: Date | null;
  windowInfo: TrainingWindowInfo;
  reason: string;
}

export interface TrainingScheduleClassification {
  status: string;
  include: boolean;
  windowInfo: TrainingWindowInfo;
  reason: string;
}

export interface TrainingScheduleUrgency {
  label: string;
  rank: number;
}

export type TrainingStatusTone = "red" | "orange" | "green" | "gray";
export type TrainingBadgeTone = "danger" | "warn" | "info" | "ok";
export type TrainingVisibleStatusField =
  | "expired"
  | "expiredScheduled"
  | "must"
  | "uncoveredScheduled"
  | "recommended"
  | "abnormal";

export interface TrainingVisibleStatusBucket {
  expired: number;
  expiredScheduled: number;
  must: number;
  uncoveredScheduled: number;
  recommended: number;
  abnormal: number;
}

export interface TrainingAssessmentFilters {
  projects?: string[];
  statuses?: string[];
  months?: string[];
  searchText?: string;
}

export interface TrainingAssessmentOptions {
  today?: Date;
  stageEnd?: Date;
  filters?: TrainingAssessmentFilters;
}

export interface TrainingAssessmentRow {
  status: string;
  projectName: string;
  employeeId: string;
  name: string;
  expiry: string;
  dueMonth: string;
  dueDate: string;
  scheduledDate: string;
  source: string;
  reason: string;
}

export interface TrainingStatsCard {
  label: string;
  value: number;
  tone: string;
  hint: string;
}

export interface TrainingChartValueRow {
  name: string;
  value: number;
}

export interface TrainingProjectChartRow extends TrainingVisibleStatusBucket {
  projectName: string;
}

export interface TrainingProjectSummaryRow extends TrainingVisibleStatusBucket {
  projectName: string;
  total: number;
  rowsByStatus: Record<string, TrainingAssessmentRow[]>;
}

export interface TrainingProjectGroup {
  projectName: string;
  status: string;
  total: number;
  rows: TrainingAssessmentRow[];
}

export interface TrainingPersonRiskItem {
  status: string;
  projectName: string;
  dueDate: string;
  expiry: string;
  reason: string;
}

export interface TrainingPersonRiskRow extends TrainingVisibleStatusBucket {
  employeeId: string;
  name: string;
  total: number;
  nearestDueDate: string;
  items: TrainingPersonRiskItem[];
}

export interface TrainingSummaryData {
  projectSummaryRows: TrainingProjectSummaryRow[];
  projectGroups: TrainingProjectGroup[];
  personRiskRows: TrainingPersonRiskRow[];
}

export interface TrainingChartData {
  statusRows: TrainingChartValueRow[];
  projectRows: TrainingProjectChartRow[];
}

export interface TrainingWorkbenchResult {
  summaryText: string;
  statsCards: TrainingStatsCard[];
  chartData: TrainingChartData;
  summaryData: TrainingSummaryData;
  displayColumns: string[];
  detailColumns: string[];
  allDetailRows: TrainingAssessmentRow[];
  detailRows: TrainingAssessmentRow[];
  skippedColumns: string[];
  skippedRows: unknown[][];
  filterOptions: {
    projects: string[];
    statuses: string[];
    months: string[];
  };
  stageStart: string;
  stageEnd: string;
}

export interface TrainingValidityDetailRow {
  projectName: string;
  sheetName: string;
  rowNumber: number;
  employeeId: string;
  name: string;
  oldExpiry: string;
  newExpiry: string;
  judgement: string;
  result: string;
  reason: string;
}

export interface TrainingValiditySkippedRow {
  projectName: string;
  name: string;
  status: string;
  reason: string;
}

export interface TrainingToolUpdatedRowEntry {
  rowNumber: number;
  employeeId: string;
  name: string;
  columns: Set<number>;
  records: TrainingValidityDetailRow[];
}

export interface TrainingValidityResult {
  summaryText: string;
  statsCards: Array<{ label: string; value: number }>;
  detailColumns: string[];
  detailRows: TrainingValidityDetailRow[];
  skippedColumns: string[];
  skippedRows: TrainingValiditySkippedRow[];
  updatedRowMap: Map<number, TrainingToolUpdatedRowEntry>;
  updatedRecords: TrainingValidityDetailRow[];
}

export type TrainingToolPersonValidityItem = import("./person-validity-query").PersonValidityItem;
export type TrainingToolPersonValidityRecord = import("./person-validity-query").PersonValidityRecord;
export type TrainingToolPersonValidityIndex = import("./person-validity-query").PersonValidityIndex;
export type TrainingCalendarSession = import("./training-calendar").TrainingCalendarSession;
export type TrainingCalendarDayEvent = import("./training-calendar").TrainingCalendarDayEvent;
export type TrainingCalendarReminder = import("./training-calendar").TrainingCalendarReminder;
export type TrainingCalendarResult = import("./training-calendar").TrainingCalendarResult;
export type TrainingToolScheduleGapCheckRow = import("./schedule-gap-check").GapCheckRow;
export type TrainingToolScheduleGapCheckResult = import("./schedule-gap-check").GapCheckResult;
export type TrainingWorkbookHealthResult = import("./workbook-health").WorkbookHealthResult;
export type TrainingCrmAnnualResult = import("./crm-annual").CrmAnnualResult;
export type TrainingQualificationPressureResult = import("./qualification-pressure").QualificationPressureResult;
export type TrainingLoadResult = import("./training-load").TrainingLoadResult;

export interface TrainingWorkbenchSelection {
  projectName: string;
  status: string;
  rows: TrainingAssessmentRow[];
}

export interface TrainingToolAppCopy {
  defaultExportButton: string;
  defaultOverview: string;
  defaultProjectCards: string;
  defaultDetailTable: string;
  defaultSkippedTable: string;
  defaultResultSummary: string;
  defaultStatus: string;
  defaultWaiting: string;
}

export interface TrainingToolAppState {
  sourceFileName: string;
  workbook: TrainingToolWorkbook | null;
  analysis: TrainingToolAnalysis | null;
  workbookHealth: TrainingWorkbookHealthResult | null;
  busy: boolean;
  pendingExport: TrainingToolWorkbook | null;
  pendingExportName: string;
  pendingExportLabel: string;
  workbenchResult: TrainingWorkbenchResult | null;
  workbenchView: TrainingWorkbenchResult | null;
  workbenchSelection: TrainingWorkbenchSelection | null;
  qualificationPressure: TrainingQualificationPressureResult | null;
  qualificationPressureSelectedMonth: string;
  qualificationPressureSelectedMode: string;
  trainingLoad: TrainingLoadResult | null;
  crmAnnualResult: TrainingCrmAnnualResult | null;
  trainingCalendarResult: TrainingCalendarResult | null;
  trainingCalendarMonthKey: string;
  scheduleGapCheckResult: TrainingToolScheduleGapCheckResult | null;
  personValidityIndex: TrainingToolPersonValidityIndex | null;
  personValiditySelectedKey: string;
  updateSelectedProjects: string[];
}

export interface TrainingToolAppElements {
  workbookFile: HTMLInputElement;
  workbookOverview: HTMLElement;
  workbookHealthPanel: HTMLElement;
  scheduleGapBaseDateInput: HTMLInputElement;
  scheduleGapHorizonGroup: HTMLFieldSetElement;
  scheduleGapSummary: HTMLElement;
  scheduleGapTableBody: HTMLTableSectionElement;
  personValidityForm: HTMLFormElement;
  personValiditySearchInput: HTMLInputElement;
  personValiditySearchButton: HTMLButtonElement;
  personValidityResult: HTMLElement;
  statusLine: HTMLElement;
  trainingCalendarMonthLabel: HTMLElement;
  trainingCalendarMonthInput: HTMLInputElement;
  trainingCalendarTodayButton: HTMLButtonElement;
  trainingCalendarReminderList: HTMLElement;
  trainingCalendarGrid: HTMLElement;
  updateValiditySheetSelect: HTMLSelectElement;
  updateProjectGroup: HTMLElement;
  updateProjectSelectAll: HTMLInputElement;
  updateProjectSummary: HTMLElement;
  updateProjectList: HTMLElement;
  updateMonthSelect: HTMLSelectElement;
  workbenchProjectSelect: HTMLSelectElement;
  workbenchStatusSelect: HTMLSelectElement;
  workbenchMonthSelect: HTMLSelectElement;
  workbenchSearchInput: HTMLInputElement;
  workbenchStartDateInput: HTMLInputElement;
  workbenchEndDateInput: HTMLInputElement;
  workbenchStatusChart: HTMLElement;
  workbenchProjectChart: HTMLElement;
  qualificationPressureStartMonthInput: HTMLInputElement;
  qualificationPressureHorizonSelect: HTMLSelectElement;
  qualificationPressureProjectSelect: HTMLSelectElement;
  qualificationPressureChart: HTMLElement;
  qualificationPressureBreakdownChart: HTMLElement;
  qualificationPressureBreakdownTitle: HTMLElement;
  qualificationPressureDetailPanel: HTMLElement;
  qualificationPressureDetailTitle: HTMLElement;
  qualificationPressureDetailBody: HTMLTableSectionElement;
  trainingLoadYearInput: HTMLInputElement;
  trainingLoadProjectSelect: HTMLSelectElement;
  trainingLoadChart: HTMLElement;
  crmYearInput: HTMLInputElement;
  crmSummary: HTMLElement;
  crmStatsGrid: HTMLElement;
  crmParticipationChart: HTMLElement;
  crmMonthlyChart: HTMLElement;
  crmRoleChart: HTMLElement;
  crmDuplicateSummary: HTMLElement;
  crmDuplicateBody: HTMLTableSectionElement;
  exportCrmDuplicateButton: HTMLButtonElement;
  crmMissingBody: HTMLTableSectionElement;
  exportCrmMissingButton: HTMLButtonElement;
  exportWorkbenchSelectionButton: HTMLButtonElement;
  exportWorkbenchViewButton: HTMLButtonElement;
  updateValidityButton: HTMLButtonElement;
  workbenchButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  resultSummary: HTMLElement;
  statsGrid: HTMLElement;
  workbenchProjectSummaryBody: HTMLTableSectionElement;
  workbenchSelectedPeopleTitle: HTMLElement;
  workbenchSelectedPeopleIntro: HTMLElement;
  workbenchSelectedPeople: HTMLElement;
  detailDetails: HTMLDetailsElement;
  detailSummaryLabel: HTMLElement;
  detailTableTitle: HTMLElement;
  detailTableHead: HTMLTableSectionElement;
  detailTableBody: HTMLTableSectionElement;
  skippedDetails: HTMLDetailsElement;
  skippedSummaryLabel: HTMLElement;
  skippedTableHead: HTMLTableSectionElement;
  skippedTableBody: HTMLTableSectionElement;
  projectCards: HTMLElement;
}

export interface TrainingAppControls {
  initializeDefaultDates(): void;
  setStatus(message: string, isError?: boolean): void;
  setBusy(busy: boolean): void;
  clearPendingExport(): void;
  setPendingExport(workbook: TrainingToolWorkbook, fileName: string, label: string, buttonText: string): void;
  invalidateExportPreview(): void;
  refreshButtons(): void;
}

export interface TrainingAppSelection {
  normalizeSelectedProjects(selectedNames: string[], projects: TrainingToolProjectAnalysis[]): string[];
  getUpdateProjects(): TrainingToolProjectAnalysis[];
  getCheckedProjectValues(listElement: HTMLElement): string[];
  getCommonValidityUpdateMonths(projectNames: string[]): string[];
  getWorkbenchFilters(): TrainingAssessmentFilters;
  getWorkbenchRange(): { stageStart: Date; stageEnd: Date } | null;
}

export interface TrainingAppCharts {
  renderWorkbenchCharts(chartData: TrainingChartData | null): void;
  renderQualificationPressureChart(result: TrainingQualificationPressureResult | null): void;
  renderQualificationPressureBreakdownChart(result: TrainingQualificationPressureResult | null, mode: string, monthKey: string): void;
  renderTrainingLoadChart(result: TrainingLoadResult | null): void;
  renderCrmCharts(result: TrainingCrmAnnualResult | null): void;
  refreshRenderedCharts(): void;
}

export type TrainingTableCell = unknown | { type: "badge"; text: unknown; tone: TrainingBadgeTone };

export interface TrainingAppResultTable {
  renderTable(headElement: HTMLTableSectionElement, bodyElement: HTMLTableSectionElement, columns: string[], rows: TrainingTableCell[][], emptyText: string): void;
  renderSkippedSummary(count: number): void;
  toValidityDetailRows(rows: TrainingValidityDetailRow[]): TrainingTableCell[][];
  toValiditySkippedRows(rows: TrainingValiditySkippedRow[]): TrainingTableCell[][];
  toWorkbenchDetailRows(rows: TrainingAssessmentRow[]): TrainingTableCell[][];
}

export interface TrainingAppSummaryView {
  renderWorkbenchSummary(summaryData: TrainingSummaryData | null): void;
}

export interface TrainingAppRenderers {
  renderWorkbookOverview(): void;
  renderWorkbookHealth(): void;
  renderValiditySheetOptions(): void;
  renderProjectCheckboxGroup(kind: string, projects: TrainingToolProjectAnalysis[], selectedNames: string[]): void;
  renderWorkbenchFilterOptions(result: TrainingWorkbenchResult | null): void;
  renderProjectCards(): void;
  renderQualificationPressure(selectedMonth?: string, selectedMode?: string): void;
  renderTrainingLoad(): void;
  renderCrmAnnual(): void;
  renderResultPlaceholders(): void;
  renderActionResult(kind: "workbench" | "validity", result: TrainingWorkbenchResult | TrainingValidityResult): void;
}

export interface TrainingAppProjects {
  renderProjectGroups(): void;
  renderMonthSelect(): void;
  renderEmptyState(): void;
  handleUpdateProjectGroupChange(event: Event): void;
}

export interface TrainingAppWorkbenchController {
  buildCurrentWorkbenchResult(analysis: TrainingToolAnalysis): TrainingWorkbenchResult;
  renderWorkbenchView(): TrainingWorkbenchResult | null;
  refreshWorkbenchResult(statusMessage?: string): TrainingWorkbenchResult | null;
  handleWorkbenchRangeChange(): void;
  handleWorkbenchFilterChange(): void;
}

export interface TrainingAppTrainingCalendar {
  initialize(): void;
  rebuild(): void;
  clear(): void;
  render(): void;
}

export interface TrainingAppScheduleGapCheck {
  initialize(): void;
  rebuild(): void;
  clear(): void;
}

export interface TrainingAppPersonValidityQuery {
  initialize(): void;
  rebuild(): void;
  handleSearch(event?: Event): void;
}

export interface TrainingAppActions {
  handleWorkbookChange(event: Event): Promise<void>;
  handleUpdatePreview(): void;
  handleWorkbenchPreview(): void;
  handleExport(): void;
  handleExportWorkbenchView(): void;
  handleExportWorkbenchSelection(): void;
  handleExportCrmDuplicate(): void;
  handleExportCrmMissing(): void;
}

export interface TrainingToolAppRuntime {
  copy: TrainingToolAppCopy;
  state: TrainingToolAppState;
  elements: TrainingToolAppElements;
  renderers: TrainingAppRenderers;
  selection: TrainingAppSelection;
  controls: TrainingAppControls;
  projects: TrainingAppProjects;
  workbenchController: TrainingAppWorkbenchController;
  actions: TrainingAppActions;
  charts: TrainingAppCharts;
  resultTable: TrainingAppResultTable;
  summaryView: TrainingAppSummaryView;
  trainingCalendar: TrainingAppTrainingCalendar;
  scheduleGapCheck: TrainingAppScheduleGapCheck;
  personValidityQuery: TrainingAppPersonValidityQuery;
}
