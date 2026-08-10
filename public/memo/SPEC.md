# 备忘录规格

## 功能

备忘录集中展示飞行部日常工作中需要反复查询的业务记录。

用户从 ohmyflight 工具主页点击“备忘录”，在新标签页打开独立页面。页面与工具首页、开发者页和用户手册页共用双主题壳层。桌面端通过左侧导航切换备忘录，移动端通过命令栏中的折叠菜单切换；右侧显示对应 Markdown 正文、表格和图片。

命令栏搜索框按关键词检索全部备忘录正文。命中后左侧显示备忘录名称和上下文摘要，右侧打开首个命中项，滚动到首个命中位置并高亮正文中的全部命中词；点击其他搜索结果可切换到对应全文。清空搜索后恢复完整导航和普通正文显示。

页面地址中的 hash 记录当前备忘录，可以直接打开指定内容。

## 当前内容

| 备忘录 | 内容 |
| --- | --- |
| [每天看](./memos/01/MEMO.md) | 每天查看事项 |
| [资质录入、统计与发布](./memos/02/MEMO.md) | 资质录入、运行资格统计、技术等级变更统计和飞行门户资质发布 |
| [资质代码](./memos/03/MEMO.md) | 资质代码表 |
| [特殊机场资格代码](./memos/04/MEMO.md) | 特殊机场资格代码表 |
| [危险品培训录入](./memos/07/MEMO.md) | 危险品培训 OSM 系统录入模板 |

## 数据边界

- 页面是 GitHub Pages 静态子应用，不上传用户数据。
- 备忘录正文和图片随 ohmyflight 一起构建和发布。
- `MEMO.md` frontmatter 只提供文件元数据，页面正文和全文搜索不显示或索引这些字段。
- Markdown、HTML、CSS 和 JavaScript 文本统一使用 UTF-8 无 BOM。
- 业务备忘录与开发者页中的项目级 Agent Skill 相互独立；业务正文不放入 `.agents/skills/`。
- 备忘录复用 ohmyflight 的 Bootstrap、marked、构建、测试、Pages 和 MIT License，不维护第二套仓库基础设施。
- 桌面与移动端使用同一套搜索、导航和正文节点；响应式样式只改变布局和折叠状态，不复制业务逻辑。

## 当前结构

| 路径 | 用途 |
| --- | --- |
| `public/memo/index.html` | 页面入口 |
| `public/memo/site.css` | 页面样式 |
| `public/tool/support-shell.css` | 支持页面共享主题、顶栏和滚动条 |
| `src/tool/support-shell.ts` | 支持页面共享主题切换 |
| `public/memo/memos/` | 备忘录正文和图片附件 |
| `public/memo/MEMO_INDEX.md` | 备忘录人工索引 |
| `src/memo/memos-data.ts` | 页面导航索引 |
| `src/memo/search.ts` | 正文搜索和命中摘要 |
| `src/memo/site.ts` | Markdown 加载和渲染 |
| `.agents/skills/memo-dev/SKILL.md` | Agent 维护流程 |
| `tests/smoke/memo.test.ts` | 索引和图片资产验证 |
