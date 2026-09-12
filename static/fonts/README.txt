把 Alpha Sector 字体文件放在这个目录里,文件名保持下面之一,UI 会自动用上:

    AlphaSector.woff2      ← 优先(体积最小)
    AlphaSector.ttf
    AlphaSector.otf

说明:
· Alpha Sector 只含拉丁字母与数字,不含中文字形。
  UI 里凡是中文的地方会自动回退到系统中文字体(黑体/苹方等),不会出现方框。
· 换字体只改 assets/css/holo.css 顶部 @font-face 的 src 即可。
