import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("HTTP flight stats delivery", () => {
  it("publishes the staged HTTP workbench without Playwright", () => {
    const root = resolveFromRoot("public/tool/app/http-flight-stats-helper");
    const landing = readFileSync(`${root}/index.html`, "utf8");
    const workbench = readFileSync(`${root}/web/index.html`, "utf8");
    const requirements = readFileSync(`${root}/requirements.txt`, "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();

    expect(pythonEntries).toEqual(["start.py"]);
    expect(landing).toContain("飞行经历查询（皇帝版）");
    expect(workbench).toContain("飞行经历查询（皇帝版）");
    expect(landing).toContain('href="../../../exports/http-flight-stats-helper.zip"');
    expect(workbench).toContain("验证凭据");
    expect(workbench).toContain("数据健康检查");
    expect(workbench).toContain("开始查询");
    expect(workbench).toContain("逐人查询结果");
    expect(workbench).toContain("严格串行");
    expect(workbench).toContain("飞行时间+起落数");
    expect(workbench).toContain("飞行经历+起落数");
    expect(workbench).toContain("左座经历+起落数");
    expect(workbench).toContain("全部数据");
    expect(requirements).toContain("requests");
    expect(requirements).not.toContain("playwright");
  });

  it("registers the tool and excludes result workbooks", () => {
    const catalog = readFileSync(resolveFromRoot("src/tool/tools-data.ts"), "utf8");
    const buildScript = readFileSync(resolveFromRoot("scripts/build.mts"), "utf8");
    const ignore = readFileSync(resolveFromRoot(".gitignore"), "utf8");

    expect(catalog).toContain('entry: "http-flight-stats-helper"');
    expect(buildScript).toContain('"http-flight-stats-helper"');
    expect(ignore).toContain("/public/tool/app/http-flight-stats-helper/results/");
  });
});
