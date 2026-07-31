import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { walkFiles } from "../helpers/fs-collect";
import { collectLocalAssetPaths } from "../helpers/html";
import { resolveFromDist } from "../helpers/paths";

describe("all tool html pages", () => {
  const htmlFiles = [
    resolveFromDist("tool", "index.html"),
    resolveFromDist("tool", "developer.html"),
    resolveFromDist("tool", "manuals.html"),
    resolveFromDist("jobskill", "index.html"),
    ...walkFiles(resolveFromDist("tool", "app"), [".html"])
  ];

  it("reference existing local assets", () => {
    htmlFiles.forEach((htmlFilePath) => {
      const assetPaths = collectLocalAssetPaths(htmlFilePath);

      assetPaths.forEach((assetPath) => {
        expect(
          fs.existsSync(assetPath),
          `${htmlFilePath} references missing asset: ${assetPath}`
        ).toBe(true);
      });
    });
  });
});
