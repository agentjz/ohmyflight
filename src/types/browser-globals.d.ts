type XlsxGlobal = typeof import("xlsx-js-style");

interface SiteConfig {
  bgType: "none" | "image" | "video";
  bgImage: string;
  bgVideo: string;
}

interface Window {
  tools: ToolItem[];
  skills: SkillItem[];
  XLSX: XlsxGlobal;
  WatchdogTheme?: {
    getTheme(): "light" | "dark";
    setTheme(theme: "light" | "dark"): "light" | "dark";
    toggleTheme(): "light" | "dark";
    storageKey: string;
  };
}

declare var tools: ToolItem[];
declare var skills: SkillItem[];

declare const CONFIG: SiteConfig;
declare const XLSX: XlsxGlobal;
declare const JSZip: any;
