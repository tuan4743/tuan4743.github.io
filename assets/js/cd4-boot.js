(function () {
  "use strict";

  var T = {
    fadeIn: 220,
    loadEnd: 3000,
    wrongAt: 3260,
    wrongSpeed: 30,
    denyAt: 4400,
    denyGap: 330,
    clearAt: 5100,
    total: 5700
  };
  var STALL_P = 0.55;

  var LOG = [
    "> OPTICAL BIOS  v1.4",
    "> DRIVE SPIN-UP ........... OK",
    "> MOUNTING DISC GLITCH",
    "> READING SECTORS ......... ",
    "> SIGNAL LOCK ............. "
  ];
  var WRONG = "Wrong disk name, trying decoding...";
  var DENY = "permission denied";
  var GARBLE = "▓▒░#@%&$*!?/\\|<>~^¤§µ¶";

  var C_CYAN = "#7ff0ff";
  var C_ICE = "#bfe9ff";
  var C_DIM = "rgba(127, 240, 255, 0.45)";
  var C_RED = "#ff4d5e";

  function rnd(a, b) { return a + Math.random() * (b - a); }

  var snapCv4 = null;
  function snapshot(ctx, W, H) {
    if (!snapCv4) snapCv4 = document.createElement("canvas");
    if (snapCv4.width !== W || snapCv4.height !== H) { snapCv4.width = W; snapCv4.height = H; }
    var sg = snapCv4.getContext("2d");
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, W, H);
    sg.drawImage(ctx.canvas, 0, 0, W, H);
    return snapCv4;
  }

  function schedule(n, span) {
    var w = [], sum = 0, i, r;
    for (i = 0; i < n; i++) {
      r = Math.random();
      var v = r < 0.18 ? 2.4 + Math.random() * 2.4 : 0.5 + Math.random();
      w.push(v); sum += v;
    }
    var out = [], acc = 0;
    for (i = 0; i < n; i++) { acc += w[i]; out.push(acc / sum * span); }
    return out;
  }
  var LINE_AT = schedule(LOG.length, T.loadEnd * 0.94);
  var TYPE_AT = (function () {
    var out = [], t = 0;
    for (var i = 0; i < WRONG.length; i++) {
      t += T.wrongSpeed * rnd(0.55, 1.7);
      if (/[,.:;]/.test(WRONG.charAt(i))) t += rnd(90, 260);
      out.push(t);
    }
    return out;
  })();
  var TYPE_END = TYPE_AT[TYPE_AT.length - 1] || 0;

  T.denyAt = T.wrongAt + Math.max(TYPE_END + 900, T.denyAt - T.wrongAt);
  T.clearAt = T.denyAt + T.denyGap * 3 + 480;
  T.total = T.clearAt + 620;

  function progressAt(el) {
    var n = LINE_AT.length, prevT = 0, prevP = 0.015, i;
    for (i = 0; i < n; i++) {
      var pHere = STALL_P * (0.12 + 0.88 * (i + 1) / n);
      if (el <= LINE_AT[i]) {
        var k = (el - prevT) / Math.max(1, LINE_AT[i] - prevT);
        return prevP + (pHere - prevP) * (1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 2));
      }
      prevT = LINE_AT[i]; prevP = pHere;
    }
    return STALL_P;
  }

  function stateAt(el) {
    var stalling = el >= T.loadEnd;
    var p = stalling ? STALL_P : progressAt(el);
    var wrongLen = 0;
    if (el >= T.wrongAt) {
      var e2 = el - T.wrongAt;
      while (wrongLen < WRONG.length && TYPE_AT[wrongLen] <= e2) wrongLen++;
    }
    var denyN = el < T.denyAt ? 0 : Math.min(3, Math.floor((el - T.denyAt) / T.denyGap) + 1);
    var amt = 0;
    if (stalling) amt = el > T.clearAt - 320 ? 0.25 : 1;
    return { p: p, stalling: stalling, wrongLen: wrongLen, deny: denyN, amt: amt, lineShown: shownLines(el) };
  }

  function shownLines(el) {
    var n = 0;
    while (n < LINE_AT.length && LINE_AT[n] <= el) n++;
    return n;
  }

  function maybeGarble(txt, amt, seed) {
    if (amt < 0.5) return txt;
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    var r = x - Math.floor(x);
    if (r > 0.22) return txt;
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
    var breach = 0.6 + st.amt * 3.6;
    var seed = Math.floor(el / 70);

    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);

    var fs = Math.max(14, Math.round(Math.min(W, H) * 0.021 * 1.4));
    var lh = Math.round(fs * 1.45);
    var lx = Math.round(W * 0.062), ly = Math.round(H * 0.07);

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

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-0.022);
    ctx.font = fs + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.globalAlpha = outA;
    var shown = st.stalling ? LOG.length : Math.max(1, st.lineShown);
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

    /* ---- 中央:与新读盘加载同源的扇区环 ----
       cd4 的 narrative 是"读不出":环保持半亮,读出弧反复扫却过不去,
       卡住时转红,与主加载器的视觉语言一致但结局相反 */
    var cx = W / 2, cy = H / 2, rr = Math.min(W, H) * 0.075, rBase = rr * 1.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = outA;

    var RINGS4 = [
      { r: rBase * 0.55, lit: st.p / (2 / 3) },
      { r: rBase * 0.94, lit: (st.p - 1 / 3) / (2 / 3) },
      { r: rBase * 1.30, lit: (st.p - 2 / 3) / (2 / 3) }
    ];

    /* 环底盘面 + 扇区分割线(与主加载器同一套暗底盘) */
    ctx.save();
    ctx.rotate(-el / 2600);
    ctx.lineWidth = Math.max(1, rr * 0.05);
    for (var ri0 = 0; ri0 < RINGS4.length; ri0++) {
      ctx.globalAlpha = outA * 0.14;
      ctx.strokeStyle = C_DIM;
      ctx.beginPath();
      ctx.arc(0, 0, RINGS4[ri0].r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, rr * 0.03);
    ctx.strokeStyle = C_DIM;
    for (var si4 = 0; si4 < 24; si4++) {
      var ang4 = (Math.PI * 2 / 24) * si4;
      ctx.globalAlpha = outA * 0.10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang4) * RINGS4[0].r, Math.sin(ang4) * RINGS4[0].r);
      ctx.lineTo(Math.cos(ang4) * RINGS4[2].r * 1.06, Math.sin(ang4) * RINGS4[2].r * 1.06);
      ctx.stroke();
    }
    ctx.restore();

    /* 逐环点亮:卡住后不再推进,读出弧一直扫 */
    for (var ri4 = 0; ri4 < RINGS4.length; ri4++) {
      var R4 = RINGS4[ri4];
      var lit4 = Math.max(0, Math.min(1, R4.lit));
      if (lit4 <= 0) continue;
      ctx.globalAlpha = outA * 0.9;
      ctx.lineWidth = Math.max(2, rr * 0.12);
      ctx.strokeStyle = st.stalling ? "#ff4d5e" : C_CYAN;
      ctx.shadowColor = st.stalling ? "#ff4d5e" : C_CYAN;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, R4.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lit4);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = outA * 0.08;
      ctx.lineWidth = Math.max(1, rr * 0.05);
      ctx.strokeStyle = C_ICE;
      ctx.beginPath();
      ctx.arc(0, 0, R4.r, -Math.PI / 2 + Math.PI * 2 * lit4, -Math.PI / 2 + Math.PI * 2);
      ctx.stroke();
      var sweep4 = (el / 260) % (Math.PI * 2);
      ctx.globalAlpha = outA * 0.55;
      ctx.lineWidth = Math.max(2, rr * 0.09);
      ctx.strokeStyle = st.stalling ? "rgba(255,77,94,0.8)" : "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.arc(0, 0, R4.r, sweep4, sweep4 + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.font = "600 " + Math.round(Math.min(W, H) * 0.032) + "px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = outA * (st.stalling ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(el / 260)));
    glow(String(Math.round(st.p * 100)) + "%", cx, cy, acc, 16, breach);
    ctx.restore();

    if (st.amt > 0.4) {
      var nBands = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (var b = 0; b < nBands; b++) {
        if (Math.random() < 0.45) continue;
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
      if (Math.random() < 0.25) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.drawImage(ctx.canvas, Math.round(rnd(-4, 4)), 0);
        ctx.restore();
      }
    }

    /* 结尾:同主加载器的 CRT 关屏压缩——读不出→压成一条亮线熄灭 */
    if (el > T.clearAt) {
      var k = Math.min(1, (el - T.clearAt) / (T.total - T.clearAt));
      var ke4 = k * k;
      var sq4 = Math.max(0.004, 1 - ke4);
      var snap4 = snapshot(ctx, W, H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(0, cy * (1 - sq4));
      ctx.scale(1, sq4);
      ctx.drawImage(snap4, 0, 0, W, H);
      ctx.restore();
      if (ke4 > 0.55) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(190,245,255," + (0.75 * Math.min(1, (ke4 - 0.55) / 0.2)).toFixed(3) + ")";
        ctx.fillRect(0, cy - 1.5 * (1 - ke4), W, 3 * (1 - ke4) + 1);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  window.CD4Boot = { total: T.total, render: CD4Boot_render, T: T };
})();
