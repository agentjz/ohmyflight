import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { loadSkillsData, loadToolsData } from "../helpers/browser-context";
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
  });

  it("keeps the requested tools in the separate hidden area", () => {
    const tools = loadToolsData() || [];
    const hiddenEntries = tools
      .filter((tool) => tool.homepageVisibility === "hidden" || tool.homepageState === "cooling")
      .map((tool) => tool.entry);

    expect(hiddenEntries).toEqual([
      "beginner-tutorial",
      "crew-match-name-id",
      "personnel-structure-stats",
      "lock-entry-helper",
      "flight-stats-helper",
      "session-bill-check",
      "oa-read-helper"
    ]);
  });

  it("keeps the README tool table synchronized with the tool list", () => {
    const tools = loadToolsData() || [];
    const readme = fs.readFileSync(resolveFromRoot("README.md"), "utf8");
    const startMarker = "<!-- tools-table:start -->";
    const endMarker = "<!-- tools-table:end -->";
    const start = readme.indexOf(startMarker);
    const end = readme.indexOf(endMarker);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const rows = readme.slice(start + startMarker.length, end)
      .split(/\r?\n/)
      .filter((line) => /^\| .+ \| (?:✅|🧪|🧊) \|/.test(line));
    const expectedRows = tools.map((tool) => {
      const state = tool.homepageState || "enabled";
      const icon = state === "beta" ? "🧪" : state === "cooling" ? "🧊" : "✅";
      return `| ${tool.name} | ${icon} | ${tool.desc} |`;
    });

    expect(rows).toEqual(expectedRows);
  });

  it("publishes four category views and defaults to all tools", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const categories = [...homepage.matchAll(/data-category="([a-z]+)"/g)].map((match) => match[1]);

    expect(categories).toEqual(["all", "heavy", "light", "automation"]);
    expect(homepage).toContain('data-default-category="all"');
  });

  it("keeps the top bar and searchable tool directory wiring", () => {
    const homepage = fs.readFileSync(resolveFromRoot("public", "tool", "index.html"), "utf8");
    const renderer = fs.readFileSync(resolveFromRoot("src", "tool", "tools-render.ts"), "utf8");

    expect(homepage).toContain('class="command-bar"');
    expect(homepage).toContain('data-default-theme="light"');
    expect(homepage).toContain('id="homeThemeToggle"');
    expect(homepage).toContain('src="../theme.js"');
    expect(homepage).toContain('id="searchInput"');
    expect(homepage).toContain('id="resultToolCount"');
    expect(renderer).toContain('class="tool-card');
    expect(renderer).toContain('class="tool-card-surface"');
    expect(renderer).toContain('class="tool-status-switch"');
    expect(renderer).toContain("getVisibleToolRows");
    expect(renderer).toContain("coolingGateLogic.matches");
    expect(renderer).toContain("coolingGateLogic.isHomepageToolHidden");
    expect(renderer).toContain("coolingGateLogic.registerClick");
    expect(homepage).toContain('id="coolingUnlockArea"');
    expect(homepage).toContain('id="coolingUnlockInput"');
    expect(homepage).toContain('id="hiddenToolsView"');
  });

  it("publishes the current repository skills", () => {
    const skills = loadSkillsData() || [];
    const manualSkillDirectories = new Set([
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
  });

});
