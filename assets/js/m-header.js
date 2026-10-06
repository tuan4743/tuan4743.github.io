(function () {
    "use strict";
    /* 手机顶栏(.m-hud)的 [≡] 按钮:点开/收起下拉菜单。
        只在窄屏 DOM 里有这颗按钮;拿不到就静默退出。 */
    var btn = document.getElementById("m-hud-menu-btn");
    var menu = document.getElementById("m-hud-menu");
    if (!btn || !menu) return;

    function setOpen(open) {
        if (open) menu.removeAttribute("hidden");
        else menu.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setOpen(menu.hasAttribute("hidden"));
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

    /* 点菜单项后收起;点别处也收起 */
    menu.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("click", function (e) {
        if (!menu.hasAttribute("hidden") && !e.target.closest(".m-hud")) setOpen(false);
    });
})();
