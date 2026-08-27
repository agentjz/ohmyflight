export interface SiteVisibilityConfig {
    homepage: {
        announcement: boolean;
        sponsorEntry: boolean;
    };
    sponsorPage: {
        contributors: boolean;
    };
}

export const siteVisibility: SiteVisibilityConfig = {
    homepage: {
        announcement: true,
        sponsorEntry: true
    },
    sponsorPage: {
        contributors: false
    }
};
