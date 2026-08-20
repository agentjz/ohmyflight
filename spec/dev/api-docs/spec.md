# API 文档开发规格

## 产品边界

API 文档是 watchdog 内嵌的 HTTP 接口事实导航，主要职责是完整展示门户页面导航地址、真实请求 URL、方法、Cookie、Headers、参数、内部请求链路、响应契约和脱敏示例。单次真实调试是用于验证文档事实的附属能力，不承担批量查询、批量锁班、智能类型互换、冲突恢复或自动通过等业务工作台职责。

API 文档保持独立 APP 目录、站点构建入口和本地 `start.py`，但不注册到 `src/tool/tools-data.ts`，不生成工具卡片或独立 ZIP。用户入口固定在工具首页顶栏原“开发者”位置。

在线静态页面与本地 `start.py` 使用同一套 HTML、CSS、浏览器模块和目录 JSON。静态页面始终完整展示文档；本地后端连接成功并验证 Cookie 后，才启用参数和真实发送控件。页面不提供 Mock，不实现登录、验证码、Cookie 刷新或任意 URL 代理。

页面顶栏提供“导出 Markdown”。导出不依赖本地后端，读取当前已经加载的两份目录生成单个 `watchdog-api-docs.md`：正文按认证、模块、业务接口、Headers、参数、响应、内部请求链路和技术说明组织；附录包含模块索引及每个模块的原始 JSON。导出不得读取 Cookie 输入框、会话状态、真实响应或人员数据。

## 信息架构

左侧顶层只有独立的“Cookie 管理”和可折叠的“飞行门户”。飞行门户下只有两个业务接口：

- 飞行经历查询
- 飞行人员锁班

系统名、模块名、分组名和接口名不重复堆叠。GET、POST 只作为方法标记。接口正文优先展示导航地址和 HTTP 请求地址，再展示 Cookie、Headers、全部参数、调用示例、响应契约、内部请求链路和技术说明。

内部请求链路不使用折叠控件。每个请求作为永久展开的语义化操作区块，固定展示序号、业务环节、技术 ID、方法、完整 URL、全部参数及数量、用途和响应契约。请求详情按“请求参数、用途、响应契约”纵向单列排列，参数也一项一行；不能为了视觉简化删除技术事实。

## 接口目录

`public/tool/app/api-docs/catalog/index.json` 是模块索引。`flight-stats.json` 和 `lock-entry.json` 各自只暴露一个业务 endpoint，并通过相同的 `systemId=flight-portal` 归属于飞行门户。模块 JSON 是 URL、方法、Headers、参数、响应契约与内部调用链的唯一接口事实源；浏览器文档、Python 后端和 Markdown 导出直接读取同一目录，不分别维护字段表。前端只能提交完整接口 ID 和业务参数，不能覆盖基础地址、路径或方法。

Cookie 管理页提供模块索引 JSON 链接，每个接口页提供对应模块 JSON 链接。JSON 是页面展示与本地执行器共同读取的完整事实源，供人直接查看，也供 AI 或其他程序结构化读取；页面不得再维护一份内容不同的接口说明。

目录中的 `internalRequests` 保留业务 endpoint 背后的所有已确认请求事实。飞行经历保留查询页和查询请求；锁班保留录入页、员工校验、额度、提交、查询分页、通过、撤销、解锁和否决。内部请求用于文档说明，不成为并列业务入口。

动态锁班类型来自：

```text
GET /newieb/nonproductionTask/showNonproductionTaskImportPage
```

有效响应必须包含 `#nonproductionTaskImportForm` 和 `#lockType`。适配器解析当前 `option[value]` 的代码、可见名称、`class` 限制标记和 `id` 日期拆分标记。`getLoginEmpProfileValidForOperationResource` 返回操作权限资源，不是锁班类型接口，不进入目录。

## 本地执行器

`start.py` 启动只监听 `127.0.0.1` 的本地服务：

```text
GET    /api/health
GET    /api/catalog
POST   /api/session
DELETE /api/session
GET    /api/options/lock-types
POST   /api/execute
```

`POST /api/session` 接受 Cookie Header 或浏览器 Copy as cURL，只保留 `JSESSIONID` 和 `iebJSid`。适配器通过飞行经历查询页验证会话，不在此阶段读取锁班类型。验证成功响应只向发起请求的当前页面返回一次规范化 Cookie Header，页面在 Cookie 管理区展示并允许复制；`GET /api/health` 和其他状态响应不返回凭据。凭据只存在 Python 进程内存和当前页面 DOM，不写文件、不进入浏览器持久化存储。

页面初始化检测到本地执行器后立即调用 `DELETE /api/session`，清除后端 Cookie、动态选项缓存与保活状态，然后以“Cookie 未验证”开始。页面刷新或重新打开不会接管后端旧会话；主动清除或后端判定失效时，页面同步隐藏已展示 Cookie。

验证成功后，飞行门户适配器启动后台保活线程。每轮重新生成 `1-60` 秒随机间隔，只 GET 飞行经历查询页并验证查询表单；请求不携带员工号、不查询业务数据、不执行写操作。保活与真实调试共用请求锁，所有门户请求仍严格串行。登录页响应会清空会话并停止保活；临时连接异常只记录脱敏状态并在下一轮重试。

`GET /api/options/lock-types` 只在用户进入锁班接口且会话有效时调用录入页，并缓存当前会话的动态类型。Cookie 验证成功只说明凭据有效，不返回或提示锁班类型数量。

`POST /api/execute` 只允许 `flight-stats.query` 和 `lock-entry.submit`：

- 飞行经历查询按目录构造完整 GET Query，按表头解析 HTML 表格并按员工号唯一归属。
- 锁班提交先读取动态类型、校验员工并取得门户姓名与部门，再派生类型名称、日期拆分标记和锁班天数，最后提交一次完整表单。

锁班提交结果按门户 Flexigrid 结构解析：表头来自 `.hDiv th`，数据行来自 `.bDiv tbody tr`，不能只读取结果区域的第一个 `table`。普通结果与冲突结果分别解析；原始 HTML 始终保留，解析异常通过结构化摘要明确显示。

执行器按目录 `systemId` 路由系统适配器。飞行门户的 Session、认证验证、请求编排和响应解析位于 `api_docs/systems/flight_portal.py`；未来 OA、天健等系统使用各自目录、凭据和适配器，不共享飞行门户 Session。

统一响应包含接口 ID、方法、HTTP 状态、耗时、最终地址、Content-Type、去除 Cookie 的 Headers、结构化 `data` 和原始 `body`。结构化 `data` 含摘要与表格；HTTP 200 不代表锁班业务成功。

## 页面模块

- `catalog-view.mjs`：HTTP 文档、内部链路和 cURL/Python 示例。
- `markdown-export.mjs`：人类可读 Markdown 正文、机器可读 JSON 附录和单文件下载。
- `parameter-form.mjs`：友好参数控件、条件字段和动态选项。
- `response-view.mjs`：表格、结构化 JSON、原始响应和 Headers 四种视图。
- `app.mjs`：目录选择、会话状态、事件和本地 API 接线。

后端不可用时文档保持完整，Cookie、参数和发送按钮灰置，不增加“仅查看”等模式标题。后端连接、Cookie 验证和错误通过 toast 提示。写接口使用明确的写操作标识和危险状态按钮；点击发送只执行一次，不自动重试或编排后续状态动作。

Cookie 管理页和接口调试栏持续显示最近验证时间及保活状态。浏览器每 3 秒读取本地 `/api/health`，不直接访问门户；后端报告 Cookie 失效后，参数和发送按钮自动禁用。

## 交付与验证

站点构建产物包含 API 文档静态页面、目录 JSON、Python 后端和依赖清单，但不生成 `api-docs.zip`。自动测试覆盖两个业务 endpoint、完整内部链路、凭据不回显、Cookie 验证与类型加载解耦、动态类型解析、员工校验、派生字段、结构化响应、Markdown 完整性、服务路由和页面交付。

接口契约、Cookie 生命周期、参数构造、动态选项或响应解析发生修改时，自动测试只能用于防回归，必须再使用 owner 当次授权的真实生产 Session 和真实数据验证才能判定有效。只读接口使用最小样本；写接口必须取得当前对象、日期、时段、类型、备注和动作授权，并按业务字段唯一归属真实响应。真实 Cookie、身份、记录 ID 和响应不得进入仓库。
