import * as XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import { parseEmployeeWorkbook, parseFlightWorkbook } from "../../../src/tool/app/international-flight-reverse/workbook";

function buildWorkbook(sheets: Record<string, unknown[][]>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name));
  return workbook;
}

describe("international flight reverse workbook parsing", () => {
  it("finds tables by headers and reads airport mapping", () => {
    const workbook = buildWorkbook({
      说明: [["说明"]],
      临期资质表: [["员工号", "姓名", "地区", "反推日期"], [1, "张三", "北美", "2026-09-30"], [1, "张三", "北美", "2026-09-30"]],
      机场配置: [["地区", "机场三字代码"], ["北美", "LAX,JFK"], ["欧洲", "AMS STN"]]
    });
    const result = parseEmployeeWorkbook(XLSX, workbook);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].employeeId).toBe("000001");
    expect(result.airportRegions).toEqual([{ region: "北美", codes: ["LAX", "JFK"] }, { region: "欧洲", codes: ["AMS", "STN"] }]);
    expect(result.issues.some((issue) => issue.kind === "duplicate-task")).toBe(true);
  });

  it("reads flight rows and reports invalid values", () => {
    const workbook = buildWorkbook({
      航班: [["员工号", "日期", "离场", "到达", "航班号", "飞行阶段"], [1, "2026-08-01", "PVG", "LAX", 100, "起飞"], ["bad", "2026-08-02", "PVG", "LAX", 101, "起飞"]]
    });
    const result = parseFlightWorkbook(XLSX, workbook);
    expect(result.flights).toHaveLength(1);
    expect(result.flights[0]).toMatchObject({ employeeId: "000001", flightNumber: "100", departure: "PVG", arrival: "LAX" });
    expect(result.issues.some((issue) => issue.kind === "invalid-employee-id")).toBe(true);
  });

  it("normalizes qualification descriptions containing supported region keywords", () => {
    const workbook = buildWorkbook({
      临期资质表: [
        ["员工号", "姓名", "地区", "反推日期"],
        [208978, "朱嘉俊", "北美区域英语通信资格", "2026-09-30"],
        [212810, "彭程", "除俄罗斯外的欧洲区域英语通信资格", "2026-09-30"],
        [276035, "曾渝浩", "西亚和撒哈拉以北的非洲区域英语通信资格", "2026-09-30"],
        [210239, "罗竣艺", "北美区域英语通信资格", "2026-09-30"],
        [210239, "罗竣艺", "除俄罗斯外的欧洲区域英语通信资格", "2026-09-30"],
        [181737, "颜文彬", "777;东南亚及港澳台区域单飞资格", "2026-09-30"]
      ]
    });

    const result = parseEmployeeWorkbook(XLSX, workbook);
    expect(result.tasks.map((task) => task.region)).toEqual(["北美", "欧洲", "西亚", "北美", "欧洲", "东南亚"]);
  });
});
