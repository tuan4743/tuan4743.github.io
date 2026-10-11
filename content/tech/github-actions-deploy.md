---
title: "用 GitHub Actions 三步搞定博客自动部署"
date: 2026-09-08T14:00:00+08:00
draft: false
tags: ["GitHub", "Hugo", "CI/CD"]
summary: "讲一下本站怎么搭的。"
comments: true
---

# 站点来源

两种来源:服务器部署和Github Pages/Cloudflare Pages等静态站点生成.  

## 服务来源

1. 买个云服务器  

去阿里云等国内云服务器厂商提供的云服务服务,浮动一百每年左右的价格.优点是有后端,比如我想挂一个持久化的评论区,就需要用后端,而不是像现在这样只能使用外部组件gisnus.  

不需要自己去申请SSL证书(当然你不申请也行,被举办了是另一件事情)  

2. 或者Github Pages/Cloudflare Pages等能够托管  

免费,网站代码大小不超过1G(我这光代码就超过250MB这一块),每个月限速100G(谁用得完).  

3. 私有云ECS  

富哥那还说啥了,该你富.问题是难度是最大,成本最高.  

## 静态站点生成器

[Hugo](https://github.com/gohugoio/hugo)或者[Astra](https://cn.wordpress.org/themes/astra/)或者[Hexo](https://hexo.io/zh-cn/),各自的markdown都很详细.  

## 站点模板

不想手搓可以上BiliBili或者Github上找博客模板.但是就算是手搓的也推荐使用模板开始搓,因为模板提供了很多贴图,按钮实现等.  

本站使用PaperMod标准主题,在此基础上定制.  

# 站点部署

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

## 配置关键点

- **权限**:`permissions.pages: write` + `id-token: write` 是 Pages 部署必需的;
- **并发控制**:同一时间只保留一个部署任务,避免连续推送时互相覆盖;
- **Hugo 版本**:与本地开发版本保持一致(`0.165.0`),避免本地与线上构建结果不一致;
- **触发器**:`workflow_dispatch` 允许在仓库 Actions 页面手动触发重新部署。

## 相关开源项目参考

- [Hugo](https://github.com/gohugoio/hugo) — 静态站点生成器
- [PaperMod](https://github.com/adityatelange/hugo-PaperMod) — 本站使用的主题
- [peaceiris/actions-hugo](https://github.com/peaceiris/actions-hugo) — GitHub Actions 中安装 Hugo 的官方社区动作
- [actions/deploy-pages](https://github.com/actions/deploy-pages) — GitHub 官方的 Pages 部署动作

感兴趣的话,可以把这条工作流复制到你自己的项目中试试。

# 定制汇总

## 主页

- 平板贴图+CD的blender模型+光驱的blender模型+一些小小的HTML动画
- SVG边框+按钮排布和实现
- 音频可视化星云粒子
- CD_1:emoji贴贴
- CD_2:蓝巨星旋转视频+行星贴图+摄像机视角
- CD_3:仿几何冲刺游戏,还原十分复杂
- CD_4:仿终端设计
- CD_5:窗雪,十分劣质的场景动画和交互
- 提示动画

## 正文页

- 右侧总面板+左下组件面板
- 左上摄像头+触发进度条
- 组件卡片+目录卡片
- 背景场景+数据库