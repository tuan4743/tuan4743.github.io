/* ============================================================
   hud-surge.js — 共流过境 · 触发条(两周期模型)
   ─────────────────────────────────────────────────────────────
   交互(用户定稿):
   · 单击 = 解锁/锁定。锁定(默认)水位不涨;
   · 解锁后水位自涨(慢),按住条加速;松手可退(锁定即退)。
   · 水位满 → 爆发段接管(渲染侧 ~3.3s:发光/光带/裂纹/覆屏),
     触发条进入 armed:交互全关,只把进度条弹满 → 白幕 → 重载。
   演出本体在 void-bg.js(暗模式)。拿不到 __voidSurge 就静默退出。
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

    function paint(p) {
        fill.style.width = (p * 100).toFixed(1) + "%";
        bar.classList.toggle("is-live", p > 0.001);
        bar.classList.toggle("is-full", p >= 0.995 || armed);
        if (lab) lab.textContent = armed ? "共流 · 爆" : (locked ? "共流 · 闭" : (p > 0 ? "共流 · 开" : "共流 · 开"));
    }

    function loop() {
        raf = 0;
        var S = window.__voidSurge;
        if (!S) return;
        var p = S.p();
        if (S.phase() === 2) { armed = true; paint(1); raf = requestAnimationFrame(loop); return; }
        armed = false;
        if (locked) {
            /* 锁定 = 冻结:水位既不涨也不退 */
            if (p > 0 && S.freeze) S.freeze();
        } else if (p > 0 && !holding) {
            /* 解锁且没按住 = 退潮(松手即退,回到 0 才停) */
            S.release();
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

    var downAt = 0;
    var downOnLocked = false;       /* 这次按下时是锁定态吗 */
    bar.addEventListener("pointerdown", function (e) {
        if (armed) return;
        e.preventDefault();
        e.stopPropagation();
        downAt = Date.now();
        downOnLocked = locked;
        try { bar.setPointerCapture(e.pointerId); } catch (er) { }
        if (locked) { setLocked(false); return; }
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

    /* 单击 = 切换锁定。★ 同一次点击会先后触发 pointerdown 和 click:
       锁定态下 pointerdown 解了锁,随后的 click 若再判 "未锁定就锁定",
       就会当帧锁回 —— 单击永远解不开锁(死锁)。区分:这次按下
       (downOnLocked)落在锁定态 ⇒ 这次 click 是"解锁"动作,不再锁回;
       落在解锁态的短按才是"锁定"。 */
    bar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (armed) return;
        if (locked) return;                        /* 已锁(可能刚被这次按下解锁前是锁定→不进这) */
        if (downOnLocked) return;                  /* 这次按下解锁了锁:click 是解锁动作的尾巴,不再锁回 */
        if (Date.now() - downAt < 350) setLocked(true);
    });

    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    setLocked(locked);
    paint(window.__voidSurge ? window.__voidSurge.p() : 0);
})();
