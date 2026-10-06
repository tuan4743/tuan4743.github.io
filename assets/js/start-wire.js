(function () {
  "use strict";

  var eyeEl = document.getElementById("start-eye");
  if (!eyeEl) return;

  function boot() {
    if (!window.AsciiEye) return false;
    wire();
    return true;
  }

  function warn(msg) {
    try { console.error("[start] " + msg); } catch (e) { }
    var pre = document.getElementById("start-eye");
    if (!pre || !pre.parentNode) return;
    if (document.getElementById("start-boot-warn")) return;
    var p = document.createElement("p");
    p.id = "start-boot-warn";
    p.style.cssText = "margin:1.2em 0 0;font:12px/1.7 ui-monospace,Menlo,Consolas,monospace;"
      + "letter-spacing:.14em;color:rgba(255,255,255,.55);text-align:center";
    p.textContent = "// 视觉模块未就绪 —— " + msg;
    pre.parentNode.appendChild(p);
  }

  function bootstrap(tries) {
    if (boot()) return;
    if (tries <= 0) {
      var src = eyeEl.getAttribute("data-eye-src");
      if (!src) { warn("拿不到 ascii-eye.js 的地址"); return; }
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () { if (!boot()) warn("模块加载了但没挂上 window.AsciiEye"); };
      s.onerror = function () { warn("ascii-eye.js 取不到(" + src + ")"); };
      document.head.appendChild(s);
      setTimeout(function () { if (!boot()) warn("轮询超时"); }, 400);
      return;
    }
    setTimeout(function () { bootstrap(tries - 1); }, 60);
  }
  bootstrap(30);

function wire() {

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 顶部登入状态栏:每秒刷新一行"系统状态" ----
     按设定,启动页是方舟的登入系统:信号来自灰烬计划的中继网络,
     锚点状态说的是"你"(博客这个锚点)没按时纠错导致身份漂移。
     只陈述状态,不说话 —— 那一屏的台词只有"你好?"一句。 */
  function startBar() {
    var signal = document.getElementById("bar-signal");
    var anchorEl = document.getElementById("bar-anchor");
    var clock = document.getElementById("bar-clock");
    if (!clock || !signal || !anchorEl) return;
    var t0 = Date.now();
    var LEVELS = ["▁▂▃", "▁▂▄", "▂▃▅", "▃▄▆", "▄▅▇"];
    var STATUSES = [
      { text: "ANCHOR: 漂移", warn: true },
      { text: "ANCHOR: 待修正", warn: true },
      { text: "ANCHOR: 纠错逾期", warn: true }
    ];
    setInterval(function () {
      signal.textContent = "RELAY SIGNAL: " + LEVELS[(Math.random() * LEVELS.length) | 0];
      var st = STATUSES[(Math.random() * STATUSES.length) | 0];
      anchorEl.textContent = st.text;
      anchorEl.classList.toggle("is-warn", !!st.warn);
      var e = Math.floor((Date.now() - t0) / 1000);
      var hh = String(Math.floor(e / 3600)).padStart(2, "0");
      var mm = String(Math.floor((e % 3600) / 60)).padStart(2, "0");
      var ss = String(e % 60).padStart(2, "0");
      clock.textContent = "T+" + hh + ":" + mm + ":" + ss;
    }, 1000);
  }
  startBar();

  var api = null;
  var HOLD_MS = 900;
  var going = false, holdAt = 0, holdEl = null, holdT = 0;

  function onOpened() {
    var say = document.querySelector(".start-say");
    var act = document.querySelector(".start-act");
    setTimeout(function () { if (say) say.classList.add("is-in"); }, reduced ? 0 : 260);
    setTimeout(function () { if (act) act.classList.add("is-in"); }, reduced ? 0 : 1150);
  }

  api = window.AsciiEye.create(eyeEl, {
    flow: document.getElementById("start-flow"),
    openOnStart: true,
    reduced: reduced,
    onOpened: onOpened
  });
  window.__startEyeApi = api;

  api.start(true);

  function holdLoop(now) {
    if (!holdEl) return;
    requestAnimationFrame(holdLoop);
    holdT = now - holdAt;
    var ph = Math.min(1, holdT / HOLD_MS);
    holdEl.style.setProperty("--hold", ph.toFixed(3));
    if (ph >= 1) { holdEl.style.setProperty("--hold", 1); finish(holdEl); }
  }

  function finish(a) {
    if (going) return;
    going = true;
    var done = holdEl;
    holdEl = null;
    api.glitch(false);
    document.body.classList.add("is-leaving");
    var href = a.getAttribute("href");
    if (reduced) { window.location.href = href; return; }
    api.close(function () { setTimeout(function () { window.location.href = href; }, 260); });
    setTimeout(function () { window.location.href = href; }, api.T_CLOSE + 1600);
    if (done) done.style.setProperty("--hold", 1);
  }

  function startHold(a) {
    if (going) return;
    holdEl = a; holdAt = performance.now(); holdT = 0;
    a.classList.add("is-holding");
    if (a.getAttribute("data-start-go") === "who") api.glitch(true);
    requestAnimationFrame(holdLoop);
  }

  function cancelHold() {
    if (holdEl) { holdEl.style.setProperty("--hold", 0); holdEl.classList.remove("is-holding"); }
    holdEl = null;
    api.glitch(false);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("[data-start-go]") : null;
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  /* ★ 手机长按的最后一道保险:选项上压掉系统右键/呼出菜单
     (Android Chrome 长按即使无可选文本也可能弹链接触摸菜单)。 */
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest("[data-start-go]")) e.preventDefault();
  });

  document.addEventListener("pointerdown", function (e) {
    var a = e.target.closest ? e.target.closest("[data-start-go]") : null;
    if (!a || going) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    /* ★ 手机:压掉长按手势链(系统选择菜单/放大镜),否则 900ms 按住
       会被浏览器组件栏抢走,选项永远按不满。配合页面上的
       touch-action / -webkit-touch-callout / user-select 三重 CSS 压制。 */
    if (a.setPointerCapture) { try { a.setPointerCapture(e.pointerId); } catch (err) { } }
    startHold(a);
  });
  ["pointerup", "pointercancel", "pointerleave", "blur"].forEach(function (ev) {
    window.addEventListener(ev, cancelHold, { passive: true });
  });
  document.addEventListener("keydown", function (e) {
    var a = e.target.closest ? e.target.closest("[data-start-go]") : null;
    if (!a || e.repeat || holdEl || going) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startHold(a); }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key === "Enter" || e.key === " ") cancelHold();
  });

  window.__startWire = function () {
    return {
      hold: holdEl ? holdT : -1,
      going: going,
      reduced: reduced,
      eye: api ? api.state() : null
    };
  };
}

})();
