/* ============================================================
   左下角 UHD —— 框上那几个模块按钮
   ─────────────────────────────────────────────────────────────
   用户:"左下角也搞一个 UHD,放几个模块,比如番茄钟,音乐播放器,时钟和日历,
         草稿纸,最左下角留的位置先留一个正方形的模块位置。"
   用户:"完成左侧UHD,实现和右边一样,是先用SVG画出边框,再往边框上塞按钮。"

   干三件事:
     ① 量面板几何:面板宽度 = 正文左缘 − 按钮右缘 − 间隙,只在 px 里算
        (和目录那块同一条规矩:正文 720px 居中,左缘随窗口宽度变)
     ② 开关模块:点方块开/关它的面板,同时只开一个
     ③ 渲染面板内容:番茄钟直接把已有的 #hud-timer 搬进来(同一个 DOM 节点,
        id / 事件 / localStorage 全都不动),别的模块各一小段

   ★ 按钮【位置】不在这里:那是 page-hud.js 算完折线顺手写下的 --hud-lb-*-x/y
     (凸起的高低跟视口长宽比有关,写死的百分比会从框里滑出去)。
     这里只负责"点开之后面板落在哪"。
   ★ 拿不到 #hud-left 就静默退出(列表页之外的页面、或样式没加载)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("hud-left");
  if (!root) return;
  var panel = document.getElementById("hud-left-panel");
  var body = document.getElementById("hud-left-body");
  var titleEl = document.getElementById("hud-left-title");
  var enEl = document.getElementById("hud-left-en");
  var closeBtn = document.getElementById("hud-left-close");
  var mods = [].slice.call(root.querySelectorAll("[data-hud-mod]"));
  if (!panel || !body || !titleEl) return;

  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;
  var timerEl = document.getElementById("hud-timer");
  var timerHome = timerEl ? timerEl.parentNode : null;
  var timerWasMin = null;

  /* ---------- ① 面板几何:量出来,不要猜 ---------- */
  var GAP = 12;          /* 按钮右缘 → 面板左缘 */
  var MIN_W = 170;       /* 比这窄就只留按钮、不弹面板 */
  var MAX_W = 320;
  var last = null;

  function layout() {
    if (!current) return;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    /* ★ 量的是图标那小块(.hud-left__face),不是按钮本身:按钮是【铺满整层】的
       (靠 clip-path 收成梯形),它的 getBoundingClientRect 是整个视口。 */
    var host = root.querySelector('[data-hud-mod="' + current + '"] .hud-left__face');
    var r = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
    var mainLeft = main.getBoundingClientRect().left;
    var left = Math.round((r && r.right ? r.right : vw * 0.08) + GAP);
    var w = Math.round(Math.min(MAX_W, Math.max(MIN_W, mainLeft - GAP * 2 - left)));
    root.style.setProperty("--hud-left-panel-x", left + "px");
    root.style.setProperty("--hud-left-panel-w", w + "px");
    /* 竖直方向跟着模块走(面板中心 ≈ 图标中心),再夹进视口 */
    var ph = panel.offsetHeight || 260;
    var top = r ? r.top + r.height / 2 - ph / 2 : vh * 0.4;
    top = Math.max(10, Math.min(top, vh - ph - 10));
    root.style.setProperty("--hud-left-panel-y", Math.round(top) + "px");
    last = { vw: vw, vh: vh, left: left, w: w, top: Math.round(top), ph: ph };
  }

  /* ---------- ② 模块内容:每个模块一小段 ---------- */
  var MODS = {
    timer: { name: "番茄钟", en: "FOCUS", host: "timer" },
    music: {
      name: "音乐播放器", en: "MUSIC",
      html: '<p class="hud-left__todo">曲目还没放进来。<br>下一刀接 static/audio/ 和播放控制,' +
        '音量键沿用右下角那条(同一个 localStorage 键)。</p>'
    },
    time: {
      name: "时钟 · 日历", en: "TIME",
      html: '<div class="hud-left__clock"><b id="hud-left-clock">--:--:--</b>' +
        '<span id="hud-left-date"></span></div><div class="hud-left__cal" id="hud-left-cal"></div>'
    },
    note: {
      name: "草稿纸", en: "NOTES",
      html: '<textarea class="hud-left__note" id="hud-left-note" spellcheck="false" ' +
        'placeholder="随手记点东西…(自动存本机)"></textarea>'
    },
    /* 左下角那枚等腰直角三角形里放什么还没定 —— 用户:"先留一个正方形的模块位置"
       (后来定成三角形按钮)。先给一块占位面板,别做成"按了没反应"。 */
    slot: {
      name: "左下角空位", en: "SLOT",
      html: '<p class="hud-left__todo">这个角先空着。<br>' +
        '形状已经定死是等腰直角三角形(两条直角边贴着页缘),里面放什么你说。</p>'
    }
  };

  var current = null;
  var clockTimer = 0;
  var calMonth = null;

  /* ---- 番茄钟:把已有的那个节点搬进面板,关的时候搬回去 ---- */
  function hostTimer() {
    if (!timerEl || !timerHome) {
      body.innerHTML = '<p class="hud-left__todo">没找到番茄钟那一块(它挂在 .page-hud 里)。</p>';
      return;
    }
    if (timerWasMin === null) timerWasMin = timerEl.classList.contains("is-min");
    body.innerHTML = "";
    timerEl.classList.add("hud-timer--inpanel");
    timerEl.classList.remove("is-min");        /* 面板里就展开着(收起键已藏) */
    body.appendChild(timerEl);
  }

  function unhostTimer() {
    if (!timerEl || !timerHome || timerEl.parentNode !== body) return;
    timerEl.classList.remove("hud-timer--inpanel");
    if (timerWasMin) timerEl.classList.add("is-min");
    timerHome.appendChild(timerEl);
  }

  function open(key) {
    if (!MODS[key]) return;
    current = key;
    titleEl.textContent = MODS[key].name;
    if (enEl) enEl.textContent = MODS[key].en;
    if (MODS[key].host === "timer") hostTimer();
    else body.innerHTML = MODS[key].html || "";
    mods.forEach(function (b) {
      var on = b.getAttribute("data-hud-mod") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    panel.hidden = false;
    layout();
    startModule(key);
  }

  function close() {
    current = null;
    unhostTimer();
    panel.hidden = true;
    mods.forEach(function (b) { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    stopModule();
  }

  function startModule(key) {
    stopModule();
    if (key === "time") {
      tickClock();
      clockTimer = setInterval(tickClock, 1000);
      renderCalendar();
    } else if (key === "note") {
      var ta = document.getElementById("hud-left-note");
      if (!ta) return;
      try { ta.value = localStorage.getItem("hud-note") || ""; } catch (e) { }
      ta.addEventListener("input", function () {
        try { localStorage.setItem("hud-note", ta.value); } catch (e) { }
      });
    }
  }

  function stopModule() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
  }

  function tickClock() {
    var el = document.getElementById("hud-left-clock");
    var d = document.getElementById("hud-left-date");
    if (!el) { stopModule(); return; }
    var now = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    el.textContent = p(now.getHours()) + ":" + p(now.getMinutes()) + ":" + p(now.getSeconds());
    if (d) {
      d.textContent = now.getFullYear() + " 年 " + (now.getMonth() + 1) + " 月 " + now.getDate() +
        " 日 · 周" + "日一二三四五六"[now.getDay()];
    }
  }

  function renderCalendar() {
    var box = document.getElementById("hud-left-cal");
    if (!box) return;
    var now = new Date();
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var y = calMonth.getFullYear(), m = calMonth.getMonth();
    var first = new Date(y, m, 1).getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var out = '<div class="hud-left__calhead"><button type="button" data-cal="-1" aria-label="上个月">‹</button>' +
      '<span>' + y + " 年 " + (m + 1) + ' 月</span>' +
      '<button type="button" data-cal="1" aria-label="下个月">›</button></div><div class="hud-left__calgrid">';
    ["日", "一", "二", "三", "四", "五", "六"].forEach(function (w) { out += '<i class="w">' + w + "</i>"; });
    for (var i = 0; i < first; i++) out += "<i></i>";
    for (var d = 1; d <= days; d++) {
      var today = (y === now.getFullYear() && m === now.getMonth() && d === now.getDate());
      out += "<i" + (today ? ' class="today"' : "") + ">" + d + "</i>";
    }
    box.innerHTML = out + "</div>";
  }

  /* ---------- ③ 事件 ---------- */
  root.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-hud-mod]") : null;
    if (!b) return;
    e.preventDefault();
    var key = b.getAttribute("data-hud-mod");
    if (current === key) close(); else open(key);
  });

  body.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-cal]") : null;
    if (!b || !calMonth) return;
    e.preventDefault();
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(b.getAttribute("data-cal")), 1);
    renderCalendar();
  });

  if (closeBtn) closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && current) close(); });

  window.addEventListener("resize", layout);
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { layout(); }).observe(main); } catch (e) { }
  }

  /* 排障出口 */
  window.__hudLeft = {
    mods: mods.map(function (b) { return b.getAttribute("data-hud-mod"); }),
    open: function () { return current; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    openKey: open,
    close: close
  };
})();
