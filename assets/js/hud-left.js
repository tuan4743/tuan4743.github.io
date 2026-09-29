/* ============================================================
   左下角 UHD —— 框上那几枚按钮 + 点出来的"全息投影"面板
   ─────────────────────────────────────────────────────────────
   用户:"完成左侧UHD,实现和右边一样,是先用 SVG 画出边框,再往边框上塞按钮。"
   用户:"我功能页并不是想脱离这个面板,而是想做成那种全息投影,点一下模块,
         投影出这个面版,再点一下收回。面版其实想做成等宽但根据模块自适应高度的,
         整体也是先画 SVG 风格的框,左下角和右上角两个 45° 切角就够了。"
   用户:"音乐播放器其实并非本地曲目,想要做成嵌入式播放器链接网易云音乐。"

   干四件事:
     ① 量面板几何:等宽(所有模块同一个宽度)+ 高度自适应;位置贴着被点的那个模块
        (左下那两枚在页底,面板就投在它们【上面】,不然会盖住按钮点不回去)
     ② 画框:SVG 六边形,左下 + 右上各一刀 45°。切角要【屏幕上的真 45°】⇒
        viewBox 每次设成面板的实际像素尺寸,多边形用像素坐标写
     ③ 那条投影光束:从这个模块的位置连到面板(把"从哪投出来的"说清楚)
     ④ 渲染内容:番茄钟把已有的 #hud-timer 搬进来;音乐 = 网易云嵌入式播放器

   ★ 按钮的位置/形不在这里 —— 那是 page-hud.js 算好写进 style 的(单一真值 gFrameLB)。
   ★ 拿不到 #hud-left 就静默退出(列表页之外的页面、或样式没加载)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("hud-left");
  if (!root) return;
  var panel = document.getElementById("hud-left-panel");
  var body = document.getElementById("hud-left-body");
  var inner = root.querySelector(".hud-proj__inner");
  var frame = root.querySelector(".hud-proj__frame");
  var beam = root.querySelector(".hud-proj__beam");
  var titleEl = document.getElementById("hud-left-title");
  var enEl = document.getElementById("hud-left-en");
  var closeBtn = document.getElementById("hud-left-close");
  var mods = [].slice.call(root.querySelectorAll("[data-hud-mod]"));
  if (!panel || !body || !titleEl) return;

  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;
  var timerEl = document.getElementById("hud-timer");
  var timerHome = timerEl ? timerEl.parentNode : null;
  var timerWasMin = null;
  var musicEmbed = root.getAttribute("data-hud-music") || "";

  /* ---------- ① 几何:等宽 + 高度自适应 ---------- */
  var GAP = 12;          /* 模块 → 面板 的缝 */
  var MIN_W = 200;       /* 比这窄就只留按钮、不弹面板 */
  var MAX_W = 360;
  var CUT = 18;          /* 两个 45° 切角的边长(px) */
  var last = null;

  function bandRight() {
    /* 带子(含凸起)伸到哪儿:设计稿里凸起伸到 6 个单位,1 个单位 = 1vh */
    return Math.round(0.06 * document.documentElement.clientHeight);
  }

  function layout() {
    if (!current) return;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var host = root.querySelector('[data-hud-mod="' + current + '"] .hud-left__face');
    var r = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
    var mainLeft = main.getBoundingClientRect().left;

    /* ★ 等宽:所有模块共用同一个左缘与宽度(不跟着模块跑)——
       左缘 = 带子伸出的地方 + 缝;宽度 = 到正文左缘为止(封顶 MAX_W) */
    var left = bandRight() + GAP + 2;
    var w = Math.round(Math.min(MAX_W, Math.max(MIN_W, mainLeft - left - GAP)));
    root.style.setProperty("--hud-left-panel-x", left + "px");
    root.style.setProperty("--hud-left-panel-w", w + "px");

    /* 先摆好位置与宽度,再量高度(高度是内容决定的) */
    panel.style.left = left + "px";
    panel.style.width = w + "px";

    var ph = panel.offsetHeight || 240;
    var top;
    if (r && r.top > vh * 0.7) {
      /* 页底那几枚:面板投在它们【上面】(盖住按钮就点不回去了) */
      top = r.top - ph - GAP - 6;
    } else {
      top = r ? r.top + r.height / 2 - ph / 2 : vh * 0.4;
    }
    top = Math.max(10, Math.min(top, vh - ph - 10));
    panel.style.top = Math.round(top) + "px";

    drawFrame(w, ph);
    drawBeam(r, left, Math.round(top), w, ph, vh);
    last = { vw: vw, vh: vh, left: left, w: w, top: Math.round(top), ph: ph, cut: CUT };
  }

  /* ---------- ② 框:六边形(左下 + 右上两个 45° 切角) ---------- */
  function hexPoints(w, h) {
    var c = Math.min(CUT, Math.floor(Math.min(w, h) / 3));
    return [
      [0, 0], [w - c, 0], [w, c], [w, h], [c, h], [0, h - c]
    ];
  }

  function drawFrame(w, h) {
    if (!frame || !w || !h) return;
    var pts = hexPoints(w, h);
    var str = pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
    frame.setAttribute("viewBox", "0 0 " + w + " " + h);
    [].forEach.call(frame.querySelectorAll("polygon"), function (p) { p.setAttribute("points", str); });
    /* 内容也按同一圈切角裁一下,免得字压到切角外面 */
    var css = "polygon(" + pts.map(function (p) { return p[0] + "px " + p[1] + "px"; }).join(", ") + ")";
    if (inner) {
      inner.style.clipPath = css;
      inner.style.webkitClipPath = css;
    }
  }

  /* ---------- ③ 光束:从模块到面板 ---------- */
  function drawBeam(r, left, top, w, ph, vh) {
    if (!beam || !r) return;
    var vw = document.documentElement.clientWidth;
    beam.setAttribute("viewBox", "0 0 " + vw + " " + vh);
    var bx = r.x + r.width / 2, by = r.y + r.height / 2;
    /* 连到面板最近的那个角:面板在模块上面就接下缘,否则接左缘 */
    var px = top > by ? left + 10 : left;
    var py = top > by ? top + ph : Math.max(top + 8, Math.min(by, top + ph - 8));
    var line = beam.querySelector("line"), dot = beam.querySelector("circle");
    if (line) {
      line.setAttribute("x1", Math.round(bx)); line.setAttribute("y1", Math.round(by));
      line.setAttribute("x2", Math.round(px)); line.setAttribute("y2", Math.round(py));
    }
    if (dot) { dot.setAttribute("cx", Math.round(bx)); dot.setAttribute("cy", Math.round(by)); }
  }

  /* ---------- ④ 模块内容 ---------- */
  var MODS = {
    timer: { name: "番茄钟", en: "FOCUS", host: "timer" },
    music: { name: "音乐播放器", en: "MUSIC", music: true },
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
    slot: {
      name: "左下角空位", en: "SLOT",
      html: '<p class="hud-left__todo">这个角先空着。<br>' +
        '形状已经定死是等腰直角三角形(两条直角边贴着页缘),里面放什么你说。</p>'
    }
  };

  var current = null;
  var clockTimer = 0;
  var calMonth = null;

  /* ---- 番茄钟:把已有的那个节点搬进面板,收回的时候搬回去 ---- */
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

  /* ---- 音乐:网易云的嵌入式播放器 ---- */
  function renderMusic() {
    if (!musicEmbed) {
      body.innerHTML = '<p class="hud-left__todo">还没接播放器。<br>' +
        '在 <code>hugo.toml</code> 里加一行 <code>hudMusicEmbed</code>,填网易云的嵌入地址:<br>' +
        '<code>//music.163.com/outchain/player?type=2&id=歌曲ID&auto=0&height=66</code><br>' +
        '(歌单把 type 改成 0,height 改大一点。)填完这里就是一个能直接播的播放器。</p>';
      return;
    }
    var h = 86;
    var m = /height=(\d+)/.exec(musicEmbed);
    if (m) h = Math.max(66, Math.min(460, Number(m[1]) + 20));
    body.innerHTML = '<iframe class="hud-left__music" src="' + musicEmbed.replace(/"/g, "&quot;") +
      '" height="' + h + '" frameborder="no" border="0" marginwidth="0" marginheight="0" ' +
      'scrolling="no" allow="autoplay" referrerpolicy="no-referrer" ' +
      'title="网易云音乐"></iframe>';
  }

  function open(key) {
    if (!MODS[key]) return;
    current = key;
    titleEl.textContent = MODS[key].name;
    if (enEl) enEl.textContent = MODS[key].en;
    if (MODS[key].host === "timer") hostTimer();
    else if (MODS[key].music) renderMusic();
    else body.innerHTML = MODS[key].html || "";
    mods.forEach(function (b) {
      var on = b.getAttribute("data-hud-mod") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    panel.hidden = false;
    layout();
    /* 高度是内容撑的 ⇒ 图/字体到位后再量一次,免得第一帧量到错的 */
    requestAnimationFrame(layout);
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

  /* ---------- 事件 ---------- */
  root.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-hud-mod]") : null;
    if (!b) return;
    e.preventDefault();
    var key = b.getAttribute("data-hud-mod");
    if (current === key) close(); else open(key);      /* 再点一下收回 */
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
    try { new ResizeObserver(function () { if (current) layout(); }).observe(main); } catch (e) { }
  }

  /* 排障出口 */
  window.__hudLeft = {
    mods: mods.map(function (b) { return b.getAttribute("data-hud-mod"); }),
    open: function () { return current; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    hex: hexPoints,
    openKey: open,
    close: close
  };
})();
