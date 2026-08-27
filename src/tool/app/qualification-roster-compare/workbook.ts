import type * as XLSX from "xlsx-js-style";
import type {
  ParsedQualificationSource,
  PersonnelRole,
  QualificationIssue,
  QualificationRecord,
  QualificationSourceType
} from "./models";

type Cell = string | number | boolean | Date | null | undefined;
type WorkbookApi = typeof XLSX;
const CODE_PATTERN = /^[A-Z]{4}$/;

function text(value: Cell): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function normalizeEmployeeId(value: Cell): string {
  const valueText = text(value);
  if (!valueText) return "";
  return /^\d+\.0+$/.test(valueText) ? valueText.replace(/\.0+$/, "") : valueText;
}

function rowsForSheet(XLSXApi: WorkbookApi, sheet: XLSX.WorkSheet): Cell[][] {
  return XLSXApi.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: "" });
}

function findHeader(
  XLSXApi: WorkbookApi,
  workbook: XLSX.WorkBook,
  required: string[],
  acceptHeaders?: (headers: string[]) => boolean
): { sheetName: string; rows: Cell[][]; headerIndex: number; headers: string[] } | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = rowsForSheet(XLSXApi, sheet);
    const maxRows = Math.min(rows.length, 100);
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex += 1) {
      const headers = (rows[rowIndex] || []).map(text);
      if (required.every((item) => headers.some((header) => header === item)) && (!acceptHeaders || acceptHeaders(headers))) {
        return { sheetName, rows, headerIndex: rowIndex, headers };
      }
    }
  }
  return null;
}

function issue(
  source: QualificationSourceType,
  sheetName: string,
  kind: QualificationIssue["kind"],
  message: string,
  rowNumber?: number,
  employeeId?: string,
  qualificationCode?: string
): QualificationIssue {
  return { source, sheetName, kind, message, rowNumber, employeeId, qualificationCode };
}

function columnIndex(headers: string[], name: string): number {
  return headers.findIndex((header) => header === name);
}

export function parsePersonnelWorkbook(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook): ParsedQualificationSource {
  const found = findHeader(XLSXApi, workbook, ["员工号", "姓名"], (headers) => headers.some((header) => CODE_PATTERN.test(header)));
  if (!found) throw new Error("未找到人员信息表：需要包含“员工号”和“姓名”表头。");
  const employeeIndex = columnIndex(found.headers, "员工号");
  const nameIndex = columnIndex(found.headers, "姓名");
  const qualificationCodes = found.headers.filter((header) => CODE_PATTERN.test(header));
  const issues: QualificationIssue[] = [];
  const records: QualificationRecord[] = [];
  const seen = new Set<string>();
  for (let index = found.headerIndex + 1; index < found.rows.length; index += 1) {
    const row = found.rows[index] || [];
    const employeeId = normalizeEmployeeId(row[employeeIndex]);
    const name = text(row[nameIndex]);
    if (!employeeId && !name) continue;
    const rowNumber = index + 1;
    if (!employeeId) issues.push(issue("personnel", found.sheetName, "missing-employee-id", "人员信息缺少员工号。", rowNumber));
    if (!name) issues.push(issue("personnel", found.sheetName, "missing-name", "人员信息缺少姓名。", rowNumber, employeeId));
    if (!employeeId || !name) continue;
    for (const qualificationCode of qualificationCodes) {
      const value = text(row[found.headers.indexOf(qualificationCode)]);
      if (!value) continue;
      let personnelRole: PersonnelRole = value === "1" ? "机长" : value === "2" ? "副驾驶" : "";
      if (!personnelRole) {
        issues.push(issue("personnel", found.sheetName, "invalid-role", `资质 ${qualificationCode} 的角色值“${value}”无效。`, rowNumber, employeeId, qualificationCode));
        continue;
      }
      const relationKey = `${qualificationCode}\u0000${employeeId}`;
      if (seen.has(relationKey)) {
        issues.push(issue("personnel", found.sheetName, "duplicate-qualification", `人员信息重复记录 ${employeeId} / ${qualificationCode}。`, rowNumber, employeeId, qualificationCode));
        continue;
      }
      seen.add(relationKey);
      records.push({ source: "personnel", employeeId, name, qualificationCode, personnelRole, sheetName: found.sheetName, rowNumber });
    }
  }
  return { source: "personnel", sheetName: found.sheetName, headerRowNumber: found.headerIndex + 1, qualificationCodes, records, issues };
}

export function parsePortalWorkbook(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook): ParsedQualificationSource {
  const found = findHeader(XLSXApi, workbook, ["员工号", "姓名", "资质类别"]);
  if (!found) throw new Error("未找到飞行门户资质名册：需要包含“员工号”“姓名”和“资质类别”表头。");
  const employeeIndex = columnIndex(found.headers, "员工号");
  const nameIndex = columnIndex(found.headers, "姓名");
  const qualificationIndex = columnIndex(found.headers, "资质类别");
  const issues: QualificationIssue[] = [];
  const records: QualificationRecord[] = [];
  const qualificationCodes: string[] = [];
  const seen = new Set<string>();
  for (let index = found.headerIndex + 1; index < found.rows.length; index += 1) {
    const row = found.rows[index] || [];
    const employeeId = normalizeEmployeeId(row[employeeIndex]);
    const name = text(row[nameIndex]);
    const qualificationCode = text(row[qualificationIndex]).toUpperCase();
    if (!employeeId && !name && !qualificationCode) continue;
    const rowNumber = index + 1;
    if (!employeeId) issues.push(issue("portal", found.sheetName, "missing-employee-id", "门户名册缺少员工号。", rowNumber));
    if (!name) issues.push(issue("portal", found.sheetName, "missing-name", "门户名册缺少姓名。", rowNumber, employeeId));
    if (!CODE_PATTERN.test(qualificationCode)) {
      issues.push(issue("portal", found.sheetName, "invalid-qualification-code", `资质类别“${qualificationCode || "空白"}”不是四位资质代码。`, rowNumber, employeeId, qualificationCode || undefined));
      continue;
    }
    if (!employeeId || !name) continue;
    if (!qualificationCodes.includes(qualificationCode)) qualificationCodes.push(qualificationCode);
    const relationKey = `${qualificationCode}\u0000${employeeId}`;
    if (seen.has(relationKey)) {
      issues.push(issue("portal", found.sheetName, "duplicate-qualification", `门户名册重复记录 ${employeeId} / ${qualificationCode}。`, rowNumber, employeeId, qualificationCode));
      continue;
    }
    seen.add(relationKey);
    records.push({ source: "portal", employeeId, name, qualificationCode, personnelRole: "", sheetName: found.sheetName, rowNumber });
  }
  return { source: "portal", sheetName: found.sheetName, headerRowNumber: found.headerIndex + 1, qualificationCodes, records, issues };
}
