(function () {
  const Utils = window.TrainingTool.Utils;
  const STATUSES = window.TrainingTool.WorkbenchStatus.STATUSES;
  const ALLOWED_HORIZONS = new Set([30, 60, 90]);

  type GapSourceRow = {
    status: string;
    projectName: string;
    employeeId?: string;
    name?: string;
    expiry?: string;
    dueDate?: string;
    scheduledDate?: string;
    source?: string;
    reason?: string;
  };

  type GapWindow = {
    key: "expired" | "within30" | "within60" | "within90";
    label: string;
    tone: "danger" | "near" | "mid" | "far";
    rank: number;
  };

  type GapCheckRow = {
    key: string;
    windowKey: GapWindow["key"];
    windowLabel: string;
    windowTone: GapWindow["tone"];
    workbenchStatus: string;
    attentionLabel: "未安排" | "已排未覆盖";
    projectName: string;
    employeeId: string;
    name: string;
    currentExpiry: string;
    latestCompletionDate: string;
    scheduledDate: string;
    source: string;
    reason: string;
  };

  type GapCheckResult = {
    baseDate: string;
    endDate: string;
    horizonDays: number;
    summary: {
      peopleCount: number;
      itemCount: number;
      expiredCount: number;
      within30Count: number;
      within60Count: number;
      within90Count: number;
      scheduledButUncoveredCount: number;
    };
    rows: GapCheckRow[];
  };

  function requireDate(value: string | Date, label: string): Date {
    const date = Utils.parseDate(value);
    if (!date) throw new Error(`${label}无效。`);
    return date;
  }

  function requireHorizon(value: number): number {
    const horizon = Number(value);
    if (!ALLOWED_HORIZONS.has(horizon)) {
      throw new Error("检查范围只能选择 30、60 或 90 天。");
    }
    return horizon;
  }

  function addDays(value: Date, days: number): Date {
    const result = Utils.makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    result.setDate(result.getDate() + days);
    return Utils.makeDate(result.getFullYear(), result.getMonth() + 1, result.getDate());
  }

  function needsAttention(status: string): boolean {
    return status === STATUSES.expired
      || status === STATUSES.expiredScheduled
      || status === STATUSES.must
      || status === STATUSES.recommended
      || status === STATUSES.uncoveredScheduled;
  }

  function classifyWindow(baseDate: Date, dueDate: Date, horizonDays: number): GapWindow | null {
    const daysUntilDue = Utils.daysBetween(dueDate, baseDate);
    if (daysUntilDue < 0) {
      return { key: "expired", label: "已过期", tone: "danger", rank: 0 };
    }
    if (daysUntilDue > horizonDays) return null;
    if (daysUntilDue <= 30) {
      return { key: "within30", label: "30 天内", tone: "near", rank: 1 };
    }
    if (daysUntilDue <= 60) {
      return { key: "within60", label: "31-60 天", tone: "mid", rank: 2 };
    }
    return { key: "within90", label: "61-90 天", tone: "far", rank: 3 };
  }

  function personIdentity(employeeIdValue?: string, nameValue?: string): string {
    const employeeId = Utils.normalizeText(employeeIdValue);
    if (employeeId) return `id:${employeeId}`;
    return `name:${Utils.normalizeText(nameValue)}`;
  }

  function rowKey(row: GapSourceRow): string {
    return `${personIdentity(row.employeeId, row.name)}|${Utils.normalizeText(row.projectName)}`;
  }

  function isScheduledButUncovered(status: string): boolean {
    return status === STATUSES.expiredScheduled || status === STATUSES.uncoveredScheduled;
  }

  function compareRows(left: GapCheckRow, right: GapCheckRow): number {
    const rank = { expired: 0, within30: 1, within60: 2, within90: 3 };
    return rank[left.windowKey] - rank[right.windowKey]
      || left.latestCompletionDate.localeCompare(right.latestCompletionDate)
      || left.projectName.localeCompare(right.projectName)
      || left.name.localeCompare(right.name)
      || left.employeeId.localeCompare(right.employeeId);
  }

  function buildFromRows(
    sourceRows: GapSourceRow[],
    baseDateValue: string | Date,
    horizonDaysValue: number
  ): GapCheckResult {
    const baseDate = requireDate(baseDateValue, "观察基准日");
    const horizonDays = requireHorizon(horizonDaysValue);
    const endDate = addDays(baseDate, horizonDays);
    const candidates: GapCheckRow[] = [];

    (sourceRows || []).forEach((row) => {
      if (!row || !needsAttention(row.status)) return;
      const dueDate = Utils.parseDate(row.dueDate);
      if (!dueDate) return;
      const windowInfo = classifyWindow(baseDate, dueDate, horizonDays);
      if (!windowInfo) return;

      candidates.push({
        key: rowKey(row),
        windowKey: windowInfo.key,
        windowLabel: windowInfo.label,
        windowTone: windowInfo.tone,
        workbenchStatus: row.status,
        attentionLabel: isScheduledButUncovered(row.status) ? "已排未覆盖" : "未安排",
        projectName: Utils.normalizeText(row.projectName),
        employeeId: Utils.normalizeText(row.employeeId),
        name: Utils.normalizeText(row.name),
        currentExpiry: Utils.normalizeText(row.expiry),
        latestCompletionDate: Utils.formatDate(dueDate),
        scheduledDate: Utils.normalizeText(row.scheduledDate),
        source: Utils.normalizeText(row.source),
        reason: Utils.normalizeText(row.reason)
      });
    });

    candidates.sort(compareRows);
    const uniqueRowMap = new Map<string, GapCheckRow>();
    candidates.forEach((row) => {
      if (!uniqueRowMap.has(row.key)) uniqueRowMap.set(row.key, row);
    });
    const uniqueRows = [...uniqueRowMap.values()];
    const people = new Set(uniqueRows.map((row) => personIdentity(row.employeeId, row.name)));

    return {
      baseDate: Utils.formatDate(baseDate),
      endDate: Utils.formatDate(endDate),
      horizonDays,
      summary: {
        peopleCount: people.size,
        itemCount: uniqueRows.length,
        expiredCount: uniqueRows.filter((row) => row.windowKey === "expired").length,
        within30Count: uniqueRows.filter((row) => row.windowKey === "within30").length,
        within60Count: uniqueRows.filter((row) => row.windowKey === "within60").length,
        within90Count: uniqueRows.filter((row) => row.windowKey === "within90").length,
        scheduledButUncoveredCount: uniqueRows.filter((row) => row.attentionLabel === "已排未覆盖").length
      },
      rows: uniqueRows
    };
  }

  function build(
    analysis: TrainingToolAnalysis,
    options: { baseDate?: string | Date; horizonDays?: number; extraProjectRows?: any[] } = {}
  ): GapCheckResult {
    const baseDate = requireDate(options.baseDate || new Date(), "观察基准日");
    const horizonDays = requireHorizon(options.horizonDays ?? 30);
    const result = window.TrainingTool.Workbench.buildWorkbench(analysis, {
      today: baseDate,
      stageEnd: addDays(baseDate, horizonDays),
      extraProjectRows: options.extraProjectRows || []
    });
    return buildFromRows(result.allDetailRows || [], baseDate, horizonDays);
  }

  window.TrainingTool.ScheduleGapCheck = {
    build,
    buildFromRows
  };
})();
