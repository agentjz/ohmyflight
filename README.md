<div align="center">

# ohmyflight

### 把反复点击、批量录入和表格核对，交给真正能跑的工具。

[项目主页](https://luckymaomi.github.io/ohmyflight/) · [工作技能](https://luckymaomi.github.io/ohmyflight/jobskill/) · [GitHub](https://github.com/luckymaomi/ohmyflight)

<p>
  <a href="https://github.com/luckymaomi/ohmyflight/actions/workflows/deploy-pages.yml"><img alt="Deploy Pages" src="https://img.shields.io/github/actions/workflow/status/luckymaomi/ohmyflight/deploy-pages.yml?branch=master&logo=githubactions&logoColor=white&label=Pages"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178C6"></a>
  <a href="https://www.python.org/"><img alt="Python 3.12" src="https://img.shields.io/badge/Python-3.12-3776AB"></a>
  <a href="https://vitest.dev/"><img alt="Vitest 4" src="https://img.shields.io/badge/Vitest-4-6E9F18"></a>
  <img alt="Static local-first" src="https://img.shields.io/badge/Architecture-static%20local--first-0f766e">
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/luckymaomi/ohmyflight?color=0f766e"></a>
</p>
</div>

## 当前工具

状态：✅ 已启用 · 🧪 Beta 测试 · 🧊 冷却中

| 工具 | 状态 | 功能 |
| --- | --- | --- |
| 培训皇帝 | ✅ | 查个人资质、排培训、核覆盖、看年度压力并更新有效期。 |
| 换季学习 | ✅ | 检查换季名单，均衡岗位和美线带队并移动导出实际安排。 |
| 审计之王 | ✅ | 从检查项检索手册证据，整理审计依据和 PDF 页面。 |
| 校对之王 | 🧪 | 比对同一本手册新旧版，复核新增、删除和修改。 |
| 姓名匹配员工号 | ✅ | 识别姓名并匹配员工号。 |
| 锁班皇帝 | ✅ | 批量录入锁班信息的 Python 工具。 |
| 飞行经历/左座经历起落数按天统计 | ✅ | 批量查询飞行经历、左座经历和起落数。 |
| 技术等级运行资格查询助手 | ✅ | 按 Excel 员工号逐人查询 IEB 技术等级和运行资格。 |
| 珠海皇帝 | 🧊 | 核对场次表与账单表姓名人次。 |
| 酒店皇帝 | ✅ | 对比酒店账单与入住登记表。 |
| 重点人员标注 | ✅ | 在审班表中标注重点人员。 |
| 航线班次统计 | ✅ | 按排班表统计每人各航线班次。 |
| 自动点 OA 助手 | 🧊 | 自动处理可确认的 OA 已阅待办。 |
| Word 模板填充器 | ✅ | 按配置生成表单并批量填充 Word 模板。 |
| PDF 工具 | ✅ | 提取、合并、转图片和图片转 PDF。 |
| PDF 加水印 | ✅ | 在 PDF 每页统一位置添加图片水印。 |
| 图片工具 | ✅ | 转换、压缩、裁剪、缩放和 Base64 互转。 |
| 文本拼接助手 | ✅ | 清除换行与常见分隔符，按指定字符重新拼接。 |
| 人员结构统计 | ✅ | 按报告口径统计人员结构并生成报告。 |

## 开源协议与贡献

本项目遵循 [MIT License](./LICENSE) 开源协议。

欢迎提交 Issue 或 Pull Request 改进工具、修复问题、补充文档。贡献前建议先阅读 [贡献指南](./CONTRIBUTING.md)，并尽量说明问题场景、输入样例、期望结果和验证方式。

## 目前

服务于：南货航飞行部、中国南方航空货运有限公司。

## 开发与构建

浏览器源码位于 `src/`，使用标准 ESM 显式依赖；每个页面由一个应用入口构建，第三方浏览器库继续从 `public/libs/` 本地加载。生产产物输出到 `dist/`。

Windows 下可直接运行 `start_index.py` 构建并打开本地站点；脚本在本机 `4567` 端口成功启动服务后打开页面，端口被占用时会直接报告错误。

```powershell
npm.cmd ci
python -m pip install -r requirements.txt
python -m playwright install chromium
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify
```

`npm.cmd run verify` 覆盖类型检查、TypeScript/Python 全量测试、真实 Chromium 页面与脱敏重型流程和连续双构建。真实 Excel 性能回放使用 `npm.cmd run test:performance -- --training-workbook <培训表> --seasonal-workbook <换季表>`；输入和原始结果不提交。构建与恢复约定见 [`spec/dev/esm-delivery/delivery.md`](./spec/dev/esm-delivery/delivery.md)。
