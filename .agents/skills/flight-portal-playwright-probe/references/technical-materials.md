# 飞行门户人员信息页面探针参考

本文件只记录 Playwright 页面证据和 DOM 事实，不代表当前交付一个 Playwright 工作台。当前“飞行人员信息查询（皇帝版）”使用 HTTP 接口；需要重新确认门户页面结构时，仍按本文件录制页面和 Network，不把页面猜测写进 HTTP 客户端。

## 入口与单人流程

已验证菜单路径：

```python
page.goto("https://ieb.csair.com/index/index")
page.get_by_text("资质管理").nth(1).click()
page.get_by_text("飞行训练").nth(1).click()
page.get_by_role("link", name="技术资料").click()
page.get_by_role("link", name="资料管理").click()
page.get_by_role("textbox", name="员工号或姓名简拼").wait_for(state="visible")
```

每名员工先清空搜索框，再输入六位员工号并点击查询；结果行按精确员工号归属，打开个人资料后读取模块，关闭 `.pilotInfo-dialog-close` 再处理下一人。页面自动化必须保持这些阶段独立，不把进入页面和开始查询合并成一个动作。

## 页面模块

- 基础信息：基本信息、教育经历、工作经历、职称信息、家庭信息。
- 技术等级：容器 `#qualList`。
- 运行资格：容器 `#showSingleEmpOperQualList`，表格可能使用 `rowspan`/`colspan`。
- 训练检查记录：培训记录容器 `#showTrainingRecordListDiv`、训练经历容器 `#trainResultList` 或 `#empProfile_trainResultList`；历史记录不属于当前需求。

## 表格解析

```text
container
  .hDiv table thead tr th
  .bDiv table tbody.list tr td
```

解析前先消费上一行仍有效的 `rowspan` 单元格，再展开当前行的 `rowspan` 与 `colspan`，最后按表头长度补齐。单元格自身或非交互子元素的 `title` 可作为完整值；链接、按钮和输入控件的 `title` 只是操作提示，不能覆盖可见业务文本。

## 页面与 HTTP 分工

Playwright 探针负责确认菜单、容器、表头、分页链接和 Network 请求来源；HTTP 客户端负责复用登录 Cookie、严格串行请求、完整分页和结构化导出。两者都必须先用当前登录态的小样本验证员工归属、响应状态和数据数量，不能用猜测的相邻接口代替真实证据。
