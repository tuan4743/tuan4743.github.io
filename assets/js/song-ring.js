(function () {
  "use strict";

  var ring = document.getElementById("song-ring");
  var track = document.getElementById("song-ring-track");
  if (!ring || !track) return;

  var TARGET = 40;

  function build(textParts) {
    var full = textParts.join(" ");
    if (!full.trim()) return;
    var repeats = Math.max(1, Math.min(4, Math.round(TARGET / Math.max(1, full.length))));
    var html = "";
    var idx = 0;
    var unit = full + "   ";
    var chars = [];
    for (var r = 0; r < repeats; r++) {
      for (var i = 0; i < unit.length; i++) chars.push({ c: unit[i], artist: false });
    }
    var n = chars.length;
    chars.forEach(function (it) {
      var ch = it.c.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      html += '<span class="song-ring__ltr" style="--i:' + idx + ';--n:' + n + '">' + (ch === " " ? "&nbsp;" : ch) + "</span>";
      idx++;
    });
    track.innerHTML = html;
  }

  window.addEventListener("cd-select", function (e) {
    var key = (e && e.detail) || "";
    var btn = document.querySelector('.cd[data-panel="' + key + '"]');
    if (!btn) return;
    var song = btn.getAttribute("data-song") || "";
    var artist = btn.getAttribute("data-artist") || "";
    if (!song && !artist) return;
    build([song, artist].filter(Boolean).join(" - ").split(""));
  });

  function initFromSelected() {
    var sel = document.querySelector(".cd.is-active") || document.querySelector(".cd");
    if (!sel) return;
    var song = sel.getAttribute("data-song") || "";
    var artist = sel.getAttribute("data-artist") || "";
    if (song || artist) build([song, artist].filter(Boolean).join(" - ").split(""));
  }
  setTimeout(initFromSelected, 1200);


  var midBox = document.getElementById("song-ring-midtext");
  function buildMid(text) {
    if (!midBox) return;
    var chars = text.split("");
    var n = chars.length;
    var html = "";
    chars.forEach(function (c, i) {
      var ch = c.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      html += '<span class="song-ring__midltr" style="--mi:' + i + ';--mn:' + n + '">' + (ch === " " ? "&nbsp;" : ch) + "</span>";
    });
    midBox.innerHTML = html;
  }
  setTimeout(function () { buildMid("链接确认 存储稳定"); }, 1400);

  var holo = document.querySelector(".holo") || document.getElementById("rack");
  var v1 = ring.querySelector(".song-ring__vol--1");
  var v2 = ring.querySelector(".song-ring__vol--2");
  var cur = 0, last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    if (!document.body.classList.contains("scene-open")) return;
    var cs = getComputedStyle(holo);
    var pulse = parseFloat(cs.getPropertyValue("--cd-pulse")) || 0;
    var bass = parseFloat(cs.getPropertyValue("--cd-bass")) || 0;
    var want = Math.max(pulse, bass);
    cur += (want - cur) * Math.min(1, dt * 8);
    var base = parseFloat(cs.getPropertyValue("--ring-vol-scale")) || 0.6;
    if (v1) v1.style.transform = "translate(-50%, -50%) scale(" + (base + cur * 0.45).toFixed(3) + ")";
    if (v2) v2.style.transform = "translate(-50%, -50%) scale(" + (base + cur * 0.22).toFixed(3) + ")";
    if (v1) v1.style.opacity = (0.5 + cur * 0.5).toFixed(2);
    if (v2) v2.style.opacity = (0.4 + cur * 0.6).toFixed(2);
    var gain = parseFloat(cs.getPropertyValue("--ring-outer-gain")) || 0.06;
    var outerPlane = ring.querySelector(".song-ring__plane--outer");
    if (outerPlane) outerPlane.style.setProperty("--ring-outer-scale", (1 + cur * gain).toFixed(4));
    var outer = ring.querySelector(".song-ring__base");
    if (outer) outer.style.borderColor = "rgba(234, 243, 255, " + (0.28 + cur * 0.35).toFixed(3) + ")";
    drawRays(cur, cs);
  }

  var rays = document.getElementById("song-ring-rays");
  var rctx = rays ? rays.getContext("2d") : null;
  function drawRays(cur, cs) {
    if (!rays || !rctx) return;
    var rack = document.getElementById("rack");
    if (!rack) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = rack.clientWidth, H = rack.clientHeight;
    if (W < 2 || H < 2) return;
    if (rays.width !== Math.round(W * dpr) || rays.height !== Math.round(H * dpr)) {
      rays.width = Math.round(W * dpr);
      rays.height = Math.round(H * dpr);
    }
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, W, H);

    var inner = ring.querySelector(".song-ring__vol--2");
    if (!inner) return;
    var rr = inner.getBoundingClientRect();
    var box = ring.getBoundingClientRect();
    var cx = rr.left - box.left + rr.width / 2;
    var cy = rr.top - box.top + rr.height / 2;
    var rad = rr.width / 2;
    var ox = box.left - rack.getBoundingClientRect().left;
    var oy = box.top - rack.getBoundingClientRect().top;

    var ang = (parseFloat(cs.getPropertyValue("--ring-line-angle")) || 30) * Math.PI / 180;
    var col = (cs.getPropertyValue("--ring-line-color") || "rgba(234,243,255,0.35)").trim();

    var pts = [
      { x: ox + cx - rad, y: oy + cy },
      { x: ox + cx + rad, y: oy + cy }
    ];
    var dx = Math.tan(ang);
    rctx.lineWidth = 1;
    rctx.strokeStyle = col;
    pts.forEach(function (pt, i) {
      var dir = i === 0 ? -1 : 1;
      var tToSide = (dir < 0 ? pt.x : W - pt.x) / dx;
      var tToBottom = (H - pt.y);
      var t = Math.min(tToSide, tToBottom);
      var ex = pt.x + dir * dx * t;
      var ey = pt.y + t;
      rctx.beginPath();
      rctx.moveTo(pt.x, pt.y);
      rctx.lineTo(ex, ey);
      rctx.stroke();
      rctx.save();
      rctx.globalAlpha = 0.22 + cur * 0.25;
      rctx.lineWidth = 3.5;
      rctx.beginPath();
      rctx.moveTo(pt.x, pt.y);
      rctx.lineTo(ex, ey);
      rctx.stroke();
      rctx.restore();
      rctx.lineWidth = 1;
      rctx.beginPath();
      rctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      rctx.fillStyle = "rgba(234, 243, 255, 0.8)";
      rctx.fill();
    });
  }
  requestAnimationFrame(frame);
})();
