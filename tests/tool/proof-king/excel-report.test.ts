import { describe, expect, it } from "vitest";

import { createExcelReport } from "../../../src/tool/app/proof-king/excel-report";

const XLSX = {
    utils: {
        book_new: () => ({ SheetNames: [] as string[], Sheets: {} as Record<string, unknown> }),
        aoa_to_sheet: (rows: unknown[][]) => ({ rows }),
        book_append_sheet: (book: any, sheet: any, name: string) => {
            book.SheetNames.push(name);
            book.Sheets[name] = sheet;
        }
    }
};
const report: any = createExcelReport(XLSX as unknown as typeof import("xlsx-js-style"));

describe("校对之王 Excel 报告", () => {
    it("按修订事件导出完整双侧原文", () => {
        const comparison = {
            summary: {
                myManualName: "我的手册.docx", referenceManualName: "参考手册.pdf", mySliceCount: 1,
                referenceSliceCount: 1, exactAnchorCount: 0, sameSliceCount: 0, referenceAddedCount: 1,
                referenceRemovedCount: 0, modifiedCount: 0, reviewCount: 0
            },
            events: [{
                id: "revision-1", kind: "reference-added", title: "新增程序", myLocation: "无对应原文",
                myText: "", referenceLocation: "第 3 页", referenceText: "完整新增原文。", similarity: 0,
                myTokensOnly: [], referenceTokensOnly: [], reason: "参考新增"
            }]
        };
        const workbook = report.buildWorkbook(comparison, comparison.events, { "revision-1": "included" });
        expect(workbook.SheetNames).toEqual(["总览", "修订事件", "参考新增", "参考删除", "内容修改", "待确认"]);
        expect(workbook.Sheets["参考新增"].rows[1]).toContain("完整新增原文。");
        expect(workbook.Sheets["参考新增"].rows[0]).toEqual(expect.arrayContaining([
            "章节", "小节编号", "小节标题", "组内序号"
        ]));
        expect(workbook.Sheets["参考新增"].rows[1]).toEqual(expect.arrayContaining([
            "纳入报告", "未识别章节", "新增程序", 1
        ]));
    });

    it("按传入事件子集生成报告并保留人工决定", () => {
        const comparison = {
            summary: { myManualName: "我的手册.pdf", referenceManualName: "参考手册.pdf" },
            events: [
                { id: "revision-1", kind: "reference-added", title: "5.1 新增", myLocation: "无对应原文", myText: "", referenceLocation: "第 1 页", referenceText: "新增", similarity: 0, myTokensOnly: [], referenceTokensOnly: [], reason: "新增" },
                { id: "revision-2", kind: "modified", title: "5.2 修改", myLocation: "第 2 页", myText: "旧", referenceLocation: "第 2 页", referenceText: "新", similarity: 0.5, myTokensOnly: [], referenceTokensOnly: [], reason: "修改" }
            ]
        };
        const workbook = report.buildWorkbook(comparison, [comparison.events[1]], { "revision-2": "included" });

        expect(workbook.Sheets["修订事件"].rows).toHaveLength(2);
        expect(workbook.Sheets["修订事件"].rows[1]).toContain("纳入报告");
        expect(workbook.Sheets["参考新增"].rows).toHaveLength(1);
    });
});
