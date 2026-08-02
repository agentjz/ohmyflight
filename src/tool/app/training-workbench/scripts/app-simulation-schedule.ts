import { TrainingToolSimulationSchedule } from "./simulation-schedule";
import type { TrainingSimulationRecordInput, TrainingToolAppRuntime } from "./models";
import { TrainingToolUtils } from "./utils";

export function installTrainingAppSimulationSchedule(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const SimulationSchedule = TrainingToolSimulationSchedule;
  const state = runtime.state;
  const elements = runtime.elements;

  function syncState() {
    state.simulationRecords = SimulationSchedule.list();
  }

  function renderProjectOptions() {
    const currentValue = elements.simulationProjectSelect.value;
    const projects = state.analysis && state.analysis.projects
      ? state.analysis.projects.filter((project) => project.peopleColumnIndex >= 0)
      : [];

    elements.simulationProjectSelect.innerHTML = [
      '<option value="">请选择项目</option>',
      ...projects.map((project) => `<option value="${Utils.escapeHtml(project.canonical)}">${Utils.escapeHtml(project.canonical)}</option>`)
    ].join("");

    if (projects.some((project) => project.canonical === currentValue)) {
      elements.simulationProjectSelect.value = currentValue;
    }
  }

  function ensureDefaultDates() {
    const today = new Date();
    const todayText = Utils.formatDate(Utils.makeDate(today.getFullYear(), today.getMonth() + 1, today.getDate()));
    if (!elements.simulationStartDateInput.value) {
      elements.simulationStartDateInput.value = todayText;
    }
    if (!elements.simulationEndDateInput.value) {
      elements.simulationEndDateInput.value = elements.simulationStartDateInput.value;
    }
    if (!elements.simulationRemarkInput.value) {
      elements.simulationRemarkInput.value = "模拟排班";
    }
  }

  function renderTable() {
    const records = state.simulationRecords || [];
    elements.simulationSummary.textContent = records.length
      ? `当前有 ${records.length} 条模拟排班记录，只影响当前浏览器里的排班总览。`
      : "当前没有模拟排班记录。";

    if (!records.length) {
      elements.simulationTableBody.innerHTML = `<tr><td class="empty-block" colspan="7">当前没有模拟排班记录。</td></tr>`;
      return;
    }

    elements.simulationTableBody.innerHTML = records.map((record) => `
      <tr>
        <td>${Utils.escapeHtml(record.projectName)}</td>
        <td class="person-name">${Utils.escapeHtml(record.name || "-")}</td>
        <td>${Utils.escapeHtml(record.employeeId || "-")}</td>
        <td>${Utils.escapeHtml(record.trainingStartDate)}</td>
        <td>${Utils.escapeHtml(record.trainingEndDate)}</td>
        <td>${Utils.escapeHtml(record.remark || "-")}</td>
        <td>
          <button class="action-button action-button-compact" type="button" data-role="remove-simulation" data-id="${Utils.escapeHtml(record.id)}">删除</button>
        </td>
      </tr>
    `).join("");
  }

  function render() {
    syncState();
    renderProjectOptions();
    ensureDefaultDates();
    renderTable();
    if (runtime.controls) runtime.controls.refreshButtons();
  }

  function buildRecordsFromSelection(): TrainingSimulationRecordInput[] {
    if (!state.workbenchSelection || !state.workbenchSelection.rows || !state.workbenchSelection.rows.length) {
      throw new Error("请先点击项目风险矩阵中的数字，打开人员明细。");
    }
    if (!state.workbenchSelectedPersonKeys || !state.workbenchSelectedPersonKeys.length) {
      throw new Error("请先在人员明细中选择要加入模拟排班的人员。");
    }

    const projectName = elements.simulationProjectSelect.value || state.workbenchSelection.projectName;
    const trainingStartDate = elements.simulationStartDateInput.value;
    const trainingEndDate = elements.simulationEndDateInput.value || trainingStartDate;
    const remark = elements.simulationRemarkInput.value || "模拟排班";
    const selectedKeys = new Set(state.workbenchSelectedPersonKeys || []);

    return state.workbenchSelection.rows
      .filter((row) => selectedKeys.has(runtime.summaryView.personKey(row)))
      .map((row) => ({
        projectName,
        employeeId: row.employeeId,
        name: row.name,
        trainingStartDate,
        trainingEndDate,
        remark
      }));
  }

  function refreshWorkbenchWithSimulation(message: string): void {
    syncState();
    if (state.analysis && runtime.workbenchController) {
      runtime.workbenchController.refreshWorkbenchResult(message);
      return;
    }
    render();
    if (runtime.controls && message) runtime.controls.setStatus(message);
  }

  function handleAddSelection() {
    try {
      const added = SimulationSchedule.addMany(buildRecordsFromSelection());
      refreshWorkbenchWithSimulation(`已加入 ${added.length} 条模拟排班记录。`);
    } catch (error) {
      runtime.controls.setStatus(Utils.errorMessage(error, "加入模拟排班失败。"), true);
    }
  }

  function handleClear() {
    SimulationSchedule.clear();
    refreshWorkbenchWithSimulation("已清空模拟排班记录。");
  }

  function handleRemove(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.role !== "remove-simulation") return;
    SimulationSchedule.remove(target.dataset.id || "");
    refreshWorkbenchWithSimulation("已删除 1 条模拟排班记录。");
  }

  function clearRecords() {
    SimulationSchedule.clear();
    syncState();
    render();
  }

  runtime.simulationSchedule = {
    render,
    handleAddSelection,
    handleClear,
    handleRemove,
    clearRecords
  };
}
