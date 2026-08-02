import { AuditKingCheckItemStore } from "./check-item-store";
import type {
    AuditKingAuditEvidence,
    AuditKingCheckItem,
    AuditKingCheckItemSource,
    AuditKingDocument,
    AuditKingEvidenceEntry,
    AuditKingEvidenceGroup,
    AuditKingImportedCheckItem,
    AuditKingManualEvidence,
    AuditKingPdfLocatorResult,
    AuditKingSearchResult,
    AuditKingStateModel,
    AuditKingTextBlock,
    AuditProjectRestoreInput
} from "./models";
import type { createAuditKingPdfLocatorModel } from "./pdf-locator-model";
import type { createAuditKingSearchEngine } from "./search-engine";
import { AuditKingSourceLocator } from "./source-locator";

interface AuditKingStateDependencies {
    SearchEngine?: ReturnType<typeof createAuditKingSearchEngine>;
    PdfLocatorModel?: ReturnType<typeof createAuditKingPdfLocatorModel>;
}

export function createAuditKingState({ SearchEngine, PdfLocatorModel }: AuditKingStateDependencies = {}) {
    const DEFAULT_DETAIL_CONTEXT_LENGTH = 2000;
    const DETAIL_CONTEXT_STEP = 2000;

    function createState(): AuditKingStateModel {
        return {
            checklistFile: null,
            checklistBlocks: [],
            documents: [],
            documentIndex: null,
            checkItems: [],
            searchResult: { matches: [], countsByCheckItem: {} },
            currentCheckItemId: "all",
            documentFilterId: "all",
            currentMatchIndex: 0,
            currentDetailContextLength: DEFAULT_DETAIL_CONTEXT_LENGTH,
            pdfLocator: PdfLocatorModel?.createState
                ? PdfLocatorModel.createState()
                : {
                    documents: [], results: [], slots: [], selectedSlotId: "", expandContextPages: true,
                    summary: { trusted: 0, review: 0, miss: 0, skip: 0 }
                }
        };
    }

    function resetMatchDetailContext(state: AuditKingStateModel): void {
        state.currentDetailContextLength = DEFAULT_DETAIL_CONTEXT_LENGTH;
    }

    function expandMatchDetailContext(state: AuditKingStateModel): void {
        state.currentDetailContextLength = (state.currentDetailContextLength || DEFAULT_DETAIL_CONTEXT_LENGTH) + DETAIL_CONTEXT_STEP;
    }

    function getEnabledDocuments(state: AuditKingStateModel): AuditKingDocument[] {
        return state.documents.filter((documentItem) => documentItem.enabled !== false);
    }

    function rebuildDocumentIndex(state: AuditKingStateModel): void {
        state.documentIndex = SearchEngine?.buildDocumentIndex
            ? SearchEngine.buildDocumentIndex(getEnabledDocuments(state))
            : null;
    }

    function addCheckItem(
        state: AuditKingStateModel,
        input: Partial<AuditKingImportedCheckItem> = {},
        options: { afterCheckItemId?: string } = {}
    ): AuditKingCheckItem {
        const item = AuditKingCheckItemStore.createCheckItem(input, state.checkItems.length);
        const afterIndex = options.afterCheckItemId
            ? state.checkItems.findIndex((candidate) => candidate.id === options.afterCheckItemId)
            : -1;
        if (afterIndex >= 0) state.checkItems.splice(afterIndex + 1, 0, item);
        else state.checkItems.push(item);
        if (state.currentCheckItemId === "all") state.currentCheckItemId = item.id;
        return item;
    }

    function replaceCheckItems(state: AuditKingStateModel, imported: AuditKingImportedCheckItem[]): void {
        state.checkItems = imported.map((item, index) => AuditKingCheckItemStore.createCheckItem(item, index));
        if (AuditKingSourceLocator.resolveCheckItemSources) {
            state.checkItems = AuditKingSourceLocator.resolveCheckItemSources(state.checkItems, state.checklistBlocks);
        }
        if (AuditKingSourceLocator.resolveCheckItemEvidences) {
            state.checkItems = AuditKingSourceLocator.resolveCheckItemEvidences(state.checkItems, state.documents);
        }
        state.currentCheckItemId = state.checkItems[0]?.id || "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function updateCheckItem(
        state: AuditKingStateModel,
        checkItemId: string,
        patch: Partial<Pick<AuditKingCheckItem, "code" | "name" | "keyword" | "enabled">>
    ): void {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (!item) return;
        if (patch.code !== undefined) item.code = patch.code.trim();
        if (patch.name !== undefined) item.name = patch.name.trim();
        if (patch.keyword !== undefined) item.keyword = patch.keyword.trim();
        if (patch.enabled !== undefined) item.enabled = patch.enabled;
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function removeCheckItem(state: AuditKingStateModel, checkItemId: string): void {
        state.checkItems = state.checkItems.filter((item) => item.id !== checkItemId);
        state.searchResult.matches = state.searchResult.matches.filter((match) => match.checkItemId !== checkItemId);
        delete state.searchResult.countsByCheckItem[checkItemId];
        if (state.currentCheckItemId === checkItemId) state.currentCheckItemId = state.checkItems[0]?.id || "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function moveCheckItemToPosition(state: AuditKingStateModel, checkItemId: string, targetPosition: number): void {
        const sourceIndex = state.checkItems.findIndex((item) => item.id === checkItemId);
        if (sourceIndex < 0 || !Number.isFinite(targetPosition)) return;
        const [item] = state.checkItems.splice(sourceIndex, 1);
        const insertIndex = Math.max(0, Math.min(state.checkItems.length, Math.trunc(targetPosition) - 1));
        state.checkItems.splice(insertIndex, 0, item);
    }

    function updateCheckItemSource(state: AuditKingStateModel, checkItemId: string, source: AuditKingCheckItemSource): void {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (item) item.source = source;
    }

    function clearCheckItemSource(state: AuditKingStateModel, checkItemId: string): void {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (item) delete item.source;
    }

    function setChecklistBlocks(state: AuditKingStateModel, blocks: AuditKingTextBlock[]): void {
        state.checklistBlocks = [...blocks];
        if (AuditKingSourceLocator.resolveCheckItemSources) {
            state.checkItems = AuditKingSourceLocator.resolveCheckItemSources(state.checkItems, state.checklistBlocks);
        }
    }

    function setDocuments(state: AuditKingStateModel, documents: AuditKingDocument[]): void {
        state.documents = documents.map((documentItem) => ({ ...documentItem, enabled: documentItem.enabled !== false }));
        if (AuditKingSourceLocator.resolveCheckItemEvidences) {
            state.checkItems = AuditKingSourceLocator.resolveCheckItemEvidences(state.checkItems, state.documents);
        }
        rebuildDocumentIndex(state);
        if (state.documentFilterId !== "all" && !getEnabledDocuments(state).some((item) => item.id === state.documentFilterId)) {
            state.documentFilterId = "all";
        }
    }

    function appendDocuments(state: AuditKingStateModel, documents: AuditKingDocument[]): void {
        setDocuments(state, [...state.documents, ...documents]);
    }

    function removeDocument(state: AuditKingStateModel, documentId: string): void {
        setDocuments(state, state.documents.filter((documentItem) => documentItem.id !== documentId));
    }

    function setDocumentEnabled(state: AuditKingStateModel, documentId: string, enabled: boolean): void {
        const documentItem = state.documents.find((item) => item.id === documentId);
        if (!documentItem) return;
        documentItem.enabled = enabled;
        rebuildDocumentIndex(state);
        if (state.documentFilterId === documentId && !enabled) state.documentFilterId = "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function setCurrentCheckItem(state: AuditKingStateModel, checkItemId: string): void {
        state.currentCheckItemId = checkItemId || "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function setDocumentFilter(state: AuditKingStateModel, documentId: string): void {
        state.documentFilterId = documentId || "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function setSearchResult(state: AuditKingStateModel, result: AuditKingSearchResult): void {
        state.searchResult = result;
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    function normalizeManualEvidence(item: AuditKingCheckItem, evidence: AuditKingManualEvidence): AuditKingManualEvidence {
        return {
            id: evidence.id || AuditKingCheckItemStore.nextId("manual-evidence"),
            sourceType: evidence.sourceType || "",
            documentId: evidence.documentId || "",
            documentName: String(evidence.documentName || "").trim(),
            blockId: evidence.blockId || "",
            blockIndex: evidence.blockIndex,
            pageNumber: evidence.pageNumber,
            title: evidence.title || "",
            start: evidence.start,
            end: evidence.end,
            globalStart: evidence.globalStart,
            globalEnd: evidence.globalEnd,
            text: String(evidence.text || "").trim(),
            beforeText: evidence.beforeText || "",
            afterText: evidence.afterText || "",
            mode: evidence.mode || "",
            note: evidence.note?.trim() || ""
        };
    }

    function addManualEvidence(state: AuditKingStateModel, checkItemId: string, evidence: AuditKingManualEvidence): AuditKingManualEvidence {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (!item) throw new Error("检查项不存在。");
        const normalized = normalizeManualEvidence(item, evidence);
        if (!normalized.documentName || !normalized.text) throw new Error("手册证据缺少手册名称或证据文本。");
        item.manualEvidences.push(normalized);
        return normalized;
    }

    function removeManualEvidence(state: AuditKingStateModel, checkItemId: string, evidenceId: string): void {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (item) item.manualEvidences = item.manualEvidences.filter((evidence) => evidence.id !== evidenceId);
    }

    function addAuditEvidence(state: AuditKingStateModel, checkItemId: string, content: string, note = "", sourceEvidenceId?: string): AuditKingAuditEvidence {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (!item) throw new Error("检查项不存在。");
        const evidence = {
            id: AuditKingCheckItemStore.nextId("audit-evidence"),
            content: content.trim(),
            note: note.trim(),
            sourceEvidenceId
        };
        item.auditEvidences.push(evidence);
        return evidence;
    }

    function adoptManualEvidence(state: AuditKingStateModel, checkItemId: string, evidenceId: string): AuditKingAuditEvidence {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (!item) throw new Error("检查项不存在。");
        const existing = item.auditEvidences.find((evidence) => evidence.sourceEvidenceId === evidenceId);
        if (existing) return existing;
        const manualEvidence = item.manualEvidences.find((evidence) => evidence.id === evidenceId);
        if (!manualEvidence) throw new Error("手册证据不存在。");
        const location = manualEvidence.pageNumber
            ? `${manualEvidence.documentName} / 第 ${manualEvidence.pageNumber} 页`
            : `${manualEvidence.documentName}${manualEvidence.blockIndex ? ` / 第 ${manualEvidence.blockIndex} 段` : ""}`;
        return addAuditEvidence(state, checkItemId, manualEvidence.text, `采纳自 ${location}`, evidenceId);
    }

    function updateAuditEvidence(state: AuditKingStateModel, checkItemId: string, evidenceId: string, patch: Partial<AuditKingEvidenceEntry>): void {
        const evidence = state.checkItems.find((item) => item.id === checkItemId)?.auditEvidences.find((item) => item.id === evidenceId);
        if (!evidence) return;
        if (patch.content !== undefined) evidence.content = patch.content;
        if (patch.note !== undefined) evidence.note = patch.note;
    }

    function removeAuditEvidence(state: AuditKingStateModel, checkItemId: string, evidenceId: string): void {
        const item = state.checkItems.find((candidate) => candidate.id === checkItemId);
        if (item) item.auditEvidences = item.auditEvidences.filter((evidence) => evidence.id !== evidenceId);
    }

    function buildEvidenceGroups(state: AuditKingStateModel): AuditKingEvidenceGroup[] {
        return state.checkItems.map((item) => ({
            id: item.id,
            title: [item.code, item.name].filter(Boolean).join("  "),
            items: item.auditEvidences.map((evidence) => ({ content: evidence.content, note: evidence.note }))
        }));
    }

    function restoreProject(state: AuditKingStateModel, input: AuditProjectRestoreInput): void {
        state.checklistFile = input.checklistFile;
        setChecklistBlocks(state, input.checklistBlocks);
        setDocuments(state, input.documents);
        replaceCheckItems(state, input.checkItems);
        state.pdfLocator.documents = [...input.locatorDocuments];
        state.pdfLocator.slots = PdfLocatorModel?.rebindWorkspaceSlotsToDocuments
            ? PdfLocatorModel.rebindWorkspaceSlotsToDocuments(input.pdfWorkspace.slots, state.pdfLocator.documents)
            : [...input.pdfWorkspace.slots];
        state.pdfLocator.selectedSlotId = state.pdfLocator.slots.some((slot) => slot.id === input.pdfWorkspace.selectedSlotId)
            ? input.pdfWorkspace.selectedSlotId
            : state.pdfLocator.slots[0]?.id || "";
        state.pdfLocator.expandContextPages = input.pdfWorkspace.expandContextPages !== false;
        state.pdfLocator.results = state.pdfLocator.slots
            .map((slot) => slot.result)
            .filter((result): result is AuditKingPdfLocatorResult => result !== undefined);
        state.pdfLocator.summary = PdfLocatorModel?.summarizeResults
            ? PdfLocatorModel.summarizeResults(state.pdfLocator.results)
            : state.pdfLocator.results.reduce((summary, result) => {
                summary[result.status] += 1;
                return summary;
            }, { trusted: 0, review: 0, miss: 0, skip: 0 });
        state.currentCheckItemId = state.checkItems.some((item) => item.id === input.view.currentCheckItemId)
            ? input.view.currentCheckItemId
            : state.checkItems[0]?.id || "all";
        state.documentFilterId = getEnabledDocuments(state).some((item) => item.id === input.view.documentFilterId)
            ? input.view.documentFilterId
            : "all";
        state.currentMatchIndex = 0;
        resetMatchDetailContext(state);
    }

    return {
        createState, resetMatchDetailContext, expandMatchDetailContext,
        addCheckItem, replaceCheckItems, updateCheckItem, removeCheckItem, moveCheckItemToPosition,
        updateCheckItemSource, clearCheckItemSource,
        setChecklistBlocks, setDocuments, appendDocuments, removeDocument, setDocumentEnabled, getEnabledDocuments,
        setCurrentCheckItem, setDocumentFilter, setSearchResult,
        addManualEvidence, removeManualEvidence, adoptManualEvidence,
        addAuditEvidence, updateAuditEvidence, removeAuditEvidence, buildEvidenceGroups, restoreProject
    };
}
