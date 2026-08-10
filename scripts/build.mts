import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { build } from "esbuild";
import ts from "typescript";
import type { BeginnerTutorialData, TutorialModule, TutorialRecord, TutorialSourceRef } from "../src/tool/app/beginner-tutorial/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const staticRoot = path.join(projectRoot, "public");
const distRoot = resolveDistRoot();
const skillsRoot = path.join(projectRoot, ".agents", "skills");
const userManualsRoot = path.join(projectRoot, "spec", "user");
const beginnerTutorialContentRoot = path.join(sourceRoot, "tool", "app", "beginner-tutorial", "content");
const execFileAsync = promisify(execFile);

function resolveDistRoot(): string {
  const requestedRoot = process.env.OHMYFLIGHT_DIST_ROOT;
  if (!requestedRoot) return path.join(projectRoot, "dist");

  const resolvedRoot = path.resolve(requestedRoot);
  const temporaryRoot = path.resolve(os.tmpdir());
  const relativePath = path.relative(temporaryRoot, resolvedRoot);
  const topLevelDirectory = relativePath.split(path.sep)[0] || "";
  if (
    relativePath.startsWith("..")
    || path.isAbsolute(relativePath)
    || !topLevelDirectory.startsWith("ohmyflight-build-")
  ) {
    throw new Error("OHMYFLIGHT_DIST_ROOT 只允许使用专用的系统临时目录。");
  }
  return resolvedRoot;
}

const pageEntries = [
  { source: "src/tool/tools-render.ts", output: "tool/app", page: "tool/index.html" },
  { source: "src/tool/manuals.ts", output: "tool/manuals-app", page: "tool/manuals.html" },
  { source: "src/tool/developer.ts", output: "tool/developer-app", page: "tool/developer.html" },
  { source: "src/tool/app/beginner-tutorial/main.ts", output: "tool/app/beginner-tutorial/app", page: "tool/app/beginner-tutorial/index.html" },
  { source: "src/memo/site.ts", output: "memo/app", page: "memo/index.html" },
  { source: "src/sponsor/main.ts", output: "sponsor/app", page: "sponsor/index.html" },
  { source: "src/tool/app/audit-king/main.ts", output: "tool/app/audit-king/app", page: "tool/app/audit-king/index.html" },
  { source: "src/tool/app/crew-flight-stats/main.ts", output: "tool/app/crew-flight-stats/app", page: "tool/app/crew-flight-stats/index.html" },
  { source: "src/tool/app/crew-match-name-id/main.ts", output: "tool/app/crew-match-name-id/app", page: "tool/app/crew-match-name-id/index.html" },
  { source: "src/tool/app/flight-stats-helper/shell.ts", output: "tool/app/flight-stats-helper/app", page: "tool/app/flight-stats-helper/index.html" },
  { source: "src/tool/app/focus-crew/main.ts", output: "tool/app/focus-crew/app", page: "tool/app/focus-crew/index.html" },
  { source: "src/tool/app/hotel-bill-check/main.ts", output: "tool/app/hotel-bill-check/app", page: "tool/app/hotel-bill-check/index.html" },
  { source: "src/tool/app/image-tool/main.ts", output: "tool/app/image-tool/app", page: "tool/app/image-tool/index.html" },
  { source: "src/tool/app/lock-entry-helper/shell.ts", output: "tool/app/lock-entry-helper/app", page: "tool/app/lock-entry-helper/index.html" },
  { source: "src/tool/app/oa-read-helper/shell.ts", output: "tool/app/oa-read-helper/app", page: "tool/app/oa-read-helper/index.html" },
  { source: "src/tool/app/qualification-query-helper/shell.ts", output: "tool/app/qualification-query-helper/app", page: "tool/app/qualification-query-helper/index.html" },
  { source: "src/tool/app/pdf-stamp/main.ts", output: "tool/app/pdf-stamp/app", page: "tool/app/pdf-stamp/index.html" },
  { source: "src/tool/app/pdf-tool/main.ts", output: "tool/app/pdf-tool/app", page: "tool/app/pdf-tool/index.html" },
  { source: "src/tool/app/personnel-structure-stats/main.ts", output: "tool/app/personnel-structure-stats/app", page: "tool/app/personnel-structure-stats/index.html" },
  { source: "src/tool/app/proof-king/main.ts", output: "tool/app/proof-king/app", page: "tool/app/proof-king/index.html" },
  { source: "src/tool/app/seasonal-learning/main.ts", output: "tool/app/seasonal-learning/app", page: "tool/app/seasonal-learning/index.html" },
  { source: "src/tool/app/session-bill-check/main.ts", output: "tool/app/session-bill-check/app", page: "tool/app/session-bill-check/index.html" },
  { source: "src/tool/app/text-joiner/main.ts", output: "tool/app/text-joiner/app", page: "tool/app/text-joiner/index.html" },
  { source: "src/tool/app/training-workbench/scripts/app.ts", output: "tool/app/training-workbench/app", page: "tool/app/training-workbench/index.html" },
  { source: "src/tool/app/training-workbench/scripts/rule-reference.ts", output: "tool/app/training-workbench/rule-reference-app", page: "tool/app/training-workbench/rule-reference.html" },
  { source: "src/tool/app/word-template-filler/main.ts", output: "tool/app/word-template-filler/app", page: "tool/app/word-template-filler/index.html" }
] as const;

const workerEntries = [
  { source: "src/tool/app/proof-king/comparison-worker.ts", output: "tool/app/proof-king/comparison-worker" }
] as const;

const hiddenManualSkillNames = new Set([
  "read-flight-training-program",
  "read-flight-technical-management-manual"
]);

async function walkSourceAssetFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];
  const assetExtensions = new Set([".py"]);

  async function visit(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }

      if (entry.isFile() && assetExtensions.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await visit(rootDir);
  return results.sort();
}

function toAssetOutputPath(sourceFilePath: string): string {
  const relativePath = path.relative(sourceRoot, sourceFilePath);
  return path.join(distRoot, relativePath);
}

async function prepareDist() {
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distRoot, { recursive: true });
}

async function copyStaticFiles() {
  await fs.cp(staticRoot, distRoot, {
    recursive: true,
    force: true
  });

  const historyPath = path.join(projectRoot, "history.md");
  try {
    await fs.copyFile(historyPath, path.join(distRoot, "history.md"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function readGitText(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: projectRoot,
      encoding: "utf8"
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

async function generateVersionFile() {
  const commit = await readGitText(["rev-parse", "--short", "HEAD"]);
  const rawLog = await readGitText(["log", "--pretty=format:%h%x09%cI%x09%s"]);
  const commits = rawLog
    ? rawLog.split(/\r?\n/).map((line) => {
        const [hash = "", date = "", ...messageParts] = line.split("\t");
        return {
          hash,
          date,
          message: messageParts.join("\t")
        };
      }).filter((item) => item.hash || item.message)
    : [];

  const version = {
    commit,
    commits
  };

  await fs.writeFile(
    path.join(distRoot, "version.json"),
    `${JSON.stringify(version, null, 2)}\n`,
    "utf8"
  );
}

async function buildPageEntries(): Promise<void> {
  const entryPoints = Object.fromEntries(
    [...pageEntries, ...workerEntries].map((entry) => [entry.output, path.join(projectRoot, entry.source)])
  );
  const result = await build({
    absWorkingDir: projectRoot,
    entryPoints,
    outdir: distRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    sourcemap: true,
    minify: true,
    charset: "utf8",
    entryNames: "[dir]/[name]",
    legalComments: "none",
    metafile: true,
    write: true,
    logLevel: "silent"
  });

  const commit = await readGitText(["rev-parse", "--short", "HEAD"]);
  const entries = [];
  for (const entry of pageEntries) {
    const output = `${entry.output}.js`;
    const content = await fs.readFile(path.join(distRoot, output));
    entries.push({
      source: entry.source,
      output,
      page: entry.page,
      sha256: createHash("sha256").update(content).digest("hex")
    });
  }

  const outputs = Object.keys(result.metafile.outputs)
    .map((output) => {
      const relativeOutput = path.relative(distRoot, path.resolve(projectRoot, output)).replace(/\\/g, "/");
      return `dist/${relativeOutput}`;
    })
    .sort((left, right) => left.localeCompare(right, "en"));
  await fs.writeFile(
    path.join(distRoot, "build-manifest.json"),
    `${JSON.stringify({ schemaVersion: 1, commit, entries, outputs }, null, 2)}\n`,
    "utf8"
  );
}

function readFrontmatterValue(frontmatter: string, key: string): string {
  const prefix = `${key}:`;
  const line = frontmatter
    .split(/\r?\n/)
    .find((candidate) => candidate.trimStart().startsWith(prefix));
  return line ? line.trim().slice(prefix.length).trim() : "";
}

async function generateSkillsDataFile() {
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills: Array<{ name: string; description: string; source: string; path: string }> = [];
  const pinnedSkillNames = new Map([
    ["read-flight-training-program", 0],
    ["read-flight-technical-management-manual", 1]
  ]);
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!entry.isDirectory()) continue;
    if (hiddenManualSkillNames.has(entry.name)) continue;
    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");

    try {
      const source = await fs.readFile(skillPath, "utf8");
      const frontmatterMatch = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
      const frontmatter = frontmatterMatch?.[1] || "";
      skills.push({
        name: readFrontmatterValue(frontmatter, "name") || entry.name,
        description: readFrontmatterValue(frontmatter, "description"),
        source,
        path: `.agents/skills/${entry.name}/SKILL.md`
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  skills.sort((left, right) => {
    const leftPriority = pinnedSkillNames.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = pinnedSkillNames.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority || left.name.localeCompare(right.name, "en");
  });

  const outputPath = path.join(distRoot, "tool", "skills-data.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(skills)}\n`, "utf8");
}

function readObjectStringProperty(node: ts.ObjectLiteralExpression, propertyName: string): string {
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : "";
    if (name !== propertyName || !ts.isStringLiteralLike(property.initializer)) continue;
    return property.initializer.text;
  }
  return "";
}

async function readToolCatalog(): Promise<Array<{ name: string; description: string; entry: string }>> {
  const sourcePath = path.join(sourceRoot, "tool", "tools-data.ts");
  const sourceText = await fs.readFile(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true);
  let catalog: Array<{ name: string; description: string; entry: string }> = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "tools") continue;
      if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      catalog = declaration.initializer.elements.flatMap((element) => {
        if (!ts.isObjectLiteralExpression(element)) return [];
        const name = readObjectStringProperty(element, "name");
        const description = readObjectStringProperty(element, "desc");
        const entry = readObjectStringProperty(element, "entry");
        return name && entry ? [{ name, description, entry }] : [];
      });
    }
  });

  if (!catalog.length) {
    throw new Error("无法从 src/tool/tools-data.ts 读取工具清单。");
  }
  return catalog;
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

async function generateManualsDataFile() {
  const manuals: Array<{ name: string; description: string; source: string; path: string }> = [];

  for (const tool of await readToolCatalog()) {
    const relativePath = `spec/user/${tool.entry}/manual.md`;
    const source = await fs.readFile(path.join(projectRoot, relativePath), "utf8");
    manuals.push({
      name: tool.name,
      description: tool.description,
      source: source.trim(),
      path: relativePath
    });
  }

  const outputPath = path.join(distRoot, "tool", "manuals-data.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manuals)}\n`, "utf8");
}

async function generateBeginnerTutorialDataFile() {
  const sourcePath = path.join(beginnerTutorialContentRoot, "knowledge.json");
  const source = JSON.parse(await fs.readFile(sourcePath, "utf8")) as Omit<BeginnerTutorialData, "modules"> & {
    modules: Array<Omit<TutorialModule, "sources" | "body">>;
  };
  if (source.schemaVersion !== 1 || !source.title || !source.description || !Array.isArray(source.sourceScope) || !Array.isArray(source.modules)) {
    throw new Error("菜鸟教程知识源结构无效。");
  }

  const sourceIndex = new Map(source.sourceScope.map((item) => [item.id, item]));
  const resolveSources = (ids: string[] | undefined, owner: string): TutorialSourceRef[] => {
    if (!ids?.length) return [];
    return ids.map((id) => {
      const item = sourceIndex.get(id);
      if (!item) throw new Error(`菜鸟教程知识项 ${owner} 引用了不存在的来源 ${id}。`);
      return item;
    });
  };

  const modules: TutorialModule[] = [];
  for (const module of source.modules) {
    const moduleBody = module.bodyFile
      ? (await fs.readFile(path.join(beginnerTutorialContentRoot, module.bodyFile), "utf8")).trim()
      : undefined;
    const records: TutorialRecord[] | undefined = module.records?.map((record) => ({
      ...record,
      sources: resolveSources(record.sourceIds, record.id)
    }));
    const steps = module.steps?.map((step) => ({
      ...step,
      sources: resolveSources(step.sourceIds, step.id)
    }));
    modules.push({
      ...module,
      ...(moduleBody === undefined ? {} : { body: moduleBody }),
      ...(records === undefined ? {} : { records }),
      ...(steps === undefined ? {} : { steps }),
      sources: resolveSources(module.sourceIds, module.id)
    });
  }

  const tutorials: BeginnerTutorialData = {
    schemaVersion: 1,
    title: source.title,
    description: source.description,
    sourceScope: source.sourceScope,
    modules
  };
  const outputPath = path.join(distRoot, "tool", "beginner-tutorial-data.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(tutorials)}\n`, "utf8");
}

async function copySourceAsset(sourceFilePath: string): Promise<string> {
  const outputFilePath = toAssetOutputPath(sourceFilePath);
  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
  await fs.copyFile(sourceFilePath, outputFilePath);
  return path.relative(projectRoot, outputFilePath);
}

async function main() {
  await prepareDist();
  await copyStaticFiles();

  const assetFiles = await walkSourceAssetFiles(sourceRoot);
  for (const sourceFilePath of assetFiles) {
    await copySourceAsset(sourceFilePath);
  }

  await generateSkillsDataFile();
  await generateManualsDataFile();
  await generateBeginnerTutorialDataFile();
  await buildPageEntries();
  await generateVersionFile();

  const outputLabel = distRoot === path.join(projectRoot, "dist") ? "dist/" : "an isolated output directory";
  process.stdout.write(`Built ${pageEntries.length} page entries, ${workerEntries.length} worker and ${assetFiles.length} source assets into ${outputLabel}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
