(function () {
  "use strict";

  var root = document.getElementById("hud-toc");
  var panel = root ? document.getElementById("hud-toc-panel") : null;
  var toggle = root ? document.getElementById("hud-toc-toggle") : null;
  var prog = root ? root.querySelector(".hud-toc__prog") : null;
  var thumb = root ? root.querySelector(".hud-toc__prog-thumb") : null;
  var items = root ? [].slice.call(root.querySelectorAll(".hud-toc__item")) : [];
  var sizeVal = document.getElementById("hud-toc-size-val");
  var trackVal = document.getElementById("hud-toc-track-val");
  var typePill = document.getElementById("hud-type");
  var pillSizeVal = document.getElementById("hud-type-size-val");
  var pillTrackVal = document.getElementById("hud-type-track-val");

  var tocUsable = !!(root && panel && items.length);
  if (!root && !typePill) return;

  var main = document.querySelector("main.main") || document.querySelector("main") || document.body;

  var GAP_BAR = 12;
  var GAP_PANEL = 18;
  var GAP_NAV = 6;
  var MIN_W = 176;       /* 比这窄就别显示了。
                            ★ 176 而不是 168(第五轮从截图上看出来的):面板里
                              "字号 [−][+] 19px / 字距 [−][+] 0.003" 两行里最长的一行
                              ≈ 26 + 5 + 22 + 5 + 22 + 5 + 42 + 内边距 22 = 171px,
                              168 会让读数折行(浏览器把 "0.003" 按字符竖着排)。 */
  var S = (function () {
    try {
      var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-s"));
      return isFinite(v) && v > 0 ? v : 1;
    } catch (e) { return 1; }
  })();
  var MAX_W = Math.round(400 * S);
  var H_RATIO = 2.4, H_MIN = 300, H_MAX_VH = 0.56;
  var TOP_H = 34;
  var TOP_GAP = 10;
  var BOX_PAD = 20;
  var lastSig = "";
  var last = null;

  function laneBox(vh) {
    var vw = document.documentElement.clientWidth;
    var mr = main.getBoundingClientRect().right;
    var nav = document.querySelector(".hud-nav");
    var navLeft = nav ? nav.getBoundingClientRect().left : vw * 0.94;
    var bar = mr + GAP_BAR;
    var left = bar + GAP_PANEL;
    var gap = Math.round(navLeft - GAP_NAV - left);
    var w = Math.min(MAX_W, gap);
    var boxH = Math.round(Math.max(H_MIN, Math.min(w * H_RATIO, vh * H_MAX_VH)));
    var center = Math.max(0.06 + boxH / vh / 2 + 0.005, Math.min(0.94 - boxH / vh / 2 - 0.005, 0.5));
    return { vw: vw, mr: Math.round(mr), navLeft: Math.round(navLeft), bar: bar, left: left,
             gap: gap, w: w, boxH: boxH, top: (center - boxH / vh / 2) * vh };
  }

  var PILL_W = 180;
  function pillWidth() {
    var w = typePill ? typePill.offsetWidth : 0;
    if (w) return w;
    var s = 1;
    try { s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hud-s")) || 1; } catch (e) { }
    return Math.round(PILL_W * s);
  }
  function placePill(lb) {
    if (!typePill) return;
    var pw = pillWidth();
    var lane = !!lb && lb.gap >= pw;
    typePill.classList.toggle("hud-type--lane", lane);
    typePill.style.left = lane ? Math.round(lb.left + lb.gap - pw) + "px" : "";
    typePill.style.top = lane ? Math.round(lb.top) + "px" : "";
  }

  function layout() {
    if (!root) {
      var lb0 = laneBox(document.documentElement.clientHeight);
      if (typePill) typePill.hidden = false;
      placePill(lb0);
      return;
    }
    var vh = document.documentElement.clientHeight;
    var lb = laneBox(vh);
    var vw = lb.vw, mr = lb.mr, navLeft = lb.navLeft, bar = lb.bar, left = lb.left;
    var gap = lb.gap, w = lb.w, boxH = lb.boxH;
    var panelH = boxH - TOP_H - TOP_GAP - BOX_PAD;
    last = { vw: vw, vh: vh, mr: mr, navLeft: navLeft, left: Math.round(left),
             gap: gap, w: w, boxH: boxH, panelH: panelH };

    root.classList.toggle("is-tight", !(w >= MIN_W));

    if (typePill) typePill.hidden = (tocUsable && w >= MIN_W);
    placePill(lb);
    var sig = [Math.round(vw), Math.round(vh), Math.round(mr), Math.round(navLeft)].join("|");
    if (sig !== lastSig) {
      root.style.setProperty("--hud-toc-cx", mr + "px");
      root.style.setProperty("--hud-toc-lane", bar + "px");
      root.style.setProperty("--hud-toc-x", left + "px");
      root.style.setProperty("--hud-toc-panel-w", w + "px");
      root.style.setProperty("--hud-toc-h", boxH + "px");
      root.style.setProperty("--hud-toc-panel-h", panelH + "px");
      root.style.setProperty("--hud-toc-y", ((lb.top / vh) * 100).toFixed(3) + "%");
      lastSig = sig;
    }
  }
  layout();
  requestAnimationFrame(function () { layout(); });
  setTimeout(function () { layout(); }, 300);

  var FS_MIN = 14, FS_MAX = 22, FS_STEP = 1;
  var LS_MIN = 0, LS_MAX = 10;
  var KEY = "content-type";
  var fs = 17, ls = 0;
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved.fs === "number" && typeof saved.ls === "number") {
      fs = saved.fs; ls = saved.ls;
    }
  } catch (e) { }

  function applyType() {
    fs = Math.max(FS_MIN, Math.min(FS_MAX, fs));
    ls = Math.max(LS_MIN, Math.min(LS_MAX, ls));
    var de = document.documentElement;
    de.style.setProperty("--article-fs", fs + "px");
    de.style.setProperty("--article-lh", (1.72 - (fs - 17) * 0.03).toFixed(2));
    de.style.setProperty("--article-ls", (ls / 1000).toFixed(3) + "em");
    if (sizeVal) sizeVal.textContent = fs + "px";
    if (trackVal) trackVal.textContent = (ls / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
    if (pillSizeVal) pillSizeVal.textContent = fs + "px";
    if (pillTrackVal) pillTrackVal.textContent = (ls / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
    try { localStorage.setItem(KEY, JSON.stringify({ fs: fs, ls: ls })); } catch (e) {}
  }
  applyType();

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
    setOpen(!root.classList.contains("is-collapsed"));
  }

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

  if (tocUsable) {
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  if (window.ResizeObserver) {
    try {
      var ro = new ResizeObserver(function () { layout(); });
      if (main) ro.observe(main);
      var navEl = document.querySelector(".hud-nav");
      if (navEl) ro.observe(navEl);
    } catch (e) {}
  }

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
    typePill.hidden = false;
  }

  window.__hudToc = {
    items: items.length, p: function () { return measure(); },
    fs: function () { return fs; }, ls: function () { return ls; },
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
    pill: function () { return typePill ? !typePill.hidden : null; },
    layout: function () { return last; },
    relayout: function () { layout(); return last; },
    box: function () {
      if (!root) return null;
      var r = root.getBoundingClientRect();
      return { left: Math.round(r.left), width: Math.round(r.width), vw: document.documentElement.clientWidth };
    },
    active: function () { return activeId; }
  };
})();
