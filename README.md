# 刷N题

**在线访问：<https://nstyz.github.io/dip-review/>**

把各种刷题网站收进一个地方。目前上线 1 个题库，后续继续增加。

## 题库 01 · 数字图像处理

**题库地址：<https://nstyz.github.io/dip-review/dip/>**

- 369 道题：333 道章节自测 + 29 道课本原题 + 7 道 DBSCAN 课件新增题
- 45 页复习精讲 PDF，含课本习题附录
- 403 道课本习题题号/考点索引
- 复习网页版支持 **浅色 / 深色 / 杂志风** 三种阅读主题

## 主站结构

```
index.html          刷N题主站
dip/                数字图像处理子网站
  index.html        刷题首页
  review.html       复习精讲网页版
  textbook.html     课本习题索引
  assets/           题库数据、样式、PDF
```

## 本地预览

    python -m http.server 8765
    # 打开 http://127.0.0.1:8765/

## 部署

纯静态 GitHub Pages，Source: **Deploy from a branch**，Branch: **main**，Folder: **/ (root)**。
