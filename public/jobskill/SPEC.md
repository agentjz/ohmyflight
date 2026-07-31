# Jobskill Spec

## 功能

Jobskill 集中展示飞行部日常工作中需要反复查询的业务 Skill。

用户从 ohmyflight 工具主页点击“技能”，在新标签页打开 Jobskill。页面与工具首页、开发者页和用户手册页共用新拟物双主题壳层，默认使用白天模式并支持在顶栏切换主题；搜索框使用内凹样式，页面和正文滚动区域提供可见的细滚动条。桌面端通过左侧导航切换 Skill，移动端通过命令栏中的折叠菜单切换；右侧显示对应 Markdown 正文、表格和图片。

命令栏搜索框按关键词检索全部 Skill 正文。命中后左侧显示 Skill 名称和上下文摘要，右侧打开首个命中 Skill，滚动到首个命中位置并高亮正文中的全部命中词；点击其他搜索结果可切换到对应全文。清空搜索后恢复完整 Skill 导航和普通正文显示。

页面地址中的 hash 记录当前 Skill，可以直接打开指定内容。

## 当前内容

| Skill | 内容 |
| --- | --- |
| [每天看](./skills/01/SKILL.md) | 每天查看事项 |
| [资质录入、统计与发布](./skills/02/SKILL.md) | 资质录入、运行资格统计、技术等级变更统计和飞行门户资质发布 |
| [资质代码](./skills/03/SKILL.md) | 资质代码表 |
| [特殊机场资格代码](./skills/04/SKILL.md) | 特殊机场资格代码表 |
| [飞行人员资质笔记](./skills/05/SKILL.md) | 副驾驶、机长和教员资质笔记 |
| [重新获得资格训练](./skills/06/SKILL.md) | 重新获得资格训练和熟练检查不合格处理 |
| [危险品培训录入](./skills/07/SKILL.md) | 危险品培训 OSM 系统录入模板 |

## 数据边界

- 页面是 GitHub Pages 静态子应用，不上传用户数据。
- Skill 正文和图片随 ohmyflight 一起构建和发布。
- `SKILL.md` frontmatter 只提供文件元数据，页面正文和全文搜索不显示或索引这些字段。
- Markdown、HTML、CSS 和 JavaScript 文本统一使用 UTF-8 无 BOM。
- Jobskill 与开发者页中的 Agent Skills 相互独立：前者是业务查询内容，后者是 AI 维护流程。
- Jobskill 复用 ohmyflight 的 Bootstrap、marked、构建、测试、Pages 和 MIT License，不维护第二套仓库基础设施。
- 桌面与移动端使用同一套搜索、导航和正文节点；响应式样式只改变布局和折叠状态，不复制业务逻辑。

## 当前结构

| 路径 | 用途 |
| --- | --- |
| `public/jobskill/index.html` | 页面入口 |
| `public/jobskill/site.css` | 页面样式 |
| `public/tool/support-shell.css` | 支持页面共享主题、顶栏和滚动条 |
| `src/tool/support-shell.ts` | 支持页面共享主题切换 |
| `public/jobskill/skills/` | Skill 正文和图片附件 |
| `public/jobskill/SKILL_INDEX.md` | Skill 人工索引 |
| `src/jobskill/skills-data.ts` | 页面导航索引 |
| `src/jobskill/search.ts` | 正文搜索和命中摘要 |
| `src/jobskill/site.ts` | Markdown 加载和渲染 |
| `.agents/skills/jobskill-dev/SKILL.md` | Agent 维护流程 |
| `tests/smoke/jobskill.test.ts` | 索引和图片资产验证 |
