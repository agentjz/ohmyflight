import { describe, expect, it } from "vitest";

import { TrainingToolConfig as Config } from "../../../src/tool/app/training-workbench/scripts/config";
import { TrainingToolRuleEngine as RuleEngine } from "../../../src/tool/app/training-workbench/scripts/rule-engine";
import { TrainingToolUtils as Utils } from "../../../src/tool/app/training-workbench/scripts/utils";
import {
  TRAINING_RENEWAL_CASES,
  TRAINING_RULE_DEFINITIONS,
  TRAINING_SCHEDULE_CASES,
  type RenewalSpecJudgement,
  type ScheduleSpecStatus,
  type TrainingRuleDefinition
} from "./rule-spec-cases";

function normalizeRuleType(value: string): TrainingRuleDefinition["ruleType"] {
  if (value === "基准月") return "基准月";
  if (value === "3个月窗口") return "3个月窗口";
  if (value === "3个月窗口（截止到前一日）") return "3个月窗口（前一日截止）";
  return "最新日期";
}

function normalizeValidityUnit(value: string): TrainingRuleDefinition["validityUnit"] {
  return value.includes("年") ? "年" : "日历月";
}

function normalizeJudgement(actual: string, ruleType: TrainingRuleDefinition["ruleType"], hasOldExpiry: boolean): RenewalSpecJudgement {
  if (!hasOldExpiry) return "首次/无旧值";
  if (ruleType === "最新日期") {
    return actual === "超期" ? "超期" : "无窗口";
  }
  if (actual === "命中窗口") return "命中窗口";
  if (actual === "超期") return "超期";
  return "提前/窗口外";
}

function normalizeScheduleStatus(actual: string): ScheduleSpecStatus {
  if (actual === "命中窗口") return "命中窗口";
  if (actual === "本阶段到期") return "本阶段到期";
  if (actual === "已过期") return "已过期";
  if (actual === "有效未到窗口") return "有效未到窗口";
  return "阶段外未到期";
}

describe("training-workbench rule spec", () => {
  it("matches the published training rule matrix, aliases, renewal examples, and schedule examples", () => {
    const ruleMap = new Map<string, any>(Config.PROJECT_RULES.map((rule: any) => [rule.canonical, rule]));

    TRAINING_RULE_DEFINITIONS.forEach((definition) => {
      const rule = ruleMap.get(definition.project);
      expect(rule, `${definition.project} should exist`).toBeTruthy();
      expect(normalizeRuleType(rule.ruleType)).toBe(definition.ruleType);
      expect(rule.validityValue).toBe(definition.validityValue);
      expect(normalizeValidityUnit(rule.validityUnit)).toBe(definition.validityUnit);
      expect(rule.baseMonthFlex).toBe(definition.baseMonthFlex);
      expect(rule.rounding).toBe(definition.rounding);

      definition.aliases.forEach((alias) => {
        expect(Utils.normalizeProjectName(alias)).toBe(definition.project);
      });
    });

    TRAINING_RENEWAL_CASES.forEach((testCase) => {
      const rule = ruleMap.get(testCase.project);
      const oldExpiry = Utils.parseDate(testCase.oldExpiry);
      const trainingDate = Utils.parseDate(testCase.trainingDate);
      const computed = RuleEngine.computeExpiry(rule, trainingDate!, oldExpiry);
      const judgement = RuleEngine.classifyUpdateJudgement(rule, trainingDate!, oldExpiry);
      const windowInfo = RuleEngine.getWindowInfo(rule, oldExpiry);

      expect(
        Utils.formatDate(computed.newExpiry),
        `${testCase.project} / ${testCase.scenario} expiry`
      ).toBe(testCase.expectedNewExpiry);
      expect(
        normalizeJudgement(judgement, normalizeRuleType(rule.ruleType), Boolean(oldExpiry)),
        `${testCase.project} / ${testCase.scenario} judgement`
      ).toBe(testCase.expectedJudgement);

      if (testCase.expectedWindowStart && testCase.expectedWindowEnd) {
        expect(windowInfo.hasWindow, `${testCase.project} / ${testCase.scenario} window exists`).toBe(true);
        expect(Utils.formatDate(windowInfo.windowStart)).toBe(testCase.expectedWindowStart);
        expect(Utils.formatDate(windowInfo.windowEnd)).toBe(testCase.expectedWindowEnd);
      } else {
        expect(windowInfo.hasWindow, `${testCase.project} / ${testCase.scenario} has no window`).toBe(false);
      }
    });

    TRAINING_SCHEDULE_CASES.forEach((testCase) => {
      const rule = ruleMap.get(testCase.project);
      const result = RuleEngine.classifyScheduleStageStatus(
        rule,
        Utils.parseDate(testCase.stageStart)!,
        Utils.parseDate(testCase.stageEnd)!,
        Utils.parseDate(testCase.oldExpiry)
      );

      expect(
        normalizeScheduleStatus(result.status),
        `${testCase.project} / ${testCase.scenario} schedule`
      ).toBe(testCase.expectedStatus);
    });
  });
});
