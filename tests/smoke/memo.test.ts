import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { memoItems } from "../../src/memo/memos-data";
import { markdownToText, search } from "../../src/memo/search";
import { resolveFromDist } from "../helpers/paths";

type PublishedMemoItem = readonly [name: string, relativePath: string];

function loadPublishedItems(): PublishedMemoItem[] {
  return memoItems;
}

function localMarkdownImages(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].trim().replace(/^<|>$/g, ""))
    .filter((target) => !/^(?:https?:)?\/\//i.test(target) && !target.startsWith("data:"))
    .map((target) => target.split("#")[0].split("?")[0]);
}

describe("memo subsite", () => {
  it("resolves every indexed memo", () => {
    const items = loadPublishedItems();
    const names = items.map(([name]) => name);
    const relativePaths = items.map(([, relativePath]) => relativePath);

    expect(new Set(names).size).toBe(items.length);
    expect(new Set(relativePaths).size).toBe(items.length);

    const spec = fs.readFileSync(resolveFromDist("memo", "SPEC.md"), "utf8");
    const index = fs.readFileSync(resolveFromDist("memo", "MEMO_INDEX.md"), "utf8");

    items.forEach(([name, relativePath]) => {
      const markdownPath = resolveFromDist("memo", relativePath);
      expect(fs.existsSync(markdownPath), `missing memo Markdown: ${relativePath}`).toBe(true);

      const markdown = fs.readFileSync(markdownPath, "utf8");
      expect(markdown).toMatch(/^---\r?\nname:\s*.+\r?\ndescription:\s*.+\r?\n---/);
      expect(spec).toContain(`./${relativePath}`);
      expect(index).toContain(`./${relativePath}`);
      expect(markdown).toContain(`# ${name}`);
    });
  });

  it("ships every locally referenced Markdown image", () => {
    loadPublishedItems().forEach(([, relativePath]) => {
      const markdownPath = resolveFromDist("memo", relativePath);
      const markdown = fs.readFileSync(markdownPath, "utf8");

      localMarkdownImages(markdown).forEach((target) => {
        const assetPath = path.resolve(path.dirname(markdownPath), target);
        expect(fs.existsSync(assetPath), `${relativePath} references missing image: ${target}`).toBe(true);
      });
    });
  });

  it("searches business text and returns a readable context", () => {
    const name = "资质办理";
    const relativePath = "memos/example/MEMO.md";
    const markdown = "---\nname: qualification\ndescription: test\n---\n# 资质办理\n完成重航划转后更新记录。";
    const searchableText = markdownToText(markdown);
    const results = search([{ name, path: relativePath, markdown }], "重航");

    expect(searchableText).not.toContain("description:");
    expect(searchableText).toContain("资质办理");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe(name);
    expect(results[0].snippet).toContain("重航划转");
  });
});
