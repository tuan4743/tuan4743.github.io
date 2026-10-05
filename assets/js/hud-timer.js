(function () {
  "use strict";

  var root = document.getElementById("hud-timer");
  if (!root) return;

  var ringBtn = document.getElementById("hud-timer-ring");
  var arc = document.getElementById("hud-timer-arc");
  var timeEl = document.getElementById("hud-timer-time");
  var stateEl = document.getElementById("hud-timer-state");
  var toggleBtn = document.getElementById("hud-timer-toggle");
  var resetBtn = document.getElementById("hud-timer-reset");
  var minBtn = document.getElementById("hud-timer-min");
  var metaEl = document.getElementById("hud-timer-meta");
  var presetBox = document.getElementById("hud-timer-presets");
  if (!timeEl) return;

  var KEY = "hud-tomato";
  var DAY_KEY = "hud-tomato-day";

  var MODES = {
    focus: { label: "专注", presets: [25, 45], min: 25 },
    break: { label: "小憩", presets: [5, 15], min: 5 }
  };

  var st = {
    phase: "focus",
    mins: 25,
    minsBy: { focus: 25, break: 5 },
    accum: 0,
    running: false,
    startedAt: 0,
    ended: false,
    collapsed: true,
    done: 0
  };

  function totalMs() { return st.mins * 60000; }

  function elapsed() {
    return st.accum + (st.running ? Date.now() - st.startedAt : 0);
  }

  function remain() {
    return Math.max(0, totalMs() - elapsed());
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s === "object") {
        if (MODES[s.phase]) st.phase = s.phase;
        if (typeof s.mins === "number" && s.mins > 0) st.mins = s.mins;
        if (typeof s.accum === "number" && s.accum >= 0) st.accum = s.accum;
        if (typeof s.startedAt === "number") st.startedAt = s.startedAt;
        st.running = !!s.running;
        if (st.running && st.startedAt) {
          var passed = Date.now() - st.startedAt;
          if (passed > 0) st.accum += passed;
          st.startedAt = Date.now();
          if (st.accum >= totalMs()) { st.accum = totalMs(); st.running = false; st.ended = true; }
        }
      }
      st.collapsed = localStorage.getItem(KEY + "-min") !== "0";
      st.minsBy[st.phase] = st.mins;
    } catch (e) { }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        phase: st.phase, mins: st.mins, accum: st.accum,
        startedAt: st.startedAt, running: st.running
      }));
    } catch (e) {}
  }

  function saveCollapsed() {
    try { localStorage.setItem(KEY + "-min", st.collapsed ? "1" : "0"); } catch (e) {}
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function loadDone() {
    try {
      if (localStorage.getItem(DAY_KEY) === today()) {
        st.done = Number(localStorage.getItem(KEY + "-done")) || 0;
      }
    } catch (e) {}
  }

  function saveDone() {
    try {
      localStorage.setItem(DAY_KEY, today());
      localStorage.setItem(KEY + "-done", String(st.done));
    } catch (e) {}
  }

  var ac = null;

  function chime() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ac) ac = new AC();
      if (ac.state === "suspended" && ac.resume) ac.resume();
      [0, 0.22].forEach(function (at, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine";
        o.frequency.value = i ? 1046.5 : 784;
        var t0 = ac.currentTime + at;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.connect(g); g.connect(ac.destination);
        o.start(t0); o.stop(t0 + 0.55);
      });
    } catch (e) { }
  }

  function fmt(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  var lastText = "";
  var lastSynced = "";

  function render() {
    var r = remain();
    var txt = fmt(r);
    if (txt !== lastText) {
      lastText = txt;
      timeEl.textContent = txt;
    }
    var p = Math.min(1, Math.max(0, elapsed() / totalMs()));
    if (arc) arc.style.setProperty("--hud-timer-p", p.toFixed(4));
    var docEl = document.documentElement;
    if (docEl && docEl.style) {
      docEl.style.setProperty("--hud-tomato-p", p.toFixed(4));
      docEl.style.setProperty("--hud-tomato-run", st.running ? "1" : "0");
    }
    if (stateEl) {
      stateEl.textContent = st.ended ? MODES[st.phase].label + " / 已完成"
        : st.running ? MODES[st.phase].label + " / 计时中"
          : MODES[st.phase].label + " / 暂停中";
    }
    root.classList.toggle("is-run", st.running);
    if (toggleBtn) toggleBtn.textContent = st.running ? "暂停" : (st.ended || st.accum > 0 ? "继续" : "开始");
    if (metaEl) metaEl.textContent = "今日完成 " + st.done + " 个番茄";
  }

  var tick = 0;

  function sync() {
    st.accum = elapsed();
    st.startedAt = Date.now();
    save();
  }

  function step() {
    if (!st.running) return;
    if (elapsed() >= totalMs()) { finish(); return; }
    if (lastText !== lastSynced) { lastSynced = lastText; sync(); }
    render();
  }

  function start() {
    if (st.running) return;
    if (st.ended || remain() <= 0) { st.accum = 0; st.ended = false; }
    st.running = true;
    st.startedAt = Date.now();
    if (!tick) tick = setInterval(step, 250);
    save(); render();
  }

  function pause() {
    if (!st.running) return;
    st.accum = elapsed();
    st.running = false;
    if (tick) { clearInterval(tick); tick = 0; }
    save(); render();
  }

  function finish() {
    st.accum = totalMs();
    st.running = false;
    st.ended = true;
    if (tick) { clearInterval(tick); tick = 0; }
    if (st.phase === "focus") { st.done += 1; saveDone(); }
    chime();
    save(); render();
  }

  function reset() {
    st.accum = 0;
    st.running = false;
    st.ended = false;
    if (tick) { clearInterval(tick); tick = 0; }
    save(); render();
  }

  function setMin(on) {
    st.collapsed = !!on;
    root.classList.toggle("is-min", st.collapsed);
    if (minBtn) {
      minBtn.setAttribute("aria-expanded", st.collapsed ? "false" : "true");
      var t = st.collapsed ? "展开番茄钟" : "收起番茄钟";
      minBtn.setAttribute("aria-label", t);
      minBtn.title = t;
    }
    saveCollapsed();
  }

  if (minBtn) minBtn.addEventListener("click", function () { setMin(true); });

  var mainBtn = toggleBtn || ringBtn;

  if (mainBtn) {
    mainBtn.addEventListener("click", function () {
      if (st.running) pause(); else start();
    });
  }
  if (resetBtn) resetBtn.addEventListener("click", reset);

  root.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-hud-timer-min],[data-hud-timer-phase]") : null;
    if (!el) return;
    e.preventDefault();
    var pm = el.getAttribute("data-hud-timer-min");
    var ph = el.getAttribute("data-hud-timer-phase");
    if (pm) {
      st.mins = Number(pm);
      st.accum = 0; st.running = false; st.ended = false;
      if (tick) { clearInterval(tick); tick = 0; }
    } else if (ph && MODES[ph]) {
      st.minsBy[st.phase] = st.mins;
      st.phase = ph;
      st.mins = st.minsBy[ph] || MODES[ph].min;
      st.accum = 0; st.running = false; st.ended = false;
      if (tick) { clearInterval(tick); tick = 0; }
    }
    syncButtons(); save(); render();
  });

  function syncButtons() {
    var i, list = root.querySelectorAll("[data-hud-timer-min]");
    for (i = 0; i < list.length; i++) {
      var v = Number(list[i].getAttribute("data-hud-timer-min"));
      var show = MODES[st.phase].presets.indexOf(v) >= 0;
      var on = show && v === st.mins;
      list[i].hidden = !show;
      list[i].classList.toggle("is-on", on);
      list[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
    list = root.querySelectorAll("[data-hud-timer-phase]");
    for (i = 0; i < list.length; i++) {
      var isOn = list[i].getAttribute("data-hud-timer-phase") === st.phase;
      list[i].classList.toggle("is-on", isOn);
      list[i].setAttribute("aria-pressed", isOn ? "true" : "false");
    }
  }

  load();
  loadDone();
  if (st.running && !tick) tick = setInterval(step, 250);
  root.classList.toggle("is-min", st.collapsed);
  if (minBtn) minBtn.setAttribute("aria-expanded", st.collapsed ? "false" : "true");
  syncButtons();
  render();

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) step();
  });
  window.addEventListener("focus", function () { step(); });

  window.__hudTomato = {
    state: function () {
      return {
        phase: st.phase, mins: st.mins, running: st.running, ended: st.ended,
        collapsed: st.collapsed, done: st.done,
        remain: Math.round(remain()), p: Math.round(elapsed() / totalMs() * 1000) / 1000
      };
    },
    start: start, pause: pause, reset: reset, finish: finish,
    setMin: setMin, render: render,
    expand: function () { setMin(false); },
    collapse: function () { setMin(true); }
  };
})();
