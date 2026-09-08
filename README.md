# Tuagfey Blog

个人博客,基于 [Hugo](https://gohugo.io) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题,托管于 GitHub Pages,绑定域名 [tuagfey.com](https://tuagfey.com)。

## 本地开发

1. 下载 Hugo (extended):<https://github.com/gohugoio/hugo/releases>
2. 运行本地服务器:

```bash
hugo server -D
```

3. 打开 <http://localhost:1313>

## 部署

推送到 `main` 分支后,GitHub Actions(见 `.github/workflows/deploy.yml`)会自动构建并发布到 GitHub Pages。

## 自定义域名

- 仓库 Pages 设置中已将 Custom domain 设为 `tuagfey.com`
- DNS 配置:
  - `A` 记录 `@` → `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153`
  - `CNAME` 记录 `www` → `tuan4743.github.io`

## 目录结构

```
content/          文章内容 (Markdown)
themes/PaperMod   主题
static/           静态资源 (CNAME、favicon 等)
hugo.toml         站点配置
```
