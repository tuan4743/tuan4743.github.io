/* ============================================================
   第二张盘「成长」的主页内容:太空站视角(贴图版 + 视频恒星)
   ─────────────────────────────────────────────────────────────
   素材:static/planet/ —— 宇宙背景 / 蓝巨星(可换成 mp4 视频)/ 五颗行星
   数据:hugo.toml:[params.intro.solar](背景+恒星)+ [[params.intro.decks.growth]]
        x / y = 星体中心  w = 宽度占面板宽的比例  rot = 贴图旋转
        depth = 纵深(越小越远):决定它随摄像机怎么动、透视缩放多少
   微调面板:Alt+T(或 ?tune)
   ─────────────────────────────────────────────────────────────
   摄像机(拖动 = 转动视角,不是平移):
     · 横向拖 → 绕竖直轴 yaw 旋转;纵向拖 → pitch
       → 离画面中心越远的东西转得越多,近的还会跟着放大/缩小(透视),
         所以看起来是绕着场景转,而不是整块平移
     · 限位:--cam-yaw / --cam-pitch(弧度)
     · 阻尼:--cam-tau(ms);松手【停在原地】,不回中
     · 太阳 depth 默认 0.02 → 转视角时它只轻微动一点点,不再像贴死的图
     · 鼠标移动不再驱动视角(已去掉)
   光子特效:
     · 独立 canvas ~70 个光子随机明灭(淡入→淡出→换地方再来),
       跟随摄像机做远景视差;只在选中这张盘时跑
   ============================================================ */
(function () {
  "use strict";

  var NARROW = 780;
  var GAP = 16;
  var CLICK_TOL = 6;
  var ORBIT = 0.00095;     /* 每像素拖动 = 多少弧度(约 0.054°/px)*/
  var PITCH_K = 0.45;      /* 纵向拖动 → pitch 的比例 */
  var BASE = 0.30;         /* 运动系数=1 时的最大横向位移(面板宽的比例)*/
  var BASY = 0.22;         /* 纵向同理(面板高的比例)*/
  var SCALE_K = 0.95;      /* 旋转感:离画面中心越远,缩放变化越大 */
  /* 运动系数:太阳 depth 0.02 → 0.066(只轻微动);行星 depth 3 → 0.96 */
  function motion(d) { return 0.06 + 0.30 * (isFinite(d) ? d : 0.7); }
  var PHOTONS = 70;        /* 背景光子数量 */

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
    var sunVideo = root.querySelector(".solar-sun-video");
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var balls = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var imgs = nodes.map(function (n) { return n.querySelector(".solar-tex"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    var TUNE = window.__solarTune || (window.__solarTune = {});
    function cfgOf(node) {
      var id = node.getAttribute("data-code") || "";
      var base = {
        x: attrNum(node, "data-x", 0.5), y: attrNum(node, "data-y", 0.5),
        w: attrNum(node, "data-w", 0.12), rot: attrNum(node, "data-rot", 0),
        depth: attrNum(node, "data-depth", 0.7)
      };
      var t = TUNE[id];
      if (t) for (var k in t) if (isFinite(t[k])) base[k] = t[k];
      return base;
    }

    var active = false, onIndex = -1, geo = [], narrow = false, sunCfg = null;

    /* ---------------- 摄像机状态 ---------------- */
    var cam = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: false, px: 0, py: 0, bx: 0, by: 0, moved: 0, dx: 0, dy: 0 };
    var camRaf = 0, camLast = 0;
    var yawMax = 0.16, pitchMax = 0.10, camTau = 110;

    /* 投影:静止时精确等于原构图(dx=dy=0, s=1)*/
    function project(g, W, H) {
      var bx = g.x - W * 0.5, by = g.y - H * 0.5;
      var sx = Math.sin(cam.yaw), sy = Math.sin(cam.pitch);
      var m = motion(g.depth);
      var dx = -sx * BASE * W * m;
      var dy = -sy * BASY * H * m;
      /* 透视:离画面中心越远,缩放变化越大 → 转视角时整体像在绕着一个点转 */
      var s = 1 + (bx / W) * sx * SCALE_K + (by / H) * sy * SCALE_K * 0.6;
      return { dx: dx, dy: dy, s: Math.max(0.5, Math.min(2, s)) };
    }

    function applyCam() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2) return;
      var i, p;
      /* 画面中心的位移(给背景层当作远景平移量)*/
      p = project({ x: W * 0.5, y: H * 0.5, depth: 0.06 }, W, H);
      cam.dx = p.dx; cam.dy = p.dy;
      root.style.setProperty("--cam-x", p.dx.toFixed(2) + "px");
      root.style.setProperty("--cam-y", p.dy.toFixed(2) + "px");
      if (sun && geo.sun) {
        p = project(geo.sun, W, H);
        sun.style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
        sun.style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
        sun.style.setProperty("--cam-s", p.s.toFixed(4));
      }
      for (i = 0; i < nodes.length; i++) {
        if (!geo[i]) continue;
        p = project(geo[i], W, H);
        geo[i].dx = p.dx; geo[i].dy = p.dy; geo[i].s = p.s;
        nodes[i].style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-s", p.s.toFixed(4));
      }
      if (onIndex >= 0) show(onIndex);
    }
    function camFrame(now) {
      camRaf = 0;
      var dt = Math.min(64, Math.max(1, now - camLast));
      camLast = now;
      var a = 1 - Math.exp(-dt / camTau);
      var dy = cam.yawT - cam.yaw, dp = cam.pitchT - cam.pitch;
      if (Math.abs(dy) < 1e-5 && Math.abs(dp) < 1e-5) { cam.yaw = cam.yawT; cam.pitch = cam.pitchT; }
      else { cam.yaw += dy * a; cam.pitch += dp * a; }
      applyCam();
      if (cam.yaw !== cam.yawT || cam.pitch !== cam.pitchT) camRaf = requestAnimationFrame(camFrame);
    }
    function kickCam() { if (!camRaf && active) { camLast = performance.now(); camRaf = requestAnimationFrame(camFrame); } }
    function stopCam() { if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; } }

    /* ---------------- 背景光子 ---------------- */
    var phCv = null, phCtx = null, phSprite = null, ph = [], phRaf = 0, phLast = 0;
    function newPhoton(rand) {
      return {
        x: Math.random(), y: Math.random(),
        r: 1.2 + Math.random() * 5.5,
        depth: 0.06 + Math.random() * 0.4,
        dur: 1600 + Math.random() * 2600,
        t: rand ? -Math.random() * 2600 : -Math.random() * 500,
        drift: (Math.random() - 0.5) * 0.00004
      };
    }
    function photonInit() {
      phCv = document.createElement("canvas");
      phCv.className = "solar-photons";
      phCv.setAttribute("aria-hidden", "true");
      root.insertBefore(phCv, root.firstChild.nextSibling);
      phCtx = phCv.getContext("2d");
      var R = 32;                                  /* 预渲染一颗光子,之后只 drawImage */
      phSprite = document.createElement("canvas");
      phSprite.width = phSprite.height = R * 2;
      var g = phSprite.getContext("2d");
      var grd = g.createRadialGradient(R, R, 0, R, R, R);
      grd.addColorStop(0, "rgba(216, 242, 255, 1)");
      grd.addColorStop(0.35, "rgba(170, 220, 255, 0.5)");
      grd.addColorStop(1, "rgba(140, 200, 255, 0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(R, R, R, 0, Math.PI * 2);
      g.fill();
      for (var i = 0; i < PHOTONS; i++) ph.push(newPhoton(true));
    }
    function photonFrame(now) {
      phRaf = 0;
      if (!active || narrow || !phCtx) return;
      var dt = phLast ? Math.min(80, now - phLast) : 16;
      phLast = now;
      var W = root.clientWidth, H = root.clientHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (phCv.width !== Math.round(W * dpr) || phCv.height !== Math.round(H * dpr)) {
        phCv.width = Math.round(W * dpr);
        phCv.height = Math.round(H * dpr);
      }
      phCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      phCtx.clearRect(0, 0, W, H);
      phCtx.globalCompositeOperation = "lighter";
      for (var i = 0; i < ph.length; i++) {
        var p = ph[i];
        p.t += dt;
        if (p.t > p.dur) { ph[i] = newPhoton(false); p = ph[i]; }
        if (p.t < 0) continue;
        var a = Math.sin(Math.PI * (p.t / p.dur));      /* 淡入 → 淡出 */
        if (a <= 0.01) continue;
        var px = (p.x + p.drift * p.t) * W + cam.dx * p.depth;
        var py = p.y * H + cam.dy * p.depth;
        var rr = p.r * (1 + 0.25 * Math.sin(p.t / 700 + i));
        phCtx.globalAlpha = Math.min(1, a * 0.85);
        phCtx.drawImage(phSprite, px - rr * 2, py - rr * 2, rr * 4, rr * 4);
      }
      phCtx.globalAlpha = 1;
      phCtx.globalCompositeOperation = "source-over";
      phRaf = requestAnimationFrame(photonFrame);
    }
    function photonStart() {
      if (narrow) return;
      if (!phCv) photonInit();
      if (!phRaf) { phLast = 0; phRaf = requestAnimationFrame(photonFrame); }
    }
    function photonStop() { if (phRaf) { cancelAnimationFrame(phRaf); phRaf = 0; } }

    /* ---------------- 位置计算 ---------------- */
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;
      yawMax = cssNum(root, "--cam-yaw", 0.16, 0, 1);
      pitchMax = cssNum(root, "--cam-pitch", 0.10, 0, 1);
      camTau = cssNum(root, "--cam-tau", 110, 10, 900);

      sunCfg = {
        x: attrNum(sun, "data-x", 0.19), y: attrNum(sun, "data-y", 0.34),
        w: attrNum(sun, "data-w", 0.26), depth: attrNum(sun, "data-depth", 0.02)
      };
      var st = TUNE.__sun;
      if (st) for (var k in st) if (isFinite(st[k])) sunCfg[k] = st[k];
      if (sun) {
        sun.style.left = (sunCfg.x * W).toFixed(1) + "px";
        sun.style.top = (sunCfg.y * H).toFixed(1) + "px";
      }
      root.style.setProperty("--sun-w", (sunCfg.w * W).toFixed(1) + "px");
      geo.sun = { x: sunCfg.x * W, y: sunCfg.y * H, depth: sunCfg.depth, r: sunCfg.w * W / 2, rh: sunCfg.w * W / 2 };

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var c = cfgOf(n);
        var w = Math.max(8, c.w * W);
        n.style.left = (c.x * W).toFixed(1) + "px";
        n.style.top = (c.y * H).toFixed(1) + "px";
        n.style.setProperty("--w", w.toFixed(1) + "px");
        var rot = c.rot ? "rotate(" + c.rot + "deg)" : "";
        if (imgs[i]) imgs[i].style.transform = rot;
        if (balls[i]) balls[i].style.transform = rot;
        var r = balls[i] ? balls[i].getBoundingClientRect() : null;
        geo[i] = {
          x: c.x * W, y: c.y * H, depth: c.depth,
          r: r ? r.width / 2 : w / 2, rh: r ? r.height / 2 : w / 2
        };
      }
      applyCam();
    }

    /* ---------------- HUD 卡片 ---------------- */
    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      var W = root.clientWidth, H = root.clientHeight;
      var pad = cssNum(root, "--pad", 20, 0, 200);
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var R = Math.max(g.r, g.rh) * (g.s || 1);
      var cx = g.x + (g.dx || 0), cy = g.y + (g.dy || 0);
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
      if (!svg) return;
      var tx = lx + w / 2, ty = ly + h / 2;
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

    /* ---------------- 光标小字提示 ---------------- */
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

    /* ---------------- 事件 ---------------- */
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
      if (!active || narrow || e.button) return;
      cam.drag = true;
      cam.moved = 0;
      cam.px = e.clientX; cam.py = e.clientY;
      cam.bx = cam.yawT; cam.by = cam.pitchT;
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
        /* ★ 拖动 = 转视角:横向给 yaw、纵向给 pitch(抓住画面的手感,带限位)*/
        cam.yawT = clamp(cam.bx - dx * ORBIT, -yawMax, yawMax);
        cam.pitchT = clamp(cam.by - dy * ORBIT * PITCH_K, -pitchMax, pitchMax);
        kickCam();
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
    /* ★ 指针移出只收小字:视角停在原地,不回中、也不再有"跟随鼠标"的视差 */
    root.addEventListener("pointerleave", function () { hintOn(false); });

    imgs.forEach(function (im) {
      if (im && !im.complete) im.addEventListener("load", function () { if (active) place(); }, { once: true });
    });
    if (sunVideo) sunVideo.muted = true;      /* 保险:绝不出声 */

    return {
      root: root, nodes: nodes, cfgOf: cfgOf, place: place, sunNode: sun,
      key: key,
      activate: function (on) {
        active = on;
        if (on) {
          place();
          root.classList.remove("is-live");
          requestAnimationFrame(function () { if (active) root.classList.add("is-live"); });
          photonStart();
          if (sunVideo) { try { sunVideo.play(); } catch (e) {} }
        } else {
          root.classList.remove("is-live");
          root.classList.remove("is-drag");
          root.classList.remove("is-cursor");
          focus(-1);
          hintText("DRAG");
          cam.yaw = cam.yawT = 0; cam.pitch = cam.pitchT = 0; cam.drag = false;
          stopCam();
          applyCam();
          photonStop();
          if (sunVideo) { try { sunVideo.pause(); } catch (e) {} }
        }
      },
      repaint: function () { place(); if (active) photonStart(); },
      state: function () {
        return {
          key: key, active: active, narrow: narrow, bodies: geo.length, open: onIndex,
          cam: {
            yaw: +cam.yaw.toFixed(4), pitch: +cam.pitch.toFixed(4),
            yawT: +cam.yawT.toFixed(4), pitchT: +cam.pitchT.toFixed(4),
            drag: cam.drag, yawMax: yawMax, pitchMax: pitchMax,
            dx: +cam.dx.toFixed(1), dy: +cam.dy.toFixed(1)
          },
          photons: ph.length,
          sun: sunCfg,
          geo: geo.filter(Boolean).map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r * 2)]; })
        };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
