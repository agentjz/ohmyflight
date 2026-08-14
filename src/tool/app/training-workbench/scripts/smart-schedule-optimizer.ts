import {
  solve,
  type Constraint,
  type Model,
  type Solution,
  type SolutionStatus
} from "yalps";

export interface SmartScheduleOptimizationGroup {
  id: string;
  projectName: string;
  count: number;
  personDays: number;
  candidateMonths: string[];
}

export interface SmartScheduleOptimizationInput {
  monthKeys: string[];
  fixedLoads: Map<string, number>;
  groups: SmartScheduleOptimizationGroup[];
}

export interface SmartScheduleOptimizationResult {
  status: SolutionStatus;
  assignments: Map<string, Map<string, number>>;
  peakPersonDays: number;
  averagePersonDays: number;
  totalDeviation: number;
  variableCount: number;
}

interface ModelParts {
  constraints: Map<string, Constraint>;
  variables: Map<string, Map<string, number>>;
  assignmentKeys: Map<string, { groupId: string; monthKey: string }>;
}

interface LoadScore {
  peak: number;
  projectPeak: number;
  deviation: number;
  projectDeviation: number;
}

const PEAK_OBJECTIVE = "objective:peak";
const PROJECT_PEAK_OBJECTIVE = "objective:project-peak";
const GLOBAL_DEVIATION_OBJECTIVE = "objective:global-deviation";
const PROJECT_DEVIATION_OBJECTIVE = "objective:project-deviation";
const EPSILON = 1e-7;

function groupConstraint(groupId: string): string {
  return `group:${groupId}`;
}

function monthConstraint(monthKey: string): string {
  return `month:${monthKey}`;
}

function deviationConstraint(monthKey: string): string {
  return `deviation:${monthKey}`;
}

function projectDeviationConstraint(projectIndex: number, monthKey: string): string {
  return `project-deviation:${projectIndex}:${monthKey}`;
}

function projectPeakConstraint(projectIndex: number, monthKey: string): string {
  return `project-peak:${projectIndex}:${monthKey}`;
}

function assignmentVariable(groupIndex: number, monthIndex: number): string {
  return `assignment:${groupIndex}:${monthIndex}`;
}

function totalWorkload(input: SmartScheduleOptimizationInput): number {
  const fixed = input.monthKeys.reduce((total, monthKey) => total + (input.fixedLoads.get(monthKey) || 0), 0);
  return fixed + input.groups.reduce((total, group) => total + group.count * group.personDays, 0);
}

function projectWorkloads(input: SmartScheduleOptimizationInput): Map<string, number> {
  const workloads = new Map<string, number>();
  input.groups.forEach((group) => {
    workloads.set(group.projectName, (workloads.get(group.projectName) || 0) + group.count * group.personDays);
  });
  return workloads;
}

function projectMonths(input: SmartScheduleOptimizationInput): Map<string, string[]> {
  const months = new Map<string, Set<string>>();
  input.groups.forEach((group) => {
    const projectMonths = months.get(group.projectName) || new Set<string>();
    group.candidateMonths.forEach((monthKey) => projectMonths.add(monthKey));
    months.set(group.projectName, projectMonths);
  });
  return new Map([...months.entries()].map(([projectName, values]) => [
    projectName,
    [...values].sort()
  ]));
}

function buildModelParts(
  input: SmartScheduleOptimizationInput
): ModelParts {
  const constraints = new Map<string, Constraint>();
  const variables = new Map<string, Map<string, number>>();
  const assignmentKeys = new Map<string, { groupId: string; monthKey: string }>();

  input.groups.forEach((group) => {
    constraints.set(groupConstraint(group.id), { equal: group.count });
  });
  input.monthKeys.forEach((monthKey) => {
    const fixedLoad = input.fixedLoads.get(monthKey) || 0;
    constraints.set(monthConstraint(monthKey), { max: -fixedLoad });
  });

  input.groups.forEach((group, groupIndex) => {
    group.candidateMonths.forEach((monthKey) => {
      const monthIndex = input.monthKeys.indexOf(monthKey);
      if (monthIndex < 0) return;
      const variableKey = assignmentVariable(groupIndex, monthIndex);
      variables.set(variableKey, new Map([
        [groupConstraint(group.id), 1],
        [monthConstraint(monthKey), group.personDays]
      ]));
      assignmentKeys.set(variableKey, { groupId: group.id, monthKey });
    });
  });

  return { constraints, variables, assignmentKeys };
}

function addAssignmentCoefficients(
  parts: ModelParts,
  input: SmartScheduleOptimizationInput,
  constraintFor: (group: SmartScheduleOptimizationGroup, monthKey: string) => string
): void {
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  parts.assignmentKeys.forEach((assignment, variableKey) => {
    const group = groups.get(assignment.groupId);
    if (!group) return;
    parts.variables.get(variableKey)?.set(constraintFor(group, assignment.monthKey), group.personDays);
  });
}

function addGlobalDeviationStage(
  parts: ModelParts,
  input: SmartScheduleOptimizationInput,
  averagePersonDays: number
): void {
  input.monthKeys.forEach((monthKey, monthIndex) => {
    const constraintKey = deviationConstraint(monthKey);
    parts.constraints.set(constraintKey, {
      equal: averagePersonDays - (input.fixedLoads.get(monthKey) || 0)
    });
    parts.variables.set(`over:${monthIndex}`, new Map([
      [constraintKey, -1],
      [GLOBAL_DEVIATION_OBJECTIVE, 1]
    ]));
    parts.variables.set(`under:${monthIndex}`, new Map([
      [constraintKey, 1],
      [GLOBAL_DEVIATION_OBJECTIVE, 1]
    ]));
  });
  addAssignmentCoefficients(parts, input, (_group, monthKey) => deviationConstraint(monthKey));
}

function addProjectPeakStage(
  parts: ModelParts,
  input: SmartScheduleOptimizationInput,
  projects: string[],
  monthsByProject: Map<string, string[]>
): void {
  const projectIndexes = new Map(projects.map((projectName, index) => [projectName, index]));
  projects.forEach((projectName, projectIndex) => {
    const months = monthsByProject.get(projectName) || [];
    months.forEach((monthKey) => {
      parts.constraints.set(projectPeakConstraint(projectIndex, monthKey), { max: 0 });
    });
    parts.variables.set(`project-peak:${projectIndex}`, new Map([
      [PROJECT_PEAK_OBJECTIVE, 1],
      ...months.map((monthKey): [string, number] => [projectPeakConstraint(projectIndex, monthKey), -1])
    ]));
  });
  addAssignmentCoefficients(parts, input, (group, monthKey) => (
    projectPeakConstraint(projectIndexes.get(group.projectName)!, monthKey)
  ));
}

function addProjectDeviationStage(
  parts: ModelParts,
  input: SmartScheduleOptimizationInput,
  projects: string[],
  projectAverages: Map<string, number>,
  monthsByProject: Map<string, string[]>
): void {
  const projectIndexes = new Map(projects.map((projectName, index) => [projectName, index]));
  projects.forEach((projectName, projectIndex) => {
    (monthsByProject.get(projectName) || []).forEach((monthKey) => {
      const constraintKey = projectDeviationConstraint(projectIndex, monthKey);
      const monthIndex = input.monthKeys.indexOf(monthKey);
      parts.constraints.set(constraintKey, { equal: projectAverages.get(projectName) || 0 });
      parts.variables.set(`project-over:${projectIndex}:${monthIndex}`, new Map([
        [constraintKey, -1],
        [PROJECT_DEVIATION_OBJECTIVE, 1]
      ]));
      parts.variables.set(`project-under:${projectIndex}:${monthIndex}`, new Map([
        [constraintKey, 1],
        [PROJECT_DEVIATION_OBJECTIVE, 1]
      ]));
    });
  });
  addAssignmentCoefficients(parts, input, (group, monthKey) => (
    projectDeviationConstraint(projectIndexes.get(group.projectName)!, monthKey)
  ));
}

function emptyAssignments(groups: SmartScheduleOptimizationGroup[]): Map<string, Map<string, number>> {
  return new Map(groups.map((group) => [group.id, new Map<string, number>()]));
}

function fractionalAssignments(
  groups: SmartScheduleOptimizationGroup[],
  variables: Array<[string, number]>,
  assignmentKeys: Map<string, { groupId: string; monthKey: string }>
): Map<string, Map<string, number>> {
  const assignments = emptyAssignments(groups);
  variables.forEach(([variableKey, value]) => {
    const assignment = assignmentKeys.get(variableKey);
    if (!assignment || value <= EPSILON) return;
    assignments.get(assignment.groupId)?.set(assignment.monthKey, value);
  });
  return assignments;
}

function integerizeAssignments(
  groups: SmartScheduleOptimizationGroup[],
  fractional: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  const result = emptyAssignments(groups);
  groups.forEach((group) => {
    const groupFractional = fractional.get(group.id) || new Map<string, number>();
    const integerMonths = result.get(group.id)!;
    const remainders = group.candidateMonths.map((monthKey) => {
      const value = Math.max(0, groupFractional.get(monthKey) || 0);
      const floor = Math.floor(value + EPSILON);
      if (floor > 0) integerMonths.set(monthKey, floor);
      return { monthKey, remainder: value - floor };
    });
    let remaining = group.count - [...integerMonths.values()].reduce((total, value) => total + value, 0);
    remainders.sort((left, right) => right.remainder - left.remainder || left.monthKey.localeCompare(right.monthKey));
    for (let index = 0; remaining > 0; index += 1) {
      const monthKey = remainders[index % remainders.length].monthKey;
      integerMonths.set(monthKey, (integerMonths.get(monthKey) || 0) + 1);
      remaining -= 1;
    }
  });
  return result;
}

function assignedLoads(
  input: SmartScheduleOptimizationInput,
  assignments: Map<string, Map<string, number>>
): Map<string, number> {
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  const loads = new Map(input.monthKeys.map((monthKey) => [monthKey, input.fixedLoads.get(monthKey) || 0]));
  assignments.forEach((months, groupId) => {
    const group = groups.get(groupId);
    if (!group) return;
    months.forEach((count, monthKey) => {
      loads.set(monthKey, (loads.get(monthKey) || 0) + count * group.personDays);
    });
  });
  return loads;
}

function assignedProjectLoads(
  input: SmartScheduleOptimizationInput,
  assignments: Map<string, Map<string, number>>
): Map<string, number> {
  const groups = new Map(input.groups.map((group) => [group.id, group]));
  const loads = new Map<string, number>();
  assignments.forEach((months, groupId) => {
    const group = groups.get(groupId);
    if (!group) return;
    months.forEach((count, monthKey) => {
      const key = `${group.projectName}\u0000${monthKey}`;
      loads.set(key, (loads.get(key) || 0) + count * group.personDays);
    });
  });
  return loads;
}

function scoreLoads(
  monthKeys: string[],
  loads: Map<string, number>,
  averagePersonDays: number,
  projects: string[],
  projectLoads: Map<string, number>,
  projectAverages: Map<string, number>,
  monthsByProject: Map<string, string[]>
): LoadScore {
  const values = monthKeys.map((monthKey) => loads.get(monthKey) || 0);
  return {
    peak: Math.max(0, ...values),
    projectPeak: projects.reduce((total, projectName) => total + Math.max(
      0,
      ...(monthsByProject.get(projectName) || []).map((monthKey) => (
        projectLoads.get(`${projectName}\u0000${monthKey}`) || 0
      ))
    ), 0),
    deviation: values.reduce((total, load) => total + Math.abs(load - averagePersonDays), 0),
    projectDeviation: projects.reduce((total, projectName) => (
      total + (monthsByProject.get(projectName) || []).reduce((projectTotal, monthKey) => (
        projectTotal + Math.abs(
          (projectLoads.get(`${projectName}\u0000${monthKey}`) || 0)
          - (projectAverages.get(projectName) || 0)
        )
      ), 0)
    ), 0)
  };
}

function isBetterScore(candidate: LoadScore, current: LoadScore): boolean {
  if (candidate.peak < current.peak - EPSILON) return true;
  if (Math.abs(candidate.peak - current.peak) > EPSILON) return false;
  if (candidate.deviation < current.deviation - EPSILON) return true;
  if (Math.abs(candidate.deviation - current.deviation) > EPSILON) return false;
  if (candidate.projectPeak < current.projectPeak - EPSILON) return true;
  return Math.abs(candidate.projectPeak - current.projectPeak) <= EPSILON
    && candidate.projectDeviation < current.projectDeviation - EPSILON;
}

function improveAssignments(
  input: SmartScheduleOptimizationInput,
  assignments: Map<string, Map<string, number>>,
  averagePersonDays: number,
  projects: string[],
  projectAverages: Map<string, number>,
  monthsByProject: Map<string, string[]>
): Map<string, Map<string, number>> {
  const loads = assignedLoads(input, assignments);
  const projectLoads = assignedProjectLoads(input, assignments);
  let currentScore = scoreLoads(
    input.monthKeys,
    loads,
    averagePersonDays,
    projects,
    projectLoads,
    projectAverages,
    monthsByProject
  );
  while (true) {
    let bestMove: { groupId: string; from: string; to: string; score: LoadScore } | null = null;
    input.groups.forEach((group) => {
      const groupAssignments = assignments.get(group.id)!;
      groupAssignments.forEach((count, from) => {
        if (count <= 0) return;
        group.candidateMonths.forEach((to) => {
          if (to === from) return;
          loads.set(from, (loads.get(from) || 0) - group.personDays);
          loads.set(to, (loads.get(to) || 0) + group.personDays);
          const fromKey = `${group.projectName}\u0000${from}`;
          const toKey = `${group.projectName}\u0000${to}`;
          projectLoads.set(fromKey, (projectLoads.get(fromKey) || 0) - group.personDays);
          projectLoads.set(toKey, (projectLoads.get(toKey) || 0) + group.personDays);
          const candidateScore = scoreLoads(
            input.monthKeys,
            loads,
            averagePersonDays,
            projects,
            projectLoads,
            projectAverages,
            monthsByProject
          );
          loads.set(from, (loads.get(from) || 0) + group.personDays);
          loads.set(to, (loads.get(to) || 0) - group.personDays);
          projectLoads.set(fromKey, (projectLoads.get(fromKey) || 0) + group.personDays);
          projectLoads.set(toKey, (projectLoads.get(toKey) || 0) - group.personDays);
          if (!isBetterScore(candidateScore, currentScore)) return;
          if (!bestMove || isBetterScore(candidateScore, bestMove.score)) {
            bestMove = { groupId: group.id, from, to, score: candidateScore };
          }
        });
      });
    });

    if (!bestMove) return assignments;
    const move: { groupId: string; from: string; to: string; score: LoadScore } = bestMove;
    const group = input.groups.find((candidate) => candidate.id === move.groupId)!;
    const groupAssignments = assignments.get(move.groupId)!;
    groupAssignments.set(move.from, (groupAssignments.get(move.from) || 0) - 1);
    if (groupAssignments.get(move.from) === 0) groupAssignments.delete(move.from);
    groupAssignments.set(move.to, (groupAssignments.get(move.to) || 0) + 1);
    loads.set(move.from, (loads.get(move.from) || 0) - group.personDays);
    loads.set(move.to, (loads.get(move.to) || 0) + group.personDays);
    const fromKey = `${group.projectName}\u0000${move.from}`;
    const toKey = `${group.projectName}\u0000${move.to}`;
    projectLoads.set(fromKey, (projectLoads.get(fromKey) || 0) - group.personDays);
    projectLoads.set(toKey, (projectLoads.get(toKey) || 0) + group.personDays);
    currentScore = move.score;
  }
}

function solveStage(parts: ModelParts, objective: string): Solution<string> {
  const model: Model<string, string> = {
    direction: "minimize",
    objective,
    constraints: parts.constraints,
    variables: parts.variables
  };
  return solve(model, { maxPivots: 100000 });
}

function lockStage(parts: ModelParts, objective: string, optimum: number): void {
  parts.constraints.set(objective, { max: optimum + EPSILON });
}

function optimizeSchedule(input: SmartScheduleOptimizationInput): SmartScheduleOptimizationResult {
  const workload = totalWorkload(input);
  const averagePersonDays = input.monthKeys.length ? workload / input.monthKeys.length : 0;
  const workloadsByProject = projectWorkloads(input);
  const projects = [...workloadsByProject.keys()].sort((left, right) => left.localeCompare(right));
  const monthsByProject = projectMonths(input);
  const projectAverages = new Map(projects.map((projectName) => [
    projectName,
    (workloadsByProject.get(projectName) || 0) / (monthsByProject.get(projectName)?.length || 1)
  ]));
  if (!input.groups.length) {
    const fixedLoads = input.monthKeys.map((monthKey) => input.fixedLoads.get(monthKey) || 0);
    return {
      status: "optimal",
      assignments: new Map(),
      peakPersonDays: Math.max(0, ...fixedLoads),
      averagePersonDays,
      totalDeviation: fixedLoads.reduce((total, load) => total + Math.abs(load - averagePersonDays), 0),
      variableCount: 0
    };
  }

  const parts = buildModelParts(input);
  parts.variables.set("peak", new Map([
    [PEAK_OBJECTIVE, 1],
    ...input.monthKeys.map((monthKey): [string, number] => [monthConstraint(monthKey), -1])
  ]));
  const stages = [
    { objective: PEAK_OBJECTIVE, prepare: (): void => undefined },
    {
      objective: GLOBAL_DEVIATION_OBJECTIVE,
      prepare: (): void => addGlobalDeviationStage(parts, input, averagePersonDays)
    },
    {
      objective: PROJECT_PEAK_OBJECTIVE,
      prepare: (): void => addProjectPeakStage(parts, input, projects, monthsByProject)
    },
    {
      objective: PROJECT_DEVIATION_OBJECTIVE,
      prepare: (): void => addProjectDeviationStage(parts, input, projects, projectAverages, monthsByProject)
    }
  ];
  let solution: Solution<string> | null = null;
  for (const [index, stage] of stages.entries()) {
    stage.prepare();
    solution = solveStage(parts, stage.objective);
    if (solution.status !== "optimal") {
      return {
        status: solution.status,
        assignments: emptyAssignments(input.groups),
        peakPersonDays: Number.NaN,
        averagePersonDays,
        totalDeviation: Number.NaN,
        variableCount: parts.variables.size
      };
    }
    if (index < stages.length - 1) lockStage(parts, stage.objective, solution.result);
  }

  const fractional = fractionalAssignments(input.groups, solution!.variables, parts.assignmentKeys);
  const assignments = improveAssignments(
    input,
    integerizeAssignments(input.groups, fractional),
    averagePersonDays,
    projects,
    projectAverages,
    monthsByProject
  );
  const loads = assignedLoads(input, assignments);
  const score = scoreLoads(
    input.monthKeys,
    loads,
    averagePersonDays,
    projects,
    assignedProjectLoads(input, assignments),
    projectAverages,
    monthsByProject
  );
  return {
    status: "optimal",
    assignments,
    peakPersonDays: score.peak,
    averagePersonDays,
    totalDeviation: score.deviation,
    variableCount: parts.variables.size
  };
}

export const TrainingToolSmartScheduleOptimizer = {
  optimizeSchedule
};
