# IEB 飞行经历 HTTP 接口事实

以下事实于 2026-08-19 在 owner 授权的已登录内网会话中完成只读验证。门户改版后必须重新探测。

## 登录态验证

```text
GET https://ieb.csair.com/newieb/flytime/showFlytimeManyQuery
```

有效响应：HTTP 200，最终路径仍是查询页，HTML 包含 `#showflyTimeExperienceQueryForm`，form method 为 GET，action 为 `/newieb/flytime/showFlytimeManyQueryList`。

失效响应：跟随重定向后最终路径是 `/login`，HTML 出现 `#scanLogin`，查询 form 不存在。

当前仅需要：

```text
JSESSIONID
iebJSid
```

未观察到 CSRF、`__VIEWSTATE`、动态签名或 Authorization Header。查询接口可在有效 Cookie 下直接调用，不依赖先 GET 查询页；生产仍用查询页作为凭据验证入口。

## 查询接口

```text
GET https://ieb.csair.com/newieb/flytime/showFlytimeManyQueryList
```

固定参数：

```text
activeStatusArray=ZAIZHI
dateType=5
exportType=1
page=1
```

每人参数：

```text
staffNum=<六位员工号>
startStr=YYYY-MM-DD
endStr=YYYY-MM-DD
```

保留页面 form 的空筛选参数：

```text
fleetCdArray1
fleetCdArray
chnDescArray
primaryBaseArray
baseArray
singlefleetCdArray
chnDescArray1
```

`currentStr` 使用每次请求的新防缓存值。请求 Headers 使用普通浏览器 User-Agent、`Accept: text/html, */*; q=0.01`、`X-Requested-With: XMLHttpRequest`、`Referer: https://ieb.csair.com/index/index`。

## 响应

当前响应是 HTML table，不是 JSON。表头和 `tbody` 行必须结构化解析，不按固定列号取值。

真实响应已观察到 19 个字段：

```text
员工号
姓名
注册基地
运行基地
技术信息
开始日期
结束日期
飞行时间
飞行经历
航段数
夜航经历
左座经历
右座经历
模拟机
本场时间
起落总数
航线起落
本场起落
人工飞行时间
```

一次人员查询同时返回全部字段，四个前端范围不改变请求参数。成功必须满足：表头非空且不重复、数据宽度与表头一致、员工号唯一匹配、可选姓名一致。

## 历史并发实测（当前已撤回）

- 曾用 4 个独立 Session 并发查询 4 人：4 条均为 HTTP 200、每条唯一匹配当前员工、19 列一致。
- 曾用 4-worker 查询 44 条真实模板：有效 44、成功 44、失败 0，总耗时约 14 秒。
- owner 已因并发风险和维护成本决定撤回该策略；当前产品严格串行，以上数据只保留为历史探测事实，不是当前性能承诺。
- 最终原版为 44 行、门户字段 19 列；原版/去分钟版形状一致，三类经历分钟转换核对通过。

上述耗时只说明当次会话和网络事实，不写成永久性能承诺；当前实现已经撤回并发，不把它作为产品能力或性能承诺。
