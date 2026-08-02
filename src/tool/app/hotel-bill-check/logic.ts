import type {
    HotelBillHyperlinkInfo,
    HotelBillHyperlinkMap,
    HotelBillMatchInput,
    HotelBillMatchOutput,
    HotelBillMatchResult,
    HotelBillMatchStatus,
    HotelBillProofLinkColumn,
    HotelBillWorkbookRow
} from "./models";

export function parseDate(value: unknown): Date | null {
        if (!value) return null;

        let parsed: Date | null = null;
        const text = String(value).trim();

        if (value instanceof Date) {
            parsed = value;
        } else if (/^\d{8}$/.test(text)) {
            parsed = new Date(text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6, 8));
        } else if (/^\d+$/.test(text) && Number.parseInt(text, 10) > 40000) {
            parsed = new Date((Number.parseInt(text, 10) - 25569) * 86400 * 1000);
        } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(text)) {
            const parts = text.split('/');
            parsed = new Date(2000 + Number.parseInt(parts[0], 10), Number.parseInt(parts[1], 10) - 1, Number.parseInt(parts[2], 10));
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2}\s+\d{1,2}:\d{2}/.test(text)) {
            const parts = text.split(/[\s\/]+/);
            parsed = new Date(2000 + Number.parseInt(parts[2], 10), Number.parseInt(parts[0], 10) - 1, Number.parseInt(parts[1], 10));
        } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(text)) {
            const parts = text.split('/');
            parsed = new Date(2000 + Number.parseInt(parts[2], 10), Number.parseInt(parts[0], 10) - 1, Number.parseInt(parts[1], 10));
        } else if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(text)) {
            const parts = text.split(/[-\/\s:]+/);
            parsed = new Date(Number.parseInt(parts[0], 10), Number.parseInt(parts[1], 10) - 1, Number.parseInt(parts[2], 10));
        } else {
            parsed = new Date(text);
        }

        if (parsed && !Number.isNaN(parsed.getTime())) {
            return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
        return null;
    }
function dayDiff(left: Date, right: Date): number {
        return Math.abs((left.getTime() - right.getTime()) / (1000 * 60 * 60 * 24));
    }

export function matchRows(input: HotelBillMatchInput): HotelBillMatchOutput {
        const results: HotelBillMatchResult[] = [];
        const matchedCheckinIdx = new Set<number>();
        const skippedBillLogs: Array<Record<string, unknown>> = [];
        const candidateLogs: Array<Record<string, unknown>> = [];

        input.billData.forEach((billRow, billIdx) => {
            const billName = String(billRow[input.billNameCol] || '').trim();
            const billDate = parseDate(billRow[input.billDateCol]);

            if (!billName || !billDate) {
                skippedBillLogs.push({
                    billIdx,
                    billName,
                    billDateRaw: billRow[input.billDateCol],
                    parsed: billDate
                });
                return;
            }

            let bestMatch: HotelBillWorkbookRow | null = null;
            let bestMatchIdx = -1;
            let bestDiff = Infinity;

            input.checkinData.forEach((checkinRow, checkinIdx) => {
                const checkinName = String(checkinRow[input.checkinNameCol] || '').trim();
                if (checkinName !== billName) return;

                const checkinDate = parseDate(checkinRow[input.checkinDateCol]);
                if (!checkinDate) return;

                const diff = dayDiff(billDate, checkinDate);
                if (candidateLogs.length < 30) {
                    candidateLogs.push({
                        billIdx,
                        checkinIdx,
                        name: billName,
                        billDate,
                        billDateRaw: billRow[input.billDateCol],
                        checkinDate,
                        checkinDateRaw: checkinRow[input.checkinDateCol],
                        diff
                    });
                }
                if (diff <= input.tolerance && diff < bestDiff) {
                    bestMatch = checkinRow;
                    bestMatchIdx = checkinIdx;
                    bestDiff = diff;
                }
            });

            let status: HotelBillMatchStatus = 'unmatched';
            if (bestMatch) {
                status = matchedCheckinIdx.has(bestMatchIdx) ? 'duplicate' : 'matched';
                matchedCheckinIdx.add(bestMatchIdx);
            }

            results.push({
                status,
                billRow,
                billIdx,
                checkinRow: bestMatch,
                checkinIdx: bestMatchIdx
            });
        });

        return { results, skippedBillLogs, candidateLogs };
    }

export function getProofLinks(
        result: HotelBillMatchResult,
        checkinColumns: string[],
        checkinHyperlinks: HotelBillHyperlinkMap
    ): HotelBillHyperlinkInfo[] {
        if (!result.checkinRow || !checkinHyperlinks[result.checkinIdx]) return [];

        const proofLinks: HotelBillHyperlinkInfo[] = [];
        Object.keys(checkinHyperlinks[result.checkinIdx]).forEach(colIdx => {
            const columnIndex = Number.parseInt(colIdx, 10);
            const colName = checkinColumns[columnIndex] || '';
            if (colName.includes('证明') || colName.includes('文件')) {
                proofLinks.push(checkinHyperlinks[result.checkinIdx][columnIndex]);
            }
        });
        return proofLinks;
    }

export function getProofColumnCount(
        results: HotelBillMatchResult[],
        checkinColumns: string[],
        checkinHyperlinks: HotelBillHyperlinkMap
    ): number {
        return Math.max(1, ...results.map(result => getProofLinks(result, checkinColumns, checkinHyperlinks).length));
    }

export function buildProofLinkColumns(
        result: HotelBillMatchResult,
        columnCount: number,
        checkinColumns: string[],
        checkinHyperlinks: HotelBillHyperlinkMap
    ): HotelBillProofLinkColumn[] {
        const proofLinks = getProofLinks(result, checkinColumns, checkinHyperlinks);
        return Array.from({ length: columnCount }, (_, index) => ({
            header: columnCount === 1 ? '入住证明' : '入住证明' + (index + 1),
            link: proofLinks[index] || null
        }));
    }
