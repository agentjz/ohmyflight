import { TrainingToolConfig } from "./config";
import { TrainingToolUtils } from "./utils";
import { TrainingXlsx as XLSX } from "./browser-vendors";
import type {
  TrainingToolAnalysis,
  TrainingToolPeopleInfo,
  TrainingToolUpdatedRowEntry,
  TrainingToolWorkbook,
  TrainingToolWorksheet,
  TrainingValidityResult
} from "./models";

const Config = TrainingToolConfig;
  const Utils = TrainingToolUtils;
  const REPORT_DATE_FORMAT = "yyyy/mm/dd";

  const TITLE_STYLE = {
    font: { bold: true, sz: 14, color: { rgb: "7D2F0D" } },
    fill: { patternType: "solid", fgColor: { rgb: "F3E1C1" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "C8A87C" } },
      bottom: { style: "thin", color: { rgb: "C8A87C" } },
      left: { style: "thin", color: { rgb: "C8A87C" } },
      right: { style: "thin", color: { rgb: "C8A87C" } }
    }
  };

  const LABEL_STYLE = {
    font: { bold: true, color: { rgb: "5A4633" } },
    fill: { patternType: "solid", fgColor: { rgb: "FBF4E5" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "D7C3A5" } },
      bottom: { style: "thin", color: { rgb: "D7C3A5" } },
      left: { style: "thin", color: { rgb: "D7C3A5" } },
      right: { style: "thin", color: { rgb: "D7C3A5" } }
    }
  };

  const VALUE_STYLE = {
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "E4D6C1" } },
      bottom: { style: "thin", color: { rgb: "E4D6C1" } },
      left: { style: "thin", color: { rgb: "E4D6C1" } },
      right: { style: "thin", color: { rgb: "E4D6C1" } }
    }
  };

  const UPDATED_CELL_STYLE = {
    font: { color: { rgb: "FFFFFF" }, bold: true },
    fill: { patternType: "solid", fgColor: { rgb: "F5222D" } }
  };

  function removeSheetIfExists(workbook: TrainingToolWorkbook, sheetName: string): void {
    if (!workbook.Sheets[sheetName]) return;
    delete workbook.Sheets[sheetName];
    workbook.SheetNames = workbook.SheetNames.filter((name) => name !== sheetName);
  }

  function insertSheetFirst(workbook: TrainingToolWorkbook, sheetName: string, sheet: TrainingToolWorksheet): void {
    removeSheetIfExists(workbook, sheetName);
    workbook.Sheets[sheetName] = sheet;
    workbook.SheetNames = [sheetName, ...workbook.SheetNames.filter((name) => name !== sheetName)];
  }

  function copyCell(sourceSheet: TrainingToolWorksheet, sourceRowIndex: number, sourceColumnIndex: number, targetSheet: TrainingToolWorksheet, targetRowIndex: number, targetColumnIndex: number): void {
    const sourceAddress = XLSX.utils.encode_cell({ r: sourceRowIndex, c: sourceColumnIndex });
    if (!sourceSheet[sourceAddress]) return;

    const targetAddress = XLSX.utils.encode_cell({ r: targetRowIndex, c: targetColumnIndex });
    targetSheet[targetAddress] = Utils.deepClone(sourceSheet[sourceAddress]);
  }

  function buildUpdatedPeopleSheet(peopleInfo: TrainingToolPeopleInfo, updatedRowMap: Map<number, TrainingToolUpdatedRowEntry>): { reportSheet: TrainingToolWorksheet; updatedItems: TrainingToolUpdatedRowEntry[] } {
    const sourceSheet = peopleInfo.sheet;
    const reportSheet: TrainingToolWorksheet = {};
    const updatedItems = Array.from(updatedRowMap.values());
    updatedItems.sort((left, right) => left.rowNumber - right.rowNumber);
    const lastColumnIndex = Math.max(peopleInfo.headers.length - 1, 0);
    const lastRowIndex = Math.max(updatedItems.length, 0);

    if (sourceSheet["!cols"]) {
      reportSheet["!cols"] = Utils.deepClone(sourceSheet["!cols"]);
    }

    if (sourceSheet["!rows"]) {
      reportSheet["!rows"] = Utils.deepClone(sourceSheet["!rows"]).slice(0, updatedItems.length + 1);
    }

    for (let columnIndex = 0; columnIndex < peopleInfo.headers.length; columnIndex += 1) {
      copyCell(sourceSheet, 0, columnIndex, reportSheet, 0, columnIndex);
    }

    updatedItems.forEach((item, index) => {
      const targetRowIndex = index + 1;
      const sourceRowIndex = item.rowNumber - 1;

      for (let columnIndex = 0; columnIndex < peopleInfo.headers.length; columnIndex += 1) {
        copyCell(sourceSheet, sourceRowIndex, columnIndex, reportSheet, targetRowIndex, columnIndex);
      }
    });

    reportSheet["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: lastRowIndex, c: lastColumnIndex }
    });

    reportSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: lastRowIndex, c: lastColumnIndex }
      })
    };

    return { reportSheet, updatedItems };
  }

  function highlightUpdatedProjectCells(reportSheet: TrainingToolWorksheet, updatedItems: TrainingToolUpdatedRowEntry[]): void {
    updatedItems.forEach((item, index) => {
      const targetRowIndex = index + 1;

      item.columns.forEach((columnIndex) => {
        const address = XLSX.utils.encode_cell({ r: targetRowIndex, c: columnIndex });
        if (!reportSheet[address]) return;
        reportSheet[address].s = Utils.mergeStyle(reportSheet[address].s as Record<string, unknown> | undefined, {
          ...UPDATED_CELL_STYLE,
          numFmt: REPORT_DATE_FORMAT
        });
        reportSheet[address].z = REPORT_DATE_FORMAT;
        delete reportSheet[address].w;
      });
    });
  }

  function writeSummaryArea(reportSheet: TrainingToolWorksheet, peopleInfo: TrainingToolPeopleInfo, updateResult: TrainingValidityResult, selectedProjectNames: string[], selectedMonthKeys: string[]): void {
    const bounds = Utils.getSheetBounds(reportSheet);
    const startColumn = Math.max(bounds.endColumn + 2, peopleInfo.headers.length + 2);
    const createdAt = new Date().toLocaleString("zh-CN", { hour12: false });
    const updatedPeopleCount = updateResult.updatedRowMap.size;
    const updatedItems = Array.from(updateResult.updatedRowMap.values());
    const updatedCellCount = updatedItems
      .reduce((total, item) => total + item.columns.size, 0);

    Utils.writeCell(reportSheet, 1, startColumn, "更新报告", TITLE_STYLE);
    Utils.writeCell(reportSheet, 2, startColumn, "生成时间", LABEL_STYLE);
    Utils.writeCell(reportSheet, 2, startColumn + 1, createdAt, VALUE_STYLE);
    Utils.writeCell(reportSheet, 3, startColumn, "所选项目", LABEL_STYLE);
    Utils.writeCell(reportSheet, 3, startColumn + 1, selectedProjectNames.join("、") || "未选择", VALUE_STYLE);
    Utils.writeCell(reportSheet, 4, startColumn, "所选月份", LABEL_STYLE);
    Utils.writeCell(reportSheet, 4, startColumn + 1, selectedMonthKeys.join("、") || "未选择", VALUE_STYLE);
    Utils.writeCell(reportSheet, 5, startColumn, "更新人数", LABEL_STYLE);
    Utils.writeCell(reportSheet, 5, startColumn + 1, updatedPeopleCount, VALUE_STYLE, "n");
    Utils.writeCell(reportSheet, 6, startColumn, "更新单元格数", LABEL_STYLE);
    Utils.writeCell(reportSheet, 6, startColumn + 1, updatedCellCount, VALUE_STYLE, "n");
    Utils.writeCell(reportSheet, 7, startColumn, "更新结论", LABEL_STYLE);
    Utils.writeCell(reportSheet, 7, startColumn + 1, updateResult.summaryText, VALUE_STYLE);
    Utils.writeCell(reportSheet, 8, startColumn, "说明", LABEL_STYLE);
    Utils.writeCell(
      reportSheet,
      8,
      startColumn + 1,
      "左侧仅保留本次实际写入更新的人员，每人一行，深红色单元格表示本次改动的项目列。",
      VALUE_STYLE
    );
  }

  function attachUpdateReportSheet(workbook: TrainingToolWorkbook, analysis: TrainingToolAnalysis, updateResult: TrainingValidityResult, selectedProjectNames: string[], selectedMonthKeys: string[]): void {
    const { reportSheet, updatedItems } = buildUpdatedPeopleSheet(analysis.peopleInfo, updateResult.updatedRowMap);

    highlightUpdatedProjectCells(reportSheet, updatedItems);
    writeSummaryArea(reportSheet, analysis.peopleInfo, updateResult, selectedProjectNames, selectedMonthKeys);
    Utils.centerAlignSheet(reportSheet);
    insertSheetFirst(workbook, Config.REPORT_SHEET_NAME, reportSheet);
  }
  export const TrainingToolReportSheet = {
    attachUpdateReportSheet
  };
