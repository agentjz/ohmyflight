import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { assertJavaScriptSyntax } from "../../helpers/syntax";
import { resolveFromPublic, resolveFromRoot } from "../../helpers/paths";

const root = resolveFromPublic("tool", "app", "api-docs");

describe("API docs delivery", () => {
  it("exposes API docs from the top navigation instead of the tool catalog", () => {
    const toolIndex = readFileSync(resolveFromPublic("tool", "index.html"), "utf8");
    const toolCatalog = readFileSync(resolveFromRoot("src", "tool", "tools-data.ts"), "utf8");
    expect(toolIndex).toContain('href="./app/api-docs/index.html"');
    expect(toolIndex).toContain('title="API 文档"');
    expect(toolCatalog).not.toContain('entry: "api-docs"');
  });

  it("presents one cookie manager and exactly two friendly API entries", () => {
    const html = readFileSync(`${root}/index.html`, "utf8");
    expect(html).toContain("Cookie 管理");
    expect(html).toContain('id="credentialInput"');
    expect(html).toContain('id="sendRequestButton"');
    expect(html).toContain('id="exportMarkdownButton"');
    expect(html).toContain('data-response-view="table"');
    expect(html).toContain('data-response-view="json"');
    expect(html).toContain('data-response-view="raw"');
    expect(html).toContain('data-response-view="headers"');
    expect(html).toContain('id="credentialStatus"');
    expect(html).toContain('id="savedCredentialPanel"');
    expect(html).toContain('id="savedCredentialText"');
    expect(html).toContain('id="copyCredentialButton"');
    expect(html).not.toContain("仅查看");
  });

  it("keeps two business catalogs and complete internal lock facts", () => {
    const index = JSON.parse(readFileSync(`${root}/catalog/index.json`, "utf8"));
    expect(index.modules.map((module: { name: string }) => module.name)).toEqual([
      "飞行经历查询接口",
      "飞行人员锁班接口"
    ]);
    const lockCatalog = JSON.parse(readFileSync(`${root}/catalog/lock-entry.json`, "utf8"));
    expect(lockCatalog.endpoints).toHaveLength(1);
    expect(JSON.stringify(lockCatalog)).toContain("showNonproductionTaskImportPage");
    expect(JSON.stringify(lockCatalog)).toContain("importNonproductionTaskLockListToSoc");
    expect(JSON.stringify(lockCatalog)).not.toContain("getLoginEmpProfileValidForOperationResource");
  });

  it("keeps browser responsibilities in syntax-valid ESM modules", () => {
    const modules = readdirSync(root).filter((name) => name.endsWith(".mjs"));
    expect(modules.length).toBeGreaterThanOrEqual(3);
    modules.forEach((name) => assertJavaScriptSyntax(`${root}/${name}`));
    const app = readFileSync(`${root}/app.mjs`, "utf8");
    expect(app).toContain("setInterval(refreshSessionStatus, 3000)");
    expect(app).toContain("飞行门户 Cookie 已验证");
    expect(app).toContain('fetchJson("/api/session", { method: "DELETE" })');
    expect(app).not.toContain("localStorage");
  });

  it("renders every internal request as an always-visible semantic operation", () => {
    const catalogView = readFileSync(`${root}/catalog-view.mjs`, "utf8");
    expect(catalogView).toContain('<article class="internal-request"');
    expect(catalogView).toContain('data-internal-request-id=');
    expect(catalogView).toContain("请求参数");
    expect(catalogView).toContain("用途");
    expect(catalogView).toContain("响应契约");
    expect(catalogView).toContain("机器可读 JSON");
    expect(catalogView).toContain("module.catalogSource");
    expect(catalogView).not.toContain('<details class="internal-request"');
    expect(catalogView).not.toContain("<summary>");
  });
});
