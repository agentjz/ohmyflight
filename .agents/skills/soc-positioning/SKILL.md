---
name: soc-positioning
description: 探测、复用或维护 SOC 运行信息网的飞行人员随机置位申请，包括 Network/cURL 取证、短时登录会话、动态航班号、人员校验和授权单条 POST 提交。用户提到 SOC、随机置位、KkTvlApply、随机审批申请或随航班置位时使用；IEB 飞行门户任务不要使用本 skill。
---

# SOC 随机

这里的“随机”是飞行人员随航班进行置位，即 aviation positioning/deadhead travel，不是 randomness。SOC 与 IEB 是两个独立系统，不共享页面、Cookie、接口事实或飞行门户 skill。

## 开始前

- HTTP 探测或提交前完整读取 [随机置位 HTTP 接口事实](references/positioning-application-api.md)。
- 只把浏览器 `Copy as cURL (bash)` 当作文本解析，不执行粘贴的命令；从中结构化提取 URL、方法、Headers、Cookie 和 form body。
- 登录由用户在 SOC 页面维护。优先使用刚捕获的 cURL；先调用只读或校验请求确认会话，遇到 `302 .../doSsoProxy` 或 IAM 登录页立即停止。
- Cookie、真实员工信息、原始请求响应和提交结果只放系统临时目录或用户明确提供的仓库外文件，不写入 skill、spec、测试、日志或 Git。

## 操作边界

- 随机置位申请会写入业务系统。只有 owner 对当前员工、日期、航线、航班、原因、座位选项、备注和提交动作明确授权时，才允许调用最终提交接口。
- 提交前依次取得申请原因、动态航班 option value，并完成人员校验；不从截图或显示文本拼造航班参数。
- 最终提交每条最多发送一次。超时、断连或响应含义不明时不自动重试；先通过真实查询或报表页面确认是否已经生成记录。
- HTTP 200 只代表请求到达，不代表申请成功。成功必须由已确认的业务响应或提交后记录证明。
- 新增批量工作台时默认严格串行，保留人工验证 Cookie、数据检查、开始提交和终止等阶段；并发需由 owner 另行明确授权并有真实证据证明不会错配航班或人员。

## 维护要求

- 页面或接口变化时重新捕获真实 Network，分别记录请求方法、字段、编码、响应和状态判断，不根据相邻 Struts action 猜契约。
- 站点中文字段按 UTF-8 form 编码。若终端或 cURL 文本出现乱码，回到原始 percent-encoded body 或重新捕获，不把乱码字面量写进客户端。
- 若后续开发 SOC 专用 APP、API 文档模块或测试，再使用对应仓库开发 skill；本 skill 记录 SOC 领域事实，不直接承载具体产品规格。
