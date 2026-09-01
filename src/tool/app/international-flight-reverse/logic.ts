import {
  DEFAULT_ANALYSIS_OPTIONS,
  type AirportRegion,
  type AnalysisOptions,
  type AnalysisResult,
  type AirportRecentFlights,
  type DataIssue,
  type EmployeeTask,
  type FlightRecord,
  type RecentFlight,
  type TaskResult
} from "./models";

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function normalizeAnalysisOptions(input: Partial<AnalysisOptions> = {}): AnalysisOptions {
  return {
    recentLimit: clampInteger(input.recentLimit ?? DEFAULT_ANALYSIS_OPTIONS.recentLimit, 1, 1000),
    matchDeparture: input.matchDeparture ?? DEFAULT_ANALYSIS_OPTIONS.matchDeparture,
    matchArrival: input.matchArrival ?? DEFAULT_ANALYSIS_OPTIONS.matchArrival,
    validityYears: clampInteger(input.validityYears ?? DEFAULT_ANALYSIS_OPTIONS.validityYears, 1, 10),
    overlapMonths: clampInteger(input.overlapMonths ?? DEFAULT_ANALYSIS_OPTIONS.overlapMonths, 0, 12),
    monthEndDay: clampInteger(input.monthEndDay ?? DEFAULT_ANALYSIS_OPTIONS.monthEndDay, 0, 31)
  };
}

function regionCodes(regions: AirportRegion[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  regions.forEach((item) => {
    const codes = new Set(item.codes.map((code) => code.toUpperCase()));
    result.set(item.region, codes);
    if (item.region === "美国") result.set("北美", codes);
    if (item.region === "北美") result.set("美国", codes);
  });
  return result;
}

export function parseAirportConfigText(value: string): { regions: AirportRegion[]; issues: DataIssue[] } {
  const regions: AirportRegion[] = [];
  const issues: DataIssue[] = [];
  const byRegion = new Map<string, string[]>();
  value.split(/\r?\n/).forEach((line, index) => {
    const source = line.trim();
    if (!source) return;
    const match = source.match(/^(.+?)\s*(?:=|:|：)\s*(.+)$/);
    if (!match) {
      issues.push({ source: "机场配置", kind: "invalid-config", message: "机场配置应使用“地区=三字码,三字码”格式。", rowNumber: index + 1 });
      return;
    }
    const region = match[1].trim();
    const tokens = match[2].split(/[\s,，、;；|/]+/).filter(Boolean);
    const codes = byRegion.get(region) || [];
    tokens.forEach((token) => {
      const code = token.toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        issues.push({ source: "机场配置", kind: "invalid-airport-code", message: `机场配置中的“${token}”不是三位代码。`, rowNumber: index + 1, region });
      } else if (!codes.includes(code)) {
        codes.push(code);
      }
    });
    byRegion.set(region, codes);
  });
  byRegion.forEach((codes, region) => { if (codes.length) regions.push({ region, codes }); });
  return { regions, issues };
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function calculateSuggestedExpiry(latestDate: string, options: AnalysisOptions): string {
  const parsed = parseIsoDate(latestDate);
  if (!parsed) return "";
  const targetMonthIndex = parsed.month - 1 + options.validityYears * 12 - options.overlapMonths;
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = options.monthEndDay === 0 ? daysInMonth : Math.min(options.monthEndDay, daysInMonth);
  return formatDate(targetYear, targetMonth, targetDay);
}

function matchingAirports(flight: FlightRecord, codes: Set<string>, options: AnalysisOptions): string[] {
  const matched: string[] = [];
  if (options.matchDeparture && codes.has(flight.departure)) matched.push(flight.departure);
  if (options.matchArrival && codes.has(flight.arrival) && !matched.includes(flight.arrival)) matched.push(flight.arrival);
  return matched;
}

function deduplicateFlights(flights: Array<{ flight: FlightRecord; matchedAirports: string[] }>): Array<{ flight: FlightRecord; matchedAirports: string[] }> {
  const seen = new Set<string>();
  const unique: Array<{ flight: FlightRecord; matchedAirports: string[] }> = [];
  flights.forEach((item) => {
    const flight = item.flight;
    const flightIdentity = flight.flightNumber || `row-${flight.sourceRow}`;
    const key = `${flight.date}\u0000${flightIdentity}\u0000${flight.departure}\u0000${flight.arrival}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  unique.sort((left, right) => right.flight.date.localeCompare(left.flight.date) || right.flight.sourceRow - left.flight.sourceRow);
  return unique;
}

function taskMessage(status: TaskResult["status"], latestDate: string): string {
  if (status === "地区无配置") return "该地区没有可用机场配置。";
  if (status === "未找到") return "反推日期前未找到命中机场的航班。";
  return `已找到最近航班：${latestDate}`;
}

function toRecentFlight(item: { flight: FlightRecord; matchedAirports: string[] }, rank: number): RecentFlight {
  return {
    rank,
    date: item.flight.date,
    flightNumber: item.flight.flightNumber,
    departure: item.flight.departure,
    arrival: item.flight.arrival,
    matchedAirports: item.matchedAirports,
    stage: item.flight.stage,
    sourceSheet: item.flight.sourceSheet,
    sourceRow: item.flight.sourceRow
  };
}

export function analyzeInternationalFlights(
  tasks: EmployeeTask[],
  flights: FlightRecord[],
  airportRegions: AirportRegion[],
  optionsInput: Partial<AnalysisOptions> = {},
  baseIssues: DataIssue[] = []
): AnalysisResult {
  const options = normalizeAnalysisOptions(optionsInput);
  const issues = [...baseIssues];
  const codesByRegion = regionCodes(airportRegions);
  const flightsByEmployee = new Map<string, FlightRecord[]>();
  flights.forEach((flight) => {
    const existing = flightsByEmployee.get(flight.employeeId) || [];
    existing.push(flight);
    flightsByEmployee.set(flight.employeeId, existing);
  });
  const results = tasks.map<TaskResult>((task) => {
    const codes = codesByRegion.get(task.region);
    if (!codes || codes.size === 0) {
      issues.push({ source: "分析", kind: "missing-airport-config", message: `地区“${task.region}”没有机场配置。`, employeeId: task.employeeId, region: task.region, sheetName: task.sourceSheet, rowNumber: task.sourceRow });
      return { ...task, status: "地区无配置", latestDate: "", suggestedExpiryDate: "", recentFlights: [], airportRecentFlights: [], message: taskMessage("地区无配置", "") };
    }
    const candidates = (flightsByEmployee.get(task.employeeId) || [])
      .filter((flight) => flight.date <= task.reverseDate)
      .map((flight) => ({ flight, matchedAirports: matchingAirports(flight, codes, options) }))
      .filter((item) => item.matchedAirports.length > 0);
    const unique = deduplicateFlights(candidates);
    const recentFlights = unique.slice(0, options.recentLimit).map((item, index) => toRecentFlight(item, index + 1));
    const airportGroups = new Map<string, Array<{ flight: FlightRecord; matchedAirports: string[] }>>();
    unique.forEach((item) => item.matchedAirports.forEach((airport) => {
      const group = airportGroups.get(airport) || [];
      group.push(item);
      airportGroups.set(airport, group);
    }));
    const airportRecentFlights: AirportRecentFlights[] = [...airportGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([airport, group]) => ({
      airport,
      flights: group.slice(0, options.recentLimit).map((item, index) => toRecentFlight(item, index + 1))
    }));
    const latestDate = recentFlights[0]?.date || "";
    const status: TaskResult["status"] = latestDate ? "已找到" : "未找到";
    return {
      ...task,
      status,
      latestDate,
      suggestedExpiryDate: latestDate ? calculateSuggestedExpiry(latestDate, options) : "",
      recentFlights,
      airportRecentFlights,
      message: taskMessage(status, latestDate)
    };
  });
  const recentFlightCount = results.reduce((total, task) => total + task.recentFlights.length, 0);
  return {
    tasks: results,
    issues,
    airportRegions,
    options,
    totals: {
      taskCount: results.length,
      matchedTasks: results.filter((item) => item.status === "已找到").length,
      noMatchTasks: results.filter((item) => item.status !== "已找到").length,
      issueCount: issues.length,
      recentFlightCount
    }
  };
}
