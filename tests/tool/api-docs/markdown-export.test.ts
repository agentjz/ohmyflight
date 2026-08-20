import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveFromPublic } from "../../helpers/paths";

const appRoot = resolveFromPublic("tool", "app", "api-docs");

async function loadExporter(): Promise<{ buildApiDocsMarkdown: (modules: unknown[]) => string }> {
  return await import(pathToFileURL(`${appRoot}/markdown-export.mjs`).href) as {
    buildApiDocsMarkdown: (modules: unknown[]) => string;
  };
}

function loadCatalogs(): unknown[] {
  return ["flight-stats.json", "lock-entry.json", "personnel-info.json"].map((name) => (
    JSON.parse(readFileSync(`${appRoot}/catalog/${name}`, "utf8"))
  ));
}

describe("API docs Markdown export", () => {
  it("exports one human-readable document with complete machine facts", async () => {
    const { buildApiDocsMarkdown } = await loadExporter();
    const markdown = buildApiDocsMarkdown(loadCatalogs());

    expect(markdown).toContain("# watchdog API 文档");
    expect(markdown).toContain("## 认证与会话");
    expect(markdown).toContain("`JSESSIONID`");
    expect(markdown).toContain("https://ieb.csair.com/newieb/flytime/showFlytimeManyQueryList");
    expect(markdown).toContain("https://ieb.csair.com/newieb/nonproductionTask/showNonproductionTaskImportResultPage");
    expect(markdown).toContain("https://ieb.csair.com/newieb/hrInfo/showEmpInfo");
    expect(markdown).toContain("https://ieb.csair.com/newieb/basics/trainingRecordList");
    expect(markdown).toContain("`staffNum`");
    expect(markdown).toContain("`lockDaysNum`");
    expect(markdown).toContain("`/newieb/nonproductionTask/vaildStaffNum`");
    expect(markdown).toContain("`/newieb/nonproductionTask/importNonproductionTaskLockListToSoc`");
    expect(markdown).toContain("## 附录：机器可读原始目录");
    expect(markdown).toContain('"schemaVersion": 1');
    expect(markdown).toContain('"internalRequests"');
  });
});
