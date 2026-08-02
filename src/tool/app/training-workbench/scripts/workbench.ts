import { TrainingToolScheduleAssessment } from "./schedule-assessment";
import type { TrainingAssessmentFilters, TrainingAssessmentOptions, TrainingAssessmentRow, TrainingToolAnalysis, TrainingWorkbenchResult } from "./models";

const ScheduleAssessment = TrainingToolScheduleAssessment;

  function buildWorkbench(analysis: TrainingToolAnalysis, options: TrainingAssessmentOptions = {}): TrainingWorkbenchResult {
    return ScheduleAssessment.buildResult(analysis, options);
  }

  function filterWorkbenchRows(rows: TrainingAssessmentRow[], filters: TrainingAssessmentFilters = {}): TrainingAssessmentRow[] {
    return ScheduleAssessment.filterRows(rows, filters);
  }

  function viewFromRows(baseResult: TrainingWorkbenchResult, filters: TrainingAssessmentFilters = {}): TrainingWorkbenchResult {
    return ScheduleAssessment.viewFromRows(baseResult, filters);
  }
  export const TrainingToolWorkbench = {
    buildWorkbench,
    filterWorkbenchRows,
    viewFromRows
  };
