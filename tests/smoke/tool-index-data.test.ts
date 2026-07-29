import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { loadManualsData, loadSiteVisibility, loadSkillsData, loadToolsData } from "../helpers/browser-context";
import { resolveFromDist, resolveFromRoot } from "../helpers/paths";

describe("tool index data", () => {
  it("uses a single explicit tool list", () => {
    const tools = loadToolsData();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools?.length).toBeGreaterThan(0);

    tools?.forEach((tool) => {
      expect(tool.entry).toMatch(/^[a-z0-9-]+$/);
      expect(tool.status === "done" || tool.status === "wip").toBe(true);
      expect(["heavy", "light", "automation"]).toContain(tool.category);
    });
  });

  it("has no work-in-progress tools", () => {
    const tools = loadToolsData() || [];
    const wipNames = tools
      .filter((tool) => tool.status === "wip")
      .map((tool) => tool.name)
      .sort();

    expect(wipNames).toEqual([]);
  });

  it("publishes four category views and defaults to all tools", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const categories = [...homepage.matchAll(/data-category="([a-z]+)"/g)].map((match) => match[1]);

    expect(categories).toEqual(["all", "heavy", "light", "automation"]);
    expect(homepage).toContain('data-default-category="all"');
    expect(homepage).not.toContain("workflows-data.js");
    expect(homepage).not.toContain('data-category="workflow"');
  });

  it("centralizes every public visibility switch", () => {
    const tools = loadToolsData() || [];
    const visibility = loadSiteVisibility();

    expect(Object.keys(visibility.tools).sort()).toEqual(tools.map((tool) => tool.entry).sort());
    expect(Object.values(visibility.tools).every((value) => typeof value === "boolean")).toBe(true);
    expect(visibility).not.toHaveProperty("workflows");
    expect(visibility.homepage).toMatchObject({
      patternGate: expect.any(Boolean),
      announcement: expect.any(Boolean),
      sponsorEntry: expect.any(Boolean)
    });
    expect(visibility.sponsorPage).toMatchObject({ contributors: expect.any(Boolean) });
  });

  it("uses the mascot only in the header and renders plain text tool cards", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const renderer = fs.readFileSync(resolveFromRoot("src", "tool", "tools-render.ts"), "utf8");

    expect(fs.existsSync(resolveFromDist("tool", "assets", "status-done.png"))).toBe(true);
    expect(homepage.match(/status-done\.png/g)).toHaveLength(1);
    expect(homepage).not.toContain("imperialOverlay");
    expect(renderer).not.toContain("status-done.png");
    expect(renderer).not.toContain("edge-particle");
    expect(renderer).not.toContain('class="tool-kind"');
    expect(renderer).not.toContain("workflow");
    expect(renderer).toContain('class="tool-card"');
  });

  it("publishes the current repository skills", () => {
    const skills = loadSkillsData() || [];
    const manuals = loadManualsData() || [];
    const manualSkillDirectories = new Set([
      "read-flight-operations-manual",
      "read-flight-training-program",
      "read-flight-technical-management-manual"
    ]);
    const skillDirectories = fs.readdirSync(resolveFromRoot(".agents", "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => fs.existsSync(resolveFromRoot(".agents", "skills", entry.name, "SKILL.md")));
    const developerSkillDirectories = skillDirectories.filter((entry) => !manualSkillDirectories.has(entry.name));

    expect(skills).toHaveLength(developerSkillDirectories.length);
    expect(new Set(skills.map((skill) => skill.name)).size).toBe(skills.length);
    skills.forEach((skill) => {
      expect(skill.name.trim().length).toBeGreaterThan(0);
      expect(skill.description.trim().length).toBeGreaterThan(0);
      expect(skill.source).toContain(`# `);
      expect(skill.path).toMatch(/^\.agents\/skills\/[a-z0-9-]+\/SKILL\.md$/);
    });
    expect(skills.map((skill) => skill.name)).not.toEqual(expect.arrayContaining([...manualSkillDirectories]));
    expect(manuals.slice(0, 3).map((manual) => manual.path)).toEqual(
      [...manualSkillDirectories].map((directory) => `.agents/skills/${directory}/SKILL.md`)
    );
  });

});
