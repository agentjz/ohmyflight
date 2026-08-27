# 浏览器 ESM 构建与恢复

## 源码与页面入口

- 浏览器内部源码位于 `src/`，统一使用标准 ESM `import`/`export` 表达依赖。
- `scripts/build.mts` 中的 `pageEntries` 是生产页面入口清单；每个清单页面输出一个 ESM 应用包。
- HTML 可以在应用入口前加载主题脚本和必要的本地第三方 UMD 库，但不得用多个内部业务脚本的标签顺序装配应用。
- 第三方全局只在页面组合根或局部适配器中收窄；内部模块不通过 `window.*` 注册表互相查找。
- 校对之王比较 Worker 单独输出为 ESM Worker；Python APP、生成数据和静态文件按原目录复制。

## 构建产物

`npm.cmd run build` 清理并重新生成 `dist/`：

- 页面应用包和 source map；
- `tool/app/proof-king/comparison-worker.js`；
- Python APP 资产；
- `tool/skills-data.json` 与 `tool/beginner-tutorial-data.json`；
- `build-manifest.json`，记录页面源码、页面路径、输出文件和 SHA-256；
- `version.json`，只记录提交事实，不写本地分支或构建时间。

构建不会逐文件发布 `src/**/*.ts` 对应的普通脚本，也不从 HTML 脚本顺序推断依赖。

## 验证命令

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run verify:deterministic
```

- `verify` 执行类型、全量 TypeScript/Python 测试和确定性双构建。
- `verify:deterministic` 在两个独立系统临时目录执行生产构建并比较全部文件路径和内容哈希，不读写当前 `dist/`，避免与并行构建相互覆盖。
- 页面视觉效果由 owner 人工检查。

## 从零恢复

在有 Git、Node 22、npm、Python 3.12 的清洁环境中执行：

```powershell
npm.cmd ci
python -m pip install -r requirements.txt
npm.cmd run verify
```

验证结束后的 `dist/` 是可直接静态托管的完整站点。发布流程只上传 `dist/`，不需要 Node 或 Python 常驻服务。

本地运行 `start_index.py` 时，脚本先构建 `dist/`，再绑定本机 `4567` 端口；只有服务成功绑定后才打开对应的 `/index.html`，端口冲突时直接报告错误，避免误开到无关服务。

若构建失败，先按报错修复源码、入口清单、静态文件或第三方清单；不要从旧 `dist/` 回填源码，也不要恢复旧全局脚本链。
