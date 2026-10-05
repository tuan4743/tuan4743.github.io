(function () {
  "use strict";

  var SLIDE_MS = 550;
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
    slideTo(a.href);
  }, true);

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
