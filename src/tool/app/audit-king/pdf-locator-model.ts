import type { AuditKingEvidenceGroup } from "./models";

export interface AuditKingPdfLocatorHooks {
    ignoreLine?: (line: string) => boolean;
    weakSegment?: (text: string) => boolean;
    skipContent?: (content: string) => boolean;
}

export function createAuditKingPdfLocatorModel(locatorHooks: AuditKingPdfLocatorHooks = {}) {
    interface PdfLocatorPage {
        pdfId: string;
        pdfName: string;
        pageNumber: number;
        text: string;
    }

    interface PdfLocatorDocument {
        id: string;
        name: string;
        pages: PdfLocatorPage[];
        pageCount?: number;
    }

    interface PdfLocatorTarget {
        sequence: string;
        title?: string;
        content: string;
        note?: string;
    }

    interface PdfLocatorSegment {
        text: string;
        sourceIndex: number;
        weight: number;
    }

    interface PdfLocatorResult {
        sequence: string;
        title: string;
        content: string;
        status: "trusted" | "review" | "miss" | "skip";
        pdfId?: string;
        pdfName?: string;
        startPage?: number;
        endPage?: number;
        coverage: number;
        orderRatio: number;
        score: number;
        matchedSegments: number;
        totalSegments: number;
        reason: string;
        snippets: string[];
        comparisons?: PdfLocatorSegmentComparison[];
    }

    interface PdfLocatorSegmentComparison {
        text: string;
        matched: boolean;
    }

    interface PdfLocatorSlot {
        id: string;
        sequence: string;
        title: string;
        content: string;
        note: string;
        selected: boolean;
        pdfId: string;
        pdfName?: string;
        startPage: number | "";
        endPage: number | "";
        result?: PdfLocatorResult;
    }

    interface PdfLocatorExportTask {
        slotId: string;
        sequence: string;
        title: string;
        pdfId: string;
        pdfName: string;
        startPage: number;
        endPage: number;
        filename: string;
        skippedReason?: string;
    }

    interface PdfLocatorWorkspaceSnapshot {
        version: number;
        exportedAt: string;
        selectedSlotId: string;
        expandContextPages: boolean;
        slots: PdfLocatorSlot[];
    }

    interface LocateSlotsOptions {
        expandContextPages?: boolean;
    }

    interface WindowCandidate {
        document: PdfLocatorDocument;
        startPage: number;
        endPage: number;
        normalizedText: string;
        rawText: string;
        score: number;
        coverage: number;
        orderRatio: number;
        matchedSegments: number;
        totalSegments: number;
        snippets: string[];
    }

    function hooks(): AuditKingPdfLocatorHooks {
        return locatorHooks;
    }

    function normalizeLine(value: string): string {
        return String(value || "")
            .normalize("NFKC")
            .replace(/\u00a0/g, " ")
            .replace(/\u3000/g, " ")
            .toLowerCase()
            .trim();
    }

    function isPageFurniture(line: string): boolean {
        if (!line) return true;
        if (/^20\d{2}\/\d{1,2}\/\d{1,2}$/.test(line)) return true;
        if (/^\d{1,4}$/.test(line)) return true;
        if (/^《[^》]{1,20}》$/.test(line)) return true;
        return hooks().ignoreLine?.(line) === true;
    }

    function stripStructuralPrefix(line: string): string {
        return line
            .replace(/^\s*\d+(?:\.\d+)*\s*/, "")
            .replace(/^[（(]\s*\d+\s*[）)]\s*/, "")
            .trim();
    }

    function normalizeLocatorText(value: string): string {
        const lines = String(value || "")
            .split(/\r?\n/)
            .map(normalizeLine)
            .filter((line) => !isPageFurniture(line))
            .map(stripStructuralPrefix)
            .filter(Boolean);
        return lines
            .join("")
            .replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");
    }

    function normalizeEvidenceLine(line: string): string {
        return stripStructuralPrefix(normalizeLine(line))
            .replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");
    }

    function splitLongSegment(text: string): string[] {
        if (text.length <= 34) return [text];
        const parts: string[] = [];
        const size = 26;
        const step = 20;
        for (let index = 0; index < text.length; index += step) {
            const part = text.slice(index, index + size);
            if (part.length >= 12) {
                parts.push(part);
            }
            if (index + size >= text.length) break;
        }
        return parts;
    }

    function isWeakSegment(text: string): boolean {
        if (text.length < 6) return true;
        return hooks().weakSegment?.(text) === true;
    }

    function buildEvidenceSegments(content: string): PdfLocatorSegment[] {
        const segments: PdfLocatorSegment[] = [];
        String(content || "")
            .split(/\r?\n/)
            .map(normalizeEvidenceLine)
            .filter((line) => !isWeakSegment(line))
            .forEach((line) => {
                splitLongSegment(line).forEach((part) => {
                    if (!isWeakSegment(part)) {
                        segments.push({
                            text: part,
                            sourceIndex: segments.length,
                            weight: Math.max(8, part.length)
                        });
                    }
                });
            });
        return segments;
    }

    function buildTargetsFromEvidenceGroups(groups: AuditKingEvidenceGroup[]): PdfLocatorTarget[] {
        return (groups || []).flatMap((group, groupIndex) => {
            const sequence = extractSequence(group.title, `未编号${groupIndex + 1}`);
            return (group.items || []).map((item, itemIndex) => ({
                sequence,
                title: group.title || sequence,
                content: item.content || "",
                note: item.note || "",
                id: `${sequence}-${itemIndex + 1}`
            }));
        });
    }

    function buildSlotsFromEvidenceGroups(groups: AuditKingEvidenceGroup[]): PdfLocatorSlot[] {
        return buildTargetsFromEvidenceGroups(groups).map((target, index) => ({
            id: `pdf-slot-${index + 1}`,
            sequence: target.sequence,
            title: target.title || target.sequence,
            content: target.content || "",
            note: target.note || "",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        }));
    }

    function buildEmptySlotsFromRange(rangeText: string): PdfLocatorSlot[] {
        const sequences = buildSequencesFromRange(rangeText);
        return sequences.map((sequence, index) => ({
            id: `pdf-slot-${index + 1}`,
            sequence,
            title: sequence,
            content: "",
            note: "",
            selected: true,
            pdfId: "",
            startPage: "",
            endPage: ""
        }));
    }

    function buildSequencesFromRange(rangeText: string): string[] {
        const parts = String(rangeText || "").trim().split("-");
        if (parts.length !== 2) {
            throw new Error("范围格式应为 X.X-X.X，例如 1.1-1.61。");
        }
        const start = parseSequenceEndpoint(parts[0]);
        const end = parseSequenceEndpoint(parts[1]);
        if (!start || !end || start.major !== end.major) {
            throw new Error("当前只支持同一一级编号内生成。");
        }
        if (end.minor < start.minor) {
            throw new Error("结束编号不能小于起始编号。");
        }
        const sequences: string[] = [];
        for (let current = start.minor; current <= end.minor; current += 1) {
            sequences.push(`${start.major}.${current}`);
        }
        return sequences;
    }

    function parseSequenceEndpoint(value: string): { major: string; minor: number } | null {
        const match = String(value || "").trim().match(/^(\d+)\.(\d+)$/);
        if (!match) return null;
        return {
            major: match[1],
            minor: Number(match[2])
        };
    }

    function extractSequence(title: string, fallback: string): string {
        const match = String(title || "").match(/^\s*(\d+(?:\.\d+)+)/);
        return match ? match[1] : fallback;
    }

    function makePageWindows(documentItem: PdfLocatorDocument, maxWindowSize = 3): WindowCandidate[] {
        const pages = [...(documentItem.pages || [])].sort((a, b) => a.pageNumber - b.pageNumber);
        const windows: WindowCandidate[] = [];
        for (let startIndex = 0; startIndex < pages.length; startIndex += 1) {
            for (let size = 1; size <= maxWindowSize; size += 1) {
                const windowPages = pages.slice(startIndex, startIndex + size);
                if (windowPages.length !== size) continue;
                const startPage = windowPages[0].pageNumber;
                const endPage = windowPages[windowPages.length - 1].pageNumber;
                if (endPage - startPage + 1 !== size) continue;
                const rawText = windowPages.map((page) => page.text || "").join("\n");
                windows.push({
                    document: documentItem,
                    startPage,
                    endPage,
                    rawText,
                    normalizedText: normalizeLocatorText(rawText),
                    score: 0,
                    coverage: 0,
                    orderRatio: 0,
                    matchedSegments: 0,
                    totalSegments: 0,
                    snippets: []
                });
            }
        }
        return windows;
    }

    function scoreWindow(windowItem: WindowCandidate, segments: PdfLocatorSegment[]): WindowCandidate {
        let coveredWeight = 0;
        let matchedSegments = 0;
        let orderedHits = 0;
        let previousPosition = -1;
        const snippets: string[] = [];

        segments.forEach((segment) => {
            const position = windowItem.normalizedText.indexOf(segment.text);
            if (position < 0) return;
            matchedSegments += 1;
            coveredWeight += segment.weight;
            if (position >= previousPosition) {
                orderedHits += 1;
                previousPosition = position;
            }
            if (snippets.length < 5) {
                snippets.push(segment.text);
            }
        });

        const totalWeight = segments.reduce((total, segment) => total + segment.weight, 0);
        const coverage = totalWeight ? coveredWeight / totalWeight : 0;
        const orderRatio = matchedSegments ? orderedHits / matchedSegments : 0;
        const densityPenalty = windowItem.endPage > windowItem.startPage + 1 ? 0.03 : 0;
        const score = Math.max(0, coverage * 0.78 + orderRatio * 0.22 - densityPenalty);

        return {
            ...windowItem,
            score,
            coverage,
            orderRatio,
            matchedSegments,
            totalSegments: segments.length,
            snippets
        };
    }

    function classifyBest(best: WindowCandidate | null, second: WindowCandidate | null): { status: "trusted" | "review" | "miss"; reason: string } {
        if (!best || best.coverage < 0.45 || best.matchedSegments < 2) {
            return { status: "miss", reason: "没有足够片段集中命中连续页面。" };
        }
        const lead = best.score - (second?.score || 0);
        if (best.coverage >= 0.78 && best.orderRatio >= 0.85 && (lead >= 0.08 || best.coverage >= 0.94)) {
            return { status: "trusted", reason: "片段集中命中连续页面，顺序一致。" };
        }
        return { status: "review", reason: "存在候选页面范围，需要人工确认。" };
    }

    function isSkippable(content: string): boolean {
        const value = String(content || "").trim();
        return !value || hooks().skipContent?.(value) === true;
    }

    function locateEvidenceInDocuments(
        target: PdfLocatorTarget,
        documents: PdfLocatorDocument[],
        preparedWindows?: WindowCandidate[]
    ): PdfLocatorResult {
        if (isSkippable(target.content)) {
            return {
                sequence: target.sequence,
                title: target.title || target.sequence,
                content: target.content,
                status: "skip",
                coverage: 0,
                orderRatio: 0,
                score: 0,
                matchedSegments: 0,
                totalSegments: 0,
                reason: "依据为空或标记为不适用。",
                snippets: []
            };
        }

        const segments = buildEvidenceSegments(target.content);
        if (!segments.length) {
            return {
                sequence: target.sequence,
                title: target.title || target.sequence,
                content: target.content,
                status: "miss",
                coverage: 0,
                orderRatio: 0,
                score: 0,
                matchedSegments: 0,
                totalSegments: 0,
                reason: "依据内容无法形成有效片段。",
                snippets: []
            };
        }

        const candidates = (preparedWindows || (documents || []).flatMap((documentItem) => makePageWindows(documentItem, 3)))
            .map((windowItem) => scoreWindow(windowItem, segments))
            .filter((windowItem) => windowItem.matchedSegments > 0)
            .sort((a, b) => b.score - a.score
                || b.coverage - a.coverage
                || (a.endPage - a.startPage) - (b.endPage - b.startPage)
                || a.startPage - b.startPage);
        const best = candidates[0] || null;
        const second = candidates.find((candidate) => !best || candidate.document.id !== best.document.id || candidate.startPage !== best.startPage || candidate.endPage !== best.endPage) || null;
        const classification = classifyBest(best, second);

        return {
            sequence: target.sequence,
            title: target.title || target.sequence,
            content: target.content,
            status: classification.status,
            pdfId: best?.document.id,
            pdfName: best?.document.name,
            startPage: best?.startPage,
            endPage: best?.endPage,
            coverage: roundMetric(best?.coverage || 0),
            orderRatio: roundMetric(best?.orderRatio || 0),
            score: roundMetric(best?.score || 0),
            matchedSegments: best?.matchedSegments || 0,
            totalSegments: segments.length,
            reason: classification.reason,
            snippets: best?.snippets || [],
            comparisons: best ? buildSegmentComparisons(segments, best.normalizedText) : segments.map((segment) => ({
                text: segment.text,
                matched: false
            }))
        };
    }

    function locateTargets(targets: PdfLocatorTarget[], documents: PdfLocatorDocument[]): PdfLocatorResult[] {
        const preparedWindows = (documents || []).flatMap((documentItem) => makePageWindows(documentItem, 3));
        return (targets || []).map((target) => locateEvidenceInDocuments(target, documents, preparedWindows));
    }

    function locateSlots(slots: PdfLocatorSlot[], documents: PdfLocatorDocument[], options: LocateSlotsOptions = {}): PdfLocatorSlot[] {
        const expandContextPages = options.expandContextPages !== false;
        const preparedWindows = (documents || []).flatMap((documentItem) => makePageWindows(documentItem, 3));
        return (slots || []).map((slot) => {
            if (!slot.content.trim()) {
                return {
                    ...slot,
                    result: {
                        sequence: slot.sequence,
                        title: slot.title || slot.sequence,
                        content: slot.content,
                        status: "skip",
                        coverage: 0,
                        orderRatio: 0,
                        score: 0,
                        matchedSegments: 0,
                        totalSegments: 0,
                        reason: "槽位没有审计篮子原文。",
                        snippets: [],
                        comparisons: []
                    }
                };
            }
            const result = locateEvidenceInDocuments({
                sequence: slot.sequence,
                title: slot.title,
                content: slot.content,
                note: slot.note
            }, documents, preparedWindows);
            const documentItem = documents.find((item) => item.id === result.pdfId);
            const expandedRange = expandContextPages && documentItem ? expandResultPageRange(result, documentItem) : null;
            return {
                ...slot,
                pdfId: result.pdfId || slot.pdfId || "",
                pdfName: result.pdfName || slot.pdfName || "",
                startPage: expandedRange?.startPage || result.startPage || slot.startPage || "",
                endPage: expandedRange?.endPage || result.endPage || slot.endPage || "",
                result
            };
        });
    }

    function expandResultPageRange(result: PdfLocatorResult, documentItem: PdfLocatorDocument): { startPage: number; endPage: number } | null {
        if (!result.startPage || !result.endPage) return null;
        const bounds = getDocumentPageBounds(documentItem);
        if (!bounds) return null;
        return {
            startPage: Math.max(bounds.minPage, result.startPage - 1),
            endPage: Math.min(bounds.maxPage, result.endPage + 1)
        };
    }

    function getDocumentPageBounds(documentItem: PdfLocatorDocument): { minPage: number; maxPage: number } | null {
        if (Number.isFinite(documentItem.pageCount) && Number(documentItem.pageCount) > 0) {
            return {
                minPage: 1,
                maxPage: Number(documentItem.pageCount)
            };
        }
        const pageNumbers = (documentItem.pages || [])
            .map((page) => page.pageNumber)
            .filter((pageNumber) => Number.isFinite(pageNumber));
        if (!pageNumbers.length) return null;
        return {
            minPage: Math.min(...pageNumbers),
            maxPage: Math.max(...pageNumbers)
        };
    }

    function buildSlotComparison(slot: PdfLocatorSlot, documents: PdfLocatorDocument[]): PdfLocatorSegmentComparison[] {
        const documentItem = (documents || []).find((item) => item.id === slot.pdfId);
        const startPage = Number(slot.startPage);
        const endPage = Number(slot.endPage);
        const segments = buildEvidenceSegments(slot.content || "");
        if (!documentItem || !Number.isFinite(startPage) || !Number.isFinite(endPage)) {
            return segments.map((segment) => ({ text: segment.text, matched: false }));
        }
        const text = documentItem.pages
            .filter((page) => page.pageNumber >= Math.min(startPage, endPage) && page.pageNumber <= Math.max(startPage, endPage))
            .map((page) => page.text)
            .join("\n");
        const normalizedText = normalizeLocatorText(text);
        return buildSegmentComparisons(segments, normalizedText);
    }

    function buildSegmentComparisons(segments: PdfLocatorSegment[], normalizedText: string): PdfLocatorSegmentComparison[] {
        return segments.map((segment) => ({
            text: segment.text,
            matched: normalizedText.includes(segment.text)
        }));
    }

    function updateSlotField(slots: PdfLocatorSlot[], slotId: string, patch: Partial<PdfLocatorSlot>): PdfLocatorSlot[] {
        return (slots || []).map((slot) => {
            if (slot.id !== slotId) return slot;
            return {
                ...slot,
                ...patch
            };
        });
    }

    function serializeWorkspace(slots: PdfLocatorSlot[], documents: PdfLocatorDocument[], selectedSlotId = "", expandContextPages = true): string {
        const snapshot: PdfLocatorWorkspaceSnapshot = {
            version: 1,
            exportedAt: new Date().toISOString(),
            selectedSlotId,
            expandContextPages: expandContextPages !== false,
            slots: (slots || []).map((slot, index) => normalizeWorkspaceSlot(slot, index, documents))
        };
        return JSON.stringify(snapshot, null, 2);
    }

    function parseWorkspace(value: string, documents: PdfLocatorDocument[]): { slots: PdfLocatorSlot[]; selectedSlotId: string; expandContextPages: boolean } {
        let data: any;
        try {
            data = JSON.parse(String(value || ""));
        } catch (_error) {
            throw new Error("PDF 工作区文件不是有效 JSON。");
        }
        const rawSlots = Array.isArray(data?.slots) ? data.slots : [];
        if (!rawSlots.length) {
            throw new Error("PDF 工作区文件没有可导入的槽位。");
        }
        const slots: PdfLocatorSlot[] = rawSlots.map((slot: any, index: number) => normalizeWorkspaceSlot(slot, index, documents));
        const selectedSlotId = slots.some((slot) => slot.id === data?.selectedSlotId)
            ? data.selectedSlotId
            : slots[0]?.id || "";
        return { slots, selectedSlotId, expandContextPages: data?.expandContextPages !== false };
    }

    function rebindWorkspaceSlotsToDocuments(slots: PdfLocatorSlot[], documents: PdfLocatorDocument[]): PdfLocatorSlot[] {
        return (slots || []).map((slot, index) => normalizeWorkspaceSlot(slot, index, documents));
    }

    function normalizeWorkspaceSlot(slot: any, index: number, documents: PdfLocatorDocument[]): PdfLocatorSlot {
        const pdfName = String(slot?.pdfName || slot?.result?.pdfName || resolveDocumentName(slot?.pdfId, documents) || "").trim();
        const pdfId = resolveDocumentId(slot?.pdfId, pdfName, documents);
        const result = normalizeWorkspaceResult(slot?.result, pdfId, pdfName);
        return {
            id: String(slot?.id || `pdf-slot-${index + 1}`),
            sequence: String(slot?.sequence || `未编号${index + 1}`),
            title: String(slot?.title || slot?.sequence || `未编号${index + 1}`),
            content: String(slot?.content || ""),
            note: String(slot?.note || ""),
            selected: slot?.selected !== false,
            pdfId,
            pdfName: pdfName || resolveDocumentName(pdfId, documents) || "",
            startPage: normalizePageValue(slot?.startPage),
            endPage: normalizePageValue(slot?.endPage),
            ...(result ? { result } : {})
        };
    }

    function normalizeWorkspaceResult(result: any, pdfId: string, pdfName: string): PdfLocatorResult | undefined {
        if (!result || typeof result !== "object") return undefined;
        const status = ["trusted", "review", "miss", "skip"].includes(result.status) ? result.status : "review";
        return {
            sequence: String(result.sequence || ""),
            title: String(result.title || ""),
            content: String(result.content || ""),
            status,
            pdfId,
            pdfName: pdfName || String(result.pdfName || ""),
            startPage: normalizeNumber(result.startPage),
            endPage: normalizeNumber(result.endPage),
            coverage: normalizeMetric(result.coverage),
            orderRatio: normalizeMetric(result.orderRatio),
            score: normalizeMetric(result.score),
            matchedSegments: normalizeCount(result.matchedSegments),
            totalSegments: normalizeCount(result.totalSegments),
            reason: String(result.reason || ""),
            snippets: Array.isArray(result.snippets) ? result.snippets.map((item: any) => String(item)) : [],
            comparisons: Array.isArray(result.comparisons)
                ? result.comparisons.map((item: any) => ({ text: String(item?.text || ""), matched: item?.matched === true }))
                : []
        };
    }

    function resolveDocumentId(pdfId: unknown, pdfName: string, documents: PdfLocatorDocument[]): string {
        const byId = documents.find((item) => item.id === pdfId);
        if (byId) return byId.id;
        const byName = documents.find((item) => item.name === pdfName);
        return byName?.id || "";
    }

    function resolveDocumentName(pdfId: unknown, documents: PdfLocatorDocument[]): string {
        return documents.find((item) => item.id === pdfId)?.name || "";
    }

    function normalizePageValue(value: unknown): number | "" {
        const page = Number(value);
        if (!Number.isFinite(page) || page < 1) return "";
        return Math.trunc(page);
    }

    function normalizeNumber(value: unknown): number | undefined {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : undefined;
    }

    function normalizeMetric(value: unknown): number {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? Math.max(0, Math.min(1, numberValue)) : 0;
    }

    function normalizeCount(value: unknown): number {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : 0;
    }

    function buildExportTasks(slots: PdfLocatorSlot[], documents: PdfLocatorDocument[], options: { onlySelected?: boolean; slotId?: string } = {}): PdfLocatorExportTask[] {
        return (slots || [])
            .filter((slot) => options.slotId ? slot.id === options.slotId : options.onlySelected ? slot.selected : true)
            .map((slot) => buildExportTask(slot, documents));
    }

    function buildExportTask(slot: PdfLocatorSlot, documents: PdfLocatorDocument[]): PdfLocatorExportTask {
        const documentItem = documents.find((item) => item.id === slot.pdfId);
        const startPage = Number(slot.startPage);
        const endPage = Number(slot.endPage);
        const baseTask = {
            slotId: slot.id,
            sequence: slot.sequence,
            title: slot.title || slot.sequence,
            pdfId: slot.pdfId || "",
            pdfName: documentItem?.name || "",
            startPage: Number.isFinite(startPage) ? Math.trunc(startPage) : 0,
            endPage: Number.isFinite(endPage) ? Math.trunc(endPage) : 0,
            filename: makeExportFilename(slot)
        };
        if (!documentItem) {
            return { ...baseTask, skippedReason: "未选择 PDF。" };
        }
        if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) {
            return { ...baseTask, skippedReason: "页码不完整。" };
        }
        const normalizedStart = Math.min(Math.trunc(startPage), Math.trunc(endPage));
        const normalizedEnd = Math.max(Math.trunc(startPage), Math.trunc(endPage));
        const pageCount = documentItem.pageCount ?? documentItem.pages.length;
        if (normalizedStart < 1 || normalizedEnd > pageCount) {
            return { ...baseTask, startPage: normalizedStart, endPage: normalizedEnd, skippedReason: "页码超出 PDF 范围。" };
        }
        return {
            ...baseTask,
            startPage: normalizedStart,
            endPage: normalizedEnd
        };
    }

    function makeExportFilename(slot: PdfLocatorSlot): string {
        const title = sanitizeFilename(slot.title || slot.sequence || "证据").slice(0, 40);
        const sequence = sanitizeFilename(slot.sequence || "未编号");
        return `${sequence}_${title || "证据"}.pdf`;
    }

    function sanitizeFilename(value: string): string {
        return String(value || "")
            .replace(/[\\/:*?"<>|]+/g, "_")
            .replace(/\s+/g, "_")
            .replace(/^_+|_+$/g, "") || "证据";
    }

    function roundMetric(value: number): number {
        return Math.round(value * 1000) / 1000;
    }

    function createState() {
        return {
            documents: [],
            results: [],
            slots: [],
            selectedSlotId: "",
            expandContextPages: true,
            summary: {
                trusted: 0,
                review: 0,
                miss: 0,
                skip: 0
            }
        };
    }

    function summarizeResults(results: PdfLocatorResult[]) {
        return (results || []).reduce((summary, result) => {
            summary[result.status] += 1;
            return summary;
        }, {
            trusted: 0,
            review: 0,
            miss: 0,
            skip: 0
        });
    }

    return {
        createState,
        normalizeLocatorText,
        buildEvidenceSegments,
        buildTargetsFromEvidenceGroups,
        buildSlotsFromEvidenceGroups,
        buildEmptySlotsFromRange,
        locateEvidenceInDocuments,
        locateTargets,
        locateSlots,
        buildSlotComparison,
        updateSlotField,
        buildExportTasks,
        serializeWorkspace,
        parseWorkspace,
        rebindWorkspaceSlotsToDocuments,
        summarizeResults
    };
}
