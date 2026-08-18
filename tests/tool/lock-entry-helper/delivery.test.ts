import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

describe("lock entry delivery entries", () => {
  it("publishes the two serial start entries", () => {
    const root = resolveFromRoot("public/tool/app/lock-entry-helper");
    const html = readFileSync(`${root}/index.html`, "utf8");
    const pythonEntries = readdirSync(root).filter((name) => name.endsWith(".py")).sort();

    expect(pythonEntries).toEqual(["startapp.py", "startsmartapp.py"]);
    expect(html).toContain('href="startapp.py"');
    expect(html).toContain('href="startsmartapp.py"');
    expect(readFileSync(`${root}/startapp.py`, "utf8")).toContain("lock_entry.original_runner");
    expect(readFileSync(`${root}/startsmartapp.py`, "utf8")).toContain("lock_entry.smart_runner");
  });
});
