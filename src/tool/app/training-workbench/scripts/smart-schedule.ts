import type {
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

const LATEST_DATE_RULE = "最新日期";
const BASE_MONTH_RULE = "基准月";
const DEFAULT_HORIZON_MONTHS = 12;
const DEFAULT_SAFETY_LEAD_MONTHS = 2;
const MAX_HORIZON_MONTHS = 60;
const MAX_MONTH_RANGE = 120;
const EMPTY_KEY_SEPARATOR = String.fromCharCode(0);

export interface SmartScheduleItem {
  employeeId: string;
  name: string;
  projectName: string;
  ruleType: string;
  dueDate: string;
  safetyTargetMonth: string;
  recommendedMonth: string;
  eligibleStartMonth: string;
  eligibleEndMonth: string;
  personDays: number;
  schedulable: boolean;
  reason: string;
}

export interface SmartScheduleMonthRow {
  monthKey: string;
  originalDuePersonDays: number;
  balancedPersonDays: number;
  averagePersonDays: number;
}

export interface SmartScheduleProjectMonthLoad {
  projectName: string;
  monthKey: string;
  personDays: number;
}

export interface SmartSchedulePlan {
  startMonth: string;
  horizonMonths: number;
  safetyLeadMonths: number;
  avoidedMonths: number[];
  monthKeys: string[];
  optimizationStatus: "optimal";
  availableProjects: string[];
  items: SmartScheduleItem[];
  fixedLoadRows: Array<{ monthKey: string; personDays: number }>;
  originalDueRows: SmartScheduleProjectMonthLoad[];
  recommendedRows: SmartScheduleProjectMonthLoad[];
  peakPersonDays: number;
  averagePersonDays: number;
  totalDeviation: number;
  safetyPenalty: number;
  avoidedPersonDays: number;
  optimizationVariableCount: number;
}

export interface SmartScheduleResult {
  startMonth: string;
  horizonMonths: number;
  selectedProject: string;
  availableProjects: string[];
  items: SmartScheduleItem[];
  monthRows: SmartScheduleMonthRow[];
}

export interface SmartSchedulePlanOptions {
  startMonth?: string;
  horizonMonths?: number | string;
  safetyLeadMonths?: number | string;
  avoidedMonths?: number[];
  today?: Date;
  fixedLoadRows?: Array<{ monthKey: string; personDays: number }>;
}

export interface SmartScheduleViewOptions {
  projectName?: string;
}

interface ScheduleDraft extends SmartScheduleItem {
  currentDate: string;
  currentMonth: string;
  currentDueMonth: string;
  candidateMonths: string[];
}

interface ScheduleGroup extends SmartScheduleOptimizationGroup {
  drafts: ScheduleDraft[];
}

function currentPlanningMonth(today: Date): string {
  return Utils.toMonthKey(
    Utils.makeDate(today.getFullYear(), today.getMonth() + 2, 1)
  );
}

function normalizeStartMonth(value: unknown, today: Date): string {
  return Utils.monthRangeFromKey(value)
    ? Utils.normalizeText(value)
    : currentPlanningMonth(today);
}

function normalizeHorizon(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    && parsed >= 12
    && parsed <= MAX_HORIZON_MONTHS
    ? parsed
    : DEFAULT_HORIZON_MONTHS;
}

function normalizeSafetyLead(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 12
    ? parsed
    : DEFAULT_SAFETY_LEAD_MONTHS;
}

function normalizeAvoidedMonths(value: unknown): number[] {
  if (!Array.isArray(value)) return [2, 7, 8];
  return [...new Set(value.map(Number).filter((month) => (
    Number.isInteger(month) && month >= 1 && month <= 12
  )))].sort((left, right) => left - right);
}

function shiftMonth(monthKey: string, amount: number): string {
  const range = Utils.monthRangeFromKey(monthKey);
  if (!range) return "";
  return Utils.toMonthKey(
    Utils.makeDate(range.start.getFullYear(), range.start.getMonth() + 1 + amount, 1)
  );
}

function monthsBetween(startMonth: string, endMonth: string): string[] {
  if (
    !Utils.monthRangeFromKey(startMonth)
    || !Utils.monthRangeFromKey(endMonth)
    || startMonth > endMonth
  ) return [];
  const result: string[] = [];
  let monthKey = startMonth;
  while (monthKey <= endMonth && result.length < MAX_MONTH_RANGE) {
    result.push(monthKey);
    monthKey = shiftMonth(monthKey, 1);
  }
  return result;
}

function candidateDate(
  monthKey: string,
  earliest: Date,
  latest: Date,
  today: Date
): Date | null {
  const range = Utils.monthRangeFromKey(monthKey);
  if (!range) return null;
  const lowerTime = Math.max(
    range.start.getTime(),
    earliest.getTime(),
    today.getTime()
  );
  const upperTime = Math.min(range.end.getTime(), latest.getTime());
  return lowerTime <= upperTime ? new Date(lowerTime) : null;
}

function windowCandidates(
  rule: TrainingToolProjectAnalysis["rule"],
  currentExpiry: Date,
  dueDate: Date,
  startMonth: string,
  endMonth: string,
  today: Date
): string[] {
  const windowInfo = RuleEngine.getWindowInfo(rule, currentExpiry);
  if (!windowInfo.hasWindow || !windowInfo.windowStart || !windowInfo.windowEnd) return [];
  const firstMonth = [Utils.toMonthKey(windowInfo.windowStart), startMonth]
    .sort()
    .at(-1) || "";
  const lastMonth = [
    Utils.toMonthKey(windowInfo.windowEnd),
    Utils.toMonthKey(dueDate),
    endMonth
  ].sort()[0] || "";
  return monthsBetween(firstMonth, lastMonth).filter((monthKey) => (
    candidateDate(monthKey, windowInfo.windowStart, dueDate, today) !== null
  ));
}

function latestDateCandidates(
  dueDate: Date,
  startMonth: string,
  endMonth: string,
  today: Date
): string[] {
  const firstMonth = [startMonth, Utils.toMonthKey(today)].sort().at(-1) || "";
  const lastMonth = [Utils.toMonthKey(dueDate), endMonth].sort()[0] || "";
  return monthsBetween(firstMonth, lastMonth).filter((monthKey) => (
    candidateDate(monthKey, today, dueDate, today) !== null
  ));
}

function estimateProjectPersonDays(project: TrainingToolProjectAnalysis): number {
  const counts = new Map<number, number>();
  project.sheetInfo.rows.forEach((row) => {
    if (!TrainingRecordPolicy.classify(row, project.sheetInfo).active) return;
    const start = Utils.parseDate(
      Utils.getValueByHeader(row, project.sheetInfo, "培训开始日期")
    );
    const end = Utils.parseDate(
      Utils.getValueByHeader(row, project.sheetInfo, "培训结束日期")
    ) || start;
    if (!start || !end || end < start) return;
    const days = Utils.daysBetween(end, start) + 1;
    if (days < 1 || days > 14) return;
    counts.set(days, (counts.get(days) || 0) + 1);
  });
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0] - right[0]
  )[0]?.[0] || 1;
}

function reasonForRule(ruleType: string, safetyTargetMonth: string): string {
  if (ruleType === LATEST_DATE_RULE) {
    return "在合法月份内优先靠近安全提前目标 "
      + safetyTargetMonth + "，最晚不超过资质截止日。";
  }
  if (ruleType === BASE_MONTH_RULE) {
    return "在基准月窗口内安排，原基准月不变。";
  }
  return "在保护窗口内安排，原到期锚点不变。";
}

function buildDrafts(
  analysis: TrainingToolAnalysis,
  options: {
    startMonth: string;
    endMonth: string;
    safetyLeadMonths: number;
    today: Date;
  }
): ScheduleDraft[] {
  const pressure = QualificationPressure.buildPressure(analysis, {
    startMonth: options.startMonth,
    horizonMonths: MAX_HORIZON_MONTHS
  });
  const projectPersonDays = new Map(
    analysis.projects.map((project) => [
      project.canonical,
      estimateProjectPersonDays(project)
    ])
  );
  const planningMonthKeys = monthsBetween(options.startMonth, options.endMonth);

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
    const currentExpiry = Utils.parseDate(
      pastCovered ? item.forecastExpiry : item.currentExpiry
    );
    const dueDate = Utils.parseDate(
      pastCovered ? item.forecastDueDate : item.currentDueDate
    );
    if (!project || !currentExpiry || !dueDate) return [];
    const dueMonth = Utils.toMonthKey(dueDate);
    if (!planningMonthKeys.includes(dueMonth) && dueMonth < options.startMonth) {
      return [{
        employeeId: item.employeeId,
        name: item.name,
        projectName: item.projectName,
        ruleType: project.rule.ruleType,
        dueDate: Utils.formatDate(dueDate),
        safetyTargetMonth: shiftMonth(dueMonth, -options.safetyLeadMonths),
        recommendedMonth: "",
        eligibleStartMonth: "",
        eligibleEndMonth: "",
        personDays: projectPersonDays.get(item.projectName) || 1,
        schedulable: false,
        reason: "当前轮次已早于滚动范围，没有不晚于截止日的合法月份。",
        currentDate,
        currentMonth,
        currentDueMonth: dueMonth,
        candidateMonths: []
      }];
    }
    if (dueMonth > options.endMonth) return [];

    const candidateMonths = project.rule.ruleType === LATEST_DATE_RULE
      ? latestDateCandidates(dueDate, options.startMonth, options.endMonth, options.today)
      : windowCandidates(
        project.rule,
        currentExpiry,
        dueDate,
        options.startMonth,
        options.endMonth,
        options.today
      );
    const safetyTargetMonth = shiftMonth(dueMonth, -options.safetyLeadMonths);
    const schedulable = candidateMonths.length > 0;
    return [{
      employeeId: item.employeeId,
      name: item.name,
      projectName: item.projectName,
      ruleType: project.rule.ruleType,
      dueDate: Utils.formatDate(dueDate),
      safetyTargetMonth,
      recommendedMonth: "",
      eligibleStartMonth: candidateMonths[0] || "",
      eligibleEndMonth: candidateMonths.at(-1) || "",
      personDays: projectPersonDays.get(item.projectName) || 1,
      schedulable,
      reason: schedulable
        ? reasonForRule(project.rule.ruleType, safetyTargetMonth)
        : "当前轮次已没有不晚于截止日的合法月份。",
      currentDate,
      currentMonth,
      currentDueMonth: dueMonth,
      candidateMonths
    }];
  });
}

function sumProjectMonthRows(rows: SmartScheduleProjectMonthLoad[]): Map<string, number> {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const key = row.projectName + EMPTY_KEY_SEPARATOR + row.monthKey;
    totals.set(key, (totals.get(key) || 0) + row.personDays);
  });
  return totals;
}

function normalizeFixedLoadRows(
  monthKeys: string[],
  rows: Array<{ monthKey: string; personDays: number }>
): Array<{ monthKey: string; personDays: number }> {
  const loads = new Map(rows.map((row) => [row.monthKey, Math.max(0, Number(row.personDays) || 0)]));
  return monthKeys.map((monthKey) => ({
    monthKey,
    personDays: loads.get(monthKey) || 0
  }));
}

function groupDrafts(drafts: ScheduleDraft[]): ScheduleGroup[] {
  const grouped = new Map<string, ScheduleDraft[]>();
  drafts.filter((draft) => draft.schedulable).forEach((draft) => {
    const key = JSON.stringify([
      draft.projectName,
      draft.personDays,
      draft.safetyTargetMonth,
      draft.candidateMonths
    ]);
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
      safetyTargetMonth: rows[0].safetyTargetMonth,
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
      throw new Error(
        "智能排班求解结果不完整：任务组 " + group.id
          + " 应排 " + group.drafts.length + " 人项，实际分配 " + offset + " 人项。"
      );
    }
    return assigned;
  });
}

function toPublicItem(draft: ScheduleDraft): SmartScheduleItem {
  const {
    currentDate: _currentDate,
    currentMonth: _currentMonth,
    currentDueMonth: _currentDueMonth,
    candidateMonths: _candidateMonths,
    ...item
  } = draft;
  return item;
}

function projectRows(
  rows: SmartScheduleProjectMonthLoad[],
  projectName: string
): SmartScheduleProjectMonthLoad[] {
  return projectName ? rows.filter((row) => row.projectName === projectName) : rows;
}

function recommendedRows(items: SmartScheduleItem[]): SmartScheduleProjectMonthLoad[] {
  const rows = items.flatMap((item): SmartScheduleProjectMonthLoad[] => (
    item.schedulable
      ? [{
        projectName: item.projectName,
        monthKey: item.recommendedMonth,
        personDays: item.personDays
      }]
      : []
  ));
  return [...sumProjectMonthRows(rows).entries()].map(([key, personDays]) => {
    const separatorIndex = key.indexOf(EMPTY_KEY_SEPARATOR);
    return {
      projectName: key.slice(0, separatorIndex),
      monthKey: key.slice(separatorIndex + 1),
      personDays
    };
  });
}

function originalDueRows(
  items: SmartScheduleItem[],
  monthKeys: string[]
): SmartScheduleProjectMonthLoad[] {
  const rows = items.flatMap((item): SmartScheduleProjectMonthLoad[] => (
    item.schedulable && monthKeys.includes(item.dueDate.slice(0, 7))
      ? [{
        projectName: item.projectName,
        monthKey: item.dueDate.slice(0, 7),
        personDays: item.personDays
      }]
      : []
  ));
  return [...sumProjectMonthRows(rows).entries()].map(([key, personDays]) => {
    const separatorIndex = key.indexOf(EMPTY_KEY_SEPARATOR);
    return {
      projectName: key.slice(0, separatorIndex),
      monthKey: key.slice(separatorIndex + 1),
      personDays
    };
  });
}

function buildPlan(
  analysis: TrainingToolAnalysis,
  options: SmartSchedulePlanOptions = {}
): SmartSchedulePlan {
  const today = options.today || RuleEngine.createTodayDate();
  const startMonth = normalizeStartMonth(options.startMonth, today);
  const horizonMonths = normalizeHorizon(options.horizonMonths);
  const safetyLeadMonths = normalizeSafetyLead(options.safetyLeadMonths);
  const avoidedMonths = normalizeAvoidedMonths(options.avoidedMonths);
  const monthKeys = monthsBetween(startMonth, shiftMonth(startMonth, horizonMonths - 1));
  const endMonth = monthKeys.at(-1) || startMonth;
  const fixedLoadRows = normalizeFixedLoadRows(monthKeys, options.fixedLoadRows || []);
  const drafts = buildDrafts(analysis, {
    startMonth,
    endMonth,
    safetyLeadMonths,
    today
  });
  const groups = groupDrafts(drafts);
  const optimization = TrainingToolSmartScheduleOptimizer.optimizeSchedule({
    monthKeys,
    fixedLoads: new Map(fixedLoadRows.map((row) => [row.monthKey, row.personDays])),
    avoidedMonths,
    groups
  });
  if (optimization.status !== "optimal") {
    const variableCount = groups.reduce(
      (total, group) => total + group.candidateMonths.length,
      0
    );
    throw new Error(
      "智能排班全局优化未完成，求解器状态：" + optimization.status
        + "，失败阶段：" + optimization.failedObjective
        + "，任务组 " + groups.length + " 个、分配变量约 " + variableCount + " 个。"
    );
  }

  const scheduledDrafts = assignRecommendations(groups, optimization.assignments);
  const impossibleDrafts = drafts.filter((draft) => !draft.schedulable);
  const items = [...scheduledDrafts, ...impossibleDrafts]
    .map(toPublicItem)
    .sort((left, right) => (
      (left.recommendedMonth || "9999-99").localeCompare(right.recommendedMonth || "9999-99")
      || left.projectName.localeCompare(right.projectName)
      || left.name.localeCompare(right.name, "zh-Hans-CN")
    ));
  const availableProjects = analysis.projects
    .map((project) => project.canonical)
    .filter((projectName, index, projects) => (
      projects.indexOf(projectName) === index
      && items.some((item) => item.projectName === projectName)
    ));
  const publicItems = items;

  return {
    startMonth,
    horizonMonths,
    safetyLeadMonths,
    avoidedMonths,
    monthKeys,
    optimizationStatus: "optimal",
    availableProjects,
    items: publicItems,
    fixedLoadRows,
    originalDueRows: originalDueRows(publicItems, monthKeys),
    recommendedRows: recommendedRows(publicItems),
    peakPersonDays: optimization.peakPersonDays,
    averagePersonDays: optimization.averagePersonDays,
    totalDeviation: optimization.totalDeviation,
    safetyPenalty: optimization.safetyPenalty,
    avoidedPersonDays: optimization.avoidedPersonDays,
    optimizationVariableCount: optimization.variableCount
  };
}

function buildView(
  plan: SmartSchedulePlan,
  options: SmartScheduleViewOptions = {}
): SmartScheduleResult {
  const requestedProject = Utils.normalizeProjectName(options.projectName);
  const selectedProject = plan.availableProjects.includes(requestedProject)
    ? requestedProject
    : "";
  const items = selectedProject
    ? plan.items.filter((item) => item.projectName === selectedProject)
    : plan.items;
  const originalLoads = new Map<string, number>();
  projectRows(plan.originalDueRows, selectedProject).forEach((row) => {
    originalLoads.set(row.monthKey, (originalLoads.get(row.monthKey) || 0) + row.personDays);
  });
  const balancedLoads = new Map<string, number>();
  projectRows(plan.recommendedRows, selectedProject).forEach((row) => {
    balancedLoads.set(row.monthKey, (balancedLoads.get(row.monthKey) || 0) + row.personDays);
  });
  if (!selectedProject) {
    plan.fixedLoadRows.forEach((row) => {
      originalLoads.set(row.monthKey, (originalLoads.get(row.monthKey) || 0) + row.personDays);
      balancedLoads.set(row.monthKey, (balancedLoads.get(row.monthKey) || 0) + row.personDays);
    });
  }
  const averagePersonDays = plan.monthKeys.length
    ? plan.monthKeys.reduce((total, monthKey) => (
      total + (balancedLoads.get(monthKey) || 0)
    ), 0) / plan.monthKeys.length
    : 0;
  const monthRows = plan.monthKeys.map((monthKey) => ({
    monthKey,
    originalDuePersonDays: originalLoads.get(monthKey) || 0,
    balancedPersonDays: balancedLoads.get(monthKey) || 0,
    averagePersonDays
  }));
  return {
    startMonth: plan.startMonth,
    horizonMonths: plan.horizonMonths,
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
