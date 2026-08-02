import { createHash } from "node:crypto";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../helpers/paths";

type LibraryRecord = {
  version: string;
  files: string[];
  source: string;
  license: string;
  sha256: Record<string, string>;
};

describe("browser third-party integrity", () => {
  it("governs every file in public/libs exactly once", () => {
    const manifest = JSON.parse(
      fs.readFileSync(resolveFromRoot("public", "libs", "versions.json"), "utf8")
    ) as { libraries: Record<string, LibraryRecord> };
    const managedFiles = Object.values(manifest.libraries).flatMap((library) => library.files).sort();
    const uniqueFiles = [...new Set(managedFiles)];
    const libraryFiles = fs.readdirSync(resolveFromRoot("public", "libs"))
      .filter((file) => file !== "versions.json")
      .sort();

    expect(uniqueFiles).toHaveLength(managedFiles.length);
    expect(uniqueFiles).toEqual(libraryFiles);
  });

  it("pins source, license and SHA-256 for every managed file", () => {
    const manifest = JSON.parse(
      fs.readFileSync(resolveFromRoot("public", "libs", "versions.json"), "utf8")
    ) as { libraries: Record<string, LibraryRecord> };

    Object.entries(manifest.libraries).forEach(([name, library]) => {
      expect(library.version, `${name} version`).not.toMatch(/未标注|未知/);
      expect(library.source, `${name} source`).toMatch(/^https:\/\//);
      expect(library.license, `${name} license`).toBeTruthy();
      library.files.forEach((file) => {
        const content = fs.readFileSync(resolveFromRoot("public", "libs", file));
        const actual = createHash("sha256").update(content).digest("hex");
        expect(library.sha256[file], `${name}/${file}`).toBe(actual);
      });
    });

    const managedFiles = Object.values(manifest.libraries)
      .flatMap((library) => library.files)
      .sort((left, right) => left.localeCompare(right, "en"));
    const actualFiles = fs.readdirSync(resolveFromRoot("public", "libs"))
      .filter((file) => file !== "versions.json")
      .sort((left, right) => left.localeCompare(right, "en"));
    expect(managedFiles).toEqual(actualFiles);
  });
});
