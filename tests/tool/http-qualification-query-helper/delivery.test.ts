import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("HTTP qualification query delivery", () => {
  it("publishes an independent staged HTTP workbench", () => {
    const root = resolveFromRoot("public/tool/app/http-qualification-query-helper");
    const landing = readFileSync(`${root}/index.html`, "utf8");
    const workbench = readFileSync(`${root}/web/index.html`, "utf8");
    const requirements = readFileSync(`${root}/requirements.txt`, "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();

    expect(pythonEntries).toEqual(["start.py"]);
    expect(landing).toContain("飞行人员信息查询（皇帝版）");
    expect(workbench).toContain("飞行人员信息查询（皇帝版）");
    expect(landing).toContain('href="../../../exports/http-qualification-query-helper.zip"');
    expect(workbench).toContain("验证 Cookie");
    expect(workbench).toContain("数据健康检查");
    expect(workbench).toContain("开始查询");
    expect(workbench).toContain("逐人查询结果");
    expect(workbench).toContain("严格串行");
    expect(requirements).toContain("requests");
    expect(requirements).toContain("beautifulsoup4");
    expect(requirements).not.toContain("playwright");
  });

  it("registers the emperor edition and excludes production results", () => {
    const catalog = readFileSync(resolveFromRoot("src/tool/tools-data.ts"), "utf8");
    const buildScript = readFileSync(resolveFromRoot("scripts/build.mts"), "utf8");
    const ignore = readFileSync(resolveFromRoot(".gitignore"), "utf8");

    expect(catalog).toContain('entry: "http-qualification-query-helper"');
    expect(buildScript).toContain('"http-qualification-query-helper"');
    expect(ignore).toContain("/public/tool/app/http-qualification-query-helper/results/");
  });
});
