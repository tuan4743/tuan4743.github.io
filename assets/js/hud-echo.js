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

   这个文件干两件事:

   ① 【眼睛跟着鼠标】—— 整只镜头朝鼠标方向偏最多 MAX_EYE 个 viewBox 单位,
      瞳孔再多偏 MAX_PUPIL(视差)。rAF 节流,pointermove 用 passive。
      ★★ 中心的算法是关键:【不能】读镜头自己的 getBoundingClientRect() ——
         它已经被我们平移过了,拿它算 = 自己追自己,会一路漂到角落。
         这里改成读【节点那层 div】的方框(.proj-node 自己不动),
         再按 viewBox 的比例(56/168)反推镜头中心。
      ★ 系统开了"减少动态效果"就整个不追(镜头停在正中间)。

   ② 【说话】—— 稀疏。三条闸门叠在一起:
        · 每个触发一个会话只响一次(sessionStorage,跨页面也记得)
        · 全局冷却 20 秒
        · 每句话还要在屏幕上停够时间才收(按字数算)
      所以一整场下来最多五六句 —— 不会变成一个碎嘴的描述框。
      ★ 触发器一律用【文档级委托】,不去改 hud-left.js / hud-timer.js / page-hud.js:
        它们不需要知道 ECHO 存在。
   ============================================================ */
(function () {
  "use strict";

  var node = document.querySelector(".proj-node");
  var eye = document.getElementById("pn-eye");
  var pupil = document.getElementById("pn-pupil");
  var bubble = document.getElementById("echo-say");
  var textEl = document.getElementById("echo-say-text");
  if (!node || !bubble || !textEl) return;      /* 首页/没有这一层:静默退出 */

  /* ---------- ① 眼睛跟着鼠标 ---------- */
  var VB = 168;            /* viewBox 边长(markup 里写死的) */
  var EYE_AT = 56;         /* 镜头中心的 viewBox 坐标(cx=cy=56) */
  var MAX_EYE = 6;         /* 整只镜头最多偏多少(viewBox 单位) */
  var MAX_PUPIL = 3;       /* 瞳孔再多偏多少(视差) */
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
    window.addEventListener("resize", function () { if (eye) eye.removeAttribute("transform"); if (pupil) pupil.removeAttribute("transform"); look(AXIS_X, AXIS_Y); });
  }

  /* ---------- ② 说话 ---------- */
  var COOL = 20000;        /* 两句之间至少隔这么久 */
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
    ]
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

  function say(key) {
    var pool = LINES[key];
    if (!pool || !pool.length) return false;
    var now = Date.now();
    var said = get("echo-said", "");
    if (said.indexOf("|" + key + "|") >= 0) return false;         /* 这个触发本场说过了 */
    if (now - Number(get("echo-last", "0")) < COOL) return false; /* 冷却中 */
    set("echo-said", said + "|" + key + "|");
    set("echo-last", String(now));

    var line = pool[Math.floor(Math.random() * pool.length)];
    textEl.textContent = line;
    bubble.classList.add("is-on");
    if (hideTimer) clearTimeout(hideTimer);
    /* 停多久按字数算:12 个字大约 5.2 秒,长句再多给一点,最多 9 秒 */
    hideTimer = setTimeout(hide, Math.min(9000, 4200 + line.length * 90));
    return true;
  }

  /* 触发一:进站。晚一点再说 —— 页面刚出来时别跟别的东西抢注意力。 */
  setTimeout(function () { say("arrive"); }, 1900);

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
    var on = false;
    var obs = new MutationObserver(function () {
      var pens = document.querySelectorAll("[data-hud-pen].is-on");
      var now = pens.length > 0;
      if (now && !on) say("pen");      /* 只在"从没拿笔 → 拿起笔"那一下说 */
      on = now;
    });
    [].forEach.call(document.querySelectorAll("[data-hud-pen]"), function (p) {
      obs.observe(p, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* 排障出口 */
  window.__echo = {
    say: say,
    hide: hide,
    line: function () { return textEl.textContent; },
    on: function () { return bubble.classList.contains("is-on"); },
    eyes: function () {
      return { eye: eye ? eye.getAttribute("transform") : null, pupil: pupil ? pupil.getAttribute("transform") : null };
    },
    still: still
  };
})();
