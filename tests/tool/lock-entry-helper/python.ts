import { execFileSync } from "node:child_process";

import { expect } from "vitest";

import { resolveFromRoot } from "../../helpers/paths";

export function runLockEntryPython(script: string) {
  const bootstrap = `
import sys
sys.path.insert(0, "public/tool/app/lock-entry-helper")
`;

  expect(() =>
    execFileSync("python", ["-c", bootstrap + script], {
      cwd: resolveFromRoot(),
      stdio: "pipe"
    })
  ).not.toThrow();
}
