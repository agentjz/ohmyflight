import type { TrainingQualificationPressureResult, TrainingSmartScheduleResult, TrainingToolAppRuntime } from "./models";
import { TrainingToolQualificationPressure } from "./qualification-pressure";
import { TrainingToolSmartSchedule } from "./smart-schedule";
import { TrainingToolTrainingLoad } from "./training-load";
import { TrainingToolUtils } from "./utils";

export function createTrainingCapacityRenderers(runtime: TrainingToolAppRuntime): {
  renderQualificationPressure(selectedMonth?: string): void;
  renderTrainingLoad(): void;
  renderSmartSchedule(selectedMonth?: string, rebuildPlan?: boolean): void;
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
    return elements.qualificationPressureModeGroup.querySelector<HTMLInputElement>('input[name="qualificationPressureMode"]:checked')?.value || "forecast";
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

  function smartScheduleRows(result: TrainingSmartScheduleResult, selectedMonth: string) {
    return result.items.filter((item) => item.recommendedMonth === selectedMonth);
  }

  function smartScheduleMonthKeys(startMonth: string, horizonMonths: number): string[] {
    const range = Utils.monthRangeFromKey(startMonth);
    if (!range || !Number.isInteger(horizonMonths) || horizonMonths < 12 || horizonMonths > 60) return [];
    return Array.from({ length: horizonMonths }, (_, index) => (
      Utils.toMonthKey(
        Utils.makeDate(range.start.getFullYear(), range.start.getMonth() + 1 + index, 1)
      )
    ));
  }

  function smartScheduleAvoidedMonths(): number[] {
    return Array.from(elements.smartScheduleAvoidMonthsGroup
      .querySelectorAll<HTMLInputElement>('input[name="smartScheduleAvoidMonth"]:checked'))
      .map((input) => Number(input.value))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  }

  function smartScheduleFixedLoadRows(
    startMonth: string,
    horizonMonths: number
  ): Array<{ monthKey: string; personDays: number }> {
    if (!state.workbook || !state.analysis) return [];
    const monthKeys = smartScheduleMonthKeys(startMonth, horizonMonths);
    const years = [...new Set(monthKeys.map((monthKey) => Number(monthKey.slice(0, 4))))];
    const crmLoads = new Map<string, number>();
    years.forEach((year) => {
      const load = TrainingToolTrainingLoad.buildLoad(state.workbook!, state.analysis!, {
        year,
        projectName: "CRM"
      });
      load.monthRows.forEach((row) => {
        crmLoads.set(row.monthKey, row.personDays);
      });
    });
    return monthKeys.map((monthKey) => ({
      monthKey,
      personDays: crmLoads.get(monthKey) || 0
    }));
  }

  function renderSmartScheduleDetails(result: TrainingSmartScheduleResult | null, selectedMonth: string): void {
    if (!result) {
      elements.smartScheduleDetailPanel.hidden = true;
      elements.smartScheduleDetailTitle.textContent = "智能推荐明细";
      elements.smartScheduleDetailBody.innerHTML = '<tr><td class="empty-block" colspan="7">点击图中的月份查看智能推荐人员项目。</td></tr>';
      return;
    }
    const rows = selectedMonth
      ? smartScheduleRows(result, selectedMonth)
      : result.items.filter((item) => !item.schedulable);
    if (!selectedMonth && !rows.length) {
      elements.smartScheduleDetailPanel.hidden = true;
      elements.smartScheduleDetailTitle.textContent = "智能推荐明细";
      elements.smartScheduleDetailBody.innerHTML = '<tr><td class="empty-block" colspan="7">点击图中的月份查看智能推荐人员项目。</td></tr>';
      return;
    }
    elements.smartScheduleDetailPanel.hidden = false;
    elements.smartScheduleDetailTitle.textContent = selectedMonth
      ? `${selectedMonth} 智能推荐（${rows.length} 人项）`
      : `无法在资质过期前安排（${rows.length} 人项）`;
    elements.smartScheduleDetailBody.innerHTML = rows.length ? rows.map((row) => {
      return `
        <tr>
          <td>${Utils.escapeHtml(row.projectName)}</td>
          <td class="person-name">${Utils.escapeHtml(row.name || "-")}</td>
          <td>${Utils.escapeHtml(row.employeeId || "-")}</td>
          <td>${Utils.escapeHtml(row.recommendedMonth || "-")}</td>
          <td>${Utils.escapeHtml(row.dueDate)}</td>
          <td>${row.personDays}</td>
          <td>${Utils.escapeHtml(row.reason)}</td>
        </tr>
      `;
    }).join("") : '<tr><td class="empty-block" colspan="7">当前月份没有智能推荐人员项目。</td></tr>';
  }

  function renderSmartSchedule(selectedMonth = "", rebuildPlan = false): void {
    if (selectedMonth && state.smartSchedule) {
      state.smartScheduleSelectedMonth = selectedMonth;
      renderSmartScheduleDetails(state.smartSchedule, selectedMonth);
      return;
    }
    if (!state.analysis) {
      state.smartSchedulePlan = null;
      state.smartSchedule = null;
      state.smartScheduleSelectedMonth = "";
      renderProjectOptions(elements.smartScheduleProjectSelect, [], "全部资质项目");
      charts.renderSmartScheduleChart(null);
      renderSmartScheduleDetails(null, "");
      return;
    }
    if (rebuildPlan || !state.smartSchedulePlan) {
      const startMonth = elements.smartScheduleStartMonthInput.value;
      const horizonMonths = Number(elements.smartScheduleHorizonInput.value);
      state.smartSchedulePlan = TrainingToolSmartSchedule.buildPlan(state.analysis, {
        startMonth,
        horizonMonths,
        safetyLeadMonths: Number(elements.smartScheduleSafetyLeadInput.value),
        avoidedMonths: smartScheduleAvoidedMonths(),
        fixedLoadRows: smartScheduleFixedLoadRows(startMonth, horizonMonths)
      });
    }
    const result = TrainingToolSmartSchedule.buildView(state.smartSchedulePlan, {
      projectName: elements.smartScheduleProjectSelect.value
    });
    renderProjectOptions(elements.smartScheduleProjectSelect, state.smartSchedulePlan.availableProjects, "全部资质项目");
    state.smartSchedule = result;
    charts.renderSmartScheduleChart(result);
    const selected = state.smartScheduleSelectedMonth;
    if (selected && result.monthRows.some((row) => row.monthKey === selected)) {
      renderSmartScheduleDetails(result, selected);
    } else {
      state.smartScheduleSelectedMonth = "";
      renderSmartScheduleDetails(result, "");
    }
  }

  return {
    renderQualificationPressure,
    renderTrainingLoad,
    renderSmartSchedule
  };
}
