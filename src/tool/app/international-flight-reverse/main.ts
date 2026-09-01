import type * as XLSX from "xlsx-js-style";

import { buildInternationalFlightExportWorkbook } from "./export";
import { analyzeInternationalFlights, normalizeAnalysisOptions, parseAirportConfigText } from "./logic";
import {
  DEFAULT_AIRPORT_REGIONS,
  DEFAULT_ANALYSIS_OPTIONS,
  type AnalysisOptions,
  type ParsedEmployees,
  type ParsedFlights
} from "./models";
import { parseEmployeeWorkbook, parseFlightWorkbook } from "./workbook";
import { buildInternationalFlightTemplateWorkbook } from "./template";
import { renderReverseView, type ReverseViewState } from "./view";

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`页面缺少元素 ${id}`);
  return node as T;
}

function mappingText(regions: typeof DEFAULT_AIRPORT_REGIONS): string {
  return regions.map((item) => `${item.region}=${item.codes.join(",")}`).join("\n");
}

function currentOptions(): AnalysisOptions {
  return normalizeAnalysisOptions({
    recentLimit: Number(element<HTMLInputElement>("recentLimit").value),
    matchDeparture: element<HTMLInputElement>("matchDeparture").checked,
    matchArrival: element<HTMLInputElement>("matchArrival").checked,
    validityYears: Number(element<HTMLInputElement>("validityYears").value),
    overlapMonths: Number(element<HTMLInputElement>("overlapMonths").value),
    monthEndDay: Number(element<HTMLInputElement>("monthEndDay").value)
  });
}

function init(): void {
  const XLSXApi = window.XLSX as unknown as typeof XLSX;
  const state: ReverseViewState = {
    flightFileName: "",
    employeeFileName: "",
    flightStatus: "尚未选择航班明细文件。",
    employeeStatus: "尚未选择临期资质表文件。",
    statusKind: "info",
    statusMessage: "请选择两份 Excel 文件。",
    result: null
  };
  let parsedFlights: ParsedFlights | null = null;
  let parsedEmployees: ParsedEmployees | null = null;

  element<HTMLTextAreaElement>("airportConfig").value = mappingText(DEFAULT_AIRPORT_REGIONS);
  element<HTMLInputElement>("recentLimit").value = String(DEFAULT_ANALYSIS_OPTIONS.recentLimit);
  element<HTMLInputElement>("validityYears").value = String(DEFAULT_ANALYSIS_OPTIONS.validityYears);
  element<HTMLInputElement>("overlapMonths").value = String(DEFAULT_ANALYSIS_OPTIONS.overlapMonths);
  element<HTMLInputElement>("monthEndDay").value = String(DEFAULT_ANALYSIS_OPTIONS.monthEndDay);

  const update = (): void => renderReverseView(state);
  const readFile = async (file: File): Promise<XLSX.WorkBook> => XLSXApi.read(await file.arrayBuffer(), { type: "array", cellDates: true });

  element<HTMLInputElement>("flightFile").addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    state.flightFileName = file.name;
    state.flightStatus = `正在读取 ${file.name}...`;
    state.result = null;
    update();
    try {
      parsedFlights = parseFlightWorkbook(XLSXApi, await readFile(file));
      state.flightStatus = `已读取 ${file.name}（${parsedFlights.flights.length} 条有效航段，${parsedFlights.issues.length} 个问题）`;
      state.statusKind = "success";
      state.statusMessage = "文件读取成功，可开始分析。";
    } catch (error) {
      parsedFlights = null;
      state.flightFileName = "";
      state.flightStatus = error instanceof Error ? error.message : String(error);
      state.statusKind = "danger";
      state.statusMessage = "航班明细读取失败。";
    }
    update();
  });

  element<HTMLInputElement>("employeeFile").addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    state.employeeFileName = file.name;
    state.employeeStatus = `正在读取 ${file.name}...`;
    state.result = null;
    update();
    try {
      parsedEmployees = parseEmployeeWorkbook(XLSXApi, await readFile(file));
      element<HTMLTextAreaElement>("airportConfig").value = mappingText(parsedEmployees.airportRegions);
      state.employeeStatus = `已读取 ${file.name}（${parsedEmployees.tasks.length} 个任务，${parsedEmployees.issues.length} 个问题）`;
      state.statusKind = "success";
      state.statusMessage = "文件读取成功，可开始分析。";
    } catch (error) {
      parsedEmployees = null;
      state.employeeFileName = "";
      state.employeeStatus = error instanceof Error ? error.message : String(error);
      state.statusKind = "danger";
      state.statusMessage = "临期资质表读取失败。";
    }
    update();
  });

  element<HTMLButtonElement>("analyzeButton").addEventListener("click", () => {
    if (!parsedFlights || !parsedEmployees) return;
    const config = parseAirportConfigText(element<HTMLTextAreaElement>("airportConfig").value);
    const options = currentOptions();
    state.result = analyzeInternationalFlights(
      parsedEmployees.tasks,
      parsedFlights.flights,
      config.regions,
      options,
      [...parsedFlights.issues, ...parsedEmployees.issues, ...config.issues]
    );
    state.statusKind = "success";
    state.statusMessage = "分析完成。";
    update();
  });

  element<HTMLButtonElement>("exportButton").addEventListener("click", () => {
    if (!state.result) return;
    XLSXApi.writeFile(buildInternationalFlightExportWorkbook(XLSXApi, state.result), "国际航班资质反推.xlsx");
  });

  element<HTMLButtonElement>("templateButton").addEventListener("click", () => {
    XLSXApi.writeFile(buildInternationalFlightTemplateWorkbook(XLSXApi), "国际航班资质反推模板.xlsx");
  });

  update();
}

document.addEventListener("DOMContentLoaded", init);
