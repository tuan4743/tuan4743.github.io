# Tuagfey Blog

个人博客,基于 [Hugo](https://gohugo.io) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题,托管于 GitHub Pages,绑定域名 [tuagfey.com](https://tuagfey.com)。

**这一页本身就是这个项目的一部分**:你现在看到的这台"显示器 + CD 架 + 光驱"整站交互
(Three.js 场景、每张盘一套开机动画、音频可视化、几何冲刺式关卡引擎)
都是在这个仓库里手写的,没有用现成的模板。

## 本地开发

1. 下载 Hugo (extended):<https://github.com/gohugoio/hugo/releases>
2. 运行本地服务器:

```bash
hugo server -D
```

3. 打开 <http://localhost:1313>

## 部署

推送到 `main` 分支后,GitHub Actions(见 `.github/workflows/deploy.yml`)会自动构建并发布到 GitHub Pages。

## 目录结构

```
content/          文章内容 (Markdown)
themes/PaperMod   主题
static/           静态资源 (CNAME、favicon 等)
layouts/          页面模板(首页的整个交互场景在这里)
assets/js/        手写的交互脚本(cd3d / cd-boot / page-* …)
hugo.toml         站点配置
```
