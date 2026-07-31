(function () {
  const Utils = window.TrainingTool.Utils;
  const ScheduleGapCheck = window.TrainingTool.ScheduleGapCheck;
  const runtime = window.TrainingToolApp;
  const state = runtime.state;
  const elements = runtime.elements;

  function todayText(): string {
    const today = new Date();
    return Utils.formatDate(Utils.makeDate(today.getFullYear(), today.getMonth() + 1, today.getDate()));
  }

  function selectedHorizon(): number {
    const selected = elements.scheduleGapHorizonGroup
      .querySelector<HTMLInputElement>('input[name="scheduleGapHorizon"]:checked');
    return Number(selected?.value || 30);
  }

  function renderEmpty(message: string): void {
    elements.scheduleGapSummary.textContent = message;
    elements.scheduleGapTableBody.innerHTML = `
      <tr><td class="empty-block" colspan="7">${Utils.escapeHtml(message)}</td></tr>
    `;
  }

  function renderStatus(row: TrainingToolScheduleGapCheckRow): string {
    return `
      <div class="schedule-gap-status">
        <span class="gap-window-badge ${Utils.escapeHtml(row.windowTone)}">${Utils.escapeHtml(row.windowLabel)}</span>
        <span class="gap-attention-label${row.attentionLabel === "已排未覆盖" ? " is-uncovered" : ""}">${Utils.escapeHtml(row.attentionLabel)}</span>
      </div>
    `;
  }

  function render(result: TrainingToolScheduleGapCheckResult): void {
    const summary = result.summary;
    elements.scheduleGapSummary.innerHTML = `
      <span>观察 ${Utils.escapeHtml(result.baseDate)} 至 ${Utils.escapeHtml(result.endDate)}</span>
      <span><strong>${summary.peopleCount}</strong> 人</span>
      <span><strong>${summary.itemCount}</strong> 项漏项</span>
      <span>已过期 ${summary.expiredCount}</span>
      <span>30 天内 ${summary.within30Count}</span>
      ${result.horizonDays >= 60 ? `<span>31-60 天 ${summary.within60Count}</span>` : ""}
      ${result.horizonDays >= 90 ? `<span>61-90 天 ${summary.within90Count}</span>` : ""}
      ${summary.scheduledButUncoveredCount ? `<span>已排未覆盖 ${summary.scheduledButUncoveredCount}</span>` : ""}
    `;

    if (!result.rows.length) {
      elements.scheduleGapTableBody.innerHTML = `
        <tr><td class="empty-block" colspan="7">当前范围内没有发现未妥善覆盖的排班项目。</td></tr>
      `;
      return;
    }

    elements.scheduleGapTableBody.innerHTML = result.rows.map((row) => `
      <tr>
        <td>${renderStatus(row)}</td>
        <td>
          <strong class="schedule-gap-person-name">${Utils.escapeHtml(row.name || "姓名未填写")}</strong>
          <span class="schedule-gap-person-id">${Utils.escapeHtml(row.employeeId || "员工号未填写")}</span>
        </td>
        <td>${Utils.escapeHtml(row.projectName)}</td>
        <td class="schedule-gap-date">${Utils.escapeHtml(row.currentExpiry || "-")}</td>
        <td class="schedule-gap-date">${Utils.escapeHtml(row.latestCompletionDate)}</td>
        <td class="schedule-gap-date">${Utils.escapeHtml(row.scheduledDate || "未安排")}</td>
        <td class="schedule-gap-reason">${Utils.escapeHtml(row.reason || "请回原表核对。")}</td>
      </tr>
    `).join("");
  }

  function rebuild(): void {
    if (!state.analysis) {
      clear();
      return;
    }

    try {
      const result = ScheduleGapCheck.build(state.analysis, {
        baseDate: elements.scheduleGapBaseDateInput.value,
        horizonDays: selectedHorizon(),
        extraProjectRows: state.simulationRecords || []
      }) as TrainingToolScheduleGapCheckResult;
      state.scheduleGapCheckResult = result;
      render(result);
    } catch (error) {
      state.scheduleGapCheckResult = null;
      renderEmpty(Utils.errorMessage(error, "排班漏项检查失败。"));
    }
  }

  function clear(): void {
    state.scheduleGapCheckResult = null;
    renderEmpty("导入总培训表后显示检查结果。");
    if (runtime.controls) runtime.controls.refreshButtons();
  }

  function initialize(): void {
    elements.scheduleGapBaseDateInput.value = todayText();
    elements.scheduleGapBaseDateInput.addEventListener("change", rebuild);
    elements.scheduleGapHorizonGroup.addEventListener("change", rebuild);
    clear();
  }

  runtime.scheduleGapCheck = {
    initialize,
    rebuild,
    clear
  };
})();
