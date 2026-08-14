import { TrainingToolCrmAnnual } from "./crm-annual";
import { createTrainingCapacityRenderers } from "./app-training-capacity";
import { TrainingToolScanner } from "./scanner";
import { TrainingToolUtils } from "./utils";
import type {
  TrainingCrmAnnualResult,
  TrainingStatsCard,
  TrainingToolAppRuntime,
  TrainingToolProjectAnalysis,
  TrainingValidityResult,
  TrainingWorkbenchResult
} from "./models";

export function installTrainingAppRenderers(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const COPY = runtime.copy;
  const state = runtime.state;
  const elements = runtime.elements;
  const charts = runtime.charts;
  const resultTable = runtime.resultTable;
  const summaryView = runtime.summaryView;
  const CrmAnnual = TrainingToolCrmAnnual;
  const Scanner = TrainingToolScanner;
  const { renderQualificationPressure, renderTrainingLoad } = createTrainingCapacityRenderers(runtime);

  type ProjectGroupElements = {
    groupElement: HTMLElement;
    selectAllElement: HTMLInputElement;
    summaryElement: HTMLElement;
    listElement: HTMLElement;
  };
  type RenderStatCard = Pick<TrainingStatsCard, "label" | "value"> & Partial<Pick<TrainingStatsCard, "tone" | "hint">>;

  function renderWorkbookOverview(): void {
    if (!state.analysis) {
      elements.workbookOverview.innerHTML = `<div class="empty-block">${COPY.defaultOverview}</div>`;
      return;
    }

    elements.workbookOverview.innerHTML = `
      <div class="overview-grid">
        <article class="overview-item">
          <span>文件名</span>
          <strong>${Utils.escapeHtml(state.sourceFileName)}</strong>
        </article>
        <article class="overview-item">
          <span>人员信息表</span>
          <strong>${Utils.escapeHtml(state.analysis.peopleInfo.name)}</strong>
        </article>
        <article class="overview-item">
          <span>可识别培训类型</span>
          <strong>${state.analysis.projects.length}</strong>
        </article>
        <article class="overview-item">
          <span>可选月份</span>
          <strong>${state.analysis.availableMonths.length}</strong>
        </article>
        <article class="overview-item">
          <span>工作表总数</span>
          <strong>${state.analysis.sheetNames.length}</strong>
        </article>
        <article class="overview-item">
          <span>人员行数</span>
          <strong>${state.analysis.peopleInfo.rows.length}</strong>
        </article>
      </div>
    `;
  }

  function renderWorkbookHealth(): void {
    const health = state.workbookHealth;
    if (!health) {
      elements.workbookHealthPanel.innerHTML = `<div class="empty-block">导入文件后，这里会显示 Excel 健康检查结果。</div>`;
      return;
    }

    const summary = health.summary || { error: 0, warning: 0, info: 0 };
    const items = health.items || [];
    const visibleItems = [
      ...items.filter((item) => item.level === "error"),
      ...items.filter((item) => item.level === "warning"),
      ...items.filter((item) => item.level === "info")
    ].slice(0, 80);

    elements.workbookHealthPanel.innerHTML = `
      <div class="health-summary">
        <span class="health-pill health-pill-danger">严重 ${Utils.escapeHtml(summary.error || 0)}</span>
        <span class="health-pill health-pill-warning">警告 ${Utils.escapeHtml(summary.warning || 0)}</span>
        <span class="health-pill health-pill-info">提示 ${Utils.escapeHtml(summary.info || 0)}</span>
      </div>
      <div class="health-list">
        ${visibleItems.length ? visibleItems.map((item) => `
          <div class="health-item">
            <span class="badge ${item.level === "error" ? "danger" : item.level === "warning" ? "warn" : "info"}">${Utils.escapeHtml(item.levelLabel)}</span>
            <span class="health-area">${Utils.escapeHtml(item.area)}</span>
            <span>
              <span class="health-message">${Utils.escapeHtml(item.message)}</span>
              ${item.detail ? `<span class="health-detail">${Utils.escapeHtml(item.detail)}</span>` : ""}
            </span>
          </div>
        `).join("") : '<div class="empty-block">当前没有健康检查提示。</div>'}
      </div>
    `;
  }

  function renderValiditySheetOptions(): void {
    const options = state.analysis
      ? [`<option value="${Utils.escapeHtml(state.analysis.peopleInfo.name)}">${Utils.escapeHtml(state.analysis.peopleInfo.name)}</option>`]
      : ['<option value="">请先导入文件</option>'];

    elements.updateValiditySheetSelect.innerHTML = options.join("");
    elements.updateValiditySheetSelect.disabled = !state.analysis;
  }

  function renderProjectCheckboxGroup(kind: string, projects: TrainingToolProjectAnalysis[], selectedNames: string[]): void {
    const groupElements = getProjectGroupElements(kind);
    const { groupElement, selectAllElement, summaryElement, listElement } = groupElements;

    groupElement.classList.toggle("is-disabled", !state.analysis || !projects.length);

    if (!state.analysis) {
      selectAllElement.checked = false;
      selectAllElement.indeterminate = false;
      selectAllElement.disabled = true;
      summaryElement.textContent = "请先导入文件";
      listElement.innerHTML = '<div class="checkbox-empty">请先导入文件</div>';
      return;
    }

    if (!projects.length) {
      selectAllElement.checked = false;
      selectAllElement.indeterminate = false;
      selectAllElement.disabled = true;
      summaryElement.textContent = "当前没有可用培训类型";
      listElement.innerHTML = '<div class="checkbox-empty">当前没有可用培训类型</div>';
      return;
    }

    const selectedSet = new Set((selectedNames || []).map((value) => Utils.normalizeText(value)).filter(Boolean));
    const selectedCount = projects.filter((project) => selectedSet.has(project.canonical)).length;

    selectAllElement.disabled = false;
    selectAllElement.checked = selectedCount > 0 && selectedCount === projects.length;
    selectAllElement.indeterminate = selectedCount > 0 && selectedCount < projects.length;
    summaryElement.textContent = selectedCount
      ? `已选 ${selectedCount} 项，共 ${projects.length} 项`
      : `可选 ${projects.length} 项，可全选或多选`;

    listElement.innerHTML = projects.map((project) => {
      const checked = selectedSet.has(project.canonical);
      return `
        <label class="checkbox-chip${checked ? " is-checked" : ""}">
          <input type="checkbox" data-role="project" value="${Utils.escapeHtml(project.canonical)}"${checked ? " checked" : ""}>
          <span class="checkbox-chip-box" aria-hidden="true"></span>
          <span class="checkbox-chip-text">${Utils.escapeHtml(project.canonical)}</span>
        </label>
      `;
    }).join("");
  }

  function getProjectGroupElements(kind: string): ProjectGroupElements {
    if (kind === "update") {
      return {
        groupElement: elements.updateProjectGroup,
        selectAllElement: elements.updateProjectSelectAll,
        summaryElement: elements.updateProjectSummary,
        listElement: elements.updateProjectList
      };
    }
    throw new Error(`未知培训类型选择区域：${kind}`);
  }

  function renderSelectOptions(selectElement: HTMLSelectElement, values: string[], emptyLabel: string): void {
    const currentValue = selectElement.value;
    selectElement.innerHTML = [
      `<option value="">${Utils.escapeHtml(emptyLabel)}</option>`,
      ...(values || []).map((value) => `<option value="${Utils.escapeHtml(value)}">${Utils.escapeHtml(value)}</option>`)
    ].join("");
    if ((values || []).includes(currentValue)) {
      selectElement.value = currentValue;
    }
  }

  function renderWorkbenchFilterOptions(result: TrainingWorkbenchResult | null): void {
    const options = result && result.filterOptions
      ? result.filterOptions
      : { projects: [], statuses: [], months: [] };
    renderSelectOptions(elements.workbenchProjectSelect, options.projects, "全部项目");
    renderSelectOptions(elements.workbenchStatusSelect, options.statuses, "全部状态");
    renderSelectOptions(elements.workbenchMonthSelect, options.months, "全部月份");
  }

  function renderProjectCards(): void {
    if (!state.analysis || !state.analysis.projects.length) {
      elements.projectCards.innerHTML = `<div class="empty-block">${COPY.defaultProjectCards}</div>`;
      return;
    }

    elements.projectCards.innerHTML = state.analysis.projects.map((project) => {
      const recordedMonths = project.recordedMonths.length ? project.recordedMonths.join("、") : "无";
      const pendingMonths = project.pendingMonths.length ? project.pendingMonths.join("、") : "无";
      const validityUpdateMonths = project.validityUpdateMonths.length ? project.validityUpdateMonths.join("、") : "无";
      const monthBadges = project.availableMonths.length
        ? project.availableMonths.map((month) => `<span>${Utils.escapeHtml(month)}</span>`).join("")
        : "<span>暂无月份</span>";

      return `
        <article class="tool-card">
          <h3>${Utils.escapeHtml(project.canonical)}</h3>
          <ul>
            <li>人员信息列：${project.peopleHeader ? Utils.escapeHtml(project.peopleHeader) : "未识别"}</li>
            <li>项目 sheet：${project.sheetName ? Utils.escapeHtml(project.sheetName) : "未识别"}</li>
            <li>已录入行数：${Utils.escapeHtml(project.recordedRowCount)}</li>
            <li>未录入行数：${Utils.escapeHtml(project.pendingRowCount)}</li>
            <li>机器看Y行数：${Utils.escapeHtml(project.validityUpdateRowCount)}</li>
            <li>已录入月份：${Utils.escapeHtml(recordedMonths)}</li>
            <li>未录入月份：${Utils.escapeHtml(pendingMonths)}</li>
            <li>更新月份：${Utils.escapeHtml(validityUpdateMonths)}</li>
          </ul>
          <div class="month-badges">${monthBadges}</div>
        </article>
      `;
    }).join("");
  }

  function renderStats(cards: RenderStatCard[] | null): void {
    if (!cards || !cards.length) {
      elements.statsGrid.innerHTML = `
        <article class="stat-card">
          <span class="muted">${COPY.defaultWaiting}</span>
          <strong>-</strong>
        </article>
      `;
      return;
    }

    elements.statsGrid.innerHTML = cards.map((card) => `
      <article class="stat-card${card.tone ? ` stat-card-${Utils.escapeHtml(card.tone)}` : ""}">
        <span class="muted">${Utils.escapeHtml(card.label)}</span>
        <strong>${Utils.escapeHtml(card.value)}</strong>
        ${card.hint ? `<small>${Utils.escapeHtml(card.hint)}</small>` : ""}
      </article>
    `).join("");
  }

  function renderCrmStats(result: TrainingCrmAnnualResult | null): void {
    if (!result) {
      elements.crmStatsGrid.innerHTML = `
        <article class="stat-card">
          <span class="muted">等待核对</span>
          <strong>-</strong>
        </article>
      `;
      return;
    }

    const cards = [
      { label: "应参加", value: result.stats.required, tone: "info" },
      { label: "已参加", value: result.stats.attended, tone: "ok" },
      { label: "未参加", value: result.stats.missing, tone: "danger" },
      { label: "重复安排", value: result.stats.duplicates || 0, tone: result.stats.duplicates ? "warning" : "muted" },
      { label: "CRM教员", value: result.stats.instructors, tone: "muted" }
    ];

    elements.crmStatsGrid.innerHTML = cards.map((card) => `
      <article class="stat-card${card.tone ? ` stat-card-${Utils.escapeHtml(card.tone)}` : ""}">
        <span class="muted">${Utils.escapeHtml(card.label)}</span>
        <strong>${Utils.escapeHtml(card.value)}</strong>
      </article>
    `).join("");
  }

  function renderCrmDuplicates(result: TrainingCrmAnnualResult | null): void {
    if (!result) {
      elements.crmDuplicateSummary.textContent = "导入总表后显示当前年份 CRM 重复安排人员。";
      elements.crmDuplicateBody.innerHTML = `<tr><td class="empty-block" colspan="6">导入总表后显示 CRM 重复安排人员。</td></tr>`;
      return;
    }

    if (!result.hasCrmSheet) {
      elements.crmDuplicateSummary.textContent = "未找到精确名为 CRM 的工作表，无法检查重复安排。";
      elements.crmDuplicateBody.innerHTML = `<tr><td class="empty-block" colspan="6">未找到精确名为 CRM 的工作表。</td></tr>`;
      return;
    }

    const duplicates = result.duplicateRows || [];
    if (!duplicates.length) {
      elements.crmDuplicateSummary.textContent = `${result.year} 年 CRM 当前没有重复安排人员。`;
      elements.crmDuplicateBody.innerHTML = `<tr><td class="empty-block" colspan="6">当前年份没有重复安排人员。</td></tr>`;
      return;
    }

    elements.crmDuplicateSummary.textContent = `${result.year} 年 CRM 发现 ${duplicates.length} 人存在重复安排，CRM 年度只需参加一次。`;
    elements.crmDuplicateBody.innerHTML = duplicates.map((row) => `
      <tr>
        <td class="person-name">${Utils.escapeHtml(row.name || "-")}</td>
        <td>${Utils.escapeHtml(row.employeeId || "-")}</td>
        <td>${Utils.escapeHtml(row.count)}</td>
        <td>${Utils.escapeHtml((row.dates || []).join("、") || "-")}</td>
        <td>${Utils.escapeHtml((row.rowNumbers || []).map((value) => `第${value}行`).join("、") || "-")}</td>
        <td>${Utils.escapeHtml((row.instructors || []).join("、") || "-")}</td>
      </tr>
    `).join("");
  }

  function renderCrmAnnual(): void {
    if (!state.workbook || !state.analysis) {
      state.crmAnnualResult = null;
      elements.crmYearInput.disabled = true;
      elements.crmYearInput.value = String(new Date().getFullYear());
      elements.crmSummary.textContent = "导入总表后显示 CRM 年度核对结果。";
      elements.crmMissingBody.innerHTML = `<tr><td class="empty-block" colspan="4">导入总表后显示未参加 CRM 人员。</td></tr>`;
      renderCrmDuplicates(null);
      renderCrmStats(null);
      charts.renderCrmCharts(null);
      return;
    }

    elements.crmYearInput.disabled = false;
    if (!elements.crmYearInput.value) {
      elements.crmYearInput.value = String(new Date().getFullYear());
    }

    const result = CrmAnnual.buildAnnualCheck(
      state.workbook,
      state.analysis,
      Scanner,
      elements.crmYearInput.value
    );

    state.crmAnnualResult = result;
    renderCrmStats(result);
    renderCrmDuplicates(result);
    charts.renderCrmCharts(result);
    elements.crmSummary.textContent = result.hasCrmSheet
      ? `${result.year} 年 CRM：应参加 ${result.stats.required} 人，已参加 ${result.stats.attended} 人，未参加 ${result.stats.missing} 人。`
      : "未找到精确名为 CRM 的工作表，无法核对 CRM 年度参加情况。";
    runtime.controls.refreshButtons();

    if (!result.hasCrmSheet) {
      elements.crmMissingBody.innerHTML = `<tr><td class="empty-block" colspan="4">未找到精确名为 CRM 的工作表。</td></tr>`;
      return;
    }

    if (!result.missingPeople.length) {
      elements.crmMissingBody.innerHTML = `<tr><td class="empty-block" colspan="4">当前年份没有未参加 CRM 人员。</td></tr>`;
      return;
    }

    elements.crmMissingBody.innerHTML = result.missingPeople.map((person) => `
      <tr>
        <td class="person-name">${Utils.escapeHtml(person.name || "-")}</td>
        <td>${Utils.escapeHtml(person.employeeId || "-")}</td>
        <td>${Utils.escapeHtml(person.department || "-")}</td>
        <td>${Utils.escapeHtml(person.techInfo || "-")}</td>
      </tr>
    `).join("");
  }

  function renderResultPlaceholders(): void {
    renderStats(null);
    charts.renderWorkbenchCharts(null);
    summaryView.renderWorkbenchSummary(null);
    if (runtime.simulationSchedule) runtime.simulationSchedule.render();
    resultTable.renderTable(elements.detailTableHead, elements.detailTableBody, [], [], COPY.defaultDetailTable);
    resultTable.renderTable(elements.skippedTableHead, elements.skippedTableBody, [], [], COPY.defaultSkippedTable);
    resultTable.renderSkippedSummary(0);
    elements.detailDetails.open = false;
    elements.detailTableTitle.textContent = "结果明细";
    elements.resultSummary.textContent = COPY.defaultResultSummary;
  }

  function renderActionResult(kind: "workbench" | "validity", result: TrainingWorkbenchResult | TrainingValidityResult): void {
    elements.resultSummary.textContent = result.summaryText;
    renderStats(result.statsCards);

    if (kind === "workbench") {
      const workbenchResult = result as TrainingWorkbenchResult;
      charts.renderWorkbenchCharts(workbenchResult.chartData);
      summaryView.renderWorkbenchSummary(workbenchResult.summaryData);
      elements.detailTableTitle.textContent = "排班总览明细";
      resultTable.renderTable(
        elements.detailTableHead,
        elements.detailTableBody,
        workbenchResult.displayColumns || workbenchResult.detailColumns,
        resultTable.toWorkbenchDetailRows(workbenchResult.detailRows),
        "当前没有需要展示的人员项目记录。"
      );
      resultTable.renderTable(
        elements.skippedTableHead,
        elements.skippedTableBody,
        workbenchResult.skippedColumns,
        workbenchResult.skippedRows,
        "排班总览没有额外提示。"
      );
      resultTable.renderSkippedSummary(0);
      elements.detailDetails.open = false;
      return;
    }

    summaryView.renderWorkbenchSummary(null);
    charts.renderWorkbenchCharts(null);

    if (kind === "validity") {
      const validityResult = result as TrainingValidityResult;
      elements.detailTableTitle.textContent = "更新明细";
      resultTable.renderTable(elements.detailTableHead, elements.detailTableBody, validityResult.detailColumns, resultTable.toValidityDetailRows(validityResult.detailRows), "本次没有生成更新明细。");
      resultTable.renderTable(elements.skippedTableHead, elements.skippedTableBody, validityResult.skippedColumns, resultTable.toValiditySkippedRows(validityResult.skippedRows), "本次没有跳过记录。");
      resultTable.renderSkippedSummary(validityResult.skippedRows.length);
      return;
    }

    throw new Error(`未知结果类型：${kind}`);
  }

  runtime.renderers = {
    renderWorkbookOverview,
    renderWorkbookHealth,
    renderValiditySheetOptions,
    renderProjectCheckboxGroup,
    renderWorkbenchFilterOptions,
    renderProjectCards,
    renderQualificationPressure,
    renderTrainingLoad,
    renderCrmAnnual,
    renderResultPlaceholders,
    renderActionResult
  };
}
