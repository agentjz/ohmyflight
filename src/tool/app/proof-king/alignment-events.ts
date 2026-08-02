import type {
    AlignmentMatch,
    ComparisonSlice,
    DiffSegment,
    RevisionContextAnchor,
    RevisionEvent,
    RevisionKind
} from "./models";
import { ManualProofText as text } from "./text-engine";

    function build(
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[],
        matches: AlignmentMatch[]
    ): RevisionEvent[] {
        const rawEvents = buildEvents(mySlices, referenceSlices, matches);
        return attachContextAnchors(
            mergeRelatedEvents(rawEvents, mySlices, referenceSlices),
            mySlices,
            referenceSlices,
            matches
        )
            .map(enforceEventConfidence)
            .sort((left, right) => eventPriority(left.kind) - eventPriority(right.kind)
                || firstSliceIndex(left, mySlices, referenceSlices) - firstSliceIndex(right, mySlices, referenceSlices));
    }

    function buildEvents(
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[],
        matches: AlignmentMatch[]
    ): RevisionEvent[] {
        const events: RevisionEvent[] = [];
        let myCursor = 0;
        let referenceCursor = 0;
        matches.forEach((match) => {
            addGapEvents(events, mySlices.slice(myCursor, match.myStart), referenceSlices.slice(referenceCursor, match.referenceStart));
            if (!match.exact) {
                events.push(makeEvent(
                    "modified",
                    mySlices.slice(match.myStart, match.myEnd),
                    referenceSlices.slice(match.referenceStart, match.referenceEnd)
                ));
            }
            myCursor = match.myEnd;
            referenceCursor = match.referenceEnd;
        });
        addGapEvents(events, mySlices.slice(myCursor), referenceSlices.slice(referenceCursor));
        return events;
    }

    function addGapEvents(events: RevisionEvent[], myGap: ComparisonSlice[], referenceGap: ComparisonSlice[]): void {
        if (!myGap.length && !referenceGap.length) return;
        if (!myGap.length) {
            chunkSlices(referenceGap).forEach((chunk) => events.push(makeEvent("reference-added", [], chunk)));
            return;
        }
        if (!referenceGap.length) {
            chunkSlices(myGap).forEach((chunk) => events.push(makeEvent("reference-removed", chunk, [])));
            return;
        }
        const aggregateSimilarity = text.similarity(joinSliceText(myGap), joinSliceText(referenceGap)) as number;
        const myLength = joinNormalizedLength(myGap);
        const referenceLength = joinNormalizedLength(referenceGap);
        const lengthRatio = Math.min(myLength, referenceLength) / Math.max(1, myLength, referenceLength);
        if (aggregateSimilarity >= 0.34 && lengthRatio >= 0.28 && myGap.length <= 12 && referenceGap.length <= 12) {
            events.push(makeEvent(aggregateSimilarity >= 0.46 ? "modified" : "review", myGap, referenceGap));
            return;
        }
        chunkSlices(myGap).forEach((chunk) => events.push(makeEvent("reference-removed", chunk, [])));
        chunkSlices(referenceGap).forEach((chunk) => events.push(makeEvent("reference-added", [], chunk)));
    }

    function chunkSlices(slices: ComparisonSlice[]): ComparisonSlice[][] {
        const chunks: ComparisonSlice[][] = [];
        slices.forEach((slice) => {
            const current = chunks[chunks.length - 1];
            const previous = current?.[current.length - 1];
            const sameContext = !!previous && (
                previous.unitId === slice.unitId
                || (!!previous.title && previous.title === slice.title && current.length < 8)
            );
            if (sameContext) current.push(slice);
            else chunks.push([slice]);
        });
        return chunks;
    }

    function makeEvent(kind: RevisionKind, mySlices: ComparisonSlice[], referenceSlices: ComparisonSlice[]): RevisionEvent {
        const myText = joinSliceText(mySlices);
        const referenceText = joinSliceText(referenceSlices);
        const similarity = myText && referenceText ? text.similarity(myText, referenceText) as number : 0;
        const tokenDifference = text.compareTokens(
            Array.from(new Set(mySlices.flatMap((slice) => slice.tokens))),
            Array.from(new Set(referenceSlices.flatMap((slice) => slice.tokens)))
        ) as { leftOnly: string[]; rightOnly: string[] };
        const diff = text.inlineDiff(myText, referenceText) as { left: DiffSegment[]; right: DiffSegment[] };
        return {
            id: "",
            kind,
            title: referenceSlices.find((slice) => slice.title)?.title || mySlices.find((slice) => slice.title)?.title || label(kind),
            mySliceIds: mySlices.map((slice) => slice.id),
            referenceSliceIds: referenceSlices.map((slice) => slice.id),
            myUnitIds: Array.from(new Set(mySlices.map((slice) => slice.unitId))),
            referenceUnitIds: Array.from(new Set(referenceSlices.map((slice) => slice.unitId))),
            myText,
            referenceText,
            myLocation: rangeLocation(mySlices),
            referenceLocation: rangeLocation(referenceSlices),
            similarity: round(similarity),
            myTokensOnly: tokenDifference.leftOnly,
            referenceTokensOnly: tokenDifference.rightOnly,
            myDiff: diff.left,
            referenceDiff: diff.right,
            contextAnchors: [],
            reason: reason(kind, tokenDifference.leftOnly.length > 0 || tokenDifference.rightOnly.length > 0)
        };
    }

    function attachContextAnchors(
        events: RevisionEvent[],
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[],
        matches: AlignmentMatch[]
    ): RevisionEvent[] {
        const myIndexes = new Map(mySlices.map((slice, index) => [slice.id, index]));
        const referenceIndexes = new Map(referenceSlices.map((slice, index) => [slice.id, index]));
        return events.map((event) => {
            if (event.kind !== "reference-added" && event.kind !== "reference-removed") return event;
            const usesReference = event.kind === "reference-added";
            const ids = usesReference ? event.referenceSliceIds : event.mySliceIds;
            const indexes = ids
                .map((id) => (usesReference ? referenceIndexes : myIndexes).get(id))
                .filter((index): index is number => index !== undefined);
            if (!indexes.length) return event;
            const firstIndex = Math.min(...indexes);
            const lastIndex = Math.max(...indexes);
            const sideStart = (match: AlignmentMatch) => usesReference ? match.referenceStart : match.myStart;
            const sideEnd = (match: AlignmentMatch) => usesReference ? match.referenceEnd : match.myEnd;
            const reliableMatches = matches.filter((match) => match.exact || match.similarity >= 0.74);
            const before = reliableMatches.filter((match) => sideEnd(match) <= firstIndex).at(-1);
            const after = reliableMatches.find((match) => sideStart(match) > lastIndex);
            const contextAnchors = [
                before && makeContextAnchor("before", before, mySlices, referenceSlices),
                after && makeContextAnchor("after", after, mySlices, referenceSlices)
            ].filter(Boolean) as RevisionContextAnchor[];
            return { ...event, contextAnchors };
        });
    }

    function makeContextAnchor(
        position: "before" | "after",
        match: AlignmentMatch,
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[]
    ): RevisionContextAnchor {
        const myIndex = position === "before" ? match.myEnd - 1 : match.myStart;
        const referenceIndex = position === "before" ? match.referenceEnd - 1 : match.referenceStart;
        const mySlice = mySlices[myIndex];
        const referenceSlice = referenceSlices[referenceIndex];
        return {
            position,
            mySliceId: mySlice.id,
            referenceSliceId: referenceSlice.id,
            myUnitId: mySlice.unitId,
            referenceUnitId: referenceSlice.unitId,
            myText: mySlice.text,
            referenceText: referenceSlice.text,
            myUnitIndex: mySlice.unitIndex,
            referenceUnitIndex: referenceSlice.unitIndex,
            myPageNumber: mySlice.pageNumber,
            referencePageNumber: referenceSlice.pageNumber,
            exact: match.exact,
            similarity: match.similarity
        };
    }

    function mergeRelatedEvents(
        input: RevisionEvent[],
        mySlices: ComparisonSlice[],
        referenceSlices: ComparisonSlice[]
    ): RevisionEvent[] {
        const myById = new Map(mySlices.map((slice) => [slice.id, slice]));
        const referenceById = new Map(referenceSlices.map((slice) => [slice.id, slice]));
        const result: RevisionEvent[] = [];
        input.forEach((event) => {
            const previous = result[result.length - 1];
            const mergeableKinds = previous && (
                (previous.kind === "modified" && (event.kind === "reference-added" || event.kind === "reference-removed"))
                || (event.kind === "modified" && (previous.kind === "reference-added" || previous.kind === "reference-removed"))
            );
            const sameContext = previous && (
                sharesAny(previous.myUnitIds, event.myUnitIds)
                || sharesAny(previous.referenceUnitIds, event.referenceUnitIds)
                || (!!previous.title && previous.title === event.title)
            );
            const structuralContinuation = previous
                && previous.kind === event.kind
                && (event.kind === "reference-added" || event.kind === "reference-removed")
                && eventsAreContiguous(previous, event, myById, referenceById)
                && (isShortHeading(previous.myText || previous.referenceText) || (!!previous.title && previous.title === event.title));
            const mergedMy = previous
                ? [...previous.mySliceIds, ...event.mySliceIds].map((id) => myById.get(id)).filter(Boolean) as ComparisonSlice[]
                : [];
            const mergedReference = previous
                ? [...previous.referenceSliceIds, ...event.referenceSliceIds].map((id) => referenceById.get(id)).filter(Boolean) as ComparisonSlice[]
                : [];
            const balancedModification = mergeableKinds
                && sameContext
                && isBalancedModification(mergedMy, mergedReference);
            if (!balancedModification && !structuralContinuation) {
                result.push(event);
                return;
            }
            result[result.length - 1] = makeEvent(structuralContinuation ? event.kind : "modified", mergedMy, mergedReference);
        });
        return result.map((event, index) => ({ ...event, id: `revision-${index + 1}` }));
    }

    function sharesAny(left: string[], right: string[]): boolean {
        const rightSet = new Set(right);
        return left.some((value) => rightSet.has(value));
    }

    function eventsAreContiguous(
        left: RevisionEvent,
        right: RevisionEvent,
        myById: Map<string, ComparisonSlice>,
        referenceById: Map<string, ComparisonSlice>
    ): boolean {
        const side = left.referenceSliceIds.length ? "reference" : "my";
        const leftIds = side === "reference" ? left.referenceSliceIds : left.mySliceIds;
        const rightIds = side === "reference" ? right.referenceSliceIds : right.mySliceIds;
        const map = side === "reference" ? referenceById : myById;
        const leftIndex = map.get(leftIds[leftIds.length - 1])?.index;
        const rightIndex = map.get(rightIds[0])?.index;
        return leftIndex !== undefined && rightIndex === leftIndex + 1;
    }

    function isShortHeading(value: string): boolean {
        const normalized = String(value || "").replace(/\s+/g, "").trim();
        return normalized.length >= 2 && normalized.length <= 40 && !/[。；！？!?]$/.test(normalized);
    }

    function isBalancedModification(mySlices: ComparisonSlice[], referenceSlices: ComparisonSlice[]): boolean {
        const myLength = joinNormalizedLength(mySlices);
        const referenceLength = joinNormalizedLength(referenceSlices);
        const lengthRatio = Math.min(myLength, referenceLength) / Math.max(1, myLength, referenceLength);
        if (lengthRatio < 0.28) return false;
        return text.similarity(joinSliceText(mySlices), joinSliceText(referenceSlices)) >= 0.34;
    }

    function joinSliceText(slices: ComparisonSlice[]): string {
        return slices.map((slice) => slice.text).join("\n");
    }

    function joinNormalizedLength(slices: ComparisonSlice[]): number {
        return slices.reduce((total, slice) => total + slice.normalized.length, 0);
    }

    function rangeLocation(slices: ComparisonSlice[]): string {
        if (!slices.length) return "无对应原文";
        const first = slices[0];
        const last = slices[slices.length - 1];
        const describe = (slice: ComparisonSlice) => slice.pageNumber
            ? `第 ${slice.pageNumber} 页`
            : `第 ${slice.unitIndex} 段`;
        return describe(first) === describe(last) ? describe(first) : `${describe(first)} - ${describe(last)}`;
    }

    function label(kind: RevisionKind): string {
        return {
            "reference-added": "参考手册新增",
            "reference-removed": "参考手册删除",
            modified: "内容修改",
            review: "待人工确认"
        }[kind];
    }

    function reason(kind: RevisionKind, tokenChanged: boolean): string {
        if (kind === "reference-added") return "参考手册存在连续原文，我的手册在对应顺序范围内没有可靠对应。";
        if (kind === "reference-removed") return "我的手册存在连续原文，参考手册在对应顺序范围内没有可靠对应。";
        if (kind === "review") return "两侧位于相同顺序区间，但文字对应关系不足以自动确认。";
        return tokenChanged ? "对应内容中的数字或英文标识发生变化。" : "对应内容存在文字增删或替换。";
    }

    function enforceEventConfidence(event: RevisionEvent): RevisionEvent {
        if (event.kind !== "modified" || event.similarity >= 0.62) return event;
        return { ...event, kind: "review", reason: reason("review", false) };
    }

    function eventPriority(kind: RevisionKind): number {
        return { "reference-added": 0, "reference-removed": 1, modified: 2, review: 3 }[kind];
    }

    function firstSliceIndex(event: RevisionEvent, mySlices: ComparisonSlice[], referenceSlices: ComparisonSlice[]): number {
        const myIndexes = new Map(mySlices.map((slice) => [slice.id, slice.index]));
        const referenceIndexes = new Map(referenceSlices.map((slice) => [slice.id, slice.index]));
        return event.referenceSliceIds.length
            ? referenceIndexes.get(event.referenceSliceIds[0]) || 0
            : myIndexes.get(event.mySliceIds[0]) || 0;
    }

    function round(value: number): number {
        return Math.round(value * 1000) / 1000;
    }

export const ManualProofEvents = { build };
