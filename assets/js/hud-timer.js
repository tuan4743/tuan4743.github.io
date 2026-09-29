/* ============================================================
   番茄钟(左栏,可收起)
   ─────────────────────────────────────────────────────────────
   用户:"可以先继续做番茄钟,番茄钟做成可收起的。"

   这块东西的三个设计决定(都不是随便定的):
   ① 计时【不自己数秒】。存的是 startedAt(这一轮开始的墙钟时间)和
      accum(之前累计跑过的毫秒),每次渲染都用 Date.now() 重算剩余:
          remain = total − (accum + (running ? now − startedAt : 0))
      为什么:setInterval 在后台标签页会被节流到 1 次/分钟甚至更慢,
      "每秒减一"的写法在切回来之后会少算好几分钟。
      按墙钟算的话,切回来第一帧就是正确值 —— 顺便省掉了"补帧"逻辑。
   ② 收起形态【不销毁表盘】,只是 CSS 把卡片淡出、换成左上角那枚胶囊
      (见 hud-timer.css 的 .is-min)。计时还在跑,胶囊上的小灯会呼吸。
   ③ 状态的唯一真相是 localStorage 里那一条(含 running),
      刷新页面回来接着走 —— 和主题切换、目录字号一个套路。

   ★ 拿不到 #hud-timer 就静默退出(首页/列表页都有 HUD,但万一模板改了,
     不能报错影响别的脚本)。
   ============================================================ */
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

  /* 两种模式各自的默认时长(分钟)与可选档位。
     ★ 档位是"每个模式自己的":专注 25/45、小憩 5/15 —— 合成一套的话,
       点小憩会拿到 45 分钟,那就不叫小憩了。 */
  var MODES = {
    focus: { label: "专注", presets: [25, 45], min: 25 },
    break: { label: "小憩", presets: [5, 15], min: 5 }
  };

  var st = {
    phase: "focus",
    mins: 25,           /* 当前模式选中的时长 */
    /* ★ 每个模式各记自己的时长:用户在专注里选了 45,切到小憩再切回来
       还是 45,而不是被打回 25。 */
    minsBy: { focus: 25, break: 5 },
    accum: 0,           /* 已经跑过的毫秒 */
    running: false,
    startedAt: 0,       /* 这一轮开始时的 Date.now() */
    ended: false,       /* 刚跑完、还没被重置/重新开始 */
    collapsed: true,    /* ★ 用户要的"可收起":默认就是收起态,不占左栏 */
    done: 0             /* 今日完成的番茄数 */
  };

  function totalMs() { return st.mins * 60000; }

  function elapsed() {
    return st.accum + (st.running ? Date.now() - st.startedAt : 0);
  }

  function remain() {
    return Math.max(0, totalMs() - elapsed());
  }

  /* ---------- 持久化 ---------- */
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && typeof s === "object") {
        if (MODES[s.phase]) st.phase = s.phase;
        if (typeof s.mins === "number" && s.mins > 0) st.mins = s.mins;
        if (typeof s.accum === "number" && s.accum >= 0) st.accum = s.accum;
        if (typeof s.startedAt === "number") st.startedAt = s.startedAt;
        st.running = !!s.running;
        /* ★ 刷新回来时如果上次是"跑着"的状态,累加那段真实流逝的时间 ——
           切走十分钟再回来,番茄钟应该已经走了十分钟,而不是从零开始。 */
        if (st.running && st.startedAt) {
          var passed = Date.now() - st.startedAt;
          if (passed > 0) st.accum += passed;
          st.startedAt = Date.now();
          if (st.accum >= totalMs()) { st.accum = totalMs(); st.running = false; st.ended = true; }
        }
      }
      st.collapsed = localStorage.getItem(KEY + "-min") !== "0";   /* 只有显式存过 "0" 才展开 */
      /* ★ 把恢复出来的时长记到这个模式名下,否则用户切一次模式就被打回默认值了 */
      st.minsBy[st.phase] = st.mins;
    } catch (e) { /* 隐私模式读不到就用默认值 */ }
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

  /* 今日番茄数:按【本地日期】分桶 —— 第二天自动从 0 开始,不用定时清理 */
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

  /* ---------- 响铃 ----------
     ★ 不用 <audio> 外链:一个 wav 也要好几十 KB,还得处理"文件没加载完就响"。
       两个正弦音 + 指数衰减 = 一声很轻的"叮",而且【必须先有用户手势】才能建
       AudioContext(浏览器自动播放策略),所以这里是在第一次点击时才建。 */
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
        o.frequency.value = i ? 1046.5 : 784;            /* G5 → C6,往上走,别像警报 */
        var t0 = ac.currentTime + at;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        o.connect(g); g.connect(ac.destination);
        o.start(t0); o.stop(t0 + 0.55);
      });
    } catch (e) { /* 没有 Web Audio 就算了,静默 */ }
  }

  /* ---------- 渲染 ---------- */
  function fmt(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  var lastText = "";
  var lastSynced = "";      /* 上一次"落盘"时的读数(和 lastText 分开记) */

  function render() {
    var r = remain();
    var txt = fmt(r);
    /* ★ 只在【显示的文字真的变了】的时候写 DOM:一秒钟一次,而不是每 250ms 一次。
       环形进度每帧都要更新,但它只是一个 CSS 变量。 */
    if (txt !== lastText) {
      lastText = txt;
      timeEl.textContent = txt;
    }
    var p = Math.min(1, Math.max(0, elapsed() / totalMs()));
    if (arc) arc.style.setProperty("--hud-timer-p", p.toFixed(4));
    /* ★★ 收起之后怎么展示这个组件(用户第二轮第 4 条):
       胶囊已经删了,改成在左下角那枚【番茄钟模块按钮】上画一个小进度圈。
       跨脚本传值走 CSS 变量,不去戳别人的 DOM:
         --hud-tomato-p    进度 0~1
         --hud-tomato-run  1 = 正在跑(圈是亮的),0 = 停着(圈是暗的)
       (按钮在 .page-hud 里,写在 :root 上就顺着层叠下去了。) */
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

  /* ---------- 走时 ----------
     ★ 250ms 一跳:环形进度看起来是连续的,而文字仍然是秒级。
       标签页被后台节流也没关系 —— remain() 是按墙钟算的(见文件头 ①)。

     ★★ sync():把"到目前为止跑了多久"【落进 accum 这一份状态】。
     为什么非做不可 —— 这条是我自己写漏、被测试逮住的:
       原来的模型是"accum = 上次暂停时的累计,startedAt = 这一轮开始时刻",
       于是"跑着的这段时间"只活在内存里:用户直接关标签页时,最后一次 save
       还是【开始那一刻】(accum=0)⇒ 刚专注过的那 20 分钟在下次打开时凭空消失,
       而且和"按墙钟算"这个既定规矩自相矛盾。
     现在的规矩:accum 永远是"最后一次 sync 时已过的时间",startedAt 跟着挪到
       sync 那一刻 —— 两者相加的语义不变(elapsed 仍然只加一次),但状态随时
       可以落盘。每次 sync 写一次 localStorage(约 1 秒 1 次,几十字节)。
     ★ render() 放在最后:sync 改了 startedAt,但 elapsed() 的值没变(加了又减),
       所以不会出现"数字跳一下"。 */
  var tick = 0;

  function sync() {
    st.accum = elapsed();
    st.startedAt = Date.now();
    save();
  }

  function step() {
    if (!st.running) return;
    if (elapsed() >= totalMs()) { finish(); return; }
    /* ★ 只在【秒数真的变了】的时候才 sync(约 1 次/秒),不是每 250ms 一次:
       环形进度每帧都要画,但"落盘"不需要那么细。 */
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
    /* ★ 只有"专注"跑完才算一个番茄 —— 小憩也计数的话,今日完成就注水了。 */
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

  /* ---------- 收起 / 展开 ---------- */
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
  /* ★ 原来这里绑的是"收起态胶囊"的点击(点它展开)。胶囊已删 —— 用户第二轮第 3 条:
     "原本的番茄钟按钮没删"。现在展开/收起由左下角那枚模块按钮管(hud-left.js)。 */

  /* ---------- 控件 ---------- */
  var mainBtn = toggleBtn || ringBtn;     /* 没给"开始"按钮时,表盘自己也能按 */

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
      /* ★ 换模式时把时长也换成【那个模式自己的记忆值】,不然"专注 45"切到小憩
         会变成 45 分钟的小憩,那就不叫小憩了。 */
      st.minsBy[st.phase] = st.mins;
      st.phase = ph;
      st.mins = st.minsBy[ph] || MODES[ph].min;
      st.accum = 0; st.running = false; st.ended = false;
      if (tick) { clearInterval(tick); tick = 0; }
    }
    syncButtons(); save(); render();
  });

  /* 按钮的选中态 + 每个模式只显示自己那两档预设。
     ★ 这里【只读】时长,不写回 MODES —— 第一版我在函数末尾写了
       `MODES[st.phase].mins = st.mins`,于是 syncButtons 成了"写状态"的函数,
       从两个地方调就会把记忆值搅乱。状态只有一处改:上面那个 click 处理器。 */
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

  /* ---------- 启动 ---------- */
  load();
  loadDone();
  if (st.running && !tick) tick = setInterval(step, 250);
  root.classList.toggle("is-min", st.collapsed);
  if (minBtn) minBtn.setAttribute("aria-expanded", st.collapsed ? "false" : "true");
  /* syncButtons 会按当前模式把不该出现的档位藏起来 —— 必须在 render 之前跑,
     否则第一帧会先亮错一个档位。 */
  syncButtons();
  render();

  /* 切回这个标签页时立刻对一次表(后台被节流期间可能已经跑完好几轮了) */
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) step();
  });
  window.addEventListener("focus", function () { step(); });

  /* 排障出口(和 __hudToc / __mc 一个规矩:线上能一眼看出内部状态) */
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
    /* ★ 第二轮:胶囊删掉之后,展开卡片这一侧由左下角那枚模块按钮调进来
       (hud-left.js 先把它搬进面板、再调 expand())。 */
    expand: function () { setMin(false); },
    collapse: function () { setMin(true); }
  };
})();
