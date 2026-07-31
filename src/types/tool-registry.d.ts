type ToolStatus = "done" | "wip";
type ToolCategory = "heavy" | "light" | "automation";
type ToolHomepageState = "enabled" | "beta" | "cooling";

interface ToolItem {
  name: string;
  desc: string;
  entry: string;
  status: ToolStatus;
  category: ToolCategory;
  homepageState?: ToolHomepageState;
}

interface SiteAnnouncement {
  message: string;
  href?: string;
}

interface SkillItem {
  name: string;
  description: string;
  source: string;
  path: string;
}

interface ManualItem {
  name: string;
  description: string;
  source: string;
  path: string;
}

declare const manuals: ManualItem[];

