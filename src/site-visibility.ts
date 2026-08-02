export interface SiteVisibilityConfig {
    homepage: {
        patternGate: boolean;
        announcement: boolean;
        sponsorEntry: boolean;
    };
    sponsorPage: {
        contributors: boolean;
    };
}

export const siteVisibility: SiteVisibilityConfig = {
    homepage: {
        patternGate: false,
        announcement: true,
        sponsorEntry: true
    },
    sponsorPage: {
        contributors: false
    }
};
