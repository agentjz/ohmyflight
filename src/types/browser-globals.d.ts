type XlsxGlobal = typeof import("xlsx-js-style");

interface SiteConfig {
  bgType: "none" | "image" | "video";
  bgImage: string;
  bgVideo: string;
}

interface HomePatternGateLogic {
  enabled: boolean;
  pattern: number[];
  appendNode(sequence: number[], node: number): number[];
  matches(sequence: number[]): boolean;
}

interface Window {
  tools: ToolItem[];
  announcement: SiteAnnouncement;
  skills: SkillItem[];
  HomePatternGateLogic: HomePatternGateLogic;
  XLSX: XlsxGlobal;
  WatchdogTheme?: {
    getTheme(): "light" | "dark";
    setTheme(theme: "light" | "dark"): "light" | "dark";
    toggleTheme(): "light" | "dark";
    storageKey: string;
  };
}

declare var tools: ToolItem[];
declare var announcement: SiteAnnouncement;
declare var skills: SkillItem[];

declare const CONFIG: SiteConfig;
declare const XLSX: XlsxGlobal;
declare const JSZip: any;
