(function () {
  "use strict";

  var content = document.querySelector(".post-content");
  if (!content) return;

  var blocks = Array.prototype.slice.call(content.children);
  if (!blocks.length) return;

  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 首屏内（或全部，reduced-motion）直接可见，不播动画 */
  if (reduced) {
    blocks.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }

  var vh = window.innerHeight || document.documentElement.clientHeight;
  var initial = [];
  var pending = [];
  blocks.forEach(function (el) {
    if (el.getBoundingClientRect().top < vh) initial.push(el);
    else pending.push(el);
  });
  initial.forEach(function (el) { el.classList.add("is-in"); });
  if (!pending.length) return;

  /* CSS 只在 html.content-reveal 前提下隐藏未入场块（渐进增强） */
  document.documentElement.classList.add("content-reveal");

  if (!("IntersectionObserver" in window)) {
    pending.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      /* 快速滚动时块可能已经越过视口上方（top<0），IO 不会报 intersecting
         —— 直接放行，否则永远卡在透明态 */
      if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.05, rootMargin: "0px 0px -10% 0px" });
  pending.forEach(function (el) { io.observe(el); });
})();
