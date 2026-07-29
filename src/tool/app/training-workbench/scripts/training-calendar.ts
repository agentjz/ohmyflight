(function () {
  const Utils = window.TrainingTool.Utils;
  const TrainingRecordPolicy = window.TrainingTool.TrainingRecordPolicy;
  const exclusions = window.TrainingTool.TrainingCalendarExclusions;

  const EMERGENCY_PROJECT = "应急训练";
  const SECURITY_PROJECT = "航空安保";
  const TSA_PROJECT = "TSA";
  const COMBINED_SECURITY_PROJECT = "航空安保 / TSA";
  const CRM_PROJECT = "CRM";
  const REMINDER_MESSAGE = "请打印签到表";
  const REMINDER_LEAD_DAYS = 7;
  const REMINDER_PROJECTS = new Set([
    CRM_PROJECT,
    EMERGENCY_PROJECT,
    "危险品",
    SECURITY_PROJECT,
    TSA_PROJECT
  ]);
  const PROJECT_ORDER = new Map([
    [CRM_PROJECT, 0],
    [EMERGENCY_PROJECT, 1],
    ["危险品", 2],
    [COMBINED_SECURITY_PROJECT, 3],
    [SECURITY_PROJECT, 4],
    [TSA_PROJECT, 5],
    ["疲劳管理", 6],
    ["飞行作风", 7]
  ]);

  interface TrainingCalendarSession {
    id: string;
    projectName: string;
    sourceProjects: string[];
    startDate: string;
    endDate: string;
    attendeeNames: string[];
  }

  interface TrainingCalendarDraft {
    projectName: string;
    sourceProjects: Set<string>;
    start: Date;
    end: Date;
    attendeeNames: Set<string>;
  }

  interface TrainingCalendarOptions {
    today?: unknown;
  }

  interface TrainingCalendarDayEvent extends TrainingCalendarSession {
    date: string;
  }

  function compareProjects(left: string, right: string): number {
    const leftOrder = PROJECT_ORDER.get(left) ?? 99;
    const rightOrder = PROJECT_ORDER.get(right) ?? 99;
    return leftOrder - rightOrder || left.localeCompare(right);
  }

  function compareSessions(left: TrainingCalendarSession, right: TrainingCalendarSession): number {
    return left.startDate.localeCompare(right.startDate)
      || left.endDate.localeCompare(right.endDate)
      || compareProjects(left.projectName, right.projectName);
  }

  function normalizeRange(row: TrainingToolSheetRow, sheetInfo: any) {
    const parsedStart = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"));
    const parsedEnd = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
    const start = parsedStart || parsedEnd;
    const end = parsedEnd || parsedStart;
    if (!start || !end || end < start) return null;
    return { start, end };
  }

  function collectSheetDrafts(
    sessionMap: Map<string, TrainingCalendarDraft>,
    projectName: string,
    sheetInfo: any
  ): void {
    if (!sheetInfo || !Array.isArray(sheetInfo.rows)) return;

    sheetInfo.rows.forEach((row: TrainingToolSheetRow) => {
      const recordState = TrainingRecordPolicy.classify(row, sheetInfo);
      if (!recordState.active) return;

      const range = normalizeRange(row, sheetInfo);
      if (!range) return;
      const startDate = Utils.formatDate(range.start);
      const endDate = Utils.formatDate(range.end);
      const key = `${projectName}|${startDate}|${endDate}`;
      const draft = sessionMap.get(key) || {
        projectName,
        sourceProjects: new Set([projectName]),
        start: range.start,
        end: range.end,
        attendeeNames: new Set<string>()
      };

      if (projectName === EMERGENCY_PROJECT) {
        const name = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));
        if (name) draft.attendeeNames.add(name);
      }
      sessionMap.set(key, draft);
    });
  }

  function collectProjectDrafts(analysis: TrainingToolAnalysis | null): TrainingCalendarDraft[] {
    if (!analysis || !Array.isArray(analysis.projects)) return [];
    const excludedProjects = new Set<string>(exclusions.projectNames);
    const sessionMap = new Map<string, TrainingCalendarDraft>();

    analysis.projects.forEach((project) => {
      if (excludedProjects.has(project.canonical)) return;
      collectSheetDrafts(sessionMap, project.canonical, project.sheetInfo);
    });
    return [...sessionMap.values()];
  }

  function collectCrmDrafts(
    workbook: TrainingToolWorkbook | null,
    scanner: any
  ): TrainingCalendarDraft[] {
    if (!workbook || !workbook.Sheets || !workbook.Sheets[CRM_PROJECT]) return [];
    const crmInfo = scanner.readSheetInfo(workbook, CRM_PROJECT);
    const sessionMap = new Map<string, TrainingCalendarDraft>();
    collectSheetDrafts(sessionMap, CRM_PROJECT, crmInfo);
    return [...sessionMap.values()];
  }

  function mergeSecurityAndTsa(drafts: TrainingCalendarDraft[]): TrainingCalendarDraft[] {
    const untouched: TrainingCalendarDraft[] = [];
    const pairMap = new Map<string, TrainingCalendarDraft[]>();

    drafts.forEach((draft) => {
      if (draft.projectName !== SECURITY_PROJECT && draft.projectName !== TSA_PROJECT) {
        untouched.push(draft);
        return;
      }
      const key = `${Utils.formatDate(draft.start)}|${Utils.formatDate(draft.end)}`;
      const bucket = pairMap.get(key) || [];
      bucket.push(draft);
      pairMap.set(key, bucket);
    });

    pairMap.forEach((bucket) => {
      const security = bucket.find((draft) => draft.projectName === SECURITY_PROJECT);
      const tsa = bucket.find((draft) => draft.projectName === TSA_PROJECT);
      if (!security || !tsa) {
        untouched.push(...bucket);
        return;
      }
      untouched.push({
        projectName: COMBINED_SECURITY_PROJECT,
        sourceProjects: new Set([SECURITY_PROJECT, TSA_PROJECT]),
        start: security.start,
        end: security.end,
        attendeeNames: new Set<string>()
      });
    });

    return untouched;
  }

  function finalizeSession(draft: TrainingCalendarDraft): TrainingCalendarSession {
    const startDate = Utils.formatDate(draft.start);
    const endDate = Utils.formatDate(draft.end);
    return {
      id: `${draft.projectName}|${startDate}|${endDate}`,
      projectName: draft.projectName,
      sourceProjects: [...draft.sourceProjects].sort(compareProjects),
      startDate,
      endDate,
      attendeeNames: [...draft.attendeeNames]
    };
  }

  function addDays(value: Date, days: number): Date {
    return Utils.makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate() + days);
  }

  function expandDayEvents(sessions: TrainingCalendarSession[]): TrainingCalendarDayEvent[] {
    const events: TrainingCalendarDayEvent[] = [];
    sessions.forEach((session) => {
      const start = Utils.parseDate(session.startDate);
      const end = Utils.parseDate(session.endDate);
      if (!start || !end) return;
      for (let current = start; current <= end; current = addDays(current, 1)) {
        events.push({
          ...session,
          date: Utils.formatDate(current)
        });
      }
    });
    return events.sort((left, right) => {
      return left.date.localeCompare(right.date)
        || compareProjects(left.projectName, right.projectName)
        || left.startDate.localeCompare(right.startDate);
    });
  }

  function buildReminders(sessions: TrainingCalendarSession[], todayValue: unknown) {
    const today = Utils.parseDate(todayValue) || Utils.makeDate(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate()
    );
    return sessions
      .filter((session) => session.sourceProjects.some((project) => REMINDER_PROJECTS.has(project)))
      .map((session) => ({
        ...session,
        daysUntil: Utils.daysBetween(Utils.parseDate(session.startDate), today),
        message: REMINDER_MESSAGE
      }))
      .filter((reminder) => reminder.daysUntil >= 0 && reminder.daysUntil <= REMINDER_LEAD_DAYS)
      .sort(compareSessions);
  }

  function buildCalendar(
    workbook: TrainingToolWorkbook | null,
    analysis: TrainingToolAnalysis | null,
    scanner: any,
    options: TrainingCalendarOptions = {}
  ) {
    const drafts = [
      ...collectProjectDrafts(analysis),
      ...collectCrmDrafts(workbook, scanner)
    ];
    const sessions = mergeSecurityAndTsa(drafts)
      .map(finalizeSession)
      .sort(compareSessions);
    return {
      sessions,
      dayEvents: expandDayEvents(sessions),
      reminders: buildReminders(sessions, options.today)
    };
  }

  function buildMonthView(
    dayEvents: TrainingCalendarDayEvent[],
    monthKey: string,
    todayValue: unknown
  ) {
    const range = Utils.monthRangeFromKey(monthKey);
    if (!range) throw new Error("月历月份无效。");
    const today = Utils.parseDate(todayValue);
    const todayText = Utils.formatDate(today);
    const mondayOffset = (range.start.getDay() + 6) % 7;
    const gridStart = addDays(range.start, -mondayOffset);
    const eventMap = new Map<string, TrainingCalendarDayEvent[]>();

    (dayEvents || []).forEach((event) => {
      const bucket = eventMap.get(event.date) || [];
      bucket.push(event);
      eventMap.set(event.date, bucket);
    });

    const days = Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const dateText = Utils.formatDate(date);
      return {
        date: dateText,
        dayNumber: date.getDate(),
        inCurrentMonth: Utils.toMonthKey(date) === monthKey,
        isToday: Boolean(todayText) && dateText === todayText,
        events: eventMap.get(dateText) || []
      };
    });

    return {
      monthKey,
      label: `${range.start.getFullYear()}年${range.start.getMonth() + 1}月`,
      days
    };
  }

  window.TrainingTool.TrainingCalendar = {
    buildCalendar,
    buildMonthView
  };
})();
