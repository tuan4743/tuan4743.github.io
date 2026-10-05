(function () {
  "use strict";

  if (window.matchMedia("(pointer: coarse)").matches) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SMOOTH = 0.22;
  var MAGNET = 0.12;
  var PAD = 10;
  var ROT_MAX = 7;
  var VEL_DIV = 5200;
  var SPIN = 24;
  var SPIN_SLOW = 0.12;
  var ROT_EASE = 0.12;
  var SIZE_EASE = 0.16;

  var JITTER = 1.2;
  var DRIFT = [0.29, 0.71];
  var DRIFT_PH = [Math.random() * 6.28, Math.random() * 6.28];
  var ARM = 0.42;
  var ARM_MAX = 26;
  var PULSE = 0.26;
  var PULSE_HZ = 0.85;
  var TICKS = [0.46, 0.78];
  var TICK_LEN = 4.5;
  var GLOW = 7;

  var SELECTOR = [
    "[data-magnetic]", ".menu a", ".nav-right a", ".side-item", ".side-search",
    ".glass-btn", ".repo-card", ".post-entry", ".slot-toggle", ".rack-close",
    ".theme-toggle", ".palette-swatch", ".search-result-item", ".post-row",
    ".tablet__app", ".tablet__recent-item", ".tablet__tag",
    ".hud-act", ".hud-nav__item", ".hud-search input", ".hud-search__clear",
    ".hud-left__mod",
    ".hud-pen__btn", ".hud-pen__range", ".hud-pen__swatch",
    "button:not(.frost-shard)",
    "main.main a:not(.anchor)",
    ".post-tags a", ".post-single a:not(.anchor)", ".post-content a:not(.anchor)",
    ".paginav a", ".post-nav a",
    ".post-footer a", ".entry-footer a", ".breadcrumbs a", ".footer a",
    ".top-link", ".share-buttons a", ".terms-tags a"
  ].join(",");

  var penShape = null, penT = 0;

  /* 亮色模式(奶白底)下线条用墨绿:canvas 里画不出 CSS 变量,
     只能每次绘制时现场读主题。 */
  function isLight() {
    try {
      return document.documentElement.getAttribute("data-theme") === "light";
    } catch (e) { return false; }
  }
  /* 线条主色(替换原来硬编码的白色) */
  function inkLine(alpha) {
    return isLight()
      ? "rgba(20,92,82," + alpha.toFixed(3) + ")"
      : "rgba(255,255,255," + alpha.toFixed(3) + ")";
  }

  function penGlow(on) {
    if (on) { ctx.shadowColor = hexA(COLOR, 0.75); ctx.shadowBlur = GLOW; }
    else { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; }
  }

  function drawCenterDot(x, y, alpha, breath) {
    var r = Math.max(1.6, (DOT / 2) * (breath || 1));
    /* 亮色模式(奶白底)中心点换墨绿,其余模式维持青白 */
    var dotInk = "#eaf3ff";
    try {
      if (document.documentElement.getAttribute("data-theme") === "light") dotInk = "#145c52";
    } catch (e) { }
    ctx.save();
    var g2 = ctx.createRadialGradient(x, y, 0, x, y, r * 4.2);
    g2.addColorStop(0, hexA(COLOR, 0.5));
    g2.addColorStop(1, hexA(COLOR, 0));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, y, r * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dotInk;
    ctx.shadowColor = hexA(COLOR, 0.9);
    ctx.shadowBlur = GLOW + 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPenCursor(ctx, x, y, cfg, t, rotDeg, alpha) {
    t = typeof t === "number" ? t : 1;
    var rad = 0;
    var rotRad = (rotDeg * Math.PI) / 180;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    if (cfg.shape === "x") {
      var arm = Math.max(1, (cfg.size || 10) * t);
      var coreT = Math.min(0.9, Math.max(0, Math.abs(Math.sin(rotRad)) * 0.62 + 0.06));
      ctx.translate(x, y);
      ctx.rotate(rotRad);
      gradLine(0, 0, -arm, -arm, alpha, true, coreT);
      gradLine(0, 0, arm, -arm, alpha, true, coreT);
      gradLine(0, 0, -arm, arm, alpha, true, coreT);
      gradLine(0, 0, arm, arm, alpha, true, coreT);
    } else {
      rad = Math.max(0.8, ((cfg.size || 8) / 2) * t);
      ctx.translate(x, y);
      ctx.rotate(rotRad);
      var gap = Math.PI / 7;
      for (var k = 0; k < 4; k++) {
        var mid = Math.PI / 4 + (k * Math.PI) / 2;
        var f0 = mid - Math.PI / 4 + gap, f1 = mid + Math.PI / 4 - gap;
        penGlow(true);
        ctx.globalAlpha = 0.85 * alpha;
        ctx.strokeStyle = hexA(COLOR, 0.85 * alpha);
        ctx.lineWidth = THICK;
        ctx.beginPath(); ctx.arc(0, 0, rad, f0, f1); ctx.stroke();
        penGlow(false);
        ctx.globalAlpha = 0.9 * alpha;
        ctx.strokeStyle = inkLine(0.9 * alpha);
        ctx.lineWidth = Math.max(0.6, THICK * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, rad, f0, f1); ctx.stroke();
      }
    }
    penGlow(false);
    ctx.restore();
    drawCenterDot(x, y, alpha);
  }

  var cv = document.createElement("canvas");
  cv.className = "magnetic-cursor-cv";
  cv.setAttribute("aria-hidden", "true");
  var st = cv.style;
  st.position = "fixed";
  st.left = "0";
  st.top = "0";
  st.width = "100%";
  st.height = "100%";
  st.pointerEvents = "none";
  st.zIndex = "9999";
  st.opacity = "0";
  st.transition = "opacity .18s ease";
  document.body.appendChild(cv);
  var ctx = cv.getContext("2d");

  function cssVar(name, dflt) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : dflt;
  }
  var COLOR = cssVar("--mc-color", "#7ff0ff");
  var SIZE = parseFloat(cssVar("--mc-size", "34px")) || 34;
  var DOT = parseFloat(cssVar("--mc-dot", "6px")) || 6;
  var THICK = parseFloat(cssVar("--mc-thick", "1px")) || 1;

  var target = null;
  function scriptBox() {
    var s = window.__mcScript;
    if (!s) return null;
    if (typeof s.x !== "number" || typeof s.y !== "number") return null;
    return s;
  }

  var target = null;
  var mx = -999, my = -999;
  var fx = -999, fy = -999;
  var fw = SIZE, fh = SIZE;
  var spinAngle = 0, rot = 0;
  var jx = 0, jy = 0;
  var pulse = 0;
  var fade = 0, fadeTo = 0;
  var last = 0, raf = 0;
  var dpr = 1;

  function angleDelta(to, from) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function resize() {
    var w = document.documentElement.clientWidth || window.innerWidth;
    var h = document.documentElement.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  function gradLine(x1, y1, x2, y2, alpha, glow, coreT) {
    var ct = ((typeof coreT === "number" && isFinite(coreT)) ? Math.max(0, Math.min(0.9, coreT)) : 0);
    var mid = Math.max(ct + 0.02, 0.28);
    var g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, inkLine(0.95 * alpha * (1 - ct)));
    if (ct > 0) g.addColorStop(ct, inkLine(0.95 * alpha));
    g.addColorStop(mid, hexA(COLOR, 0.85 * alpha));
    g.addColorStop(1, hexA(COLOR, 0));
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = THICK;
    ctx.lineCap = "round";
    if (glow) { ctx.shadowColor = hexA(COLOR, 0.75); ctx.shadowBlur = GLOW; }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = inkLine(0.5 * alpha);
    ctx.lineWidth = Math.max(0.6, THICK * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  function hexA(hex, a) {
    var h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "rgba(127,240,255," + a.toFixed(3) + ")";
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a.toFixed(3) + ")";
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.08, (now - last) / 1000) || 0.016;
    last = now;
    var wh = resize();
    var W = wh[0], H = wh[1];
    ctx.clearRect(0, 0, W, H);
    if (mx < -900) return;


    var sb = scriptBox();
    var tx = mx, ty = my, tw = SIZE, th = SIZE;
    var small = false;
    if (sb) {
      tx = sb.x; ty = sb.y; tw = sb.w; th = sb.h;
    } else if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      small = Math.min(r.width, r.height) < 90;
      var mg = small ? 0 : MAGNET;
      tx = cx + (mx - cx) * mg;
      ty = cy + (my - cy) * mg;
      var pad = small ? 4 : Math.min(PAD, Math.max(4, Math.min(r.width, r.height) * 0.16));
      if (typeof window.__mcPad === "number" && isFinite(window.__mcPad)) pad = window.__mcPad;
      tw = r.width + pad * 2;
      th = r.height + pad * 2;
    }

    var k = 1 - Math.pow(1 - (sb ? 0.20 : SMOOTH), dt * 60);
    var px = fx, py = fy;
    fx += (tx - fx) * k;
    fy += (ty - fy) * k;
    var ks = 1 - Math.pow(1 - (sb ? 0.20 : SIZE_EASE), dt * 60);
    fw += (tw - fw) * ks;
    fh += (th - fh) * ks;

    var lean = 0;
    var spinScale = (typeof window.__mcSpinScale === "number" && isFinite(window.__mcSpinScale))
      ? window.__mcSpinScale : 1;
    var lockedNow = !!sb || !!target;
    if (!lockedNow && ROT_MAX > 0 && !reduced) {
      var vx = (fx - px) / dt;
      lean = Math.max(-ROT_MAX, Math.min(ROT_MAX, -vx / VEL_DIV));
    }
    if (!reduced) spinAngle += SPIN * dt * spinScale * (lockedNow ? SPIN_SLOW : 1);
    var targetRot = lockedNow ? 0 : spinAngle + lean;
    rot += angleDelta(targetRot, rot) * (1 - Math.pow(1 - ROT_EASE, dt * 60));

    if (!reduced && !lockedNow) {
      var tt = now / 1000;
      jx = JITTER * 0.5 * (Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0]) + 0.6 * Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1]));
      jy = JITTER * 0.5 * (Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1] + 1.7) + 0.6 * Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0] + 0.9));
      pulse += dt * Math.PI * 2 * PULSE_HZ;
    } else {
      jx = jy = 0;
    }

    fade += (fadeTo - fade) * Math.min(1, dt * 8);
    cv.style.opacity = fade.toFixed(3);
    if (fade < 0.02) return;

    var penCfg = window.__mcPenCfg;
    if (penCfg && penCfg.shape) {
      if (penShape !== penCfg.shape) { penShape = penCfg.shape; penT = 0; }
      penT += (1 - penT) * Math.min(1, dt * 9);
      window.__mc = {
        x: Math.round(fx), y: Math.round(fy), w: Math.round(fw), h: Math.round(fh),
        draw: [+(mx).toFixed(3), +(my).toFixed(3)], mouse: [Math.round(mx), Math.round(my)],
        locked: false, pen: penCfg.shape, rot: +rot.toFixed(2),
        jitter: [0, 0], dot: +(DOT / 2).toFixed(2), fade: +fade.toFixed(2), reduced: reduced
      };
      drawPenCursor(ctx, mx, my, penCfg, penT, rot, fade);
      return;
    }
    penShape = null; penT = 0;

    var bx = fx + jx, by = fy + jy;
    var arm = Math.min(ARM_MAX, Math.max(8, Math.min(fw, fh) * ARM));
    var locked = !!sb || !!target;
    var alpha = (locked ? 1 : 0.82) * fade;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((rot * Math.PI) / 180);
    var hw = fw / 2, hh = fh / 2;
    var corners = [
      [-hw, -hh, 1, 1], [hw, -hh, -1, 1], [-hw, hh, 1, -1], [hw, hh, -1, -1]
    ];
    for (var ci = 0; ci < corners.length; ci++) {
      var c = corners[ci];
      var x = c[0], y = c[1], sx = c[2], sy = c[3];
      gradLine(x, y, x + sx * arm, y, alpha, true);
      gradLine(x, y, x, y + sy * arm, alpha, true);
      for (var ti = 0; ti < TICKS.length; ti++) {
        var t = TICKS[ti];
        var ta = alpha * (0.55 - ti * 0.18);
        ctx.save();
        ctx.shadowColor = hexA(COLOR, 0.5);
        ctx.shadowBlur = 3;
        ctx.strokeStyle = hexA(COLOR, ta);
        ctx.lineWidth = Math.max(0.6, THICK * 0.7);
        ctx.beginPath();
        ctx.moveTo(x + sx * arm * t, y);
        ctx.lineTo(x + sx * arm * t, y - sy * TICK_LEN);
        ctx.moveTo(x, y + sy * arm * t);
        ctx.lineTo(x - sx * TICK_LEN, y + sy * arm * t);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();

    if (!locked) {
      drawCenterDot(mx + jx * 0.5, my + jy * 0.5, fade,
        reduced ? 1 : 1 + Math.sin(pulse) * PULSE);
    }

    window.__mc = {
      x: Math.round(fx), y: Math.round(fy), w: Math.round(fw), h: Math.round(fh),
      draw: [+(bx).toFixed(3), +(by).toFixed(3)],
      mouse: [Math.round(mx), Math.round(my)],
      locked: locked, rot: +rot.toFixed(2), jitter: [+jx.toFixed(3), +jy.toFixed(3)],
      dot: locked ? null : +(DOT / 2 * (1 + Math.sin(pulse) * PULSE)).toFixed(2),
      fade: +fade.toFixed(2), reduced: reduced
    };
  }

  function isSynthetic(e) { return e && e.isTrusted === false; }
  var follow = function (e) {
    mx = e.clientX; my = e.clientY;
    if (fx < -900) { fx = mx; fy = my; }
    fadeTo = 1;
    if (isSynthetic(e)) scriptedMove = true;
    else scriptedMove = false;
    if (window.__mcOnPointer) {
      try { window.__mcOnPointer(mx, my, !isSynthetic(e)); } catch (err) { }
    }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  var scriptedMove = false;
  window.__mcIsScript = function () { return !!scriptBox(); };
  window.addEventListener("pointermove", follow, { passive: true });
  window.addEventListener("mousemove", follow, { passive: true });

  document.addEventListener("mouseover", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (!t || t === target) return;
    target = t;
    document.documentElement.classList.add("magnetic-locked");
  }, true);

  document.addEventListener("mouseout", function (e) {
    if (!target) return;
    var to = e.relatedTarget;
    if (to && target.contains(to)) return;
    target = null;
    document.documentElement.classList.remove("magnetic-locked");
  }, true);

  window.addEventListener("mouseleave", function () { fadeTo = 0; });
  window.addEventListener("resize", resize);

  document.documentElement.classList.add("magnetic-on");
  if (reduced) document.documentElement.classList.add("magnetic-reduced");
  raf = requestAnimationFrame(tick);
})();
