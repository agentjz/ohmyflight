import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { resolveFromDist } from "../helpers/paths";

describe("deterministic version contract", () => {
  it("contains only reproducible source facts", () => {
    const version = JSON.parse(fs.readFileSync(resolveFromDist("version.json"), "utf8")) as Record<string, unknown>;

    expect(version.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(version).not.toHaveProperty("branch");
    expect(version).not.toHaveProperty("builtAt");
  });
});
