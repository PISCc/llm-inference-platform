# Git 与备份恢复说明

## 当前仓库策略

- 源码、配置、文档和 `dist/index.html` 纳入 Git。
- `node_modules/`、Vite 缓存、日志、环境变量和临时浏览器文件不纳入 Git。
- 依赖由 `package-lock.json` 固定，恢复后运行 `npm ci` 即可重建。
- 文本文件统一使用 LF，避免 Windows 换行造成大面积无效差异。

## 日常安全流程

```powershell
npm run build
git diff --check
git status --short
git add -A
git commit -m "说明本次变更"
.\scripts\backup-project.ps1
```

## 从 Git Bundle 恢复完整仓库

```powershell
git clone "备份文件.bundle" llm-inference-platform-restored
cd llm-inference-platform-restored
npm ci
npm run build
```

Git Bundle 包含提交历史、分支和标签，适合在仓库损坏或目录误删后恢复。

## 从源码 ZIP 恢复当前文件

1. 解压 `source.zip`。
2. 在项目目录运行 `npm ci`。
3. 运行 `npm run build` 重新验证。

源码 ZIP 包含源码、配置、文档和离线产物，但不包含 `node_modules` 和 `.git`。

## 从补丁恢复未提交修改

```powershell
git apply --binary "working-tree.patch"
```

只有备份时工作区存在未提交修改，补丁文件才会包含内容。
