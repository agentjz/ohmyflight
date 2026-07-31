# 站点入口可见性开发规格

`src/site-visibility.ts` 只维护页面级入口开关。`homepage` 控制首页图案门禁、公告和宣传页入口，`sponsorPage` 控制贡献人员名单。

工具目录不经过可见性开关过滤，`src/tool/tools-data.ts` 中的全部工具直接进入首页列表、搜索集合和分类计数。

这些页面开关只控制入口呈现，不提供权限或安全隔离。工具名称、说明和公告正文继续由内容模块维护，贡献人员及其文案继续由 `public/sponsor/contributors.js` 维护；工具内部业务规则的 `enabled` 不属于此配置。
