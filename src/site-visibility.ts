// 站点入口发布开关只在这里维护；false 仅隐藏页面入口，不限制固定 URL。
const siteVisibility: SiteVisibilityConfig = {
    homepage: {
        patternGate: false,
        announcement: true,
        sponsorEntry: true
    },
    sponsorPage: {
        contributors: false
    },
    tools: {
        "training-workbench": true,
        "audit-king": true,
        "proof-king": true,
        "crew-match-name-id": true,
        "lock-entry-helper": true,
        "flight-stats-helper": true,
        "qualification-query-helper": true,
        "session-bill-check": true,
        "hotel-bill-check": true,
        "focus-crew": true,
        "crew-flight-stats": true,
        "oa-read-helper": true,
        "word-template-filler": true,
        "pdf-tool": true,
        "pdf-stamp": true,
        "image-tool": true,
        "text-joiner": true,
        "crew-extract-id": true,
        "personnel-structure-stats": true
    }
};

window.siteVisibility = siteVisibility;
