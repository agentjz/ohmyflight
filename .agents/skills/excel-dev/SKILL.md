---
name: excel-dev
description: ohmyflight 仓库内开发、修改或排查 Excel 读取、Excel 导出、表头映射、日期解析、批量导入、SheetJS/openpyxl 数据处理和相关测试时使用；尤其适用于修复日期偏移、Excel serial、JS Date 字符串泄漏、超链接导出、表格解析口径不一致等问题。
---

# Excel 开发

在 ohmyflight 仓库处理 Excel 工具时使用本 skill。先读 `AGENTS.md` 和 `.agents/skills/ohmyflight-dev/SKILL.md`，再执行本文件约束。

## 核心原则

- 在 Excel 读取边界统一归一数据，不把原始单元格对象一路传到渲染、匹配或导出层。
- 日期必须按“业务日期”处理，不按 JavaScript `Date` 的字符串表现处理。
- 表头、字段名、列名优先用结构化映射定位，不依赖示例文件名、固定 sheet 名或硬编码列号，除非 spec 明确要求。
- 导出给人工核对的 Excel 要保留必要上下文、异常说明和可点击超链接。
- 修改解析、日期、导出结构或业务口径时，先补核心测试，再改实现。

## 读取策略

浏览器 SheetJS 工具：

- 需要保留类型时，可以用 `raw: true`，但读取后必须立即把值转成业务层稳定类型。
- 需要显示预览时，可以用 `raw: false, dateNF: 'yyyy-mm-dd'`，但不能只靠显示文本完成核心规则判断。
- 使用 `cellDates: true` 时，Excel 日期单元格会变成 JS `Date`，不得直接 `String(value)`。
- 读取超链接时单独从单元格 `cell.l.Target` 或 `HYPERLINK()` 公式提取，导出时用真正的 hyperlink cell，不把多个链接拼成不可点击文本。

Python openpyxl 工具：

- 用 `load_workbook(..., data_only=True)` 读取业务值。
- `datetime` 或 `date` 必须在读取边界格式化成 `YYYY-MM-DD` 或业务需要的格式。
- 员工号、证件号、编号等字段要防止被 Excel 读成数字后丢前导零；读取后用专门的 normalize 函数处理。

## 日期策略

推荐实现一组小函数，不在业务逻辑里散落 `new Date(...)`：

- `isValidDate(value)`：判断有效日期对象。
- `makeLocalDate(year, month, day)`：用本地中午构造日期，避免 UTC 和夏令时边界。
- `excelSerialToDate(serial)`：优先用 `XLSX.SSF.parse_date_code(serial)` 或明确的 Excel epoch 转换。
- `parseDate(value)`：只支持明确格式。
- `formatDate(value)`：统一输出 `YYYY-MM-DD` 或 spec 要求的格式。

解析顺序：

1. 空值返回空。
2. `Date` 只取年月日，必要时处理 SheetJS 读出的 `23:59:59.999` 边界。
3. 数字在日期字段中按 Excel serial 处理。
4. `YYYYMMDD` 优先按 8 位日期处理，不能先当 serial。
5. `YYYY/M/D`、`YYYY-M-D`、`YYYY.M.D` 按年月日处理。
6. 拒绝 `5/11/26`、`11/5/26` 这类地区歧义短日期，除非 spec 明确写明业务口径。

禁止：

- 禁止用 `String(date)`、模板字符串或隐式拼接输出 Date。
- 禁止依赖浏览器 `new Date('2026/5/11')`、`new Date('5/11/26')` 兜底解析。
- 禁止用 `toISOString().slice(0, 10)` 生成本地业务日期或文件名日期；中国时区早上 8 点前会变成前一天。
- 禁止把普通数字文本字段自动转日期；编号、员工号、金额、序号可能也是数字。

## 导出策略

- Excel 导出要明确单元格类型，文本字段用字符串，数值字段用数值，日期字段按业务确认格式输出。
- 多个可点击链接要拆成多列或多行，不能把显示文字简单拼接到一个不可点击单元格。
- 文件名日期使用本地年月日函数，例如 `YYYY-MM-DD`，不要使用 UTC ISO 日期。
- 导出结果需要人工核对时，保留来源行号、状态、说明和异常原因。

## 测试策略

Excel 日期相关修改至少覆盖：

- Excel `Date` 对象输入。
- Excel serial 数字输入。
- `YYYYMMDD` 字符串和数字输入。
- `YYYY/M/D` 或 `YYYY-M-D` 文本输入。
- 歧义短日期应拒绝或按 spec 明确解析。
- 文本字段收到 Date 对象时不得输出 `GMT`、`中国标准时间`、`Invalid Date`。
- 普通数字文本字段不得被误转成日期。

表格解析和导出相关修改至少覆盖：

- 表头别名或字段名映射。
- 空行、缺列、异常值。
- 超链接读取和导出保持可点击。
- 导出 workbook 的 sheet 名、表头、关键单元格值和链接结构。

## 验证命令

先跑相关局部测试，再按 `ohmyflight-dev` 收尾要求运行：

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
```

业务测试直接导入 `src/` 模块，不从 `dist/` 或浏览器全局装载实现。文件上传、第三方库和页面接线使用 `npm.cmd run test:browser` 对生产构建做真实 Chromium 验证；真实 Excel 性能回放通过 `test:performance` 传入 owner 本地文件，输入和原始结果不提交。
