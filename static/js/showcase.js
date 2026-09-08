/* 主页展示层:面板切换 / 时钟 / 背景粒子(HUD 玻璃风格) */
(function () {
  "use strict";

  var panels = document.querySelectorAll(".panel");
  var items = document.querySelectorAll(".side-item[data-panel]");
  var order = ["home", "tech", "archives", "guestbook", "about"];
  var current = "home";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function byName(name) {
    return document.querySelector('.panel[data-panel="' + name + '"]');
  }

  function goto(name, push) {
    if (order.indexOf(name) === -1 || name === current) return;
    var prevEl = byName(current);
    var nextEl = byName(name);
    if (!nextEl) return;

    if (prevEl) {
      prevEl.classList.remove("is-active");
      prevEl.classList.add("is-prev");
      clearTimeout(prevEl.__t);
      prevEl.__t = setTimeout(function () {
        prevEl.classList.remove("is-prev");
      }, reduced ? 0 : 520);
    }
    nextEl.classList.remove("is-prev");
    nextEl.classList.add("is-active");

    items.forEach(function (it) {
      var on = it.getAttribute("data-panel") === name;
      it.classList.toggle("is-active", on);
      if (on) {
        it.setAttribute("aria-current", "page");
      } else {
        it.removeAttribute("aria-current");
      }
    });

    var hud = document.getElementById("hud-panel");
    if (hud) hud.textContent = name.toUpperCase();

    current = name;
    if (push && history.replaceState) {
      history.replaceState(null, "", "#" + name);
    }
  }

  items.forEach(function (it) {
    it.addEventListener("click", function (e) {
      e.preventDefault();
      goto(it.getAttribute("data-panel"), true);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      goto(el.getAttribute("data-goto"), true);
    });
  });

  window.addEventListener("keydown", function (e) {
    if (e.target && (e.target.matches("input, textarea") || e.target.isContentEditable)) return;
    var idx = order.indexOf(current);
    if (e.key === "ArrowRight") {
      goto(order[Math.min(idx + 1, order.length - 1)], true);
    } else if (e.key === "ArrowLeft") {
      goto(order[Math.max(idx - 1, 0)], true);
    }
  });

  window.addEventListener("hashchange", function () {
    var h = location.hash.slice(1);
    if (order.indexOf(h) !== -1 && h !== current) goto(h, false);
  });

  /* 初始面板:支持 #tech 直达 */
  var init = location.hash.slice(1);
  if (order.indexOf(init) !== -1 && init !== "home") {
    var panelEl = byName(init);
    var itemEl = document.querySelector('.side-item[data-panel="' + init + '"]');
    if (panelEl && itemEl) {
      panelEl.classList.add("is-active");
      itemEl.classList.add("is-active");
      itemEl.setAttribute("aria-current", "page");
      current = init;
      var hud2 = document.getElementById("hud-panel");
      if (hud2) hud2.textContent = init.toUpperCase();
    }
  }

  /* 时钟 */
  var clock = document.getElementById("hud-clock");
  if (clock) {
    function pad(n) {
      return String(n).padStart(2, "0");
    }
    function tick() {
      var d = new Date();
      clock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ===== 背景 Canvas:漂浮粒子 + 近邻连线 ===== */
  var canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, DPR = 1;
  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var accent = "34,211,238";

  function readAccent() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    if (!v) return;
    var m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (m) accent = m[1] + "," + m[2] + "," + m[3];
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawn() {
    var n = Math.min(56, Math.max(24, Math.floor((W * H) / 30000)));
    particles = [];
    for (var i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.26,
        vy: (Math.random() - 0.5) * 0.26,
        r: Math.random() * 1.5 + 0.7
      });
    }
  }

  var running = false;

  function frame() {
    if (document.hidden) return;
    ctx.clearRect(0, 0, W, H);

    var i, j, p, q, dx, dy, d;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;
    }

    /* 近邻连线 */
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      for (j = i + 1; j < particles.length; j++) {
        q = particles[j];
        dx = p.x - q.x;
        dy = p.y - q.y;
        d = dx * dx + dy * dy;
        if (d < 12100) { /* 110px */
          var a = (1 - d / 12100) * 0.16;
          ctx.strokeStyle = "rgba(" + accent + "," + a.toFixed(3) + ")";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
      /* 与鼠标的连线 */
      dx = p.x - mouse.x;
      dy = p.y - mouse.y;
      d = dx * dx + dy * dy;
      if (d < 32400) {
        var am = (1 - d / 32400) * 0.22;
        ctx.strokeStyle = "rgba(" + accent + "," + am.toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    /* 粒子 */
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      ctx.fillStyle = "rgba(" + accent + ",0.55)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  if (!reduced) {
    readAccent();
    resize();
    spawn();
    window.addEventListener("resize", function () {
      resize();
      spawn();
    });
    window.addEventListener("mousemove", function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener("mouseleave", function () {
      mouse.x = -9999;
      mouse.y = -9999;
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });
    running = true;
    requestAnimationFrame(frame);
  }
})();
