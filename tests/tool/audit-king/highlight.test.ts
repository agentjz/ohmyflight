import { describe, expect, it } from "vitest";

import { AuditKingHighlight as highlight } from "../../../src/tool/app/audit-king/highlight";

describe("audit-king highlight", () => {
  it("keeps overlapping manual keywords visible", () => {
    const segments = highlight.buildHighlightSegments("ABCD", [
      { checkItemId: "kw-1", color: "#f59e0b", start: 0, end: 3 },
      { checkItemId: "kw-2", color: "#22c55e", start: 1, end: 4 }
    ]);

    expect(segments).toEqual([
      { text: "A", keywordIds: ["kw-1"], evidenceIds: [], colors: ["#f59e0b"] },
      { text: "BC", keywordIds: ["kw-1", "kw-2"], evidenceIds: [], colors: ["#f59e0b", "#22c55e"] },
      { text: "D", keywordIds: ["kw-2"], evidenceIds: [], colors: ["#22c55e"] }
    ]);
  });

  it("keeps manual evidence ranges separate from keyword ranges", () => {
    const segments = highlight.buildHighlightSegments("ABCDEFG", [
      { checkItemId: "kw-1", color: "#ffd666", start: 1, end: 3 },
      { checkItemId: "kw-1", evidenceId: "evidence-1", kind: "manual-evidence", color: "#198754", start: 2, end: 6 }
    ]);

    expect(segments).toEqual([
      { text: "A", keywordIds: [], evidenceIds: [], colors: [] },
      { text: "B", keywordIds: ["kw-1"], evidenceIds: [], colors: ["#ffd666"] },
      { text: "C", keywordIds: ["kw-1"], evidenceIds: ["evidence-1"], colors: ["#ffd666", "#198754"] },
      { text: "DEF", keywordIds: [], evidenceIds: ["evidence-1"], colors: ["#198754"] },
      { text: "G", keywordIds: [], evidenceIds: [], colors: [] }
    ]);
  });

  it("builds short context around a match", () => {
    const context = highlight.buildContext("0123456789命中ABCDEFGHIJ", {
      start: 10,
      end: 12,
      before: 4,
      after: 4
    });

    expect(context).toEqual({
      text: "6789命中ABCD",
      offset: 6,
      truncatedStart: true,
      truncatedEnd: true
    });
  });

  it("builds 100-character summary context around a match", () => {
    const before = "前".repeat(120);
    const after = "后".repeat(130);
    const context = highlight.buildContext(`${before}命中${after}`, {
      start: 120,
      end: 122,
      before: 100,
      after: 100
    });

    expect(context.text).toBe(`${"前".repeat(100)}命中${"后".repeat(100)}`);
    expect(context.offset).toBe(20);
    expect(context.truncatedStart).toBe(true);
    expect(context.truncatedEnd).toBe(true);
  });

  it("builds full block detail context for the selected match", () => {
    const text = "整段开头，包含命中词，整段结尾。";
    const context = highlight.buildFullContext(text);

    expect(context).toEqual({
      text,
      offset: 0,
      truncatedStart: false,
      truncatedEnd: false
    });
  });

  it("builds a large nearby original text window around a selected match", () => {
    const blocks = Array.from({ length: 8 }, (_, index) => ({
      id: `b${index + 1}`,
      documentId: "manual-1",
      documentName: "手册.docx",
      blockIndex: index + 1,
      title: "",
      text: `${index + 1}`.repeat(1000)
    }));
    blocks[4].text = `${"5".repeat(400)}命中${"5".repeat(598)}`;

    const context = highlight.buildBlockWindowContext(blocks, {
      blockId: "b5",
      matchStart: 400,
      matchEnd: 402,
      targetLength: 5000
    });

    expect(context.text.length).toBeGreaterThanOrEqual(5000);
    expect(context.text.slice(context.matchStart, context.matchEnd)).toBe("命中");
    expect(context.truncatedStart).toBe(true);
    expect(context.truncatedEnd).toBe(true);
  });

  it("limits a very large block to the requested window around the match", () => {
    const blocks = [{
      id: "b1",
      documentId: "manual-1",
      documentName: "手册.docx",
      blockIndex: 1,
      title: "",
      text: `${"前".repeat(5000)}命中${"后".repeat(5000)}`
    }];

    const context = highlight.buildBlockWindowContext(blocks, {
      blockId: "b1",
      matchStart: 5000,
      matchEnd: 5002,
      targetLength: 2000
    });

    expect(context.text.length).toBe(2000);
    expect(context.text.slice(context.matchStart, context.matchEnd)).toBe("命中");
    expect(context.text.startsWith("前")).toBe(true);
    expect(context.text.endsWith("后")).toBe(true);
    expect(context.truncatedStart).toBe(true);
    expect(context.truncatedEnd).toBe(true);
  });
});
