import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("HTTP lock entry delivery", () => {
  it("publishes two fixed-mode entries and the staged workbench", () => {
    const root = resolveFromRoot("public/tool/app/http-lock-entry-helper");
    const landing = readFileSync(`${root}/index.html`, "utf8");
    const workbench = readFileSync(`${root}/web/index.html`, "utf8");
    const requirements = readFileSync(`${root}/requirements.txt`, "utf8");
    const buildScript = readFileSync(resolveFromRoot("scripts/build.mts"), "utf8");
    const exporter = readFileSync(resolveFromRoot("scripts/tool-exports.mts"), "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();

    expect(pythonEntries).toEqual(["startapp.py", "startsmartapp.py"]);
    expect(readFileSync(`${root}/startapp.py`, "utf8")).toContain('create_server(app_directory, "original"');
    expect(readFileSync(`${root}/startsmartapp.py`, "utf8")).toContain('create_server(app_directory, "smart"');
    expect(landing).toContain('href="../../../exports/http-lock-entry-helper.zip"');
    expect(workbench).toContain("验证凭据");
    expect(workbench).toContain("数据健康检查");
    expect(workbench).toContain("开始录入");
    expect(workbench).toContain("逐条录入结果");
    expect(workbench).toContain('id="conflictRecovery" type="checkbox"');
    expect(requirements).toContain("requests");
    expect(requirements).not.toContain("playwright");
    expect(buildScript).toContain('"http-lock-entry-helper"');
    expect(exporter).toContain('relativePath === "web/theme.js"');
  });

  it("registers the tool and keeps local result workbooks out of delivery", () => {
    const catalog = readFileSync(resolveFromRoot("src/tool/tools-data.ts"), "utf8");
    const ignore = readFileSync(resolveFromRoot(".gitignore"), "utf8");
    const exporter = readFileSync(resolveFromRoot("scripts/tool-exports.mts"), "utf8");

    expect(catalog).toContain('entry: "http-lock-entry-helper"');
    expect(ignore).toContain("/public/tool/app/http-lock-entry-helper/results/");
    expect(exporter).toContain('!pathParts.includes("results")');
  });
});
