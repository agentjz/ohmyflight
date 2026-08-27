import type * as XLSX from "xlsx-js-style";
import { compareQualificationRosters } from "./comparison";
import { buildQualificationExportWorkbook } from "./export";
import { parsePersonnelWorkbook, parsePortalWorkbook } from "./workbook";
import { renderQualificationView, type QualificationViewState } from "./view";

function get<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`页面缺少元素 ${id}`);
  return node as T;
}

document.addEventListener("DOMContentLoaded", () => {
  const XLSXApi = window.XLSX as unknown as typeof XLSX;
  const state: QualificationViewState = { result: null, selectedCode: "", filter: "diff", personnelFileName: "", portalFileName: "", statusMessage: "请选择两份 Excel 文件。", statusKind: "info" };
  let personnelWorkbook: XLSX.WorkBook | null = null;
  let portalWorkbook: XLSX.WorkBook | null = null;

  const update = (): void => renderQualificationView(state);
  const readFile = async (file: File): Promise<XLSX.WorkBook> => XLSXApi.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const bindFile = (id: string, source: "personnel" | "portal"): void => {
    get<HTMLInputElement>(id).addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      state.statusMessage = `正在读取 ${file.name}...`;
      state.statusKind = "info";
      state.result = null;
      update();
      try {
        const workbook = await readFile(file);
        if (source === "personnel") { personnelWorkbook = workbook; state.personnelFileName = file.name; parsePersonnelWorkbook(XLSXApi, workbook); }
        else { portalWorkbook = workbook; state.portalFileName = file.name; parsePortalWorkbook(XLSXApi, workbook); }
        state.statusMessage = `${source === "personnel" ? "人员信息" : "飞行门户"}文件读取成功。`;
        state.statusKind = "success";
      } catch (error) {
        if (source === "personnel") { personnelWorkbook = null; state.personnelFileName = ""; } else { portalWorkbook = null; state.portalFileName = ""; }
        state.statusMessage = error instanceof Error ? error.message : String(error);
        state.statusKind = "danger";
      }
      update();
    });
  };
  bindFile("personnelFile", "personnel");
  bindFile("portalFile", "portal");
  get<HTMLButtonElement>("compareButton").addEventListener("click", () => {
    if (!personnelWorkbook || !portalWorkbook) return;
    try {
      const personnel = parsePersonnelWorkbook(XLSXApi, personnelWorkbook);
      const portal = parsePortalWorkbook(XLSXApi, portalWorkbook);
      state.result = compareQualificationRosters(personnel, portal);
      state.selectedCode = state.result.summaries.find((summary) => summary.differenceCount > 0)?.qualificationCode || state.result.qualificationCodes[0] || "";
      state.filter = "diff";
      state.statusMessage = "比对完成。默认显示所选资质的差异人员。";
      state.statusKind = "success";
      update();
    } catch (error) { state.statusMessage = error instanceof Error ? error.message : String(error); state.statusKind = "danger"; update(); }
  });
  get<HTMLSelectElement>("qualificationSelect").addEventListener("change", (event) => { state.selectedCode = (event.target as HTMLSelectElement).value; update(); });
  get<HTMLSelectElement>("statusFilter").addEventListener("change", (event) => { state.filter = (event.target as HTMLSelectElement).value as QualificationViewState["filter"]; update(); });
  get<HTMLButtonElement>("exportButton").addEventListener("click", () => { if (state.result) XLSXApi.writeFile(buildQualificationExportWorkbook(XLSXApi, state.result), "运行资质比对.xlsx"); });
  update();
});
