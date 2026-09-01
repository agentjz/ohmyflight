import type * as XLSX from "xlsx-js-style";

import { DEFAULT_AIRPORT_REGIONS, type WorkbookApi } from "./models";

export function buildInternationalFlightTemplateWorkbook(XLSXApi: WorkbookApi): XLSX.WorkBook {
  const workbook = XLSXApi.utils.book_new();
  const employeeSheet = XLSXApi.utils.aoa_to_sheet([
    ["员工号", "姓名", "资质", "反推日期"],
    ["", "", "北美", ""],
    ["", "", "欧洲", ""],
    ["", "", "西亚", ""],
    ["", "", "东南亚", ""]
  ]);
  employeeSheet["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];

  const airportRows: Array<Array<string>> = [["地区", "机场", "三字代码"]];
  DEFAULT_AIRPORT_REGIONS.forEach((region) => {
    region.codes.forEach((code) => airportRows.push([region.region, "", code]));
  });
  const airportSheet = XLSXApi.utils.aoa_to_sheet(airportRows);
  airportSheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }];

  const instructionSheet = XLSXApi.utils.aoa_to_sheet([
    ["国际航班资质反推模板填写说明"],
    ["临期资质表：每行填写一名员工，员工号建议保留 6 位数字。"],
    ["反推日期当天包含在查询范围内，日期格式填写 YYYY-MM-DD。"],
    ["资质可填写标准地区名或完整资格描述；包含“北美”“西亚”“欧洲”或“东南亚”的描述会自动归一，其它地区需与机场配置表一致。"],
    ["航班明细表另行从飞行经历导出文件上传，不需要复制到本模板。"],
    ["页面仍可直接编辑机场配置和近期航班数量。"]
  ]);
  instructionSheet["!cols"] = [{ wch: 88 }];

  XLSXApi.utils.book_append_sheet(workbook, employeeSheet, "临期资质表");
  XLSXApi.utils.book_append_sheet(workbook, airportSheet, "机场三字代码");
  XLSXApi.utils.book_append_sheet(workbook, instructionSheet, "填写说明");
  return workbook;
}
