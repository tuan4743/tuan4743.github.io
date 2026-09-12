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

  var tmp = null, tctx = null;          /* 临时画布:切片类效果需要先拷一份 */
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
    var R = Math.min(W, H) * 0.085;
    var hx = R * 1.5, hy = R * Math.sqrt(3);
    var cols = Math.ceil(W / hx) + 2, rows = Math.ceil(H / hy) + 2;
    var sweep = (el / 2400) % 1.6 - 0.3;                 /* 从左到右扫过 */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var cx = c * hx;
        var cy = r * hy + (c % 2 ? hy / 2 : 0);
        var u = cx / W;                                   /* 0~1 的横向位置 */
        var d = Math.abs(u - sweep);
        if (d > 0.16) continue;
        var a = (1 - d / 0.16) * 0.30;
        ctx.globalAlpha = a;
        ctx.strokeStyle = "#7ff0ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var i = 0; i < 6; i++) {
          var ang = Math.PI / 180 * (60 * i - 90);
          var px = cx + Math.cos(ang) * R * 0.62, py = cy + Math.sin(ang) * R * 0.62;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        /* 电路光点:每个格子里跑一个点,沿某条边来回 */
        var t = (el / 900 + (c * 7 + r * 13) * 0.11) % 1;
        var a1 = Math.PI / 180 * (60 * ((c + r) % 6) - 90);
        var a2 = a1 + Math.PI / 3;
        var sx = cx + Math.cos(a1) * R * 0.62, sy = cy + Math.sin(a1) * R * 0.62;
        var ex = cx + Math.cos(a2) * R * 0.62, ey = cy + Math.sin(a2) * R * 0.62;
        ctx.globalAlpha = a * 1.6;
        ctx.fillStyle = "#e8fbff";
        ctx.beginPath();
        ctx.arc(sx + (ex - sx) * t, sy + (ey - sy) * t, 1.7, 0, Math.PI * 2);
        ctx.fill();
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
    /* 条带位移:每 90ms 换一批随机的行段 */
    var seed = Math.floor(el / 90);
    sliceShift(ctx, W, H, function (y) {
      var s = Math.sin(seed * 12.9898 + Math.floor(y / 24) * 7.13) * 43758.5453;
      var r = s - Math.floor(s);
      return r > 0.86 ? (r - 0.93) * W * 0.16 : 0;
    }, 12);
    /* RGB 分离 */
    var amt = 1.5 + 3 * Math.abs(Math.sin(el / 260));
    rgbSplit(ctx, W, H, amt, 0.35);
    /* 随机块跳变 */
    var s2 = Math.sin(seed * 78.233) * 43758.5453;
    var r2 = s2 - Math.floor(s2);
    if (r2 > 0.55) {
      var bh = 8 + r2 * 26;
      var by = ((seed * 37) % 100) / 100 * H;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(ctx.canvas, 0, by, W, bh, (r2 - 0.5) * W * 0.08, by, W, bh);
      ctx.restore();
    }
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
