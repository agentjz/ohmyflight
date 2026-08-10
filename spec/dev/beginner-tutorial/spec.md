# 菜鸟教程开发规格

菜鸟教程是工具首页第一项，用于集中发布《运行手册》《飞行人员训练大纲》《飞行技术管理手册》的阅读地图、规则核对路径和版本复核方法。它是独立静态工具，不读取或展示 `.agents/skills/*/SKILL.md`。

三本教程的唯一业务知识正文分别维护在：

- `spec/reference/flight-manuals/operations-manual.md`
- `spec/reference/flight-manuals/training-program.md`
- `spec/reference/flight-manuals/technical-management-manual.md`

构建按上述顺序生成 `dist/tool/beginner-tutorial-data.json`。每项保留独立正文的名称、说明、去除 YAML frontmatter 后的 Markdown 和仓库源路径。原始 Word/PDF 手册不进入仓库，教程是阅读导航，不替代用户提供的现行手册原文。

三个对应阅读 Skill 只维护触发、证据纪律和执行流程，使用时必须完整读取对应独立正文。章节地图、规则卡、数字口径和版本复核要求不得在 Skill 与页面源码中重复维护。

页面使用共享 `src/tool/document-library.ts` 完成数据校验、折叠列表、Markdown 懒渲染、相对链接修正和合并下载。用户手册页复用同一内核，但只读取 `manuals-data.json`；两个数据集不得互相混入。

页面接入 `public/theme.css`、`public/theme.js`、支持页壳和阅读样式。状态与表面使用完整边框，不使用彩色单边强调。
