import type { PdfStampResizeDirection, PdfStampRule } from "./models";

type PdfStampDrawOptions = {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
};
type PdfStampOverlayStyle = {
    leftPx: number;
    topPx: number;
    widthPx: number;
    heightPx: number;
    opacity: string;
};
type PdfStampPagePlan = {
    pageNum: number;
    rules: PdfStampRule[];
};

export const MM2PT = 72 / 25.4;

export function createRule(id: number, imgAspect: number, overrides?: Partial<PdfStampRule>): PdfStampRule {
        const safeAspect = imgAspect > 0 ? imgAspect : 1;
        return {
            id,
            mode: 'all',
            rangeStr: '',
            xMm: 10,
            yMm: 10,
            wMm: 30,
            hMm: Math.round(30 / safeAspect * 10) / 10,
            opacity: 1,
            lockRatio: true,
            ...(overrides || {})
        };
    }
export function parsePageRange(rangeStr: string, maxPage: number): number[] {
        const max = Math.max(0, Math.floor(maxPage));
        if (!rangeStr || !rangeStr.trim() || max <= 0) return [];

        const pages = new Set<number>();
        for (const part of rangeStr.split(',')) {
            const text = part.trim();
            if (!text) continue;

            if (text.includes('-')) {
                const [startRaw, endRaw] = text.split('-');
                const start = Number.parseInt(startRaw.trim(), 10);
                const end = Number.parseInt(endRaw.trim(), 10);
                if (Number.isNaN(start) || Number.isNaN(end)) continue;

                const lower = Math.max(1, Math.min(start, end));
                const upper = Math.min(max, Math.max(start, end));
                for (let page = lower; page <= upper; page++) {
                    pages.add(page);
                }
                continue;
            }

            const page = Number.parseInt(text, 10);
            if (!Number.isNaN(page) && page >= 1 && page <= max) {
                pages.add(page);
            }
        }

        return Array.from(pages).sort((left, right) => left - right);
    }

export function ruleMatchesPage(rule: Pick<PdfStampRule, 'mode' | 'rangeStr'>, pageNum: number, maxPage: number): boolean {
        if (pageNum < 1 || pageNum > maxPage) return false;
        if (rule.mode === 'all') return true;
        if (rule.mode === 'odd') return pageNum % 2 === 1;
        if (rule.mode === 'even') return pageNum % 2 === 0;
        if (rule.mode === 'range') return parsePageRange(rule.rangeStr, maxPage).includes(pageNum);
        return false;
    }

export function getRulesForPage(rules: PdfStampRule[], pageNum: number, maxPage: number): PdfStampRule[] {
        return rules.filter(rule => ruleMatchesPage(rule, pageNum, maxPage));
    }

export function buildStampDrawOptions(rule: PdfStampRule, pageHeightPt: number): PdfStampDrawOptions {
        const width = rule.wMm * MM2PT;
        const height = rule.hMm * MM2PT;
        return {
            x: rule.xMm * MM2PT,
            y: pageHeightPt - rule.yMm * MM2PT - height,
            width,
            height,
            opacity: rule.opacity
        };
    }

export function updateRuleField(rule: PdfStampRule, field: keyof PdfStampRule, value: unknown, imgAspect: number): PdfStampRule {
        const next = { ...rule };
        if (field === 'mode') {
            const mode = String(value);
            if (mode === 'all' || mode === 'odd' || mode === 'even' || mode === 'range') {
                next.mode = mode;
            }
            return next;
        }
        if (field === 'rangeStr') {
            next.rangeStr = String(value ?? '');
            return next;
        }
        if (field === 'lockRatio') {
            next.lockRatio = !!value;
            return next;
        }
        if (field === 'xMm' || field === 'yMm' || field === 'wMm' || field === 'hMm' || field === 'opacity') {
            next[field] = Number.parseFloat(String(value)) || 0;
            if (next.lockRatio && imgAspect > 0) {
                if (field === 'wMm') {
                    next.hMm = next.wMm / imgAspect;
                } else if (field === 'hMm') {
                    next.wMm = next.hMm * imgAspect;
                }
            }
        }
        return next;
    }

    function mmToPx(valueMm: number, renderScale: number): number {
        return valueMm * renderScale * MM2PT;
    }

    function pxToMm(valuePx: number, renderScale: number): number {
        return valuePx / (renderScale * MM2PT);
    }

export function buildOverlayStyle(rule: PdfStampRule, renderScale: number): PdfStampOverlayStyle {
        return {
            leftPx: mmToPx(rule.xMm, renderScale),
            topPx: mmToPx(rule.yMm, renderScale),
            widthPx: mmToPx(rule.wMm, renderScale),
            heightPx: mmToPx(rule.hMm, renderScale),
            opacity: String(rule.opacity)
        };
    }

export function applyOverlayMove(
        rule: PdfStampRule,
        input: {
            dxPx: number;
            dyPx: number;
            startLeftPx: number;
            startTopPx: number;
            widthPx: number;
            heightPx: number;
            canvasWidthPx: number;
            canvasHeightPx: number;
            renderScale: number;
        }
    ): PdfStampRule {
        const leftPx = Math.max(0, Math.min(input.startLeftPx + input.dxPx, input.canvasWidthPx - input.widthPx));
        const topPx = Math.max(0, Math.min(input.startTopPx + input.dyPx, input.canvasHeightPx - input.heightPx));
        return {
            ...rule,
            xMm: pxToMm(leftPx, input.renderScale),
            yMm: pxToMm(topPx, input.renderScale)
        };
    }

export function applyOverlayResize(
        rule: PdfStampRule,
        input: {
            direction: PdfStampResizeDirection;
            dxPx: number;
            dyPx: number;
            startLeftPx: number;
            startTopPx: number;
            startWidthPx: number;
            startHeightPx: number;
            renderScale: number;
            imgAspect: number;
        }
    ): PdfStampRule {
        let leftPx = input.startLeftPx;
        let topPx = input.startTopPx;
        let widthPx = input.startWidthPx;
        let heightPx = input.startHeightPx;
        const lockRatio = rule.lockRatio && input.imgAspect > 0;

        if (input.direction === 'br') {
            widthPx = Math.max(10, input.startWidthPx + input.dxPx);
            heightPx = lockRatio ? widthPx / input.imgAspect : Math.max(10, input.startHeightPx + input.dyPx);
        } else if (input.direction === 'bl') {
            widthPx = Math.max(10, input.startWidthPx - input.dxPx);
            heightPx = lockRatio ? widthPx / input.imgAspect : Math.max(10, input.startHeightPx + input.dyPx);
            leftPx = input.startLeftPx + (input.startWidthPx - widthPx);
        } else if (input.direction === 'tr') {
            widthPx = Math.max(10, input.startWidthPx + input.dxPx);
            heightPx = lockRatio ? widthPx / input.imgAspect : Math.max(10, input.startHeightPx - input.dyPx);
            topPx = input.startTopPx + (input.startHeightPx - heightPx);
        } else if (input.direction === 'tl') {
            widthPx = Math.max(10, input.startWidthPx - input.dxPx);
            heightPx = lockRatio ? widthPx / input.imgAspect : Math.max(10, input.startHeightPx - input.dyPx);
            leftPx = input.startLeftPx + (input.startWidthPx - widthPx);
            topPx = input.startTopPx + (input.startHeightPx - heightPx);
        }

        return {
            ...rule,
            xMm: pxToMm(leftPx, input.renderScale),
            yMm: pxToMm(topPx, input.renderScale),
            wMm: pxToMm(widthPx, input.renderScale),
            hMm: pxToMm(heightPx, input.renderScale)
        };
    }

export function buildExportPlan(rules: PdfStampRule[], totalPages: number): PdfStampPagePlan[] {
        const pages: PdfStampPagePlan[] = [];
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageRules = getRulesForPage(rules, pageNum, totalPages);
            if (pageRules.length) {
                pages.push({ pageNum, rules: pageRules });
            }
        }
        return pages;
    }
