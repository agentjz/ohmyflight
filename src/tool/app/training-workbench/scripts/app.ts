(function () {
  const runtime = window.TrainingToolApp;
  const elements = runtime.elements;
  const controls = runtime.controls;
  const projects = runtime.projects;
  const workbenchController = runtime.workbenchController;
  const actions = runtime.actions;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    elements.workbookFile.addEventListener("change", actions.handleWorkbookChange);
    elements.updateValiditySheetSelect.addEventListener("change", controls.invalidateExportPreview);
    elements.updateMonthSelect.addEventListener("change", controls.invalidateExportPreview);
    elements.workbenchStartDateInput.addEventListener("change", workbenchController.handleWorkbenchRangeChange);
    elements.workbenchEndDateInput.addEventListener("change", workbenchController.handleWorkbenchRangeChange);
    elements.workbenchProjectSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
    elements.workbenchStatusSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
    elements.workbenchMonthSelect.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
    elements.workbenchSearchInput.addEventListener("input", workbenchController.handleWorkbenchFilterChange);
    elements.workbenchPressureYearInput.addEventListener("change", workbenchController.handleWorkbenchFilterChange);
    elements.scheduledDistributionProjectSelect.addEventListener("change", runtime.renderers.renderScheduledDistribution);
    elements.scheduledDistributionMonthSelect.addEventListener("change", runtime.renderers.renderScheduledDistribution);
    elements.annualTrainingProjectSelect.addEventListener("change", runtime.renderers.renderAnnualTrainingStats);
    elements.annualTrainingYearSelect.addEventListener("change", runtime.renderers.renderAnnualTrainingStats);
    elements.annualTrainingMonthSelect.addEventListener("change", runtime.renderers.renderAnnualTrainingStats);
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
    runtime.personValidityQuery.initialize();
  }
})();
