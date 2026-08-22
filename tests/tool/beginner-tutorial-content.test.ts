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
  it("装配转机型主链和直接适用的资格恢复入口", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const copilotPath = findRecord(data, "copilot-type-transition-path");
    const a1 = findRecord(data, "fo-a1");
    const a2 = findRecord(data, "fo-a2");
    const captainPath = findRecord(data, "captain-type-transition-path");
    const captainFailure = findRecord(data, "recovery-practical-failure-captain");
    const annualCheck = findRecord(data, "recovery-annual-line-check");
    const english = findRecord(data, "qualification-english");

    const copilotExperience = sectionText(copilotPath, "5. A1监视运行经历与A2检查");
    expect(copilotExperience).toContain("25小时");
    expect(copilotExperience).toContain("PF不少于4个航段");
    expect(copilotExperience).toContain("PM不少于1个航段");
    expect(copilotExperience).toContain("至少4个起落");
    expect(copilotExperience).toContain("24分钟");
    expect(copilotExperience).toContain("PF、昼间、带指引ILS");
    expect(a2.action).toContain("作为PF，在昼间完成带指引ILS进近");

    const captainExperience = sectionText(captainPath, "5. 机长航线运行经历");
    expect(captainExperience).toContain("4次飞行、4个航段、4个起落");
    expect(captainExperience).toContain("夜航航段数");
    expect(sectionText(annualCheck, "未按期完成")).toContain("人工飞行检查");
    expect(english.lifecycle).toContain("1分项或3个及以上2分项");
    expect(english.lifecycle).toContain("存在2分项时不能通过国际航线英语通信检查");
    expect(english.lifecycle).toContain("存在3分项时不能通过通信检查员检查");

    expect(copilotPath.recoveryRecords?.map((record) => record.targetId)).toEqual([
      "recovery-120-100"
    ]);
    expect(a1.recoveryRecords?.map((record) => record.targetId)).toEqual([
      "recovery-recency",
      "recovery-overdue",
      "recovery-proficiency-failure-copilot",
      "recovery-120-100"
    ]);
    expect(sectionText(findRecord(data, "recovery-recency"), "触发条件")).toContain("18分钟");

    const finalBranch = sectionText(captainFailure, "两次补充训练仍不合格");
    expect(finalBranch).toContain("D类副驾驶");
    expect(finalBranch).toContain("3年内不得担任机长");
    expect(finalBranch).toContain("1000小时副驾驶经历");
  });

  it("装配专项能力恢复和PF/PM资质保持条件", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const capability = findRecord(data, "recovery-competency-defect");
    const qualification = findRecord(data, "qualification-cat1-ils-autoland");
    const lvo = findRecord(data, "qualification-lvo");
    const rnp = findRecord(data, "qualification-rnp-apch");
    const b2 = findRecord(data, "type-b2");
    const b3 = findRecord(data, "type-b3");

    expect(capability.lifecycle).toContain("知识应用缺陷");
    expect(capability.lifecycle).toContain("宽体机不少于2个航段");
    expect(qualification.lifecycle).toContain("PF和PM");
    expect(qualification.lifecycle).toContain("一次着陆、一次复飞");
    expect(lvo.action).toContain("2小时PF和2小时PM");
    expect(rnp.lifecycle).toContain("PF和PM");
    expect(b2.action).toContain("100小时");
    expect(b2.action).toContain("EBT");
    expect(b3.action).toContain("200小时");
    expect(b3.action).toContain("2次改装训练");
  });

  it("保留二次语义审计确认的专项训练和检查边界", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const rvsm = findRecord(data, "qualification-rvsm");
    const uprt = findRecord(data, "qualification-uprt");
    const flightStyle = findRecord(data, "qualification-flight-style");
    const ebt = findRecord(data, "qualification-ebt");
    const deicing = findRecord(data, "qualification-deicing");
    const visualApproach = findRecord(data, "qualification-visual-approach");
    const cat1 = findRecord(data, "qualification-cat1-ils-autoland");
    const lvo = findRecord(data, "qualification-lvo");
    const captainB = findRecord(data, "captain-b");
    const captainPath = findRecord(data, "captain-type-transition-path");
    const requiredSpecialCheck = findRecord(data, "recovery-required-qualification-special-check");

    expect(rvsm.action).toContain("不少于8小时");
    expect(rvsm.action).toContain("80分");
    expect(rvsm.lifecycle).toContain("理论复训每12个月");
    expect(rvsm.lifecycle).toContain("模拟机复训也每12个月");

    expect(uprt.action).toContain("理论训练后60天内");
    expect(uprt.lifecycle).toContain("每2年内完成全部科目");
    expect(uprt.lifecycle).toContain("不应在熟练检查、航线检查");

    expect(flightStyle.action).toContain("副驾驶8小时");
    expect(flightStyle.action).toContain("任一维度得分为71至89分");
    expect(flightStyle.lifecycle).toContain("补考仍不合格时暂停运行资格");
    expect(ebt.action).toContain("每半年完成3课共12小时");
    expect(ebt.lifecycle).toContain("3个月内完成补训");
    expect(deicing.action).toContain("8课时初训");
    expect(deicing.lifecycle).toContain("预计进入地面结冰条件运行前");

    expect(visualApproach.action).toContain("PF和PM");
    expect(visualApproach.action).toContain("一次着陆、一次复飞");
    expect(visualApproach.lifecycle).toContain("连续12个月未在该机场");
    expect(visualApproach.lifecycle).toContain("按初次获取资格");
    expect(cat1.action).toContain("不少于2小时");
    expect(cat1.action).toContain("补考仍不合格时终止本次训练");

    expect(lvo.action).toContain("机长至少具有300小时机长经历");
    expect(lvo.action).toContain("副驾驶至少具有300小时本型别副驾驶经历");
    expect(lvo.action).toContain("II类签注不是取得III类签注的前置条件");
    expect(lvo.action).toContain("4小时低能见运行理论");
    expect(lvo.lifecycle).toContain("超过12个月时，按初始资格重新训练和检查");

    expect(captainB.lifecycle).toContain("1次着陆替代1小时");
    expect(captainB.lifecycle).toContain("至少仍须完成50小时");
    const lineCheck = sectionText(captainPath, "6. 航线技术检查");
    expect(lineCheck).toContain("三类中的两类");
    expect(lineCheck).toContain("考试员必须上座");
    expect(lineCheck).toContain("两次检查之间不得安排其他飞行任务");
    expect(lineCheck).toContain("由原考试员实施");

    expect(requiredSpecialCheck.status).toBe("partial");
    expect(requiredSpecialCheck.action).toContain("形成书面材料");
    expect(requiredSpecialCheck.lifecycle).toContain("不得借用");
  });

  it("保持机长检查范围、航线间断恢复和资深副驾驶核心边界", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const captainB = findRecord(data, "captain-b");
    const interruption = findRecord(data, "recovery-line-flying-interruption");
    const specialModule = data.modules.find((module) => module.id === "special-categories");

    expect(captainB.action).toContain("同一级全部航段由同一考试员完成");
    expect(interruption.action).toContain("间断航线飞行超过6个月");
    expect(interruption.action).toContain("至少2个航段");
    expect(interruption.lifecycle).toContain("航线检查合格后恢复相应运行资格");
    expect(specialModule?.body).toContain("资深副驾驶通道");
    expect(specialModule?.body).toContain("只在右座履行副驾驶职责");
    expect(specialModule?.body).toContain("按照D类副驾驶技术等级参与运行及搭组");
  });

  it("只用单向恢复入口引用权威规则", async () => {
    const data = await loadBeginnerTutorialData(contentRoot);
    const records = data.modules.flatMap((module) => module.records || []);
    const captainB = findRecord(data, "captain-b");
    const captainFailure = findRecord(data, "recovery-proficiency-failure-captain");

    expect(JSON.stringify(data)).not.toContain('"embeddedRecords"');
    expect(records).toHaveLength(74);
    expect(captainB.recoveryRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetId: "recovery-proficiency-failure-captain",
        summary: expect.stringContaining("当日立即失去资格")
      })
    ]));
    expect(sectionText(captainFailure, "立即后果")).toContain("不得依据本次机长熟练检查结论签注PC-CP");
    expect(sectionText(captainFailure, "先恢复副驾驶检查签注")).toContain("补充6小时副驾驶训练，训练中包含检查");
    expect(sectionText(captainFailure, "先恢复副驾驶检查签注")).toContain("副驾驶检查合格后方可签注PC-CP");
  });

  it("拒绝无法解析的记录引用", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "watchdog-tutorial-test-"));
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
        recoveryRecordIds: ["missing-record"]
      }]
    }));

    await expect(loadBeginnerTutorialData(root)).rejects.toThrow("missing-record");
  });

  it("拒绝把普通内容伪装成恢复规则", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "watchdog-tutorial-test-"));
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
      records: [
        {
          id: "source",
          title: "Source",
          status: "confirmed",
          category: "Test",
          audience: "Test",
          summary: "Test",
          action: "Test",
          lifecycle: "Test",
          recoveryRecordIds: ["ordinary-target"]
        },
        {
          id: "ordinary-target",
          title: "Ordinary target",
          status: "confirmed",
          category: "Test",
          audience: "Test",
          summary: "Test",
          action: "Test",
          lifecycle: "Test"
        }
      ]
    }));

    await expect(loadBeginnerTutorialData(root)).rejects.toThrow("恢复链接必须指向恢复模块");
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
