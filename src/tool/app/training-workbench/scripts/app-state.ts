import type { TrainingToolAppRuntime } from "./models";

export function installTrainingAppState(runtime: TrainingToolAppRuntime): void {
runtime.state = {
    sourceFileName: "",
    workbook: null,
    analysis: null,
    workbookHealth: null,
    busy: false,
    pendingExport: null,
    pendingExportName: "",
    pendingExportLabel: "",
    workbenchResult: null,
    workbenchView: null,
    workbenchSelection: null,
    workbenchSelectedPersonKeys: [],
    simulationRecords: [],
    qualificationPressure: null,
    qualificationPressureSelectedMonth: "",
    trainingLoad: null,
    smartSchedule: null,
    smartScheduleSelectedMonth: "",
    crmAnnualResult: null,
    trainingCalendarResult: null,
    trainingCalendarMonthKey: "",
    scheduleGapCheckResult: null,
    personValidityIndex: null,
    personValiditySelectedKey: "",
    updateSelectedProjects: []
  };
}
