/* ============================================================
   磁力光标 v3:四角锁定框(canvas 版)
   ─────────────────────────────────────────────────────────────
   为什么从 DOM 换成 canvas:要做"线内侧亮、往外衰减"的渐变 + 青色外发光,
   而 CSS 的 border 没法上渐变(四角的 i 元素就是靠 border 画的)。
   画在 canvas 上以后,渐变色差、发光、刻度、呼吸、抖动都好控制。

   画什么(用户点名要的四条):
     ① 四条角线:每根从角点出发,线性渐变到透明(内亮外淡)+ 青色外发光(shadowBlur)
     ② 中心点:呼吸缩放(半径按正弦循环)+ 一圈柔光;锁定时让位给框体
     ③ 微抖动:整框做极小的随机位移(平滑随机游走,不是每帧乱跳)
        —— 模拟"光学信号不稳定",不要死钉在一个位置
     ④ 辅助刻度:每个角的两条边旁边各加几根细小垂直线(雷达/光学瞄准那种)

   行为沿用 v2:向鼠标平滑收敛、按横向速度轻微倾斜、慢速自转、
   悬停到可点元素上时"磁吸"放大并转正、触屏/减少动效时不启用。
   CSS 里那套 .magnetic-cursor / .magnetic-dot 的旧样式现在没人用了(元素不再创建),
   但 html.magnetic-on / .magnetic-locked / .magnetic-reduced 这几个 class 照旧挂 ——
   "隐藏系统光标"和别处的样式判断还靠它们。
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(pointer: coarse)").matches) return;   /* 触屏不启用 */
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 行为参数(v2 沿用)---------- */
  var SMOOTH = 0.22;      /* 框体跟随平滑度(0~1,越小越"拖") */
  var MAGNET = 0.12;      /* 磁吸强度(0=完全吸附目标中心,1=完全跟手) */
  var PAD = 10;           /* 包住目标时的外扩(px) */
  var ROT_MAX = 7;        /* 速度倾斜最大角度(度),0 = 不倾斜 */
  var VEL_DIV = 5200;     /* 速度→角度换算除数 */
  var SPIN = 24;          /* 实时自转速度(度/秒),0 = 不自转 */
  var SPIN_SLOW = 0.12;   /* 锁定目标时自转的衰减系数 */
  var ROT_EASE = 0.12;    /* 旋转角平滑收敛速度 */
  var SIZE_EASE = 0.16;   /* 框体大小收敛速度(原来靠 CSS 的 0.18s 过渡)*/

  /* ---------- 新增:外观参数 ---------- */
  var JITTER = 1.2;       /* 微抖动幅度(px):整框的随机漂移上限 */
  var DRIFT = [0.29, 0.71];   /* 两个漂移频率(Hz):叠加起来像"信号不稳"的慢漂 */
  var DRIFT_PH = [Math.random() * 6.28, Math.random() * 6.28];
  var ARM = 0.42;         /* 角线长度 = 框体短边 × 这个比例 */
  var ARM_MAX = 26;       /* 角线最长(px) */
  var PULSE = 0.26;       /* 中心点呼吸幅度(半径的比例)*/
  var PULSE_HZ = 0.85;    /* 呼吸频率(Hz)*/
  var TICKS = [0.46, 0.78];   /* 辅助刻度落在角线的哪个位置(比例)*/
  var TICK_LEN = 4.5;     /* 刻度短线长度(px)*/
  var GLOW = 7;           /* 外发光半径(px)*/

  var SELECTOR = [
    "[data-magnetic]", ".menu a", ".nav-right a", ".side-item", ".side-search",
    ".glass-btn", ".repo-card", ".post-entry", ".slot-toggle", ".rack-close",
    ".theme-toggle", ".palette-swatch", ".search-result-item", ".post-row", "button"
  ].join(",");

  /* ---------- DOM:一张铺满视口的画布 ---------- */
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

  /* 取值:优先 --mc-*(站点调色板),取不到就用兜底 */
  function cssVar(name, dflt) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : dflt;
  }
  var COLOR = cssVar("--mc-color", "#7ff0ff");    /* 主打青色(和其它 HUD 一致)*/
  var SIZE = parseFloat(cssVar("--mc-size", "34px")) || 34;
  var DOT = parseFloat(cssVar("--mc-dot", "6px")) || 6;
  var THICK = parseFloat(cssVar("--mc-thick", "1px")) || 1;

  var target = null;
  var mx = -999, my = -999;        /* 鼠标真实坐标(中心点用,严格贴手)*/
  var fx = -999, fy = -999;        /* 框体坐标(平滑)*/
  var fw = SIZE, fh = SIZE;        /* 框体尺寸(平滑)*/
  var spinAngle = 0, rot = 0;
  var jx = 0, jy = 0;              /* 微抖动偏移(平滑随机游走)*/
  var pulse = 0;                   /* 呼吸相位*/
  var fade = 0, fadeTo = 0;        /* 显隐淡入淡出*/
  var last = 0, raf = 0;
  var dpr = 1;

  function angleDelta(to, from) {
    var d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }

  /* 一条带渐变 + 外发光的线:从 (x1,y1) 亮,到 (x2,y2) 淡出 */
  function gradLine(x1, y1, x2, y2, alpha, glow) {
    var g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, "rgba(255,255,255," + (0.95 * alpha).toFixed(3) + ")");
    g.addColorStop(0.28, hexA(COLOR, 0.85 * alpha));
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
    /* 再压一层很淡的亮芯:线看着"内部亮"*/
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 * alpha).toFixed(3) + ")";
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

    /* ---- 目标点与尺寸:磁吸时贴向目标中心 ---- */
    var tx = mx, ty = my, tw = SIZE, th = SIZE;
    if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      tx = cx + (mx - cx) * MAGNET;
      ty = cy + (my - cy) * MAGNET;
      tw = r.width + PAD * 2;
      th = r.height + PAD * 2;
    }

    /* ---- 平滑收敛(帧率无关)---- */
    var k = 1 - Math.pow(1 - SMOOTH, dt * 60);
    var px = fx, py = fy;
    fx += (tx - fx) * k;
    fy += (ty - fy) * k;
    var ks = 1 - Math.pow(1 - SIZE_EASE, dt * 60);
    fw += (tw - fw) * ks;
    fh += (th - fh) * ks;

    /* ---- 旋转:自转 + 速度倾斜;锁定时转正 ---- */
    var lean = 0;
    if (!target && ROT_MAX > 0 && !reduced) {
      var vx = (fx - px) / dt;
      lean = Math.max(-ROT_MAX, Math.min(ROT_MAX, -vx / VEL_DIV));
    }
    if (!reduced) spinAngle += SPIN * dt * (target ? SPIN_SLOW : 1);
    var targetRot = target ? 0 : spinAngle + lean;
    rot += angleDelta(targetRot, rot) * (1 - Math.pow(1 - ROT_EASE, dt * 60));

    /* ---- ③ 微抖动:两个不同频率的正弦叠加(平滑慢漂,不是每帧乱跳)---- */
    if (!reduced) {
      var tt = now / 1000;
      jx = JITTER * 0.5 * (Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0]) + 0.6 * Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1]));
      jy = JITTER * 0.5 * (Math.sin(tt * DRIFT[1] * 6.283 + DRIFT_PH[1] + 1.7) + 0.6 * Math.sin(tt * DRIFT[0] * 6.283 + DRIFT_PH[0] + 0.9));
      pulse += dt * Math.PI * 2 * PULSE_HZ;
    } else {
      jx = jy = 0;
    }

    /* ---- 显隐 ---- */
    fade += (fadeTo - fade) * Math.min(1, dt * 8);
    cv.style.opacity = fade.toFixed(3);
    if (fade < 0.02) return;

    /* ---- 画框 ---- */
    var bx = fx + jx, by = fy + jy;
    var arm = Math.min(ARM_MAX, Math.max(8, Math.min(fw, fh) * ARM));
    var locked = !!target;
    var alpha = (locked ? 1 : 0.82) * fade;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((rot * Math.PI) / 180);
    var hw = fw / 2, hh = fh / 2;
    /* 四个角:每个角两条边(从角点往里画,内亮外淡)*/
    var corners = [
      [-hw, -hh, 1, 1], [hw, -hh, -1, 1], [-hw, hh, 1, -1], [hw, hh, -1, -1]
    ];
    corners.forEach(function (c) {
      var x = c[0], y = c[1], sx = c[2], sy = c[3];
      gradLine(x, y, x + sx * arm, y, alpha, true);          /* 横边 */
      gradLine(x, y, x, y + sy * arm, alpha, true);          /* 竖边 */
      /* ④ 辅助刻度:两条边旁边各几根细小垂直线 */
      TICKS.forEach(function (t, i) {
        var ta = alpha * (0.55 - i * 0.18);
        ctx.save();
        ctx.shadowColor = hexA(COLOR, 0.5);
        ctx.shadowBlur = 3;
        ctx.strokeStyle = hexA(COLOR, ta);
        ctx.lineWidth = Math.max(0.6, THICK * 0.7);
        ctx.beginPath();
        /* 横边上的刻度(往框外挑)*/
        ctx.moveTo(x + sx * arm * t, y);
        ctx.lineTo(x + sx * arm * t, y - sy * TICK_LEN);
        /* 竖边上的刻度(往框外挑)*/
        ctx.moveTo(x, y + sy * arm * t);
        ctx.lineTo(x - sx * TICK_LEN, y + sy * arm * t);
        ctx.stroke();
        ctx.restore();
      });
    });
    ctx.restore();

    /* ---- ② 中心点:呼吸缩放 + 柔光(锁定时让位给框体)---- */
    if (!locked) {
      var rr = (DOT / 2) * (1 + (reduced ? 0 : Math.sin(pulse) * PULSE));
      var px2 = mx + jx * 0.5, py2 = my + jy * 0.5;   /* 点也跟着抖一点点(幅度减半)*/
      var g2 = ctx.createRadialGradient(px2, py2, 0, px2, py2, rr * 4.2);
      g2.addColorStop(0, hexA(COLOR, 0.5));
      g2.addColorStop(1, hexA(COLOR, 0));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(px2, py2, rr * 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#eaf3ff";
      ctx.shadowColor = hexA(COLOR, 0.9);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px2, py2, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    window.__mc = {
      x: Math.round(fx), y: Math.round(fy), w: Math.round(fw), h: Math.round(fh),
      /* 实际画出来的位置 = 平滑位置 + 微抖动(排障/验收看这个)*/
      draw: [+(bx).toFixed(3), +(by).toFixed(3)],
      mouse: [Math.round(mx), Math.round(my)],
      locked: locked, rot: +rot.toFixed(2), jitter: [+jx.toFixed(3), +jy.toFixed(3)],
      dot: locked ? null : +(DOT / 2 * (1 + Math.sin(pulse) * PULSE)).toFixed(2),
      fade: +fade.toFixed(2), reduced: reduced
    };
  }

  /* ---------- 事件 ---------- */
  window.addEventListener("mousemove", function (e) {
    mx = e.clientX; my = e.clientY;
    if (fx < -900) { fx = mx; fy = my; }
    fadeTo = 1;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

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
