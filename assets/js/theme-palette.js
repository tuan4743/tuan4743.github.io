(function () {
  "use strict";

  if (document.body.classList.contains("intro-page")) {
    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var html = document.documentElement;
        if (html.dataset.theme === "dark") {
          switchTheme("light");
        } else {
          switchTheme("dark");
        }
      });
    }
  }

  /* ---------- 明暗渐变切换 ----------
     直接换 data-theme 时所有颜色属性瞬翻,刺眼。
     ★ 用 View Transitions API 做整页交叉淡化:旧画面淡出、新画面淡入,
       与页面里成百上千条 CSS transition 完全解耦 —— 之前用 .theme-fade
       全局过渡的方案,实测(逐帧采样)会被页面里其他过渡/继承链追赶,
       过渡末端出现一次肉眼可见的"回跳",反复修都修不干净,故整体弃用。
       不支持 View Transitions 的浏览器(旧 Firefox 等)退回瞬切,
       和修复前的行为一致,不会更差。 */
  function switchTheme(next) {
    var html = document.documentElement;
    var commit = function () {
      html.dataset.theme = next;
      try { localStorage.setItem("pref-theme", next); } catch (e) { }
    };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }
  /* 暴露给主题 footer 里那支 PaperMod 原生脚本对齐用(见 baseof 注释) */
  window.__switchTheme = switchTheme;

  var wrap = document.getElementById("palette-wrap");
  var btn = document.getElementById("palette-toggle");
  var panel = document.getElementById("palette-panel");
  if (!wrap || !btn || !panel) return;

  function current() {
    return document.documentElement.dataset.palette || "";
  }

  function apply(p) {
    if (p) {
      document.documentElement.dataset.palette = p;
    } else {
      delete document.documentElement.dataset.palette;
    }
    try {
      localStorage.setItem("pref-palette", p || "default");
    } catch (e) {}
    var sel = panel.querySelector(".palette-swatch.active");
    if (sel) sel.classList.remove("active");
    var match = panel.querySelector('.palette-swatch[data-palette="' + p + '"]');
    if (match) match.classList.add("active");
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    wrap.classList.toggle("open");
  });

  panel.addEventListener("click", function (e) {
    var sw = e.target.closest(".palette-swatch");
    if (!sw) return;
    apply(sw.getAttribute("data-palette") || "");
    wrap.classList.remove("open");
    e.stopPropagation();
  });

  document.addEventListener("click", function () {
    wrap.classList.remove("open");
  });

  var initial = panel.querySelector('.palette-swatch[data-palette="' + current() + '"]');
  if (initial) initial.classList.add("active");
})();
