# 站点入口显示配置

站点维护者只需编辑 `src/site-visibility.ts`：

- `homepage.patternGate` 控制首页图案门禁。
- `homepage.announcement` 控制首页公告。
- `homepage.sponsorEntry` 控制公告是否链接案例与贡献页面。
- `sponsorPage.contributors` 控制是否展示贡献人员名单。
- `tools` 中每个工具的布尔值控制该工具是否进入首页列表、搜索和分类计数。

工具开关设为 `false` 后，固定工具地址仍然可以访问。该配置用于整理发布入口，不是权限控制。
