/* ============================================================
   右侧 HUD 的交互层 + 边框几何(第二阶段)
   ─────────────────────────────────────────────────────────────
   三件事:
     1) 画边框:按用户给的走向算顶点(下面是 gFrame,纯函数,可单独验);
     2) 配色滑条(#palette-hue)→ 调 window.__hudPalette(算法在 hud-palette.js);
     3) 音量滑条(#volume-range)→ 写 cd-audio.js 读的那个键(cd-audio-vol,0~1)。
   明暗旋钮(#theme-toggle)【不需要这里绑】:主题的 footer 脚本按 id 找它。

   ★★ 角度是【屏幕上的角度】,这一条是用户明确纠正过的:
      "你的角度理解错了,你现在画的是与水平方向30°,而我要的是60°,陡一点的线。
       而且你这个45°完全不是45°啊。"
      我第一版把 45°/60° 当成了"百分比坐标空间"里的角度(dx=dy 就算 45°)——
      在 16:9 屏上那只有 29°,所以他看到的根本不是 45°。正确换算是:
        屏幕 tan(角) = (Δy% × 视口高) / (Δx% × 视口宽)
        ⇒ Δx% = Δy% × (视口高 ÷ 视口宽) ÷ tan(角)
      ⇒ 斜线的水平位移与视口长宽比有关 ⇒ 这条折线【必须在运行时算】,
        模板里那份只是 16:9 的参考值(也是没有 JS 时的样子)。
        gFrame(1920, 1080) 的结果与模板里那份【必须逐字相同】——
        tests/page-hud.test.mjs 里钉着这条(两边都算一遍再比)。
   ============================================================ */
(function () {
    "use strict";

    var T60 = Math.tan(Math.PI / 3);   /* tan60° = √3 = 1.7320508… */

    /* ------------------------------------------------------------
       边框几何(纯函数,不碰 DOM —— 测试直接拿它算)
       ------------------------------------------------------------
       坐标制式(用户定的):原点在页面右上角,x 轴【向左】,单位是"一页的 1%"。
       走向(用户第二版提示词):
         ① 起点 (45, 0)
         ② 屏幕上 60° 往右下,到 y=9
         ③ 水平向右到 x=30
         ④ 屏幕上 45° 往右上,到 y=6
         ⑤ 水平向右到 x=10
         ⑥ 屏幕上 45° 往右下,到 x=6     ← 记此时 y = y₁
         ⑦ 垂直向下,到 y = 100 − y₁
         ⑧ 屏幕上 45° 往左下,到 x=10
         ⑨ 水平向右到 x=25
         ⑩ 屏幕上 60° 往左下,到下边框 y=100
       返回:{ path: 给 SVG 的 d(x_svg = 100 − x),user: 用户坐标下的顶点 }
       ------------------------------------------------------------ */
    function gFrame(w, h) {
        var k = h / w;                       /* 视口的高/宽比 */
        var y1;

        var p1 = [45, 0];
        var p2 = [p1[0] - (9 * k) / T60, 9];   /* ② 60°:Δy=9 ⇒ Δx = 9k/√3 */
        var p3 = [30, 9];                      /* ③ */
        var p4 = [p3[0] - 3 * k, 6];           /* ④ 45° 向上:Δy=3 ⇒ Δx = 3k */
        var p5 = [10, 6];                      /* ⑤ */
        var p6 = [6, 0];                       /* ⑥ 45° 向下:Δx=4 ⇒ Δy = 4/k */
        p6[1] = 6 + 4 / k;
        y1 = p6[1];
        var p7 = [6, 100 - y1];                /* ⑦ 用户自己给的关系式 */
        var p8 = [10, p7[1] + 4 / k];          /* ⑧ 45°:Δx=4 ⇒ Δy = 4/k(恒等于 94) */
        var p9 = [25, p8[1]];                  /* ⑨ */
        var p10 = [p9[0] + (6 * k) / T60, 100];/* ⑩ 60°:Δy=6 ⇒ Δx = 6k/√3 */

        var user = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
        var d = user.map(function (p, i) {
            var x = 100 - p[0];              /* SVG 的 x 向右为正 */
            return (i ? "L" : "M") + round(x) + " " + round(p[1]);
        }).join(" ");
        return { path: d, user: user, k: k, y1: y1 };
    }

    /* 输出保留 4 位小数:够精确,又不会让 d 属性长得没法看 */
    function round(v) {
        return Math.round(v * 1e4) / 1e4;
    }

    /* 把算出来的折线写到三层 path 上(它们必须永远同一条 d) */
    function drawFrame() {
        var svg = document.getElementById("page-hud");
        if (!svg) return;
        var w = window.innerWidth || document.documentElement.clientWidth || 0;
        var h = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!w || !h) return;
        var g = gFrame(w, h);
        var paths = svg.querySelectorAll("path");
        for (var i = 0; i < paths.length; i++) paths[i].setAttribute("d", g.path);
        svg.setAttribute("data-hud-frame", g.path);
        /* 顺带把它挂出来:探针/以后要按边框定位的东西都能读到真实值 */
        if (window.__hudFrame) window.__hudFrame.last = g;
    }

    if (typeof window !== "undefined") {
        window.__hudFrame = { gFrame: gFrame, draw: drawFrame, T60: T60 };
    }

    /* ------------------------------------------------------------
       以下都要 DOM:没有 DOM(测试里)就只导出上面的纯函数
       ------------------------------------------------------------ */
    if (typeof document === "undefined" || !document.getElementById) return;

    drawFrame();
    /* 视口一变,斜线的水平位移就得重算(角度是按视口长宽比换算的)。
       用 rAF 收一下,拖窗口时不要每像素都算。 */
    var pending = false;
    window.addEventListener("resize", function () {
        if (pending) return;
        pending = true;
        var run = function () { pending = false; drawFrame(); };
        if (window.requestAnimationFrame) window.requestAnimationFrame(run);
        else setTimeout(run, 120);
    });

    var root = document.documentElement;
    var P = window.__hudPalette;
    var byId = function (id) { return document.getElementById(id); };

    /* ---------------- 配色滑条 ---------------- */
    var hue = byId("palette-hue");
    var hueVal = byId("hud-hue-val");

    function paintHue() {
        if (!hueVal || !hue) return;
        /* 没拖过就显示"默认":那时候页面用的是站点自己的配色,
           写一个色相数字反而是在骗人(见 hud-palette.js 开头第 2 条)。 */
        hueVal.textContent = (P && P.stored() !== null)
            ? Math.round(parseFloat(hue.value)) + "°"
            : "默认";
    }

    if (hue && P) {
        hue.value = String(P.initialHue());
        paintHue();
        hue.addEventListener("input", function () {
            P.set(parseFloat(hue.value));
            paintHue();
        });
        /* 主题一切换,同一组变量要按新的深浅重算一遍 */
        if (window.MutationObserver) {
            new MutationObserver(function () {
                if (P.stored() !== null) P.apply(parseFloat(hue.value));
            }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
        }
    }

    /* ---------------- 音量滑条 ---------------- */
    var vol = byId("volume-range");
    var volVal = byId("hud-vol-val");

    function paintVol() {
        if (volVal && vol) volVal.textContent = vol.value + "%";
    }

    if (vol) {
        var v = 0.5;
        try {
            var f = parseFloat(localStorage.getItem("cd-audio-vol"));
            if (isFinite(f)) v = Math.min(1, Math.max(0, f));
        } catch (e) { }
        vol.value = String(Math.round(v * 100));
        paintVol();
        vol.addEventListener("input", function () {
            var n = Math.min(1, Math.max(0, parseFloat(vol.value) / 100));
            try { localStorage.setItem("cd-audio-vol", String(n)); } catch (e) { }
            /* 这个页面上真有音频模块时(以后加了播放器),让它跟着变 */
            try {
                window.dispatchEvent(new CustomEvent("hud-volume", { detail: n }));
            } catch (e) { }
            paintVol();
        });
    }
})();
