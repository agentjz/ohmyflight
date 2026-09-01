import { describe, expect, it } from "vitest";

import { loadBeginnerTutorialData } from "../../scripts/beginner-tutorial-content.mjs";
import {
  beginnerTutorialRecordAnchor,
  buildBeginnerTutorialMarkdown
} from "../../src/tool/app/beginner-tutorial/markdown-export";
import { resolveFromRoot } from "../helpers/paths";

const contentRoot = resolveFromRoot("src", "tool", "app", "beginner-tutorial", "content");

describe("菜鸟教程 Markdown 导出", () => {
  it("把同源教程完整导出为连续正文和原始JSON附录", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const markdown = buildBeginnerTutorialMarkdown(data);

    expect(markdown).toContain("documentType: watchdog-beginner-tutorial");
    expect(markdown).toContain(`# ${data.title}`);
    expect(markdown).toContain("## 来源索引");
    expect(markdown).toContain("## 附录：机器可读原始教程");
    expect(markdown).toContain("航段、飞行次数、起落、PF/PM、昼间/夜间");

    for (const source of data.sourceScope) {
      expect(markdown).toContain(`\`${source.id}\``);
      expect(markdown).toContain(`${source.manual}》${source.version}`);
    }

    for (const module of data.modules) {
      expect(markdown).toContain(`模块 ID：\`${module.id}\``);
      expect(markdown).toContain(module.title);
      if (module.progression) expect(markdown).toContain(`成长路径：${module.progression}`);
      if (module.body) expect(markdown).toContain(module.body.trim());
      for (const step of module.steps || []) {
        expect(markdown).toContain(`步骤 ID：\`${step.id}\``);
        expect(markdown).toContain(step.title);
      }
      for (const record of module.records || []) {
        expect(markdown).toContain(`记录 ID：\`${record.id}\``);
        expect(markdown).toContain(record.action);
        expect(markdown).toContain(record.lifecycle);
        const anchor = beginnerTutorialRecordAnchor(module.id, record.id);
        expect(markdown.match(new RegExp(`<a id="${anchor}"></a>`, "g"))).toHaveLength(1);
        for (const recoveryRule of record.recoveryRecords || []) {
          expect(markdown).toContain(`](#${beginnerTutorialRecordAnchor(recoveryRule.moduleId, recoveryRule.targetId)})`);
        }
      }
    }

    expect(markdown).toContain("同一条恢复规则只在其权威模块出现一次");
    expect(markdown).toContain("````json");
    expect(markdown).toContain(JSON.stringify(data, null, 2));
    expect(markdown.endsWith("\n")).toBe(true);
  });

});
