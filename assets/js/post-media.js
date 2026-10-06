/* ============================================================
   post-media.js — 文章正文的两件小事
   ─────────────────────────────────────────────────────────────
   1. 代码块折叠:每个代码块右上角一枚 ▾/▸ 按钮,折起来后
      留一条"语言 · N 行"的窄条,点窄条或按钮展开。不自动折,
      折不折由读者定。
   2. 照片展示:正文里的 <img> 点击放大(遮罩 lightbox),
      Esc / 点遮罩关闭;title 或 alt 作为图注显示在图下方。
      包在链接里的图不劫持(点击仍走链接)。

   页面里没有 .post-content 就整体静默退出(首页/HUD 页不受影响)。
   reduced-motion:放大不放缩放动画,其余保留。
   ============================================================ */
(function () {
  "use strict";

  var content = document.querySelector(".post-content");
  if (!content) return;

  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- 1. 代码块折叠 ---------- */

  function langOf(container) {
    var code = container.querySelector("pre code");
    if (!code) return "";
    var m = (code.className || "").match(/language-([\w+-]+)/);
    return m ? m[1] : "";
  }

  function lineCount(container) {
    var code = container.querySelector("pre code");
    if (!code) return 0;
    var text = code.textContent || "";
    var n = text.replace(/\n$/, "").split("\n").length;
    return n;
  }

  function wireFold() {
    var blocks = content.querySelectorAll(".highlight:not(table), .post-content > pre");
    [].forEach.call(blocks, function (box) {
      if (box.querySelector(".code-fold")) return;
      /* 行号表(highlighttable)的折叠目标是整张 .highlight 容器 */
      var container = box.closest(".highlight") || box;

      var strip = document.createElement("button");
      strip.type = "button";
      strip.className = "code-fold-strip";
      var lang = langOf(container);
      strip.innerHTML = "<span class=\"code-fold-arrow\">▸</span> " +
        (lang ? lang + " · " : "") + lineCount(container) + " 行 · 点击展开";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "code-fold";
      btn.setAttribute("aria-expanded", "false");
      btn.title = "展开代码块";
      btn.innerHTML = "▸";

      function setFolded(folded) {
        container.classList.toggle("is-folded", folded);
        btn.setAttribute("aria-expanded", folded ? "false" : "true");
        btn.innerHTML = folded ? "▸" : "▾";
        btn.title = folded ? "展开代码块" : "折叠代码块";
      }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setFolded(!container.classList.contains("is-folded"));
      });
      strip.addEventListener("click", function () { setFolded(false); });

      container.appendChild(btn);
      container.appendChild(strip);
      /* 默认折叠:先收起来,读者想看再展开 */
      setFolded(true);
    });
  }

  /* ---------- 2. 照片 lightbox ---------- */

  var overlay = null;
  var overlayImg = null;
  var overlayCap = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "img-lightbox";
    overlay.hidden = true;
    overlay.innerHTML =
      "<button class=\"img-lightbox__close\" type=\"button\" aria-label=\"关闭\">×</button>" +
      "<img class=\"img-lightbox__img\" alt=\"\">" +
      "<p class=\"img-lightbox__cap\"></p>";
    overlayImg = overlay.querySelector(".img-lightbox__img");
    overlayCap = overlay.querySelector(".img-lightbox__cap");
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.classList.contains("img-lightbox__close")) closeBox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeBox();
    });
    document.body.appendChild(overlay);
  }

  function closeBox() {
    if (!overlay) return;
    overlay.hidden = true;
    overlay.classList.remove("is-open");
  }

  function openBox(img) {
    ensureOverlay();
    overlayImg.src = img.currentSrc || img.src;
    overlayImg.alt = img.alt || "";
    var cap = img.getAttribute("title") || img.alt || "";
    overlayCap.textContent = cap;
    overlayCap.hidden = !cap;
    overlay.hidden = false;
    /* 强制一帧再挂 is-open,过渡才起得来 */
    if (!reduced) requestAnimationFrame(function () { overlay.classList.add("is-open"); });
    else overlay.classList.add("is-open");
  }

  function wirePhotos() {
    content.addEventListener("click", function (e) {
      var img = e.target.closest("img");
      if (!img || img.closest("a") || img.classList.contains("in-text")) return;
      e.preventDefault();
      openBox(img);
    });
  }

  function boot() { wireFold(); wirePhotos(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
