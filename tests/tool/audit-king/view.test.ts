import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuditKingView } from "../../../src/tool/app/audit-king/view";

function createElement() {
  return {
    innerHTML: "", textContent: "", className: "", value: "", disabled: false,
    clientHeight: 320, scrollHeight: 960, scrollTop: 0, offsetTop: 0,
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}

describe("audit-king current check item view", () => {
  let view: any;
  let elements: Record<string, any>;

  beforeAll(() => {
    const document = { getElementById(id: string) { return elements[id] || null; } };
    vi.stubGlobal("document", document);
    const SearchEngine = {
      filterMatches(matches: any[], filters: any) {
        return matches.filter((match) => (filters.checkItemId === "all" || match.checkItemId === filters.checkItemId)
          && (filters.documentId === "all" || match.documentId === filters.documentId));
      }
    };
    const Highlight = {
      buildHighlightSegments(text: string, ranges: any[]) {
        if (!ranges.length) return [{ text, keywordIds: [], evidenceIds: [], colors: [] }];
        const range = ranges[0];
        return [
          { text: text.slice(0, range.start), keywordIds: [], evidenceIds: [], colors: [] },
          { text: text.slice(range.start, range.end), keywordIds: [range.checkItemId], evidenceIds: range.evidenceId ? [range.evidenceId] : [], colors: [range.color] },
          { text: text.slice(range.end), keywordIds: [], evidenceIds: [], colors: [] }
        ].filter((segment) => segment.text);
      },
      buildBlockWindowContext() {
        return { text: "前文训练要求后文", matchStart: 2, matchEnd: 6, truncatedStart: false, truncatedEnd: false, windowStart: 0, windowEnd: 8 };
      }
    };
    view = createAuditKingView({
      SearchEngine,
      Highlight,
      PdfLocatorView: { renderPdfLocator() {} }
    } as any);
  });

  beforeEach(() => {
    elements = {
      checkItemList: createElement(), checklistText: createElement(), manualList: createElement(), manualFilter: createElement(),
      matchList: createElement(), matchCount: createElement(), matchDetail: createElement(), matchDetailContextLabel: createElement(),
      expandMatchDetailBtn: createElement(), addSelectedManualEvidenceBtn: createElement(), manualEvidenceList: createElement(),
      manualEvidenceCount: createElement(), evidenceList: createElement(), evidenceCount: createElement()
    };
  });

  const item = {
    id: "item-1", code: "1.1", name: "进入条件", keyword: "训练要求", color: "#ffd666", enabled: true,
    source: undefined, manualEvidences: [], auditEvidences: []
  };

  it("renders one check item with independent fields and workflow counts", () => {
    view.renderCheckItems({
      currentCheckItemId: "item-1", checklistBlocks: [], checkItems: [item],
      searchResult: { countsByCheckItem: { "item-1": 3 }, matches: [] }
    });

    expect(elements.checkItemList.innerHTML).toContain("1.1");
    expect(elements.checkItemList.innerHTML).toContain("进入条件");
    expect(elements.checkItemList.innerHTML).toContain("训练要求");
    expect(elements.checkItemList.innerHTML).toContain("3 命中 / 0 证据 / 0 依据");
    expect(elements.checkItemList.innerHTML).toContain("edit-check-item-name");
  });

  it("renders candidate evidence with a clear adopt action", () => {
    view.renderManualEvidences({
      currentCheckItemId: "item-1", documents: [],
      checkItems: [{ ...item, manualEvidences: [{ id: "manual-1", documentName: "运行手册.pdf", pageNumber: 7, text: "资格要求" }] }]
    });

    expect(elements.manualEvidenceCount.textContent).toBe("1 条手册证据");
    expect(elements.manualEvidenceList.innerHTML).toContain("运行手册.pdf / 第 7 页");
    expect(elements.manualEvidenceList.innerHTML).toContain("采纳为审计依据");
  });

  it("renders audit evidence under the same check item title", () => {
    view.renderEvidence({
      checkItems: [{ ...item, auditEvidences: [{ id: "audit-1", content: "资格要求", note: "已复核" }] }]
    });

    expect(elements.evidenceCount.textContent).toBe("1 个检查项 / 1 条依据");
    expect(elements.evidenceList.innerHTML).toContain("1.1 进入条件");
    expect(elements.evidenceList.innerHTML).toContain("资格要求");
    expect(elements.evidenceList.innerHTML).toContain("已复核");
  });

  it("shows PDF page position and save action on a matching result", () => {
    view.renderMatches({
      currentCheckItemId: "item-1", currentMatchIndex: 0, currentDetailContextLength: 2000, documentFilterId: "all",
      checkItems: [item], documents: [{ id: "doc-1", name: "手册.pdf", blocks: [{ id: "b1", text: "训练要求" }] }],
      searchResult: { countsByCheckItem: {}, matches: [{
        id: "m1", checkItemId: "item-1", keywordText: "训练要求", keywordColor: "#ffd666", documentId: "doc-1",
        documentName: "手册.pdf", blockId: "b1", blockIndex: 1, pageNumber: 9, title: "", start: 0, end: 4,
        mode: "exact", matchedText: "训练要求", blockText: "训练要求"
      }] }
    });

    expect(elements.matchList.innerHTML).toContain("第 9 页");
    expect(elements.matchList.innerHTML).toContain("保存为手册证据");
    expect(elements.matchDetail.innerHTML).toContain("ak-highlight");
  });

  it("highlights only the selected check item source", () => {
    const text = "第一处训练要求，第二处训练要求";
    view.renderChecklist({
      currentCheckItemId: "item-1",
      checklistBlocks: [{ id: "b1", blockIndex: 1, text, documentId: "c", documentName: "检查单", title: "" }],
      checkItems: [{ ...item, source: { blockId: "b1", start: 3, end: 7, text: "训练要求" } }]
    });

    expect((elements.checklistText.innerHTML.match(/<mark/g) || []).length).toBe(1);
  });

  it("keeps disabled manuals visible but outside the result filter", () => {
    view.renderDocuments({
      documentFilterId: "disabled",
      documents: [
        { id: "enabled", name: "运行手册.docx", enabled: true, blocks: [{ id: "b1" }] },
        { id: "disabled", name: "训练大纲.docx", enabled: false, blocks: [{ id: "b2" }] }
      ]
    });

    expect(elements.manualList.innerHTML).toContain("训练大纲.docx");
    expect(elements.manualList.innerHTML).toContain("启用");
    expect(elements.manualFilter.innerHTML).not.toContain("训练大纲.docx");
    expect(elements.manualFilter.value).toBe("all");
  });
});
