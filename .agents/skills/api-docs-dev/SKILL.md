---
name: api-docs-dev
description: 维护 watchdog API 文档的接口目录、静态页面、本地执行器、Cookie 生命周期、真实单次调试和 Markdown 导出时使用；业务工作台功能开发使用对应工具 skill。
---

# API 文档维护

API 文档是跨系统 HTTP 接口的事实导航和真实单次调试器，不是批量业务工作台。开始前读取 `spec/dev/api-docs/spec.md`、`public/tool/app/api-docs/catalog/index.json` 及索引引用的当前模块 JSON；涉及飞行门户请求时同时使用 `flight-portal-http-probe`，涉及页面时同时使用 `ui-clarity`，正式改代码时同时使用 `watchdog-dev`。

## 唯一事实源

- `public/tool/app/api-docs/catalog/` 中由 `index.json` 引用的模块 JSON 是接口 URL、方法、Headers、参数、响应契约和内部调用链的唯一事实源。
- 页面、Python 执行器和 Markdown 导出必须直接消费同一目录，不分别维护接口字段表。
- 本 skill、spec 和用户手册只记录职责、工作流与可观察行为，不复制完整接口契约。接口事实变化时先改目录，再让所有消费者一起验证。
- Cookie、真实身份、原始响应和运行结果是临时验证证据，不属于接口目录，也不得写入仓库。

## Cookie 生命周期

- API 文档本地执行器只监听 `127.0.0.1`。`POST /api/session` 验证成功后可向发起请求的当前页面返回一次规范化 Cookie Header，用于页面展示和复制。
- Cookie 只属于当前页面生命周期：不写 `localStorage`、静态文件或日志；`GET /api/health`、Markdown 导出和其他状态响应不得包含 Cookie 值。
- 页面初始化连接本地执行器后立即清除后端旧 Session，再显示“Cookie 未验证”。刷新、重新打开或主动清除后，不得沿用旧保活状态或声称旧 Cookie 仍有效。
- 后端报告会话失效时，页面同步隐藏当前页 Cookie、停用真实请求并展示失效状态。

## 真实验证门槛

单元测试、fixture、Mock、类型检查和静态页面检查只能防回归，不能证明真实接口有效。涉及请求契约、Cookie 生命周期、参数构造、动态选项、响应解析或执行结果的修改，必须使用 owner 当次授权的真实生产 Session 和真实生产数据完成端到端验证；没有真实验证只能明确标记“未验证”，不能宣称完成、有效或通过。

- 只读接口使用最小真实样本，核对最终 URL、HTTP 状态、结构化归属和原始响应契约。
- 写接口执行前必须取得 owner 对当前对象、日期、时间模式、起止时间、类型、备注和动作的明确授权；过去授权不延续。
- 写入响应必须按当前对象和业务参数唯一归属；存在查询接口时，写入后重新查询确认真实状态。HTTP 200、toast 或单元测试都不能替代业务结果证据。
- 真实验证只记录脱敏结论。Cookie、姓名、员工号、记录 ID、响应正文、截图和临时探针放系统临时目录，验证后清理，不进入 Git。

## 收口

同步更新目录消费者、测试、`spec/dev/api-docs/spec.md` 和 `spec/user/api-docs/manual.md`，运行相关局部测试与仓库全量验证。临时启动本地入口时遵守 `AGENTS.md`：完成验证后关闭本轮进程并确认端口释放。最终回复区分自动测试与真实生产验证结论。
