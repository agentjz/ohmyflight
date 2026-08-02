import { TrainingToolCrmInstructors } from "./crm-instructors";
import { TrainingToolTrainingRecordPolicy } from "./training-record-policy";
import { TrainingToolUtils } from "./utils";
import type {
  TrainingToolAnalysis,
  TrainingToolSheetInfo,
  TrainingToolSheetRow,
  TrainingToolWorkbook
} from "./models";

const Utils = TrainingToolUtils;
  const TrainingRecordPolicy = TrainingToolTrainingRecordPolicy;
  const CrmInstructors = TrainingToolCrmInstructors;

  const CRM_SHEET_NAME = "CRM";
  const ROLE_ORDER = ["教员", "机长", "副驾驶", "未识别"];

  export interface CrmPersonBasics {
    employeeId: string;
    name: string;
    department: string;
    techInfo: string;
    operation: string;
    remark: string;
  }

  export interface CrmRecord {
    employeeId: string;
    name: string;
    key: string;
    trainingDate: Date | null;
    trainingDateText: string;
    instructor: string;
    remark: string;
    rowNumber: number;
    active: boolean;
  }

  export interface CrmDuplicateRow {
    employeeId: string;
    name: string;
    department: string;
    techInfo: string;
    count: number;
    records: CrmRecord[];
    rowNumbers: number[];
    dates: string[];
    instructors: string[];
  }

  export interface CrmRoleRow {
    role: string;
    required: number;
    attended: number;
    missing: number;
    attendedRate: number;
  }

  export interface CrmAnnualResult {
    year: number;
    hasCrmSheet: boolean;
    requiredPeople: CrmPersonBasics[];
    attendedPeople: CrmPersonBasics[];
    missingPeople: CrmPersonBasics[];
    records: CrmRecord[];
    participationRows: Array<{ name: string; value: number; kind: string }>;
    monthlyRows: Array<{ label: string; count: number; kind: string }>;
    roleRows: CrmRoleRow[];
    duplicateRows: CrmDuplicateRow[];
    stats: { required: number; attended: number; missing: number; instructors: number; duplicates: number };
  }

  type TrainingScanner = Pick<typeof import("./scanner").TrainingToolScanner, "readSheetInfo">;

  function normalizeYear(value: unknown): number {
    const text = Utils.normalizeText(value);
    const year = Number(text);
    return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
  }

  function getCurrentYear(): number {
    return new Date().getFullYear();
  }

  function getPersonBasics(row: TrainingToolSheetRow, peopleInfo: TrainingToolSheetInfo): CrmPersonBasics {
    return {
      employeeId: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "员工号")),
      name: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "姓名")),
      department: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "分部")),
      techInfo: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "技术信息")),
      operation: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "是否运行")),
      remark: Utils.normalizeText(Utils.getValueByHeader(row, peopleInfo, "备注"))
    };
  }

  function classifyRole(techInfo: unknown): string {
    const text = Utils.normalizeText(techInfo);
    if (text.includes("飞行教员") || text.includes("教员")) return "教员";
    if (text.includes("机长")) return "机长";
    if (text.includes("副驾驶")) return "副驾驶";
    return "未识别";
  }

  function buildInstructorSet(): Set<string> {
    return new Set((CrmInstructors.names || []).map((name) => Utils.normalizeText(name)).filter(Boolean));
  }

  function buildRequiredPeople(analysis: TrainingToolAnalysis | null): CrmPersonBasics[] {
    if (!analysis || !analysis.peopleInfo || !analysis.peopleInfo.rows) return [];
    const instructorSet = buildInstructorSet();
    return analysis.peopleInfo.rows
      .map((row) => getPersonBasics(row, analysis.peopleInfo))
      .filter((person) => person.employeeId || person.name)
      .filter((person) => !instructorSet.has(person.name));
  }

  function getCrmSheetInfo(workbook: TrainingToolWorkbook | null, scanner: TrainingScanner): TrainingToolSheetInfo | null {
    if (!workbook || !workbook.Sheets || !workbook.Sheets[CRM_SHEET_NAME]) return null;
    return scanner.readSheetInfo(workbook, CRM_SHEET_NAME);
  }

  function getTrainingDate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): Date | null {
    return Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训开始日期"))
      || Utils.parseDate(Utils.getValueByHeader(row, sheetInfo, "培训结束日期"));
  }

  function dateBelongsToYear(dateValue: Date | null, year: number): boolean {
    return Boolean(dateValue) && dateValue!.getFullYear() === year;
  }

  function collectPersonKeys(person: { employeeId?: string; name?: string }): string[] {
    return [person.employeeId, person.name].map((value) => Utils.normalizeText(value)).filter(Boolean);
  }

  function buildCrmRecord(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): CrmRecord {
    const trainingDate = getTrainingDate(row, sheetInfo);
    const name = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "姓名"));
    const employeeId = Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "员工号"));
    return {
      employeeId,
      name,
      key: employeeId || name,
      trainingDate,
      trainingDateText: Utils.formatDate(trainingDate),
      instructor: Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "教员")),
      remark: Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, "备注")),
      rowNumber: row.rowNumber,
      active: TrainingRecordPolicy.classify(row, sheetInfo).active
    };
  }

  function buildValidRecords(sheetInfo: TrainingToolSheetInfo | null, year: number): CrmRecord[] {
    if (!sheetInfo || !sheetInfo.rows) return [];
    return sheetInfo.rows
      .map((row) => buildCrmRecord(row, sheetInfo))
      .filter((record) => record.active)
      .filter((record) => record.key)
      .filter((record) => dateBelongsToYear(record.trainingDate, year));
  }

  function buildParticipationRows(attendedCount: number, missingCount: number): Array<{ name: string; value: number; kind: string }> {
    return [
      { name: "已参加", value: attendedCount, kind: "attended" },
      { name: "未参加", value: missingCount, kind: "missing" }
    ];
  }

  function findEarliestRecordForPerson(person: CrmPersonBasics, records: CrmRecord[]): CrmRecord | null {
    const keys = new Set(collectPersonKeys(person));
    return (records || [])
      .filter((record) => collectPersonKeys(record).some((key) => keys.has(key)))
      .sort((left, right) => (left.trainingDate as unknown as number) - (right.trainingDate as unknown as number))[0] || null;
  }

  function findRecordsForPerson(person: CrmPersonBasics, records: CrmRecord[]): CrmRecord[] {
    const keys = new Set(collectPersonKeys(person));
    return (records || [])
      .filter((record) => collectPersonKeys(record).some((key) => keys.has(key)))
      .sort((left, right) => {
        const leftTime = left.trainingDate ? left.trainingDate.getTime() : 0;
        const rightTime = right.trainingDate ? right.trainingDate.getTime() : 0;
        return leftTime - rightTime || left.rowNumber - right.rowNumber;
      });
  }

  function buildDuplicateRows(requiredPeople: CrmPersonBasics[], records: CrmRecord[]): CrmDuplicateRow[] {
    const peopleByKey = new Map<string, CrmPersonBasics>();
    (requiredPeople || []).forEach((person) => {
      collectPersonKeys(person).forEach((key) => {
        if (!peopleByKey.has(key)) {
          peopleByKey.set(key, person);
        }
      });
    });

    const recordGroups = new Map<string, CrmRecord[]>();
    (records || []).forEach((record) => {
      const key = record.employeeId || record.name;
      if (!key) return;
      const bucket = recordGroups.get(key) || [];
      bucket.push(record);
      recordGroups.set(key, bucket);
    });

    return [...recordGroups.entries()]
      .map(([key, personRecords]) => {
        const person = (peopleByKey.get(key) || personRecords[0]!) as CrmPersonBasics;
        const sortedRecords = [...personRecords].sort((left, right) => {
          const leftTime = left.trainingDate ? left.trainingDate.getTime() : 0;
          const rightTime = right.trainingDate ? right.trainingDate.getTime() : 0;
          return leftTime - rightTime || left.rowNumber - right.rowNumber;
        });
        return {
          employeeId: person.employeeId || personRecords[0]!.employeeId,
          name: person.name || personRecords[0]!.name,
          department: person.department || "",
          techInfo: person.techInfo || "",
          count: sortedRecords.length,
          records: sortedRecords,
          rowNumbers: sortedRecords.map((record) => record.rowNumber),
          dates: [...new Set(sortedRecords.map((record) => record.trainingDateText).filter(Boolean))],
          instructors: [...new Set(sortedRecords.map((record) => record.instructor).filter(Boolean))]
        };
      })
      .filter((row) => row.count > 1)
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-Hans-CN"));
  }

  function buildMonthlyRows(records: CrmRecord[], missingCount: number, attendedPeople: CrmPersonBasics[] = []): Array<{ label: string; count: number; kind: string }> {
    const monthlyCounts = Array.from({ length: 12 }, (_, index) => ({
      label: `${index + 1}月`,
      count: 0,
      kind: "attended"
    }));

    attendedPeople.forEach((person) => {
      const record = findEarliestRecordForPerson(person, records);
      if (!record!.trainingDate) return;
      const index = record!.trainingDate.getMonth();
      if (index >= 0 && index < 12) {
        monthlyCounts[index].count += 1;
      }
    });

    return [
      ...monthlyCounts,
      { label: "未参加", count: missingCount, kind: "missing" }
    ];
  }

  function buildRoleRows(requiredPeople: CrmPersonBasics[], attendedPeople: CrmPersonBasics[], missingPeople: CrmPersonBasics[]): CrmRoleRow[] {
    const attendedKeys = new Set(attendedPeople.flatMap((person) => collectPersonKeys(person)));
    const missingKeys = new Set(missingPeople.flatMap((person) => collectPersonKeys(person)));
    const roleMap = new Map<string, CrmRoleRow>(ROLE_ORDER.map((role) => [role, {
      role,
      required: 0,
      attended: 0,
      missing: 0,
      attendedRate: 0
    }]));

    requiredPeople.forEach((person) => {
      const role = classifyRole(person.techInfo);
      const item = roleMap.get(role) || roleMap.get("未识别");
      if (!item) return;
      const keys = collectPersonKeys(person);
      item.required += 1;
      if (keys.some((key) => attendedKeys.has(key))) {
        item.attended += 1;
      } else if (keys.some((key) => missingKeys.has(key))) {
        item.missing += 1;
      }
    });

    roleMap.forEach((item) => {
      item.missing = item.required - item.attended;
      item.attendedRate = item.required ? item.attended / item.required : 0;
    });

    return ROLE_ORDER.map((role) => roleMap.get(role)!);
  }

  function buildAnnualCheck(workbook: TrainingToolWorkbook | null, analysis: TrainingToolAnalysis | null, scanner: TrainingScanner, yearValue: unknown): CrmAnnualResult {
    const year = normalizeYear(yearValue || getCurrentYear());
    const crmSheet = getCrmSheetInfo(workbook, scanner);
    const requiredPeople = buildRequiredPeople(analysis);
    const records = buildValidRecords(crmSheet, year);
    const attendedKeys = new Set(records.flatMap((record) => collectPersonKeys(record)));
    const hasAttended = (person: CrmPersonBasics): boolean => collectPersonKeys(person).some((key) => attendedKeys.has(key));
    const attendedPeople = requiredPeople.filter(hasAttended);
    const missingPeople = requiredPeople.filter((person) => !hasAttended(person));
    const participationRows = buildParticipationRows(attendedPeople.length, missingPeople.length);
    const monthlyRows = buildMonthlyRows(records, missingPeople.length, attendedPeople);
    const roleRows = buildRoleRows(requiredPeople, attendedPeople, missingPeople);
    const duplicateRows = buildDuplicateRows(requiredPeople, records);

    return {
      year,
      hasCrmSheet: Boolean(crmSheet),
      requiredPeople,
      attendedPeople,
      missingPeople,
      records,
      participationRows,
      monthlyRows,
      roleRows,
      duplicateRows,
      stats: {
        required: requiredPeople.length,
        attended: attendedPeople.length,
        missing: missingPeople.length,
        instructors: buildInstructorSet().size,
        duplicates: duplicateRows.length
      }
    };
  }
  export const TrainingToolCrmAnnual = {
    CRM_SHEET_NAME,
    normalizeYear,
    classifyRole,
    buildRequiredPeople,
    buildValidRecords,
    buildDuplicateRows,
    buildParticipationRows,
    buildMonthlyRows,
    buildRoleRows,
    buildAnnualCheck
  };
