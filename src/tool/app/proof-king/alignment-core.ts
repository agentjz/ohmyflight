import { ManualProofEvents as eventBuilder } from "./alignment-events";
import type {
    AlignmentMatch,
    ComparisonOptions,
    ComparisonProgress,
    ComparisonSlice,
    ManualComparison,
    RevisionEvent,
    WorkerManual
} from "./models";
import { ManualProofText as text } from "./text-engine";

    type Anchor = { myIndex: number; referenceIndex: number; exact: boolean; similarity: number };
    type Candidate = AlignmentMatch & { baseScore: number; score: number; previous: number };

    function compare(
        myManual: WorkerManual,
        referenceManual: WorkerManual,
        options: ComparisonOptions = {},
        reportProgress?: (progress: ComparisonProgress) => void
    ): ManualComparison {
        requireTextEngine();
        reportProgress?.({ phase: "正在重建句子和条款", completed: 0, total: 1 });
        const mySlices = text.createSlices(myManual, options) as ComparisonSlice[];
        const referenceSlices = text.createSlices(referenceManual, options) as ComparisonSlice[];
        reportProgress?.({ phase: "正在建立唯一原文锚点", completed: 0, total: 1 });
        const exactAnchors = uniqueExactAnchors(mySlices, referenceSlices);
        const matches: AlignmentMatch[] = [];
        const boundaries: Anchor[] = [
            { myIndex: -1, referenceIndex: -1, exact: true, similarity: 1 },
            ...exactAnchors,
            { myIndex: mySlices.length, referenceIndex: referenceSlices.length, exact: true, similarity: 1 }
        ];

        for (let index = 0; index < boundaries.length - 1; index += 1) {
            const start = boundaries[index];
            const end = boundaries[index + 1];
            matches.push(...alignGap(mySlices, referenceSlices, start, end, options));
            if (end.myIndex < mySlices.length) matches.push(anchorMatch(end));
            reportProgress?.({ phase: "正在按原文顺序对齐", completed: index + 1, total: boundaries.length - 1 });
        }

        const orderedMatches = deduplicateMatches(matches);
        reportProgress?.({ phase: "正在聚合完整修订事件", completed: 0, total: 1 });
        const events = eventBuilder.build(mySlices, referenceSlices, orderedMatches) as RevisionEvent[];
        const sameSliceCount = orderedMatches
            .filter((match) => match.exact)
            .reduce((total, match) => total + Math.max(match.myEnd - match.myStart, match.referenceEnd - match.referenceStart), 0);

        return {
            mySlices,
            referenceSlices,
            events,
            summary: {
                myManualName: myManual.name,
                referenceManualName: referenceManual.name,
                mySliceCount: mySlices.length,
                referenceSliceCount: referenceSlices.length,
                exactAnchorCount: exactAnchors.length,
                sameSliceCount,
                referenceAddedCount: events.filter((event) => event.kind === "reference-added").length,
                referenceRemovedCount: events.filter((event) => event.kind === "reference-removed").length,
                modifiedCount: events.filter((event) => event.kind === "modified").length,
                reviewCount: events.filter((event) => event.kind === "review").length
            }
        };
    }

    function uniqueExactAnchors(mySlices: ComparisonSlice[], referenceSlices: ComparisonSlice[]): Anchor[] {
        const myPositions = positionsByNormalized(mySlices);
        const referencePositions = positionsByNormalized(referenceSlices);
        const candidates: Anchor[] = [];
        myPositions.forEach((myIndexes, normalized) => {
            const referenceIndexes = referencePositions.get(normalized) || [];
            if (normalized.length < 12 || myIndexes.length !== 1 || referenceIndexes.length !== 1) return;
            candidates.push({ myIndex: myIndexes[0], referenceIndex: referenceIndexes[0], exact: true, similarity: 1 });
        });
        candidates.sort((left, right) => left.myIndex - right.myIndex || left.referenceIndex - right.referenceIndex);
        return longestIncreasingAnchors(candidates);
    }

    function positionsByNormalized(slices: ComparisonSlice[]): Map<string, number[]> {
        const positions = new Map<string, number[]>();
        slices.forEach((slice, index) => {
            const indexes = positions.get(slice.normalized) || [];
            indexes.push(index);
            positions.set(slice.normalized, indexes);
        });
        return positions;
    }

    function longestIncreasingAnchors(candidates: Anchor[]): Anchor[] {
        const tails: number[] = [];
        const tailCandidateIndexes: number[] = [];
        const previous = new Int32Array(candidates.length);
        previous.fill(-1);
        candidates.forEach((candidate, candidateIndex) => {
            let low = 0;
            let high = tails.length;
            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                if (tails[middle] < candidate.referenceIndex) low = middle + 1;
                else high = middle;
            }
            if (low === tails.length) {
                tails.push(candidate.referenceIndex);
                tailCandidateIndexes.push(candidateIndex);
            } else {
                tails[low] = candidate.referenceIndex;
                tailCandidateIndexes[low] = candidateIndex;
            }
            if (low > 0) previous[candidateIndex] = tailCandidateIndexes[low - 1];
        });
        if (!tailCandidateIndexes.length) return [];
        const result: Anchor[] = [];
        let cursor = tailCandidateIndexes[tailCandidateIndexes.length - 1];
        while (cursor >= 0) {
            result.push(candidates[cursor]);
            cursor = previous[cursor];
        }
        return result.reverse();
    }

    function anchorMatch(anchor: Anchor): AlignmentMatch {
        return {
            myStart: anchor.myIndex,
            myEnd: anchor.myIndex + 1,
            referenceStart: anchor.referenceIndex,
            referenceEnd: anchor.referenceIndex + 1,
            exact: anchor.exact,
            similarity: anchor.similarity
        };
    }

    function alignGap(
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[],
        start: Anchor,
        end: Anchor,
        options: ComparisonOptions
    ): AlignmentMatch[] {
        const myStart = start.myIndex + 1;
        const myEnd = end.myIndex;
        const referenceStart = start.referenceIndex + 1;
        const referenceEnd = end.referenceIndex;
        if (myStart >= myEnd || referenceStart >= referenceEnd) return [];
        const minimum = Math.max(0.6, Math.min(0.9, options.minimumCandidateSimilarity ?? 0.64));
        const referenceWindows = sliceWindows(referenceSlices, referenceStart, referenceEnd);
        const gramIndex = new Map<string, number[]>();
        const exactIndex = new Map<string, number[]>();
        referenceWindows.forEach((window, windowIndex) => {
            const exact = exactIndex.get(window.normalized) || [];
            exact.push(windowIndex);
            exactIndex.set(window.normalized, exact);
            window.grams.forEach((gram) => {
                const indexes = gramIndex.get(gram) || [];
                indexes.push(windowIndex);
                gramIndex.set(gram, indexes);
            });
        });
        const candidates: Candidate[] = [];
        sliceWindows(mySlices, myStart, myEnd).forEach((myWindow) => {
            const exact = exactIndex.get(myWindow.normalized) || [];
            const counts = new Map<number, number>();
            if (exact.length) exact.forEach((windowIndex) => counts.set(windowIndex, Number.MAX_SAFE_INTEGER));
            else myWindow.grams.forEach((gram) => {
                (gramIndex.get(gram) || []).forEach((windowIndex) => {
                    counts.set(windowIndex, (counts.get(windowIndex) || 0) + 1);
                });
            });
            Array.from(counts.entries())
                .sort((left, right) => right[1] - left[1] || left[0] - right[0])
                .slice(0, 24)
                .forEach(([windowIndex]) => {
                    const referenceWindow = referenceWindows[windowIndex];
                    const exactMatch = myWindow.normalized === referenceWindow.normalized;
                    const similarity = exactMatch ? 1 : text.similarity(myWindow.text, referenceWindow.text) as number;
                    if (similarity < minimum) return;
                    const lengthRatio = Math.min(myWindow.normalized.length, referenceWindow.normalized.length)
                        / Math.max(1, myWindow.normalized.length, referenceWindow.normalized.length);
                    if (!exactMatch && lengthRatio < 0.42) return;
                    const coverage = Math.min(myWindow.normalized.length, referenceWindow.normalized.length);
                    const myPosition = (myWindow.start - myStart) / Math.max(1, myEnd - myStart - 1);
                    const referencePosition = (referenceWindow.start - referenceStart) / Math.max(1, referenceEnd - referenceStart - 1);
                    const positionBonus = Math.max(0, 1 - Math.abs(myPosition - referencePosition)) * coverage * 0.03;
                    const baseScore = coverage * (exactMatch ? 1.25 : similarity - minimum + 0.18) + positionBonus;
                    candidates.push({
                        myStart: myWindow.start,
                        myEnd: myWindow.end,
                        referenceStart: referenceWindow.start,
                        referenceEnd: referenceWindow.end,
                        exact: exactMatch,
                        similarity,
                        baseScore,
                        score: baseScore,
                        previous: -1
                    });
                });
        });
        return maximumWeightChain(candidates, referenceStart, referenceEnd);
    }

    function sliceWindows(
        slices: ComparisonSlice[],
        start: number,
        end: number
    ): Array<{ start: number; end: number; text: string; normalized: string; grams: string[] }> {
        const windows: Array<{ start: number; end: number; text: string; normalized: string; grams: string[] }> = [];
        for (let index = start; index < end; index += 1) {
            for (let size = 1; size <= 24 && index + size <= end; size += 1) {
                const values = slices.slice(index, index + size);
                const normalized = values.map((slice) => slice.normalized).join("");
                if (!normalized || normalized.length > 520) break;
                if (size > 2 && !values.every(isStructuralFragment)) break;
                const value = values.map((slice) => slice.text).join("");
                windows.push({
                    start: index,
                    end: index + size,
                    text: value,
                    normalized,
                    grams: text.grams(value) as string[]
                });
            }
        }
        return windows;
    }

    function isStructuralFragment(slice: ComparisonSlice): boolean {
        return slice.normalized.length <= 80 && !/[。；！？!?]$/.test(slice.text.trim());
    }

    function maximumWeightChain(candidates: Candidate[], referenceStart: number, referenceEnd: number): AlignmentMatch[] {
        if (!candidates.length) return [];
        candidates.sort((left, right) => left.myStart - right.myStart
            || left.referenceStart - right.referenceStart
            || left.myEnd - right.myEnd
            || left.referenceEnd - right.referenceEnd);
        const size = referenceEnd - referenceStart + 2;
        const bestScores = new Float64Array(size);
        const bestNodes = new Int32Array(size);
        bestNodes.fill(-1);
        const completionOrder = candidates.map((_candidate, index) => index)
            .sort((left, right) => candidates[left].myEnd - candidates[right].myEnd);
        let completionCursor = 0;
        let bestNode = -1;
        let groupStart = 0;
        while (groupStart < candidates.length) {
            let groupEnd = groupStart + 1;
            const currentMyStart = candidates[groupStart].myStart;
            while (completionCursor < completionOrder.length
                && candidates[completionOrder[completionCursor]].myEnd <= currentMyStart) {
                const node = completionOrder[completionCursor];
                const completed = candidates[node];
                const position = completed.referenceEnd - referenceStart + 1;
                fenwickUpdate(bestScores, bestNodes, position, completed.score, node);
                completionCursor += 1;
            }
            while (groupEnd < candidates.length && candidates[groupEnd].myStart === currentMyStart) groupEnd += 1;
            for (let index = groupStart; index < groupEnd; index += 1) {
                const candidate = candidates[index];
                const queryPosition = candidate.referenceStart - referenceStart + 1;
                const previousBest = fenwickQuery(bestScores, bestNodes, queryPosition);
                candidate.score = candidate.baseScore + previousBest.score;
                candidate.previous = previousBest.node;
                if (bestNode < 0 || candidate.score > candidates[bestNode].score) bestNode = index;
            }
            groupStart = groupEnd;
        }
        const result: AlignmentMatch[] = [];
        let cursor = bestNode;
        while (cursor >= 0) {
            const candidate = candidates[cursor];
            result.push({
                myStart: candidate.myStart,
                myEnd: candidate.myEnd,
                referenceStart: candidate.referenceStart,
                referenceEnd: candidate.referenceEnd,
                exact: candidate.exact,
                similarity: candidate.similarity
            });
            cursor = candidate.previous;
        }
        return result.reverse();
    }

    function fenwickQuery(scores: Float64Array, nodes: Int32Array, position: number): { score: number; node: number } {
        let bestScore = 0;
        let bestNode = -1;
        for (let index = position; index > 0; index -= index & -index) {
            if (scores[index] > bestScore) {
                bestScore = scores[index];
                bestNode = nodes[index];
            }
        }
        return { score: bestScore, node: bestNode };
    }

    function fenwickUpdate(scores: Float64Array, nodes: Int32Array, position: number, score: number, node: number): void {
        for (let index = position; index < scores.length; index += index & -index) {
            if (score <= scores[index]) continue;
            scores[index] = score;
            nodes[index] = node;
        }
    }

    function deduplicateMatches(matches: AlignmentMatch[]): AlignmentMatch[] {
        const result: AlignmentMatch[] = [];
        matches.sort((left, right) => left.myStart - right.myStart || left.referenceStart - right.referenceStart);
        matches.forEach((match) => {
            const previous = result[result.length - 1];
            if (previous && (match.myStart < previous.myEnd || match.referenceStart < previous.referenceEnd)) return;
            result.push(match);
        });
        return result;
    }

    function requireTextEngine(): void {
        if (!text?.createSlices) throw new Error("ManualProofText is not loaded.");
        if (!eventBuilder?.build) throw new Error("ManualProofEvents is not loaded.");
    }

export const ManualProofAlignment = {
        compare,
        uniqueExactAnchors,
        alignGap
    };
