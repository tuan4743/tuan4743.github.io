/* ============================================================
   世界观数据库 · 全屏档案终端(arc-terminal.js)
   ─────────────────────────────────────────────────────────────
   左下角 ARCHIVE 按钮 → 原地拉起全屏档案终端(不跳页):
   · 开机序列:条目按序解码入场(clip-path + blur);
   · 悬停:信号格已由 CSS 充能;条目点击就地展开著录详情
     (载体/完整性/ECHO 提示/「打开原文」链接);
   · 幕导航:左列 ACT I-VI,点击滚动到对应幕;滚动时高亮跟随;
   · 退出:右上按钮 / Esc;开着的详情自动收起。
   数据:同一份 #hud-world-data(与 SSR /world/ 页同源)。
   ============================================================ */
(function () {
    "use strict";

    var raw = document.getElementById("hud-world-data");
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw.textContent) || {}; } catch (e) { return; }
    var items = data.items || [];
    if (!items.length) return;

    /* ---- 构 DOM(一次,复用) ---- */
    var root = document.createElement("div");
    root.className = "arc-t";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "世界观数据库 · 档案终端");

    /* 顶栏 */
    var bar = document.createElement("div");
    bar.className = "arc-t__bar";
    var FEED = "源事件 EID 7C41-0000-0900-3B7E · 中继 3 跳 · 距离 1,100 光年 · 泡壁抵达 T+1,222 · 剩余 122 年 · 时间和距离可以互相验算,这是本库唯一的自检方式 · 本数据库不提供结论 · 解码密码在于人 · ";
    bar.innerHTML =
        '<span class="arc-t__brand">虚界方舟 · 灰烬计划</span>' +
        '<span class="arc-t__feed" aria-hidden="true"><i>' + FEED + FEED + "</i></span>" +
        '<span class="arc-t__clock" aria-hidden="true"></span>' +
        '<button type="button" class="arc-t__close" aria-label="关闭档案终端">退出 ESC</button>';
    root.appendChild(bar);

    var main = document.createElement("div");
    main.className = "arc-t__main";

    /* 幕导航 */
    var acts = [];
    items.forEach(function (it) {
        if (!it.act) return;
        if (!acts.length || acts[acts.length - 1].name !== it.act) {
            acts.push({ name: it.act, items: [] });
        }
        acts[acts.length - 1].items.push(it);
    });

    var nav = document.createElement("nav");
    nav.className = "arc-t__nav";
    nav.innerHTML = '<p class="arc-t__nav-k">接收时序</p>';
    var navBtns = [];
    acts.forEach(function (a, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "arc-t__nav-i";
        b.setAttribute("data-no", "ACT " + roman(i + 1));
        b.innerHTML = "<b>" + esc(a.name) + "</b><span>" + a.items.length + " 份</span>";
        b.addEventListener("click", function () {
            var sec = root.querySelectorAll(".arc-act-t")[i];
            if (!sec) return;
            var top = sec.getBoundingClientRect().top -
                flow.getBoundingClientRect().top + flow.scrollTop - 12;
            flow.scrollTo({ top: top, behavior: "smooth" });
        });
        nav.appendChild(b);
        navBtns.push(b);
    });
    main.appendChild(nav);

    /* 档案流 */
    var flow = document.createElement("div");
    flow.className = "arc-t__flow";
    acts.forEach(function (a, ai) {
        var sec = document.createElement("section");
        sec.className = "arc-act-t";
        var head = document.createElement("header");
        head.className = "arc-act-t__head";
        head.innerHTML =
            '<span class="arc-act-t__act">ACT ' + roman(ai + 1) + "</span>" +
            "<h2 class=\"arc-act-t__name\">" + esc(a.name) + "</h2>" +
            '<span class="arc-act-t__note">' + a.items.length + " 份回收</span>";
        sec.appendChild(head);

        var list = document.createElement("div");
        list.className = "arc-t__list";
        a.items.forEach(function (it, k) {
            var el = document.createElement("button");
            el.type = "button";
            el.className = "arc-it";
            el.style.setProperty("--d", String(ai * 90 + k * 55));
            var meta = [it.time, it.carrier].filter(Boolean).map(esc)
                .map(function (s) { return "<em>" + s + "</em>"; }).join("");
            el.innerHTML =
                '<span class="arc-it__no">' + esc(it.no || "") + "</span>" +
                '<span class="arc-it__body">' +
                '<span class="arc-it__title">' + esc(it.title || "") + "</span>" +
                '<span class="arc-it__meta">' + meta + "</span>" +
                "</span>" +
                '<span class="arc-it__int">' + esc((it.integrity || "").replace(/^完整性/, "").trim() || "—") + "</span>" +
                '<span class="arc-it__detail">' +
                "<div>" + (it.carrier ? "载体 <b>" + esc(it.carrier) + "</b> · " : "") +
                "完整性 <b>" + esc(it.integrity || "未知") + "</b></div>" +
                (it.hint ? '<div class="arc-it__hint" data-hint="' + esc(it.hint) + '" hidden></div>' : "") +
                '<a class="arc-it__go" href="' + esc(it.url || "#") + '">打开原文 →</a>' +
                "</span>";
            el.addEventListener("click", function (e) {
                if (e.target.closest(".arc-it__go")) return;   /* 链接放行 */
                var openNow = el.classList.contains("is-open");
                list.querySelectorAll(".arc-it.is-open").forEach(function (o) {
                    o.classList.remove("is-open");
                });
                if (!openNow) {
                    el.classList.add("is-open");
                    typeHint(el);
                }
            });
            list.appendChild(el);
        });
        sec.appendChild(list);
        flow.appendChild(sec);
    });
    main.appendChild(flow);
    root.appendChild(main);

    /* 扫描线 */
    var scan = document.createElement("i");
    scan.className = "arc-t__scan";
    scan.setAttribute("aria-hidden", "true");
    root.appendChild(scan);

    document.body.appendChild(root);

    /* ---- 状态机 ---- */
    var open = false;
    function show() {
        if (open) return;
        open = true;
        root.hidden = false;
        /* 重触发入场动画 */
        root.querySelectorAll(".arc-it").forEach(function (el) {
            el.style.animation = "none";
            void el.offsetWidth;
            el.style.animation = "";
        });
        requestAnimationFrame(function () { root.classList.add("is-open"); });
        tickClock();
    }
    function hide() {
        if (!open) return;
        open = false;
        /* 收终端时掐掉 ECHO 打字机,别让她在看不见的地方继续说 */
        typeTimers.forEach(function (t) { clearInterval(t); });
        typeTimers.length = 0;
        root.classList.remove("is-open");
        root.querySelectorAll(".arc-it.is-open").forEach(function (o) {
            o.classList.remove("is-open");
        });
        setTimeout(function () { if (!open) root.hidden = true; }, 360);
    }

    function roman(n) {
        var R = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        return R[n - 1] || String(n);
    }

    /* ---- ECHO 的提示:不是印在卡片上的字段,是她【不情愿地】打出来的。
       第一次点开著录:先打一行牢骚,停一拍,才把提示逐字吐出来。
       同一条第二次展开不再重播(她说过的话不会重复)。语气与
       hud-echo.js 的 ECHO 同一人:短句、省略号、别扭。 ---- */
    var GRUMBLE = [
        "……你要看的是档案,不是我。行吧。",
        "这个也想问。记性吗。",
        "哈。这条我也刚注意到,不说破就没人知道。",
        "别到处说这是我讲的。"
    ];
    var grumbleIdx = 0;
    var hinted = {};                                 /* no → 已打过 */
    var typeTimers = [];

    function typeInto(el, text, cps, done) {
        var i = 0;
        var t = setInterval(function () {
            i += 1;
            el.textContent = text.slice(0, i);
            if (i >= text.length) {
                clearInterval(t);
                if (done) done();
            }
        }, cps);
        typeTimers.push(t);
    }

    function typeHint(el) {
        var box = el.querySelector(".arc-it__hint");
        if (!box || box.dataset.done === "1") return;
        var no = el.querySelector(".arc-it__no").textContent.trim();
        var line = box.getAttribute("data-hint") || "";
        if (!line) return;
        if (hinted[no]) {                            /* 第二次:整句直接挂上 */
            box.hidden = false;
            box.dataset.done = "1";
            box.textContent = line;
            return;
        }
        hinted[no] = true;
        box.dataset.done = "1";
        box.hidden = false;
        box.textContent = "";
        var gr = GRUMBLE[grumbleIdx % GRUMBLE.length];
        grumbleIdx += 1;
        var reduced = window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            box.textContent = gr + " — " + line;
            return;
        }
        typeInto(box, gr, 30, function () {
            setTimeout(function () {
                var br = document.createElement("div");
                br.className = "arc-it__hint-line";
                box.appendChild(br);
                typeInto(br, line, 26, function () {
                    br.classList.add("is-done");
                });
            }, 620);
        });
    }

    function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    /* 顶栏时钟:方舟时间(开机后 N 年的戏仿用真实时钟即可,克制的细节) */
    function tickClock() {
        if (!open) return;
        var c = bar.querySelector(".arc-t__clock");
        if (c) {
            var d = new Date();
            var pad = function (n) { return (n < 10 ? "0" : "") + n; };
            c.textContent = "T+" + d.getFullYear() + "." + pad(d.getMonth() + 1) + "." + pad(d.getDate()) +
                " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
        }
        setTimeout(tickClock, 1000);
    }

    /* 幕导航滚动高亮 */
    flow.addEventListener("scroll", function () {
        var secs = root.querySelectorAll(".arc-act-t");
        var cur = 0;
        for (var i = 0; i < secs.length; i++) {
            if (secs[i].offsetTop - flow.offsetTop - flow.scrollTop < 60) cur = i;
        }
        navBtns.forEach(function (b, i) { b.classList.toggle("is-on", i === cur); });
    }, { passive: true });

    /* 退出 */
    bar.querySelector(".arc-t__close").addEventListener("click", hide);
    document.addEventListener("keydown", function (e) {
        if (!open) return;
        if (e.key === "Escape") {
            var t = e.target;
            var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
            if (!typing) hide();
        }
    });

    /* ---- 入口:左下角 ARCHIVE 按钮 ----
       hud-left.js 的统一点击分发里 world 分支调 __arcTerminal.show();
       这里只暴露接口(按钮的 click 不在这里绑,避免双开)。 */
    /* SSR 页(/world/):页面本身已有同款静态结构;终端只由 HUD 按钮唤起,
       URL 直接访问落到静态页,行为一致。 */
    window.__arcTerminal = { show: show, hide: hide, isOpen: function () { return open; } };
})();
