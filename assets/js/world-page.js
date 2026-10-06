/* ============================================================
   world-page.js — /world/ 档案页环境响应
   ─────────────────────────────────────────────────────────────
   两件事,都是对"读者已经在做的事"的回应:

   1. 滚动读到关键结构(著录行 / 表格 / 结尾校订注)时,
      右侧 HUD 面板扫过一道光(--hud-glow 0→0.4→0,1.2s)。
      --hud-glow 原是纯静态变量(page-hud.css),此处是唯一
      运行时驱动;亮色模式 shell.css 已强制 0,天然不冲突。
   2. 滚到底(校订注完全可见)→ ECHO 一次性低语(每页每会话
      一次)。走 window.__echo.show(无冷却、不占 poke 计数),
      与 hud-echo.js 自身的 say 冷却互不干扰。

   reduced-motion:不做脉冲(glow 恒 0),台词保留(非动效)。
   非 /world/ 页面:全部静默退出。
   ============================================================ */
(function () {
  "use strict";

  if (!/^\/world\/[^/]+\/$/.test(location.pathname)) return;

  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var hud = document.getElementById("page-hud");

  /* ---------- glow 脉冲:读到关键结构,面板回一道光 ---------- */
  var glowT = 0;
  var glowing = false;
  function pulse() {
    if (reduced || !hud) return;
    glowing = true;
    glowT = performance.now();
    (function step(now) {
      if (!glowing) return;
      var p = (now - glowT) / 1200;
      if (p >= 1) { hud.style.setProperty("--hud-glow", "0"); glowing = false; return; }
      /* 正弦包络:0→0.4→0 */
      hud.style.setProperty("--hud-glow", (Math.sin(p * Math.PI) * 0.4).toFixed(3));
      requestAnimationFrame(step);
    })(performance.now());
  }

  /* ---------- 关键结构进入视口 → 脉冲一次(每个元素只一次) ---------- */
  function wireGlow() {
    if (reduced || !("IntersectionObserver" in window) || !hud) return;
    var targets = document.querySelectorAll(
      ".post-content > blockquote:first-child, .post-content table, .post-content > hr + p"
    );
    if (!targets.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          pulse();
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ---------- 滚到底 → ECHO 低语(每页每会话一次) ---------- */
  var DONE_LINES = [
    "看完了。这份的校订注你也读了。",
    "……完整性栏你没跳过。少见。",
    "看完就翻下一份吧,我记着你看到哪了。"
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function doneOnce() {
    var k = "wp-done:" + location.pathname;
    var seen = false;
    try { seen = sessionStorage.getItem(k) === "1"; } catch (e) { }
    if (seen) return;
    try { sessionStorage.setItem(k, "1"); } catch (e) { }
    if (window.__echo && window.__echo.show) window.__echo.show(pick(DONE_LINES));
  }
  function wireDone() {
    var last = document.querySelector(".post-content > hr:last-of-type + p") ||
      document.querySelector(".post-content > p:last-of-type");
    if (!last) return;
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { doneOnce(); io.disconnect(); }
      });
    }, { threshold: 0.9 });
    io.observe(last);
  }

  function boot() { wireGlow(); wireDone(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
