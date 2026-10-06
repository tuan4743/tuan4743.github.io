/* ============================================================
   hud-surge.js — 共流过境 · 触发块(十阶段)
   ─────────────────────────────────────────────────────────────
   交互(用户定稿):
   · 挂在左上角摄像机(proj-node)斜边外侧,斜 45° 贴边、铺满全长;
   · 形态只有 10 个块(无文字/无框/无底色),单击一次点亮下一块;
   · 走满 10 块 → 爆发段接管(armed):交互全关 → 白幕 → 重载。
   水位由渲染侧 __voidSurge.setLevel(stage/10) 直接设置,
   渲染侧不再自走速率(阶段式)。拿不到 __voidSurge 就静默退出。
   ============================================================ */
(function () {
    "use strict";

    var bar = document.getElementById("hud-surge");
    if (!bar) return;
    var rail = bar.querySelector(".hud-surge__rail");
    if (!rail) return;

    var STAGES = 10;
    var stage = 0;                  /* 0..10;10 = 交给爆发段 */
    var cells = [];                 /* 10 个块 */
    var raf = 0;
    var armed = false;

    /* 生成 10 个块(JS 生成,避免 partial 里写 10 个 span) */
    for (var i = 0; i < STAGES; i++) {
        var c = document.createElement("span");
        c.className = "hud-surge__cell";
        rail.appendChild(c);
        cells.push(c);
    }

    function paint() {
        for (var i = 0; i < cells.length; i++) {
            cells[i].classList.toggle("on", i < stage);
        }
        bar.classList.toggle("is-live", stage > 0);
        bar.classList.toggle("is-full", stage >= STAGES || armed);
        bar.setAttribute("aria-valuenow", String(stage));
    }

    function loop() {
        raf = 0;
        var S = window.__voidSurge;
        if (!S) return;
        if (S.phase() === 2) { armed = true; paint(); raf = requestAnimationFrame(loop); return; }
        armed = false;
        paint();
    }

    function setStage(n) {
        stage = Math.max(0, Math.min(STAGES, n));
        var S = window.__voidSurge;
        if (S && S.setLevel) S.setLevel(stage / STAGES);
        paint();
        kick();
    }

    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    /* 单击 = 点亮下一块;满 10 后渲染侧自动进入爆发。 */
    bar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (armed) return;
        setStage(stage + 1);
    });

    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    /* 初始:阶段 0(渲染侧水位也是 0) */
    setStage(0);
})();
