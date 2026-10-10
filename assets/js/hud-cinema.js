/* ============================================================
   全屏模式(Cinema):折叠所有边缘 HUD,正文满屏阅读。
   —— html.hud-cinema 一个类管全部:
      · 右侧 HUD 框架/边带/盆栽/导航/控制列/笔/Logo/搜索淡出退场;
      · 左栏 HUD(番茄钟/时钟等面板 + 左下按钮)退场;
      · ECHO 摄像头 + 对话框 + 触发块退场;
      · 回到顶部浮标退场;正文容器去圆角阴影满屏。
      ★ 目录(hud-toc)不折叠 —— 目录卡片是正文的一部分,保留。
   —— 入口必须可发现:右侧 HUD 导航列顶部放一个常驻全屏按钮
      (数据驱动,不是隐藏手势);退出走同按钮 / Esc。
   —— 状态存 localStorage(pref-cinema),跨页保持。
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
        paintBtn();
    }

    /* 恢复上次状态 */
    if (stored()) docEl.classList.add("hud-cinema");

    /* ---- 右栏常驻入口按钮:插进 .hud-nav 最上面(和导航项同款外观) ---- */
    var btn = null;
    function paintBtn() {
        if (!btn) return;
        var on = docEl.classList.contains("hud-cinema");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        var name = btn.querySelector(".hud-nav__name");
        if (name) name.textContent = on ? "退出全屏" : "全屏";
        btn.title = on ? "退出全屏 (Alt + F)" : "全屏 (Alt + F)";
    }

    function buildBtn() {
        var nav = document.querySelector(".hud-nav");
        if (!nav || document.getElementById("hud-cinema-btn")) return;
        btn = document.createElement("a");
        btn.className = "hud-nav__item hud-cinema__btn";
        btn.id = "hud-cinema-btn";
        btn.href = "javascript:void(0)";
        btn.setAttribute("role", "button");
        btn.setAttribute("aria-pressed", "false");
        btn.style.setProperty("--hud-i", "-1");
        btn.innerHTML =
            '<span class="hud-nav__icon" aria-hidden="true">' +
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path>' +
            '<path d="M8 21H5a2 2 0 0 1-2-2v-3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>' +
            "</svg></span>" +
            '<span class="hud-nav__name">全屏</span>';
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            toggle();
        });
        nav.insertBefore(btn, nav.firstChild);
        paintBtn();
    }

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

    buildBtn();

    /* 暴露给控制台/其它模块 */
    window.__hudCinema = {
        on: function () { return docEl.classList.contains("hud-cinema"); },
        toggle: toggle,
        set: apply
    };
})();
