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

  /* ============================================================
     取 DOM —— ★ 目录这一块【全部可选】,因为正文字号控件有两个家:
       · 文章页:目录面板里的两行(常规位置)
       · 其它页 / 目录被收掉时:HUD 左栏那枚胶囊 #hud-type(备用位置)
     用户第五轮之后从 CDP 扫描发现:面板在 1280 及以下会因缝太窄整块收掉,
     字号控件跟着消失 —— 而"方便用户调内容页"正是他要的东西。
     ⇒ 第一版这里写的是 if (!root) return; 加上 if (!panel || !items.length) return;,
       于是列表页(没有目录 DOM)连胶囊都不工作。现在改成:有哪块就做哪块的事。
     ============================================================ */
  var root = document.getElementById("hud-toc");
  var panel = root ? document.getElementById("hud-toc-panel") : null;
  var toggle = root ? document.getElementById("hud-toc-toggle") : null;
  var prog = root ? root.querySelector(".hud-toc__prog") : null;
  var thumb = root ? root.querySelector(".hud-toc__prog-thumb") : null;
  var items = root ? [].slice.call(root.querySelectorAll(".hud-toc__item")) : [];
  var sizeVal = document.getElementById("hud-toc-size-val");
  /* ★ 用户第五轮:"一个配文四个按钮,不知道具体哪个是哪个" ⇒ 两个读数各管一行 */
  var trackVal = document.getElementById("hud-toc-track-val");
  var typePill = document.getElementById("hud-type");
  var pillSizeVal = document.getElementById("hud-type-size-val");
  var pillTrackVal = document.getElementById("hud-type-track-val");

  /* 目录真的能用吗(有 DOM、有面板、有至少两个条目)—— 不能用的页面就靠备用胶囊 */
  var tocUsable = !!(root && panel && items.length);
  /* 点击委托挂在哪两个容器上 —— root(面板那四个按钮)和 typePill(备用胶囊)。
     ★ 两个都要挂:胶囊不在 root 里,只挂 root 的话胶囊上的点击不会冒泡上来。 */
  if (!root && !typePill) return;

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
  var MIN_W = 176;       /* 比这窄就别显示了。
                            ★ 176 而不是 168(第五轮从截图上看出来的):面板里
                              "字号 [−][+] 19px / 字距 [−][+] 0.003" 两行里最长的一行
                              ≈ 26 + 5 + 22 + 5 + 22 + 5 + 42 + 内边距 22 = 171px,
                              168 会让读数折行(浏览器把 "0.003" 按字符竖着排)。 */
  var MAX_W = 400;       /* 太宽也难看(宽屏上缝会很大) */
  /* 高度:先进 = 盒子总高(面板 + 下面那枚回到顶部),再由它算出面板高。
     ★ 用户第三轮:"怎么这个卡片没有居中对齐?" —— 面板和进度条的高度原来各用一个
       整页百分比,谁也没对齐谁;现在进度条高度直接取【面板高】这一个数,
       两者共用同一个垂直中心(.hud-toc 是 flex + align-items:center)。 */
  var H_RATIO = 2.4, H_MIN = 300, H_MAX_VH = 0.56;
  var TOP_H = 34;        /* 回到顶部那枚圆按钮的高 */
  var TOP_GAP = 10;      /* 它和面板之间的间距 */
  var BOX_PAD = 20;      /* 盒子上下各留 10px(见 CSS 的 padding) */
  var lastSig = "";     /* 上一次真正写下去的几何签名 */
  var last = null;      /* 量到的中间值,排障出口用 */

  function layout() {
    /* ★ 这一页没有目录 DOM(列表页/首页,或者标题太少没渲染)⇒ 没有几何可量,
       备用胶囊直接顶上,然后收工。不写这个 early return 的话下面
       root.classList 会抛错(而这一版之前是"整块 return 掉",胶囊也跟着没了)。 */
    if (!root) {
      if (typePill) typePill.hidden = false;
      return;
    }
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var mr = main.getBoundingClientRect().right;
    var nav = document.querySelector(".hud-nav");
    var navLeft = nav ? nav.getBoundingClientRect().left : vw * 0.94;
    var bar = mr + GAP_BAR;
    var left = bar + GAP_PANEL;
    var gap = Math.round(navLeft - GAP_NAV - left);    /* 这条缝真正能用的宽 */
    var w = Math.min(MAX_W, gap);
    var boxH = Math.round(Math.max(H_MIN, Math.min(w * H_RATIO, vh * H_MAX_VH)));   /* 盒子总高 */
    var panelH = boxH - TOP_H - TOP_GAP - BOX_PAD;                                  /* 面板自己的高 */
    last = { vw: vw, vh: vh, mr: Math.round(mr), navLeft: Math.round(navLeft), left: Math.round(left),
             gap: gap, w: w, boxH: boxH, panelH: panelH };

    /* ★★ 守卫【不能】只看"宽度有没有变":同一个宽度下几何可能已经变了
       (1700 宽时 345px 可以对应 left=1264 也可以对应 left=1277,
        后者就会把面板右缘压到导航上)—— 所以按【几何签名】比。
       也【不能】写成"视口没变就整个跳过":视口没变、正文右缘和竖栏左缘变了
       (字体/图标加载完)同样要重算,否则旧值一直留着。 */
    root.classList.toggle("is-tight", !(w >= MIN_W));

    /* ★★ 备用胶囊的显隐 —— 只在"目录这一块用不了"的时候才顶上:
         · 缝太窄(root 被加上 .is-tight,面板整个 display:none)
         · 或者干脆没有目录 DOM(列表页/首页:标题太少不渲染)
       有目录的时候不显示它:同一个控件不该在屏幕上出现两份。
       ★ 判据取的是【实测宽度】而不是"切了什么类" —— 类可能因为别的原因被切,
         而这里要回答的问题始终是"用户现在还能不能在目录里调字号"。
       ★★ 下半句是 CDP 扫描逼出来的:胶囊宽 218px,而正文左缘在 1200 的窗口上
         只有 216px ⇒ 再窄就没有它能站的地方了(硬要显示就是压住正文一角)。
         这种情况交给 CSS 里的 @media (max-width: 1239px){ display:none } ——
         那些窗口上"目录没有、胶囊也没有",和改之前一样,但至少不会压正文。
         为什么不用 JS 判:视口宽是个纯 CSS 事实,写在这里要多一个常量、
         还要跟 CSS 里的媒体查询对齐,两个数早晚会走散。 */
    if (typePill) typePill.hidden = (tocUsable && w >= MIN_W);
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
      root.style.setProperty("--hud-toc-h", boxH + "px");
      root.style.setProperty("--hud-toc-panel-h", panelH + "px");
      /* 垂直中心:盒子高 boxH,让它落在 [top, top+boxH] 正中 —— 顶带上沿(6%)以下、
         底带(94%)以上取中点。同时给上下留 0.5% 余量,别贴到折线上。 */
      var center = Math.max(0.06 + boxH / vh / 2 + 0.005, Math.min(0.94 - boxH / vh / 2 - 0.005, 0.5));
      root.style.setProperty("--hud-toc-y", ((center - boxH / vh / 2) * 100).toFixed(3) + "%");
      lastSig = sig;
    }
  }
  layout();
  /* ★ 再量两次:第一次跑在字体/图标就位之前,数值不是最终的 ——
     宽度一旦写错就会一直留着,所以必须重算。 */
  requestAnimationFrame(function () { layout(); });
  setTimeout(function () { layout(); }, 300);

  /* ============================================================
     ④ 字号 / 字距:★ 调的是【正文】,不是目录
     ─────────────────────────────────────────────────────────────
     用户第四轮:"我发现你这个字号怎么是调整这个目录页的,其实我想调整内容页的,
     方便用户。"
     ⇒ 这两个按钮改的是【文章正文】的字号/行距,目录自己的那组固定成用户挑好的
       (16px / 0.04em,见 hud-toc.css 的 --toc-fs / --toc-ls)。
     ★ 怎么改正文:不改 .post-content 自己的 font-size(它的声明带类名权重,
       直接改行内样式不好维护),而是在 :root 上写两个变量,由
       assets/css/extended/custom.css 里的 article-typography 段落消费:
           --article-fs / --article-lh
       这样"正文排版"只有一个开关,以后要接主题设置也方便。
     ★ 存 localStorage,和主题切换一个套路(下次打开还是你调好的大小)。
     ============================================================ */
  var FS_MIN = 14, FS_MAX = 22, FS_STEP = 1;
  var LS_MIN = 0, LS_MAX = 10;
  var KEY = "content-type";
  var fs = 17, ls = 0;          /* 17px 是 PaperMod 正文的默认字号 */
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.fs === "number" && typeof saved.ls === "number") {
      fs = saved.fs; ls = saved.ls;
    }
  } catch (e) { /* 隐私模式读不到就算了,用默认值 */ }

  function applyType() {
    fs = Math.max(FS_MIN, Math.min(FS_MAX, fs));
    ls = Math.max(LS_MIN, Math.min(LS_MAX, ls));
    var de = document.documentElement;
    de.style.setProperty("--article-fs", fs + "px");
    /* 行距跟着字号走:字越大,行距比例略收一点,免得一屏只剩几行 */
    de.style.setProperty("--article-lh", (1.72 - (fs - 17) * 0.03).toFixed(2));
    de.style.setProperty("--article-ls", (ls / 1000).toFixed(3) + "em");
    /* ★ 三个读数是【同一个值的三个显示位】:面板里的两行 + 备用胶囊上的两个。
       全都在这里写,不在别处各写一份 —— 上一版就是"面板有读数、胶囊没读数",
       窄屏上用户根本不知道当前字号是多少。 */
    if (sizeVal) sizeVal.textContent = fs + "px";
    if (trackVal) trackVal.textContent = (ls / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
    if (pillSizeVal) pillSizeVal.textContent = fs + "px";
    if (pillTrackVal) pillTrackVal.textContent = (ls / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
    try { localStorage.setItem(KEY, JSON.stringify({ fs: fs, ls: ls })); } catch (e) {}
  }
  applyType();

  /* ★★ 两处按钮、一份处理器 —— 但要挂在【两个容器】上,不能只挂 root:
     我第一版写的是 clickHost = root || typePill,以为"有 root 就挂 root"够了。
     错在:备用胶囊【不在 root 里面】(root 是 hud-toc 那块,胶囊是 .page-hud 的
     另一个子元素),所以点胶囊根本冒泡不到 root 上 —— 真浏览器里点它毫无反应,
     而假 DOM 的测试反而过了(那里我把点击直接派发给了 root)。
     ⇒ 现在是同一个 handler 分别 addEventListener 到 root 和 typePill 上。 */
  function onTypeClick(e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-hud-toc-size],[data-hud-toc-track]") : null;
    if (!b) return;
    e.preventDefault();
    var d1 = b.getAttribute("data-hud-toc-size");
    var d2 = b.getAttribute("data-hud-toc-track");
    if (d1) fs += Number(d1) * FS_STEP;
    if (d2) ls += Number(d2);
    applyType();
  }
  if (root) root.addEventListener("click", onTypeClick);
  if (typePill) typePill.addEventListener("click", onTypeClick);

  /* ---------- 回到顶部(用户第四轮:"左下角有一个圆的 go to top 按钮……
       这个按钮给他放到目录页下面靠内容页的地方吧")----------
     ★ 我们只画按钮和位置;滚动行为交给主题自己那套:点一下触发原按钮的 click,
       平滑滚动、URL 里的 #top 都由它处理,不重复实现。
     ★ 显隐也和主题同步:主题的脚本每帧给 #top-link toggle .hidden,
       我们把那个类映到自己这枚上(它就是"该不该出现"的唯一真相)。 */
  var topBtn = document.getElementById("hud-toc-top");
  var themeTop = document.getElementById("top-link");
  if (topBtn) {
    topBtn.addEventListener("click", function () {
      if (themeTop) themeTop.click();
      else window.scrollTo({ top: 0, behavior: "smooth" });
    });
    var syncTop = function () {
      var on = themeTop ? !themeTop.classList.contains("hidden") : window.pageYOffset > 200;
      topBtn.classList.toggle("is-on", on);
    };
    if (themeTop && window.MutationObserver) {
      try { new MutationObserver(syncTop).observe(themeTop, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    }
    window.addEventListener("scroll", syncTop, { passive: true });
    syncTop();
  }

  /* ---------- ③ 收起 / 展开(暂留给导航栏,见下)----------
     ★★★ 用户第二轮第四条:"这个右滑的收起页我其实本意是想给导航栏的,
     收起导航栏可以让用户更专注。" ⇒ 目录这块的页签先停用(hud-toc.html 里
     给它加了 hidden),但代码留着 —— 导航栏那版直接复用这一套。 */
  function setOpen(on) {
    if (!root) return;
    root.classList.toggle("is-collapsed", !on);
    if (toggle) {
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      toggle.title = on ? "收起目录" : "展开目录";
    }
  }
  if (toggle && !toggle.hidden && root) {
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
      var list = root.querySelector(".hud-toc__list");
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

  /* ★ 下面这些全部依赖目录 DOM 与正文几何 —— 列表页上它们没有意义,
     但 layout() 还是要跑(它负责把备用胶囊显出来)。 */
  if (tocUsable) {
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
  } else if (typePill) {
    /* 没有目录可用:备用胶囊直接顶上 */
    typePill.hidden = false;
  }

  /* 排障出口:和 window.__mc 一个套路 —— 线上自查靠它 */
  window.__hudToc = {
    items: items.length, p: function () { return measure(); },
    fs: function () { return fs; }, ls: function () { return ls; },
    /* ★ 这两个是【正文】的排版,不是目录的(用户第四轮要求) */
    article: function () {
      var de = document.documentElement;
      return {
        fs: de.style.getPropertyValue("--article-fs"),
        lh: de.style.getPropertyValue("--article-lh"),
        ls: de.style.getPropertyValue("--article-ls")
      };
    },
    tocType: function () {
      if (!root) return { fs: '', ls: '' };
      var cs = getComputedStyle(root);
      return { fs: cs.getPropertyValue("--toc-fs").trim(), ls: cs.getPropertyValue("--toc-ls").trim() };
    },
    collapsed: function () { return root ? root.classList.contains("is-collapsed") : null; },
    tight: function () { return root ? root.classList.contains("is-tight") : null; },
    /* ★ 备用胶囊(窄屏/列表页上的字号控件)现在顶上来了吗 */
    pill: function () { return typePill ? !typePill.hidden : null; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    /* 位置是量出来的,所以要能一眼看到量了啥(验收用) */
    box: function () {
      if (!root) return null;
      var r = root.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), vw: document.documentElement.clientWidth };
    },
    active: function () { return activeId; }
  };
})();
