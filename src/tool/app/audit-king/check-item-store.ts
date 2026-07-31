(function () {
    const runtime = window.AuditKing || (window.AuditKing = {});
    const palette = [
        "#c45d7a", "#22c55e", "#3b82f6", "#ef4444",
        "#8b5cf6", "#14b8a6", "#4f7f99", "#64748b"
    ];
    let serial = 0;

    function nextId(prefix: string): string {
        serial += 1;
        return `${prefix}-${Date.now()}-${serial}`;
    }

    function createCheckItem(
        input: Partial<AuditKingImportedCheckItem> = {},
        index = 0
    ): AuditKingCheckItem {
        return {
            id: input.id || nextId("check-item"),
            code: String(input.code || "").trim(),
            name: String(input.name || "").trim(),
            keyword: String(input.keyword || "").trim(),
            color: input.color || palette[index % palette.length],
            enabled: input.enabled !== false,
            source: input.source ? { ...input.source } : undefined,
            manualEvidences: (input.manualEvidences || []).map((evidence) => ({
                ...evidence,
                id: evidence.id || nextId("manual-evidence")
            })),
            auditEvidences: (input.auditEvidences || []).map((evidence) => ({
                id: evidence.id || nextId("audit-evidence"),
                content: String(evidence.content || ""),
                note: String(evidence.note || ""),
                sourceEvidenceId: evidence.sourceEvidenceId || undefined
            }))
        };
    }

    runtime.CheckItemStore = { createCheckItem, nextId, palette };
})();
