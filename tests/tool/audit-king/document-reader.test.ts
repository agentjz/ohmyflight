import { describe, expect, it } from "vitest";

import { createAuditKingDocumentReader } from "../../../src/tool/app/audit-king/document-reader";

describe("audit-king document reader", () => {
  const reader = createAuditKingDocumentReader({
        async extractRawText() {
          return { value: "第一段\n\n第二段" };
        }
      }, null);

  it("builds stable document and block ids without timestamps", async () => {
    const file = new File([new ArrayBuffer(0)], "中国南方航空货运有限公司-机组资格【2024】.docx");

    const documentItem = await reader.readDocxFile(file, 0);

    expect(documentItem.id).toBe("doc-1-中国南方航空货运有限公司-机组资格-2024-docx");
    expect(documentItem.blocks.map((block: any) => block.id)).toEqual([
      "doc-1-中国南方航空货运有限公司-机组资格-2024-docx-b1",
      "doc-1-中国南方航空货运有限公司-机组资格-2024-docx-b2"
    ]);
  });

  it("creates searchable PDF blocks with page numbers", () => {
    const blocks = reader.groupPdfPageItems([
      { str: "进入", transform: [1, 0, 0, 1, 10, 700], width: 20 },
      { str: "条件", transform: [1, 0, 0, 1, 31, 700], width: 20 },
      { str: "下一行", transform: [1, 0, 0, 1, 10, 680], width: 30 }
    ], "pdf-1", "手册.pdf", 7, 12);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ blockIndex: 12, pageNumber: 7, text: "进入条件" });
    expect(blocks[1]).toMatchObject({ blockIndex: 13, pageNumber: 7, text: "下一行" });
  });
});
