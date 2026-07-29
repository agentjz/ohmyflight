interface SiteVisibilityConfig {
  homepage: {
    patternGate: boolean;
    announcement: boolean;
    sponsorEntry: boolean;
  };
  sponsorPage: {
    contributors: boolean;
  };
  tools: Record<string, boolean>;
}

interface Window {
  siteVisibility: SiteVisibilityConfig;
}

declare var siteVisibility: SiteVisibilityConfig;
