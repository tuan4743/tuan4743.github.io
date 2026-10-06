/* ============================================================
   hud-surge.js — 共流过境 · 触发条(十阶段)
   ─────────────────────────────────────────────────────────────
   交互(用户定稿):
   · 挂在左上角摄像机(proj-node)下方,斜 45° 贴其斜边;
   · 条分 10 个阶段(10 格),单击一次进到下一阶段;
   · 走满 10 阶段 → 爆发段接管(armed):交互全关 → 白幕 → 重载。
   水位由渲染侧 __voidSurge.setLevel(stage/10) 直接设置,
   渲染侧不再自走速率(阶段式)。拿不到 __voidSurge 就静默退出。
   ============================================================ */
(function () {
    "use strict";

    var bar = document.getElementById("hud-surge");
    var fill = document.getElementById("hud-surge-fill");
    var lab = document.getElementById("hud-surge-label");
    if (!bar || !fill) return;

    var STAGES = 10;
    var stage = 0;                  /* 0..10;10 = 交给爆发段 */
    var raf = 0;
    var armed = false;

    function paint() {
        var p = stage / STAGES;
        fill.style.width = (p * 100).toFixed(1) + "%";
        bar.classList.toggle("is-live", stage > 0);
        bar.classList.toggle("is-full", stage >= STAGES || armed);
        if (lab) lab.textContent = armed ? "共流 · 爆" : "共流 · " + stage + "/10";
        bar.setAttribute("aria-valuenow", String(stage));
    }

    function loop() {
        raf = 0;
        var S = window.__voidSurge;
        if (!S) return;
        if (S.phase() === 2) { armed = true; paint(); raf = requestAnimationFrame(loop); return; }
        armed = false;
        paint();
        /* armed(水位已设到 1)后渲染侧自己推进爆发,不再需要循环 */
    }

    function setStage(n) {
        stage = Math.max(0, Math.min(STAGES, n));
        var S = window.__voidSurge;
        if (S && S.setLevel) S.setLevel(stage / STAGES);
        paint();
        kick();
    }

    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    /* 单击 = 进到下一阶段;满 10 后渲染侧自动进入爆发。 */
    bar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (armed) return;
        setStage(stage + 1);
    });

    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    /* 初始:阶段 0(渲染侧水位也是 0) */
    setStage(0);
})();
