# 浏览器 ESM 交付与不可变核心边界

## 受保护边界

浏览器源码使用标准 ESM 显式依赖和按页面单入口生产构建。以下按工具列出的解析、规则、状态、排序、导出和文档结果是不可变业务边界；现有测试断言与金样共同作为证据。模块装配、类型或构建调整不得改变这些结果。

| 工具 | 受保护的核心 API 或结果 | 主要自动证据 |
| --- | --- | --- |
| 培训皇帝 | `Utils` 日期/文本归一，`Scanner` 工作簿识别，`TrainingRecordPolicy`，`RuleEngine`，`ScheduleAssessment`，`ScheduleGapCheck`，`PersonValidityQuery`，`TrainingCalendar`，`ScheduledDistribution`，`AnnualTrainingStats`，`CrmAnnual`，`WorkbookHealth`，`Validity`，`Workbench`，各 Excel 导出模型 | `tests/tool/training-workbench/` 及 owner 本地总表结果哈希 |
| 换季学习 | 工作簿读取与日期归一、健康检查、岗位与 Hook/过滤分组、确定性均衡、恢复与移动记录、导出排序/格式 | `tests/tool/seasonal-learning/` 3 个测试文件及 owner 本地换季表结果哈希 |
| 审计之王 | 稳定文档/块 ID、文本归一、精确与宽松检索、来源恢复、证据状态、工作簿、PDF 槽位、项目包、文件夹脚本 | `tests/tool/audit-king/` 及生成 DOCX 读取结果哈希 |
| 校对之王 | DOCX/PDF 读取、噪音过滤、文本切分、锚点和 1:N/N:1/N:M 对齐、事件分类排序、导航分组、人工决定、Excel/Word 报告、项目包 | `tests/tool/proof-king/` 及生成 DOCX 对比结果哈希 |
| 航线班次统计 | 名单顺序解析、文本姓名匹配、航线统计、未匹配单元格、人员顺序、导出行 | `tests/tool/crew-flight-stats/logic.test.ts` |
| 酒店皇帝 | 酒店账单/入住表读取、姓名与日期匹配、差异分类、导出工作簿结构 | `tests/tool/hotel-bill-check/export.test.ts` 与浏览器工作流 |
| 重点人员标注 | 表头识别、员工号归一、重点人员匹配、单元格样式与导出 | `tests/tool/focus-crew/logic.test.ts` |
| 姓名匹配员工号 | 文本姓名识别、员工号映射、未匹配/多匹配、编辑状态、Excel 与图片导出 | `tests/tool/crew-match-name-id/logic.test.ts` |
| 文本拼接助手 | 分隔符识别、空项处理、顺序与输出拼接 | `tests/tool/text-joiner/logic.test.ts` |
| 珠海皇帝 | 场次/账单表头读取、姓名规范化、人次统计、状态与图表输入 | `tests/tool/session-bill-check/logic.test.ts` |
| 人员结构统计 | 人员表识别、资质/年龄/性别/原单位等统计闭合、前 9 张 Word 表写回 | `tests/tool/personnel-structure-stats/` 2 个测试文件 |
| 图片工具 | 文件类型、Blob URL 生命周期、转换、压缩、裁剪、缩放和 Base64 输入输出 | `tests/tool/image-tool/shared.test.ts` 与浏览器工作流 |
| PDF 工具 | PDF 拆分、合并、转图片、图片转 PDF 的页序、尺寸和文件输出 | 浏览器工作流与第三方适配器启动测试 |
| PDF 加水印 | 页尺寸与水印位置换算、规则校验、页面渲染和导出 PDF | `tests/tool/pdf-stamp/logic.test.ts` |
| Word 模板填充器 | 配置字段解析、模板/循环/日期/批量填充、独立 HTML 生成与打包结构 | `tests/tool/word-template-filler/generated-batch.test.ts` |
| 锁班皇帝 | 下载页面、命令复制和 Python APP 文件边界；Python 业务实现不在重构范围 | 静态资源测试与 Python 测试 |
| 飞行经历/左座经历起落数按天统计 | 下载页面、命令复制和 Python APP 文件边界；Python 业务实现不在重构范围 | 静态资源测试与 Python 测试 |
| 技术等级运行资格查询助手 | 下载页面和 Python APP 文件边界；查询与 Excel 写回业务实现不在重构范围 | `tests/python/test_qualification_query_helper.py` |
| 自动点 OA 助手 | 下载页面、命令复制和 Python APP 文件边界；Python 业务实现不在重构范围 | 静态资源测试 |

## 金样与性能证据

- 迁移前全量测试基线：Vitest 62 个文件、253 项断言；Python unittest 7 项，全部通过。
- `legacy-build-baseline.json` 固化各 HTML 的应用脚本数、原始体积、gzip 体积和核心产物哈希。
- `legacy-performance.json` 固化四个重型页面的冷启动指标及固定输入工作流的耗时与结果 SHA-256；真实业务文件路径和内容不写入仓库。
- 自动业务测试的期望值是金样的一部分。迁移只可改为直接导入源码，不得删除、放宽或改变业务期望。
- 当前 owner 本地培训表、换季表和生成 DOCX 工作流的结果 SHA-256 分别为 `36f72df2caa826ef9d27246f90503da605437ba0ff5dc94a2496703ef6a86434`、`926d9695af95e4b6216dc0599eb4430fac9f0163484919ffee3902746eacdda3`、`123d95246be4bfb6ca84baf8090085de514468ea159485553f13ef684fdeacbd`、`eee5043dceb616b950ce2feb312425e97be943ebe461e306175db910efbce4ad`。

## 性能采样口径

- 固定 Windows 11 10.0.26200、Node 22.19.0、Python 3.12.10、Playwright 1.58.0、Chromium 145.0.7632.6。
- 每项先预热 1 次，再使用全新浏览器 context 正式采样 3 次，记录中位数、P95、最小值和最大值。
- 冷启动记录 wall time、Navigation Timing、DOMContentLoaded、脚本请求数、传输字节和 JS 堆。
- 关键工作流记录导入/文档读取/比对完成时间及业务可观察结果文本哈希。
- 设备计时预算使用基线中位数加 25% 与 100 ms 两者较大值作为允许噪声；结构预算要求每页仅 1 个应用入口脚本，业务结果哈希必须完全一致，任何 console error、pageerror 或 HTTP 失败均不允许。
- `npm.cmd run test:browser` 对生产构建的 27 个 HTML 执行真实 Chromium 启动检查，并用脱敏合成 Excel/DOCX 运行培训、换季、审计和校对关键流程。
- `npm.cmd run test:performance -- --training-workbook <培训表> --seasonal-workbook <换季表> --baseline spec/dev/esm-delivery/legacy-performance.json` 复现三次正式采样、结果哈希预算和五轮内存复核；真实输入与原始输出不进入仓库。
- 固定真实输入正式工作流中位数均在预算内，四项结果哈希与重构前金样一致；该性能证据未用于修改核心业务算法。
