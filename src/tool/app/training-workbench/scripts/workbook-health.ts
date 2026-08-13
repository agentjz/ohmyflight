import { TrainingToolConfig } from "./config";
import { TrainingToolCrmAnnual } from "./crm-annual";
import { TrainingToolCrmInstructors } from "./crm-instructors";
import { TrainingToolTrainingIgnoreList } from "./training-ignore-list";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import type {
  TrainingToolAnalysis,
  TrainingToolProjectAnalysis,
  TrainingToolSheetInfo,
  TrainingToolSheetRow,
  TrainingToolWorkbook
} from "./models";

const Config = TrainingToolConfig;
  const Utils = TrainingToolUtils;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;
  const TrainingIgnoreList = TrainingToolTrainingIgnoreList;
  const CrmAnnual = TrainingToolCrmAnnual;
  const CrmInstructors = TrainingToolCrmInstructors;

  type HealthLevel = "error" | "warning" | "info";

  export interface WorkbookHealthResult {
    items: Array<{
      level: HealthLevel;
      levelLabel: string;
      area: string;
      message: string;
      detail: string;
    }>;
    summary: Record<HealthLevel, number>;
  }

  const LEVELS: Record<HealthLevel, string> = {
    error: "严重",
    warning: "警告",
    info: "提示"
  };

  interface SecurityTsaPersonEntry {
    key: string;
    label: string;
    rowNumber: number;
  }

  interface SecurityTsaSessionGroup {
    startDate: string;
    endDate: string;
    people: Map<string, SecurityTsaPersonEntry>;
  }

  function createResult(): WorkbookHealthResult {
    return {
      items: [],
      summary: {
        error: 0,
        warning: 0,
        info: 0
      }
    };
  }

  function addItem(
    result: WorkbookHealthResult,
    level: HealthLevel,
    area: string,
    message: string,
    detail = ""
  ): void {
    result.items.push({ level, levelLabel: LEVELS[level], area, message, detail });
    result.summary[level] += 1;
  }

  type TrainingScanner = Pick<typeof import("./scanner").TrainingToolScanner, "readSheetInfo">;

  function hasHeader(sheetInfo: TrainingToolSheetInfo | null | undefined, headerName: unknown): boolean {
    return (sheetInfo && sheetInfo.headerMap && sheetInfo.headerMap.has(Utils.normalizeText(headerName))) as boolean;
  }

  function getRowPersonLabel(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): string {
    const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "员工号"));
    const name = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));
    return [employeeId, name].filter(Boolean).join(" / ") || `第${row.rowNumber}行`;
  }

  function checkPeopleSheet(result: WorkbookHealthResult, analysis: TrainingToolAnalysis): void {
    const peopleInfo = analysis.peopleInfo;
    addItem(result, "info", "人员信息表", `识别到人员信息表“${peopleInfo.name}”，共 ${peopleInfo.rows.length} 行。`);

    ["员工号", "姓名"].forEach((header) => {
      if (!hasHeader(peopleInfo, header)) {
        addItem(result, "error", "人员信息表", `缺少必要表头“${header}”。`);
      }
    });

    ["分部", "技术信息", "是否运行", "备注"].forEach((header) => {
      if (!hasHeader(peopleInfo, header)) {
        addItem(result, "warning", "人员信息表", `缺少建议表头“${header}”。`, "相关展示或 CRM 分类可能不完整。");
      }
    });

    const employeeRows = new Map<string, number[]>();
    peopleInfo.rows.forEach((row) => {
      const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "员工号"));
      const name = Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "姓名"));
      if (!employeeId && !name) {
        addItem(result, "warning", "人员信息表", `第${row.rowNumber}行缺少员工号和姓名。`);
      }
      if (!employeeId) return;
      const rows = employeeRows.get(employeeId) || [];
      rows.push(row.rowNumber);
      employeeRows.set(employeeId, rows);
    });

    employeeRows.forEach((rows, employeeId) => {
      if (rows.length > 1) {
        addItem(result, "warning", "人员信息表", `员工号 ${employeeId} 重复出现。`, `行号：${rows.join("、")}`);
      }
    });
  }

  function checkSpecialCasePeople(result: WorkbookHealthResult): void {
    const ignoredPeople = TrainingIgnoreList.IGNORED_PERSON_PROJECTS;
    const crmInstructors = CrmInstructors.names;
    if (!ignoredPeople.length && !crmInstructors.length) return;

    const nonFlyingPeople: string[] = [];
    const securityInstructors: string[] = [];
    ignoredPeople.forEach((item) => {
      if (item.ignoreAllProjects) {
        nonFlyingPeople.push(item.name);
        return;
      }
      securityInstructors.push(item.name);
    });

    const groups = [
      { label: "不飞人员（所有资质不监控）", names: nonFlyingPeople },
      { label: "安保教员（航空安保、TSA 不监控）", names: securityInstructors },
      { label: "CRM 教员（不进入 CRM 未参加名单）", names: crmInstructors }
    ].filter((group) => group.names.length);
    const uniqueNames = new Set(groups.flatMap((group) => group.names));
    const detail = groups.map((group) => `${group.label}：${group.names.join("、")}`).join("；");
    addItem(result, "info", "特判人员", `当前维护 ${groups.length} 类、共 ${uniqueNames.size} 人。`, detail);
  }

  function checkProjectSheetRows(result: WorkbookHealthResult, project: TrainingToolProjectAnalysis): void {
    const sheetInfo = project.sheetInfo;
    if (!sheetInfo) return;

    sheetInfo.rows.forEach((row) => {
      const label = getRowPersonLabel(row, sheetInfo);
      const recordState = TrainingRecordPolicy.classify(row, sheetInfo);
      const startRaw = Utils.getValueByHeader(row, sheetInfo, "培训开始日期");
      const endRaw = Utils.getValueByHeader(row, sheetInfo, "培训结束日期");
      const hasStart = Utils.hasMeaningfulValue(startRaw);
      const hasEnd = Utils.hasMeaningfulValue(endRaw);
      const startDate = Utils.parseDate(startRaw);
      const endDate = Utils.parseDate(endRaw);

      if (recordState.abnormal) {
        addItem(result, "warning", project.canonical, `${label} 数据矛盾。`, `${project.sheetName} 第${row.rowNumber}行：${recordState.reason}`);
      }

      if ((hasStart && !startDate) || (hasEnd && !endDate)) {
        addItem(result, "warning", project.canonical, `${label} 培训日期无法解析。`, `${project.sheetName} 第${row.rowNumber}行`);
      }

      if (recordState.active && !startDate && !endDate) {
        addItem(result, "warning", project.canonical, `${label} 缺少可用培训日期。`, `${project.sheetName} 第${row.rowNumber}行`);
      }
    });
  }

  function checkProjects(result: WorkbookHealthResult, analysis: TrainingToolAnalysis): void {
    const expectedNames = Config.PROJECT_RULES
      .filter((rule) => rule.enabled)
      .map((rule) => rule.canonical);
    const recognized = new Set(analysis.projects.map((project) => project.canonical));

    expectedNames.forEach((projectName) => {
      if (!recognized.has(projectName)) {
        addItem(result, "warning", "培训项目", `未识别到“${projectName}”项目 sheet。`);
      }
    });

    analysis.projects.forEach((project) => {
      addItem(
        result,
        "info",
        project.canonical,
        `识别到项目 sheet“${project.sheetName}”。`,
        `已录入 ${project.recordedRowCount} 行，未录入 ${project.pendingRowCount} 行。`
      );

      if (project.peopleColumnIndex < 0) {
        addItem(result, "warning", project.canonical, "人员信息表中没有对应有效期列。", "排班总览无法按人员当前有效期判断该项目。");
      }

      checkProjectSheetRows(result, project);
    });
  }

  function buildSecurityTsaSessionGroups(
    project: TrainingToolProjectAnalysis
  ): Map<string, SecurityTsaSessionGroup> {
    const groups = new Map<string, SecurityTsaSessionGroup>();
    const sheetInfo = project.sheetInfo;
    if (!sheetInfo) return groups;

    sheetInfo.rows.forEach((row: TrainingToolSheetRow) => {
      const recordState = TrainingRecordPolicy.classify(row, sheetInfo);
      if (!recordState.active) return;

      const startDate = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"));
      const endDate = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
      if (!startDate || !endDate) return;

      const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "员工号"));
      const name = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));
      if (!employeeId && !name) return;

      const startDateText = Utils.formatDate(startDate);
      const endDateText = Utils.formatDate(endDate);
      const sessionKey = `${startDateText}@@${endDateText}`;
      const personKey = employeeId ? `id:${employeeId}` : `name:${name}`;
      const group = groups.get(sessionKey) || {
        startDate: startDateText,
        endDate: endDateText,
        people: new Map<string, SecurityTsaPersonEntry>()
      };

      if (!group.people.has(personKey)) {
        group.people.set(personKey, {
          key: personKey,
          label: [employeeId, name].filter(Boolean).join(" / "),
          rowNumber: row.rowNumber
        });
      }
      groups.set(sessionKey, group);
    });

    return groups;
  }

  function formatSessionPerson(entry: SecurityTsaPersonEntry): string {
    return `${entry.label}（第${entry.rowNumber}行）`;
  }

  function checkSecurityTsaAttendees(
    result: WorkbookHealthResult,
    analysis: TrainingToolAnalysis
  ): void {
    const securityProject = analysis.projectMap.get("航空安保");
    const tsaProject = analysis.projectMap.get("TSA");
    if (!securityProject || !tsaProject) return;

    const securityGroups = buildSecurityTsaSessionGroups(securityProject);
    const tsaGroups = buildSecurityTsaSessionGroups(tsaProject);

    securityGroups.forEach((securityGroup, sessionKey) => {
      const tsaGroup = tsaGroups.get(sessionKey);
      if (!tsaGroup) return;

      const securityOnly = [...securityGroup.people.values()]
        .filter((person) => !tsaGroup.people.has(person.key));
      const tsaOnly = [...tsaGroup.people.values()]
        .filter((person) => !securityGroup.people.has(person.key));
      if (!securityOnly.length && !tsaOnly.length) return;

      const dateLabel = securityGroup.startDate === securityGroup.endDate
        ? securityGroup.startDate
        : `${securityGroup.startDate} 至 ${securityGroup.endDate}`;
      const details = [
        securityOnly.length
          ? `仅航空安保：${securityOnly.map(formatSessionPerson).join("、")}`
          : "",
        tsaOnly.length
          ? `仅 TSA：${tsaOnly.map(formatSessionPerson).join("、")}`
          : ""
      ].filter(Boolean);

      addItem(
        result,
        "warning",
        "安保 / TSA 名单",
        `${dateLabel} 名单不一致。`,
        details.join("；")
      );
    });
  }

  function checkCrm(result: WorkbookHealthResult, workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis, scanner: TrainingScanner, yearValue: unknown): void {
    const year = CrmAnnual.normalizeYear(yearValue || new Date().getFullYear());
    const crmLikeSheets = workbook.SheetNames.filter((name) => Utils.normalizeText(name).includes("CRM"));
    const hasExactCrm = workbook.Sheets[CrmAnnual.CRM_SHEET_NAME];

    crmLikeSheets
      .filter((name) => name !== CrmAnnual.CRM_SHEET_NAME)
      .forEach((name) => {
        addItem(result, "info", "CRM", `发现工作表“${name}”，系统不会作为当年 CRM 核对来源。`);
      });

    if (!hasExactCrm) {
      addItem(result, "warning", "CRM", "未找到精确名为“CRM”的工作表。");
      return;
    }

    const crmSheet = scanner.readSheetInfo(workbook, CrmAnnual.CRM_SHEET_NAME);
    ["员工号", "姓名", "培训开始日期", "培训结束日期", "备注"].forEach((header) => {
      if (!hasHeader(crmSheet, header)) {
        addItem(result, "warning", "CRM", `CRM 工作表缺少表头“${header}”。`);
      }
    });

    const crmResult = CrmAnnual.buildAnnualCheck(workbook, analysis, scanner, year);
    const unrecognized = (crmResult.roleRows || []).find((row) => row.role === "未识别");
    addItem(
      result,
      "info",
      "CRM",
      `${year} 年 CRM 核对可生成。`,
      `应参加 ${crmResult.stats.required} 人，已参加 ${crmResult.stats.attended} 人，未参加 ${crmResult.stats.missing} 人。`
    );
    if (unrecognized && unrecognized.required) {
      addItem(result, "warning", "CRM", `有 ${unrecognized.required} 名 CRM 应参加人员技术等级未识别。`);
    }
    if (crmResult.duplicateRows && crmResult.duplicateRows.length) {
      addItem(
        result,
        "warning",
        "CRM",
        `${year} 年 CRM 有 ${crmResult.duplicateRows.length} 人重复安排。`,
        crmResult.duplicateRows
          .slice(0, 8)
          .map((row) => `${row.name || row.employeeId}：${row.count} 次（行号：${row.rowNumbers.join("、")}）`)
          .join("；")
      );
    }
  }

  function checkIgnoredSheets(result: WorkbookHealthResult, workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis): void {
    const usedSheets = new Set([
      analysis.peopleInfo.name,
      ...analysis.projects.map((project) => project.sheetName).filter(Boolean),
      CrmAnnual.CRM_SHEET_NAME
    ]);
    workbook.SheetNames
      .filter((sheetName) => !usedSheets.has(sheetName))
      .forEach((sheetName) => {
        addItem(result, "info", "未纳入监控", `工作表“${sheetName}”当前不参与培训皇帝监控。`);
      });
  }

  function buildWorkbookHealth(workbook: TrainingToolWorkbook | null, analysis: TrainingToolAnalysis | null, scanner: TrainingScanner, options: { crmYear?: unknown } = {}): WorkbookHealthResult {
    const healthOptions = options;
    const result = createResult();
    if (!workbook || !analysis) {
      addItem(result, "error", "工作簿", "未导入可检查的工作簿。");
      return result;
    }

    checkPeopleSheet(result, analysis);
    checkSpecialCasePeople(result);
    checkProjects(result, analysis);
    checkSecurityTsaAttendees(result, analysis);
    checkCrm(result, workbook, analysis, scanner, healthOptions.crmYear);
    checkIgnoredSheets(result, workbook, analysis);

    return result;
  }
  export const TrainingToolWorkbookHealth = {
    buildWorkbookHealth
  };
