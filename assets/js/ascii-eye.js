(function () {
  "use strict";

  var RAMP = " .-:=+*#%@";

  function create(pre, opt) {
    opt = opt || {};
    if (!pre) return null;

    var CELL_W = 6.6, CELL_H = 16.5;
    var COLS = 0, ROWS = 0, FS = 11;
    var HALF_W = 0, EYE_HY = 0, IRIS_R = 0, PUPIL_R = 0;
    var EYE_AR = 2.05;
    var EYE_W_FRAC = 0.62;
    var LID_POW = 0.30;
    var IRIS_OF_LID = 0.74;
    var PUPIL_OF_IRIS = 0.46;
    var SLIT_W = 0.075, SLIT_H = 0.42;
    var LID_PEAK = 1 / Math.pow(1 - Math.pow(2, -1 / LID_POW), LID_POW);
    var LID_FIT = LID_PEAK;
    var LID_UP = 1.0, LID_DOWN = 0.86;
    var CENTER_SHIFT = 0;

    function lidAt(px, open, up) {
      var t = 1 - (px / HALF_W) * (px / HALF_W);
      if (t <= 0) return 0;
      return open * EYE_HY * (up ? LID_UP : LID_DOWN) * Math.pow(t, LID_POW);
    }

    function sclera(depth, open) {
      return (0.66 + 0.14 * Math.pow(depth > 0 ? depth : 0, 0.8)) * (0.6 + open * 0.4);
    }

    function eye(px, py, gx, gy, open, out) {
      var q = 0;
      if (open > 0.001) {
        var lidU = lidAt(px, open, true);
        var lidD = lidAt(px, open, false);
        if (py < lidU && py > -lidD) {
          var depth = py < 0 ? (1 + py / (lidU || 1)) : (1 - py / (lidD || 1));
          var ix = px - gx * IRIS_R * 0.46, iy = py - gy * IRIS_R * 0.46;
          var ir = Math.sqrt(ix * ix + iy * iy);
          q = sclera(depth, open);
          if (ir < IRIS_R) {
            q = 0.30;
            var lim = Math.abs(ir - IRIS_R * 0.90);
            if (lim < IRIS_R * 0.07) q = 0.98 - lim * 0.6;
            var sl = Math.abs(ix) < IRIS_R * SLIT_W && Math.abs(iy) < IRIS_R * SLIT_H;
            if (sl) q = 0.16;
          }
        }
      }
      out.q = q;
    }

    function measure() {
      var vw = window.innerWidth, vh = window.innerHeight;
      FS = Math.max(8, Math.min(22, Math.round(vw / 120)));
      CELL_W = FS * 0.6;
      CELL_H = FS * 1.5;
      var eyeW = vw * EYE_W_FRAC;
      COLS = Math.max(40, Math.min(240, Math.round(eyeW / CELL_W)));
      HALF_W = COLS * CELL_W / 2;
      EYE_HY = HALF_W / EYE_AR;
      ROWS = Math.max(12, Math.round(EYE_HY * LID_UP * LID_FIT * 2 / CELL_H * 1.30));
      var maxRows = Math.max(12, Math.floor(vh * 0.56 / CELL_H));
      if (ROWS > maxRows) {
        ROWS = maxRows;
        COLS = Math.max(40, Math.min(COLS,
          Math.round(ROWS * CELL_H / (LID_UP * LID_FIT * 2 * 1.30) * EYE_AR * 2 / CELL_W)));
        HALF_W = COLS * CELL_W / 2;
        EYE_HY = HALF_W / EYE_AR;
      }
      IRIS_R = EYE_HY * LID_UP * LID_FIT * IRIS_OF_LID;
      PUPIL_R = IRIS_R * PUPIL_OF_IRIS;
      CENTER_SHIFT = (lidAt(0, 1, true) - lidAt(0, 1, false)) / 2;
      pre.style.fontSize = FS + "px";
      pre.style.lineHeight = CELL_H + "px";
      pre.style.height = (ROWS * CELL_H) + "px";
      pre.style.width = (COLS * CELL_W) + "px";
    }

    function fitTo(boxW, boxH) {
      if (!boxW || !boxH) return;
      var fs = Math.max(6, Math.min(22, Math.round(boxW / 26)));
      CELL_W = fs * 0.6;
      CELL_H = fs * 1.5;
      FS = fs;
      COLS = Math.max(16, Math.floor(boxW / CELL_W));
      ROWS = Math.max(8, Math.floor(boxH * 0.86 / CELL_H));
      HALF_W = COLS * CELL_W / 2;
      EYE_HY = HALF_W / EYE_AR;
      IRIS_R = EYE_HY * LID_UP * LID_FIT * IRIS_OF_LID;
      PUPIL_R = IRIS_R * PUPIL_OF_IRIS;
      CENTER_SHIFT = (lidAt(0, 1, true) - lidAt(0, 1, false)) / 2;
      pre.style.fontSize = FS + "px";
      pre.style.lineHeight = CELL_H + "px";
      pre.style.height = (ROWS * CELL_H) + "px";
      pre.style.width = (COLS * CELL_W) + "px";
    }

    function anchor(left, top, width, height) {
      if (!pre.parentNode || !width || !height) return;
      var st = pre.parentNode.style;
      st.left = Math.round(left) + "px";
      st.top = Math.round(top) + "px";
      st.width = Math.round(width) + "px";
      st.height = Math.round(height) + "px";
    }

    var tgt = { x: 0, y: 0 };
    var gz = { x: 0, y: 0 };
    var hasPointer = false;
    var forceGaze = opt.gaze === "fixed";
    var freeLook = false, freeUntil = 0;

    var tilt = 0, carry = 0;
    function applyXform() {
      var host = pre.parentNode;
      if (!host) return;
      host.style.transformOrigin = "50% 50%";
      host.style.transform =
        (carry ? "translateX(" + carry + "px) " : "") + (tilt ? "rotate(" + tilt + "deg)" : "");
    }
    function rotate(deg) {
      tilt = +deg || 0;
      applyXform();
    }
    function offsetX(px) {
      carry = +px || 0;
      applyXform();
    }

    function fromPointer(e) {
      if (forceGaze) return;
      var w = window.innerWidth, h = window.innerHeight;
      var nx = (e.clientX - w / 2) / (w / 2);
      var ny = (e.clientY - h / 2) / (h / 2);
      tgt.x = Math.max(-1, Math.min(1, nx * 1.25));
      tgt.y = Math.max(-1, Math.min(1, ny * 1.25));
      hasPointer = true;
    }
    if (!forceGaze) {
      window.addEventListener("mousemove", fromPointer, { passive: true });
      window.addEventListener("mouseleave", function () { hasPointer = false; }, { passive: true });
      window.addEventListener("touchmove", function (e) {
        if (e.touches && e.touches[0]) fromPointer(e.touches[0]);
      }, { passive: true });
    }

    function centerGaze() {
      hasPointer = false;
      tgt.x = 0; tgt.y = 0;
    }
    function lookAt(el) {
      hasPointer = false;
      if (!el || !el.getBoundingClientRect) return;
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      var w = window.innerWidth, h = window.innerHeight;
      var nx = ((r.left + r.width / 2) - w / 2) / (w / 2);
      var ny = ((r.top + r.height / 2) - h / 2) / (h / 2);
      tgt.x = Math.max(-1, Math.min(1, nx * 1.25));
      tgt.y = Math.max(-1, Math.min(1, ny * 1.25));
    }
    function setGaze(x, y) {
      if (freeLook && performance.now() < freeUntil) return;
      hasPointer = false;
      tgt.x = Math.max(-1, Math.min(1, +x || 0));
      tgt.y = Math.max(-1, Math.min(1, +y || 0));
    }

    function pointerLook(clientX, clientY) {
      if (!forceGaze) return;
      var w = window.innerWidth, h = window.innerHeight;
      tgt.x = Math.max(-1, Math.min(1, ((clientX - w / 2) / (w / 2)) * 1.25));
      tgt.y = Math.max(-1, Math.min(1, ((clientY - h / 2) / (h / 2)) * 1.25));
      hasPointer = true;
      freeLook = true;
      freeUntil = performance.now() + 600;
    }

    var blinkN = 0;
    var blinkOff = !!opt.reduced;
    try {
      if (window.matchMedia) {
        var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        blinkOff = mq.matches;
        if (mq.addEventListener) mq.addEventListener("change", function (e) { blinkOff = e.matches; });
      }
    } catch (e) { }
    var nextBlink = performance.now() + 2600, blinkT = -1;
    function blink(now) {
      if (blinkOff) return 1;
      if (blinkT >= 0) {
        var k = (now - blinkT) / 160;
        if (k >= 1) { blinkT = -1; blinkN++; nextBlink = now + 2500 + Math.random() * 3000; return 1; }
        return Math.max(0.06, Math.abs(Math.cos(Math.PI * k)));
      }
      if (now > nextBlink) { blinkT = now; return 0.06; }
      return 1;
    }

    var PH = { BOOT: 0, JITTER: 1, OPEN: 2, IDLE: 3, CLOSING: 4, SHUT: 5 };
    var phase = PH.SHUT;
    var phaseAt = 0;
    var T_BOOT = 620, T_JITTER = 260, T_OPEN = 560;
    var OPEN_LINE = 0.045;
    var T_CLOSE = 780;
    var closeMs = T_CLOSE;
    var openVal = OPEN_LINE;
    var jitterAmp = 0;
    var glitch = 0, glitchNext = 0, redUntil = 0;
    var closedDone = false, closeCb = null;

    function easeOutBack(k) { var c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }

    var JUNK = "#%&$@*!?=+~^<>/\\|_";
    function junkChar() { return JUNK.charAt((Math.random() * JUNK.length) | 0); }

    var openedOnce = false;
    var last = 0, rafOn = false;

    function frame(now) {
      if (!rafOn) return;
      requestAnimationFrame(frameSafe);
      if (now - last < 16) return;
      last = now;

      var el = now - phaseAt;
      if (phase === PH.BOOT && el > T_BOOT) { phase = PH.JITTER; phaseAt = now; }
      else if (phase === PH.JITTER && el > T_JITTER) { phase = PH.OPEN; phaseAt = now; }
      else if (phase === PH.OPEN && el > T_OPEN) { phase = PH.IDLE; phaseAt = now; onOpened(); }

      if (blinkOff && phase < PH.IDLE && phase !== PH.SHUT) { phase = PH.IDLE; phaseAt = now; openVal = 1; onOpened(); }

      if (phase === PH.BOOT) {
        openVal = OPEN_LINE;
      } else if (phase === PH.JITTER) {
        jitterAmp = 1.6 + Math.random() * 2.4;
        openVal = OPEN_LINE + Math.random() * 0.05;
      } else if (phase === PH.OPEN) {
        var k = Math.min(1, el / T_OPEN);
        openVal = OPEN_LINE + (1 - OPEN_LINE) * easeOutBack(k);
      } else if (phase === PH.CLOSING) {
        var kc = Math.min(1, el / closeMs);
        openVal = 1 - (1 - OPEN_LINE) * (kc * kc * (3 - 2 * kc));
        if (kc >= 1) {
          openVal = OPEN_LINE; closedDone = true; phase = PH.SHUT;
          if (closeCb) { var cb = closeCb; closeCb = null; cb(); }
        }
      } else if (phase === PH.SHUT) {
        openVal = OPEN_LINE;
      } else {
        openVal = blink(now);
      }

      if (glitch && now > glitchNext) {
        glitchNext = now + 240 + Math.random() * 320;
        redUntil = now + 45 + Math.random() * 90;
      }
      var glitching = glitch && now < redUntil;
      pre.classList.toggle("is-glitch", glitching);
      if (glitch && !glitching) {
        pre.style.setProperty("--eye-glitch",
          (Math.random() < 0.5 ? "#d94a42" : (Math.random() < 0.5 ? "#d9c25a" : "#dfe6ee")));
      }

      var tx = tgt.x, ty = tgt.y;
      if (!hasPointer && opt.drift !== false) {
        tx += Math.sin(now / 3100) * 0.30;
        ty += Math.cos(now / 4700) * 0.16;
        tx = Math.max(-1, Math.min(1, tx));
        ty = Math.max(-1, Math.min(1, ty));
      }
      var kk = blinkOff ? 1 : (forceGaze ? 0.20 : 0.09);
      gz.x += (tx - gz.x) * kk;
      gz.y += (ty - gz.y) * kk;

      var lines = new Array(ROWS);
      var tmp = { q: 0 };
      var FW = HALF_W, FCH = CELL_H, FSHIFT = CENTER_SHIFT, FH = FW;
      var w = COLS - 1;
      for (var r = 0; r < ROWS; r++) {
        var py = ((r + 0.5) / ROWS * 2 - 1) * (ROWS * FCH / 2) - FSHIFT;
        if (phase === PH.JITTER) py += (Math.random() - 0.5) * jitterAmp * FCH;
        var s = "";
        for (var c = 0; c <= w; c++) {
          var px = ((c + 0.5) / COLS * 2 - 1) * FH;
          eye(px, py, gz.x, gz.y, openVal, tmp);
          if (glitching && Math.random() < 0.035) {
            s += Math.random() < 0.5 ? junkChar() : RAMP.charAt(RAMP.length - 1);
          } else {
            s += RAMP.charAt(Math.round(tmp.q * (RAMP.length - 1)));
          }
        }
        if (s.length < COLS) s += new Array(COLS - s.length + 1).join(" ");
        else if (s.length > COLS) s = s.slice(0, COLS);
        lines[r] = s;
      }
      if (glitching) {
        for (var g = 0; g < ROWS; g++) {
          if (Math.random() < 0.07) {
            var sh = 1 + ((Math.random() * 3) | 0);
            lines[g] = " ".repeat(sh) + lines[g].slice(0, Math.max(0, lines[g].length - sh));
          }
        }
      }
      var out = lines.join("\n");
      if (out !== pre.textContent) pre.textContent = out;

      window.__startEye = {
        gx: gz.x, gy: gz.y, open: openVal, cols: COLS, rows: ROWS,
        cellW: CELL_W, cellH: CELL_H, fs: FS,
        drawn: lines[0] ? lines[0].length : -1,
        first: lines[0] ? lines[0].slice(0, 10) : null,
        reduced: blinkOff, blinks: blinkN, phase: phase, glitch: !!glitching,
        box: (function () { try { var b = pre.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; } catch (e) { return null; } })()
      };
    }

    function frameSafe(now) {
      try { frame(now); }
      catch (e) {
        rafOn = false;
        window.__eyeError = String((e && e.stack) || e);
        if (window.console && console.error) console.error("[ascii-eye] 渲染循环出错:", e);
      }
    }

    function onOpened() {
      if (openedOnce) return;
      openedOnce = true;
      if (typeof opt.onOpened === "function") opt.onOpened();
      try { window.dispatchEvent(new CustomEvent("eye-opened")); } catch (e) { }
    }

    var flow = opt.flow || null;
    var FL = { cols: 0, rows: 0, streams: [], last: 0 };
    var FLOW_CH = "01".split("");
    var FLOW_TAIL = ".:-=+*#%@";
    var FLOW_SPEED = 0.34;
    var FRAGMENTS = [
      "EVENT_ID:UL002-", "泡壁速度0.9c", "最后广播32分钟", "RELAY#0194", "灰烬计划",
      "ANCHOR:漂移", "信噪比不足", "唯一事件ID", "TTL:800ly", "拓扑缺陷",
      "纠错网络", "相变潜热", "中继转发", "威胁列表", "真空衰变"
    ];

    function flowMeasure() {
      if (!flow) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      var fs = 11, ch = fs * 2.1;
      flow.style.fontSize = fs + "px";
      flow.style.lineHeight = ch + "px";
      flow.style.width = "auto";
      var probeTxt = "0000000000000000000000000000000000000000";
      flow.textContent = probeTxt;
      var w40 = 0;
      try {
        var tn0 = flow.firstChild;
        if (tn0 && tn0.nodeType === 3) {
          var r0 = document.createRange();
          r0.setStart(tn0, 0);
          r0.setEnd(tn0, probeTxt.length);
          w40 = r0.getBoundingClientRect().width;
        }
      } catch (e) { w40 = 0; }
      var cw = (w40 > 0 ? w40 / probeTxt.length : fs * 0.62);
      FL.cols = Math.max(8, Math.floor((vw - 4) / cw));
      FL.rows = Math.max(8, Math.floor(vh / ch));
      flow.style.width = (FL.cols * cw) + "px";
      flow.style.height = (FL.rows * ch) + "px";
      FL.streams = [];
      var GAP = 2;
      for (var c = 0; c < FL.cols; c++) {
        var on = (c % GAP !== 0) && ((c * 3) % 5 !== 0);
        var len = 7 + ((c * 7) % 9);
        var ph = (c * 5) % 23;
        FL.streams.push({
          on: on, speed: FLOW_SPEED, len: len,
          head: ph * (FL.rows + len) / 23,
          frag: null, fragDone: false, origLen: len,
          cells: new Array(FL.rows).fill(" ")
        });
      }
      flowDraw();
    }

    function flowDraw() {
      if (!flow) return;
      var out = [];
      for (var r = 0; r < FL.rows; r++) {
        var line = "";
        for (var c = 0; c < FL.cols; c++) {
          var st = FL.streams[c];
          line += st && st.on ? (st.cells[r] || " ") : " ";
        }
        out.push(line);
      }
      flow.textContent = out.join("\n");
    }

    function flowStep() {
      if (!flow || !FL.streams.length) return;
      // 设定文本碎片:偶尔有一条流整段换成设定词句(中继重发的碎片),
      // 概率极低,平时仍是 0/1,不抢戏。
      for (var c = 0; c < FL.cols; c++) {
        var st = FL.streams[c];
        if (!st.on) continue;
        st.head += st.speed;
        if (st.frag && st.head >= st.len && !st.fragDone) {
          st.fragDone = true; st.frag = null;
          st.len = st.origLen; // 还原普通流长度,否则这条流永久变长
        }
        if (!st.frag && Math.random() < 0.0002) {
          st.frag = FRAGMENTS[(Math.random() * FRAGMENTS.length) | 0];
          st.fragDone = false;
          st.origLen = st.len;
          st.len = st.frag.length + 6;
          st.head = 0; // 碎片从头开始滚,否则 head 多半早已越过 len,下一帧就被清掉
        }
        var span = FL.rows + st.len;
        if (st.head >= span) { st.head -= span; if (st.head >= span) st.head = 0; }
        var h = st.head | 0;
        for (var r = 0; r < FL.rows; r++) {
          var d = (h - r) % span;
          if (d < 0) d += span;
          if (d >= st.len) { st.cells[r] = " "; continue; }
          if (Math.random() < 0.18) { st.cells[r] = " "; continue; }
          var k = d / st.len;
          if (st.frag && !st.fragDone) {
            var fi = Math.round(k * (st.frag.length - 1));
            st.cells[r] = k < 0.12 ? " " : st.frag.charAt(Math.max(0, fi));
          } else {
            st.cells[r] = k < 0.35
              ? FLOW_CH[(Math.random() * FLOW_CH.length) | 0]
              : FLOW_TAIL[Math.min(FLOW_TAIL.length - 1, Math.floor(k * FLOW_TAIL.length))];
          }
        }
      }
      flowDraw();
    }

    function flowTick(now) {
      if (!flow || flowOff) return;
      requestAnimationFrame(flowTick);
      if (now - FL.last < 80) return;
      FL.last = now;
      flowStep();
    }
    var flowOff = !!opt.reduced;
    var flowStart = function () {
      if (!flow) return;
      flowMeasure();
      requestAnimationFrame(flowTick);
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { flowMeasure(); });
      }
      setTimeout(flowMeasure, 400);
      setTimeout(flowMeasure, 1200);
    };

    var rt = 0, rt2 = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(measure, 140);
      if (flow) { clearTimeout(rt2); rt2 = setTimeout(flowMeasure, 200); }
    }, { passive: true });

    var api = {
      el: pre,
      resize: measure,
      fitTo: fitTo,
      anchor: anchor,
      rotate: rotate,
      offsetX: offsetX,
      setGaze: setGaze,
      onPointer: pointerLook,
      freeLook: function (on) { freeLook = !!on; if (!on) freeUntil = 0; },
      lookAt: lookAt,
      centerGaze: centerGaze,
      glitch: function (on) { glitch = on ? 1 : 0; glitchNext = 0; if (!on) pre.classList.remove("is-glitch"); },
      isOpen: function () { return phase === PH.IDLE; },
      running: function () { return rafOn; },
      start: function (openOnStart) {
        openedOnce = false;
        closedDone = false;
        measure();
        if (flow) flowStart();
        if (!openOnStart) { phase = PH.SHUT; openVal = OPEN_LINE; }
        else { phase = PH.BOOT; openVal = OPEN_LINE; phaseAt = performance.now(); }
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
      },
      openNow: function () {
        measure();
        if (flow) flowStart();
        phase = PH.IDLE; phaseAt = performance.now(); openVal = 1;
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
        onOpened();
      },
      close: function (cb, ms) {
        closeMs = (typeof ms === "number" && ms > 0) ? ms : T_CLOSE;
        closeCb = cb || null;
        closedDone = false;
        phase = PH.CLOSING;
        phaseAt = performance.now();
        if (!rafOn) { rafOn = true; last = 0; requestAnimationFrame(frameSafe); }
        setTimeout(function () {
          if (closeCb === cb && cb) { var f = closeCb; closeCb = null; f(); }
        }, closeMs + 900);
      },
      closed: function () { return closedDone; },
      T_CLOSE: T_CLOSE,
      state: function () { return window.__startEye || null; },
      stop: function () { rafOn = false; flowOff = true; }
    };
    return api;
  }

  window.AsciiEye = { create: create, RAMP: RAMP };
})();
