import fs from "node:fs";
import path from "node:path";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { tools } from "../../src/tool/tools-data";
import { resolveFromDist, resolveFromRoot } from "../helpers/paths";

describe("standalone tool exports", () => {
  it("generates one standalone archive for every current tool entry", async () => {
    const exportRoot = resolveFromDist("exports");
    const archiveNames = fs.readdirSync(exportRoot)
      .filter((fileName) => fileName.endsWith(".zip"))
      .sort((left, right) => left.localeCompare(right, "en"));
    const expectedArchiveNames = tools
      .map((tool) => `${tool.entry}.zip`)
      .sort((left, right) => left.localeCompare(right, "en"));

    expect(archiveNames).toEqual(expectedArchiveNames);

    for (const tool of tools) {
      const archive = await JSZip.loadAsync(fs.readFileSync(path.join(exportRoot, `${tool.entry}.zip`)));
      const fileNames = Object.keys(archive.files).sort((left, right) => left.localeCompare(right, "en"));
      expect(fileNames).toContain("index.html");
      expect(fileNames).toContain("app.js");
      expect(fileNames).toContain("standalone-runtime.js");
      expect(fileNames).toContain("watchdog-tool.json");
      expect(fileNames.some((fileName) => fileName.includes("__pycache__") || fileName.endsWith(".pyc"))).toBe(false);
      expect(fileNames.some((fileName) => fileName.startsWith("../") || path.isAbsolute(fileName))).toBe(false);

      const indexHtml = await archive.file("index.html")?.async("text");
      expect(indexHtml).toContain('src="./standalone-runtime.js"');
      expect(indexHtml).not.toMatch(/type=["']module["']/i);
      expect(indexHtml).not.toMatch(/(?:src|href)=["']\.\.\//i);

      const manifestSource = await archive.file("watchdog-tool.json")?.async("text");
      const manifest = JSON.parse(manifestSource || "{}") as {
        format?: string;
        entry?: string;
        root?: string;
        files?: string[];
      };
      expect(manifest).toMatchObject({
        format: "watchdog-standalone-tool",
        entry: tool.entry,
        root: "index.html"
      });
      expect(manifest.files).toEqual(fileNames);
    }
  });

  it("derives homepage download links from each tool entry", () => {
    const renderer = fs.readFileSync(resolveFromRoot("src", "tool", "tools-render.ts"), "utf8");
    expect(renderer).toContain('class="tool-card-download"');
    expect(renderer).toContain("`../exports/${item.entry}.zip`");
    expect(renderer).toContain("download");
    expect(renderer).toContain("aria-label=\"下载${escapeHtml(item.name)}独立应用\"");
  });
});
