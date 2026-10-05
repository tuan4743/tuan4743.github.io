(function () {
  "use strict";

  var cv = document.getElementById("holo-reticle");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var rack = document.getElementById("rack");
  if (!rack) return;
  var holo = document.querySelector(".holo") || rack;

  /* 亮色模式(奶白底)下的墨绿分支:根 data-theme="light" 时,
     扫描框/锁框/十字换墨绿 —— 其余模式维持原青白 */
  function inkColor() {
    try {
      if (document.documentElement.getAttribute("data-theme") === "light") {
        return "rgba(24, 92, 82, 0.88)";
      }
    } catch (e) { }
    return "rgba(234, 243, 255, 0.9)";
  }

  var fade = 1;
  var target = 1;
  var busy = false;
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

  window.addEventListener("cd-select", function () {
    target = 0;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { if (!busy) target = 1; }, 420);
  });
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

    var sx = (num(V("--scan-x", "26%").replace("%", ""), 26) / 100) * w;
    var sy = (num(V("--scan-y", "7%").replace("%", ""), 7) / 100) * h;
    var stem = num(V("--scan-stem", "18px").replace("px", ""), 18);
    var dotR = num(V("--scan-dot", "3px").replace("px", ""), 3);
    ctx.save();
    ctx.strokeStyle = inkColor();
    ctx.fillStyle = inkColor();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - stem * 0.6, sy - stem * 0.6);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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

    var ax = num(V("--cd-ax", "0px").replace("px", ""), cr);
    var ay = num(V("--cd-ay", "0px").replace("px", ""), 0);
    var bx = num(V("--cd-bx", "0px").replace("px", ""), 0);
    var by = num(V("--cd-by", "0px").replace("px", ""), cr);
    if (!followTilt) { ax = cr; ay = 0; bx = 0; by = cr; }
    else {
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

    function onCircle(a) {
      var ca = Math.cos(a), sa = Math.sin(a);
      return [cx + (ca * ax + sa * bx) * R, cy + (ca * ay + sa * by) * R];
    }

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = inkColor();
    ctx.fillStyle = inkColor();
    ctx.lineWidth = 1;

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

    var p1 = onCircle(spin), p2 = onCircle(spin + Math.PI);
    ctx.save();
    ctx.globalAlpha = fade * lockA;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(p1[0], p1[1]);
    ctx.moveTo(sx, sy); ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    ctx.restore();

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
      lockR: +(cr * lockR).toFixed(1),
      drawAx: [Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by)],
      lockA: lockA, spin: speed,
      tilt: followTilt ? "跟随盘面" : "正圆",
      basis: [Math.round(ax), Math.round(ay), Math.round(bx), Math.round(by)],
      scanX: Math.round(sx), scanY: Math.round(sy)
    };
  }

  requestAnimationFrame(frame);
})();
