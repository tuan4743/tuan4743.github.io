/* ============================================================
   三支笔:荧光笔 / 记号笔 / 橡皮擦 —— 真的能画
   ─────────────────────────────────────────────────────────────
   用户:"把右下角那两只笔一个橡皮实现了.一直拖到现在."

   为什么单独一个文件:笔的【外观与交互】一直住在 page-hud.js(选笔、滑条、色点、
   光标形态),而"落笔"是另一码事 —— 一块覆盖正文的 canvas + 笔画数据。
   分开之后 page-hud.js 不用长出几百行,而且这段可以单独读、单独测。

   ★ 画布是【文档坐标】的:钉在正文那一块上,跟着页面滚 ⇒ 画的线永远贴着那行字,
     不会"滚一下就跑"。位置/尺寸由 layout() 按正文的实际盒子算(和目录那块同规矩:
     只在 px 里算,百分比猜不得)。
   ★ 笔画存成矢量(点数组)而不是只留位图:换窗口/换字号重排之后能重画一遍,
     而且"清空"就是把这个数组清掉。
   ★ 什么时候能画:【有笔选中】才画 —— 没选笔时画布 pointer-events:none,
     正文照常选中/点链接(这是用户第五轮踩过的那条:整层不能吃点击)。
   ★ 清空:有笔选中时右键(菜单被我们接管)—— 弹一句提示,不做没有反馈的操作。
   ============================================================ */
(function () {
  "use strict";

  var HUD = document.getElementById("page-hud");
  if (!HUD) return;
  var main = document.querySelector("main.main") || document.querySelector("main");
  if (!main || !main.getBoundingClientRect) return;

  var canvas = document.createElement("canvas");
  canvas.className = "hud-ink";
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;z-index:95;pointer-events:none;touch-action:none";
  var ctx = canvas.getContext ? canvas.getContext("2d") : null;
  if (!ctx) return;
  document.body.appendChild(canvas);

  var strokes = [];          /* [{pen, color, size, pts:[[x,y],…]}] 文档坐标(CSS px) */
  var cur = null;            /* 正在画的这一笔 */
  var box = { x: 0, y: 0, w: 1, h: 1 };
  var dpr = 1;
  var drawing = false;

  /* 笔的参数:粗细/透明度/合成方式。粗细跟着那支笔自己的滑条(1~24)。 */
  function penCfg(name) {
    var el = document.querySelector('[data-hud-pen="' + name + '"]');
    var input = document.querySelector('[data-hud-pen-size="' + name + '"]');
    var size = input ? parseFloat(input.value) : 8;
    if (!isFinite(size)) size = 8;
    var color = "#eaf3ff";
    if (el && window.getComputedStyle) {
      var v = window.getComputedStyle(el).getPropertyValue("--pen-color");
      if (v && v.trim()) color = v.trim();
    }
    if (name === "marker") return { color: color, w: Math.max(8, size * 2.4), alpha: 0.3, op: "source-over" };
    if (name === "eraser") return { color: "#000", w: Math.max(10, size * 1.8), alpha: 1, op: "destination-out" };
    return { color: color, w: Math.max(1, size * 0.6), alpha: 1, op: "source-over" };   /* 记号笔 */
  }

  function activePen() {
    var on = document.querySelector("[data-hud-pen].is-on");
    return on ? on.getAttribute("data-hud-pen") : null;
  }

  /* 有笔选中才接管指针;顺带把光标那层也告诉一声(它自己会换成 × 或圆框) */
  function syncMode() {
    var pen = activePen();
    canvas.style.pointerEvents = pen ? "auto" : "none";
    document.documentElement.classList.toggle("hud-ink-on", !!pen);
    return pen;
  }

  function layout() {
    var r = main.getBoundingClientRect();
    var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    box.x = Math.round(r.left + sx);
    box.y = Math.round(r.top + sy);
    box.w = Math.max(1, Math.round(r.width));
    box.h = Math.max(1, Math.round(Math.max(r.height, main.scrollHeight || 0)));
    /* 长文章就把倍率降到 1:画布面积 ×4 是内存,别为了清晰把标签页拖垮 */
    var want = window.devicePixelRatio || 1;
    dpr = (box.w * box.h > 3.2e6) ? 1 : Math.min(2, want);
    canvas.width = Math.round(box.w * dpr);
    canvas.height = Math.round(box.h * dpr);
    canvas.style.left = box.x + "px";
    canvas.style.top = box.y + "px";
    canvas.style.width = box.w + "px";
    canvas.style.height = box.h + "px";
    redraw();
  }

  /* 一笔一条路径:圆头圆角,连点之间直接连(点足够密,看着就是平滑的) */
  function paint(s) {
    if (!s.pts.length) return;
    ctx.save();
    ctx.globalCompositeOperation = s.op;
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.w * dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.pts[0][0] * dpr, s.pts[0][1] * dpr);
    for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0] * dpr, s.pts[i][1] * dpr);
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * dpr + 0.01, s.pts[0][1] * dpr);
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < strokes.length; i++) paint(strokes[i]);
  }

  function local(e) {
    var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    return [e.pageX !== undefined ? e.pageX - box.x : (e.clientX + sx) - box.x,
            e.pageY !== undefined ? e.pageY - box.y : (e.clientY + sy) - box.y];
  }

  canvas.addEventListener("pointerdown", function (e) {
    var pen = activePen();
    if (!pen || e.button === 2) return;
    e.preventDefault();
    var c = penCfg(pen);
    cur = { pen: pen, color: c.color, w: c.w, alpha: c.alpha, op: c.op, pts: [local(e)] };
    strokes.push(cur);
    drawing = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    paint(cur);
    notify(true);
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!drawing || !cur) return;
    e.preventDefault();
    cur.pts.push(local(e));
    /* 只画最后一小段(不必整幅重画)—— 橡皮的 destination-out 也能一段一段擦 */
    ctx.save();
    ctx.globalCompositeOperation = cur.op;
    ctx.globalAlpha = cur.alpha;
    ctx.strokeStyle = cur.color;
    ctx.lineWidth = Math.max(1, cur.w * dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    var n = cur.pts.length;
    ctx.moveTo(cur.pts[n - 2][0] * dpr, cur.pts[n - 2][1] * dpr);
    ctx.lineTo(cur.pts[n - 1][0] * dpr, cur.pts[n - 1][1] * dpr);
    ctx.stroke();
    ctx.restore();
  });

  function finish(e) {
    if (!drawing) return;
    drawing = false;
    try { if (e && e.pointerId !== undefined) canvas.releasePointerCapture(e.pointerId); } catch (err) { }
    if (cur && cur.pts.length === 2) { /* 点一下也留个点 */ cur.pts.push(cur.pts[1]); }
    cur = null;
    notify(false);
  }
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  /* 右键 = 清空(只在有笔选中时;不然正文自己的右键菜单没了) */
  canvas.addEventListener("contextmenu", function (e) {
    if (!activePen()) return;
    e.preventDefault();
    var n = strokes.length;
    if (!n) { notify(null, "还没有笔迹"); return; }
    strokes = [];
    redraw();
    notify(null, "已清空 " + n + " 笔");
  });

  /* 提示:复用 HUD 那颗 toast(拿走已有的就自己弹一个) */
  function notify(busy, text) {
    var t = document.getElementById("hud-toast");
    if (!t) return;
    if (text) { t.textContent = text; t.hidden = false; clearTimeout(notify._t); notify._t = setTimeout(function () { t.hidden = true; }, 1600); }
    else if (busy === true) { t.hidden = true; }
  }

  var pending = false;
  window.addEventListener("resize", function () {
    if (pending) return;
    pending = true;
    var run = function () { pending = false; layout(); };
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    else setTimeout(run, 120);
  });
  /* 点笔那排按钮之后才知道该不该接管指针 —— page-hud.js 先处理,我们后看 */
  document.addEventListener("click", function () { setTimeout(syncMode, 0); }, true);
  window.addEventListener("load", function () { layout(); syncMode(); });

  layout();
  syncMode();

  /* 排障出口 */
  window.__hudInk = {
    strokes: function () { return strokes.slice(); },
    count: function () { return strokes.length; },
    box: function () { return { x: box.x, y: box.y, w: box.w, h: box.h, dpr: dpr }; },
    mode: function () { return canvas.style.pointerEvents; },
    clear: function () { strokes = []; redraw(); },
    layout: layout,
    el: canvas
  };
})();
