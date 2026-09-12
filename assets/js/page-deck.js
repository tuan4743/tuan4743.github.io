/* ============================================================
   第一张盘「自我」的主页内容:滑动分页(.deck,样式见 pages.css)
   ─────────────────────────────────────────────────────────────
   阻尼(轻柔、只为更丝滑):
     · 滚轮 / 拖拽 / 方向键改的都是【目标位置 target】
     · 渲染位置每帧向它逼近 —— 但用的是与帧率无关的写法:
         pos += (target - pos) × (1 - e^(-dt/TAU))
       TAU 就是"阻尼时间常数"(CSS 变量 --deck-tau,默认 90ms):
       越小越跟手、越大越飘。比"每帧固定比例"好在 60Hz / 120Hz 上手感一致。
     · 不做任何吸附:视角停在哪就是哪,不必对齐到某一页
   淡入淡出(按"这一页在视口里露出多少"算,所以相邻两页才有意义):
     · 一页露出 ≥ --deck-k-hi(默认 62%)→ 不透明
       露出 ≤ --deck-k-lo(默认 6%)→ 完全透明,中间平滑过渡
     · 每页至少占 --deck-page(默认 0.8)个屏高 → 相邻页会露一条边,
       滚动时旧页淡出、新页淡入,看得见而且说得通
   性能:
     · 只有当前被选中的那一页跑 rAF;位置追上目标立刻停 → 静止时零开销
   ============================================================ */
(function () {
  "use strict";

  var EPS = 0.3;            /* 位置差小于这个就算到位(px)*/
  var WHEEL_LINE = 18;      /* deltaMode=1(按行滚)时一行算多少 px */
  var DRAG_K = 1.0;         /* 拖拽跟手度 */
  var FLING = 170;          /* 松手惯性:速度 × 这个值(px),上限见下 */
  var FLING_MAX = 700;
  var defaultTau = 90;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function num(el, name, dflt, lo, hi) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isFinite(v) && v >= lo && v <= hi ? v : dflt;
  }

  var decks = {};

  function build(deck) {
    var key = deck.getAttribute("data-deck") || "";
    var track = deck.querySelector(".deck-track");
    if (!track) return null;
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".deck-slide"));
    var dots = Array.prototype.slice.call(deck.querySelectorAll(".deck-dot"));
    var bar = deck.querySelector(".deck-progress > i");

    var tau = defaultTau, pageK = 0.8, kLo = 0.06, kHi = 0.62, gapK = 0.10;
    function readCfg() {
      tau = num(deck, "--deck-tau", defaultTau, 10, 600);
      pageK = num(deck, "--deck-page", 0.8, 0.2, 2);
      kLo = num(deck, "--deck-k-lo", 0.06, 0, 1);
      kHi = num(deck, "--deck-k-hi", 0.62, 0, 1);
      gapK = num(deck, "--deck-gap-y", 0.10, 0, 1);
      if (kHi <= kLo) kHi = kLo + 0.2;
    }
    readCfg();

    var pos = 0, target = 0, raf = 0, last = 0;
    var active = false, dragging = false, dragY = 0, dragT = 0, dragV = 0;

    function vh() { return deck.clientHeight; }
    function maxPos() { return Math.max(0, track.scrollHeight - vh()); }

    /* 每一页的"停靠位置"(方向键 / 页码点用;不是限制,只是跳转目标)*/
    function stops() {
      var out = [], m = maxPos();
      for (var i = 0; i < slides.length; i++) out.push(clamp(slides[i].offsetTop, 0, m));
      return out;
    }
    function nearestIndex(v) {
      var s = stops(), best = 0, bd = 1e9;
      for (var i = 0; i < s.length; i++) {
        var d = Math.abs(s[i] - v);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }

    function paint() {
      var h = vh();
      track.style.transform = "translate3d(0," + (-pos).toFixed(2) + "px,0)";
      if (h > 1) {
        /* ★ 一页的高度写成 px:CSS 里 min-height:100% 解析不出来
           (百分比相对的是 .deck-track,而它是 auto)。--deck-page < 1 时
           相邻两页会互相露一条边 —— 淡入淡出就是在这条边上发生的。
           页与页之间再留 --deck-gap-y(默认 0.1 个屏高)的间隔,让两页"分得开" */
        var need = Math.round(h * pageK) + "px";
        var gapPx = Math.round(h * gapK) + "px";
        for (var q = 0; q < slides.length; q++) {
          if (slides[q].style.minHeight !== need) slides[q].style.minHeight = need;
          var mb = q === slides.length - 1 ? "0px" : gapPx;
          if (slides[q].style.marginBottom !== mb) slides[q].style.marginBottom = mb;
        }
        var vt = pos, vb = pos + h, best = 0, bd = 1e9;
        for (var i = 0; i < slides.length; i++) {
          var s = slides[i];
          var top = s.offsetTop, sh = s.offsetHeight || 1;
          var vis = Math.min(top + sh, vb) - Math.max(top, vt);      /* 与视口重叠的高度 */
          var f = vis <= 0 ? 0 : Math.min(1, vis / sh);              /* 露出比例 0~1 */
          var k = clamp((f - kLo) / (kHi - kLo), 0, 1);
          k = k * k * (3 - 2 * k);                                   /* smoothstep */
          s.style.setProperty("--k", k.toFixed(3));
          var d = Math.abs((top + sh / 2) - (pos + h / 2));
          if (d < bd) { bd = d; best = i; }
        }
        for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("is-on", j === best);
      }
      if (bar) {
        var m = maxPos();
        /* 每页高度写下去之后可滚动范围会变,这里顺手把目标拉回合法区间 */
        if (target > m) target = m;
        if (pos > m) pos = m;
        bar.style.width = (m > 0 ? (pos / m) * 100 : 100).toFixed(2) + "%";
      }
    }

    function frame(now) {
      raf = 0;
      var dt = Math.min(64, Math.max(1, now - last));   /* 卡顿时别一次补太多 */
      last = now;
      var d = target - pos;
      if (Math.abs(d) < EPS) { pos = target; paint(); return; }   /* 追上就停 rAF */
      pos += d * (1 - Math.exp(-dt / tau));    /* 与帧率无关的阻尼 */
      paint();
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (raf || !active) return;
      last = performance.now();                /* 起手这一帧也要有真实的 dt(否则第一帧原地不动)*/
      raf = requestAnimationFrame(frame);
    }

    function setTarget(v) { target = clamp(v, 0, maxPos()); kick(); }
    function touched() { if (!deck.classList.contains("is-touched")) deck.classList.add("is-touched"); }
    function goto(i) {
      var s = stops();
      setTarget(s[clamp(i, 0, s.length - 1)]);
      touched();
    }

    /* ---------- 输入:只改目标位置,不做吸附 ---------- */
    function onWheel(e) {
      if (!active) return;
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= WHEEL_LINE;
      else if (e.deltaMode === 2) d *= (vh() || 600);
      e.preventDefault();
      touched();
      setTarget(target + d);
    }
    function onDown(e) {
      if (!active || e.button) return;
      dragging = true;
      dragY = e.clientY;
      dragT = performance.now();
      dragV = 0;
      deck.classList.add("is-drag");
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!dragging) return;
      var now = performance.now();
      var dy = e.clientY - dragY;
      var dt = Math.max(1, now - dragT);
      dragV = dragV * 0.7 + (dy / dt) * 0.3;          /* 平滑一下速度,用于松手惯性 */
      dragY = e.clientY;
      dragT = now;
      touched();
      setTarget(target - dy * DRAG_K);
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      deck.classList.remove("is-drag");
      /* 松手带一点惯性:速度越大滑得越远,但仍有阻尼拖着,不会飞出去 */
      if (Math.abs(dragV) > 0.02) setTarget(target - clamp(dragV * FLING, -FLING_MAX, FLING_MAX));
      dragV = 0;
    }
    function onKey(e) {
      if (!active) return;
      var k = e.key;
      if (k === "ArrowDown" || k === "PageDown") { e.preventDefault(); goto(nearestIndex(target) + 1); }
      else if (k === "ArrowUp" || k === "PageUp") { e.preventDefault(); goto(nearestIndex(target) - 1); }
      else if (k === "Home") { e.preventDefault(); goto(0); }
      else if (k === "End") { e.preventDefault(); goto(slides.length - 1); }
    }
    deck.addEventListener("wheel", onWheel, { passive: false });
    deck.addEventListener("pointerdown", onDown);
    deck.addEventListener("pointermove", onMove);
    deck.addEventListener("pointerup", onUp);
    deck.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    for (var q = 0; q < dots.length; q++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          if (active) goto(parseInt(btn.getAttribute("data-goto"), 10) || 0);
        });
      })(dots[q]);
    }

    return {
      key: key,
      activate: function (on) {
        if (on === active) {
          if (on) { readCfg(); target = clamp(target, 0, maxPos()); pos = target; paint(); }
          return;
        }
        active = on;
        if (on) {
          readCfg();
          target = clamp(target, 0, maxPos());
          pos = target;                     /* 重新显示时不要从别处滑过来 */
          paint();
          kick();
        } else {
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          dragging = false;
          last = 0;
        }
      },
      repaint: function () {
        if (!active) return;
        readCfg();
        target = clamp(target, 0, maxPos());
        pos = clamp(pos, 0, maxPos());
        paint();
      },
      /* 调试 / 验收用 */
      state: function () {
        return {
          key: key, active: active,
          pos: +pos.toFixed(2), target: +target.toFixed(2),
          max: +maxPos().toFixed(2), tau: tau, page: pageK
        };
      }
    };
  }

  /* 注册给核心(见 pages.js):"哪张盘被选中"和 resize 重排都由核心统一管 */
  if (window.CDPages && window.CDPages.register) window.CDPages.register("deck", build);
})();
