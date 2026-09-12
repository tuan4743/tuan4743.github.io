本目录放两套字体,放进来即自动生效,不需要改代码。

① 拉丁 / 数字字体:Alpha Sector(文件任选其一)
       AlphaSector.woff2      ← 优先(体积最小)
       AlphaSector.ttf
       AlphaSector.otf

② 中文字体:像素字体(文件任选其一)
       PixelCN.woff2
       PixelCN.ttf
       PixelCN.otf

如果文件名不一样:改 assets/css/holo.css 顶部两个 @font-face 的 src 即可。

工作方式(浏览器按字符回退,自动分工):
   "Alpha Sector"  →  拉丁字母与数字
   "Pixel CN"      →  中文
   后面的系统字体   →  以上都没有的字符兜底
所以同一个界面上,英文数字是 Alpha Sector,中文是像素字体,不会互相干扰。

像素字体小贴士:
· 像素字体在"整数倍字号"下最清晰(比如 12px / 16px / 24px)。
  界面里的字号都是变量,可以在 assets/css/holo.css 顶部调:
    --title-size      主题字号(默认 clamp(30px, 5.6vh, 56px))
    --panel-fs        面板字号(默认 10px)
    --ring-mid-fs     中环文字字号(默认 11px)
    --caption-size    配文字号
· 想让中文更锐利:--ui-pixel-smooth: none;  想柔和一点:改成 auto;
