import fs from "node:fs";
import vm from "node:vm";

import { tools } from "../../src/tool/tools-data";
import { resolveFromDist } from "./paths";

type BrowserSandbox = Record<string, unknown> & {
  window?: BrowserSandbox;
  globalThis?: BrowserSandbox;
  __tools?: ToolItem[];
  __skills?: SkillItem[];
  __manuals?: ManualItem[];
};

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

function runBrowserVendor(relativePath: string, context: BrowserSandbox) {
  const filename = resolveFromDist(relativePath);
  if (!fs.existsSync(filename)) {
    throw new Error(`缺少构建产物 ${relativePath}，请先运行 npm.cmd run build。`);
  }
  const source = fs.readFileSync(filename, "utf8");
  return vm.runInContext(source, context, { filename });
}

export function loadBrowserVendor(relativePath: string, overrides: Record<string, unknown> = {}) {
  const context = createBrowserContext(overrides);
  runBrowserVendor(relativePath, context);
  return context;
}

export function loadToolsData() {
  return tools;
}

export function loadSkillsData() {
  return JSON.parse(fs.readFileSync(resolveFromDist("tool", "skills-data.json"), "utf8")) as SkillItem[];
}

export function loadManualsData() {
  return JSON.parse(fs.readFileSync(resolveFromDist("tool", "manuals-data.json"), "utf8")) as ManualItem[];
}
