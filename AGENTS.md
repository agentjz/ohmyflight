# cargodog Agent 工作规约

本文件是仓库地图和最高约束。具体开发方法看 `.agents/skills/`，具体业务事实看 `spec/`。

## 基础约束

- 始终使用简体中文和项目 owner 交流。
- 仓库文本文件统一使用 UTF-8 无 BOM；发现 BOM 或其他可清洗的编码问题时直接规范源文件，不在读取端保留兼容分支。
- 阅读本仓库文本文件时按 UTF-8 读取；PowerShell 中文显示乱码时，不要误判文件损坏。
- PowerShell here-string 或管道把含中文字符串的脚本传给 `node`、`python` 等命令时，中文字面量可能被终端编码污染成问号；涉及中文路径、sheet 名、表头、分类名的验证脚本，不要依赖命令文本里的中文字符串，优先用文件扫描、索引、表头读取结果或 UTF-8 脚本文件来定位。
- 在 PowerShell 中运行 Node/npm 命令时使用 `npm.cmd`、`npx.cmd`，不要直接用 `npm`、`npx`。
- 不回滚用户已有改动，除非 owner 明确要求。
- 遇到脏工作区，只处理当前任务相关文件。

## 事实纪律

- 事实高于一切。所有判断、计划、代码修改和回复必须基于仓库代码、spec、测试、命令输出、用户提供的数据/截图/文本或可复现运行结果。
- 必须区分：已确认事实、用户提供事实、未验证推测、计划事项、已完成并验证事项。
- 事实不清楚时先排查；无法排查时明确说明不确定。
- 任何会影响生产数据、业务规则、导出结果、自动化提交或用户工作流的不明确事项，都必须向 owner 确认后再执行；不能猜测、预测或用自信语气替代确认。
- 存在疑问时，回复必须明确列出“已确认”和“仍不明确”的内容。
- 不编造功能、数据、接口、页面行为、测试结果或业务规则。
- 文档只写当前事实，不写历史过程、未来计划或未经验证的推测。

## Skills

- 项目级 skill 放在 `.agents/skills/`。
- 任务命中 skill 描述时，必须先读对应 `SKILL.md`。
- 中大型开发、跨模块重构、工具下线、测试结构整理或生产级验收闭环时，看 `.agents/skills/plan/SKILL.md`，并维护根目录 `plan.md`。
- 新增或修改工具、业务规则、spec、测试、构建时，看 `.agents/skills/cargodog-dev/SKILL.md`。
- 涉及培训皇帝/培训工作台/培训 Excel/培训规则时，看 `.agents/skills/training-workbench/SKILL.md`。
- 涉及页面 UI、表格、卡片、筛选区、结果区、统计摘要或用户指出页面混乱难看时，看 `.agents/skills/ui-clarity/SKILL.md`。
- 涉及 Excel 读取、导出、表头映射、日期解析或 openpyxl/SheetJS 时，看 `.agents/skills/excel-dev/SKILL.md`。
- 涉及 IEB/飞行门户、Playwright 页面探测、员工号查询、技术等级/运行资格抓取或 Excel 批量写回时，看 `.agents/skills/flight-portal-probe/SKILL.md`。
- 涉及两本 Word/PDF 手册的新增、删除和修改比对时，看 `.agents/skills/compare-manuals/SKILL.md`。
- 涉及《飞行人员训练大纲》的训练课程、课时、检查、资格保持恢复或版本复核时，看 `.agents/skills/read-flight-training-program/SKILL.md`。
- 涉及《飞行技术管理手册》的技术等级、资格、聘任、检查、档案或版本复核时，看 `.agents/skills/read-flight-technical-management-manual/SKILL.md`。
- 涉及菜鸟教程正文、知识结构、手册版本更新、来源或页面测试时，看 `.agents/skills/beginner-tutorial-dev/SKILL.md`。
- 涉及 docx 读取、分析、修改或生成时，看 `.agents/skills/docx-report/SKILL.md`。
- 涉及面试人员名单整理成锁班导入模板时，看 `.agents/skills/interview-lock-list/SKILL.md`。
- 涉及人员结构统计和 Word 报告结果核对时，看 `.agents/skills/personnel-report-check/SKILL.md`。
- 涉及备忘录业务子站、日常备忘录正文、图片附件、导航或索引时，看 `.agents/skills/memo-dev/SKILL.md`。
- 如果 skill 和 owner 当前明确需求冲突，以 owner 当前需求为准，并说明冲突点。

## Spec、测试与完成标准

- `spec/dev/` 是开发规格和业务规则记录位置，`spec/user/` 是用户操作手册记录位置。
- 代码、测试、文档必须同步；任何一方还在描述旧事实，任务就没完成。
- 修改业务规则、解析规则、日期规则、导出结构或修复回归时，必须优先补充或更新测试。
- 测试保护核心规则，不为了 UI 细节、目录形状或临时实现写脆弱测试。
- 不写“某段旧代码不得出现”“某个内部字段不得出现”这类负向保护测试，除非它对应真实业务可观察回归。
- 仓库发生代码改动后，收尾前必须运行全量测试；无法运行时必须说明原因和风险。
- 不能只凭解释声称完成，必须说明验证结果。

## 文件职责

- 单一职责看变化原因，不看行数。
- 超过 300 行必须触发职责审查，但不是自动拆分理由。
- 能一句话说清职责、变化原因一致、内部耦合合理，可以保留。
- 状态管理、规则计算、数据读写、渲染展示、外部接线、错误处理、业务判断混在一起时，必须拆清边界。
- 不为了拆而拆，不为了省事硬塞。

## 工程取舍

- 工程化服务于真实维护，不为了展示技术增加框架、层级、配置或强制模板。
- 优先减少重复入口、隐含契约和无法自动发现的错误；不要把动态业务数据机械包装成复杂类型只为追求指标。
- 全部 TypeScript 使用同一类型检查配置；动态 Excel、图表和第三方库边界可以保持必要弹性，稳定业务模型应尽量使用明确结构。
- 当前 `tsconfig.json` 为兼容既有动态浏览器模块保留 `noImplicitAny: false`，因此不能把“类型检查通过”表述为“全仓无隐式 any”。新增或修改的稳定业务函数必须写明参数和返回结构，不继续扩大隐式 any；不要用批量补 `any` 的方式追求表面指标。
- 浏览器工具保持静态、本地优先和按工具独立；引入新框架或构建层前必须证明它能显著降低当前维护成本。
- 每个 Python 自动化脚本是可独立分发的完整 APP，不为了代码复用拆成多文件包；跨脚本重复只有在确实降低使用和维护成本时才处理。

## 运行证据

- 用户给了原始输入时，优先用原始输入复现。
- `start_index.py` 由 owner 手动启动；agent 不得将其作为后台常驻服务。确需验证时只允许临时使用 `--no-open` 启动，并在验证结束后立即终止本次启动的进程、确认监听端口已释放。
- 表格、文本解析、日期和姓名问题，要查看中间值，不只看最终现象。
- 浏览器自动化问题要分清输入解析、DOM 选中值、页面显示值、实际提交值。
- 内网系统无法访问时，以用户提供的 HTML、截图、日志和本地代码为事实来源。
- 前端视觉效果由 owner 人工检查；agent 只做构建、测试和静态页面连通性验证。

## 仓库入口

- 本项目是静态浏览器工具集合。
- 源码主要在 `src/`，静态页面和本地库主要在 `public/`，构建产物输出到 `dist/`。
- 工具入口数据在 `src/tool/tools-data.ts`。
- 首页入口在 `public/index.html`，实际工具首页在 `public/tool/index.html` 和 `src/tool/`。
- 工具页在 `public/tool/app/<tool>/`，源码在 `src/tool/app/<tool>/`。
- 备忘录独立子站在 `public/memo/`，页面逻辑在 `src/memo/`。
- 开发规格在 `spec/dev/<tool>/`，用户手册在 `spec/user/<tool>/manual.md`，测试在 `tests/tool/`。

## 常用命令

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify
npx.cmd vitest run tests/tool/<name>.test.ts
```

## 提交与推送

- 提交信息必须使用简体中文。
- 提交信息写成一个不分段、不换行的完整段落，可以包含多句话；必须具体说明本次提交实际修改了什么和带来的行为变化，不用一句话强行概括。
- 提交前确认暂存区只包含本次任务相关文件。
- 不提交真实业务数据、临时本地文件、探测脚本输出或无关脏改动。

## 收尾回复

- 最终回复保持简洁。
- 说明改了什么、验证了什么、是否还有风险。
- 不粘贴大段日志、diff 或源码，除非 owner 明确要求。
