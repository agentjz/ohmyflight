import { describe, expect, it } from "vitest";

import { ManualProofReportModel } from "../../../src/tool/app/proof-king/report-model";

const report: any = ManualProofReportModel;

describe("校对之王 Word 报告模型", () => {
    it("只在报告层从稳定事件标题整理章节编号和红删蓝增", () => {
        const rows = report.buildRows([{
            kind: "modified",
            title: "5.7.2 训练模块和科目",
            reason: "对应内容存在文字变化。",
            myLocation: "第 41 页",
            referenceLocation: "第 47 页",
            myDiff: [{ kind: "equal", text: "第十二课" }, { kind: "removed", text: "飞行技能考试" }],
            referenceDiff: [{ kind: "equal", text: "第十二课" }, { kind: "added", text: "转机型训练实践考试" }]
        }]);

        expect(rows[0]).toMatchObject({ chapter: "第 5 章", number: "5.7.2", title: "5.7.2 训练模块和科目" });
        expect(rows[0].explanation).toBe("");
        expect(rows[0].myRuns).toContainEqual({ text: "飞行技能考试", color: "FF0000" });
        expect(rows[0].referenceRuns).toContainEqual({ text: "转机型训练实践考试", color: "00B0F0" });
    });

    it("只把同类别且相邻的同一小节归组并保留每个修订事件", () => {
        const groups = report.buildGroups([
            reportEvent("revision-1", "reference-added", "5.7.2 训练模块和科目", "新增要求一"),
            reportEvent("revision-2", "reference-added", "5.7.2 训练模块和科目", "新增要求二"),
            reportEvent("revision-3", "reference-added", "5.8.1 检查程序", "新增检查"),
            reportEvent("revision-4", "reference-added", "5.7.2 训练模块和科目", "另一处同名要求"),
            reportEvent("revision-5", "modified", "5.7.2 训练模块和科目", "修改要求")
        ]);

        expect(groups).toHaveLength(4);
        expect(groups[0]).toMatchObject({
            kind: "reference-added",
            chapter: "第 5 章",
            number: "5.7.2",
            title: "5.7.2 训练模块和科目"
        });
        expect(groups[0].rows).toHaveLength(2);
        expect(groups.flatMap((group: any) => group.rows)).toHaveLength(5);
        expect(groups[3]).toMatchObject({ kind: "modified" });
    });

    it("没有稳定小节标题的事件保持独立呈现组", () => {
        const groups = report.buildGroups([
            reportEvent("revision-1", "reference-added", "参考手册新增", "无法识别标题一"),
            reportEvent("revision-2", "reference-added", "参考手册新增", "无法识别标题二")
        ]);

        expect(groups).toHaveLength(2);
        expect(groups.every((group: any) => group.title === "未识别小节")).toBe(true);
    });
});

function reportEvent(id: string, kind: string, title: string, value: string) {
    return {
        id,
        kind,
        title,
        reason: "保留判断依据",
        myLocation: "第 41 页",
        referenceLocation: "第 47 页",
        myDiff: [{ kind: "removed", text: value }],
        referenceDiff: [{ kind: "added", text: value }]
    };
}
