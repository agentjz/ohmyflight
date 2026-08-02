import { siteVisibility } from "../site-visibility";

const HOME_ACCESS_PATTERN = [7, 8, 9];

export function appendHomePatternNode(sequence: number[], node: number): number[] {
    if (!Number.isInteger(node) || node < 1 || node > 9 || sequence.includes(node)) return [...sequence];

    const next = [...sequence];
    const previous = next.length ? next[next.length - 1] : undefined;
    if (previous !== undefined) {
        const intermediate = getHomePatternIntermediateNode(previous, node);
        if (intermediate !== undefined && !next.includes(intermediate)) next.push(intermediate);
    }
    next.push(node);
    return next;
}

function getHomePatternIntermediateNode(from: number, to: number): number | undefined {
    const fromIndex = from - 1;
    const toIndex = to - 1;
    const fromRow = Math.floor(fromIndex / 3);
    const fromColumn = fromIndex % 3;
    const toRow = Math.floor(toIndex / 3);
    const toColumn = toIndex % 3;

    if ((fromRow + toRow) % 2 !== 0 || (fromColumn + toColumn) % 2 !== 0) return undefined;
    const middleRow = (fromRow + toRow) / 2;
    const middleColumn = (fromColumn + toColumn) / 2;
    const middleNode = middleRow * 3 + middleColumn + 1;
    return middleNode === from || middleNode === to ? undefined : middleNode;
}

export function matchesHomeAccessPattern(sequence: number[]): boolean {
    if (sequence.length !== HOME_ACCESS_PATTERN.length) return false;
    const forward = HOME_ACCESS_PATTERN.every((node, index) => sequence[index] === node);
    const backward = HOME_ACCESS_PATTERN.every((node, index) => sequence[sequence.length - 1 - index] === node);
    return forward || backward;
}

export const homePatternLogic = {
    enabled: siteVisibility.homepage.patternGate === true,
    pattern: [...HOME_ACCESS_PATTERN],
    appendNode: appendHomePatternNode,
    matches: matchesHomeAccessPattern
};
