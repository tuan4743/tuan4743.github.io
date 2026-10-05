(function () {
  "use strict";

  var IMG = "/assets/screen/frame.webp";
  var GAP = 10;
  var CORNER = 14;
  var SP_GAP = 4;
  var S = 4;

  var data = null;
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
          var raw = pts.map(function (p) { return [p[0], p[1]]; })
            .concat(pts.slice().reverse().map(function (p) { return [p[2], p[3]]; }));
          var poly = raw.map(shrink);

          var PADT = 5;
          var cover = null;
          if (raw.length >= 6) {
            var cxm = (medL * S + medR * S) / 2;
            cover = raw.map(function (p) {
              var x = p[0] + (p[0] < cxm ? -PADT : PADT);
              var y = p[1] <= ry0 ? ry0 - PADT : (p[1] >= ry1 ? ry1 + PADT : p[1]);
              return [x, y];
            });
          }

          done({
            img: [img.naturalWidth, img.naturalHeight],
            safe: [best.x * S, best.y * S, (best.x + best.w) * S, (best.y + best.h) * S],
            box: hRun && vRun ? [hRun[0] * S, vRun[0] * S, hRun[1] * S, vRun[1] * S] : null,
            win: [medL * S, ry0, medR * S, ry1],
            polygon: poly.length >= 6 ? poly : null,
            coverClip: cover
          });
        } catch (e) { done(null); }
      };
      img.onerror = function () { done(null); };
      img.src = IMG;
    });
  }

  function resolveLen(raw, W, H) {
    var m = /^\s*(-?[\d.]+)(vh|vw|px|%)?\s*$/.exec(String(raw || ""));
    if (!m) return null;
    var v = parseFloat(m[1]), u = m[2] || "px";
    if (u === "vh" || u === "%") return v / 100 * H;
    if (u === "vw") return v / 100 * W;
    return v;
  }

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
        "--ff-clip", "--ff-clip-cover", "--ff-win-top", "--ff-win-right", "--ff-win-bottom", "--ff-win-left"]
        .forEach(function (k) { s.removeProperty(k); });
      return;
    }
    var sx = W / data.img[0], sy = H / data.img[1];
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
    function polyStr(pts) {
      return "polygon(" + pts.map(function (p) {
        return (p[0] * sx).toFixed(1) + "px " + (p[1] * sy).toFixed(1) + "px";
      }).join(", ") + ")";
    }
    if (data.polygon) s.setProperty("--ff-clip", polyStr(data.polygon));
    if (data.coverClip) s.setProperty("--ff-clip-cover", polyStr(data.coverClip));
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
