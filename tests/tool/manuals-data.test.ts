import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { loadManualsData, loadSkillsData, loadToolsData } from "../helpers/browser-context";
import { resolveFromRoot } from "../helpers/paths";

const movedSkillNames = [
  "read-flight-operations-manual",
  "read-flight-training-program",
  "read-flight-technical-management-manual"
];

describe("user manuals data", () => {
  it("places the three flight manuals before tools in registry order", () => {
    const tools = loadToolsData() || [];
    const manuals = loadManualsData() || [];

    expect(manuals.map((item) => item.name)).toEqual([
      "运行手册",
      "训练大纲",
      "技术管理手册",
      ...tools.map((item) => item.name)
    ]);
    expect(manuals.every((item) => item.source.trim().startsWith("# "))).toBe(true);
  });

  it("moves flight manual readers out of the developer list", () => {
    const skills = loadSkillsData() || [];
    expect(skills.map((item) => item.name)).not.toEqual(expect.arrayContaining(movedSkillNames));
  });

  it("links the homepage entry and exposes one-file Markdown download", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const manualPage = fs.readFileSync(resolveFromRoot("public", "tool", "manuals.html"), "utf8");
    const manualScript = fs.readFileSync(resolveFromRoot("src", "tool", "manuals.ts"), "utf8");

    expect(homepage.indexOf("./manuals.html")).toBeGreaterThan(homepage.indexOf("./developer.html"));
    expect(homepage.indexOf("./manuals.html")).toBeLessThan(homepage.indexOf("https://github.com/luckymaomi/ohmyflight"));
    expect(manualPage).toContain("manuals-app.js");
    expect(manualScript).toContain('fetch("./manuals-data.json")');
    expect(manualScript).toContain('type: "text/markdown;charset=utf-8"');
    expect(manualScript).toContain('link.download = "ohmyflight-用户手册.md"');
  });
});
