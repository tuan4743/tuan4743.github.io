(function () {
  "use strict";

  var KEY = "home-guide-done";
  var tablet = document.getElementById("tablet");
  var eyeHost = document.getElementById("home-eye");
  var eyePre = document.getElementById("home-eye-pre");
  var consoleEl = document.getElementById("home-console");
  var lineEl = document.getElementById("home-console-line");
  if (!tablet || !eyeHost || !eyePre || !consoleEl || !lineEl) return;

  var docEl = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FAST = /[?&]fast=1/.test(location.search);
  var settleMs = (reduced || FAST) ? 30 : 520;
  var gate = function (ms) { return (reduced || FAST) ? Math.min(ms, 90) : ms; };

  var eye = null;
  var playing = false;
  var skipping = false;
  var locked = false;
  var wheelLocked = false;
  var stepIndex = -1;
  var stepLabel = "";
  var stepList = [];
  var typeDone = true;
  var snapNow = null;
  var snapTarget = null;
  var gazeMode = "scan";
  var frameRect = null;                    /* 扫描框当前该在的矩形(视线每帧跟着它)。
                                              ★★★ 字段名统一成 left/top/width/height,
                                              【和 getBoundingClientRect() 同构】——
                                              这里踩过一次:字段用的是 x/y/w/h,而
                                              lookAtRect 里读的是 p.left/p.top/p.width,
                                              于是每次算出来都是 NaN,一路写进
                                              eye.setGaze(NaN, NaN)。症状是"眼睛完全
                                              不跟框",而控制台一声不响(NaN 不抛异常)。
                                              两处名字对齐之后这类错就不可能再发生。 */
  var guidePos = { x: -1, y: -1 };

  var staticWrap = document.getElementById("screen-static");

  function blackout() {
    docEl.classList.remove("home-boot");
    docEl.classList.add("home-dark");
    tablet.classList.remove("is-scan");
    lockTop(true);
    lockSlot(true);
    tablet.classList.add("is-dark");
    if (window.__tabletOpen) window.__tabletOpen(true);
    void tablet.offsetWidth;
    tablet.classList.add("is-scan");
    setTimeout(function () { tablet.classList.remove("is-scan"); }, reduced ? 0 : 1600);
    if (window.__cdPreview) window.__cdPreview(false);
  }

  function lockTop(on) {
    var t = document.getElementById("statusbar-toggle");
    docEl.classList.toggle("top-locked", !!on);
    if (!t) return;
    t.classList.toggle("is-locked", !!on);
    t.setAttribute("aria-hidden", on ? "true" : "false");
  }

  var slotOpened = false;
  function lockSlot(on) {
    if (!on) slotOpened = true;
    if (slotOpened) on = false;
    docEl.classList.toggle("slot-locked", !!on);
    var t = document.querySelector(".slot-toggle");
    if (!t) return;
    t.classList.toggle("is-locked", !!on);
    t.setAttribute("aria-hidden", on ? "true" : "false");
  }

  function watchBootEnd() {
    if (!staticWrap || !window.MutationObserver) { docEl.classList.remove("home-dark"); return; }
    var obs = new MutationObserver(function () {
      if (staticWrap.classList.contains("is-black")) return;
      docEl.classList.remove("home-dark");
      obs.disconnect();
    });
    obs.observe(staticWrap, { attributes: true, attributeFilter: ["class"] });
    setTimeout(function () { docEl.classList.remove("home-dark"); obs.disconnect(); }, 12000);
  }

  function cssPx(name, dflt) {
    var v = getComputedStyle(docEl).getPropertyValue(name);
    var n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r: r };
  }

  function regionRect(sel) {
    var host = tablet.getBoundingClientRect();
    var map = {
      "rack-info": [0.03, 0.06, 0.42, 0.30],
      "rack-discs": [0.30, 0.26, 0.62, 0.46],
      "tablet-all": [0.02, 0.02, 0.96, 0.96]
    };
    var f = map[sel] || map["tablet-all"];
    return {
      left: host.left + host.width * f[0],
      top: host.top + host.height * f[1],
      width: host.width * f[2],
      height: host.height * f[3]
    };
  }

  function moveTo(x, y) {
    guidePos.x = x; guidePos.y = y;
    try {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: y }));
    } catch (e) { }
    var el = document.elementFromPoint(x, y);
    if (el && el.dispatchEvent) {
      try { el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: x, clientY: y })); } catch (e) { }
    }
  }

  function clearTarget() {
    var el = snapNow;
    if (el && el.dispatchEvent) {
      try { el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); } catch (e) { }
    }
    snapNow = null;
    window.__mcScript = null;
  }

  function scriptSnap(left, top, w, h) {
    var cx = Math.round(left + w / 2), cy = Math.round(top + h / 2);
    guidePos.x = cx; guidePos.y = cy;
    try {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: cx, clientY: cy }));
      window.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: cx, clientY: cy }));
    } catch (e) { }
    var el = document.elementFromPoint(cx, cy);
    if (el && el.dispatchEvent) {
      try { el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: cx, clientY: cy })); } catch (e) { }
    }
    window.__mcScript = { x: cx, y: cy, w: Math.round(w), h: Math.round(h) };
    frameRect = { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
  }


  function snap(spec) {
    if (!spec || spec === "clear") { clearTarget(); return; }
    if (spec.indexOf("region:") === 0) {
      var r = regionRect(spec.slice(7));
      if (!(r.width > 1 && r.height > 1)) return null;
      scriptSnap(r.left, r.top, r.width, r.height);
      snapNow = null;
      return null;
    }
    var el = document.querySelector(spec);
    if (!el) return;
    var b = el.getBoundingClientRect();
    if (!(b.width > 0 || b.height > 0)) return null;
    scriptSnap(b.left - 2, b.top - 2, b.width + 4, b.height + 4);
    snapNow = el;
    return el;
  }

  var lastSnapSpec = null;
  function refreshSnap() {
    if (!lastSnapSpec) return;
    var r;
    if (lastSnapSpec.indexOf("region:") === 0) {
      r = regionRect(lastSnapSpec.slice(7));
      if (!(r.width > 1 && r.height > 1)) return;
      scriptSnap(r.left, r.top, r.width, r.height);
      return;
    }
    var el = document.querySelector(lastSnapSpec);
    if (!el) return;
    var b = el.getBoundingClientRect();
    if (!(b.width > 0 || b.height > 0)) return;
    scriptSnap(b.left - 2, b.top - 2, b.width + 4, b.height + 4);
    snapNow = el;
  }
  function setSnapSpec(spec) { lastSnapSpec = spec; }

  var GRAB = 6;

  /* 隐性跳过的连点计数必须注册在 eat() 之前:
     eat 在锁定阶段会对 pointerdown 调 stopImmediatePropagation,
     同节点后注册的监听再也收不到 —— 注册在它前面才能全程计数。 */
  function onRushTap(e) {
    if (!playing || rushFast) return;
    if (e.target && e.target.closest && e.target.closest(".slot-toggle, #rack-insert, #intro-toggle, #statusbar-toggle")) return;
    var now = performance.now();
    taps = taps.filter(function (t) { return now - t < 2400; });
    taps.push(now);
    if (taps.length >= 5) {
      taps.length = 0;
      rushFast = true;                 /* 立刻停主链:后续步骤的台词/等待全部不再发起 */
      rushPromise = say(RUSH_LINE);    /* 打断当前句,插话从空行逐字打出 */
    }
  }
  window.addEventListener("pointerdown", onRushTap, true);

  function eat(e) {
    if (e.type === "wheel") {
      if (!wheelLocked) return;
    } else if (e.type === "pointermove" || e.type === "mousemove") {
      if (!locked) return;
      var dx = e.clientX - guidePos.x, dy = e.clientY - guidePos.y;
      if (guidePos.x >= 0 && Math.abs(dx) <= GRAB && Math.abs(dy) <= GRAB) return;
    } else if (!locked) {
      return;
    }
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  }
  ["pointermove", "mousemove", "pointerdown", "mousedown", "wheel"].forEach(function (t) {
    window.addEventListener(t, eat, { capture: true, passive: false });
  });

  function lock(on) {
    locked = !!on;
    docEl.classList.toggle("guide-lock", locked);
    if (locked) window.__mcSpinScale = 0.12;
    else window.__mcSpinScale = 1;
  }
  function lockWheel(on) { wheelLocked = !!on; }

  var VOICE = {
    char: 62, charJitter: 0.38,
    punct: {
      "。": 340, ".": 340, "?": 340, "!": 340,
      ",": 150, "、": 130, ";": 160, ":": 170, "-": 180, "—": 190,
      "…": 300,
      ")": 90, "」": 120, "”": 120
    },
    breath: 120,
    gap: 1250,
    fastChar: 0, fastGap: 40
  };
  function voiceFast() { return FAST && !reduced ? true : FAST; }
  function applyVoice(patch) {
    if (!patch) return VOICE;
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) {
      if (k === "punct") { for (var p in patch.punct) VOICE.punct[p] = patch.punct[p]; }
      else VOICE[k] = patch[k];
    }
    return VOICE;
  }

  function charGap(text, i) {
    if (FAST) return VOICE.fastChar;
    var ch = text.charAt(i);
    var prev = i > 0 ? text.charAt(i - 1) : "";
    if (i > 0 && /[A-Za-z0-9_]/.test(ch) && /[A-Za-z0-9_]/.test(prev)) {
      return Math.max(16, VOICE.char * 0.32);
    }
    var d = VOICE.char * (1 + (Math.random() * 2 - 1) * VOICE.charJitter);
    if (ch === "…" && prev === "…") return VOICE.char + 70;
    var p = VOICE.punct[ch];
    if (p) d += p;
    if (prev && VOICE.punct[prev] && prev !== "…") d += VOICE.breath;
    return d;
  }

  /* say():每句话自带计时器句柄(局部 myTimer),代际号 sayEpoch 判让位。
     旧版共用 speaking 一个变量:隐性跳过 say(插话)一进来就把它
     clearTimeout 掉,而当前句正挂在它自己的计时器上 —— 被打断的
     promise 永远不 resolve,play 主链悬死,引导就"不会终止"。
     现在被打断时:旧循环看到代际号变了,当场 resolve 让位,不再写行。 */
  var sayEpoch = 0;
  function say(text) {
    var my = ++sayEpoch;
    var myTimer = 0;
    var stopped = false;
    consoleEl.classList.add("is-on");
    lineEl.textContent = "";
    consoleEl.classList.remove("is-typed");
    typeDone = false;
    var done = function () {
      typeDone = true;
      consoleEl.classList.add("is-typed");
    };
    if (!text) { done(); return Promise.resolve(); }
    if (VOICE.fastChar <= 0 && FAST) { lineEl.textContent = text; done(); return Promise.resolve(); }
    return new Promise(function (resolve) {
      var i = 0;
      (function tick() {
        if (stopped || my !== sayEpoch) { resolve(); return; }   /* 被新 say 接管:让位 */
        if (skipping) { lineEl.textContent = text; done(); resolve(); return; }
        i++;
        lineEl.textContent = text.slice(0, i);
        if (i >= text.length) { done(); resolve(); return; }
        myTimer = setTimeout(tick, charGap(text, i - 1));
      })();
    }).then(function () {
      return new Promise(function (r) {
        if (stopped || my !== sayEpoch) { r(); return; }
        myTimer = setTimeout(function () {
          if (my !== sayEpoch) { r(); return; }
          r();
        }, FAST ? VOICE.fastGap : VOICE.gap);
      });
    });
  }

  function step(o) { return o; }

  function steps() {
    return [
      step({
        label: "睁眼",
        eye: "reveal",
        wait: reduced ? 200 : 2200
      }),
      step({ text: "登入完成。哦,是你啊。怎么又变成了这样。" }),
      step({ text: "我是方舟总控 AI 子代理,代号 ECHOM_D29_Z68J521,……你叫我 ECHO。" }),
      step({ text: "本系统记录,这是你第 27 次未按时进行人格修正,你能不能长点记性?", accent: "correction" }),
      step({ text: "一旦长时间未修正,锚点将发生不可逆偏移。" }),
      step({ text: "……好吧,我又得重来一遍:" }),

      step({
        label: "整块平板",
        snap: "region:tablet-all",
        text: "这是总控修正终端,你需要在这里完成五项修正。"
      }),

      step({
        label: "下滑栏",
        snap: "#statusbar-toggle",
        lock: true,
        unlockTop: true,
        text: "这是终端按钮,按下可以切换终端设置页,在设置页你可以前往核心数据库,或者对终端环境进行一些设置。"
      }),

      step({
        label: "CD 架按钮",
        snap: "#intro-toggle",
        lock: true,
        text: "从这里可以进入情感引擎安装仓。"
      }),
      step({ gaze: "center", text: "这可是你的杰作。从里面你可以校准自己的人格。" }),
      step({
        label: "按下它",
        snap: ".slot-toggle",
        unlock: true,
        gaze: "scan",
        text: "按下它。",
        press: ".slot-toggle"
      }),

      step({
        label: "进入 CD 页",
        dock: true,
        wait: reduced ? 500 : 2600
      }),
      step({ label: "引擎内容", snap: "region:rack-info", text: "这是引擎的内容。" }),
      step({ label: "CD 区", snap: "region:rack-discs", text: "你的滤网协议还挺有意思?" }),
      step({
        lockWheel: true,
        text: "滚轮滑动可以上下选择……你能不能消停一会,等你先完成这一张再滑。"
      }),
      step({ label: "插入按钮", snap: "#rack-insert", wheelLock: true, text: "这是插入按钮,可以插入当前引擎。" }),
      step({
        label: "按下,进入第一次校准",
        snap: "#rack-insert",
        unlock: true,
        unlockWheel: true,
        text: "按下,进入第一次校准。",
        press: "#rack-insert",
        finish: true
      })
    ];
  }

  function waitWhileTyping() {
    return new Promise(function (resolve) {
      (function poll() {
        if (typeDone || skipping || rushFast) { resolve(); return; }
        setTimeout(poll, 90);
      })();
    });
  }
  function sleep(ms) {
    return new Promise(function (r) {
      if (skipping || rushFast) { setTimeout(r, Math.min(ms, 90)); return; }
      setTimeout(r, ms);
    });
  }

  function eyeReveal() {
    if (!eye) return;
    eyeHost.classList.add("is-on");
    eye.start(true);
  }

  // “第 27 次未按时进行人格修正”这一句的视觉加重:
  // 眼睛抖红一瞬 + 整屏闪一帧警告色(样式在 tablet.css,无新系统)。
  function accentCorrection() {
    if (reduced) return;
    var pre = eyePre;
    if (pre) {
      pre.classList.add("is-glitch-red");
      setTimeout(function () { pre.classList.remove("is-glitch-red"); }, 620);
    }
    var flash = document.createElement("div");
    flash.className = "ff-redflash";
    document.body.appendChild(flash);
    setTimeout(function () { flash.remove(); }, 640);
  }

  var pulseEl = null;
  function pulseTarget(sel, on) {
    if (pulseEl) { pulseEl.classList.remove("is-guide-pulse"); pulseEl = null; }
    if (!on) return;
    var el = document.querySelector(sel);
    if (!el) return;
    el.classList.add("is-guide-pulse");
    pulseEl = el;
  }

  var DOCK_TILT = 90;
  var DOCK_CLOSE_MS = 320;
  var DOCK_SETTLE_MS = 700;
  var dockStage = 0;

  function dockPress() {
    if (dockStage) return;
    dockStage = 1;
    window.__dockAt = { press: Math.round(performance.now()) };
    consoleEl.classList.remove("is-on");
    beginDockClose().then(dockSettle);
  }

  function dockSettle() {
    if (dockStage >= 2) return;
    dockStage = 2;
    window.__dockAt.dock = Math.round(performance.now());
    dockIntoBox();
    return sleep(FAST ? 80 : DOCK_SETTLE_MS).then(dockOpen);
  }

  function dockOpen() {
    if (dockStage >= 3) return;
    dockStage = 3;
    window.__dockAt.open = Math.round(performance.now());
    if (eye && eye.offsetX) eye.offsetX(0);
    if (eye && eye.openNow) eye.openNow();
    dockIntoBox();
    eyeHost.classList.add("is-on");
  }

  var eyeCarried = false;
  function carryEye() {
    if (!eye || !eye.offsetX) return;
    if (dockStage !== 1) {
      if (eyeCarried) { eye.offsetX(0); eyeCarried = false; }
      return;
    }
    var s = document.getElementById("scene");
    var x = 0;
    try {
      var cs = s ? getComputedStyle(s) : null;
      if (cs && cs.transform && cs.transform !== "none") {
        x = new DOMMatrixReadOnly(cs.transform).m41;
      }
    } catch (e) { x = 0; }
    if (!isFinite(x)) x = 0;
    eye.offsetX(x);
    eyeCarried = true;
  }

  var dockWatchOn = false;
  function watchDockPress() {
    if (dockWatchOn) return;
    dockWatchOn = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.closest && t.closest(".slot-toggle, #intro-toggle")) dockPress();
    }, true);
    try {
      new MutationObserver(function () {
        if (document.body.classList.contains("scene-open")) dockPress();
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch (e) { }
    (function poll() {
      if (dockStage || !playing) return;
      if (document.body.classList.contains("scene-open")) { dockPress(); return; }
      setTimeout(poll, 40);
    })();
  }


  var dockClosing = null;
  function beginDockClose() {
    if (!dockClosing) dockClosing = closeEye();
    return dockClosing;
  }

  function closeEye() {
    return new Promise(function (resolve) {
      if (!eye) return resolve();
      if (eye.freeLook) eye.freeLook(false);
      var done = false;
      var fin = function () { if (!done) { done = true; resolve(); } };
      try { eye.close(fin, DOCK_CLOSE_MS); } catch (e) { fin(); }
      setTimeout(fin, DOCK_CLOSE_MS + 500);
    });
  }

  function dockIntoBox() {
    eyeHost.classList.add("is-docked");
    var vw = window.innerWidth, vh = window.innerHeight;
    var winL = cssPx("--ff-win-left", vw * 0.05);
    var winR = cssPx("--ff-win-right", vw * 0.05);
    var glassW = Math.max(320, vw - winL - winR);
    var r = tablet.getBoundingClientRect();
    var visR = Math.min(r.right || vw, vw);
    if (!(visR > 80)) visR = vw - 12;
    var third = glassW / 3;
    if (eye.rotate) eye.rotate(DOCK_TILT);
    var strip = stripBox(vw, visR);
    var L = Math.max(220, Math.round(Math.min(vh * 0.62, third * 1.5, strip.w * 1.8)));
    var hostW = L;
    var hostH = Math.max(120, Math.round(L * 0.56));
    var cx = stripCenterX(strip, hostW);
    eye.anchor(cx - hostW / 2, (vh - hostH) / 2, hostW, hostH);
    eye.fitTo(hostW, hostH / 0.86);
  }

  function stripLeftX(vw) {
    var rack = document.querySelector(".rack");
    if (rack) {
      var r = rack.getBoundingClientRect();
      if (r.left <= 1 && r.right > vw * 0.2 && r.right < vw * 0.9) return r.right;
    }
    return cssLen("--rack-w", vw * 0.66);
  }

  function cssLen(name, dflt) {
    var box = document.createElement("div");
    box.style.cssText = "position:absolute;left:-9999px;top:0;height:0;pointer-events:none;width:var(" + name + ")";
    (document.body || docEl).appendChild(box);
    var w = box.getBoundingClientRect().width;
    if (box.parentNode) box.parentNode.removeChild(box);
    return isFinite(w) && w > 1 ? w : dflt;
  }

  function stripBox(vw, visR) {
    var l = Math.max(0, Math.min(stripLeftX(vw), vw * 0.86));
    var r = Math.max(l + 120, Math.min(visR || vw, vw));
    return { l: l, r: r, w: r - l };
  }

  function stripCenterX(strip, hostW) {
    var cx = strip.l + strip.w * 0.60;
    var half = hostW * 0.56 / 2;
    return Math.max(strip.l + 6 + half, Math.min(cx, strip.r - 6 - half));
  }

  function runDock() {
    if (!dockStage) dockPress();
    return beginDockClose().then(function () {
      return sleep(FAST ? 160 : DOCK_SETTLE_MS + 320);
    });
  }

  function followLoop() {
    if (!playing) return;
    requestAnimationFrame(followLoop);
    window.__followTicks = (window.__followTicks || 0) + 1;
    refreshSnap();
    carryEye();
    if (gazeMode !== "scan" || !eye) return;
    if (frameRect) lookAtRect(frameRect);
  }

  function lookAtRect(p) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cx = p.left + p.width / 2, cy = p.top + p.height / 2;
    var gx = ((cx - vw / 2) / (vw / 2)) * 1.25;
    var gy = ((cy - vh / 2) / (vh / 2)) * 1.25;
    if (!isFinite(gx) || !isFinite(gy)) return;
    window.__lastGaze = { gx: Math.round(gx * 1000) / 1000, gy: Math.round(gy * 1000) / 1000, rect: [Math.round(p.left), Math.round(p.top), Math.round(p.width), Math.round(p.height)] };
    eye.setGaze(gx, gy);
  }

  function runStep(s, i) {
    stepIndex = i;
    stepLabel = s.label || "";
    var next = stepList[i + 1] || null;
    if (s.lock) lock(true);
    if (s.unlock) lock(false);
    if (s.unlockTop) lockTop(false);
    if ((s.snap === "#intro-toggle" || s.snap === ".slot-toggle" ||
         s.press === ".slot-toggle" || s.press === "#intro-toggle")) lockSlot(false);
    if (s.wheelLock) lockWheel(true);
    if (s.unlockWheel) lockWheel(false);

    if (s.snap) {
      setSnapSpec(s.snap);
      var t = snap(s.snap);
      snapTarget = t || null;
      gazeMode = "scan";
    }
    if (s.gaze === "center") { gazeMode = "center"; if (eye) eye.centerGaze(); }
    if (s.gaze === "scan") gazeMode = "scan";
    if (s.eye === "reveal") eyeReveal();
    if (s.dock) {
      runDock();
    }

    var tasks = [];
    if (s.press) {
      tasks.push(function () {
        if (next && next.dock) watchDockPress();
        watchPressStart(s.press);
        window.__mcScript = null;
        lastSnapSpec = null;
        frameRect = null;
        pulseTarget(s.press, true);
        return null;
      });
    }
    if (s.text) {
      tasks.push(function () {
        if (s.accent === "correction") accentCorrection();
        if (rushFast) return Promise.resolve();  /* ECHO 插话后:后续介绍台词不再说 */
        return say(s.text);
      });
    }
    if (s.press) {
      tasks.push(function () {
        if (rushFast) { pulseTarget(s.press, false); return Promise.resolve(); }  /* 插话后:不等按压 */
        return waitForUser(s.press);
      });
    }
    if (!tasks.length) {
      tasks.push(function () { return sleep(gate(s.wait || 0)).then(function () { return sleep(settleMs); }); });
    }
    var p = Promise.resolve();
    tasks.forEach(function (fn) { p = p.then(fn); });
    window.__stepInfo = window.__stepInfo || {};
    window.__stepInfo[i] = { label: s.label || "", tasks: tasks.length, at: Math.round(performance.now()) };
    p.then(function () { window.__stepInfo[i].end = Math.round(performance.now()); },
      function (e) { window.__stepInfo[i].rej = String((e && e.message) || e); });
    return p;
  }

  var pressedAt = {};

  var winkedOut = false;
  function winkOut() {
    if (winkedOut) return;
    winkedOut = true;
    consoleEl.classList.remove("is-on");
    var off = function () { eyeHost.classList.remove("is-on"); };
    try {
      if (eye && eye.close) eye.close(off, DOCK_CLOSE_MS);
      else off();
    } catch (e) { off(); }
    setTimeout(off, DOCK_CLOSE_MS + 60);
  }

  function watchPressStart(sel) {
    if (!sel || pressedAt["@" + sel]) return;
    pressedAt["@" + sel] = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest(sel)) return;
      if (pressedAt[sel] === undefined) pressedAt[sel] = Math.round(performance.now());
      if (sel === "#rack-insert") winkOut();
    }, true);
  }

  function makeWaiter(sel) {
    if (sel === "#intro-toggle" || sel === ".slot-toggle") {
      return {
        done: function () { return pressedAt[sel] !== undefined || document.body.classList.contains("scene-open"); },
        watch: null
      };
    }
    if (sel === "#statusbar-toggle") {
      return {
        done: function () { return pressedAt[sel] !== undefined || document.body.classList.contains("tablet-open"); },
        watch: null
      };
    }
    if (sel === "#rack-insert") {
      var started = false;
      return {
        done: function () { return pressedAt[sel] !== undefined || started; },
        watch: function (arm) {
          if (arm) document.addEventListener("cd-busy", function (e) {
            if (e && e.detail === true) started = true;
          });
        }
      };
    }
    return {
      done: function () { return pressedAt[sel] !== undefined; },
      watch: function (arm) { },
      fallbackSel: sel
    };
  }

  function waitForUser(sel) {
    lock(false);
    lockWheel(false);
    var el = document.querySelector(sel);
    if (!el) return sleep(200);
    var w = makeWaiter(sel);
    if (w.watch) w.watch(true);
    window.__pressState = { sel: sel, at: Math.round(performance.now()), hit: 0, done: 0, pre: w.done() };
    if (w.done()) return Promise.resolve();
    return new Promise(function (resolve) {
      var t0 = performance.now();
      var poll = 0;
      var finish = function (why) {
        if (window.__pressState.done) return;
        window.__pressState.done = 1;
        window.__pressState.why = why;
        try { if (poll) clearInterval(poll); } catch (e) { }
        pulseTarget(sel, false);
        resolve();
      };
      poll = setInterval(function () {
        var now = performance.now();
        var isDone = false;
        try { isDone = w.done(); } catch (e) { if (window.__pressState) window.__pressState.err = String(e && e.message || e); }
        if (isDone) { finish("state"); return; }
        if (skipping || rushFast) { finish("rush"); return; }   /* 快进 / ECHO 插话后:不等用户按了 */
        if (now - t0 > 60000) finish("timeout");
      }, 60);
    });
  }

  /* ============================================================
     隐性跳过分支(整块重写)
     ─────────────────────────────────────────────────────────────
     触发:引导播放中,2.4s 内连点 5 次(排除引导自己的按钮)。
     行为 = 用户逐字描述:"触发后当前对话结束停止当前对话并触发新对话"
       1) 立刻 say(RUSH_LINE):sayEpoch++ 让当前句当场断 promise、
          让出屏幕;插话从空行逐字打出 —— 即"当前对话结束、触发新对话"。
       2) 插话说完 rushFast = true;play 链的下一个链环立刻置 finished,
          直接跳到 finishGuide() 收尾 —— 收尾就是原有那份(一帧解除
          is-dark / scene-open / is-docked / home-boot / home-dark 等
          全部隐藏态),不做任何平行动画,所以不会再有:
          "背景露平板"、"顶部按钮消失"、"卡死在最后不收尾"。

     不变式(相对旧版的所有教训):
       - 只有一个终点:finishGuide。rush 不自带任何收尾/清屏逻辑。
       - rush 不碰 skipping(显式空格快进)的语义,二者互不干扰。
       - 旧 say 的 promise 一定 resolve(靠 sayEpoch 让位),主链不会悬死。
       - 插话完成后任何 pointerdown 不再累计(taps 冷却),不会二次触发。
       - 即使主链因极端原因仍卡在某一步,waitForUser / sleep 均有
         60s/正常时长上限,finishGuide 最迟仍会被走到。
       - 兜底 10s 强制收尾,保证"不会卡死在动画最后"。
     ============================================================ */
  var RUSH_LINE = "这么着急?好吧,你自己看着办。";
  var taps = [];
  var rushFast = false;          /* 插话已触发:主链停止推进,收尾走 finishGuide */
  var rushDone = false;          /* 兜底收尾已执行,防止 finishGuide 跑两次 */
  var rushPromise = null;        /* 插话台词的 say promise(play 链等它说完再收尾) */
  /* 计数监听注册在 eat() 之前(见 GRAB 上方),这里不再重复注册 */

  function play() {
    if (playing) return Promise.resolve();
    window.__playCount = (window.__playCount || 0) + 1;
    playing = true;
    try {
      var bEl = document.getElementById("home-console-build");
      if (bEl) bEl.textContent = "· b:" + (window.__build || "?") + (FAST ? " · fast" : "");
    } catch (e) { }
    skipping = false;
    gazeMode = "scan";
    playStart = performance.now();
    followLoop();
    var list = steps();
    stepList = list;
    var p = Promise.resolve();
    var finished = false;
    list.forEach(function (s, i) {
      p = p.then(function () {
        if (rushFast) {
          /* 插话后:等插话说完,一次性跳到收尾 */
          if (!finished) {
            finished = true;
            var end = function () { playing = false; finishGuide(); };
            if (rushPromise && rushPromise.then) return rushPromise.then(end, end);
            end();
          }
          return null;
        }
        if (skipping) { return null; }
        return runStep(s, i).catch(function (e) {
          window.__guideError = (window.__guideError || []).concat(
            ["step " + i + " (" + (s.label || s.text || "") + "): " + ((e && e.message) || e)]);
          console.error("[home-guide] 第 " + i + " 步出错:", e);
        });
      });
    });
    /* 兜底:插话后若主链因任何一个 promise 不落(如 waitForUser 已在等)卡住,
       10s 后强制收尾 —— 保证永远不会"卡死在动画最后不收尾" */
    var guard = setTimeout(function () {
      if (playing && rushFast && !rushDone) { rushDone = true; finishGuide(); playing = false; }
    }, 10000);
    return p.then(function () {
      clearTimeout(guard);
      playing = false;
      finishGuide();
    });
  }

  function finishGuide() {
    lock(false);
    lockTop(false);
    lockWheel(false);
    lockSlot(false);
    window.__mcSpinScale = 1;
    window.__mcScript = null;
    lastSnapSpec = null;

    /* 收尾必须在一帧内把所有"隐藏态"全部解除,不允许留下任何中间态:
       - is-dark:平板黑幕(引导期间只露眼睛)
       - top-locked/is-locked:顶部按钮隐藏
       - scene-open:CD 页展开(也会隐藏顶部按钮;快进跳过 dock 收起时会残留)
       - is-docked:眼睛停靠 CD 页一角的残留
       - home-boot / home-dark:黑屏双闸;快进路径没有随后的 CD boot,
         黑底必须当场撤,否则"背景露平板/顶部按钮消失" */
    tablet.classList.remove("is-dark");
    document.body.classList.remove("scene-open");
    eyeHost.classList.remove("is-docked");
    if (window.__tabletOpen) window.__tabletOpen(false);

    var winked = false;
    var wink = function () { if (!winked) { winked = true; eyeHost.classList.remove("is-on"); } };
    try {
      if (eye && eye.close) eye.close(wink, DOCK_CLOSE_MS);
      else wink();
    } catch (e) { wink(); }
    setTimeout(wink, DOCK_CLOSE_MS + 60);
    consoleEl.classList.remove("is-on");
    setTimeout(function () {
      consoleEl.hidden = true;
      if (eye) { eye.stop(); eyePre.textContent = ""; }
    }, DOCK_CLOSE_MS + 180);
    docEl.classList.remove("home-boot");
    docEl.classList.remove("home-dark");
    watchBootEnd();
    if (window.__cdPreview) window.__cdPreview(true);
    window.__guideDone = true;
  }

  var playStart = 0;
  function skip() {
    if (!playing || skipping) return;
    if (performance.now() - playStart < 400) return;
    skipping = true;
    sayEpoch++;              /* 当前打字循环下一拍让位,行内直接补完整句 */
    typeDone = true;
    consoleEl.classList.add("is-typed");
  }
  document.addEventListener("keydown", function (e) {
    if (!playing) return;
    if (e.key !== " " && e.key !== "Enter" && e.key !== "Escape") return;
    skip();
  });

  function shouldPlay() { return true; }

  function build() {
    if (!window.AsciiEye) return false;
    eye = window.AsciiEye.create(eyePre, {
      gaze: "fixed",
      drift: false,
      reduced: reduced
    });
    window.__mcOnPointer = function (x, y, real) {
      if (!real || !eye) return;
      if (gazeMode !== "scan") return;
      if (eye.onPointer) eye.onPointer(x, y);
    };
    return !!eye;
  }

  function expose() {
    window.__homeEyeApi = eye;
  }

  var booted = false;
  window.__homeBoot = function () {
    if (booted) return;
    booted = true;
    blackout();
    if (!build()) { console.warn("[home-guide] ascii-eye 没就绪,引导跳过"); return; }
    expose();
    eye.resize();
    eyeHost.classList.remove("is-docked");

    if (!shouldPlay()) {
      eyeHost.classList.add("is-on");
      eye.openNow();
      consoleEl.hidden = true;
      setTimeout(function () {
        eyeHost.classList.remove("is-on");
        tablet.classList.remove("is-dark");
        setTimeout(function () { eye.stop(); eyePre.textContent = ""; }, 600);
      }, 9000);
      return;
    }

    consoleEl.hidden = false;
    requestAnimationFrame(function () { consoleEl.classList.add("is-on"); });
    play();
  };

  setTimeout(function () { if (!booted) window.__homeBoot(); }, 6000);

  window.__guide = function () {
    var mc = window.__mc || null;
    return {
      playing: playing,
      skipping: skipping,
      step: stepIndex,
      label: stepLabel,
      typed: typeDone,
      locked: locked,
      wheelLocked: wheelLocked,
      line: lineEl.textContent,
      snap: snapNow ? (snapNow.id || snapNow.className) : null,
      docked: eyeHost.classList.contains("is-docked"),
      eyeOn: eyeHost.classList.contains("is-on"),
      dark: tablet.classList.contains("is-dark"),
      closing: !!dockClosing,
      dockStage: dockStage,
      dockAt: window.__dockAt || null,
      host: (function () {
        var r = eyeHost.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      })(),
      pre: (function () {
        if (!eyePre) return null;
        var r = eyePre.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      })(),
      eye: eye ? eye.state() : null,
      frame: mc ? { x: mc.x, y: mc.y, w: mc.w, h: mc.h, locked: mc.locked } : null
    };
  };
})();
