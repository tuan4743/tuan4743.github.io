/* ============================================================
   hud-surge.js — 共流过境 · 触发条
   ─────────────────────────────────────────────────────────────
   世界观:共识流的流量由锚点共识决定;平时闸门是锁死的
   (默认锁定 —— 背景不被自动演出打扰),持有者可以亲手开闸。
   交互(用户定稿):
   · 一条横向细进度条,水位 0 起步;
   · 单击 = 锁定/解锁。锁定时水位不涨(默认锁定);
   · 解锁状态按住条 = 加速流逝(0.20/s,约 5s 到满),松手回落
     常速;水位到顶驻留(雾罩全屏),再次单击锁定 → 转退潮。
   · 演出本体在 void-bg.js(暗模式共流),亮模式不演出。
   ★ 拿不到 window.__voidSurge(脚本缺失/启动页)就整个静默退出。
   ============================================================ */
(function () {
    "use strict";

    var bar = document.getElementById("hud-surge");
    var fill = document.getElementById("hud-surge-fill");
    var lab = document.getElementById("hud-surge-label");
    if (!bar || !fill) return;

    var LOCKED = "pref-surge-locked";       /* 默认锁定 */
    var locked = true;
    try { locked = localStorage.getItem(LOCKED) !== "0"; } catch (e) { }

    var holding = false;
    var raf = 0;

    function paint(p) {
        fill.style.width = (p * 100).toFixed(1) + "%";
        bar.classList.toggle("is-live", p > 0.001);
        bar.classList.toggle("is-full", p >= 0.995);
        if (lab) lab.textContent = locked ? "共流 · 闭" : (p >= 0.995 ? "共流 · 满" : "共流 · 开");
    }

    function loop() {
        raf = 0;
        var S = window.__voidSurge;
        if (!S) return;
        var p = S.p();
        if (locked) {
            /* 锁 = 闸门放下:不管水位在哪,退潮 */
            if (p > 0) S.release();
        } else if (p < 1) {
            /* 开闸:按住加速,不按常速涨 */
            S.hold(holding);
        }
        /* p >= 1 且未锁:满潮驻留(每帧 hold(true) 也不再涨),等锁定退潮 */
        paint(p);
        /* 水位没动静且是锁定的:可以歇循环(下一次交互会 kick) */
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

    /* 按住加速:pointerdown 起,pointerup/leave 止(setPointerCapture 兜住移出)。
       锁定态下 pointerdown = 解锁(单击语义,不加速)。 */
    bar.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        downAt = Date.now();
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

    /* 解锁后的短按(<350ms)= 锁定:退潮。避免和按住加速打架。 */
    var downAt = 0;
    bar.addEventListener("click", function (e) {
        e.stopPropagation();
        if (Date.now() - downAt < 350) {
            if (!locked) setLocked(true);
        }
    });

    /* 右键不弹菜单(它是个仪表,不是链接) */
    bar.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    setLocked(locked);
    paint(window.__voidSurge ? window.__voidSurge.p() : 0);
})();
