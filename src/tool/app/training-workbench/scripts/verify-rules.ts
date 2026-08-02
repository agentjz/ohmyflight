import { TrainingToolConfig as Config } from "./config";
import type { TrainingProjectRule } from "./models";
import { TrainingToolRuleEngine as RuleEngine } from "./rule-engine";
import { TrainingToolUtils as Utils } from "./utils";

function getRule(projectName: string): TrainingProjectRule {
  const rule = Config.PROJECT_RULES.find((item) => item.canonical === projectName);
  if (!rule) {
    throw new Error(`未找到规则：${projectName}`);
  }
  return rule;
}

function makeDate(text: string): Date {
  return Utils.parseDate(text)!;
}

function formatDate(value: Date | null): string {
  return Utils.formatDate(value);
}

function assertEqual(actual: unknown, expected: unknown, label: string, failures: string[]): void {
  if (actual !== expected) {
    failures.push(`${label}: 期望 ${expected}，实际 ${actual}`);
  }
}

function runComputeExpiryCases(failures: string[]): void {
  const cases = [
    { project: "应急训练", oldExpiry: "", trainingDate: "2000-01-01", expected: "2002-02-28" },
    { project: "应急训练", oldExpiry: "2002-02-28", trainingDate: "2001-12-01", expected: "2004-02-29" },
    { project: "应急训练", oldExpiry: "2002-02-28", trainingDate: "2001-11-30", expected: "2003-12-31" },
    { project: "危险品", oldExpiry: "", trainingDate: "2000-01-01", expected: "2002-01-01" },
    { project: "危险品", oldExpiry: "2027-06-15", trainingDate: "2027-03-15", expected: "2029-06-15" },
    { project: "危险品", oldExpiry: "2027-06-15", trainingDate: "2027-06-16", expected: "2029-06-16" },
    { project: "英语能力", oldExpiry: "2027-06-15", trainingDate: "2027-06-15", expected: "2030-06-15" },
    { project: "汉语能力", oldExpiry: "2027-06-15", trainingDate: "2027-05-20", expected: "2033-06-15" },
    { project: "航空安保", oldExpiry: "", trainingDate: "2000-01-01", expected: "2002-01-31" },
    { project: "航空安保", oldExpiry: "2002-01-31", trainingDate: "2002-02-01", expected: "2004-02-29" },
    { project: "TSA", oldExpiry: "", trainingDate: "2026-05-06", expected: "2027-05-31" },
    { project: "TSA", oldExpiry: "2026-05-31", trainingDate: "2026-05-06", expected: "2027-05-31" },
    { project: "疲劳管理", oldExpiry: "2002-01-31", trainingDate: "2001-08-05", expected: "2003-08-31" },
    { project: "飞行作风", oldExpiry: "2002-01-31", trainingDate: "2002-03-15", expected: "2004-03-31" }
  ];

  cases.forEach((item, index) => {
    const rule = getRule(item.project);
    const result = RuleEngine.computeExpiry(rule, makeDate(item.trainingDate), makeDate(item.oldExpiry));
    assertEqual(formatDate(result.newExpiry), item.expected, `computeExpiry#${index + 1} ${item.project}`, failures);
  });
}

function runUpdateJudgementCases(failures: string[]): void {
  const cases = [
    { project: "应急训练", oldExpiry: "", trainingDate: "2024-01-10", expected: "首次无旧值" },
    { project: "危险品", oldExpiry: "2027-06-15", trainingDate: "2027-03-15", expected: "命中窗口" },
    { project: "危险品", oldExpiry: "2027-06-15", trainingDate: "2027-03-14", expected: "提前窗口外" },
    { project: "危险品", oldExpiry: "2027-06-15", trainingDate: "2027-06-15", expected: "超期" },
    { project: "英语能力", oldExpiry: "2027-06-15", trainingDate: "2027-06-15", expected: "命中窗口" },
    { project: "航空安保", oldExpiry: "2026-04-30", trainingDate: "2026-01-15", expected: "最新日期重算" },
    { project: "航空安保", oldExpiry: "2026-04-30", trainingDate: "2026-05-01", expected: "超期" },
    { project: "TSA", oldExpiry: "2026-05-31", trainingDate: "2026-05-06", expected: "最新日期重算" },
    { project: "TSA", oldExpiry: "2026-05-31", trainingDate: "2026-06-01", expected: "超期" }
  ];

  cases.forEach((item, index) => {
    const rule = getRule(item.project);
    const actual = RuleEngine.classifyUpdateJudgement(rule, makeDate(item.trainingDate), makeDate(item.oldExpiry));
    assertEqual(actual, item.expected, `classifyUpdateJudgement#${index + 1} ${item.project}`, failures);
  });
}

function runUpdateOutcomeCases(failures: string[]): void {
  const today = makeDate("2026-04-01");
  const cases = [
    { oldExpiry: "", newExpiry: "2026-05-01", expected: "已更新" },
    { oldExpiry: "2026-04-30", newExpiry: "2026-04-30", expected: "不变" },
    { oldExpiry: "2026-04-30", newExpiry: "2026-01-31", expected: "更新无效" },
    { oldExpiry: "2026-12-31", newExpiry: "2026-06-30", expected: "有效期回退" },
    { oldExpiry: "2026-02-01", newExpiry: "2026-03-15", expected: "更新无效" }
  ];

  cases.forEach((item, index) => {
    const result = RuleEngine.evaluateUpdateResult(makeDate(item.oldExpiry), makeDate(item.newExpiry), today);
    assertEqual(result.result, item.expected, `evaluateUpdateResult#${index + 1}`, failures);
  });
}

function runScheduleCases(failures: string[]): void {
  const cases = [
    { project: "危险品", oldExpiry: "2027-06-15", stageStart: "2027-06-15", stageEnd: "2027-06-30", expected: "已过期" },
    { project: "危险品", oldExpiry: "2027-06-15", stageStart: "2027-03-15", stageEnd: "2027-03-31", expected: "命中窗口" },
    { project: "危险品", oldExpiry: "2027-06-15", stageStart: "2027-03-01", stageEnd: "2027-03-14", expected: "有效未到窗口" },
    { project: "英语能力", oldExpiry: "2027-06-15", stageStart: "2027-06-15", stageEnd: "2027-06-30", expected: "命中窗口" },
    { project: "航空安保", oldExpiry: "2026-04-30", stageStart: "2026-04-01", stageEnd: "2026-04-30", expected: "本阶段到期" },
    { project: "航空安保", oldExpiry: "2026-05-01", stageStart: "2026-05-02", stageEnd: "2026-05-31", expected: "已过期" },
    { project: "TSA", oldExpiry: "2026-05-31", stageStart: "2026-05-01", stageEnd: "2026-05-31", expected: "本阶段到期" }
  ];

  cases.forEach((item, index) => {
    const rule = getRule(item.project);
    const result = RuleEngine.classifyScheduleStageStatus(
      rule,
      makeDate(item.stageStart),
      makeDate(item.stageEnd),
      makeDate(item.oldExpiry)
    );
    assertEqual(result.status, item.expected, `classifyScheduleStageStatus#${index + 1} ${item.project}`, failures);
  });
}

function main(): void {
  const failures: string[] = [];
  runComputeExpiryCases(failures);
  runUpdateJudgementCases(failures);
  runUpdateOutcomeCases(failures);
  runScheduleCases(failures);

  if (failures.length) {
    console.error("规则校验失败：");
    failures.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
    return;
  }

  console.log("规则校验通过：computeExpiry 12 条，更新判断 7 条，更新结果 5 条，预排判断 6 条。");
}

main();
