import type { AuditKingEvidenceGroup } from "./models";

export function createAuditKingExport(XLSX: typeof import("xlsx-js-style")) {

    function buildEvidenceRows(groups: AuditKingEvidenceGroup[]): Array<Array<string | number>> {
        return [
            ["条款名称", "依据序号", "依据内容", "备注"],
            ...groups.flatMap((group) => group.items.length
                ? group.items.map((item, index) => [group.title, index + 1, item.content, item.note])
                : [[group.title, 0, "", ""]])
        ];
    }

    function buildEvidenceWorkbook(groups: AuditKingEvidenceGroup[]): any {
        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet(buildEvidenceRows(groups));
        sheet["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 64 }, { wch: 32 }];
        XLSX.utils.book_append_sheet(workbook, sheet, "审计篮子");
        return workbook;
    }

    return { buildEvidenceRows, buildEvidenceWorkbook };
}
