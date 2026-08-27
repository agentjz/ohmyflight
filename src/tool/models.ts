export type ToolStatus = "done" | "wip";
export type ToolCategory = "heavy" | "light" | "automation";
export type ToolHomepageState = "enabled" | "beta" | "cooling";

export interface ToolItem {
  name: string;
  desc: string;
  entry: string;
  status: ToolStatus;
  category: ToolCategory;
  homepageState?: ToolHomepageState;
  homepageVisibility?: "hidden";
}

export interface SkillItem {
  name: string;
  description: string;
  source: string;
  path: string;
}
