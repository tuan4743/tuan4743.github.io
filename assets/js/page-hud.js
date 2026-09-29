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
    function gFrame(w, h, bandX) {
        var k = h / w;                       /* 视口的高/宽比 */
        var y1;
        /* ★ ⑨ 的横坐标(= 底带往左伸到哪)是【一个接口】:默认 35,
           也可以在 CSS 里改 --hud-band-x,drawFrame 会把它读进来传给这里 ——
           一个数同时管折线和三支笔那一行的宽度(用户:"把 x 从 25 扩到 30 我感觉就差不多了")。 */
        var bx = isFinite(parseFloat(bandX)) ? parseFloat(bandX) : 35;

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
        var p9 = [bx, p8[1]];                  /* ⑨(底带往左伸到 bx%)*/
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

    /* ------------------------------------------------------------
       左下角 UHD 的折线 = 右侧那条【整条镜像】
       (用户:"整体 UHD 对称,因此模块大小相同,左侧和下侧的 UHD 对称")
       ------------------------------------------------------------
       变换只有两件事:
         ① x' = 100 − x(关于竖直中线翻)
         ② 顶点顺序【倒过来】—— 不翻顺序的话起点/终点换了头:右侧是"从顶边
            走到页底",镜像后成了"从页底走到顶边",折线形状一样,但跑马灯和
            "挂在路径上的按钮"全会错位。
       ★★ 底边收口用 63.0514(右侧那条 d 的终点),不是镜像出来的 36.9486:
          右侧底板写的是 d + "L100 100 L100 0 Z",它沿页底从 63.0514 盖到 100;
          左边镜像过来是 0 盖到 36.9486 ⇒ 中间 26% 是空的,看着像底板断了一截。
          接上之后两条带子在页底首尾相接。对折线本身没有影响(那一段贴着页底 y=100)。
       ★ 其余顶点全是纯镜像,不额外调整 —— 一调整左右就不对称了。
       ------------------------------------------------------------ */
    function gFrameLeft(w, h, bandX) {
        var g = gFrame(w, h, bandX);
        /* ★★ 顺序很重要,别跳步:先把右侧顶点换成【屏幕坐标】,再镜像、再倒序。
           我第一版是"先在用户坐标里镜像、最后再 100−x 转屏幕",等于把镜像
           做了两遍又漏了一次转换 —— 收口那点变成 (36.95, 0),折线最后一段从
           页底一路斜穿回左上角。形状类的东西,坐标系只能有一个口径。 */
        var scr = g.user.map(function (p) { return [100 - p[0], p[1]]; });   /* 右侧 d 的点 */
        var pts = scr.map(function (p) { return [100 - p[0], p[1]]; }).reverse();
        var meet = scr[scr.length - 1][0];                    /* 右侧底边收口 x = 63.0514 */
        /* ★★ 是 push 不是替换:镜像倒序之后末尾那个点正是【顶部凸起】的顶点
           (45,0),替换掉它等于把这一整个凸起削平 —— 上一版就是这么错的,
           表现是"左上角少了一块、折线从页底斜着连到 (45,0)"。
           追加之后左支比右支多一个点(收口点没有镜像对应物),比对时要注意。 */
        pts.push([meet, 100]);                                /* 追加收口点 ⇒ 页底连成一条 */
        var d = pts.map(function (p, i) {
            return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
        }).join(" ");
        return { path: d, fill: d + " L0 100 L0 0 Z", user: pts, k: g.k, meet: meet };
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
        /* 底带宽度:优先读 CSS 里的 --hud-band-x(接口),读不到就用默认 35 */
        var bandX = null;
        try {
            var cs = window.getComputedStyle ? window.getComputedStyle(root).getPropertyValue("--hud-band-x") : "";
            bandX = parseFloat(String(cs).replace("%", ""));
        } catch (e) { }
        var g = gFrame(w, h, bandX);
        var paths = root.querySelectorAll(".hud-halo, .hud-line, .hud-run");
        for (var i = 0; i < paths.length; i++) paths[i].setAttribute("d", g.path);
        /* 底板:同一圈轮廓的【闭合版】—— 它把框里那一块盖住,
           正文滚过去时不会从框里透出来(用户要的"覆盖效果")。 */
        var fill = root.querySelector(".hud-fill");
        if (fill) fill.setAttribute("d", g.fill);
        root.setAttribute("data-hud-frame", g.path);
        if (window.__hudFrame) window.__hudFrame.last = g;

        /* ---------- 左下角 UHD(第一刀:只画形状)----------
           ★ 左支 SVG 是【独立的一支】(.page-hud__frame--left),不是把右侧折线拼长:
             两条线共用同一套 0~100 百分比坐标,分开画最简单,也不会互相改写 d。
           ★ 选择器必须限定在左支 SVG 里 —— 上面那条注释里的坑:写成
             root.querySelectorAll("path") 会把所有图标里的 path 一起改掉。
           ★ 拿不到这支 SVG 就安静跳过(旧产物/别的页面可能还没有它)。 */
        var leftRoot = root.querySelector(".page-hud__frame--left");
        if (leftRoot) {
            var gl = gFrameLeft(w, h, bandX);
            var lps = leftRoot.querySelectorAll(".hud-halo, .hud-line, .hud-run");
            for (var j = 0; j < lps.length; j++) lps[j].setAttribute("d", gl.path);
            var lfill = leftRoot.querySelector(".hud-fill");
            if (lfill) lfill.setAttribute("d", gl.fill);
            leftRoot.setAttribute("data-hud-frame-left", gl.path);
            g.left = gl;
        }
        if (window.__hudFrame) window.__hudFrame.last = g;
    }

    if (typeof window !== "undefined") {
        window.__hudFrame = { gFrame: gFrame, gFrameLeft: gFrameLeft, draw: drawFrame, T60: T60 };
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
        publishPenCursor();
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

    /* ---- 笔的鼠标形态(用户第九轮)----
       · 记号笔 → ×,实时跟手;
       · 荧光笔 / 橡皮 → 圆框,直径 = 那支笔选的大小;
       · 没选笔 → 恢复默认的矩形扫描框。
       配置写进 window.__mcPenCfg,magnetic-cursor.js 每帧读它(松耦合:
       它不需要知道 HUD 里选了哪支笔)。 */
    function publishPenCursor() {
        var on = null;
        for (var i = 0; i < pens.length; i++) if (pens[i].classList.contains("is-on")) on = pens[i];
        /* ★★★ 这里原来写的是 if (!on || !window.__mcPenCfg) —— 鸡生蛋:
           __mcPenCfg 一开始就是 undefined,于是永远判定"没有配置"、永远置 null,
           笔的鼠标形态一次都没生效(用户:"把我说的笔的那三个改动加一下")。
           正确条件只看"有没有选中笔"。 */
        if (!on) { window.__mcPenCfg = null; return; }
        var name = on.getAttribute("data-hud-pen");
        var size = parseFloat(penSizes[name]);
        if (!isFinite(size)) size = 8;
        /* 尺寸滑动条是 1~24(Markdown 里的"笔尖大小"),换算成屏幕像素:
           圆形框给直径(×1.7),× 给臂长(×0.75) */
        window.__mcPenCfg = name === "annot"
            ? { shape: "x", size: Math.round(6 + size * 0.75) }
            : { shape: "circle", size: Math.round(size * 1.7) };
    }

    /* ---- 笔色(用户第七轮:"笔应该还要加一个调节颜色的滑块,或者几个颜色的选项")----
       选了"几个颜色的选项":五颗圆点。颜色和大小一样存 localStorage,
       而且写进那支笔的 --pen-color —— 预览球跟着变色,不然就是个"点了没反应"的控件。 */
    var PEN_COLOR = "hud-pen-color";
    var penColors = {};
    try { penColors = JSON.parse(store.get(PEN_COLOR) || "{}") || {}; } catch (e) { penColors = {}; }

    function paintPenColor(name, color) {
        var el = document.querySelector('[data-hud-pen="' + name + '"]');
        if (!el) return;
        el.style.setProperty("--pen-color", color);
        var dots = el.querySelectorAll(".hud-pen__swatch");
        for (var i = 0; i < dots.length; i++) {
            dots[i].classList.toggle("is-on", dots[i].getAttribute("data-pen-c") === color);
        }
    }

    function setPenColor(name, color) {
        penColors[name] = color;
        store.set(PEN_COLOR, JSON.stringify(penColors));
        paintPenColor(name, color);
    }

    [].slice.call(document.querySelectorAll(".hud-pen__swatch")).forEach(function (dot) {
        var name = dot.getAttribute("data-hud-pen-color");
        var m = /--pen-c:\s*([^;"]+)/.exec(dot.getAttribute("style") || "");
        var color = m ? m[1].trim() : "#eaf3ff";
        dot.setAttribute("data-pen-c", color);
        dot.addEventListener("click", function (e) {
            e.stopPropagation();
            setPenColor(name, color);
        });
        if (penColors[name] === color) paintPenColor(name, color);
    });

    function activatePen(name) {
        pens.forEach(function (p) {
            var on = p.getAttribute("data-hud-pen") === name;
            p.classList.toggle("is-on", on);
            var btn = p.querySelector(".hud-pen__btn");
            if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        store.set(PEN_ON, name || "");
        publishPenCursor();
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
    Object.keys(penColors).forEach(function (n) { paintPenColor(n, penColors[n]); });

    /* ---------------- 微信:复制微信号 ----------------
       ★ 用户第八轮:"点微信这个按钮出来的二维码好小,不如干脆复制我的微信号到剪切板算了:tuagfey."
       ★ 剪贴板 API 在非 https / 旧浏览器上可能没有 ⇒ 退回 execCommand 那条老路,
         再不行就把微信号【显示出来】让用户自己抄(不能点了没反应)。 */
    var wxBtn = byId("hud-wechat");
    var toast = byId("hud-toast");
    var toastTimer = null;

    function say(text) {
        if (!toast) return;
        toast.textContent = text;
        toast.hidden = false;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.hidden = true; }, 1800);
    }

    function fallbackCopy(text) {
        try {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            var ok = document.execCommand && document.execCommand("copy");
            document.body.removeChild(ta);
            return !!ok;
        } catch (e) { return false; }
    }

    if (wxBtn) {
        wxBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var text = wxBtn.getAttribute("data-copy") || "";
            var done = function (ok) { say(ok ? "已复制微信号:" + text : "微信号:" + text); };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
            } else {
                done(fallbackCopy(text));
            }
        });
        document.addEventListener("click", function () { if (toast) toast.hidden = true; });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape" && toast) toast.hidden = true; });
    }
})();
