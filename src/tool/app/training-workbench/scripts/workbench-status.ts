import type { TrainingStatusTone, TrainingVisibleStatusBucket, TrainingVisibleStatusField } from "./models";

const STATUSES = {
    expired: "已过期",
    expiredScheduled: "已过期已排补训",
    must: "必须排",
    recommended: "推荐排",
    uncoveredScheduled: "已排未覆盖",
    normal: "正常",
    abnormal: "异常"
  };

  const VISIBLE_STATUS_FIELDS: Array<{ status: string; field: TrainingVisibleStatusField }> = [
    { status: STATUSES.expired, field: "expired" },
    { status: STATUSES.expiredScheduled, field: "expiredScheduled" },
    { status: STATUSES.must, field: "must" },
    { status: STATUSES.uncoveredScheduled, field: "uncoveredScheduled" },
    { status: STATUSES.recommended, field: "recommended" },
    { status: STATUSES.abnormal, field: "abnormal" }
  ];

  const DEFAULT_VISIBLE_STATUSES = new Set(VISIBLE_STATUS_FIELDS.map((item) => item.status));

  const STATUS_ORDER = new Map<string, number>([
    [STATUSES.expired, 0],
    [STATUSES.expiredScheduled, 1],
    [STATUSES.must, 2],
    [STATUSES.uncoveredScheduled, 3],
    [STATUSES.recommended, 4],
    [STATUSES.abnormal, 5],
    [STATUSES.normal, 6]
  ]);

  const TONE_ORDER = new Map<TrainingStatusTone, number>([
    ["red", 0],
    ["orange", 1],
    ["green", 2],
    ["gray", 3]
  ]);

  function rankOfStatus(status: string): number {
    return STATUS_ORDER.has(status) ? STATUS_ORDER.get(status)! : 99;
  }

  function fieldForStatus(status: string): TrainingVisibleStatusField | "" {
    const item = VISIBLE_STATUS_FIELDS.find((entry) => entry.status === status);
    return item ? item.field : "";
  }

  function isDefaultVisible(status: string): boolean {
    return DEFAULT_VISIBLE_STATUSES.has(status);
  }

  function createVisibleStatusBucket(): TrainingVisibleStatusBucket;
  function createVisibleStatusBucket<T extends object>(extra: T): TrainingVisibleStatusBucket & T;
  function createVisibleStatusBucket<T extends object>(extra = {} as T): TrainingVisibleStatusBucket & T {
    return {
      ...extra,
      expired: 0,
      expiredScheduled: 0,
      must: 0,
      uncoveredScheduled: 0,
      recommended: 0,
      abnormal: 0
    };
  }

  function incrementVisibleStatusBucket(item: TrainingVisibleStatusBucket, status: string): void {
    const field = fieldForStatus(status);
    if (field) item[field] += 1;
  }

  function toneForQualificationStatus(status: string): TrainingStatusTone {
    switch (status) {
      case STATUSES.expired:
      case STATUSES.must:
      case STATUSES.uncoveredScheduled:
      case STATUSES.abnormal:
        return "red";
      case STATUSES.recommended:
        return "orange";
      case STATUSES.expiredScheduled:
      case STATUSES.normal:
        return "green";
      default:
        return "gray";
    }
  }

  function badgeToneForWorkbenchStatus(status: string): "danger" | "warn" | "ok" | "info" {
    switch (status) {
      case STATUSES.expired:
      case STATUSES.abnormal:
      case STATUSES.uncoveredScheduled:
        return "danger";
      case STATUSES.must:
      case STATUSES.recommended:
        return "warn";
      case STATUSES.expiredScheduled:
      case STATUSES.normal:
      case "已排已录入":
        return "ok";
      default:
        return "info";
    }
  }

  function labelForTone(tone: TrainingStatusTone): string {
    switch (tone) {
      case "red":
        return "红";
      case "orange":
        return "橙";
      case "green":
        return "绿";
      default:
        return "灰";
    }
  }

  function rankOfTone(tone: TrainingStatusTone): number {
    return TONE_ORDER.get(tone) ?? 99;
  }

  function chooseWorstTone(currentTone: TrainingStatusTone, nextTone: TrainingStatusTone): TrainingStatusTone {
    return rankOfTone(nextTone) < rankOfTone(currentTone) ? nextTone : currentTone;
  }
  export const TrainingToolWorkbenchStatus = {
    STATUSES,
    VISIBLE_STATUS_FIELDS,
    DEFAULT_VISIBLE_STATUSES,
    STATUS_ORDER,
    rankOfStatus,
    fieldForStatus,
    isDefaultVisible,
    createVisibleStatusBucket,
    incrementVisibleStatusBucket,
    toneForQualificationStatus,
    badgeToneForWorkbenchStatus,
    labelForTone,
    rankOfTone,
    chooseWorstTone
  };
