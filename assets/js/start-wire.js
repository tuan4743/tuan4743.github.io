/* ============================================================
   启动页接线:眼睛出场 → "你好?" → 两个选项 → 按住确认
   ─────────────────────────────────────────────────────────────
   · 眼睛本身在 assets/js/ascii-eye.js(逐帧几何、瞳孔、数据流);
   · 这里只管【时间线】和【交互】:
       一线 → 抖动 → 猛地睁开 → 260ms 后"你好?" → 再 890ms 两个选项
   · 两个选项都要按住 900ms,底边那条线是进度,松手弹回 0;
     "你是谁?"按住期间眼睛【错乱】(乱码/错位/闪红)= 它在初始化;
     "别废话"不初始化 —— 认识这东西的人不需要它自我介绍。
   · 键盘(Enter/Space)走同一套:keydown 开始、keyup 结束。
   · 跳转要等【眼睛真的闭上】(api.close 的回调),不是只看定时器。

   ★★★ 为什么这段代码【必须是一个外部 js 文件】,不能写回模板的内联 <script>:
      内联的经典脚本在执行时文档还在解析中,而 ascii-eye.js 是 defer 的 ——
      defer 的脚本要等解析完才跑。所以内联脚本里 window.AsciiEye 一定是
      undefined,那句守卫 `if (!window.AsciiEye) return` 会【静默退出】:
      没有异常、没有日志,页面上就是一双不动的眼睛(实测踩过)。
      ⇒ 外部脚本 + defer:Hugo 会按【文档顺序】把两个 defer 脚本排队,
        ascii-eye.js 在前,这一份在后,执行时 window.AsciiEye 必定已就绪。
   ★★ 另一个坑(同一个症状的第二种成因,已经处理掉了):
      原来内联脚本里用 `var pre` 收元素、`var REDUCED` 收媒体查询,
      Hugo 的 JS 压缩器会把这两个局部变量压成【同一个名字】,
      于是 create() 拿到一个布尔值 —— 也是"什么都不发生"。
      现在 hugo.toml 里 [minify] disableJS = true 关掉了内联脚本压缩。
   ============================================================ */
(function () {
  "use strict";

  var eyeEl = document.getElementById("start-eye");
  if (!eyeEl || !window.AsciiEye) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ★★★ 这一行【必须有】:create() 只是把眼睛造出来并接到宿主上,
     真正开始播出场(一线 → 抖动 → 猛地睁开)是 start(true)。
     少了它:没有异常、没有日志,页面上就是一双不动的空眼睛 ——
     我从内联脚本搬过来时漏掉了它,症状和"变量被压缩器合并"一模一样,
     所以两条注释都留在文件头了,别再删。 */
  api.start(true);

  /* 按住进度:写 --hold 给 CSS 那条底线。眼睛不参与 -> 用 rAF 单独跑,
     这样"按住"这件事跟眼睛的渲染循环解耦(眼睛停了也还能读条)。 */
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
    /* 眼睛缓缓闭合,闭完再多给一拍(让人看清那条线)才换页 */
    api.close(function () { setTimeout(function () { window.location.href = href; }, 260); });
    /* ★ 兜底:万一渲染循环没跑起来(标签页被挂起等),T_CLOSE+1600ms 强制走,
       否则用户会卡在启动页出不去。 */
    setTimeout(function () { window.location.href = href; }, api.T_CLOSE + 1600);
    if (done) done.style.setProperty("--hold", 1);
  }

  function startHold(a) {
    if (going) return;
    holdEl = a; holdAt = performance.now(); holdT = 0;
    a.classList.add("is-holding");
    /* 只有"你是谁?"会触发初始化错乱 */
    if (a.getAttribute("data-start-go") === "who") api.glitch(true);
    requestAnimationFrame(holdLoop);
  }

  function cancelHold() {
    if (holdEl) { holdEl.style.setProperty("--hold", 0); holdEl.classList.remove("is-holding"); }
    holdEl = null;
    api.glitch(false);
  }

  /* ★★ 必须拦住这两个链接的【默认跳转】:
     光在 pointerdown 上 preventDefault 不够 —— 浏览器在 pointerup 之后
     还会补一个 click,而那就是 <a> 的默认行为。
     症状极隐蔽:按住 300ms 松手,进度条明明只走到 1/3,
     页面却在 100ms 内跳走了(实测)。
     ⇒ 捕获阶段拦掉 click,要跳只走 finish()。 */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("[data-start-go]") : null;
    if (!a) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener("pointerdown", function (e) {
    var a = e.target.closest ? e.target.closest("[data-start-go]") : null;
    if (!a || going) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
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

  /* 现场读数(排障口) */
  window.__startWire = function () {
    return {
      hold: holdEl ? holdT : -1,
      going: going,
      reduced: reduced,
      eye: api ? api.state() : null
    };
  };
})();
