# IEB 非生产任务 HTTP 接口事实

以下是已用登录后的真实会话验证的当前接口契约。接口返回值大量使用 HTML 片段和字符串布尔值，不能只按状态码判断业务成功。

## 会话与公共请求

基础地址：

```text
https://ieb.csair.com
```

已验证会话 Cookie：

```text
JSESSIONID
iebJSid
```

两者均为 Session Cookie、HttpOnly。普通控制台的 `document.cookie` 读不到完整值。实际使用由用户在 F12 Network 对任意已登录请求执行“Copy as cURL”，本地服务解析 cURL 中的 `Cookie` Header；也可接受单独粘贴的 Cookie Header。

浏览器关闭后，`requests.Session` 只加载这两个 Cookie 仍能访问全部已验证接口。页面 sessionStorage 中的 `loginRole`、`powerObj` 不参与这些后端请求认证。

已捕获的 XHR 请求特征：

```text
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
Origin: https://ieb.csair.com
Referer: https://ieb.csair.com/index/index
X-Requested-With: XMLHttpRequest
Cookie: <当前会话>
```

客户端发送表单时使用结构化 form 编码，不手拼字符串。`random` 是页面用 `Math.random()` 追加的普通小数参数，不是签名。当前未观察到 CSRF Header、CSRF Body 字段、`__VIEWSTATE` 或其他签名。

凭据验证不能只看 HTTP 200。GET 录入页后必须同时确认未返回登录页，并存在 `#nonproductionTaskImportForm` 和 `#lockType`。

## 录入页与动态类型

```text
GET /newieb/nonproductionTask/showNonproductionTaskImportPage?random=<decimal>
```

响应为 HTML 片段。解析 `#showNonproductionTaskImportPage #lockType option[value]`，每项保留：

| 页面属性 | 含义与用法 |
|---|---|
| `value` | 提交代码，例如 `BS_STUDY`、`GDO`、`RECU_LVE_R` |
| 可见文本 | `【代码】名称`，去掉代码前缀后作为 `lockTypeDesc` |
| `class` | 页面限制标记；`1` 会把时间模式锁定为按时间段 |
| `id` | 页面作为 `dateSplitFlag` 提交，当前值为 `0` 或 `1` |

HTML 中多个 option 复用 `id="0"` 或 `id="1"`，这不符合 DOM 唯一 ID 语义。不得用 option `id` 定位类型，只按 `value` 定位，再读取其元数据。

页面类型列表会变化。生产逻辑不得依赖固定数量或穷举常量；每次新会话验证后读取并缓存当前列表。输入可按代码、`代码-名称` 或页面完整标签归一，但提交前必须与当前动态列表匹配。

页面类型选择逻辑当前为：

- `class="1"` 的类型强制 `lockTimeType=1`。
- `ALV_FD` 即使页面 `class="0"` 也被脚本特别强制为模式 1。
- `CRM` 强制模式 1，默认时间为 `08:30` 至 `16:30`。
- 其他类型默认时间为 `08:59` 至 `19:59`，并可使用模式 2。
- 页面把 option `id` 原样写入 `dateSplitFlag`。

## 员工校验

```text
POST /newieb/nonproductionTask/vaildStaffNum
```

注意端点拼写是门户现状的 `vaild`，字段 `staffNum` 使用大写 `N`：

```text
staffNum=<员工号>
operationType=1
random=<decimal>
flagType=nonproductionTask
```

响应为 JSON。`permissionFlag` 是字符串 `"true"`/`"false"`，不是 JSON boolean。通过时读取：

```text
nameInfo
deptInfo
```

提交使用这里返回的姓名和部门；不能信任 Excel 中的姓名、部门替代门户身份事实。若输入包含姓名，可用于一致性提示，但员工号仍是主标识。

## 额度与规则提示

```text
POST /newieb/nonproductionTask/showNonproductionHolidayRulesTips
```

Body：

```text
staffnum=<员工号>
holidayType=<当前类型代码>
holidayTypeDesc=<当前类型名称>
random=<decimal>
```

响应为 HTML。智能路由读取 `.hDiv table` 表头和 `.bDiv table` 数据，按字段名解析：

```text
休假类型
年份
休假天数
锁班天数
解锁天数
可休天数
```

只在 `RECU_LVE` 与 `ALV_FD` 之间按目标年份“可休天数”执行现有智能互换；其他类型原样提交。没有目标年份、重复年份、列数异常或非整数额度时归档预检失败，不猜额度。额度表中的 ALV_FD 可能显示为“年假（公休假）”，不能据此改成普通 `ALV`。

## 时间控件与校验

页面只有小时和分钟下拉：小时 `00` 至 `23`，分钟 `00` 至 `59`。没有秒输入字段。服务器在查询和结果中把分钟值显示为 `HH:mm:00`，因此当前只支持分钟粒度，不能对外宣称支持自定义秒。

页面当前客户端校验包括：

- 开始时间和结束时间都必填，且不能相等。
- 同一天或按月份模式要求开始时分小于结束时分。
- 模式 1 的开始/结束日期和页面计算锁班天数必填。
- 模式 2 必须选择至少一天，`lockDays` 等于所选日数量。
- 当模式 1 的结束日号减开始日号为 1，且 `dateSplitFlag=0` 时，页面要求起止时间差超过 8 小时。
- 锁班原因必填，页面 textarea `maxlength=60`。

纯 HTTP 实现保持页面当前可观察规则，不擅自增加新限制。页面内部 `lockTimeMinutes` 和显示用锁班时长不在最终表单 Body 中。

## 提交

```text
POST /newieb/nonproductionTask/showNonproductionTaskImportResultPage
```

公共字段：

```text
staffnum
lockType
dateSplitFlag
lockRemark
startDt
endDt
lockDays
lockTimeType
lockYearAndMonth
lockStartHourAndMinute
lockEndHourAndMinute
lockTypeDesc
chnName
orgUnitName
random
```

### 模式 1：按时间段

```text
lockTimeType=1
startDt=YYYY-MM-DD HH:mm
endDt=YYYY-MM-DD HH:mm
lockDays=<连续自然日数量>
lockYearAndMonth=
lockStartHourAndMinute=
lockEndHourAndMinute=
```

任意分钟已验证能被服务器原样保存，查询显示时秒为 `00`。

### 模式 2：按月份（频率）

```text
lockTimeType=2
startDt=
endDt=
lockYearAndMonth=YYYY-MM
lockDaysNum=<日号>  # 每个选中日期重复一个同名字段
lockDays=<lockDaysNum 数量>
lockStartHourAndMinute=HH:mm
lockEndHourAndMinute=HH:mm
```

必须用能够保留重复 key 的表单编码，例如 Python 的 `list[tuple[str, str]]`。已验证选择两个非连续日会返回并保存两条独立记录，每条 `lockDays=1`。

### 备注与身份字段

`lockRemark` 可由输入提供，自定义文本已验证会原样保存。页面默认行为是“当前操作人标识 + 类型名称”，但操作人信息属于当前登录态，不能硬编码、写测试或写仓库。保持旧版习惯时，每行备注优先，其次统一备注；都为空时才从当前录入页提取门户默认模板并生成同等值。

`lockTypeDesc` 使用当前 option 可见名称去掉 `【代码】` 后的部分。`chnName`、`orgUnitName` 必须来自员工校验响应。

## 提交响应

响应为 HTML 片段，不是 JSON。分开解析：

- `#showNonproductionTaskImportResultPage1`：普通结果。
- `#showNonproductionTaskImportResultPage1table tbody.list tr`：普通数据行。
- `#showNonproductionTaskImportResultPage2`：冲突列表。
- `#showNonproductionTaskImportResultPage2 tbody.list tr`：冲突数据行。

普通结果按表头读取锁班状态、员工号、姓名、部门、开始日期、结束日期、锁班天数、锁班类型和锁班原因。冲突结果按表头读取序号、锁班结果、身份、日期、类型、原因和冲突说明。空表以“没有相关信息”为准。

业务成功不能只看 HTTP 200。必须按当前员工号、校验姓名、实际类型、实际起止日期精确归属普通结果，并确认冲突表为空。已验证的冲突提交表现为：普通结果 0 行、冲突表 1 行，并且该冲突行不会出现在待审批查询中。

## 锁班查询

查询页：

```text
GET /newieb/nonproductionTask/showNonproductionTaskPage?random=<decimal>
```

列表：

```text
POST /newieb/nonproductionTask/showLockListPage  # 第一页
GET  /newieb/nonproductionTask/showLockListPage  # 后续页
```

`#queryFormId` 的 Body：

```text
staffnum
base
primBase
fleetCd
lockType
lockStatus
startDt
endDt
orderByType
entryStaffnum
page
random
```

状态代码：

| 值 | 页面状态 |
|---|---|
| `1` | 已锁 |
| `3` | 待审批 |
| `5` | 已解锁 |
| `6` | 已撤销 |
| `7` | 已否决 |

结果按表头解析，当前字段包括选择、序号、状态、员工号、姓名、运行基地、注册基地、部门、开始日期、结束日期、锁班天数、锁班类型、锁班名称、日志、锁班原因、冲突、录入人、录入时间和积分休假。第一列表头可为空，必须保留为“选择”，不能过滤后让其他字段整体左移。

分页上限取 Footer 的“最后一页”链接；“共 N 条记录”是记录数，不是页数。第一页由查询按钮发 POST，后续页由 `goPageTwo` 发 GET，并携带 `page` 与 `currentStr`。查询或冲突定位必须遍历全部页，并按记录 ID 去除重复响应。

表格 checkbox 的 `value` 是后续状态动作的记录 ID，但只能在按业务字段唯一定位目标行之后读取。不要用固定行号、录制时 ID、checkbox accessible name 或序号先猜目标。

## 状态动作

以下均为 `POST application/x-www-form-urlencoded`：

```text
/newieb/nonproductionTask/importNonproductionTaskLockListToSoc  # 待审批 -> 已锁
/newieb/nonproductionTask/deleteNonproductionTaskLock           # 待审批 -> 已撤销
/newieb/nonproductionTask/unlockNonproductionTaskLock           # 已锁 -> 已解锁
/newieb/nonproductionTask/rejectNonproductionTaskLock           # 待审批 -> 已否决
```

Body 由以下部分合并：

```text
ids=<记录 ID>               # 多条时重复同名字段
approveRemark=<动作原因>
<当前 queryFormId 全部字段>
random=<decimal>
```

响应为 JSON，`success` 是字符串 `"true"`/`"false"`；同时读取 `successMsg` 或 `errorMsg`。接口返回成功后必须重新调用列表接口确认状态，不能只相信提示文字。通过动作需要确认同一记录进入“已锁”且不再出现在“待审批”；解锁、撤销和否决同样复查目标状态。

真实会话已验证：待审批记录可通过为已锁，已锁记录可解锁并在状态 5 查询中出现，多个待审批记录可一次撤销并在状态 6 查询中出现。

## HTTP 冲突恢复

纯 HTTP 可以复现旧版完整恢复链：

1. 从冲突响应读取当前片段的员工、类型和时间区间。
2. `showLockListPage` 查询该员工全部“已锁”分页。
3. 只保留员工号一致、状态已锁、自然日区间与冲突区间重叠的记录；全分页必须恰好一条。
4. 在结果证据已经即时保存后，从该唯一行读取 `ids`。
5. 调用 `unlockNonproductionTaskLock`，再查询确认旧记录不再是已锁且可在已解锁状态中归属。
6. 原提交 Body 只重放一次；再次冲突时停止该原始记录，不继续解锁第二条。

已验证冲突行本身不持久化为待审批记录，因此恢复前不需要撤销冲突行。页面变化后仍应通过查询复核这一事实。
