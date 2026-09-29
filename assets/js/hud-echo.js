/* ============================================================
   ECHO —— 左上角那个三角形的副摄像头 + 它右边那个小对话框
   ─────────────────────────────────────────────────────────────
   用户第七轮:"看到左上角那个SVG画出的三角了吗?……那个就是 ECHO 的副摄像头
   (主摄像头就是平板本体)。访客在设定上其实就是这艘飞船(本博客)的锚点,
   由于未按时进行稳定,导致记忆缺失,所以理论上 ECHO 的语气是老朋友,
   但是这种事情发生太多次了(锚点忘记稳定),懒得关心。
   我想的是在它的右侧加一个小小的对话框就足够了,正好缺点东西。
   在进行某些交互时有反应。(触发别太密集,搞得跟一个描述框一样)
   那个三角里面的光点做出摄像头探头,放大,往右下角移一点。会跟着鼠标移动。"

   用户第八轮(特殊互动):"比如番茄钟一轮结束/没结束就暂停,笔形态时鼠标移到
   ECHO 上,读世界观档案里的某篇具体文章时一直点摄像头它会不情愿的给一点点提示。"

   这个文件干五件事:

   ① 【眼睛跟着鼠标】—— 整只镜头朝鼠标方向偏最多 MAX_EYE 个 viewBox 单位,
      瞳孔再多偏 MAX_PUPIL(视差)。rAF 节流,pointermove 用 passive。
      ★★ 中心的算法是关键:【不能】读镜头自己的 getBoundingClientRect() ——
         它已经被我们平移过了,拿它算 = 自己追自己,会一路漂到角落。
         这里改成读【节点那层 div】的方框(.proj-node 自己不动),
         再按 viewBox 的比例(56/168)反推镜头中心。
      ★ 系统开了"减少动态效果"就整个不追(镜头停在正中间)。

   ② 【说话】—— 稀疏。三道闸门叠着:
        · once 类触发:一个会话只响一次(sessionStorage,翻页也记得)
        · cool 类触发:隔几分钟才允许再说一次
        · 全局冷却 20 秒(标了 force 的急事可以跳过)
      所以一整场下来最多几句 —— 不会变成一个碎嘴的描述框。
      ★ 触发器一律用【文档级委托】+ 观察 CSS 变量,不去改 hud-left.js /
        hud-timer.js / page-hud.js:它们不需要知道 ECHO 存在。

   ③ 【番茄钟】一轮跑完 / 没跑完就停。hud-timer.js 不派事件,但它把状态写在
      :root 的 --hud-tomato-run / --hud-tomato-p 上,盯那两个变量就够。

   ④ 【笔激活时鼠标扫过镜头】→ "别画我。"

   ⑤ 【一直戳摄像头】→ 不情愿地把本页的提示吐出来(提示在 world/提示.md,
      经 sync-world.mjs 写进 archive.hint,再由 page-hud.html 挂到
      data-echo-hint 上)。换一篇重新数,所以每一篇都有自己的那一句。
   ============================================================ */
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
  if (!node || !bubble || !textEl) return;      /* 首页/没有这一层:静默退出 */

  /* ---------- ① 眼睛跟着鼠标 ---------- */
  var VB = 168;            /* viewBox 边长(markup 里写死的) */
  var EYE_AT = 56;         /* 镜头中心的 viewBox 坐标(cx=cy=56) */
  var MAX_EYE = 6;         /* 整只镜头最多偏多少(viewBox 单位) */
  var MAX_PUPIL = 3;       /* 瞳孔相对虹膜再多偏多少(视差;两个加起来才是总位移) */
  var REACH = 340;         /* 鼠标离到这么远,偏移就到头 */
  var AXIS_X = window.innerWidth / 2, AXIS_Y = window.innerHeight / 2;
  var raf = 0;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function move() {
    raf = 0;
    if (!eye) return;
    var r = node.getBoundingClientRect();
    if (!r.width) return;
    var k = r.width / VB;                        /* 1 个 viewBox 单位 = 多少 px */
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

  /* ---------- ② 说话 ---------- */
  var COOL = 20000;        /* 两句之间至少隔这么久(标了 force 的急事可以跳过) */
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
    /* —— 特殊互动(第八轮)—— */
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
    ]
  };
  /* 每个触发的规矩:
       once  一个会话只响一次
       cool  可重复的,隔这么久才允许说下一次
       force 说的时候跳过全局冷却(跑完一轮这种事不该被"刚说过话"挡掉) */
  var TRIG = {
    arrive: { once: true },
    archive: { once: true },
    music: { once: true },
    timer: { once: true },
    timerRun: { once: true },
    pen: { once: true },
    done: { once: true, force: true },
    /* ★ giveUp 和 hoverPen 都带 force:它们是"用户刚做了一件事"的即时反应 ——
       刚拿起笔就把鼠标扫过来,正是最自然的时机,被"20 秒内刚说过话"挡掉就废了。
       密度靠它们自己的 cool 管(3 分钟 / 1 分钟),够稀。 */
    giveUp: { cool: 180000, force: true },
    hoverPen: { cool: 60000, force: true }
  };

  /* sessionStorage:同一个会话里翻页也记得说过什么(localStorage 太长久 ——
     隔一个星期再来,该说的还是该说) */
  function get(k, d) { try { return sessionStorage.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { } }

  var hideTimer = 0;

  function hide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
    bubble.classList.remove("is-on");
  }

  /* 只负责把话说出来、停够时间再收(按字数算,最多 11 秒) */
  function show(line, holdMs) {
    textEl.textContent = line;
    bubble.classList.add("is-on");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, holdMs || Math.min(11000, 4200 + line.length * 90));
  }

  function say(key, opt) {
    var pool = LINES[key];
    if (!pool || !pool.length) return false;
    var cfg = TRIG[key] || {};
    var now = Date.now();
    var said = get("echo-said", "");
    if (cfg.once) {
      if (said.indexOf("|" + key + "|") >= 0) return false;          /* 本场说过了 */
    } else if (cfg.cool) {
      if (now - Number(get("echo-cool-" + key, "0")) < cfg.cool) return false;
      set("echo-cool-" + key, String(now));
    }
    if (!(opt && opt.force) && !cfg.force && now - Number(get("echo-last", "0")) < COOL) return false;
    if (cfg.once) set("echo-said", said + "|" + key + "|");
    set("echo-last", String(now));
    show(pool[Math.floor(Math.random() * pool.length)]);
    return true;
  }

  /* 触发一:进站。晚一点再说 —— 页面刚出来时别跟别的东西抢注意力。
     ★ 如果刚被它关过一次(上一轮强制重载留下的记号),就接一句 ——
       不然用户会觉得"黑屏完回来,它装没事人"。这一句走 show,绕过所有闸门。 */
  setTimeout(function () {
    var boAt = Number(get("echo-blackout", "0"));
    if (boAt && Date.now() - boAt < 25000) {
      set("echo-blackout", "0");
      return void show("……回来了。那玩意儿重启要三十秒。");
    }
    say("arrive");
  }, 1900);

  /* 触发二~四:点 HUD 上的东西。文档级委托(捕获阶段),
     所以即使别的模块 stopPropagation 也照样能听见。 */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-hud-mod="world"]')) return void say("archive");
    if (t.closest('[data-hud-mod="music"]')) return void say("music");
    if (t.closest('[data-hud-mod="timer"]')) return void say("timer");
    if (t.closest("#hud-timer-toggle")) return void say("timerRun");
  }, true);

  /* 触发五:拿笔。笔的开关是 page-hud.js 在 [data-hud-pen] 上切 .is-on ——
     直接盯那个类,比猜点到了哪个子元素准。 */
  if (window.MutationObserver) {
    var penOn = false;
    var obs = new MutationObserver(function () {
      var now = document.querySelectorAll("[data-hud-pen].is-on").length > 0;
      if (now && !penOn) say("pen");      /* 只在"从没拿笔 → 拿起笔"那一下说 */
      penOn = now;
    });
    [].forEach.call(document.querySelectorAll("[data-hud-pen]"), function (p) {
      obs.observe(p, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* ---------- ③ 番茄钟:跑完一轮 / 没跑完就停了 ----------
     hud-timer.js 不派事件,但它把状态写在 :root 的两个变量上:
         --hud-tomato-run  1 = 在跑,0 = 停着
         --hud-tomato-p    进度 0~1
     盯这两个变量就够,不用去改它。
     ★ 那台 MutationObserver 会被【任何】documentElement 的样式改动叫醒
       (换主题、调字号…),所以这里只看 run 的 1→0 那一跳,别的都不理。
     ★ 归零(重置)不吭声 —— 那是"重来",不是"放弃",别乱扣帽子。
       阈值取 0.0005:render() 把进度写成 toFixed(4),所以"重置"就是 0.0000,
       而跑了 1 秒也是 0.0007 —— 用 0.02(≈30 秒)会把"刚开就反悔"漏掉。 */
  var lastRun = null;
  function watchTimer() {
    var run = docEl.style.getPropertyValue("--hud-tomato-run").trim();
    var p = parseFloat(docEl.style.getPropertyValue("--hud-tomato-p")) || 0;
    if (lastRun === null) { lastRun = run; return; }   /* 第一次读到的是上一页留下的状态 */
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

  /* ---------- ④ 笔激活时鼠标扫过镜头 ---------- */
  if (hot) {
    hot.addEventListener("pointerenter", function () {
      if (document.querySelector("[data-hud-pen].is-on")) say("hoverPen");
    });
  }

  /* ---------- ⑤ 一直戳摄像头:先是语库随机,然后威胁,最后真的关掉 ----------
     用户第八轮:"话的种类有点少,来回点就三句,我觉得前两句可以在一个语库中随机抽,
     比如:'我统计你一共看过 76131 遍了(数字可以随机,至少五位数),怎么就记不住……'
     '……怎么记忆缺失了学习也跟着缺失了?'……加多了可以触发:
     '……再点我就把你的带宽共识协议关掉',接着点就会真的黑屏然后重进网站。"

     阶梯(按本页的点击数):
       1~2   语库 A —— 不耐烦,随机抽
       3     提示(world/提示.md 里那一句;"……行吧。就一句:")
       4~5   语库 B —— "说过了"
       6     威胁:"……再点我就把你的带宽共识协议关掉。"
       7     语库 C —— 最后通牒
       8+    真的关掉:黑屏 1.6 秒 → location.reload()
     ★ 计数按【页面】存:换一篇重新数,所以每一篇都有自己的那一句提示。
     ★ 这一条【不走】全局冷却 —— 不然连点四下要等一分多钟,那就不叫"一直戳"了;
       改成 700ms 节流,手速再快也看得清一句一句往外蹦。
     ★ {n} 会被换成一个五到六位的随机数 —— 那个统计本来就是 ECHO 现编的。 */
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
  var POKE_END = 8;        /* 第几下真的关 */

  function pick(pool) {
    return pool[Math.floor(Math.random() * pool.length)]
      .replace("{n}", String(10000 + Math.floor(Math.random() * 989999)));
  }

  /* 真的关掉:HUD 那行字淡进来 → 停一下 → 重进网站 */
  function blackout() {
    var el = document.getElementById("echo-black");
    set("echo-poke:" + location.pathname, "0");   /* 重进之后从第一下重新数 */
    set("echo-blackout", String(Date.now()));     /* 回来时好接一句 */
    set("echo-last", String(Date.now()));
    hide();
    if (!el) { location.reload(); return; }
    /* ★ 顺手把文档的滚动条按住:黑幕是 position:fixed 铺满视口的,
       可滚动条画在视口外面 ⇒ 右边会留一条亮边,黑屏就不黑了(实测截到过)。 */
    docEl.style.overflow = "hidden";
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add("is-on"); });
    /* 1.6 秒:够看完那两行字,又不至于让人以为页面死了 */
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

  /* 排障出口 */
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
