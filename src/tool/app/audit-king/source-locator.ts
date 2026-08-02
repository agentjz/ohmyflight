import type {
    AuditKingCheckItem,
    AuditKingCheckItemSource,
    AuditKingDocument,
    AuditKingManualEvidence,
    AuditKingMatch,
    AuditKingTextBlock
} from "./models";
    const CONTEXT_LENGTH = 20;
    type AuditKingSourceDocument = Pick<AuditKingDocument, "id" | "name" | "blocks">;
    type AuditKingManualMatch = Omit<AuditKingMatch, "checkItemId"> & {
        checkItemId?: string;
        keywordId?: string;
    };

    function makeSource(block: AuditKingTextBlock, start: number, end: number): AuditKingCheckItemSource {
        const safeStart = Math.max(0, Math.min(start, block.text.length));
        const safeEnd = Math.max(safeStart, Math.min(end, block.text.length));
        return {
            blockId: block.id,
            blockIndex: block.blockIndex,
            start: safeStart,
            end: safeEnd,
            text: block.text.slice(safeStart, safeEnd),
            beforeText: block.text.slice(Math.max(0, safeStart - CONTEXT_LENGTH), safeStart),
            afterText: block.text.slice(safeEnd, Math.min(block.text.length, safeEnd + CONTEXT_LENGTH))
        };
    }

    function makeManualEvidence(match: AuditKingManualMatch): AuditKingManualEvidence {
        const safeStart = Math.max(0, Math.min(match.start, match.blockText.length));
        const safeEnd = Math.max(safeStart, Math.min(match.end, match.blockText.length));
        return {
            sourceType: "summary",
            documentId: match.documentId,
            documentName: match.documentName,
            blockId: match.blockId,
            blockIndex: match.blockIndex,
            pageNumber: match.pageNumber,
            title: match.title,
            start: safeStart,
            end: safeEnd,
            text: match.blockText.slice(safeStart, safeEnd),
            beforeText: match.blockText.slice(Math.max(0, safeStart - CONTEXT_LENGTH), safeStart),
            afterText: match.blockText.slice(safeEnd, Math.min(match.blockText.length, safeEnd + CONTEXT_LENGTH)),
            mode: match.mode,
            note: ""
        };
    }

    function buildDocumentTextMap(documentItem: AuditKingSourceDocument): {
        text: string;
        blocks: Array<{ block: AuditKingTextBlock; start: number; end: number }>;
    } {
        const blocks: Array<{ block: AuditKingTextBlock; start: number; end: number }> = [];
        let offset = 0;
        documentItem.blocks.forEach((block, index) => {
            const start = offset;
            const end = start + block.text.length;
            blocks.push({ block, start, end });
            offset = end + (index < documentItem.blocks.length - 1 ? 2 : 0);
        });
        return {
            text: documentItem.blocks.map((block) => block.text).join("\n\n"),
            blocks
        };
    }

    function makeManualEvidenceFromDocumentRange(
        documentItem: AuditKingSourceDocument,
        start: number,
        end: number,
        options: { sourceType?: "summary" | "selection" | ""; mode?: "exact" | "loose" | ""; note?: string } = {}
    ): AuditKingManualEvidence {
        const map = buildDocumentTextMap(documentItem);
        const safeStart = Math.max(0, Math.min(start, map.text.length));
        const safeEnd = Math.max(safeStart, Math.min(end, map.text.length));
        const startBlock = map.blocks.find((item) => safeStart >= item.start && safeStart <= item.end);
        const endBlock = map.blocks.find((item) => safeEnd >= item.start && safeEnd <= item.end);
        const sameBlock = startBlock && endBlock && startBlock.block.id === endBlock.block.id;
        const evidence: AuditKingManualEvidence = {
            sourceType: options.sourceType || "selection",
            documentId: documentItem.id,
            documentName: documentItem.name,
            globalStart: safeStart,
            globalEnd: safeEnd,
            text: map.text.slice(safeStart, safeEnd),
            beforeText: map.text.slice(Math.max(0, safeStart - CONTEXT_LENGTH), safeStart),
            afterText: map.text.slice(safeEnd, Math.min(map.text.length, safeEnd + CONTEXT_LENGTH)),
            mode: options.mode || "",
            note: options.note?.trim() || ""
        };
        if (sameBlock && startBlock) {
            evidence.blockId = startBlock.block.id;
            evidence.blockIndex = startBlock.block.blockIndex;
            evidence.pageNumber = startBlock.block.pageNumber;
            evidence.title = startBlock.block.title;
            evidence.start = safeStart - startBlock.start;
            evidence.end = safeEnd - startBlock.start;
        }
        return evidence;
    }

    function normalizeNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === "") return null;
        const numberValue = typeof value === "number" ? value : Number(String(value).trim());
        return Number.isFinite(numberValue) ? numberValue : null;
    }

    function getSourceBlockIndex(source: AuditKingCheckItemSource): number | null {
        return normalizeNumber(source.blockIndex);
    }

    function textAt(block: AuditKingTextBlock, start: number | null, end: number | null): string {
        if (start === null || end === null || start < 0 || end <= start || end > block.text.length) return "";
        return block.text.slice(start, end);
    }

    function matchesExpected(selected: string, expected: string): boolean {
        return !!selected && !!expected && selected === expected;
    }

    function resolveByCoordinates(
        block: AuditKingTextBlock | undefined,
        source: AuditKingCheckItemSource,
        keywordText: string
    ): AuditKingCheckItemSource | null {
        if (!block) return null;
        const start = normalizeNumber(source.start);
        const end = normalizeNumber(source.end);
        const selected = textAt(block, start, end);
        const expected = source.text || keywordText;
        if (!matchesExpected(selected, expected)) return null;
        return makeSource(block, start as number, end as number);
    }

    function findAllInBlock(block: AuditKingTextBlock, text: string): AuditKingCheckItemSource[] {
        if (!text) return [];
        const matches: AuditKingCheckItemSource[] = [];
        let start = block.text.indexOf(text);
        while (start >= 0) {
            matches.push(makeSource(block, start, start + text.length));
            start = block.text.indexOf(text, start + Math.max(1, text.length));
        }
        return matches;
    }

    function contextMatches(blockText: string, candidate: AuditKingCheckItemSource, source: AuditKingCheckItemSource): boolean {
        const start = normalizeNumber(candidate.start);
        const end = normalizeNumber(candidate.end);
        if (start === null || end === null) return false;
        const before = source.beforeText || "";
        const after = source.afterText || "";
        const beforeOk = !before || blockText.slice(Math.max(0, start - before.length), start) === before;
        const afterOk = !after || blockText.slice(end, Math.min(blockText.length, end + after.length)) === after;
        return beforeOk && afterOk;
    }

    function uniqueByContext(blocks: AuditKingTextBlock[], source: AuditKingCheckItemSource, keywordText: string): AuditKingCheckItemSource | null {
        const sourceText = source.text || keywordText;
        if (!sourceText) return null;
        const matches = blocks
            .flatMap((block) => findAllInBlock(block, sourceText).filter((candidate) => contextMatches(block.text, candidate, source)));
        return matches.length === 1 ? matches[0] : null;
    }

    function uniqueInBlock(block: AuditKingTextBlock | undefined, keywordText: string): AuditKingCheckItemSource | null {
        if (!block) return null;
        const matches = findAllInBlock(block, keywordText);
        return matches.length === 1 ? matches[0] : null;
    }

    function resolveSource(
        source: AuditKingCheckItemSource | undefined,
        blocks: AuditKingTextBlock[],
        keywordText: string
    ): AuditKingCheckItemSource | undefined {
        if (!source || !blocks.length) return source;

        const exactBlock = source.blockId ? blocks.find((block) => block.id === source.blockId) : undefined;
        const byExactId = resolveByCoordinates(exactBlock, source, keywordText);
        if (byExactId) return byExactId;

        const blockIndex = getSourceBlockIndex(source);
        const indexedBlock = blockIndex ? blocks.find((block) => block.blockIndex === blockIndex) : undefined;
        const byIndex = resolveByCoordinates(indexedBlock, source, keywordText);
        if (byIndex) return byIndex;

        if (indexedBlock) {
            const byContextInBlock = uniqueByContext([indexedBlock], source, keywordText);
            if (byContextInBlock) return byContextInBlock;
        }

        const byContext = uniqueByContext(blocks, source, keywordText);
        if (byContext) return byContext;

        const byUniqueTextInBlock = uniqueInBlock(indexedBlock, keywordText);
        if (byUniqueTextInBlock) return byUniqueTextInBlock;

        return source;
    }

    function makeEvidenceFromBlock(
        block: AuditKingTextBlock,
        start: number,
        end: number,
        evidence: AuditKingManualEvidence
    ): AuditKingManualEvidence {
        const safeStart = Math.max(0, Math.min(start, block.text.length));
        const safeEnd = Math.max(safeStart, Math.min(end, block.text.length));
        return {
            ...evidence,
            documentId: block.documentId,
            documentName: block.documentName,
            blockId: block.id,
            blockIndex: block.blockIndex,
            pageNumber: block.pageNumber,
            title: block.title,
            start: safeStart,
            end: safeEnd,
            globalStart: evidence.globalStart,
            globalEnd: evidence.globalEnd,
            text: block.text.slice(safeStart, safeEnd),
            beforeText: block.text.slice(Math.max(0, safeStart - CONTEXT_LENGTH), safeStart),
            afterText: block.text.slice(safeEnd, Math.min(block.text.length, safeEnd + CONTEXT_LENGTH))
        };
    }

    function getEvidenceDocumentBlocks(evidence: AuditKingManualEvidence, documents: AuditKingSourceDocument[]): AuditKingTextBlock[] {
        const byId = evidence.documentId
            ? documents.find((documentItem) => documentItem.id === evidence.documentId)
            : undefined;
        if (byId) return byId.blocks;

        const byName = evidence.documentName
            ? documents.filter((documentItem) => documentItem.name === evidence.documentName)
            : [];
        if (byName.length) {
            return byName.flatMap((documentItem) => documentItem.blocks);
        }
        return documents.flatMap((documentItem) => documentItem.blocks);
    }

    function resolveEvidenceByCoordinates(
        block: AuditKingTextBlock | undefined,
        evidence: AuditKingManualEvidence
    ): AuditKingManualEvidence | null {
        if (!block) return null;
        const start = normalizeNumber(evidence.start);
        const end = normalizeNumber(evidence.end);
        const selected = textAt(block, start, end);
        if (!matchesExpected(selected, evidence.text)) return null;
        return makeEvidenceFromBlock(block, start as number, end as number, evidence);
    }

    function resolveEvidenceByGlobalCoordinates(
        documentItem: AuditKingSourceDocument | undefined,
        evidence: AuditKingManualEvidence
    ): AuditKingManualEvidence | null {
        if (!documentItem) return null;
        const start = normalizeNumber(evidence.globalStart);
        const end = normalizeNumber(evidence.globalEnd);
        if (start === null || end === null) return null;
        const map = buildDocumentTextMap(documentItem);
        const selected = start >= 0 && end > start && end <= map.text.length ? map.text.slice(start, end) : "";
        if (!matchesExpected(selected, evidence.text)) return null;
        return makeManualEvidenceFromDocumentRange(documentItem, start, end, {
            sourceType: evidence.sourceType,
            mode: evidence.mode,
            note: evidence.note
        });
    }

    function findEvidenceTextInBlock(block: AuditKingTextBlock, text: string): AuditKingManualEvidence[] {
        if (!text) return [];
        const matches: AuditKingManualEvidence[] = [];
        let start = block.text.indexOf(text);
        while (start >= 0) {
            matches.push(makeEvidenceFromBlock(block, start, start + text.length, {
                documentName: block.documentName,
                text
            }));
            start = block.text.indexOf(text, start + Math.max(1, text.length));
        }
        return matches;
    }

    function evidenceContextMatches(blockText: string, candidate: AuditKingManualEvidence, evidence: AuditKingManualEvidence): boolean {
        const start = normalizeNumber(candidate.start);
        const end = normalizeNumber(candidate.end);
        if (start === null || end === null) return false;
        const before = evidence.beforeText || "";
        const after = evidence.afterText || "";
        const beforeOk = !before || blockText.slice(Math.max(0, start - before.length), start) === before;
        const afterOk = !after || blockText.slice(end, Math.min(blockText.length, end + after.length)) === after;
        return beforeOk && afterOk;
    }

    function uniqueEvidenceByContext(blocks: AuditKingTextBlock[], evidence: AuditKingManualEvidence): AuditKingManualEvidence | null {
        const evidenceText = evidence.text || "";
        if (!evidenceText) return null;
        const matches = blocks.flatMap((block) => findEvidenceTextInBlock(block, evidenceText)
            .filter((candidate) => evidenceContextMatches(block.text, candidate, evidence)));
        return matches.length === 1 ? { ...matches[0], sourceType: evidence.sourceType, mode: evidence.mode, note: evidence.note || "" } : null;
    }

    function documentContextMatches(fullText: string, candidate: AuditKingManualEvidence, evidence: AuditKingManualEvidence): boolean {
        const start = normalizeNumber(candidate.globalStart);
        const end = normalizeNumber(candidate.globalEnd);
        if (start === null || end === null) return false;
        const before = evidence.beforeText || "";
        const after = evidence.afterText || "";
        const beforeOk = !before || fullText.slice(Math.max(0, start - before.length), start) === before;
        const afterOk = !after || fullText.slice(end, Math.min(fullText.length, end + after.length)) === after;
        return beforeOk && afterOk;
    }

    function findEvidenceTextInDocument(documentItem: AuditKingSourceDocument, text: string, evidence: AuditKingManualEvidence): AuditKingManualEvidence[] {
        if (!text) return [];
        const map = buildDocumentTextMap(documentItem);
        const matches: AuditKingManualEvidence[] = [];
        let start = map.text.indexOf(text);
        while (start >= 0) {
            matches.push(makeManualEvidenceFromDocumentRange(documentItem, start, start + text.length, {
                sourceType: evidence.sourceType,
                mode: evidence.mode,
                note: evidence.note
            }));
            start = map.text.indexOf(text, start + Math.max(1, text.length));
        }
        return matches.filter((candidate) => documentContextMatches(map.text, candidate, evidence));
    }

    function uniqueEvidenceByDocumentContext(documents: AuditKingSourceDocument[], evidence: AuditKingManualEvidence): AuditKingManualEvidence | null {
        const evidenceText = evidence.text || "";
        if (!evidenceText) return null;
        const candidates = getEvidenceCandidateDocuments(evidence, documents)
            .flatMap((documentItem) => findEvidenceTextInDocument(documentItem, evidenceText, evidence));
        return candidates.length === 1 ? candidates[0] : null;
    }

    function getEvidenceCandidateDocuments(evidence: AuditKingManualEvidence, documents: AuditKingSourceDocument[]): AuditKingSourceDocument[] {
        const byId = evidence.documentId
            ? documents.find((documentItem) => documentItem.id === evidence.documentId)
            : undefined;
        if (byId) return [byId];
        const byName = evidence.documentName
            ? documents.filter((documentItem) => documentItem.name === evidence.documentName)
            : [];
        return byName.length ? byName : documents;
    }

    function resolveManualEvidence(
        evidence: AuditKingManualEvidence,
        documents: AuditKingSourceDocument[]
    ): AuditKingManualEvidence {
        if (!documents.length || !evidence.text) return evidence;

        const exactDocument = evidence.documentId
            ? documents.find((documentItem) => documentItem.id === evidence.documentId)
            : undefined;
        const namedDocument = !exactDocument && evidence.documentName
            ? documents.find((documentItem) => documentItem.name === evidence.documentName)
            : undefined;
        const byGlobalCoordinates = resolveEvidenceByGlobalCoordinates(exactDocument || namedDocument, evidence);
        if (byGlobalCoordinates) return byGlobalCoordinates;

        const blocks = getEvidenceDocumentBlocks(evidence, documents);
        const exactBlock = evidence.blockId ? blocks.find((block) => block.id === evidence.blockId) : undefined;
        const byExactId = resolveEvidenceByCoordinates(exactBlock, evidence);
        if (byExactId) return byExactId;

        const blockIndex = normalizeNumber(evidence.blockIndex);
        const indexedBlock = blockIndex !== null ? blocks.find((block) => block.blockIndex === blockIndex) : undefined;
        const byIndex = resolveEvidenceByCoordinates(indexedBlock, evidence);
        if (byIndex) return byIndex;

        const shouldPreferDocumentContext = evidence.sourceType === "selection"
            || evidence.globalStart !== undefined
            || evidence.globalEnd !== undefined;
        if (shouldPreferDocumentContext) {
            const byDocumentContext = uniqueEvidenceByDocumentContext(documents, evidence);
            if (byDocumentContext) return byDocumentContext;
        }

        if (indexedBlock) {
            const byContextInBlock = uniqueEvidenceByContext([indexedBlock], evidence);
            if (byContextInBlock) return byContextInBlock;
        }

        const byContext = uniqueEvidenceByContext(blocks, evidence);
        if (byContext) return byContext;

        const byDocumentContext = uniqueEvidenceByDocumentContext(documents, evidence);
        if (byDocumentContext) return byDocumentContext;

        return evidence;
    }

    function resolveCheckItemEvidences(items: AuditKingCheckItem[], documents: AuditKingSourceDocument[]): AuditKingCheckItem[] {
        return items.map((item) => ({
            ...item,
            manualEvidences: item.manualEvidences.map((evidence) => resolveManualEvidence(evidence, documents))
        }));
    }

    function resolveCheckItemSources(items: AuditKingCheckItem[], blocks: AuditKingTextBlock[]): AuditKingCheckItem[] {
        return items.map((item) => ({
            ...item,
            source: resolveSource(item.source, blocks, item.keyword)
        }));
    }

export const AuditKingSourceLocator = {
        makeSource,
        makeManualEvidence,
        makeManualEvidenceFromDocumentRange,
        resolveSource,
        resolveManualEvidence,
        resolveCheckItemSources,
        resolveCheckItemEvidences
    };
