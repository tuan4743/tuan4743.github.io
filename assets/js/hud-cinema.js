/* ============================================================
   全屏模式(Cinema):折叠所有边缘 HUD,正文满屏阅读。
   —— html.hud-cinema 一个类管全部。
   —— 入口:点站名(hud-logo)切换;全屏态站名滑到屏幕最右上,
      再点一下恢复。Alt+F / Esc 同样有效。
   —— 状态存 localStorage(pref-cinema),跨页保持。
   ★ 结构注意:.hud-toc 是 .page-hud 的子元素,所以【不能】把
     .page-hud 整棵淡出 —— 那会把目录一起带走(opacity 是父级
     封顶的)。改成逐个退场 page-hud 的直接子件,目录和站名留在层上。
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

    function paintLogo() {
        var logo = document.querySelector(".hud-logo");
        if (logo) logo.classList.toggle("is-cinema", docEl.classList.contains("hud-cinema"));
    }

    function apply(on) {
        docEl.classList.toggle("hud-cinema", on);
        save(on);
        paintLogo();
    }

    /* 恢复上次状态 */
    if (stored()) docEl.classList.add("hud-cinema");

    function toggle() {
        apply(!docEl.classList.contains("hud-cinema"));
    }

    /* 站名即开关 */
    function bindLogo() {
        var logo = document.querySelector(".hud-logo");
        if (!logo || logo.__cinemaBound) return;
        logo.__cinemaBound = true;
        logo.classList.add("hud-logo--cinema"); /* 开放点击 + 提示 */
        logo.addEventListener("click", function (e) {
            e.preventDefault();
            toggle();
        });
        paintLogo();
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindLogo);
    } else {
        bindLogo();
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

    /* 暴露给控制台/其它模块 */
    window.__hudCinema = {
        on: function () { return docEl.classList.contains("hud-cinema"); },
        toggle: toggle,
        set: apply
    };
})();
