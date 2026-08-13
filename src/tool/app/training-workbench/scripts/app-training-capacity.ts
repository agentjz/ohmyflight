import type { TrainingQualificationPressureResult, TrainingToolAppRuntime } from "./models";
import { TrainingToolQualificationPressure } from "./qualification-pressure";
import { TrainingToolTrainingLoad } from "./training-load";
import { TrainingToolUtils } from "./utils";

export function createTrainingCapacityRenderers(runtime: TrainingToolAppRuntime): {
  renderQualificationPressure(selectedMonth?: string): void;
  renderTrainingLoad(): void;
} {
  const Utils = TrainingToolUtils;
  const state = runtime.state;
  const elements = runtime.elements;
  const charts = runtime.charts;

  function renderProjectOptions(select: HTMLSelectElement, projects: string[], emptyText: string): void {
    const selected = select.value;
    select.innerHTML = [
      `<option value="">${emptyText}</option>`,
      ...projects.map((project) => `<option value="${Utils.escapeHtml(project)}">${Utils.escapeHtml(project)}</option>`)
    ].join("");
    if (projects.includes(selected)) select.value = selected;
  }

  function getQualificationPressureMode(): string {
    return elements.qualificationPressureModeGroup.querySelector<HTMLInputElement>('input[name="qualificationPressureMode"]:checked')?.value || "compare";
  }

  function pressureDetailRows(result: TrainingQualificationPressureResult, monthKey: string) {
    const mode = getQualificationPressureMode();
    return result.items.filter((item) => {
      if (mode === "current") return item.currentDueMonth === monthKey;
      if (mode === "forecast") return item.forecastDueMonth === monthKey;
      return item.currentDueMonth === monthKey || item.forecastDueMonth === monthKey;
    });
  }

  function renderQualificationPressureDetails(result: TrainingQualificationPressureResult | null, monthKey: string): void {
    if (!result || !monthKey) {
      elements.qualificationPressureDetailPanel.hidden = true;
      elements.qualificationPressureDetailTitle.textContent = "月份明细";
      elements.qualificationPressureDetailBody.innerHTML = '<tr><td class="empty-block" colspan="9">点击图中的月份查看人员项目。</td></tr>';
      return;
    }
    const rows = pressureDetailRows(result, monthKey);
    elements.qualificationPressureDetailPanel.hidden = false;
    elements.qualificationPressureDetailTitle.textContent = `${monthKey} 月份明细（${rows.length} 人项）`;
    elements.qualificationPressureDetailBody.innerHTML = rows.length ? rows.map((row) => `
      <tr>
        <td class="person-name">${Utils.escapeHtml(row.name || "-")}</td>
        <td>${Utils.escapeHtml(row.employeeId || "-")}</td>
        <td>${Utils.escapeHtml(row.projectName)}</td>
        <td>${Utils.escapeHtml(row.currentDueDate)}</td>
        <td>${Utils.escapeHtml(row.scheduledDate || "未安排")}</td>
        <td>${Utils.escapeHtml(row.forecastDueDate)}</td>
        <td><span class="badge ${row.coverageStatus === "已覆盖" ? "ok" : "danger"}">${Utils.escapeHtml(row.coverageStatus)}</span></td>
        <td>${row.daysEarly === null ? "-" : Utils.escapeHtml(row.daysEarly)}</td>
        <td>${Utils.escapeHtml(row.reason)}</td>
      </tr>
    `).join("") : '<tr><td class="empty-block" colspan="9">该月份没有对应的人项。</td></tr>';
  }

  function renderQualificationPressure(selectedMonth = ""): void {
    if (selectedMonth && state.qualificationPressure) {
      state.qualificationPressureSelectedMonth = selectedMonth;
      renderQualificationPressureDetails(state.qualificationPressure, selectedMonth);
      return;
    }
    if (!state.analysis) {
      state.qualificationPressure = null;
      state.qualificationPressureSelectedMonth = "";
      renderProjectOptions(elements.qualificationPressureProjectSelect, [], "全部资质项目");
      renderQualificationPressureDetails(null, "");
      charts.renderQualificationPressureChart(null, getQualificationPressureMode());
      return;
    }
    const result = TrainingToolQualificationPressure.buildPressure(state.analysis, {
      startMonth: elements.qualificationPressureStartMonthInput.value,
      horizonMonths: Number(elements.qualificationPressureHorizonSelect.value),
      projectName: elements.qualificationPressureProjectSelect.value,
      extraProjectRows: state.simulationRecords || []
    });
    renderProjectOptions(elements.qualificationPressureProjectSelect, result.availableProjects, "全部资质项目");
    state.qualificationPressure = result;
    charts.renderQualificationPressureChart(result, getQualificationPressureMode());
    const selected = state.qualificationPressureSelectedMonth;
    if (selected && result.monthRows.some((row) => row.monthKey === selected)) {
      renderQualificationPressureDetails(result, selected);
    } else {
      state.qualificationPressureSelectedMonth = "";
      renderQualificationPressureDetails(result, "");
    }
  }

  function renderTrainingLoad(): void {
    if (!state.workbook || !state.analysis) {
      state.trainingLoad = null;
      renderProjectOptions(elements.trainingLoadProjectSelect, [], "全部培训项目");
      charts.renderTrainingLoadChart(null);
      return;
    }
    const result = TrainingToolTrainingLoad.buildLoad(state.workbook, state.analysis, {
      year: elements.trainingLoadYearInput.value,
      projectName: elements.trainingLoadProjectSelect.value,
      extraProjectRows: state.simulationRecords || []
    });
    renderProjectOptions(elements.trainingLoadProjectSelect, result.projects, "全部培训项目");
    state.trainingLoad = result;
    charts.renderTrainingLoadChart(result);
  }

  return {
    renderQualificationPressure,
    renderTrainingLoad
  };
}
