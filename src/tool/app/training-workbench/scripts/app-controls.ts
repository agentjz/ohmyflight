import type { TrainingToolAppRuntime, TrainingToolWorkbook } from "./models";

export function installTrainingAppControls(runtime: TrainingToolAppRuntime): void {
const COPY = runtime.copy;
  const state = runtime.state;
  const elements = runtime.elements;

  function todayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function nextMonthEndString(): string {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, "0")}-${String(monthEnd.getDate()).padStart(2, "0")}`;
  }

  function initializeDefaultDates(): void {
    elements.workbenchStartDateInput.value = todayString();
    elements.workbenchEndDateInput.value = nextMonthEndString();
    elements.qualificationPressureStartMonthInput.value = todayString().slice(0, 7);
    elements.trainingLoadYearInput.value = String(new Date().getFullYear());
    elements.smartScheduleYearInput.value = String(new Date().getFullYear());
  }

  function setStatus(message: string, isError = false): void {
    elements.statusLine.textContent = message;
    elements.statusLine.classList.toggle("is-error", Boolean(isError));
  }

  function refreshButtons(): void {
    const canUpdate = Boolean(state.analysis)
      && Boolean(elements.updateValiditySheetSelect.value)
      && state.updateSelectedProjects.length > 0
      && Boolean(elements.updateMonthSelect.value)
      && !state.busy;

    const canWorkbench = Boolean(state.analysis) && !state.busy;
    const canExportWorkbenchView = Boolean(state.workbenchView && state.workbenchView.detailRows && state.workbenchView.detailRows.length) && !state.busy;
    const canExportWorkbenchSelection = Boolean(state.workbenchSelection && state.workbenchSelection.rows && state.workbenchSelection.rows.length) && !state.busy;
    const hasSimulationRecords = Boolean(state.simulationRecords && state.simulationRecords.length);
    const canAddSimulationSelection = Boolean(
      state.analysis
      && state.workbenchSelection
      && state.workbenchSelection.rows
      && state.workbenchSelection.rows.length
      && state.workbenchSelectedPersonKeys
      && state.workbenchSelectedPersonKeys.length
      && elements.simulationProjectSelect.value
      && elements.simulationStartDateInput.value
      && elements.simulationEndDateInput.value
    ) && !state.busy;
    const canExportCrmMissing = Boolean(
      state.crmAnnualResult
      && state.crmAnnualResult.hasCrmSheet
      && state.crmAnnualResult.missingPeople
      && state.crmAnnualResult.missingPeople.length
    ) && !state.busy;

    elements.updateValidityButton.disabled = !canUpdate;
    elements.workbenchButton.disabled = !canWorkbench;
    elements.exportWorkbenchViewButton.disabled = !canExportWorkbenchView;
    elements.exportWorkbenchSelectionButton.disabled = !canExportWorkbenchSelection;
    elements.simulationProjectSelect.disabled = !state.analysis || state.busy;
    elements.simulationStartDateInput.disabled = !state.analysis || state.busy;
    elements.simulationEndDateInput.disabled = !state.analysis || state.busy;
    elements.simulationRemarkInput.disabled = !state.analysis || state.busy;
    elements.simulationAddSelectionButton.disabled = !canAddSimulationSelection;
    elements.simulationClearButton.disabled = !hasSimulationRecords || state.busy;
    elements.exportCrmMissingButton.disabled = !canExportCrmMissing;
    elements.workbenchProjectSelect.disabled = !state.workbenchResult || state.busy;
    elements.workbenchStatusSelect.disabled = !state.workbenchResult || state.busy;
    elements.workbenchMonthSelect.disabled = !state.workbenchResult || state.busy;
    elements.workbenchSearchInput.disabled = !state.workbenchResult || state.busy;
    elements.workbenchStartDateInput.disabled = !state.analysis || state.busy;
    elements.workbenchEndDateInput.disabled = !state.analysis || state.busy;
    elements.qualificationPressureStartMonthInput.disabled = !state.analysis || state.busy;
    elements.qualificationPressureHorizonSelect.disabled = !state.analysis || state.busy;
    elements.qualificationPressureProjectSelect.disabled = !state.analysis || state.busy;
    elements.qualificationPressureModeGroup.disabled = !state.analysis || state.busy;
    elements.qualificationPressureModeGroup.querySelectorAll<HTMLInputElement>('input[name="qualificationPressureMode"]')
      .forEach((input) => {
        input.disabled = !state.analysis || state.busy;
      });
    elements.trainingLoadYearInput.disabled = !state.analysis || state.busy;
    elements.trainingLoadProjectSelect.disabled = !state.analysis || state.busy;
    elements.smartScheduleYearInput.disabled = !state.analysis || state.busy;
    elements.smartScheduleProjectSelect.disabled = !state.analysis || state.busy;
    elements.scheduleGapBaseDateInput.disabled = !state.analysis || state.busy;
    elements.scheduleGapHorizonGroup.disabled = !state.analysis || state.busy;
    elements.scheduleGapHorizonGroup.querySelectorAll<HTMLInputElement>('input[name="scheduleGapHorizon"]')
      .forEach((input) => {
        input.disabled = !state.analysis || state.busy;
      });
    elements.exportButton.disabled = !state.pendingExport || state.busy;
  }

  function setBusy(busy: boolean): void {
    state.busy = busy;
    elements.workbookFile.disabled = busy;
    refreshButtons();
  }

  function clearPendingExport(): void {
    state.pendingExport = null;
    state.pendingExportName = "";
    state.pendingExportLabel = "";
    elements.exportButton.textContent = COPY.defaultExportButton;
  }

  function setPendingExport(workbook: TrainingToolWorkbook, fileName: string, label: string, buttonText: string): void {
    state.pendingExport = workbook;
    state.pendingExportName = fileName;
    state.pendingExportLabel = label;
    elements.exportButton.textContent = buttonText;
  }

  function invalidateExportPreview(): void {
    clearPendingExport();
    refreshButtons();
  }

  runtime.controls = {
    initializeDefaultDates,
    setStatus,
    setBusy,
    clearPendingExport,
    setPendingExport,
    invalidateExportPreview,
    refreshButtons
  };
}
