interface SiteVisibilityConfig {
  homepage: {
    patternGate: boolean;
    announcement: boolean;
    sponsorEntry: boolean;
  };
  sponsorPage: {
    contributors: boolean;
  };
}

interface Window {
  siteVisibility: SiteVisibilityConfig;
}

declare var siteVisibility: SiteVisibilityConfig;
