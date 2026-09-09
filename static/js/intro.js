/* 首页介绍页:CD 托盘开合 + 主题面板切换 */
(function () {
  "use strict";

  var body = document.body;
  var toggle = document.getElementById("intro-toggle");
  var drawer = document.getElementById("intro-drawer");
  var panels = document.querySelectorAll(".intro-panel");
  var cds = document.querySelectorAll(".cd[data-panel]");
  var current = null;

  /* ---------- 托盘开合 ---------- */
  function setOpen(open) {
    body.classList.toggle("intro-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
  }

  toggle.addEventListener("click", function () {
    setOpen(!body.classList.contains("intro-open"));
  });

  document.addEventListener("click", function (e) {
    if (
      body.classList.contains("intro-open") &&
      !drawer.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      setOpen(false);
    }
  });

  /* ---------- 面板切换(侧边导航完全不动) ---------- */
  function goto(name) {
    if (!name || name === current) return;
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === name);
    });
    cds.forEach(function (cd) {
      var on = cd.getAttribute("data-panel") === name;
      cd.classList.toggle("is-active", on);
      if (on) {
        cd.setAttribute("aria-current", "true");
      } else {
        cd.removeAttribute("aria-current");
      }
    });
    current = name;
    if (history.replaceState) {
      history.replaceState(null, "", "#" + name);
    }
  }

  cds.forEach(function (cd) {
    cd.addEventListener("click", function () {
      goto(cd.getAttribute("data-panel"));
      setOpen(false); /* 选择主题后托盘收起(策略待定,可去掉) */
    });
  });

  /* 初始激活第一个面板 */
  var first = panels[0];
  var firstCd = cds[0];
  if (first) {
    current = first.getAttribute("data-panel");
  }
  if (firstCd) {
    firstCd.classList.add("is-active");
    firstCd.setAttribute("aria-current", "true");
  }

  /* 支持 #self 直达 */
  var init = location.hash.slice(1);
  if (init && init !== current) {
    goto(init);
  }
})();
