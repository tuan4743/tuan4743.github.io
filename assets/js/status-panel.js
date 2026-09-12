/* ============================================================
   光驱上方的状态面板
     · 电源 / 轨道编号 / 信号强度 / 就绪
     · 低频(鼓点)才浮现的水平波形
   参数在 holo.css 的 .holo:--panel-*
   ============================================================ */
(function () {
  "use strict";

  var el = document.getElementById("drive-status");
  if (!el) return;
  var wave = document.getElementById("drive-status-wave");
  var wctx = wave ? wave.getContext("2d") : null;
  var holo = document.querySelector(".holo") || document.getElementById("rack");

  /* 每张盘的"信号强度":用 key 做个稳定的伪随机,换盘就换数 */
  function signalFor(key) {
    var h = 0, i;
    for (i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
    return 62 + (h % 36);          /* 62% ~ 97% */
  }
  function trackOf(idx) {
    return ("0" + (idx + 1)).slice(-2) + " / 05";
  }

  var t0 = performance.now();
  var bass = 0, phase = 0, last = 0;

  function cssVar(name, d) {
    var v = holo ? getComputedStyle(holo).getPropertyValue(name) : "";
    return v && v.trim() ? v.trim() : d;
  }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  /* 换盘:更新文字与格数 */
  window.addEventListener("cd-select", function (e) {
    var key = (e && e.detail) || "";
    var idx = 0;
    try {
      var order = Array.prototype.map.call(document.querySelectorAll(".cd[data-panel]"), function (c) {
        return c.getAttribute("data-panel");
      });
      idx = Math.max(0, order.indexOf(key));
    } catch (err) {}
    var sig = signalFor(String(key));
    var set = function (id, txt) { var n = document.getElementById(id); if (n) n.textContent = txt; };
    set("ds-track", trackOf(idx));
    set("ds-signal", sig + "%");
    /* 信号格:8 格,按百分比点亮 */
    var bars = el.querySelectorAll(".drive-status__bars i");
    var lit = Math.round((sig / 100) * bars.length);
    Array.prototype.forEach.call(bars, function (b, i) { b.classList.toggle("on", i < lit); });
  });

  function frame(now) {
    requestAnimationFrame(frame);
    if (!wave || !wctx) return;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;

    /* 低频电平:0~1(只有低频强的时候波形才明显)*/
    var target = num(cssVar("--cd-bass", "0"), 0);
    bass += (target - bass) * Math.min(1, dt * 6);
    phase += dt * 3.2;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = wave.clientWidth, h = wave.clientHeight;
    if (w < 4 || h < 4) return;
    if (wave.width !== Math.round(w * dpr) || wave.height !== Math.round(h * dpr)) {
      wave.width = Math.round(w * dpr);
      wave.height = Math.round(h * dpr);
    }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, w, h);

    var amp = Math.min(1, bass * 1.4);
    var mid = h / 2;
    /* 基线 */
    wctx.strokeStyle = "rgba(234, 243, 255, " + (0.10 + amp * 0.1).toFixed(3) + ")";
    wctx.lineWidth = 1;
    wctx.beginPath();
    wctx.moveTo(0, mid);
    wctx.lineTo(w, mid);
    wctx.stroke();

    /* 波形:低频越强越明显(画两遍 —— 粗而淡的一遍充当微弱辉光,不用 CSS filter)*/
    if (amp < 0.02) return;
    function wavePath() {
      wctx.beginPath();
      for (var x = 0; x <= w; x += 2) {
        var t = x / w;
        var env = Math.sin(Math.PI * t);
        var y = mid + Math.sin(t * Math.PI * 6 + phase) * (h * 0.42) * amp * env
                    + Math.sin(t * Math.PI * 17 - phase * 1.7) * (h * 0.12) * amp * env;
        if (x === 0) wctx.moveTo(x, y); else wctx.lineTo(x, y);
      }
      wctx.stroke();
    }
    wctx.save();
    wctx.strokeStyle = "rgba(234, 243, 255, " + (0.10 + amp * 0.16).toFixed(3) + ")";
    wctx.lineWidth = 4;
    wavePath();
    wctx.restore();
    wctx.strokeStyle = "rgba(234, 243, 255, " + (0.38 + amp * 0.5).toFixed(3) + ")";
    wctx.lineWidth = 1.2;
    wavePath();
  }
  requestAnimationFrame(frame);
})();
