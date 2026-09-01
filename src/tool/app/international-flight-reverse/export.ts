import type * as XLSX from "xlsx-js-style";

import type { AnalysisResult, DataIssue } from "./models";

type WorkbookApi = typeof XLSX;

function appendSheet(XLSXApi: WorkbookApi, workbook: XLSX.WorkBook, name: string, rows: Array<Array<string | number>>, widths: number[]): void {
  const sheet = XLSXApi.utils.aoa_to_sheet(rows);
  const columnLetters = (columnNumber: number): string => {
    let value = columnNumber;
    let result = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  };
  sheet["!autofilter"] = { ref: `A1:${columnLetters(widths.length)}${Math.max(1, rows.length)}` };
  sheet["!freeze"] = { ySplit: 1 } as never;
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  XLSXApi.utils.book_append_sheet(workbook, sheet, name);
}

function issueSource(issue: DataIssue): string {
  return issue.source;
}

export function buildInternationalFlightExportWorkbook(XLSXApi: WorkbookApi, result: AnalysisResult): XLSX.WorkBook {
  const workbook = XLSXApi.utils.book_new();
  const summaryRows: Array<Array<string | number>> = [
    ["员工号", "姓名", "资质", "地区", "反推日期", "状态", "最近航班日期", "建议资质有效期", "近期航班数", "命中机场", "说明", "临期资质表位置"],
    ...result.tasks.map((task) => [
      task.employeeId,
      task.name,
      task.qualification || task.region,
      task.region,
      task.reverseDate,
      task.status,
      task.latestDate,
      task.suggestedExpiryDate,
      task.recentFlights.length,
      [...new Set(task.recentFlights.flatMap((flight) => flight.matchedAirports))].join(","),
      task.message,
      `${task.sourceSheet} 第${task.sourceRow}行`
    ])
  ];
  const detailRows: Array<Array<string | number>> = [
    ["员工号", "姓名", "资质", "地区", "反推日期", "序号", "航班日期", "航班号", "离场", "到达", "命中机场", "飞行阶段", "航班表位置"],
    ...result.tasks.flatMap((task) => task.recentFlights.map((flight) => [
      task.employeeId,
      task.name,
      task.qualification || task.region,
      task.region,
      task.reverseDate,
      flight.rank,
      flight.date,
      flight.flightNumber,
      flight.departure,
      flight.arrival,
      flight.matchedAirports.join(","),
      flight.stage,
      `${flight.sourceSheet} 第${flight.sourceRow}行`
    ]))
  ];
  const airportDetailRows: Array<Array<string | number>> = [
    ["员工号", "姓名", "资质", "地区", "机场", "序号", "航班日期", "航班号", "离场", "到达", "命中机场", "飞行阶段", "航班表位置"],
    ...result.tasks.flatMap((task) => task.airportRecentFlights.flatMap((airportGroup) => airportGroup.flights.map((flight) => [
      task.employeeId,
      task.name,
      task.qualification || task.region,
      task.region,
      airportGroup.airport,
      flight.rank,
      flight.date,
      flight.flightNumber,
      flight.departure,
      flight.arrival,
      flight.matchedAirports.join(","),
      flight.stage,
      `${flight.sourceSheet} 第${flight.sourceRow}行`
    ])))
  ];
  const configRows: Array<Array<string | number>> = [
    ["地区", "机场三字码"],
    ...result.airportRegions.map((item) => [item.region, item.codes.join(",")]),
    [],
    ["分析参数", "值"],
    ["每项近期航班数", result.options.recentLimit],
    ["离场参与匹配", result.options.matchDeparture ? "是" : "否"],
    ["到达参与匹配", result.options.matchArrival ? "是" : "否"],
    ["资质年限（年）", result.options.validityYears],
    ["重叠月数", result.options.overlapMonths],
    ["目标月末日（0=自然月末）", result.options.monthEndDay]
  ];
  const issueRows: Array<Array<string | number>> = [
    ["来源", "问题类型", "说明", "工作表", "行号", "员工号", "地区"],
    ...result.issues.map((issue) => [issueSource(issue), issue.kind, issue.message, issue.sheetName || "", issue.rowNumber || "", issue.employeeId || "", issue.region || ""])
  ];
  appendSheet(XLSXApi, workbook, "最近航班汇总", summaryRows, [12, 12, 36, 10, 13, 12, 13, 16, 12, 16, 36, 20]);
  appendSheet(XLSXApi, workbook, "近期航班明细", detailRows, [12, 12, 36, 10, 13, 8, 13, 10, 10, 10, 14, 12, 20]);
  appendSheet(XLSXApi, workbook, "机场近期航班", airportDetailRows, [12, 12, 36, 10, 10, 8, 13, 10, 10, 10, 14, 12, 20]);
  appendSheet(XLSXApi, workbook, "机场配置", configRows, [28, 30]);
  appendSheet(XLSXApi, workbook, "数据问题", issueRows, [12, 22, 42, 18, 8, 12, 12]);
  return workbook;
}
