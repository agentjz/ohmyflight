import { describe, expect, it } from "vitest";

import { AuditKingSourceLocator as locator } from "../../../src/tool/app/audit-king/source-locator";

describe("audit-king source locator", () => {
  it("creates a durable checklist source with block index, selected text and context", () => {
    const source = locator.makeSource({
      id: "doc-1-checklist-docx-b7",
      documentId: "doc-1-checklist-docx",
      documentName: "检查单.docx",
      blockIndex: 7,
      title: "",
      text: "程序是否规定进入机长训练并完成检查"
    }, 6, 12);

    expect(source).toMatchObject({
      blockId: "doc-1-checklist-docx-b7",
      blockIndex: 7,
      start: 6,
      end: 12,
      text: "进入机长训练"
    });
    expect(source.beforeText).toBe("程序是否规定");
    expect(source.afterText).toBe("并完成检查");
  });

  it("resolves legacy timestamp block ids by block index and coordinates", () => {
    const blocks = [
      { id: "doc-1-checklist-docx-b1", documentId: "doc-1-checklist-docx", documentName: "检查单.docx", blockIndex: 1, title: "", text: "无关段落" },
      { id: "doc-1-checklist-docx-b2", documentId: "doc-1-checklist-docx", documentName: "检查单.docx", blockIndex: 2, title: "", text: "程序是否规定进入机长训练" }
    ];

    const source = locator.resolveSource({
      blockId: "doc-1-1783044084949-checklist-docx-b2",
      start: 6,
      end: 12
    }, blocks, "进入机长训练");

    expect(source).toMatchObject({
      blockId: "doc-1-checklist-docx-b2",
      blockIndex: 2,
      start: 6,
      end: 12,
      text: "进入机长训练"
    });
  });

  it("uses context to recover a source after coordinates move, but only on unique match", () => {
    const blocks = [
      { id: "doc-1-checklist-docx-b1", documentId: "doc-1-checklist-docx", documentName: "检查单.docx", blockIndex: 1, title: "", text: "新增文字。程序是否规定进入机长训练并完成检查" }
    ];

    const source = locator.resolveSource({
      blockIndex: 1,
      start: 6,
      end: 12,
      text: "进入机长训练",
      beforeText: "程序是否规定",
      afterText: "并完成检查"
    }, blocks, "进入机长训练");

    expect(source).toMatchObject({
      blockId: "doc-1-checklist-docx-b1",
      blockIndex: 1,
      start: 11,
      end: 17,
      text: "进入机长训练"
    });
  });

  it("creates durable manual evidence from a manual match", () => {
    const evidence = locator.makeManualEvidence({
      id: "match-1",
      keywordId: "kw-1",
      keywordText: "训练要求",
      keywordColor: "#ffd666",
      documentId: "manual-1",
      documentName: "运行手册.docx",
      blockId: "manual-1-b3",
      blockIndex: 3,
      title: "训练章节",
      start: 2,
      end: 6,
      mode: "exact",
      matchedText: "训练要求",
      blockText: "机组训练要求应当满足运行手册"
    });

    expect(evidence).toMatchObject({
      sourceType: "summary",
      documentId: "manual-1",
      documentName: "运行手册.docx",
      blockId: "manual-1-b3",
      blockIndex: 3,
      title: "训练章节",
      start: 2,
      end: 6,
      text: "训练要求",
      beforeText: "机组",
      afterText: "应当满足运行手册",
      mode: "exact"
    });
  });

  it("creates manual evidence from selected full detail text without requiring the keyword", () => {
    const documentItem = {
      id: "manual-1",
      name: "运行手册.docx",
      blocks: [
        { id: "manual-1-b1", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 1, title: "", text: "第一段无关内容" },
        { id: "manual-1-b2", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 2, title: "资格章节", text: "驾驶员应当满足申请航线运输驾驶员执照规定的资格要求和经历要求。" }
      ]
    };
    const fullText = "第一段无关内容\n\n驾驶员应当满足申请航线运输驾驶员执照规定的资格要求和经历要求。";
    const start = fullText.indexOf("申请航线运输驾驶员执照规定的资格要求");
    const end = start + "申请航线运输驾驶员执照规定的资格要求".length;

    const evidence = locator.makeManualEvidenceFromDocumentRange(documentItem, start, end, {
      sourceType: "selection"
    });

    expect(evidence).toMatchObject({
      sourceType: "selection",
      documentId: "manual-1",
      documentName: "运行手册.docx",
      blockId: "manual-1-b2",
      blockIndex: 2,
      title: "资格章节",
      start: 7,
      end: 25,
      globalStart: start,
      globalEnd: end,
      text: "申请航线运输驾驶员执照规定的资格要求",
      beforeText: "第一段无关内容\n\n驾驶员应当满足",
      afterText: "和经历要求。"
    });
  });

  it("resolves manual evidence by document name, block index, coordinates and text", () => {
    const documents = [{
      id: "manual-current",
      name: "运行手册.docx",
      blocks: [
        { id: "manual-current-b1", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 1, title: "", text: "无关段落" },
        { id: "manual-current-b3", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 3, title: "训练章节", text: "机组训练要求应当满足运行手册" }
      ]
    }];

    const evidence = locator.resolveManualEvidence({
      documentName: "运行手册.docx",
      blockIndex: 3,
      start: 2,
      end: 6,
      text: "训练要求",
      beforeText: "机组",
      afterText: "应当满足运行手册"
    }, documents);

    expect(evidence).toMatchObject({
      documentId: "manual-current",
      documentName: "运行手册.docx",
      blockId: "manual-current-b3",
      blockIndex: 3,
      title: "训练章节",
      start: 2,
      end: 6,
      text: "训练要求"
    });
  });

  it("uses full-document context to recover selected evidence after coordinates move", () => {
    const documents = [{
      id: "manual-current",
      name: "运行手册.docx",
      blocks: [
        { id: "manual-current-b1", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 1, title: "", text: "新增段落" },
        { id: "manual-current-b2", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 2, title: "资格章节", text: "新增文字。驾驶员应当满足申请航线运输驾驶员执照规定的资格要求和经历要求。" }
      ]
    }];

    const evidence = locator.resolveManualEvidence({
      sourceType: "selection",
      documentName: "运行手册.docx",
      globalStart: 999,
      globalEnd: 1018,
      text: "申请航线运输驾驶员执照规定的资格要求",
      beforeText: "驾驶员应当满足",
      afterText: "和经历要求。"
    }, documents);

    expect(evidence).toMatchObject({
      sourceType: "selection",
      documentId: "manual-current",
      documentName: "运行手册.docx",
      blockId: "manual-current-b2",
      blockIndex: 2,
      title: "资格章节",
      start: 12,
      end: 30,
      text: "申请航线运输驾驶员执照规定的资格要求"
    });
    expect(evidence.globalStart).toBeGreaterThan(0);
    expect(evidence.globalEnd).toBeGreaterThan(evidence.globalStart!);
  });

  it("does not guess a manual evidence location when the same evidence appears multiple times", () => {
    const documents = [{
      id: "manual-current",
      name: "运行手册.docx",
      blocks: [
        { id: "manual-current-b1", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 1, title: "", text: "训练要求应当满足运行手册" },
        { id: "manual-current-b2", documentId: "manual-current", documentName: "运行手册.docx", blockIndex: 2, title: "", text: "训练要求应当满足运行手册" }
      ]
    }];

    const evidence = locator.resolveManualEvidence({
      documentName: "运行手册.docx",
      text: "训练要求",
      afterText: "应当满足运行手册"
    }, documents);

    expect(evidence).toEqual({
      documentName: "运行手册.docx",
      text: "训练要求",
      afterText: "应当满足运行手册"
    });
  });
});
