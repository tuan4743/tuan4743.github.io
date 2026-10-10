/* ============================================================
   右下角三盆花 — 盆栽互动
   ★ 命中方案:整棵 svg 打开 pointer-events(auto),点击落在
     svg 内任意位置都收得到;再用「svg 内坐标 → viewBox 坐标」
     的几何换算判断点在哪一盆。不再依赖 fill/stroke 全空的
     透明热区 path —— 那条链路在部分环境下命中不了。
   ★ 风:全局检测鼠标速度与方向 —— 快速扫过时叶子顺着鼠标
     水平方向被"吹"摆,速度越快摆幅越大(--wind-amp)。
     慢速移动/悬停不触发(免得页面处处生风)。
   ★ 抖动:.is-shake 只挂【可见的盆/植株组】—— 挂在透明热区上
     会把 hit path 边缘描出来(之前的"黑框")。
   ============================================================ */
(function () {
    "use strict";

    var svg = document.querySelector(".hud-plants");
    if (!svg) return;

    var reduce = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- 风:全局鼠标速度/方向检测 ---- */
    var breezeT = 0;
    function breeze(dir, pow) {
        if (reduce) return;
        /* 幅度 2.2°..6.5°:叶子离盆底 ~250px(viewBox 单位),
           3° 就有 ~13px 弧顶位移,慢扫也看得清;太快再往上加。 */
        svg.style.setProperty("--wind-amp",
            (2.2 + Math.max(0, Math.min(1, pow)) * 4.3).toFixed(2) + "deg");
        svg.classList.toggle("wind-r", dir >= 0);
        svg.classList.toggle("wind-l", dir < 0);
        svg.classList.add("is-breeze");
        if (breezeT) clearTimeout(breezeT);
        breezeT = setTimeout(function () {
            svg.classList.remove("is-breeze");
            breezeT = 0;
        }, 1300);
    }

    var WALK = 140;          /* px/s,低于此算"慢走",不起风 */
    var FULL = 900;          /* px/s 及以上算满级阵风 */
    var lx = 0, ly = 0, lt = 0;
    var smoothV = 0;
    var lastDir = 0;
    var raf = 0, nx = 0, ny = 0, nt = 0;

    function consume() {
        raf = 0;
        var dt = (nt - lt) / 1000;
        if (dt > 0.004) {
            var v = Math.hypot(nx - lx, ny - ly) / dt;
            smoothV = smoothV * 0.55 + v * 0.45;
            var dx = nx - lx;
            if (Math.abs(dx) > 3) lastDir = dx > 0 ? 1 : -1;
            lx = nx; ly = ny; lt = nt;
        }
        if (smoothV > WALK) breeze(lastDir, (smoothV - WALK) / (FULL - WALK));
    }

    if (!reduce) {
        document.addEventListener("pointermove", function (e) {
            nx = e.clientX; ny = e.clientY;
            if (!lt) { lx = nx; ly = ny; lt = performance.now(); return; }
            if (!raf) raf = requestAnimationFrame(consume);
        }, { passive: true });
        window.addEventListener("pointerout", function (e) {
            if (!e.relatedTarget) {
                smoothV = 0;
                if (breezeT) { clearTimeout(breezeT); breezeT = 0; }
                svg.classList.remove("is-breeze");
            }
        });
    }

    /* ---- 点击:svg 内坐标 → viewBox(218 30 492 572)→ 分盆 ----
       三盆的 viewBox 包围盒(留 10px 余量):
         left:  x 218-420, y 38-595   (左盆植株+盆)
         flower: x 290-510, y 220-595 (花盆:花+盆)
         right: x 460-700, y 235-595  (右盆植株+盆)
       命中顺序 flower 优先(花芯在中层,范围也最窄)。 */
    var ZONES = [
        { name: "flower", x0: 290, x1: 512, y0: 222, y1: 595 },
        { name: "left",   x0: 218, x1: 420, y0: 38,  y1: 595 },
        { name: "right",  x0: 460, x1: 700, y0: 235, y1: 595 }
    ];

    function zoneAt(evt) {
        var r = svg.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        var vx = 218 + (evt.clientX - r.left) / r.width * 492;
        var vy = 30 + (evt.clientY - r.top) / r.height * 572;
        for (var i = 0; i < ZONES.length; i++) {
            var z = ZONES[i];
            if (vx >= z.x0 && vx <= z.x1 && vy >= z.y0 && vy <= z.y1) return z.name;
        }
        return null;
    }

    /* 点哪盆抖哪盆的可见组:
       left  → ink 组(左盆植株+盆, x 218-420)
       flower→ front 组(花+花盆, x 306-540)
       right → back 组(右盆植株+盆, x 464-700;类名带 back 是历史命名,
                它才是右大盆那一整棵,front 反而是中间花盆) */
    function visibleTarget(name) {
        if (name === "left") return svg.querySelector(".hud-plants__ink");
        if (name === "flower") return svg.querySelector(".hud-plants__front");
        if (name === "right") return svg.querySelector(".hud-plants__back");
        return null;
    }

    svg.addEventListener("click", function (e) {
        var name = zoneAt(e);
        if (!name) return;
        var t = visibleTarget(name);
        if (t && !reduce) {
            t.classList.remove("is-shake");
            void t.getBoundingClientRect(); /* 连点每次都重播 */
            t.classList.add("is-shake");
        }
        /* 点中花芯:切一次花色(花芯 viewBox 圆心 416,298 r≈30) */
        var dx = 0, dy = 0;
        var r2 = svg.getBoundingClientRect();
        var cx = 218 + (e.clientX - r2.left) / r2.width * 492;
        var cy = 30 + (e.clientY - r2.top) / r2.height * 572;
        dx = cx - 416; dy = cy - 298;
        if (dx * dx + dy * dy <= 34 * 34) {
            var core = svg.querySelector(".hud-plants__core");
            if (core) core.classList.toggle("is-alt");
        }
    });

    window.addEventListener("pagehide", function () {
        svg.classList.remove("is-breeze");
    });
})();
