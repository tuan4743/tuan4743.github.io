---
title: "用 GitHub Actions 三步搞定博客自动部署"
date: 2026-09-08T14:00:00+08:00
draft: false
tags: ["GitHub", "Hugo", "CI/CD"]
summary: "这个博客从 git push 到上线全自动,背后的关键就是 GitHub Actions 工作流。本文拆解部署原理与完整配置。"
---

本站的部署流程是:**推送代码 → GitHub Actions 自动构建 → 发布到 GitHub Pages**。整个过程无需手动操作,本文拆解其中的原理与配置,感兴趣的可以直接参考。

## 原理

1. 向 `main` 分支推送代码后,GitHub Actions 触发 `Deploy Hugo site to Pages` 工作流;
2. 工作流在 Ubuntu 上安装 Hugo(extended 版),执行 `hugo --minify` 生成静态文件;
3. 把生成的 `public/` 目录作为 artifact 上传,再由 `deploy-pages` 动作发布到 GitHub Pages。

## 完整工作流配置

本站使用的配置位于 `.github/workflows/deploy.yml`:

```yaml
name: Deploy Hugo site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: "0.165.0"
          extended: true
      - name: Build
        run: hugo --minify
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 关键点

- **权限**:`permissions.pages: write` + `id-token: write` 是 Pages 部署必需的;
- **并发控制**:同一时间只保留一个部署任务,避免连续推送时互相覆盖;
- **Hugo 版本**:与本地开发版本保持一致(`0.165.0`),避免本地与线上构建结果不一致;
- **触发器**:`workflow_dispatch` 允许在仓库 Actions 页面手动触发重新部署。

## 相关开源项目

- [Hugo](https://github.com/gohugoio/hugo) — 静态站点生成器
- [PaperMod](https://github.com/adityatelange/hugo-PaperMod) — 本站使用的主题
- [peaceiris/actions-hugo](https://github.com/peaceiris/actions-hugo) — GitHub Actions 中安装 Hugo 的官方社区动作
- [actions/deploy-pages](https://github.com/actions/deploy-pages) — GitHub 官方的 Pages 部署动作

感兴趣的话,可以把这条工作流复制到你自己的项目中试试。
