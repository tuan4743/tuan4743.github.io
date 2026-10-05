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
  var tmp2 = null, t2ctx = null, tmp3 = null, t3ctx = null;

  function ensureTmp(W, H) {
    if (!tmp) { tmp = document.createElement("canvas"); tctx = tmp.getContext("2d"); }
    if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  }
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
    ctx.drawImage(tmp, -amount, 0);
    ctx.drawImage(tmp, amount, 0);
    ctx.restore();
  }

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

  var HEX_T = {
    form: 450,
    draw: 420,
    hold: 120,
    spread: 900,
    out: 1000,
    outAt: 990,
    total: 2890
  };
  var HEX_S = {
    sizeFrac: 0.087,
    overlap: 1.012,
    tile: "#171717",
    line: "#7ff0ff",
    lineFrac: 0.0011
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
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.restore();
    if (el > HEX_T.total + 40) return;

    var R = (W * HEX_S.sizeFrac) / 1.732;
    var RP = R * HEX_S.overlap;
    var hx = R * 1.732, hy = R * 1.5;
    var cols = Math.ceil(W / hx) + 2, rows = Math.ceil(H / hy) + 2;
    var cx0 = W * 0.5, cy0 = H * 0.5, maxD = Math.hypot(cx0, cy0);
    var per = 6;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, W * HEX_S.lineFrac);
    for (var c = -1; c <= cols; c++) {
      for (var r = -1; r <= rows; r++) {
        var ox = (c + 0.5) * hx + ((r & 1) ? hx * 0.5 : 0);
        var oy = (r + 0.5) * hy;
        var idx = (c + 1) * (rows + 3) + (r + 1);
        var rr = mulberry32(idx * 7919 + 13)();
        var tIn = (el - rr * HEX_T.form) / HEX_T.draw;
        var inK = tIn <= 0 ? 0 : easeOutPower4(Math.min(1, tIn));
        var dist = Math.hypot(ox - cx0, oy - cy0) / maxD;
        var tOut = (el - HEX_T.outAt - dist * HEX_T.spread) / HEX_T.out;
        var outK = tOut <= 0 ? 0 : easeOutQuad(Math.min(1, tOut));
        if (outK >= 1) continue;
        if (inK <= 0 && outK <= 0) continue;

        var fade = 1 - outK;
        var fillK = Math.min(1, inK * 3);
        var alpha = fade * fillK;
        if (fade <= 0.02 || alpha <= 0.01) continue;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(fade, fade);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = HEX_S.tile;
        ctx.beginPath();
        hexPath(ctx, RP);
        ctx.fill();
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
          if (frac > 0.01 && seg < per) {
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

  function fxGlitch(ctx, W, H, el) {
    if (!tmp2) { tmp2 = document.createElement("canvas"); t2ctx = tmp2.getContext("2d"); }
    if (!tmp3) { tmp3 = document.createElement("canvas"); t3ctx = tmp3.getContext("2d"); }
    if (tmp2.width !== W || tmp2.height !== H) { tmp2.width = W; tmp2.height = H; }
    if (tmp3.width !== W || tmp3.height !== H) { tmp3.width = W; tmp3.height = H; }

    var tick = Math.floor(el / 35);
    var rnd = mulberry32(tick * 2654435761);

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

  var MAP = { emoji: fxEmoji, hex: fxHex, glitch: fxGlitch };

  window.CDBootFx = {
    hexTiming: HEX_T,
    hexStyle: HEX_S,
    apply: function (name, ctx, W, H, el, info) {
      var fn = MAP[String(name || "").toLowerCase()];
      if (!fn) return;
      try { fn(ctx, W, H, el, info || {}); }
      catch (e) {
        if (!window.__fxFailed) {
          window.__fxFailed = true;
          window.__fxErrMsg = name + ": " + (e && e.stack ? e.stack : e);
          try { console.error("[CDBootFx]", name, e); } catch (e2) {}
        }
      }
    }
  };
})();
