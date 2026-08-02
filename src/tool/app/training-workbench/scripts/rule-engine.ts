import { TrainingToolUtils } from "./utils";
import type {
  TrainingComputedExpiry,
  TrainingPlanCoverage,
  TrainingProjectRule,
  TrainingScheduleClassification,
  TrainingScheduleUrgency,
  TrainingUpdateOutcome,
  TrainingWindowInfo
} from "./models";

const Utils = TrainingToolUtils;

  type WindowPolicy = {
    unit: "month" | "day";
    amount: number;
    endOffsetDays: number;
    tag: string;
    detailLabel: string;
  };

  function monthEnd(year: number, month: number): Date {
    return Utils.makeDate(year, month, new Date(year, month, 0).getDate());
  }

  function firstDayOfMonth(value: Date): Date {
    return Utils.makeDate(value.getFullYear(), value.getMonth() + 1, 1);
  }

  function addMonths(value: Date, months: number): Date {
    const totalMonth = value.getMonth() + months;
    const year = value.getFullYear() + Math.floor(totalMonth / 12);
    const month = ((totalMonth % 12) + 12) % 12 + 1;
    const day = Math.min(value.getDate(), new Date(year, month, 0).getDate());
    return Utils.makeDate(year, month, day);
  }

  function addYears(value: Date, years: number): Date {
    const year = value.getFullYear() + years;
    const month = value.getMonth() + 1;
    const day = Math.min(value.getDate(), new Date(year, month, 0).getDate());
    return Utils.makeDate(year, month, day);
  }

  function addValidity(dateValue: Date, rule: TrainingProjectRule): Date {
    const usesYears = Utils.normalizeText(rule.validityUnit).includes("年");
    const base = usesYears
      ? addYears(dateValue, rule.validityValue)
      : addMonths(dateValue, rule.validityValue);

    return Utils.normalizeText(rule.rounding) === "月底"
      ? monthEnd(base.getFullYear(), base.getMonth() + 1)
      : base;
  }

  function calculateBaseMonthExpiry(trainingDate: Date, validityMonths: number): Date {
    const anchor = firstDayOfMonth(trainingDate);
    const expiryMonth = addMonths(anchor, validityMonths + 1);
    return monthEnd(expiryMonth.getFullYear(), expiryMonth.getMonth() + 1);
  }

  function inferBaseMonthWindow(oldExpiry: Date, flexMonths: number): { windowStart: Date; windowEnd: Date; baseMonth: Date } {
    const baseMonth = firstDayOfMonth(addMonths(oldExpiry, -1));
    const windowStart = firstDayOfMonth(addMonths(baseMonth, -flexMonths));
    const windowEndMonth = addMonths(baseMonth, flexMonths);
    const windowEnd = monthEnd(windowEndMonth.getFullYear(), windowEndMonth.getMonth() + 1);
    return { windowStart, windowEnd, baseMonth };
  }

  function shiftDays(value: Date, days: number): Date {
    const shifted = Utils.cloneDate(value)!;
    shifted.setDate(shifted.getDate() + days);
    return shifted;
  }

  function isThreeMonthWindowRule(rule: TrainingProjectRule): boolean {
    const ruleType = Utils.normalizeText(rule.ruleType);
    return ruleType === "3个月窗口（截止到前一日）" || ruleType === "3个月窗口";
  }

  function resolveWindowPolicy(rule: TrainingProjectRule): WindowPolicy | null {
    const ruleType = Utils.normalizeText(rule.ruleType);

    if (ruleType === "3个月窗口（截止到前一日）") {
      return {
        unit: "month",
        amount: 3,
        endOffsetDays: -1,
        tag: "3个月窗口（截止到前一日）",
        detailLabel: "3个月窗口"
      };
    }

    if (ruleType === "3个月窗口") {
      return {
        unit: "month",
        amount: 3,
        endOffsetDays: 0,
        tag: "3个月窗口",
        detailLabel: "3个月窗口"
      };
    }

    return null;
  }

  function buildWindowRange(oldExpiry: Date, windowPolicy: WindowPolicy): { windowStart: Date; windowEnd: Date } {
    const windowStart = windowPolicy.unit === "month"
      ? addMonths(oldExpiry, -windowPolicy.amount)
      : shiftDays(oldExpiry, -windowPolicy.amount);
    const windowEnd = shiftDays(oldExpiry, windowPolicy.endOffsetDays);
    return { windowStart, windowEnd };
  }

  function resolveDueDate(oldExpiry: Date, windowInfo: TrainingWindowInfo): Date {
    if (windowInfo && windowInfo.hasWindow && windowInfo.windowEnd) {
      return windowInfo.windowEnd;
    }
    return oldExpiry;
  }

  function getWindowInfo(rule: TrainingProjectRule, oldExpiry: Date | null): TrainingWindowInfo {
    const ruleType = Utils.normalizeText(rule.ruleType);
    if (!oldExpiry) {
      return {
        hasWindow: false,
        windowStart: null,
        windowEnd: null,
        tag: "",
        detail: "无旧有效期，无法推导窗口。"
      };
    }

    if (ruleType === "基准月") {
      const { windowStart, windowEnd, baseMonth } = inferBaseMonthWindow(oldExpiry, rule.baseMonthFlex);
      return {
        hasWindow: true,
        windowStart,
        windowEnd,
        tag: "基准月窗口",
        detail: `当前基准月为 ${baseMonth.getMonth() + 1} 月，窗口为 ${Utils.formatDate(windowStart)} 至 ${Utils.formatDate(windowEnd)}。`
      };
    }

    const windowPolicy = resolveWindowPolicy(rule);
    if (windowPolicy) {
      const { windowStart, windowEnd } = buildWindowRange(oldExpiry, windowPolicy);
      return {
        hasWindow: true,
        windowStart,
        windowEnd,
        tag: windowPolicy.tag,
        detail: `旧有效期为 ${Utils.formatDate(oldExpiry)}，${windowPolicy.detailLabel}为 ${Utils.formatDate(windowStart)} 至 ${Utils.formatDate(windowEnd)}。`
      };
    }

    return {
      hasWindow: false,
      windowStart: null,
      windowEnd: null,
      tag: "无窗口",
      detail: "该项目无窗口期，按最新培训开始日期直接重算。"
    };
  }

  function computeExpiry(rule: TrainingProjectRule, trainingDate: Date, oldExpiry: Date | null): TrainingComputedExpiry {
    const ruleType = Utils.normalizeText(rule.ruleType);

    if (ruleType === "最新日期") {
      const newExpiry = addValidity(trainingDate, rule);
      return {
        newExpiry,
        reason: `无窗口期，按本次培训开始日期重算到 ${Utils.formatDate(newExpiry)}。`
      };
    }

    const windowPolicy = resolveWindowPolicy(rule);
    if (windowPolicy) {
      if (oldExpiry) {
        const windowInfo = getWindowInfo(rule, oldExpiry) as Extract<TrainingWindowInfo, { hasWindow: true }>;
        if (trainingDate >= windowInfo.windowStart && trainingDate <= windowInfo.windowEnd) {
          const newExpiry = addValidity(oldExpiry, rule);
          return {
            newExpiry,
            reason: `命中${windowInfo.tag}，沿用旧到期锚点顺延到 ${Utils.formatDate(newExpiry)}。`
          };
        }
      }

      const newExpiry = addValidity(trainingDate, rule);
      return {
        newExpiry,
        reason: `未命中${windowPolicy.detailLabel}，按本次培训开始日期重算到 ${Utils.formatDate(newExpiry)}。`
      };
    }

    if (ruleType === "基准月") {
      if (oldExpiry) {
        const windowInfo = getWindowInfo(rule, oldExpiry) as Extract<TrainingWindowInfo, { hasWindow: true }>;
        if (trainingDate >= windowInfo.windowStart && trainingDate <= windowInfo.windowEnd) {
          const newExpiry = addValidity(oldExpiry, rule);
          return {
            newExpiry,
            reason: `命中基准月窗口，保留原基准月并顺延到 ${Utils.formatDate(newExpiry)}。`
          };
        }
      }

      const newExpiry = calculateBaseMonthExpiry(trainingDate, rule.validityValue);
      return {
        newExpiry,
        reason: `未命中基准月窗口，基准月改为 ${trainingDate.getMonth() + 1} 月，新有效期为 ${Utils.formatDate(newExpiry)}。`
      };
    }

    throw new Error(`不支持的规则类型：${ruleType}`);
  }

  function sameDay(left: Date | null, right: Date | null): boolean {
    if (!left || !right) return false;
    return Utils.formatDate(left) === Utils.formatDate(right);
  }

  function isEarlierDay(left: Date | null, right: Date | null): boolean {
    if (!left || !right) return false;
    return left.getTime() < right.getTime() && !sameDay(left, right);
  }

  function createTodayDate(): Date {
    const now = new Date();
    return Utils.makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function classifyUpdateJudgement(rule: TrainingProjectRule, trainingDate: Date, oldExpiry: Date | null): string {
    if (!oldExpiry) return "首次无旧值";

    const ruleType = Utils.normalizeText(rule.ruleType);
    if (ruleType === "最新日期") {
      return trainingDate > oldExpiry ? "超期" : "最新日期重算";
    }

    const windowInfo = getWindowInfo(rule, oldExpiry);
    if (windowInfo.hasWindow && trainingDate >= windowInfo.windowStart && trainingDate <= windowInfo.windowEnd) {
      return "命中窗口";
    }
    if (windowInfo.hasWindow && trainingDate > windowInfo.windowEnd) {
      return "超期";
    }
    return "提前窗口外";
  }

  function evaluateUpdateResult(oldExpiry: Date | null, newExpiry: Date | null, currentDate?: Date | null): TrainingUpdateOutcome {
    const today = currentDate || createTodayDate();

    if (newExpiry && isEarlierDay(newExpiry, today)) {
      if (oldExpiry && isEarlierDay(newExpiry, oldExpiry)) {
        return {
          result: "更新无效",
          shouldWrite: false,
          reason: "新有效期早于当前日期，且比当前有效期更早，本次不回写。"
        };
      }
      return {
        result: "更新无效",
        shouldWrite: false,
        reason: "新有效期早于当前日期，本次不回写。"
      };
    }

    if (oldExpiry && isEarlierDay(newExpiry, oldExpiry)) {
      return {
        result: "有效期回退",
        shouldWrite: false,
        reason: "新有效期早于当前有效期，本次不回写。"
      };
    }

    if (oldExpiry && sameDay(oldExpiry, newExpiry)) {
      return {
        result: "不变",
        shouldWrite: false,
        reason: "新旧有效期一致，无需回写。"
      };
    }

    return {
      result: "已更新",
      shouldWrite: true,
      reason: oldExpiry
        ? "新有效期晚于当前有效期，允许回写。"
        : "首次生成有效期，允许回写。"
    };
  }

  function evaluatePlanCoverage(rule: TrainingProjectRule, trainingDate: Date | null, oldExpiry: Date | null): TrainingPlanCoverage {
    if (!oldExpiry) {
      return {
        covered: false,
        dueDate: null,
        newExpiry: null,
        windowInfo: getWindowInfo(rule, oldExpiry),
        reason: "无旧有效期，无法判断本轮到期是否已被覆盖。"
      };
    }

    const windowInfo = getWindowInfo(rule, oldExpiry);
    const dueDate = resolveDueDate(oldExpiry, windowInfo);

    if (!trainingDate) {
      return {
        covered: false,
        dueDate,
        newExpiry: null,
        windowInfo,
        reason: "培训日期无法解析，不能判断是否已覆盖本轮到期。"
      };
    }

    if (dueDate && trainingDate > dueDate) {
      return {
        covered: false,
        dueDate,
        newExpiry: null,
        windowInfo,
        reason: `培训日期 ${Utils.formatDate(trainingDate)} 晚于本轮最晚完成日期 ${Utils.formatDate(dueDate)}，不能覆盖本轮到期。`
      };
    }

    const computed = computeExpiry(rule, trainingDate, oldExpiry);
    if (!computed.newExpiry || sameDay(computed.newExpiry, oldExpiry) || isEarlierDay(computed.newExpiry, oldExpiry)) {
      return {
        covered: false,
        dueDate,
        newExpiry: computed.newExpiry,
        windowInfo,
        reason: `按规则计算的新有效期 ${Utils.formatDate(computed.newExpiry)} 未晚于当前有效期 ${Utils.formatDate(oldExpiry)}，不能覆盖本轮到期。`
      };
    }

    return {
      covered: true,
      dueDate,
      newExpiry: computed.newExpiry,
      windowInfo,
      reason: `培训日期 ${Utils.formatDate(trainingDate)} 可覆盖本轮到期。${computed.reason}`
    };
  }

  function describeIgnored(cutoffDate: Date, oldExpiry: Date, windowInfo: TrainingWindowInfo): string {
    const dueDate = resolveDueDate(oldExpiry, windowInfo);
    if (!windowInfo.hasWindow) {
      return "项目无窗口期，且有效期截止日期未晚于旧有效期，默认忽略。";
    }
    if (cutoffDate < windowInfo.windowStart) {
      return `仍有效，且距离窗口开始还有 ${Utils.daysBetween(windowInfo.windowStart, cutoffDate)} 天。`;
    }
    if (cutoffDate > dueDate) {
      return "有效期截止日期已晚于本轮必须完成日期。";
    }
    return "仍有效，当前日期不属于窗口期。";
  }

  function classifyScheduleStatus(rule: TrainingProjectRule, cutoffDate: Date, oldExpiry: Date | null): TrainingScheduleClassification {
    if (!oldExpiry) {
      return {
        status: "缺少旧有效期",
        include: false,
        windowInfo: getWindowInfo(rule, oldExpiry),
        reason: "这一行没有可解析的旧有效期，暂时无法判断是否需要预排班。"
      };
    }

    const windowInfo = getWindowInfo(rule, oldExpiry);
    const dueDate = resolveDueDate(oldExpiry, windowInfo);
    if (cutoffDate > dueDate) {
      return {
        status: "已过期",
        include: true,
        windowInfo,
        reason: `有效期截止日期已晚于本轮必须完成日期。${windowInfo.detail}`
      };
    }

    if (windowInfo.hasWindow && cutoffDate >= windowInfo.windowStart && cutoffDate <= windowInfo.windowEnd) {
      return {
        status: "命中窗口",
        include: true,
        windowInfo,
        reason: `有效期截止日期落在${windowInfo.tag}内。${windowInfo.detail}`
      };
    }

    return {
      status: "有效未到窗口",
      include: false,
      windowInfo,
      reason: describeIgnored(cutoffDate, oldExpiry, windowInfo)
    };
  }

  function describeStageOutsideWindow(stageStart: Date, stageEnd: Date, oldExpiry: Date, windowInfo: TrainingWindowInfo): string {
    if (!windowInfo.hasWindow) {
      return `项目无窗口期，当前有效期为 ${Utils.formatDate(oldExpiry)}，未落在预排区间 ${Utils.formatDate(stageStart)} 至 ${Utils.formatDate(stageEnd)} 内。`;
    }
    if (stageEnd < windowInfo.windowStart) {
      return `到预排区间结束时仍未进入${windowInfo.tag}，窗口开始于 ${Utils.formatDate(windowInfo.windowStart)}。`;
    }
    return `预排区间未命中${windowInfo.tag}，窗口为 ${Utils.formatDate(windowInfo.windowStart)} 至 ${Utils.formatDate(windowInfo.windowEnd)}。`;
  }

  function classifyScheduleUrgency(rule: TrainingProjectRule, stageStart: Date, stageEnd: Date, oldExpiry: Date | null, status: string): TrainingScheduleUrgency {
    if (!oldExpiry) {
      return {
        label: "",
        rank: 0
      };
    }

    const windowInfo = getWindowInfo(rule, oldExpiry);
    const dueDate = resolveDueDate(oldExpiry, windowInfo);

    if (dueDate < stageStart || status === "已过期") {
      return {
        label: "已过期",
        rank: 50
      };
    }

    const windowPolicy = resolveWindowPolicy(rule);
    if (windowPolicy && isThreeMonthWindowRule(rule)) {
      const daysToExpiry = Utils.daysBetween(dueDate, stageEnd);
      if (daysToExpiry <= 30) {
        return {
          label: "30天内到期",
          rank: 40
        };
      }
      if (daysToExpiry <= 60) {
        return {
          label: "60天内到期",
          rank: 30
        };
      }
      if (daysToExpiry <= 90) {
        return {
          label: "90天内到期",
          rank: 20
        };
      }
    }

    if (status === "本阶段到期") {
      return {
        label: "本阶段到期",
        rank: 15
      };
    }

    if (status === "命中窗口") {
      return {
        label: "命中窗口",
        rank: 10
      };
    }

    return {
      label: "",
      rank: 0
    };
  }

  function classifyScheduleStageStatus(rule: TrainingProjectRule, stageStart: Date, stageEnd: Date, oldExpiry: Date | null): TrainingScheduleClassification {
    if (!oldExpiry) {
      return {
        status: "缺少旧有效期",
        include: false,
        windowInfo: getWindowInfo(rule, oldExpiry),
        reason: "这一行没有可解析的旧有效期，暂时无法判断是否需要预排班。"
      };
    }

    const windowInfo = getWindowInfo(rule, oldExpiry);
    const dueDate = resolveDueDate(oldExpiry, windowInfo);
    if (dueDate < stageStart) {
      return {
        status: "已过期",
        include: true,
        windowInfo,
        reason: `预排开始日期 ${Utils.formatDate(stageStart)} 已晚于本轮必须完成日期 ${Utils.formatDate(dueDate)}，该人员已过期，需立即安排并人工确认。`
      };
    }

    if (windowInfo.hasWindow && Utils.rangesOverlap(stageStart, stageEnd, windowInfo.windowStart, windowInfo.windowEnd)) {
      return {
        status: "命中窗口",
        include: true,
        windowInfo,
        reason: `预排区间 ${Utils.formatDate(stageStart)} 至 ${Utils.formatDate(stageEnd)} 与${windowInfo.tag}重叠，需进入预排。`
      };
    }

    if (!windowInfo.hasWindow && oldExpiry >= stageStart && oldExpiry <= stageEnd) {
      return {
        status: "本阶段到期",
        include: true,
        windowInfo,
        reason: `项目无窗口期，但旧有效期 ${Utils.formatDate(oldExpiry)} 落在预排区间 ${Utils.formatDate(stageStart)} 至 ${Utils.formatDate(stageEnd)} 内，需在过期前安排。`
      };
    }

    return {
      status: windowInfo.hasWindow ? "有效未到窗口" : "阶段外未到期",
      include: false,
      windowInfo,
      reason: describeStageOutsideWindow(stageStart, stageEnd, oldExpiry, windowInfo)
    };
  }
  export const TrainingToolRuleEngine = {
    addValidity,
    calculateBaseMonthExpiry,
    getWindowInfo,
    computeExpiry,
    classifyUpdateJudgement,
    evaluateUpdateResult,
    evaluatePlanCoverage,
    classifyScheduleStatus,
    classifyScheduleStageStatus,
    classifyScheduleUrgency,
    createTodayDate
  };
