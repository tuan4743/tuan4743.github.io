/* ============================================================
   每张盘的"标志性动作" —— 场景特效层(独立文件)
   ─────────────────────────────────────────────────────────────
   接入点:intro.js 在 scene.draw() 之后调用 CDBootFx.apply(名称, ctx, W, H, el)
   五张盘各有一套,全部在画布上完成,不用 CSS filter:
     emoji(自我)  铺满那一刻整屏全息闪光 + 轻微 RGB 抖动
     hex(成长)    六边形网格逐格点亮(扫掠)+ 沿格边走线的电路光点
     water(迷茫)  水平切片折射波纹(把画面按行错位)+ 水面光斑
     glitch(技术) RGB 三通道分离 + 条带位移 + 随机块跳变
     fractal(未来) 低分辨率渲染 Julia 集再放大(真分形,不是画出来的圆圈)
   ============================================================ */
(function () {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function easeOutPower4(t) { var u = 1 - t; return 1 - u * u * u * u; }

  var tmp = null, tctx = null;
  var tmp2 = null, t2ctx = null, tmp3 = null, t3ctx = null;          /* 临时画布:切片类效果需要先拷一份 */

  function ensureTmp(W, H) {
    if (!tmp) { tmp = document.createElement("canvas"); tctx = tmp.getContext("2d"); }
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  }
  /* ---------- 通用:RGB 分离(把画面按红/青两通道错开叠加)---------- */
  function rgbSplit(ctx, W, H, amount, alpha) {
    ensureTmp(W, H);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = "source-over";
    tctx.globalAlpha = 1;
    tctx.clearRect(0, 0, W, H);
    tctx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha == null ? 0.5 : alpha;
    /* 只取红色通道:整幅画一层红,再用 multiply 抠出红分量 —— 这里用更省的做法:
       把整幅画以极低透明度偏移重画两次,视觉上等效于轻微色散 */
    ctx.drawImage(tmp, -amount, 0);
    ctx.drawImage(tmp, amount, 0);
    ctx.restore();
  }

  /* ---------- 通用:水平切片错位(水的折射 / 故障的条带)---------- */
  function sliceShift(ctx, W, H, fn, sliceH) {
    ensureTmp(W, H);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = "source-over";
    tctx.globalAlpha = 1;
    tctx.clearRect(0, 0, W, H);
    tctx.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "copy";
    ctx.clearRect(0, 0, W, H);
    var sh = sliceH || 6;
    for (var y = 0; y < H; y += sh) {
      var dx = fn(y);
      ctx.drawImage(tmp, 0, y, W, Math.min(sh, H - y), dx, y, W, Math.min(sh, H - y));
    }
    ctx.restore();
  }

  /* ---------- emoji:铺满那一刻的整屏全息闪光 ---------- */
  function fxEmoji(ctx, W, H, el, info) {
    var t = info && info.fillDone ? info.fillDone : -1;
    if (t < 0) return;
    var d = el - t;
    if (d < 0 || d > 420) return;
    var k = 1 - d / 420;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.16 * k * k;
    ctx.fillStyle = "#d8f6ff";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.34 * k;
    ctx.strokeStyle = "#bfe9ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- hex:六边形矩阵"自己画出来" → 从中心塌缩,把底下露出来 ----------
     规格照用户给的范例 static/temp/hexagons matrix.html 逐项对齐:
       viewBox 1000 宽 · 六边形宽 86.6(= √3R,R=50) · 列距 86.5 · 行距 74.5(= 1.5R)
       → 相邻格子【边贴边】,整屏铺成一块蜂巢,不是一张蛛网
     时间轴(总长 2.89s):
       0.00 ~ 0.99s  形成:每格随机顺序、0.5s 内自己画一圈;这段时间底下一律【黑屏】
       0.99s 起       消失:从屏幕中心向外逐格 scale→0 + 淡出,把底下的页面露出来
     ★ 作画半径比格距大 1.2%:相邻格子边缘重合,消掉抗锯齿留下的缝(1px 的缝也会透出网页)*/
  var HEX_T = {
    form: 450,      /* 每格起始时刻的随机散布(范例 stagger each 0.002 × 225 ≈ 0.45s)*/
    draw: 420,      /* 单格把自己画一圈的用时(范例 duration 0.5s)*/
    hold: 120,      /* 画完停一下,保证撤黑屏时没有格子还在画 */
    spread: 900,    /* 从中心向外逐格开始的散布(范例 stagger each 0.004 × 225 ≈ 0.9s)*/
    out: 1000,      /* 单格塌缩用时(范例 duration 1s)*/
    outAt: 990,     /* = form + draw + hold → 塌缩开始 = 黑屏撤掉的时刻 */
    total: 2890     /* = outAt + spread + out */
  };
  var HEX_S = {
    sizeFrac: 0.087,  /* 六边形宽 ÷ 屏宽 —— 范例 86.6 / 1000,约 11.5 列 */
    overlap: 1.012,   /* 作画半径放大系数(消缝)*/
    tile: "#171717",  /* 瓷砖本体 —— 范例里的 fill */
    line: "#7ff0ff",  /* 描边:冰蓝(范例是绿 #17f700,按你的黑白/冰蓝配色换掉了)*/
    lineFrac: 0.0011  /* 线宽 ÷ 屏宽 —— 范例 stroke-width 0.8 / 1000 */
  };
  function easeOutQuad(t) { var u = 1 - t; return 1 - u * u; }
  function hexPt(i, R) {
    var a = Math.PI / 180 * (60 * i - 90);
    return [Math.cos(a) * R, Math.sin(a) * R];
  }
  function hexPath(ctx, R) {
    for (var i = 0; i < 6; i++) {
      var p = hexPt(i, R);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();
  }
  function fxHex(ctx, W, H, el) {
    /* 只由本特效作画:先清屏 —— 否则会和场景自带的六边形动画叠成"两个矩阵" */
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.restore();
    if (el > HEX_T.total + 40) return;

    var R = (W * HEX_S.sizeFrac) / 1.732;        /* 外接圆半径:范例 viewBox 1000、格宽 86.6 */
    var RP = R * HEX_S.overlap;                  /* 作画半径(略大一点点,严丝合缝)*/
    var hx = R * 1.732, hy = R * 1.5;            /* 列距 √3R · 行距 1.5R:六边形密铺的唯一步长 */
    var cols = Math.ceil(W / hx) + 2, rows = Math.ceil(H / hy) + 2;
    var cx0 = W * 0.5, cy0 = H * 0.5, maxD = Math.hypot(cx0, cy0);
    var per = 6;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, W * HEX_S.lineFrac);
    /* 从 -1 铺到 cols/rows:四边都越出屏幕,蜂巢盖满整屏(不留边框缝)*/
    for (var c = -1; c <= cols; c++) {
      for (var r = -1; r <= rows; r++) {
        var ox = (c + 0.5) * hx + ((r & 1) ? hx * 0.5 : 0);
        var oy = (r + 0.5) * hy;
        var idx = (c + 1) * (rows + 3) + (r + 1);
        var rr = mulberry32(idx * 7919 + 13)();          /* 每格固定的"随机顺序"值 */
        /* ① 形成:自己画一圈 */
        var tIn = (el - rr * HEX_T.form) / HEX_T.draw;
        var inK = tIn <= 0 ? 0 : easeOutPower4(Math.min(1, tIn));
        /* ② 消失:从中心向外,逐格缩小 + 淡出 */
        var dist = Math.hypot(ox - cx0, oy - cy0) / maxD;
        var tOut = (el - HEX_T.outAt - dist * HEX_T.spread) / HEX_T.out;
        var outK = tOut <= 0 ? 0 : easeOutQuad(Math.min(1, tOut));
        if (outK >= 1) continue;
        if (inK <= 0 && outK <= 0) continue;             /* 还没轮到它 → 底下一片黑 */

        var fade = 1 - outK;                             /* 塌缩进度:同时缩 + 淡 */
        var fillK = Math.min(1, inK * 3);                /* 瓷砖本体"凝"得比描边快 */
        var alpha = fade * fillK;
        if (fade <= 0.02 || alpha <= 0.01) continue;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(fade, fade);
        /* 瓷砖本体:范例的 fill #171717 —— 铺满后整屏就是这块暗色蜂巢 */
        ctx.globalAlpha = alpha;
        ctx.fillStyle = HEX_S.tile;
        ctx.beginPath();
        hexPath(ctx, RP);
        ctx.fill();
        /* 描边"自己画一圈":只画前 inK 比例的那一段(范例是滑动 dash,这里用画线,更像"长出来")*/
        var seg = Math.max(0, Math.min(per, inK * per));
        if (seg > 0.02) {
          ctx.globalAlpha = 0.95 * fade * Math.min(1, inK * 1.5);
          ctx.strokeStyle = HEX_S.line;
          ctx.beginPath();
          var k, p;
          for (k = 0; k <= per; k++) {
            if (k > seg) break;
            p = hexPt(k, RP);
            if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
          }
          var frac = seg - Math.floor(seg);
          if (frac > 0.01 && seg < per) {                /* 收尾那一小段按比例画 */
            var p1 = hexPt(Math.floor(seg), RP);
            var p2 = hexPt(Math.min(per, Math.floor(seg) + 1), RP);
            ctx.lineTo(p1[0] + (p2[0] - p1[0]) * frac, p1[1] + (p2[1] - p1[1]) * frac);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /* ---------- water:水平切片折射 + 水面光斑 ---------- */
  function fxWater(ctx, W, H, el) {
    var amp = Math.min(26, W * 0.014);
    sliceShift(ctx, W, H, function (y) {
      return Math.sin(y * 0.045 + el / 420) * amp * (0.5 + 0.5 * Math.sin(y * 0.011 - el / 900));
    }, 5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 7; i++) {
      var t = (el / 3000 + i * 0.37) % 1;
      var x = (i * 0.19 + 0.08) * W + Math.sin(el / 700 + i) * 26;
      var y = t * H;
      var rr = (28 + (i % 3) * 16) * (0.6 + 0.4 * Math.sin(el / 300 + i));
      var g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, "rgba(190, 240, 255, 0.22)");
      g.addColorStop(1, "rgba(190, 240, 255, 0)");
      ctx.globalAlpha = 0.7 * Math.sin(Math.PI * t);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- glitch:RGB 分离 + 条带位移 + 随机块跳变 ---------- */
  function fxGlitch(ctx, W, H, el) {
    /* 照着 faulttext.html 的手感:
       · 每 35ms 换一批(范例是 30ms)—— 换得越快越像"信号在崩"
       · 每批随机挑 4 块矩形切片整体位移(clip-path 的等价做法)
       · 红/蓝两份错开叠加(screen 混合),幅度随正弦呼吸 */
    if (!tmp2) { tmp2 = document.createElement("canvas"); t2ctx = tmp2.getContext("2d"); }
    if (!tmp3) { tmp3 = document.createElement("canvas"); t3ctx = tmp3.getContext("2d"); }
    if (tmp2.width !== W || tmp2.height !== H) { tmp2.width = W; tmp2.height = H; }
    if (tmp3.width !== W || tmp3.height !== H) { tmp3.width = W; tmp3.height = H; }

    var tick = Math.floor(el / 35);
    var rnd = mulberry32(tick * 2654435761);

    /* ① 快照一帧,然后在快照上做随机切片位移 */
    t2ctx.setTransform(1, 0, 0, 1, 0, 0);
    t2ctx.globalCompositeOperation = "source-over";
    t2ctx.globalAlpha = 1;
    t2ctx.clearRect(0, 0, W, H);
    t2ctx.drawImage(ctx.canvas, 0, 0);

    for (var i = 0; i < 4; i++) {
      var bx = rnd() * W * 0.82;
      var by = rnd() * H * 0.86;
      var bw = W * (0.06 + rnd() * 0.34);
      var bh = H * (0.015 + rnd() * 0.07);
      var dx = (rnd() - 0.5) * W * 0.09;
      ctx.drawImage(tmp2, bx, by, bw, bh, bx + dx, by, bw, bh);
    }

    /* ② 红 / 蓝两份,错开后用 screen 叠回 —— 对应范例的 ::before/::after */
    var off = 1.2 + 2.4 * Math.abs(Math.sin(el / 210));
    t3ctx.setTransform(1, 0, 0, 1, 0, 0);
    t3ctx.globalCompositeOperation = "source-over";
    t3ctx.globalAlpha = 1;
    t3ctx.clearRect(0, 0, W, H);
    t3ctx.drawImage(tmp2, 0, 0);
    t3ctx.globalCompositeOperation = "multiply";
    t3ctx.fillStyle = "#ff2b2b";
    t3ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.55;
    ctx.drawImage(tmp3, -off, 0);
    t3ctx.globalCompositeOperation = "source-over";
    t3ctx.clearRect(0, 0, W, H);
    t3ctx.drawImage(tmp2, 0, 0);
    t3ctx.globalCompositeOperation = "multiply";
    t3ctx.fillStyle = "#2b6bff";
    t3ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp3, off, 0);
    ctx.restore();
  }

  /* water 已换成"像素火车驶过云海"场景,自带雨与圆形清除,这里不再叠加水波 */
  /* ★ fractal(未来)这一张改成 snow.glsl 场景,自带整屏作画 ——
     如果再叠一层特效会把它盖住(之前那层 Julia 就是这么把暴风雪盖掉的)*/
  var MAP = { emoji: fxEmoji, hex: fxHex, glitch: fxGlitch };

  window.CDBootFx = {
    hexTiming: HEX_T,          /* 调试:直接改 HEX_T.outAt / .total 就能调黑屏与总时长 */
    hexStyle: HEX_S,           /* 调试:瓷砖色 / 描边色 / 格子大小 */
    apply: function (name, ctx, W, H, el, info) {
      var fn = MAP[String(name || "").toLowerCase()];
      if (!fn) return;
      try { fn(ctx, W, H, el, info || {}); }
      catch (e) {
        /* 特效失败不能影响动画 —— 但也不能一声不吭(否则画面会莫名其妙空掉):
           第一次出错时报到控制台,并把错误挂到 window 上便于排查 */
        if (!window.__fxFailed) {
          window.__fxFailed = true;
          window.__fxErrMsg = name + ": " + (e && e.stack ? e.stack : e);
          try { console.error("[CDBootFx]", name, e); } catch (e2) {}
        }
      }
    }
  };
})();
