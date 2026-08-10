import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { walkFiles } from "../helpers/fs-collect";
import { resolveFromDist } from "../helpers/paths";

describe("shared theme assets", () => {
  const toolAppHtmlFiles = walkFiles(resolveFromDist("tool", "app"), [".html"]);
  const supportPageHtmlFiles = [
    resolveFromDist("tool", "developer.html"),
    resolveFromDist("tool", "manuals.html"),
    resolveFromDist("memo", "index.html")
  ];

  it("are present in dist", () => {
    expect(fs.existsSync(resolveFromDist("theme.js"))).toBe(true);
    expect(fs.existsSync(resolveFromDist("theme.css"))).toBe(true);
  });

  it("are loaded by every tool app page", () => {
    toolAppHtmlFiles.forEach((htmlFilePath) => {
      const html = fs.readFileSync(htmlFilePath, "utf8");

      expect(html, `${htmlFilePath} does not load theme.js`).toContain("theme.js");
      expect(html, `${htmlFilePath} does not load theme.css`).toContain("theme.css");
    });
  });

  it("are shared by the support pages", () => {
    supportPageHtmlFiles.forEach((htmlFilePath) => {
      const html = fs.readFileSync(htmlFilePath, "utf8");

      expect(html).toContain('data-default-theme="light"');
      expect(html).toContain("theme.js");
      expect(html).toContain("support-shell.css");
      expect(html).toContain('type="module"');
      expect(html).toContain("data-theme-toggle");
    });
  });
});
