import { installTrainingAppCopy } from "./app-copy";
import type { TrainingToolAppRuntime } from "./models";
import { installTrainingAppState } from "./app-state";
import { installTrainingAppElements } from "./app-elements";
import { installTrainingAppPersonValidityQuery } from "./app-person-validity-query";
import { installTrainingAppScheduleGapCheck } from "./app-schedule-gap-check";
import { installTrainingAppTrainingCalendar } from "./app-training-calendar";
import { installTrainingAppCharts } from "./app-charts";
import { installTrainingAppResultTable } from "./app-result-table";
import { installTrainingAppSummaryView } from "./app-summary-view";
import { installTrainingAppRenderers } from "./app-renderers";
import { installTrainingAppSelection } from "./app-selection";
import { installTrainingAppControls } from "./app-controls";
import { installTrainingAppProjects } from "./app-projects";
import { installTrainingAppWorkbenchController } from "./app-workbench-controller";
import { installTrainingAppSimulationSchedule } from "./app-simulation-schedule";
import { installTrainingAppActions } from "./app-actions";

function createRuntime(): TrainingToolAppRuntime {
  const runtime = {} as TrainingToolAppRuntime;
  installTrainingAppCopy(runtime);
  installTrainingAppState(runtime);
  installTrainingAppElements(runtime);
  installTrainingAppPersonValidityQuery(runtime);
  installTrainingAppScheduleGapCheck(runtime);
  installTrainingAppTrainingCalendar(runtime);
  installTrainingAppCharts(runtime);
  installTrainingAppResultTable(runtime);
  installTrainingAppSummaryView(runtime);
  installTrainingAppRenderers(runtime);
  installTrainingAppSelection(runtime);
  installTrainingAppControls(runtime);
  installTrainingAppProjects(runtime);
  installTrainingAppWorkbenchController(runtime);
  installTrainingAppSimulationSchedule(runtime);
  installTrainingAppActions(runtime);
  return runtime;
}

function init(runtime: TrainingToolAppRuntime): void {
  const { elements, controls, projects, workbenchController, actions } = runtime;
  elements.workbookFile.addEventListener("change", actions.handleWorkbookChange);
  elements.updateValiditySheetSelect.addEventListener("change", controls.invalidateExportPreview);
  elements.updateMonthSelect.addEventListener("change", controls.invalidateExportPreview);
  elements.workbenchStartDateInput.addEventListener("change", workbenchController.handleWorkbenchRangeChange);
  elements.workbenchEndDateInput.addEventListener("change", workbenchController.handleWorkbenchRangeChange);
  elements.workbenchProjectSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
  elements.workbenchStatusSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
  elements.workbenchMonthSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
  elements.workbenchSearchInput.addEventListener("input", workbenchController.handleWorkbenchFilterChange);
  elements.qualificationPressureStartMonthInput.addEventListener("change", () => runtime.renderers.renderQualificationPressure());
  elements.qualificationPressureHorizonSelect.addEventListener("change", () => runtime.renderers.renderQualificationPressure());
  elements.qualificationPressureProjectSelect.addEventListener("change", () => runtime.renderers.renderQualificationPressure());
  elements.qualificationPressureModeGroup.addEventListener("change", () => runtime.renderers.renderQualificationPressure());
  elements.trainingLoadYearInput.addEventListener("change", runtime.renderers.renderTrainingLoad);
  elements.trainingLoadProjectSelect.addEventListener("change", runtime.renderers.renderTrainingLoad);
  elements.smartScheduleYearInput.addEventListener("change", () => runtime.renderers.renderSmartSchedule());
  elements.smartScheduleAdvanceSelect.addEventListener("change", () => runtime.renderers.renderSmartSchedule());
  elements.smartScheduleProjectSelect.addEventListener("change", () => runtime.renderers.renderSmartSchedule());
  elements.crmYearInput.addEventListener("change", runtime.renderers.renderCrmAnnual);
  elements.updateProjectGroup.addEventListener("change", projects.handleUpdateProjectGroupChange);
  elements.updateValidityButton.addEventListener("click", actions.handleUpdatePreview);
  elements.workbenchButton.addEventListener("click", actions.handleWorkbenchPreview);
  elements.exportWorkbenchSelectionButton.addEventListener("click", actions.handleExportWorkbenchSelection);
  elements.exportWorkbenchViewButton.addEventListener("click", actions.handleExportWorkbenchView);
  elements.simulationAddSelectionButton.addEventListener("click", runtime.simulationSchedule.handleAddSelection);
  elements.simulationClearButton.addEventListener("click", runtime.simulationSchedule.handleClear);
  elements.simulationTableBody.addEventListener("click", runtime.simulationSchedule.handleRemove);
  elements.simulationProjectSelect.addEventListener("change", controls.refreshButtons);
  elements.simulationStartDateInput.addEventListener("change", () => {
    if (!elements.simulationEndDateInput.value) {
      elements.simulationEndDateInput.value = elements.simulationStartDateInput.value;
    }
    controls.refreshButtons();
  });
  elements.simulationEndDateInput.addEventListener("change", controls.refreshButtons);
  elements.exportCrmMissingButton.addEventListener("click", actions.handleExportCrmMissing);
  elements.exportButton.addEventListener("click", actions.handleExport);

  controls.initializeDefaultDates();
  projects.renderEmptyState();
  runtime.trainingCalendar.initialize();
  runtime.simulationSchedule.render();
  runtime.scheduleGapCheck.initialize();
  runtime.personValidityQuery.initialize();
}

const runtime = createRuntime();
document.addEventListener("DOMContentLoaded", () => init(runtime), { once: true });
