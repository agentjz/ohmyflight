# 站点入口显示配置

站点维护者只需编辑 `src/site-visibility.ts`：

- `homepage.patternGate` 控制首页图案门禁。
- `homepage.announcement` 控制首页公告。
- `homepage.sponsorEntry` 控制公告是否链接案例与贡献页面。
- `sponsorPage.contributors` 控制是否展示贡献人员名单。

工具清单不使用显示开关，`src/tool/tools-data.ts` 中登记的工具会直接进入首页、搜索和分类计数。页面级配置用于整理入口呈现，不是权限控制。
