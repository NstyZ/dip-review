# DIP 期末刷题站 · GitHub Pages

这是可直接部署到 GitHub Pages 的**纯静态网站**：无需 Node、Python 或后端，所有题目数据都在 `assets/data.js` 中，进度保存在访问者自己的浏览器 localStorage。

## 方式一：用脚本发布（推荐）

1. 安装并登录 GitHub CLI（只需一次）：
   - 安装：https://cli.github.com/
   - 登录：`gh auth login`
2. 在本文件夹打开 PowerShell，运行：
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\发布到GitHub.ps1
   ```
3. 按提示输入仓库名（默认 `dip-review`）。脚本会创建公开仓库、推送代码，并尝试开启 GitHub Pages。
4. 打开仓库的 **Settings → Pages**，确认：
   - Source: **Deploy from a branch**
   - Branch: **main**，Folder: **/ (root)**
5. 约 1–2 分钟后访问：
   ```
   https://你的GitHub用户名.github.io/dip-review/
   ```

## 方式二：手动发布

```bash
git init -b main
git add .
git commit -m "Publish DIP quiz site"
gh repo create dip-review --public --source=. --remote=origin --push
```

然后到仓库 **Settings → Pages**：
- Source 选择 **Deploy from a branch**
- Branch 选 **main**，目录选 **/ (root)**
- 保存后等待 1–2 分钟

## 内容说明

- 333 道题：170 单选 + 64 判断 + 49 填空 + 13 简答 + 25 计算 + 12 方案设计
- 单选/判断即时判题；填空/简答/计算/方案设计对照参考答案自评
- 错题本、收藏夹、全局搜索、章节练习、37 题模拟卷、学习统计
- 不包含老师原始课件 PDF；仓库里只有自己整理的静态网站文件
- 所有链接均为相对路径，因此无论仓库名是什么都能在 `https://用户名.github.io/仓库名/` 下运行

## 本地预览

```bash
python -m http.server 8765
# 打开 http://127.0.0.1:8765/
```
