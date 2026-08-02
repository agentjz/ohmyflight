import type { LocalManual, ManualUnit } from "./models";

    function buildContextWindow(
        manual: Pick<LocalManual, "units">,
        focusUnitIds: string[],
        focusText: string,
        radius = 260
    ): { before: string; focus: string; after: string } | null {
        const focusIds = new Set(focusUnitIds);
        const focusIndexes = manual.units
            .map((unit, index) => focusIds.has(unit.id) ? index : -1)
            .filter((index) => index >= 0);
        if (!focusIndexes.length) return null;

        const firstIndex = Math.min(...focusIndexes);
        const lastIndex = Math.max(...focusIndexes);
        const beforeSource = joinUnitText(manual.units.slice(0, firstIndex));
        const selectedSource = joinUnitText(manual.units.slice(firstIndex, lastIndex + 1));
        const afterSource = joinUnitText(manual.units.slice(lastIndex + 1));
        const exactStart = focusText ? selectedSource.indexOf(focusText) : -1;
        const range = exactStart >= 0
            ? { start: exactStart, end: exactStart + focusText.length }
            : findNormalizedRange(selectedSource, focusText);

        if (!range) {
            return {
                before: beforeSource.slice(-radius),
                focus: focusText || selectedSource,
                after: afterSource.slice(0, radius)
            };
        }

        const before = joinContextText(beforeSource, selectedSource.slice(0, range.start));
        const after = joinContextText(selectedSource.slice(range.end), afterSource);
        return {
            before: before.slice(-radius),
            focus: selectedSource.slice(range.start, range.end),
            after: after.slice(0, radius)
        };
    }

    function joinUnitText(units: Array<Pick<ManualUnit, "text">>): string {
        return units.map((unit) => unit.text).filter(Boolean).join("\n");
    }

    function joinContextText(first: string, second: string): string {
        if (!first) return second;
        if (!second) return first;
        return `${first}\n${second}`;
    }

    function findNormalizedRange(source: string, focus: string): { start: number; end: number } | null {
        const sourceIndex = normalizeWithOffsets(source);
        const focusText = normalizeWithOffsets(focus).text;
        const normalizedStart = focusText ? sourceIndex.text.indexOf(focusText) : -1;
        if (normalizedStart < 0) return null;
        const start = sourceIndex.offsets[normalizedStart];
        const endOffset = sourceIndex.offsets[normalizedStart + focusText.length - 1];
        return start === undefined || endOffset === undefined ? null : { start, end: endOffset + 1 };
    }

    function normalizeWithOffsets(value: string): { text: string; offsets: number[] } {
        let text = "";
        const offsets: number[] = [];
        Array.from(value).forEach((raw, index) => {
            Array.from(raw.normalize("NFKC").toLowerCase()).forEach((character) => {
                if (!/[0-9a-z\u4e00-\u9fff]/.test(character)) return;
                text += character;
                offsets.push(index);
            });
        });
        return { text, offsets };
    }

export const ManualProofDocumentContext = { buildContextWindow, findNormalizedRange };
