import fs from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";

export type ToolExportDefinition = {
  entry: string;
  name: string;
  pageDirectory: string;
  applicationBundle: string;
  auxiliaryBundles?: Array<{ source: string; target: string }>;
  workerBundles?: Array<{ source: string; target: string }>;
};

export type ToolExportOptions = {
  distRoot: string;
  exportRoot: string;
  tools: ToolExportDefinition[];
};

export type ToolExportResult = {
  entry: string;
  name: string;
  archivePath: string;
  files: string[];
};

const fixedZipDate = new Date(0);

export async function buildToolExports(options: ToolExportOptions): Promise<ToolExportResult[]> {
  await fs.rm(options.exportRoot, { recursive: true, force: true });
  await fs.mkdir(options.exportRoot, { recursive: true });

  const results: ToolExportResult[] = [];
  for (const definition of options.tools) {
    results.push(await buildToolExport(options, definition));
  }
  return results;
}

async function buildToolExport(options: ToolExportOptions, definition: ToolExportDefinition): Promise<ToolExportResult> {
  const pageDirectory = path.resolve(definition.pageDirectory);
  const zip = new JSZip();
  const addedFiles = new Set<string>();
  const htmlFiles = await listFiles(pageDirectory, (filePath) => path.extname(filePath).toLowerCase() === ".html");
  if (!htmlFiles.some((filePath) => path.basename(filePath).toLowerCase() === "index.html")) {
    throw new Error(`工具 ${definition.entry} 缺少 index.html。`);
  }

  const htmlSources = new Map<string, string>();
  for (const htmlFile of htmlFiles) {
    const relativePath = path.relative(pageDirectory, htmlFile).replace(/\\/g, "/");
    const source = await fs.readFile(htmlFile, "utf8");
    const transformed = rewriteStandaloneHtml(source);
    htmlSources.set(relativePath, transformed);
    addZipText(zip, addedFiles, relativePath, transformed);
  }

  const pageFiles = await listFiles(pageDirectory, (filePath) => {
    const relativePath = path.relative(pageDirectory, filePath).replace(/\\/g, "/");
    const pathParts = relativePath.split("/");
    return !relativePath.endsWith(".html")
      && !relativePath.endsWith(".js")
      && !relativePath.endsWith(".map")
      && !pathParts.includes("__pycache__")
      && !relativePath.endsWith(".pyc");
  });
  for (const pageFile of pageFiles) {
    const relativePath = path.relative(pageDirectory, pageFile).replace(/\\/g, "/");
    addZipBytes(zip, addedFiles, relativePath, await fs.readFile(pageFile));
  }

  const applicationBundle = rewriteStandaloneScript(await fs.readFile(definition.applicationBundle, "utf8"));
  const scriptSources = [applicationBundle];
  const embeddedAssets = new Map<string, Uint8Array>();
  addZipText(zip, addedFiles, "app.js", applicationBundle);
  for (const bundle of definition.auxiliaryBundles || []) {
    const content = rewriteStandaloneScript(await fs.readFile(bundle.source, "utf8"));
    scriptSources.push(content);
    addZipText(zip, addedFiles, bundle.target, content);
  }
  for (const bundle of definition.workerBundles || []) {
    const content = rewriteStandaloneScript(await fs.readFile(bundle.source, "utf8"));
    scriptSources.push(content);
    const bytes = Buffer.from(content, "utf8");
    embeddedAssets.set(bundle.target, bytes);
    addZipBytes(zip, addedFiles, bundle.target, bytes);
  }

  const referencedPaths = collectReferencedPaths([...htmlSources.values(), ...scriptSources]);
  const referencedResources = await copyReferencedResources(options.distRoot, zip, addedFiles, referencedPaths);
  const generatedData = await copyGeneratedData(options.distRoot, definition.entry, zip, addedFiles);
  const fetchPaths = collectFetchPaths(scriptSources);
  for (const fetchPath of fetchPaths) {
    const content = referencedResources.get(fetchPath) || generatedData.get(fetchPath);
    if (content) embeddedAssets.set(fetchPath, content);
  }
  for (const [dataPath, content] of generatedData) embeddedAssets.set(dataPath, content);
  addZipText(zip, addedFiles, "standalone-runtime.js", createStandaloneRuntime(embeddedAssets));

  const manifestPath = "watchdog-tool.json";
  const manifest = {
    format: "watchdog-standalone-tool",
    schemaVersion: 1,
    entry: definition.entry,
    name: definition.name,
    root: "index.html",
    files: [...addedFiles, manifestPath].sort((left, right) => left.localeCompare(right, "en"))
  };
  addZipText(zip, addedFiles, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "DOS"
  });
  const archivePath = path.join(options.exportRoot, `${definition.entry}.zip`);
  await fs.writeFile(archivePath, bytes);
  return {
    entry: definition.entry,
    name: definition.name,
    archivePath,
    files: [...addedFiles].sort((left, right) => left.localeCompare(right, "en"))
  };
}

async function copyGeneratedData(
  distRoot: string,
  entry: string,
  zip: JSZip,
  addedFiles: Set<string>
): Promise<Map<string, Uint8Array>> {
  const generatedData = new Map<string, Uint8Array>();
  const candidates = [path.join("tool", `${entry}-data.json`)];
  if (entry === "beginner-tutorial") candidates.push(path.join("tool", "beginner-tutorial-data.json"));
  for (const relativePath of candidates) {
    const sourcePath = path.join(distRoot, relativePath);
    try {
      const targetPath = path.basename(relativePath);
      const content = await fs.readFile(sourcePath);
      addZipBytes(zip, addedFiles, targetPath, content);
      generatedData.set(targetPath, content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return generatedData;
}

function collectReferencedPaths(contents: string[]): Set<string> {
  const referenced = new Set<string>();
  for (const content of contents) {
    const matches = content.matchAll(/(?:\.\/)?(?:libs|template)\/[A-Za-z0-9_./\-\u0080-\uffff]+/g);
    for (const match of matches) {
      const value = match[0].replace(/^\.\//, "").replace(/[)'"`;,]+$/, "");
      if (value.startsWith("libs/") || value.startsWith("template/")) referenced.add(value);
    }
  }
  referenced.add("theme.js");
  referenced.add("theme.css");
  if (contents.some((content) => content.includes("./support-shell.css"))) referenced.add("support-shell.css");
  return referenced;
}

function collectFetchPaths(contents: string[]): Set<string> {
  const referenced = new Set<string>();
  for (const content of contents) {
    const matches = content.matchAll(/\.\/(?:libs|template)\/[A-Za-z0-9_./\-\u0080-\uffff]+|\.\/[A-Za-z0-9_.\-]+-data\.json/g);
    for (const match of matches) {
      referenced.add(match[0].replace(/^\.\//, "").replace(/[)'"`;,]+$/, ""));
    }
  }
  return referenced;
}

async function copyReferencedResources(
  distRoot: string,
  zip: JSZip,
  addedFiles: Set<string>,
  referencedPaths: Set<string>
): Promise<Map<string, Uint8Array>> {
  const resources = new Map<string, Uint8Array>();
  for (const relativePath of [...referencedPaths].sort((left, right) => left.localeCompare(right, "en"))) {
    const sourcePath = relativePath === "support-shell.css"
      ? path.join(distRoot, "tool", relativePath)
      : path.join(distRoot, relativePath);
    try {
      const content = await fs.readFile(sourcePath);
      addZipBytes(zip, addedFiles, relativePath, content);
      resources.set(relativePath, content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      throw new Error(`导出包缺少资源：${relativePath}`);
    }
  }
  return resources;
}

async function listFiles(rootDirectory: string, predicate: (filePath: string) => boolean): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile() && predicate(filePath)) {
        files.push(filePath);
      }
    }
  }
  await visit(rootDirectory);
  return files;
}

function rewriteStandaloneHtml(source: string): string {
  const rewritten = source.replace(
    /\b(src|href|download)=(['"])([^'"]+)\2/gi,
    (_match, attribute: string, quote: string, value: string) => `${attribute}=${quote}${rewriteStandalonePath(value)}${quote}`
  );
  const classicScripts = rewritten.replace(/<script([^>]*?)\s+type=(['"])module\2([^>]*)>/gi, "<script$1$3>");
  return classicScripts.replace(/<\/head>/i, "    <script src=\"./standalone-runtime.js\"></script>\n</head>");
}

function rewriteStandalonePath(value: string): string {
  if (/^(?:[a-z]+:|\/\/|#|data:|mailto:)/i.test(value)) return value;
  if (value.startsWith("../../../")) return `./${value.slice(9)}`;
  if (value.startsWith("../../")) return `./${value.slice(6)}`;
  if (value.startsWith("../")) return `./${value.slice(3)}`;
  return value;
}

function rewriteStandaloneScript(source: string): string {
  return source
    .split("../../../").join("./")
    .split("../../").join("./")
    .split("../").join("./");
}

function createStandaloneRuntime(assets: Map<string, Uint8Array>): string {
  const serializedAssets = Object.fromEntries(
    [...assets.entries()]
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([assetPath, content]) => [assetPath, {
        mediaType: mediaTypeFor(assetPath),
        base64: Buffer.from(content).toString("base64")
      }])
  );
  return `(function () {
  var assets = ${JSON.stringify(serializedAssets)};
  var nativeFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  var NativeWorker = window.Worker;

  function assetKey(value) {
    var raw = typeof value === "string" ? value : value && value.url;
    if (!raw) return "";
    try {
      var base = new URL("./", window.location.href);
      var target = new URL(raw, window.location.href);
      if (!target.href.startsWith(base.href)) return "";
      return decodeURIComponent(target.href.slice(base.href.length).split(/[?#]/, 1)[0]);
    } catch (_error) {
      return "";
    }
  }

  function decode(asset) {
    var binary = window.atob(asset.base64);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  window.fetch = function (input, init) {
    var asset = assets[assetKey(input)];
    if (asset) {
      return Promise.resolve(new Response(decode(asset), {
        status: 200,
        headers: { "Content-Type": asset.mediaType }
      }));
    }
    return nativeFetch ? nativeFetch(input, init) : Promise.reject(new TypeError("当前环境不支持 fetch。"));
  };

  if (typeof NativeWorker === "function") {
    window.Worker = function (url, options) {
      var asset = assets[assetKey(url)];
      if (!asset) return new NativeWorker(url, options);
      var objectUrl = URL.createObjectURL(new Blob([decode(asset)], { type: asset.mediaType }));
      return new NativeWorker(objectUrl, options);
    };
    window.Worker.prototype = NativeWorker.prototype;
  }
})();
`;
}

function mediaTypeFor(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase();
  if (extension === ".json") return "application/json;charset=utf-8";
  if (extension === ".js") return "text/javascript;charset=utf-8";
  if (extension === ".txt") return "text/plain;charset=utf-8";
  if (extension === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}

function addZipText(zip: JSZip, addedFiles: Set<string>, relativePath: string, content: string): void {
  addZipBytes(zip, addedFiles, relativePath, Buffer.from(content, "utf8"));
}

function addZipBytes(zip: JSZip, addedFiles: Set<string>, relativePath: string, content: Uint8Array): void {
  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalizedPath || normalizedPath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`导出包路径无效：${relativePath}`);
  }
  if (addedFiles.has(normalizedPath)) return;
  zip.file(normalizedPath, content, { date: fixedZipDate, createFolders: false });
  addedFiles.add(normalizedPath);
}
