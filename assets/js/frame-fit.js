/* ============================================================
   模拟屏幕外框贴合(FrameFit)—— 五张盘共用
   ─────────────────────────────────────────────────────────────
   问题:外框是 /assets/screen/frame.webp 按 100% 100% 拉伸铺满视口的贴图,
         它中间那块【透明窗口】才是真正能显示东西的地方。而页面上原来用
         --sp-t/--sp-x/--sp-b(13vh / 5vw / 7.5vh)当可视区内边距 ——
         右下比窗口多出去 7~10px,四角的【斜切】也压不住,于是内容顶出金属框
         (用户先在第四张盘的终端上发现,其实五张盘的开机画面/页面都有)。
   做法:运行时把那张贴图读进 canvas(缩到 1/4 算,毫秒级),量出两样东西:
     · 最大内接矩形(safe):完全落在透明区里的最大矩形 → 给"内容"用;
     · 窗口轮廓(polygon):逐行扫透明范围拼成的多边形 → 给"玻璃"裁边用。
   产出(写在 <html> 上的自定义属性 + 一个 class,懂 CSS 的地方直接用):
     html.frame-fitted                   量到了(量不到就退回 CSS 里的保底值)
     --ff-safe-*   内接矩形四边(px,从视口算)
     --ff-win-*    中线包围盒四边(px)—— 比内接矩形大,给"贴边"的层用
     --ff-clip     多边形(px),配合 clip-path 把一整层裁成屏幕形状
   另外会把 .screen 上那套 --sp-* 抬高到"不小于窗口内边距",页面自然就收进来了。

   依赖:无。任何模块都可以
     FrameFit.ready(function (d) { … })  // 量好之后回调(已量好则立即回调)
   来拿数据;窗口 resize 时会自动重算并派发 frame-fit 事件。
   ============================================================ */
(function () {
  "use strict";

  var IMG = "/assets/screen/frame.webp";
  var GAP = 10;                 /* (历史值)内接矩形再往里收一点 */
  var CORNER = 14;              /* 窗口再往里收一点,躲开四角的斜切(给"内容"用)*/
  var SP_GAP = 4;               /* --sp-* 至少比窗口多让这么多 */
  var S = 4;                    /* 贴图缩到这个比例再算 */

  var data = null;              /* 量到的原始数据*/
  var cbs = [];
  var pending = false;

  function measure() {
    return new Promise(function (done) {
      var img = new Image();
      img.onload = function () {
        try {
          var W = Math.max(8, Math.round(img.naturalWidth / S));
          var H = Math.max(8, Math.round(img.naturalHeight / S));
          var c = document.createElement("canvas");
          c.width = W; c.height = H;
          var g = c.getContext("2d", { willReadFrequently: true });
          g.drawImage(img, 0, 0, W, H);
          var d = g.getImageData(0, 0, W, H).data;
          var A = function (x, y) { return d[(y * W + x) * 4 + 3]; };

          /* ① 中线上的一整段透明:中线包围盒(参考用,也是"贴边层"的边界)*/
          function bigRun(len, alpha) {
            var best = null, s = -1, i;
            for (i = 0; i < len; i++) {
              var clear = alpha(i) <= 8;
              if (clear && s < 0) s = i;
              if (!clear && s >= 0) { if (!best || i - 1 - s > best[1] - best[0]) best = [s, i - 1]; s = -1; }
            }
            if (s >= 0 && (!best || len - 1 - s > best[1] - best[0])) best = [s, len - 1];
            return best;
          }
          var vRun = bigRun(H, function (y) { return A(Math.floor(W / 2), y); });
          var hRun = bigRun(W, function (x) { return A(x, Math.floor(H / 2)); });

          /* ② 最大内接矩形(单调栈,按行做直方图)—— 保证整个落在透明区里,
                斜切角也不会被顶到。只搜中间 5%~95%,免得把贴图最外圈的透明留白当成窗口 */
          var x0 = Math.floor(W * 0.05), x1 = Math.ceil(W * 0.95);
          var y0 = Math.floor(H * 0.05), y1 = Math.ceil(H * 0.95);
          var heights = new Int32Array(W), best = null;
          for (var y = y0; y < y1; y++) {
            for (var x = x0; x < x1; x++) heights[x] = A(x, y) <= 8 ? heights[x] + 1 : 0;
            var stack = [];
            for (var x2 = x0; x2 <= x1; x2++) {
              var h = x2 === x1 ? 0 : heights[x2], start = x2;
              while (stack.length && stack[stack.length - 1].h >= h) {
                var top = stack.pop();
                var area = top.h * (x2 - top.x);
                if (!best || area > best.area) best = { x: top.x, y: y - top.h + 1, w: x2 - top.x, h: top.h, area: area };
                start = top.x;
              }
              stack.push({ x: start, h: h });
            }
          }
          if (!best) return done(null);

          /* ③ 窗口轮廓:逐行扫出透明范围拼成多边形(玻璃层裁边用)。
                同时给"逐行左右边界"取中位数 —— 电源键那种局部凸起、四角的斜切
                都是离群值,中线法量出来的左边界会偏掉(实际 77px,被电源键带成 52px)。*/
          var rows = 25, pts = [], lefts = [], rights = [];
          var ry0 = vRun ? vRun[0] * S : best.y * S, ry1 = vRun ? vRun[1] * S : (best.y + best.h) * S;
          for (var i2 = 0; i2 < rows; i2++) {
            var yy = Math.round(ry0 + (ry1 - ry0) * (i2 / (rows - 1)));
            var sy = Math.max(0, Math.min(H - 1, Math.round(yy / S)));
            var r = null, s2 = -1, xx;
            for (xx = x0; xx < x1; xx++) {
              var clear2 = A(xx, sy) <= 8;
              if (clear2 && s2 < 0) s2 = xx;
              if (!clear2 && s2 >= 0) { if (!r || xx - 1 - s2 > r[1] - r[0]) r = [s2, xx - 1]; s2 = -1; }
            }
            if (s2 >= 0 && (!r || x1 - 1 - s2 > r[1] - r[0])) r = [s2, x1 - 1];
            if (r) {
              pts.push([r[0] * S, yy, r[1] * S, yy]);
              /* 只收"跟典型值差不多宽"的行(太窄的是切角/凸起)*/
              if (r[1] - r[0] > (x1 - x0) * 0.5) { lefts.push(r[0]); rights.push(r[1]); }
            }
          }
          lefts.sort(function (a, b) { return a - b; });
          rights.sort(function (a, b) { return a - b; });
          var medL = lefts.length ? lefts[Math.floor(lefts.length / 2)] : best.x;
          var medR = rights.length ? rights[Math.floor(rights.length / 2)] : best.x + best.w;
          var cx = (best.x + best.w / 2) * S, cy = (best.y + best.h / 2) * S;
          var k = Math.max(0.9, 1 - (2 * GAP) / Math.max(80, best.h * S));
          function shrink(p) { return [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]; }
          var poly = pts.map(function (p) { return shrink([p[0], p[1]]); })
            .concat(pts.slice().reverse().map(function (p) { return shrink([p[2], p[3]]); }));

          done({
            img: [img.naturalWidth, img.naturalHeight],
            safe: [best.x * S, best.y * S, (best.x + best.w) * S, (best.y + best.h) * S],
            box: hRun && vRun ? [hRun[0] * S, vRun[0] * S, hRun[1] * S, vRun[1] * S] : null,
            /* 窗口四边的稳健值(图上坐标):左右取中位数,上下取中线透明段的两端 */
            win: [medL * S, ry0, medR * S, ry1],
            polygon: poly.length >= 6 ? poly : null
          });
        } catch (e) { done(null); }
      };
      img.onerror = function () { done(null); };
      img.src = IMG;
    });
  }

  /* "13vh" / "5vw" / "24px" → px(自定义属性取出来是原样的字符串,不会自动解析)*/
  function resolveLen(raw, W, H) {
    var m = /^\s*(-?[\d.]+)(vh|vw|px|%)?\s*$/.exec(String(raw || ""));
    if (!m) return null;
    var v = parseFloat(m[1]), u = m[2] || "px";
    if (u === "vh" || u === "%") return v / 100 * H;
    if (u === "vw") return v / 100 * W;
    return v;
  }

  /* 页面那套 --sp-* 直接落到窗口四边(不再取 max:第二张/第三张那种自带整块底的页面,
     原来会留一圈底色在框里,看着像"浮在框里的小方块") */
  var spOrig = null;
  function clampSp(winIns) {
    var el = document.querySelector(".screen");
    if (!el || !winIns) return;
    var W = window.innerWidth, H = window.innerHeight;
    var cs = getComputedStyle(el);
    if (!spOrig) {
      spOrig = {};
      ["--sp-t", "--sp-x", "--sp-b"].forEach(function (k) { spOrig[k] = resolveLen(cs.getPropertyValue(k), W, H); });
    }
    el.style.setProperty("--sp-t", Math.round(Math.max(0, winIns[1]) + SP_GAP) + "px");
    el.style.setProperty("--sp-x", Math.round(Math.max(winIns[0], winIns[2]) + SP_GAP) + "px");
    el.style.setProperty("--sp-b", Math.round(Math.max(0, winIns[3]) + SP_GAP) + "px");
  }

  function apply() {
    var html = document.documentElement, s = html.style;
    var W = window.innerWidth, H = window.innerHeight;
    if (!data) {
      html.classList.remove("frame-fitted");
      ["--ff-safe-top", "--ff-safe-right", "--ff-safe-bottom", "--ff-safe-left",
        "--ff-clip", "--ff-win-top", "--ff-win-right", "--ff-win-bottom", "--ff-win-left"]
        .forEach(function (k) { s.removeProperty(k); });
      return;
    }
    var sx = W / data.img[0], sy = H / data.img[1];
    /* 窗口四边的内边距(px):玻璃按轮廓裁;内容用"窗口 + CORNER"躲开斜切 */
    var win = data.win || [data.safe[0], data.safe[1], data.safe[2], data.safe[3]];
    var winIns = [win[0] * sx, win[1] * sy, W - win[2] * sx, H - win[3] * sy];
    var safeIns = [winIns[0] + CORNER, winIns[1] + CORNER, winIns[2] + CORNER, winIns[3] + CORNER];
    s.setProperty("--ff-win-left", Math.round(winIns[0]) + "px");
    s.setProperty("--ff-win-top", Math.round(winIns[1]) + "px");
    s.setProperty("--ff-win-right", Math.round(winIns[2]) + "px");
    s.setProperty("--ff-win-bottom", Math.round(winIns[3]) + "px");
    s.setProperty("--ff-safe-left", Math.round(safeIns[0]) + "px");
    s.setProperty("--ff-safe-top", Math.round(safeIns[1]) + "px");
    s.setProperty("--ff-safe-right", Math.round(safeIns[2]) + "px");
    s.setProperty("--ff-safe-bottom", Math.round(safeIns[3]) + "px");
    if (data.polygon) {
      s.setProperty("--ff-clip", "polygon(" + data.polygon.map(function (p) {
        return (p[0] * sx).toFixed(1) + "px " + (p[1] * sy).toFixed(1) + "px";
      }).join(", ") + ")");
    }
    html.classList.add("frame-fitted");
    clampSp(winIns);
  }

  function boot() {
    if (pending) return;
    pending = true;
    measure().then(function (d) {
      data = d;
      apply();
      cbs.forEach(function (cb) { try { cb(d); } catch (e) {} });
      cbs = [];
      try { window.dispatchEvent(new CustomEvent("frame-fit", { detail: !!d })); } catch (e) {}
    });
  }

  window.FrameFit = {
    ready: function (cb) {
      if (data) { try { cb(data); } catch (e) {} return; }
      cbs.push(cb);
      boot();
    },
    data: function () { return data; },
    refit: apply,
    /* 排障:控制台敲 FrameFit.debug() */
    debug: function () {
      var W = window.innerWidth, H = window.innerHeight;
      return {
        measured: !!data,
        img: data ? data.img : null,
        safe: data ? data.safe : null,
        box: data ? data.box : null,
        viewport: [W, H],
        styleVars: (function () {
          var cs = getComputedStyle(document.documentElement), out = {};
          ["--ff-safe-left", "--ff-safe-top", "--ff-safe-right", "--ff-safe-bottom",
            "--ff-win-left", "--ff-win-top", "--ff-win-right", "--ff-win-bottom"].forEach(function (k) {
              out[k] = cs.getPropertyValue(k).trim();
            });
          return out;
        })(),
        screenSp: (function () {
          var el = document.querySelector(".screen");
          if (!el) return null;
          var cs = getComputedStyle(el);
          return { t: cs.getPropertyValue("--sp-t").trim(), x: cs.getPropertyValue("--sp-x").trim(), b: cs.getPropertyValue("--sp-b").trim() };
        })(),
        fitted: document.documentElement.classList.contains("frame-fitted")
      };
    }
  };

  boot();
  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(apply, 160);
  });
})();
