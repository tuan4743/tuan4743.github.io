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

  /* ---------- 明暗整体切换 ----------
     页面上散布着大量 0.14~0.3s 的 color/background 过渡(HUD 按钮、
     行、链接……),直接换 data-theme 时它们【各自】完成过渡 ——
     表现为元素明暗依次变化,闪眼。
     做法:切换前给 <html> 挂 .theme-snap(禁掉所有 color 类过渡),
     下一帧切换 data-theme,再下一帧摘掉 —— 全站一瞬间整体翻转。 */
  function switchTheme(next) {
    var html = document.documentElement;
    html.classList.add("theme-snap");
    /* 强制一次 style/layout,确保禁过渡先生效 */
    void html.offsetWidth;
    html.dataset.theme = next;
    try { localStorage.setItem("pref-theme", next); } catch (e) { }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.classList.remove("theme-snap");
      });
    });
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
