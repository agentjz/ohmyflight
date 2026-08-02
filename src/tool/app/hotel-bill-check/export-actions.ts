import { buildProofLinkColumns, getProofColumnCount } from "./logic";
import type { HotelBillContext } from "./models";
import { getSelectedCols } from "./view";

const hyperlinkStyle = {
        font: { color: { rgb: "0000FF" }, underline: true }
    };

export function makeHyperlinkCell(url: string, display: string): Record<string, unknown> {
        return {
            f: '=HYPERLINK("' + url + '","' + display + '")',
            t: 'str',
            s: hyperlinkStyle
        };
    }
export function exportExcel(context: HotelBillContext, selectColumns: (type: string) => number[] = getSelectedCols): void {
        if (context.state.matchResults.length === 0) return;

        const billDisplayCols = selectColumns('bill');
        const checkinDisplayCols = selectColumns('checkin');
        const proofColumnCount = getProofColumnCount(context.state.matchResults, context.state.checkinColumns, context.state.checkinHyperlinks);
        const worksheet: import("xlsx-js-style").WorkSheet = {};
        const colCount = 1 + billDisplayCols.length + checkinDisplayCols.length + proofColumnCount;

        let col = 0;
        worksheet[context.XLSX.utils.encode_cell({ r: 0, c: col++ })] = { v: '匹配状态', t: 's' };
        billDisplayCols.forEach(index => {
            worksheet[context.XLSX.utils.encode_cell({ r: 0, c: col++ })] = { v: '[账单] ' + context.state.billColumns[index], t: 's' };
        });
        checkinDisplayCols.forEach(index => {
            worksheet[context.XLSX.utils.encode_cell({ r: 0, c: col++ })] = { v: '[登记] ' + context.state.checkinColumns[index], t: 's' };
        });
        buildProofLinkColumns(context.state.matchResults[0], proofColumnCount, context.state.checkinColumns, context.state.checkinHyperlinks).forEach(proofColumn => {
            worksheet[context.XLSX.utils.encode_cell({ r: 0, c: col++ })] = { v: proofColumn.header, t: 's' };
        });

        context.state.matchResults.forEach((result, rowIndex) => {
            const row = rowIndex + 1;
            let currentColumn = 0;
            worksheet[context.XLSX.utils.encode_cell({ r: row, c: currentColumn++ })] = { v: result.status === 'matched' ? '匹配' : result.status === 'duplicate' ? '重复匹配' : '无登记', t: 's' };

            billDisplayCols.forEach(columnIndex => {
                const link = context.state.billHyperlinks[result.billIdx] && context.state.billHyperlinks[result.billIdx][columnIndex];
                worksheet[context.XLSX.utils.encode_cell({ r: row, c: currentColumn++ })] = link
                    ? makeHyperlinkCell(link.url, link.display)
                    : { v: result.billRow[columnIndex] || '', t: 's' };
            });

            if (result.checkinRow) {
                checkinDisplayCols.forEach(columnIndex => {
                    const link = context.state.checkinHyperlinks[result.checkinIdx] && context.state.checkinHyperlinks[result.checkinIdx][columnIndex];
                    worksheet[context.XLSX.utils.encode_cell({ r: row, c: currentColumn++ })] = link
                        ? makeHyperlinkCell(link.url, link.display)
                        : { v: result.checkinRow?.[columnIndex] || '', t: 's' };
                });
            } else {
                checkinDisplayCols.forEach(() => {
                    worksheet[context.XLSX.utils.encode_cell({ r: row, c: currentColumn++ })] = { v: '-', t: 's' };
                });
            }

            buildProofLinkColumns(result, proofColumnCount, context.state.checkinColumns, context.state.checkinHyperlinks).forEach(proofColumn => {
                worksheet[context.XLSX.utils.encode_cell({ r: row, c: currentColumn++ })] = proofColumn.link
                    ? makeHyperlinkCell(proofColumn.link.url, proofColumn.link.display)
                    : { v: '', t: 's' };
            });
        });

        worksheet['!ref'] = context.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: context.state.matchResults.length, c: colCount - 1 } });
        worksheet['!cols'] = Array(colCount).fill({ wch: 15 });

        const workbook = context.XLSX.utils.book_new();
        context.XLSX.utils.book_append_sheet(workbook, worksheet, '对比结果');
        context.XLSX.writeFile(workbook, '账单对比结果.xlsx');
    }
