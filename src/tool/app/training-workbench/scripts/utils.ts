import { TrainingToolConfig } from "./config";
import { TrainingXlsx as XLSX } from "./browser-vendors";
import type { TrainingToolSheetInfo, TrainingToolSheetRow, TrainingToolWorksheet } from "./models";

const Config = TrainingToolConfig;
  const CENTER_ALIGNMENT = { horizontal: "center", vertical: "center" };

  function normalizeText(value: unknown): string {
    return String(value ?? "").trim();
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad(value: string | number): string {
    return String(value).padStart(2, "0");
  }

  function makeDate(year: number, month: number, day: number): Date {
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.valueOf());
  }

  function cloneDate(value: unknown): Date | null {
    return isValidDate(value)
      ? makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate())
      : null;
  }

  function excelSerialToDate(serial: number): Date | null {
    if (!Number.isFinite(serial)) return null;
    const epoch = Date.UTC(1899, 11, 30);
    const milliseconds = Math.round(serial * 86400000);
    const date = new Date(epoch + milliseconds);
    if (!isValidDate(date)) return null;
    return makeDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function isNullLikeText(text: unknown): boolean {
    return Config.NULL_LIKE_VALUES.includes(normalizeText(text));
  }

  function parseDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === "") return null;
    if (isValidDate(value)) return cloneDate(value);
    if (typeof value === "number" && Number.isFinite(value)) return excelSerialToDate(value);

    const text = normalizeText(value);
    if (!text || isNullLikeText(text)) return null;

    let matched = text
      .replace(/\//g, "-")
      .replace(/\./g, "-")
      .replace("T", " ")
      .match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matched) {
      return makeDate(Number(matched[1]), Number(matched[2]), Number(matched[3]));
    }

    matched = text.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (matched) {
      return makeDate(Number(matched[1]), Number(matched[2]), Number(matched[3]));
    }

    return null;
  }

  function formatDate(value: unknown): string {
    return isValidDate(value)
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : "";
  }

  function toMonthKey(value: unknown): string {
    const date = parseDate(value);
    return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}` : "";
  }

  function sortMonthKeys(values: string[]) {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
  }

  function monthRangeFromKey(monthKey: unknown): { start: Date; end: Date } | null {
    const matched = normalizeText(monthKey).match(/^(\d{4})-(\d{2})$/);
    if (!matched) return null;
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const start = makeDate(year, month, 1);
    const end = makeDate(year, month, new Date(year, month, 0).getDate());
    return { start, end };
  }

  function rangesOverlap(startA: Date | null, endA: Date | null, startB: Date | null, endB: Date | null): boolean {
    if (!startA || !endA || !startB || !endB) return false;
    return startA <= endB && startB <= endA;
  }

  function daysBetween(later: Date, earlier: Date): number {
    return Math.round((later.getTime() - earlier.getTime()) / 86400000);
  }

  function normalizeProjectName(name: unknown): string {
    const text = normalizeText(name);
    if (!text) return "";
    return Config.PROJECT_ALIAS_LOOKUP.get(text) || text;
  }

  function normalizeYes(value: unknown): boolean {
    const text = normalizeText(value);
    return Config.TRUE_LIKE_VALUES.includes(text);
  }

  function hasMeaningfulValue(value: unknown): boolean {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return normalizeText(value) !== "";
    return true;
  }

  function buildHeaderMap(headers: unknown[]): Map<string, number> {
    const map = new Map<string, number>();
    headers.forEach((header, index) => {
      const normalized = normalizeText(header);
      if (!normalized || map.has(normalized)) return;
      map.set(normalized, index);
    });
    return map;
  }

  function findHeaderIndex(sheetInfo: Pick<TrainingToolSheetInfo, "headerMap">, headerName: unknown): number {
    return sheetInfo.headerMap.has(normalizeText(headerName))
      ? sheetInfo.headerMap.get(normalizeText(headerName))!
      : -1;
  }

  function getValueByHeader(row: TrainingToolSheetRow, sheetInfo: Pick<TrainingToolSheetInfo, "headerMap">, headerName: unknown): unknown {
    const index = findHeaderIndex(sheetInfo, headerName);
    return index >= 0 ? row.cells[index] : null;
  }

  function normalizeNumberLike(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = normalizeText(value);
    if (!text) return 0;
    const direct = Number(text);
    if (Number.isFinite(direct)) return direct;
    const matched = text.match(/-?\d+(?:\.\d+)?/);
    return matched ? Number(matched[0]) : 0;
  }

  function buildPersonKey(name: unknown, employeeId: unknown): string {
    return `${normalizeText(name)}@@${normalizeText(employeeId)}`;
  }

  function cloneSimple<T>(value: T): T {
    if (isValidDate(value)) return cloneDate(value) as T;
    if (Array.isArray(value)) return value.map((item) => cloneSimple(item)) as T;
    if (!value || typeof value !== "object") return value;
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    Object.keys(value).forEach((key) => {
      result[key] = cloneSimple(source[key]);
    });
    return result as T;
  }

  function deepClone<T>(value: T): T {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (error) {
        return cloneSimple(value);
      }
    }
    return cloneSimple(value);
  }

  function cloneStyle(style: Record<string, unknown> | null | undefined): Record<string, unknown> {
    return style ? deepClone(style) : {};
  }

  function mergeStyle(baseStyle: Record<string, unknown> | null | undefined, patchStyle: Record<string, unknown>): Record<string, unknown> {
    const base = cloneStyle(baseStyle);
    Object.keys(patchStyle || {}).forEach((key) => {
      const baseValue = base[key];
      const patchValue = patchStyle[key];
      if (
        baseValue &&
        patchValue &&
        typeof baseValue === "object" &&
        typeof patchValue === "object" &&
        !Array.isArray(baseValue) &&
        !Array.isArray(patchValue)
      ) {
        base[key] = mergeStyle(
          baseValue as Record<string, unknown>,
          patchValue as Record<string, unknown>
        );
      } else {
        base[key] = deepClone(patchValue);
      }
    });
    return base;
  }

  function inferCellType(value: unknown): string {
    if (isValidDate(value)) return "d";
    if (typeof value === "number") return "n";
    if (typeof value === "boolean") return "b";
    return "s";
  }

  function expandSheetRef(sheet: TrainingToolWorksheet, rowIndex: number, columnIndex: number): void {
    const current = sheet["!ref"]
      ? XLSX.utils.decode_range(sheet["!ref"])
      : { s: { r: rowIndex, c: columnIndex }, e: { r: rowIndex, c: columnIndex } };
    current.s.r = Math.min(current.s.r, rowIndex);
    current.s.c = Math.min(current.s.c, columnIndex);
    current.e.r = Math.max(current.e.r, rowIndex);
    current.e.c = Math.max(current.e.c, columnIndex);
    sheet["!ref"] = XLSX.utils.encode_range(current);
  }

  function writeCell(sheet: TrainingToolWorksheet, rowNumber: number, columnIndex: number, value: unknown, style?: Record<string, unknown>, typeHint?: string): string {
    const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
    const cell: { v: unknown; t: string; z?: string; s?: unknown } = {
      v: value,
      t: typeHint || inferCellType(value)
    };

    if (cell.t === "d") {
      cell.z = Config.LONG_DATE_FORMAT;
    }

    if (style) {
      cell.s = deepClone(style);
    }

    sheet[address] = cell;
    expandSheetRef(sheet, rowNumber - 1, columnIndex);
    return address;
  }

  function writeDateCell(sheet: TrainingToolWorksheet, rowNumber: number, columnIndex: number, dateValue: Date): string {
    const address = XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex });
    const current = sheet[address] || {};
    const next = {
      ...current,
      t: "d",
      v: cloneDate(dateValue),
      z: Config.LONG_DATE_FORMAT
    };

    next.s = mergeStyle(
      current.s as Record<string, unknown> | undefined,
      {
        numFmt: Config.LONG_DATE_FORMAT,
        alignment: CENTER_ALIGNMENT
      }
    );

    delete next.w;
    sheet[address] = next;
    expandSheetRef(sheet, rowNumber - 1, columnIndex);
    return address;
  }

  function centerAlignSheet(sheet: TrainingToolWorksheet): void {
    Object.keys(sheet || {}).forEach((address) => {
      if (address.startsWith("!")) return;
      const cell = sheet[address];
      if (!cell || typeof cell !== "object") return;
      cell.s = mergeStyle(cell.s as Record<string, unknown> | undefined, { alignment: CENTER_ALIGNMENT });
    });
  }

  function computeSheetWidths(rows: unknown[][]): Array<{ wch: number }> {
    const widths: number[] = [];
    rows.forEach((row) => {
      row.forEach((value, index) => {
        const text = String(value ?? "");
        widths[index] = Math.min(42, Math.max(widths[index] || 10, text.length + 2));
      });
    });
    return widths.map((wch) => ({ wch }));
  }

  function getSheetBounds(sheet: TrainingToolWorksheet | null | undefined): { startRow: number; startColumn: number; endRow: number; endColumn: number } {
    if (!sheet || !sheet["!ref"]) {
      return { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 };
    }
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    return {
      startRow: range.s.r,
      startColumn: range.s.c,
      endRow: range.e.r,
      endColumn: range.e.c
    };
  }

  function stripExtension(fileName: unknown): string {
    return normalizeText(fileName).replace(/\.[^.]+$/, "");
  }

  function buildTimestamp(): string {
    const now = new Date();
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join("") + "_" + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");
  }

  function buildOutputFileName(sourceFileName: unknown, actionLabel: unknown): string {
    return `${stripExtension(sourceFileName)}_${actionLabel}_${buildTimestamp()}.xlsx`;
  }

  function sanitizeSheetName(name: unknown): string {
    return normalizeText(name).replace(/[\\/?*[\]:]/g, " ").trim();
  }

  function errorMessage(error: unknown, fallback = "操作失败。"): string {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message || fallback;
  }
  export const TrainingToolUtils = {
    normalizeText,
    escapeHtml,
    pad,
    makeDate,
    isValidDate,
    cloneDate,
    parseDate,
    formatDate,
    toMonthKey,
    sortMonthKeys,
    monthRangeFromKey,
    rangesOverlap,
    daysBetween,
    normalizeProjectName,
    normalizeYes,
    hasMeaningfulValue,
    isNullLikeText,
    buildHeaderMap,
    findHeaderIndex,
    getValueByHeader,
    normalizeNumberLike,
    buildPersonKey,
    deepClone,
    cloneStyle,
    mergeStyle,
    expandSheetRef,
    writeCell,
    writeDateCell,
    centerAlignSheet,
    computeSheetWidths,
    getSheetBounds,
    buildOutputFileName,
    sanitizeSheetName,
    errorMessage
  };
