# HTTP 飞行经历查询（新）开发规格

## 产品边界

`http-flight-stats-helper` 是与 `flight-stats-helper` 并列的独立 Python 本地 APP。用户自行从已登录 IEB 门户复制 cURL 或 Cookie Header，工具只提取 `JSESSIONID` 和 `iebJSid`，通过纯 HTTP 查询飞行经历，不启动 Playwright，不执行门户录入、撤销或其他写操作。

服务只监听 `127.0.0.1`。登录凭据只保存在当前 Python 进程内存，不进入状态响应、日志、Excel 或文件系统。一批完成后保留当前登录态，可更换输入继续查询；凭据失效时清除内存 Cookie 并提示重新验证。

## 已验证接口

- 凭据验证：`GET https://ieb.csair.com/newieb/flytime/showFlytimeManyQuery`。有效页面包含 `#showflyTimeExperienceQueryForm`，未登录会重定向到 `/login` 并出现 `#scanLogin`。
- 人员查询：`GET https://ieb.csair.com/newieb/flytime/showFlytimeManyQueryList`。
- 查询参数：`staffNum`、`activeStatusArray=ZAIZHI`、`dateType=5`、`startStr=YYYY-MM-DD`、`endStr=YYYY-MM-DD`、页面既有空筛选参数、`page=1` 和防缓存值。
- 当前接口没有已观察到的 CSRF Token、`__VIEWSTATE`、动态签名或 Authorization Header；查询请求不依赖预先执行页面初始化。
- 单名员工的一次响应同时返回页面全部可见字段。实测表头包含员工号、姓名、注册基地、运行基地、技术信息、开始日期、结束日期、飞行时间、飞行经历、航段数、夜航经历、左座经历、右座经历、模拟机、本场时间、起落总数、航线起落、本场起落和人工飞行时间。

## 输入与范围

- Excel 按表头读取员工号、姓名、开始日期和结束日期，继续支持“工号/员工编号”“员工姓名”“起始时间/开始时间”“截止时间/结束时间”等既有别名。
- 粘贴输入按行读取六位员工号、可选姓名和一个或两个明确日期。
- 无效数据只提示并跳过，不形成强制确认门槛；重复员工号只查询第一次。
- 查询范围为“飞行时间+起落数”“飞行经历+起落数”“左座经历+起落数”“全部数据”。前三项可组合；“全部数据”为全选快捷项。
- 范围只控制输出列。每名员工始终只发送一次完整查询，不为多个范围重复请求。

## 串行与归属

- 所有人员严格按输入顺序逐个查询，前一人请求结束后才开始下一人；页面不提供并发数或并发开关。
- 所有查询复用凭据验证阶段保留的单个 `requests.Session`，不创建线程本地 Session 或请求池。
- 每个响应必须按动态表头解析，并精确找到当前员工号的唯一同行；输入姓名非空时同时校验姓名。
- 完成事件按输入顺序逐人展示，最终结果保持原输入索引顺序。
- 登录失效后停止后续查询，未查询记录写明原因。

## 输出与阶段

- 人工阶段为：验证凭据、数据健康检查、开始查询、终止。`POST /api/start` 为 agent 保留验证、检查、查询全链路入口。
- 查询过程中逐人显示已返回结果，日志和结果区向上滚动后暂停自动置底。
- 查询期间不写结果 Excel。所有请求结束或终止后，一次性生成原版和去分钟版两个文件。
- 原版保留页面原值；去分钟版只把“飞行时间”“飞行经历”“左座经历”的 `H:MM` 转为小时部分。选择前三类任一范围时都必须包含“起落总数”。
- 输入错误保存在独立 sheet；失败和未查询人员保留输入身份、日期、状态和错误说明。

## 文件职责

- `credentials.py`：cURL/Cookie 脱敏解析。
- `input_data.py`：Excel/粘贴输入边界归一。
- `portal_client.py`：凭据验证、单个 Session、请求参数和动态表格归属。
- `exporter.py`：范围筛选与最终原版/去分钟版双文件。
- `runner.py`：串行循环、事件、中断、会话失效和原顺序结果。
- `manager.py`：内存 Session、阶段、批次线程、状态和结果路径。
- `server.py`：loopback HTTP API 与静态资源。
- `web/`：人工工作台。

## API

- `POST /api/session/verify`：验证 `credentials`，不回显凭据。
- `POST /api/check-data`：读取当前 Excel Base64 或粘贴输入并提示有效性。
- `POST /api/run`：按当前内存登录态开始严格串行查询。
- `POST /api/start`：agent 全链路入口；可提供新凭据，也可复用当前已验证 Session。
- `POST /api/stop`：在请求边界终止批次。
- `GET /api/status`：查询阶段、进度、日志和逐人结果。
- `GET /api/download/original`、`GET /api/download/stripped`：下载本批结果。
