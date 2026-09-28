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

  /* ---------- ④ 字号 / 字距(存 localStorage)---------- */
  var FS_MIN = 11, FS_MAX = 17, LS_MIN = 0, LS_MAX = 12;   /* 字距存 0~12,用的时候 /100 当 em */
  var KEY = "hud-toc-type";
  var fs = 12, ls = 4;
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
    if (sizeVal) sizeVal.textContent = fs + "px/" + (ls / 100).toFixed(2) + "em";
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

  /* ---------- ③ 收起 / 展开 ---------- */
  function setOpen(on) {
    root.classList.toggle("is-collapsed", !on);
    if (toggle) {
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      toggle.title = on ? "收起目录" : "展开目录";
    }
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setOpen(root.classList.contains("is-collapsed"));
    });
    /* ★ 真 bug(测试逮到的):以前只在【点击之后】才写 aria-expanded / title,
       刚打开页面时这两个都是空的 —— 屏幕阅读器读不出这块能收起来,
       鼠标悬停也没有提示。进页面就先按"当前是展开的"写一次。 */
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

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

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
    active: function () { return activeId; }
  };
})();
