import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveFromDist } from "../helpers/paths";

type BuildEntry = {
  source: string;
  output: string;
  page: string;
  sha256: string;
};

type BuildManifest = {
  schemaVersion: number;
  commit: string;
  entries: BuildEntry[];
};

describe("ESM production build contract", () => {
  it("publishes a machine-readable entry manifest", () => {
    const manifestPath = resolveFromDist("build-manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BuildManifest;

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(manifest.entries.length).toBeGreaterThan(0);
    manifest.entries.forEach((entry) => {
      expect(entry.source).toMatch(/^src\/.+\.ts$/);
      expect(entry.output).toMatch(/\.js$/);
      expect(entry.page).toMatch(/\.html$/);
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(fs.existsSync(resolveFromDist(...entry.output.split("/")))).toBe(true);
    });
  });

  it("loads exactly one module application entry on every manifested page", () => {
    const manifest = JSON.parse(
      fs.readFileSync(resolveFromDist("build-manifest.json"), "utf8")
    ) as BuildManifest;

    manifest.entries.forEach((entry) => {
      const htmlPath = resolveFromDist(...entry.page.split("/"));
      const html = fs.readFileSync(htmlPath, "utf8");
      const applicationSource = path.posix.relative(path.posix.dirname(entry.page), entry.output);
      const escaped = applicationSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tags = html.match(new RegExp(`<script\\b[^>]*type=["']module["'][^>]*src=["'](?:\\./)?${escaped}["'][^>]*>`, "g")) || [];
      expect(tags, entry.page).toHaveLength(1);
    });
  });
});
