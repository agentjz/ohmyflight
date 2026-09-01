import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { walkFiles } from "../helpers/fs-collect";
import { collectLocalAssetPaths, collectScriptReferences } from "../helpers/html";
import { resolveFromDist } from "../helpers/paths";

describe("engineering contract", () => {
  it("keeps page script references unique and includes an app-owned entry", () => {
    const htmlFiles = walkFiles(resolveFromDist("tool", "app"), [".html"]);
    htmlFiles.forEach((htmlFile) => {
      const scripts = collectScriptReferences(htmlFile);
      const paths = scripts.map((item) => item.path);
      expect(new Set(paths).size, `${htmlFile} has duplicate scripts`).toBe(paths.length);
      const localAssets = collectLocalAssetPaths(htmlFile);
      const appDirectory = path.dirname(htmlFile);
      const belongsToApp = (assetPath: string) => {
        const relative = path.relative(appDirectory, assetPath);
        return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
      };
      expect(
        paths.some(belongsToApp)
          || localAssets.some((assetPath) => belongsToApp(assetPath) && assetPath.endsWith(".py")),
        `${htmlFile} has no app-owned script or Python app`
      ).toBe(true);
    });
  });

  it("ships every statically referenced Worker", () => {
    const scripts = walkFiles(resolveFromDist("tool", "app"), [".js"]);
    const missing: string[] = [];
    scripts.forEach((script) => {
      const source = fs.readFileSync(script, "utf8");
      Array.from(source.matchAll(/new Worker\(["']([^"']+)["']/g), (match) => match[1]).forEach((reference) => {
        const workerPath = path.resolve(path.dirname(script), reference);
        if (!fs.existsSync(workerPath)) missing.push(`${script} -> ${reference}`);
      });
    });
    expect(missing).toEqual([]);
  });
});
