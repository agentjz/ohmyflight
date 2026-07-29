type TrainingToolWorkbook = import("xlsx-js-style").WorkBook;

interface TrainingToolSheetRow {
  rowNumber: number;
  cells: unknown[];
}

interface TrainingToolRecordedInfo {
  rows: TrainingToolSheetRow[];
}

interface TrainingToolProjectAnalysis {
  canonical: string;
  peopleColumnIndex: number;
  sheetInfo?: any;
  recordedInfo?: TrainingToolRecordedInfo | null;
  validityUpdateInfo?: TrainingToolRecordedInfo | null;
  recordedMonths: string[];
  validityUpdateMonths: string[];
  pendingMonths: string[];
  availableMonths: string[];
  pendingRowCount: number;
  recordedRowCount: number;
  validityUpdateRowCount: number;
  peopleHeader?: string;
  sheetName?: string;
}

interface TrainingToolPeopleInfo {
  name: string;
  rows: TrainingToolSheetRow[];
}

interface TrainingToolAnalysis {
  peopleInfo: TrainingToolPeopleInfo;
  projects: TrainingToolProjectAnalysis[];
  availableMonths: string[];
  sheetNames: string[];
  projectMap: Map<string, TrainingToolProjectAnalysis>;
}

interface TrainingCalendarSession {
  id: string;
  projectName: string;
  sourceProjects: string[];
  startDate: string;
  endDate: string;
  attendeeNames: string[];
}

interface TrainingCalendarDayEvent extends TrainingCalendarSession {
  date: string;
}

interface TrainingCalendarReminder extends TrainingCalendarSession {
  daysUntil: number;
  message: string;
}

interface TrainingCalendarResult {
  sessions: TrainingCalendarSession[];
  dayEvents: TrainingCalendarDayEvent[];
  reminders: TrainingCalendarReminder[];
}

interface TrainingToolAppCopy {
  defaultExportButton: string;
  defaultOverview: string;
  defaultProjectCards: string;
  defaultDetailTable: string;
  defaultSkippedTable: string;
  defaultResultSummary: string;
  defaultStatus: string;
  defaultWaiting: string;
}

interface TrainingToolAppState {
  sourceFileName: string;
  workbook: TrainingToolWorkbook | null;
  analysis: TrainingToolAnalysis | null;
  workbookHealth: any;
  busy: boolean;
  pendingExport: TrainingToolWorkbook | null;
  pendingExportName: string;
  pendingExportLabel: string;
  workbenchResult: any;
  workbenchView: any;
  workbenchSelection: any;
  workbenchSelectedPersonKeys: string[];
  simulationRecords: any[];
  scheduledDistribution: any;
  annualTrainingStats: any;
  annualTrainingStatsView: any;
  crmAnnualResult: any;
  trainingCalendarResult: TrainingCalendarResult | null;
  trainingCalendarMonthKey: string;
  updateSelectedProjects: string[];
}

interface TrainingToolUpdatedRowEntry {
  rowNumber: number;
  columns: Set<number>;
}

interface TrainingToolAppElements {
  workbookFile: HTMLInputElement;
  workbookOverview: HTMLElement;
  workbookHealthPanel: HTMLElement;
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
  workbenchPressureYearInput: HTMLInputElement;
  workbenchStatusChart: HTMLElement;
  workbenchProjectChart: HTMLElement;
  workbenchMonthChart: HTMLElement;
  scheduledDistributionProjectSelect: HTMLSelectElement;
  scheduledDistributionMonthSelect: HTMLSelectElement;
  scheduledDistributionSummary: HTMLElement;
  scheduledDistributionDateChart: HTMLElement;
  annualTrainingProjectSelect: HTMLSelectElement;
  annualTrainingYearSelect: HTMLSelectElement;
  annualTrainingMonthSelect: HTMLSelectElement;
  annualTrainingSummary: HTMLElement;
  annualTrainingDateChart: HTMLElement;
  crmYearInput: HTMLInputElement;
  crmSummary: HTMLElement;
  crmStatsGrid: HTMLElement;
  crmParticipationChart: HTMLElement;
  crmMonthlyChart: HTMLElement;
  crmRoleChart: HTMLElement;
  crmDuplicateSummary: HTMLElement;
  crmDuplicateBody: HTMLTableSectionElement;
  crmMissingBody: HTMLTableSectionElement;
  exportCrmMissingButton: HTMLButtonElement;
  exportWorkbenchSelectionButton: HTMLButtonElement;
  exportWorkbenchViewButton: HTMLButtonElement;
  simulationProjectSelect: HTMLSelectElement;
  simulationStartDateInput: HTMLInputElement;
  simulationEndDateInput: HTMLInputElement;
  simulationRemarkInput: HTMLInputElement;
  simulationAddSelectionButton: HTMLButtonElement;
  simulationClearButton: HTMLButtonElement;
  simulationSummary: HTMLElement;
  simulationTableBody: HTMLTableSectionElement;
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

interface TrainingToolAppRuntime {
  copy: TrainingToolAppCopy;
  state: TrainingToolAppState;
  elements: TrainingToolAppElements;
  renderers: any;
  selection: any;
  controls: any;
  projects: any;
  workbenchController: any;
  actions: any;
  charts: any;
  annualTrainingStats: any;
  resultTable: any;
  summaryView: any;
  simulationSchedule: any;
  trainingCalendar: any;
}

interface Window {
  TrainingToolApp: TrainingToolAppRuntime;
  echarts?: any;
}
