# 飞行人员信息查询（皇帝版）开发规格

## 产品边界

`http-qualification-query-helper` 是 IEB 飞行人员信息只读查询 APP，入口名称为“飞行人员信息查询（皇帝版）”。它不修改门户数据；用户自行提供已登录门户的 Cookie Header 或 Copy as cURL。APP 使用单个 `requests.Session` 严格串行查询，不启动 Playwright，服务只监听 `127.0.0.1`。

## 已验证 HTTP 契约

- 会话验证：`GET /newieb/basics/showEmpprofileCompositeListPageNew`，有效页面包含 `#showEmpProfileCompositeListPageForm`。
- 人员归属：`GET /newieb/basics/showEmpProfileCompositeResult`，`personName` 使用员工号，`activeStatusArray=ZAIZHI` 和 `activeStatusArray=WAIBU` 必须作为重复 Query 参数发送。
- 基础信息：`POST /newieb/hrInfo/showEmpInfo`，multipart 字段 `staffNum`，返回 `empDto`、`eduList`、`workList`、`titleList`、`relationList`，分别对应基本信息、教育经历、工作经历、职称信息、家庭信息。
- 技术等级：`POST /newieb/basics/qualList`，表单字段 `staffNum`、`currentStr`，结果区域 `#qualList`。
- 运行资格：`POST /newieb/basics/showSingleEmpOperQualListByempIdNew`，表单字段 `empid`、`currentStr`，结果区域 `#showSingleEmpOperQualList`。
- 培训记录：`POST /newieb/basics/trainingRecordList`，表单字段 `page`、`staffId`、`fuzzyQuery=true`、`newMachineId`、`trainName`；每页最多 12 条，须从第 1 页遍历到末页，超过末页会重复末页，客户端不得继续请求。
- 训练经历：`POST /newieb/basics/trainResultList`，表单字段 `staffNum`、`trainName`，一次返回全部训练记录，不读取历史记录。

公共请求头为 `Accept: text/html, */*; q=0.01`、门户首页 `Referer` 和 `X-Requested-With: XMLHttpRequest`；基础信息响应为 JSON。当前真实请求未观察到 CSRF、`__VIEWSTATE`、动态签名或 Authorization。

## 输入与规则

- Excel 接受 `.xlsx`、`.xlsm`，表头必须包含“员工号”“工号”或“员工编码”，姓名可选；粘贴输入每行识别六位员工号和可选中文姓名。
- 数值员工号左补零到六位；重复员工号只处理第一次，无效行作为输入错误保留。
- 人员查询必须按员工号唯一归属，姓名非空时同时核对姓名。单人失败写入结果后继续下一人。
- 数据健康检查只报告有效/无效数量，不替代“开始查询”按钮，不强制拦截有效输入。
- 所有人严格串行，停止只阻止后续人员，不打断已发出的当前 HTTP 请求。

## 输出

- `处理报告`：输入行号、员工号、输入姓名、页面姓名、身份核对、基础信息/技术等级/运行资格/培训记录/训练经历五类条数、状态和说明。
- `基础信息`、`技术等级`、`运行资格`、`培训记录`、`训练经历`：按模块写入 Excel，所有明细行保留员工号和页面姓名；基础信息保留分区与记录序号，培训记录和训练经历保留来源页码。
- JSON 文件格式为 `flight-personnel-info-v1`，与 Excel 使用同一 `QueryResult` 数据，包含 `summary`、逐人 `people`、空列表和来源页码。
- `汇总` 和文本报告记录输入来源、结果路径、时间、总数、成功、失败、输入错误和中断状态。
- 前端逐人显示员工号、输入姓名、页面姓名、五类条数、状态和错误；用户向上滚动日志或结果列表后暂停自动置底，回到底部恢复跟随。

## 文件职责

- `credentials.py`：Cookie/cURL 文本解析与摘要。
- `input_data.py`：Excel 与粘贴输入归一化。
- `portal_client.py`：Session、请求构造、登录判断、人员归属和 HTML/JSON 解析。
- `exporter.py`：Excel、JSON、原子保存和文本报告。
- `runner.py`：严格串行、逐人事件和停止边界。
- `manager.py`：内存 Session、线程、阶段、结果和下载路径。
- `server.py`：loopback API 和静态资源。
- `start.py`：本地启动入口。

结果目录为 `public/tool/app/http-qualification-query-helper/results/`，必须保持 Git 忽略且不进入独立 ZIP。

## API

- `POST /api/session/verify`：验证 `credentials`，不回显凭据。
- `POST /api/check-data`：检查 Excel Base64 或粘贴输入。
- `POST /api/run`：复用当前 Session 开始严格串行查询。
- `POST /api/start`：agent 全链路入口，可导入新凭据或复用当前 Session。
- `POST /api/stop`：请求停止后续派发。
- `GET /api/status`：返回阶段、进度、日志与逐人结果。
- `GET /api/download/excel`、`GET /api/download/json`、`GET /api/download/report`：下载本批结果。
