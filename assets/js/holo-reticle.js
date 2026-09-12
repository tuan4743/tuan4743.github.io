/* ============================================================
   锁定圆 + 扫描节点(独立 canvas 层)
   ─────────────────────────────────────────────────────────────
   画什么:
     · 扫描节点:从左侧框右上角节点往右下伸一条短线,末端一个点(永远显示,不隐藏)
     · 锁定圆:盘旁边一圈淡虚线,会【跟着盘面一起倾斜】(用盘面的投影基向量画椭圆)
     · 从节点发两条虚线,连到圆上正好相对的两点,两点沿圆缓缓运动
   什么时候隐藏(只隐藏圆 + 连线,节点不隐藏):
     · 滚轮切换 CD 时
     · 插入光盘动画期间(由 intro.js 广播 cd-busy)
   参数全在 holo.css 的 .holo 里:--scan-* / --lock-*
   ============================================================ */
(function () {
  "use strict";

  var cv = document.getElementById("holo-reticle");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var rack = document.getElementById("rack");
  if (!rack) return;
  var holo = document.querySelector(".holo") || rack;   /* 变量定义在这里 */

  var fade = 1;             /* 圆/连线的透明系数 */
  var target = 1;
  var busy = false;         /* 插入动画中 */
  var spin = 0;
  var last = 0;
  var timer = null;

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  var cs = null;
  function V(name, d) {
    var v = cs ? cs.getPropertyValue(name) : "";
    if (!v || !v.trim()) v = getComputedStyle(holo).getPropertyValue(name);
    return v && v.trim() ? v.trim() : d;
  }

  /* 换 CD:淡出,停稳后淡回 */
  window.addEventListener("cd-select", function () {
    target = 0;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { if (!busy) target = 1; }, 420);
  });
  /* 插入动画:整段保持隐藏,结束后淡回 */
  window.addEventListener("cd-busy", function (e) {
    busy = !!(e && e.detail);
    target = busy ? 0 : 1;
    if (busy && timer) { clearTimeout(timer); timer = null; }
  });

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = rack.clientWidth, h = rack.clientHeight;
    if (w < 2 || h < 2) return false;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    if (!document.body.classList.contains("scene-open")) return;
    if (!resize()) return;
    cs = getComputedStyle(holo);
    var w = rack.clientWidth, h = rack.clientHeight;
    ctx.clearRect(0, 0, w, h);

    /* ---- 1. 扫描节点:永远画(不参与隐藏)---- */
    var sx = (num(V("--scan-x", "26%").replace("%", ""), 26) / 100) * w;
    var sy = (num(V("--scan-y", "7%").replace("%", ""), 7) / 100) * h;
    var stem = num(V("--scan-stem", "18px").replace("px", ""), 18);
    var dotR = num(V("--scan-dot", "3px").replace("px", ""), 3);
    ctx.save();
    ctx.strokeStyle = "rgba(234, 243, 255, 0.9)";
    ctx.fillStyle = "rgba(234, 243, 255, 0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - stem * 0.6, sy - stem * 0.6);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* ---- 2. 圆 + 连线(会被隐藏)---- */
    /* 按时间线性淡入淡出(不按帧插值 —— 低帧率下也能准时到位)*/
    var dur = target < fade ? 0.12 : 0.28;
    fade += (target > fade ? 1 : -1) * (dt / dur);
    fade = Math.max(0, Math.min(1, fade));
    if (fade < 0.01) {
      window.__reticle = { fade: +fade.toFixed(2), busy: busy, scanX: Math.round(sx), scanY: Math.round(sy) };
      return;
    }

    var cx = num(V("--cd-x", "0px").replace("px", ""), 0) + num(V("--lock-cx", "0px").replace("px", ""), 0);
    var cy = num(V("--cd-y", "0px").replace("px", ""), 0) + num(V("--lock-cy", "0px").replace("px", ""), 0);
    var cr = num(V("--cd-r", "0px").replace("px", ""), 0);
    if (cr < 4) return;

    var lockR = num(V("--lock-r", "1.06"), 1.06);
    var lockA = num(V("--lock-a", "0.32"), 0.32);
    var dash = V("--lock-dash", "6 10").split(/\s+/).map(Number);
    var speed = num(V("--lock-spin", "0.25"), 0.25);
    var followTilt = num(V("--lock-follow-tilt", "1"), 1) > 0.5;
    spin += dt * speed;

    /* 盘面投影基向量(单位是"一个盘半径"在屏幕上的位移)*/
    var ax = num(V("--cd-ax", "0px").replace("px", ""), cr);
    var ay = num(V("--cd-ay", "0px").replace("px", ""), 0);
    var bx = num(V("--cd-bx", "0px").replace("px", ""), 0);
    var by = num(V("--cd-by", "0px").replace("px", ""), cr);
    if (!followTilt) { ax = cr; ay = 0; bx = 0; by = cr; }
    else {
      /* ★ 基向量只用来定"方向和压扁比例",长度统一缩放到 --cd-r
         (基向量的绝对长度曾导致锁定圆大了一倍多,这里彻底锚定) */
      var la = Math.sqrt(ax * ax + ay * ay);
      var lb = Math.sqrt(bx * bx + by * by);
      var avg = (la + lb) / 2;
      if (avg > 0.001) {
        var sc = cr / avg;
        ax *= sc; ay *= sc; bx *= sc; by *= sc;
      } else {
        ax = cr; ay = 0; bx = 0; by = cr;
      }
    }
    var R = lockR;

    /* 圆上一点(角度 a)→ 屏幕坐标:center + (cos a * A + sin a * B) * R */
    function onCircle(a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      return [cx + (ca * ax + sa * bx) * R, cy + (ca * ay + sa * by) * R];
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = "rgba(234, 243, 255, 0.9)";
    ctx.fillStyle = "rgba(234, 243, 255, 0.9)";
    ctx.lineWidth = 1;

    /* 锁定圆:用变换把单位圆画成椭圆的虚线 */
    /* ★ 关键:ctx.transform() 会把坐标系放大 sc 倍,而线宽/虚线节拍也一起被放大
       —— 之前这里把 1px 的线放大成了约 190px,于是整整一个"实心大圆盘"。
       所以在变换空间里要把它们都除以 sc,屏幕上才是 1px 的虚线。 */
    var sc = Math.max(1, cr * R);
    ctx.save();
    ctx.globalAlpha = fade * lockA;
    ctx.setLineDash(dash.map(function (v) { return v / sc; }));
    ctx.lineWidth = 1 / sc;
    ctx.beginPath();
    ctx.transform(ax * R, ay * R, bx * R, by * R, cx, cy);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* 两条虚线:节点 → 圆上相对的两点 */
    var p1 = onCircle(spin), p2 = onCircle(spin + Math.PI);
    ctx.save();
    ctx.globalAlpha = fade * lockA;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(p1[0], p1[1]);
    ctx.moveTo(sx, sy); ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    ctx.restore();

    /* 那两个点 */
    ctx.globalAlpha = fade * Math.min(1, lockA + 0.25);
    [p1, p2].forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], dotR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    window.__reticle = {
      fade: +fade.toFixed(2), busy: busy,
      cd: [Math.round(cx), Math.round(cy), Math.round(cr)],
      lockR: +(cr * lockR).toFixed(1),                /* 锁定圆的主半径(应≈盘半径×lock-r)*/
      drawAx: [Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by)],
      lockA: lockA, spin: speed,
      tilt: followTilt ? "跟随盘面" : "正圆",
      basis: [Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by)],
      scanX: Math.round(sx), scanY: Math.round(sy)
    };
  }

  requestAnimationFrame(frame);
})();
