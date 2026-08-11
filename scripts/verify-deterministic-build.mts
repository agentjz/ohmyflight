import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return files.flat().sort((left, right) => left.localeCompare(right, "en"));
}

async function snapshot(distRoot: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const file of await walk(distRoot)) {
    const relativePath = path.relative(distRoot, file).replace(/\\/g, "/");
    const content = await fs.readFile(file);
    result.set(relativePath, createHash("sha256").update(content).digest("hex"));
  }
  return result;
}

async function runBuild(distRoot: string): Promise<void> {
  const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, "scripts/build.mts"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, CARGODOG_DIST_ROOT: distRoot }
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function main(): Promise<void> {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cargodog-build-deterministic-"));
  try {
    const firstRoot = path.join(temporaryRoot, "first");
    const secondRoot = path.join(temporaryRoot, "second");
    await runBuild(firstRoot);
    const first = await snapshot(firstRoot);
    await runBuild(secondRoot);
    const second = await snapshot(secondRoot);
    const paths = [...new Set([...first.keys(), ...second.keys()])].sort();
    const differences = paths.filter((file) => first.get(file) !== second.get(file));
    if (differences.length) {
      throw new Error(`连续两次构建不一致：${differences.join("、")}`);
    }
    process.stdout.write(`Deterministic build verified for ${paths.length} files.\n`);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
