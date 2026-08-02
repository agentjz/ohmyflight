import type * as XlsxRuntime from "xlsx-js-style";

import type {
    SessionBillCompareResult,
    SessionBillLogicApi,
    SessionBillSheet,
    SessionBillSheetRow,
    SessionBillSourceEntry,
    SessionBillStatus,
    SessionBillWorkbook
} from "./models";

export function createSessionBillLogic(XLSX: typeof XlsxRuntime): SessionBillLogicApi {

    const SESSION_HEADERS = ["学员", "教员", "检查员"];
    const BILL_SHEETS = ["全动", "理论"];
    const STATUS_ORDER: SessionBillStatus[] = ["一致", "场次多", "账单多", "仅场次有", "仅账单有"];

    function normalizeText(value: unknown): string {
        return String(value ?? "").trim();
    }

    function normalizeMatchName(value: unknown): string {
        return normalizeText(value).toLocaleLowerCase("en-US");
    }

    function splitNames(value: unknown): string[] {
        return normalizeText(value)
            .split(/[，,]/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function sheetToRows(sheet: SessionBillSheet, sheetName: string): SessionBillSheetRow[] {
        const matrix = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: "",
            blankrows: true
        }) as unknown[][];

        return matrix.map((cells, index) => ({
            sheetName,
            rowNumber: index + 1,
            cells
        }));
    }

    function buildHeaderMap(cells: unknown[]): Map<string, number> {
        const map = new Map<string, number>();
        cells.forEach((value, index) => {
            const text = normalizeText(value);
            if (!text || map.has(text)) return;
            map.set(text, index);
        });
        return map;
    }

    function findHeaderRow(rows: SessionBillSheetRow[], requiredHeaders: string[]): { row: SessionBillSheetRow; headerMap: Map<string, number> } {
        for (const row of rows) {
            const headerMap = buildHeaderMap(row.cells);
            if (requiredHeaders.every((header) => headerMap.has(header))) {
                return { row, headerMap };
            }
        }
        throw new Error(`未找到必要表头：${requiredHeaders.join("、")}`);
    }

    function pushEntry(
        entries: SessionBillSourceEntry[],
        name: string,
        source: "场次" | "账单",
        sheetName: string,
        rowNumber: number,
        role?: string,
        sourceColumn?: string,
        extras: Partial<SessionBillSourceEntry> = {}
    ): void {
        entries.push({
            name,
            matchName: normalizeMatchName(name),
            source,
            sheetName,
            rowNumber,
            role,
            sourceColumn,
            ...extras
        });
    }

    function analyzeSessionWorkbook(workbook: SessionBillWorkbook) {
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("场次表没有工作表。");

        const sheet = workbook.Sheets[sheetName];
        const rows = sheetToRows(sheet, sheetName);
        const { row: headerRow, headerMap } = findHeaderRow(rows, SESSION_HEADERS);
        const dataRows = rows.filter((row) => row.rowNumber > headerRow.rowNumber);
        const entries: SessionBillSourceEntry[] = [];

        dataRows.forEach((row) => {
            SESSION_HEADERS.forEach((header) => {
                const columnIndex = headerMap.get(header);
                if (columnIndex === undefined) return;
                splitNames(row.cells[columnIndex]).forEach((name) => {
                    pushEntry(entries, name, "场次", sheetName, row.rowNumber, header, header, {
                        dateText: normalizeText(row.cells[headerMap.get("日期") ?? -1]),
                        startText: normalizeText(row.cells[headerMap.get("起始时间") ?? -1]),
                        endText: normalizeText(row.cells[headerMap.get("结束时间") ?? -1]),
                        groupText: normalizeText(row.cells[headerMap.get("组号") ?? -1]),
                        natureText: normalizeText(row.cells[headerMap.get("训练性质") ?? -1]),
                        modelText: normalizeText(row.cells[headerMap.get("机型") ?? -1]),
                        deviceText: normalizeText(row.cells[headerMap.get("设备") ?? -1])
                    });
                });
            });
        });

        return {
            entries,
            sheetName,
            rowCount: dataRows.length
        };
    }

    function analyzeBillWorkbook(workbook: SessionBillWorkbook) {
        const entries: SessionBillSourceEntry[] = [];
        const foundSheetNames: string[] = [];
        let rowCount = 0;

        BILL_SHEETS.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) {
                throw new Error(`账单表缺少工作表：${sheetName}`);
            }
            foundSheetNames.push(sheetName);
            const rows = sheetToRows(sheet, sheetName);
            const { row: headerRow, headerMap } = findHeaderRow(rows, ["姓名"]);
            const nameIndex = headerMap.get("姓名");
            const dataRows = rows.filter((row) => row.rowNumber > headerRow.rowNumber);
            rowCount += dataRows.length;

            dataRows.forEach((row) => {
                if (nameIndex === undefined) return;
                const name = normalizeText(row.cells[nameIndex]);
                if (!name) return;
                pushEntry(entries, name, "账单", sheetName, row.rowNumber, undefined, "姓名", {
                    dateText: normalizeText(row.cells[headerMap.get("账单日期") ?? headerMap.get("结束日期") ?? headerMap.get("起始日期") ?? -1]),
                    startText: normalizeText(row.cells[headerMap.get("起始日期") ?? -1]),
                    endText: normalizeText(row.cells[headerMap.get("结束日期") ?? -1]),
                    groupText: normalizeText(row.cells[headerMap.get("显示组号") ?? -1]),
                    natureText: normalizeText(row.cells[headerMap.get("训练性质") ?? -1]),
                    modelText: normalizeText(row.cells[headerMap.get("机型") ?? -1]),
                    deviceText: normalizeText(row.cells[headerMap.get("设备_csn") ?? -1]),
                    quantityText: normalizeText(row.cells[headerMap.get("数量") ?? -1]),
                    amountText: normalizeText(row.cells[headerMap.get("金额") ?? -1])
                });
            });
        });

        return {
            entries,
            sheetNames: foundSheetNames,
            rowCount
        };
    }

    function groupEntries(entries: SessionBillSourceEntry[]): Map<string, SessionBillSourceEntry[]> {
        const groups = new Map<string, SessionBillSourceEntry[]>();
        entries.forEach((entry) => {
            const bucket = groups.get(entry.matchName) || [];
            bucket.push(entry);
            groups.set(entry.matchName, bucket);
        });
        return groups;
    }

    function displayNameForEntries(entries: SessionBillSourceEntry[]): string {
        return entries[0]?.name || "";
    }

    function allDisplayNames(entries: SessionBillSourceEntry[]): string {
        return [...new Set(entries.map((entry) => entry.name).filter(Boolean))].join(" / ");
    }

    function formatRefs(entries: SessionBillSourceEntry[]): string {
        return entries
            .map((entry) => {
                const role = entry.role ? `/${entry.role}` : "";
                return `${entry.sheetName}!第${entry.rowNumber}行${role}`;
            })
            .join("；");
    }

    function resolveStatus(sessionCount: number, billCount: number): SessionBillStatus {
        if (sessionCount > 0 && billCount === 0) return "仅场次有";
        if (sessionCount === 0 && billCount > 0) return "仅账单有";
        if (sessionCount > billCount) return "场次多";
        if (billCount > sessionCount) return "账单多";
        return "一致";
    }

    function buildNote(status: SessionBillStatus, diff: number): string {
        if (status === "一致") return "两边姓名人次一致。";
        if (status === "仅场次有") return "账单表没有该姓名。";
        if (status === "仅账单有") return "场次表没有该姓名。";
        if (status === "场次多") return `场次表多 ${Math.abs(diff)} 次。`;
        return `账单表多 ${Math.abs(diff)} 次。`;
    }

    function compareEntries(
        sessionEntries: SessionBillSourceEntry[],
        billEntries: SessionBillSourceEntry[],
        sourceInfo: { sessionSheetName?: string; billSheetNames?: string[] } = {}
    ): SessionBillCompareResult {
        const sessionGroups = groupEntries(sessionEntries);
        const billGroups = groupEntries(billEntries);
        const matchNames = [...new Set([...sessionGroups.keys(), ...billGroups.keys()])]
            .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
        const statusCounts = STATUS_ORDER.reduce((result, status) => {
            result[status] = 0;
            return result;
        }, {} as Record<SessionBillStatus, number>);

        const rows = matchNames.map((matchName) => {
            const currentSessionEntries = sessionGroups.get(matchName) || [];
            const currentBillEntries = billGroups.get(matchName) || [];
            const allEntries = [...currentSessionEntries, ...currentBillEntries];
            const name = displayNameForEntries(allEntries);
            const sessionCount = currentSessionEntries.length;
            const billCount = currentBillEntries.length;
            const diff = sessionCount - billCount;
            const status = resolveStatus(sessionCount, billCount);
            statusCounts[status] += 1;

            return {
                key: matchName,
                status,
                name,
                matchedNames: allDisplayNames(allEntries),
                sessionCount,
                billCount,
                diff,
                sessionRefs: formatRefs(currentSessionEntries),
                billRefs: formatRefs(currentBillEntries),
                note: buildNote(status, diff)
            };
        });

        const groupsByKey = rows.reduce((groups, row) => {
            groups[row.key] = {
                sessionEntries: sessionGroups.get(row.key) || [],
                billEntries: billGroups.get(row.key) || []
            };
            return groups;
        }, {} as Record<string, { sessionEntries: SessionBillSourceEntry[]; billEntries: SessionBillSourceEntry[] }>);

        const summary = {
            sessionTotal: sessionEntries.length,
            sessionUnique: sessionGroups.size,
            billTotal: billEntries.length,
            billUnique: billGroups.size,
            comparedNames: rows.length,
            matchedNames: statusCounts["一致"],
            mismatchNames: rows.length - statusCounts["一致"],
            statusCounts
        };

        return {
            summary,
            rows,
            sessionEntries,
            billEntries,
            statusRows: STATUS_ORDER.map((status) => ({ status, total: statusCounts[status] })),
            sourceInfo: {
                sessionSheetName: sourceInfo.sessionSheetName || "",
                billSheetNames: sourceInfo.billSheetNames || []
            },
            groupsByKey
        };
    }

    function makeSheet(rows: unknown[][]): SessionBillSheet {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet["!cols"] = rows[0]?.map((_, index) => ({ wch: index <= 1 ? 16 : 24 })) || [];
        return sheet;
    }

    function buildExportWorkbook(result: SessionBillCompareResult): SessionBillWorkbook {
        const workbook = XLSX.utils.book_new();
        const summaryRows = [
            ["指标", "数值"],
            ["场次总人次", result.summary.sessionTotal],
            ["账单总人次", result.summary.billTotal],
            ["参与核对姓名数", result.summary.comparedNames],
            ["一致姓名数", result.summary.matchedNames],
            ["差异姓名数", result.summary.mismatchNames],
            ...result.statusRows.map((row) => [row.status, row.total])
        ];
        const detailRows = [
            ["状态", "姓名", "场次人次", "账单人次", "差异", "场次来源", "账单来源", "说明"],
            ...result.rows.map((row) => [
                row.status,
                row.matchedNames && row.matchedNames !== row.name ? `${row.name}（${row.matchedNames}）` : row.name,
                row.sessionCount,
                row.billCount,
                row.diff,
                row.sessionRefs,
                row.billRefs,
                row.note
            ])
        ];
        const sessionRows = [
            ["姓名", "来源", "Sheet", "行号", "角色", "日期", "开始", "结束", "组号", "训练性质", "机型", "设备"],
            ...result.sessionEntries.map((entry) => [
                entry.name,
                entry.source,
                entry.sheetName,
                entry.rowNumber,
                entry.role || "",
                entry.dateText || "",
                entry.startText || "",
                entry.endText || "",
                entry.groupText || "",
                entry.natureText || "",
                entry.modelText || "",
                entry.deviceText || ""
            ])
        ];
        const billRows = [
            ["姓名", "来源", "Sheet", "行号", "日期", "开始", "结束", "显示组号", "训练性质", "机型", "设备", "数量", "金额"],
            ...result.billEntries.map((entry) => [
                entry.name,
                entry.source,
                entry.sheetName,
                entry.rowNumber,
                entry.dateText || "",
                entry.startText || "",
                entry.endText || "",
                entry.groupText || "",
                entry.natureText || "",
                entry.modelText || "",
                entry.deviceText || "",
                entry.quantityText || "",
                entry.amountText || ""
            ])
        ];

        XLSX.utils.book_append_sheet(workbook, makeSheet(summaryRows), "核对汇总");
        XLSX.utils.book_append_sheet(workbook, makeSheet(detailRows), "姓名差异明细");
        XLSX.utils.book_append_sheet(workbook, makeSheet(sessionRows), "场次拆分明细");
        XLSX.utils.book_append_sheet(workbook, makeSheet(billRows), "账单姓名明细");
        return workbook;
    }

    function buildOutputFileName(): string {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, "0");
        const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `场次账单核对_${stamp}.xlsx`;
    }

    return {
        splitNames,
        analyzeSessionWorkbook,
        analyzeBillWorkbook,
        compareEntries,
        buildExportWorkbook,
        buildOutputFileName
    };
}
