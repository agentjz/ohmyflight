import { TrainingToolUtils } from "./utils";

const Utils = TrainingToolUtils;

  type IgnoredPersonProjects = {
    name: string;
    projects: string[];
    ignoreAllProjects?: boolean;
    reason: string;
  };

  const IGNORED_PERSON_PROJECTS: IgnoredPersonProjects[] = [
    {
      name: "程春林",
      projects: [],
      ignoreAllProjects: true,
      reason: "自动过滤清单：不飞人员，所有资质均不用监控。"
    },
    {
      name: "宋云龙",
      projects: [],
      ignoreAllProjects: true,
      reason: "自动过滤清单：不飞人员，所有资质均不用监控。"
    },
    {
      name: "邢晓楠",
      projects: [],
      ignoreAllProjects: true,
      reason: "自动过滤清单：不飞人员，所有资质均不用监控。"
    },
    {
      name: "沈欣",
      projects: ["航空安保", "TSA"],
      reason: "自动过滤清单：安保教员不用管航空安保和TSA。"
    },
    {
      name: "张鹏",
      projects: ["航空安保", "TSA"],
      reason: "自动过滤清单：安保教员不用管航空安保和TSA。"
    },
    {
      name: "王峰",
      projects: ["航空安保", "TSA"],
      reason: "自动过滤清单：安保教员不用管航空安保和TSA。"
    }
  ];

  const ignoreMap = new Map<string, {
    name: string;
    projects: Set<string>;
    ignoreAllProjects: boolean;
    reason: string;
  }>();
  IGNORED_PERSON_PROJECTS.forEach((item) => {
    const name = Utils.normalizeText(item.name);
    const projects = new Set(item.projects.map((projectName) => Utils.normalizeProjectName(projectName)));
    ignoreMap.set(name, {
      ...item,
      name,
      projects,
      ignoreAllProjects: Boolean(item.ignoreAllProjects)
    });
  });

  function getIgnoreReason(person: { name?: string; employeeId?: string } | null | undefined, projectName: unknown): string {
    const name = Utils.normalizeText(person && person.name);
    const canonicalProjectName = Utils.normalizeProjectName(projectName);
    if (!name || !canonicalProjectName) return "";

    const item = ignoreMap.get(name);
    if (!item || (!item.ignoreAllProjects && !item.projects.has(canonicalProjectName))) return "";
    return item.reason;
  }

  function shouldIgnore(person: { name?: string; employeeId?: string } | null | undefined, projectName: unknown): boolean {
    return Boolean(getIgnoreReason(person, projectName));
  }
  export const TrainingToolTrainingIgnoreList = {
    IGNORED_PERSON_PROJECTS,
    shouldIgnore,
    getIgnoreReason
  };
