import { describe, expect, it } from "vitest";

import { walkFiles } from "../helpers/fs-collect";
import { collectScriptReferences } from "../helpers/html";
import { resolveFromDist } from "../helpers/paths";
import { assertJavaScriptSyntax } from "../helpers/syntax";

describe("all tool JavaScript files", () => {
  const htmlFiles = [
    resolveFromDist("tool", "index.html"),
    resolveFromDist("tool", "developer.html"),
    resolveFromDist("tool", "manuals.html"),
    resolveFromDist("jobskill", "index.html"),
    ...walkFiles(resolveFromDist("tool", "app"), [".html"])
  ];

  const modeByScriptPath = new Map();
  htmlFiles.forEach((htmlFilePath) => {
    collectScriptReferences(htmlFilePath).forEach((item) => {
      modeByScriptPath.set(item.path, item.type);
    });
  });

  const scriptFiles = [
    resolveFromDist("tool", "tools-data.js"),
    resolveFromDist("tool", "tools-render.js"),
    resolveFromDist("tool", "developer.js"),
    resolveFromDist("tool", "manuals.js"),
    resolveFromDist("tool", "skills-data.js"),
    resolveFromDist("tool", "manuals-data.js"),
    resolveFromDist("jobskill", "skills-data.js"),
    resolveFromDist("jobskill", "site.js"),
    ...walkFiles(resolveFromDist("tool", "app"), [".js"])
  ];

  it("have valid syntax", () => {
    scriptFiles.forEach((scriptFilePath) => {
      expect(() => {
        assertJavaScriptSyntax(scriptFilePath, modeByScriptPath.get(scriptFilePath) || "auto");
      }, `invalid JavaScript syntax: ${scriptFilePath}`).not.toThrow();
    });
  }, 15000);
});
