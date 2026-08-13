import { TrainingToolRuleEngine } from "./rule-engine";
import { TrainingToolTrainingIgnoreList } from "./training-ignore-list";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import { TrainingToolWorkbenchStatus } from "./workbench-status";
import type {
  TrainingAssessmentFilters,
  TrainingAssessmentOptions,
  TrainingAssessmentRow,
  TrainingChartData,
  TrainingChartValueRow,
  TrainingExtraProjectRow,
  TrainingPersonRiskRow,
  TrainingProjectChartRow,
  TrainingProjectGroup,
  TrainingProjectRule,
  TrainingProjectSummaryRow,
  TrainingRecordState,
  TrainingStatsCard,
  TrainingSummaryData,
  TrainingToolAnalysis,
  TrainingToolProjectAnalysis,
  TrainingToolSheetInfo,
  TrainingToolSheetRow,
  TrainingVisibleStatusBucket,
  TrainingWorkbenchResult,
  TrainingWindowInfo
} from "./models";

const Utils = TrainingToolUtils;
  const RuleEngine = TrainingToolRuleEngine;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;
  const TrainingIgnoreList = TrainingToolTrainingIgnoreList;
  const WorkbenchStatus = TrainingToolWorkbenchStatus;
  const STATUSES = WorkbenchStatus.STATUSES;
  const DEFAULT_VISIBLE_STATUSES = WorkbenchStatus.DEFAULT_VISIBLE_STATUSES;
  const VISIBLE_STATUS_FIELDS = WorkbenchStatus.VISIBLE_STATUS_FIELDS;

  type AssessmentFilters = TrainingAssessmentFilters;
  type ExtraProjectRow = TrainingExtraProjectRow;

  type AssessmentCandidate = { employeeId: string; name: string; expiry: Date };
  type CandidateMatch = {
    rowNumber: number;
    source: string;
    trainingDate: Date | null;
    trainingDateText: string;
    recorded: boolean;
    recordState: TrainingRecordState;
    covered: boolean;
    dueDate?: Date | null;
    reason: string;
  };
  type CandidateSource = { sheetInfo: TrainingToolSheetInfo; rows: TrainingToolSheetRow[]; sheetName: string };
  type SchedulingNeed = {
    status: string;
    dueDate: Date;
    dueMonth: string;
    windowInfo: TrainingWindowInfo;
    reason: string;
  };
  type SummaryOptions = {
    analysis?: Pick<TrainingToolAnalysis, "projects">;
    baseRows?: Array<{ projectName: string }>;
  };

  function getRowTrainingDate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): Date | null {
    return Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"))
      || Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
  }

  function createExtraSheetInfo(project: TrainingToolProjectAnalysis): TrainingToolSheetInfo & { project: TrainingToolProjectAnalysis } {
    const headers = [
      "员工号",
      "姓名",
      "项目名称",
      "培训开始日期",
      "培训结束日期",
      "培训信息是否录入",
      "备注"
    ];

    return {
      name: "模拟排班",
      sheet: null,
      matrix: [headers],
      headers,
      headerMap: Utils.buildHeaderMap(headers),
      rows: [],
      project
    };
  }

  function buildExtraRows(project: TrainingToolProjectAnalysis, extraProjectRows: ExtraProjectRow[] = []): { sheetInfo: TrainingToolSheetInfo; rows: TrainingToolSheetRow[] } {
    const sheetInfo = createExtraSheetInfo(project);
    const rows = (extraProjectRows || [])
      .filter((item) => Utils.normalizeProjectName(item.projectName) === project.canonical)
      .map((item, index) => ({
        rowNumber: index + 1,
        simulationId: item.id || "",
        simulation: true,
        cells: [
          Utils.normalizeText(item.employeeId),
          Utils.normalizeText(item.name),
          project.canonical,
          item.trainingStartDate || "",
          item.trainingEndDate || item.trainingStartDate || "",
          "否",
          Utils.normalizeText(item.remark)
        ],
        source: item.source || "模拟排班"
      }));

    return {
      sheetInfo: {
        ...sheetInfo,
        rows
      },
      rows
    };
  }

  function samePerson(candidate: AssessmentCandidate, row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): boolean {
    const rowEmployeeId = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "员工号"));
    const rowName = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));

    if (candidate.employeeId && rowEmployeeId) {
      return candidate.employeeId === rowEmployeeId;
    }

    if (!candidate.name || !rowName) {
      return false;
    }

    return candidate.name === rowName;
  }

  function addMonths(value: Date, months: number): Date {
    const totalMonth = value.getMonth() + months;
    const year = value.getFullYear() + Math.floor(totalMonth / 12);
    const month = ((totalMonth % 12) + 12) % 12 + 1;
    const day = Math.min(value.getDate(), new Date(year, month, 0).getDate());
    return Utils.makeDate(year, month, day);
  }

  function firstDayOfMonth(value: Date): Date {
    return Utils.makeDate(value.getFullYear(), value.getMonth() + 1, 1);
  }

  function monthEnd(value: Date): Date {
    return Utils.makeDate(value.getFullYear(), value.getMonth() + 1, new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate());
  }

  function createTodayDate(): Date {
    return RuleEngine.createTodayDate();
  }

  function getDefaultStageEnd(today: Date): Date {
    return monthEnd(addMonths(today, 1));
  }

  function buildCandidateMatches(project: TrainingToolProjectAnalysis, candidate: AssessmentCandidate, extraProjectRows: ExtraProjectRow[] = []): CandidateMatch[] {
    const sources: CandidateSource[] = [];
    if (project.sheetInfo && project.sheetInfo.rows) {
      sources.push({
        sheetInfo: project.sheetInfo,
        rows: project.sheetInfo.rows,
        sheetName: project.sheetName
      });
    }

    const extraRows = buildExtraRows(project, extraProjectRows);
    if (extraRows.rows.length) {
      sources.push({
        sheetInfo: extraRows.sheetInfo,
        rows: extraRows.rows,
        sheetName: "模拟排班"
      });
    }

    return sources.flatMap((sourceInfo) => sourceInfo.rows
      .filter((row) => samePerson(candidate, row, sourceInfo.sheetInfo))
      .map((row) => {
        const trainingDate = getRowTrainingDate(row, sourceInfo.sheetInfo);
        const recordState = TrainingRecordPolicy.classify(row, sourceInfo.sheetInfo);
        const coverage: { covered: boolean; dueDate?: Date | null; reason: string } = recordState.active
          ? RuleEngine.evaluatePlanCoverage(project.rule, trainingDate, candidate.expiry)
          : {
            covered: false,
            reason: recordState.reason
          };
        return {
          rowNumber: row.rowNumber,
          source: row.simulation ? (row.source || "模拟排班") : `${sourceInfo.sheetName} 第${row.rowNumber}行`,
          trainingDate,
          trainingDateText: Utils.formatDate(trainingDate),
          recorded: recordState.recorded,
          recordState,
          covered: coverage.covered,
          dueDate: coverage.dueDate,
          reason: coverage.reason
        };
      }))
      .sort((left, right) => {
        const leftTime = left.trainingDate ? left.trainingDate.getTime() : Number.POSITIVE_INFINITY;
        const rightTime = right.trainingDate ? right.trainingDate.getTime() : Number.POSITIVE_INFINITY;
        return leftTime - rightTime || left.rowNumber - right.rowNumber;
      });
  }

  function getNoWindowRecommendationStart(expiry: Date): Date {
    return firstDayOfMonth(addMonths(expiry, -2));
  }

  function classifySchedulingNeed(rule: TrainingProjectRule, stageStart: Date, stageEnd: Date, expiry: Date): SchedulingNeed {
    const windowInfo = RuleEngine.getWindowInfo(rule, expiry);
    const coverageInfo = RuleEngine.evaluatePlanCoverage(rule, expiry, expiry);
    const dueDate = coverageInfo.dueDate || expiry;

    if (dueDate < stageStart) {
      return {
        status: STATUSES.expired,
        dueDate,
        dueMonth: Utils.toMonthKey(dueDate),
        windowInfo,
        reason: `当前有效期已过期，最晚完成日期为 ${Utils.formatDate(dueDate)}。`
      };
    }

    if (dueDate >= stageStart && dueDate <= stageEnd) {
      return {
        status: STATUSES.must,
        dueDate,
        dueMonth: Utils.toMonthKey(dueDate),
        windowInfo,
        reason: `本月不处理就会过期，最晚完成日期为 ${Utils.formatDate(dueDate)}。`
      };
    }

    if (windowInfo.hasWindow && Utils.rangesOverlap(stageStart, stageEnd, windowInfo.windowStart, windowInfo.windowEnd)) {
      return {
        status: STATUSES.recommended,
        dueDate,
        dueMonth: Utils.toMonthKey(dueDate),
        windowInfo,
        reason: `已进入${windowInfo.tag}，建议提前安排。${windowInfo.detail}`
      };
    }

    if (!windowInfo.hasWindow) {
      const recommendStart = getNoWindowRecommendationStart(dueDate);
      const recommendEnd = dueDate;
      if (Utils.rangesOverlap(stageStart, stageEnd, recommendStart, recommendEnd)) {
        return {
          status: STATUSES.recommended,
          dueDate,
          dueMonth: Utils.toMonthKey(dueDate),
          windowInfo,
          reason: `项目无窗口期，已进入管理提前期 ${Utils.formatDate(recommendStart)} 至 ${Utils.formatDate(recommendEnd)}，建议提前安排。`
        };
      }
    }

    return {
      status: STATUSES.normal,
      dueDate,
      dueMonth: Utils.toMonthKey(dueDate),
      windowInfo,
      reason: `当前有效期为 ${Utils.formatDate(expiry)}，本阶段不用处理。`
    };
  }

  function buildAssessmentRows(analysis: TrainingToolAnalysis, project: TrainingToolProjectAnalysis, stageStart: Date, stageEnd: Date, extraProjectRows: ExtraProjectRow[] = []): TrainingAssessmentRow[] {
    const rows: TrainingAssessmentRow[] = [];

    analysis.peopleInfo.rows.forEach((row) => {
      const employeeId = Utils.normalizeText(row.cells[analysis.peopleIndex.employeeColumnIndex]);
      const name = Utils.normalizeText(row.cells[analysis.peopleIndex.nameColumnIndex]);
      if (!employeeId && !name) return;
      if (TrainingIgnoreList.shouldIgnore({ employeeId, name }, project.canonical)) return;

      const rawExpiry = row.cells[project.peopleColumnIndex];
      const expiry = Utils.parseDate(rawExpiry);
      const expiryText = Utils.formatDate(expiry) || Utils.normalizeText(rawExpiry);
      const source = `${analysis.peopleInfo.name} 第${row.rowNumber}行`;

      if (!expiry) {
        if (Utils.normalizeText(rawExpiry) && !Utils.isNullLikeText(rawExpiry)) {
          rows.push({
            status: STATUSES.abnormal,
            projectName: project.canonical,
            employeeId,
            name,
            expiry: expiryText,
          dueMonth: "",
          dueDate: "",
          scheduledDate: "",
          source,
          reason: `当前有效期“${Utils.normalizeText(rawExpiry)}”无法解析为日期。`
          });
        }
        return;
      }

      const candidate = { employeeId, name, expiry };
      const matches = buildCandidateMatches(project, candidate, extraProjectRows);
      const abnormalMatches = matches.filter((item) => item.recordState && item.recordState.abnormal);
      const activeMatches = matches.filter((item) => item.recordState && item.recordState.active);
      const coveredMatches = matches.filter((item) => item.covered);
      const earliestActive = activeMatches[0];
      const earliestCovered = coveredMatches[0];
      const scheduleNeed = classifySchedulingNeed(project.rule, stageStart, stageEnd, expiry);

      let status = scheduleNeed.status;
      let reason = scheduleNeed.reason;
      let rowSource = source;

      if (abnormalMatches.length) {
        status = STATUSES.abnormal;
        reason = `${abnormalMatches[0].recordState.reason}（项目 sheet 第${abnormalMatches[0].rowNumber}行）`;
        rowSource = abnormalMatches[0].source;
      } else if (coveredMatches.length) {
        status = STATUSES.normal;
        reason = "已找到可覆盖本轮到期的有效安排，排班层面不用重复排。";
        rowSource = earliestCovered.source;
      } else if (activeMatches.length && scheduleNeed.status === STATUSES.expired) {
        status = STATUSES.expiredScheduled;
        reason = `当前有效期已过期，已有安排 ${earliestActive.trainingDateText || "日期无法解析"}，但不能覆盖本轮到期。${earliestActive.reason}`;
        rowSource = earliestActive.source;
      } else if (activeMatches.length && (
        scheduleNeed.status === STATUSES.must || scheduleNeed.status === STATUSES.recommended
      )) {
        status = STATUSES.uncoveredScheduled;
        reason = `已有安排 ${earliestActive.trainingDateText || "日期无法解析"}，但不能覆盖本轮到期。${earliestActive.reason}`;
        rowSource = earliestActive.source;
      } else if (scheduleNeed.status === STATUSES.expired) {
        reason = "当前有效期已过期，且未找到可覆盖本轮到期的安排。";
      } else if (scheduleNeed.status === STATUSES.must) {
        reason = `未找到可覆盖本轮到期的安排。${scheduleNeed.reason}`;
      } else if (scheduleNeed.status === STATUSES.recommended) {
        reason = `未找到可覆盖本轮到期的安排。${scheduleNeed.reason}`;
      }

      rows.push({
        status,
        projectName: project.canonical,
        employeeId,
        name,
        expiry: Utils.formatDate(expiry),
        dueMonth: scheduleNeed.dueMonth,
        dueDate: Utils.formatDate(scheduleNeed.dueDate),
        scheduledDate: earliestCovered ? earliestCovered.trainingDateText : (earliestActive ? earliestActive.trainingDateText : ""),
        source: rowSource,
        reason
      });
    });

    return rows;
  }

  function sortRows(rows: TrainingAssessmentRow[]): TrainingAssessmentRow[] {
    rows.sort((left, right) => {
      const leftRank = WorkbenchStatus.rankOfStatus(left.status);
      const rightRank = WorkbenchStatus.rankOfStatus(right.status);
      return leftRank - rightRank
        || left.dueDate.localeCompare(right.dueDate)
        || left.projectName.localeCompare(right.projectName)
        || left.name.localeCompare(right.name);
    });
    return rows;
  }

  function buildRows(analysis: TrainingToolAnalysis, options: TrainingAssessmentOptions = {}): { stageStart: Date; stageEnd: Date; rows: TrainingAssessmentRow[] } {
    const stageStart = options.today || createTodayDate();
    const stageEnd = options.stageEnd || getDefaultStageEnd(stageStart);
    const rows: TrainingAssessmentRow[] = [];
    const extraProjectRows = options.extraProjectRows || [];

    analysis.projects
      .filter((project) => project.peopleColumnIndex >= 0)
      .forEach((project) => {
        rows.push(...buildAssessmentRows(analysis, project, stageStart, stageEnd, extraProjectRows));
      });

    return {
      stageStart,
      stageEnd,
      rows: sortRows(rows)
    };
  }

  function normalizeFilterSet(values: string[] | undefined): Set<string> {
    return new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Utils.normalizeText(value))
        .filter(Boolean)
    );
  }

  function includesSearch(row: TrainingAssessmentRow, searchText: unknown): boolean {
    const keyword = Utils.normalizeText(searchText);
    if (!keyword) return true;
    return [
      row.projectName,
      row.employeeId,
      row.name,
      row.expiry,
      row.dueMonth,
      row.scheduledDate,
      row.source,
      row.reason
    ].some((value) => Utils.normalizeText(value).includes(keyword));
  }

  function filterRows(rows: TrainingAssessmentRow[], filters: AssessmentFilters = {}): TrainingAssessmentRow[] {
    const projectSet = normalizeFilterSet(filters.projects);
    const statusSet = normalizeFilterSet(filters.statuses);
    const monthSet = normalizeFilterSet(filters.months);
    const hasExplicitStatusFilter = statusSet.size > 0;

    return rows.filter((row) => {
      if (projectSet.size && !projectSet.has(row.projectName)) return false;
      if (hasExplicitStatusFilter && !statusSet.has(row.status)) return false;
      if (!hasExplicitStatusFilter && !WorkbenchStatus.isDefaultVisible(row.status)) return false;
      if (monthSet.size && !monthSet.has(row.dueMonth)) return false;
      return includesSearch(row, filters.searchText);
    });
  }

  function countRows(rows: TrainingAssessmentRow[]): Record<string, number> {
    return rows.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  function buildStatsCards(rows: TrainingAssessmentRow[]): TrainingStatsCard[] {
    const counts = countRows(rows);
    return [
      {
        label: STATUSES.expired,
        value: counts[STATUSES.expired] || 0,
        tone: "danger",
        hint: "有效期已经早于评估开始日期，必须立即处理。"
      },
      {
        label: STATUSES.must,
        value: counts[STATUSES.must] || 0,
        tone: "warning",
        hint: "最晚完成日期落在当前评估区间内。"
      },
      {
        label: STATUSES.recommended,
        value: counts[STATUSES.recommended] || 0,
        tone: "info",
        hint: "已经进入窗口期或管理提前期，适合提前排班。"
      },
      {
        label: STATUSES.uncoveredScheduled,
        value: counts[STATUSES.uncoveredScheduled] || 0,
        tone: "danger",
        hint: "项目 sheet 里有安排，但按规则不能覆盖本轮到期。"
      },
      {
        label: STATUSES.abnormal,
        value: counts[STATUSES.abnormal] || 0,
        tone: "danger",
        hint: "日期或取消备注存在矛盾，需要人工确认。"
      },
      {
        label: STATUSES.expiredScheduled,
        value: counts[STATUSES.expiredScheduled] || 0,
        tone: "ok",
        hint: "人员信息表已过期，但项目 sheet 里已有补训安排。"
      }
    ];
  }

  function uniqueSortedText(values: unknown[], sort = true): string[] {
    const result = [...new Set(values.map((value) => String(value || "")).filter(Boolean))] as string[];
    return sort ? result.sort((left, right) => left.localeCompare(right)) : result;
  }

  function buildFilterOptions(rows: TrainingAssessmentRow[]): TrainingWorkbenchResult["filterOptions"] {
    return {
      projects: uniqueSortedText(rows.map((row) => row.projectName)),
      statuses: uniqueSortedText(rows.map((row) => row.status), false),
      months: uniqueSortedText(rows.map((row) => row.dueMonth))
    };
  }

  function buildStatusChartRows(rows: TrainingAssessmentRow[]): TrainingChartValueRow[] {
    const counts = countRows(rows);
    return VISIBLE_STATUS_FIELDS.map((item) => ({
      name: item.status,
      value: counts[item.status] || 0
    }));
  }

  function buildProjectChartRows(rows: TrainingAssessmentRow[]): TrainingProjectChartRow[] {
    const projectMap = new Map<string, TrainingProjectChartRow>();
    rows.forEach((row) => {
      if (!WorkbenchStatus.isDefaultVisible(row.status)) return;
      if (!projectMap.has(row.projectName)) {
        projectMap.set(row.projectName, WorkbenchStatus.createVisibleStatusBucket({
          projectName: row.projectName,
        }));
      }
      const item = projectMap.get(row.projectName);
      WorkbenchStatus.incrementVisibleStatusBucket(item!, row.status);
    });
    return [...projectMap.values()].sort((left, right) => {
      const leftTotal = VISIBLE_STATUS_FIELDS.reduce((total, item) => total + left[item.field], 0);
      const rightTotal = VISIBLE_STATUS_FIELDS.reduce((total, item) => total + right[item.field], 0);
      return rightTotal - leftTotal || left.projectName.localeCompare(right.projectName);
    });
  }

  function createProjectSummaryItem(projectName: string): TrainingProjectSummaryRow {
    return {
      projectName,
      ...WorkbenchStatus.createVisibleStatusBucket(),
      total: 0,
      rowsByStatus: {
        [STATUSES.expired]: [],
        [STATUSES.expiredScheduled]: [],
        [STATUSES.must]: [],
        [STATUSES.uncoveredScheduled]: [],
        [STATUSES.recommended]: [],
        [STATUSES.abnormal]: []
      }
    };
  }

  function incrementProjectSummary(item: TrainingProjectSummaryRow, row: TrainingAssessmentRow): void {
    const status = row.status;
    WorkbenchStatus.incrementVisibleStatusBucket(item, status);
    if (item.rowsByStatus[status]) item.rowsByStatus[status].push(row);
    item.total += 1;
  }

  function buildProjectSummaryRows(rows: TrainingAssessmentRow[], options: SummaryOptions = {}): TrainingProjectSummaryRow[] {
    const summaryOptions = options;
    const projectMap = new Map<string, TrainingProjectSummaryRow>();
    if (summaryOptions.analysis && summaryOptions.analysis.projects) {
      summaryOptions.analysis.projects.forEach((project) => {
        if (project && project.canonical && !projectMap.has(project.canonical)) {
          projectMap.set(project.canonical, createProjectSummaryItem(project.canonical));
        }
      });
    }
    if (summaryOptions.baseRows) {
      summaryOptions.baseRows.forEach((row) => {
        if (row && row.projectName && !projectMap.has(row.projectName)) {
          projectMap.set(row.projectName, createProjectSummaryItem(row.projectName));
        }
      });
    }
    rows.forEach((row) => {
      if (!WorkbenchStatus.isDefaultVisible(row.status)) return;
      if (!projectMap.has(row.projectName)) {
        projectMap.set(row.projectName, createProjectSummaryItem(row.projectName));
      }
      incrementProjectSummary(projectMap.get(row.projectName)!, row);
    });
    return [...projectMap.values()].sort((left, right) => {
      return right.total - left.total
        || right.expired - left.expired
        || right.expiredScheduled - left.expiredScheduled
        || right.must - left.must
        || right.uncoveredScheduled - left.uncoveredScheduled
        || right.recommended - left.recommended
        || left.projectName.localeCompare(right.projectName);
    });
  }

  function buildProjectGroups(rows: TrainingAssessmentRow[]): TrainingProjectGroup[] {
    const groupMap = new Map<string, Omit<TrainingProjectGroup, "total">>();
    rows.forEach((row) => {
      if (!WorkbenchStatus.isDefaultVisible(row.status)) return;
      const key = `${row.projectName}@@${row.status}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          projectName: row.projectName,
          status: row.status,
          rows: []
        });
      }
      groupMap.get(key)!.rows.push(row);
    });
    return [...groupMap.values()]
      .map((group) => ({
        ...group,
        total: group.rows.length,
        rows: group.rows.slice(0, 80)
      }))
      .sort((left, right) => {
        const leftRank = WorkbenchStatus.rankOfStatus(left.status);
        const rightRank = WorkbenchStatus.rankOfStatus(right.status);
        return left.projectName.localeCompare(right.projectName)
          || leftRank - rightRank;
      });
  }

  function parseDisplayDate(value: unknown): Date | null {
    return Utils.parseDate(value);
  }

  function buildPersonRiskRows(rows: TrainingAssessmentRow[]): TrainingPersonRiskRow[] {
    const personMap = new Map<string, TrainingPersonRiskRow>();
    rows.forEach((row) => {
      if (!WorkbenchStatus.isDefaultVisible(row.status)) return;
      const key = row.employeeId || row.name;
      if (!key) return;
      if (!personMap.has(key)) {
        personMap.set(key, {
          employeeId: row.employeeId,
          name: row.name,
          ...WorkbenchStatus.createVisibleStatusBucket(),
          total: 0,
          nearestDueDate: "",
          items: []
        });
      }
      const item = personMap.get(key)!;
      WorkbenchStatus.incrementVisibleStatusBucket(item, row.status);
      item.total += 1;
      item.items.push({
        status: row.status,
        projectName: row.projectName,
        dueDate: row.dueDate,
        expiry: row.expiry,
        reason: row.reason
      });

      const dueDate = parseDisplayDate(row.dueDate || row.expiry);
      const currentNearest = parseDisplayDate(item.nearestDueDate);
      if (dueDate && (!currentNearest || dueDate < currentNearest)) {
        item.nearestDueDate = Utils.formatDate(dueDate);
      }
    });

    return [...personMap.values()].sort((left, right) => {
      const leftDue = parseDisplayDate(left.nearestDueDate);
      const rightDue = parseDisplayDate(right.nearestDueDate);
      const dueSort = leftDue && rightDue ? leftDue.getTime() - rightDue.getTime() : 0;
      return right.expired - left.expired
        || right.expiredScheduled - left.expiredScheduled
        || right.must - left.must
        || right.uncoveredScheduled - left.uncoveredScheduled
        || right.recommended - left.recommended
        || right.abnormal - left.abnormal
        || dueSort
        || left.name.localeCompare(right.name);
    });
  }

  function buildSummaryData(rows: TrainingAssessmentRow[], options: SummaryOptions = {}): TrainingSummaryData {
    return {
      projectSummaryRows: buildProjectSummaryRows(rows, options),
      projectGroups: buildProjectGroups(rows),
      personRiskRows: buildPersonRiskRows(rows)
    };
  }

  function buildChartData(rows: TrainingAssessmentRow[]): TrainingChartData {
    return {
      statusRows: buildStatusChartRows(rows),
      projectRows: buildProjectChartRows(rows)
    };
  }

  function buildResult(analysis: TrainingToolAnalysis, options: TrainingAssessmentOptions = {}): TrainingWorkbenchResult {
    const assessment = buildRows(analysis, options);
    const allRows = assessment.rows;
    const detailRows = filterRows(allRows, options.filters || {});
    const hasExplicitStatusFilter = normalizeFilterSet((options.filters || {}).statuses).size > 0;
    return {
      summaryText: hasExplicitStatusFilter
        ? `排班总览显示 ${detailRows.length} 条，原始扫描 ${allRows.length} 条。`
        : `排班总览默认显示 ${detailRows.length} 条待处理或异常记录，原始扫描 ${allRows.length} 条。`,
      statsCards: buildStatsCards(detailRows),
      chartData: buildChartData(detailRows),
      summaryData: buildSummaryData(detailRows, { analysis }),
      displayColumns: ["状态", "项目", "姓名", "当前有效期", "已排日期", "说明"],
      detailColumns: ["状态", "项目", "员工号", "姓名", "当前有效期", "到期月份", "最晚完成日期", "已排日期", "来源", "说明"],
      allDetailRows: allRows,
      detailRows,
      skippedColumns: [],
      skippedRows: [],
      filterOptions: buildFilterOptions(allRows),
      stageStart: Utils.formatDate(assessment.stageStart),
      stageEnd: Utils.formatDate(assessment.stageEnd)
    };
  }

  function viewFromRows(baseResult: TrainingWorkbenchResult, filters: AssessmentFilters = {}): TrainingWorkbenchResult {
    const allRows = baseResult.allDetailRows || baseResult.detailRows || [];
    const detailRows = filterRows(allRows, filters);
    const hasExplicitStatusFilter = normalizeFilterSet(filters.statuses).size > 0;
    return {
      ...baseResult,
      summaryText: hasExplicitStatusFilter
        ? `排班总览显示 ${detailRows.length} 条，原始扫描 ${allRows.length} 条。`
        : `排班总览默认显示 ${detailRows.length} 条待处理或异常记录，原始扫描 ${allRows.length} 条。`,
      statsCards: buildStatsCards(detailRows),
      chartData: buildChartData(detailRows),
      summaryData: buildSummaryData(detailRows, {
        baseRows: baseResult.summaryData && baseResult.summaryData.projectSummaryRows
          ? baseResult.summaryData.projectSummaryRows
          : []
      }),
      displayColumns: baseResult.displayColumns || ["状态", "项目", "姓名", "当前有效期", "已排日期", "说明"],
      detailRows,
      allDetailRows: allRows,
      filterOptions: baseResult.filterOptions || buildFilterOptions(allRows)
    };
  }
  export const TrainingToolScheduleAssessment = {
    STATUSES,
    DEFAULT_VISIBLE_STATUSES,
    buildRows,
    buildResult,
    filterRows,
    viewFromRows,
    buildStatsCards,
    buildChartData,
    buildSummaryData
  };
