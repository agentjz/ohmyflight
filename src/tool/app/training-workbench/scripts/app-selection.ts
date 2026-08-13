import { TrainingToolUtils } from "./utils";
import type { TrainingAssessmentFilters, TrainingToolAppRuntime, TrainingToolProjectAnalysis } from "./models";

export function installTrainingAppSelection(runtime: TrainingToolAppRuntime): void {
const Utils = TrainingToolUtils;
  const state = runtime.state;
  const elements = runtime.elements;

  function normalizeSelectedProjects(selectedNames: string[], projects: TrainingToolProjectAnalysis[]): string[] {
    const selectedSet = new Set(
      (selectedNames || [])
        .map((value) => Utils.normalizeText(value))
        .filter(Boolean)
    );
    return projects
      .map((project) => project.canonical)
      .filter((projectName) => selectedSet.has(projectName));
  }

  function getUpdateProjects(): TrainingToolProjectAnalysis[] {
    if (!state.analysis) return [];
    return state.analysis.projects.filter(
      (project) => project.peopleColumnIndex >= 0 && project.validityUpdateInfo && project.validityUpdateInfo.rows.length
    );
  }

  function getCheckedProjectValues(listElement: HTMLElement): string[] {
    return Array.from(listElement.querySelectorAll('input[data-role="project"]:checked'))
      .map((input) => Utils.normalizeText((input as HTMLInputElement).value))
      .filter(Boolean);
  }

  function getCommonValidityUpdateMonths(projectNames: string[]): string[] {
    const analysis = state.analysis;
    if (!analysis || !projectNames.length) return [];

    const selectedProjects = projectNames
      .map((projectName) => analysis.projectMap.get(projectName))
      .filter((project): project is TrainingToolProjectAnalysis => Boolean(project));

    if (!selectedProjects.length) return [];

    let commonMonths = [...selectedProjects[0]!.validityUpdateMonths];
    for (let index = 1; index < selectedProjects.length; index += 1) {
      const monthSet = new Set(selectedProjects[index]!.validityUpdateMonths);
      commonMonths = commonMonths.filter((monthKey) => monthSet.has(monthKey));
    }
    return Utils.sortMonthKeys(commonMonths);
  }

  function getWorkbenchFilters(): TrainingAssessmentFilters {
    return {
      projects: elements.workbenchProjectSelect.value ? [elements.workbenchProjectSelect.value] : [],
      statuses: elements.workbenchStatusSelect.value ? [elements.workbenchStatusSelect.value] : [],
      months: elements.workbenchMonthSelect.value ? [elements.workbenchMonthSelect.value] : [],
      searchText: elements.workbenchSearchInput.value
    };
  }

  function getWorkbenchRange(): { stageStart: Date; stageEnd: Date } | null {
    const stageStart = Utils.parseDate(elements.workbenchStartDateInput.value);
    const stageEnd = Utils.parseDate(elements.workbenchEndDateInput.value);
    if (!stageStart || !stageEnd || stageStart > stageEnd) {
      return null;
    }
    return { stageStart, stageEnd };
  }

  runtime.selection = {
    normalizeSelectedProjects,
    getUpdateProjects,
    getCheckedProjectValues,
    getCommonValidityUpdateMonths,
    getWorkbenchFilters,
    getWorkbenchRange
  };
}
