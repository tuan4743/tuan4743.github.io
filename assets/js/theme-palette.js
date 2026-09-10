/* 背景配色:面板预设色块选择,localStorage 持久化
   另:首页是独立文档(不含主题 footer),明暗切换需要在这里自行绑定 */
(function () {
  "use strict";

  /* ---------- 明暗切换(仅首页需要,普通页面由主题 footer 绑定,避免重复绑定) ---------- */
  if (document.body.classList.contains("intro-page")) {
    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        var html = document.documentElement;
        if (html.dataset.theme === "dark") {
          html.dataset.theme = "light";
          try { localStorage.setItem("pref-theme", "light"); } catch (e) {}
        } else {
          html.dataset.theme = "dark";
          try { localStorage.setItem("pref-theme", "dark"); } catch (e) {}
        }
      });
    }
  }

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

  /* 触屏设备:点击按钮开关面板;桌面端悬停已由 CSS 处理 */
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

  /* 初始高亮当前配色 */
  var initial = panel.querySelector('.palette-swatch[data-palette="' + current() + '"]');
  if (initial) initial.classList.add("active");
})();
