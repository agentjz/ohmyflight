---
name: ieb-http-flight-stats
description: 开发、探测或维护 IEB 飞行经历与起落数的纯 HTTP 查询客户端和本地工作台。用户提到手工导入 Cookie/cURL、不使用 Playwright、串行飞行时间/经历/左座经历/起落数查询、原版与去分钟版 Excel 时使用；门户 DOM 自动化仍使用 flight-portal-probe。
---

# IEB HTTP 飞行经历查询

用于 `public/tool/app/http-flight-stats-helper/` 及同类只读 HTTP 查询。先读 `AGENTS.md`、`spec/dev/http-flight-stats-helper/spec.md`；修改 Excel 时同时使用 `excel-dev`，修改页面时同时使用 `ui-clarity`。

涉及接口 URL、参数、响应或并发方式时，先读 [references/api.md](references/api.md)。接口改版后先用只读小样本重新探测，不凭旧字段继续查询。

## 产品边界

- 新 HTTP APP 与 Playwright 版 `flight-stats-helper` 并列，旧 APP 的代码、入口和行为保持不变。
- 用户自己维护已登录门户会话。工具只解析 `JSESSIONID` 与 `iebJSid`，不实现登录、扫码、验证码或 Cookie 刷新。
- 查询只读。任何门户录入、撤销、审批或状态修改都不属于本 skill 的授权范围。
- 凭据只保存在本地服务内存，不写文件、不进入日志、状态 JSON、Excel、fixture、截图或 Git；不要在回复或命令输出中复述值。
- 真实姓名、员工号、输入 Excel、门户响应原文和结果文件不得进入仓库。测试使用虚构身份和脱敏 HTML。

## 固定业务契约

- 前端保留四个预设：飞行时间+起落数、飞行经历+起落数、左座经历+起落数、全部数据。前三项可组合，全部数据是全选快捷项。
- 每名员工只查询一次完整结果，预设只筛选输出列；不得按范围重复请求门户。
- 每个前三类预设都必须包含“起落总数”。全部数据按页面动态表头输出全部可见字段。
- 输入沿用旧工具：员工号、可选姓名、开始日期、结束日期；重复员工只处理第一次；数据健康检查只提示有效性，不形成确认门槛。
- 页面阶段是验证凭据、数据健康检查、开始查询、终止；agent 保留 `/api/start` 全链路入口。
- 查询完成事件可逐人展示，向上滚动应暂停自动置底；最终 Excel 必须按原输入索引归位。
- 所有请求结束或终止后一次性生成原版和去分钟版。去分钟版只处理飞行时间、飞行经历和左座经历的 `H:MM`。

## 串行边界

- 所有人员严格按输入顺序逐个查询，页面没有并发数、并发开关或 worker 池入口。
- 所有查询复用凭据验证成功后保留的单个 `requests.Session`；不创建线程本地 Session，也不在线程间复制会话。
- 响应必须按动态表头解析，并精确匹配当前员工号；输入姓名非空时同时校验姓名。HTTP 200、有表格或有一行都不能单独代表成功。
- 登录失效后停止后续查询，未查询人员写明原因；不要无限重试。

## 维护顺序

1. 先用有效会话 GET 查询页，证明未跳回 `/login` 且 form 存在。
2. 用 1 条脱敏或授权真实输入确认一次查询的动态表头和身份归属。
3. 接口变化时先更新脱敏 fixture 和失败测试，再改 `portal_client.py`。
4. 查询策略变化先做少量受控实测，分别核对员工号、姓名、表头和结果行数；当前产品固定串行。
5. 用 owner 原始 Excel 回放时只输出汇总、耗时、字段和一致性，不打印人员数据。
6. 最后运行新工具局部测试以及仓库 build、typecheck、test、verify；检查结果目录、zip、敏感信息和 UTF-8 BOM。

## 代码地图

- `credentials.py`：只解析目标 Cookie。
- `input_data.py`：Excel/粘贴边界归一。
- `portal_client.py`：凭据验证、查询参数、单个 Session、登录失效和动态表格归属。
- `exporter.py`：范围筛选及最终双文件。
- `runner.py`：串行循环、中断、事件和原顺序结果。
- `manager.py`：内存 Session、阶段、批次线程和下载状态。
- `server.py`：loopback API 和静态资源。
- `web/`：人工工作台。
