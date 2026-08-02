import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import type { TrainingToolAnalysis, TrainingToolSheetInfo, TrainingToolSheetRow } from "./models";

const Utils = TrainingToolUtils;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

  export interface ScheduledDistributionRow {
    projectName: string;
    employeeId: string;
    name: string;
    trainingDate: string;
    monthKey: string;
    remark: string;
    source: string;
  }

  export interface ScheduledDistributionFilters {
    projectName?: string;
    monthKey?: string;
  }

  interface ScheduledDistributionBucket {
    label: string;
    total: number;
    projects: Map<string, number>;
  }

  export interface ScheduledDistributionSummaryRow {
    label: string;
    total: number;
    projectSummary: string;
  }

  export interface ScheduledDistributionResult {
    allRows: ScheduledDistributionRow[];
    rows: ScheduledDistributionRow[];
    filterOptions: { projects: string[]; months: string[] };
    summary: {
      monthRows: ScheduledDistributionSummaryRow[];
      dateRows: ScheduledDistributionSummaryRow[];
      projectRows: ScheduledDistributionSummaryRow[];
      total: number;
    };
  }

  function getTrainingDate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): Date | null {
    return Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"))
      || Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
  }

  function buildRows(analysis: TrainingToolAnalysis | null): ScheduledDistributionRow[] {
    if (!analysis || !analysis.projects) return [];
    const rows: ScheduledDistributionRow[] = [];

    analysis.projects.forEach((project) => {
      if (!project.sheetInfo || !project.sheetInfo.rows) return;
      project.sheetInfo.rows.forEach((row) => {
        const recordState = TrainingRecordPolicy.classify(row, project.sheetInfo);
        if (!recordState.active) return;

        const trainingDate = getTrainingDate(row, project.sheetInfo);
        const trainingDateText = Utils.formatDate(trainingDate);
        if (!trainingDateText) return;

        rows.push({
          projectName: project.canonical,
          employeeId: Utils.normalizeText(Utils.getValueByHeader(row, project.sheetInfo, "员工号")),
          name: Utils.normalizeText(Utils.getValueByHeader(row, project.sheetInfo, "姓名")),
          trainingDate: trainingDateText,
          monthKey: Utils.toMonthKey(trainingDate),
          remark: Utils.normalizeText(Utils.getValueByHeader(row, project.sheetInfo, "备注")),
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

  function createBucket(label: string): ScheduledDistributionBucket {
    return {
      label,
      total: 0,
      projects: new Map()
    };
  }

  function addToBucket(bucket: ScheduledDistributionBucket, row: ScheduledDistributionRow): void {
    bucket.total += 1;
    bucket.projects.set(row.projectName, (bucket.projects.get(row.projectName) || 0) + 1);
  }

  function finalizeBuckets(map: Map<string, ScheduledDistributionBucket>): ScheduledDistributionSummaryRow[] {
    return [...map.values()]
      .map((bucket) => ({
        label: bucket.label,
        total: bucket.total,
        projectSummary: [...bucket.projects.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .map(([projectName, count]) => `${projectName} ${count}`)
          .join("；")
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  function uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function filterRows(rows: ScheduledDistributionRow[], filters: ScheduledDistributionFilters = {}): ScheduledDistributionRow[] {
    const projectName = Utils.normalizeText(filters.projectName);
    const monthKey = Utils.normalizeText(filters.monthKey);
    return (rows || []).filter((row) => {
      if (projectName && row.projectName !== projectName) return false;
      if (monthKey && row.monthKey !== monthKey) return false;
      return true;
    });
  }

  function buildSummary(rows: ScheduledDistributionRow[]): ScheduledDistributionResult["summary"] {
    const monthMap = new Map<string, ScheduledDistributionBucket>();
    const dateMap = new Map<string, ScheduledDistributionBucket>();
    const projectMap = new Map<string, ScheduledDistributionBucket>();

    (rows || []).forEach((row) => {
      const monthKey = row.monthKey || "无月份";
      const dateKey = row.trainingDate || "无日期";
      const projectKey = row.projectName || "未识别项目";

      if (!monthMap.has(monthKey)) monthMap.set(monthKey, createBucket(monthKey));
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, createBucket(dateKey));
      if (!projectMap.has(projectKey)) projectMap.set(projectKey, createBucket(projectKey));

      addToBucket(monthMap.get(monthKey)!, row);
      addToBucket(dateMap.get(dateKey)!, row);
      addToBucket(projectMap.get(projectKey)!, row);
    });

    return {
      monthRows: finalizeBuckets(monthMap),
      dateRows: finalizeBuckets(dateMap),
      projectRows: finalizeBuckets(projectMap),
      total: (rows || []).length
    };
  }

  function buildDistribution(analysis: TrainingToolAnalysis | null, filters: ScheduledDistributionFilters = {}): ScheduledDistributionResult {
    const allRows = buildRows(analysis);
    const rows = filterRows(allRows, filters);
    return {
      allRows,
      rows,
      filterOptions: {
        projects: uniqueSorted(allRows.map((row) => row.projectName)),
        months: uniqueSorted(allRows.map((row) => row.monthKey))
      },
      summary: buildSummary(rows)
    };
  }
  export const TrainingToolScheduledDistribution = {
    buildRows,
    filterRows,
    buildSummary,
    buildDistribution
  };
