import type { TrainingToolAppRuntime } from "./models";

export function installTrainingAppProjects(runtime: TrainingToolAppRuntime): void {
const COPY = runtime.copy;
  const state = runtime.state;
  const elements = runtime.elements;
  const renderers = runtime.renderers;
  const selection = runtime.selection;
  const controls = runtime.controls;

  function renderProjectGroups() {
    const updateProjects = selection.getUpdateProjects();

    state.updateSelectedProjects = selection.normalizeSelectedProjects(state.updateSelectedProjects, updateProjects);

    renderers.renderProjectCheckboxGroup("update", updateProjects, state.updateSelectedProjects);
  }

  function renderMonthSelect() {
    const selectedMonth = elements.updateMonthSelect.value;

    if (!state.analysis || !state.updateSelectedProjects.length) {
      elements.updateMonthSelect.innerHTML = '<option value="">请先选择培训类型</option>';
      elements.updateMonthSelect.disabled = true;
      controls.refreshButtons();
      return;
    }

    const commonMonths = selection.getCommonValidityUpdateMonths(state.updateSelectedProjects);
    if (!commonMonths.length) {
      elements.updateMonthSelect.innerHTML = '<option value="">所选培训类型没有共同更新月份</option>';
      elements.updateMonthSelect.disabled = true;
      controls.refreshButtons();
      return;
    }

    elements.updateMonthSelect.innerHTML = [
      '<option value="">请选择更新月份</option>',
      ...commonMonths.map((monthKey) => `<option value="${monthKey}">${monthKey}</option>`)
    ].join("");

    if (commonMonths.includes(selectedMonth)) {
      elements.updateMonthSelect.value = selectedMonth;
    }

    elements.updateMonthSelect.disabled = false;
    controls.refreshButtons();
  }

  function renderEmptyState() {
    state.updateSelectedProjects = [];
    state.workbenchResult = null;
    state.workbenchView = null;
    state.workbenchSelection = null;
    elements.workbenchSearchInput.value = "";
    renderers.renderWorkbookOverview();
    renderers.renderValiditySheetOptions();
    renderProjectGroups();
    renderMonthSelect();
    renderers.renderWorkbenchFilterOptions(null);
    renderers.renderProjectCards();
    renderers.renderResultPlaceholders();
    renderers.renderQualificationPressure();
    renderers.renderTrainingLoad();
    renderers.renderSmartSchedule();
    renderers.renderCrmAnnual();
    controls.clearPendingExport();
    controls.refreshButtons();
  }

  function handleUpdateProjectGroupChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const updateProjects = selection.getUpdateProjects();
    if (target.dataset.role === "select-all") {
      state.updateSelectedProjects = target.checked
        ? updateProjects.map((project) => project.canonical)
        : [];
    } else if (target.dataset.role === "project") {
      state.updateSelectedProjects = selection.getCheckedProjectValues(elements.updateProjectList);
    } else {
      return;
    }

    renderers.renderProjectCheckboxGroup("update", updateProjects, state.updateSelectedProjects);
    renderMonthSelect();
    controls.invalidateExportPreview();
  }

  runtime.projects = {
    renderProjectGroups,
    renderMonthSelect,
    renderEmptyState,
    handleUpdateProjectGroupChange
  };
}
