# 技术等级与运行资格 HTTP 接口事实

本文件记录 IEB 技术资料只读查询的已验证请求契约。维护 `http-qualification-query-helper` 时，业务输入、输出和阶段口径另读对应 APP spec。

## 会话验证

```text
GET https://ieb.csair.com/newieb/basics/showEmpprofileCompositeListPageNew
Query: random=<防缓存值>
有效标记: #showEmpProfileCompositeListPageForm
```

最终 URL 进入 `/login`，或响应出现 `#scanLogin`、登录表单时，当前 Session 已失效。HTTP 200 本身不是有效登录证据。

## 人员检索

```text
GET https://ieb.csair.com/newieb/basics/showEmpProfileCompositeResult
```

Query：

```text
personName=<六位员工号>
staffNumAllDesc=
primaryBaseArray=
baseArray=
techBase=
bolMultiQualCd=
bolPriBase=
bolJCY=
activeStatusArray=ZAIZHI
activeStatusArray=WAIBU
fleetCdbranch=
isOperQual=Y
operQualArray=
page=1
currentStr=<毫秒时间戳>
```

两个 `activeStatusArray` 必须用 tuple 列表或等价的重复参数结构保留。使用普通字典只会保留最后一个值，已验证会造成在职人员查询为空。响应为 Flexigrid HTML，应按动态表头读取并按员工号唯一归属；姓名由员工号同行取得，输入姓名非空时再核对。真实姓名单元格内含有标题为“查看作风纪律资料”的链接，该 `title` 是操作提示，姓名必须读取单元格可见文本，不能把任意交互控件的 `title` 当作业务值。

## 技术等级

```text
POST https://ieb.csair.com/newieb/basics/qualList
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

Form：

```text
staffNum=<六位员工号>
currentStr=<毫秒时间戳>
```

结果区域为 `#qualList`。区域内第一个 table 是 9 列表头，第二个 table 是数据：`#`、技术等级代码、技术等级、水平等级、机型、生效时间、失效时间、对应检查记录、数据来源。

## 运行资格

```text
POST https://ieb.csair.com/newieb/basics/showSingleEmpOperQualListByempIdNew
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

Form：

```text
empid=<六位员工号>
currentStr=<毫秒时间戳>
```

已确认 `empid` 使用员工号，不是页面内部 ID。结果区域为 `#showSingleEmpOperQualList`。区域内第一个 table 是 8 列表头，第二个 table 是数据：类型、运行资格代码、运行资格、水平等级、机型、生效时间、失效时间、备注。

运行资格存在 `rowspan` 和 `colspan`，必须展开为规则网格；单元格有 `title` 时优先读取完整值。每行展开后的宽度必须与表头一致，不能静默截断或错位。

## Headers 与页面依赖

XHR 公共 Header：

```text
Accept: text/html, */*; q=0.01
Referer: https://ieb.csair.com/index/index
X-Requested-With: XMLHttpRequest
```

POST 另使用同源 `Origin` 和表单 Content-Type。当前真实请求未观察到 CSRF Token、动态签名、`__VIEWSTATE` 或 Authorization；三个查询请求可以在验证后的同一 `requests.Session` 中直接完成，不需要执行页面 JavaScript。门户升级后若契约异常，应重新录制 Network，而不是增加旧值兜底。
