import type { HotelBillContext, HotelBillHyperlinkMap, HotelBillWorkbookRow, HotelBillWorkSheet } from "./models";
import { renderColumnSelectors, renderDisplayCols, renderPreview, showStatus } from "./view";

export function extractHyperlinks(context: HotelBillContext, sheet: HotelBillWorkSheet, headerRow: number): HotelBillHyperlinkMap {
        const links: HotelBillHyperlinkMap = {};
        const range = context.XLSX.utils.decode_range(sheet['!ref'] || 'A1');

        for (let row = headerRow + 1; row <= range.e.r; row++) {
            const rowIndex = row - headerRow - 1;
            links[rowIndex] = {};

            for (let column = range.s.c; column <= range.e.c; column++) {
                const address = context.XLSX.utils.encode_cell({ r: row, c: column });
                const cell = sheet[address];
                if (!cell) continue;

                if (cell.l && cell.l.Target) {
                    links[rowIndex][column] = { url: cell.l.Target, display: cell.v || '' };
                } else if (cell.f && cell.f.includes('HYPERLINK')) {
                    const match = cell.f.match(/HYPERLINK\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/i);
                    if (match) {
                        links[rowIndex][column] = { url: match[1], display: match[2] };
                    }
                }
            }
        }
        return links;
    }
export function loadBillPreview(context: HotelBillContext): void {
        if (!context.state.billWorkbook) return;
        const headerRow = Number.parseInt(context.getInput('billHeaderRow').value, 10);
        const sheet = context.state.billWorkbook.Sheets[context.state.billWorkbook.SheetNames[0]];
        const rows = context.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as HotelBillWorkbookRow[];

        if (rows.length <= headerRow) {
            showStatus(context, 'billStatus', '表头行超出数据范围', 'error');
            return;
        }

        context.state.billColumns = (rows[headerRow] || []).map((cell, index) => String(cell || '列' + (index + 1)));
        context.state.billData = rows.slice(headerRow + 1);
        context.state.billHyperlinks = extractHyperlinks(context, sheet, headerRow);

        renderPreview(context, 'bill', context.state.billColumns, context.state.billData.slice(0, 5));
        renderColumnSelectors(context, 'bill', context.state.billColumns);
        renderDisplayCols(context, 'bill', context.state.billColumns);
        context.getElement('billConfigSection').style.display = 'block';
        checkAllReady(context);
    }

export function loadCheckinPreview(context: HotelBillContext): void {
        if (!context.state.checkinWorkbook) return;
        const headerRow = Number.parseInt(context.getInput('checkinHeaderRow').value, 10);
        const sheet = context.state.checkinWorkbook.Sheets[context.state.checkinWorkbook.SheetNames[0]];
        const rows = context.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as HotelBillWorkbookRow[];

        if (rows.length <= headerRow) {
            showStatus(context, 'checkinStatus', '表头行超出数据范围', 'error');
            return;
        }

        context.state.checkinColumns = (rows[headerRow] || []).map((cell, index) => String(cell || '列' + (index + 1)));
        context.state.checkinData = rows.slice(headerRow + 1);
        context.state.checkinHyperlinks = extractHyperlinks(context, sheet, headerRow);

        renderPreview(context, 'checkin', context.state.checkinColumns, context.state.checkinData.slice(0, 5));
        renderColumnSelectors(context, 'checkin', context.state.checkinColumns);
        renderDisplayCols(context, 'checkin', context.state.checkinColumns);
        context.getElement('checkinConfigSection').style.display = 'block';
        checkAllReady(context);
    }

function checkAllReady(context: HotelBillContext): void {
        if (context.state.billData.length > 0 && context.state.checkinData.length > 0) {
            context.getElement('matchSection').style.display = 'block';
        }
    }

export function handleBillFile(context: HotelBillContext, event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (readerEvent: ProgressEvent<FileReader>) {
            try {
                const result = readerEvent.target?.result;
                if (!(result instanceof ArrayBuffer)) {
                    throw new Error('文件读取结果不是 ArrayBuffer');
                }
                context.state.billWorkbook = context.XLSX.read(new Uint8Array(result), { type: 'array', cellFormula: true, cellStyles: true });
                showStatus(context, 'billStatus', '已加载: ' + file.name, 'success');
                loadBillPreview(context);
            } catch (error) {
                showStatus(context, 'billStatus', '文件解析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
export function handleCheckinFile(context: HotelBillContext, event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (readerEvent: ProgressEvent<FileReader>) {
            try {
                const result = readerEvent.target?.result;
                if (!(result instanceof ArrayBuffer)) {
                    throw new Error('文件读取结果不是 ArrayBuffer');
                }
                context.state.checkinWorkbook = context.XLSX.read(new Uint8Array(result), { type: 'array', cellFormula: true, cellStyles: true });
                showStatus(context, 'checkinStatus', '已加载: ' + file.name, 'success');
                loadCheckinPreview(context);
            } catch (error) {
                showStatus(context, 'checkinStatus', '文件解析失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
