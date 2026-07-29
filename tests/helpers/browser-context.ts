import fs from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

import { projectRoot, resolveFromDist, resolveFromRoot } from "./paths";

type BrowserSandbox = Record<string, unknown> & {
  window?: BrowserSandbox;
  globalThis?: BrowserSandbox;
  __tools?: ToolItem[];
  __siteVisibility?: SiteVisibilityConfig;
  __skills?: SkillItem[];
  __manuals?: ManualItem[];
};

let distFreshChecked = false;
const buildLockDir = resolveFromRoot(".vitest", "dist-build.lock");

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function latestMtimeMs(root: string): number {
  if (!fs.existsSync(root)) return 0;
  const stat = fs.statSync(root);
  if (stat.isFile()) return stat.mtimeMs;

  return fs.readdirSync(root, { withFileTypes: true }).reduce((latest, entry) => {
    const fullPath = `${root}/${entry.name}`;
    if (entry.isDirectory()) return Math.max(latest, latestMtimeMs(fullPath));
    if (entry.isFile()) return Math.max(latest, fs.statSync(fullPath).mtimeMs);
    return latest;
  }, stat.mtimeMs);
}

function runBuildForDist(): void {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["run", "build"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
    shell: process.platform === "win32"
  });

  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${npmCommand} run build exited with code ${result.status ?? "unknown"}`);
  }
}

function needsDistBuild(): boolean {
  const distRoot = resolveFromRoot("dist");
  const distMtime = latestMtimeMs(distRoot);
  const sourceMtime = Math.max(
    latestMtimeMs(resolveFromRoot("src")),
    latestMtimeMs(resolveFromRoot("public")),
    latestMtimeMs(resolveFromRoot(".agents", "skills")),
    latestMtimeMs(resolveFromRoot("spec"))
  );

  return !distMtime || distMtime < sourceMtime;
}

function runWithBuildLock(callback: () => void): void {
  fs.mkdirSync(resolveFromRoot(".vitest"), { recursive: true });
  const startedAt = Date.now();
  let ownsLock = false;

  while (!ownsLock) {
    try {
      fs.mkdirSync(buildLockDir);
      ownsLock = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (Date.now() - startedAt > 120_000) {
        throw new Error("等待 dist 构建锁超时。");
      }
      sleepSync(100);
    }
  }

  try {
    callback();
  } finally {
    fs.rmSync(buildLockDir, { recursive: true, force: true });
  }
}

function ensureDistFresh(): void {
  if (distFreshChecked) return;
  distFreshChecked = true;

  if (needsDistBuild()) {
    runWithBuildLock(() => {
      if (needsDistBuild()) {
        runBuildForDist();
      }
    });
  }
}

function createBaseSandbox(overrides: Record<string, unknown> = {}): BrowserSandbox {
  const sandbox: BrowserSandbox = {
    console,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Map,
    Set,
    Date,
    Math,
    JSON,
    RegExp,
    Array,
    Object,
    Number,
    String,
    Boolean,
    URLSearchParams,
    ...overrides
  };

  sandbox.window = sandbox.window || sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

export function createBrowserContext(overrides: Record<string, unknown> = {}) {
  const sandbox = createBaseSandbox(overrides);
  vm.createContext(sandbox);
  return sandbox;
}

export function runBrowserScript(relativePath: string, context: BrowserSandbox, trailer = "") {
  ensureDistFresh();
  const filename = resolveFromDist(relativePath);
  if (!fs.existsSync(filename)) {
    runWithBuildLock(() => {
      if (!fs.existsSync(filename)) {
        runBuildForDist();
      }
    });
  }
  const source = fs.readFileSync(filename, "utf8");
  return vm.runInContext(`${source}\n${trailer}`, context, { filename });
}

export function loadBrowserScripts(relativePaths: string[], overrides: Record<string, unknown> = {}) {
  const context = createBrowserContext(overrides);
  relativePaths.forEach((relativePath) => {
    runBrowserScript(relativePath, context);
  });
  return context;
}

export function loadToolsData() {
  const context = createBrowserContext();
  runBrowserScript("tool/tools-data.js", context, "globalThis.__tools = tools;");
  return context.__tools;
}

export function loadSiteVisibility(): SiteVisibilityConfig {
  const context = createBrowserContext();
  runBrowserScript("site-visibility.js", context, "globalThis.__siteVisibility = siteVisibility;");
  if (!context.__siteVisibility) throw new Error("站点可见性配置未注册。");
  return context.__siteVisibility;
}

export function loadSkillsData() {
  const context = createBrowserContext();
  runBrowserScript("tool/skills-data.js", context, "globalThis.__skills = skills;");
  return context.__skills;
}

export function loadManualsData() {
  const context = createBrowserContext();
  runBrowserScript("tool/manuals-data.js", context, "globalThis.__manuals = manuals;");
  return context.__manuals;
}
