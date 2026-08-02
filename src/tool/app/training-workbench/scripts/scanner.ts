import { TrainingToolConfig } from "./config";
import { getTrainingXlsx } from "./browser-vendors";
import type {
  TrainingProjectRule,
  TrainingToolAnalysis,
  TrainingToolPeopleIndex,
  TrainingToolPeopleInfo,
  TrainingToolPendingSession,
  TrainingToolProjectAnalysis,
  TrainingToolSheetInfo,
  TrainingToolSheetRow,
  TrainingToolWorkbook,
  TrainingToolWorksheet
} from "./models";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";

const Config = TrainingToolConfig;
  const Utils = TrainingToolUtils;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;

  function readWorkbookFile(file: File): Promise<TrainingToolWorkbook> {
    const XLSX = getTrainingXlsx();
    if (!XLSX) {
      throw new Error("未加载 XLSX 库，无法读取 Excel 文件。");
    }
    return file.arrayBuffer().then((buffer) => XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      cellFormula: true,
      cellNF: true,
      cellStyles: true
    }));
  }

  function sheetToMatrix(sheet: TrainingToolWorksheet): TrainingToolSheetRow["cells"][] {
    const XLSX = getTrainingXlsx();
    if (!XLSX) throw new Error("未加载 XLSX 库，无法读取 Excel 文件。");
    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false
    }) as TrainingToolSheetRow["cells"][];
  }

  function readSheetInfo(workbook: TrainingToolWorkbook, sheetName: string): TrainingToolSheetInfo {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`未找到工作表：${sheetName}`);
    }

    const matrix = sheetToMatrix(sheet);
    const headers = (matrix[0] || []).map((item) => Utils.normalizeText(item));
    const headerMap = Utils.buildHeaderMap(headers);
    const rows = matrix.slice(1)
      .map((cells, index) => ({
        rowNumber: index + 2,
        cells: [...cells]
      }))
      .filter((row) => row.cells.some((value) => Utils.hasMeaningfulValue(value)));

    return {
      name: sheetName,
      sheet,
      matrix,
      headers,
      headerMap,
      rows
    };
  }

  function findSheetName(workbook: TrainingToolWorkbook, candidates: string[]): string {
    const normalizedCandidates = new Set(
      candidates
        .map((name) => Utils.normalizeText(name).replace(/\s+/g, ""))
        .filter(Boolean)
    );

    for (const sheetName of workbook.SheetNames) {
      const normalizedSheetName = Utils.normalizeText(sheetName).replace(/\s+/g, "");
      if (normalizedCandidates.has(normalizedSheetName)) {
        return sheetName;
      }
    }
    return "";
  }

  function resolvePeopleSheetName(workbook: TrainingToolWorkbook): string {
    if (workbook.Sheets[Config.PEOPLE_SHEET_NAME]) {
      return Config.PEOPLE_SHEET_NAME;
    }

    for (const sheetName of workbook.SheetNames) {
      if (Config.IGNORED_SHEET_NAMES.has(sheetName)) continue;
      const info = readSheetInfo(workbook, sheetName);
      const hasRequiredHeaders = Config.REQUIRED_PEOPLE_HEADERS.every(
        (header) => info.headerMap.has(header)
      );
      if (hasRequiredHeaders) {
        return sheetName;
      }
    }

    throw new Error("未识别到人员信息表，至少需要包含“员工号”和“姓名”表头。");
  }

  function ensureRequiredHeaders(sheetInfo: TrainingToolSheetInfo, requiredHeaders: string[], label: string): void {
    const missing = requiredHeaders.filter((header) => !sheetInfo.headerMap.has(header));
    if (missing.length) {
      throw new Error(`${label}缺少必要表头：${missing.join("、")}。`);
    }
  }

  function extractMonthKeys(sheetInfo: TrainingToolSheetInfo): string[] {
    const months = new Set<string>();
    sheetInfo.rows.forEach((row) => {
      const startMonth = Utils.toMonthKey(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"));
      const endMonth = Utils.toMonthKey(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
      if (startMonth) months.add(startMonth);
      else if (endMonth) months.add(endMonth);
    });
    return Utils.sortMonthKeys([...months]);
  }

  function buildPeopleIndex(peopleInfo: TrainingToolPeopleInfo): TrainingToolPeopleIndex {
    const byName = new Map<string, number[]>();
    const byId = new Map<string, number[]>();
    const nameIndex = Utils.findHeaderIndex(peopleInfo, "姓名");
    const employeeIndex = Utils.findHeaderIndex(peopleInfo, "员工号");

    peopleInfo.rows.forEach((row, index) => {
      const name = Utils.normalizeText(row.cells[nameIndex]);
      const employeeId = Utils.normalizeText(row.cells[employeeIndex]);

      if (name) {
        const current = byName.get(name) || [];
        current.push(index);
        byName.set(name, current);
      }

      if (employeeId) {
        const current = byId.get(employeeId) || [];
        current.push(index);
        byId.set(employeeId, current);
      }
    });

    return {
      employeeColumnIndex: employeeIndex,
      nameColumnIndex: nameIndex,
      byName,
      byId
    };
  }

  function createSheetSlice(sheetInfo: TrainingToolSheetInfo, rows: TrainingToolSheetRow[]): TrainingToolSheetInfo {
    const sampleRowNumber = rows.length
      ? rows[0].rowNumber
      : (sheetInfo.rows.length ? sheetInfo.rows[0].rowNumber : 2);

    return {
      ...sheetInfo,
      rows,
      sampleRowNumber
    };
  }

  function splitProjectRowsByRecordedStatus(sheetInfo: TrainingToolSheetInfo): {
    recordedRows: TrainingToolSheetRow[];
    pendingRows: TrainingToolSheetRow[];
    validityUpdateRows: TrainingToolSheetRow[];
  } {
    const recordedRows: TrainingToolSheetRow[] = [];
    const pendingRows: TrainingToolSheetRow[] = [];
    const validityUpdateRows: TrainingToolSheetRow[] = [];

    sheetInfo.rows.forEach((row) => {
      const recordState = TrainingRecordPolicy.classify(row, sheetInfo);
      const validityState = TrainingRecordPolicy.classifyForValidityUpdate(row, sheetInfo);

      if (validityState.markedForUpdate) {
        validityUpdateRows.push(row);
      }

      if (recordState.recorded) {
        recordedRows.push(row);
        return;
      }
      if (!recordState.active) {
        return;
      }
      pendingRows.push(row);
    });

    return { recordedRows, pendingRows, validityUpdateRows };
  }

  function collectPendingDefaults(rows: TrainingToolSheetRow[], sheetInfo: TrainingToolSheetInfo): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    rows.forEach((row) => {
      sheetInfo.headers.forEach((header) => {
        if (!header || Config.DYNAMIC_SCHEDULE_HEADERS.has(header)) return;
        if (Utils.hasMeaningfulValue(defaults[header])) return;
        const value = Utils.getValueByHeader(row, sheetInfo, header);
        if (!Utils.hasMeaningfulValue(value)) return;
        defaults[header] = value;
      });
    });
    return defaults;
  }

  function buildPendingDefaultsByMonth(pendingInfo: TrainingToolSheetInfo): Map<string, Record<string, unknown>> {
    const grouped = new Map<string, TrainingToolSheetRow[]>();
    pendingInfo.rows.forEach((row) => {
      const monthKey = Utils.toMonthKey(
        Utils.getValueByHeader(row, pendingInfo, "培训开始日期")
        || Utils.getValueByHeader(row, pendingInfo, "培训结束日期")
      );
      if (!monthKey) return;
      const bucket = grouped.get(monthKey) || [];
      bucket.push(row);
      grouped.set(monthKey, bucket);
    });

    const result = new Map<string, Record<string, unknown>>();
    grouped.forEach((rows, monthKey) => {
      result.set(monthKey, collectPendingDefaults(rows, pendingInfo));
    });
    return result;
  }

  function buildPendingSessionsByMonth(pendingInfo: TrainingToolSheetInfo): Map<string, TrainingToolPendingSession[]> {
    const sessions = new Map<string, TrainingToolPendingSession[]>();
    pendingInfo.rows.forEach((row) => {
      const startDate = Utils.parseDate(Utils.getValueByHeader(row, pendingInfo, "培训开始日期"));
      const endDate = Utils.parseDate(Utils.getValueByHeader(row, pendingInfo, "培训结束日期"));
      const monthKey = Utils.toMonthKey(startDate || endDate);
      if (!monthKey) return;

      const key = `${Utils.formatDate(startDate)}|${Utils.formatDate(endDate)}`;
      const bucket = sessions.get(monthKey) || [];
      if (!bucket.some((item) => item.key === key)) {
        bucket.push({
          key,
          startDate,
          endDate
        });
      }
      sessions.set(monthKey, bucket);
    });
    return sessions;
  }

  function buildProjectInfo(workbook: TrainingToolWorkbook, peopleInfo: TrainingToolPeopleInfo, rule: TrainingProjectRule): TrainingToolProjectAnalysis | null {
    const peopleColumnIndex = peopleInfo.headers.findIndex(
      (header) => Utils.normalizeProjectName(header) === rule.canonical
    );
    const sheetName = findSheetName(workbook, [rule.canonical, ...rule.aliases]);

    if (!sheetName) {
      return null;
    }

    const sheetInfo = readSheetInfo(workbook, sheetName);
    ensureRequiredHeaders(sheetInfo, Config.REQUIRED_PROJECT_HEADERS, `${rule.canonical}项目 sheet`);

    const { recordedRows, pendingRows, validityUpdateRows } = splitProjectRowsByRecordedStatus(sheetInfo);
    const recordedInfo = createSheetSlice(sheetInfo, recordedRows);
    const pendingInfo = createSheetSlice(sheetInfo, pendingRows);
    const validityUpdateInfo = createSheetSlice(sheetInfo, validityUpdateRows);
    const recordedMonths = extractMonthKeys(recordedInfo);
    const pendingMonths = extractMonthKeys(pendingInfo);
    const validityUpdateMonths = extractMonthKeys(validityUpdateInfo);

    return {
      canonical: rule.canonical,
      rule,
      peopleColumnIndex,
      peopleHeader: peopleColumnIndex >= 0 ? peopleInfo.headers[peopleColumnIndex] : "",
      sheetName,
      sheetInfo,
      recordedInfo,
      pendingInfo,
      validityUpdateInfo,
      recordedRowCount: recordedRows.length,
      pendingRowCount: pendingRows.length,
      validityUpdateRowCount: validityUpdateRows.length,
      recordedMonths,
      pendingMonths,
      validityUpdateMonths,
      availableMonths: Utils.sortMonthKeys([...recordedMonths, ...pendingMonths]),
      pendingDefaultsByMonth: buildPendingDefaultsByMonth(pendingInfo),
      pendingGlobalDefaults: collectPendingDefaults(pendingInfo.rows, pendingInfo),
      pendingSessionsByMonth: buildPendingSessionsByMonth(pendingInfo)
    };
  }

  function analyzeWorkbook(workbook: TrainingToolWorkbook): TrainingToolAnalysis {
    const peopleSheetName = resolvePeopleSheetName(workbook);
    const peopleInfo = readSheetInfo(workbook, peopleSheetName) as TrainingToolPeopleInfo;
    ensureRequiredHeaders(peopleInfo, Config.REQUIRED_PEOPLE_HEADERS, "人员信息表");

    const peopleIndex = buildPeopleIndex(peopleInfo);
    const projects = Config.PROJECT_RULES
      .map((rule) => buildProjectInfo(workbook, peopleInfo, rule))
      .filter((project): project is TrainingToolProjectAnalysis => project !== null);

    const projectMap = new Map(projects.map((project) => [project.canonical, project]));
    const availableMonths = Utils.sortMonthKeys(projects.flatMap((project) => project.availableMonths));

    return {
      peopleInfo,
      peopleIndex,
      projects,
      projectMap,
      availableMonths,
      sheetNames: [...workbook.SheetNames]
    };
  }
  export const TrainingToolScanner = {
    readWorkbookFile,
    readSheetInfo,
    findSheetName,
    resolvePeopleSheetName,
    analyzeWorkbook
  };
