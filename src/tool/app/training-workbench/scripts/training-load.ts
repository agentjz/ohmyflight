import type {
  TrainingExtraProjectRow,
  TrainingToolAnalysis,
  TrainingToolSheetInfo,
  TrainingToolSheetRow,
  TrainingToolWorkbook
} from "./models";
import { TrainingToolScanner } from "./scanner";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";

const Utils = TrainingToolUtils;
const Scanner = TrainingToolScanner;
const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

const SECURITY_PROJECT = "航空安保";
const TSA_PROJECT = "TSA";
const JOINT_PROJECT = "航空安保 / TSA";
const CRM_PROJECT = "CRM";

interface LoadRecord {
  projectName: string;
  employeeId: string;
  name: string;
  personKey: string;
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
}

interface SessionDraft {
  projectName: string;
  sourceProjects: Set<string>;
  startDate: string;
  endDate: string;
  attendees: Set<string>;
}

export interface TrainingLoadSession {
  projectName: string;
  sourceProjects: string[];
  startDate: string;
  endDate: string;
  attendeeCount: number;
}

export interface TrainingLoadMonthRow {
  monthKey: string;
  personDays: number;
  sessionCount: number;
  recordCount: number;
}

export interface TrainingLoadResult {
  year: number;
  selectedProject: string;
  projects: string[];
  sessions: TrainingLoadSession[];
  monthRows: TrainingLoadMonthRow[];
  summary: {
    personDays: number;
    sessionCount: number;
    recordCount: number;
    crmRecordCount: number;
  };
}

export interface TrainingLoadOptions {
  year?: number | string;
  projectName?: string;
  extraProjectRows?: TrainingExtraProjectRow[];
}

function normalizeYear(value: unknown): number {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

function normalizeRange(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): { start: Date; end: Date } | null {
  const parsedStart = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"));
  const parsedEnd = Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
  const start = parsedStart || parsedEnd;
  const end = parsedEnd || parsedStart;
  return start && end && end >= start ? { start, end } : null;
}

function personKey(employeeId: string, name: string): string {
  return employeeId ? `id:${employeeId}` : name ? `name:${name}` : "";
}

function toLoadRecord(projectName: string, row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): LoadRecord | null {
  if (!TrainingRecordPolicy.classify(row, sheetInfo).active) return null;
  const range = normalizeRange(row, sheetInfo);
  if (!range) return null;
  const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "员工号"));
  const name = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));
  const key = personKey(employeeId, name);
  if (!key) return null;
  return {
    projectName,
    employeeId,
    name,
    personKey: key,
    start: range.start,
    end: range.end,
    startDate: Utils.formatDate(range.start),
    endDate: Utils.formatDate(range.end)
  };
}

function buildSimulationSheetInfo(rows: TrainingExtraProjectRow[]): TrainingToolSheetInfo {
  const headers = ["员工号", "姓名", "项目名称", "培训开始日期", "培训结束日期", "培训信息是否录入", "备注"];
  const sheetRows = rows.map((row, index) => ({
    rowNumber: index + 1,
    simulation: true,
    cells: [row.employeeId || "", row.name || "", row.projectName, row.trainingStartDate || "", row.trainingEndDate || row.trainingStartDate || "", "否", row.remark || "模拟排班"]
  }));
  return {
    name: "模拟排班",
    sheet: null,
    matrix: [headers, ...sheetRows.map((row) => row.cells)],
    headers,
    headerMap: Utils.buildHeaderMap(headers),
    rows: sheetRows
  };
}

function collectRecords(workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis, options: TrainingLoadOptions): LoadRecord[] {
  const records: LoadRecord[] = [];
  analysis.projects.forEach((project) => {
    project.sheetInfo.rows.forEach((row) => {
      const record = toLoadRecord(project.canonical, row, project.sheetInfo);
      if (record) records.push(record);
    });
  });

  if (workbook.Sheets[CRM_PROJECT]) {
    const crmInfo = Scanner.readSheetInfo(workbook, CRM_PROJECT);
    crmInfo.rows.forEach((row) => {
      const record = toLoadRecord(CRM_PROJECT, row, crmInfo);
      if (record) records.push(record);
    });
  }

  const simulationRows = options.extraProjectRows || [];
  if (simulationRows.length) {
    const simulationInfo = buildSimulationSheetInfo(simulationRows);
    simulationInfo.rows.forEach((row) => {
      const projectName = Utils.normalizeProjectName(Utils.getValueByHeader(row, simulationInfo, "项目名称"));
      const record = toLoadRecord(projectName, row, simulationInfo);
      if (record) records.push(record);
    });
  }
  return records;
}

function normalizeProjectName(value: unknown): string {
  return Utils.normalizeText(value);
}

function buildSessionDrafts(records: LoadRecord[]): SessionDraft[] {
  const groups = new Map<string, SessionDraft>();
  records.forEach((record) => {
    const key = `${record.projectName}|${record.startDate}|${record.endDate}`;
    const draft = groups.get(key) || {
      projectName: record.projectName,
      sourceProjects: new Set([record.projectName]),
      startDate: record.startDate,
      endDate: record.endDate,
      attendees: new Set<string>()
    };
    draft.attendees.add(record.personKey);
    groups.set(key, draft);
  });
  return [...groups.values()];
}

function mergeSecurityAndTsa(drafts: SessionDraft[]): SessionDraft[] {
  const result: SessionDraft[] = [];
  const paired = new Map<string, SessionDraft[]>();
  drafts.forEach((draft) => {
    if (draft.projectName !== SECURITY_PROJECT && draft.projectName !== TSA_PROJECT) {
      result.push(draft);
      return;
    }
    const key = `${draft.startDate}|${draft.endDate}`;
    const bucket = paired.get(key) || [];
    bucket.push(draft);
    paired.set(key, bucket);
  });
  paired.forEach((bucket) => {
    const security = bucket.find((draft) => draft.projectName === SECURITY_PROJECT);
    const tsa = bucket.find((draft) => draft.projectName === TSA_PROJECT);
    if (!security || !tsa) {
      result.push(...bucket);
      return;
    }
    result.push({
      projectName: JOINT_PROJECT,
      sourceProjects: new Set([SECURITY_PROJECT, TSA_PROJECT]),
      startDate: security.startDate,
      endDate: security.endDate,
      attendees: new Set([...security.attendees, ...tsa.attendees])
    });
  });
  return result;
}

function finalizeSessions(records: LoadRecord[], year: number): TrainingLoadSession[] {
  return mergeSecurityAndTsa(buildSessionDrafts(records))
    .filter((session) => Utils.parseDate(session.startDate)?.getFullYear() === year)
    .map((session) => ({
      projectName: session.projectName,
      sourceProjects: [...session.sourceProjects].sort(),
      startDate: session.startDate,
      endDate: session.endDate,
      attendeeCount: session.attendees.size
    }))
    .sort((left, right) => left.startDate.localeCompare(right.startDate)
      || left.endDate.localeCompare(right.endDate)
      || left.projectName.localeCompare(right.projectName));
}

function addDays(value: Date, days: number): Date {
  return Utils.makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate() + days);
}

function buildLoad(workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis, options: TrainingLoadOptions = {}): TrainingLoadResult {
  const year = normalizeYear(options.year);
  const allRecords = collectRecords(workbook, analysis, options);
  const projects = [...new Set(allRecords.map((record) => record.projectName))];
  const requestedProject = normalizeProjectName(options.projectName);
  const selectedProject = projects.includes(requestedProject) ? requestedProject : "";
  const records = selectedProject ? allRecords.filter((record) => record.projectName === selectedProject) : allRecords;
  const selectedRecords = records.filter((record) => record.start.getFullYear() === year);
  const sessions = finalizeSessions(records, year);
  const monthRows = Array.from({ length: 12 }, (_, index) => ({
    monthKey: `${year}-${String(index + 1).padStart(2, "0")}`,
    personDays: 0,
    sessionCount: 0,
    recordCount: 0
  }));

  const personDayKeys = new Set<string>();
  records.forEach((record) => {
    for (let date = record.start; date <= record.end; date = addDays(date, 1)) {
      if (date.getFullYear() !== year) continue;
      personDayKeys.add(`${record.personKey}|${Utils.formatDate(date)}`);
    }
  });
  personDayKeys.forEach((key) => {
    const month = Number(key.slice(-5, -3));
    if (month >= 1 && month <= 12) monthRows[month - 1].personDays += 1;
  });
  selectedRecords.forEach((record) => {
    monthRows[record.start.getMonth()].recordCount += 1;
  });
  sessions.forEach((session) => {
    const start = Utils.parseDate(session.startDate)!;
    monthRows[start.getMonth()].sessionCount += 1;
  });

  return {
    year,
    selectedProject,
    projects,
    sessions,
    monthRows,
    summary: {
      personDays: monthRows.reduce((sum, row) => sum + row.personDays, 0),
      sessionCount: sessions.length,
      recordCount: selectedRecords.length,
      crmRecordCount: selectedRecords.filter((record) => record.projectName === CRM_PROJECT).length
    }
  };
}

export const TrainingToolTrainingLoad = {
  buildLoad
};
