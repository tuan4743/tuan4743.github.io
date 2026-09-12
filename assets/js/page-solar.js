/* ============================================================
   第二张盘「成长」的主页内容:太空站视角的太阳系(.solar,样式见 pages.css)
   ─────────────────────────────────────────────────────────────
   构图(用户给的机位,位置都是面板宽高的比例,写在一个个 data-x / data-y 上):
     · 太阳:中心偏左上,直径约屏宽的 1/3 —— 它是整幅图的视觉锚点
     · 五颗星体按机位摆:类地(左下·中等)/ 岩石(左上·小·炎热)/
       气态(中下偏右·巨大·带环)/ 岩石(右下·炎热)/ 黑洞(右上·最小)
     · 每个星体的位置/半径都在 JS 里按容器尺寸算 → 窗口怎么变构图都不散
   机位感(视差):
     · 鼠标在面板上移动时,把位置写进 --cam-x / --cam-y(-1~1),
       各层按自己的 --depth 反向平移一点 —— 远的动得少、近的动得多,
       于是有"隔着观察窗往外看"的纵深。只有 mousemove 才写样式,不占 rAF
   HUD 卡片(磁吸 combo):
     · 星体本身就是磁吸光标的目标(带 data-magnetic),光标会锁上去
     · 锁定(鼠标移入 / 键盘 focus / 触屏点一下)才显示卡片
     · 卡片位置自动挑"空间更大的一侧",再夹在边框内(离边 ≥ --pad),
       所以永远不会顶出屏幕;连线从星体边缘指向卡片中心,末端被卡片盖住
   窄屏(W < 780):切成竖排列表,卡片常显,星体缩成小图标(不玩视差)
   ============================================================ */
(function () {
  "use strict";

  var NARROW = 780;      /* 小于这个宽度换成竖排列表 */
  var GAP = 16;          /* 星体边缘到卡片之间的空隙 */
  var CAM = 14;          /* 视差最大位移(px):乘以各层 --depth */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(el, name, dflt) {
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
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    var active = false, onIndex = -1, geo = [], narrow = false;

    /* ---------------- 位置计算 ---------------- */
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;

      /* 太阳:中心偏左上,直径 ≈ 屏宽的 1/3 */
      var sunX = 0.30 * W, sunY = 0.36 * H;
      var sunR = 0.155 * W;
      root.style.setProperty("--sun-r", sunR.toFixed(1) + "px");
      if (sun) {
        sun.style.left = sunX.toFixed(1) + "px";
        sun.style.top = sunY.toFixed(1) + "px";
      }

      /* 星体:半径按"最大星体"的基准 × size(气态行星最大) */
      var rBase = Math.min(W * 0.085, H * 0.13);
      geo = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var x = clamp(num(n, "data-x", 0.5), 0, 1) * W;
        var y = clamp(num(n, "data-y", 0.5), 0, 1) * H;
        var r = rBase * clamp(num(n, "data-size", 0.5), 0.05, 1.4);
        n.style.left = x.toFixed(1) + "px";
        n.style.top = y.toFixed(1) + "px";
        n.style.setProperty("--r", r.toFixed(1) + "px");
        geo.push({ x: x, y: y, r: r });
      }
      if (onIndex >= 0) show(onIndex);
    }

    /* 星体半径里还要加上环(气态行星的环比本体宽),卡片得躲开它 */
    function outerR(i) {
      var g = geo[i];
      if (!g) return 0;
      var ring = nodes[i].classList.contains("has-ring");
      return g.r * (ring ? 1.45 : 1);
    }

    /* ---------------- HUD 卡片:挑一侧 + 夹在边框内 ---------------- */
    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      var W = root.clientWidth, H = root.clientHeight;
      var pad = parseFloat(getComputedStyle(root).getPropertyValue("--pad")) || 20;
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var R = outerR(i);

      /* 哪边空间大就放哪边:先横后纵,取更大的那一块 */
      var spaceR = W - (g.x + R), spaceL = g.x - R, spaceB = H - (g.y + R), spaceT = g.y - R;
      var sides = [
        { k: "right", v: spaceR - w },
        { k: "left", v: spaceL - w },
        { k: "above", v: spaceT - h },
        { k: "below", v: spaceB - h }
      ];
      sides.sort(function (a, b) { return b.v - a.v; });
      var side = sides[0].k;

      var cx, cy;
      if (side === "right") { cx = g.x + R + GAP; cy = g.y - h / 2; }
      else if (side === "left") { cx = g.x - R - GAP - w; cy = g.y - h / 2; }
      else if (side === "above") { cx = g.x - w / 2; cy = g.y - R - GAP - h; }
      else { cx = g.x - w / 2; cy = g.y + R + GAP; }
      /* 夹在边框内 —— 这一步保证卡片永远不越界 */
      cx = clamp(cx, pad, Math.max(pad, W - pad - w));
      cy = clamp(cy, pad, Math.max(pad, H - pad - h));
      /* ★ 卡片是 .solar-node 的子元素,而 node 的原点就在星体中心 ——
         所以 transform 要用"相对星体中心"的偏移,不能直接写面板坐标 */
      card.style.transform = "translate3d(" + (cx - g.x).toFixed(1) + "px," + (cy - g.y).toFixed(1) + "px,0)";
      card.classList.add("is-on");

      /* 连线:星体边缘 → 卡片中心(末端被卡片盖住,看起来正好接在边上)*/
      drawLine(i, cx + w / 2, cy + h / 2, R);
    }

    function drawLine(i, tx, ty, R) {
      if (!svg) return;
      var g = geo[i], W = root.clientWidth, H = root.clientHeight;
      /* 起点要算上视差:星体本体被 --cam-* 平移过 */
      var dx = -CAM * num(nodes[i], "data-depth", 0.7) * (parseFloat(root.style.getPropertyValue("--cam-x")) || 0);
      var dy = -CAM * num(nodes[i], "data-depth", 0.7) * (parseFloat(root.style.getPropertyValue("--cam-y")) || 0);
      var px = g.x + dx, py = g.y + dy;
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

    function hide(i) {
      if (i >= 0 && cards[i]) cards[i].classList.remove("is-on");
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (onIndex === i) onIndex = -1;
    }

    function focus(i) {
      if (onIndex === i) return;
      if (onIndex >= 0) {
        var old = onIndex;
        if (cards[old]) cards[old].classList.remove("is-on");
        nodes[old].classList.remove("is-on");
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
      /* 触屏:点一下开、再点一下关(磁吸光标在触屏上本来就不启用)*/
      ball.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch") return;
        focus(onIndex === i ? -1 : i);
      });
    });

    /* 视差:鼠标在面板上动 → 写 --cam-x / --cam-y(只有 mousemove 才写,不占 rAF)*/
    root.addEventListener("pointermove", function (e) {
      if (!active || narrow || e.pointerType === "touch") return;
      var r = root.getBoundingClientRect();
      var nx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      var ny = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      root.style.setProperty("--cam-x", nx.toFixed(3));
      root.style.setProperty("--cam-y", ny.toFixed(3));
      if (onIndex >= 0) show(onIndex);        /* 星体动了,连线跟着重画 */
    });

    root.addEventListener("pointerleave", function () {
      root.style.setProperty("--cam-x", "0");
      root.style.setProperty("--cam-y", "0");
      focus(-1);
    });

    var raf = 0;
    function later() {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; place(); });
    }

    place();

    return {
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
          geo: geo.map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r)]; })
        };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
