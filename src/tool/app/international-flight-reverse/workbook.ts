import type * as XLSX from "xlsx-js-style";

import {
  DEFAULT_AIRPORT_REGIONS,
  type AirportRegion,
  type CellValue,
  type DataIssue,
  type EmployeeTask,
  type FlightRecord,
  type ParsedEmployees,
  type ParsedFlights,
  type WorkbookApi
} from "./models";

const EMPLOYEE_HEADERS = ["员工号", "工号", "员工编号"];
const NAME_HEADERS = ["姓名", "员工姓名"];
const REGION_HEADERS = ["地区", "区域"];
const QUALIFICATION_HEADERS = ["资质", "地区", "区域"];
const DATE_HEADERS = ["反推日期", "截止日期", "查询日期"];
const FLIGHT_DATE_HEADERS = ["日期", "航班日期", "飞行日期"];
const DEPARTURE_HEADERS = ["离场", "离场机场", "起飞机场"];
const ARRIVAL_HEADERS = ["到达", "到达机场", "降落机场"];
const FLIGHT_NUMBER_HEADERS = ["航班号", "航班编号", "航班"];
const STAGE_HEADERS = ["飞行阶段", "阶段"];
const AIRPORT_CODE_HEADERS = ["三字码", "机场三字代码", "机场代码"];
const AIRPORT_CODE_PATTERN = /^[A-Z]{3}$/;

function text(value: CellValue): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const REGION_KEYWORDS: Array<{ keyword: string; region: string }> = [
  { keyword: "北美", region: "北美" },
  { keyword: "西亚", region: "西亚" },
  { keyword: "欧洲", region: "欧洲" },
  { keyword: "东南亚", region: "东南亚" }
];

export function normalizeRegionLabel(value: CellValue): string {
  const raw = text(value);
  return REGION_KEYWORDS.find((item) => raw.includes(item.keyword))?.region || raw;
}

export function normalizeEmployeeId(value: CellValue): string {
  if (value === null || value === undefined || value === "") return "";
  let normalized = typeof value === "number" && Number.isInteger(value) ? String(value) : text(value);
  if (/^\d+\.0+$/.test(normalized)) normalized = normalized.replace(/\.0+$/, "");
  if (!/^\d+$/.test(normalized)) return "";
  return normalized.length < 6 ? normalized.padStart(6, "0") : normalized;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

export function normalizeDate(value: CellValue, XLSXApi?: WorkbookApi): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSXApi?.SSF?.parse_date_code?.(value) as { y?: number; m?: number; d?: number } | undefined;
    if (parsed?.y && parsed.m && parsed.d) return formatDate(parsed.y, parsed.m, parsed.d);
    const serialDate = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    if (!Number.isNaN(serialDate.getTime())) return formatDate(serialDate.getUTCFullYear(), serialDate.getUTCMonth() + 1, serialDate.getUTCDate());
    return "";
  }
  const raw = text(value);
  const match = raw.match(/^(\d{4})\s*(?:[-/.年])\s*(\d{1,2})\s*(?:[-/.月])\s*(\d{1,2})\s*日?$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return "";
  return formatDate(year, month, day);
}

function rowsForSheet(XLSXApi: WorkbookApi, sheet: XLSX.WorkSheet): CellValue[][] {
  return XLSXApi.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: "" });
}

function findHeader(
  XLSXApi: WorkbookApi,
  workbook: XLSX.WorkBook,
  requiredGroups: string[][]
): { sheetName: string; rows: CellValue[][]; headerIndex: number; headers: string[] } | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = rowsForSheet(XLSXApi, sheet);
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 100); rowIndex += 1) {
      const headers = (rows[rowIndex] || []).map(text);
      if (requiredGroups.every((group) => group.some((candidate) => headers.includes(candidate)))) {
        return { sheetName, rows, headerIndex: rowIndex, headers };
      }
    }
  }
  return null;
}

function findColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

function cloneRegions(regions: AirportRegion[]): AirportRegion[] {
  return regions.map((item) => ({ region: item.region, codes: [...item.codes] }));
}

function parseAirportCodeList(value: CellValue): { codes: string[]; invalid: string[] } {
  const tokens = text(value).split(/[\s,，、;；|/]+/).filter(Boolean);
  const codes: string[] = [];
  const invalid: string[] = [];
  tokens.forEach((token) => {
    const code = token.toUpperCase();
    if (AIRPORT_CODE_PATTERN.test(code)) {
      if (!codes.includes(code)) codes.push(code);
    } else {
      invalid.push(token);
    }
  });
  return { codes, invalid };
}

export function parseAirportRegions(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook): { regions: AirportRegion[]; issues: DataIssue[]; found: boolean } {
  const issues: DataIssue[] = [];
  const found = findHeader(XLSXApi, workbook, [REGION_HEADERS, AIRPORT_CODE_HEADERS]);
  if (!found) return { regions: cloneRegions(DEFAULT_AIRPORT_REGIONS), issues, found: false };
  const regionIndex = findColumn(found.headers, REGION_HEADERS);
  const codeIndex = findColumn(found.headers, AIRPORT_CODE_HEADERS);
  const byRegion = new Map<string, string[]>();
  for (let index = found.headerIndex + 1; index < found.rows.length; index += 1) {
    const row = found.rows[index] || [];
    const region = normalizeRegionLabel(row[regionIndex]);
    const rawCodes = row[codeIndex];
    if (!region && !text(rawCodes)) continue;
    const parsed = parseAirportCodeList(rawCodes);
    if (!region) {
      issues.push({ source: "机场配置", kind: "invalid-config", message: "机场配置缺少地区。", sheetName: found.sheetName, rowNumber: index + 1 });
      continue;
    }
    if (parsed.invalid.length) {
      issues.push({ source: "机场配置", kind: "invalid-airport-code", message: `机场配置包含无效三字码：${parsed.invalid.join("、")}`, sheetName: found.sheetName, rowNumber: index + 1, region });
    }
    const existing = byRegion.get(region) || [];
    parsed.codes.forEach((code) => { if (!existing.includes(code)) existing.push(code); });
    byRegion.set(region, existing);
  }
  const regions = [...byRegion.entries()].filter(([, codes]) => codes.length > 0).map(([region, codes]) => ({ region, codes }));
  return { regions: regions.length ? regions : cloneRegions(DEFAULT_AIRPORT_REGIONS), issues, found: true };
}

export function parseEmployeeWorkbook(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook): ParsedEmployees {
  const issues: DataIssue[] = [];
  const found = findHeader(XLSXApi, workbook, [EMPLOYEE_HEADERS, NAME_HEADERS, QUALIFICATION_HEADERS, DATE_HEADERS]);
  if (!found) throw new Error("未找到临期资质表：需要包含员工号、姓名、资质和反推日期表头。");
  const employeeIndex = findColumn(found.headers, EMPLOYEE_HEADERS);
  const nameIndex = findColumn(found.headers, NAME_HEADERS);
  const regionIndex = findColumn(found.headers, QUALIFICATION_HEADERS);
  const dateIndex = findColumn(found.headers, DATE_HEADERS);
  const tasks: EmployeeTask[] = [];
  const seen = new Set<string>();
  for (let index = found.headerIndex + 1; index < found.rows.length; index += 1) {
    const row = found.rows[index] || [];
    if (!row.some((value) => text(value))) continue;
    const rowNumber = index + 1;
    const employeeId = normalizeEmployeeId(row[employeeIndex]);
    const name = text(row[nameIndex]);
    const qualification = text(row[regionIndex]);
    const region = normalizeRegionLabel(qualification);
    const reverseDate = normalizeDate(row[dateIndex], XLSXApi);
    if (!employeeId) issues.push({ source: "临期资质表", kind: "invalid-employee-id", message: "员工号为空或不是数字。", sheetName: found.sheetName, rowNumber });
    if (!reverseDate) issues.push({ source: "临期资质表", kind: "invalid-date", message: "反推日期格式无效。", sheetName: found.sheetName, rowNumber, employeeId, region });
    if (!employeeId || !reverseDate) continue;
    const taskKey = `${employeeId}\u0000${qualification}\u0000${reverseDate}`;
    if (seen.has(taskKey)) {
      issues.push({ source: "临期资质表", kind: "duplicate-task", message: "员工号、资质和反推日期重复。", sheetName: found.sheetName, rowNumber, employeeId, region });
      continue;
    }
    seen.add(taskKey);
    tasks.push({ employeeId, name, qualification, region, reverseDate, sourceSheet: found.sheetName, sourceRow: rowNumber });
  }
  const airport = parseAirportRegions(XLSXApi, workbook);
  issues.push(...airport.issues);
  return { sheetName: found.sheetName, headerRowNumber: found.headerIndex + 1, tasks, airportRegions: airport.regions, issues };
}

export function parseFlightWorkbook(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook): ParsedFlights {
  const issues: DataIssue[] = [];
  const found = findHeader(XLSXApi, workbook, [EMPLOYEE_HEADERS, FLIGHT_DATE_HEADERS, DEPARTURE_HEADERS, ARRIVAL_HEADERS]);
  if (!found) throw new Error("未找到航班明细表：需要包含员工号、日期、离场和到达表头。");
  const employeeIndex = findColumn(found.headers, EMPLOYEE_HEADERS);
  const dateIndex = findColumn(found.headers, FLIGHT_DATE_HEADERS);
  const departureIndex = findColumn(found.headers, DEPARTURE_HEADERS);
  const arrivalIndex = findColumn(found.headers, ARRIVAL_HEADERS);
  const nameIndex = findColumn(found.headers, NAME_HEADERS);
  const flightNumberIndex = findColumn(found.headers, FLIGHT_NUMBER_HEADERS);
  const stageIndex = findColumn(found.headers, STAGE_HEADERS);
  const flights: FlightRecord[] = [];
  for (let index = found.headerIndex + 1; index < found.rows.length; index += 1) {
    const row = found.rows[index] || [];
    if (!row.some((value) => text(value))) continue;
    const rowNumber = index + 1;
    const employeeId = normalizeEmployeeId(row[employeeIndex]);
    const date = normalizeDate(row[dateIndex], XLSXApi);
    const departure = text(row[departureIndex]).toUpperCase();
    const arrival = text(row[arrivalIndex]).toUpperCase();
    if (!employeeId) issues.push({ source: "航班明细", kind: "invalid-employee-id", message: "航班行员工号为空或不是数字。", sheetName: found.sheetName, rowNumber });
    if (!date) issues.push({ source: "航班明细", kind: "invalid-date", message: "航班日期格式无效。", sheetName: found.sheetName, rowNumber, employeeId });
    if (!AIRPORT_CODE_PATTERN.test(departure) || !AIRPORT_CODE_PATTERN.test(arrival)) {
      issues.push({ source: "航班明细", kind: "invalid-airport-code", message: "离场或到达不是三位机场代码。", sheetName: found.sheetName, rowNumber, employeeId });
    }
    if (!employeeId || !date || !AIRPORT_CODE_PATTERN.test(departure) || !AIRPORT_CODE_PATTERN.test(arrival)) continue;
    flights.push({ employeeId, name: text(row[nameIndex]), date, flightNumber: text(row[flightNumberIndex]), departure, arrival, stage: text(row[stageIndex]), sourceSheet: found.sheetName, sourceRow: rowNumber });
  }
  return { sheetName: found.sheetName, headerRowNumber: found.headerIndex + 1, flights, issues };
}
