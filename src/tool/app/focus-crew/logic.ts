import type * as XlsxRuntime from "xlsx-js-style";

import type {
    FocusCrewCategory,
    FocusCrewCategoryConfigEntry,
    FocusCrewCategoryTotals,
    FocusCrewCollectResult,
    FocusCrewHighlightResult,
    FocusCrewJsonRow,
    FocusCrewLogicApi,
    FocusCrewWorkbook,
    FocusCrewWorksheet,
    FocusSheetInfo
} from "./models";

export function createFocusCrewLogic(XLSX: typeof XlsxRuntime): FocusCrewLogicApi {
    const CATEGORY_CONFIG: Record<FocusCrewCategory, FocusCrewCategoryConfigEntry> = {
        '重点关注': { priority: 1, color: 'F6DADF', label: '重点' },
        '一般关注': { priority: 2, color: 'E4E0F1', label: '一般' },
        '预防性关注': { priority: 3, color: '5b84f9', label: '预防' },
        '三新人员（不上会）': { priority: 4, color: '65c53f', label: '三新' },
        '长期关注': { priority: 5, color: 'a584ed', label: '长期' }
    };

    function normalizeText(value: unknown): string {
        return String(value ?? '').trim();
    }

    function detectCategory(sheetName: string): FocusCrewCategory | null {
        for (const category of Object.keys(CATEGORY_CONFIG) as FocusCrewCategory[]) {
            if (sheetName.includes(category) || category.includes(sheetName)) {
                return category;
            }
        }
        return null;
    }

    function parseFocusWorkbook(workbook: FocusCrewWorkbook): FocusSheetInfo[] {
        const focusSheets: FocusSheetInfo[] = [];

        workbook.SheetNames.forEach(sheetName => {
            const category = detectCategory(sheetName);
            if (!category) return;

            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json<FocusCrewJsonRow>(sheet, { header: 1, raw: false });
            if (rows.length < 2) return;

            const columns = (rows[1] || []).map((cell, index) => cell ? String(cell) : '列' + (index + 1));
            focusSheets.push({
                name: sheetName,
                category,
                columns,
                data: rows
            });
        });

        return focusSheets;
    }

    function collectFocusData(
        focusSheets: FocusSheetInfo[],
        nameColumnBySheetIndex: Record<number, number>
    ): FocusCrewCollectResult {
        const focusData: Record<string, FocusCrewCategory[]> = {};

        focusSheets.forEach((sheetInfo, sheetIndex) => {
            const nameCol = nameColumnBySheetIndex[sheetIndex];
            if (!Number.isInteger(nameCol)) return;

            for (let rowIndex = 2; rowIndex < sheetInfo.data.length; rowIndex++) {
                const row = sheetInfo.data[rowIndex];
                if (!Array.isArray(row) || row.length === 0) continue;

                const name = normalizeText(row[nameCol]);
                if (!name) continue;

                focusData[name] = focusData[name] || [];
                focusData[name].push(sheetInfo.category);
            }
        });

        return {
            focusData,
            focusNames: Object.keys(focusData)
        };
    }

    function uniqueCategoriesForName(focusData: Record<string, FocusCrewCategory[]>, name: string): FocusCrewCategory[] {
        return Array.from(new Set(focusData[name] || []))
            .sort((left, right) => CATEGORY_CONFIG[left].priority - CATEGORY_CONFIG[right].priority);
    }

    function createHighlightedCell(value: unknown, categories: FocusCrewCategory[]) {
        const topCategory = categories[0];
        const labels = categories.map(category => '[' + CATEGORY_CONFIG[category].label + ']').join('');

        return {
            v: normalizeText(value) + labels,
            t: 's',
            s: {
                fill: { patternType: 'solid', fgColor: { rgb: CATEGORY_CONFIG[topCategory].color } },
                alignment: { horizontal: 'left', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: '000000' } },
                    bottom: { style: 'thin', color: { rgb: '000000' } },
                    left: { style: 'thin', color: { rgb: '000000' } },
                    right: { style: 'thin', color: { rgb: '000000' } }
                }
            }
        };
    }

    function buildHighlightedWorkbook(
        scheduleWorkbook: FocusCrewWorkbook,
        scheduleNameCol: number,
        focusData: Record<string, FocusCrewCategory[]>
    ): FocusCrewHighlightResult {
        const resultWorkbook = XLSX.utils.book_new();
        const matchedCategories: FocusCrewCategoryTotals = {};
        const sheetMatchCounts: Record<string, number> = {};

        scheduleWorkbook.SheetNames.forEach(sheetName => {
            const sourceSheet = scheduleWorkbook.Sheets[sheetName];
            const range = XLSX.utils.decode_range(sourceSheet['!ref'] || 'A1');
            const newSheet: FocusCrewWorksheet = {};
            let matchCount = 0;

            for (let rowIndex = 0; rowIndex <= range.e.r; rowIndex++) {
                for (let colIndex = 0; colIndex <= range.e.c; colIndex++) {
                    const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                    const sourceCell = sourceSheet[addr];
                    if (!sourceCell) continue;

                    const name = rowIndex > 0 && colIndex === scheduleNameCol
                        ? normalizeText(sourceCell.v)
                        : '';
                    const categories = name ? uniqueCategoriesForName(focusData, name) : [];

                    if (categories.length > 0) {
                        newSheet[addr] = createHighlightedCell(sourceCell.v, categories);
                        matchCount++;
                        categories.forEach(category => {
                            matchedCategories[category] = (matchedCategories[category] || 0) + 1;
                        });
                    } else {
                        newSheet[addr] = {
                            v: sourceCell.v,
                            t: sourceCell.t || 's',
                            s: sourceCell.s || {}
                        };
                    }
                }
            }

            newSheet['!ref'] = sourceSheet['!ref'];
            if (sourceSheet['!cols']) newSheet['!cols'] = sourceSheet['!cols'];
            if (sourceSheet['!rows']) newSheet['!rows'] = sourceSheet['!rows'];

            XLSX.utils.book_append_sheet(resultWorkbook, newSheet, sheetName);
            sheetMatchCounts[sheetName] = matchCount;
        });

        return {
            workbook: resultWorkbook,
            matchedCategories,
            sheetMatchCounts
        };
    }

    return {
        CATEGORY_CONFIG,
        detectCategory,
        parseFocusWorkbook,
        collectFocusData,
        buildHighlightedWorkbook
    };
}
