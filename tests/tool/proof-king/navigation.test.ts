import { describe, expect, it } from "vitest";

import { ManualProofNavigation } from "../../../src/tool/app/proof-king/navigation";

const navigation: any = ManualProofNavigation;

describe("校对之王修订导航", () => {
    it("筛选只作用于当前修订事件", () => {
        const events = [
            { kind: "reference-added", title: "新增程序", myText: "", referenceText: "检查程序" },
            { kind: "modified", title: "训练要求", myText: "20次", referenceText: "24次" }
        ];
        expect(navigation.filterEvents(events, "reference-added", "程序")).toHaveLength(1);
        expect(navigation.filterEvents(events, "modified", "24")).toHaveLength(1);
    });

    it("按标题推导章节并返回关键词命中侧和片段", () => {
        const events = [
            { id: "other", kind: "reference-removed", title: "17.2 其它训练", myText: "180掉头", referenceText: "" },
            { id: "target", kind: "modified", title: "5.7.2 模拟机训练", myText: "地面滑行要领，180掉头", referenceText: "按照指令完成滑行，180掉头" }
        ];

        expect(navigation.chapters(events)).toEqual(["第 17 章", "第 5 章"]);
        const results = navigation.filterEvents(events, "all", "180掉头", "第 5 章");
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ id: "target", matchedSide: "both" });
        expect(results[0].matchedExcerpt).toContain("180掉头");
    });

    it("结果再多也只计算有限可视窗口", () => {
        const range = navigation.calculateWindow(50_000, 800, 10_000);
        expect(range.end - range.start).toBeLessThan(20);
        expect(range.totalHeight).toBe(10_000 * navigation.rowHeight);
    });

    it("按类别、章节和小节逐层组织事件并保留计数", () => {
        const events = [
            event("revision-1", "reference-added", "5.7.2 模拟机训练", "新增训练要求"),
            event("revision-2", "modified", "5.7.2 模拟机训练", "训练时间改为24小时"),
            event("revision-3", "reference-added", "5.8.1 检查程序", "新增检查程序"),
            event("revision-4", "review", "待人工确认", "表格结构变化")
        ];

        expect(navigation.categoryCounts(events, "")).toMatchObject([
            { kind: "all", total: 4, matched: 4 },
            { kind: "reference-added", total: 2, matched: 2 },
            { kind: "reference-removed", total: 0, matched: 0 },
            { kind: "modified", total: 1, matched: 1 },
            { kind: "review", total: 1, matched: 1 }
        ]);

        const outline = navigation.buildOutline(events, "all", "");
        expect(outline).toHaveLength(2);
        expect(outline[0]).toMatchObject({ label: "第 5 章", count: 3 });
        expect(outline[0].sections).toHaveLength(2);
        expect(outline[0].sections[0]).toMatchObject({ label: "5.7.2 模拟机训练", count: 2 });
        expect(outline[1]).toMatchObject({ label: "未识别章节", count: 1 });
        expect(outline[1].sections[0]).toMatchObject({ label: "未识别小节", count: 1 });
    });

    it("关键词只收窄计数和小节内容，不把非相邻同名小节误归成一组", () => {
        const events = [
            event("revision-1", "modified", "5.7.2 模拟机训练", "第一次训练修改"),
            event("revision-2", "modified", "5.8.1 检查程序", "中间检查修改"),
            event("revision-3", "modified", "5.7.2 模拟机训练", "第二次训练修改")
        ];

        const outline = navigation.buildOutline(events, "modified", "训练");
        expect(outline[0].sections).toHaveLength(2);
        expect(outline[0].sections.map((section: any) => section.count)).toEqual([1, 1]);
        expect(navigation.categoryCounts(events, "训练")).toContainEqual(expect.objectContaining({
            kind: "modified", total: 3, matched: 2
        }));
    });

    it("章节树只提供小节起点，事件流始终保留当前大类和搜索的全部事件", () => {
        const events = [
            event("revision-1", "reference-added", "5.7.2 模拟机训练", "新增训练一"),
            event("revision-2", "reference-added", "5.8.1 检查程序", "新增检查"),
            event("revision-3", "reference-added", "5.7.2 模拟机训练", "新增训练二"),
            event("revision-4", "modified", "5.7.2 模拟机训练", "修改训练")
        ];

        const visible = navigation.filterEvents(events, "reference-added", "");
        const outline = navigation.buildOutline(events, "reference-added", "");
        const starts = outline.flatMap((chapter: any) => chapter.sections.map((section: any) => section.startEventId));

        expect(visible.map((item: any) => item.id)).toEqual(["revision-1", "revision-2", "revision-3"]);
        expect(starts).toEqual(["revision-1", "revision-2", "revision-3"]);
    });
});

function event(id: string, kind: string, title: string, text: string) {
    return {
        id,
        kind,
        title,
        myText: text,
        referenceText: text,
        myLocation: "第 1 页",
        referenceLocation: "第 1 页"
    };
}
