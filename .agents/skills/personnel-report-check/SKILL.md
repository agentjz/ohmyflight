---
name: personnel-report-check
description: 核对人员结构统计和人员结构 Word 报告填充结果时使用。适用于人员信息 Excel、人员结构报告 docx、app.py 写回结果、统计口径闭合、资质代码映射和报告数据一致性核对。
---

# Personnel Report Check

本 skill 只写核对工作方法；具体业务口径、资质代码和统计规则以 `spec/dev/personnel-structure-stats/spec.md` 为准。

## 先读

- `.agents/skills/watchdog-dev/SKILL.md`
- `.agents/skills/docx-report/SKILL.md`
- `spec/dev/personnel-structure-stats/spec.md`
- `src/tool/app/personnel-structure-stats/app.py`
- `src/tool/app/personnel-structure-stats/logic.ts`

## 核对原则

- 不凭肉眼印象判断 Word 已写对；必须读取生成后的 docx 结构和单元格值。
- 不只抽查一个总数；至少核对前 9 张表的目标月份列、`本月变化`、`本月占比`。
- 有真实 Excel 和真实 docx 时，优先用真实样本跑一遍，再读回生成文件逐项比对。
- PowerShell 临时脚本里不要用中文字符串做关键定位条件；优先按表格索引、段落索引、实际读出的行列或 UTF-8 脚本文件核对。
- 真实业务 Excel、Word、生成报告和临时核对文件不要提交。

## 核对范围

人员结构报告只核对飞行部人员结构表格部分：

- 前 9 张表
- 写到 `空勤人员原单位情况` 为止

人员引进情况、其他部门、安全管理岗位表不属于该脚本写入范围。

## 必查项目

- Excel 是否识别到人员信息表头，而不是误读第一个说明 sheet。
- docx 是否至少有 9 张飞行部统计表。
- 脚本是否生成新文件，而不是覆盖原 docx。
- 目标月份列、`本月变化` 列、`本月占比` 列是否先清空再写入。
- 表内目标月份人数是否和计算结果一致。
- `本月变化` 是否按当前月减上月生成。
- `本月占比` 是否按当前母数生成。
- `其他`、未映射原单位、异常人员是否在日志中提示，不要静默吞掉。

## 推荐验证方式

1. 运行脚本生成新 docx。
2. 用 `python-docx` 读取新 docx。
3. 用脚本同一套计算函数读取 Excel 得到期望结果。
4. 按段落索引和表格索引逐项比较：
   - 表 1 到表 9：目标月份列和占比列
5. 如果比对失败，先判断是业务口径问题、模板结构变化问题，还是写入定位问题。

## 变更要求

- 资质代码映射、统计口径、表格写入范围发生变化时，先更新 `spec/dev/personnel-structure-stats/spec.md`。
- 修改脚本后，补或更新 `tests/tool/personnel-structure-stats/docx-app.test.ts`。
- 改动后至少运行：

```powershell
npx.cmd vitest run tests/tool/personnel-structure-stats/docx-app.test.ts tests/tool/personnel-structure-stats/logic.test.ts
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```
