import { TrainingToolWorkbenchStatus } from "./workbench-status";
import type { TrainingBadgeTone } from "./models";

const WorkbenchStatus = TrainingToolWorkbenchStatus;

  function makeBadgeCell(text: unknown, tone: TrainingBadgeTone): { type: "badge"; text: unknown; tone: TrainingBadgeTone } {
    return {
      type: "badge",
      text,
      tone
    };
  }

  function badgeToneForUpdateJudgement(value: unknown): TrainingBadgeTone {
    switch (value) {
      case "命中窗口":
        return "warn";
      case "超期":
        return "danger";
      case "首次无旧值":
        return "info";
      case "提前窗口外":
      case "最新日期重算":
      default:
        return "info";
    }
  }

  function badgeToneForUpdateResult(value: unknown): TrainingBadgeTone {
    switch (value) {
      case "已更新":
        return "ok";
      case "不变":
        return "info";
      case "有效期回退":
      case "更新无效":
        return "danger";
      default:
        return "info";
    }
  }

  function badgeToneForSkippedStatus(value: unknown): TrainingBadgeTone {
    switch (value) {
      case "日期异常":
      case "匹配失败":
      case "记录异常":
        return "danger";
      case "有效期异常":
        return "danger";
      case "培训未录入":
      case "不参与更新":
      case "缺少旧有效期":
        return "info";
      case "有效未到窗口":
      case "阶段外未到期":
        return "ok";
      default:
        return "info";
    }
  }

  function badgeToneForWorkbenchStatus(value: string): TrainingBadgeTone {
    return WorkbenchStatus.badgeToneForWorkbenchStatus(value);
  }
  export const TrainingToolResultStatus = {
    makeBadgeCell,
    badgeToneForUpdateJudgement,
    badgeToneForUpdateResult,
    badgeToneForSkippedStatus,
    badgeToneForWorkbenchStatus
  };
