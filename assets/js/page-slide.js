/* ============================================================
   向左滑过场(用户要求)
   ─────────────────────────────────────────────────────────────
   世界坐标从左到右是【CD 选择页 | 首页 | 其他页】—— 其他页在首页【右边】。
   流程:点平板上的 APP → 整块"机器"【向左】平移 100vw 出去(视口往右移)→
         滑完 → 跳到那张页面。
   为什么滑【整屏】而不是像 CD 架那样滑 66vw:
     CD 架那套是"把左边的架子拉进画面";这一套是"人往右边的页面去",
     所以要滑到底、把屏幕整个让出画面。
   为什么滑完才跳:滑走时露出来的是宇宙背景(.page-cosmos / .intro-bg 里的
     .cosmos),而落地页的背景【就是同一份】,所以看起来像"在同一个页面里平移"。
     先跳再滑就会看到新页面自己动一下,穿帮。
   ★ 动画本身全在 CSS(assets/css/extended/shell.css 第三节),这里只负责:
     挂 .page-out → 等过渡结束(带兜底定时器)→ location。
   ★ 不拦这些情况:新标签/新窗口、按了修饰键、非左键、href 是空的或锚点。
     拦截它们会让"用中键开新标签"这种正常操作失效。
   ============================================================ */
(function () {
  "use strict";

  var SLIDE_MS = 550;          /* 必须和 CSS 里那条 transform 过渡时长一致 */
  var FALLBACK_MS = SLIDE_MS + 260;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var leaving = false;

  function slideTo(href) {
    if (leaving) return;
    leaving = true;
    if (reduced) { window.location.href = href; return; }

    var body = document.body;
    body.classList.add("page-out");

    var done = false;
    function go() {
      if (done) return;
      done = true;
      window.location.href = href;
    }

    /* 用 scene 的 transitionend 收口(它一定是最后到位的那个);
       再兜一个定时器:过渡被打断/元素不在,也不会把用户卡在这一页。 */
    var scene = document.getElementById("scene");
    if (scene) {
      scene.addEventListener("transitionend", function (e) {
        if (e.propertyName === "transform" || e.propertyName === "") go();
      });
    }
    setTimeout(go, FALLBACK_MS);
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("[data-slide]") : null;
    if (!a) return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    var href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;
    e.preventDefault();
    slideTo(a.href);            /* 用 a.href(绝对地址),别用属性里的相对地址 */
  }, true);

  /* 现场读数:这个环境没有浏览器,留一个能一眼问出答案的口子 */
  window.__pageSlide = function () {
    return {
      leaving: leaving,
      pageOut: document.body.classList.contains("page-out"),
      reduced: reduced,
      targets: document.querySelectorAll("[data-slide]").length,
      slideMs: SLIDE_MS
    };
  };
})();
