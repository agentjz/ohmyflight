---
name: training-workbench
description: watchdog 培训皇帝/培训工作台专属开发引导。用于修改培训有效期、排班总览、排班后资质压力、实际培训负载、CRM 年度核对、培训 Excel 解析导出、培训测试或培训 spec 时。
---

# Training Workbench

本 skill 只做培训模块开发引导；具体业务事实写在 `spec/dev/training-workbench/`，用户操作方法写在 `spec/user/training-workbench/manual.md`。

## 先读

- 通用开发方法：`.agents/skills/watchdog-dev/SKILL.md`
- 培训总览事实：`spec/dev/training-workbench/spec.md`
- 培训规则事实：`spec/dev/training-workbench/training-rule-spec.md`
- 用户操作手册：`spec/user/training-workbench/manual.md`

## 大方针

- 不凭记忆改培训规则；先确认 spec、测试和当前代码。
- 培训工具只呈现已确认事实，不替用户发明新业务规则。
- 具体口径放 spec，工作方法放 skill，仓库入口放 `AGENTS.md`。
- 排班总览、有效期更新、统计图和 CRM 可能是不同口径；改动前先确认数据来源和影响范围。
- 新事实替代旧事实时，只保留新事实；不要为旧名称、旧字段或旧口径保留兼容层，除非 owner 明确要求。

## 改动要求

- 涉及培训规则、Excel 解析、日期判断、导出结构、忽略清单或回归问题时，同步代码、测试和 spec。
- 优先沿用现有模块结构，不顺手重构无关培训代码。
- 有真实培训表时可做本地回放，但真实业务 Excel 不能成为仓库测试依赖，也不能提交。

## 当前模块边界

- `rule-engine.ts`：有效期、窗口和排班规则判断。
- `schedule-assessment.ts`：把人员有效期、项目安排和规则汇总成排班状态、筛选项与统计摘要。该文件虽长，但当前变化原因仍是同一排班评估模型，不因行数单独拆分。
- `workbench.ts`：组织工作台扫描、筛选和导出。
- `qualification-pressure.ts`：复用当前轮次覆盖判断，按全部或单个资质项目预测排班执行后的下一轮最晚完成月份，输出总体趋势、项目构成和人员明细的统一数据。
- `training-load.ts`：按全部或单个培训项目统计项目及 CRM 的月度人天和班次；原始记录数只作为内部核对数据。
- `crm-annual.ts`：独立维护 CRM 年度参加核对，不并入资质有效期判断。
- `app-*.ts`：页面接线、状态、渲染、图表和交互，不承载培训规则。
- `app.ts` 是培训主页唯一生产入口，`rule-reference.ts` 是规则速查页唯一入口；内部模块通过局部 runtime 接口显式连接，不注册浏览器全局命名空间。

只有当一个文件同时出现不同业务口径、独立状态生命周期或独立外部边界时才拆分。不要因为文件超过 300 行就机械拆开，也不要把规则计算重新塞回页面渲染文件。

## 验证

按影响范围先跑相关测试，再跑：

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```
