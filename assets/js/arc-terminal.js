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
    /* ---- 解密门(按内容定制, 简单不绕):
       部分档案带着"未解密"标记, 点开著录先给一道小题,
       答对才正式展开(完整著录 + 问 ECHO + 打开原文)。
       题目按编号挑:全是档案内容里能直接找到/一眼算的,
       目的是"回去看一眼原文", 不是脑筋急转弯。
       ★ 必须声明在条目构建之前 —— var 提升只提升声明不提升赋值,
         放在调用点之后 GATES 是 undefined, 整个终端建到一半就崩。 ---- */
    var GATES = {
        /* ★ 题目必须自包含:题面在终端里就能答(卡片上的编号/时间/完整性),
           不能依赖原文 —— 否则"看原文要解密、解密要看原文"死锁。 */
        "01": { q: "本档案编号的两位数字之和?", a: ["1"], tip: "0 + 1" },
        "08": { q: "把编号 08 的两位数字对调, 得到多少?", a: ["80"], tip: "口算" },
        "12": { q: "61 比 39, 差是多少?(这条的题面就写在第一幕注记里)", a: ["22", "二十二"], tip: "口算" },
        "18": { q: "编号 18 倒过来写是多少?", a: ["81"], tip: "口算" },
        "23": { q: "本卡的完整性百分比, 十位数字是?", a: ["9"], tip: "看右缘" },
        "26": { q: "编号 26 加上 22, 等于本幕最后一份的编号, 它是多少?", a: ["48"], tip: "口算" }
    };
    function gateFor(no) { return GATES[no] || null; }

    /* 已解密过的档案不再上锁(localStorage 持久) */
    var unlockedSet = {};
    try {
        (JSON.parse(localStorage.getItem("arc-unlocked") || "[]") || []).forEach(function (n) {
            unlockedSet[n] = true;
        });
    } catch (e) { }
    function unlockedBefore(no) { return !!unlockedSet[no]; }

    /* 正式著录区内容(解锁后由 gate 替换进来;未锁卡直接渲染) */
    function detailInner(it) {
        return "<div>" + (it.carrier ? "载体 <b>" + esc(it.carrier) + "</b> · " : "") +
            "完整性 <b>" + esc(it.integrity || "未知") + "</b></div>" +
            /* ECHO 提示:小按钮触发(点开著录不自动吐), 她逐字打 */
            (it.hint ? '<button type="button" class="arc-it__ask">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linecap="round" aria-hidden="true">' +
            '<rect x="3" y="5" width="18" height="12" rx="2"/>' +
            '<path d="M7 9h.01M11 9h.01M15 9h.01M7 13h10"/>' +
            '<path d="M9 17l-2 3 5-3"/>' +
            "</svg><span>ECHO 解密提示</span></button>" +
            '<div class="arc-it__hint" data-hint="' + esc(it.hint) + '" hidden></div>' : "") +
            /* 跳转前先播收场动画:拦截点击 → hide() → 动画走完再真跳 */
            '<a class="arc-it__go" href="' + esc(it.url || "#") + '" data-go>打开原文 →</a>';
    }

    function detailHTML(it) {
        return '<span class="arc-it__detail">' + detailInner(it) + "</span>";
    }

    var bar = document.createElement("div");
    bar.className = "arc-t__bar";
    var FEED = "源事件 EID 7C41-0000-0900-3B7E · 中继 3 跳 · 距离 1,100 光年 · 泡壁抵达 T+1,222 · 剩余 122 年 · 时间和距离可以互相验算,这是本库唯一的自检方式 · 本数据库不提供结论 · 解码密码在于人 · ";
    var FEED2 = "收录 " + items.length + " 份回收档案 · 六幕接收窗口 · 弱信号档案以完整性标注 · 相变时间 T = 澜的源事件 · 泡壁速度 0.9c · 方舟内部另用开机后计时 · 本库唯一自检:验算 · ";
    /* 方舟 LOGO(SVG):三层弧线环(广播扩散)+ 中央一粒源点 */
    var LOGO =
        '<svg class="arc-t__logo" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
        '<circle cx="24" cy="24" r="3.2" fill="currentColor"/>' +
        '<circle cx="24" cy="24" r="10" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-dasharray="42 21" stroke-linecap="round"/>' +
        '<circle cx="24" cy="24" r="17.5" stroke="currentColor" stroke-width="1.1" ' +
        'stroke-dasharray="70 40" stroke-linecap="round" opacity="0.7"/>' +
        '<circle cx="24" cy="24" r="23" stroke="currentColor" stroke-width="0.8" ' +
        'stroke-dasharray="16 26 9 26" stroke-linecap="round" opacity="0.45"/>' +
        "</svg>";

    /* 顶栏:LOGO + 双行著录(feed 两行交错滚动)+ 时钟 + 退出 */
    bar.innerHTML =
        '<span class="arc-t__brand">' + LOGO +
        "<span class=\"arc-t__brand-t\"><b>虚界方舟</b><i>灰烬计划 · 回收档案库</i></span></span>" +
        '<span class="arc-t__feed" aria-hidden="true">' +
        '<i class="arc-t__feed-l">' + FEED + FEED + "</i>" +
        '<i class="arc-t__feed-r">' + FEED2 + FEED2 + "</i>" +
        "</span>" +
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
                (gateFor(it.no || "") && !unlockedBefore(it.no)
                    ? ""   /* 上锁卡:著录区在下面以解密门注入 */
                    : '<span class="arc-it__detail">' + detailInner(it) + "</span>");
            var gate = gateFor(it.no || "") && !unlockedBefore(it.no);
            if (gate) {
                /* 未解密:著录区先显示解密门, 答对才把正式内容换进来 */
                el.classList.add("is-locked");
                el.insertAdjacentHTML("beforeend",
                    '<span class="arc-it__detail arc-it__gate">' +
                    '<div class="arc-it__gate-q"><b>未解密</b> — ' + esc(gate.q) +
                    ' <span class="arc-it__gate-tip">(提示:' + esc(gate.tip) + ")</span></div>" +
                    '<div class="arc-it__gate-row">' +
                    '<input class="arc-it__gate-in" type="text" placeholder="输入答案…" aria-label="解密答案">' +
                    '<button type="button" class="arc-it__gate-go">解密</button>' +
                    "</div>" +
                    '<div class="arc-it__gate-err" hidden></div>' +
                    "</span>");
            }
            el.addEventListener("click", function (e) {
                /* 打开原文:先播收场动画, 走完再真跳 —— 不做就是硬切 */
                var go = e.target.closest(".arc-it__go");
                if (go) {
                    e.preventDefault();
                    var href = go.getAttribute("href");
                    hide();
                    setTimeout(function () { location.href = href; }, 420);
                    return;
                }
                /* 「问 ECHO」由它自己的监听处理, 不走展开/收起 */
                if (e.target.closest(".arc-it__ask")) return;
                /* 解密门内的一切交互(输入框/解密按钮)不动展开态 ——
                   点输入框把卡片收起来等于把门拆了 */
                if (e.target.closest(".arc-it__gate")) return;
                var openNow = el.classList.contains("is-open");
                list.querySelectorAll(".arc-it.is-open").forEach(function (o) {
                    o.classList.remove("is-open");
                });
                if (!openNow) el.classList.add("is-open");
            });
            /* 解密门提交 */
            var gateEl = el.querySelector(".arc-it__gate");
            if (gateEl) {
                var unlock = function () {
                    var v = gateEl.querySelector(".arc-it__gate-in").value.trim();
                    var err = gateEl.querySelector(".arc-it__gate-err");
                    if (gate.a.indexOf(v) >= 0) {
                        el.classList.remove("is-locked");
                        el.classList.add("is-unlocked");
                        if (err) err.hidden = true;
                        /* 换上正式著录内容;解锁记录持久 —— 下次开终端不再锁 */
                        try {
                            var seen = JSON.parse(localStorage.getItem("arc-unlocked") || "[]");
                            if (seen.indexOf(it.no) < 0) {
                                seen.push(it.no);
                                localStorage.setItem("arc-unlocked", JSON.stringify(seen));
                            }
                        } catch (e) { }
                        gateEl.outerHTML = detailHTML(it);
                    } else {
                        if (err) {
                            err.textContent = "不对。(" + (v ? "「" + v + "」" : "空") + ")";
                            err.hidden = false;
                            /* 抖一下输入框:错了要看得见是输入错了 */
                            var inp = gateEl.querySelector(".arc-it__gate-in");
                            if (inp) {
                                inp.classList.remove("is-err");
                                void inp.offsetWidth;
                                inp.classList.add("is-err");
                            }
                        }
                    }
                };
                gateEl.querySelector(".arc-it__gate-go").addEventListener("click", function (e) {
                    e.stopPropagation();
                    unlock();
                });
                gateEl.querySelector(".arc-it__gate-in").addEventListener("keydown", function (e) {
                    if (e.key === "Enter") { e.stopPropagation(); unlock(); }
                    e.stopPropagation();
                });
            }
            /* 问 ECHO:委托到卡片上 —— 解锁后新生成的按钮也能用 */
            el.addEventListener("click", function (e) {
                if (e.target.closest(".arc-it__ask")) {
                    e.stopPropagation();
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

    /* 扫描线撤除(用户定稿:不符合整体语言) */

    document.body.appendChild(root);

    /* ---- 状态机 ---- */
    var open = false;
    var scrollY = 0;
    function show() {
        if (open) return;
        /* 撑开原点 = 左下角 ARCHIVE 按钮的实际位置(按钮没了兜底用左下) */
        var mod = document.querySelector('[data-hud-mod="world"]');
        if (mod) {
            var r = mod.getBoundingClientRect();
            root.style.setProperty("--arc-ox", Math.round(window.innerWidth - (r.left + r.width / 2)) + "px");
            root.style.setProperty("--arc-oy", Math.round(window.innerHeight - (r.top + r.height / 2)) + "px");
        }
        open = true;
        root.hidden = false;
        /* 终端开着时锁住背后页面滚动(全屏覆盖层, 底下的正文不该跟着滚) */
        scrollY = window.pageYOffset || 0;
        document.body.style.top = -scrollY + "px";
        document.body.classList.add("arc-t-lock");
        /* 重触发入场动画 */
        root.querySelectorAll(".arc-it").forEach(function (el) {
            el.style.animation = "none";
        });
        /* 双 rAF:先让浏览器把【关闭态】(clip 0)绘制并提交,
           下一帧才加 is-open 开始撑开 —— 否则关闭态和展开态挤在同一帧,
           表现为闪一下正常画面再从头播 */
        requestAnimationFrame(function () {
            root.querySelectorAll(".arc-it").forEach(function (el) {
                void el.offsetWidth;
                el.style.animation = "";
            });
            requestAnimationFrame(function () {
                root.classList.add("is-open");
            });
        });
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
        /* 与 CSS 收回时长(0.52s)对齐再 hidden —— 提前掐会闪 */
        setTimeout(function () {
            if (!open) {
                root.hidden = true;
                /* 解锁背后页面滚动, 恢复原位置 */
                document.body.classList.remove("arc-t-lock");
                document.body.style.top = "";
                window.scrollTo(0, scrollY);
            }
        }, 560);
    }

    function roman(n) {
        var R = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        return R[n - 1] || String(n);
    }

    /* 解密门定义已上移到条目构建之前(见文件头部注释) */

    /* ---- ECHO 的提示:不是印在卡片上的字段,是她【不情愿地】打出来的。
       点「问 ECHO」:先一行牢骚,停一拍,才把提示逐字吐出来。
       同一条第二次不再重播(她说过的话不会重复)。语气与
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
