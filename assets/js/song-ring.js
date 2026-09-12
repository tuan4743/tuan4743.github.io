/* ============================================================
   光驱下方的 3D 歌名光环
     · 外圈文字 = "歌名 - 歌手",按字数决定重复几遍(字数多就少重复)
     · 内圈两个环 = 音量环,跟着音乐电平缩放
   参数在 holo.css 的 .holo:--ring-*
   ============================================================ */
(function () {
  "use strict";

  var ring = document.getElementById("song-ring");
  var track = document.getElementById("song-ring-track");
  if (!ring || !track) return;

  /* 目标:绕一圈大约 40 个字符的位置;字多就少重复,字少就多重复 */
  var TARGET = 40;

  function build(textParts) {
    var full = textParts.join(" ");
    if (!full.trim()) return;
    var repeats = Math.max(1, Math.min(4, Math.round(TARGET / Math.max(1, full.length))));
    var html = "";
    var idx = 0;
    /* 每个字符(含空格)一个 span,沿圆周均匀分布 */
    var unit = full + "   ";                       /* 段与段之间留空隙 */
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

  /* 换盘:取歌名 + 歌手 */
  window.addEventListener("cd-select", function (e) {
    var key = (e && e.detail) || "";
    var btn = document.querySelector('.cd[data-panel="' + key + '"]');
    if (!btn) return;
    var song = btn.getAttribute("data-song") || "";
    var artist = btn.getAttribute("data-artist") || "";
    if (!song && !artist) return;
    build([song, artist].filter(Boolean).join(" - ").split(""));
  });

  /* 首次进入:用当前选中的那张盘渲染一次 */
  function initFromSelected() {
    var sel = document.querySelector(".cd.is-active") || document.querySelector(".cd");
    if (!sel) return;
    var song = sel.getAttribute("data-song") || "";
    var artist = sel.getAttribute("data-artist") || "";
    if (song || artist) build([song, artist].filter(Boolean).join(" - ").split(""));
  }
  setTimeout(initFromSelected, 1200);

  /* 音量环:跟着 --cd-pulse / --cd-bass 缩放 */
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
  }
  requestAnimationFrame(frame);
})();
