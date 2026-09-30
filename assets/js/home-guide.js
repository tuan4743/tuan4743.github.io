/* ============================================================
   首页开机引导(用户第二轮)
   ─────────────────────────────────────────────────────────────
   用户(逐字,别改需求):
     · "进入首页的初始化从进入CD页转为直接停在平板上,此时平板是黑屏。"
     · "然后把启动页的眼睛移植过去,触发动画和对话(对话逐字打出),按照顺序给出:"
        动画:平板上眼睛睁开
        对话:你好.哦,是你啊.怎么又变成了这样.
        对话:我是方舟总控AI子代理,代号ECHOM_D29_Z68J521,......你叫我ECHO.
        对话:本系统记录,这是你第27次未按时进行人格修正,你能不能长点记性?
        对话:一旦长时间未修正,锚点将发生不可逆偏移.
        对话:......好吧,我又得重来一遍:
        动画:鼠标扫描框自动吸附到整个平板页面,注意瞳孔也要跟着移动,包括后面.
        对话:这是总控修正终端,你需要在这里完成五项修正.
        动画:鼠标扫描框自动吸附到平板上侧的下滑栏(锁住鼠标不允许按下).
        对话:按下可以展开终端设置页,在设置页你可以前往核心数据库,或者对终端环境进行一些设置.
        动画:鼠标扫描框自动吸附到平板左侧的打开CD架按钮(锁住鼠标不允许按下).
        对话:从这里可以进入情感引擎安装仓.
        对话:(瞳孔转向面对屏幕正中央)这可是你的杰作.从里面你可以校准自己的人格.
        对话:(瞳孔变回跟随扫描框)按下它(解锁鼠标,允许按下按钮).
        动画:按下之后,由于进入CD页,此时平板就展示了三分之一,所以要把眼睛转个向并缩小放到右侧三分之一的平板屏幕上.
        动画:鼠标扫描框自动吸附到左上角的文字区域(这里没有做实际吸附的框,吸附大致范围)
        对话:这是引擎的内容.
        动画:鼠标扫描框自动吸附到CD区域(同样也没做实际吸附框,需要吸附大致范围)
        对话:你的滤网协议还挺有意思?
        对话:(此时需要锁住滚轮)滚轮滑动可以上下选择......你能不能消停一会,等你先完成这一张再滑.
        动画:鼠标扫描框自动吸附到左侧的插入按钮.
        对话:(锁住按钮)这是插入按钮,可以插入当前引擎.
        对话:(解锁按钮)按下,进入第一次校准.
        按下后就正常了,所有动画结束。

   ─────────────────────────────────────────────────────────────
   ★★ 扫描框是【真的那个扫描框】,不是另画一个:
      整段动画靠派发合成事件驱动(pointermove / mouseover / click),
      magnetic-cursor.js 和 intro.js 分不出真假,照常反应。
      这样"引导里框停在哪儿"和"用户自己把鼠标移上去"永远是同一个位置 ——
      另画一个假框的话,两边迟早在某个分辨率下对不上。

   ★★ "锁住鼠标"= html.guide-lock(pointer-events:none)+ 在捕获阶段
      掐掉真实的 pointermove/wheel。合成事件不受 pointer-events 影响,
      所以引导自己派发的 click 照样能落到按钮上。

   ★★ 眼睛用 assets/js/ascii-eye.js —— 和启动页【同一份】。
      · 一开始宿主铺满整块平板(黑屏上睁眼),进 CD 页之后收成
        "右侧三分之一"那一格,并在这之前把视线按用户要求
        先"面向屏幕正中央"、再"变回跟随扫描框"。

   ★★ 只在【第一次】进来时播:播完写 localStorage。
      想再看一遍:地址后面加 ?guide=1,或者按 Shift+G。
      ★ 但不管播不播,每次都从"黑屏的平板"开始 —— 那是初始化状态,不是引导的一部分。
   ============================================================ */
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
  /* ★ ?fast=1:把打字、停拍、等待全部压到最短 —— 只给自动化验证用
     (?guide=1&fast=1 就是"每次都播、而且快进")。
     默认节奏是"人在说话":每字 42ms、一句说完停 900ms、扫描框吸过去 420ms。 */
  var FAST = /[?&]fast=1/.test(location.search);
  var TYPE_MS = (reduced || FAST) ? (FAST && !reduced ? 3 : 0) : 42;
  var afterLine = (reduced || FAST) ? 60 : 900;      /* 一句说完之后停一拍 */
  var settleMs = (reduced || FAST) ? 30 : 420;       /* 扫描框吸过去、停稳 */
  var gate = function (ms) { return (reduced || FAST) ? Math.min(ms, 90) : ms; };

  var eye = null;
  var playing = false;
  var skipping = false;
  var locked = false;                      /* 锁鼠标(按不动) */
  var wheelLocked = false;                 /* 锁滚轮 */
  var stepIndex = -1;
  var stepLabel = "";
  var typeDone = true;
  var snapNow = null;                      /* 探针用:当前吸附目标 */
  /* 引导自己认为"鼠标在哪儿" —— 锁鼠标时用来分辨"这一下是人手还是剧本" */
  var guidePos = { x: -1, y: -1 };

  /* ------------------------------------------------------------
     一、黑屏:初始化状态永远是"停在一块黑着屏的平板上"
     ------------------------------------------------------------ */
  var staticWrap = document.getElementById("screen-static");

  function blackout() {
    docEl.classList.remove("home-boot");
    docEl.classList.add("home-dark");        /* 底衬:机身两侧的透光也压黑,见 tablet.css */
    tablet.classList.remove("is-scan");
    tablet.classList.add("is-dark");
    /* ★ 一进来就黑屏,那 EDGE 上的扫描遮罩要扫一下 —— 用户说的"初始化"
       本身也是一个动作,不扫的话像是页面没加载出来。 */
    void tablet.offsetWidth;
    tablet.classList.add("is-scan");
    setTimeout(function () { tablet.classList.remove("is-scan"); }, reduced ? 0 : 1600);
  }

  /* ★★ 引导走完之后还有一段【老流程】:按下插入 → setOpen(false) → 开机动画
     (几秒)→ 才露出盘页。这段时间平板必须还是黑的(它本来就是 .is-dark),
     而"底衬"要一直挂到开机动画把黑屏撤掉那一刻才收 —— 否则机身两侧会先亮起来,
     看着像屏幕边缘漏光。所以盯 .screen-static 的 is-black:它一没,底衬就撤。 */
  function watchBootEnd() {
    if (!staticWrap || !window.MutationObserver) { docEl.classList.remove("home-dark"); return; }
    var obs = new MutationObserver(function () {
      if (staticWrap.classList.contains("is-black")) return;
      docEl.classList.remove("home-dark");
      obs.disconnect();
    });
    obs.observe(staticWrap, { attributes: true, attributeFilter: ["class"] });
    /* 兜底:开机动画最长 ~5 秒,再等久一点还没撤就自己收 */
    setTimeout(function () { docEl.classList.remove("home-dark"); obs.disconnect(); }, 12000);
  }

  /* ------------------------------------------------------------
     二、扫描框:派发合成事件,把【真的】那个框引到目标上
     ------------------------------------------------------------ */
  /* 玻璃窗口的四边(frame-fit.js 写在 <html> 上,量不到退回 CSS 保底值)。
     ★ 为什么需要它:说"眼睛放在平板【右三分之一】"时,分母必须是【玻璃的宽】,
       不是视口的宽 —— 1600 视口下玻璃只有 1430,而机器一打开只剩 430 可见。 */
  function cssPx(name, dflt) {
    var v = getComputedStyle(docEl).getPropertyValue(name);
    var n = parseFloat(v);
    return isFinite(n) ? n : dflt;
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), r: r };
  }

  /* 大致范围:没有真实吸附框的地方(用户:"这里没有做实际吸附的框,吸附大致范围")
     用一个百分比矩形当"范围",把框停在它的中心。 */
  function regionRect(sel) {
    var host = tablet.getBoundingClientRect();
    var map = {
      "rack-info": [0.03, 0.06, 0.42, 0.30],   /* 左上角的引擎文字区 */
      "rack-discs": [0.30, 0.26, 0.62, 0.46],  /* CD 轮盘那一带 */
      "tablet-all": [0.02, 0.02, 0.96, 0.96]   /* 整块平板 */
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
    /* 顺序要紧:move 先到(光标自己的位置),再 mouseover 把目标告诉它。
       两个都是合成事件,同步派发 —— 光标那一个 rAF 里就同时拿到新位置和目标。 */
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
  }

  /* snap 的三种形态:
       ".sel"      —— 真元素:量它的框,停在中心(扫描框自己会磁吸上去)
       "region:x"  —— 大致范围:同上,但框是算出来的
       "clear"     —— 松开目标 */
  var basePad = (typeof window.__mcPad === "number") ? window.__mcPad : null;

  function snap(spec) {
    if (!spec || spec === "clear") { clearTarget(); return; }
    if (spec.indexOf("region:") === 0) {
      var key = spec.slice(7);
      /* ★ "整块平板"那一格:外扩要【往内收】。按 magnetic-cursor 默认的
         16% / PAD 算,一整块屏的外扩只有十来像素,框读起来还是"小小一个";
         引导说的是"吸附到整个平板页面",框就该贴着玻璃四边。 */
      window.__mcPad = (key === "tablet-all") ? -6 : (basePad === null ? 10 : basePad);
      var r = regionRect(key);
      moveTo(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      snapNow = null;
      return;
    }
    if (basePad === null) window.__mcPad = 10; else window.__mcPad = basePad;
    var el = document.querySelector(spec);
    if (!el) return;
    var c = centerOf(el);
    moveTo(c.x, c.y);
    snapNow = el;
    return el;
  }

  /* ------------------------------------------------------------
     三、锁鼠标 / 锁滚轮
     ------------------------------------------------------------ */
  /* ★★★ 这里【不能】一律掐掉 pointermove —— 会把引导自己派发的那些也一起掐掉。
     引导驱动扫描框靠的就是"往 window 上派发一个合成 pointermove"
     (magnetic-cursor.js 监听 window,分不出真假),而本监听挂在【捕获阶段】,
     位置又比它早,一刀切下去合成事件先死在这儿:框从此一动不动,
     而控制台一声不响(踩过:表现为"吸附框根本没动",查了很久)。
     ⇒ 只掐【离引导当前位置足够远】的真实移动:用户的手一动就会被拦下,
       而引导自己派发的那一个正好落在 guidePos 上,原样放行。
     ★ pointerdown / mousedown 照旧一律掐(锁定期间不许按)。 */
  var GRAB = 6;                    /* 容差:合成事件也可能被浏览器取整 */

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
    /* ★ 锁住的那几拍里,扫描框要"停稳"而不是一直自转:
       以 24°/s 转的小方块读起来像个转动图标,不像锁定框(见 magnetic-cursor.js
       里的 __mcSpinScale 说明)。解锁时把倍率还回去。 */
    if (locked) window.__mcSpinScale = 0.12;
    else window.__mcSpinScale = 1;
  }
  function lockWheel(on) { wheelLocked = !!on; }

  /* ------------------------------------------------------------
     四、逐字打出
     ------------------------------------------------------------ */
  var typing = 0;
  function typeLine(text, forceInstant) {
    clearTimeout(typing);
    lineEl.textContent = "";
    consoleEl.classList.remove("is-typed");
    typeDone = false;
    if (!text) { typeDone = true; consoleEl.classList.add("is-typed"); return Promise.resolve(); }
    if (TYPE_MS <= 0 || forceInstant) {
      lineEl.textContent = text;
      typeDone = true;
      consoleEl.classList.add("is-typed");
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var i = 0;
      (function tick() {
        if (skipping) {
          lineEl.textContent = text;
          typeDone = true;
          consoleEl.classList.add("is-typed");
          resolve();
          return;
        }
        i++;
        lineEl.textContent = text.slice(0, i);
        if (i >= text.length) {
          typeDone = true;
          consoleEl.classList.add("is-typed");
          resolve();
          return;
        }
        var ch = text.charAt(i - 1);
        /* 标点之后多停一拍 —— 一口气打完像机器,不像人在说话 */
        var d = TYPE_MS * (/[。!?.,:;、,.]/.test(ch) ? 5 : 1);
        typing = setTimeout(tick, d);
      })();
    });
  }

  /* ------------------------------------------------------------
     五、步骤表 —— 用户给的那一串,一条不改地落在这里
     ------------------------------------------------------------ */
  function step(o) { return o; }

  function steps() {
    return [
      /* —— 眼睛睁开 —— */
      step({
        label: "睁眼",
        eye: "reveal",
        wait: reduced ? 200 : 2200
      }),
      step({ text: "你好。哦,是你啊。怎么又变成了这样。" }),
      step({ text: "我是方舟总控 AI 子代理,代号 ECHOM_D29_Z68J521,……你叫我 ECHO。" }),
      step({ text: "本系统记录,这是你第 27 次未按时进行人格修正,你能不能长点记性?" }),
      step({ text: "一旦长时间未修正,锚点将发生不可逆偏移。" }),
      step({ text: "……好吧,我又得重来一遍:" }),

      /* —— 扫过整块平板 —— */
      step({
        label: "整块平板",
        snap: "region:tablet-all",
        text: "这是总控修正终端,你需要在这里完成五项修正。"
      }),

      /* —— 上侧下滑栏(锁鼠标) —— */
      step({
        label: "下滑栏",
        snap: "#statusbar-toggle",
        lock: true,
        text: "按下可以展开终端设置页,在设置页你可以前往核心数据库,或者对终端环境进行一些设置。"
      }),

      /* —— 左侧打开 CD 架按钮(锁鼠标) —— */
      step({
        label: "CD 架按钮",
        snap: "#intro-toggle",
        lock: true,
        text: "从这里可以进入情感引擎安装仓。"
      }),
      step({ gaze: "center", text: "这可是你的杰作。从里面你可以校准自己的人格。" }),
      step({
        label: "按下它",
        snap: "#intro-toggle",
        unlock: true,
        gaze: "scan",
        text: "按下它。"
      }),

      /* —— 按下 → 进 CD 页 → 眼睛转到右侧三分之一 —— */
      step({
        label: "进入 CD 页",
        click: "#intro-toggle",
        dock: true,
        wait: reduced ? 500 : 3000
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
        text: "按下,进入第一次校准。"
      }),
      step({ label: "按下插入", click: "#rack-insert", wait: 900, finish: true })
    ];
  }

  /* ------------------------------------------------------------
     六、跑
     ------------------------------------------------------------ */
  function waitWhileTyping() {
    return new Promise(function (resolve) {
      (function poll() {
        if (typeDone || skipping) { resolve(); return; }
        setTimeout(poll, 90);
      })();
    });
  }
  function sleep(ms) {
    return new Promise(function (r) {
      if (skipping) { setTimeout(r, Math.min(ms, 90)); return; }
      setTimeout(r, ms);
    });
  }

  function eyeReveal() {
    if (!eye) return;
    eyeHost.classList.add("is-on");
    eye.start(true);
  }

  function eyeDock() {
    /* 用户:"把眼睛转个向并缩小放到右侧三分之一的平板屏幕上。"
       ★★★ 这一格的分母是【玻璃窗口的宽】,不是视口的宽;而机器一打开,
          平板只露出最左边那一截 —— 所以"右三分之一"要落在
          [可见区右边界 − 玻璃宽/3, 可见区右边界] 这一小段里,
          再往左让开金属框。第一版写的是 left:auto/right:0/width:33vw
          (视口右边三分之一),整只眼睛压在 CD 盘面上(截图里就是)。 */
    eyeHost.classList.add("is-docked");
    if (!eye) return;
    setTimeout(function () {
      var vw = window.innerWidth, vh = window.innerHeight;
      var winL = cssPx("--ff-win-left", vw * 0.05);
      var winR = cssPx("--ff-win-right", vw * 0.05);
      var glassW = Math.max(320, vw - winL - winR);
      var r = tablet.getBoundingClientRect();
      /* 平板此刻的可见右边界(scene 打开后它被推到右边,只露一截) */
      var visR = Math.min(r.right || vw, vw);
      if (!(visR > 80)) visR = vw * (1 - 0.34);          /* 量不到就按"露出 34%"兜底 */

      var eyeW = glassW / 3;                              /* 玻璃宽的三分之一 */
      var hostW = Math.max(140, Math.round(eyeW * 1.06));
      var hostH = Math.max(120, Math.round(vh * 0.70));
      var left = Math.max(winL + 8, visR - hostW - 8);
      eye.anchor(left, (vh - hostH) / 2, hostW, hostH);
      eye.fitTo(hostW * 0.98, hostH * 0.98);
    }, reduced ? 0 : 570);
  }

  function runStep(s, i) {
    stepIndex = i;
    stepLabel = s.label || "";
    if (s.lock) lock(true);
    if (s.unlock) lock(false);
    if (s.wheelLock) lockWheel(true);
    if (s.unlockWheel) lockWheel(false);

    if (s.snap) {
      var t = snap(s.snap);
      if (eye && s.gaze !== "center") {
        if (t) eye.lookAt(t); else eye.centerGaze();
      }
    }
    if (s.gaze === "center" && eye) eye.centerGaze();
    if (s.gaze === "scan" && eye && snapNow) eye.lookAt(snapNow);
    if (s.eye === "reveal") eyeReveal();
    if (s.click) {
      var btn = document.querySelector(s.click);
      if (btn) {
        try {
          btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        } catch (e) { }
      }
    }
    if (s.dock) {
      /* 点下去之后 CD 架要 550ms 才滑到位,眼睛在这一拍里换格 */
      setTimeout(eyeDock, reduced ? 30 : 620);
    }

    if (s.text) {
      return typeLine(s.text).then(function () { return sleep(afterLine); });
    }
    /* 没有台词的步骤:光等(每步都再给一拍,让扫描框吸稳) */
    return sleep(gate(s.wait || 0)).then(function () { return sleep(settleMs); });
  }

  function play() {
    if (playing) return Promise.resolve();
    playing = true;
    skipping = false;
    var list = steps();
    var p = Promise.resolve();
    list.forEach(function (s, i) {
      p = p.then(function () {
        if (skipping && !s.click) { /* 跳过时仍然执行"按下"那一类动作 */ return null; }
        return runStep(s, i);
      });
    });
    return p.then(function () {
      playing = false;
      finishGuide();
    });
  }

  function finishGuide() {
    lock(false);
    lockWheel(false);
    /* 扫描框还原成"平时的样子":自转倍率与外扩都归位 */
    window.__mcSpinScale = 1;
    if (basePad !== null) window.__mcPad = basePad;

    /* ★★★ 收尾要把【平板本身】关掉,而且【必须把黑屏状态摘掉】。
       这两件事缺一不可,两个都踩过:
        · 只把眼睛和台词淡掉、平板留在原地 ⇒ 平板那一层(z-index 40)压在 CD 页上面,
          "按下插入"之后的开机动画放完,用户看到的是一块【平板主屏】,
          而不是刚插进去的那张盘;
        · 平板收起了、但 .is-dark 没摘 ⇒ 它藏在 hidden 后面看不出来,
          可引导走完之后用户一旦从 CD 页再点开平板,看到的是【一块黑屏】
          (实测复现:tablet is-dark is-on,主屏完全不显示)。
          这跟"用户按过一次开之后,刷新仍然是开的"那条记忆是同一个坑:
          藏起来的坏状态迟早会被下一次打开翻出来。
       ★ 放在这里(而不是等开机动画结束)是为了让平板的第一段 ——
         "从略微缩小 + 下移展开到位"(tablet.js 的 .36s 转场)—— 和
         setOpen(false) → 开机动画这段时间并行,不额外拖时间。 */
    tablet.classList.remove("is-dark");
    if (window.__tabletOpen) window.__tabletOpen(false);

    eyeHost.classList.remove("is-on");
    consoleEl.classList.remove("is-on");
    setTimeout(function () {
      consoleEl.hidden = true;
      /* 眼睛连内容一起清掉:只 stop() 的话,那一屏字符还留在 <pre> 里,
         淡出的半秒里会被看见(它有 is-docked 的内联尺寸,是实打实占位的)。 */
      if (eye) { eye.stop(); eyePre.textContent = ""; }
    }, 420);
    /* ★ 不再往 localStorage 写"播过了":现在每次都播(见 shouldPlay)。
       更要紧的是 —— 验证探针曾经把这个标记写进用户的浏览器,
       于是用户打开线上站看到的是"眼睛挂了九秒就没了"(他报的"动画完全没有加载")。
       探针不该有能力改动用户的持久状态。 */
    docEl.classList.remove("home-boot");
    watchBootEnd();
    window.__guideDone = true;
  }

  /* 跳过:按任意键 / 点一下。
     ★ 不直接结束 —— 当前这句立刻打完,剩下的步骤快进,但
       【"按下"那一类动作照旧执行】(否则用户会被留在 CD 页上不知道发生了什么,
       而且平板还在黑屏状态)。 */
  function skip() {
    if (!playing || skipping) return;
    skipping = true;
    clearTimeout(typing);
    typeDone = true;
    consoleEl.classList.add("is-typed");
  }
  document.addEventListener("keydown", function () {
    if (!playing) return;
    skip();
  });
  document.addEventListener("pointerdown", function () {
    if (!playing) return;
    skip();
  }, true);

  /* ------------------------------------------------------------
     七、起来
     ------------------------------------------------------------ */
  /* ★★★ 默认【每次进来都播一遍】(2026-09-30 用户第三轮)。
     原来写的是"播过一次就记住、回访不再播",两个理由把它废掉了:
       ① 用户正在反复看这一段,每次都得先去清 localStorage 才能再看一次;
       ② ★ 更要命的是:我自己的验证探针会往 tuagfey.com 这个域的 localStorage
          写这个标记 —— 于是用户打开线上站,看到的是"眼睛挂了九秒就没了",
          也就是他报的"动画完全没有加载"。探针污染了用户的浏览器状态,
          这种设计本身就是错的。
     ⇒ 想快速跳过的人有两条路:按任意键 / 点一下(见 skip),那已经够了。 */
  function shouldPlay() { return true; }

  function build() {
    if (!window.AsciiEye) return false;
    eye = window.AsciiEye.create(eyePre, {
      /* ★ gaze:'fixed':首页的眼睛不跟真实鼠标 —— 它跟的是扫描框/剧情。
         (用户要求的就是"瞳孔也要跟着移动",而"移动"是引导说了算的。) */
      gaze: "fixed",
      drift: false,
      reduced: reduced
    });
    return !!eye;
  }

  /* 排障出口:眼睛的 API 只活在闭包里,外面查不到它有没有就绪 ——
     引导"静止不动"最可能的原因就是它没建起来,所以留一个口子。 */
  function expose() {
    window.__homeEyeApi = eye;
  }

  /* 等 intro.js 把首屏准备好(它会在 3D/音乐都好了之后调 __homeBoot)。
     万一它没调(资源缺失走降级),这里也兜一个定时器。 */
  var booted = false;
  window.__homeBoot = function () {
    if (booted) return;
    booted = true;
    blackout();
    if (!build()) { console.warn("[home-guide] ascii-eye 没就绪,引导跳过"); return; }
    expose();
    /* 眼睛先摆好位置(黑屏上不显示),等着剧本第一句让它睁开 */
    eye.resize();
    eyeHost.classList.remove("is-docked");

    if (!shouldPlay()) {
      /* 回访:不播引导,但也不让用户对着一块黑屏发愣 ——
         把眼睛直接睁着放在屏幕中央,十秒后自己淡掉。
         ★★ 淡完之后【必须】把平板的黑屏状态摘掉(跟 finishGuide 同一个道理):
            回访的人下一步就是点顶缘箭头开平板,留着 .is-dark 的话
            他看到的是一块黑屏(实测复现过)。
         ★ 这条分支现在是【死代码】(shouldPlay 恒为 true),但留着:
           哪天要恢复"只播一次",把 shouldPlay 改回去就能用,不用重写这一段。 */
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

  /* 兜底:6 秒还没被叫,就自己起来(降级路径 / __homeBoot 被别的东西吃掉) */
  setTimeout(function () { if (!booted) window.__homeBoot(); }, 6000);

  /* 现场读数(排障口)—— 这一段的时序错一点都很难从截图上看出来 */
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
      eye: eye ? eye.state() : null,
      frame: mc ? { x: mc.x, y: mc.y, w: mc.w, h: mc.h, locked: mc.locked } : null
    };
  };
})();
