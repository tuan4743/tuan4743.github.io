/* ============================================================
   第二张盘「成长」的主页内容:太空站视角(贴图版)
   ─────────────────────────────────────────────────────────────
   素材:static/planet/ —— 宇宙背景 / 蓝巨星 / 五颗行星(已自动裁掉透明边距)
   数据:hugo.toml:[params.intro.solar](背景+恒星)+ [[params.intro.decks.growth]](五颗行星)
        x / y = 星体中心(面板宽高的比例) w = 宽度占面板宽的比例
        rot = 贴图旋转  depth = 纵深(视差与拖动时移动多少,越大越近)
   微调面板:Alt+T(或 ?tune)—— 滑条 + 数字框,能直接生成 TOML
   ─────────────────────────────────────────────────────────────
   摄像机:
     · 鼠标移动 → 轻微视差(近的动得多、远的动得少)
     · 按住拖动 → 整个视角平移,范围有限(--cam-max,默认面板尺寸的 6%),
       松手后停在原地;位移带阻尼(时间常数 --cam-tau,默认 110ms)
     · 光标旁小字提示:DRAG,按住时变 RELEASE
   ============================================================ */
(function () {
  "use strict";

  var NARROW = 780;      /* 小于这个宽度换成竖排列表 */
  var GAP = 16;          /* 星体边缘到卡片之间的空隙 */
  var PAR = 8;           /* 鼠标视差最大位移(px)*/
  var CLICK_TOL = 6;     /* 拖动超过这么多像素就不算点击(触屏用)*/

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function attrNum(el, name, dflt) {
    var v = parseFloat(el && el.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function cssNum(el, name, dflt, lo, hi) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isFinite(v) && v >= lo && v <= hi ? v : dflt;
  }
  function mk(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function build(root, key) {
    var sun = root.querySelector(".solar-node--star");
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var balls = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var imgs = nodes.map(function (n) { return n.querySelector(".solar-tex"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    var TUNE = window.__solarTune || (window.__solarTune = {});
    function cfgOf(node) {
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

    var active = false, onIndex = -1, geo = [], narrow = false, sunCfg = null;

    /* ---------- 摄像机状态 ---------- */
    var cam = { x: 0, y: 0, tx: 0, ty: 0, drag: false, px: 0, py: 0, bx: 0, by: 0, moved: 0 };
    var camRaf = 0, camLast = 0;
    var camMax = 0.06, camTau = 110;

    function maxX() { return camMax * root.clientWidth; }
    function maxY() { return camMax * root.clientHeight; }

    function applyCam() {
      root.style.setProperty("--cam-x", cam.x.toFixed(2) + "px");
      root.style.setProperty("--cam-y", cam.y.toFixed(2) + "px");
      if (onIndex >= 0) show(onIndex);          /* 星体动了,连线跟着重画 */
    }
    function camFrame(now) {
      camRaf = 0;
      var dt = Math.min(64, Math.max(1, now - camLast));
      camLast = now;
      var a = 1 - Math.exp(-dt / camTau);
      var dx = cam.tx - cam.x, dy = cam.ty - cam.y;
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) { cam.x = cam.tx; cam.y = cam.ty; }
      else { cam.x += dx * a; cam.y += dy * a; }
      applyCam();
      if (cam.x !== cam.tx || cam.y !== cam.ty) camRaf = requestAnimationFrame(camFrame);
    }
    function kickCam() { if (!camRaf && active) { camLast = performance.now(); camRaf = requestAnimationFrame(camFrame); } }
    function stopCam() { if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; } }

    /* ---------- 位置计算 ---------- */
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;
      camMax = cssNum(root, "--cam-max", 0.06, 0, 0.4);
      camTau = cssNum(root, "--cam-tau", 110, 10, 900);

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
      root.style.setProperty("--sun-w", (sunCfg.w * W).toFixed(1) + "px");

      geo = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var c = cfgOf(n);
        var w = Math.max(8, c.w * W);
        n.style.left = (c.x * W).toFixed(1) + "px";
        n.style.top = (c.y * H).toFixed(1) + "px";
        n.style.setProperty("--w", w.toFixed(1) + "px");
        n.style.setProperty("--depth", c.depth);
        var rot = c.rot ? "rotate(" + c.rot + "deg)" : "";
        if (imgs[i]) imgs[i].style.transform = rot;
        if (balls[i]) balls[i].style.transform = rot;
        var r = balls[i] ? balls[i].getBoundingClientRect() : null;
        geo.push({
          x: c.x * W, y: c.y * H, depth: c.depth,
          r: r ? r.width / 2 : w / 2, rh: r ? r.height / 2 : w / 2
        });
      }
      applyCam();
    }

    function outerR(i) {
      var g = geo[i];
      if (!g) return 0;
      return Math.max(g.r, g.rh);
    }

    /* ---------- HUD 卡片 ---------- */
    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      var W = root.clientWidth, H = root.clientHeight;
      var pad = cssNum(root, "--pad", 20, 0, 200);
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var R = outerR(i);
      var cx = g.x + cam.x * g.depth, cy = g.y + cam.y * g.depth;
      var sides = [
        { k: "right", v: W - (cx + R) - w },
        { k: "left", v: (cx - R) - w },
        { k: "above", v: (cy - R) - h },
        { k: "below", v: H - (cy + R) - h }
      ];
      sides.sort(function (a, b) { return b.v - a.v; });
      var lx, ly;
      switch (sides[0].k) {
        case "right": lx = cx + R + GAP; ly = cy - h / 2; break;
        case "left": lx = cx - R - GAP - w; ly = cy - h / 2; break;
        case "above": lx = cx - w / 2; ly = cy - R - GAP - h; break;
        default: lx = cx - w / 2; ly = cy + R + GAP;
      }
      lx = clamp(lx, pad, Math.max(pad, W - pad - w));
      ly = clamp(ly, pad, Math.max(pad, H - pad - h));
      card.style.transform = "translate3d(" + (lx - g.x).toFixed(1) + "px," + (ly - g.y).toFixed(1) + "px,0)";
      card.classList.add("is-on");
      drawLine(i, lx + w / 2, ly + h / 2, R, cx, cy);
    }

    function drawLine(i, tx, ty, R, cx, cy) {
      if (!svg) return;
      var W = root.clientWidth, H = root.clientHeight;
      var ax = tx - cx, ay = ty - cy;
      var len = Math.max(1, Math.hypot(ax, ay));
      var sx = cx + (ax / len) * (R + 2), sy = cy + (ay / len) * (R + 2);
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

    /* ---------- 光标旁的小字提示 ----------
       幂等:万一这个 root 被 build 两次(脚本重复加载之类),先把上一次留下的清掉 ——
       否则会存在两个 .solar-drag,取到的那个永远是 DRAG */
    var stale = root.querySelectorAll(".solar-drag");
    for (var si = 0; si < stale.length; si++) stale[si].remove();
    var hint = document.createElement("span");
    hint.className = "solar-drag";
    hint.textContent = "DRAG";
    root.appendChild(hint);
    function moveHint(e) {
      hint.style.transform = "translate3d(" + (e.clientX + 16) + "px," + (e.clientY + 16) + "px,0)";
    }
    function hintOn(on) { root.classList.toggle("is-cursor", !!on); }
    function hintText(t) { hint.textContent = t; }

    /* ---------- 事件 ---------- */
    nodes.forEach(function (n, i) {
      var ball = balls[i];
      if (!ball) return;
      ball.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch" || cam.drag) return;
        focus(i);
      });
      ball.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      ball.addEventListener("focus", function () { if (active) focus(i); });
      ball.addEventListener("blur", function () { if (active && onIndex === i) focus(-1); });
      ball.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch" || cam.moved > CLICK_TOL) return;
        focus(onIndex === i ? -1 : i);
      });
    });

    function onDown(e) {
      if (!active || narrow) return;
      if (e.button) return;                       /* 只认左键 / 触摸 */
      cam.drag = true;
      cam.moved = 0;
      cam.px = e.clientX; cam.py = e.clientY;
      cam.bx = cam.tx; cam.by = cam.ty;
      root.classList.add("is-drag");
      if (e.pointerType !== "touch") { hintText("RELEASE"); moveHint(e); hintOn(true); }
      focus(-1);
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!active) return;
      if (cam.drag) {
        var dx = e.clientX - cam.px, dy = e.clientY - cam.py;
        cam.moved += Math.abs(dx) + Math.abs(dy);
        cam.tx = clamp(cam.bx + dx * 1.1, -maxX(), maxX());
        cam.ty = clamp(cam.by + dy * 1.1, -maxY(), maxY());
        kickCam();
      } else if (!narrow && e.pointerType !== "touch") {
        /* 不按时:轻微视差(直接给值,省一次 rAF */
        var r = root.getBoundingClientRect();
        var nx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
        var ny = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
        cam.x = cam.tx = -nx * PAR;
        cam.y = cam.ty = -ny * PAR;
        stopCam();
        applyCam();
      }
      if (e.pointerType !== "touch") { moveHint(e); hintOn(true); }
    }
    function onUp(e) {
      if (!cam.drag) return;
      cam.drag = false;
      root.classList.remove("is-drag");
      hintText("DRAG");
      if (e && e.pointerType !== "touch") moveHint(e);
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("pointerleave", function () {
      hintOn(false);
      if (cam.drag) return;
      cam.x = cam.tx = 0;
      cam.y = cam.ty = 0;
      applyCam();
      focus(-1);
    });

    imgs.forEach(function (im) {
      if (im && !im.complete) im.addEventListener("load", function () { if (active) place(); }, { once: true });
    });

    return {
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
          root.classList.remove("is-drag");
          root.classList.remove("is-cursor");
          focus(-1);
          hintText("DRAG");
          cam.x = cam.tx = 0; cam.y = cam.ty = 0; cam.drag = false;
          stopCam();
          applyCam();
        }
      },
      repaint: function () { place(); },
      state: function () {
        return {
          key: key, active: active, narrow: narrow,
          bodies: geo.length, open: onIndex,
          cam: {
            x: +cam.x.toFixed(1), y: +cam.y.toFixed(1),
            tx: +cam.tx.toFixed(1), ty: +cam.ty.toFixed(1),
            drag: cam.drag, max: +maxX().toFixed(1)
          },
          sun: sunCfg,
          geo: geo.map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r * 2)]; })
        };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
