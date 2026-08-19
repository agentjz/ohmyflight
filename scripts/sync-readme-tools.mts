import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tools } from "../src/tool/tools-data";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(projectRoot, "README.md");
const startMarker = "<!-- tools-table:start -->";
const endMarker = "<!-- tools-table:end -->";

function escapeTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function statusIcon(homepageState: string | undefined): string {
  if (homepageState === "beta") return "🧪";
  if (homepageState === "cooling") return "🧊";
  return "✅";
}

export function renderToolsTable(): string {
  const rows = tools.map((tool) =>
    `| ${escapeTableCell(tool.name)} | ${statusIcon(tool.homepageState)} | ${escapeTableCell(tool.desc)} |`
  );
  return [
    startMarker,
    "| 工具 | 状态 | 功能 |",
    "| --- | --- | --- |",
    ...rows,
    endMarker
  ].join("\n");
}

export function replaceToolsTable(readme: string): string {
  const start = readme.indexOf(startMarker);
  const end = readme.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("README.md 缺少工具表同步标记");
  }
  const endOffset = end + endMarker.length;
  return `${readme.slice(0, start)}${renderToolsTable()}${readme.slice(endOffset)}`;
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const current = await fs.readFile(readmePath, "utf8");
  const next = replaceToolsTable(current);

  if (current === next) {
    process.stdout.write("README 工具表已与 tools-data.ts 同步。\n");
    return;
  }

  if (checkOnly) {
    throw new Error("README 工具表未与 src/tool/tools-data.ts 同步，请运行 npm run sync:readme");
  }

  await fs.writeFile(readmePath, next, "utf8");
  process.stdout.write("已根据 src/tool/tools-data.ts 更新 README 工具表。\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
