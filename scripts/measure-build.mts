import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

type ScriptAsset = {
  source: string;
  kind: "application" | "third-party" | "site-runtime";
  bytes: number | null;
  gzipBytes: number | null;
};

type PageMeasurement = {
  page: string;
  scripts: ScriptAsset[];
  applicationScriptCount: number;
  applicationBytes: number;
  applicationGzipBytes: number;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(projectRoot, "dist");
const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));

async function walkFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await visit(root);
  return files.sort((left, right) => left.localeCompare(right, "en"));
}

function classifyScript(source: string): ScriptAsset["kind"] {
  const normalized = source.replace(/\\/g, "/").split(/[?#]/, 1)[0];
  if (normalized.includes("/libs/") || normalized.startsWith("libs/")) return "third-party";
  if (/(^|\/)(theme|site-visibility)\.js$/.test(normalized)) return "site-runtime";
  return "application";
}

async function readScriptAsset(htmlPath: string, source: string): Promise<ScriptAsset> {
  if (/^(?:https?:)?\/\//i.test(source)) {
    return { source, kind: "third-party", bytes: null, gzipBytes: null };
  }

  const cleanSource = source.split(/[?#]/, 1)[0];
  const assetPath = path.resolve(path.dirname(htmlPath), cleanSource);
  try {
    const content = await fs.readFile(assetPath);
    return {
      source,
      kind: classifyScript(source),
      bytes: content.byteLength,
      gzipBytes: gzipSync(content, { level: 9 }).byteLength
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { source, kind: classifyScript(source), bytes: null, gzipBytes: null };
  }
}

async function measurePage(htmlPath: string): Promise<PageMeasurement> {
  const html = await fs.readFile(htmlPath, "utf8");
  const sources = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]);
  const scripts = await Promise.all(sources.map((source) => readScriptAsset(htmlPath, source)));
  const applicationScripts = scripts.filter((script) => script.kind === "application");
  return {
    page: path.relative(distRoot, htmlPath).replace(/\\/g, "/"),
    scripts,
    applicationScriptCount: applicationScripts.length,
    applicationBytes: applicationScripts.reduce((total, script) => total + (script.bytes ?? 0), 0),
    applicationGzipBytes: applicationScripts.reduce((total, script) => total + (script.gzipBytes ?? 0), 0)
  };
}

async function main(): Promise<void> {
  const files = await walkFiles(distRoot);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const pages = await Promise.all(htmlFiles.map(measurePage));
  const coreFiles = files.filter((file) => !file.endsWith("version.json"));
  const hash = createHash("sha256");
  let totalBytes = 0;

  for (const file of coreFiles) {
    const content = await fs.readFile(file);
    const relativePath = path.relative(distRoot, file).replace(/\\/g, "/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
    totalBytes += content.byteLength;
  }

  const result = {
    schemaVersion: 1,
    coreArtifactSha256: hash.digest("hex"),
    fileCount: files.length,
    totalBytes,
    pages
  };
  const serialized = `${JSON.stringify(result, null, 2)}\n`;

  if (outputArgument) {
    const outputPath = path.resolve(projectRoot, outputArgument.slice("--output=".length));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, serialized, "utf8");
  }
  process.stdout.write(serialized);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
