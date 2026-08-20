# IEB HTTP 会话与探测方法

本文件记录纯 HTTP 探测的共性。具体 URL、字段和业务归属读取对应业务 reference。

## 会话来源

当前已验证的关键 Session Cookie 为：

```text
JSESSIONID
iebJSid
```

两者为 HttpOnly，普通 `document.cookie` 和 Cookie Store API 无法完整读取。用户可在已登录门户 F12 Network 中对任意请求执行 Copy as cURL，本地代码从文本中的 Cookie Header 提取目标 Cookie；也可接受完整 Cookie Header。

不要执行粘贴的 cURL，不采用其中未经确认的 URL、方法或 Body。Cookie 只装载到目标域的独立 `requests.Session` 或 `httpx.Client`。

## 探测步骤

1. 用业务查询页或录入页验证凭据，确认最终 URL 未进入 `/login` 且目标 form/容器存在。
2. 从 Playwright Network 或浏览器 DevTools 捕获一条真实请求，分别记录方法、路径、Query、Content-Type、Headers、Body 和响应格式。
3. 检查是否存在 CSRF Header/Body、隐藏字段、`__VIEWSTATE`、动态签名、Authorization、随机数或页面初始化依赖。
4. 先只携带最小必要 Cookie 和 Header 重放只读请求；逐项验证哪些字段真正必要，不把“当前未观察到”写成永久不存在。
5. 用结构化解析器读取 HTML/JSON，检查登录页、表头、列宽、字符串布尔值、空结果和业务错误。
6. 按当前人员和业务条件唯一归属结果，再决定是否允许批量或状态动作。

## 公共请求事实

基础地址：

```text
https://ieb.csair.com
```

已捕获 XHR 常见 Header：

```text
Origin: https://ieb.csair.com
Referer: https://ieb.csair.com/index/index
X-Requested-With: XMLHttpRequest
```

锁班接口主要使用 `application/x-www-form-urlencoded`；飞行经历查询使用 GET Query。`random` 或 `currentStr` 当前是防缓存值，不是签名，但页面升级后要重新确认。

## 响应判断

- HTTP 200 可能是登录页、错误片段、空表或冲突结果。
- JSON 中的 `success`、`permissionFlag` 等可能是字符串 `"true"`/`"false"`，不要按 JSON boolean 猜。
- HTML 表格保留空白选择列，按表头与同行单元格解析；截断显示优先读取 `title`。
- 分页的记录总数不是页数；第一页和后续页可能使用不同方法，按真实页面请求复刻。
- 登录失效后停止后续请求并提示重新导入凭据，不批量重放可能已经发送的写请求。

## 授权和清理

只读查询可在当前任务明确范围内用小样本验证。提交、通过、撤销、解锁和否决需要 owner 对当前对象、日期和动作的明确授权；过去授权不延续。

Cookie、真实身份、记录 ID、原始 HTML/JSON、截图和临时结果放系统临时目录。输出日志只保留脱敏摘要，结束时删除探针和原始证据；仓库测试使用虚构身份与脱敏 fixture。
