import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { buildInternationalFlightExportWorkbook } from "../../../src/tool/app/international-flight-reverse/export";
import type { AnalysisResult } from "../../../src/tool/app/international-flight-reverse/models";

describe("international flight reverse export", () => {
  it("exports summary, detail, configuration and issues", () => {
    const result: AnalysisResult = {
      airportRegions: [{ region: "北美", codes: ["LAX"] }],
      options: { recentLimit: 2, matchDeparture: true, matchArrival: true, validityYears: 1, overlapMonths: 1, monthEndDay: 30 },
      issues: [],
      tasks: [{ employeeId: "000001", name: "张三", region: "北美", reverseDate: "2026-09-30", status: "已找到", latestDate: "2026-08-01", suggestedExpiryDate: "2027-07-30", recentFlights: [{ rank: 1, date: "2026-08-01", flightNumber: "100", departure: "PVG", arrival: "LAX", matchedAirports: ["LAX"], stage: "起飞", sourceSheet: "航班", sourceRow: 2 }], airportRecentFlights: [{ airport: "LAX", flights: [{ rank: 1, date: "2026-08-01", flightNumber: "100", departure: "PVG", arrival: "LAX", matchedAirports: ["LAX"], stage: "起飞", sourceSheet: "航班", sourceRow: 2 }] }], message: "已找到最近航班：2026-08-01", sourceSheet: "员工", sourceRow: 2 }],
      totals: { taskCount: 1, matchedTasks: 1, noMatchTasks: 0, issueCount: 0, recentFlightCount: 1 }
    };
    const workbook = buildInternationalFlightExportWorkbook(XLSX, result);
    expect(workbook.SheetNames).toEqual(["最近航班汇总", "近期航班明细", "机场近期航班", "机场配置", "数据问题"]);
    expect(workbook.Sheets["最近航班汇总"].A1.v).toBe("员工号");
    expect(workbook.Sheets["近期航班明细"].F2.v).toBe("2026-08-01");
    expect(workbook.Sheets["机场近期航班"].D2.v).toBe("LAX");
    expect(workbook.Sheets["机场配置"].A5.v).toBe("每项近期航班数");
    expect(workbook.Sheets["机场配置"].B5.v).toBe(2);
    expect(workbook.Sheets["数据问题"]["!autofilter"]?.ref).toBe("A1:G1");
  });
});
