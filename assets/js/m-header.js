(function () {
    "use strict";
    /* 手机顶栏(.m-hud)的 [≡] 按钮:点开/收起下拉菜单。
        只在窄屏 DOM 里有这颗按钮;拿不到就静默退出。
        ★ 展开不突兀:不用 hidden 硬切,菜单常驻 DOM、max-height +
          opacity 过渡(0.22s,HUD 同款时长);收起后 visibility:hidden
          兜底,不挡触摸、不进 tab 序。 */
    var btn = document.getElementById("m-hud-menu-btn");
    var menu = document.getElementById("m-hud-menu");
    if (!btn || !menu) return;

    var OPEN_H = menu.scrollHeight || 260;   /* 展开后的真实高度(px) */

    function setOpen(open) {
        menu.style.maxHeight = open ? OPEN_H + "px" : "0px";
        menu.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setOpen(btn.getAttribute("aria-expanded") !== "true");
    });

    /* 点菜单项后收起;点别处也收起 */
    menu.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("click", function (e) {
        if (btn.getAttribute("aria-expanded") === "true" && !e.target.closest(".m-hud")) setOpen(false);
    });

    /* 明暗切换:与 HUD 的 theme-toggle 同一逻辑(直接换 data-theme +
        写 pref-theme)。不共用 id —— HUD 在窄屏只是 display:none,id
        还在 DOM 里,重复 id 会让两处绑定互相踩。 */
    var themeBtn = document.getElementById("m-hud-theme");
    if (themeBtn) {
        themeBtn.addEventListener("click", function () {
            var html = document.documentElement;
            var next = html.dataset.theme === "light" ? "dark" : "light";
            if (window.__switchTheme) window.__switchTheme(next);
            else {
                html.dataset.theme = next;
                try { localStorage.setItem("pref-theme", next); } catch (err) { }
            }
        });
    }
})();
