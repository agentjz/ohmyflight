import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("qualification query helper delivery", () => {
  it("publishes the staged Playwright workbench", () => {
    const root = resolveFromRoot("public/tool/app/qualification-query-helper");
    const landing = readFileSync(`${root}/index.html`, "utf8");
    const workbench = readFileSync(`${root}/web/index.html`, "utf8");
    const requirements = readFileSync(`${root}/requirements.txt`, "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();

    expect(pythonEntries).toEqual(["start.py"]);
    expect(landing).toContain("技术等级运行资格查询助手（乞丐版）");
    expect(landing).toContain('href="../../../exports/qualification-query-helper.zip"');
    expect(workbench).toContain("导入登录态并进入查询页面");
    expect(workbench).toContain("数据健康检查");
    expect(workbench).toContain("开始查询");
    expect(workbench).toContain("逐人查询结果");
    expect(workbench).toContain("停止并关闭浏览器");
    expect(requirements).toContain("playwright");
    expect(requirements).toContain("openpyxl");
  });

  it("registers result exclusion and workbench packaging", () => {
    const build = readFileSync(resolveFromRoot("scripts/build.mts"), "utf8");
    const ignore = readFileSync(resolveFromRoot(".gitignore"), "utf8");
    const catalog = readFileSync(resolveFromRoot("src/tool/tools-data.ts"), "utf8");

    expect(build).toContain('"qualification-query-helper"');
    expect(ignore).toContain("/public/tool/app/qualification-query-helper/results/");
    expect(catalog).toContain('name: "技术等级运行资格查询助手（乞丐版）"');
  });
});
