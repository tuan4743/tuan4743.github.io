/* ============================================================
   第二张盘「成长」的主页内容:科幻风太阳系行星图(.solar,样式见 pages.css)
   ─────────────────────────────────────────────────────────────
   布局(全部在 JS 里算,所以宽屏/窄屏/窗口大小变化都能自适应):
     · 恒星在最左,行星沿"黄道线"向右依次排开,距离越远 = 数字越大
     · 每颗行星画一圈属于它自己的椭圆轨道(以恒星为中心、压扁的透视感)
     · 每颗行星挂一张 HUD 卡片(标题 + 正文),上下交替,避免互相压住
     · 卡片与星体之间那条细线画在 SVG 里:从星体边缘起、到卡片边缘止,
       两端各带一个小节点 —— 就是"用细线连到星体边缘"这个 HUD 味道
   窄屏(W < 780):
     · 切换成时间线样式(.is-narrow):轨道线隐藏,一行一颗行星 + 卡片,可以上下滚
   动效:
     · 选中这张盘时给容器加 .is-live,行星按 --i 依次弹出、卡片依次淡入
       (纯 CSS transition + delay,不占 rAF)
   ============================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var NARROW = 780;      /* 小于这个宽度就换成时间线排版 */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(el, name, dflt, lo, hi) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isFinite(v) && v >= lo && v <= hi ? v : dflt;
  }
  function mk(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function build(root, key) {
    var svg = root.querySelector(".solar-svg");
    var starNode = root.querySelector(".solar-node--star");
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var planets = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var active = false, touching = false;

    /* ---------- 交互:鼠标 / 触屏指到哪颗,哪颗和它的卡片一起亮 ---------- */
    function focus(i) {
      for (var k = 0; k < nodes.length; k++) {
        nodes[k].classList.toggle("is-on", k === i);
        if (cards[k]) cards[k].classList.toggle("is-on", k === i);
      }
    }
    nodes.forEach(function (n, i) {
      n.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(i);
      });
      n.addEventListener("pointerdown", function () { touching = true; focus(i); });
      n.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
    });

    /* ---------- 排版 ---------- */
    var geo = [];
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      var narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (narrow) {
        /* 窄屏:把所有内联几何都清掉,交给 CSS 流式排(卡片变成时间线,可以上下滚)*/
        geo = [];
        if (svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
        root.style.removeProperty("--sr");
        [starNode].concat(nodes).forEach(function (n) {
          if (!n) return;
          n.style.removeProperty("left");
          n.style.removeProperty("top");
          n.style.removeProperty("--r");
          n.style.removeProperty("--cx");
        });
        planets.forEach(function (p) { if (p) { p.style.removeProperty("width"); p.style.removeProperty("height"); } });
        return;
      }

      var padX = clamp(W * 0.045, 20, 110);
      var cy = H * 0.53;
      var sr = clamp(H * 0.082, 22, 78);                       /* 恒星半径 */
      var rMax = clamp(H * 0.036, 11, 30);                     /* 最大行星半径 */
      var rMin = Math.max(5, rMax * 0.30);
      var sX = padX + sr;
      var n = nodes.length || 1;

      /* 行星沿黄道线排开:第一颗离恒星 sr + 一段间距,最后一颗留出右边距 */
      var gapFirst = clamp(W * 0.07, 54, 190);
      var x0 = sX + sr + gapFirst;
      var x1 = W - padX - clamp(W * 0.02, 16, 54);
      if (x1 < x0 + 40) x1 = x0 + 40;

      /* 恒星 */
      root.style.setProperty("--sr", sr.toFixed(1) + "px");
      starNode.style.left = sX.toFixed(1) + "px";
      starNode.style.top = cy.toFixed(1) + "px";

      var parts = [];
      geo = [];
      for (var i = 0; i < nodes.length; i++) {
        var t = n > 1 ? i / (n - 1) : 0.5;
        var x = x0 + (x1 - x0) * t;
        var sz = num(planets[i], "--size", t, 0, 1);
        var r = rMin + (rMax - rMin) * sz;
        var up = i % 2 === 0;                                   /* 卡片上下交替 */
        var off = (up ? 1 : -1) * clamp(W * 0.024, 16, 42);      /* 卡片再横向偏一点 → 连线成折线 */

        nodes[i].style.left = x.toFixed(1) + "px";
        nodes[i].style.top = cy.toFixed(1) + "px";
        nodes[i].style.setProperty("--r", r.toFixed(1) + "px");
        nodes[i].classList.toggle("is-up", up);          /* 卡片在上 / 在下(CSS 用它定位)*/
        nodes[i].classList.toggle("is-down", !up);
        planets[i].style.width = planets[i].style.height = (r * 2).toFixed(1) + "px";
        var cxCard = placeCard(nodes[i], cards[i], x + off, W, padX);

        /* 轨道:以恒星为中心、压扁的椭圆(只要右半边,不然整屏都是圈)*/
        var rx = x - sX, ry = rx * 0.30;
        parts.push(mk("ellipse", {
          cx: sX.toFixed(1), cy: cy.toFixed(1), rx: rx.toFixed(1), ry: ry.toFixed(1),
          "class": "solar-orbit"
        }));
        /* 连线:星体边缘 →(斜线)→ 拐点 →(横线)→ 卡片边缘,HUD 那种两段折线 */
        var yA = up ? cy - r : cy + r;
        var yB = up ? cy - r - 24 : cy + r + 24;
        var kneeX = x + (cxCard - x) * 0.45;
        parts.push(mk("path", {
          d: "M" + x.toFixed(1) + " " + yA.toFixed(1) +
            " L" + kneeX.toFixed(1) + " " + yB.toFixed(1) +
            " L" + cxCard.toFixed(1) + " " + yB.toFixed(1),
          "class": "solar-lead"
        }));
        parts.push(mk("circle", { cx: x.toFixed(1), cy: yA.toFixed(1), r: 2, "class": "solar-node-dot" }));
        parts.push(mk("circle", { cx: cxCard.toFixed(1), cy: yB.toFixed(1), r: 1.6, "class": "solar-node-dot is-end" }));
        geo.push({ x: x, r: r });
      }

      if (svg) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        /* 黄道线:恒星 → 最右 */
        parts.unshift(mk("path", {
          d: "M" + (sX + sr).toFixed(1) + " " + cy.toFixed(1) + " H" + (W - padX * 0.4).toFixed(1),
          "class": "solar-ecliptic"
        }));
        /* 轨道画在行星下面,连线画在上面 */
        parts.forEach(function (p) {
          if (p.getAttribute("class") !== "solar-lead" && !/node-dot/.test(p.getAttribute("class"))) svg.appendChild(p);
        });
        parts.forEach(function (p) {
          if (p.getAttribute("class") === "solar-lead" || /node-dot/.test(p.getAttribute("class"))) svg.appendChild(p);
        });
      }
    }

    /* 卡片挂在行星旁边(想让它中心落在 wantX);靠边的行星把卡片往回收,别顶出屏幕。
       返回卡片真实中心 x —— 折线要用它算拐点 */
    function placeCard(node, card, wantX, W, padX) {
      var cw = card ? (card.offsetWidth || 200) : 200;
      var half = cw / 2;
      var cx = clamp(wantX, padX + half, W - padX - half);
      if (node) node.style.setProperty("--cx", (cx - parseFloat(node.style.left || "0")).toFixed(1) + "px");
      return cx;
    }

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
          place();                                   /* 显示出来才量得到尺寸 */
          root.classList.remove("is-live");
          /* 下一帧再加 is-live:让"依次弹出"的动画每次进来都重播 */
          requestAnimationFrame(function () { if (active) root.classList.add("is-live"); });
        } else {
          root.classList.remove("is-live");
          focus(-1);
          touching = false;
        }
      },
      repaint: function () { place(); },
      state: function () {
        return { key: key, active: active, narrow: root.classList.contains("is-narrow"), planets: geo.length };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
