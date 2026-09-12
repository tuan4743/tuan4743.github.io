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
  var julia = null, jctx = null;        /* 低分辨率缓冲:分形用 */

  function ensureTmp(W, H) {
    if (!tmp) { tmp = document.createElement("canvas"); tctx = tmp.getContext("2d"); }
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  }
  function ensureJulia(W, H) {
    if (!julia) { julia = document.createElement("canvas"); jctx = julia.getContext("2d", { willReadFrequently: true }); }
    if (julia.width !== W || julia.height !== H) { julia.width = W; julia.height = H; }
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

  /* ---------- hex:六边形网格扫掠点亮 + 电路光点沿边走 ---------- */
  function fxHex(ctx, W, H, el) {
    /* 只由本特效作画:先清屏 —— 否则会和场景自带的六边形动画叠成'两个矩阵' */
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.restore();
    /* ---- 时间轴(照着范例的手感重排)----
       0.00 ~ 0.75s  逐格"自己画一圈" + 淡入   (随机顺序,每格 2ms stagger)
       0.55 ~ 1.55s  从中心向外塌缩 scale→0    (每格 4ms stagger,与上一段重叠)
       总长 1.7s,之后交给场景自己 */
    var T_IN = 750, T_OUT = 1000, T_OVERLAP = 200;
    var totalIn = T_IN + 225 * 2;          /* 加上 stagger 尾巴 */
    var totalOut = T_OUT + 225 * 4;
    if (el > totalIn + totalOut + 200) return;

    /* ★ 完全按范例的规格:
       范例 viewBox 1000 宽、六边形宽 86.6 → 占屏宽 8.7%;
       列距 86.5(1.732R)、行距 74.5(1.5R)。
       之前用 min(W,H)*5.2% 导致格子又小又细,像蛛网。 */
    var R = (W * 0.087) / 1.732;
    var hx = R * 1.732, hy = R * 1.5;
    var cols = Math.ceil(W / hx) + 2, rows = Math.ceil(H / hy) + 2;
    var cx0 = W / 2, cy0 = H / 2;

    ctx.save();
    ctx.lineJoin = "round";
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var ox = c * hx + (r % 2 ? hx / 2 : 0);
        var oy = r * hy;
        var idx = c * rows + r;
        /* 每格自己的随机顺序值(固定,不随帧变)*/
        var rr = mulberry32(idx * 7919 + 13)();
        /* 第一阶段:进场 */
        var tIn = (el - rr * T_IN - idx * 2) / 420;
        var inK = tIn <= 0 ? 0 : easeOutPower4(Math.min(1, tIn));
        /* 第二阶段:从中心向外塌缩 */
        var dist = Math.hypot(ox - cx0, oy - cy0) / Math.hypot(cx0, cy0);
        var tOut = (el - (T_IN + T_OVERLAP) - dist * 600 - idx * 4) / T_OUT;
        var outK = tOut <= 0 ? 0 : Math.min(1, tOut);
        if (inK <= 0 && outK <= 0) continue;

        var scale = 1 - outK;
        /* 瓷砖本体:只要还在场上就画(与描边进度无关)*/
        var tileA = 1 - outK;
        /* 描边与亮点:跟着进场进度 */
        var alpha = inK * (1 - outK);
        if (scale <= 0.01 || tileA <= 0.01) continue;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);
        ctx.globalAlpha = tileA;
        /* 实心暗色蜂巢底 —— 范例里 fill="#171717",这是"结构感"的来源 */
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var a = Math.PI / 180 * (60 * i - 90);
          var px = Math.cos(a) * R * 0.86, py = Math.sin(a) * R * 0.86;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        /* ★ 精髓:每格是"实心暗色瓷砖",一开始就整片存在(范例的 fill #171717),
           只有描边在画 —— 之前让它随 alpha 渐入,就又变成了飘着的空线框 */
        ctx.fillStyle = "#171717";
        ctx.fill();
        ctx.globalAlpha = 1;
        /* 描边"自己画一圈":只画前 inK 比例的那一段 */
        var per = 6;
        var seg = Math.max(0, Math.min(per, inK * per));
        if (seg > 0.02) {
          ctx.strokeStyle = "rgba(127, 240, 255, " + (0.95 * alpha).toFixed(3) + ")";
          ctx.lineWidth = Math.max(1, W * 0.0011);
          ctx.beginPath();
          var started = false;
          for (var k = 0; k <= per; k++) {
            if (k > seg) break;
            var ang = Math.PI / 180 * (60 * k - 90);
            var qx = Math.cos(ang) * R * 0.86, qy = Math.sin(ang) * R * 0.86;
            if (!started) { ctx.moveTo(qx, qy); started = true; } else ctx.lineTo(qx, qy);
          }
          var frac = seg - Math.floor(seg);
          if (frac > 0.01 && seg < per) {          /* 收尾那一小段按比例画 */
            var a1 = Math.PI / 180 * (60 * Math.floor(seg) - 90);
            var a2 = Math.PI / 180 * (60 * Math.min(per, Math.floor(seg) + 1) - 90);
            var x1 = Math.cos(a1) * R * 0.86, y1 = Math.sin(a1) * R * 0.86;
            var x2 = Math.cos(a2) * R * 0.86, y2 = Math.sin(a2) * R * 0.86;
            ctx.lineTo(x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac);
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

  /* ---------- fractal:低分辨率 Julia 集,再放大 ---------- */
  function fxFractal(ctx, W, H, el) {
    var sw = Math.max(120, Math.round(W / 4)), sh = Math.max(80, Math.round(H / 4));
    ensureJulia(sw, sh);
    var t = el / 6000;
    var cr = -0.72 + Math.cos(t * 1.7) * 0.12;
    var ci = 0.27 + Math.sin(t * 1.3) * 0.11;
    var zoom = 1.15 + 0.35 * Math.sin(t * 0.9);
    var img = jctx.createImageData(sw, sh);
    var d = img.data, i = 0;
    for (var py = 0; py < sh; py++) {
      var y0 = (py / sh - 0.5) * 2.6 / zoom;
      for (var px = 0; px < sw; px++) {
        var x0 = (px / sw - 0.5) * 2.6 / zoom;
        var x = x0, y = y0, k = 0;
        while (x * x + y * y < 4 && k < 42) {
          var xt = x * x - y * y + cr;
          y = 2 * x * y + ci;
          x = xt;
          k++;
        }
        var v = k / 42;
        var glow = k >= 42 ? 0 : Math.pow(v, 0.55);
        d[i++] = Math.round(30 + 120 * glow);
        d[i++] = Math.round(60 + 180 * glow);
        d[i++] = Math.round(90 + 165 * glow);
        d[i++] = Math.round(255 * Math.min(1, glow * 1.25));
      }
    }
    jctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(julia, 0, 0, sw, sh, 0, 0, W, H);
    ctx.restore();
    /* 外面再套一层轻微 RGB 分离,和整体画风一致 */
    rgbSplit(ctx, W, H, 1.2, 0.18);
  }

  /* water 已换成"像素火车驶过云海"场景,自带雨与圆形清除,这里不再叠加水波 */
  var MAP = { emoji: fxEmoji, hex: fxHex, glitch: fxGlitch, fractal: fxFractal };

  window.CDBootFx = {
    apply: function (name, ctx, W, H, el, info) {
      var fn = MAP[String(name || "").toLowerCase()];
      if (!fn) return;
      try { fn(ctx, W, H, el, info || {}); } catch (e) { /* 特效失败不能影响动画 */ }
    }
  };
})();
