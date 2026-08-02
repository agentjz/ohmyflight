import { describe, expect, it } from "vitest";

import { ManualProofAlignment } from "../../../src/tool/app/proof-king/alignment-core";

const core: any = ManualProofAlignment;

describe("校对之王顺序对齐", () => {
    it("以顺序锚点为边界聚合参考新增和参考删除", () => {
        const comparison = core.compare(
            manual("my", [
                "共同开头条款要求所有人员完成训练。",
                "我的手册仍保留的完整旧规定。",
                "共同结尾条款要求记录保存备查。"
            ]),
            manual("reference", [
                "共同开头条款要求所有人员完成训练。",
                "参考手册新增的第一项完整要求。",
                "参考手册新增的第二项完整要求。",
                "共同结尾条款要求记录保存备查。"
            ])
        );

        const added = comparison.events.find((event: any) => event.kind === "reference-added" && event.referenceText.includes("第一项"));
        const removed = comparison.events.find((event: any) => event.kind === "reference-removed" && event.myText.includes("旧规定"));

        expect(added).toBeTruthy();
        expect(removed).toBeTruthy();
        expect(added.contextAnchors).toMatchObject([
            { position: "before", myUnitId: "my-unit-1", referenceUnitId: "reference-unit-1" },
            { position: "after", myUnitId: "my-unit-3", referenceUnitId: "reference-unit-4" }
        ]);
        expect(removed.contextAnchors).toMatchObject(added.contextAnchors);
    });

    it("把同一事项的责任主体和数字变化归为内容修改", () => {
        const comparison = core.compare(
            manual("my", [
                "共同开头条款要求所有人员完成训练。",
                "飞行部负责组织检查，每季度不少于20次。",
                "共同结尾条款要求记录保存备查。"
            ]),
            manual("reference", [
                "共同开头条款要求所有人员完成训练。",
                "各单位负责组织检查，每季度不少于24次。",
                "共同结尾条款要求记录保存备查。"
            ])
        );
        const modified = comparison.events.find((event: any) => event.kind === "modified");

        expect(modified).toBeTruthy();
        expect(modified.myText).toContain("飞行部");
        expect(modified.referenceText).toContain("各单位");
        expect(modified.myTokensOnly).toContain("20");
        expect(modified.referenceTokensOnly).toContain("24");
    });

    it("文档开头新增只保留真实存在的共同后文锚点", () => {
        const comparison = core.compare(
            manual("my", ["共同后续条款要求记录保存备查。"]),
            manual("reference", ["参考手册在开头新增的完整要求。", "共同后续条款要求记录保存备查。"])
        );
        const added = comparison.events.find((event: any) => event.kind === "reference-added");

        expect(added.contextAnchors).toMatchObject([
            { position: "after", myUnitId: "my-unit-1", referenceUnitId: "reference-unit-2" }
        ]);
    });

    it("一个完整句对应两个相邻片段时不产生虚假新增", () => {
        const comparison = core.compare(
            manual("my", [
                "共同开头条款要求完成准备工作。",
                "飞行人员完成训练并检查合格后方可参加运行。",
                "共同结尾条款要求保存全部记录。"
            ]),
            manual("reference", [
                "共同开头条款要求完成准备工作。",
                "飞行人员完成训练并",
                "检查合格后方可参加运行。",
                "共同结尾条款要求保存全部记录。"
            ])
        );

        expect(comparison.events).toHaveLength(0);
    });

    it("连续短行与扁平长文本对应时不产生虚假新增和删除", () => {
        const rows = [
            "共同开头条款要求完成准备工作。",
            "第一项检查训练机构资质",
            "第二项检查课程设置",
            "第三项检查教员资质",
            "第四项检查训练设备",
            "第五项检查运行记录",
            "第六项检查整改结果",
            "共同结尾条款要求保存全部记录。"
        ];
        const comparison = core.compare(
            manual("my", rows),
            manual("reference", [
                rows[0],
                rows.slice(1, -1).join(""),
                rows[rows.length - 1]
            ])
        );

        expect(comparison.events).toHaveLength(0);
    });

    it("新增使用附近高可信对应而不是远处完全一致句作为前锚点", () => {
        const comparison = core.compare(
            manual("my", [
                "全局共同开头条款要求完成准备。",
                "飞行部负责组织年度训练和检查。",
                "共同后文要求保存训练记录备查。"
            ]),
            manual("reference", [
                "全局共同开头条款要求完成准备。",
                "飞行部负责组织全部年度训练和检查。",
                "参考手册新增独立复核要求。",
                "共同后文要求保存训练记录备查。"
            ])
        );
        const added = comparison.events.find((event: any) => event.kind === "reference-added");
        const before = added.contextAnchors.find((anchor: any) => anchor.position === "before");

        expect(before.myText).toBe("飞行部负责组织年度训练和检查。");
        expect(before.referenceText).toBe("飞行部负责组织全部年度训练和检查。");
    });

    it("同一参考片段不会被多个我的片段重复占用", () => {
        const comparison = core.compare(
            manual("my", [
                "共同开头条款要求所有人员完成训练。",
                "重复要求必须完成年度检查。",
                "重复要求必须完成年度检查。",
                "共同结尾条款要求记录保存备查。"
            ]),
            manual("reference", [
                "共同开头条款要求所有人员完成训练。",
                "重复要求必须完成年度检查。",
                "共同结尾条款要求记录保存备查。"
            ])
        );

        expect(comparison.summary.sameSliceCount).toBe(3);
        expect(comparison.events.some((event: any) => event.kind === "reference-removed")).toBe(true);
    });

    it("不会把相邻的大段新增吞进短句修改", () => {
        const comparison = core.compare(
            manual("my", [
                "共同开头条款要求完成准备。",
                "训练完成后应在六十天内接受检查。",
                "共同结尾条款要求保存记录。"
            ]),
            manual("reference", [
                "共同开头条款要求完成准备。",
                "训练完成后应在九十天内接受检查。后续新增第一项完整要求。后续新增第二项完整要求。后续新增第三项完整要求。后续新增第四项完整要求。",
                "共同结尾条款要求保存记录。"
            ])
        );

        expect(comparison.events.some((event: any) => event.kind === "modified"
            && event.myText.includes("六十天")
            && event.referenceText.includes("九十天"))).toBe(true);
        expect(comparison.events.some((event: any) => event.kind === "reference-added"
            && event.referenceText.includes("后续新增第四项"))).toBe(true);
    });
});

function manual(id: string, lines: string[]) {
    return {
        id,
        name: `${id}.docx`,
        units: lines.map((text, index) => ({
            id: `${id}-unit-${index + 1}`,
            manualId: id,
            index: index + 1,
            kind: "paragraph",
            text,
            title: ""
        }))
    };
}
