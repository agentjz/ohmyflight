(function () {
  const Utils = window.TrainingTool.Utils;
  const PersonValidityQuery = window.TrainingTool.PersonValidityQuery;
  const runtime = window.TrainingToolApp;
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
        <div>
          <h3>${Utils.escapeHtml(person.name || "姓名未填写")}</h3>
          <div class="person-validity-meta">
            <span>${Utils.escapeHtml(person.employeeId || "员工号未填写")}</span>
            <span>${Utils.escapeHtml(person.department || "分部未填写")}</span>
            <span>${Utils.escapeHtml(person.technicalInfo || "技术信息未填写")}</span>
          </div>
        </div>
        <span class="person-validity-count">${person.validities.length} 项</span>
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
      <div class="person-validity-match-list">
        ${matches.map((person) => `
          <button class="person-validity-match" type="button" data-person-validity-key="${Utils.escapeHtml(person.key)}">
            <strong>${Utils.escapeHtml(person.name || "姓名未填写")}</strong>
            <span>${Utils.escapeHtml([person.employeeId, person.department, person.technicalInfo].filter(Boolean).join(" · "))}</span>
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
})();
