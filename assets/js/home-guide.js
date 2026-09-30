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
  var TYPE_MS = (reduced || FAST) ? (FAST && !reduced ? 3 : 0) : 58;
  /* ★★★ 进 CD 页之后那几句要【更快】。
     用户第七轮:"左滑后那几句话的出字速度还是不对"。
     左滑那段是一口气把四件事说完(引擎内容 / 滤网协议 / 锁滚轮 / 插入按钮),
     按开头的 58ms/字 一句要读五六秒,四句下来二十多秒 —— 节奏拖垮了。
     开头那几句是要"一字一句交代清楚"的(第一次见面),这里不一样:
     用户在等着操作,话只是旁白 ⇒ 压到 34ms/字,并把句间停顿收到 700ms。 */
  var TYPE_MS_FAST_TAIL = (reduced || FAST) ? (FAST && !reduced ? 3 : 0) : 34;
  var typeMs = TYPE_MS;                    /* 当前生效的那一档(进 CD 页时切过去) */
  var afterLine = (reduced || FAST) ? 60 : 1500;     /* 一句说完之后停一拍(留出读的时间)*/
  var afterLineTail = (reduced || FAST) ? 60 : 700;  /* 进 CD 页之后:旁白不必停那么久 */
  var settleMs = (reduced || FAST) ? 30 : 520;       /* 扫描框吸过去、停稳 */
  var inCdPage = false;                    /* 左滑过去之后为真 */
  var gate = function (ms) { return (reduced || FAST) ? Math.min(ms, 90) : ms; };

  var eye = null;
  var playing = false;
  var skipping = false;
  var locked = false;                      /* 锁鼠标(按不动) */
  var wheelLocked = false;                 /* 锁滚轮 */
  var stepIndex = -1;
  var stepLabel = "";
  var stepList = [];                       /* 当前这一遍的步骤表(runStep 要往后看一拍) */
  var typeDone = true;
  var snapNow = null;                      /* 探针用:当前吸附目标 */
  var snapTarget = null;
  var gazeMode = "scan";                   /* "scan" = 跟着扫描框;"center" = 看向屏幕正中央 */
  var frameRect = null;                    /* 扫描框当前该在的矩形(视线每帧跟着它)。
                                              ★★★ 字段名统一成 left/top/width/height,
                                              【和 getBoundingClientRect() 同构】——
                                              这里踩过一次:字段用的是 x/y/w/h,而
                                              lookAtRect 里读的是 p.left/p.top/p.width,
                                              于是每次算出来都是 NaN,一路写进
                                              eye.setGaze(NaN, NaN)。症状是"眼睛完全
                                              不跟框",而控制台一声不响(NaN 不抛异常)。
                                              两处名字对齐之后这类错就不可能再发生。 */
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
    /* ★★ 顶缘那枚下滑栏先锁死(用户第五轮:"刚刚进入首页的时候这个上滑栏
       默认是打开的,导致能透过动画按按钮")。
       引导走到"下滑栏"那一拍才 unlockTop() 放它出来 —— 那一刻正好是
       "现在该认识这个按钮了"。 */
    lockTop(true);
    /* ★★★ 顺序有讲究:必须先挂 .is-dark,再让平板"入场"。
       反过来的话(先 is-on 再 is-dark)平板会带着 opacity 0 → 1 的入场过渡
       淡进来,中间那 260ms 里快捷控制卡片(音量滑条)会跟着露一下脸 ——
       这正是用户第三轮报的"刚进页面时音量滑块莫名其妙出现"。
       is-dark 那条 CSS 已经把入场过渡关掉了,所以先挂它就等于"一上来就是全黑"。 */
    tablet.classList.add("is-dark");
    if (window.__tabletOpen) window.__tabletOpen(true);
    /* ★ 一进来就黑屏,那 EDGE 上的扫描遮罩要扫一下 —— 用户说的"初始化"
       本身也是一个动作,不扫的话像是页面没加载出来。 */
    void tablet.offsetWidth;
    tablet.classList.add("is-scan");
    setTimeout(function () { tablet.classList.remove("is-scan"); }, reduced ? 0 : 1600);
  }

  /* 顶缘那枚开关的显隐(见 tablet.css 里 top-locked 那段说明)。
     ★ 摘的是 html 上的 top-locked:它在 <head> 里同步挂上,是"进页面那一刻
       就锁死"的那道闸;走到"下滑栏"这一拍才轮到它开。 */
  function lockTop(on) {
    var t = document.getElementById("statusbar-toggle");
    docEl.classList.toggle("top-locked", !!on);
    if (!t) return;
    t.classList.toggle("is-locked", !!on);
    t.setAttribute("aria-hidden", on ? "true" : "false");
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
    window.__mcScript = null;
  }

  /* ============================================================
     磁吸:用【剧本矩形】驱动那个真扫描框(magnetic-cursor.js 的 __mcScript)
     ─────────────────────────────────────────────────────────────
     用户第三轮:"扫描框的动画,确实移动了,但是扫描框没有磁吸上去,
                要的是这个磁吸的效果。"
     为什么光派发合成事件不行:
       · 合成 mouseover 只对【真有 DOM 元素】的地方有效 —— 而引导里
         "吸附到整块平板""吸附到 CD 轮盘那一带"根本没有元素可指;
       · 就算有元素,框的尺寸是 tick 里按"目标尺寸的 16%"平滑逼近的,
         小按钮上框比按钮大一圈、大区域上又几乎看不出来 ——
         读起来就是"框飘过去了,没吸住"。
     ⇒ 剧本直接给出框最终该在的矩形(位置 + 宽高),cursor 那边就不再自己算。
       ★ 缓动保留:吸的过程要看得见(约 260ms),不是一帧到位。
       ★ 只覆盖位置与尺寸,角线/渐变/发光那些美术参数一个都不动。
     ============================================================ */
  function scriptSnap(left, top, w, h) {
    var cx = Math.round(left + w / 2), cy = Math.round(top + h / 2);
    /* 先把真实指针"搬"到目标中心:mouseover 会设上 target,
       于是"锁定态"的判断(停止抖动、转正)和手玩时完全一致。 */
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
    /* ★ 给视线用的矩形用 left/top/width/height —— 和 getBoundingClientRect() 同构,
       这样 lookAtRect 里那套算式不用改名字(见 frameRect 的声明处)。 */
    frameRect = { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
  }

  /* snap 的三种形态:
       ".sel"      —— 真元素:量它的框,框贴着它(外扩 2px)
       "region:x"  —— 大致范围:矩形的四边就是框的四边
       "clear"     —— 松开目标
     ★★ frameRect(视线每帧跟着的那个矩形)只在文件上面声明一次,这里不再写。 */

  function snap(spec) {
    if (!spec || spec === "clear") { clearTarget(); return; }
    if (spec.indexOf("region:") === 0) {
      var r = regionRect(spec.slice(7));
      if (!(r.width > 1 && r.height > 1)) return null;   /* 量不到就别写 NaN,见 refreshSnap */
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

  /* ★★★ 重新量一遍当前吸附目标,并把剧本矩形刷成最新值。
     为什么必须有这一条(实测踩过):量一次就钉死是不行的 ——
     · CD 架拉出来的那一刻,整台机器还在 550ms 的平移里,
       那时量到的 #rack-insert 位置是【移动前】的;
     · 平板的玻璃窗口(frame-fit)也是在首帧之后才量出来的。
     于是框会停在"旧坐标"上,和按钮错开几十上百像素 ——
     用户看到的正是"扫描框没有磁吸上去"。
     ⇒ 每一帧重算:框跟着目标走,而磁吸的缓动让这个过程仍然像"吸",
       不像"瞬移"。 */
  var lastSnapSpec = null;
  function refreshSnap() {
    if (!lastSnapSpec) return;
    var r;
    if (lastSnapSpec.indexOf("region:") === 0) {
      r = regionRect(lastSnapSpec.slice(7));
      /* ★★★ 平板是 hidden 的时候 getBoundingClientRect() 全是 0 ——
         regionRect 会算出 NaN,而 NaN 一写进 __mcScript,那个框【就再也不动了】
         (它每帧都被刷新成 NaN,连"磁吸到整块平板"都做不到)。
         实测踩过:region 那几拍全部僵硬在屏幕中心,而看元素的几拍(下滑栏、
         CD 架按钮)是好的 —— 因为那些元素量得到真实坐标。
         ⇒ 量不到(宽或高为 0)就【这一帧不刷】,保留上一次有效值。 */
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
    if (typeMs <= 0 || forceInstant) {
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
        typing = setTimeout(tick, charDelay(text, i - 1));
      })();
    });
  }

  /* ============================================================
     语速:让"打字"读起来像一个人在说话,而不是复读机
     ─────────────────────────────────────────────────────────────
     用户第三轮:"语速,按照你的理解把文本出现的速度改一下,现在一是太快
                二是匀速,有些句子里面两句话是连着出的,还有像……,哦,
                这些明显需要停顿的没有表现出来,像个真AI复读机一样。"

     三件事:
       ① 基础速度慢下来(42ms/字 → 58ms/字),太快了来不及读;
       ② 【标点】给足停顿,而且长度分档 —— 逗号一小口、句号一口、
          "……"和不齐的省略号是真正的迟疑(最长):
            逗号/顿号     ~150ms
            句号/问号/叹号 ~330ms
            冒号          ~240ms(后半句要来了)
            省略号(……)  ~620ms(迟疑)
            破折号        ~260ms
       ③ 【换气】:一句话里的第二个分句起头稍微压一下,不要"哒哒哒哒"一串
          同一个速度冲到底 —— 人说话每个小句的起头都会重来一次。
     ★ 所有停顿都是【附加在字与字之间】的,不改字本身出现的顺序。
     ============================================================ */
  /* ★★ 数值是【量出来的】(探针 .tmp/check-pace.mjs 打印每个字之间的间隔):
     原表是按 42ms/字 调的,基础速度提到 58ms 之后同一个表就"过重"了 ——
     实测逗号 214ms、冒号 235ms,加上字本身的 60ms 就是 270~300ms,
     一串"代号:ECHOM_D29_Z68J521,……"读起来一顿一顿的。
     ⇒ 标点只做"轻微收一下",真正的重音留给省略号。
     目标节奏(实测):普通字 45~95ms,逗号 ~150ms,句号 ~380ms,省略号 ~560ms。 */
  var PUNCT = {
    "。": 300, "!": 300, "?": 300, "?": 300, "!": 300,
    ",": 90, "、": 90, ";": 100, ";": 100,
    ":": 130, ":": 130,
    "…": 240,          /* 单个省略号点;连着的"……"只算一次(见下面的跳过) */
    "-": 120, "—": 170,
    ")": 80, ")": 80, "」": 110, "”": 110
  };
  var BREATH = 90;     /* 分句起头的换气(轻一点:重音交给标点) */

  function charDelay(text, i) {
    /* ★ 用【当前生效的那一档】,不是常量 TYPE_MS ——
       左滑进 CD 页之后 typeMs 换成 34ms/字(见 runDock)。 */
    var base = typeMs;
    var ch = text.charAt(i);
    var d = base + (Math.random() * base * 0.45);     /* ±45% 的抖动:匀速最像机器 */
    var p = PUNCT[ch];
    if (p) d += p;
    if (i > 0) {
      var prev = text.charAt(i - 1);
      /* ★★ 连续的省略号点只算【一次】迟疑:
         "……" 是两个 U+2026,按表走就是 2 × 240 = 480ms 的停顿,
         读起来是"卡了两下"。真正的迟疑只需要一个明显的空档。 */
      if (ch === "…" && prev === "…") d = base + 60;
      if (prev === "," || prev === "、" || prev === ";" || prev === ":" || prev === "—") d += BREATH;
      /* ★ 代号里的字符是一串"一个词":ECHOM_D29_Z68J521 要是按基础速度
         一个字一个字蹦,那一句要读十几秒,而且没有语义停顿可言 ⇒ 压快。 */
      if (/[A-Za-z0-9_]/.test(ch) && /[A-Za-z0-9_]/.test(prev)) d = Math.max(14, base * 0.30);
    }
    return d;
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
        /* ★ 走到这一拍才把它放出来(开机那一段它是被锁死的,见 blackout) */
        unlockTop: true,
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
        /* ★★★ 吸附的是 screen 左缘那枚【看得见的】按钮 .slot-toggle,
           不是它的 id #intro-toggle。
           踩过:写 #intro-toggle 时,脉冲光圈加到了 <section class="screen-slot">
           里面的 <button> 上 —— 而那个位置上还盖着 .screen-frame(z-index 34)
           与 .slot-seam,光圈被压在下面,用户根本看不见("该按哪个"的提示等于没有)。
           而 .slot-toggle 自己就是那枚 34×52 的按钮,高亮它一定看得见。 */
        snap: ".slot-toggle",
        unlock: true,
        gaze: "scan",
        text: "按下它。",
        /* ★ 让用户自己按(第三轮:"按下按钮并不是自动按,是让用户自己按") */
        press: ".slot-toggle"
      }),

      /* —— 按下 → 进 CD 页 → 眼睛横过来、缩到右侧那一格 —— */
      step({
        label: "进入 CD 页",
        /* 值的真伪不重要(只看有没有):这一步走的是"闭眼 → 左滑 → 右侧重睁",
           见 runDock。留 true 是为了读起来明确"这一拍要做换场"。 */
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
        /* ★ 最后一次也是【让用户自己按】—— 按下去之后一切恢复正常,
           这一步是引导的出口,更不该代劳。 */
        press: "#rack-insert",
        finish: true
      })
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

  /* 眼睛出场:黑屏上睁开(引导的第一步) */
  function eyeReveal() {
    if (!eye) return;
    eyeHost.classList.add("is-on");
    eye.start(true);
  }

  /* 高亮目标:让用户一眼看到"该按的是这个"。
     ★ 为什么需要它(用户第五轮):"扫描框固定在按钮的时候,实际鼠标并不在这里,
       所以根本就按不了。"
       根因:引导把扫描框【钉】在按钮上,而真实指针在别处 —— 两者不是同一个位置。
       钉着框却让用户去点,用户就会用真实指针去够,框又不动,自然按不到
       (而且这一屏的原生光标被 cursor:none 藏起来了,看到的只有画出来的框)。
       ⇒ 到"让用户自己按"这一拍:① 松开钉住的框(它自己会跟回真实指针),
         ② 给目标加一个脉冲光圈 —— 提示"按这个",同时指针老老实实跟着手。 */
  var pulseEl = null;
  function pulseTarget(sel, on) {
    if (pulseEl) { pulseEl.classList.remove("is-guide-pulse"); pulseEl = null; }
    if (!on) return;
    var el = document.querySelector(sel);
    if (!el) return;
    el.classList.add("is-guide-pulse");
    pulseEl = el;
  }

  /* ============================================================
     进 CD 页那一段的编排
     ─────────────────────────────────────────────────────────────
     ★★★ 两次要求【是叠加的,不是互相取代】—— 我第五轮读错了,把旋转删了,
     用户第六轮指出:"我说眼睛要旋转90°,你怎么又给我修回去了?"
       · 第三轮:"这个眼睛要转向90°,放到右侧,就像横着看一样"        ⇒ 要【转】
       · 第五轮:"按下左滑后,主屏幕的眼睛马上闭上,等到彻底滑过去后,
                 眼睛再在右侧睁开"                                  ⇒ 要【闭→滑→睁】
     ⇒ 完整编排(四步):
         ① 按下之后:眼睛马上闭上(等它闭到底,约 780ms);
         ② 同时左滑 100vw 出去;
         ③ 到位后换格 + 转到 90°(旋转有 0.55s 过渡,和左滑同拍 ——
            此刻眼睛是闭着的,所以看到的是"它转过去了",不是"它转着给你看");
         ④ 全部落定才重新睁开。
     ★ "右侧那只眼睛跟鼠标"是靠 setGaze 做到的,与旋转无关 ——
       旋转只改变眼睛的朝向(横着看),瞳孔照样跟着扫描框走。
     ============================================================ */
  var DOCK_TILT = 90;                      /* 到位后转多少度(用户第三轮定的) */

  /* ★★★ 用户第七轮:"按下进入CD页的按钮时,主眼睛应该立马闭合,否则跟不上左滑的速度。"
     原编排的【闭眼】是从"引导走到下一步"才开始算的:
       按下 → 这一拍还要把台词尾巴和 1.5s 停拍走完 → 下一步 runStep 里
       setTimeout(380) → closeEye(780ms) → 才左滑。
     从按下到眼睛开始闭,最长要一秒多;而平板那一下是【立刻】黑屏 + 左滑的,
     用户看到的就是"屏幕都滑走了,眼睛还睁着"。
     ⇒ 闭眼改成【挂在按钮按下的那一刻】,和引导走到哪一拍无关:
       watchDockPress() 在"该用户按了"的那一拍开头就开始盯着 scene-open,
       状态一变立刻闭眼;runDock 里只是【等这个已经在跑的闭眼】收口。
     ★ 闭眼只做一次(记忆化):两条路径(按下就闭 / runDock 兜底闭)不会打架。 */
  var dockClosing = null;
  function beginDockClose() {
    if (!dockClosing) {
      /* 现场读数:谁在什么时刻把闭眼这件事点着的(带调用栈)*/
      window.__dockCloseAt = { t: Math.round(performance.now()), stack: String((new Error()).stack || "").split("\n").slice(1, 4).join(" ← ") };
      dockClosing = closeEye();
    }
    return dockClosing;
  }

  var dockWatchOn = false;
  function watchDockPress() {
    if (dockWatchOn) return;
    dockWatchOn = true;
    /* 现场读数:这一条链路上任何一处"没接上"都只能靠读时间戳查
       (什么时候挂上的、轮询了几次、哪一刻命中的)。 */
    window.__dockWatch = { armed: Math.round(performance.now()), polls: 0, hit: null, hitWhy: null, why: null, log: [] };
    var hit = function (how) {
      if (dockClosing) return;
      window.__dockWatch.hit = Math.round(performance.now());
      window.__dockWatch.hitWhy = how;
      beginDockClose();
    };
    /* ① 首选:直接盯 body 的 class。MutationObserver 的回调在 class 变化后的
       微任务里就跑 —— 也就是说【和"按下"同一个任务】,零延迟,不吃定时器节流。
       (踩过:只靠 40ms 轮询时,后台标签页的 setTimeout 被节流到 ~700ms,
        于是"按下 → 闭眼"又慢回去了。这正是用户报的那个现象。) */
    try {
      new MutationObserver(function () {
        if (document.body.classList.contains("scene-open")) hit("observer");
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    } catch (e) { window.__dockWatch.moErr = String(e && e.message || e); }
    /* ② 兜底:轮询。管两件事 —— 状态在挂观察者【之前】就已经设过;
       以及 MutationObserver 万一不可用。 */
    (function poll() {
      window.__dockWatch.polls++;
      window.__dockWatch.log.push([Math.round(performance.now()), !!dockClosing, playing, document.body.classList.contains("scene-open")]);
      if (window.__dockWatch.log.length > 40) window.__dockWatch.log.shift();
      if (dockClosing || !playing) { window.__dockWatch.why = dockClosing ? "already" : "stopped"; return; }
      if (document.body.classList.contains("scene-open")) { hit("poll"); return; }
      setTimeout(poll, 40);
    })();
  }

  function closeEye() {
    return new Promise(function (resolve) {
      if (!eye) return resolve();
      if (eye.freeLook) eye.freeLook(false);
      var done = false;
      var fin = function () { if (!done) { done = true; resolve(); } };
      try { eye.close(fin); } catch (e) { fin(); }
      setTimeout(fin, (eye.T_CLOSE || 780) + 400);        /* 兜底:闭眼动画万一没跑 */
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
    if (!(visR > 80)) visR = vw - 12;                     /* 量不到就按"右缘贴着视口"兜底 */
    var third = glassW / 3;
    /* ★ 转 90° 之后【宽高互换】,所以"能不能放下"要按【转完的占位】算:
       转完的宽 = 转之前的高,转完的高 = 转之前的宽。
       ★★★ 用户第七轮:"转向90°后,眼睛应该小一点,不然放不下。"
       原来按 "转之前的宽 = 那一格 × 1.02" 给盒子 —— 转完那一格就装的是
       "0.74 个屏高"(实测转完占位 799×653,而右边那一格只有 640 宽),
       于是眼睛横过来之后顶出屏幕右缘、上下也顶到机身。
       ⇒ 改成【先定转完要多大】再回推宿主:
            L(转完的"长")≤ 屏高的 62%,而且 ≤ 那一格的 1.5 倍
              —— 系数 1.5 不是拍的:这只眼的 ink 宽高比 ≈ 0.47
                 (宽 = 长 × 0.468),L 取到 1.5 × 格宽时,
                 转完的【宽】正好 ≈ 0.70 × 格宽,两侧各留 ~15% 余量。
            宿主格 = (L, L×0.56):转完占位 = (L×0.56, L),落在那一格正中。 */
    if (eye.rotate) eye.rotate(DOCK_TILT);
    var strip = stripBox(vw, visR);
    /* L(转完的"长")还要能装进可见条带:转完占的宽 ≈ 0.51×L ⇒ L ≤ 条带宽 × 1.8 */
    var L = Math.max(220, Math.round(Math.min(vh * 0.62, third * 1.5, strip.w * 1.8)));
    var hostW = L;                                       /* 转之前:宽 */
    var hostH = Math.max(120, Math.round(L * 0.56));     /* 转之前:高 */
    var cx = stripCenterX(strip, hostW);
    eye.anchor(cx - hostW / 2, (vh - hostH) / 2, hostW, hostH);
    /* fitTo(boxW, boxH):boxW 定字号+列数(= 画出来的宽,也就是转完的高);
       boxH 只管行数、而且按 86% 落地,所以要把宿主高除回去。 */
    eye.fitTo(hostW, hostH / 0.86);
  }

  /* ★★★ 用户第七轮:"把侧边显示的眼睛往右边移一点点"。
     原来按【frame-fit 窗口】的右边三分之一居中 —— 那一格是 [1040, 1520],
     中心 1280;而平板真正露出来的玻璃是另一块(机身左边那条黑边比 --ff-win-left
     宽得多)。实测 1600×900:
       CD 架占 [0, 1056](--rack-w = 66vw),平板露出的条带 = [1056, 1600],
       其中左边约 23% 是机身黑边、右边约 3%:玻璃 ≈ [1180, 1585],中心 1382。
       眼睛却摆在 1261 —— 贴着玻璃左缘,右边空一大片(截图里一眼就能看出来)。
     ⇒ 位置改成按【可见条带】算:
          眼心 = 条带左 + 条带宽 × 0.60
        0.60 是量出来的玻璃中心(条带左边 23% 是机身、右边 3%),不是拍的。 */
  function stripLeftX(vw) {
    /* ① 首选:CD 架自己的盒子(宿主在 .scene 里,量它最准)。
       ★ 只在"真的贴住左缘、宽度占了大半屏"时才认 —— page-out 那段时间
         整台机器在 -100vw,这时量到的是离屏值,必须退回 CSS 变量。 */
    var rack = document.querySelector(".rack");
    if (rack) {
      var r = rack.getBoundingClientRect();
      if (r.left <= 1 && r.right > vw * 0.2 && r.right < vw * 0.9) return r.right;
    }
    /* ② 退回 --rack-w(注意是 66vw 这种【带单位】的值,不能直接 parseFloat) */
    return cssLen("--rack-w", vw * 0.66);
  }

  /* 把带单位的 CSS 变量换算成 px。
     ★ 踩过:用 cssPx() 那种 parseFloat 读 --rack-w: 66vw 会得到 66,
       眼睛就被算到屏幕最左边去了(实测 ink 中心 986 而不是 1382)。 */
  function cssLen(name, dflt) {
    var box = document.createElement("div");
    box.style.cssText = "position:absolute;left:-9999px;top:0;height:0;pointer-events:none;width:var(" + name + ")";
    (document.body || docEl).appendChild(box);
    var w = box.getBoundingClientRect().width;
    if (box.parentNode) box.parentNode.removeChild(box);
    return isFinite(w) && w > 1 ? w : dflt;
  }

  function stripBox(vw, visR) {
    /* 上界给 0.86 而不是 0.5:窄屏时 --rack-w 会变成 84vw,条带本来就窄,
       再按 0.5 夹一下就把眼睛推到屏幕中间去了(实测踩过)。 */
    var l = Math.max(0, Math.min(stripLeftX(vw), vw * 0.86));
    var r = Math.max(l + 120, Math.min(visR || vw, vw));
    return { l: l, r: r, w: r - l };
  }

  function stripCenterX(strip, hostW) {
    var cx = strip.l + strip.w * 0.60;
    /* 窄屏兜底:条带比眼睛还窄时,至少把整只眼睛压进条带里(转完占的宽 ≈ 0.56×宿主宽) */
    var half = hostW * 0.56 / 2;
    return Math.max(strip.l + 6 + half, Math.min(cx, strip.r - 6 - half));
  }

  /* ★★★ 用户第七轮:"动画过程按下进入CD页的按钮,会往左滑,然后突然往右滑又回去,
     这个往右滑进入数据库是bug"。
     根因:左滑是引导自己挂的 .page-out(.scene 平移 -100vw);而"到位"是【把
     .page-out 摘掉】—— 一摘,.scene 就带着那条 0.55s 过渡从 -100vw 滑回
     scene-open 的位置(CD 架那一格),用户看到的就是"又往右滑回去"
     (而且方向正好和"去右边的页面"那条过场一样,所以他读成"进数据库")。
     ⇒ 摘 .page-out 之前先把过渡按住(html.guide-cut),让归位【瞬间】完成:
       左滑是一次性的离场,不该有回程。 */
  function cutBack() {
    try {
      docEl.classList.add("guide-cut");
      docEl.classList.remove("page-slide");
      document.body.classList.remove("page-out");
      void docEl.offsetWidth;            /* 强制重算样式:让"归位"落在同一帧 */
    } finally {
      docEl.classList.remove("guide-cut");   /* 万一上面抛了,也不能把过渡永久按住 */
    }
  }

  function runDock() {
    /* ★ 等的是【按下那一刻就已经开始跑】的那次闭眼(见 beginDockClose),
       不是"从这里才开始闭" —— 所以镜头不在这儿停顿。 */
    beginDockClose().then(function () {
      /* ② 左滑出去(和 page-slide.js 用的是同一条过渡) */
      docEl.classList.add("page-slide");
      document.body.classList.add("page-out");
      return sleep(reduced ? 120 : 700);
    }).then(function () {
      /* ③ 滑完 → 【瞬间】归位到 CD 页(没有回程滑行,见 cutBack),
            然后换格 + 转向(此刻眼睛闭着,所以看得到"它转过去了") */
      cutBack();
      dockIntoBox();
      return sleep(reduced ? 40 : 620);                   /* 等旋转的 0.55s 过渡落地 */
    }).then(function () {
      /* ④ 重新睁开
         ★★★ 顺序是【睁开 → 重新贴尺寸 → 才显出来】,不能反。
         为什么(第七轮实测抓到的真凶):eye.openNow() 内部先调 measure() ——
         那是"按【整个视口】算字号和列数"的那一套,它会把 dockIntoBox 里
         按右边那一格算好的尺寸【整个冲掉】:
           实测 1600×900 下,openNow() 之后 <pre> 的内联尺寸是 748.8×487.5
           (整屏那一档),而宿主格只有 558×312 —— 于是眼睛横过来之后
           占位 488×719,而右边那一格只有 480 宽 ⇒ "放不下"。
         之前几轮把这件事记在"盒子给大了"的账上,其实是这一下被冲掉的。
         ⇒ openNow() 之后再 dockIntoBox() 一次(宿主盒子没变,只是把
           字号/列数按那一格重算),最后才 is-on 显出来 ——
           用户看到的直接就是"睁开的、尺寸正确的那只眼睛",不会看到跳一下。 */
      if (eye.openNow) eye.openNow();
      dockIntoBox();
      eyeHost.classList.add("is-on");
      return sleep(reduced ? 60 : 380);
    });
  }

  /* 视线每帧跟着扫描框。
     ★ 为什么要每帧:.lookAt 给的是"指向那个元素"的方向,而框是在缓动移动的
       —— 只在换拍时算一次的话,瞳孔会在框还没到位时就跳到终点。
       每一帧跟着框当前位置算,读起来就是"眼睛一路盯着它走"。
     ★ 只在 gazeMode === "scan" 时跑;那一句"看向屏幕正中央"由 centerGaze 接管。 */
  function followLoop() {
    if (!playing) return;
    requestAnimationFrame(followLoop);
    window.__followTicks = (window.__followTicks || 0) + 1;
    refreshSnap();                       /* ★ 每一帧重新量目标:机器在平移/玻璃在贴合 */
    if (gazeMode !== "scan" || !eye) return;
    if (frameRect) lookAtRect(frameRect);
  }

  function lookAtRect(p) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cx = p.left + p.width / 2, cy = p.top + p.height / 2;
    /* 和 ascii-eye 里 lookAt 同一套归一化:相对【视口中心】的方向 */
    var gx = ((cx - vw / 2) / (vw / 2)) * 1.25;
    var gy = ((cy - vh / 2) / (vh / 2)) * 1.25;
    /* ★ 防御:NaN 一旦传进 setGaze,眼睛就【永远不动】而且不报错。
       这里咬一口:任何一个数不是有限值就整帧不动(保留上一帧的视线)。 */
    if (!isFinite(gx) || !isFinite(gy)) return;
    window.__lastGaze = { gx: Math.round(gx * 1000) / 1000, gy: Math.round(gy * 1000) / 1000, rect: [Math.round(p.left), Math.round(p.top), Math.round(p.width), Math.round(p.height)] };
    eye.setGaze(gx, gy);
  }

  function runStep(s, i) {
    stepIndex = i;
    stepLabel = s.label || "";
    /* ★ 往后看一拍:有些编排要知道"下一步是什么"(比如"按下这一下会左滑进 CD 页",
       ⇒ 按下就得立刻闭眼)。见 runStep 里 s.press 那一段。 */
    var next = stepList[i + 1] || null;
    if (s.lock) lock(true);
    if (s.unlock) lock(false);
    if (s.unlockTop) lockTop(false);
    if (s.wheelLock) lockWheel(true);
    if (s.unlockWheel) lockWheel(false);

    if (s.snap) {
      setSnapSpec(s.snap);
      var t = snap(s.snap);
      snapTarget = t || null;
      /* ★★ 视线【始终】跟着扫描框(用户第三轮:"眼睛是始终要跟扫描框的,
         只有一句台词需要看向屏幕中央")。
         所以这里不再逐拍设置视线,而是交给"每一帧跟着框"那条循环
         —— 框在缓动、在换位置,瞳孔就一路跟着走,而不是一步跳到位。 */
      gazeMode = "scan";
    }
    if (s.gaze === "center") { gazeMode = "center"; if (eye) eye.centerGaze(); }
    if (s.gaze === "scan") gazeMode = "scan";
    if (s.eye === "reveal") eyeReveal();
    /* ★★★ 提示高亮的时机:【等用户按的那一步开始时】亮 ——
       不当成"拍子一开始"就亮。实测:一拍里"进入 CD 页"到台词打完要分两步
       (先等按、再说话),把高亮挂在拍子开头会让它在台词出现前 60 秒就亮着,
       用户根本对不上"这句话说的是哪个按钮"。
       ⇒ 交给"等用户按"那一步的第一个任务,它和台词几乎同时发生。 */
    if (s.dock) {
      /* ★★★ 用户第五轮,重写了这一段的编排:
         "按下左滑后,主屏幕的眼睛马上闭上,等到彻底滑过去后,
          眼睛再在右侧睁开。而且这个右侧眼睛也有同样不跟鼠标的问题。"
         ⇒ 不再是"缩小 + 转 90°",而是:闭眼 → 左滑 → 在新的位置重新睁眼。
           眼睛的朝向【也仍然要转 90°】(第三轮的要求,两件事是叠加的,
           第六轮用户为这个纠正过一次:"我说眼睛要旋转90°,你怎么又给我修回去了?")。
      ★★★ 第七轮:"按下进入CD页的按钮时,主眼睛应该立马闭合,否则跟不上左滑的速度。"
        ⇒ 原来这里挂的是 setTimeout(runDock, 380) —— 那 380ms 是"人手按完了,
          引导还在发呆"的可视延迟。现在【立刻】走 runDock,而 runDock 里等的
          闭眼是按下那一刻就已经在跑的(见 watchDockPress / beginDockClose)。
      ★ 顺带:从这一拍起,台词换成"操作旁白"的那一档语速(见 typeMs)。 */
      typeMs = TYPE_MS_FAST_TAIL;
      inCdPage = true;
      runDock();
    }

    /* ★ 要按的、要说的,都按【先按后说】的顺序排好再跑 */
    var tasks = [];
    /* ★★★ 顺序:【先说话,再等用户按】。
       用户第六轮:"对话'按下它'只有点击按钮之后才会触发。"
       根因:第三轮把"让用户自己按"改进来时,我把等待排在了台词【前面】——
       于是这一拍的表现是:台词一句都没有,界面就那么干等着;
       用户按下去之后那句"按下它。"才打出来。完全反了。
       用户给的原顺序本来就是:对话("按下它")→ 动画(按下 → 左滑)。
       ★ 高亮与松框仍然在这一拍【一开始】就做:它们是"这句台词在说哪个按钮"
         的注解,要跟台词同时在场,而且不能等到按完才亮。
         (踩过:高亮挂在拍子开头而台词在最后 → 早了 60 秒;
          挂在台词之后 → 用户读完话才亮、一按就灭。两头都够不着。) */
    if (s.press) {
      tasks.push(function () {
        /* ★★★ 如果按下这一下会引发"左滑进 CD 页",那从这一刻起就盯着那个状态:
           用户一按,眼睛【立刻】闭(不等引导走到下一拍)。
           见 watchDockPress / beginDockClose 上的说明。 */
        if (next && next.dock) watchDockPress();
        window.__mcScript = null;
        lastSnapSpec = null;
        frameRect = null;
        pulseTarget(s.press, true);
        return null;                       /* 先只把提示摆好,不阻塞 */
      });
    }
    if (s.text) {
      tasks.push(function () {
        /* ★ 左滑之后那几句换成"操作旁白"的短停拍(见 afterLineTail):
           它们是一口气交代四个按钮,句间再各停 1.5 秒就太拖了。 */
        var pause = inCdPage ? afterLineTail : afterLine;
        return typeLine(s.text).then(function () { return sleep(pause); });
      });
    }
    if (s.press) {
      tasks.push(function () { return waitForUser(s.press); });
    }
    if (!tasks.length) {
      /* 没有台词的步骤:光等(每步都再给一拍,让扫描框吸稳) */
      tasks.push(function () { return sleep(gate(s.wait || 0)).then(function () { return sleep(settleMs); }); });
    }
    var p = Promise.resolve();
    tasks.forEach(function (fn) { p = p.then(fn); });
    /* 现场读数:每一步的起止时刻 —— 这一段的时序错一点都很难从截图上看出来,
       留着它(而不是只活在排查时)才查得动下一次的问题。 */
    window.__stepInfo = window.__stepInfo || {};
    window.__stepInfo[i] = { label: s.label || "", tasks: tasks.length, at: Math.round(performance.now()) };
    p.then(function () { window.__stepInfo[i].end = Math.round(performance.now()); },
      function (e) { window.__stepInfo[i].rej = String((e && e.message) || e); });
    return p;
  }

  /* ============================================================
     等用户自己按下某个按钮
     ─────────────────────────────────────────────────────────────
     用户第三轮:"按下按钮并不是自动按,是让用户自己按"。

     ★★★ 判据用【状态】,不是"有没有接到那次 click"。
     为什么(实测踩了很久):靠 document 上的一次性监听去抓那一下点击,
     在某些路径下抓不到 —— 鼠标事件确实到了页面上(用 CDP 派发真事件验过:
     pointerdown/mousedown/pointerup/mouseup/click 五个都到了 document),
     但引导自己的那份监听就是没触发,于是"用户明明按了,引导还在等",
     最后靠 12 秒兜底才过去。这类"监听没接到"的 bug 极难复现也极难证明。

     ⇒ 改成查【那个动作到底生效了没有】:
         · CD 架按钮  → body.scene-open 出现
         · 插入按钮   → cd-busy 事件(cd3d 确认插入开始)
       两个都是"结果",不依赖事件怎么冒泡、从哪个元素上按的、
       甚至用户是点按钮还是点它里面的那个 svg —— 一律成立。

     ★ 兜底:12 秒还没按就自己过去 —— 不能把用户永远卡在引导里出不去。
     ============================================================ */
  function makeWaiter(sel) {
    if (sel === "#intro-toggle" || sel === ".slot-toggle") {
      return {
        done: function () { return document.body.classList.contains("scene-open"); },
        watch: null
      };
    }
    if (sel === "#statusbar-toggle") {
      return {
        done: function () { return document.body.classList.contains("tablet-open"); },
        watch: null
      };
    }
    if (sel === "#rack-insert") {
      /* 插入是 cd3d 的异步流程:它一开始就广播 cd-busy(true) */
      var started = false;
      return {
        done: function () { return started; },
        watch: function (arm) {
          if (arm) document.addEventListener("cd-busy", function (e) {
            if (e && e.detail === true) started = true;
          });
        }
      };
    }
    /* 其它元素:退回"点到它就算"(这类没有状态可查) */
    return {
      done: function () { return false; },
      watch: function (arm) { },
      fallbackSel: sel
    };
  }

  function waitForUser(sel) {
    /* ★★★ 用户第五轮:"扫描框固定在按钮的时候,实际鼠标并不在这里,所以根本就按不了。"
       根因:引导把扫描框【钉】在按钮上,而真实指针在别处 —— 两者不是同一个位置。
       这一屏的原生光标又被 cursor:none 藏起来了,用户看到的只有画出来的框,
       于是他会去点"框所在的地方",而那一击根本没落在按钮上。
       ⇒ 松框 + 脉冲高亮这两件事已经由 runStep 的 arm 在【一拍开始时】做了
         (见那里"提示要在台词之前亮起来"的说明);这里只负责等状态。 */
    lock(false);
    lockWheel(false);
    var el = document.querySelector(sel);
    if (!el) return sleep(200);
    var w = makeWaiter(sel);
    if (w.watch) w.watch(true);
    /* 用户可能在提示出现之前就按过了 */
    window.__pressState = { sel: sel, at: Math.round(performance.now()), hit: 0, done: 0, pre: w.done() };
    if (w.done()) return Promise.resolve();
    return new Promise(function (resolve) {
      var t0 = performance.now();
      var poll = 0;
      /* ★★★ var poll 必须先声明、finish 里再防御一次:
         原来写的是 `var finish = function(){ … clearInterval(poll) … }`
         紧接着 `var poll = setInterval(…)` —— 定时器回调触发时 poll【已经】赋值,
         看起来没问题;但 finish 一旦在赋值之前被调用(同步路径),
         `clearInterval(poll)` 读的是【暂时性死区】里的 poll ⇒ ReferenceError
         抛在定时器/Promise 回调里 ⇒ 不冒泡到控制台,而 resolve() 那行
         永远走不到 ⇒ 整条引导链在这里【静默卡死】。
         实测症状就是:用户明明按了按钮、CD 架也开了,引导还停在"按下它"
         (这一步卡了整整一轮排查)。⇒ 声明提前 + try/catch 兜底。 */
      var finish = function (why) {
        if (window.__pressState.done) return;
        window.__pressState.done = 1;
        window.__pressState.why = why;
        try { if (poll) clearInterval(poll); } catch (e) { }
        pulseTarget(sel, false);          /* 按完了,把高亮收掉 */
        resolve();
      };
      /* ★ 兜底 60 秒:不是"等不及"的兜底,是"用户走开了"的兜底 ——
         这一步是引导的出口,用户可能真的去干别的了。
         (原来写 12 秒:正常读一句台词就要五六秒,12 秒很容易被误判成超时。) */
      poll = setInterval(function () {
        var now = performance.now();
        var isDone = false;
        try { isDone = w.done(); } catch (e) { if (window.__pressState) window.__pressState.err = String(e && e.message || e); }
        if (isDone) { finish("state"); return; }
        if (now - t0 > 60000) finish("timeout");
      }, 60);
    });
  }

  function play() {
    if (playing) return Promise.resolve();
    window.__playCount = (window.__playCount || 0) + 1;
    playing = true;
    skipping = false;
    gazeMode = "scan";
    playStart = performance.now();
    followLoop();                        /* 视线每帧跟着扫描框 */
    var list = steps();
    stepList = list;
    var p = Promise.resolve();
    list.forEach(function (s, i) {
      p = p.then(function () {
        if (skipping) { /* 跳过时"要用户按"的那两拍也别等了 */ return null; }
        /* ★★ 每一步都包一层 catch:一步里抛异常(比如某个 API 名字写错)
           会让整条 Promise 链【静默死掉】—— 引导停在那儿,没有异常抛出到
           控制台,截图上看就是"不走了"。实测踩过一次(ReferenceError:
           basePad is not defined),查了很久。包一层至少留个记录、继续往下走。 */
        return runStep(s, i).catch(function (e) {
          window.__guideError = (window.__guideError || []).concat(
            ["step " + i + " (" + (s.label || s.text || "") + "): " + ((e && e.message) || e)]);
          console.error("[home-guide] 第 " + i + " 步出错:", e);
        });
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
    /* 扫描框还原成"平时的样子":自转倍率归位;剧本矩形撤掉 */
    window.__mcSpinScale = 1;
    window.__mcScript = null;
    lastSnapSpec = null;

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

  /* ============================================================
     跳过
     ─────────────────────────────────────────────────────────────
     ★★★ 触发条件不能是"任意 pointerdown"。踩过:
       引导说"按下它"、让用户去按 CD 架按钮 —— 用户按下时产生的 pointerdown
       被这条监听当成"我要跳过",于是 skipping 一置真,
       【后面所有步骤连跑都不跑】(play 的链里 `if (skipping) return null`)。
       症状极具迷惑性:用户按了按钮、CD 架也开了,引导却停在原地不动。
     ⇒ 只有【键盘】算数(空格/回车/Esc)。鼠标不要参与:
       引导里要按的按钮本来就有两处,不能把"按它"读成"跳过它"。
     ★ 另外给它一个"冷静期":刚进一拍的前 400ms 不吃跳过,
       免得连点两下时第二下误触。
     ============================================================ */
  var playStart = 0;
  function skip() {
    if (!playing || skipping) return;
    if (performance.now() - playStart < 400) return;
    skipping = true;
    clearTimeout(typing);
    typeDone = true;
    consoleEl.classList.add("is-typed");
  }
  document.addEventListener("keydown", function (e) {
    if (!playing) return;
    if (e.key !== " " && e.key !== "Enter" && e.key !== "Escape") return;
    skip();
  });

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
      /* ★ gaze:'fixed':首页的眼睛不跟【页面上的鼠标事件】乱飘 ——
         它听的是引导脚本 + 下面那条真人指针的转达。
         (用户第三轮:"眼睛是始终要跟扫描框的";第五轮补:
          "眼睛不能跟随自由移动的扫描框" —— 所以真人一动指针就交回给手。) */
      gaze: "fixed",
      drift: false,
      reduced: reduced
    });
    /* ★★ 把"真人动了鼠标"这件事从 magnetic-cursor 转达给眼睛。
       它那边分得清合成事件与真实事件(isTrusted),这里只负责转交 ——
       引导自己派发的 pointermove 不会被当成"用户在动"。 */
    window.__mcOnPointer = function (x, y, real) {
      if (!real || !eye) return;
      if (gazeMode !== "scan") return;
      if (eye.onPointer) eye.onPointer(x, y);
    };
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
      /* 第七轮新加的三处,给探针直接读:
         · typeMs  —— 当前生效的字速(进 CD 页后应该变成 34)
         · inCdPage —— 已经左滑过去了
         · closing  —— 闭眼是否已经在跑(按下那一刻起就该是 true)
         · host/pre —— 转 90° 之后到底占了多大(转完是宽高互换的) */
      typeMs: typeMs,
      inCdPage: inCdPage,
      closing: !!dockClosing,
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
