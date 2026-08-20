# 技术等级运行资格查询助手（皇帝版）开发规格

## 产品边界

`http-qualification-query-helper` 与 Playwright 版 `qualification-query-helper` 并列存在。它只读取 IEB 技术资料，不修改门户数据；用户自行提供已登录门户的 Cookie Header 或 Copy as cURL，APP 使用单个 `requests.Session` 严格串行查询，不启动 Playwright。

服务只监听 `127.0.0.1`。凭据只存在当前 Python 进程内存，不进入状态响应、日志、Excel 或文件。一批完成后保留 Session 供下一批复用，登录失效时停止派发后续人员并清除内存凭据。

## 已验证 HTTP 契约

- 会话验证：`GET /newieb/basics/showEmpprofileCompositeListPageNew`；有效页面包含 `#showEmpProfileCompositeListPageForm`。
- 人员检索：`GET /newieb/basics/showEmpProfileCompositeResult`；`personName` 使用六位员工号，`activeStatusArray=ZAIZHI` 和 `activeStatusArray=WAIBU` 必须作为两个同名 Query 参数发送。
- 技术等级：`POST /newieb/basics/qualList`；表单字段为 `staffNum`、`currentStr`。
- 运行资格：`POST /newieb/basics/showSingleEmpOperQualListByempIdNew`；表单字段为 `empid`、`currentStr`，其中 `empid` 使用员工号。
- XHR 公共 Header 为 `Accept: text/html, */*; q=0.01`、门户首页 Referer 和 `X-Requested-With: XMLHttpRequest`；POST 使用表单编码。
- 当前真实请求未观察到 CSRF Token、`__VIEWSTATE`、动态签名或 Authorization，也不依赖执行页面 JavaScript。

## 输入与查询规则

- Excel 接受 `.xlsx`、`.xlsm`，必需表头为“员工号”“工号”或“员工编号”，姓名可选；粘贴输入每行识别六位员工号和可选中文姓名。
- Excel 数值员工号左补零到六位；文本员工号必须本身为六位数字。
- 重复员工号只处理第一次；无效行作为输入错误保留。数据健康检查只报告有效性，不形成开始查询的强制门槛。
- 人员检索必须按员工号唯一归属；输入姓名非空时同时校验姓名。单人普通失败写入结果后继续下一人。
- 技术等级从 `#qualList` 读取，固定校验 9 个表头；运行资格从 `#showSingleEmpOperQualList` 读取，固定校验 8 个表头。
- 两个区域的表头和数据位于不同 table；数据单元格自身或非交互后代元素的 `title` 优先作为完整值，链接、按钮和输入控件的 `title` 只是操作提示，不得覆盖可见数据；`rowspan`、`colspan` 展开后每行宽度必须与表头一致。

## 阶段与停止

人工阶段为“验证 Cookie”“数据健康检查”“开始查询”“停止查询”。`POST /api/start` 保留给 agent，依次完成凭据验证、数据检查和查询。

所有人员严格按输入顺序查询。停止只设置停止标记，当前已经发出的 HTTP 请求自然结束，之后不再派发下一人。批次完成或终止后不主动销毁有效 Session；关闭本地服务才关闭 Session。

## 输出

- `处理报告`：输入行号、员工号、输入姓名、页面姓名、身份核对、技术等级条数、运行资格条数、状态和说明。
- `技术资料明细`：技术等级与运行资格逐条写入，保持乞丐版字段口径。
- `汇总`：输入来源、结果路径、时间、有效人数、成功、失败、输入错误和中断状态。
- 每个人成功或失败后原子保存 Excel，批次结束生成文本报告。
- 前端逐人展示员工号、输入姓名、页面姓名、两类条数、状态和错误；用户向上滚动后暂停自动置底。

## 文件职责

- `credentials.py`：Cookie/cURL 文本解析与脱敏摘要。
- `input_data.py`：Excel 和粘贴输入边界归一。
- `portal_client.py`：Session、请求构造、登录判断、人员归属和 HTML 表格解析。
- `exporter.py`：增量 Excel、原子保存和文本报告。
- `runner.py`：严格串行、逐人事件和停止边界。
- `manager.py`：内存 Session、线程、阶段与结果路径。
- `server.py`：loopback API 和静态资源。
- `start.py`：本地启动入口。

运行结果目录为 `public/tool/app/http-qualification-query-helper/results/`，必须保持 Git 忽略且不进入独立 ZIP。

## API

- `POST /api/session/verify`：验证 `credentials`，不回显凭据。
- `POST /api/check-data`：检查 Excel Base64 或粘贴输入。
- `POST /api/run`：复用当前 Session 开始严格串行查询。
- `POST /api/start`：agent 全链路入口，可导入新凭据或复用当前 Session。
- `POST /api/stop`：请求边界停止派发。
- `GET /api/status`：返回阶段、进度、日志与逐人结果。
- `GET /api/download/excel`、`GET /api/download/report`：下载本批结果。
