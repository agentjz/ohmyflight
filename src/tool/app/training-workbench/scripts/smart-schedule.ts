import type {
  TrainingExtraProjectRow,
  TrainingProjectRule,
  TrainingToolAnalysis,
  TrainingToolProjectAnalysis
} from "./models";
import { TrainingToolQualificationPressure } from "./qualification-pressure";
import { TrainingToolRuleEngine } from "./rule-engine";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";

const Utils = TrainingToolUtils;
const RuleEngine = TrainingToolRuleEngine;
const QualificationPressure = TrainingToolQualificationPressure;
const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

export type SmartScheduleItemStatus = "已排" | "待排" | "建议调整" | "无法安排";

export interface SmartScheduleItem {
  employeeId: string;
  name: string;
  projectName: string;
  ruleType: string;
  dueDate: string;
  currentDate: string;
  currentMonth: string;
  recommendedMonth: string;
  eligibleStartMonth: string;
  eligibleEndMonth: string;
  personDays: number;
  status: SmartScheduleItemStatus;
  reason: string;
}

export interface SmartScheduleMonthRow {
  monthKey: string;
  currentPersonDays: number;
  recommendedPersonDays: number;
}

export interface SmartScheduleResult {
  year: number;
  latestAdvanceMonths: number;
  selectedProject: string;
  availableProjects: string[];
  items: SmartScheduleItem[];
  monthRows: SmartScheduleMonthRow[];
}

export interface SmartScheduleOptions {
  year?: number | string;
  latestAdvanceMonths?: number | string;
  projectName?: string;
  today?: Date;
  extraProjectRows?: TrainingExtraProjectRow[];
  currentLoadRows?: Array<{ monthKey: string; personDays: number }>;
}

interface ScheduleDraft extends SmartScheduleItem {
  candidateMonths: string[];
  preferredMonth: string;
  scheduledCovered: boolean;
}

const LATEST_DATE_RULE = "最新日期";
const BASE_MONTH_RULE = "基准月";
const DEFAULT_ADVANCE_MONTHS = 2;

function normalizeYear(value: unknown): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

function normalizeAdvanceMonths(value: unknown): number {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 1 && amount <= 6 ? amount : DEFAULT_ADVANCE_MONTHS;
}

function monthKeysForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

function shiftMonth(monthKey: string, amount: number): string {
  const range = Utils.monthRangeFromKey(monthKey);
  if (!range) return "";
  return Utils.toMonthKey(Utils.makeDate(range.start.getFullYear(), range.start.getMonth() + 1 + amount, 1));
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  if (!Utils.monthRangeFromKey(startMonth) || !Utils.monthRangeFromKey(endMonth) || startMonth > endMonth) return [];
  const result: string[] = [];
  let monthKey = startMonth;
  while (monthKey <= endMonth && result.length < 120) {
    result.push(monthKey);
    monthKey = shiftMonth(monthKey, 1);
  }
  return result;
}

function firstPlanningMonth(year: number, today: Date): string {
  const todayMonth = Utils.toMonthKey(today);
  if (year < today.getFullYear()) return `${year}-13`;
  if (year > today.getFullYear()) return `${year}-01`;
  return todayMonth;
}

function candidateDate(monthKey: string, earliest: Date, latest: Date, today: Date): Date | null {
  const range = Utils.monthRangeFromKey(monthKey);
  if (!range) return null;
  const lowerTime = Math.max(range.start.getTime(), earliest.getTime(), today.getTime());
  const upperTime = Math.min(range.end.getTime(), latest.getTime());
  return lowerTime <= upperTime ? new Date(lowerTime) : null;
}

function windowCandidates(
  rule: TrainingProjectRule,
  currentExpiry: Date,
  dueDate: Date,
  year: number,
  today: Date
): { months: string[]; preferredMonth: string } {
  const startOfYear = `${year}-01`;
  const endOfYear = `${year}-12`;
  const windowInfo = RuleEngine.getWindowInfo(rule, currentExpiry);
  if (!windowInfo.hasWindow) return { months: [], preferredMonth: "" };

  const firstMonth = [Utils.toMonthKey(windowInfo.windowStart), startOfYear, firstPlanningMonth(year, today)]
    .sort()
    .at(-1) || "";
  const lastMonth = [Utils.toMonthKey(windowInfo.windowEnd), endOfYear].sort()[0] || "";
  const months = monthsBetween(firstMonth, lastMonth).filter((monthKey) => (
    candidateDate(monthKey, windowInfo.windowStart, dueDate, today) !== null
  ));
  const preferredMonth = rule.ruleType === BASE_MONTH_RULE
    ? shiftMonth(Utils.toMonthKey(currentExpiry), -1)
    : months[0] || "";
  return { months, preferredMonth };
}

function latestDateCandidates(
  dueDate: Date,
  year: number,
  today: Date,
  advanceMonths: number
): { months: string[]; preferredMonth: string } {
  const dueMonth = Utils.toMonthKey(dueDate);
  const firstMonth = shiftMonth(dueMonth, -advanceMonths);
  const lastMonth = shiftMonth(dueMonth, -1);
  const planningStart = firstPlanningMonth(year, today);
  const startMonth = [firstMonth, `${year}-01`, planningStart].sort().at(-1) || "";
  const endMonth = [lastMonth, `${year}-12`].sort()[0] || "";
  let months = monthsBetween(startMonth, endMonth).filter((monthKey) => {
    const range = Utils.monthRangeFromKey(monthKey);
    return Boolean(range && range.end >= today && range.start <= dueDate);
  });
  const safeWindowMissed = Boolean(
    Utils.monthRangeFromKey(lastMonth)
    && Utils.monthRangeFromKey(lastMonth)!.end < today
  );
  if (!months.length && safeWindowMissed && dueDate >= today && Utils.toMonthKey(dueDate).startsWith(`${year}-`)) {
    months = monthsBetween(firstPlanningMonth(year, today), dueMonth).filter((monthKey) => {
      const range = Utils.monthRangeFromKey(monthKey);
      return Boolean(range && range.end >= today && range.start <= dueDate);
    });
  }
  return { months, preferredMonth: months.includes(lastMonth) ? lastMonth : months[0] || "" };
}

function estimateProjectPersonDays(project: TrainingToolProjectAnalysis): number {
  const counts = new Map<number, number>();
  project.sheetInfo.rows.forEach((row) => {
    if (!TrainingRecordPolicy.classify(row, project.sheetInfo).active) return;
    const start = Utils.parseDate(Utils.getValueByHeader(row, project.sheetInfo, "培训开始日期"));
    const end = Utils.parseDate(Utils.getValueByHeader(row, project.sheetInfo, "培训结束日期")) || start;
    if (!start || !end || end < start) return;
    const days = Utils.daysBetween(end, start) + 1;
    if (days < 1 || days > 14) return;
    counts.set(days, (counts.get(days) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] || 1;
}

function distanceInMonths(left: string, right: string): number {
  const leftRange = Utils.monthRangeFromKey(left);
  const rightRange = Utils.monthRangeFromKey(right);
  if (!leftRange || !rightRange) return Number.MAX_SAFE_INTEGER;
  return Math.abs(
    (leftRange.start.getFullYear() - rightRange.start.getFullYear()) * 12
    + leftRange.start.getMonth()
    - rightRange.start.getMonth()
  );
}

function chooseMonth(draft: ScheduleDraft, loads: Map<string, number>): string {
  return [...draft.candidateMonths].sort((left, right) => {
    const loadDifference = (loads.get(left) || 0) - (loads.get(right) || 0);
    if (loadDifference) return loadDifference;
    const currentDifference = Number(right === draft.currentMonth) - Number(left === draft.currentMonth);
    if (currentDifference) return currentDifference;
    const leftDistance = distanceInMonths(left, draft.preferredMonth);
    const rightDistance = distanceInMonths(right, draft.preferredMonth);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return draft.ruleType === LATEST_DATE_RULE
      ? right.localeCompare(left)
      : left.localeCompare(right);
  })[0] || "";
}

function buildDrafts(analysis: TrainingToolAnalysis, options: SmartScheduleOptions & {
  year: number;
  latestAdvanceMonths: number;
  today: Date;
}): ScheduleDraft[] {
  const pressure = QualificationPressure.buildPressure(analysis, {
    startMonth: `${options.year}-01`,
    horizonMonths: 60,
    extraProjectRows: options.extraProjectRows || []
  });
  const projectPersonDays = new Map(analysis.projects.map((project) => [project.canonical, estimateProjectPersonDays(project)]));

  return pressure.items.flatMap((item): ScheduleDraft[] => {
    const project = analysis.projectMap.get(item.projectName);
    const currentExpiry = Utils.parseDate(item.currentExpiry);
    const dueDate = Utils.parseDate(item.currentDueDate);
    if (!project || !currentExpiry || !dueDate) return [];

    const currentDate = Utils.parseDate(item.scheduledDate);
    const currentMonth = Utils.toMonthKey(currentDate);
    const candidateInfo = project.rule.ruleType === LATEST_DATE_RULE
      ? latestDateCandidates(dueDate, options.year, options.today, Number(options.latestAdvanceMonths))
      : windowCandidates(project.rule, currentExpiry, dueDate, options.year, options.today);
    const legalRangeTouchesYear = candidateInfo.months.length > 0;
    const currentTouchesYear = currentMonth.startsWith(`${options.year}-`);
    const dueTouchesYear = Utils.toMonthKey(dueDate).startsWith(`${options.year}-`);
    const latestDateBelongsToEarlierPlan = project.rule.ruleType === LATEST_DATE_RULE
      && !legalRangeTouchesYear
      && !currentTouchesYear
      && dueDate >= options.today;
    if (latestDateBelongsToEarlierPlan || (!legalRangeTouchesYear && !currentTouchesYear && !dueTouchesYear)) return [];

    const isPastCovered = Boolean(currentDate && currentDate < options.today && item.coverageStatus === "已覆盖");
    const candidateMonths = isPastCovered ? [currentMonth] : candidateInfo.months;
    const eligibleStartMonth = candidateMonths[0] || "";
    const eligibleEndMonth = candidateMonths.at(-1) || "";
    return [{
      employeeId: item.employeeId,
      name: item.name,
      projectName: item.projectName,
      ruleType: project.rule.ruleType,
      dueDate: item.currentDueDate,
      currentDate: item.scheduledDate,
      currentMonth,
      recommendedMonth: "",
      eligibleStartMonth,
      eligibleEndMonth,
      personDays: projectPersonDays.get(item.projectName) || 1,
      status: "待排",
      reason: "",
      candidateMonths,
      preferredMonth: isPastCovered ? currentMonth : candidateInfo.preferredMonth,
      scheduledCovered: item.coverageStatus === "已覆盖"
    }];
  });
}

function buildFixedLoads(
  drafts: ScheduleDraft[],
  year: number,
  currentLoadRows: Array<{ monthKey: string; personDays: number }>
): Map<string, number> {
  const taskCurrent = new Map(monthKeysForYear(year).map((monthKey) => [monthKey, 0]));
  drafts.forEach((draft) => {
    if (!taskCurrent.has(draft.currentMonth)) return;
    taskCurrent.set(draft.currentMonth, (taskCurrent.get(draft.currentMonth) || 0) + draft.personDays);
  });
  const baseline = new Map(currentLoadRows.map((row) => [row.monthKey, row.personDays]));
  return new Map(monthKeysForYear(year).map((monthKey) => [
    monthKey,
    Math.max(0, (baseline.get(monthKey) || 0) - (taskCurrent.get(monthKey) || 0))
  ]));
}

function scheduleDrafts(
  drafts: ScheduleDraft[],
  year: number,
  today: Date,
  currentLoadRows: Array<{ monthKey: string; personDays: number }> = []
): SmartScheduleItem[] {
  const loads = buildFixedLoads(drafts, year, currentLoadRows);
  const locked = drafts.filter((draft) => (
    draft.scheduledCovered
    && Boolean(draft.currentDate)
    && (Utils.parseDate(draft.currentDate)?.getTime() || 0) < today.getTime()
    && draft.currentMonth.startsWith(`${year}-`)
  ));
  locked.forEach((draft) => loads.set(draft.currentMonth, (loads.get(draft.currentMonth) || 0) + draft.personDays));

  return [...drafts]
    .sort((left, right) => left.candidateMonths.length - right.candidateMonths.length
      || left.eligibleEndMonth.localeCompare(right.eligibleEndMonth)
      || left.dueDate.localeCompare(right.dueDate)
      || left.projectName.localeCompare(right.projectName)
      || left.name.localeCompare(right.name, "zh-Hans-CN"))
    .map((draft): SmartScheduleItem => {
      const parsedCurrentDate = Utils.parseDate(draft.currentDate);
      const pastCovered = draft.scheduledCovered && parsedCurrentDate && parsedCurrentDate < today;
      let recommendedMonth = pastCovered ? draft.currentMonth : chooseMonth(draft, loads);
      let status: SmartScheduleItemStatus;
      let reason: string;

      if (!recommendedMonth) {
        recommendedMonth = draft.scheduledCovered ? draft.currentMonth : "";
        status = "无法安排";
        reason = draft.dueDate < Utils.formatDate(today)
          ? `当前轮次最晚完成日期为 ${draft.dueDate}，已无法在不过期的前提下生成推荐。`
          : "本年度剩余月份无法同时满足项目规则和安全提前量。";
      } else {
        if (!pastCovered) {
          loads.set(recommendedMonth, (loads.get(recommendedMonth) || 0) + draft.personDays);
        }
        status = !draft.currentMonth
          ? "待排"
          : draft.currentMonth === recommendedMonth
            ? "已排"
            : "建议调整";
        if (draft.ruleType === LATEST_DATE_RULE) {
          const emergencyFallback = draft.eligibleEndMonth === Utils.toMonthKey(draft.dueDate);
          reason = emergencyFallback
            ? "安全提前范围已经错过，优先在到期前尽快安排。"
            : status === "已排"
              ? "当前安排已满足安全提前量。"
              : "在到期前的安全提前范围内，选择当前负载较低的月份。";
        } else if (draft.ruleType === BASE_MONTH_RULE) {
          reason = status === "已排"
            ? "当前安排位于基准月窗口内。"
            : "在基准月窗口内选择负载较低的月份，原基准月不变。";
        } else {
          reason = status === "已排"
            ? "当前安排位于保护窗口内。"
            : "在保护窗口内选择负载较低的月份，原到期锚点不变。";
        }
      }

      const { candidateMonths: _candidateMonths, preferredMonth: _preferredMonth, scheduledCovered: _scheduledCovered, ...item } = draft;
      return { ...item, recommendedMonth, status, reason };
    });
}

function buildMonthRows(
  items: SmartScheduleItem[],
  year: number,
  today: Date,
  currentLoadRows: Array<{ monthKey: string; personDays: number }> = []
): SmartScheduleMonthRow[] {
  const taskCurrent = new Map(monthKeysForYear(year).map((monthKey) => [monthKey, 0]));
  const taskRecommended = new Map(monthKeysForYear(year).map((monthKey) => [monthKey, 0]));
  items.forEach((item) => {
    if (taskCurrent.has(item.currentMonth)) {
      taskCurrent.set(item.currentMonth, (taskCurrent.get(item.currentMonth) || 0) + item.personDays);
    }
    if (taskRecommended.has(item.recommendedMonth)) {
      taskRecommended.set(item.recommendedMonth, (taskRecommended.get(item.recommendedMonth) || 0) + item.personDays);
    }
  });

  const baseline = new Map(currentLoadRows.map((row) => [row.monthKey, row.personDays]));
  const hasBaseline = currentLoadRows.length > 0;
  const todayMonth = Utils.toMonthKey(today);
  return monthKeysForYear(year).map((monthKey) => {
    const taskCurrentDays = taskCurrent.get(monthKey) || 0;
    const taskRecommendedDays = taskRecommended.get(monthKey) || 0;
    const currentPersonDays = hasBaseline ? baseline.get(monthKey) || 0 : taskCurrentDays;
    const historicalMonth = monthKey < todayMonth;
    const fixedPersonDays = Math.max(0, currentPersonDays - taskCurrentDays);
    return {
      monthKey,
      currentPersonDays,
      recommendedPersonDays: hasBaseline && historicalMonth
        ? currentPersonDays
        : fixedPersonDays + taskRecommendedDays
    };
  });
}

function buildSmartSchedule(analysis: TrainingToolAnalysis, options: SmartScheduleOptions = {}): SmartScheduleResult {
  const year = normalizeYear(options.year);
  const latestAdvanceMonths = normalizeAdvanceMonths(options.latestAdvanceMonths);
  const today = options.today || RuleEngine.createTodayDate();
  const drafts = buildDrafts(analysis, {
    ...options,
    year,
    latestAdvanceMonths,
    today
  });
  const requestedProject = Utils.normalizeProjectName(options.projectName);
  const scopedDrafts = requestedProject
    ? drafts.filter((draft) => draft.projectName === requestedProject)
    : drafts;
  const allItems = scheduleDrafts(scopedDrafts, year, today, options.currentLoadRows || []);
  const availableProjects = analysis.projects
    .map((project) => project.canonical)
    .filter((projectName, index, projects) => projects.indexOf(projectName) === index && drafts.some((item) => item.projectName === projectName));
  const selectedProject = availableProjects.includes(requestedProject) ? requestedProject : "";
  const items = selectedProject ? allItems.filter((item) => item.projectName === selectedProject) : allItems;
  return {
    year,
    latestAdvanceMonths,
    selectedProject,
    availableProjects,
    items: items.sort((left, right) => (left.recommendedMonth || left.currentMonth || "9999-99").localeCompare(right.recommendedMonth || right.currentMonth || "9999-99")
      || left.projectName.localeCompare(right.projectName)
      || left.name.localeCompare(right.name, "zh-Hans-CN")),
    monthRows: buildMonthRows(items, year, today, options.currentLoadRows || [])
  };
}

export const TrainingToolSmartSchedule = {
  buildSmartSchedule
};
