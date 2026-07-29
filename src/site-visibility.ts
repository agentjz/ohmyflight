// 首页交互和赞助页开关集中维护；工具目录只由 tools-data.ts 决定。
const siteVisibility: SiteVisibilityConfig = {
    homepage: {
        patternGate: false,
        announcement: true,
        sponsorEntry: true
    },
    sponsorPage: {
        contributors: false
    }
};

window.siteVisibility = siteVisibility;
