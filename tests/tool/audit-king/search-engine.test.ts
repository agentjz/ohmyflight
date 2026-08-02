import { beforeAll, describe, expect, it } from "vitest";

import { createAuditKingSearchEngine } from "../../../src/tool/app/audit-king/search-engine";
import { loadBrowserVendor } from "../../helpers/browser-context";

describe("audit-king search engine", () => {
  let searchEngine: any;

    beforeAll(() => {
        const context = loadBrowserVendor("libs/flexsearch.bundle.min.js");
        searchEngine = createAuditKingSearchEngine((context as any).FlexSearch);
    });

  it("searches multiple manual keywords across manuals with exact and loose hits", () => {
    const documents = [
      {
        id: "manual-1",
        name: "运行手册.docx",
        blocks: [
          { id: "m1-b1", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 1, title: "3.4", text: "航空人员应携带现行有效证件。" },
          { id: "m1-b2", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 2, title: "4.1", text: "机组成员只能被指派一项飞行机组工作。" }
        ]
      },
      {
        id: "manual-2",
        name: "飞行人员训练大纲.docx",
        blocks: [
          { id: "m2-b1", documentId: "manual-2", documentName: "飞行人员训练大纲.docx", blockIndex: 1, title: "6.3", text: "机长转机型训练进入 条件：持有航线运输驾驶员执照。" },
          { id: "m2-b2", documentId: "manual-2", documentName: "飞行人员训练大纲.docx", blockIndex: 2, title: "6.4", text: "模拟机训练课程设置。" }
        ]
      }
    ];
    const keywords = [
      { id: "kw-1", keyword: "进入条件", color: "#f59e0b", enabled: true },
      { id: "kw-2", keyword: "航线运输驾驶员执照", color: "#22c55e", enabled: true },
      { id: "kw-3", keyword: "不存在的词", color: "#3b82f6", enabled: true }
    ];

    const result = searchEngine.searchDocuments(documents, keywords);

    expect(result.countsByCheckItem).toEqual({
      "kw-1": 1,
      "kw-2": 1,
      "kw-3": 0
    });
    expect(result.matches.map((match: any) => ({
      keywordId: match.checkItemId,
      documentName: match.documentName,
      blockIndex: match.blockIndex,
      mode: match.mode,
      text: match.matchedText
    }))).toEqual([
      { keywordId: "kw-1", documentName: "飞行人员训练大纲.docx", blockIndex: 1, mode: "loose", text: "进入 条件" },
      { keywordId: "kw-2", documentName: "飞行人员训练大纲.docx", blockIndex: 1, mode: "exact", text: "航线运输驾驶员执照" }
    ]);
  });

  it("filters matches by keyword and document without recalculating business meaning", () => {
    const matches = [
      { id: "m1", checkItemId: "kw-1", documentId: "doc-1" },
      { id: "m2", checkItemId: "kw-2", documentId: "doc-1" },
      { id: "m3", checkItemId: "kw-1", documentId: "doc-2" }
    ];

    expect(searchEngine.filterMatches(matches, { checkItemId: "kw-1", documentId: "all" }).map((item: any) => item.id)).toEqual(["m1", "m3"]);
    expect(searchEngine.filterMatches(matches, { checkItemId: "all", documentId: "doc-1" }).map((item: any) => item.id)).toEqual(["m1", "m2"]);
  });

    it("builds a reusable document index for repeated keyword searches", () => {
    const documents = [
      {
        id: "manual-1",
        name: "运行手册.docx",
        blocks: [
          { id: "m1-b1", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 1, title: "", text: "证件携带要求。" },
          { id: "m1-b2", documentId: "manual-1", documentName: "运行手册.docx", blockIndex: 2, title: "", text: "进入 条件和训练要求。" }
        ]
      }
    ];
    const keywords = [
      { id: "kw-1", keyword: "进入条件", color: "#f59e0b", enabled: true }
    ];

    const index = searchEngine.buildDocumentIndex(documents);
    const result = searchEngine.searchIndex(index, keywords);

        expect(index.blocks).toHaveLength(2);
        expect(index.flexIndex).toBeTruthy();
        expect(Object.keys(index.grams).length).toBeGreaterThan(0);
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0].matchedText).toBe("进入 条件");
    });

    it("uses the local FlexSearch index without losing middle Chinese phrase matches", () => {
        const documents = [
            {
                id: "manual-1",
                name: "训练手册.docx",
                blocks: [
                    { id: "m1-b1", documentId: "manual-1", documentName: "训练手册.docx", blockIndex: 1, title: "", text: "进入条件和训练要求。" },
                    { id: "m1-b2", documentId: "manual-1", documentName: "训练手册.docx", blockIndex: 2, title: "", text: "证件携带要求。" }
                ]
            }
        ];

        const index = searchEngine.buildDocumentIndex(documents);
        const result = searchEngine.searchIndex(index, [
            { id: "kw-1", keyword: "训练", color: "#f59e0b", enabled: true }
        ]);

        expect(result.countsByCheckItem["kw-1"]).toBe(1);
        expect(result.matches[0].matchedText).toBe("训练");
    });
});
