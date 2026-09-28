/* ============================================================
   侧边目录(进度条 + 目录面板 + 收起 + 字号/字距)
   ─────────────────────────────────────────────────────────────
   用户原话:"加一个侧边目录,就放在内容页和侧边栏的中间"。
   这块东西是 HUD 的一部分(定位、配色、字体全部沿用 page-hud.css 那一套),
   但逻辑独立,所以单开一个文件 —— 和 page-hud.js 一样挂在 extend_footer 里。

   它干四件事:
     ① 阅读进度:滚到哪、那条竖线上的光点走到哪(只跟【正文】算,不算整页)
     ② 当前小节:离视口上沿最近的那个标题高亮,自动滚进面板可视区
     ③ 收起/展开:点页签把面板 max-width 收到 0,页签自己滑到面板右缘
     ④ 字号/字距:只调【目录自己】的字,存 localStorage
   ★ 拿不到 DOM 时全部静默退出(列表页/首页没有这块,不能报错)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("hud-toc");
  if (!root) return;
  var panel = document.getElementById("hud-toc-panel");
  var toggle = document.getElementById("hud-toc-toggle");
  var prog = root.querySelector(".hud-toc__prog");
  var thumb = root.querySelector(".hud-toc__prog-thumb");
  var list = root.querySelector(".hud-toc__list");
  var items = [].slice.call(root.querySelectorAll(".hud-toc__item"));
  var sizeVal = document.getElementById("hud-toc-size-val");
  if (!panel || !items.length) return;

  /* 正文容器:PaperMod 是 <main class="main">。进度条只跟它算 ——
     标题带、页脚、上下篇导航都不该算进"这篇文章读了多少"。 */
  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;

  /* ============================================================
     ① 位置:量出来,不要猜
     ─────────────────────────────────────────────────────────────
     用户第二轮:"这个位置明显就不对啊,遮住了内容页"。
     真原因:正文是 --main-width(720px)【居中】的,它的右缘在视口里的
     百分比随窗口宽度变(1920 宽 ⇒ 68.7%,1416 宽 ⇒ 70.4%),而竖栏永远在
     右边 5vw —— 中间那条缝不但窄,还在移动。我第一版把面板左缘写死 73%,
     窗口一窄就压到正文上去了。
     ⇒ 读三个真实数值:正文右缘、竖栏左缘、视口宽,然后:
          进度条   = 正文右缘 + 12px
          面板左缘 = 进度条 + 18px
          面板宽   = 一直撑到竖栏左边(留 6px)
        缝太窄(<168px)就整块不显示 —— 宁可没有,也不能压住正文。
     ============================================================ */
  var GAP_BAR = 12;      /* 进度条离正文右缘 */
  var GAP_PANEL = 18;    /* 面板离进度条 */
  var GAP_NAV = 6;       /* 面板离竖栏 */
  var MIN_W = 168;       /* 比这窄就别显示了 */
  var MAX_W = 400;       /* 太宽也难看(宽屏上缝会很大) */
  /* 面板高度:按可用宽度定比例(卡片不能又窄又长),再夹到视口高度的 56% 以内。
     ★ 用户第三轮:"怎么这个卡片没有居中对齐?" —— 面板和进度条的高度原来各用
       一个整页百分比,谁也没对齐谁;现在两个高度都取这一个数,并且共用同一个
       垂直中心(.hud-toc 是 flex + align-items:center)。 */
  var H_RATIO = 2.4, H_MIN = 300, H_MAX_VH = 0.56;
  var lastSig = "";     /* 上一次真正写下去的几何签名 */
  var last = null;      /* 量到的中间值,排障出口用 */

  function layout() {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var mr = main.getBoundingClientRect().right;
    var nav = document.querySelector(".hud-nav");
    var navLeft = nav ? nav.getBoundingClientRect().left : vw * 0.94;
    var bar = mr + GAP_BAR;
    var left = bar + GAP_PANEL;
    var gap = Math.round(navLeft - GAP_NAV - left);    /* 这条缝真正能用的宽 */
    var w = Math.min(MAX_W, gap);
    var h = Math.round(Math.max(H_MIN, Math.min(w * H_RATIO, vh * H_MAX_VH)));
    last = { vw: vw, vh: vh, mr: Math.round(mr), navLeft: Math.round(navLeft), left: Math.round(left), gap: gap, w: w, h: h };

    /* ★★ 守卫【不能】只看"宽度有没有变":同一个宽度下几何可能已经变了
       (1700 宽时 345px 可以对应 left=1264 也可以对应 left=1277,
        后者就会把面板右缘压到导航上)—— 所以按【几何签名】比。
       也【不能】写成"视口没变就整个跳过":视口没变、正文右缘和竖栏左缘变了
       (字体/图标加载完)同样要重算,否则旧值一直留着。 */
    root.classList.toggle("is-tight", !(w >= MIN_W));
    var sig = [Math.round(vw), Math.round(vh), Math.round(mr), Math.round(navLeft)].join("|");
    if (sig !== lastSig) {
      /* ★ 单位只用 px,不掺百分比:left: calc(73.294% - 74.353% + 18px)
         我以为是 18px − 18px = 0,浏览器算出来是 +13.375px
         (百分比和像素在 calc 里不通用)。三个 x 全部用相对视口的 px 写死。
         ★ 即使缝太窄(面板已经隐藏)也照样写:留着一组过期数字,
           排查的时候会看到"CSS 说 244px、实际是别的",白费一轮。 */
      root.style.setProperty("--hud-toc-cx", mr + "px");
      root.style.setProperty("--hud-toc-lane", bar + "px");
      root.style.setProperty("--hud-toc-x", left + "px");
      root.style.setProperty("--hud-toc-panel-w", w + "px");
      root.style.setProperty("--hud-toc-h", h + "px");
      /* 垂直中心:面板高 h,让它落在 [top, top+h] 正中 —— 顶带上沿(6%)以下、
         底带(94%)以上取中点。同时给上下留 3% 余量,别贴到折线上。 */
      var center = Math.max(0.06 + h / vh / 2 + 0.005, Math.min(0.94 - h / vh / 2 - 0.005, 0.5));
      root.style.setProperty("--hud-toc-y", ((center - h / vh / 2) * 100).toFixed(3) + "%");
      lastSig = sig;
    }
  }
  layout();
  /* ★ 再量两次:第一次跑在字体/图标就位之前,数值不是最终的 ——
     宽度一旦写错就会一直留着,所以必须重算。 */
  requestAnimationFrame(function () { layout(); });
  setTimeout(function () { layout(); }, 300);

  /* ---------- ④ 字号 / 字距(存 localStorage)---------- */
  var FS_MIN = 13, FS_MAX = 24, LS_MIN = 0, LS_MAX = 16;   /* 字距存 0~16,用时 /100 当 em */
  var KEY = "hud-toc-type";
  var fs = 15, ls = 3;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.fs === "number" && typeof saved.ls === "number") {
      fs = saved.fs; ls = saved.ls;
    }
  } catch (e) { /* 隐私模式读不到就算了,用默认值 */ }

  function applyType() {
    fs = Math.max(FS_MIN, Math.min(FS_MAX, fs));
    ls = Math.max(LS_MIN, Math.min(LS_MAX, ls));
    root.style.setProperty("--toc-fs", fs + "px");
    root.style.setProperty("--toc-ls", (ls / 100).toFixed(2) + "em");
    /* 读数写短一点(面板最窄只有 168px,写全 "15px/0.03em" 会被裁掉尾巴) */
    if (sizeVal) sizeVal.textContent = fs + "/" + ls;
    try { localStorage.setItem(KEY, JSON.stringify({ fs: fs, ls: ls })); } catch (e) {}
  }
  applyType();

  root.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-hud-toc-size],[data-hud-toc-track]") : null;
    if (!b) return;
    e.preventDefault();
    var d1 = b.getAttribute("data-hud-toc-size");
    var d2 = b.getAttribute("data-hud-toc-track");
    if (d1) fs += Number(d1);
    if (d2) ls += Number(d2);
    applyType();
  });

  /* ---------- ③ 收起 / 展开(暂留给导航栏,见下)----------
     ★★★ 用户第二轮第四条:"这个右滑的收起页我其实本意是想给导航栏的,
     收起导航栏可以让用户更专注。" ⇒ 目录这块的页签先停用(hud-toc.html 里
     给它加了 hidden),但代码留着 —— 导航栏那版直接复用这一套。 */
  function setOpen(on) {
    root.classList.toggle("is-collapsed", !on);
    if (toggle) {
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      toggle.title = on ? "收起目录" : "展开目录";
    }
  }
  if (toggle && !toggle.hidden) {
    toggle.addEventListener("click", function () {
      setOpen(root.classList.contains("is-collapsed"));
    });
    /* 进页面就先按"当前是展开的"写一次 aria-expanded / title */
    setOpen(!root.classList.contains("is-collapsed"));
  }

  /* ---------- ①② 进度 + 当前小节 ---------- */
  var activeId = null;
  var raf = 0;

  function measure() {
    var r = main.getBoundingClientRect();
    var top = r.top + window.pageYOffset;
    var span = Math.max(1, main.offsetHeight - window.innerHeight);
    var p = (window.pageYOffset - top) / span;
    return Math.max(0, Math.min(1, p));
  }

  function paint() {
    raf = 0;
    var p = measure();
    if (prog) prog.style.setProperty("--hud-toc-p", p.toFixed(4));
    if (thumb) thumb.style.setProperty("--hud-toc-p", p.toFixed(4));

    /* 当前小节 = 最后一个"已经越过视口上沿 1/3 处"的标题 */
    var line = window.innerHeight * 0.32;
    var best = items[0];
    for (var i = 0; i < items.length; i++) {
      var el = document.getElementById(items[i].getAttribute("data-hud-toc-id"));
      if (!el) continue;
      if (el.getBoundingClientRect().top <= line) best = items[i];
    }
    var id = best ? best.getAttribute("data-hud-toc-id") : null;
    if (id && id !== activeId) {
      activeId = id;
      items.forEach(function (a) { a.classList.toggle("is-current", a === best); });
      /* 把高亮那条滚进面板可视区(面板只有一屏高) */
      if (list) {
        var lr = list.getBoundingClientRect(), ar = best.getBoundingClientRect();
        if (ar.top < lr.top || ar.bottom > lr.bottom) {
          list.scrollTop += ar.top - lr.top - (lr.height - ar.height) / 2;
        }
      }
    }
  }

  function onScroll() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function onResize() {
    layout();
    onScroll();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  /* 正文/导航的宽度会因为字体加载、图片撑开、窗口缩放而变 ⇒ 都要重量一次。
     ★ 必须有这一条:启动时 layout() 是在字体和图标还没就位的时候跑的,
       那时量出来的缝不是最终的(实测 1700 宽下按旧值排版,面板右缘压住导航 7px)。 */
  if (window.ResizeObserver) {
    try {
      var ro = new ResizeObserver(function () { layout(); });
      if (main) ro.observe(main);
      var navEl = document.querySelector(".hud-nav");
      if (navEl) ro.observe(navEl);
    } catch (e) {}
  }

  /* 点条目:平滑滚过去(尊重用户的"减少动效")*/
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  items.forEach(function (a) {
    a.addEventListener("click", function (e) {
      var el = document.getElementById(a.getAttribute("data-hud-toc-id"));
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", "#" + a.getAttribute("data-hud-toc-id"));
    });
  });

  paint();

  /* 排障出口:和 window.__mc 一个套路 —— 线上自查靠它 */
  window.__hudToc = {
    items: items.length, p: function () { return measure(); },
    fs: function () { return fs; }, ls: function () { return ls; },
    collapsed: function () { return root.classList.contains("is-collapsed"); },
    tight: function () { return root.classList.contains("is-tight"); },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    /* 位置是量出来的,所以要能一眼看到量了啥(验收用) */
    box: function () {
      var r = root.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), vw: document.documentElement.clientWidth };
    },
    active: function () { return activeId; }
  };
})();
