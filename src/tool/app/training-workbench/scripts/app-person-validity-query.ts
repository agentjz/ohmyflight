import { TrainingToolPersonValidityQuery } from "./person-validity-query";
import type { TrainingToolAppRuntime, TrainingToolPersonValidityItem, TrainingToolPersonValidityRecord } from "./models";
import { TrainingToolUtils } from "./utils";

export function installTrainingAppPersonValidityQuery(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const PersonValidityQuery = TrainingToolPersonValidityQuery;
  const state = runtime.state;
  const elements = runtime.elements;

  function setResult(html: string): void {
    elements.personValidityResult.innerHTML = html;
  }

  function renderPrompt(message: string): void {
    setResult(`<div class="empty-block">${Utils.escapeHtml(message)}</div>`);
  }

  function statusClass(stateValue: TrainingToolPersonValidityItem["state"]): string {
    if (stateValue === "valid") return "ok";
    if (stateValue === "expired") return "danger";
    return "info";
  }

  function renderPerson(person: TrainingToolPersonValidityRecord): void {
    state.personValiditySelectedKey = person.key;
    setResult(`
      <div class="person-validity-profile">
        <div class="person-validity-heading">
          <h3>${Utils.escapeHtml(person.name || "姓名未填写")}</h3>
          <span class="person-validity-count">共 ${person.validities.length} 项</span>
        </div>
        <dl class="person-validity-meta">
          <div>
            <dt>员工号</dt>
            <dd>${Utils.escapeHtml(person.employeeId || "未填写")}</dd>
          </div>
          <div>
            <dt>分部</dt>
            <dd>${Utils.escapeHtml(person.department || "未填写")}</dd>
          </div>
          <div>
            <dt>技术信息</dt>
            <dd>${Utils.escapeHtml(person.technicalInfo || "未填写")}</dd>
          </div>
        </dl>
      </div>
      <div class="table-shell person-validity-table-shell">
        <table class="table person-validity-table">
          <thead>
            <tr><th>资质</th><th>有效期</th><th>状态</th></tr>
          </thead>
          <tbody>
            ${person.validities.map((item) => `
              <tr>
                <td>${Utils.escapeHtml(item.name)}</td>
                <td>${Utils.escapeHtml(item.value)}</td>
                <td><span class="badge ${statusClass(item.state)}">${Utils.escapeHtml(item.stateLabel)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `);
  }

  function renderMatches(matches: TrainingToolPersonValidityRecord[]): void {
    setResult(`
      <p class="person-validity-match-summary">找到 ${matches.length} 人，请选择要查看的人员。</p>
      <div class="person-validity-match-list">
        ${matches.map((person) => `
          <button class="person-validity-match" type="button" data-person-validity-key="${Utils.escapeHtml(person.key)}">
            <strong>
              <span>${Utils.escapeHtml(person.name || "姓名未填写")}</span>
              <span class="person-validity-match-id">${Utils.escapeHtml(person.employeeId || "员工号未填写")}</span>
            </strong>
            <span>${Utils.escapeHtml([person.department, person.technicalInfo].filter(Boolean).join(" · ") || "分部和技术信息未填写")}</span>
          </button>
        `).join("")}
      </div>
    `);
  }

  function handleSearch(event?: Event): void {
    event?.preventDefault();
    if (!state.personValidityIndex) {
      renderPrompt("请先导入总培训表文件。");
      return;
    }
    const query = elements.personValiditySearchInput.value;
    if (!Utils.normalizeText(query)) {
      renderPrompt("请输入姓名或员工号。");
      return;
    }
    const matches = PersonValidityQuery.search(state.personValidityIndex, query);
    if (!matches.length) {
      renderPrompt("没有找到匹配人员。");
      return;
    }
    if (matches.length === 1) {
      renderPerson(matches[0]);
      return;
    }
    state.personValiditySelectedKey = "";
    renderMatches(matches);
  }

  function handleResultClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !state.personValidityIndex) return;
    const button = target.closest<HTMLButtonElement>("[data-person-validity-key]");
    const key = button?.dataset.personValidityKey;
    if (!key) return;
    const person = state.personValidityIndex.people.find((item) => item.key === key);
    if (person) renderPerson(person);
  }

  function rebuild(): void {
    state.personValiditySelectedKey = "";
    elements.personValiditySearchInput.value = "";
    try {
      state.personValidityIndex = state.analysis
        ? PersonValidityQuery.buildIndex(state.analysis)
        : null;
      elements.personValiditySearchInput.disabled = !state.personValidityIndex;
      elements.personValiditySearchButton.disabled = !state.personValidityIndex;
      renderPrompt(state.personValidityIndex ? "输入姓名或员工号查询资质有效期。" : "导入总培训表后可查询人员资质。");
    } catch (error) {
      state.personValidityIndex = null;
      elements.personValiditySearchInput.disabled = true;
      elements.personValiditySearchButton.disabled = true;
      renderPrompt(Utils.errorMessage(error, "人员资质查询初始化失败。"));
    }
  }

  function initialize(): void {
    elements.personValidityForm.addEventListener("submit", handleSearch);
    elements.personValidityResult.addEventListener("click", handleResultClick);
    rebuild();
  }

  runtime.personValidityQuery = {
    initialize,
    rebuild,
    handleSearch
  };
}
