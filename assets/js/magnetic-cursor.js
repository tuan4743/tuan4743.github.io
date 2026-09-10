/* ============================================================
   磁力光标(四角选择框 + 磁吸)
   思路参考 JIEJOE'S WEB Tutorial 的 018-magnetic-pointer(MIT License,
   Copyright (c) 2026 JIEJOE'S WEB Tutorial),按本站设计重写实现。
   - 悬停到可交互元素时,框体变形包住该元素,并带磁力吸附
   - 触屏设备 / 系统"减少动效"时自动不启用
   ============================================================ */
(function () {
  "use strict";

  /* 触屏设备不启用(没有 hover 概念) */
  if (window.matchMedia("(pointer: coarse)").matches) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 生效目标:显式标记 [data-magnetic] 或这些交互元素 */
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

  var BASE = 34;          /* 默认框体尺寸(px) */
  var PAD = 10;           /* 包住目标时外扩(px) */
  var MAGNET = 0.12;      /* 磁吸强度:0 = 完全吸附,1 = 完全跟手 */

  var el = document.createElement("div");
  el.className = "magnetic-cursor";
  el.innerHTML = "<i></i><i></i><i></i><i></i>";
  document.body.appendChild(el);

  var target = null;
  var x = -999, y = -999;
  var raf = 0;

  function paint() {
    raf = 0;
    var px = x, py = y;
    if (target) {
      var r = target.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      px = cx + (x - cx) * MAGNET;
      py = cy + (y - cy) * MAGNET;
    }
    el.style.transform = "translate3d(" + px + "px," + py + "px,0)";
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  window.addEventListener(
    "mousemove",
    function (e) {
      x = e.clientX;
      y = e.clientY;
      el.classList.add("is-visible");
      schedule();
    },
    { passive: true }
  );

  /* 事件委托:动态出现的元素也能生效 */
  document.addEventListener(
    "mouseover",
    function (e) {
      var t = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
      if (!t || t === target) return;
      target = t;
      var r = t.getBoundingClientRect();
      el.style.setProperty("--mc-w", Math.round(r.width + PAD * 2) + "px");
      el.style.setProperty("--mc-h", Math.round(r.height + PAD * 2) + "px");
      el.classList.add("is-locked");
      schedule();
    },
    true
  );

  document.addEventListener(
    "mouseout",
    function (e) {
      if (!target) return;
      var to = e.relatedTarget;
      if (to && target.contains(to)) return;      /* 仍在目标内部 */
      target = null;
      el.style.removeProperty("--mc-w");
      el.style.removeProperty("--mc-h");
      el.classList.remove("is-locked");
      schedule();
    },
    true
  );

  window.addEventListener("mouseleave", function () {
    el.classList.remove("is-visible");
  });

  /* 初始化成功后才隐藏系统光标(JS 失效时系统光标仍在) */
  document.documentElement.classList.add("magnetic-on");
  if (reduced) document.documentElement.classList.add("magnetic-reduced");
})();
