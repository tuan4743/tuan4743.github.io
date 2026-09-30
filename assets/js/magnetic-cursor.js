/* ============================================================
   磁力光标 v3:四角锁定框(canvas 版)
   ─────────────────────────────────────────────────────────────
   为什么从 DOM 换成 canvas:要做"线内侧亮、往外衰减"的渐变 + 青色外发光,
   而 CSS 的 border 没法上渐变(四角的 i 元素就是靠 border 画的)。
   画在 canvas 上以后,渐变色差、发光、刻度、呼吸、抖动都好控制。

   画什么(用户点名要的四条):
     ① 四条角线:每根从角点出发,线性渐变到透明(内亮外淡)+ 青色外发光(shadowBlur)
     ② 中心点:呼吸缩放(半径按正弦循环)+ 一圈柔光;锁定时让位给框体
     ③ 微抖动:整框做极小的随机位移(平滑随机游走,不是每帧乱跳)
        —— 模拟"光学信号不稳定",不要死钉在一个位置
     ④ 辅助刻度:每个角的两条边旁边各加几根细小垂直线(雷达/光学瞄准那种)

   行为沿用 v2:向鼠标平滑收敛、按横向速度轻微倾斜、慢速自转、
   悬停到可点元素上时"磁吸"放大并转正、触屏/减少动效时不启用。
   CSS 里那套 .magnetic-cursor / .magnetic-dot 的旧样式现在没人用了(元素不再创建),
   但 html.magnetic-on / .magnetic-locked / .magnetic-reduced 这几个 class 照旧挂 ——
   "隐藏系统光标"和别处的样式判断还靠它们。
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(pointer: coarse)").matches) return;   /* 触屏不启用 */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 行为参数(v2 沿用)---------- */
  var SMOOTH = 0.22;      /* 框体跟随平滑度(0~1,越小越"拖") */
  var MAGNET = 0.12;      /* 磁吸强度(0=完全吸附目标中心,1=完全跟手) */
  var PAD = 10;           /* 包住目标时的外扩(px) */
  var ROT_MAX = 7;        /* 速度倾斜最大角度(度),0 = 不倾斜 */
  var VEL_DIV = 5200;     /* 速度→角度换算除数 */
  var SPIN = 24;          /* 实时自转速度(度/秒),0 = 不自转 */
  var SPIN_SLOW = 0.12;   /* 锁定目标时自转的衰减系数 */
  var ROT_EASE = 0.12;    /* 旋转角平滑收敛速度 */
  var SIZE_EASE = 0.16;   /* 框体大小收敛速度(原来靠 CSS 的 0.18s 过渡)*/

  /* ---------- 新增:外观参数 ---------- */
  var JITTER = 1.2;       /* 微抖动幅度(px):整框的随机漂移上限 */
  var DRIFT = [0.29, 0.71];   /* 两个漂移频率(Hz):叠加起来像"信号不稳"的慢漂 */
  var DRIFT_PH = [Math.random() * 6.28, Math.random() * 6.28];
  var ARM = 0.42;         /* 角线长度 = 框体短边 × 这个比例 */
  var ARM_MAX = 26;       /* 角线最长(px) */
  var PULSE = 0.26;       /* 中心点呼吸幅度(半径的比例)*/
  var PULSE_HZ = 0.85;    /* 呼吸频率(Hz)*/
  var TICKS = [0.46, 0.78];   /* 辅助刻度落在角线的哪个位置(比例)*/
  var TICK_LEN = 4.5;     /* 刻度短线长度(px)*/
  var GLOW = 7;           /* 外发光半径(px)*/

  var SELECTOR = [
    "[data-magnetic]", ".menu a", ".nav-right a", ".side-item", ".side-search",
    ".glass-btn", ".repo-card", ".post-entry", ".slot-toggle", ".rack-close",
    ".theme-toggle", ".palette-swatch", ".search-result-item", ".post-row",
    /* ★ 平板主界面里的 APP 图标(用户在那边报过"鼠标的扫描框移上去不会吸附")。
       它们是 <a class="tablet__app">,而下面那条兜底只认 button ——
       所以第一版里只有"播放器"那枚 <button> 会吸,五个导航 APP 全都不吸。
       卡片上的链接(最近更新/标签)同理,一起列进来。 */
    ".tablet__app", ".tablet__recent-item", ".tablet__tag",
    /* ★★ 右侧 HUD(用户第五轮反馈:"有一些按钮鼠标移上去不会吸附,比如搜索框、
       下载、Github,以及导航页")。原因就是这个白名单:兜底那条只认 button,
       而 HUD 里下载/GitHub 是 <a>、导航项是 <a>、搜索框是 <input> —— 一个都不匹配。
       明暗和三支笔之所以会吸,只是因为它们恰好是 <button>。 */
    ".hud-act", ".hud-nav__item", ".hud-search input", ".hud-search__clear",
    /* ★★ 左下角那个 UHD 上的按钮(用户:"这几个按钮现在还不能被锁定框锁定")。
       ★ 它们不是普通方块:盒子 = 那个梯形的【外接矩形】,形靠 clip-path 收出来
         (page-hud.js 的 gFrameLB().boxes 写的)—— 所以 getBoundingClientRect()
         量到的正好是那枚按钮的框,锁定框贴得住。
       ★ 面板上的收起键也一起(它和 HUD 里别的关闭键同一套语言)。 */
    ".hud-left__mod",
    /* ★ .hud-logo 不在这里:用户明确说"它只是个 LOGO,不需要吸附"。 */
    ".hud-pen__btn", ".hud-pen__range", ".hud-pen__swatch",
    /* ★ 排除第五张盘的碎片:.frost-shard 也是 <button>,但它只有 18~37px,
       磁吸(MAGNET=0.12)会把画出来的光标整个拉到碎片中心、并且把中心点藏起来 ——
       用户看到的是"光标和实际化霜的位置对不上"(真实指针在化霜,画出来的光标跑了)。
       碎片靠"边缘爆闪"提示就够了,不需要磁吸。 */
    "button:not(.frost-shard)",
    /* ★★★ 第三轮用户反馈:"内容页的某些可点击事件,比如文本链接、标签、上下一页等,
       扫描框不会锁"。又是同一个毛病:这些都是 <a>,而兜底那条只认 <button>。
       ⇒ 把正文里"能点的东西"全补进来。
       ★ 这里用【排除法】(main.main 下所有 a,再排掉不该锁的)而不是一个个列类名:
         正文链接的形态太多(行内链接、外链、脚注、代码块里的链接……),列类名必漏;
         真正不该锁的只有这几个:
           · .anchor  —— 标题旁边那个 "#" 锚点,贴着标题,锁它会跟划词打架
           · .toc a   —— PaperMod 自带的折叠目录(哪天开出来时)
         (目录自己的 .hud-toc__item 不在这里,它自己那条已经单独列了。) */
    "main.main a:not(.anchor)",
    /* ★★ 实测(CDP 在真页面上逐条 matches 查出来的):标题旁的 .anchor
       是被【这几条】漏进来的 —— 我一开始只在 main.main a 那条写了 :not(.anchor),
       而 .post-single a / .post-content a 同样匹配 <a class="anchor">,
       于是"排除了却还在"。那个锚点量出来是 0×0(PaperMod 的 "#" 静止时不显示),
       锁一个 0 尺寸的框没有意义,所以这几条也一并排除。 */
    ".post-tags a", ".post-single a:not(.anchor)", ".post-content a:not(.anchor)",
    ".paginav a", ".post-nav a",
    ".post-footer a", ".entry-footer a", ".breadcrumbs a", ".footer a",
    ".top-link", ".share-buttons a", ".terms-tags a"
  ].join(",");

  /* 笔形态的光标:记号笔 = ×(两笔交叉),荧光笔/橡皮 = 圆框(直径 = 笔的大小) */
  var penShape = null, penT = 0;   /* 笔形态:形状 + 展开进度(0~1)*/

  /* ★★★ 这就是【锁定框的美术】原样搬过来(用户:"这个美术不对啊,应该沿用之前锁定框的
     美术,因为这只是锁定框的两种形态" + "现在是纯青色,缺少内发光")。
     锁定框那四条角线是 gradLine 画的,它的渐变是:
        白 (0.95α) → 青 (0.85α, 28% 处) → 透明
     再叠一层 shadowColor=青 + shadowBlur 的外发光 —— 那个"白心 + 青晕"就是内发光。
     上一版我用 strokeStyle=COLOR 平涂,所以看着是"纯青色、没有内亮"。
     · 记号笔 = ×:四条臂从中心往外,中心是白心(和角线的亮端在角上同理);
     · 荧光笔/橡皮 = 圆框:四段弧(断口在四个斜角上),同样的白心 + 青晕;
     · 两个都跟着 rot 转。 */
  function penGlow(on) {
    if (on) { ctx.shadowColor = hexA(COLOR, 0.75); ctx.shadowBlur = GLOW; }
    else { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; }
  }

  /* ★★★ 中心那个光点,三处必须是同一个东西(用户:"鼠标中心的那个光点呢?怎么不见了")。
     真原因有两个,都是我自己造出来的:
       ① 笔形态里我写的是 Math.max(1.1, DOT / 5) —— DOT=10 时半径只有 2px,
          整颗点 4px 宽、正压在 4 条白心线交叉的位置上,等于没画;
       ② 未锁定时的那个点带呼吸(半径 DOT/2 起跳,还有一圈 4.2 倍半径的柔光),
          形状和大小都对不上,所以视觉上"换了一颗点"。
     现在抽成一个函数:未锁定 / 记号笔 / 圆框三种情况调的都是它。
     breath = 呼吸系数(未锁定时才动,笔形态固定 1)。 */
  function drawCenterDot(x, y, alpha, breath) {
    var r = Math.max(1.6, (DOT / 2) * (breath || 1));
    ctx.save();
    var g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
    g2.addColorStop(0, hexA(COLOR, 0.5));
    g2.addColorStop(1, hexA(COLOR, 0));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eaf3ff";
    ctx.shadowColor = hexA(COLOR, 0.9);
    ctx.shadowBlur = GLOW + 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPenCursor(ctx, x, y, cfg, t, rotDeg, alpha) {
    t = typeof t === "number" ? t : 1;
    var rad = 0;
    var rotRad = (rotDeg * Math.PI) / 180;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    if (cfg.shape === "x") {
      /* ★★★ 真 bug(用户:"×还是不转"):× 的四条臂是 gradLine 画的,而 gradLine 用的是
         「绝对坐标 + 自己 save/restore」,它不看当前变换矩阵 —— 所以外面 ctx.rotate 转了
         等于没转(圆框那半边走的是 arc,arc 吃当前矩阵,所以只有它在转)。
         现在把四条臂放进和圆框同一套 translate + rotate 里,坐标改成以中心为原点。
         另一半原因更隐蔽:直角 × 是 90° 对称的,转 90° / 180° / 270° 和原图一模一样,
         所以就算真的在转,眼睛也看不出来。⇒ 让那团【白色内芯】跟着 rot 沿对角臂打转
         (青晕位置不动,所以还是原来那个 ×;亮芯绕着中心跑,旋转才看得见)。 */
      var arm = Math.max(1, (cfg.size || 10) * t);
      var coreT = Math.min(0.9, Math.max(0, Math.abs(Math.sin(rotRad)) * 0.62 + 0.06));
      ctx.translate(x, y);
      ctx.rotate(rotRad);
      gradLine(0, 0, -arm, -arm, alpha, true, coreT);
      gradLine(0, 0, arm, -arm, alpha, true, coreT);
      gradLine(0, 0, -arm, arm, alpha, true, coreT);
      gradLine(0, 0, arm, arm, alpha, true, coreT);
    } else {
      rad = Math.max(0.8, ((cfg.size || 8) / 2) * t);
      ctx.translate(x, y);
      ctx.rotate(rotRad);                       /* ★ 跟着转 */
      var gap = Math.PI / 7;
      for (var k = 0; k < 4; k++) {
        var mid = Math.PI / 4 + (k * Math.PI) / 2;
        var f0 = mid - Math.PI / 4 + gap, f1 = mid + Math.PI / 4 - gap;
        penGlow(true);
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = hexA(COLOR, 0.85 * alpha);
        ctx.lineWidth = THICK;
        ctx.beginPath(); ctx.arc(0, 0, rad, f0, f1); ctx.stroke();
        /* 白心那一道(比青线细一点、亮一点 —— 和 gradLine 的 0 号色标同源)*/
        penGlow(false);
        ctx.globalAlpha = 0.9 * alpha;
        ctx.strokeStyle = "rgba(255,255,255," + (0.9 * alpha).toFixed(3) + ")";
        ctx.lineWidth = Math.max(0.6, THICK * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, rad, f0, f1); ctx.stroke();
      }
    }
    penGlow(false);
    ctx.restore();
    /* 中心光点 = 鼠标真实位置(和未锁定时那颗点完全同一套画法)*/
    drawCenterDot(x, y, alpha);
  }

  /* ---------- DOM:一张铺满视口的画布 ---------- */
  var cv = document.createElement("canvas");
  cv.className = "magnetic-cursor-cv";
  cv.setAttribute("aria-hidden", "true");
  var st = cv.style;
  st.position = "fixed";
  st.left = "0";
  st.top = "0";
  st.width = "100%";
  st.height = "100%";
  st.pointerEvents = "none";
  st.zIndex = "9999";
  st.opacity = "0";
  st.transition = "opacity .18s ease";
  document.body.appendChild(cv);
  var ctx = cv.getContext("2d");

  /* 取值:优先 --mc-*(站点调色板),取不到就用兜底 */
  function cssVar(name, dflt) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : dflt;
  }
  var COLOR = cssVar("--mc-color", "#7ff0ff");    /* 主打青色(和其它 HUD 一致)*/
  var SIZE = parseFloat(cssVar("--mc-size", "34px")) || 34;
  var DOT = parseFloat(cssVar("--mc-dot", "6px")) || 6;
  var THICK = parseFloat(cssVar("--mc-thick", "1px")) || 1;

  var target = null;
  /* ★★★ window.__mcScript:【剧本模式】—— 首页引导用。
     背景:引导要的是"扫描框磁吸到某个部件上,而且【停在那个部件的框上】"。
     光靠派发合成 mousemove/mouseover 是不够的:
       · 合成 mouseover 确实能设上 target,但边框尺寸是 tick 里用
         SIZE_EASE 平滑逼近的,而且外扩按"目标尺寸的 16%"算 ——
         小按钮上框比按钮大一圈、大区域上又几乎看不出来;
       · 更要命的是,引导要的是"吸附到这一整块区域"(比如整个平板、
         CD 轮盘那一带),而那里根本没有对应的 DOM 元素可以 mouseover。
     ⇒ 给剧本一个直接的覆盖:{x, y, w, h} 就是框最终该在的矩形,
       设上之后 tick 不再自己算位置/尺寸,直接把框画在那儿;
       同时给 target 留一个占位对象,让"锁定态"的观感(停止抖动)照旧成立。
     ★ 它【只覆盖位置与尺寸】,不动颜色、角线长短、外发光那些美术参数 ——
       用户要的是"沿用锁定框的美术",不是另一套。 */
  function scriptBox() {
    var s = window.__mcScript;
    if (!s) return null;
    if (typeof s.x !== "number" || typeof s.y !== "number") return null;
    return s;
  }

  var target = null;
  var mx = -999, my = -999;        /* 鼠标真实坐标(中心点用,严格贴手)*/
  var fx = -999, fy = -999;        /* 框体坐标(平滑)*/
  var fw = SIZE, fh = SIZE;        /* 框体尺寸(平滑)*/
  var spinAngle = 0, rot = 0;
  var jx = 0, jy = 0;              /* 微抖动偏移(平滑随机游走)*/
  var pulse = 0;                   /* 呼吸相位*/
  var fade = 0, fadeTo = 0;        /* 显隐淡入淡出*/
  var last = 0, raf = 0;
  var dpr = 1;

  function angleDelta(to, from) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function resize() {
    /* ★★★ 真 bug(第十轮从代码里找出来的):这里原来用 window.innerWidth/innerHeight,
       它们【包含滚动条】;而画布的 CSS 尺寸是 100%(不含滚动条)。
       博客页一定有纵向滚动条 ⇒ 后备缓冲比 CSS 盒子宽出那 15~17px ⇒
       浏览器把画布【横向拉伸】了 scrollbar/innerWidth(约 1.3%),
       于是画出来的框离原点越远偏得越多 —— 导航栏在最右边,偏移最大,
       用户看到的就是"吸附框位置不对,整体偏左"。
       ⇒ 用 documentElement.clientWidth/Height:和 CSS 的 100% 是同一个盒子。 */
    var w = document.documentElement.clientWidth || window.innerWidth;
    var h = document.documentElement.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  /* 一条带渐变 + 外发光的线:从 (x1,y1) 亮,到 (x2,y2) 淡出
     coreT(可选,0~1)= 那团"白色内芯"落在整条线的哪个位置。
       不传 = 0(亮端就在起点,角线一直是这个画法);
       只有记号笔的 × 传它 —— × 是 90° 对称的,亮芯不绕着中心跑,
       转起来眼睛根本看不出(见 drawPenCursor 里的说明)。 */
  function gradLine(x1, y1, x2, y2, alpha, glow, coreT) {
    var ct = ((typeof coreT === "number" && isFinite(coreT)) ? Math.max(0, Math.min(0.9, coreT)) : 0);
    var mid = Math.max(ct + 0.02, 0.28);
    var g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, "rgba(255,255,255," + (0.95 * alpha * (1 - ct)).toFixed(3) + ")");
    if (ct > 0) g.addColorStop(ct, "rgba(255,255,255," + (0.95 * alpha).toFixed(3) + ")");
    g.addColorStop(mid, hexA(COLOR, 0.85 * alpha));
    g.addColorStop(1, hexA(COLOR, 0));
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = THICK;
    ctx.lineCap = "round";
    if (glow) { ctx.shadowColor = hexA(COLOR, 0.75); ctx.shadowBlur = GLOW; }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    /* 再压一层很淡的亮芯:线看着"内部亮"*/
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 * alpha).toFixed(3) + ")";
    ctx.lineWidth = Math.max(0.6, THICK * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  function hexA(hex, a) {
    var h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "rgba(127,240,255," + a.toFixed(3) + ")";
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.08, (now - last) / 1000) || 0.016;
    last = now;
    var wh = resize();
    var W = wh[0], H = wh[1];
    ctx.clearRect(0, 0, W, H);
    if (mx < -900) return;

    /* ★★ 选了笔之后的鼠标形态(用户第九轮):
         · 记号笔 → 从矩形扫描框收紧到中心光点,再展开成一个 ×,而且【实时跟手】;
         · 荧光笔 / 橡皮 → 圆框,直径 = 那支笔选的大小。
       配置由 page-hud.js 写进 window.__mcPenCfg(它知道当前选了哪支笔、多大)。 */

    /* ---- 目标点与尺寸:磁吸时贴向目标中心 ---- */
    var sb = scriptBox();
    var tx = mx, ty = my, tw = SIZE, th = SIZE;
    var small = false;
    if (sb) {
      /* 剧本模式:位置/尺寸就是剧本给的那个矩形,不走磁吸也不走缓动 */
      tx = sb.x; ty = sb.y; tw = sb.w; th = sb.h;
    } else if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      /* ★★ 小目标【不做磁吸偏移】(用户第八轮:"吸附框的位置还是不对啊,就是偏左,
         你可以看看 CD 页的几个按钮的吸附框怎么做的,那几个很准")。
         CD 页那几个是大按钮,12% 的偏移相对尺寸看不出来;HUD 里 52~72px 的方按钮,
         同样的绝对偏移 + 外扩就明显"框跑到左边去了"。
         ⇒ 小于 90px 的目标:MAGNET 记 0(框严格压在目标中心),只有大件才吃磁吸。 */
      small = Math.min(r.width, r.height) < 90;
      var mg = small ? 0 : MAGNET;
      tx = cx + (mx - cx) * mg;
      ty = cy + (my - cy) * mg;
      /* ★★ 外扩按目标尺寸走(用户第五轮:"下面的三个笔,吸附的框和实际的框偏移比较大")。
         原来是固定 PAD=10 ⇒ 一个高 30px 的按钮被撑成 50px 的框,看着就是"框和按钮不重合"。
         现在小目标按 22% 外扩(最小 4px),大目标照样 10px 封顶。 */
      /* ★ 再收一档:用户第七轮又说"吸附框还是有偏差,基本都是有点偏大+偏左"。
         22% 对 64px 的方按钮仍是 14px(被 PAD 封到 10)⇒ 框比按钮大 20px。
         现在小目标按 10% 走(64px ⇒ 6.4px),最小 3px —— 框基本贴着按钮。 */
      /* ★★★ 真 bug(第九轮才揪出来):这两行原来【不是一个公式】——
         上一轮只把"宽"改成 10%,"高"还留着旧的 22% ⇒ 框又扁又大、
         和按钮不是一个尺寸(用户:"吸附框的位置还是不对啊,整体就是图片的效果")。
         现在宽高共用同一个 pad。 */
      /* ★★ 小目标:pad = 0 —— 框【严格贴合】目标的矩形,一点都不外扩。
         用户连着三轮说"偏大",那就干脆不加:框和按钮四条边重合。 */
      /* ★ 小目标给 4px:严丝合缝太紧(用户:"应该略大一点点"),10% 又偏大。 */
      var pad = small ? 4 : Math.min(PAD, Math.max(4, Math.min(r.width, r.height) * 0.16));
      /* ★★ window.__mcPad:外扩量的显式覆盖(px)。首页引导要说"扫描框吸附到
         整个平板页面" —— 那时框贴着一整块屏的四条边,按 16% / PAD=10 算出来的
         外扩在小屏上几乎看不见,框读起来还是"小小一个"。引导脚本给它一个
         负值(往内收),框就正好落在平板玻璃里面。 */
      if (typeof window.__mcPad === "number" && isFinite(window.__mcPad)) pad = window.__mcPad;
      tw = r.width + pad * 2;
      th = r.height + pad * 2;
    }

    /* ---- 平滑收敛(帧率无关)----
       ★★ 这里【保持缓动】:用户明确说过"瞬时吸附绝对不要改,给我改回去"。
          曾经试过"小目标一帧到位",被否掉了 —— 手感的连续性比"看起来准"重要。
       ★ 剧本模式(引导)用 0.20:约 150ms 收敛。
         为什么比手玩快:剧本的矩形是【每一帧重新量】的(机器在平移、
         玻璃在贴合),收敛太慢就永远追不上目标 —— 而用户要的是
         "磁吸上去、然后稳稳贴住",不是"框在后面慢慢飘"。 */
    var k = 1 - Math.pow(1 - (sb ? 0.20 : SMOOTH), dt * 60);
    var px = fx, py = fy;
    fx += (tx - fx) * k;
    fy += (ty - fy) * k;
    var ks = 1 - Math.pow(1 - (sb ? 0.20 : SIZE_EASE), dt * 60);
    fw += (tw - fw) * ks;
    fh += (th - fh) * ks;

    /* ---- 旋转:自转 + 速度倾斜;锁定时转正 ----
       ★★ window.__mcSpinScale:自转速度的倍率(默认 1)。
          首页引导要把框"停在"某个部件上给用户看,以 24°/s 自转的那个小方块
          读起来像个转动的图标,不像"锁定框"。引导脚本把它压到 0.12,
          框就安静下来了 —— 引导结束再把倍率还原。
       ★★★ var lean 这一行【不能删】:它下面那个 if 只负责"要不要算",
          而 targetRot 在 if【外面】读 lean。删掉声明的话整个 tick 每帧抛
          ReferenceError: lean is not defined —— 画布上的扫描框从此一动不动,
          而且报错全在 rAF 里,控制台不一定会显眼地提示(这个坑踩过一次)。 */
    var lean = 0;
    var spinScale = (typeof window.__mcSpinScale === "number" && isFinite(window.__mcSpinScale))
      ? window.__mcSpinScale : 1;
    /* ★ 剧本模式下"锁定"由剧本说了算(它可能瞄的是一个没有 DOM 的区域):
       这时不来自转、也不吃速度倾斜,框转正停稳 —— 就是"磁吸住了"的样子。 */
    var lockedNow = !!sb || !!target;
    if (!lockedNow && ROT_MAX > 0 && !reduced) {
      var vx = (fx - px) / dt;
      lean = Math.max(-ROT_MAX, Math.min(ROT_MAX, -vx / VEL_DIV));
    }
    if (!reduced) spinAngle += SPIN * dt * spinScale * (lockedNow ? SPIN_SLOW : 1);
    var targetRot = lockedNow ? 0 : spinAngle + lean;
    rot += angleDelta(targetRot, rot) * (1 - Math.pow(1 - ROT_EASE, dt * 60));

    /* ---- ③ 微抖动:两个不同频率的正弦叠加(平滑慢漂,不是每帧乱跳)----
       ★★★ 另一个真 bug:抖动是【无条件】加在画框位置上的(bx = fx + jx)。
         没锁定时它让框显得"活着",但锁定之后它仍然把框推着漂几个像素 ——
         大按钮上看不出来,HUD 里 60px 的导航项上就是【恒定的偏移】。
         ⇒ 锁定(有 target)时不再抖动,框严格压在目标上。 */
    if (!reduced && !lockedNow) {
      var tt = now / 1000;
      jx = JITTER * 0.5 * (Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0]) + 0.6 * Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1]));
      jy = JITTER * 0.5 * (Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1] + 1.7) + 0.6 * Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0] + 0.9));
      pulse += dt * Math.PI * 2 * PULSE_HZ;
    } else {
      jx = jy = 0;
    }

    /* ---- 显隐 ---- */
    fade += (fadeTo - fade) * Math.min(1, dt * 8);
    cv.style.opacity = fade.toFixed(3);
    if (fade < 0.02) return;

    /* ---- ★ 笔的两种形态(记号笔 = ×,荧光笔/橡皮 = 圆框)----
       放在这里是为了吃到上面刚算好的 rot:锁定框会转,这两个形态也要跟着转
       (用户:"×和圆框也是要旋转的")。位置用鼠标真实坐标,不做缓动、不加抖动。

       ★★ 排障出口必须在 return 之前写好:上一版 window.__mc 在函数最末尾赋值,
          笔形态这里一 return,外面就读不到 rot / 形态 —— 线上"× 到底转没转"
          根本没法自查(只能靠这里的录制器才看出来它一直恒为 0)。 */
    var penCfg = window.__mcPenCfg;
    if (penCfg && penCfg.shape) {
      if (penShape !== penCfg.shape) { penShape = penCfg.shape; penT = 0; }
      penT += (1 - penT) * Math.min(1, dt * 9);
      window.__mc = {
        x: Math.round(fx), y: Math.round(fy), w: Math.round(fw), h: Math.round(fh),
        draw: [+(mx).toFixed(3), +(my).toFixed(3)], mouse: [Math.round(mx), Math.round(my)],
        locked: false, pen: penCfg.shape, rot: +rot.toFixed(2),
        jitter: [0, 0], dot: +(DOT / 2).toFixed(2), fade: +fade.toFixed(2), reduced: reduced
      };
      drawPenCursor(ctx, mx, my, penCfg, penT, rot, fade);
      return;
    }
    penShape = null; penT = 0;

    /* ---- 画框 ---- */
    var bx = fx + jx, by = fy + jy;
    var arm = Math.min(ARM_MAX, Math.max(8, Math.min(fw, fh) * ARM));
    /* ★ 剧本模式也算"锁定":亮度满格、中心点让位给框体(和磁吸到元素上一致) */
    var locked = !!sb || !!target;
    var alpha = (locked ? 1 : 0.82) * fade;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((rot * Math.PI) / 180);
    var hw = fw / 2, hh = fh / 2;
    /* 四个角:每个角两条边(从角点往里画,内亮外淡)*/
    var corners = [
      [-hw, -hh, 1, 1], [hw, -hh, -1, 1], [-hw, hh, 1, -1], [hw, hh, -1, -1]
    ];
    /* ★ 用显式下标循环(原来 forEach 的回调会把 index 顶到第 2 个参数上,
       以后想往 gradLine 传 coreT 会踩坑)*/
    for (var ci = 0; ci < corners.length; ci++) {
      var c = corners[ci];
      var x = c[0], y = c[1], sx = c[2], sy = c[3];
      gradLine(x, y, x + sx * arm, y, alpha, true);          /* 横边 */
      gradLine(x, y, x, y + sy * arm, alpha, true);          /* 竖边 */
      /* ④ 辅助刻度:两条边旁边各几根细小垂直线 */
      for (var ti = 0; ti < TICKS.length; ti++) {
        var t = TICKS[ti];
        var ta = alpha * (0.55 - ti * 0.18);
        ctx.save();
        ctx.shadowColor = hexA(COLOR, 0.5);
        ctx.shadowBlur = 3;
        ctx.strokeStyle = hexA(COLOR, ta);
        ctx.lineWidth = Math.max(0.6, THICK * 0.7);
        ctx.beginPath();
        /* 横边上的刻度(往框外挑)*/
        ctx.moveTo(x + sx * arm * t, y);
        ctx.lineTo(x + sx * arm * t, y - sy * TICK_LEN);
        /* 竖边上的刻度(往框外挑)*/
        ctx.moveTo(x, y + sy * arm * t);
        ctx.lineTo(x - sx * TICK_LEN, y + sy * arm * t);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    /* ---- ② 中心点:呼吸缩放 + 柔光(锁定时让位给框体)----
       ★ 和笔形态共用 drawCenterDot —— 之前这里是手写的第二份实现,
         两份长得不一样,切到笔的时候中心点看着就"不见了"。 */
    if (!locked) {
      /* 点也跟着抖一点点(幅度减半)*/
      drawCenterDot(mx + jx * 0.5, my + jy * 0.5, fade,
        reduced ? 1 : 1 + Math.sin(pulse) * PULSE);
    }

    window.__mc = {
      x: Math.round(fx), y: Math.round(fy), w: Math.round(fw), h: Math.round(fh),
      /* 实际画出来的位置 = 平滑位置 + 微抖动(排障/验收看这个)*/
      draw: [+(bx).toFixed(3), +(by).toFixed(3)],
      mouse: [Math.round(mx), Math.round(my)],
      locked: locked, rot: +rot.toFixed(2), jitter: [+jx.toFixed(3), +jy.toFixed(3)],
      dot: locked ? null : +(DOT / 2 * (1 + Math.sin(pulse) * PULSE)).toFixed(2),
      fade: +fade.toFixed(2), reduced: reduced
    };
  }

  /* ---------- 事件 ---------- */
  /* ★★★ 跟手这件事必须挂在 pointermove 上(第七轮用户反馈:
     "这个笔在按下的时候这个磁吸光标不会跟着移动啊……不能跟随问题有点大")。
     根因在规范里:落笔那层 canvas 在 pointerdown 上 preventDefault(不这么做就会开始
     选字/拖图),而 Pointer Events 规定 —— pointerdown 的默认行为一旦被取消,
     浏览器就【不再派发兼容的 mousemove/mousedown/mouseup】。
     所以整段按住的拖动里,mousemove 一次都不来 ⇒ 光标冻在按下那一刻。
     pointermove 不受这条影响,永远会来;mousemove 留着当兜底。 */
  var follow = function (e) {
    mx = e.clientX; my = e.clientY;
    if (fx < -900) { fx = mx; fy = my; }
    fadeTo = 1;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener("pointermove", follow, { passive: true });
  window.addEventListener("mousemove", follow, { passive: true });

  document.addEventListener("mouseover", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!t || t === target) return;
    target = t;
    document.documentElement.classList.add("magnetic-locked");
  }, true);

  document.addEventListener("mouseout", function (e) {
    if (!target) return;
    var to = e.relatedTarget;
    if (to && target.contains(to)) return;
    target = null;
    document.documentElement.classList.remove("magnetic-locked");
  }, true);

  window.addEventListener("mouseleave", function () { fadeTo = 0; });
  window.addEventListener("resize", resize);

  document.documentElement.classList.add("magnetic-on");
  if (reduced) document.documentElement.classList.add("magnetic-reduced");
  raf = requestAnimationFrame(tick);
})();
