(function () {
  "use strict";

  var CELL = 7;
  var WARM_R = 62;          /* "暖"的作用半径(屏幕像素)。
                               ★ 原来 96,用户说"融化的范围还可以再小一点" */
  var MELT_HIT = 0.075;
  var MELT_DWELL = 0.007;
  var DWELL_MS = 250;
  var DWELL_SLOP = 14;
  var TEXT_STRIDE = 2;
  var TICK = 40;
  var SNOW_N = 130;
  var SNOW_SLANT = -0.34;
  var SNOW_SPD_MIN = 1.1;
  var SNOW_SPD_MAX = 2.8;
  var DRIP_MAX = 44;
  var OPEN_AT = 0.42;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function slice(nl) { return Array.prototype.slice.call(nl); }

  function build(root) {
    var cv = q("[data-frost-cv]", root);
    var layer = q("[data-frost-shards]", root);
    var skyCv = q("[data-frost-sky]", root);
    var aurCv = q("[data-frost-aurora]", root);
    var snowCv = q("[data-frost-snow]", root);
    var mapEl = q("[data-frost-map]", root);
    var glintLayer = q("[data-frost-glints]", root);
    var glintEls = [];
    var headEl = q(".frost-head", root);
    var hintEl = q("[data-frost-hint]", root);
    var countEl = q("[data-frost-count]", root);
    var readEl = q("[data-frost-read]", root);
    var readCard = q("[data-frost-readcard]", root);
    var readText = q("[data-frost-readtext]", root);
    var readMark = q(".frost-read__mark", root);
    var doneEl = q("[data-frost-finale]", root);
    var shards = slice(root.querySelectorAll("[data-frost-shard]"));
    if (!cv || !layer || !shards.length) return null;

    var ctx = cv.getContext("2d");
    var W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
    var cov = null;
    var bA = null, bAw = 0, bAh = 0;
    var bB = null, bBw = 0, bBh = 0;
    var bC = null, bCw = 0, bCh = 0;
    var tex = null, texCtx = null;
    var covCv = null, covCtx = null, covImg = null;
    var zone = [];
    var starAt = [];
    var collected = [];
    var themeOf = [];                  /* 碎片 → 主题。★ 主题 → 图案序号由 patternFor 现算,
                                          不再另存一份编号数组:两份编号迟早会对不上。 */
    var openIdx = -1;
    var openMark = -1;
    var dialogT = 0;
    var markFrom = -1;
    var flake = [], drip = [];
    var warm = { on: false, x: 0, y: 0, type: "mouse", ax: -9999, ay: -9999, since: 0 };
    var dirty = false;
    var active = false, raf = 0, timer = 0, kept = 0, pressing = false, captured = false;
    var downX = 0, downY = 0, dragDist = 0;
    var meltCalls = 0, lastMelt = null;
    var reduced = false;
    try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { reduced = false; }
    var diag = [];

    function idx(c, r) { return r * cols + c; }
    function halton(n, b) { var f = 1, r = 0; while (n > 0) { f /= b; r += f * (n % b); n = Math.floor(n / b); } return r; }
    function sizeCanvas(c, wCss, hCss) {
      if (!c) return null;
      c.width = Math.max(1, Math.round(wCss * dpr));
      c.height = Math.max(1, Math.round(hCss * dpr));
      c.style.setProperty("width", Math.round(wCss) + "px");
      c.style.setProperty("height", Math.round(hCss) + "px");
      return c.getContext("2d");
    }

    function softDot(c, x, y, r, a) {
      c.fillStyle = "rgba(226, 238, 255, " + (a * 0.26).toFixed(3) + ")";
      c.fillRect(x - r * 1.8, y - r * 0.40, r * 3.6, Math.max(1, r * 0.80));
      c.fillRect(x - r * 0.40, y - r * 1.8, Math.max(1, r * 0.80), r * 3.6);
      c.fillStyle = "rgba(226, 238, 255, " + (a * 0.58).toFixed(3) + ")";
      c.fillRect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      c.fillStyle = "rgba(248, 252, 255, " + a.toFixed(3) + ")";
      c.fillRect(x - r * 0.34, y - r * 0.34, Math.max(1, r * 0.68), Math.max(1, r * 0.68));
    }

    tex = document.createElement("canvas");
    texCtx = tex.getContext("2d");
    covCv = document.createElement("canvas");
    covCtx = covCv.getContext("2d");

    for (var si = 0; si < shards.length; si++) {
      collected[si] = false;
      themeOf[si] = shards[si].getAttribute("data-theme") || "";
    }
    if (glintLayer) {
      for (var gi = 0; gi < shards.length; gi++) {
        var gEl = document.createElement("i");
        gEl.className = "frost-glint";
        glintLayer.appendChild(gEl);
        glintEls.push(gEl);
      }
    }

    function buildSky() {
      var s = sizeCanvas(skyCv, W, H);
      if (!s) return;
      var DW = W * dpr, DH = H * dpr;
      var HOR = DH * 0.73;
      var BANDS = 150;
      for (var b = 0; b < BANDS; b++) {
        var t = b / (BANDS - 1);
        var lift = (0.12 + 0.88 * t * t) * (0.35 + 0.65 * (t * t * (3 - 2 * t)));
        var r = 4 + 9 * lift, g = 7 + 16 * lift, bl = 16 + 30 * lift;
        s.fillStyle = "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
        s.fillRect(0, Math.floor(b * HOR / BANDS) - 1, DW, Math.ceil(HOR / BANDS) + 2);
      }
      function groundTop(x, back) {
        var t = x / DW;
        var h = Math.sin(t * 3.1 + 0.7 - 1.6) * 0.088
          + Math.sin(t * 7.3 + 2.1 - 1.6) * 0.034
          + Math.sin(t * 1.6 - 1.6) * 0.070;
        if (back) {
          h = h * 0.62 + Math.sin(t * 2.2 + 3.4) * 0.013 - 0.004;
          h *= 0.55 + 0.45 * Math.sin(Math.PI * t);
        }
        return HOR + h * DH;
      }
      var SX = Math.max(2, Math.round(dpr * 2));
      for (var xb = -SX; xb < DW + SX; xb += SX) {
        var gyb = groundTop(xb + SX * 0.5, true);
        s.fillStyle = "rgb(26, 36, 58)";
        s.fillRect(xb, gyb, SX, Math.max(1, DH - gyb));
      }
      for (var x = -SX; x < DW + SX; x += SX) {
        var gy = groundTop(x + SX * 0.5, false);
        var g = s.createLinearGradient(0, gy, 0, DH);
        g.addColorStop(0, "rgb(4, 6, 12)");
        g.addColorStop(0.55, "rgb(3, 5, 10)");
        g.addColorStop(1, "rgb(2, 3, 7)");
        s.fillStyle = g;
        s.fillRect(x, gy, SX, Math.max(1, DH - gy));
      }
    }


    function fr(v) { return v - Math.floor(v); }
    function h12(x, y) {
      var a = fr(x * 0.1031), b = fr(y * 0.1030), c = fr(x * 0.0973);
      var d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
      return fr((fr(a + d) + fr(b + d)) * fr(c + d));
    }
    function vnoise(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      var uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      var a = h12(ix, iy), b = h12(ix + 1, iy), c = h12(ix, iy + 1), e = h12(ix + 1, iy + 1);
      var p = a + (b - a) * ux, q = c + (e - c) * ux;
      return p + (q - p) * uy;
    }
    var FC = Math.cos(0.6435), FS = Math.sin(0.6435);
    function fbm(x, y, o) {
      var v = 0, amp = 0.5;
      for (var i = 0; i < o; i++) {
        v += amp * vnoise(x, y);
        var nx = FC * x - FS * y, ny = FS * x + FC * y;
        x = nx * 2.03 + 19.7; y = ny * 2.03 + 7.3;
        amp *= 0.5;
      }
      return v / (1 - Math.pow(0.5, o));
    }
    function cl01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function sstep(a, b, x) { var u = cl01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
    function mixC(a, b, u) {
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }



    var AUR_URL = (window.__SHADERS && window.__SHADERS.aurora) || "/shaders/aurora.glsl";
    var AUR_SCALE = 0.5;
    var aurT0 = 0;
    var MOTE_MS = 1000;
    var CARD_MS = 1300;
    var KEEP_MS = 1450;
    var aurReady = false, aurFailed = false;
    var aurPreloading = false, aurFrames = 0, aurLastErr = "";
    function preloadAurora() {
      if (aurReady || aurFailed || aurPreloading) return;
      if (!window.CDBootGlsl) {
        if (!aurPreloading) { aurPreloading = true; setTimeout(function () { aurPreloading = false; preloadAurora(); }, 80); }
        return;
      }
      aurPreloading = true;
      window.CDBootGlsl.preload("aurora", AUR_URL).then(function (ok) {
        aurPreloading = false;
        if (ok) aurReady = true; else { aurFailed = true; aurLastErr = "preload 失败(拿不到 " + AUR_URL + ")"; }
      })["catch"](function (e) {
        aurPreloading = false; aurFailed = true; aurLastErr = "preload 抛错: " + e;
      });
    }
    function paintAuroraGlsl(t) {
      if (!aurReady || !window.CDBootGlsl || !aurCv) return false;
      var gw = Math.max(64, Math.round(W * AUR_SCALE));
      var gh = Math.max(40, Math.round(H * AUR_SCALE));
      var gl = null;
      try {
        gl = window.CDBootGlsl.render("aurora", AUR_URL, t, gw, gh);
      } catch (e) {
        aurFailed = true; aurLastErr = "render 抛错: " + e; return false;
      }
      if (!gl) { aurFailed = true; aurLastErr = aurLastErr || "render 返回空(多半是着色器编译失败,看控制台的 [boot-glsl])"; return false; }
      var a = aurCv.getContext("2d");
      if (!a) { aurLastErr = "aurora 画布拿不到 2d 上下文"; return false; }
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.globalCompositeOperation = "source-over";
      a.globalAlpha = 1;
      a.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in a) a.imageSmoothingQuality = "high";
      a.clearRect(0, 0, aurCv.width, aurCv.height);
      a.drawImage(gl, 0, 0, gw, gh, 0, 0, aurCv.width, aurCv.height);
      aurFrames++;
      return true;
    }
    window.__frostAurora = function () {
      var cs = null;
      try { cs = aurCv ? window.getComputedStyle(aurCv) : null; } catch (e) { }
      return {
        host: !!window.CDBootGlsl,
        url: AUR_URL,
        ready: aurReady,
        failed: aurFailed,
        err: aurLastErr || "(无)",
        frames: aurFrames,
        canvas: aurCv ? { w: aurCv.width, h: aurCv.height } : null,
        panel: { W: W, H: H },
        css: cs ? { opacity: cs.opacity, blend: cs.mixBlendMode, zIndex: cs.zIndex, display: cs.display } : "(没有 getComputedStyle)",
        reducedMotion: reduced,
        active: active
      };
    };

    function buildFrost() {
      var TW = Math.max(1, cv.width), TH = Math.max(1, cv.height);
      tex.width = TW; tex.height = TH;
      var t = texCtx;
      if (!t) return;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = "source-over";
      t.globalAlpha = 1;
      t.lineCap = "round";
      t.clearRect(0, 0, TW, TH);

      t.fillStyle = "rgba(206, 226, 246, 0.50)";
      t.fillRect(0, 0, TW, TH);

      var s0 = 0x9e3779b9 | 0;
      function rnd() { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; s0 |= 0; return ((s0 >>> 0) % 1048576) / 1048576; }

      var DW = 11, DH = 8;
      var densA = new Float32Array((DW + 1) * (DH + 1));
      for (var q2 = 0; q2 < densA.length; q2++) densA[q2] = 0.22 + rnd() * 0.78;
      function dens(x, y) {
        var fx = Math.min(DW - 1e-4, Math.max(0, x / TW * DW)), fy = Math.min(DH - 1e-4, Math.max(0, y / TH * DH));
        var x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
        var i0 = y0 * (DW + 1) + x0;
        var a = densA[i0], b = densA[i0 + 1], c = densA[i0 + DW + 1], d = densA[i0 + DW + 2];
        return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
      var thin = Math.min(1, 1400000 / (TW * TH));
      var k = 1 / Math.sqrt(Math.max(0.08, thin));

      var buckets = [[], [], [], [], []];
      var ALPHA = [0.05, 0.09, 0.15, 0.23, 0.34];
      function seg(x1, y1, x2, y2, lvl) { var b = buckets[lvl]; b.push(x1, y1, x2, y2); }

      var S1 = Math.max(3, Math.round(2.1 * dpr * k));
      for (var y = -S1; y < TH + S1; y += S1) {
        for (var x = -S1; x < TW + S1; x += S1) {
          var px = x + rnd() * S1, py = y + rnd() * S1;
          var d0 = dens(px, py);
          if (rnd() > 0.30 + d0 * 0.62) continue;
          var ang = (rnd() * 3 | 0) * (Math.PI / 3) + (rnd() - 0.5) * 0.5;
          var len = dpr * (1.6 + rnd() * 4.0);
          var lv = d0 < 0.35 ? 0 : d0 < 0.55 ? 1 : d0 < 0.78 ? 2 : 3;
          var hx = Math.cos(ang) * len * 0.5, hy = Math.sin(ang) * len * 0.5;
          seg(px - hx, py - hy, px + hx, py + hy, lv);
        }
      }

      var S2 = Math.max(7, Math.round(5.5 * dpr * k));
      for (var gy2 = 0; gy2 < TH + S2; gy2 += S2) {
        for (var gx2 = 0; gx2 < TW + S2; gx2 += S2) {
          var fx2 = gx2 + rnd() * S2, fy2 = gy2 + rnd() * S2;
          var d2 = dens(fx2, fy2);
          if (rnd() > 0.22 + d2 * 0.55) continue;
          var a2 = (rnd() * 3 | 0) * (Math.PI / 3) + (rnd() - 0.5) * 0.35;
          var ux = Math.cos(a2), uy = Math.sin(a2);
          var L2 = dpr * (3.5 + rnd() * 6.0) * (0.7 + d2 * 0.5);
          var lv2 = d2 < 0.45 ? 1 : d2 < 0.78 ? 2 : 3;
          seg(fx2 - ux * L2 * 0.5, fy2 - uy * L2 * 0.5, fx2 + ux * L2 * 0.5, fy2 + uy * L2 * 0.5, lv2);
          for (var sgn = -1; sgn <= 1; sgn += 2) {
            for (var bno = 0; bno < 2; bno++) {
              var at = (0.18 + bno * 0.42) * sgn;
              var bx = fx2 + ux * L2 * at, by = fy2 + uy * L2 * at;
              var bl = L2 * (0.30 - bno * 0.08);
              seg(bx, by, bx + Math.cos(a2 + sgn * 1.05) * bl, by + Math.sin(a2 + sgn * 1.05) * bl, lv2);
            }
          }
        }
      }

      var S3 = Math.max(44, Math.round(42 * dpr * k));
      for (var gy3 = 0; gy3 < TH + S3; gy3 += S3) {
        for (var gx3 = 0; gx3 < TW + S3; gx3 += S3) {
          if (rnd() > 0.42) continue;
          var cx3 = gx3 + rnd() * S3, cy3 = gy3 + rnd() * S3;
          var rot = rnd() * Math.PI, L3 = dpr * (3 + rnd() * 4.5);
          var lv3 = dens(cx3, cy3) < 0.6 ? 2 : 3;
          for (var arm = 0; arm < 3; arm++) {
            var a3 = rot + arm * Math.PI / 3;
            var vx = Math.cos(a3), vy = Math.sin(a3);
            seg(cx3 - vx * L3, cy3 - vy * L3, cx3 + vx * L3, cy3 + vy * L3, lv3);
            for (var sg2 = -1; sg2 <= 1; sg2 += 2) {
              var mx = cx3 + vx * L3 * 0.55 * sg2, my = cy3 + vy * L3 * 0.55 * sg2;
              seg(mx, my, mx + Math.cos(a3 + sg2 * 1.05) * L3 * 0.42, my + Math.sin(a3 + sg2 * 1.05) * L3 * 0.42, lv3);
            }
          }
        }
      }

      t.fillStyle = "rgba(255, 255, 255, 0.34)";
      var nGlint = Math.round(TW * TH / 26000);
      for (var g2 = 0; g2 < nGlint; g2++) {
        var sx2 = rnd() * TW, sy2 = rnd() * TH, rr = dpr * (0.5 + rnd() * 0.9);
        t.fillRect(sx2 - rr, sy2 - rr * 0.20, rr * 2, rr * 0.40);
        t.fillRect(sx2 - rr * 0.20, sy2 - rr, rr * 0.40, rr * 2);
      }

      for (var b2 = 0; b2 < buckets.length; b2++) {
        var arr = buckets[b2];
        if (!arr.length) continue;
        t.beginPath();
        for (var i = 0; i + 3 < arr.length; i += 4) {
          t.moveTo(arr[i], arr[i + 1]);
          t.lineTo(arr[i + 2], arr[i + 3]);
        }
        t.lineWidth = Math.max(0.6, dpr * (b2 >= 4 ? 0.95 : b2 >= 3 ? 0.8 : 0.65));
        t.strokeStyle = "rgba(255, 255, 255, " + ALPHA[b2] + ")";
        t.stroke();
      }
    }

    function blotchAt(arr, aw, c, r, size) {
      var fx = c / size, fy = r / size;
      var c0 = fx | 0, r0 = fy | 0;
      var tx = fx - c0, ty = fy - r0;
      var i0 = r0 * aw + c0;
      var a = arr[i0], b = arr[i0 + 1], d = arr[i0 + aw], e = arr[i0 + aw + 1];
      return (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
    }
    function thickAt(c, r) {
      var t = 0.50 * blotchAt(bA, bAw, c, r, 9)
        + 0.30 * blotchAt(bB, bBw, c, r, 3.4)
        + 0.20 * blotchAt(bC, bCw, c, r, 1.6);
      var v = (t - 0.20) / 0.46;
      return v <= 0 ? 0 : v >= 1 ? 1 : v;
    }

    function polyPoints(seedIdx) {
      var s = (seedIdx * 2654435761) | 0;
      if (!s) s = 12345;
      function r2() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return ((s >>> 0) % 10000) / 10000; }
      var n = 7 + ((r2() * 4) | 0);
      var pts = [];
      var base = 0.80 + r2() * 0.20;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 + (r2() - 0.5) * 0.38;
        var rr = 50 * base * (0.30 + r2() * 0.70);
        pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
      }
      return pts;
    }
    function polyStr(pts) {
      var out = [];
      for (var i = 0; i < pts.length; i++) out.push(pts[i][0].toFixed(1) + "% " + pts[i][1].toFixed(1) + "%");
      return "polygon(" + out.join(",") + ")";
    }

    function layoutShards() {
      if (!W || !H) return;
      var pad = Math.round(W * 0.055);
      var top = Math.min(140, H * 0.24);
      var bottom = H - Math.min(70, H * 0.14);
      var placed = [];
      var blocked = [];
      [[headEl, 16], [hintEl, 14]].forEach(function (pair) {
        var el = pair[0];
        if (!el) return;
        var b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        blocked.push({ x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 });
      });
      function hits(x, y, w, h) {
        for (var i = 0; i < blocked.length; i++) {
          var b = blocked[i];
          if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
        }
        return false;
      }

      var i = 1, guard = 0;
      var tight = (W * H) / Math.max(1, shards.length) < 16000;
      var gapX = tight ? 9 : 16, gapY = tight ? 8 : 14;
      var base = Math.max(24, Math.min(38, W * 0.028));
      var minSide = W < 560 ? 40 : Math.max(18, Math.round(base * 0.62));
      for (var k = 0; k < shards.length; k++) {
        var el = shards[k];
        var ar = [1.0, 0.78, 1.22, 0.9, 1.34, 0.72][k % 6];
        var sc = [1.0, 0.86, 1.14, 0.94][k % 4];
        var bw = Math.max(minSide, Math.round(base * ar * sc));
        var bh = Math.max(minSide, Math.round(base * (1.55 - ar * 0.45) * sc));
        var x = pad, y = top, ok = false;
        while (!ok && guard++ < 14000) {
          x = pad + halton(i, 2) * Math.max(10, W - bw - pad * 2);
          y = top + halton(i, 3) * Math.max(10, bottom - top - bh);
          i++;
          ok = !hits(x, y, bw, bh);
          if (!ok) continue;
          for (var j = 0; j < placed.length; j++) {
            var p = placed[j];
            if (Math.abs(p.y - y) < (p.h + bh) * 0.5 + gapY && Math.abs(p.x - x) < (p.w + bw) * 0.5 + gapX) { ok = false; break; }
          }
        }
        var pts = polyPoints(k);
        var poly = polyStr(pts);
        el.style.setProperty("left", x.toFixed(1) + "px");
        el.style.setProperty("top", y.toFixed(1) + "px");
        el.style.setProperty("width", bw + "px");
        el.style.setProperty("height", bh + "px");
        el.style.setProperty("clip-path", poly);
        el.style.setProperty("-webkit-clip-path", poly);
        el.style.setProperty("--shard-delay", ((k * 0.7) % 6).toFixed(2) + "s");
        var gl = glintEls[k];
        if (gl) {
          var vi = (k * 3 + 2) % pts.length;
          var vx2 = pts[vi][0] / 100, vy2 = pts[vi][1] / 100;
          gl.style.setProperty("left", (x + bw * vx2).toFixed(1) + "px");
          gl.style.setProperty("top", (y + bh * vy2).toFixed(1) + "px");
          gl.style.setProperty("--edge", (Math.atan2(vy2 - 0.5, vx2 - 0.5) * 180 / Math.PI).toFixed(1) + "deg");
          gl.style.setProperty("animation-delay", (-(k * 1.37) % 9).toFixed(2) + "s");
          gl.style.setProperty("animation-duration", (9 + (k % 5) * 3.2).toFixed(2) + "s");
        }
        placed.push({ x: x, y: y, w: bw, h: bh });
      }
    }

    var PATTERNS = [
      {
        name: "北斗",
        pts: [[0.02, 0.50], [0.18, 0.72], [0.40, 0.80], [0.62, 0.78], [0.66, 0.52], [0.90, 0.42], [0.98, 0.14]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
        shard: [0, 3, 5]
      },
      {
        name: "猎户",
        pts: [[0.22, 0.06], [0.78, 0.04], [0.86, 0.40], [0.50, 0.52], [0.14, 0.40], [0.24, 0.94], [0.76, 0.90]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 6], [4, 5]],
        shard: [0, 3, 6]
      },
      {
        name: "仙后",
        pts: [[0.02, 0.60], [0.24, 0.16], [0.46, 0.66], [0.72, 0.06], [0.98, 0.54], [0.62, 0.92], [0.34, 0.90]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5]],
        shard: [0, 2, 4]
      }
    ];
    var ANCHOR = [[0.19, 0.30], [0.52, 0.21], [0.81, 0.29]];
    var SINGLE = [[0.86, 0.30], [0.09, 0.50], [0.74, 0.58], [0.30, 0.62]];

    function starScale() { return Math.max(74, Math.min(178, Math.min(W * 0.185, H * 0.42))); }

    function patternPoints(pi, s) {
      var p = PATTERNS[pi % PATTERNS.length];
      var xs = [], ys = [], i;
      for (i = 0; i < p.pts.length; i++) { xs.push(p.pts[i][0]); ys.push(p.pts[i][1]); }
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var an = ANCHOR[pi % ANCHOR.length];
      var ox = an[0] * W - (minX + maxX) * 0.5 * s, oy = an[1] * H - (minY + maxY) * 0.5 * s;
      var out = [];
      for (i = 0; i < p.pts.length; i++) {
        out.push({ x: ox + p.pts[i][0] * s, y: oy + p.pts[i][1] * s, i: i });
      }
      return out;
    }

    function patternFor(th) {
      var k = 0;
      for (var i = 0; i < shards.length; i++) {
        var t2 = themeOf[i];
        if (!t2) continue;
        if (t2 === th) return k % PATTERNS.length;
        var first = true;
        for (var j = 0; j < i; j++) if (themeOf[j] === t2) { first = false; break; }
        if (first) k++;
      }
      return 0;
    }

    function layoutStars() {
      var s = starScale(), singleK = 0;
      for (var k = 0; k < shards.length; k++) {
        var th = themeOf[k];
        if (!th) {
          var p = SINGLE[singleK % SINGLE.length];
          singleK++;
          starAt[k] = { x: p[0] + (k % 2 ? 0.012 : -0.012), y: p[1] + (k % 3 ? 0.012 : -0.012) };
          continue;
        }
        var pi = patternFor(th);
        var si = 0;
        for (var j = 0; j < k; j++) if (themeOf[j] === th) si++;
        var full = patternPoints(pi, s);
        var slots = PATTERNS[pi].shard;
        var pt = full[slots[si % slots.length]] || full[0];
        starAt[k] = { x: pt.x / W, y: pt.y / H };
      }
    }
    function rebuildMap() {
      if (!mapEl || !W || !H) return;
      while (mapEl.firstChild) mapEl.removeChild(mapEl.firstChild);
      var s = starScale();
      for (var pi = 0; pi < PATTERNS.length; pi++) {
        var th = null;
        for (var k = 0; k < shards.length; k++) {
          var t2 = themeOf[k];
          if (t2 && patternFor(t2) === pi) { th = t2; break; }
        }
        if (!th) continue;
        var total = 0, got = 0;
        for (var j = 0; j < shards.length; j++) {
          if (themeOf[j] !== th) continue;
          total++;
          if (collected[j]) got++;
        }
        if (total < 2 || got < total) continue;
        var full = patternPoints(pi, s);
        var slots2 = PATTERNS[pi].shard;
        for (var c = 0; c < full.length; c++) {
          if (slots2.indexOf(full[c].i) >= 0) continue;
          addDot("frost-companion", full[c].x / W, full[c].y / H, th);
        }
        var eds = PATTERNS[pi].edges;
        for (var e2 = 0; e2 < eds.length; e2++) {
          var pa = full[eds[e2][0]], pb = full[eds[e2][1]];
          if (pa && pb) addStarLine({ x: pa.x / W, y: pa.y / H }, { x: pb.x / W, y: pb.y / H });
        }
      }
      for (var i2 = 0; i2 < shards.length; i2++) {
        if (!collected[i2]) continue;
        var st = starAt[i2] || { x: 0.5, y: 0.3 };
        addDot("frost-star", st.x, st.y, themeOf[i2]);
      }
    }
    function addDot(cls, xr, yr, th) {
      var el = document.createElement("i");
      el.className = cls;
      el.style.setProperty("left", (xr * 100).toFixed(2) + "%");
      el.style.setProperty("top", (yr * 100).toFixed(2) + "%");
      if (th) el.setAttribute("data-theme", th);
      mapEl.appendChild(el);
      return el;
    }
    function addStarLine(p, q) {
      if (!p || !q) return;
      var dx = (q.x - p.x) * W, dy = (q.y - p.y) * H;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (!len) return;
      var el = document.createElement("i");
      el.className = "frost-starline";
      el.style.setProperty("left", (p.x * 100).toFixed(2) + "%");
      el.style.setProperty("top", (p.y * 100).toFixed(2) + "%");
      el.style.setProperty("width", len.toFixed(1) + "px");
      el.style.setProperty("transform", "rotate(" + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + "deg)");
      mapEl.appendChild(el);
    }

    function shardText(i) {
      var t = q(".frost-shard__text", shards[i]);
      return t && t.textContent ? t.textContent : "";
    }
    function warmShard(i) {
      var b = shards[i].getBoundingClientRect(), lr = layer.getBoundingClientRect();
      var cx = b.left - lr.left + b.width * 0.5, cy = b.top - lr.top + b.height * 0.5;
      melt(cx, cy - b.height * 0.18, 0.55);
      melt(cx, cy + b.height * 0.18, 0.55);
      melt(cx, cy, 0.55);
      if (hintEl) hintEl.classList.add("is-used");
      kick();
    }
    function openShard(i) {
      if (openIdx >= 0 || collected[i]) return false;
      openIdx = i;
      shards[i].classList.add("is-open");
      root.classList.add("is-reading");
      if (readText) readText.textContent = shardText(i);
      if (readEl) { readEl.hidden = false; readEl.classList.add("is-on"); }
      var b = shards[i].getBoundingClientRect();
      if (readMark && b.width > 0 && W > 0) {
        setMarkPoly(readMark, shards[i].style.getPropertyValue("clip-path") || "");
        var CARD_W = Math.min(W * 0.62, 620);
        var CARD_H = Math.min(H * 0.38, 320);
        var MARK_SLOT = 96;
        var cardLeft = (W - CARD_W) * 0.5, cardTop = (H - CARD_H) * 0.5;
        var markCX = cardLeft + CARD_W * 0.05 + MARK_SLOT * 0.5;
        var markCY = cardTop + CARD_H * 0.5;
        var shardCX = b.left + b.width * 0.5;
        var shardCY = b.top + b.height * 0.5;
        var sc = Math.max(0.06, Math.min(1.6, b.width / MARK_SLOT));
        readMark.style.setProperty("--mark-x", (shardCX - markCX).toFixed(1) + "px");
        readMark.style.setProperty("--mark-y", (shardCY - markCY).toFixed(1) + "px");
        readMark.style.setProperty("--mark-s", sc.toFixed(3));
        readMark.style.setProperty("--mark-rot", (i % 2 ? 7 : -7) + "deg");
        var markSvg = readMark.querySelector("svg");
        if (markSvg) {
          markSvg.style.setProperty("animation-name", "none");
          markSvg.style.setProperty("animation-play-state", "paused");
        }
        readMark.classList.add("is-flying");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            readMark.classList.remove("is-flying");
            readMark.style.setProperty("--mark-x", "0px");
            readMark.style.setProperty("--mark-y", "0px");
            readMark.style.setProperty("--mark-s", "1");
            readMark.style.setProperty("--mark-rot", "0deg");
            setTimeout(function () {
              if (markSvg) {
                markSvg.style.removeProperty("animation-name");
                markSvg.style.removeProperty("animation-play-state");
              }
            }, 340);
          });
        });
      }
      openMark = i;
      if (readCard && readCard.focus) { try { readCard.focus(); } catch (e) { } }
      return true;
    }
    window.__frostMark = function () {
      if (!readMark) return { ok: false, why: "页面上没有 .frost-read__mark" };
      var r = readMark.getBoundingClientRect();
      var cs = window.getComputedStyle ? window.getComputedStyle(readMark) : null;
      var poly = readMark.querySelector("polygon");
      return {
        slot: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        flying: readMark.classList.contains("is-flying"),
        varX: readMark.style.getPropertyValue("--mark-x"),
        varY: readMark.style.getPropertyValue("--mark-y"),
        varS: readMark.style.getPropertyValue("--mark-s"),
        varRot: readMark.style.getPropertyValue("--mark-rot"),
        transform: cs ? cs.transform : "(没有 getComputedStyle)",
        transition: cs ? cs.transitionDuration : "",
        polyPoints: poly ? String(poly.getAttribute("points")).slice(0, 40) : "(没有 polygon)",
        openIdx: openIdx
      };
    };
    function setMarkPoly(svg, poly) {
      var m = /polygon\(([^)]*)\)/.exec(poly);
      if (!m) return false;
      var polyEl = svg.querySelector("polygon");
      if (!polyEl) return false;
      polyEl.setAttribute("points", m[1].replace(/%/g, "").trim());
      return true;
    }
    function closeShard() {
      if (openIdx < 0) return;
      var i = openIdx;
      shards[i].classList.remove("is-open");
      openIdx = -1;
      openMark = -1;
      root.classList.remove("is-reading");
      if (readEl) { readEl.hidden = true; readEl.classList.remove("is-on", "is-off"); }
      if (shards[i].focus) { try { shards[i].focus(); } catch (e) { } }
    }
    function keepShard() {
      if (openIdx < 0) return false;
      var i = openIdx;
      collected[i] = true;
      kept++;
      openIdx = -1;
      shards[i].classList.remove("is-open");
      shards[i].classList.add("is-kept");
      if (glintEls[i]) glintEls[i].classList.add("is-kept");
      if (readMark) readMark.classList.add("is-kept");
      if (readCard) readCard.classList.add("is-flying");
      root.classList.remove("is-reading");
      if (dialogT) clearTimeout(dialogT);
      dialogT = setTimeout(function () {
        if (readEl) readEl.classList.add("is-off");
      }, CARD_MS);
      dialogT = setTimeout(function () {
        dialogT = 0;
        if (readEl) { readEl.hidden = true; readEl.classList.remove("is-on", "is-off"); }
        if (readCard) readCard.classList.remove("is-flying");
        if (readMark) readMark.classList.remove("is-kept", "is-flying");
        openMark = -1;
        rebuildMap();
        updateCount();
        checkDone();
      }, KEEP_MS);
      return true;
    }
    function updateCount() {
      if (!countEl) return;
      countEl.textContent = kept + " / " + shards.length;
    }
    function checkDone() {
      if (kept < shards.length) return false;
      root.classList.add("is-done");
      if (doneEl) doneEl.setAttribute("aria-hidden", "false");
      return true;
    }

    function measureZones() {
      var lr = layer.getBoundingClientRect();
      for (var i = 0; i < shards.length; i++) {
        var b = shards[i].getBoundingClientRect();
        var z = zone[i] || (zone[i] = {});
        if (!b.width || !cols || !rows) { z.ok = false; continue; }
        z.ok = true;
        z.c0 = Math.max(0, Math.floor((b.left - lr.left) / CELL));
        z.c1 = Math.min(cols - 1, Math.ceil((b.right - lr.left) / CELL));
        z.r0 = Math.max(0, Math.floor((b.top - lr.top) / CELL));
        z.r1 = Math.min(rows - 1, Math.ceil((b.bottom - lr.top) / CELL));
      }
    }

    function resize() {
      var m = layer.getBoundingClientRect();
      W = Math.max(1, Math.round(m.width));
      H = Math.max(1, Math.round(m.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cols = Math.ceil(W / CELL);
      rows = Math.ceil(H / CELL);

      sizeCanvas(cv, W, H);
      layoutShards();
      measureZones();
      layoutStars();

      var n = cols * rows;
      var old = cov;
      cov = new Float32Array(n);
      if (old && old.length === n) cov.set(old);
      else for (var i = 0; i < n; i++) cov[i] = 1;

      var sr = 0x1b873593 | 0;
      function rnd() { sr ^= sr << 13; sr ^= sr >>> 17; sr ^= sr << 5; sr |= 0; return ((sr >>> 0) % 1048576) / 1048576; }
      bAw = Math.ceil(cols / 9) + 2; bAh = Math.ceil(rows / 9) + 2;
      bA = new Float32Array(bAw * bAh);
      for (var t = 0; t < bA.length; t++) bA[t] = rnd();
      bBw = Math.ceil(cols / 3.4) + 2; bBh = Math.ceil(rows / 3.4) + 2;
      bB = new Float32Array(bBw * bBh);
      for (var u = 0; u < bB.length; u++) bB[u] = rnd();
      bCw = Math.ceil(cols / 1.6) + 2; bCh = Math.ceil(rows / 1.6) + 2;
      bC = new Float32Array(bCw * bCh);
      for (var v = 0; v < bC.length; v++) bC[v] = rnd();

      if (covCtx) {
        covCv.width = cols; covCv.height = rows;
        covImg = covCtx.createImageData(cols, rows);
      }
      buildSky();
      preloadAurora();
      buildFrost();
      buildSnow();
      rebuildMap();
      updateCount();
      dirty = true;
    }

    function buildSnow() {
      sizeCanvas(snowCv, W, H);
      flake.length = 0;
      var s0 = 0x7ab3c1d5 | 0;
      function rnd() { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; s0 |= 0; return ((s0 >>> 0) % 1048576) / 1048576; }
      var n = Math.round(SNOW_N * Math.min(1.6, W / 900 + 0.35));
      for (var i = 0; i < n; i++) {
        var vy = dpr * (SNOW_SPD_MIN + rnd() * (SNOW_SPD_MAX - SNOW_SPD_MIN));
        flake.push({
          x: rnd() * W * dpr, y: rnd() * H * dpr,
          r: dpr * (1.6 + rnd() * 2.4),
          vy: vy,
          vx: vy * SNOW_SLANT,
          sway: 0.18 + rnd() * 0.5,
          ph: rnd() * Math.PI * 2,
          a: 0.24 + rnd() * 0.5
        });
      }
      snowStep();
    }
    function snowStep() {
      var s = snowCv && snowCv.getContext("2d");
      if (!s) return;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, snowCv.width, snowCv.height);
      var wpx = W * dpr, hpx = H * dpr;
      for (var i = 0; i < flake.length; i++) {
        var f = flake[i];
        f.y += f.vy;
        f.x += f.vx + Math.sin(f.ph) * f.sway;
        f.ph += 0.02;
        if (f.y > hpx + 6) { f.y = -6; f.x = Math.random() * (wpx + 80) - 40; }
        if (f.x < -8) f.x = wpx + 6;
        if (f.x > wpx + 8) f.x = -6;
        softDot(s, f.x, f.y, Math.max(0.8, f.r * 0.62), f.a, false);
        if (f.r > dpr * 2.2) {
          s.fillStyle = "rgba(226, 240, 255, " + (f.a * 0.20).toFixed(3) + ")";
          var arm = f.r * 1.25;
          s.fillRect(f.x - arm, f.y - dpr * 0.35, arm * 2, Math.max(1, dpr * 0.7));
          s.fillRect(f.x - dpr * 0.35, f.y - arm, Math.max(1, dpr * 0.7), arm * 2);
        }
      }
    }

    function melt(cx, cy, amount) {
      if (!cols || !rows) return;
      meltCalls++;
      lastMelt = [Math.round(cx), Math.round(cy), amount];
      cx *= dpr; cy *= dpr;
      var R = WARM_R * dpr, cs = CELL * dpr;
      var c0 = Math.max(0, Math.floor((cx - R) / cs));
      var c1 = Math.min(cols - 1, Math.ceil((cx + R) / cs));
      var r0 = Math.max(0, Math.floor((cy - R) / cs));
      var r1 = Math.min(rows - 1, Math.ceil((cy + R) / cs));
      var changed = false;
      for (var r = r0; r <= r1; r++) {
        for (var c = c0; c <= c1; c++) {
          var i = idx(c, r);
          if (cov[i] <= 0) continue;
          var dx = (c + 0.5) * cs - cx, dy = (r + 0.5) * cs - cy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > R) continue;
          var k = 1 - d / R;
          var nv = cov[i] - amount * k * k;
          cov[i] = nv < 0 ? 0 : nv;
          changed = true;
        }
      }
      if (changed) dirty = true;
    }

    function spawnDrips(cx, cy) {
      if (drip.length >= DRIP_MAX || Math.random() >= 0.22) return;
      drip.push({
        x: cx + (Math.random() - 0.5) * 22, y: cy + (Math.random() - 0.3) * 16,
        vy: 0.25 + Math.random() * 0.5,
        r: 0.9 + Math.random() * 1.5,
        life: 90 + (Math.random() * 60 | 0)
      });
    }
    function dripStep() {
      for (var i = drip.length - 1; i >= 0; i--) {
        var d = drip[i];
        d.vy += 0.055;
        if (d.vy > 3.4) d.vy = 3.4;
        d.y += d.vy;
        d.life--;
        if (d.y > H + 8 || d.life <= 0) drip.splice(i, 1);
      }
    }
    function paintDrips() {
      if (!drip.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (var i = 0; i < drip.length; i++) {
        var d = drip[i];
        var fade = Math.min(1, d.life / 40);
        ctx.fillStyle = "rgba(196, 226, 250, " + (0.5 * fade).toFixed(3) + ")";
        ctx.fillRect(d.x - d.r * 0.5, d.y - d.r * 0.5, d.r, d.r * 1.5);
        ctx.fillStyle = "rgba(240, 250, 255, " + (0.75 * fade).toFixed(3) + ")";
        ctx.fillRect(d.x - d.r * 0.30, d.y - d.r * 0.40, d.r * 0.5, d.r * 0.6);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function paintFrost() {
      if (!covImg) return;
      var d = covImg.data;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var v = cov[idx(c, r)];
          var i = (r * cols + c) * 4;
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
          if (v <= 0.01) { d[i + 3] = 0; continue; }
          var th = thickAt(c, r);
          d[i + 3] = th <= 0 ? 0 : (Math.pow(v, 0.85) * th * 255) | 0;
        }
      }
      covCtx.putImageData(covImg, 0, 0);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(covCv, 0, 0, cols, rows, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      paintDrips();
      dirty = false;
    }

    function refreshShards() {
      diag.length = 0;
      var anyOpen = false;
      for (var i = 0; i < shards.length; i++) {
        var z = zone[i];
        if (!z || !z.ok) continue;
        var sum = 0, n = 0;
        for (var r = z.r0; r <= z.r1; r += TEXT_STRIDE) {
          for (var c = z.c0; c <= z.c1; c += TEXT_STRIDE) { sum += cov[idx(c, r)]; n++; }
        }
        var frost = n ? sum / n : 1;
        var clear = Math.max(0, Math.min(1, (1 - frost - 0.05) / 0.75));
        diag.push({ i: i, frost: +frost.toFixed(4), clear: +clear.toFixed(4), c0: z.c0, c1: z.c1, r0: z.r0, r1: z.r1 });
        shards[i].style.setProperty("--clear", clear.toFixed(3));
        if (!collected[i]) {
          shards[i].style.setProperty("pointer-events", clear > OPEN_AT ? "auto" : "none");
          shards[i].style.setProperty("cursor", clear > OPEN_AT ? "pointer" : "default");
          if (clear > OPEN_AT) anyOpen = true;
        }
      }
      root.classList.toggle("is-openable", anyOpen);
    }

    function frame() {
      raf = 0;
      if (!active) return;
      if (warm.on && (pressing || Date.now() - warm.since >= DWELL_MS)) {
        melt(warm.x, warm.y, MELT_DWELL);
        spawnDrips(warm.x, warm.y);
      }
      if (drip.length) dripStep();
      if (!reduced) snowStep();
      if (!reduced || !aurFrames) {
        paintAuroraGlsl(((window.performance && performance.now) ? performance.now() : Date.now()) / 1000 - aurT0 / 1000);
      }
      if (dirty || drip.length) { paintFrost(); refreshShards(); }
      if (reduced && !dirty && !drip.length && !warm.on) return;
      raf = requestAnimationFrame(function () { timer = setTimeout(frame, TICK); });
    }
    function kick() {
      if (raf || !active) return;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf = 0;
    }

    function local(e) {
      var m = cv.getBoundingClientRect();
      var sx = (m.width > 0) ? W / m.width : 1;
      var sy = (m.height > 0) ? H / m.height : 1;
      return { x: (e.clientX - m.left) * sx, y: (e.clientY - m.top) * sy };
    }
    function onMove(e, fromDown) {
      if (!active) return;
      var isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      if (isTouch && !pressing) return;
      var p = local(e);
      if (pressing) {
        var mdx = p.x - downX, mdy = p.y - downY;
        var md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md > dragDist) dragDist = md;
      }
      var now = Date.now();
      var jx = p.x - warm.ax, jy = p.y - warm.ay;
      if (!warm.on || jx * jx + jy * jy > DWELL_SLOP * DWELL_SLOP) {
        warm.ax = p.x; warm.ay = p.y; warm.since = now;
      }
      warm.on = true; warm.x = p.x; warm.y = p.y; warm.type = isTouch ? "touch" : "mouse";
      if (pressing || now - warm.since >= DWELL_MS) melt(p.x, p.y, MELT_HIT);
      if (hintEl) hintEl.classList.add("is-used");
      if (pressing && !fromDown && !captured) {
        captured = true;
        try { root.setPointerCapture(e.pointerId); } catch (err) { }
      }
      kick();
    }
    function onDown(e) {
      if (!active) return;
      pressing = true;
      captured = false;
      dragDist = 0;
      var p0 = local(e);
      downX = p0.x; downY = p0.y;
      onMove(e, true);
    }
    function onUp() {
      pressing = false;
      captured = false;
      if (warm.type !== "mouse") warm.on = false;
    }
    function onLeave() { warm.on = false; }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("pointerleave", onLeave);

    for (var ci = 0; ci < shards.length; ci++) {
      (function (i) {
        shards[i].addEventListener("click", function () {
          if (!active) return;
          if (dragDist > 6) return;
          openShard(i);
        });
        shards[i].addEventListener("focus", function () { if (active && !collected[i]) warmShard(i); });
      })(ci);
    }
    if (readCard) readCard.addEventListener("click", function () { if (active) keepShard(); });
    if (readEl) readEl.addEventListener("click", function (e) { if (e.target === readEl) closeShard(); });
    document.addEventListener("keydown", function (e) {
      if (!active) return;
      if ((e.key === "Escape" || e.keyCode === 27) && openIdx >= 0) closeShard();
    });

    window.addEventListener("resize", function () {
      if (!active) return;
      clearTimeout(resize._t);
      resize._t = setTimeout(function () { resize(); paintFrost(); refreshShards(); }, 180);
    });

    return {
      key: root.getAttribute("data-frost") || "future",
      activate: function (on) {
        active = on;
        if (on) {
          /* 与过场衔接:进场时盖上霜雾再散开(过场结束在霜雾里,面板从同一雾里透出) */
          root.classList.add("is-entering");
          root.classList.remove("is-entered");
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              root.classList.remove("is-entering");
              root.classList.add("is-entered");
            });
          });
          aurT0 = (window.performance && performance.now) ? performance.now() : Date.now();
          preloadAurora();
          if (!cols) requestAnimationFrame(function () { resize(); paintFrost(); refreshShards(); updateCount(); kick(); });
          else { resize(); paintFrost(); refreshShards(); updateCount(); kick(); }
        } else {
          stop();
          warm.on = false;
        }
      },
      reveal: function () { kick(); },
      refresh: function () { measureZones(); refreshShards(); return diag.slice(); },
      repaint: function () { if (active) { resize(); paintFrost(); refreshShards(); } },
      state: function () {
        var sum = 0;
        for (var i = 0; i < cov.length; i++) sum += cov[i];
        var themes = {};
        for (var t = 0; t < shards.length; t++) {
          if (!themeOf[t]) continue;
          themes[themeOf[t]] = themes[themeOf[t]] || { total: 0, kept: 0 };
          themes[themeOf[t]].total++;
          if (collected[t]) themes[themeOf[t]].kept++;
        }
        return {
          key: "future", active: active, cols: cols, rows: rows,
          diag: diag.slice(),
          frost: +(sum / (cov.length || 1)).toFixed(3),
          shards: shards.length,
          kept: kept,
          open: openIdx,
          stars: mapEl ? mapEl.querySelectorAll(".frost-star").length : 0,
          lines: mapEl ? mapEl.querySelectorAll(".frost-starline").length : 0,
          themes: themes,
          done: root.classList.contains("is-done"),
          warm: warm.on, warming: warm.type, pressing: pressing, reduced: reduced,
          meltCalls: meltCalls, lastMelt: lastMelt,
          drops: drip.length,
          count: countEl ? countEl.textContent : "",
          visible: shards.filter(function (e) { return parseFloat(e.style.getPropertyValue("--clear")) > 0.55; }).length
        };
      },
      warmAt: function (x, y, amount) {
        melt(x, y, amount === undefined ? 0.25 : amount);
        paintFrost(); refreshShards();
        return true;
      },
      focusShard: function (i) { warmShard(i); rebuildMap(); return true; },
      covAt: function (x, y) {
        if (!cols || !rows) return -1;
        var c = Math.floor(x / CELL), r = Math.floor(y / CELL);
        if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
        return +cov[idx(c, r)].toFixed(3);
      },
      meltAll: function () { for (var i = 0; i < cov.length; i++) cov[i] = 0; paintFrost(); refreshShards(); return true; },
      freezeAll: function () { for (var i = 0; i < cov.length; i++) cov[i] = 1; paintFrost(); refreshShards(); return true; },
      open: function (i) { return openShard(i); },
      close: function () { closeShard(); return true; },
      keep: function () { return keepShard(); },
      collectAll: function () {
        for (var i = 0; i < shards.length; i++) {
          if (collected[i]) continue;
          openShard(i);
          keepShard();
        }
        rebuildMap(); updateCount(); checkDone();
        return kept;
      }
    };
  }

  if (window.CDPages && window.CDPages.register) {
    window.CDPages.register("frost", function (root) {
      var api = build(root);
      if (!api) return api;
      document.addEventListener("cd-boot-done", function () { api.reveal(); });
      document.addEventListener("cd-panel", function (e) {
        if (e.detail === "future" && !window.__bootRunning) setTimeout(api.reveal, 0);
      });
      setTimeout(function () {
        if (!window.__bootRunning &&
          document.querySelector(".intro-panel.is-active[data-panel='future']")) api.reveal();
      }, 0);
      return api;
    });
  }
})();
