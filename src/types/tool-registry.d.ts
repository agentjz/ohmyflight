type ToolStatus = "done" | "wip";
type ToolCategory = "heavy" | "light" | "automation";
type ToolHomepageState = "enabled" | "beta" | "cooling";
type ToolHomepageVisibility = "hidden";

interface ToolItem {
  name: string;
  desc: string;
  entry: string;
  status: ToolStatus;
  category: ToolCategory;
  homepageState?: ToolHomepageState;
  homepageVisibility?: ToolHomepageVisibility;
}

interface SkillItem {
  name: string;
  description: string;
  source: string;
  path: string;
}

