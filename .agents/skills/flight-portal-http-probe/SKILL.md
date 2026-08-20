---
name: flight-portal-http-probe
description: 探测、复用或维护 IEB 飞行门户纯 HTTP 接口与本地 HTTP 工作台，包括 Cookie/cURL 会话、请求参数、响应解析、飞行经历查询和非生产任务锁班状态动作。用户要求不使用 Playwright、分析 Network 请求、构造 requests/httpx 客户端或维护 HTTP 前缀 APP 时使用；页面 DOM 探测使用 flight-portal-playwright-probe。
---

# 飞行门户 HTTP 接口探针

用于把已登录门户中的真实请求还原为结构化 HTTP 客户端。它统一技术方法，不合并业务授权：飞行经历是只读查询，锁班提交、通过、撤销、解锁和否决是写操作。

## Reference 路由

- 每次 HTTP 探测都先完整读取 [会话与探测方法](references/session-and-probing.md)。
- 非生产任务锁班接口、动态类型、时间模式、查询、通过、撤销、解锁或冲突恢复：读取 [锁班接口事实](references/lock-entry-api.md)。维护锁班本地 APP 时再读取 [锁班工作台约束](references/lock-entry-workbench.md)。
- 飞行时间、飞行经历、左座经历与起落数查询：读取 [飞行经历接口事实](references/flight-stats-api.md)。维护对应本地 APP 时再读取 [飞行经历工作台约束](references/flight-stats-workbench.md)。
- 需要观察页面按钮、DOM、frame、表头来源或录制 Network 时，同时使用 `flight-portal-playwright-probe`。
- 涉及 Excel 时同时使用 `excel-dev`；正式修改工具时同时使用 `watchdog-dev`，涉及页面时再使用 `ui-clarity`。

## 共同行为

1. 先确认当前会话有效，并区分登录页、HTTP 错误和业务失败；HTTP 200 不是成功证据。
2. 从真实页面 Network、用户提供的 Copy as cURL 或现有生产代码取得 URL、方法、Headers、Query、Body 和响应格式，不凭相邻接口猜字段。
3. cURL 只作为文本解析，不作为命令执行；请求用结构化 params/form/json API 构造，重复 key 使用 tuple 列表保留。
4. 检查 Cookie、CSRF、隐藏字段、动态签名、Referer、Origin、XHR Header 和页面初始化依赖，并区分已验证事实与当前未观察到。
5. 响应按 HTML/JSON 结构解析，按员工号、可选姓名、类型、日期时间和记录状态精确归属；不取第一行代替目标。
6. 只读接口先用一个小样本验证，再批量。当前 HTTP 锁班与飞行经历 APP 都保持严格串行，不新增并发入口。
7. 状态变更只在 owner 对当前样例和动作明确授权时执行；动作前唯一定位，动作后重新查询确认状态。
8. 探针、Cookie、原始响应、真实人员和临时结果只放系统临时目录，结束后删除，不进入仓库。

## 维护边界

- HTTP 技术层只替换浏览器渲染和 DOM 操作，不擅自改变输入、类型、日期、额度、结果、冲突、导出或用户分步习惯。
- 登录由用户维护。工具不实现扫码、验证码或自动刷新，也不声称 `document.cookie` 能导出 HttpOnly Cookie。
- 凭据只存在监听 `127.0.0.1` 的本地后端内存，不回显、不写 localStorage、日志、状态 API、Excel、fixture、截图或 Git。
- 门户结构变化、登录失效、表头缺失、归属不唯一或接口响应契约异常时停止当前记录，不通过旧字段、固定 ID 或无限重试掩盖变化。
