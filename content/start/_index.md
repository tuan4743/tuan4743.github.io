---
title: "你好?"
description: "方舟总控 AI"
comment: false
# ★★ 启动页是"裸页":它自己那一屏的样式全写在 layouts/start/list.html 的 <style> 里,
#    不要底带 HUD、不要星云背景、不要投影与 ECHO —— 用户原话"启动页很干净"。
#    ★ 为什么需要这个标记:extend_head.html 里那个判断是 `if not (.Param "isHome")`,
#      本意是"不是那块仿真屏幕就都算博客页"。启动页也不是那块屏,于是它被当成博客页,
#      挨了一套 page-hud.css + shell-page(实测:那一页会去下一份自己根本没有 DOM 的样式)。
#      ⇒ 判据变成"不是仿真屏幕,也不是启动页"。
bare: true
---
