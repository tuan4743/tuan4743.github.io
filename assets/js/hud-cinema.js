/* ============================================================
   全屏模式(Cinema):折叠所有边缘 HUD,正文满屏阅读。
   —— html.hud-cinema 一个类管全部:
      · 右侧 HUD 框架/边带/盆栽/导航/控制列/笔/Logo/搜索淡出退场;
      · 左栏 HUD(番茄钟/时钟等面板 + 左下按钮)退场;
      · 侧目录退场;ECHO 摄像头 + 对话框 + 触发块退场;
      · 回到顶部浮标退场;正文容器去圆角阴影满屏。
   —— 入口:Alt+F(或 F11 交给浏览器,这里 Alt+F 避开)。
      退出:Alt+F 再按一次,或 Esc。
   —— 状态存 localStorage(pref-cinema),跨页保持;
      鼠标猛甩到屏幕最右缘 400ms 不离开也回 —— 不加任何新 UI,
      出口只有键盘 + 右缘热区(零宽,不挡正文)。
   ============================================================ */
(function () {
    "use strict";

    var docEl = document.documentElement;
    var KEY = "pref-cinema";

    function stored() {
        try { return localStorage.getItem(KEY) === "on"; } catch (e) { return false; }
    }
    function save(on) {
        try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { }
    }

    function apply(on) {
        docEl.classList.toggle("hud-cinema", on);
        save(on);
    }

    /* 恢复上次状态 */
    if (stored()) docEl.classList.add("hud-cinema");

    function toggle() {
        apply(!docEl.classList.contains("hud-cinema"));
    }

    /* Alt+F 切换;Esc 在全屏态退出(不抢搜索框/输入框的 Esc) */
    document.addEventListener("keydown", function (e) {
        if (e.altKey && (e.key === "f" || e.key === "F")) {
            e.preventDefault();
            toggle();
            return;
        }
        if (e.key === "Escape" && docEl.classList.contains("hud-cinema")) {
            var t = e.target;
            var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
            if (!typing) apply(false);
        }
    });

    /* 右缘热区:鼠标贴住屏幕最右 6px 且停留 400ms → 退出全屏。
       零宽热区平时不挡任何东西(pointer-events 只在开着的 6px 条上)。 */
    var rail = document.createElement("div");
    rail.className = "hud-cinema-rail";
    rail.setAttribute("aria-hidden", "true");
    rail.hidden = !docEl.classList.contains("hud-cinema");
    document.body.appendChild(rail);

    var railT = 0;
    rail.addEventListener("pointerenter", function () {
        if (railT) return;
        railT = setTimeout(function () {
            railT = 0;
            apply(false);
        }, 400);
    });
    rail.addEventListener("pointerleave", function () {
        if (railT) { clearTimeout(railT); railT = 0; }
    });

    /* 状态变化时同步热区可见性 + 通知 HUD(页面缩放等已监听 resize,这里单独发) */
    new MutationObserver(function () {
        rail.hidden = !docEl.classList.contains("hud-cinema");
    }).observe(docEl, { attributes: true, attributeFilter: ["class"] });

    /* 暴露给控制台/其它模块 */
    window.__hudCinema = {
        on: function () { return docEl.classList.contains("hud-cinema"); },
        toggle: toggle,
        set: apply
    };
})();
