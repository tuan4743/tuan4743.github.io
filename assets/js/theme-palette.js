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
     做法:切换前给 <html> 挂 .theme-fade(全站颜色属性统一
     ~1.1s 过渡),下一帧切换 data-theme,过渡走完再摘掉 ——
     页面整体在几秒内渐变成新色。摘早了悬停微过渡没事,
     摘晚了也只是渐变期间悬停也是慢的,可接受。 */
  var fadeTimer = 0;
  function switchTheme(next) {
    var html = document.documentElement;
    if (fadeTimer) clearTimeout(fadeTimer);
    html.classList.add("theme-fade");
    /* 强制一次 style,确保过渡规则先于 data-theme 生效 */
    void html.offsetWidth;
    html.dataset.theme = next;
    try { localStorage.setItem("pref-theme", next); } catch (e) { }
    /* ★ 修"切换末期文字颜色突然变一下":定时摘 .theme-fade 不可靠 ——
       实测(逐帧采样)部分元素的过渡起点被推迟/重置过,固定 1400ms 摘类时
       过渡仍在半途,类一摘 transition 失效,颜色"啪"地跳到终值。
       改成【探活式】摘除:每 120ms 查一次 document.getAnimations(),
       只在页面里再没有进行中的 CSS transition(时长 > 200ms 的)时才摘;
       5s 硬上限兜底,避免某个元素永远挂着长过渡把类钉死。 */
    fadeTimer = setInterval(function () {
      var busy = false;
      try {
        var anims = document.getAnimations ? document.getAnimations() : [];
        for (var i = 0; i < anims.length; i++) {
          var a = anims[i];
          /* 只关心 CSS transition(主题渐变就是它);CSSAnimation(呼吸灯
             之类的无限动画)不属于本次切换,不挡摘类。 */
          if (a && a.constructor && a.constructor.name === "CSSTransition") { busy = true; break; }
          if (a && a.transitionProperty) { busy = true; break; }
        }
      } catch (e) { busy = true; }
      if (!busy || ++switchTheme._guard > 40) {
        clearInterval(fadeTimer);
        fadeTimer = 0;
        switchTheme._guard = 0;
        html.classList.remove("theme-fade");
      }
    }, 120);
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
