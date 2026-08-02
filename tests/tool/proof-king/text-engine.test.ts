import { describe, expect, it } from "vitest";

import { ManualProofText as text } from "../../../src/tool/app/proof-king/text-engine";

describe("校对之王文本引擎", () => {
    it("先按标点切句，再为匹配副本去除排版和编号", () => {
        expect(text.splitText("3.1 第一条。第二条；第三条！")).toEqual(["3.1 第一条。", "第二条；", "第三条！"]);
        expect(text.normalize(" 3.1  第一 条。 ")).toBe("第一条");
    });

    it("不内置业务词等价关系并保留数字英文变化", () => {
        expect(text.similarity("飞行部负责检查。", "飞行训练管理部负责检查。")).toBeLessThan(1);
        expect(text.tokens("不少于 60 个起落，人工飞行 360 分钟，ICAO 4级")).toEqual(["360", "4", "60", "icao"]);
    });

    it("生成可直接高亮的双侧逐字差异", () => {
        const result = text.inlineDiff("不少于60个起落", "不少于70个起落");
        expect(result.left.some((item: any) => item.kind === "removed" && item.text === "6")).toBe(true);
        expect(result.right.some((item: any) => item.kind === "added" && item.text === "7")).toBe(true);
    });
});
