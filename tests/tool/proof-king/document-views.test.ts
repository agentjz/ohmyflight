import { describe, expect, it } from "vitest";

import { ManualProofDocumentContext } from "../../../src/tool/app/proof-king/document-context";
import {
    calculatePdfPageWindow,
    calculateTopAlignedScrollTop
} from "../../../src/tool/app/proof-king/pdf-document-view";
import { calculateCenteredScrollTop } from "../../../src/tool/app/proof-king/word-document-view";

const views: any = {
    ...ManualProofDocumentContext,
    calculateCenteredScrollTop,
    calculatePdfPageWindow,
    calculateTopAlignedScrollTop
};

describe("校对之王原文定位", () => {
    it("PDF 上下文按忽略空格和标点后的原文定位", () => {
        expect(views.findNormalizedRange("前文。飞行 人员，应完成检查。后文。", "飞行人员应完成检查")).toEqual({ start: 3, end: 14 });
    });

    it("从完整手册中构造命中原文及前后上下文", () => {
        const manual = {
            units: [
                { id: "u-1", text: "第一段前文。" },
                { id: "u-2", text: "飞行 人员，应完成检查。" },
                { id: "u-3", text: "第三段后文。" }
            ]
        };

        const context = views.buildContextWindow(manual, ["u-2"], "飞行人员应完成检查", 40);

        expect(context.before).toContain("第一段前文");
        expect(context.focus).toBe("飞行 人员，应完成检查");
        expect(context.after).toContain("第三段后文");
    });

    it("计算 Word 阅读容器内部的居中滚动位置", () => {
        expect(views.calculateCenteredScrollTop(300, 100, 400, 610, 40)).toBe(630);
        expect(views.calculateCenteredScrollTop(0, 100, 400, 120, 20)).toBe(0);
    });

    it("PDF 只渲染目标页附近并限制远页 canvas 保留范围", () => {
        expect(views.calculatePdfPageWindow(10, 30)).toEqual({
            renderStart: 9,
            renderEnd: 11,
            retainStart: 7,
            retainEnd: 13
        });
        expect(views.calculatePdfPageWindow(1, 30)).toEqual({
            renderStart: 1,
            renderEnd: 2,
            retainStart: 1,
            retainEnd: 4
        });
    });

    it("PDF 目标页滚动值按容器内部位置计算", () => {
        expect(views.calculateTopAlignedScrollTop(1200, 600, 1450)).toBe(2040);
        expect(views.calculateTopAlignedScrollTop(0, 600, 605)).toBe(0);
    });
});
