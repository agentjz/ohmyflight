import type {
    ComparisonOptions,
    ComparisonSlice,
    DiffKind,
    DiffSegment,
    WorkerManual
} from "./models";

    function normalize(value: unknown): string {
        return String(value ?? "")
            .normalize("NFKC")
            .toLowerCase()
            .replace(/^\s*(?:\d+(?:\.\d+){1,6}|[（(]\s*\d+\s*[）)]|[a-z][.、])\s*/, "")
            .replace(/[^0-9a-z\u4e00-\u9fff]+/g, "");
    }

    function grams(value: string, size = 2): string[] {
        const text = normalize(value);
        if (!text) return [];
        if (text.length <= size) return [text];
        const result = new Set<string>();
        for (let index = 0; index <= text.length - size; index += 1) {
            result.add(text.slice(index, index + size));
        }
        return Array.from(result);
    }

    function tokens(value: unknown): string[] {
        const text = String(value ?? "").normalize("NFKC").toLowerCase();
        const result = new Set<string>();
        (text.match(/[a-z][a-z0-9._/-]*|\d+(?:\.\d+)*/g) || []).forEach((token) => {
            if (token.length >= 2 || /^\d+$/.test(token)) result.add(token);
        });
        return Array.from(result).sort();
    }

    function splitText(value: unknown): string[] {
        const source = String(value ?? "").replace(/\r\n?/g, "\n").replace(/\n+/g, "").trim();
        if (!source) return [];
        const strong = splitKeepingBoundary(source, new Set(["。", "！", "？", "!", "?", "；", ";"]));
        const result: string[] = [];
        strong.forEach((part) => {
            if (normalize(part).length <= 180) {
                appendPart(result, part);
                return;
            }
            const soft = splitKeepingBoundary(part, new Set(["，", ",", "、", "：", ":"]));
            let buffer = "";
            soft.forEach((item) => {
                const next = `${buffer}${item}`;
                if (buffer && normalize(next).length > 140) {
                    appendPart(result, buffer);
                    buffer = item;
                } else {
                    buffer = next;
                }
            });
            appendPart(result, buffer);
        });
        return result;
    }

    function splitKeepingBoundary(value: string, boundaries: Set<string>): string[] {
        const result: string[] = [];
        let current = "";
        Array.from(value).forEach((character) => {
            current += character;
            if (!boundaries.has(character)) return;
            if (current.trim()) result.push(current.trim());
            current = "";
        });
        if (current.trim()) result.push(current.trim());
        return result;
    }

    function appendPart(result: string[], rawPart: string): void {
        const part = rawPart.trim();
        if (!part) return;
        const normalized = normalize(part);
        if (!normalized) return;
        if (result.length && normalized.length < 8 && !/[。！？？!；;]$/.test(part) && !/^\d+(?:\.\d+)+$/.test(part)) {
            result[result.length - 1] += part;
            return;
        }
        result.push(part);
    }

    function similarity(leftValue: unknown, rightValue: unknown): number {
        const left = normalize(leftValue);
        const right = normalize(rightValue);
        if (!left || !right) return 0;
        if (left === right) return 1;
        const leftGrams = grams(left);
        const rightGrams = grams(right);
        const rightSet = new Set(rightGrams);
        const overlap = leftGrams.filter((gram) => rightSet.has(gram)).length;
        const dice = (2 * overlap) / Math.max(1, leftGrams.length + rightGrams.length);
        const lengthRatio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
        const containment = left.includes(right) || right.includes(left) ? lengthRatio : 0;
        return clamp(Math.max(containment, dice * 0.82 + lengthRatio * 0.18));
    }

    function createSlices(manual: WorkerManual, options: ComparisonOptions = {}): ComparisonSlice[] {
        const weak = new Set((options.weakPhrases || []).map(normalize).filter(Boolean));
        const slices: ComparisonSlice[] = [];
        manual.units.forEach((unit) => {
            splitText(unit.text).forEach((text) => {
                const normalized = normalize(text);
                const extractedTokens = tokens(text);
                if (!normalized || /^\d+$/.test(normalized)) return;
                if (normalized.length < 6 && extractedTokens.length === 0) return;
                if (weak.has(normalized)) return;
                slices.push({
                    id: `${manual.id}-slice-${slices.length + 1}`,
                    manualId: manual.id,
                    index: slices.length,
                    unitId: unit.id,
                    unitIndex: unit.index,
                    text,
                    normalized,
                    grams: grams(normalized),
                    tokens: extractedTokens,
                    title: unit.title,
                    pageNumber: unit.pageNumber
                });
            });
        });
        return slices;
    }

    function compareTokens(left: string[], right: string[]): { leftOnly: string[]; rightOnly: string[] } {
        const leftSet = new Set(left);
        const rightSet = new Set(right);
        return {
            leftOnly: left.filter((token) => !rightSet.has(token)),
            rightOnly: right.filter((token) => !leftSet.has(token))
        };
    }

    function inlineDiff(leftValue: unknown, rightValue: unknown): { left: DiffSegment[]; right: DiffSegment[] } {
        const left = compactDisplay(leftValue);
        const right = compactDisplay(rightValue);
        if (left === right) {
            return { left: left ? [{ kind: "equal", text: left }] : [], right: right ? [{ kind: "equal", text: right }] : [] };
        }
        const leftChars = Array.from(left);
        const rightChars = Array.from(right);
        if (leftChars.length * rightChars.length > 600_000) return edgeDiff(left, right);
        const width = rightChars.length + 1;
        const table = new Uint16Array((leftChars.length + 1) * width);
        for (let leftIndex = leftChars.length - 1; leftIndex >= 0; leftIndex -= 1) {
            for (let rightIndex = rightChars.length - 1; rightIndex >= 0; rightIndex -= 1) {
                const offset = leftIndex * width + rightIndex;
                table[offset] = leftChars[leftIndex] === rightChars[rightIndex]
                    ? table[(leftIndex + 1) * width + rightIndex + 1] + 1
                    : Math.max(table[(leftIndex + 1) * width + rightIndex], table[offset + 1]);
            }
        }
        const leftSegments: DiffSegment[] = [];
        const rightSegments: DiffSegment[] = [];
        let leftIndex = 0;
        let rightIndex = 0;
        while (leftIndex < leftChars.length || rightIndex < rightChars.length) {
            if (leftIndex < leftChars.length && rightIndex < rightChars.length && leftChars[leftIndex] === rightChars[rightIndex]) {
                pushSegment(leftSegments, "equal", leftChars[leftIndex]);
                pushSegment(rightSegments, "equal", rightChars[rightIndex]);
                leftIndex += 1;
                rightIndex += 1;
            } else if (rightIndex < rightChars.length && (leftIndex >= leftChars.length
                || table[leftIndex * width + rightIndex + 1] >= table[(leftIndex + 1) * width + rightIndex])) {
                pushSegment(rightSegments, "added", rightChars[rightIndex]);
                rightIndex += 1;
            } else {
                pushSegment(leftSegments, "removed", leftChars[leftIndex]);
                leftIndex += 1;
            }
        }
        return { left: leftSegments, right: rightSegments };
    }

    function edgeDiff(left: string, right: string): { left: DiffSegment[]; right: DiffSegment[] } {
        let prefix = 0;
        const maxPrefix = Math.min(left.length, right.length);
        while (prefix < maxPrefix && left[prefix] === right[prefix]) prefix += 1;
        let suffix = 0;
        while (suffix < left.length - prefix && suffix < right.length - prefix
            && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
        const before = left.slice(0, prefix);
        const after = suffix ? left.slice(left.length - suffix) : "";
        const leftMiddle = left.slice(prefix, left.length - suffix || undefined);
        const rightMiddle = right.slice(prefix, right.length - suffix || undefined);
        return {
            left: [before && { kind: "equal" as const, text: before }, leftMiddle && { kind: "removed" as const, text: leftMiddle }, after && { kind: "equal" as const, text: after }].filter(Boolean) as DiffSegment[],
            right: [before && { kind: "equal" as const, text: before }, rightMiddle && { kind: "added" as const, text: rightMiddle }, after && { kind: "equal" as const, text: after }].filter(Boolean) as DiffSegment[]
        };
    }

    function compactDisplay(value: unknown): string {
        return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
    }

    function pushSegment(segments: DiffSegment[], kind: DiffKind, text: string): void {
        const previous = segments[segments.length - 1];
        if (previous?.kind === kind) previous.text += text;
        else segments.push({ kind, text });
    }

    function clamp(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

export const ManualProofText = {
    normalize,
    grams,
    tokens,
    splitText,
    similarity,
    createSlices,
    compareTokens,
    inlineDiff
};
