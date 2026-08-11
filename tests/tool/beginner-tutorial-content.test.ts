import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadBeginnerTutorialData } from "../../scripts/beginner-tutorial-content.mjs";
import type { TutorialRecord } from "../../src/tool/app/beginner-tutorial/types";
import { resolveFromRoot } from "../helpers/paths";

const temporaryRoots: string[] = [];
const contentRoot = resolveFromRoot("src", "tool", "app", "beginner-tutorial", "content");

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("菜鸟教程知识装配", () => {
  it("装配转机型主链和可复用的资格恢复分支", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const copilotPath = findRecord(data, "copilot-type-transition-path");
    const a1 = findRecord(data, "fo-a1");
    const captainFailure = findRecord(data, "recovery-practical-failure-captain");

    const copilotExperience = sectionText(copilotPath, "5. A1监视运行经历与A2检查");
    expect(copilotExperience).toContain("25小时");
    expect(copilotExperience).toContain("PF不少于4个航段");
    expect(copilotExperience).toContain("PM不少于1个航段");
    expect(copilotExperience).toContain("至少4个起落");
    expect(copilotExperience).toContain("24分钟");

    expect(a1.embeddedRecords?.map((record) => record.id)).toEqual([
      "recovery-recency",
      "recovery-overdue",
      "recovery-proficiency-failure-copilot",
      "recovery-120-100"
    ]);
    expect(sectionText(a1.embeddedRecords?.[0], "触发条件")).toContain("18分钟");

    const finalBranch = sectionText(captainFailure, "两次补充训练仍不合格");
    expect(finalBranch).toContain("D类副驾驶");
    expect(finalBranch).toContain("3年内不得担任机长");
    expect(finalBranch).toContain("1000小时副驾驶经历");
  });

  it("拒绝无法解析的记录引用", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ohmyflight-tutorial-test-"));
    temporaryRoots.push(root);
    await fs.mkdir(path.join(root, "modules"));
    await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify({
      schemaVersion: 1,
      title: "Test",
      description: "Test",
      sourceFile: "sources.json",
      moduleFiles: ["modules/example.json"]
    }));
    await fs.writeFile(path.join(root, "sources.json"), "[]");
    await fs.writeFile(path.join(root, "modules", "example.json"), JSON.stringify({
      id: "example",
      title: "Example",
      kind: "records",
      summary: "Example",
      records: [{
        id: "record",
        title: "Record",
        status: "confirmed",
        category: "Test",
        audience: "Test",
        summary: "Test",
        action: "Test",
        lifecycle: "Test",
        reuseRecordIds: ["missing-record"]
      }]
    }));

    await expect(loadBeginnerTutorialData(root)).rejects.toThrow("missing-record");
  });
});

function findRecord(
  data: Awaited<ReturnType<typeof loadBeginnerTutorialData>>,
  recordId: string
): TutorialRecord {
  const record = data.modules.flatMap((module) => module.records || []).find((item) => item.id === recordId);
  if (!record) throw new Error(`Missing tutorial record: ${recordId}`);
  return record;
}

function sectionText(record: Pick<TutorialRecord, "sections"> | undefined, title: string): string {
  return record?.sections?.find((section) => section.title === title)?.items.join("；") || "";
}
