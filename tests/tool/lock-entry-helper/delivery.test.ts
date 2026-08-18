import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("lock entry delivery entries", () => {
  it("publishes the two fixed-mode workbench entries", () => {
    const root = resolveFromRoot("public/tool/app/lock-entry-helper");
    const html = readFileSync(`${root}/index.html`, "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();
    const originalEntry = readFileSync(`${root}/startapp.py`, "utf8");
    const smartEntry = readFileSync(`${root}/startsmartapp.py`, "utf8");
    const workbench = readFileSync(`${root}/web/index.html`, "utf8");

    expect(pythonEntries).toEqual(["startapp.py", "startsmartapp.py"]);
    expect(html).toContain('href="../../../exports/lock-entry-helper.zip"');
    expect(originalEntry).toContain('create_server(app_directory, "original"');
    expect(smartEntry).toContain('create_server(app_directory, "smart"');
    expect(workbench).toContain("进入录入页面");
    expect(workbench).toContain("数据健康检查");
    expect(workbench).toContain("逐条录入结果");
  });
});
