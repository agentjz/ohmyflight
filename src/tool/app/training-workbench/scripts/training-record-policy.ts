import { TrainingToolUtils } from "./utils";
import type { TrainingRecordState, TrainingToolSheetInfo, TrainingToolSheetRow, TrainingValidityRecordState } from "./models";

const Utils = TrainingToolUtils;

  const HEADERS = {
    infoEntered: "培训信息是否录入",
    machineView: "机器看",
    remark: "备注"
  };

  const VALUES = {
    recorded: "是",
    machineUpdate: "Y",
    cancelKeyword: "取消"
  };

  function getInfoEnteredText(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): string {
    return Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, HEADERS.infoEntered));
  }

  function getRemarkText(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): string {
    return Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, HEADERS.remark));
  }

  function getMachineViewText(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): string {
    return Utils.normalizeText(Utils.getValueByHeader(row, sheetInfo, HEADERS.machineView));
  }

  function isRecorded(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): boolean {
    return getInfoEnteredText(row, sheetInfo) === VALUES.recorded;
  }

  function isMarkedForValidityUpdate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): boolean {
    return getMachineViewText(row, sheetInfo).toUpperCase() === VALUES.machineUpdate;
  }

  function isCancelled(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): boolean {
    return getRemarkText(row, sheetInfo).includes(VALUES.cancelKeyword);
  }

  function classify(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): TrainingRecordState {
    const recorded = isRecorded(row, sheetInfo);
    const cancelled = isCancelled(row, sheetInfo);

    if (recorded && cancelled) {
      return {
        recorded,
        cancelled,
        active: false,
        abnormal: true,
        status: "已录入但备注取消",
        reason: "培训信息是否录入为“是”，但备注包含“取消”，数据矛盾，需人工确认。"
      };
    }

    if (cancelled) {
      return {
        recorded,
        cancelled,
        active: false,
        abnormal: false,
        status: "已取消",
        reason: "备注包含“取消”，这条计划记录不参与覆盖判断。"
      };
    }

    return {
      recorded,
      cancelled,
      active: true,
      abnormal: false,
      status: recorded ? "已录入" : "未录入",
      reason: ""
    };
  }

  function classifyForValidityUpdate(row: TrainingToolSheetRow, sheetInfo: TrainingToolSheetInfo): TrainingValidityRecordState {
    const markedForUpdate = isMarkedForValidityUpdate(row, sheetInfo);
    const cancelled = isCancelled(row, sheetInfo);

    if (markedForUpdate && cancelled) {
      return {
        markedForUpdate,
        cancelled,
        active: false,
        abnormal: true,
        status: "机器看Y但备注取消",
        reason: "机器看为“Y”，但备注包含“取消”，数据矛盾，需人工确认。"
      };
    }

    if (cancelled) {
      return {
        markedForUpdate,
        cancelled,
        active: false,
        abnormal: false,
        status: "已取消",
        reason: "备注包含“取消”，这条记录不参与有效期更新。"
      };
    }

    return {
      markedForUpdate,
      cancelled,
      active: markedForUpdate,
      abnormal: false,
      status: markedForUpdate ? "机器看Y" : "机器看非Y",
      reason: markedForUpdate ? "" : "机器看不是“Y”，本次不参与有效期更新。"
    };
  }
  export const TrainingToolTrainingRecordPolicy = {
    getInfoEnteredText,
    getMachineViewText,
    getRemarkText,
    isRecorded,
    isMarkedForValidityUpdate,
    isCancelled,
    classify,
    classifyForValidityUpdate
  };
