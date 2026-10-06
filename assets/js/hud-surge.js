/* ============================================================
   hud-surge.js — 共流过境 · 触发条(两周期模型)
   ─────────────────────────────────────────────────────────────
   交互(用户定稿):
   · 单击 = 解锁/锁定。锁定(默认)水位不涨;
   · 解锁后水位自涨(慢),按住条加速;锁定即退。
   · 水位满 → 爆发段接管(渲染侧 ~9s:震动/炫光/白幕),
     触发条进入 armed:交互全关,进度条弹满 → 重载。
   演出本体在 void-bg.js(暗模式)。拿不到 __voidSurge 就静默退出。

   ★ 状态机(实测教训:previous 版 pointerdown 里解锁、click 里
     再上锁 —— 同一次点按两个事件先后触发,永远解不开锁!
     现在整个状态机只走 click 一个入口,pointer 系只管按住加速。)
   ============================================================ */
(function () {
    "use strict";

    var bar = document.getElementById("hud-surge");
    var fill = document.getElementById("hud-surge-fill");
    var lab = document.getElementById("hud-surge-label");
    if (!bar || !fill) return;

    var LOCKED = "pref-surge-locked";
    var locked = true;
    try { locked = localStorage.getItem(LOCKED) !== "0"; } catch (e) { }

    var holding = false;
    var raf = 0;
    var armed = false;              /* 爆发段接管:交互全关 */
    var downAt = 0;
    var downOnLocked = false;       /* 这次按下时是否处于锁定态 */

    function paint(p) {
        fill.style.width = (p * 100).toFixed(1) + "%";
        bar.classList.toggle("is-live", p > 0.001);
        bar.classList.toggle("is-full", p >= 0.995 || armed);
        if (lab) lab.textContent = armed ? "共流 · 爆" : (locked ? "共流 · 闭" : "共流 · 开");
    }

    function loop() {
        raf = 0;
        var S = window.__voidSurge;
        if (!S) return;
        var p = S.p();
        if (S.phase() === 2) { armed = true; paint(1); raf = requestAnimationFrame(loop); return; }
        armed = false;
        if (locked) {
            if (p > 0) S.release();
        } else {
            S.hold(holding);
        }
        paint(p);
        if (p > 0 || (!locked && p < 1) || holding) raf = requestAnimationFrame(loop);
    }

    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    function setLocked(v) {
        locked = v;
        try { localStorage.setItem(LOCKED, v ? "1" : "0"); } catch (e) { }
        bar.classList.toggle("is-locked", locked);
        bar.setAttribute("aria-pressed", locked ? "true" : "false");
        kick();
    }

    /* pointerdown:只记录按住(加速用),不改锁定态。
       锁定态下按住不加速 —— 必须先单击解锁。 */
    bar.addEventListener("pointerdown", function (e) {
        if (armed) return;
        e.preventDefault();
        e.stopPropagation();
        downAt = Date.now();
        downOnLocked = locked;
        if (locked) return;                     /* 锁定态:等 click 解锁 */
        try { bar.setPointerCapture(e.pointerId); } catch (er) { }
        holding = true;
        kick();
    });
    function stopHold() {
        if (!holding) return;
        holding = false;
        kick();
    }
    bar.addEventListener("pointerup", stopHold);
    bar.addEventListener("pointercancel", stopHold);
    bar.addEventListener("lostpointercapture", stopHold);

    /* click:唯一的状态切换入口。
       · 锁定态 → 解锁(开始涨);
       · 解锁态的短按(<350ms,非按住加速)→ 锁定(退回)。
       ★ downOnLocked 区分"这次点击是解锁动作"(不再上锁回去)。 */
    bar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (armed) return;
        if (locked) { setLocked(false); return; }
        if (!holding && Date.now() - downAt < 350 && !downOnLocked) setLocked(true);
        downOnLocked = false;
    });

    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    setLocked(locked);
    paint(window.__voidSurge ? window.__voidSurge.p() : 0);
})();
