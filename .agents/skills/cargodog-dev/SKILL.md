---
name: cargodog-dev
description: cargodog 仓库内新增或修改工具的一般开发流程，适用于前端工具、Python 小工具、Excel 解析导出工具、业务规则实现、入口注册、spec 文档、测试和构建收尾。
---

# cargodog Dev

在本仓库新增或修改工具时使用本 skill。

## 开发参考

- 先读 `AGENTS.md`，再看仓库里同类型的成熟 app，不要从零臆造结构。
- 前端 Excel 工具优先参考 `crew-flight-stats`、`hotel-bill-check`、`focus-crew`。
- 文本解析工具优先参考 `crew-match-name-id`、`text-joiner`。
- 大型前端模块优先参考 `training-workbench`。
- Python 工具优先参考 `lock-entry-helper`、`flight-stats-helper`、`oa-read-helper`。
- 工具入口看 `src/tool/tools-data.ts`，页面放 `public/tool/app/<tool>/`，源码放 `src/tool/app/<tool>/`。
- 涉及页面 UI 时同时读取 `.agents/skills/ui-clarity/SKILL.md` 和 `spec/dev/ui-theme/spec.md`；页面接入共享 `theme.js`、`theme.css`，专属 CSS 只维护布局和领域特判。

## 实现原则

- 具体业务规则写进 `spec/dev/<tool>/`，用户操作方法写进 `spec/user/<tool>/manual.md`，不要写进 skill。
- 代码、测试、文档三位一体同步；三者有一个还在描述旧事实，任务就没完成。
- 业务逻辑和页面渲染分开：解析、统计、规则判断放可测试的逻辑模块，页面只负责上传、展示、导出和状态提示。
- 浏览器内部模块使用标准 ESM 显式导入导出；每个 HTML 页面只连接一个应用入口，不通过 `window.*` 注册表或脚本标签顺序装配内部模块。
- 稳定业务测试直接导入 `src/` 模块；生产构建、第三方 UMD 接线和页面资源通过构建产物与确定性构建验证，页面视觉和交互由 owner 人工检查，不维护仓库级真实浏览器测试。
- Excel 和文本处理优先按表头、字段名、结构化数据定位，不要写死文件名、sheet 名、列号或示例值，除非 spec 明确要求。
- 输出给人核对的文件必须保留必要结果、口径和异常说明，不要堆无用噪音。

## 验证原则

- 不要被页面表象迷惑。数据统计、Excel 解析、文本匹配、日期规则这类功能，正确性主要看核心逻辑测试、真实样本回放和导出结构检查。
- 在 PowerShell 里用 here-string 或管道临时运行 Node/Python 脚本时，中文字符串可能变成问号；验证中文路径、sheet 名、表头、分类名时，优先用文件扫描、索引、实际读取到的表头或 UTF-8 脚本文件，不要让命令文本里的中文成为关键定位条件。
- 页面交互、资源加载和布局不替代核心逻辑测试；仓库级自动验证不启动真实浏览器，必须依赖浏览器 API 的生产工具按自身运行手册处理。
- UI 样式细节不作为核心测试对象；业务规则、解析规则、日期窗口、导出字段、曾经出错的回归点必须优先测试。
- 修改规则或修复回归时，优先把失败场景写进测试，再改实现。

## 收尾命令

按改动范围运行相关测试，然后收尾必须跑：

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify
```

如果只验证某个测试文件，可先跑：

```powershell
npx.cmd vitest run tests/tool/<name>.test.ts
```

PowerShell 可能因为执行策略拦截 `npm.ps1`，本仓库内优先使用 `npm.cmd` 和 `npx.cmd`。

## 提交前

- 检查 `git status --short`。
- 只暂存本次任务相关文件。
- 不提交真实业务 Excel、Word、临时探测脚本、临时输出文件或无关脏改动。
- 提交信息按 `AGENTS.md`：简体中文，一句话，不分段不分行。
