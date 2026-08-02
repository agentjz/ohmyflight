import { describe, expect, it } from "vitest";

import { createAuditKingPdfLocatorReader } from "../../../src/tool/app/audit-king/pdf-locator-reader";

describe("audit-king pdf locator reader", () => {
    it("reads text pages from PDF.js", async () => {
        const reader = loadReaderWithPdfJs([
            ["第一页文字"],
            ["第二页", "补充文字"]
        ]);

        const documents = await reader.readPdfFiles([
            makeFile("手册.pdf")
        ]);

        expect(documents).toHaveLength(1);
        expect(documents[0].name).toBe("手册.pdf");
        expect(documents[0].pageCount).toBe(2);
        expect(documents[0].pages.map((page: any) => page.text)).toEqual([
            "第一页文字",
            "第二页\n补充文字"
        ]);
    });

    it("rejects scanned PDFs without readable text layer", async () => {
        const reader = loadReaderWithPdfJs([[""], [" "]]);

        await expect(reader.readPdfFiles([
            makeFile("扫描件.pdf")
        ])).rejects.toThrow("没有可读取的文字层");
    });
});

function loadReaderWithPdfJs(pageItems: string[][]) {
    return createAuditKingPdfLocatorReader({
            GlobalWorkerOptions: {},
            getDocument: () => ({
                promise: Promise.resolve({
                    numPages: pageItems.length,
                    getPage: async (pageNumber: number) => ({
                        getTextContent: async () => ({
                            items: pageItems[pageNumber - 1].map((str) => ({ str }))
                        })
                    })
                })
            })
        });
}

function makeFile(name: string) {
    return new File([new ArrayBuffer(8)], name);
}
