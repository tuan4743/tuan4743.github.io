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

  /* ---------- 每张盘的面板人设 ----------
     默认(健康盘):状态 = 就绪(绿),信号 = 用 key 做的稳定伪随机 62%~97%
     第四张盘 tech(故障):状态 = 未知(紫),
                          信号 = 0%~37% 之间每 0.5 秒重掷一次(探测器扫不到锁的样子),
                          波形也从"跟鼓点起伏"换成"失锁的噪声" */
  var UNSTABLE = { tech: true };
  var SIGNAL_TICK = 500;              /* 故障盘信号重掷间隔(ms)—— 任务书:0.5 秒一变 */

  function signalFor(key) {
    var h = 0, i;
    for (i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
    return 62 + (h % 36);          /* 62% ~ 97% */
  }
  function unstableSignal() {
    return Math.floor(Math.random() * 38);        /* 0 ~ 37 */
  }
  function trackOf(idx) {
    return ("0" + (idx + 1)).slice(-2) + " / 05";
  }
  function isUnstable(key) { return !!UNSTABLE[key]; }

  var t0 = performance.now();
  var bass = 0, phase = 0, last = 0;
  var curKey = "";                    /* 当前选中的盘(波形分支要用)*/
  var signalTimer = 0;                /* 故障盘的 0.5s 定时器 */

  function cssVar(name, d) {
    var v = holo ? getComputedStyle(holo).getPropertyValue(name) : "";
    return v && v.trim() ? v.trim() : d;
  }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }

  /* 写信号值 + 按百分比点亮 8 格 */
  function paintSignal(sig) {
    var n = document.getElementById("ds-signal");
    if (n) n.textContent = Math.round(sig) + "%";
    var bars = el.querySelectorAll(".drive-status__bars i");
    var lit = Math.round((sig / 100) * bars.length);
    Array.prototype.forEach.call(bars, function (b, i) { b.classList.toggle("on", i < lit); });
  }

  /* 换盘:轨道号 / 状态(文字+颜色)/ 信号(静态值 or 每 0.5s 乱跳)*/
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

  /* 初次进入:本文件在 intro.js 之后加载,它开场那次 cd-select 我们没听到,
     所以这里按"当前选中的盘(退回第一张)"自己补一次,免得面板停在 HTML 里的初始值 */
  (function initPanel() {
    var sel = document.querySelector(".cd.is-selected[data-panel]") || document.querySelector(".cd[data-panel]");
    if (sel) applyKey(sel.getAttribute("data-panel") || "");
  })();

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

    /* ★ 故障盘:没有可用的低频信号 —— 不画鼓点包络,改画一条"失锁"的噪声线,
       让它看上去像探测器在硬扫一个读不出来的盘(紫色,和"未知"呼应)*/
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
      /* 偶尔来一下"掉信号":整条线扁下去 */
      if (Math.random() < 0.06) {
        wctx.fillStyle = "rgba(185, 133, 255, 0.10)";
        wctx.fillRect(0, mid - 1, w, 2);
      }
      return;
    }

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
