# 技术等级运行资格查询助手（乞丐版）开发规格

## 产品边界

`qualification-query-helper` 是 IEB 飞行门户只读 Playwright 查询 APP。它由本地 Python HTTP 服务和静态工作台组成，在可见 Chromium 中复用用户粘贴的当前 Cookie，按员工号逐人抓取技术等级和运行资格。它不修改门户资格数据。

## 操作阶段

1. 用户在工作台输入 Cookie，并选择 Excel 或粘贴人员。
2. “导入登录态并进入查询页面”只启动浏览器、注入 Cookie、进入“资质管理 / 飞行训练 / 技术资料 / 资料管理”，页面就绪后停止。
3. “数据健康检查”只报告有效和无效输入，不检查门户页面，也不是开始查询的强制确认。
4. “开始查询”才按输入顺序严格串行查询。
5. 完成后浏览器保持打开，可以准备下一批；“停止并关闭浏览器”终止 Playwright 进程树。

`POST /api/start` 保留给 agent 作为全链路入口；前端使用 `/api/prepare`、`/api/check-data`、`/api/run` 和 `/api/stop` 分步控制。

## 登录态

- 接受完整 Cookie Header 或 Copy as cURL 内容。
- Cookie 至少包含 `iebJSid` 和 `JSESSIONID`，并注入 Playwright browser context。
- Cookie 只存在于当前服务和浏览器子进程内存，不写文件、不写状态响应、不写日志和结果。
- 门户跳回 `/login` 或出现 `#scanLogin` 时报告登录态失效。

## 输入契约

- Excel 接受 `.xlsx`、`.xlsm`；必需表头为 `员工号`、`工号` 或 `员工编号`，姓名可选。
- 粘贴输入每行一人，识别六位员工号和可选中文姓名。
- Excel 数值员工号左补零到六位；文本员工号必须本身是六位数字。
- 重复员工号只查询第一条，其余输入行作为输入错误写入处理报告。

## 查询链路

- 使用资料管理搜索框逐人清空后输入员工号，并只点击精确员工号链接。
- 技术等级容器为 `#qualList`；运行资格容器为 `#showSingleEmpOperQualList`。
- 容器可位于任意 frame；表头和值按 DOM 读取，`rowspan` 和 `colspan` 展开成规则网格。
- 技术等级和运行资格分别校验必需表头；标签加载失败重试一次。
- 每人无论成功失败都关闭个人弹窗。普通单人失败后继续；浏览器关闭时停止后续查询。

## 输出契约

- `处理报告`：每个输入人员或输入错误一行，记录页面姓名、姓名一致性、两类记录数量、状态和说明。
- `技术资料明细`：一条技术等级或运行资格记录一行，保留当前页面字段。
- `汇总`：输入来源、结果文件、查询时间、有效员工数、成功、失败、输入错误和中断状态。
- 每个人完成后原子保存结果 Excel；批次结束生成同名文本报告。
- 前端逐人显示员工号、输入姓名、页面姓名、两类条数、状态和错误。

## 模块职责

- `credentials.py`：Cookie 解析和 Playwright cookie 格式。
- `input_data.py`：Excel 与粘贴输入。
- `portal.py`：门户导航、人员定位和两张表解析。
- `exporter.py`：增量 Excel 与文本报告。
- `runner.py`：严格串行批次和事件。
- `manager.py`：Playwright 子进程、会话复用和状态。
- `server.py`：本地 HTTP API 与静态资源。
- `start.py`：本地服务入口。

运行结果目录为 `public/tool/app/qualification-query-helper/results/`，必须保持 Git 忽略且不进入独立 zip。
