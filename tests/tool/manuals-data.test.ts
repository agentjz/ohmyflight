import { describe, expect, it } from "vitest";

import { loadBeginnerTutorialData, loadManualsData, loadSkillsData, loadToolsData } from "../helpers/browser-context";

const movedSkillNames = [
  "read-flight-operations-manual",
  "read-flight-training-program",
  "read-flight-technical-management-manual"
];

describe("document library data", () => {
  it("separates tool manuals from the three beginner tutorials", () => {
    const tools = loadToolsData() || [];
    const manuals = loadManualsData() || [];
    const tutorials = loadBeginnerTutorialData() || [];

    expect(tools[0]).toMatchObject({ name: "菜鸟教程", entry: "beginner-tutorial" });
    expect(manuals.map((item) => item.name)).toEqual(tools.map((item) => item.name));
    expect(tutorials.map((item) => item.name)).toEqual([
      "运行手册",
      "训练大纲",
      "技术管理手册"
    ]);
    expect(tutorials.every((item) => item.source.trim().startsWith("# "))).toBe(true);
    expect(tutorials.every((item) => item.path.startsWith("spec/reference/flight-manuals/"))).toBe(true);
    expect(tutorials.every((item) => !item.path.includes(".agents/skills/"))).toBe(true);
  });

  it("moves flight manual readers out of the developer list", () => {
    const skills = loadSkillsData() || [];
    expect(skills.map((item) => item.name)).not.toEqual(expect.arrayContaining(movedSkillNames));
  });

});
