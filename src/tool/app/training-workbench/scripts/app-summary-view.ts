import { TrainingToolResultStatus } from "./result-status";
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
  const ResultStatus = TrainingToolResultStatus;
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

  function personKey(row: TrainingAssessmentRow): string {
    return `${row.projectName}@@${row.status}@@${row.employeeId || ""}@@${row.name || ""}`;
  }

  function getSelectedKeySet(rows: TrainingAssessmentRow[]): Set<string> {
    const availableKeys = new Set((rows || []).map(personKey));
    const selectedKeys = new Set(
      (runtime.state.workbenchSelectedPersonKeys || []).filter((key) => availableKeys.has(key))
    );
    runtime.state.workbenchSelectedPersonKeys = [...selectedKeys];
    return selectedKeys;
  }

  function badge(status: string): string {
    return `<span class="badge ${Utils.escapeHtml(ResultStatus.badgeToneForWorkbenchStatus(status))}">${Utils.escapeHtml(status)}</span>`;
  }

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
    const selectedKeys = getSelectedKeySet(rows);
    if (runtime.controls) runtime.controls.refreshButtons();

    if (!projectName || !status) {
      runtime.state.workbenchSelectedPersonKeys = [];
      elements.workbenchSelectedPeopleTitle.textContent = "人员明细";
      elements.workbenchSelectedPeopleIntro.textContent = "点击上方矩阵中的数字后显示具体人员。";
      elements.workbenchSelectedPeople.innerHTML = `<div class="empty-block">请选择一个项目和状态。</div>`;
      return;
    }

    elements.workbenchSelectedPeopleTitle.textContent = `${projectName} - ${status}`;
    elements.workbenchSelectedPeopleIntro.textContent = `共 ${rows.length} 人，已选 ${selectedKeys.size} 人。`;

    if (!rows.length) {
      runtime.state.workbenchSelectedPersonKeys = [];
      elements.workbenchSelectedPeople.innerHTML = `<div class="empty-block">当前没有对应人员。</div>`;
      return;
    }

    elements.workbenchSelectedPeople.innerHTML = `
      <div class="toolbar toolbar-tight selected-person-toolbar">
        <button class="action-button action-button-compact" type="button" data-role="select-all-people">全选</button>
        <button class="action-button action-button-compact" type="button" data-role="clear-people">取消全选</button>
        <button class="action-button action-button-compact" type="button" data-role="invert-people">反选</button>
      </div>
      <div class="table-shell selected-person-shell">
        <table class="table table-hover align-middle result-table selected-person-table">
          <thead>
            <tr>
              <th>选择</th>
              <th>姓名</th>
              <th>员工号</th>
              <th>当前有效期</th>
              <th>最晚完成日期</th>
              <th>已排日期</th>
              <th>判断说明</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const key = personKey(row);
              return `
              <tr>
                <td>
                  <input type="checkbox" data-role="person-select" data-key="${Utils.escapeHtml(key)}"${selectedKeys.has(key) ? " checked" : ""}>
                </td>
                <td class="person-name">${Utils.escapeHtml(row.name || "-")}</td>
                <td>${Utils.escapeHtml(row.employeeId || "-")}</td>
                <td>${Utils.escapeHtml(row.expiry || "-")}</td>
                <td>${Utils.escapeHtml(row.dueDate || "-")}</td>
                <td>${Utils.escapeHtml(row.scheduledDate || "-")}</td>
                <td>${Utils.escapeHtml(row.reason || "-")}</td>
              </tr>
            `; }).join("")}
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
    runtime.state.workbenchSelectedPersonKeys = [];
    renderProjectSummary(currentSummaryRows);
  });

  elements.workbenchSelectedPeople.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const rows = getRowsBySelection(selectedProject, selectedStatus);
    const keys = rows.map(personKey);
    if (target.dataset.role === "select-all-people") {
      runtime.state.workbenchSelectedPersonKeys = keys;
    } else if (target.dataset.role === "clear-people") {
      runtime.state.workbenchSelectedPersonKeys = [];
    } else if (target.dataset.role === "invert-people") {
      const selected = new Set(runtime.state.workbenchSelectedPersonKeys || []);
      runtime.state.workbenchSelectedPersonKeys = keys.filter((key) => !selected.has(key));
    } else {
      return;
    }
    renderSelectedPeople(selectedProject, selectedStatus);
  });

  elements.workbenchSelectedPeople.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.role !== "person-select") return;
    const selected = new Set(runtime.state.workbenchSelectedPersonKeys || []);
    const key = target.dataset.key || "";
    if (target.checked) selected.add(key);
    else selected.delete(key);
    runtime.state.workbenchSelectedPersonKeys = [...selected];
    renderSelectedPeople(selectedProject, selectedStatus);
  });

  runtime.summaryView = {
    renderWorkbenchSummary,
    personKey
  };
}
