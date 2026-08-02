import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import type { TrainingToolAnalysis, TrainingToolSheetInfo, TrainingToolSheetRow } from "./models";

const Utils = TrainingToolUtils;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

  export interface AnnualTrainingStatsRow {
    projectName: string;
    employeeId: string;
    name: string;
    trainingDate: string;
    year: number;
    monthKey: string;
    source: string;
  }

  export interface AnnualTrainingStatsFilters {
    projectName?: string;
    year?: number | string;
    monthKey?: string;
  }

  export interface AnnualTrainingStatsDistribution {
    allRows: AnnualTrainingStatsRow[];
    rows: AnnualTrainingStatsRow[];
    year: number;
    filterOptions: { projects: string[]; years: string[]; months: string[] };
    summary: {
      total: number;
      projectCount: number;
      projectRows: Array<{ projectName: string; total: number }>;
      monthRows: Array<{ label: string; total: number }>;
    };
  }

  function getTrainingDate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): Date | null {
    return Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"))
      || Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
  }

  function normalizeYear(value: unknown, fallbackYear: number): number {
    const year = Number(Utils.normalizeText(value));
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallbackYear;
  }

  function buildRows(analysis: TrainingToolAnalysis | null): AnnualTrainingStatsRow[] {
    if (!analysis || !analysis.projects) return [];
    const rows: AnnualTrainingStatsRow[] = [];

    analysis.projects.forEach((project) => {
      if (!project.sheetInfo || !project.sheetInfo.rows) return;
      project.sheetInfo.rows.forEach((row) => {
        const recordState = TrainingRecordPolicy.classify(row, project.sheetInfo);
        if (!recordState.active || !recordState.recorded) return;

        const trainingDate = getTrainingDate(row, project.sheetInfo);
        const trainingDateText = Utils.formatDate(trainingDate);
        if (!trainingDate || !trainingDateText) return;

        rows.push({
          projectName: project.canonical,
          employeeId: Utils.normalizeText(Utils.getValueByHeader(row, project.sheetInfo, "员工号")),
          name: Utils.normalizeText(Utils.getValueByHeader(row, project.sheetInfo, "姓名")),
          trainingDate: trainingDateText,
          year: trainingDate.getFullYear(),
          monthKey: Utils.toMonthKey(trainingDate),
          source: `${project.sheetName} 第${row.rowNumber}行`
        });
      });
    });

    return rows.sort((left, right) => {
      return left.trainingDate.localeCompare(right.trainingDate)
        || left.projectName.localeCompare(right.projectName)
        || left.name.localeCompare(right.name);
    });
  }

  function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function buildMonthKeys(year: number): string[] {
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  }

  function filterRows(rows: AnnualTrainingStatsRow[], filters: AnnualTrainingStatsFilters = {}): AnnualTrainingStatsRow[] {
    const projectName = Utils.normalizeText(filters.projectName);
    const fallbackYear = new Date().getFullYear();
    const year = normalizeYear(filters.year, fallbackYear);
    const monthKey = Utils.normalizeText(filters.monthKey);

    return (rows || []).filter((row) => {
      if (projectName && row.projectName !== projectName) return false;
      if (year && row.year !== year) return false;
      if (monthKey && row.monthKey !== monthKey) return false;
      return true;
    });
  }

  function buildProjectRows(rows: AnnualTrainingStatsRow[]): Array<{ projectName: string; total: number }> {
    const projectMap = new Map<string, number>();
    rows.forEach((row) => {
      projectMap.set(row.projectName, (projectMap.get(row.projectName) || 0) + 1);
    });
    return [...projectMap.entries()]
      .map(([projectName, total]) => ({ projectName, total }))
      .sort((left, right) => right.total - left.total || left.projectName.localeCompare(right.projectName));
  }

  function buildMonthRows(rows: AnnualTrainingStatsRow[], year: number): Array<{ label: string; total: number }> {
    const monthMap = new Map(buildMonthKeys(year).map((monthKey) => [monthKey, 0]));
    rows.forEach((row) => {
      if (!monthMap.has(row.monthKey)) return;
      monthMap.set(row.monthKey, (monthMap.get(row.monthKey) || 0) + 1);
    });
    return [...monthMap.entries()].map(([label, total]) => ({ label, total }));
  }

  function buildDistribution(analysis: TrainingToolAnalysis | null, filters: AnnualTrainingStatsFilters = {}): AnnualTrainingStatsDistribution {
    const allRows = buildRows(analysis);
    const availableYears = uniqueSorted(allRows.map((row) => String(row.year))).reverse();
    const fallbackYear = availableYears.length ? Number(availableYears[0]) : new Date().getFullYear();
    const year = normalizeYear(filters.year, fallbackYear);
    const rows = filterRows(allRows, { ...filters, year });
    const yearRows = allRows.filter((row) => row.year === year);

    return {
      allRows,
      rows,
      year,
      filterOptions: {
        projects: uniqueSorted(allRows.map((row) => row.projectName)),
        years: availableYears,
        months: buildMonthKeys(year).filter((monthKey) => yearRows.some((row) => row.monthKey === monthKey))
      },
      summary: {
        total: rows.length,
        projectCount: new Set(rows.map((row) => row.projectName)).size,
        projectRows: buildProjectRows(rows),
        monthRows: buildMonthRows(rows, year)
      }
    };
  }
  export const TrainingToolAnnualTrainingStats = {
    buildRows,
    filterRows,
    buildDistribution
  };
