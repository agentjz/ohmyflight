import type {
    AuditKingAuditEvidence,
    AuditKingCheckItem,
    AuditKingCheckItemSource,
    AuditKingImportedCheckItem,
    AuditKingManualEvidence
} from "./models";

export function createAuditKingCheckItemWorkbook(XLSX: typeof import("xlsx-js-style")) {
    const itemHeaders = [
        "序号", "检查编号", "检查项名称", "关键词", "启用", "颜色",
        "检查单段落", "检查单段落序号", "来源起点", "来源终点", "来源文本", "来源前文", "来源后文"
    ];
    const manualHeaders = [
        "检查项序号", "证据序号", "证据ID", "证据来源", "手册名称", "手册ID", "手册段落", "手册段落序号", "PDF页码",
        "章节标题", "证据起点", "证据终点", "全文起点", "全文终点", "证据文本", "证据前文", "证据后文", "命中类型", "备注"
    ];
    const auditHeaders = ["检查项序号", "依据序号", "依据内容", "备注", "来源证据ID"];

    function text(value: unknown): string {
        return value === null || value === undefined ? "" : String(value).trim();
    }

    function number(value: unknown): number | undefined {
        if (value === null || value === undefined || value === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    function rows(sheet: any): Record<string, unknown>[] {
        return XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" }) as Record<string, unknown>[];
    }

    function requireCurrentWorkbook(workbook: any): void {
        const required = ["检查项", "手册证据", "审计依据"];
        if (!required.every((name) => workbook.Sheets?.[name])) {
            throw new Error("不是当前审计之王检查项工作簿，必须包含检查项、手册证据、审计依据三个工作表。");
        }
    }

    function buildItemRows(items: AuditKingCheckItem[]): Array<Array<string | number>> {
        return [itemHeaders, ...items.map((item, index) => [
            index + 1, item.code, item.name, item.keyword, item.enabled === false ? "否" : "是", item.color,
            item.source?.blockId || "", item.source?.blockIndex ?? "", item.source?.start ?? "", item.source?.end ?? "",
            item.source?.text || "", item.source?.beforeText || "", item.source?.afterText || ""
        ])];
    }

    function buildManualRows(items: AuditKingCheckItem[]): Array<Array<string | number>> {
        return [manualHeaders, ...items.flatMap((item, itemIndex) => item.manualEvidences.map((evidence, evidenceIndex) => [
            itemIndex + 1, evidenceIndex + 1, evidence.id || "", evidence.sourceType || "", evidence.documentName, evidence.documentId || "",
            evidence.blockId || "", evidence.blockIndex ?? "", evidence.pageNumber ?? "", evidence.title || "",
            evidence.start ?? "", evidence.end ?? "", evidence.globalStart ?? "", evidence.globalEnd ?? "", evidence.text,
            evidence.beforeText || "", evidence.afterText || "", evidence.mode || "", evidence.note || ""
        ]))];
    }

    function buildAuditRows(items: AuditKingCheckItem[]): Array<Array<string | number>> {
        return [auditHeaders, ...items.flatMap((item, itemIndex) => item.auditEvidences.map((evidence, evidenceIndex) => [
            itemIndex + 1, evidenceIndex + 1, evidence.content, evidence.note, evidence.sourceEvidenceId || ""
        ]))];
    }

    function appendSheet(workbook: any, data: Array<Array<string | number>>, name: string, widths: number[]): void {
        const sheet = XLSX.utils.aoa_to_sheet(data);
        sheet["!cols"] = widths.map((wch) => ({ wch }));
        XLSX.utils.book_append_sheet(workbook, sheet, name);
    }

    function buildWorkbook(items: AuditKingCheckItem[]): any {
        const workbook = XLSX.utils.book_new();
        appendSheet(workbook, buildItemRows(items), "检查项", [8, 14, 42, 28, 8, 12, 30, 14, 10, 10, 28, 28, 28]);
        appendSheet(workbook, buildManualRows(items), "手册证据", [12, 10, 26, 12, 30, 24, 26, 14, 10, 24, 10, 10, 10, 10, 48, 28, 28, 12, 24]);
        appendSheet(workbook, buildAuditRows(items), "审计依据", [12, 10, 64, 32, 26]);
        return workbook;
    }

    function parseSource(row: Record<string, unknown>): AuditKingCheckItemSource | undefined {
        const source: AuditKingCheckItemSource = {
            blockId: text(row["检查单段落"]) || undefined,
            blockIndex: number(row["检查单段落序号"]),
            start: number(row["来源起点"]),
            end: number(row["来源终点"]),
            text: text(row["来源文本"]) || undefined,
            beforeText: text(row["来源前文"]) || undefined,
            afterText: text(row["来源后文"]) || undefined
        };
        return Object.values(source).some((value) => value !== undefined) ? source : undefined;
    }

    function parseWorkbook(workbook: any): AuditKingImportedCheckItem[] {
        requireCurrentWorkbook(workbook);
        const itemRows = rows(workbook.Sheets["检查项"]);
        const manualRows = rows(workbook.Sheets["手册证据"]);
        const auditRows = rows(workbook.Sheets["审计依据"]);
        const ordered = itemRows.map((row, rowIndex) => ({ row, rowIndex, order: number(row["序号"]) }))
            .filter(({ row }) => ["检查编号", "检查项名称", "关键词"].some((header) => text(row[header])))
            .sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.rowIndex - right.rowIndex);

        return ordered.map(({ row, order }, itemIndex) => {
            const workbookPosition = order ?? itemIndex + 1;
            const manualEvidences = manualRows
                .filter((manualRow) => number(manualRow["检查项序号"]) === workbookPosition)
                .map((manualRow): AuditKingManualEvidence => ({
                    id: text(manualRow["证据ID"]) || undefined,
                    sourceType: text(manualRow["证据来源"]) as AuditKingManualEvidence["sourceType"],
                    documentName: text(manualRow["手册名称"]),
                    documentId: text(manualRow["手册ID"]),
                    blockId: text(manualRow["手册段落"]),
                    blockIndex: number(manualRow["手册段落序号"]),
                    pageNumber: number(manualRow["PDF页码"]),
                    title: text(manualRow["章节标题"]),
                    start: number(manualRow["证据起点"]), end: number(manualRow["证据终点"]),
                    globalStart: number(manualRow["全文起点"]), globalEnd: number(manualRow["全文终点"]),
                    text: text(manualRow["证据文本"]), beforeText: text(manualRow["证据前文"]), afterText: text(manualRow["证据后文"]),
                    mode: text(manualRow["命中类型"]) as AuditKingManualEvidence["mode"], note: text(manualRow["备注"])
                }))
                .filter((evidence) => evidence.documentName && evidence.text);
            const auditEvidences = auditRows
                .filter((auditRow) => number(auditRow["检查项序号"]) === workbookPosition)
                .map((auditRow, evidenceIndex): AuditKingAuditEvidence => ({
                    id: `imported-audit-${itemIndex + 1}-${evidenceIndex + 1}`,
                    content: text(auditRow["依据内容"]),
                    note: text(auditRow["备注"]),
                    sourceEvidenceId: text(auditRow["来源证据ID"]) || undefined
                }))
                .filter((evidence) => evidence.content || evidence.note);
            return {
                order: workbookPosition,
                code: text(row["检查编号"]),
                name: text(row["检查项名称"]),
                keyword: text(row["关键词"]),
                enabled: !["否", "停用", "false", "0"].includes(text(row["启用"]).toLowerCase()),
                color: text(row["颜色"]) || undefined,
                source: parseSource(row),
                manualEvidences,
                auditEvidences
            };
        });
    }

    return { itemHeaders, manualHeaders, auditHeaders, buildWorkbook, parseWorkbook };
}
