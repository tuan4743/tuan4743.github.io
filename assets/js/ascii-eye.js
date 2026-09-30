/* ============================================================
   方舟总控 AI 的【ASCII 大眼睛】—— 共用实现
   ─────────────────────────────────────────────────────────────
   这一只眼睛原来只长在启动页(layouts/start/list.html 的内联脚本)里。
   现在【首页也要它】(用户:"然后把启动页的眼睛移植过去,触发动画和对话")——
   两个地方必须表现得一模一样,所以抽成这一份,两边都用它,不各写一遍:
     · 启动页:眼睛 → 睁开 → "你好?" → 两个选项(按住确认)
     · 首页  :眼睛 → 睁开 → ECHO 开口逐字说话 → 扫过平板各个部件(引导)

   ★★ 两处【不是同一个角色】,别把台词写进这里:
      启动页那一只是方舟总控 AI(全页不说话);首页这一只叫 ECHO(子代理)。
      所以本模块只管"怎么画",一个字都不说 —— 说什么是调用方的事(onOpened)。

   ★★★ 这个文件里每一条注释都是踩出来的,改之前先读:
     · 不做任何镜像/复制(只算左半再反转):瞳孔跟着视线往一边移时,
       镜像会把左半的瞳孔复制到右半 ⇒ 屏幕上出现【两个瞳孔】(用户报过)。
       对称只能靠几何本身(虹膜圆心在中轴上、瞳孔是解析竖缝)。
     · 每行必须补满到 COLS,【不许 trim 行尾空格】:
       <pre> 的宽度会被行尾空格影响,一 trim 画布就比坐标系窄几格,眼睛整体偏左。
       宽度同时钉成 COLS × 字宽,居中交给 text-align。
     · flowMeasure 里【不能】提前调 flowDraw:那时 FL.streams 还没建,
       读 undefined.on 直接抛异常,后面建流的代码整段不执行,
       <pre> 里只剩测量用的那串 '0000…' —— 用户看到的是"乱流只在左半边"。
     · 字号上限原来是 14px,那正是"27 寸上眼睛不变大"的病根;
       现在按 vw/120 走(上限 22px)。
     · 高度必须封顶(网格高 ≤ 视口高的 56%),否则宽屏上眼睛把视口吃光,
       下面的字和按钮被挤出屏幕。
     · 竖瞳用【解析竖缝】(|ix| < IRIS_R·SLIT_W && |iy| < IRIS_R·SLIT_H),
       不要写成 hypot(px·SQUEEZE, py) < PUPIL_R —— 后者正中间那一列会被取整挤掉。
     · 高光【不要加】:一块亮斑压在瞳孔左上会把整只眼的重心拽向左边。

   ★★ rAF 回调里抛异常是【静默】的(控制台可能一声不响,表现只是"眼睛不动"),
      所以渲染循环外面包了 frameSafe,try/catch 之后把栈写进 window.__eyeError。

   接口(window.AsciiEye.create):
     create(pre, opt) → {
       el, resize(), fitTo(w,h), setGaze(x,y), lookAt(el), centerGaze(), glitch(on),
       start(openOnStart) / openNow() / close(cb) / stop(),
       isOpen(), running(), closed(), T_CLOSE, state()
     }
     opt: { flow, gaze:'fixed', openOnStart, onOpened, reduced, drift }
   ============================================================ */
(function () {
  "use strict";

  /* 字符梯度:暗 → 亮。★ 用 ASCII,不用制表符/方块字 ——
     那些在等宽字体里不一定是 1ch 宽,网格会歪(踩过)。 */
  var RAMP = " .-:=+*#%@";

  function create(pre, opt) {
    opt = opt || {};
    if (!pre) return null;

    /* ---------- 几何 ----------
       ★★ 数学定下来了,都是量出来的:
         · 格子尺寸【固定】= 字号 × 0.6 / 字号 × 1.5,只按视口挑字号;
           不要"先摆网格再反推字号"—— 那样每改一次字号格子跟着动,
           瞳孔位置就跟着漂,量出来的数全废(踩过)。
         · 眼睛宽度按视口的 62% 定列数,再由 EYE_AR 反推行数。
         · ★★★ 虹膜半径按【眼睑开孔高度】取,不按眼半径 ——
           这是唯一能让"瞳孔 ≥3 格""虹膜 ≥8 格""两侧还看得见眼白"
           同时成立的取法。按眼半径取时开孔永远被虹膜塞满,
           画出来是一团圆盘/曼陀罗,不是眼睛(连试 6 组参数都是)。 */
    var CELL_W = 6.6, CELL_H = 16.5;
    var COLS = 0, ROWS = 0, FS = 11;
    var HALF_W = 0, EYE_HY = 0, IRIS_R = 0, PUPIL_R = 0;
    var EYE_AR = 2.05;          /* 杏仁形 宽 : 高 */
    var EYE_W_FRAC = 0.62;      /* 眼睛宽度 / 视口宽度 */
    var LID_POW = 0.30;         /* lidAt 的形状指数(同时决定眼睛占多少行)*/
    var IRIS_OF_LID = 0.74;     /* 虹膜半径 / 开孔半高 */
    var PUPIL_OF_IRIS = 0.46;
    var SLIT_W = 0.075, SLIT_H = 0.42;   /* 竖缝的两个半轴(按虹膜半径取比例)*/
    /* lidAt 的峰值:LID_POW=0.30 时 ≈ 0.877。
       ★ 这个数同时定了两件事:网格高度、虹膜半径。别再拍系数。 */
    var LID_PEAK = 1 / Math.pow(1 - Math.pow(2, -1 / LID_POW), LID_POW);
    var LID_FIT = LID_PEAK;
    var LID_UP = 1.0, LID_DOWN = 0.86;   /* 上睑盖得多、下睑浅 —— 真眼睛的比例 */
    var CENTER_SHIFT = 0;

    function lidAt(px, open, up) {
      var t = 1 - (px / HALF_W) * (px / HALF_W);
      if (t <= 0) return 0;
      return open * EYE_HY * (up ? LID_UP : LID_DOWN) * Math.pow(t, LID_POW);
    }

    /* 巩膜(眼白):整只眼里最亮的一片,但【必须是平的】。
       ★★★ 这里改了三版,每版的病都不一样,记下来免得再走一遍:
         ① 强渐变(正中很亮、往边缘衰减):那团亮在字符网格上自己围成一个环,
            截图看起来【像两只眼睛叠在一起】。
         ② 压平但绝对亮度和虹膜同档:巩膜和虹膜糊成一片,没有层次。
         ③ 压到 0.14~0.26:整只眼变成一坨灰,虹膜反而看不见了。
       ⇒ 巩膜要【又平又亮】,层次靠"巩膜 > 虹膜 > 竖瞳"这个【顺序】拉开。 */
    function sclera(depth, open) {
      return (0.66 + 0.14 * Math.pow(depth > 0 ? depth : 0, 0.8)) * (0.6 + open * 0.4);
    }

    function eye(px, py, gx, gy, open, out) {
      var q = 0;
      if (open > 0.001) {
        /* 开孔 = 上睑【与】下睑之间,两条都要判:
           只判一条的话另一侧会豁出去一块(眼角多出一片肉)。 */
        var lidU = lidAt(px, open, true);
        var lidD = lidAt(px, open, false);
        if (py < lidU && py > -lidD) {
          var depth = py < 0 ? (1 + py / (lidU || 1)) : (1 - py / (lidD || 1));
          var ix = px - gx * IRIS_R * 0.46, iy = py - gy * IRIS_R * 0.46;
          var ir = Math.sqrt(ix * ix + iy * iy);
          q = sclera(depth, open);
          if (ir < IRIS_R) {
            /* 虹膜:比巩膜暗【两档】。
               ★ 梯度只有 10 级,差一档等于没差 —— 0.40 和巩膜的 0.66~0.80
                 都落在 '=' 那一级,画出来是"一整片 = 中间一块 ."。
               ★ 放射纹从 0.28+0.05·fib 收到 0.30 定值:那点纹路在 10 级梯度上
                 翻不出第二档字符,却让虹膜里散布一堆明暗不一的格子 ——
                 用户连着两轮说"歪",一半是它贡献的(看着像脏,不像结构)。 */
            q = 0.30;
            /* 轮部环:整只眼睛"有神"全靠这一圈。收窄到 0.07 ——
               0.11 那版这一圈自己就宽得能当第二只眼。 */
            var lim = Math.abs(ir - IRIS_R * 0.90);
            if (lim < IRIS_R * 0.07) q = 0.98 - lim * 0.6;
            /* ★★★ 瞳孔:竖缝用【解析式】,不用"半径放大再取整"。 */
            var sl = Math.abs(ix) < IRIS_R * SLIT_W && Math.abs(iy) < IRIS_R * SLIT_H;
            if (sl) q = 0.16;
          }
        }
      }
      out.q = q;
    }

    /* ---------- 尺寸 ---------- */
    function measure() {
      var vw = window.innerWidth, vh = window.innerHeight;
      /* ★★★ 字号上限原来是 14px,那正是"27 寸上眼睛不变大"的病根:
         格子尺寸 = 字号 × 0.6 / 字号 × 1.5,字号封在 14 ⇒ 格子封在 8.4×21px,
         视口再宽也只能靠"多给几列"变大 —— 而列数又被视口宽卡住。 */
      FS = Math.max(8, Math.min(22, Math.round(vw / 120)));
      CELL_W = FS * 0.6;
      CELL_H = FS * 1.5;
      var eyeW = vw * EYE_W_FRAC;
      COLS = Math.max(40, Math.min(240, Math.round(eyeW / CELL_W)));
      HALF_W = COLS * CELL_W / 2;
      EYE_HY = HALF_W / EYE_AR;
      /* ★★★ 1.30 是【量出来的】,不是算出来的:
         原来写 1.06,实测量到的画布宽高比是 3.27 —— 而 EYE_AR 设的是 2.35,
         差了 39%。原因:网格比开孔矮,最上/最下那几行的开孔被网格边缘切掉,
         眼睛就成了"两头削平的椭圆"。1.06 × (3.27/2.35) ≈ 1.48,
         但补偿是非线性的(切成什么样取决于行对齐),所以取 1.30 实测到位。 */
      ROWS = Math.max(12, Math.round(EYE_HY * LID_UP * LID_FIT * 2 / CELL_H * 1.30));
      /* ★★★ 高度必须封顶 —— 只按宽度定尺寸会在宽屏上炸掉:
         2560×1080 下算出 42 行 = 882px,眼睛本体就把视口吃光,
         下面的"你好?"和两个选项被挤出屏幕(wrap 甚至跑到 y = -33)。
         按"网格高 ≤ 视口高的 56%"再夹一道,并【同步缩 COLS】——
         只改行数会把眼睛压扁,比例就毁了。 */
      var maxRows = Math.max(12, Math.floor(vh * 0.56 / CELL_H));
      if (ROWS > maxRows) {
        ROWS = maxRows;
        COLS = Math.max(40, Math.min(COLS,
          Math.round(ROWS * CELL_H / (LID_UP * LID_FIT * 2 * 1.30) * EYE_AR * 2 / CELL_W)));
        HALF_W = COLS * CELL_W / 2;
        EYE_HY = HALF_W / EYE_AR;
      }
      IRIS_R = EYE_HY * LID_UP * LID_FIT * IRIS_OF_LID;
      PUPIL_R = IRIS_R * PUPIL_OF_IRIS;
      /* 眼睛竖向中心相对网格中心偏了多少(上睑高、下睑低)⇒ 反向平移网格 */
      CENTER_SHIFT = (lidAt(0, 1, true) - lidAt(0, 1, false)) / 2;
      pre.style.fontSize = FS + "px";
      pre.style.lineHeight = CELL_H + "px";
      pre.style.height = (ROWS * CELL_H) + "px";
      /* ★★★ 宽度也钉死成"列数 × 字宽"。这是"眼睛偏左"的根治:
         <pre> 的宽度原来由内容撑,而内容宽度会被行尾空格影响;
         flex 又按那个宽度居中 ⇒ 画布与坐标系差几格,眼睛整体偏。
         text-align:center 再兜一层,保证任何宽度下文字都在正中间。 */
      pre.style.width = (COLS * CELL_W) + "px";
    }

    /* fitTo(w,h):换宿主尺寸(首页要把它塞进平板右三分之一那一格)。
       只重算列/行/字号,不改形状比例 —— 还是同一只眼睛,只是小了一号。 */
    function fitTo(boxW, boxH) {
      if (!boxW || !boxH) return;
      var fs = Math.max(6, Math.min(22, Math.round(boxW / 26)));
      CELL_W = fs * 0.6;
      CELL_H = fs * 1.5;
      FS = fs;
      COLS = Math.max(16, Math.floor(boxW / CELL_W));
      ROWS = Math.max(8, Math.floor(boxH * 0.86 / CELL_H));
      HALF_W = COLS * CELL_W / 2;
      EYE_HY = HALF_W / EYE_AR;
      IRIS_R = EYE_HY * LID_UP * LID_FIT * IRIS_OF_LID;
      PUPIL_R = IRIS_R * PUPIL_OF_IRIS;
      CENTER_SHIFT = (lidAt(0, 1, true) - lidAt(0, 1, false)) / 2;
      pre.style.fontSize = FS + "px";
      pre.style.lineHeight = CELL_H + "px";
      pre.style.height = (ROWS * CELL_H) + "px";
      pre.style.width = (COLS * CELL_W) + "px";
    }

    /* 换宿主格(首页要把它塞进"平板还能看见的那一格")。
       ★★★ 位置必须【用视口坐标显式给】,不能用 left:auto;right:0 + width:33vw:
          .scene 打开 CD 架时整块机器按 --rack-w(66vw)平移,而眼睛的宿主不在
          .scene 里,不会被带着走 —— 按"视口右边三分之一"算出来的那一格,
          和平板实际露出来的那一格【不是同一块】(第一版截图里眼睛有一大半
          压在金属框上,就是它)。⇒ left/top/width/height 由调用方量好传进来。 */
    function anchor(left, top, width, height) {
      if (!pre.parentNode || !width || !height) return;
      var st = pre.parentNode.style;
      st.left = Math.round(left) + "px";
      st.top = Math.round(top) + "px";
      st.width = Math.round(width) + "px";
      st.height = Math.round(height) + "px";
    }

    /* ---------- 视线 ---------- */
    var tgt = { x: 0, y: 0 };      /* 目标 */
    var gz = { x: 0, y: 0 };       /* 当前(平滑用) */
    var hasPointer = false;
    var forceGaze = opt.gaze === "fixed";   /* true = 不跟鼠标,只认 setGaze */

    function fromPointer(e) {
      if (forceGaze) return;
      var w = window.innerWidth, h = window.innerHeight;
      var nx = (e.clientX - w / 2) / (w / 2);
      var ny = (e.clientY - h / 2) / (h / 2);
      tgt.x = Math.max(-1, Math.min(1, nx * 1.25));
      tgt.y = Math.max(-1, Math.min(1, ny * 1.25));
      hasPointer = true;
    }
    if (!forceGaze) {
      window.addEventListener("mousemove", fromPointer, { passive: true });
      window.addEventListener("mouseleave", function () { hasPointer = false; }, { passive: true });
      window.addEventListener("touchmove", function (e) {
        if (e.touches && e.touches[0]) fromPointer(e.touches[0]);
      }, { passive: true });
    }

    /* 面向屏幕正中央(用户:"瞳孔转向面对屏幕正中央")*/
    function centerGaze() {
      hasPointer = false;
      tgt.x = 0; tgt.y = 0;
    }
    /* 跟着某个元素:把视线指向那个元素相对视口中心的方向 */
    function lookAt(el) {
      hasPointer = false;
      if (!el || !el.getBoundingClientRect) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      var w = window.innerWidth, h = window.innerHeight;
      var nx = ((r.left + r.width / 2) - w / 2) / (w / 2);
      var ny = ((r.top + r.height / 2) - h / 2) / (h / 2);
      tgt.x = Math.max(-1, Math.min(1, nx * 1.25));
      tgt.y = Math.max(-1, Math.min(1, ny * 1.25));
    }
    /* 直接给归一化方向(引导脚本用) */
    function setGaze(x, y) {
      hasPointer = false;
      tgt.x = Math.max(-1, Math.min(1, +x || 0));
      tgt.y = Math.max(-1, Math.min(1, +y || 0));
    }

    /* ---------- 眨眼 ---------- */
    var blinkN = 0;
    /* ★ REDUCED 是【查询一次定死】的,但系统设置可能在页面开着的时候改;
       而且无头浏览器默认就报 reduce(踩过:采样 6 秒一次都没眨)。
       所以在查询外面再套一层"可被覆盖"的软开关,默认跟随系统。 */
    var blinkOff = !!opt.reduced;
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        blinkOff = mq.matches;
        if (mq.addEventListener) mq.addEventListener("change", function (e) { blinkOff = e.matches; });
      }
    } catch (e) { }
    var nextBlink = performance.now() + 2600, blinkT = -1;
    function blink(now) {
      if (blinkOff) return 1;
      if (blinkT >= 0) {
        var k = (now - blinkT) / 160;
        if (k >= 1) { blinkT = -1; blinkN++; nextBlink = now + 2500 + Math.random() * 3000; return 1; }
        return Math.max(0.06, Math.abs(Math.cos(Math.PI * k)));
      }
      if (now > nextBlink) { blinkT = now; return 0.06; }
      return 1;
    }

    /* ---------- 出场时间线 ----------
       BOOT(一线) → JITTER(抖) → 猛地睁开 → IDLE → CLOSING(闭)
       ★ 开眼用 easeOutBack 过冲:"猛地睁开"要的就是过冲那一下。
       ★ 眨眼在 BOOT/JITTER 期间【不许插进来】—— 那时候眼睛还没开。 */
    var PH = { BOOT: 0, JITTER: 1, OPEN: 2, IDLE: 3, CLOSING: 4, SHUT: 5 };
    var phase = PH.SHUT;
    var phaseAt = 0;
    var T_BOOT = 620, T_JITTER = 260, T_OPEN = 560;
    /* ★★★ 缝的最小开度 —— 这个数必须【能占满一整行】:
       格子高 16.5px,而开孔半高 = open × EYE_HY × LID_UP × PEAK。
       open = 0.02 时半高只有 5px —— 一行都占不满,屏幕上【什么都没有】。
       ⇒ 最小值取 0.045(半高≈11.8px,正好铺满一行),看得见一条横线。 */
    var OPEN_LINE = 0.045;
    var T_CLOSE = 780;
    var openVal = OPEN_LINE;
    var jitterAmp = 0;
    var glitch = 0, glitchNext = 0, redUntil = 0;
    var closedDone = false, closeCb = null;

    function easeOutBack(k) { var c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }

    /* 错乱的字符库:只用 ASCII(用户要的就是 ASCII),挑字形碎的 */
    var JUNK = "#%&$@*!?=+~^<>/\\|_";
    function junkChar() { return JUNK.charAt((Math.random() * JUNK.length) | 0); }

    var openedOnce = false;
    var last = 0, rafOn = false;

    function frame(now) {
      if (!rafOn) return;
      requestAnimationFrame(frameSafe);
      if (now - last < 16) return;            /* ≈60fps */
      last = now;

      /* ---------- 阶段推进 ---------- */
      var el = now - phaseAt;
      if (phase === PH.BOOT && el > T_BOOT) { phase = PH.JITTER; phaseAt = now; }
      else if (phase === PH.JITTER && el > T_JITTER) { phase = PH.OPEN; phaseAt = now; }
      else if (phase === PH.OPEN && el > T_OPEN) { phase = PH.IDLE; phaseAt = now; onOpened(); }

      if (blinkOff && phase < PH.IDLE && phase !== PH.SHUT) { phase = PH.IDLE; phaseAt = now; openVal = 1; onOpened(); }

      /* ---------- 开合 ---------- */
      if (phase === PH.BOOT) {
        openVal = OPEN_LINE;
      } else if (phase === PH.JITTER) {
        /* 抖动:线开始跳。振幅随机游走,别用正弦 —— 正弦看着像呼吸不像故障 */
        jitterAmp = 1.6 + Math.random() * 2.4;
        openVal = OPEN_LINE + Math.random() * 0.05;
      } else if (phase === PH.OPEN) {
        var k = Math.min(1, el / T_OPEN);
        openVal = OPEN_LINE + (1 - OPEN_LINE) * easeOutBack(k);
      } else if (phase === PH.CLOSING) {
        var kc = Math.min(1, el / T_CLOSE);
        openVal = 1 - (1 - OPEN_LINE) * (kc * kc * (3 - 2 * kc));   /* smoothstep */
        if (kc >= 1) {
          openVal = OPEN_LINE; closedDone = true; phase = PH.SHUT;
          if (closeCb) { var cb = closeCb; closeCb = null; cb(); }
        }
      } else if (phase === PH.SHUT) {
        openVal = OPEN_LINE;
      } else {
        openVal = blink(now);
      }

      /* ---------- 错乱 ----------
         ★★★ 用户:"你这个左下角按钮的乱序的效果,范围是一个小方框,
           而且范围和频率有点大。"
         ⇒ 频率:爆发间隔 60~190ms → 240~560ms;
           范围:每个字符被换成乱码的概率 10% → 3.5%,整行错位 18% → 7%;
           强度:红/黄/白闪的亮度也压了一档。 */
      if (glitch && now > glitchNext) {
        glitchNext = now + 240 + Math.random() * 320;
        redUntil = now + 45 + Math.random() * 90;
      }
      var glitching = glitch && now < redUntil;
      pre.classList.toggle("is-glitch", glitching);
      if (glitch && !glitching) {
        pre.style.setProperty("--eye-glitch",
          (Math.random() < 0.5 ? "#d94a42" : (Math.random() < 0.5 ? "#d9c25a" : "#dfe6ee")));
      }

      /* ★ 鼠标不在时不许"死住":给一点极慢自漂(两个不同频率,不会走成一条直线)。
         但【引导脚本钉住的视线不许被自漂带跑】—— opt.drift === false 时完全不加。 */
      var tx = tgt.x, ty = tgt.y;
      if (!hasPointer && opt.drift !== false) {
        tx += Math.sin(now / 3100) * 0.30;
        ty += Math.cos(now / 4700) * 0.16;
        tx = Math.max(-1, Math.min(1, tx));
        ty = Math.max(-1, Math.min(1, ty));
      }
      var kk = blinkOff ? 1 : 0.09;
      gz.x += (tx - gz.x) * kk;
      gz.y += (ty - gz.y) * kk;

      var lines = new Array(ROWS);
      var tmp = { q: 0 };
      /* ★★★ 把几何量在帧开头就咬死成局部量:measure() 会在 resize 时改这些量,
         渲染循环跑到一半被改掉的话,同一行左右两半就是用【两套几何】算出来的。 */
      var FW = HALF_W, FCH = CELL_H, FSHIFT = CENTER_SHIFT, FH = FW;
      var w = COLS - 1;
      for (var r = 0; r < ROWS; r++) {
        var py = ((r + 0.5) / ROWS * 2 - 1) * (ROWS * FCH / 2) - FSHIFT;
        if (phase === PH.JITTER) py += (Math.random() - 0.5) * jitterAmp * FCH;
        /* ★★★ 每一列【独立】按自己的 px 算,不做任何镜像。
           对称要靠几何本身(虹膜圆心在中轴上、瞳孔是解析竖缝)去保证,
           不能靠"复制一半"—— 复制会把任何非对称的意图(追鼠标)也一起复制。 */
        var s = "";
        for (var c = 0; c <= w; c++) {
          var px = ((c + 0.5) / COLS * 2 - 1) * FH;
          eye(px, py, gz.x, gz.y, openVal, tmp);
          if (glitching && Math.random() < 0.035) {
            s += Math.random() < 0.5 ? junkChar() : RAMP.charAt(RAMP.length - 1);
          } else {
            s += RAMP.charAt(Math.round(tmp.q * (RAMP.length - 1)));
          }
        }
        /* ★★★ 【不要 trim 行尾空格】。补满到 COLS,坐标系与渲染宽度严格一致。 */
        if (s.length < COLS) s += new Array(COLS - s.length + 1).join(" ");
        else if (s.length > COLS) s = s.slice(0, COLS);
        lines[r] = s;
      }
      /* 错位:整行横移一两格(只有乱码期才有)。★ 概率 18% → 7% */
      if (glitching) {
        for (var g = 0; g < ROWS; g++) {
          if (Math.random() < 0.07) {
            var sh = 1 + ((Math.random() * 3) | 0);
            lines[g] = " ".repeat(sh) + lines[g].slice(0, Math.max(0, lines[g].length - sh));
          }
        }
      }
      var out = lines.join("\n");
      if (out !== pre.textContent) pre.textContent = out;

      /* 现场读数:探针要能读到视线/开孔/阶段,不然只能靠猜 */
      window.__startEye = {
        gx: gz.x, gy: gz.y, open: openVal, cols: COLS, rows: ROWS,
        cellW: CELL_W, cellH: CELL_H, fs: FS,
        drawn: lines[0] ? lines[0].length : -1,
        first: lines[0] ? lines[0].slice(0, 10) : null,
        reduced: blinkOff, blinks: blinkN, phase: phase, glitch: !!glitching,
        box: (function () { try { var b = pre.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; } catch (e) { return null; } })()
      };
    }

    /* ★★ rAF 回调里抛异常是【静默】的(控制台可能一声不响,
       表现只是"眼睛不动"),所以包一层并把栈留在一个能读的地方。 */
    function frameSafe(now) {
      try { frame(now); }
      catch (e) {
        rafOn = false;
        window.__eyeError = String((e && e.stack) || e);
        if (window.console && console.error) console.error("[ascii-eye] 渲染循环出错:", e);
      }
    }

    function onOpened() {
      if (openedOnce) return;
      openedOnce = true;
      if (typeof opt.onOpened === "function") opt.onOpened();
      try { window.dispatchEvent(new CustomEvent("eye-opened")); } catch (e) { }
    }

    /* ============================================================
       背景数据流:向上滚的 ASCII 竖线(可选 —— 传 opt.flow 才建)
       ─────────────────────────────────────────────────────────────
       · 一张铺满视口的 <pre>,内容是 ROWS_L × COLS_L 的字符网格;
         每帧把每列的"流头位置"向上推,并给走过的位置补一个新字符。
       · 一部分列留空(散列决定),这样像"数据流"而不是"雨帘"。
       · 帧率压到 ~12fps:背景不该抢注意力,而且省 CPU。
       ============================================================ */
    var flow = opt.flow || null;
    var FL = { cols: 0, rows: 0, streams: [], last: 0 };
    var FLOW_CH = "01".split("");
    var FLOW_TAIL = ".:-=+*#%@";
    var FLOW_SPEED = 0.34;

    function flowMeasure() {
      if (!flow) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      var fs = 11, ch = fs * 2.1;
      /* ★★★ 顺序错了就全错,这一处踩了三次:
         ① 先量字宽、后设 fontSize ⇒ 量的是【继承来的字号】的字宽;
         ② 按 0.62 估字宽 ⇒ 126 列 × 12.8px = 1613px > 1600px 视口,右边整片被裁;
         ③ 字体继承正文的栈 ⇒ 等宽回退的字宽和估值差得远。
         ⇒ 正确顺序:先定字号与字体(字体在 CSS 里写死 monospace),
           再量一个【真字符】的宽度,最后按它算列数,并留 4px 余量。 */
      flow.style.fontSize = fs + "px";
      flow.style.lineHeight = ch + "px";
      flow.style.width = "auto";
      var probeTxt = "0000000000000000000000000000000000000000";
      flow.textContent = probeTxt;
      var w40 = 0;
      try {
        var tn0 = flow.firstChild;
        if (tn0 && tn0.nodeType === 3) {
          var r0 = document.createRange();
          r0.setStart(tn0, 0);
          r0.setEnd(tn0, probeTxt.length);
          w40 = r0.getBoundingClientRect().width;
        }
      } catch (e) { w40 = 0; }
      var cw = (w40 > 0 ? w40 / probeTxt.length : fs * 0.62);
      FL.cols = Math.max(8, Math.floor((vw - 4) / cw));
      FL.rows = Math.max(8, Math.floor(vh / ch));
      flow.style.width = (FL.cols * cw) + "px";
      flow.style.height = (FL.rows * ch) + "px";
      /* ★★★ 这里【绝对不能】提前 flowDraw():那时 FL.streams 还没建,
         读 undefined.on 直接抛异常,后面建流的代码整段不执行,
         <pre> 里只剩上面那串测量用的 '0000…' —— 用户看到的"乱流只在左半边"
         就是这串残留。 */
      /* ★★★ 环形缓冲 + 规则分布:每列各自随机"开不开、流头在哪、多长"
         ⇒ 总有若干连续列恰好同时空着,截图上就是【某一段整片空白】。 */
      FL.streams = [];
      var GAP = 2;                          /* 每 2 列留 1 列空 */
      for (var c = 0; c < FL.cols; c++) {
        var on = (c % GAP !== 0) && ((c * 3) % 5 !== 0);
        var len = 7 + ((c * 7) % 9);        /* 7~15,按列号错开 */
        var ph = (c * 5) % 23;              /* 相位错开 */
        FL.streams.push({
          on: on, speed: FLOW_SPEED, len: len,
          head: ph * (FL.rows + len) / 23,
          cells: new Array(FL.rows).fill(" ")
        });
      }
      flowDraw();
    }

    function flowDraw() {
      if (!flow) return;
      var out = [];
      for (var r = 0; r < FL.rows; r++) {
        var line = "";
        for (var c = 0; c < FL.cols; c++) {
          var st = FL.streams[c];
          line += st && st.on ? (st.cells[r] || " ") : " ";
        }
        out.push(line);
      }
      flow.textContent = out.join("\n");
    }

    function flowStep() {
      if (!flow || !FL.streams.length) return;
      for (var c = 0; c < FL.cols; c++) {
        var st = FL.streams[c];
        if (!st.on) continue;
        st.head += st.speed;
        var span = FL.rows + st.len;
        if (st.head >= span) { st.head -= span; if (st.head >= span) st.head = 0; }
        var h = st.head | 0;
        for (var r = 0; r < FL.rows; r++) {
          var d = (h - r) % span;
          if (d < 0) d += span;
          if (d >= st.len) { st.cells[r] = " "; continue; }
          if (Math.random() < 0.18) { st.cells[r] = " "; continue; }
          var k = d / st.len;
          st.cells[r] = k < 0.35
            ? FLOW_CH[(Math.random() * FLOW_CH.length) | 0]
            : FLOW_TAIL[Math.min(FLOW_TAIL.length - 1, Math.floor(k * FLOW_TAIL.length))];
        }
      }
      flowDraw();
    }

    function flowTick(now) {
      if (!flow || flowOff) return;
      requestAnimationFrame(flowTick);
      if (now - FL.last < 80) return;                 /* ≈12fps */
      FL.last = now;
      flowStep();
    }
    var flowOff = !!opt.reduced;
    var flowStart = function () {
      if (!flow) return;
      flowMeasure();
      requestAnimationFrame(flowTick);
      /* ★★★ 字体一加载完必须【重量一次】:首帧量到的是回退字体的字宽
         (实测 5.93px/字),而真字体更宽 ⇒ 按 269 列排出来的行比 <pre> 宽,
         右边整片被裁掉 —— 这就是"乱流只在左半边"的根因。 */
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { flowMeasure(); });
      }
      setTimeout(flowMeasure, 400);
      setTimeout(flowMeasure, 1200);
    };

    var rt = 0, rt2 = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 140);
      if (flow) { clearTimeout(rt2); rt2 = setTimeout(flowMeasure, 200); }
    }, { passive: true });

    var api = {
      el: pre,
      resize: measure,
      fitTo: fitTo,
      anchor: anchor,
      setGaze: setGaze,
      lookAt: lookAt,
      centerGaze: centerGaze,
      glitch: function (on) { glitch = on ? 1 : 0; glitchNext = 0; if (!on) pre.classList.remove("is-glitch"); },
      isOpen: function () { return phase === PH.IDLE; },
      running: function () { return rafOn; },
      /* start(openOnStart):从"一条线"开始播完整出场 */
      start: function (openOnStart) {
        openedOnce = false;
        closedDone = false;
        measure();
        if (flow) flowStart();
        if (!openOnStart) { phase = PH.SHUT; openVal = OPEN_LINE; }
        else { phase = PH.BOOT; openVal = OPEN_LINE; phaseAt = performance.now(); }
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
      },
      /* openNow():跳过出场,直接睁着(回访/调试用)*/
      openNow: function () {
        measure();
        if (flow) flowStart();
        phase = PH.IDLE; phaseAt = performance.now(); openVal = 1;
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
        onOpened();
      },
      /* close(cb):缓缓闭合(闭到底再回调) */
      close: function (cb) {
        closeCb = cb || null;
        closedDone = false;
        phase = PH.CLOSING;
        phaseAt = performance.now();
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
        /* 兜底:万一动画循环没跑起来(标签页被挂起等),T_CLOSE+900ms 强制回调 */
        setTimeout(function () {
          if (closeCb === cb && cb) { var f = closeCb; closeCb = null; f(); }
        }, T_CLOSE + 900);
      },
      closed: function () { return closedDone; },
      T_CLOSE: T_CLOSE,
      state: function () { return window.__startEye || null; },
      /* 停掉整个渲染循环(引导结束、要彻底安静时用)*/
      stop: function () { rafOn = false; flowOff = true; }
    };
    return api;
  }

  window.AsciiEye = { create: create, RAMP: RAMP };
})();
