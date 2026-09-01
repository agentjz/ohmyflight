import { describe, expect, it } from "vitest";

import { analyzeInternationalFlights, calculateSuggestedExpiry, parseAirportConfigText } from "../../../src/tool/app/international-flight-reverse/logic";
import type { EmployeeTask, FlightRecord } from "../../../src/tool/app/international-flight-reverse/models";

const task: EmployeeTask = { employeeId: "000001", name: "张三", qualification: "北美区域英语通信资格", region: "北美", reverseDate: "2026-09-30", sourceSheet: "临期资质表", sourceRow: 2 };
const flight = (date: string, flightNumber: string, departure: string, arrival: string, sourceRow: number, stage = "起飞"): FlightRecord => ({ employeeId: "000001", name: "张三", date, flightNumber, departure, arrival, stage, sourceSheet: "航班明细", sourceRow });

describe("international flight reverse logic", () => {
  it("deduplicates repeated stages and keeps distinct same-day routes", () => {
    const result = analyzeInternationalFlights([task], [
      flight("2026-08-20", "100", "PVG", "LAX", 2, "起飞"),
      flight("2026-08-20", "100", "PVG", "LAX", 3, "巡航1"),
      flight("2026-08-20", "100", "PVG", "LAX", 4, "着陆"),
      flight("2026-08-20", "100", "LAX", "ANC", 5, "起飞"),
      flight("2026-07-01", "99", "PVG", "JFK", 6),
      flight("2026-10-01", "101", "PVG", "ORD", 7)
    ], [{ region: "北美", codes: ["LAX", "JFK", "ORD", "ANC", "NLU"] }], { recentLimit: 3 });

    expect(result.tasks[0].recentFlights.map((item) => [item.date, item.flightNumber, item.departure, item.arrival])).toEqual([
      ["2026-08-20", "100", "LAX", "ANC"],
      ["2026-08-20", "100", "PVG", "LAX"],
      ["2026-07-01", "99", "PVG", "JFK"]
    ]);
    expect(result.tasks[0].suggestedExpiryDate).toBe("2027-07-30");
  });

  it("honors cutoff, direction and configurable recent count", () => {
    const result = analyzeInternationalFlights([task], [
      flight("2026-09-30", "1", "LAX", "PVG", 2),
      flight("2026-09-30", "2", "PVG", "LAX", 3),
      flight("2026-09-29", "3", "PVG", "JFK", 4),
      flight("2026-10-01", "4", "PVG", "ORD", 5)
    ], [{ region: "北美", codes: ["LAX", "JFK", "ORD", "ANC", "NLU"] }], { recentLimit: 2, matchDeparture: false, matchArrival: true });

    expect(result.tasks[0].recentFlights.map((item) => item.flightNumber)).toEqual(["2", "3"]);
    expect(result.tasks[0].latestDate).toBe("2026-09-30");
  });

  it("reports missing region configuration and parses editable mapping", () => {
    const config = parseAirportConfigText("北美=LAX,JFK\n错误=AB\n");
    expect(config.regions).toEqual([{ region: "北美", codes: ["LAX", "JFK"] }]);
    expect(config.issues).toHaveLength(1);
    const result = analyzeInternationalFlights([{ ...task, region: "未知" }], [], config.regions);
    expect(result.tasks[0].status).toBe("地区无配置");
    expect(result.issues.some((issue) => issue.kind === "missing-airport-config")).toBe(true);
  });

  it("treats 美国 and 北美 as equivalent region labels", () => {
    const result = analyzeInternationalFlights([{ ...task, region: "美国" }], [flight("2026-08-01", "1", "PVG", "LAX", 2)], [{ region: "北美", codes: ["LAX"] }]);
    expect(result.tasks[0].status).toBe("已找到");
  });

  it("supports natural month end and short months", () => {
    expect(calculateSuggestedExpiry("2026-03-10", { recentLimit: 3, matchDeparture: true, matchArrival: true, validityYears: 1, overlapMonths: 1, monthEndDay: 0 })).toBe("2027-02-28");
    expect(calculateSuggestedExpiry("2026-06-06", { recentLimit: 3, matchDeparture: true, matchArrival: true, validityYears: 1, overlapMonths: 1, monthEndDay: 30 })).toBe("2027-05-30");
  });
});
