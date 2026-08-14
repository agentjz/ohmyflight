import type {
  TrainingExtraProjectRow,
  TrainingProjectRule,
  TrainingToolAnalysis,
  TrainingToolProjectAnalysis
} from "./models";
import { TrainingToolQualificationPressure } from "./qualification-pressure";
import { TrainingToolRuleEngine } from "./rule-engine";
import {
  TrainingToolSmartScheduleOptimizer,
  type SmartScheduleOptimizationGroup
} from "./smart-schedule-optimizer";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";

const Utils = TrainingToolUtils;
const RuleEngine = TrainingToolRuleEngine;
const QualificationPressure = TrainingToolQualificationPressure;
const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

export interface SmartScheduleItem {
  employeeId: string;
  name: string;
  projectName: string;
  ruleType: string;
  dueDate: string;
  recommendedMonth: string;
  eligibleStartMonth: string;
  eligibleEndMonth: string;
  personDays: number;
  schedulable: boolean;
  reason: string;
}

export interface SmartScheduleMonthRow {
  monthKey: string;
  currentPersonDays: number;
  balancedPersonDays: number;
  averagePersonDays: number;
}

export interface SmartScheduleProjectMonthLoad {
  projectName: string;
  monthKey: string;
  personDays: number;
}

export interface SmartSchedulePlan {
  year: number;
  optimizationStatus: "optimal";
  availableProjects: string[];
  items: SmartScheduleItem[];
  currentLoadRows: Array<{ monthKey: string; personDays: number }>;
  replaceableCurrentRows: SmartScheduleProjectMonthLoad[];
  recommendedRows: SmartScheduleProjectMonthLoad[];
  peakPersonDays: number;
  averagePersonDays: number;
  totalDeviation: number;
  optimizationVariableCount: number;
}

export interface SmartScheduleResult {
  year: number;
  selectedProject: string;
  availableProjects: string[];
  items: SmartScheduleItem[];
  monthRows: SmartScheduleMonthRow[];
}

export interface SmartSchedulePlanOptions {
  year?: number | string;
  today?: Date;
  extraProjectRows?: TrainingExtraProjectRow[];
  currentLoadRows?: Array<{ monthKey: string; personDays: number }>;
}

export interface SmartScheduleViewOptions {
  projectName?: string;
  currentLoadRows?: Array<{ monthKey: string; personDays: number }>;
}

interface ScheduleDraft extends SmartScheduleItem {
  currentDate: string;
  currentMonth: string;
  candidateMonths: string[];
}

interface ScheduleGroup extends SmartScheduleOptimizationGroup {
  drafts: ScheduleDraft[];
}

const LATEST_DATE_RULE = "最新日期";
const BASE_MONTH_RULE = "基准月";

function normalizeYear(value: unknown): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
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
  if (year < today.getFullYear()) return `${year}-13`;
  if (year > today.getFullYear()) return `${year}-01`;
  return Utils.toMonthKey(today);
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
): string[] {
  const windowInfo = RuleEngine.getWindowInfo(rule, currentExpiry);
  if (!windowInfo.hasWindow) return [];
  const firstMonth = [Utils.toMonthKey(windowInfo.windowStart), `${year}-01`, firstPlanningMonth(year, today)]
    .sort()
    .at(-1) || "";
  const lastMonth = [Utils.toMonthKey(windowInfo.windowEnd), `${year}-12`].sort()[0] || "";
  return monthsBetween(firstMonth, lastMonth).filter((monthKey) => (
    candidateDate(monthKey, windowInfo.windowStart, dueDate, today) !== null
  ));
}

function latestDateCandidates(dueDate: Date, year: number, today: Date): string[] {
  if (dueDate.getFullYear() !== year) return [];
  const firstMonth = firstPlanningMonth(year, today);
  const lastMonth = Utils.toMonthKey(dueDate);
  return monthsBetween(firstMonth, lastMonth).filter((monthKey) => (
    candidateDate(monthKey, today, dueDate, today) !== null
  ));
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

function reasonForRule(ruleType: string): string {
  if (ruleType === LATEST_DATE_RULE) return "为均衡全年培训人天，在最晚完成日期前安排。";
  if (ruleType === BASE_MONTH_RULE) return "在基准月窗口内安排，原基准月不变。";
  return "在保护窗口内安排，原到期锚点不变。";
}

function buildDrafts(
  analysis: TrainingToolAnalysis,
  options: SmartSchedulePlanOptions & { year: number; today: Date }
): ScheduleDraft[] {
  const pressure = QualificationPressure.buildPressure(analysis, {
    startMonth: `${options.year}-01`,
    horizonMonths: 60,
    extraProjectRows: options.extraProjectRows || []
  });
  const projectPersonDays = new Map(analysis.projects.map((project) => [
    project.canonical,
    estimateProjectPersonDays(project)
  ]));

  return pressure.items.flatMap((item): ScheduleDraft[] => {
    const project = analysis.projectMap.get(item.projectName);
    const currentDateValue = Utils.parseDate(item.scheduledDate);
    const currentDate = Utils.formatDate(currentDateValue);
    const currentMonth = Utils.toMonthKey(currentDateValue);
    const pastCovered = Boolean(
      currentDateValue
      && currentDateValue < options.today
      && item.coverageStatus === "已覆盖"
    );
    const currentExpiry = Utils.parseDate(pastCovered ? item.forecastExpiry : item.currentExpiry);
    const dueDate = Utils.parseDate(pastCovered ? item.forecastDueDate : item.currentDueDate);
    if (!project || !currentExpiry || !dueDate) return [];

    const candidateMonths = project.rule.ruleType === LATEST_DATE_RULE
      ? latestDateCandidates(dueDate, options.year, options.today)
      : windowCandidates(project.rule, currentExpiry, dueDate, options.year, options.today);
    const dueTouchesYear = dueDate.getFullYear() === options.year;
    const windowTouchesYear = candidateMonths.length > 0;
    if (!dueTouchesYear && !windowTouchesYear) return [];

    const schedulable = candidateMonths.length > 0;
    return [{
      employeeId: item.employeeId,
      name: item.name,
      projectName: item.projectName,
      ruleType: project.rule.ruleType,
      dueDate: Utils.formatDate(dueDate),
      currentDate,
      currentMonth,
      recommendedMonth: "",
      eligibleStartMonth: candidateMonths[0] || "",
      eligibleEndMonth: candidateMonths.at(-1) || "",
      personDays: projectPersonDays.get(item.projectName) || 1,
      schedulable,
      reason: schedulable
        ? reasonForRule(project.rule.ruleType)
        : `截至 ${Utils.formatDate(options.today)} 已没有不晚于 ${Utils.formatDate(dueDate)} 的合法月份。`,
      candidateMonths
    }];
  });
}

function sumProjectMonthRows(rows: SmartScheduleProjectMonthLoad[]): Map<string, number> {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const key = `${row.projectName}\u0000${row.monthKey}`;
    totals.set(key, (totals.get(key) || 0) + row.personDays);
  });
  return totals;
}

function replaceableCurrentRows(drafts: ScheduleDraft[], year: number, today: Date): SmartScheduleProjectMonthLoad[] {
  const rows = drafts.flatMap((draft): SmartScheduleProjectMonthLoad[] => {
    const currentDate = Utils.parseDate(draft.currentDate);
    if (!currentDate || currentDate < today || !draft.currentMonth.startsWith(`${year}-`)) return [];
    return [{
      projectName: draft.projectName,
      monthKey: draft.currentMonth,
      personDays: draft.personDays
    }];
  });
  const totals = sumProjectMonthRows(rows);
  return [...totals.entries()].map(([key, personDays]) => {
    const [projectName, monthKey] = key.split("\u0000");
    return { projectName, monthKey, personDays };
  });
}

function fixedLoadsForOptimization(
  monthKeys: string[],
  currentLoadRows: Array<{ monthKey: string; personDays: number }>,
  replaceableRows: SmartScheduleProjectMonthLoad[]
): Map<string, number> {
  const currentLoads = new Map(currentLoadRows.map((row) => [row.monthKey, row.personDays]));
  const replaceableLoads = new Map<string, number>();
  replaceableRows.forEach((row) => {
    replaceableLoads.set(row.monthKey, (replaceableLoads.get(row.monthKey) || 0) + row.personDays);
  });
  return new Map(monthKeys.map((monthKey) => [
    monthKey,
    Math.max(0, (currentLoads.get(monthKey) || 0) - (replaceableLoads.get(monthKey) || 0))
  ]));
}

function groupDrafts(drafts: ScheduleDraft[]): ScheduleGroup[] {
  const grouped = new Map<string, ScheduleDraft[]>();
  drafts.filter((draft) => draft.schedulable).forEach((draft) => {
    const key = JSON.stringify([draft.projectName, draft.personDays, draft.candidateMonths]);
    const rows = grouped.get(key) || [];
    rows.push(draft);
    grouped.set(key, rows);
  });
  return [...grouped.values()]
    .sort((left, right) => left[0].projectName.localeCompare(right[0].projectName)
      || left[0].eligibleEndMonth.localeCompare(right[0].eligibleEndMonth)
      || left[0].eligibleStartMonth.localeCompare(right[0].eligibleStartMonth)
      || left[0].personDays - right[0].personDays)
    .map((rows, index) => ({
      id: String(index),
      projectName: rows[0].projectName,
      count: rows.length,
      personDays: rows[0].personDays,
      candidateMonths: [...rows[0].candidateMonths],
      drafts: [...rows].sort((left, right) => left.dueDate.localeCompare(right.dueDate)
        || left.name.localeCompare(right.name, "zh-Hans-CN")
        || left.employeeId.localeCompare(right.employeeId))
    }));
}

function assignRecommendations(
  groups: ScheduleGroup[],
  assignments: Map<string, Map<string, number>>
): ScheduleDraft[] {
  return groups.flatMap((group) => {
    const groupAssignments = assignments.get(group.id) || new Map<string, number>();
    const months = [...groupAssignments.entries()].sort(([left], [right]) => left.localeCompare(right));
    let offset = 0;
    const assigned = months.flatMap(([monthKey, count]) => {
      const rows = group.drafts.slice(offset, offset + count).map((draft) => ({
        ...draft,
        recommendedMonth: monthKey
      }));
      offset += count;
      return rows;
    });
    if (offset !== group.drafts.length) {
      throw new Error(`智能排班求解结果不完整：任务组 ${group.id} 应排 ${group.drafts.length} 人项，实际分配 ${offset} 人项。`);
    }
    return assigned;
  });
}

function toPublicItem(draft: ScheduleDraft): SmartScheduleItem {
  const { currentDate: _currentDate, currentMonth: _currentMonth, candidateMonths: _candidateMonths, ...item } = draft;
  return item;
}

function recommendedRows(items: SmartScheduleItem[]): SmartScheduleProjectMonthLoad[] {
  const rows = items.flatMap((item): SmartScheduleProjectMonthLoad[] => item.schedulable ? [{
    projectName: item.projectName,
    monthKey: item.recommendedMonth,
    personDays: item.personDays
  }] : []);
  const totals = sumProjectMonthRows(rows);
  return [...totals.entries()].map(([key, personDays]) => {
    const [projectName, monthKey] = key.split("\u0000");
    return { projectName, monthKey, personDays };
  });
}

function buildPlan(analysis: TrainingToolAnalysis, options: SmartSchedulePlanOptions = {}): SmartSchedulePlan {
  const year = normalizeYear(options.year);
  const today = options.today || RuleEngine.createTodayDate();
  const monthKeys = monthKeysForYear(year);
  const currentLoadRows = monthKeys.map((monthKey) => ({
    monthKey,
    personDays: options.currentLoadRows?.find((row) => row.monthKey === monthKey)?.personDays || 0
  }));
  const drafts = buildDrafts(analysis, { ...options, year, today });
  const replaceableRows = replaceableCurrentRows(drafts, year, today);
  const fixedLoads = fixedLoadsForOptimization(monthKeys, currentLoadRows, replaceableRows);
  const groups = groupDrafts(drafts);
  const optimization = TrainingToolSmartScheduleOptimizer.optimizeSchedule({
    monthKeys,
    fixedLoads,
    groups
  });
  if (optimization.status !== "optimal") {
    const variableCount = groups.reduce((total, group) => total + group.candidateMonths.length, 0);
    throw new Error(`智能排班全局优化未完成，求解器状态：${optimization.status}，任务组 ${groups.length} 个、分配变量约 ${variableCount} 个。`);
  }

  const scheduledDrafts = assignRecommendations(groups, optimization.assignments);
  const impossibleDrafts = drafts.filter((draft) => !draft.schedulable);
  const items = [...scheduledDrafts, ...impossibleDrafts]
    .map(toPublicItem)
    .sort((left, right) => (left.recommendedMonth || "9999-99").localeCompare(right.recommendedMonth || "9999-99")
      || left.projectName.localeCompare(right.projectName)
      || left.name.localeCompare(right.name, "zh-Hans-CN"));
  const availableProjects = analysis.projects
    .map((project) => project.canonical)
    .filter((projectName, index, projects) => projects.indexOf(projectName) === index
      && items.some((item) => item.projectName === projectName));

  return {
    year,
    optimizationStatus: "optimal",
    availableProjects,
    items,
    currentLoadRows,
    replaceableCurrentRows: replaceableRows,
    recommendedRows: recommendedRows(items),
    peakPersonDays: optimization.peakPersonDays,
    averagePersonDays: optimization.averagePersonDays,
    totalDeviation: optimization.totalDeviation,
    optimizationVariableCount: optimization.variableCount
  };
}

function rowsForProject(rows: SmartScheduleProjectMonthLoad[], projectName: string): SmartScheduleProjectMonthLoad[] {
  return projectName ? rows.filter((row) => row.projectName === projectName) : rows;
}

function buildView(plan: SmartSchedulePlan, options: SmartScheduleViewOptions = {}): SmartScheduleResult {
  const requestedProject = Utils.normalizeProjectName(options.projectName);
  const selectedProject = plan.availableProjects.includes(requestedProject) ? requestedProject : "";
  const items = selectedProject
    ? plan.items.filter((item) => item.projectName === selectedProject)
    : plan.items;
  const currentLoadRows = options.currentLoadRows || (selectedProject
    ? monthKeysForYear(plan.year).map((monthKey) => ({
        monthKey,
        personDays: rowsForProject(plan.replaceableCurrentRows, selectedProject)
          .filter((row) => row.monthKey === monthKey)
          .reduce((total, row) => total + row.personDays, 0)
      }))
    : plan.currentLoadRows);
  const currentLoads = new Map(currentLoadRows.map((row) => [row.monthKey, row.personDays]));
  const replaceableLoads = new Map<string, number>();
  rowsForProject(plan.replaceableCurrentRows, selectedProject).forEach((row) => {
    replaceableLoads.set(row.monthKey, (replaceableLoads.get(row.monthKey) || 0) + row.personDays);
  });
  const recommendationLoads = new Map<string, number>();
  rowsForProject(plan.recommendedRows, selectedProject).forEach((row) => {
    recommendationLoads.set(row.monthKey, (recommendationLoads.get(row.monthKey) || 0) + row.personDays);
  });
  const balancedLoads = monthKeysForYear(plan.year).map((monthKey) => (
    Math.max(0, (currentLoads.get(monthKey) || 0) - (replaceableLoads.get(monthKey) || 0))
    + (recommendationLoads.get(monthKey) || 0)
  ));
  const averagePersonDays = balancedLoads.reduce((total, value) => total + value, 0) / balancedLoads.length;
  const monthRows = monthKeysForYear(plan.year).map((monthKey, index) => ({
    monthKey,
    currentPersonDays: currentLoads.get(monthKey) || 0,
    balancedPersonDays: balancedLoads[index],
    averagePersonDays
  }));

  return {
    year: plan.year,
    selectedProject,
    availableProjects: plan.availableProjects,
    items,
    monthRows
  };
}

export const TrainingToolSmartSchedule = {
  buildPlan,
  buildView
};
