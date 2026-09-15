/* ============================================================
   第四张盘「技术」的开机动画(故障光盘)
   ─────────────────────────────────────────────────────────────
   任务书要求的三件事(见 gd-web/docs/cd04-terminal.md):
     · 删掉过场动画,只留前面这段"终端式加载动画"
     · 进度到 55% 时【直接变红卡死不动】,左侧打印
         Wrong disk name, trying decoding...
       等一秒,再打三行红色的 permission denied,然后清屏进入下一页
     · 错误期间保留故障元素:局部撕裂 / RGB 分离 / 字符乱码

   下一页(内核日志 + 真正的终端)不在这里画 —— 画布清屏后交给
   DOM 里的终端(assets/js/cd4-terminal.js),它收到 cd-boot-done 才开始打印。
   这样"两页"用的是同一套终端排版,不会各画一套。

   接入点:intro.js 的 screenBoot() —— 款式名是 glitch 且本文件已加载时,
          整段时间轴交给 CD4Boot.render(),不再走下边的 scene。
   ============================================================ */
(function () {
  "use strict";

  /* 时间轴(ms)。要改节奏只动这里 */
  var T = {
    fadeIn: 220,        /* 起手黑屏 */
    loadEnd: 2400,      /* 进度爬到 55% 的时刻 */
    wrongAt: 2620,      /* "Wrong disk name, trying decoding..." 开始打 */
    wrongSpeed: 26,     /* 打字机速度(ms/字符)*/
    denyAt: 3900,       /* 打完那句后再等一秒 → 三行 permission denied */
    denyGap: 330,
    clearAt: 5100,      /* 清屏 */
    total: 5700         /* 整段时长(onEnd 在这一刻触发)*/
  };
  var STALL_P = 0.55;   /* 卡死时的进度 */

  var LOG = [
    "> OPTICAL BIOS  v1.4",
    "> DRIVE SPIN-UP ........... OK",
    "> MOUNTING DISC GLITCH",
    "> READING SECTORS ......... ",
    "> SIGNAL LOCK ............. ",
    "> READY"
  ];
  var WRONG = "Wrong disk name, trying decoding...";
  var DENY = "permission denied";
  var GARBLE = "▓▒░#@%&$*!?/\\|<>~^¤§µ¶";

  var C_CYAN = "#7ff0ff";
  var C_ICE = "#bfe9ff";
  var C_DIM = "rgba(127, 240, 255, 0.45)";
  var C_RED = "#ff4d5e";

  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* 本帧的状态:进度 / 是否已卡死 / 已打完的字符数 / 已出现的 denied 行数 */
  function stateAt(el) {
    var stalling = el >= T.loadEnd;
    var p = el >= T.loadEnd ? STALL_P : STALL_P * Math.min(1, el / T.loadEnd);
    var wrongLen = el < T.wrongAt ? 0 : Math.floor((el - T.wrongAt) / T.wrongSpeed);
    wrongLen = Math.max(0, Math.min(WRONG.length, wrongLen));
    var denyN = el < T.denyAt ? 0 : Math.min(3, Math.floor((el - T.denyAt) / T.denyGap) + 1);
    /* 故障强度:卡死之后拉满;清屏前 300ms 归零 */
    var amt = 0;
    if (stalling) amt = el > T.clearAt - 320 ? 0.25 : 1;
    return { p: p, stalling: stalling, wrongLen: wrongLen, deny: denyN, amt: amt };
  }

  /* 乱码:故障期间把一部分字符换掉 */
  function maybeGarble(txt, amt, seed) {
    if (amt < 0.5) return txt;
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    var r = x - Math.floor(x);
    if (r > 0.22) return txt;                       /* 大部分帧不动 */
    var arr = txt.split("");
    for (var i = 0; i < arr.length; i++) {
      var y = Math.sin((seed + i) * 78.233) * 43758.5453;
      if ((y - Math.floor(y)) < 0.25) arr[i] = GARBLE[Math.floor((y - Math.floor(y)) * 100) % GARBLE.length];
    }
    return arr.join("");
  }

  function CD4Boot_render(ctx, W, H, el) {
    var st = stateAt(el);
    var outA = Math.min(1, el / T.fadeIn);
    var acc = st.stalling ? C_RED : C_CYAN;
    var breach = 0.6 + st.amt * 3.6;                 /* 色差幅度 */
    var seed = Math.floor(el / 70);

    /* ---- 底:近黑(比其它盘更黑一点,后面要接终端)---- */
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);

    var fs = Math.max(14, Math.round(Math.min(W, H) * 0.021 * 1.4));
    var lh = Math.round(fs * 1.45);
    var lx = Math.round(W * 0.062), ly = Math.round(H * 0.07);

    /* 带色差的文字:红/青各偏一点,本体压在上面 */
    function glow(txt, x, y, color, blur, aber) {
      ctx.save();
      if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.4;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 60, 90, 0.55)";
      ctx.fillText(txt, x - aber, y);
      ctx.fillStyle = "rgba(60, 230, 255, 0.55)";
      ctx.fillText(txt, x + aber, y);
      ctx.restore();
    }

    /* ---------- 左侧日志 ---------- */
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-0.022);
    ctx.font = fs + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.globalAlpha = outA;
    var shown = st.stalling ? LOG.length : Math.min(LOG.length, Math.floor(st.p / STALL_P * (LOG.length - 1) + 1));
    for (var i = 0; i < shown; i++) {
      var txt = LOG[i];
      if (i === 3) txt += Math.round(st.p * 100) + "%";
      if (i === 4) txt += st.stalling ? "LOST" : "LOCKING";
      var col = C_ICE;
      if (i === 3 && st.stalling) col = C_RED;
      if (i === 4 && st.stalling) col = C_RED;
      ctx.globalAlpha = outA * (i === shown - 1 ? 0.75 + 0.25 * Math.abs(Math.sin(el / 150)) : 0.92);
      glow(maybeGarble(txt, st.amt, seed + i), 0, i * lh, col, i === shown - 1 ? 10 : 0, breach);
    }
    /* 卡死之后:告警行 + 打字机那句 + 三行 permission denied */
    var y = shown * lh;
    if (st.stalling) {
      ctx.globalAlpha = outA;
      glow("! WRONG DISK NAME", 0, y, C_RED, 12, breach);
      y += lh * 1.5;
      if (st.wrongLen > 0) {
        glow(WRONG.slice(0, st.wrongLen), 0, y, C_RED, 8, breach);
        if (st.wrongLen < WRONG.length && Math.floor(el / 220) % 2 === 0) {
          ctx.fillStyle = C_RED;
          ctx.fillRect(ctx.measureText(WRONG.slice(0, Math.max(1, st.wrongLen))).width + 2, y, fs * 0.5, fs * 0.85);
        }
      }
      y += lh * 1.35;
      for (var d = 0; d < st.deny; d++) {
        ctx.globalAlpha = outA * (d === st.deny - 1 ? 0.8 + 0.2 * Math.abs(Math.sin(el / 130)) : 0.95);
        glow("        " + DENY, 0, y + d * lh, C_RED, 10, breach);
      }
    }
    ctx.restore();

    /* ---------- 右侧数据列(故障时整列变红并乱跳)---------- */
    ctx.save();
    ctx.globalAlpha = outA;
    ctx.font = Math.max(9, Math.round(fs * 0.72)) + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    for (var k = 0; k < 9; k++) {
      var r1 = function (i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
      var val;
      if (st.stalling) {
        val = r1(k) < 0.5 ? "ERR 0x" + Math.floor(r1(k + 3) * 65535).toString(16).toUpperCase().padStart(4, "0")
                          : "SIG " + (r1(k + 7) * 3.7).toFixed(1) + "%";
      } else if (k % 3 === 0) {
        val = "0x" + Math.floor(r1(k) * 65535).toString(16).toUpperCase().padStart(4, "0");
      } else if (k % 3 === 1) {
        val = "SIG " + (95 + r1(k) * 4.9).toFixed(1) + "%";
      } else {
        val = "LAT " + (6 + r1(k) * 9).toFixed(1) + "ms";
      }
      ctx.globalAlpha = outA * (0.35 + 0.35 * r1(k + 40));
      ctx.fillStyle = st.stalling ? C_RED : (k % 3 === 0 ? C_DIM : C_ICE);
      ctx.fillText(val, W * 0.955, H * 0.07 + k * lh);
    }
    ctx.restore();

    /* ---------- 中央圆环 + 百分比 ---------- */
    var cx = W / 2, cy = H / 2, rr = Math.min(W, H) * 0.075, rBase = rr * 1.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = outA;

    /* 虚线外圈 */
    ctx.save();
    ctx.rotate(-el / 2600);
    ctx.setLineDash([rr * 0.34, rr * 0.26]);
    ctx.lineWidth = Math.max(1, rr * 0.07);
    ctx.strokeStyle = st.stalling ? "rgba(255,77,94,0.55)" : C_DIM;
    ctx.shadowColor = acc; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(0, 0, rBase * 1.26, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    /* 刻度(卡死后停转) */
    ctx.save();
    ctx.rotate(st.stalling ? 0 : el / 1700);
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, rr * 0.055);
    for (var ti = 0; ti < 24; ti++) {
      var ang = (Math.PI * 2 / 24) * ti, long = ti % 2 === 0;
      ctx.globalAlpha = outA * (long ? 0.55 : 0.3);
      ctx.strokeStyle = long ? acc : C_ICE;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * rBase * (long ? 1.06 : 1.12), Math.sin(ang) * rBase * (long ? 1.06 : 1.12));
      ctx.lineTo(Math.cos(ang) * rBase * 1.2, Math.sin(ang) * rBase * 1.2);
      ctx.stroke();
    }
    ctx.restore();

    /* 雷达扫描(卡死后停) */
    if (!st.stalling) {
      ctx.save();
      ctx.rotate(el / 620);
      ctx.globalAlpha = outA * 0.5;
      if (ctx.createConicGradient) {
        var sweep = ctx.createConicGradient(0, 0, 0);
        sweep.addColorStop(0, "rgba(127,240,255,0)");
        sweep.addColorStop(0.12, "rgba(127,240,255,0.5)");
        sweep.addColorStop(0.25, "rgba(127,240,255,0)");
        sweep.addColorStop(1, "rgba(127,240,255,0)");
        ctx.fillStyle = sweep;
        ctx.beginPath(); ctx.arc(0, 0, rBase * 1.02, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* 进度主环 */
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(2, rr * 0.17);
    ctx.strokeStyle = st.stalling ? "rgba(255,77,94,0.16)" : "rgba(127, 240, 255, 0.16)";
    ctx.beginPath(); ctx.arc(0, 0, rBase, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.strokeStyle = acc;
    ctx.shadowColor = acc; ctx.shadowBlur = st.stalling ? 22 : 14;
    ctx.beginPath(); ctx.arc(0, 0, rBase, 0, Math.PI * 2 * st.p); ctx.stroke();
    ctx.restore();

    /* 内侧细环 */
    ctx.save();
    ctx.rotate(st.stalling ? 0 : el / 900);
    ctx.setLineDash([rr * 0.18, rr * 0.3]);
    ctx.lineWidth = Math.max(1, rr * 0.07);
    ctx.strokeStyle = C_ICE;
    ctx.globalAlpha = outA * 0.5;
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 0, rBase * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.restore();

    /* 百分比 */
    ctx.save();
    ctx.font = "600 " + Math.round(Math.min(W, H) * 0.032) + "px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = outA * (st.stalling ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(el / 260)));
    glow(String(Math.round(st.p * 100)) + "%", cx, cy, acc, 16, breach);
    ctx.restore();

    /* ---------- 故障元素:撕裂条 + RGB 分离 + 闪白 ---------- */
    if (st.amt > 0.4) {
      var nBands = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (var b = 0; b < nBands; b++) {
        if (Math.random() < 0.45) continue;                 /* 偶尔这一帧不撕 */
        var bh = Math.round(rnd(6, 26));
        var by = Math.round(rnd(0, H - bh));
        var dx = Math.round(rnd(-16, 16));
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(ctx.canvas, 0, by, W, bh, dx, by, W, bh);
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,77,94,0.18)" : "rgba(197,108,255,0.16)";
        ctx.fillRect(0, by, W, bh);
        ctx.restore();
      }
      /* 整帧的横向偏移(很轻,只为了让画面"站不稳")*/
      if (Math.random() < 0.25) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(ctx.canvas, Math.round(rnd(-4, 4)), 0);
        ctx.restore();
      }
    }

    /* 清屏前:整块往下压黑(进入下一页) */
    if (el > T.clearAt) {
      var k = Math.min(1, (el - T.clearAt) / (T.total - T.clearAt));
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  window.CD4Boot = { total: T.total, render: CD4Boot_render, T: T };
})();
