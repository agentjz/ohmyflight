import type { AuditKingHighlightRange, AuditKingTextBlock } from "./models";

    type HighlightSegment = {
        text: string;
        keywordIds: string[];
        evidenceIds: string[];
        colors: string[];
    };

    function normalizeRanges(text: string, ranges: AuditKingHighlightRange[]): AuditKingHighlightRange[] {
        return ranges
            .map((range) => ({
                ...range,
                start: Math.max(0, Math.min(text.length, range.start)),
                end: Math.max(0, Math.min(text.length, range.end))
            }))
            .filter((range) => range.end > range.start)
            .sort((left, right) => left.start - right.start || left.end - right.end);
    }

    function buildHighlightSegments(text: string, ranges: AuditKingHighlightRange[]): HighlightSegment[] {
        const normalizedRanges = normalizeRanges(text, ranges);
        const boundaries = new Set<number>([0, text.length]);

        normalizedRanges.forEach((range) => {
            boundaries.add(range.start);
            boundaries.add(range.end);
        });

        const sortedBoundaries = Array.from(boundaries).sort((left, right) => left - right);
        const segments: HighlightSegment[] = [];

        for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
            const start = sortedBoundaries[index];
            const end = sortedBoundaries[index + 1];
            if (end <= start) continue;
            const active = normalizedRanges.filter((range) => range.start < end && range.end > start);
            segments.push({
                text: text.slice(start, end),
                keywordIds: active.filter((range) => range.kind !== "manual-evidence").map((range) => range.checkItemId),
                evidenceIds: active.filter((range) => range.kind === "manual-evidence").map((range) => range.evidenceId || range.checkItemId),
                colors: active.map((range) => range.color)
            });
        }

        return segments.filter((segment) => segment.text);
    }

    function buildContext(
        text: string,
        options: { start: number; end: number; before: number; after: number }
    ): { text: string; offset: number; truncatedStart: boolean; truncatedEnd: boolean } {
        const start = Math.max(0, options.start - options.before);
        const end = Math.min(text.length, options.end + options.after);
        return {
            text: text.slice(start, end),
            offset: start,
            truncatedStart: start > 0,
            truncatedEnd: end < text.length
        };
    }

    function buildFullContext(text: string): { text: string; offset: number; truncatedStart: boolean; truncatedEnd: boolean } {
        return {
            text,
            offset: 0,
            truncatedStart: false,
            truncatedEnd: false
        };
    }

    function buildBlockWindowContext(
        blocks: AuditKingTextBlock[],
        options: { blockId: string; matchStart: number; matchEnd: number; targetLength: number }
    ): { text: string; matchStart: number; matchEnd: number; truncatedStart: boolean; truncatedEnd: boolean; windowStart: number; windowEnd: number } {
        const currentIndex = blocks.findIndex((block) => block.id === options.blockId);
        if (currentIndex < 0) {
            return {
                text: "",
                matchStart: 0,
                matchEnd: 0,
                truncatedStart: false,
                truncatedEnd: false,
                windowStart: 0,
                windowEnd: 0
            };
        }

        const blockOffsets: number[] = [];
        let offset = 0;
        blocks.forEach((block, index) => {
            blockOffsets[index] = offset;
            offset += block.text.length;
            if (index < blocks.length - 1) {
                offset += 2;
            }
        });

        const fullText = blocks.map((block) => block.text).join("\n\n");
        const currentOffset = blockOffsets[currentIndex] || 0;
        const globalMatchStart = currentOffset + options.matchStart;
        const globalMatchEnd = currentOffset + options.matchEnd;
        const targetLength = Math.max(globalMatchEnd - globalMatchStart, Math.trunc(options.targetLength || 0));
        const beforeLength = Math.floor((targetLength - (globalMatchEnd - globalMatchStart)) / 2);
        const afterLength = Math.max(0, targetLength - (globalMatchEnd - globalMatchStart) - beforeLength);
        const windowStart = Math.max(0, globalMatchStart - beforeLength);
        const windowEnd = Math.min(fullText.length, globalMatchEnd + afterLength);

        return {
            text: fullText.slice(windowStart, windowEnd),
            matchStart: globalMatchStart - windowStart,
            matchEnd: globalMatchEnd - windowStart,
            truncatedStart: windowStart > 0,
            truncatedEnd: windowEnd < fullText.length,
            windowStart,
            windowEnd
        };
    }

export const AuditKingHighlight = {
        buildHighlightSegments,
        buildContext,
        buildFullContext,
        buildBlockWindowContext
    };
