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

  var strokes = [];
  var cur = null;
  var box = { x: 0, y: 0, w: 1, h: 1 };
  var dpr = 1;
  var drawing = false;

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
    return { color: color, w: Math.max(1, size * 0.6), alpha: 1, op: "source-over" };
  }

  function activePen() {
    var on = document.querySelector("[data-hud-pen].is-on");
    return on ? on.getAttribute("data-hud-pen") : null;
  }

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
    if (cur && cur.pts.length === 2) { cur.pts.push(cur.pts[1]); }
    cur = null;
    notify(false);
  }
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  canvas.addEventListener("contextmenu", function (e) {
    if (!activePen()) return;
    e.preventDefault();
    var n = strokes.length;
    if (!n) { notify(null, "还没有笔迹"); return; }
    strokes = [];
    redraw();
    notify(null, "已清空 " + n + " 笔");
  });

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
  document.addEventListener("click", function () { setTimeout(syncMode, 0); }, true);
  window.addEventListener("load", function () { layout(); syncMode(); });

  layout();
  syncMode();

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
