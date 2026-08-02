import type * as XlsxRuntime from "xlsx-js-style";

import { buildExportRows, resolveImageTitle } from "./logic";
import type {
    CrewExportColumn,
    CrewExportOptions,
    CrewMatchNameIdExporterApi,
    CrewRosterEntry,
    Html2CanvasApi,
    StyledCrewCell
} from "./models";

export function createCrewMatchNameIdExporter(
    XLSX: typeof XlsxRuntime,
    html2canvas: Html2CanvasApi | undefined
): CrewMatchNameIdExporterApi {

function applyWorksheetStyle(
    worksheet: import("xlsx-js-style").WorkSheet,
    rowCount: number,
    columnCount: number,
    options: CrewExportOptions
): void {
    const border = {
        top: { style: "thin", color: { rgb: "C8D2CD" } },
        bottom: { style: "thin", color: { rgb: "C8D2CD" } },
        left: { style: "thin", color: { rgb: "C8D2CD" } },
        right: { style: "thin", color: { rgb: "C8D2CD" } }
    };

    for (let row = 0; row < rowCount; row++) {
        for (let column = 0; column < columnCount; column++) {
            const address = XLSX.utils.encode_cell({ r: row, c: column });
            const cell = worksheet[address] as StyledCrewCell | undefined;
            if (!cell) continue;
            cell.s = row === 0
                ? {
                    font: { name: "微软雅黑", sz: 11, bold: true, color: { rgb: "26352E" } },
                    fill: { patternType: "solid", fgColor: { rgb: "E8EFEA" } },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    border
                }
                : {
                    font: { name: "微软雅黑", sz: 11, color: { rgb: "1F2933" } },
                    fill: { patternType: "solid", fgColor: { rgb: row % 2 === 0 ? "F7F9FA" : "FFFFFF" } },
                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                    border
                };
        }
    }

    const fixedColumnWidths = [
        { wch: 13 },
        { wch: 16 },
        { wch: 14 },
        { wch: 26 }
    ];
    if (options.includeTechLevel) fixedColumnWidths.push({ wch: 13 });
    worksheet["!cols"] = [
        ...fixedColumnWidths,
        ...Array.from({ length: Math.max(0, columnCount - fixedColumnWidths.length) }, () => ({ wch: 20 }))
    ];
    worksheet["!rows"] = [
        { hpt: 28 },
        ...Array.from({ length: Math.max(0, rowCount - 1) }, () => ({ hpt: 34 }))
    ];
    if (rowCount > 0 && columnCount > 0) {
        worksheet["!autofilter"] = {
            ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowCount - 1, c: columnCount - 1 } })
        };
    }
}

function buildExcelWorkbook(
    entries: CrewRosterEntry[],
    customColumns: CrewExportColumn[],
    options: CrewExportOptions = {}
): import("xlsx-js-style").WorkBook {
    const rows = buildExportRows(entries, customColumns, options);
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    applyWorksheetStyle(worksheet, rows.length, rows[0]?.length || 0, options);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "匹配结果");
    return workbook;
}

function exportExcel(
    entries: CrewRosterEntry[],
    customColumns: CrewExportColumn[],
    options: CrewExportOptions = {}
): void {
    XLSX.writeFile(
        buildExcelWorkbook(entries, customColumns, options),
        `姓名匹配员工号_${formatLocalDate(new Date())}.xlsx`
    );
}

function applyImageCellStyle(cell: HTMLTableCellElement, isHeader: boolean, rowIndex: number): void {
    cell.style.boxSizing = "border-box";
    cell.style.padding = "12px 10px";
    cell.style.border = "1px solid #c8d2cd";
    cell.style.textAlign = "center";
    cell.style.verticalAlign = "middle";
    cell.style.whiteSpace = "pre-wrap";
    cell.style.overflowWrap = "anywhere";
    cell.style.lineHeight = "1.45";
    cell.style.letterSpacing = "0";
    if (isHeader) {
        cell.style.background = "#e8efea";
        cell.style.color = "#26352e";
        cell.style.fontWeight = "700";
        cell.style.fontSize = "16px";
    } else {
        cell.style.background = rowIndex % 2 === 0 ? "#f7f9fa" : "#ffffff";
        cell.style.color = "#1f2933";
        cell.style.fontWeight = "400";
        cell.style.fontSize = "15px";
    }
}

function buildImageSurface(rows: string[][], title: string, options: CrewExportOptions): HTMLElement {
    const baseWidths = [118, 150, 136, 230];
    if (options.includeTechLevel) baseWidths.push(110);
    const columnWidths = [
        ...baseWidths,
        ...Array.from({ length: Math.max(0, (rows[0]?.length || 0) - baseWidths.length) }, () => 180)
    ];
    const contentWidth = columnWidths.reduce((sum, width) => sum + width, 0);

    const surface = document.createElement("section");
    surface.style.position = "fixed";
    surface.style.left = "-100000px";
    surface.style.top = "0";
    surface.style.boxSizing = "border-box";
    surface.style.width = `${Math.max(900, contentWidth + 64)}px`;
    surface.style.padding = "30px 32px 34px";
    surface.style.background = "#ffffff";
    surface.style.color = "#1f2933";
    surface.style.fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif';

    const heading = document.createElement("h1");
    heading.textContent = title;
    heading.style.margin = "0 0 22px";
    heading.style.padding = "0";
    heading.style.color = "#222a2e";
    heading.style.fontSize = "28px";
    heading.style.fontWeight = "700";
    heading.style.lineHeight = "1.3";
    heading.style.letterSpacing = "0";
    heading.style.textAlign = "center";
    surface.appendChild(heading);

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.tableLayout = "fixed";
    table.style.borderCollapse = "collapse";
    table.style.borderSpacing = "0";

    const colgroup = document.createElement("colgroup");
    columnWidths.forEach((width) => {
        const col = document.createElement("col");
        col.style.width = `${width}px`;
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    (rows[0] || []).forEach((value) => {
        const cell = document.createElement("th");
        cell.textContent = value;
        applyImageCellStyle(cell, true, 0);
        headerRow.appendChild(cell);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.slice(1).forEach((row, rowIndex) => {
        const tableRow = document.createElement("tr");
        row.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            applyImageCellStyle(cell, false, rowIndex);
            tableRow.appendChild(cell);
        });
        tbody.appendChild(tableRow);
    });
    table.appendChild(tbody);
    surface.appendChild(table);
    return surface;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("图片编码失败。"));
        }, "image/png");
    });
}

function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

async function exportImage(
    entries: CrewRosterEntry[],
    customColumns: CrewExportColumn[],
    imageTitle: string,
    options: CrewExportOptions = {}
): Promise<void> {
    if (!html2canvas) throw new Error("图片导出组件未加载，请刷新页面后重试。");

    const rows = buildExportRows(entries, customColumns, options);
    const title = resolveImageTitle(imageTitle);
    const surface = buildImageSurface(rows, title, options);
    document.body.appendChild(surface);

    try {
        const canvas = await html2canvas(surface, {
            backgroundColor: "#ffffff",
            logging: false,
            scale: 2,
            useCORS: true,
            windowWidth: surface.scrollWidth
        });
        const blob = await canvasToBlob(canvas);
        downloadBlob(blob, `${safeFileName(title)}_${formatLocalDate(new Date())}.png`);
    } finally {
        surface.remove();
    }
}

function safeFileName(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "人员名单";
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

    return {
        buildExcelWorkbook,
        exportExcel,
        exportImage
    };
}
