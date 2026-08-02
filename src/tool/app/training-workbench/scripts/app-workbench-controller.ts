import { TrainingToolUtils } from "./utils";
import type { TrainingToolAnalysis, TrainingToolAppRuntime, TrainingWorkbenchResult } from "./models";
import { TrainingToolWorkbench } from "./workbench";

export function installTrainingAppWorkbenchController(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const Workbench = TrainingToolWorkbench;
  const state = runtime.state;
  const elements = runtime.elements;
  const renderers = runtime.renderers;
  const selection = runtime.selection;
  const controls = runtime.controls;

  function buildCurrentWorkbenchResult(analysis: TrainingToolAnalysis): TrainingWorkbenchResult {
    const range = selection.getWorkbenchRange();
    if (!range) {
      throw new Error("请确认排班总览评估日期区间，开始日期不能晚于结束日期。");
    }
    return Workbench.buildWorkbench(analysis, {
      today: range.stageStart,
      stageEnd: range.stageEnd,
      extraProjectRows: state.simulationRecords || []
    });
  }

  function renderWorkbenchView() {
    if (!state.workbenchResult) return null;
    const view = Workbench.viewFromRows(state.workbenchResult, selection.getWorkbenchFilters());
    state.workbenchView = view;
    state.workbenchSelection = null;
    renderers.renderWorkbenchFilterOptions(view);
    renderers.renderActionResult("workbench", view);
    if (runtime.simulationSchedule) runtime.simulationSchedule.render();
    controls.refreshButtons();
    return view;
  }

  function handleWorkbenchRangeChange() {
    controls.clearPendingExport();
    if (!state.analysis) {
      controls.refreshButtons();
      return;
    }

    try {
      state.workbenchResult = buildCurrentWorkbenchResult(state.analysis);
      renderWorkbenchView();
      controls.setStatus("排班总览评估区间已更新。");
    } catch (error) {
      state.workbenchResult = null;
      renderers.renderResultPlaceholders();
      controls.setStatus(Utils.errorMessage(error, "排班总览评估区间无效。"), true);
      controls.refreshButtons();
    }
  }

  function handleWorkbenchFilterChange() {
    if (!state.workbenchResult) return;
    renderWorkbenchView();
    controls.setStatus("排班总览筛选已更新。");
  }

  function refreshWorkbenchResult(statusMessage = "") {
    if (!state.analysis) {
      controls.refreshButtons();
      return null;
    }

    state.workbenchResult = buildCurrentWorkbenchResult(state.analysis);
    const view = renderWorkbenchView();
    if (runtime.scheduleGapCheck) runtime.scheduleGapCheck.rebuild();
    if (statusMessage) controls.setStatus(statusMessage);
    return view;
  }

  runtime.workbenchController = {
    buildCurrentWorkbenchResult,
    renderWorkbenchView,
    refreshWorkbenchResult,
    handleWorkbenchRangeChange,
    handleWorkbenchFilterChange
  };
}
