/* ============================================================
   点击特效(触摸涟漪)
   —— 手机/平板没有磁吸光标,点按没有落点反馈;这里补一个
      与站点线条语言一致的涟漪:单击处一圈细环从 0 扩到 ~64px
      淡出,0.55s,不遮挡、不拦截任何事件(pointer-events:none)。
   —— 触发条件:pointer:coarse(触屏设备)。桌面端不挂。
   —— 排除:HUD 触发块(hud-surge)、ECHO 热区(echo-hot)这类
      自带按压反馈的控件,涟漪不重复叠。
   ============================================================ */
(function () {
    "use strict";

    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* 排除名单:这些控件已有自己的反馈,再叠一圈会乱 */
    var SKIP = ".hud-surge, .echo-hot";

    var pool = [];
    var MAX = 6; /* 同屏最多 6 圈,快速乱点也不堆积 */

    function spawn(x, y) {
        var el = pool.pop();
        if (!el) {
            if (document.querySelectorAll(".tap-ripple").length >= MAX) return;
            el = document.createElement("span");
            el.className = "tap-ripple";
            el.setAttribute("aria-hidden", "true");
        }
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.classList.remove("is-run");
        void el.offsetWidth; /* 重置动画 */
        el.classList.add("is-run");
        document.body.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
            if (pool.length < MAX) pool.push(el);
        }, 600);
    }

    document.addEventListener("pointerdown", function (e) {
        if (e.pointerType && e.pointerType !== "touch" && e.pointerType !== "pen") return;
        var t = e.target;
        if (t && t.closest && t.closest(SKIP)) return;
        spawn(e.clientX, e.clientY);
    }, { passive: true });
})();
