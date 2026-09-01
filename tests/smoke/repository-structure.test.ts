import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../helpers/paths";

const textFileExtensions = new Set([
  ".css", ".html", ".js", ".json", ".md", ".mts", ".py", ".svg", ".ts", ".txt", ".yaml", ".yml"
]);

function collectBomFiles() {
  const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
    cwd: resolveFromRoot(),
    encoding: "utf8"
  }).split("\0").filter(Boolean);

  return trackedFiles.filter((relativePath) => {
    if (!textFileExtensions.has(path.extname(relativePath).toLowerCase())) return false;
    const absolutePath = resolveFromRoot(relativePath);
    if (!fs.existsSync(absolutePath)) return false;
    const content = fs.readFileSync(absolutePath);
    return content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf;
  });
}

describe("repository structure", () => {
  it("stores repository text as UTF-8 without BOM", () => {
    const bomFiles = collectBomFiles().sort();

    expect(bomFiles, `UTF-8 BOM files:\n${bomFiles.join("\n")}`).toEqual([]);
  });
});
