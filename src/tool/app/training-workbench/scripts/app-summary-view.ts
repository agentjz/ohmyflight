import type {
  TrainingAssessmentRow,
  TrainingProjectSummaryRow,
  TrainingSummaryData,
  TrainingToolAppRuntime,
  TrainingVisibleStatusField
} from "./models";
import { TrainingToolUtils } from "./utils";
import { TrainingToolWorkbenchStatus } from "./workbench-status";

export function installTrainingAppSummaryView(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const WorkbenchStatus = TrainingToolWorkbenchStatus;
  const elements = runtime.elements;

  const STATUS_KEYS = WorkbenchStatus.VISIBLE_STATUS_FIELDS.map((item) => ({
    field: item.field,
    label: item.status
  }));

  type StatusKey = { field: TrainingVisibleStatusField; label: string };

  let currentSummaryRows: TrainingProjectSummaryRow[] = [];
  let selectedProject = "";
  let selectedStatus = "";

  function getRowsBySelection(projectName: string, status: string): TrainingAssessmentRow[] {
    const project = currentSummaryRows.find((row) => row.projectName === projectName);
    if (!project || !project.rowsByStatus) return [];
    return project.rowsByStatus[status] || [];
  }

  function findDefaultSelection(rows: TrainingProjectSummaryRow[]): { projectName: string; status: string } {
    for (const row of rows || []) {
      for (const statusItem of STATUS_KEYS) {
        if (row[statusItem.field] > 0) {
          return {
            projectName: row.projectName,
            status: statusItem.label
          };
        }
      }
    }
    return { projectName: "", status: "" };
  }

  function renderSelectedPeople(projectName: string, status: string): void {
    const rows = getRowsBySelection(projectName, status);
    runtime.state.workbenchSelection = projectName && status
      ? { projectName, status, rows }
      : null;
    if (runtime.controls) runtime.controls.refreshButtons();

    if (!projectName || !status) {
      elements.workbenchSelectedPeopleTitle.textContent = "人员明细";
      elements.workbenchSelectedPeopleIntro.textContent = "点击上方矩阵中的数字后显示具体人员。";
      elements.workbenchSelectedPeople.innerHTML = `<div class="empty-block">请选择一个项目和状态。</div>`;
      return;
    }

    elements.workbenchSelectedPeopleTitle.textContent = `${projectName} - ${status}`;
    elements.workbenchSelectedPeopleIntro.textContent = `共 ${rows.length} 人。`;

    if (!rows.length) {
      elements.workbenchSelectedPeople.innerHTML = `<div class="empty-block">当前没有对应人员。</div>`;
      return;
    }

    elements.workbenchSelectedPeople.innerHTML = `
      <div class="table-shell selected-person-shell">
        <table class="table table-hover align-middle result-table selected-person-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>员工号</th>
              <th>当前有效期</th>
              <th>最晚完成日期</th>
              <th>已排日期</th>
              <th>判断说明</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td class="person-name">${Utils.escapeHtml(row.name || "-")}</td>
                <td>${Utils.escapeHtml(row.employeeId || "-")}</td>
                <td>${Utils.escapeHtml(row.expiry || "-")}</td>
                <td>${Utils.escapeHtml(row.dueDate || "-")}</td>
                <td>${Utils.escapeHtml(row.scheduledDate || "-")}</td>
                <td>${Utils.escapeHtml(row.reason || "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderCountButton(row: TrainingProjectSummaryRow, statusItem: StatusKey): string {
    const count = row[statusItem.field] || 0;
    const selected = selectedProject === row.projectName && selectedStatus === statusItem.label;
    return `
      <button
        class="risk-count-button${selected ? " is-selected" : ""}"
        type="button"
        data-project="${Utils.escapeHtml(row.projectName)}"
        data-status="${Utils.escapeHtml(statusItem.label)}"
        ${count ? "" : "disabled"}
      >${Utils.escapeHtml(count)}</button>
    `;
  }

  function renderProjectSummary(rows: TrainingProjectSummaryRow[]): void {
    currentSummaryRows = rows || [];
    if (!currentSummaryRows.length) {
      selectedProject = "";
      selectedStatus = "";
      elements.workbenchProjectSummaryBody.innerHTML = `<tr><td class="empty-block" colspan="6">当前没有项目风险统计。</td></tr>`;
      renderSelectedPeople("", "");
      return;
    }

    const currentRows = getRowsBySelection(selectedProject, selectedStatus);
    if (!currentRows.length) {
      const defaultSelection = findDefaultSelection(currentSummaryRows);
      selectedProject = defaultSelection.projectName;
      selectedStatus = defaultSelection.status;
    }

    elements.workbenchProjectSummaryBody.innerHTML = currentSummaryRows.map((row) => `
      <tr>
        <td>${Utils.escapeHtml(row.projectName)}</td>
        ${STATUS_KEYS.map((statusItem) => `<td>${renderCountButton(row, statusItem)}</td>`).join("")}
        <td>${Utils.escapeHtml(row.total)}</td>
      </tr>
    `).join("");

    renderSelectedPeople(selectedProject, selectedStatus);
  }

  function renderWorkbenchSummary(summaryData: TrainingSummaryData | null): void {
    const data = (summaryData || {}) as Partial<TrainingSummaryData>;
    renderProjectSummary(data.projectSummaryRows || []);
  }

  elements.workbenchProjectSummaryBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const projectName = target.dataset.project || "";
    const status = target.dataset.status || "";
    if (!projectName || !status) return;
    selectedProject = projectName;
    selectedStatus = status;
    renderProjectSummary(currentSummaryRows);
  });

  runtime.summaryView = {
    renderWorkbenchSummary
  };
}
