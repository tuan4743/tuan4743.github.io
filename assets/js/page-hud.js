/* ============================================================
   右侧 HUD 的交互层 + 边框几何(第二阶段)
   ─────────────────────────────────────────────────────────────
   这一版管五件事:
     1) 边框:按用户给的走向算顶点(下面的 gFrame 是纯函数,可单独验);
     2) 配色滑条(#palette-hue)→ 调 window.__hudPalette;
     3) 音量滑条(#volume-range)→ 写 cd-audio.js 读的那个键(cd-audio-vol);
     4) 三支笔:按一下激活 + 就地展开尺寸滑条(同时只开一支);
     5) 微信按钮:点出二维码,点别处/Esc 收回。
   明暗按钮(#theme-toggle)【不需要这里绑】:主题的 footer 脚本按 id 找它。

   ★★ 角度是【屏幕上的角度】(用户纠正过两次):
      "你的角度理解错了,你现在画的是与水平方向30°,而我要的是60°,陡一点的线。
       而且你这个45°完全不是45°啊。"
      换算:屏幕 tan(角) = (Δy% × 视口高) ÷ (Δx% × 视口宽)
            ⇒ Δx% = Δy% × (视口高 ÷ 视口宽) ÷ tan(角)
      ⇒ 斜线的水平位移与视口长宽比有关 ⇒ 折线只能在运行时算。
        模板里那份是 16:9 参考值,两边必须逐字相同(tests 里钉着)。
   ============================================================ */
(function () {
    "use strict";

    var T60 = Math.tan(Math.PI / 3);   /* tan60° = √3 */

    /* ------------------------------------------------------------
       边框几何(纯函数,不碰 DOM —— 测试直接拿它算)
       ------------------------------------------------------------
       坐标制式(用户定的):原点在页面右上角,x 轴【向左】,单位 = 一页的 1%。
       走向(用户第三版提示词):
         ① 起点 (45, 0)                     ② 屏幕 60° 往右下,到 y=9
         ③ 水平向右到 x=30                  ④ 屏幕 45° 往右上,到 y=6
         ⑤ 水平向右到 x=8                   ⑥ 屏幕 45° 往右下,到 x=5  ← y₁
         ⑦ 垂直向下,到 y = 100 − y₁         ⑧ 屏幕 45° 往左下,到 x=8
         ⑨ 水平向右到 x=35                  ⑩ 屏幕 60° 往左下,到下边框 y=100
       ★ ⑨ 原来是 25,第四刀之后改成 35:底带要塞下三支笔 + 展开出来的尺寸滑条,
         25% 的宽度在 1236px 的窗口上不够,笔会顶出框外(用户报的"笔顶出去了")。
       返回:{ path: 给 SVG 的 d(x_svg = 100 − x),fill: 闭合版(给底板用),
              user: 用户坐标下的顶点 }
       ------------------------------------------------------------ */
    function gFrame(w, h) {
        var k = h / w;                       /* 视口的高/宽比 */
        var y1;

        var p1 = [45, 0];
        var p2 = [p1[0] - (9 * k) / T60, 9];   /* ② 60°:Δy=9 ⇒ Δx = 9k/√3 */
        var p3 = [30, 9];                      /* ③ */
        var p4 = [p3[0] - 3 * k, 6];           /* ④ 45° 向上:Δy=3 ⇒ Δx = 3k */
        var p5 = [8, 6];                       /* ⑤ */
        var p6 = [5, 0];                       /* ⑥ 45° 向下:Δx=3 ⇒ Δy = 3/k */
        p6[1] = 6 + 3 / k;
        y1 = p6[1];
        var p7 = [5, 100 - y1];                /* ⑦ 用户自己给的关系式 */
        var p8 = [8, p7[1] + 3 / k];           /* ⑧ 45°:Δx=3 ⇒ Δy = 3/k(恒等于 94) */
        var p9 = [35, p8[1]];                  /* ⑨ */
        var p10 = [p9[0] + (6 * k) / T60, 100];/* ⑩ 60°:Δy=6 ⇒ Δx = 6k/√3 */

        var user = [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10];
        var d = user.map(function (p, i) {
            return (i ? "L" : "M") + round(100 - p[0]) + " " + round(p[1]);
        }).join(" ");
        /* 底板用的闭合折线:沿页底往右 → 沿页右缘往上 → 回到起点。
           不闭合成"首尾直连"那条直线(那样会把大半个页面斜着切掉)。 */
        var fill = d + " L100 100 L100 0 Z";
        return { path: d, fill: fill, user: user, k: k, y1: y1 };
    }

    function round(v) {
        return Math.round(v * 1e4) / 1e4;
    }

    /* 把算出来的折线写到三条 path 上(它们必须永远同一条 d)
       ★★★ 选择器【必须】限定在边框那支 SVG 里(.page-hud__frame)。
         第一版写的是 root.querySelectorAll("path") —— root 是整个 HUD,
         于是导航图标、三枚按钮图标里凡是用 <path> 画的,d 全被改成了这条折线
         (坐标 0~100,塞进 24×24 的图标 viewBox 里 ⇒ 什么都看不见)。
         症状极具误导性:用 <polyline>/<rect>/<line>/<circle> 画的图标
         (技术 / 归档 / 关于的头)一切正常,用 <path> 画的(主页 / 留言 / 三个按钮)
         整只消失 —— 看着像"素材丢了",其实是自己的 JS 把它们改没了。
         测试里现在有一条:只有 .page-hud__frame 里的 path 会被写 d。 */
    function drawFrame() {
        var root = document.getElementById("page-hud");
        if (!root) return;
        var w = window.innerWidth || document.documentElement.clientWidth || 0;
        var h = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!w || !h) return;
        var g = gFrame(w, h);
        var paths = root.querySelectorAll(".hud-halo, .hud-line, .hud-run");
        for (var i = 0; i < paths.length; i++) paths[i].setAttribute("d", g.path);
        /* 底板:同一圈轮廓的【闭合版】—— 它把框里那一块盖住,
           正文滚过去时不会从框里透出来(用户要的"覆盖效果")。 */
        var fill = root.querySelector(".hud-fill");
        if (fill) fill.setAttribute("d", g.fill);
        root.setAttribute("data-hud-frame", g.path);
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
    /* 视口一变,斜线的水平位移就得重算(角度是按长宽比换算的)。
       用 rAF 收一下,拖窗口时不要每像素都算。 */
    var pending = false;
    window.addEventListener("resize", function () {
        if (pending) return;
        pending = true;
        var run = function () { pending = false; drawFrame(); };
        if (window.requestAnimationFrame) window.requestAnimationFrame(run);
        else setTimeout(run, 120);
    });

    var rootEl = document.documentElement;
    var byId = function (id) { return document.getElementById(id); };
    var store = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };

    /* ---------------- 配色滑条 ---------------- */
    var P = window.__hudPalette;
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
            }).observe(rootEl, { attributes: true, attributeFilter: ["data-theme"] });
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
        var raw = store.get("cd-audio-vol");
        var f = parseFloat(raw);
        if (isFinite(f)) v = Math.min(1, Math.max(0, f));
        vol.value = String(Math.round(v * 100));
        paintVol();
        vol.addEventListener("input", function () {
            var n = Math.min(1, Math.max(0, parseFloat(vol.value) / 100));
            store.set("cd-audio-vol", String(n));
            /* 这个页面上真有音频模块时(以后加了播放器),让它跟着变 */
            try {
                window.dispatchEvent(new CustomEvent("hud-volume", { detail: n }));
            } catch (e) { }
            paintVol();
        });
    }

    /* ---------------- HUD 自己那颗搜索清空按钮(×) ----------------
       ★ 为什么不用浏览器自带的那颗(input[type=search] 的 cancel 按钮):
         它只派发 search、不派发 input(部分浏览器就是这样),于是点了 ×
         面板不收、结果不清 —— 用户原话"右侧的×没用"。
         这颗直接清空输入框 + 调组件自己暴露的 clear(),任何浏览器一个样。
       ★ 没内容的时候它自己是 hidden 的(CSS 里 .hud-search__clear[hidden] 有 display:none
         —— 不写这一条的话,那个 display:inline-flex 会把 hidden 属性盖掉)。 */
    var sInput = byId("header-search-input");
    var sClear = byId("hud-search-clear");

    function paintClear() {
        if (sClear) sClear.hidden = !(sInput && sInput.value);
    }

    if (sInput && sClear) {
        sInput.addEventListener("input", paintClear);
        sInput.addEventListener("search", paintClear);
        sClear.addEventListener("click", function (e) {
            e.stopPropagation();
            var root = byId("header-search");
            var inst = root && root.__search;
            if (inst && inst.clear) {
                inst.clear();
            } else {
                sInput.value = "";
                var panel = byId("header-search-results");
                if (panel) panel.hidden = true;
            }
            paintClear();
            sInput.focus();
        });
        paintClear();
    }

    /* ---------------- 三支笔:激活 + 展开尺寸滑条 ----------------
       ★ 同时只开一支(用户:"同样做好自动重排" —— 展开的那一支靠 flex
         把同一行里其它按钮挤开,不需要手写位移动画)。
       ★ 尺寸【存 localStorage】;笔还没有真正落笔的地方(画布是后面的事),
         所以展开那截里放了一颗跟着变大的圆点当预览 —— 不做"按了没反应"的控件。 */
    var PEN_ON = "hud-pen";
    var PEN_SIZE = "hud-pen-size";
    var penSizes = {};
    try { penSizes = JSON.parse(store.get(PEN_SIZE) || "{}") || {}; } catch (e) { penSizes = {}; }

    var pens = [].slice.call(document.querySelectorAll("[data-hud-pen]"));
    var penInputs = [].slice.call(document.querySelectorAll("[data-hud-pen-size]"));

    function setPenSize(name, val) {
        penSizes[name] = val;
        store.set(PEN_SIZE, JSON.stringify(penSizes));
        var el = document.querySelector('[data-hud-pen="' + name + '"]');
        if (el) el.style.setProperty("--pen-size", String(val));
    }

    penInputs.forEach(function (input) {
        var name = input.getAttribute("data-hud-pen-size");
        var saved = penSizes[name];
        if (saved !== undefined && isFinite(parseFloat(saved))) input.value = String(saved);
        setPenSize(name, parseFloat(input.value));
        input.addEventListener("input", function () { setPenSize(name, parseFloat(input.value)); });
        /* 拖滑条时别让它顺手把按钮点了/把页面划了 */
        input.addEventListener("click", function (e) { e.stopPropagation(); });
    });

    function activatePen(name) {
        pens.forEach(function (p) {
            var on = p.getAttribute("data-hud-pen") === name;
            p.classList.toggle("is-on", on);
            var btn = p.querySelector(".hud-pen__btn");
            if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        store.set(PEN_ON, name || "");
    }

    pens.forEach(function (p) {
        var name = p.getAttribute("data-hud-pen");
        var btn = p.querySelector(".hud-pen__btn");
        if (!btn) return;
        btn.addEventListener("click", function () {
            /* 再按一次就收起来(展开->收起也要能走回去) */
            activatePen(p.classList.contains("is-on") ? "" : name);
        });
    });
    /* 刷新后不自动展开:工具默认是收着的(要用了才展开,免得挡住底带) */
    activatePen("");

    /* ---------------- 微信二维码 ---------------- */
    var wxBtn = byId("hud-wechat");
    var qr = byId("hud-qr");

    function setQr(open) {
        if (!qr || !wxBtn) return;
        qr.hidden = !open;
        wxBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    if (wxBtn && qr) {
        wxBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            setQr(qr.hidden);
        });
        document.addEventListener("click", function () { setQr(false); });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") setQr(false);
        });
    }
})();
