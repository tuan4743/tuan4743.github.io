/* ============================================================
   第二张盘「成长」的主页内容:太空站视角(用户贴图版)
   ─────────────────────────────────────────────────────────────
   素材:static/planet/(用户提供,已自动裁掉透明边距 → 元素尺寸就是可见尺寸)
     宇宙背景      → params.intro.solar.bg
     蓝巨星(恒星)→ params.intro.solar.sun
     五颗行星贴图  → 每颗的 tex
   构图:x / y 是星体中心相对面板宽高的比例;w 是【宽度占面板宽的比例】
     (贴图版本用"宽度比例"最好调:写成 0.12 就是面板宽的 12%)
     五颗按用户要求【从左到右】排列:寒冷 → 炎热 → 类地 → 黑洞 → 气态
   向阳面:用户画的时候统一朝左上,所以五颗都排在恒星的右下方;
     个别对不上的可以用每颗的 rot(度)把贴图转一下
   微调接口:网址后面加 ?tune → 出现滑条面板(位置/大小/旋转),
     调完点"复制 TOML",把结果贴回 hugo.toml 即可
   ============================================================ */
(function () {
  "use strict";

  var NARROW = 780;      /* 小于这个宽度换成竖排列表 */
  var GAP = 16;          /* 星体边缘到卡片之间的空隙 */
  var CAM = 14;          /* 视差最大位移(px):乘以各层 --depth */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function attrNum(el, name, dflt) {
    var v = parseFloat(el.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function mk(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function build(root, key) {
    var sun = root.querySelector(".solar-node--star");
    var sunBall = sun ? sun.querySelector(".solar-sun") : null;
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var balls = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var imgs = nodes.map(function (n) { return n.querySelector(".solar-tex"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    /* ---------- 可调参数:data-* 打底,?tune 面板的覆盖优先 ---------- */
    var TUNE = window.__solarTune || (window.__solarTune = {});
    function cfgOf(node, kind) {
      var id = node.getAttribute("data-code") || "";
      var base = {
        x: attrNum(node, "data-x", 0.5),
        y: attrNum(node, "data-y", 0.5),
        w: attrNum(node, "data-w", 0.12),
        rot: attrNum(node, "data-rot", 0),
        depth: attrNum(node, "data-depth", 0.7)
      };
      var t = TUNE[id];
      if (t) for (var k in t) if (isFinite(t[k])) base[k] = t[k];
      return base;
    }

    var active = false, onIndex = -1, geo = [], narrow = false;
    var sunCfg = null;

    /* ---------------- 位置计算 ---------------- */
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;

      /* 恒星:位置 + 宽度比例(默认 0.26 面板宽) */
      sunCfg = {
        x: attrNum(sun, "data-x", 0.19),
        y: attrNum(sun, "data-y", 0.34),
        w: attrNum(sun, "data-w", 0.26)
      };
      var st = TUNE.__sun;
      if (st) for (var k in st) if (isFinite(st[k])) sunCfg[k] = st[k];
      if (sun) {
        sun.style.left = (sunCfg.x * W).toFixed(1) + "px";
        sun.style.top = (sunCfg.y * H).toFixed(1) + "px";
      }
      if (sunBall) sunBall.style.width = (sunCfg.w * W).toFixed(1) + "px";
      root.style.setProperty("--sun-w", (sunCfg.w * W).toFixed(1) + "px");

      geo = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var c = cfgOf(n, i);
        var w = Math.max(8, c.w * W);
        n.style.left = (c.x * W).toFixed(1) + "px";
        n.style.top = (c.y * H).toFixed(1) + "px";
        n.style.setProperty("--w", w.toFixed(1) + "px");
        n.style.setProperty("--depth", c.depth);
        if (imgs[i]) imgs[i].style.transform = c.rot ? "rotate(" + c.rot + "deg)" : "";
        if (balls[i]) balls[i].style.transform = c.rot ? "rotate(" + c.rot + "deg)" : "";
        /* 半径按落位后的真实盒子算(贴图是高是扁都能用) */
        var r = balls[i] ? balls[i].getBoundingClientRect() : null;
        geo.push({
          x: c.x * W, y: c.y * H,
          r: r ? r.width / 2 : w / 2,
          rh: r ? r.height / 2 : w / 2
        });
      }
    }

    /* 卡片躲开"星体外接圆"(扁的贴图按高度算,免得卡片压到图上)*/
    function outerR(i) {
      var g = geo[i];
      if (!g) return 0;
      var ring = nodes[i].classList.contains("has-ring");
      return Math.max(g.r, g.rh) * (ring ? 1.2 : 1);
    }

    /* ---------------- HUD 卡片 ---------------- */
    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      var W = root.clientWidth, H = root.clientHeight;
      var pad = parseFloat(getComputedStyle(root).getPropertyValue("--pad")) || 20;
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var R = outerR(i);
      var sides = [
        { k: "right", v: W - (g.x + R) - w },
        { k: "left", v: (g.x - R) - w },
        { k: "above", v: (g.y - R) - h },
        { k: "below", v: H - (g.y + R) - h }
      ];
      sides.sort(function (a, b) { return b.v - a.v; });
      var cx, cy;
      switch (sides[0].k) {
        case "right": cx = g.x + R + GAP; cy = g.y - h / 2; break;
        case "left": cx = g.x - R - GAP - w; cy = g.y - h / 2; break;
        case "above": cx = g.x - w / 2; cy = g.y - R - GAP - h; break;
        default: cx = g.x - w / 2; cy = g.y + R + GAP;
      }
      cx = clamp(cx, pad, Math.max(pad, W - pad - w));
      cy = clamp(cy, pad, Math.max(pad, H - pad - h));
      /* 卡片是 .solar-node 的子元素,node 原点就在星体中心 → 用相对偏移 */
      card.style.transform = "translate3d(" + (cx - g.x).toFixed(1) + "px," + (cy - g.y).toFixed(1) + "px,0)";
      card.classList.add("is-on");
      drawLine(i, cx + w / 2, cy + h / 2, R);
    }

    function drawLine(i, tx, ty, R) {
      if (!svg) return;
      var g = geo[i], W = root.clientWidth, H = root.clientHeight;
      var d = attrNum(nodes[i], "data-depth", 0.7);
      var camx = parseFloat(root.style.getPropertyValue("--cam-x")) || 0;
      var camy = parseFloat(root.style.getPropertyValue("--cam-y")) || 0;
      var px = g.x - CAM * d * camx, py = g.y - CAM * d * camy;
      var ax = tx - px, ay = ty - py;
      var len = Math.max(1, Math.hypot(ax, ay));
      var sx = px + (ax / len) * (R + 2), sy = py + (ay / len) * (R + 2);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.appendChild(mk("path", {
        d: "M" + sx.toFixed(1) + " " + sy.toFixed(1) + " L" + tx.toFixed(1) + " " + ty.toFixed(1),
        "class": "solar-lead"
      }));
      svg.appendChild(mk("circle", { cx: sx.toFixed(1), cy: sy.toFixed(1), r: 2.2, "class": "solar-node-dot" }));
    }

    function focus(i) {
      if (onIndex === i) return;
      if (onIndex >= 0) {
        if (cards[onIndex]) cards[onIndex].classList.remove("is-on");
        nodes[onIndex].classList.remove("is-on");
      }
      onIndex = i;
      if (i < 0) { if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild); return; }
      nodes[i].classList.add("is-on");
      show(i);
    }

    /* ---------------- 事件 ---------------- */
    nodes.forEach(function (n, i) {
      var ball = balls[i];
      if (!ball) return;
      ball.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(i);
      });
      ball.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      ball.addEventListener("focus", function () { if (active) focus(i); });
      ball.addEventListener("blur", function () { if (active && onIndex === i) focus(-1); });
      ball.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch") return;
        focus(onIndex === i ? -1 : i);
      });
    });

    root.addEventListener("pointermove", function (e) {
      if (!active || narrow || e.pointerType === "touch") return;
      var r = root.getBoundingClientRect();
      var nx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      var ny = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      root.style.setProperty("--cam-x", nx.toFixed(3));
      root.style.setProperty("--cam-y", ny.toFixed(3));
      if (onIndex >= 0) show(onIndex);
    });
    root.addEventListener("pointerleave", function () {
      root.style.setProperty("--cam-x", "0");
      root.style.setProperty("--cam-y", "0");
      focus(-1);
    });

    /* 贴图加载完尺寸才准 → 重排一次(宽高比是图片自带的,不用手填)*/
    imgs.forEach(function (im) {
      if (!im) return;
      if (!im.complete) im.addEventListener("load", function () { if (active) place(); }, { once: true });
    });

    var raf = 0;
    function later() {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; place(); });
    }

    place();

    var api = {
      root: root, nodes: nodes, cfgOf: cfgOf, place: place, sunNode: sun,
      key: key,
      activate: function (on) {
        active = on;
        if (on) {
          place();
          root.classList.remove("is-live");
          requestAnimationFrame(function () { if (active) root.classList.add("is-live"); });
        } else {
          root.classList.remove("is-live");
          focus(-1);
          root.style.setProperty("--cam-x", "0");
          root.style.setProperty("--cam-y", "0");
        }
      },
      repaint: function () { place(); },
      state: function () {
        return {
          key: key, active: active, narrow: narrow,
          bodies: geo.length, open: onIndex,
          sun: sunCfg,
          geo: geo.map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r * 2)]; })
        };
      }
    };
    return api;
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
