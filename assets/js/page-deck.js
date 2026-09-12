/* ============================================================
   第一张盘「自我」的主页内容:滑动分页(.deck,样式见 pages.css)
   ─────────────────────────────────────────────────────────────
   阻尼怎么做的:
     · 滚轮 / 拖拽 / 方向键改的都是【目标位置 target】
     · 真正渲染的位置 pos 每帧向 target 逼近:pos += (target - pos) × DAMP
       → 有惯性、有尾随,不会跟着手指瞬移;DAMP 从 CSS 变量 --deck-damp 读
     · 输入停下 SNAP_MS 之后,再把 target 吸附到最近一页(所以它还是"分页")
   淡入淡出:
     · 每页按"离屏幕中心的距离"算一个 0~1 的 k,写进 CSS 变量 --k
       pages.css 用 opacity: var(--k) + 位移 —— 连续淡入淡出,不靠定时器
   性能:
     · 只有当前被选中的那一页(is-active)才跑 rAF;位置追上目标立刻停
       → 静止时零开销,不会因为放着不管一直烧 CPU
   ============================================================ */
(function () {
  "use strict";

  var SNAP_MS = 170;        /* 输入停下多久后吸附到最近一页 */
  var EPS = 0.35;           /* 位置差小于这个就算到位了(px)*/
  var WHEEL_LINE = 18;      /* deltaMode=1(按行滚)时,一行算多少 px */
  var DRAG_K = 1.15;        /* 拖拽比滚轮稍微跟手一点 */
  var defaultDamp = 0.16;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dampOf(el) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue("--deck-damp"));
    return v > 0 && v <= 1 ? v : defaultDamp;
  }

  var decks = {};

  function build(deck) {
    var key = deck.getAttribute("data-deck") || "";
    var track = deck.querySelector(".deck-track");
    if (!track) return null;
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".deck-slide"));
    var dots = Array.prototype.slice.call(deck.querySelectorAll(".deck-dot"));
    var bar = deck.querySelector(".deck-progress > i");
    var damp = dampOf(deck);

    var pos = 0, target = 0, raf = 0, snapT = 0;
    var active = false, dragging = false, dragY = 0;

    function maxPos() { return Math.max(0, track.scrollHeight - deck.clientHeight); }

    /* 每一页的"停靠位置":直接用它在轨道里的 offsetTop,页面高度不一样也不会错 */
    function stops() {
      var out = [], m = maxPos();
      for (var i = 0; i < slides.length; i++) out.push(clamp(slides[i].offsetTop, 0, m));
      return out;
    }
    function nearest(v) {
      var s = stops(), best = s.length ? s[0] : 0, bd = 1e9;
      for (var i = 0; i < s.length; i++) {
        var d = Math.abs(s[i] - v);
        if (d < bd) { bd = d; best = s[i]; }
      }
      return best;
    }

    function paint() {
      track.style.transform = "translate3d(0," + (-pos).toFixed(2) + "px,0)";
      var vh = deck.clientHeight;
      /* 高度量到 0(还没上屏/被隐藏)时不要算 --k:否则会把每一页都算成"离中心无限远"→ 全透明。
         这时保持 CSS 里的默认值 1(可见),等下一次有效的 paint 再算 */
      if (vh > 1) {
        /* ★ 每页至少一屏高:写成 px。
           CSS 里的 min-height:100% 解析不出来 —— 百分比是相对 .deck-track 的高度,
           而它是 auto(由内容撑),于是一页只有文字那么高,几页会挤在同一屏里。
           写 px 之后:短页占满一屏,长页照样能长出去(是 min-height 不是 height)*/
        var need = vh + "px";
        for (var q = 0; q < slides.length; q++) {
          if (slides[q].style.minHeight !== need) slides[q].style.minHeight = need;
        }
        var mid = pos + vh / 2;
        var best = 0, bd = 1e9;
        for (var i = 0; i < slides.length; i++) {
          var s = slides[i];
          var d = (s.offsetTop + s.offsetHeight / 2) - mid;
          var k = clamp(1 - Math.abs(d) / (vh * 0.82), 0, 1);
          k = k * k * (3 - 2 * k);                       /* smoothstep:淡入淡出更柔 */
          s.style.setProperty("--k", k.toFixed(3));
          if (Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
        }
        for (var j = 0; j < dots.length; j++) dots[j].classList.toggle("is-on", j === best);
      }
      if (bar) {
        var m = maxPos();
        bar.style.width = (m > 0 ? (pos / m) * 100 : 100).toFixed(2) + "%";
      }
    }

    function frame() {
      raf = 0;
      var d = target - pos;
      if (Math.abs(d) < EPS) { pos = target; paint(); return; }   /* 追上就停 rAF */
      pos += d * damp;
      paint();
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && active) raf = requestAnimationFrame(frame); }

    function setTarget(v) { target = clamp(v, 0, maxPos()); kick(); }
    function snapLater() {
      clearTimeout(snapT);
      snapT = setTimeout(function () { setTarget(nearest(target)); }, SNAP_MS);
    }
    function touched() { if (!deck.classList.contains("is-touched")) deck.classList.add("is-touched"); }
    function goto(i) {
      var s = stops();
      setTarget(s[clamp(i, 0, s.length - 1)]);
      touched();
    }
    function step(d) {
      var s = stops(), cur = 0, bd = 1e9;
      for (var i = 0; i < s.length; i++) {
        var dd = Math.abs(s[i] - target);
        if (dd < bd) { bd = dd; cur = i; }
      }
      goto(cur + d);
    }

    /* ---------- 输入 ---------- */
    function onWheel(e) {
      if (!active) return;
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= WHEEL_LINE;
      else if (e.deltaMode === 2) d *= (deck.clientHeight || 600);
      e.preventDefault();
      touched();
      setTarget(target + d);
      snapLater();
    }
    function onDown(e) {
      if (!active || e.button) return;
      dragging = true;
      dragY = e.clientY;
      deck.classList.add("is-drag");
      clearTimeout(snapT);
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!dragging) return;
      touched();
      setTarget(target - (e.clientY - dragY) * DRAG_K);
      dragY = e.clientY;
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      deck.classList.remove("is-drag");
      snapLater();
    }
    function onKey(e) {
      if (!active) return;
      var k = e.key;
      if (k === "ArrowDown" || k === "PageDown") { e.preventDefault(); step(1); }
      else if (k === "ArrowUp" || k === "PageUp") { e.preventDefault(); step(-1); }
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

    var api = {
      key: key,
      activate: function (on) {
        if (on === active) { if (on) { damp = dampOf(deck); target = clamp(target, 0, maxPos()); pos = target; paint(); } return; }
        active = on;
        if (on) {
          damp = dampOf(deck);
          target = clamp(target, 0, maxPos());
          pos = target;                     /* 重新显示时不要从别处滑过来 */
          paint();
          kick();
        } else {
          clearTimeout(snapT);
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          dragging = false;
        }
      },
      repaint: function () {
        if (!active) return;
        target = clamp(target, 0, maxPos());
        pos = clamp(pos, 0, maxPos());
        paint();
      },
      /* 调试/验收用 */
      state: function () {
        return { key: key, active: active, pos: +pos.toFixed(2), target: +target.toFixed(2), max: +maxPos().toFixed(2), damp: damp };
      }
    };
    return api;
  }

  function buildAll() {
    var list = document.querySelectorAll(".deck[data-deck]");
    for (var i = 0; i < list.length; i++) {
      var k = list[i].getAttribute("data-deck");
      if (!decks[k]) {
        var api = build(list[i]);
        if (api) decks[k] = api;
      }
    }
  }

  function activate(key) {
    buildAll();
    for (var k in decks) if (Object.prototype.hasOwnProperty.call(decks, k)) decks[k].activate(k === key);
  }

  window.CDPages = {
    activate: activate,
    repaint: function () { for (var k in decks) if (decks[k]) decks[k].repaint(); },
    decks: decks,
    state: function () {
      var out = {};
      for (var k in decks) out[k] = decks[k].state();
      return out;
    }
  };

  function boot() {
    buildAll();
    var on = document.querySelector(".intro-panel.is-active[data-panel]");
    if (on) activate(on.getAttribute("data-panel"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.addEventListener("resize", function () {
    for (var k in decks) if (decks[k]) decks[k].repaint();
  });
})();
