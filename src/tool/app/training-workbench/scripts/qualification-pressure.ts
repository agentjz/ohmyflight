import type { TrainingToolAnalysis } from "./models";
import { TrainingToolRuleEngine } from "./rule-engine";
import { TrainingToolScheduleAssessment } from "./schedule-assessment";
import { TrainingToolUtils } from "./utils";

const Utils = TrainingToolUtils;
const RuleEngine = TrainingToolRuleEngine;
const ScheduleAssessment = TrainingToolScheduleAssessment;

export type QualificationPressureCoverageStatus = "已覆盖" | "未安排" | "已排未覆盖" | "晚于截止日";

export interface QualificationPressureItem {
  employeeId: string;
  name: string;
  projectName: string;
  currentExpiry: string;
  currentDueDate: string;
  currentDueMonth: string;
  scheduledDate: string;
  forecastExpiry: string;
  forecastDueDate: string;
  forecastDueMonth: string;
  coverageStatus: QualificationPressureCoverageStatus;
  daysEarly: number | null;
  source: string;
  reason: string;
}

export interface QualificationPressureMonthRow {
  monthKey: string;
  currentTotal: number;
  forecastTotal: number;
  currentByProject: Record<string, number>;
  forecastByProject: Record<string, number>;
}

export interface QualificationPressureResult {
  startMonth: string;
  horizonMonths: number;
  selectedProject: string;
  availableProjects: string[];
  projects: string[];
  items: QualificationPressureItem[];
  monthRows: QualificationPressureMonthRow[];
}

export interface QualificationPressureOptions {
  startMonth?: string;
  horizonMonths?: number;
  projectName?: string;
}

const DEFAULT_HORIZON_MONTHS = 36;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeStartMonth(value: unknown): string {
  return Utils.monthRangeFromKey(value) ? Utils.normalizeText(value) : currentMonthKey();
}

function normalizeHorizon(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 12 && parsed <= 60 ? parsed : DEFAULT_HORIZON_MONTHS;
}

function addMonths(monthKey: string, amount: number): string {
  const range = Utils.monthRangeFromKey(monthKey)!;
  const target = Utils.makeDate(range.start.getFullYear(), range.start.getMonth() + 1 + amount, 1);
  return Utils.toMonthKey(target);
}

function buildMonthKeys(startMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addMonths(startMonth, index));
}

function coverageStatus(scheduledDate: Date | null, dueDate: Date | null, covered: boolean): QualificationPressureCoverageStatus {
  if (covered) return "已覆盖";
  if (!scheduledDate) return "未安排";
  if (dueDate && scheduledDate > dueDate) return "晚于截止日";
  return "已排未覆盖";
}

function buildItems(analysis: TrainingToolAnalysis, options: QualificationPressureOptions): QualificationPressureItem[] {
  const assessment = ScheduleAssessment.buildResult(analysis);

  return assessment.allDetailRows.flatMap((row): QualificationPressureItem[] => {
    const project = analysis.projectMap.get(row.projectName);
    const currentExpiry = Utils.parseDate(row.expiry);
    if (!project || !currentExpiry) return [];

    const scheduledDate = Utils.parseDate(row.scheduledDate);
    const coverage = RuleEngine.evaluatePlanCoverage(project.rule, scheduledDate, currentExpiry);
    const currentDueDate = coverage.dueDate || Utils.parseDate(row.dueDate) || currentExpiry;
    const status = coverageStatus(scheduledDate, currentDueDate, coverage.covered);
    const forecastExpiry = coverage.covered && coverage.newExpiry ? coverage.newExpiry : currentExpiry;
    const forecastDue = RuleEngine.evaluatePlanCoverage(project.rule, forecastExpiry, forecastExpiry).dueDate || forecastExpiry;
    const daysEarly = scheduledDate && currentDueDate
      ? Utils.daysBetween(currentDueDate, scheduledDate)
      : null;
    return [{
      employeeId: row.employeeId,
      name: row.name,
      projectName: row.projectName,
      currentExpiry: Utils.formatDate(currentExpiry),
      currentDueDate: Utils.formatDate(currentDueDate),
      currentDueMonth: Utils.toMonthKey(currentDueDate),
      scheduledDate: Utils.formatDate(scheduledDate),
      forecastExpiry: Utils.formatDate(forecastExpiry),
      forecastDueDate: Utils.formatDate(forecastDue),
      forecastDueMonth: Utils.toMonthKey(forecastDue),
      coverageStatus: status,
      daysEarly,
      source: row.source,
      reason: status === "未安排" ? "未找到可覆盖当前轮次的有效安排。" : (coverage.reason || row.reason)
    }];
  }).sort((left, right) => left.forecastDueDate.localeCompare(right.forecastDueDate)
    || left.projectName.localeCompare(right.projectName)
    || left.name.localeCompare(right.name, "zh-Hans-CN"));
}

function incrementProject(bucket: Record<string, number>, projectName: string): void {
  bucket[projectName] = (bucket[projectName] || 0) + 1;
}

function buildMonthRows(items: QualificationPressureItem[], monthKeys: string[]): QualificationPressureMonthRow[] {
  const monthMap = new Map(monthKeys.map((monthKey) => [monthKey, {
    monthKey,
    currentTotal: 0,
    forecastTotal: 0,
    currentByProject: {},
    forecastByProject: {}
  } as QualificationPressureMonthRow]));

  items.forEach((item) => {
    const current = monthMap.get(item.currentDueMonth);
    if (current) {
      current.currentTotal += 1;
      incrementProject(current.currentByProject, item.projectName);
    }
    const forecast = monthMap.get(item.forecastDueMonth);
    if (forecast) {
      forecast.forecastTotal += 1;
      incrementProject(forecast.forecastByProject, item.projectName);
    }
  });
  return [...monthMap.values()];
}

function buildPressure(analysis: TrainingToolAnalysis, options: QualificationPressureOptions = {}): QualificationPressureResult {
  const startMonth = normalizeStartMonth(options.startMonth);
  const horizonMonths = normalizeHorizon(options.horizonMonths);
  const allItems = buildItems(analysis, options);
  const itemProjects = new Set(allItems.map((item) => item.projectName));
  const availableProjects = analysis.projects
    .map((project) => project.canonical)
    .filter((projectName, index, projects) => itemProjects.has(projectName) && projects.indexOf(projectName) === index);
  const requestedProject = Utils.normalizeText(options.projectName);
  const selectedProject = availableProjects.includes(requestedProject) ? requestedProject : "";
  const items = selectedProject ? allItems.filter((item) => item.projectName === selectedProject) : allItems;
  const monthKeys = buildMonthKeys(startMonth, horizonMonths);
  const monthRows = buildMonthRows(items, monthKeys);
  return {
    startMonth,
    horizonMonths,
    selectedProject,
    availableProjects,
    projects: selectedProject ? [selectedProject] : availableProjects,
    items,
    monthRows
  };
}

export const TrainingToolQualificationPressure = {
  buildPressure
};
