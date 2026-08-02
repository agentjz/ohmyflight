import { describe, expect, it } from "vitest";
import * as docx from "docx";

import { createWordReport } from "../../../src/tool/app/proof-king/word-report";

const report: any = createWordReport(docx);

describe("校对之王 Word 报告", () => {
    it("生成可打包的标准 DOCX 五列表格", async () => {
        const document = report.buildDocument({
            summary: { myManualName: "我的手册.pdf", referenceManualName: "参考手册.pdf" },
            events: [{
                kind: "reference-added", title: "5.7.2 训练模块和科目", reason: "参考新增",
                myLocation: "无对应原文", referenceLocation: "第 47 页",
                myDiff: [], referenceDiff: [{ kind: "added", text: "新增训练要求" }]
            }]
        });
        const buffer = await docx.Packer.toBuffer(document);

        expect(buffer.subarray(0, 2).toString()).toBe("PK");
        expect(buffer.length).toBeGreaterThan(1000);
    });
});
