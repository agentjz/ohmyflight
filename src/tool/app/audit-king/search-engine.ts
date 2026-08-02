import type {
    AuditKingCheckItem,
    AuditKingDocument,
    AuditKingDocumentIndex,
    AuditKingIndexedBlock,
    AuditKingMatch,
    AuditKingSearchResult,
    AuditKingTextBlock
} from "./models";
import { AuditKingTextNormalizer as TextNormalizer } from "./text-normalizer";

export function createAuditKingSearchEngine(FlexSearch: any) {
    const GRAM_SIZE = 2;

    function requireNormalizer() {
        return TextNormalizer;
    }

    function createCounts(items: AuditKingCheckItem[]): Record<string, number> {
        return Object.fromEntries(items.map((item) => [item.id, 0]));
    }

    function uniqueNumbers(values: number[]): number[] {
        return Array.from(new Set(values)).sort((left, right) => left - right);
    }

    function createFlexIndex(): any {
        const IndexCtor = FlexSearch?.Index;
        return IndexCtor ? new IndexCtor({ tokenize: "full", cache: false }) : null;
    }

    function gramsFor(text: string): string[] {
        if (!text) return [];
        if (text.length <= GRAM_SIZE) return [text];
        const grams: string[] = [];
        for (let index = 0; index <= text.length - GRAM_SIZE; index += 1) grams.push(text.slice(index, index + GRAM_SIZE));
        return Array.from(new Set(grams));
    }

    function intersectSorted(left: number[], right: number[]): number[] {
        const result: number[] = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < left.length && rightIndex < right.length) {
            if (left[leftIndex] === right[rightIndex]) {
                result.push(left[leftIndex]); leftIndex += 1; rightIndex += 1;
            } else if (left[leftIndex] < right[rightIndex]) leftIndex += 1;
            else rightIndex += 1;
        }
        return result;
    }

    function buildDocumentIndex(documents: AuditKingDocument[]): AuditKingDocumentIndex {
        const normalizer = requireNormalizer();
        const blocks: AuditKingIndexedBlock[] = [];
        const grams: Record<string, number[]> = {};
        const flexIndex = createFlexIndex();
        documents.forEach((documentItem) => documentItem.blocks.forEach((block) => {
            const loose = normalizer.buildLooseIndex(block.text);
            const indexedBlock = { ...block, looseText: loose.normalized, looseOffsetMap: loose.offsetMap };
            const blockIndex = blocks.length;
            blocks.push(indexedBlock);
            flexIndex?.add(blockIndex, indexedBlock.looseText);
            gramsFor(indexedBlock.looseText).forEach((gram) => (grams[gram] || (grams[gram] = [])).push(blockIndex));
        }));
        Object.keys(grams).forEach((gram) => { grams[gram] = uniqueNumbers(grams[gram]); });
        return { documents, blocks, grams, flexIndex };
    }

    function makeMatch(
        item: AuditKingCheckItem,
        block: AuditKingTextBlock,
        start: number,
        end: number,
        mode: "exact" | "loose",
        serial: number
    ): AuditKingMatch {
        return {
            id: `${item.id}-${block.id}-${start}-${end}-${mode}-${serial}`,
            checkItemId: item.id,
            keywordText: item.keyword,
            keywordColor: item.color,
            documentId: block.documentId,
            documentName: block.documentName,
            blockId: block.id,
            blockIndex: block.blockIndex,
            pageNumber: block.pageNumber,
            title: block.title,
            start, end, mode,
            matchedText: block.text.slice(start, end),
            blockText: block.text
        };
    }

    function exactMatches(item: AuditKingCheckItem, block: AuditKingIndexedBlock, serial: { value: number }): AuditKingMatch[] {
        const matches: AuditKingMatch[] = [];
        let start = item.keyword ? block.text.indexOf(item.keyword) : -1;
        while (start >= 0) {
            const end = start + item.keyword.length;
            matches.push(makeMatch(item, block, start, end, "exact", serial.value++));
            start = block.text.indexOf(item.keyword, start + Math.max(1, item.keyword.length));
        }
        return matches;
    }

    function looseMatches(
        item: AuditKingCheckItem,
        block: AuditKingIndexedBlock,
        existingRanges: Set<string>,
        serial: { value: number }
    ): AuditKingMatch[] {
        const keywordText = requireNormalizer().normalizeLoose(item.keyword);
        if (!keywordText) return [];
        const matches: AuditKingMatch[] = [];
        let normalizedStart = block.looseText.indexOf(keywordText);
        while (normalizedStart >= 0) {
            const normalizedEnd = normalizedStart + keywordText.length - 1;
            const start = block.looseOffsetMap[normalizedStart]?.originalStart;
            const end = block.looseOffsetMap[normalizedEnd]?.originalEnd;
            const rangeKey = `${start}:${end}`;
            if (typeof start === "number" && typeof end === "number" && !existingRanges.has(rangeKey)) {
                matches.push(makeMatch(item, block, start, end, "loose", serial.value++));
                existingRanges.add(rangeKey);
            }
            normalizedStart = block.looseText.indexOf(keywordText, normalizedStart + Math.max(1, keywordText.length));
        }
        return matches;
    }

    function candidateBlockIndexes(index: AuditKingDocumentIndex, item: AuditKingCheckItem): number[] {
        const normalized = requireNormalizer().normalizeLoose(item.keyword);
        if (!normalized) return [];
        const queryGrams = gramsFor(normalized);
        if (queryGrams.some((gram) => !index.grams[gram]?.length)) return [];
        if (!queryGrams.length) return [];
        queryGrams.sort((left, right) => index.grams[left].length - index.grams[right].length);
        let candidates = [...index.grams[queryGrams[0]]];
        for (let gramIndex = 1; gramIndex < queryGrams.length && candidates.length; gramIndex += 1) {
            candidates = intersectSorted(candidates, index.grams[queryGrams[gramIndex]]);
        }
        if (normalized.length === 1 && index.flexIndex) {
            return uniqueNumbers([...candidates, ...index.flexIndex.search(normalized, index.blocks.length).map(Number)]);
        }
        return candidates;
    }

    function searchIndex(index: AuditKingDocumentIndex, items: AuditKingCheckItem[]): AuditKingSearchResult {
        const enabledItems = items.filter((item) => item.enabled !== false && item.keyword.trim());
        const countsByCheckItem = createCounts(items);
        const matches: AuditKingMatch[] = [];
        const serial = { value: 1 };
        enabledItems.forEach((item) => candidateBlockIndexes(index, item).forEach((blockIndex) => {
            const block = index.blocks[blockIndex];
            const exact = exactMatches(item, block, serial);
            const ranges = new Set(exact.map((match) => `${match.start}:${match.end}`));
            const blockMatches = [...exact, ...looseMatches(item, block, ranges, serial)];
            countsByCheckItem[item.id] += blockMatches.length;
            matches.push(...blockMatches);
        }));
        matches.sort((left, right) => (
            left.documentName.localeCompare(right.documentName, "zh-Hans-CN")
            || left.blockIndex - right.blockIndex
            || left.start - right.start
        ));
        return { matches, countsByCheckItem };
    }

    function searchDocuments(documents: AuditKingDocument[], items: AuditKingCheckItem[]): AuditKingSearchResult {
        return searchIndex(buildDocumentIndex(documents), items);
    }

    function filterMatches(matches: AuditKingMatch[], filters: { checkItemId: string; documentId: string }): AuditKingMatch[] {
        return matches.filter((match) => (
            (!filters.checkItemId || filters.checkItemId === "all" || match.checkItemId === filters.checkItemId)
            && (!filters.documentId || filters.documentId === "all" || match.documentId === filters.documentId)
        ));
    }

    return { buildDocumentIndex, searchIndex, searchDocuments, filterMatches };
}
