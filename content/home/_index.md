---
title: "主页"
description: "仿真屏幕 · 平板主界面"
comment: false
# ★★ 这块"仿真屏幕"的标记 —— 原来它就是站点根,所以各处判据写的是 .IsHome。
#    启动页占了根之后它搬到 /home/,而 /home/ 不是严格意义的 Home 页(启动页才是)。
#    ⇒ 凡"只有这块屏才该有"的东西,判据一律改成 (.Param "isHome"):
#      · 左栏那枚音量条(nav-switches.html):少了它 cd-audio.js 拿不到 #sound-toggle
#      · 身体类名 intro-page / home-page:过场平移、背景那几条 CSS 都挂在这两个类上
#    ★ 写在【本页 front matter】里,不是 hugo.toml 的 [params] ——
#      后者是全站生效,音量条会长到每一篇博客页上。
isHome: true
---
