/* ============================================================
   磁力光标 v2:四角选择框(平滑跟随 + 速度倾斜)+ 中心实点
   思路参考 JIEJOE'S WEB Tutorial 的 018-magnetic-pointer(MIT License,
   Copyright (c) 2026 JIEJOE'S WEB Tutorial),按本站设计重写实现。

   - 框体:向鼠标位置平滑收敛(帧率无关),并按横向速度轻微倾斜 → 丝滑感
   - 中心小点:严格贴在鼠标真实坐标(不平滑),磁吸锁定目标时隐藏 →
     既保证点击精准,又让"系统光标被隐藏"没有隐患
   - 触屏设备 / 系统"减少动效"时自动不启用
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(pointer: coarse)").matches) return;   /* 触屏不启用 */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 可调参数 ---------- */
  var SMOOTH = 0.22;      /* 框体跟随平滑度(0~1,越小越"拖") */
  var MAGNET = 0.12;      /* 磁吸强度(0=完全吸附目标中心,1=完全跟手) */
  var PAD = 10;           /* 包住目标时的外扩(px) */
  var ROT_MAX = 7;        /* 速度倾斜最大角度(度),0 = 不倾斜 */
  var VEL_DIV = 5200;     /* 速度→角度换算除数(越大越不敏感) */

  var SELECTOR = [
    "[data-magnetic]",
    ".menu a",
    ".nav-right a",
    ".side-item",
    ".side-search",
    ".glass-btn",
    ".repo-card",
    ".post-entry",
    ".slot-toggle",
    ".rack-close",
    ".theme-toggle",
    ".palette-swatch",
    ".search-result-item",
    ".post-row",
    "button"
  ].join(",");

  /* ---------- DOM ---------- */
  var frame = document.createElement("div");
  frame.className = "magnetic-cursor";
  frame.innerHTML = "<i></i><i></i><i></i><i></i>";
  document.body.appendChild(frame);

  var dot = document.createElement("div");
  dot.className = "magnetic-dot";
  document.body.appendChild(dot);

  var target = null;
  var mx = -999, my = -999;      /* 鼠标真实坐标(小点用,严格贴手) */
  var fx = -999, fy = -999;      /* 框体坐标(平滑) */
  var rot = 0;                   /* 当前倾斜角 */
  var last = 0;
  var raf = 0;
  var visible = false;

  function paintDot() {
    dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.08, (now - last) / 1000) || 0.016;
    last = now;

    /* 目标点:磁吸时贴向目标中心 */
    var tx = mx, ty = my;
    if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      tx = cx + (mx - cx) * MAGNET;
      ty = cy + (my - cy) * MAGNET;
    }

    /* 平滑收敛(帧率无关) */
    var k = 1 - Math.pow(1 - SMOOTH, dt * 60);
    var px = fx, py = fy;
    fx += (tx - fx) * k;
    fy += (ty - fy) * k;

    /* 速度倾斜:横向移动越快,框体越倾斜;锁定目标时归正 */
    var vx = (fx - px) / dt;
    var rotTarget = 0;
    if (!target && ROT_MAX > 0 && !reduced) {
      rotTarget = Math.max(-ROT_MAX, Math.min(ROT_MAX, -vx / VEL_DIV));
    }
    rot += (rotTarget - rot) * 0.12;

    frame.style.transform =
      "translate3d(" + fx.toFixed(1) + "px," + fy.toFixed(1) + "px,0) rotate(" + rot.toFixed(2) + "deg)";
  }

  function setVisible(on) {
    if (on === visible) return;
    visible = on;
    frame.classList.toggle("is-visible", on);
    dot.classList.toggle("is-visible", on);
  }

  /* ---------- 事件 ---------- */
  window.addEventListener(
    "mousemove",
    function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (fx < -900) { fx = mx; fy = my; }   /* 首次进入不做飞入动画 */
      paintDot();                             /* 小点:立即到位,不平滑 */
      setVisible(true);
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true }
  );

  document.addEventListener(
    "mouseover",
    function (e) {
      var t = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!t || t === target) return;
      target = t;
      var r = t.getBoundingClientRect();
      frame.style.setProperty("--mc-w", Math.round(r.width + PAD * 2) + "px");
      frame.style.setProperty("--mc-h", Math.round(r.height + PAD * 2) + "px");
      frame.classList.add("is-locked");
      document.documentElement.classList.add("magnetic-locked");   /* 小点隐藏 */
    },
    true
  );

  document.addEventListener(
    "mouseout",
    function (e) {
      if (!target) return;
      var to = e.relatedTarget;
      if (to && target.contains(to)) return;
      target = null;
      frame.style.removeProperty("--mc-w");
      frame.style.removeProperty("--mc-h");
      frame.classList.remove("is-locked");
      document.documentElement.classList.remove("magnetic-locked");
    },
    true
  );

  window.addEventListener("mouseleave", function () {
    setVisible(false);
  });

  document.documentElement.classList.add("magnetic-on");
  if (reduced) document.documentElement.classList.add("magnetic-reduced");
  raf = requestAnimationFrame(tick);
})();
