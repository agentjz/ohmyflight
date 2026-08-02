import type { TrainingToolAppRuntime } from "./models";

export function installTrainingAppCopy(runtime: TrainingToolAppRuntime): void {
runtime.copy = {
    defaultExportButton: "导出当前预览 Excel",
    defaultOverview: "导入文件后，这里会显示识别到的主表、项目数量和月份范围。",
    defaultProjectCards: "导入文件后显示各项目识别详情。",
    defaultDetailTable: "生成预览后显示结果明细。",
    defaultSkippedTable: "生成预览后显示跳过记录和提示信息。",
    defaultResultSummary: "尚未执行任何操作。",
    defaultStatus: "请先导入总培训表文件。",
    defaultWaiting: "等待执行"
  };
}
