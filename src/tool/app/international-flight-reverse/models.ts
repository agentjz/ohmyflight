import type * as XLSX from "xlsx-js-style";

export type CellValue = string | number | boolean | Date | null | undefined;
export type WorkbookApi = typeof XLSX;

export interface AirportRegion {
  region: string;
  codes: string[];
}

export interface EmployeeTask {
  employeeId: string;
  name: string;
  qualification: string;
  region: string;
  reverseDate: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface FlightRecord {
  employeeId: string;
  name: string;
  date: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  stage: string;
  sourceSheet: string;
  sourceRow: number;
}

export type IssueKind =
  | "missing-header"
  | "invalid-employee-id"
  | "invalid-date"
  | "invalid-airport-code"
  | "duplicate-task"
  | "missing-airport-config"
  | "invalid-config";

export interface DataIssue {
  source: "临期资质表" | "航班明细" | "机场配置" | "分析";
  kind: IssueKind;
  message: string;
  sheetName?: string;
  rowNumber?: number;
  employeeId?: string;
  region?: string;
}

export interface ParsedEmployees {
  sheetName: string;
  headerRowNumber: number;
  tasks: EmployeeTask[];
  airportRegions: AirportRegion[];
  issues: DataIssue[];
}

export interface ParsedFlights {
  sheetName: string;
  headerRowNumber: number;
  flights: FlightRecord[];
  issues: DataIssue[];
}

export interface AnalysisOptions {
  recentLimit: number;
  matchDeparture: boolean;
  matchArrival: boolean;
  validityYears: number;
  overlapMonths: number;
  monthEndDay: number;
}

export interface RecentFlight {
  rank: number;
  date: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  matchedAirports: string[];
  stage: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface AirportRecentFlights {
  airport: string;
  flights: RecentFlight[];
}

export type TaskStatus = "已找到" | "未找到" | "地区无配置";

export interface TaskResult {
  employeeId: string;
  name: string;
  qualification: string;
  region: string;
  reverseDate: string;
  status: TaskStatus;
  latestDate: string;
  suggestedExpiryDate: string;
  recentFlights: RecentFlight[];
  airportRecentFlights: AirportRecentFlights[];
  message: string;
  sourceSheet: string;
  sourceRow: number;
}

export interface AnalysisResult {
  tasks: TaskResult[];
  issues: DataIssue[];
  airportRegions: AirportRegion[];
  options: AnalysisOptions;
  totals: {
    taskCount: number;
    matchedTasks: number;
    noMatchTasks: number;
    issueCount: number;
    recentFlightCount: number;
  };
}

export const DEFAULT_AIRPORT_REGIONS: AirportRegion[] = [
  { region: "北美", codes: ["LAX", "JFK", "ORD", "ANC", "NLU"] },
  { region: "欧洲", codes: ["AMS", "STN", "BUD", "PIK"] },
  { region: "西亚", codes: ["RUH", "DWC"] },
  { region: "东南亚", codes: ["HAN"] }
];

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  recentLimit: 3,
  matchDeparture: true,
  matchArrival: true,
  validityYears: 1,
  overlapMonths: 1,
  monthEndDay: 30
};
