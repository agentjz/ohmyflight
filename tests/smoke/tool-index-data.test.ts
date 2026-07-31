import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { loadManualsData, loadSiteVisibility, loadSkillsData, loadToolsData } from "../helpers/browser-context";
import { resolveFromRoot } from "../helpers/paths";

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
    expect(tools).toContainEqual(expect.objectContaining({
      entry: "seasonal-learning",
      category: "heavy",
      status: "done"
    }));
    expect(tools).toContainEqual(expect.objectContaining({
      entry: "oa-read-helper",
      homepageState: "disabled"
    }));
    expect(tools).toContainEqual(expect.objectContaining({
      entry: "proof-king",
      homepageState: "beta"
    }));
    expect(tools).toContainEqual(expect.objectContaining({
      entry: "session-bill-check",
      homepageState: "maintenance"
    }));
  });

  it("publishes four category views and defaults to all tools", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const categories = [...homepage.matchAll(/data-category="([a-z]+)"/g)].map((match) => match[1]);

    expect(categories).toEqual(["all", "heavy", "light", "automation"]);
    expect(homepage).toContain('data-default-category="all"');
  });

  it("keeps only non-tool page switches in site visibility", () => {
    const visibility = loadSiteVisibility();

    expect(visibility.homepage).toMatchObject({
      patternGate: false,
      announcement: expect.any(Boolean),
      sponsorEntry: expect.any(Boolean)
    });
    expect(visibility.sponsorPage).toMatchObject({ contributors: expect.any(Boolean) });
  });

  it("keeps the top bar, pattern gate and searchable tool directory wiring", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const renderer = fs.readFileSync(resolveFromRoot("src", "tool", "tools-render.ts"), "utf8");

    expect(homepage).toContain('class="command-bar"');
    expect(homepage).toContain('id="homePatternGate"');
    expect(homepage).toContain('id="searchInput"');
    expect(homepage).toContain('id="resultToolCount"');
    expect(renderer).toContain('class="tool-card');
    expect(renderer).toContain('class="tool-card-surface"');
    expect(renderer).toContain('class="tool-status-switch"');
    expect(renderer).toContain('aria-disabled="true"');
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
    expect(manuals.slice(0, 3).map((manual) => manual.path)).toEqual(
      [...manualSkillDirectories].map((directory) => `.agents/skills/${directory}/SKILL.md`)
    );
  });

});
