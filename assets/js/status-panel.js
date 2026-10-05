(function () {
  "use strict";

  var el = document.getElementById("drive-status");
  if (!el) return;
  var wave = document.getElementById("drive-status-wave");
  var wctx = wave ? wave.getContext("2d") : null;
  var holo = document.querySelector(".holo") || document.getElementById("rack");

  var UNSTABLE = { tech: true };
  var SIGNAL_TICK = 500;

  function signalFor(key) {
    var h = 0, i;
    for (i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
    return 62 + (h % 36);
  }
  function unstableSignal() {
    return Math.floor(Math.random() * 38);
  }
  function trackOf(idx) {
    return ("0" + (idx + 1)).slice(-2) + " / 05";
  }
  function isUnstable(key) { return !!UNSTABLE[key]; }

  var t0 = performance.now();
  var bass = 0, phase = 0, last = 0;
  var curKey = "";
  var signalTimer = 0;

  function cssVar(name, d) {
    var v = holo ? getComputedStyle(holo).getPropertyValue(name) : "";
    return v && v.trim() ? v.trim() : d;
  }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  function paintSignal(sig) {
    var n = document.getElementById("ds-signal");
    if (n) n.textContent = Math.round(sig) + "%";
    var bars = el.querySelectorAll(".drive-status__bars i");
    var lit = Math.round((sig / 100) * bars.length);
    Array.prototype.forEach.call(bars, function (b, i) { b.classList.toggle("on", i < lit); });
  }

  function applyKey(key) {
    if (key === curKey) return;
    curKey = key;
    var idx = 0;
    try {
      var order = Array.prototype.map.call(document.querySelectorAll(".cd[data-panel]"), function (c) {
        return c.getAttribute("data-panel");
      });
      idx = Math.max(0, order.indexOf(key));
    } catch (err) {}
    var set = function (id, txt) { var n = document.getElementById(id); if (n) n.textContent = txt; };
    set("ds-track", trackOf(idx));

    var bad = isUnstable(key);
    el.classList.toggle("is-unstable", bad);
    var st = document.getElementById("ds-state");
    if (st) {
      st.textContent = bad ? "未知" : "就绪";
      st.classList.toggle("is-ok", !bad);
      st.classList.toggle("is-unknown", bad);
    }
    if (signalTimer) { clearInterval(signalTimer); signalTimer = 0; }
    if (bad) {
      paintSignal(unstableSignal());
      signalTimer = setInterval(function () { paintSignal(unstableSignal()); }, SIGNAL_TICK);
    } else {
      paintSignal(signalFor(key));
    }
  }

  window.addEventListener("cd-select", function (e) {
    applyKey(String((e && e.detail) || ""));
  });

  (function initPanel() {
    var sel = document.querySelector(".cd.is-selected[data-panel]") || document.querySelector(".cd[data-panel]");
    if (sel) applyKey(sel.getAttribute("data-panel") || "");
  })();

  function frame(now) {
    requestAnimationFrame(frame);
    if (!wave || !wctx) return;
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;

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
    wctx.strokeStyle = "rgba(234, 243, 255, " + (0.10 + amp * 0.1).toFixed(3) + ")";
    wctx.lineWidth = 1;
    wctx.beginPath();
    wctx.moveTo(0, mid);
    wctx.lineTo(w, mid);
    wctx.stroke();

    if (isUnstable(curKey)) {
      wctx.strokeStyle = "rgba(185, 133, 255, " + (0.30 + 0.28 * Math.random()).toFixed(3) + ")";
      wctx.lineWidth = 1.1;
      wctx.beginPath();
      for (var nx = 0; nx <= w; nx += 3) {
        var ny = mid + (Math.random() * 2 - 1) * h * 0.40
                     + Math.sin(nx * 0.55 + phase * 2.6) * h * 0.09;
        if (nx === 0) wctx.moveTo(nx, ny); else wctx.lineTo(nx, ny);
      }
      wctx.stroke();
      if (Math.random() < 0.06) {
        wctx.fillStyle = "rgba(185, 133, 255, 0.10)";
        wctx.fillRect(0, mid - 1, w, 2);
      }
      return;
    }

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
