import type {
    RevisionCategoryCount,
    RevisionChapterGroup,
    RevisionEvent,
    RevisionKind,
    RevisionNavigationEvent,
    VirtualWindow
} from "./models";
    const rowHeight = 118;
    const overscan = 4;

    const categoryOrder: Array<RevisionKind | "all"> = [
        "all", "reference-added", "reference-removed", "modified", "review"
    ];

    function filterEvents(
        events: RevisionEvent[],
        kind: RevisionKind | "all",
        query: string,
        chapter = "all"
    ): RevisionNavigationEvent[] {
        const normalizedQuery = normalized(query);
        const results = orderedEvents(events).flatMap((event): RevisionNavigationEvent[] => {
            const viewChapter = chapterLabel(event.title);
            if (kind !== "all" && event.kind !== kind) return [];
            if (chapter !== "all" && viewChapter !== chapter) return [];
            const annotated = annotateEvent(event, query, normalizedQuery, viewChapter);
            return annotated ? [annotated] : [];
        });
        return normalizedQuery
            ? results.sort((left, right) => (right.searchScore || 0) - (left.searchScore || 0))
            : results;
    }

    function categoryCounts(events: RevisionEvent[], query: string): RevisionCategoryCount[] {
        const normalizedQuery = normalized(query);
        return categoryOrder.map((kind) => {
            const categoryEvents = kind === "all" ? events : events.filter((event) => event.kind === kind);
            const matched = normalizedQuery
                ? categoryEvents.filter((event) => eventMatchesQuery(event, normalizedQuery)).length
                : categoryEvents.length;
            return { kind, label: kind === "all" ? "全部" : label(kind), total: categoryEvents.length, matched };
        });
    }

    function buildOutline(
        events: RevisionEvent[],
        kind: RevisionKind | "all",
        query: string
    ): RevisionChapterGroup[] {
        const normalizedQuery = normalized(query);
        const chapterGroups = new Map<string, RevisionChapterGroup>();
        sectionRuns(orderedEvents(events)).forEach((run) => {
            const filtered = run.events.flatMap((event): RevisionNavigationEvent[] => {
                if (kind !== "all" && event.kind !== kind) return [];
                const annotated = annotateEvent(event, query, normalizedQuery, run.chapterLabel);
                return annotated ? [annotated] : [];
            });
            if (!filtered.length) return;
            const chapterKey = `chapter:${normalized(run.chapterLabel) || "unknown"}`;
            let chapter = chapterGroups.get(chapterKey);
            if (!chapter) {
                chapter = { key: chapterKey, label: run.chapterLabel, count: 0, sections: [] };
                chapterGroups.set(chapterKey, chapter);
            }
            chapter.sections.push({
                key: `section:${run.index}`,
                label: run.sectionLabel,
                count: filtered.length,
                startEventId: filtered[0].id,
                events: filtered
            });
            chapter.count += filtered.length;
        });
        return Array.from(chapterGroups.values());
    }

    function sectionRuns(events: RevisionEvent[]): Array<{
        index: number;
        chapterLabel: string;
        sectionLabel: string;
        events: RevisionEvent[];
    }> {
        const runs: Array<{
            index: number;
            chapterLabel: string;
            sectionLabel: string;
            identity: string;
            events: RevisionEvent[];
        }> = [];
        events.forEach((event) => {
            const chapter = chapterLabel(event.title) || "未识别章节";
            const section = sectionLabel(event.title);
            const identity = `${normalized(chapter)}|${normalized(section)}`;
            const current = runs[runs.length - 1];
            if (current?.identity === identity) current.events.push(event);
            else runs.push({ index: runs.length, chapterLabel: chapter, sectionLabel: section, identity, events: [event] });
        });
        return runs;
    }

    function orderedEvents(events: RevisionEvent[]): RevisionEvent[] {
        return events.map((event, index) => ({ event, index, sequence: eventSequence(event.id) }))
            .sort((left, right) => {
                if (left.sequence !== null && right.sequence !== null) return left.sequence - right.sequence;
                return left.index - right.index;
            })
            .map(({ event }) => event);
    }

    function eventSequence(id: string): number | null {
        const match = String(id || "").match(/revision-(\d+)$/);
        return match ? Number(match[1]) : null;
    }

    function annotateEvent(
        event: RevisionEvent,
        query: string,
        normalizedQuery: string,
        viewChapter: string
    ): RevisionNavigationEvent | null {
        if (!normalizedQuery) return { ...event, viewChapter };
        const titleMatched = normalized(event.title).includes(normalizedQuery);
        const myMatched = normalized(event.myText).includes(normalizedQuery);
        const referenceMatched = normalized(event.referenceText).includes(normalizedQuery);
        if (!titleMatched && !myMatched && !referenceMatched) return null;
        const matchedSide = myMatched && referenceMatched ? "both" : myMatched ? "my" : referenceMatched ? "reference" : "title";
        const source = matchedSide === "my" ? event.myText
            : matchedSide === "reference" ? event.referenceText
                : shorterMatchingText(event, normalizedQuery);
        const sourceLength = Math.max(normalizedQuery.length, normalized(source).length);
        return {
            ...event,
            viewChapter,
            matchedSide,
            matchedExcerpt: excerpt(source, query),
            searchScore: (titleMatched ? 300 : 0) + (myMatched ? 120 : 0) + (referenceMatched ? 120 : 0)
                + (myMatched && referenceMatched ? 400 : 0) + Math.min(80, 2000 / sourceLength)
        };
    }

    function eventMatchesQuery(event: RevisionEvent, normalizedQuery: string): boolean {
        return normalized(event.title).includes(normalizedQuery)
            || normalized(event.myText).includes(normalizedQuery)
            || normalized(event.referenceText).includes(normalizedQuery);
    }

    function chapters(events: RevisionEvent[]): string[] {
        return Array.from(new Set(events.map((event) => chapterLabel(event.title)).filter(Boolean))) as string[];
    }

    function chapterLabel(title: string): string {
        const match = String(title || "").normalize("NFKC").match(/^\s*(\d+)(?:\.|\s|$)/);
        return match ? `第 ${match[1]} 章` : "";
    }

    function sectionLabel(title: string): string {
        const value = String(title || "").normalize("NFKC").trim();
        if (!value || ["参考手册新增", "参考手册删除", "内容修改", "待人工确认"].includes(value)) {
            return "未识别小节";
        }
        return value;
    }

    function normalized(value: unknown): string {
        return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    }

    function shorterMatchingText(event: RevisionEvent, query: string): string {
        const values = [event.myText, event.referenceText].filter((value) => normalized(value).includes(query));
        return values.sort((left, right) => left.length - right.length)[0] || event.referenceText || event.myText || event.title;
    }

    function excerpt(value: string, query: string, radius = 90): string {
        const text = String(value || "").replace(/\s+/g, " ").trim();
        if (!query) return text.slice(0, radius * 2);
        const index = text.normalize("NFKC").toLowerCase().indexOf(String(query).normalize("NFKC").toLowerCase());
        if (index < 0) return text.slice(0, radius * 2);
        return text.slice(Math.max(0, index - radius), index + query.length + radius);
    }

    function calculateWindow(scrollTop: number, viewportHeight: number, itemCount: number): VirtualWindow {
        const visible = Math.max(1, Math.ceil(Math.max(rowHeight, viewportHeight) / rowHeight));
        const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight) - overscan);
        const end = Math.min(itemCount, start + visible + overscan * 2);
        return { start, end, offsetTop: start * rowHeight, totalHeight: itemCount * rowHeight };
    }

    function label(kind: RevisionKind): string {
        return {
            "reference-added": "参考新增",
            "reference-removed": "参考删除",
            modified: "内容修改",
            review: "待确认"
        }[kind];
    }

export const ManualProofNavigation = {
        rowHeight,
        filterEvents,
        categoryCounts,
        buildOutline,
        chapters,
        chapterLabel,
        sectionLabel,
        calculateWindow,
        label
    };
