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
  var mods = [].slice.call(root.querySelectorAll("[data-hud-mod]"));
  if (!panel || !body || !titleEl) return;

  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;
  var timerEl = document.getElementById("hud-timer");
  var timerHome = timerEl ? timerEl.parentNode : null;
  var timerWasMin = null;
  var musicEmbed = root.getAttribute("data-hud-music") || "";
  var musicData = { embed: "", songs: [] };
  try {
    var raw = document.getElementById("hud-music-data");
    if (raw && raw.textContent) musicData = JSON.parse(raw.textContent) || musicData;
  } catch (e) { }
  if (!musicData.embed) musicData.embed = musicEmbed;
  var musicPick = 0;

  var worldData = { home: "", items: [] };
  try {
    var wraw = document.getElementById("hud-world-data");
    if (wraw && wraw.textContent) worldData = JSON.parse(wraw.textContent) || worldData;
  } catch (e) { }

  var audioEl = document.createElement("audio");
  audioEl.id = "hud-player-audio";
  audioEl.preload = "none";
  audioEl.style.display = "none";
  root.appendChild(audioEl);

  var PST = "hud-music-state";
  var pendingSeek = 0;
  var lastSave = 0;
  var wantResume = false;

  function saveState(force) {
    var s = musicData.songs[musicPick];
    if (!s || !audioEl.getAttribute("src")) return;
    var now = Date.now();
    if (!force && now - lastSave < 900) return;
    lastSave = now;
    try {
      sessionStorage.setItem(PST, JSON.stringify({
        id: String(s.id),
        t: audioEl.currentTime || 0,
        playing: !audioEl.paused && !audioEl.ended,
        at: now
      }));
    } catch (e) { }
  }

  var retryArmed = false;
  function tryPlay() {
    var p = audioEl.play();
    if (p && p.catch) p.catch(function () {
      if (!wantResume || retryArmed) return;
      retryArmed = true;
      var once = function () {
        document.removeEventListener("pointerdown", once, true);
        document.removeEventListener("keydown", once, true);
        retryArmed = false;
        if (!wantResume || !audioEl.paused) return;
        tryPlay();
      };
      document.addEventListener("pointerdown", once, true);
      document.addEventListener("keydown", once, true);
    });
  }

  function restoreState() {
    if (!musicData.songs.length) return;
    var st = null;
    try { st = JSON.parse(sessionStorage.getItem(PST) || "null"); } catch (e) { }
    if (!st || !st.id) return;
    var i = -1;
    for (var k = 0; k < musicData.songs.length; k++) {
      if (String(musicData.songs[k].id) === String(st.id)) i = k;
    }
    if (i < 0) return;
    musicPick = i;
    var s = musicData.songs[i];
    if (!s.direct) return;
    if (!st.playing) {
      audioEl.dataset.song = String(s.id);
      return;
    }
    audioEl.preload = "auto";
    audioEl.dataset.song = String(s.id);
    audioEl.src = "//music.163.com/song/media/outer/url?id=" + s.id + ".mp3";
    pendingSeek = (st.t || 0) + Math.min(2.5, Math.max(0, (Date.now() - (st.at || Date.now())) / 1000));
    wantResume = true;
    try { audioEl.load(); } catch (e) { }
    setTimeout(function () {
      if (!wantResume || !audioEl.paused || !pendingSeek) return;
      try { audioEl.currentTime = pendingSeek; } catch (e) { }
      pendingSeek = 0;
      tryPlay();
    }, 2500);
  }

  var GAP = 12;
  var MIN_W = 200;
  var MAX_W = 360;
  var CUT = 18;
  var LINE_Y = 88;
  var last = null;
  var anim = 0;

  function bandRight() {
    return Math.round(0.06 * document.documentElement.clientHeight);
  }

  function projBottom() {
    var n = document.querySelector(".proj-node");
    if (!n || !n.getBoundingClientRect) return 0;
    var r = n.getBoundingClientRect();
    return r && r.height ? Math.round(r.bottom) + 12 : 0;
  }

  function layoutSlit(left, w) {
    var slit = document.getElementById("hud-left-slit");
    if (!slit) return;
    slit.style.left = left + "px";
    slit.style.width = w + "px";
    slit.style.top = Math.round(LINE_Y / 100 * document.documentElement.clientHeight) + "px";
  }

  var animTarget = 0;
  function unfold(targetH, durMs) {
    var w = parseFloat(panel.style.width) || panel.offsetWidth || 320;
    var lineTop = last ? last.line : Math.round(LINE_Y / 100 * document.documentElement.clientHeight);
    var from = panel.offsetHeight;
    var t0 = 0, dur = durMs || 460;
    animTarget = targetH;
    if (anim) cancelAnimationFrame(anim);
    var step = function (ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var h = from + (animTarget - from) * e;
      panel.style.height = h + "px";
      panel.style.top = Math.round(lineTop - h) + "px";
      drawFrame(w, h);
      if (k < 1) anim = requestAnimationFrame(step);
      else {
        panel.style.height = animTarget + "px";
        panel.style.top = Math.round(lineTop - animTarget) + "px";
        drawFrame(w, animTarget);
        anim = 0;
        panel.classList.add("is-still");
      }
    };
    anim = requestAnimationFrame(step);
  }

  function layout(animate) {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var mainLeft = main.getBoundingClientRect().left;

    var left = bandRight() + GAP + 2;
    var w = Math.round(Math.min(MAX_W, Math.max(MIN_W, mainLeft - left - GAP)));
    var lineTop = Math.round(LINE_Y / 100 * vh);
    root.style.setProperty("--hud-left-panel-x", left + "px");
    root.style.setProperty("--hud-left-panel-w", w + "px");
    panel.style.left = left + "px";
    panel.style.width = w + "px";
    layoutSlit(left, w);
    last = { vw: vw, vh: vh, left: left, w: w, ph: 0, line: lineTop, cut: CUT };
    if (!current) return;

    var host = root.querySelector('[data-hud-mod="' + current + '"] .hud-left__face');
    var r = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;

    var maxH = Math.max(200, lineTop - projBottom() - 12);
    var ph = Math.min((inner && inner.offsetHeight) || panel.offsetHeight || 240, maxH);
    if (animate) {
      panel.style.height = "0px";
      panel.style.top = Math.round(lineTop) + "px";
      unfold(ph, 460);
    } else if (anim) {
      animTarget = ph;
    } else {
      panel.style.height = ph + "px";
      drawFrame(w, ph);
    }
    if (!anim) panel.style.top = Math.round(lineTop - ph) + "px";
    drawBeam(r, left, Math.round(lineTop - ph), w, ph, vh);
    last.ph = ph;
  }

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
    var css = "polygon(" + pts.map(function (p) { return p[0] + "px " + p[1] + "px"; }).join(", ") + ")";
    if (inner) {
      inner.style.clipPath = css;
      inner.style.webkitClipPath = css;
    }
  }

  function drawBeam(r, left, top, w, ph, vh) {
    if (!beam || !r) return;
    var vw = document.documentElement.clientWidth;
    beam.setAttribute("viewBox", "0 0 " + vw + " " + vh);
    var bx = r.x + r.width / 2, by = r.y + r.height / 2;
    var px = left;
    var py = Math.min(top + ph - 8, Math.max(top + 8, by));
    var line = beam.querySelector("line"), dot = beam.querySelector("circle");
    if (line) {
      line.setAttribute("x1", Math.round(bx)); line.setAttribute("y1", Math.round(by));
      line.setAttribute("x2", Math.round(px)); line.setAttribute("y2", Math.round(py));
    }
    if (dot) { dot.setAttribute("cx", Math.round(bx)); dot.setAttribute("cy", Math.round(by)); }
  }

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
    world: { name: "世界观数据库", en: "ARCHIVE", world: true }
  };

  var current = null;
  var clockTimer = 0;
  var calMonth = null;

  function hostTimer() {
    if (!timerEl || !timerHome) {
      body.innerHTML = '<p class="hud-left__todo">没找到番茄钟那一块(它挂在 .page-hud 里)。</p>';
      return;
    }
    if (timerWasMin === null) timerWasMin = timerEl.classList.contains("is-min");
    body.innerHTML = "";
    timerEl.classList.add("hud-timer--inpanel");
    body.appendChild(timerEl);
    if (window.__hudTomato && window.__hudTomato.expand) window.__hudTomato.expand();
    else timerEl.classList.remove("is-min");
  }

  function unhostTimer() {
    if (!timerEl || !timerHome || timerEl.parentNode !== body) return;
    timerEl.classList.remove("hud-timer--inpanel");
    if (window.__hudTomato && window.__hudTomato.collapse) window.__hudTomato.collapse();
    else if (timerWasMin) timerEl.classList.add("is-min");
    timerHome.appendChild(timerEl);
  }

  function renderMusic() {
    if (musicData.embed) {
      pauseAudio();
      var m0 = /height=(\d+)/.exec(musicData.embed);
      var h0 = m0 ? Math.max(66, Math.min(460, Number(m0[1]) + 20)) : 86;
      body.innerHTML = musicFrame(musicData.embed, h0);
      return;
    }
    var songs = musicData.songs || [];
    if (!songs.length) {
      pauseAudio();
      body.innerHTML = '<p class="hud-left__todo">还没接播放器。<br>' +
        '在 <code>hugo.toml</code> 里给 <code>hudMusicSongs</code> 填网易云的歌曲 ID,<br>' +
        '或者给 <code>hudMusicEmbed</code> 填一条嵌入地址:<br>' +
        '<code>//music.163.com/outchain/player?type=2&id=歌曲ID&auto=0&height=66</code></p>';
      return;
    }
    if (musicPick >= songs.length) musicPick = 0;
    var cur = songs[musicPick] || {};
    if (audioEl.dataset.song !== String(cur.id)) {
      audioEl.dataset.song = String(cur.id);
      if (cur.direct) {
        audioEl.src = "//music.163.com/song/media/outer/url?id=" + cur.id + ".mp3";
      } else {
        pauseAudio();
        audioEl.removeAttribute("src");
      }
    }
    var rows = songs.map(function (s, i) {
      return '<button type="button" class="hud-plist__row' + (i === musicPick ? " is-on" : "") +
        '" data-hud-song="' + i + '" aria-pressed="' + (i === musicPick) + '">' +
        '<span class="hud-plist__name">' + esc(s.name || ("歌曲 " + (i + 1))) + '</span>' +
        '<span class="hud-plist__meta">' + esc(s.artist || "") + '</span></button>';
    }).join("");
    body.innerHTML = playerFor(cur) +
      '<p class="hud-plist__hint">歌单</p>' +
      '<div class="hud-plist">' + rows + '</div>';
    wireAudio();
  }

  function renderWorld() {
    var items = (worldData && worldData.items) || [];
    if (!items.length) {
      body.innerHTML = '<p class="hud-left__todo">数据库是空的。<br>' +
        '跑一次 <code>node scripts/sync-world.mjs</code>,<br>' +
        '它会把 <code>static/world/碎片/</code> 编成 <code>content/world/</code>。</p>';
      return;
    }
    var acts = [], byAct = {};
    items.forEach(function (it) {
      var a = it.act || "未归类";
      if (!byAct[a]) { byAct[a] = []; acts.push(a); }
      byAct[a].push(it);
    });
    var out = "";
    if (worldData.home) {
      out += '<a class="hud-cat__home" data-magnetic href="' + esc(worldData.home) + '">' +
        '<b>世界观数据库</b><span>' + items.length + ' 份回收档案 · 六幕</span></a>';
    }
    out += '<div class="hud-cat">';
    acts.forEach(function (a) {
      out += '<p class="hud-cat__act">' + esc(a) + '</p>';
      byAct[a].forEach(function (it) {
        out += '<a class="hud-cat__row" href="' + esc(it.url) + '" title="' + esc(it.title) + '">' +
          '<span class="hud-cat__no">' + esc(it.no) + '</span>' +
          '<span class="hud-cat__name">' + esc(it.title) + '</span>' +
          '<span class="hud-cat__time">' + esc(it.time || "") + '</span></a>';
      });
    });
    body.innerHTML = out + '</div>' +
      '<p class="hud-cat__foot">点一条 → 进正文页</p>';
  }

  function pauseAudio() {
    try { audioEl.pause(); } catch (e) { }
    var btn = document.getElementById("hud-player-btn");
    if (btn) btn.classList.remove("is-playing");
    var m = document.querySelector('[data-hud-pen], [data-hud-mod="music"]');
    if (m) m.classList.remove("is-playing");
  }

  function playerFor(s) {
    if (s.direct) {
      return '<div class="hud-player">' +
        '<button class="hud-player__btn" type="button" id="hud-player-btn" aria-label="播放或暂停">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path class="hud-player__icon" d="M8 5v14l11-7z"></path></svg></button>' +
        '<div class="hud-player__meta"><b>' + esc(s.name || "") + '</b>' +
        '<span>' + esc(s.artist || "") + '</span></div>' +
        '<span class="hud-player__time" id="hud-player-time">0:00</span>' +
        '<span class="hud-player__track"><i id="hud-player-fill"></i></span>' +
        '</div>';
    }
    return musicFrame("//music.163.com/outchain/player?type=2&id=" + s.id + "&auto=0&height=66", 86) +
      '<p class="hud-plist__note">这首网易云只给嵌入式播放器(没有直链)⇒ 音量用它自己的。</p>';
  }

  function applyVolume(a) {
    var v = NaN;
    try { v = parseFloat(localStorage.getItem("cd-audio-vol")); } catch (e) { }
    if (!isFinite(v)) v = 0.5;
    try { a.volume = Math.min(1, Math.max(0, v)); } catch (e) { }
  }

  function wireAudio() {
    var a = audioEl;
    var btn = document.getElementById("hud-player-btn");
    var fill = document.getElementById("hud-player-fill");
    var timeEl = document.getElementById("hud-player-time");
    var musicBtn = document.querySelector('[data-hud-mod="music"]');
    var paint = function () {
      if (fill) fill.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + "%";
      if (timeEl) timeEl.textContent = fmtTime(a.currentTime);
    };
    window.__hudAudio = { el: a, paint: paint };
    applyVolume(a);
    paint();
    if (btn) {
      btn.classList.toggle("is-playing", !a.paused);
      btn.addEventListener("click", function () {
        if (a.paused) { var p = a.play(); if (p && p.catch) p.catch(function () { }); }
        else a.pause();
      });
    }
  }

  function fmtTime(sec) {
    if (!isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60), r = Math.floor(sec % 60);
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function bindAudioOnce() {
    var a = audioEl;
    applyVolume(a);
    window.addEventListener("hud-volume", function (e) {
      var v = e && e.detail;
      if (a && isFinite(v)) { try { a.volume = Math.min(1, Math.max(0, v)); } catch (err) { } }
    });
    var setState = function (playing) {
      var m = document.querySelector('[data-hud-mod="music"]');
      if (m) m.classList.toggle("is-playing", playing);
      var btn = document.getElementById("hud-player-btn");
      if (btn) btn.classList.toggle("is-playing", playing);
    };
    a.addEventListener("play", function () { setState(true); });
    a.addEventListener("pause", function () { setState(false); });
    a.addEventListener("ended", function () { setState(false); });
    a.addEventListener("timeupdate", function () {
      var f = document.getElementById("hud-player-fill");
      var t = document.getElementById("hud-player-time");
      if (f) f.style.width = (a.duration ? (a.currentTime / a.duration * 100) : 0) + "%";
      if (t) t.textContent = fmtTime(a.currentTime);
    });
    a.addEventListener("error", function () {
      if (!a.getAttribute("src")) return;
      var s = (musicData.songs || [])[musicPick];
      if (!s || current !== "music") return;
      var holder = body.querySelector(".hud-player");
      if (holder) holder.outerHTML = musicFrame(
        "//music.163.com/outchain/player?type=2&id=" + s.id + "&auto=0&height=66", 86) +
        '<p class="hud-plist__note">这首没有直链(网易云只给嵌入式播放器)⇒ 音量用它自己的。</p>';
    });
  }
  bindAudioOnce();

  audioEl.addEventListener("loadedmetadata", function () {
    if (pendingSeek) {
      try { audioEl.currentTime = pendingSeek; } catch (e) { }
      pendingSeek = 0;
    }
    if (wantResume) tryPlay();
  });
  audioEl.addEventListener("play", function () { wantResume = false; saveState(true); });
  audioEl.addEventListener("pause", function () { saveState(true); });
  audioEl.addEventListener("ended", function () { saveState(true); });
  audioEl.addEventListener("timeupdate", function () { saveState(false); });
  window.addEventListener("pagehide", function () { saveState(true); });
  restoreState();

  function musicFrame(src, h) {
    return '<iframe class="hud-left__music" src="' + esc(src) + '" height="' + h +
      '" frameborder="no" border="0" marginwidth="0" marginheight="0" scrolling="no" ' +
      'allow="autoplay" title="网易云音乐"></iframe>';
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function open(key) {
    if (!MODS[key]) return;
    if (anim) { cancelAnimationFrame(anim); anim = 0; }
    current = key;
    titleEl.textContent = MODS[key].name;
    if (enEl) enEl.textContent = MODS[key].en;
    if (MODS[key].host === "timer") hostTimer();
    else if (MODS[key].music) renderMusic();
    else if (MODS[key].world) renderWorld();
    else body.innerHTML = MODS[key].html || "";
    mods.forEach(function (b) {
      var on = b.getAttribute("data-hud-mod") === key;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    panel.hidden = false;
    panel.classList.remove("is-still");
    startModule(key);
    layout(true);
    panel.classList.add("is-open");
    requestAnimationFrame(function () { layout(false); });
  }

  function close() {
    if (!current) return;
    current = null;
    unhostTimer();
    stopModule();
    mods.forEach(function (b) { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    panel.classList.remove("is-open");
    unfold(0, 380);
    var wait = function () {
      if (anim) { setTimeout(wait, 60); return; }
      panel.hidden = true;
      panel.classList.remove("is-still");
    };
    setTimeout(wait, 60);
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

  root.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-hud-mod]") : null;
    if (!b) return;
    e.preventDefault();
    var key = b.getAttribute("data-hud-mod");
    if (current === key) close(); else open(key);
  });

  body.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-cal]") : null;
    if (b && calMonth) {
      e.preventDefault();
      calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + Number(b.getAttribute("data-cal")), 1);
      renderCalendar();
      return;
    }
    var row = e.target.closest ? e.target.closest("[data-hud-song]") : null;
    if (row) {
      e.preventDefault();
      musicPick = Number(row.getAttribute("data-hud-song")) || 0;
      renderMusic();
      layout(false);
      return;
    }
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && current) close(); });

  window.addEventListener("resize", function () { layout(false); });
  if (window.ResizeObserver) {
    try { new ResizeObserver(function () { layout(false); }).observe(main); } catch (e) { }
  }
  layout(false);

  window.__hudLeft = {
    mods: mods.map(function (b) { return b.getAttribute("data-hud-mod"); }),
    open: function () { return current; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    hex: hexPoints,
    openKey: open,
    close: close,
    music: function () {
      var s = musicData.songs[musicPick] || {};
      var raw = null;
      try { raw = JSON.parse(sessionStorage.getItem(PST) || "null"); } catch (e) { }
      return {
        pick: musicPick, id: s.id ? String(s.id) : null, direct: !!s.direct,
        t: audioEl.currentTime || 0, paused: audioEl.paused,
        wantResume: wantResume, saved: raw
      };
    }
  };
})();
