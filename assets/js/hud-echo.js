(function () {
  "use strict";

  var docEl = document.documentElement;
  var node = document.querySelector(".proj-node");
  var eye = document.getElementById("pn-eye");
  var pupil = document.getElementById("pn-pupil");
  var bubble = document.getElementById("echo-say");
  var textEl = document.getElementById("echo-say-text");
  var hot = document.getElementById("echo-hot");
  var hud = document.getElementById("page-hud");
  if (!node || !bubble || !textEl) return;

  var VB = 168;
  var EYE_AT = 56;
  var MAX_EYE = 6;
  var MAX_PUPIL = 3;
  var REACH = 340;
  var AXIS_X = window.innerWidth / 2, AXIS_Y = window.innerHeight / 2;
  var raf = 0;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function move() {
    raf = 0;
    if (!eye) return;
    var r = node.getBoundingClientRect();
    if (!r.width) return;
    var k = r.width / VB;
    var cx = r.left + EYE_AT * k, cy = r.top + EYE_AT * k;
    var dx = AXIS_X - cx, dy = AXIS_Y - cy;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var t = Math.min(1, d / REACH);
    var ux = dx / d, uy = dy / d;
    eye.setAttribute("transform", "translate(" + (ux * MAX_EYE * t).toFixed(2) + " " +
      (uy * MAX_EYE * t).toFixed(2) + ")");
    if (pupil) {
      pupil.setAttribute("transform", "translate(" + (ux * MAX_PUPIL * t).toFixed(2) + " " +
        (uy * MAX_PUPIL * t).toFixed(2) + ")");
    }
  }

  function look(x, y) {
    AXIS_X = x; AXIS_Y = y;
    if (still) return;
    if (!raf) raf = requestAnimationFrame(move);
  }

  if (!still) {
    document.addEventListener("pointermove", function (e) { look(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener("resize", function () {
      if (eye) eye.removeAttribute("transform");
      if (pupil) pupil.removeAttribute("transform");
      look(AXIS_X, AXIS_Y);
    });
  }

  var COOL = 20000;
  var LINES = {
    arrive: [
      "回来了。……嗯,不用解释,这种情况我见过好几次了。",
      "哟,醒了。今天先看哪一份?",
      "又是你。行,我不问了。"
    ],
    archive: [
      "又翻档案。你自己那份还没校准呢。",
      "这套你翻过几回了。……随你。"
    ],
    music: [
      "放着吧,我不嫌吵。",
      "这首上次你听了一半就跑了。"
    ],
    timer: [
      "要专注?行。"
    ],
    timerRun: [
      "计时开始。我不说话。"
    ],
    pen: [
      "别画在别人写的东西上。",
      "又拿笔。……画吧,反正也不是我的。"
    ],
    done: [
      "一轮到了。……嗯,记上了。",
      "到了。难得。"
    ],
    giveUp: [
      "又停了。",
      "行,停吧。我也不催你。",
      "还剩一点呢。……随你。"
    ],
    hoverPen: [
      "别画我。",
      "喂。这儿是镜头,不是纸。"
    ],
    reading: [
      "还在看。……表我帮你盯着。",
      "看了这么久。……行,你慢慢看。",
      "这一份是有点长。我等你。"
    ],
    deepNight: [
      "这个点的档案,字都比白天淡。",
      "凌晨还翻档案。……行,我不问。",
      "夜班的时段。巧了。"
    ],
    manyFragments: [
      "翻这么多份。……找到想找的了?",
      "第四份了。你的记忆比我想的能装。",
      "一份接一份。……行,我陪着。"
    ]
  };
  var TRIG = {
    arrive: { once: true },
    archive: { once: true },
    music: { once: true },
    timer: { once: true },
    timerRun: { once: true },
    pen: { once: true },
    done: { once: true, force: true },
    giveUp: { cool: 180000, force: true },
    hoverPen: { cool: 60000, force: true },
    reading: { cool: 600000, force: true },
    deepNight: { once: true, force: true },
    manyFragments: { cool: 1800000, force: true }
  };

  function get(k, d) { try { return sessionStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }

  var hideTimer = 0;
  var typeTimer = 0;

  function hide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
    if (typeTimer) { clearInterval(typeTimer); typeTimer = 0; }
    bubble.classList.remove("is-on");
  }

  var lastShown = null;
  function show(line, holdMs) {
    lastShown = line;
    if (typeTimer) { clearInterval(typeTimer); typeTimer = 0; }
    bubble.classList.add("is-on");
    /* 逐字浮现:终端吐字,不是对话框弹字。
       reduced-motion 直接整句上(文案非动效,保留)。 */
    if (still) {
      textEl.textContent = line;
    } else {
      textEl.textContent = "";
      var i = 0;
      typeTimer = setInterval(function () {
        i += 1;
        textEl.textContent = line.slice(0, i);
        if (i >= line.length) {
          clearInterval(typeTimer);
          typeTimer = 0;
        }
      }, 34);
    }
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, (holdMs || Math.min(11000, 4200 + line.length * 90)) + (still ? 0 : line.length * 34));
  }

  function say(key, opt) {
    var pool = LINES[key];
    if (!pool || !pool.length) return false;
    var cfg = TRIG[key] || {};
    var now = Date.now();
    var said = get("echo-said", "");
    if (cfg.once) {
      if (said.indexOf("|" + key + "|") >= 0) return false;
    } else if (cfg.cool) {
      if (now - Number(get("echo-cool-" + key, "0")) < cfg.cool) return false;
      set("echo-cool-" + key, String(now));
    }
    if (!(opt && opt.force) && !cfg.force && now - Number(get("echo-last", "0")) < COOL) return false;
    if (cfg.once) set("echo-said", said + "|" + key + "|");
    set("echo-last", String(now));
    /* 不连续重复:池里多于一句时,跳过上一句刚说过的那句(台词可能连续触发相同台词的修法)。 */
    var idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && pool[idx] === lastShown) idx = (idx + 1) % pool.length;
    lastShown = pool[idx];
    show(pool[idx]);
    return true;
  }

  setTimeout(function () {
    var boAt = Number(get("echo-blackout", "0"));
    if (boAt && Date.now() - boAt < 25000) {
      set("echo-blackout", "0");
      return void show("……回来了。那玩意儿重启要三十秒。");
    }
    var m = window.__hudLeft && window.__hudLeft.music ? window.__hudLeft.music() : null;
    if (m && m.wantResume && m.paused && m.t > 1) {
      var s = Math.floor(m.t), mm = Math.floor(s / 60), ss = s % 60;
      return void show("……歌停在 " + mm + ":" + (ss < 10 ? "0" : "") + ss + "。想接着听,点一下就行。");
    }
    say("arrive");
  }, 1900);

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-hud-mod="world"]')) return void say("archive");
    if (t.closest('[data-hud-mod="music"]')) return void say("music");
    if (t.closest('[data-hud-mod="timer"]')) return void say("timer");
    if (t.closest("#hud-timer-toggle")) return void say("timerRun");
  }, true);

  if (window.MutationObserver) {
    var penOn = false;
    var obs = new MutationObserver(function () {
      var now = document.querySelectorAll("[data-hud-pen].is-on").length > 0;
      if (now && !penOn) say("pen");
      penOn = now;
    });
    [].forEach.call(document.querySelectorAll("[data-hud-pen]"), function (p) {
      obs.observe(p, { attributes: true, attributeFilter: ["class"] });
    });
  }

  var lastRun = null;
  function watchTimer() {
    var run = docEl.style.getPropertyValue("--hud-tomato-run").trim();
    var p = parseFloat(docEl.style.getPropertyValue("--hud-tomato-p")) || 0;
    if (lastRun === null) { lastRun = run; return; }
    if (lastRun === "1" && run === "0") {
      if (p >= 0.999) say("done");
      else if (p > 0.0005) say("giveUp");
    }
    lastRun = run;
  }
  if (window.MutationObserver) {
    new MutationObserver(watchTimer)
      .observe(docEl, { attributes: true, attributeFilter: ["style"] });
  }

  if (hot) {
    hot.addEventListener("pointerenter", function () {
      if (document.querySelector("[data-hud-pen].is-on")) say("hoverPen");
    });
  }

  var POKE_A = [
    "别戳。",
    "我统计了一下,你一共看过这一篇 {n} 遍了。怎么就记不住……",
    "……怎么记忆缺失了,学习也跟着缺失了?",
    "手拿开。",
    "你上一次也是这么戳的。",
    "摄像头不是按钮。……虽然它确实按得动。",
    "这块玻璃很薄,真的。",
    "我看得见你。别装了。"
  ];
  var POKE_B = [
    "说过了。",
    "提示只给一次,不补。",
    "你戳它也不会多冒一句出来。",
    "我记性比你好 —— 你问过了。",
    "回去再看一遍原文。真的。",
    "……你还没走啊。",
    "再戳也不会有新的。我保证。"
  ];
  var POKE_C = [
    "最后一次警告。",
    "我数到三。",
    "手还在上面。",
    "……你确定要试?",
    "行。你自己要的。"
  ];
  var POKE_THREAT = "……再点我就把你的带宽共识协议关掉。";
  var POKE_END = 8;

  function pick(pool) {
    var idx = Math.floor(Math.random() * pool.length);
    /* 不连续重复:上一句刚说过的话不再随机到 */
    if (pool.length > 1 && pool[idx] === lastShown) idx = (idx + 1) % pool.length;
    return pool[idx]
      .replace("{n}", String(10000 + Math.floor(Math.random() * 989999)));
  }

  function blackout() {
    var el = document.getElementById("echo-black");
    set("echo-poke:" + location.pathname, "0");
    set("echo-blackout", String(Date.now()));
    set("echo-last", String(Date.now()));
    hide();
    if (!el) { location.reload(); return; }
    docEl.style.overflow = "hidden";
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("is-on"); });
    setTimeout(function () { location.reload(); }, 1600);
  }

  var pokeAt = 0;
  function poke() {
    var now = Date.now();
    if (now - pokeAt < 700) return;
    pokeAt = now;
    var hint = (hud && hud.getAttribute("data-echo-hint")) || "";
    var key = "echo-poke:" + location.pathname;
    var n = Number(get(key, "0")) + 1;
    set(key, String(n));
    if (n <= 2) return void show(pick(POKE_A));
    if (n === 3) {
      if (hint) return void show("……行吧。就一句:" + hint);
      return void show("这儿没有能提示你的东西。");
    }
    if (n <= 5) return void show(pick(POKE_B));
    if (n === 6) return void show(POKE_THREAT);
    if (n === 7) return void show(pick(POKE_C));
    blackout();
  }
  if (hot) hot.addEventListener("click", poke);

  /* ---------- 陪伴层:读档久 / 深夜 / 连续翻档案 ---------- */
  var isWorldPage = /^\/world\//.test(location.pathname);

  /* 深夜(02:00–04:59)打开任意档案页 */
  if (isWorldPage) {
    (function deepNight() {
      var h = new Date().getHours();
      if (h >= 2 && h < 5) setTimeout(function () { say("deepNight"); }, 5200);
    })();

    /* 同页停留 >90s 且滚动过 → reading */
    (function readingWatch() {
      var t0 = Date.now();
      var scrolled = false;
      window.addEventListener("scroll", function () { scrolled = true; }, { passive: true, once: true });
      setTimeout(function () {
        if (scrolled && Date.now() - t0 > 90000) say("reading");
      }, 92000);
    })();

    /* 单会话连续打开 ≥4 份不同碎片 */
    (function fragmentCount() {
      var here = location.pathname;
      var trail = [];
      try { trail = JSON.parse(sessionStorage.getItem("echo-trail") || "[]"); } catch (e) { }
      if (trail[trail.length - 1] !== here) {
        trail.push(here);
        if (trail.length > 8) trail = trail.slice(-8);
        try { sessionStorage.setItem("echo-trail", JSON.stringify(trail)); } catch (e) { }
      }
      var uniq = {};
      trail.forEach(function (p) { uniq[p] = 1; });
      if (Object.keys(uniq).length >= 4) setTimeout(function () { say("manyFragments"); }, 4000);
    })();
  }

  window.__echo = {
    say: say,
    show: show,
    hide: hide,
    poke: poke,
    blackout: blackout,
    count: function () { return Number(get("echo-poke:" + location.pathname, "0")); },
    line: function () { return textEl.textContent; },
    on: function () { return bubble.classList.contains("is-on"); },
    hint: function () { return (hud && hud.getAttribute("data-echo-hint")) || ""; },
    eyes: function () {
      return {
        eye: eye ? eye.getAttribute("transform") : null,
        pupil: pupil ? pupil.getAttribute("transform") : null
      };
    },
    still: still
  };
})();
