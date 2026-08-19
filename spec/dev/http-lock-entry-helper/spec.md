# 锁班皇帝（新）开发规格

## 1. 定位

`http-lock-entry-helper` 是与 `lock-entry-helper` 并列的独立本地 Python APP。旧工具继续使用 Playwright；新工具只使用用户自行提供的 IEB 已登录会话，通过 `requests.Session` 串行调用非生产任务 HTTP 接口，不实现登录、不启动浏览器，也不从旧工具目录导入运行时代码。

页面名称为“锁班皇帝（新）”，技术目录使用 `http-` 前缀。原始入口为 `startapp.py`，智能入口为 `startsmartapp.py`，两者都只监听 `127.0.0.1` 的随机端口。

## 2. 会话凭据

工作台接受浏览器 Network 面板的 Copy as cURL 文本或完整 Cookie Header，只提取 `JSESSIONID` 和 `iebJSid`。粘贴内容不作为命令执行，cURL 中的 URL、方法和 Body 不参与请求。

两个 Cookie 都是 HttpOnly，页面 Console 中的 `document.cookie` 和 Cookie Store API 无法读取，因此工作台不提供无效的 Console 复制脚本。凭据只存 Python 进程内存，不写 localStorage、日志、状态响应、Excel 或文件。验证成功后页面只显示验证时间、动态类型数量和类型版本摘要。

凭据验证请求：

```text
GET /newieb/nonproductionTask/showNonproductionTaskImportPage
```

响应必须未进入登录页，并同时包含 `#nonproductionTaskImportForm` 与 `#lockType`。类型 option 的 `value`、可见名称、`class` 和 `id` 每次随会话动态读取；生产逻辑没有固定类型枚举。

## 3. 人工分步

页面操作保持四个独立动作：

1. 验证凭据。
2. 数据健康检查。
3. 开始录入。
4. 终止当前批次。

数据健康检查调用生产解析链，只返回有效数、无效数和逐条原因。检查不是确认门槛，有无错误都不改变“可开始录入”的业务规则；开始录入时重新解析当前页面输入，只处理有效记录并在日志中列出被跳过的无效数据。

批次完成或人工终止后，当前有效 Session 和动态类型元数据保留，可更换 Excel 或粘贴内容继续下一批。Session 失效或本地服务退出后需要重新提供凭据。

## 4. 输入

Excel 使用当前活动 sheet，按表头名读取，不依赖文件名、sheet 名或固定列号。

必需表头：

```text
员工号（或工号）
姓名
锁班类型（或请假类型）
开始日期
结束日期
```

可选表头：

```text
时间模式（或锁班时间类型）
开始时间
结束时间
月份（或锁班月份）
锁班日期（或日期列表）
备注（或锁班原因）
```

粘贴输入推荐用 tab 或 `|` 分隔，顺序为员工号、姓名、锁班类型、开始日期、结束日期、可选开始时间、可选结束时间、可选备注。

员工号按六位文本归一。日期支持 Excel Date、Excel serial、`YYYYMMDD` 和明确的 `YYYY-M-D`、`YYYY/M/D`、`YYYY.M.D`；不接受地区含义不明确的短日期。时间粒度为分钟，格式为 `HH:mm`。

类型可填写代码、`代码-名称` 或门户完整标签，最终必须归属当前动态类型。姓名只用于一致性提示；提交使用员工校验接口返回的姓名和部门。每行备注优先于统一备注，两者都为空时使用录入页当前默认原因模板。原因最长 60 字符。

## 5. 时间模式

模式 1 按连续时间段提交：

```text
lockTimeType=1
startDt=YYYY-MM-DD HH:mm
endDt=YYYY-MM-DD HH:mm
lockDays=<连续自然日数>
```

`class="1"` 的类型、`ALV_FD` 和 `CRM` 只能使用模式 1。CRM 无自定义时间时使用 `08:30-16:30`，其他类型使用 `08:59-19:59`。

模式 2 按月份提交，`lockDaysNum` 以重复同名字段保留多个非连续日号：

```text
lockTimeType=2
lockYearAndMonth=YYYY-MM
lockDaysNum=<日号>
lockDaysNum=<另一个日号>
lockStartHourAndMinute=HH:mm
lockEndHourAndMinute=HH:mm
```

客户端保持门户当前日期、时分和 8 小时规则，不增加额外强制限制。

## 6. HTTP 客户端

公共请求使用 `application/x-www-form-urlencoded` 结构化编码、`Origin`、`Referer` 和 `X-Requested-With: XMLHttpRequest`。当前接口未观察到 CSRF Token、`__VIEWSTATE`、动态签名或 Authorization Header。

主要端点：

| 动作 | 方法与路径 |
|---|---|
| 员工校验 | `POST /newieb/nonproductionTask/vaildStaffNum` |
| 额度读取 | `POST /newieb/nonproductionTask/showNonproductionHolidayRulesTips` |
| 提交 | `POST /newieb/nonproductionTask/showNonproductionTaskImportResultPage` |
| 查询 | `POST /newieb/nonproductionTask/showLockListPage` |
| 解锁 | `POST /newieb/nonproductionTask/unlockNonproductionTaskLock` |
| 通过 | `POST /newieb/nonproductionTask/importNonproductionTaskLockListToSoc` |

员工校验字段使用门户现状的 `staffNum`，其他接口使用 `staffnum`。JSON 中的 `permissionFlag` 和 `success` 按字符串布尔值解析。

提交响应同时解析普通结果区与冲突结果区。普通结果必须按员工号、门户姓名、实际类型和完整日期时分精确归属；模式 2 的每个日号必须分别唯一归属。HTTP 200、响应第一行或单独提示文字都不作为业务成功依据。

查询按表头解析并遍历全部页。门户第一页使用 POST，后续页按页面脚本使用 GET；页脚“共 N 条记录”是记录数，不是页数，最后一页链接才是分页上限。空白选择列表头必须保留，不能让字段错位。checkbox `value` 只在业务字段唯一匹配后作为记录 ID 使用。

状态动作统一使用重复 `ids`、`approveRemark` 和当前查询字段。通过接口成功后必须重新查询“已锁”和“待审批”，确认同一目标已锁且不再待审批。

## 7. 原始与智能模式

原始模式按每行动态归一后的类型和日期原样生成一个提交片段。

智能模式只对 `RECU_LVE` 和 `ALV_FD` 读取目标年份可休天数：输入类型额度优先，不足部分使用另一类型的连续尾段；两类合计不足时整条不提交；跨自然年不处理。普通 `ALV`、`RECU_LVE_R` 和其他类型不参与互换。

## 8. 冲突恢复

冲突恢复只在智能入口页面显示并由批次复选框决定，默认关闭。启用后的顺序固定为：

1. 精确归属当前冲突响应并即时保存。
2. 查询当前员工全部“已锁”分页。
3. 只保留员工号一致、状态已锁且自然日区间重叠的记录，候选必须恰好一条。
4. 把唯一旧记录证据和即将执行的动作即时写入结果 Excel。
5. 调用解锁接口，并查询确认目标不再处于已锁且已进入已解锁。
6. 原提交 Body 只重放一次。
7. 重提仍冲突或失败时停止当前原始记录，不解锁第二条。

正常新提交默认不会被自动通过、撤销或否决。工作台可勾选“提交成功后直接通过并锁班”：每个片段仍串行先提交、保存待审批结果，再调用通过接口并复查状态；未勾选时保持原有待审批行为。通过失败时明确报告“待审批记录已生成，但通过并锁班失败”，不吞掉第一步结果。

## 9. 状态、结果与 API

manager 维护等待凭据、验证中、凭据有效、检查数据、数据已检查、运行中、终止中、已终止、已完成和失败阶段。runner 通过事件回调追加进度、日志和逐条结果；前端只展示服务端事实。

每个批次创建 `results/<runId>/HTTP锁班结果_<runId>.xlsx`。普通结果、冲突、解锁前证据、动作结果和重提结果每产生一项就原子保存一次，不回写输入 Excel。`results/` 被 Git 和独立下载包排除。

本地 API：

```text
POST /api/session/verify
POST /api/check-data
POST /api/run
POST /api/stop
GET  /api/status
GET  /api/download/result
POST /api/start
```

`/api/start` 是 agent 全链路入口，可携带凭据，也可复用进程内已验证 Session；它依次执行凭据验证、数据检查和开始录入。前端人工路径不调用该接口。

## 10. 模块职责

| 模块 | 职责 |
|---|---|
| `credentials.py` | cURL/Cookie 解析与无密摘要 |
| `metadata.py` | 动态类型、默认原因模板和类型归一 |
| `input_data.py` | Excel/粘贴、日期时间和输入检查 |
| `routing.py` | 智能分段、区间重叠和唯一候选 |
| `portal_client.py` | Session、HTTP、响应解析、查询和状态动作 |
| `result_store.py` | 原子即时结果 Excel |
| `runner.py` | 串行执行、中断和单次冲突恢复 |
| `manager.py` | Session、批次线程、状态和下载 |
| `server.py` | loopback API 与静态页面 |
| `web/` | 人工分步、输入、结果、日志和滚动跟随 |

## 11. 验证边界

仓库测试只使用虚构员工号、虚构姓名和脱敏 HTML/JSON。真实输入、Cookie、响应、记录 ID 和结果文件不进入仓库。页面最终视觉由 owner 人工检查；门户动态 HTML 或规则变化时，客户端以缺表、登录页或无法精确归属停止，不猜测继续。
