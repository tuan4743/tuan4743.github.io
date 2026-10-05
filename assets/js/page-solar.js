(function () {
  "use strict";

  var NARROW = 780;
  var GAP = 16;
  var CLICK_TOL = 6;
  var ORBIT = 0.00095;
  var PITCH_K = 0.45;
  var BASE = 0.30;
  var BASY = 0.22;
  var SCALE_K = 0.95;
  function motion(d) { return 0.06 + 0.30 * (isFinite(d) ? d : 0.7); }
  var PHOTONS = 70;
  var STAR_KEY = -2;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function attrNum(el, name, dflt) {
    var v = parseFloat(el && el.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function cssNum(el, name, dflt, lo, hi) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isFinite(v) && v >= lo && v <= hi ? v : dflt;
  }
  function mk(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function build(root, key) {
    var sun = root.querySelector(".solar-node--star");
    var sunVideo = root.querySelector(".solar-sun-video");
    var starHit = root.querySelector(".solar-planet--star");
    var starCard = root.querySelector(".solar-card--star");
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var balls = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var imgs = nodes.map(function (n) { return n.querySelector(".solar-tex"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    var TUNE = window.__solarTune || (window.__solarTune = {});
    function cfgOf(node) {
      var id = node.getAttribute("data-code") || "";
      var base = {
        x: attrNum(node, "data-x", 0.5), y: attrNum(node, "data-y", 0.5),
        w: attrNum(node, "data-w", 0.12), rot: attrNum(node, "data-rot", 0),
        depth: attrNum(node, "data-depth", 0.7)
      };
      var t = TUNE[id];
      if (t) for (var k in t) if (isFinite(t[k])) base[k] = t[k];
      return base;
    }

    var active = false, onIndex = -1, geo = [], narrow = false, sunCfg = null;

    var cam = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: false, px: 0, py: 0, bx: 0, by: 0, moved: 0, dx: 0, dy: 0 };
    var camRaf = 0, camLast = 0;
    var yawMax = 0.16, pitchMax = 0.10, camTau = 110;

    function project(g, W, H) {
      var bx = g.x - W * 0.5, by = g.y - H * 0.5;
      var sx = Math.sin(cam.yaw), sy = Math.sin(cam.pitch);
      var m = motion(g.depth);
      var dx = -sx * BASE * W * m;
      var dy = -sy * BASY * H * m;
      var s = 1 + (bx / W) * sx * SCALE_K + (by / H) * sy * SCALE_K * 0.6;
      return { dx: dx, dy: dy, s: Math.max(0.5, Math.min(2, s)) };
    }

    function applyCam() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2) return;
      var i, p;
      p = project({ x: W * 0.5, y: H * 0.5, depth: 0.06 }, W, H);
      cam.dx = p.dx; cam.dy = p.dy;
      root.style.setProperty("--cam-x", p.dx.toFixed(2) + "px");
      root.style.setProperty("--cam-y", p.dy.toFixed(2) + "px");
      if (sun && geo.sun) {
        p = project(geo.sun, W, H);
        geo.sun.dx = p.dx; geo.sun.dy = p.dy; geo.sun.s = p.s;
        var ball = sun.querySelector(".solar-sun");
        if (ball) {
          ball.style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
          ball.style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
          ball.style.setProperty("--cam-s", p.s.toFixed(4));
        }
        if (starHit) {
          starHit.style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
          starHit.style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
          starHit.style.setProperty("--cam-s", p.s.toFixed(4));
        }
      }
      for (i = 0; i < nodes.length; i++) {
        if (!geo[i]) continue;
        p = project(geo[i], W, H);
        geo[i].dx = p.dx; geo[i].dy = p.dy; geo[i].s = p.s;
        nodes[i].style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-s", p.s.toFixed(4));
      }
      if (onIndex >= 0 || onIndex === STAR_KEY) refreshCard();
    }
    function camFrame(now) {
      camRaf = 0;
      var dt = Math.min(64, Math.max(1, now - camLast));
      camLast = now;
      var a = 1 - Math.exp(-dt / camTau);
      var dy = cam.yawT - cam.yaw, dp = cam.pitchT - cam.pitch;
      if (Math.abs(dy) < 1e-5 && Math.abs(dp) < 1e-5) { cam.yaw = cam.yawT; cam.pitch = cam.pitchT; }
      else { cam.yaw += dy * a; cam.pitch += dp * a; }
      applyCam();
      if (cam.yaw !== cam.yawT || cam.pitch !== cam.pitchT) camRaf = requestAnimationFrame(camFrame);
    }
    function kickCam() { if (!camRaf && active) { camLast = performance.now(); camRaf = requestAnimationFrame(camFrame); } }
    function stopCam() { if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; } }

    var phCv = null, phCtx = null, phSprite = null, ph = [], phRaf = 0, phLast = 0;
    function newPhoton(rand) {
      return {
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 2.6,
        depth: 0.06 + Math.random() * 0.4,
        dur: 1600 + Math.random() * 2600,
        t: rand ? -Math.random() * 2600 : -Math.random() * 500,
        drift: (Math.random() - 0.5) * 0.00004
      };
    }
    var novaSpriteCv = null;
    var nova = { next: 2500 + Math.random() * 6000, t: -1, dur: 0, x: 0, y: 0, size: 0, spin: 0 };
    var NOVA_DUR = 320;
    function novaBuild() {
      var S = 160, c = S / 2;
      novaSpriteCv = document.createElement("canvas");
      novaSpriteCv.width = novaSpriteCv.height = S;
      var g = novaSpriteCv.getContext("2d");
      var core = g.createRadialGradient(c, c, 0, c, c, S * 0.17);
      core.addColorStop(0, "rgba(255,255,255,1)");
      core.addColorStop(0.3, "rgba(215,240,255,0.8)");
      core.addColorStop(1, "rgba(150,205,255,0)");
      g.fillStyle = core;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "lighter";
      for (var i = 0; i < 2; i++) {
        g.save();
        g.translate(c, c);
        g.rotate(i * Math.PI / 2);
        var lg = g.createLinearGradient(-c, 0, c, 0);
        lg.addColorStop(0, "rgba(170,215,255,0)");
        lg.addColorStop(0.5, "rgba(240,250,255,0.95)");
        lg.addColorStop(1, "rgba(170,215,255,0)");
        g.fillStyle = lg;
        g.fillRect(-c, -S * 0.011, S, S * 0.022);
        g.restore();
      }
      g.globalCompositeOperation = "source-over";
    }
    function novaSpawn() {
      var left = Math.random() < 0.5;
      var top = Math.random() < 0.5;
      nova.x = left ? 0.05 + Math.random() * 0.17 : 0.78 + Math.random() * 0.17;
      nova.y = top ? 0.08 + Math.random() * 0.16 : 0.74 + Math.random() * 0.18;
      nova.size = 26 + Math.random() * 26;
      nova.spin = (Math.random() - 0.5) * 0.6;
      nova.t = 0;
      nova.dur = NOVA_DUR * (0.85 + Math.random() * 0.3);
      nova.next = 4000 + Math.random() * 7000;
    }
    function novaDraw(W, H) {
      if (!novaSpriteCv) return;
      var k = nova.t / nova.dur;
      var a = k < 0.15 ? k / 0.15 : Math.pow(1 - (k - 0.15) / 0.85, 2);
      if (a <= 0.01) return;
      var x = nova.x * W + cam.dx * 0.05;
      var y = nova.y * H + cam.dy * 0.05;
      var R = nova.size * (1 + 0.5 * k);
      phCtx.save();
      phCtx.globalCompositeOperation = "lighter";
      phCtx.translate(x, y);
      phCtx.rotate(nova.spin);
      phCtx.globalAlpha = Math.min(1, a * 1.15);
      phCtx.drawImage(novaSpriteCv, -R, -R, R * 2, R * 2);
      var rk = Math.max(0, (k - 0.1) / 0.9);
      if (rk < 1) {
        phCtx.globalAlpha = (1 - rk) * 0.35 * a;
        phCtx.strokeStyle = "rgba(200,235,255,1)";
        phCtx.lineWidth = 1;
        phCtx.beginPath();
        phCtx.arc(0, 0, R * (0.5 + rk * 1.6), 0, Math.PI * 2);
        phCtx.stroke();
      }
      phCtx.restore();
    }

    function photonInit() {
      phCv = document.createElement("canvas");
      phCv.className = "solar-photons";
      phCv.setAttribute("aria-hidden", "true");
      root.insertBefore(phCv, root.firstChild.nextSibling);
      phCtx = phCv.getContext("2d");
      var R = 32;
      phSprite = document.createElement("canvas");
      phSprite.width = phSprite.height = R * 2;
      var g = phSprite.getContext("2d");
      var grd = g.createRadialGradient(R, R, 0, R, R, R);
      grd.addColorStop(0, "rgba(216, 242, 255, 1)");
      grd.addColorStop(0.35, "rgba(170, 220, 255, 0.5)");
      grd.addColorStop(1, "rgba(140, 200, 255, 0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(R, R, R, 0, Math.PI * 2);
      g.fill();
      if (!novaSpriteCv) novaBuild();
      for (var i = 0; i < PHOTONS; i++) ph.push(newPhoton(true));
    }
    function photonFrame(now) {
      phRaf = 0;
      if (!active || narrow || !phCtx) return;
      var dt = phLast ? Math.min(80, now - phLast) : 16;
      phLast = now;
      var W = root.clientWidth, H = root.clientHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (phCv.width !== Math.round(W * dpr) || phCv.height !== Math.round(H * dpr)) {
        phCv.width = Math.round(W * dpr);
        phCv.height = Math.round(H * dpr);
      }
      phCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      phCtx.clearRect(0, 0, W, H);
      phCtx.globalCompositeOperation = "lighter";
      for (var i = 0; i < ph.length; i++) {
        var p = ph[i];
        p.t += dt;
        if (p.t > p.dur) { ph[i] = newPhoton(false); p = ph[i]; }
        if (p.t < 0) continue;
        var a = Math.sin(Math.PI * (p.t / p.dur));
        if (a <= 0.01) continue;
        var px = (p.x + p.drift * p.t) * W + cam.dx * p.depth;
        var py = p.y * H + cam.dy * p.depth;
        var rr = p.r * (1 + 0.25 * Math.sin(p.t / 700 + i));
        phCtx.globalAlpha = Math.min(1, a * 0.85);
        phCtx.drawImage(phSprite, px - rr * 1.5, py - rr * 1.5, rr * 3, rr * 3);
      }
      if (nova.t < 0) {
        nova.next -= dt;
        if (nova.next <= 0) novaSpawn();
      } else {
        nova.t += dt;
        if (nova.t > nova.dur) nova.t = -1;
        else novaDraw(W, H);
      }
      phCtx.globalAlpha = 1;
      phCtx.globalCompositeOperation = "source-over";
      phRaf = requestAnimationFrame(photonFrame);
    }
    function photonStart() {
      if (narrow) return;
      if (!phCv) photonInit();
      if (!phRaf) { phLast = 0; phRaf = requestAnimationFrame(photonFrame); }
    }
    function photonStop() { if (phRaf) { cancelAnimationFrame(phRaf); phRaf = 0; } }

    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      closeCards();
      yawMax = cssNum(root, "--cam-yaw", 0.16, 0, 1);
      pitchMax = cssNum(root, "--cam-pitch", 0.10, 0, 1);
      camTau = cssNum(root, "--cam-tau", 110, 10, 900);

      sunCfg = {
        x: attrNum(sun, "data-x", 0.19), y: attrNum(sun, "data-y", 0.34),
        w: attrNum(sun, "data-w", 0.26), depth: attrNum(sun, "data-depth", 0.02),
        sphere: attrNum(sun, "data-sphere", 0.52)
      };
      var st = TUNE.__sun;
      if (st) for (var k in st) if (isFinite(st[k])) sunCfg[k] = st[k];
      if (sun) {
        sun.style.left = (sunCfg.x * W).toFixed(1) + "px";
        sun.style.top = (sunCfg.y * H).toFixed(1) + "px";
      }
      var sunElW = sunCfg.w * W;
      if (sunVideo && sunCfg.sphere > 0.05) sunElW = sunElW / sunCfg.sphere;
      root.style.setProperty("--sun-w", sunElW.toFixed(1) + "px");
      root.style.setProperty("--sun-hit", Math.max(56, sunCfg.w * W * 1.16).toFixed(1) + "px");
      var sunBallEl = sun ? sun.querySelector(".solar-sun") : null;
      if (sunBallEl) sunBallEl.style.setProperty("--sun-mask-rp", (sunCfg.w * W * 0.5 * 1.32).toFixed(1) + "px");
      geo.sun = {
        x: sunCfg.x * W, y: sunCfg.y * H, depth: sunCfg.depth,
        r: sunCfg.w * W / 2, rh: sunCfg.w * W / 2, dx: 0, dy: 0, s: 1
      };
      root.__sunElW = sunElW;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var c = cfgOf(n);
        var w = Math.max(8, c.w * W);
        n.style.left = (c.x * W).toFixed(1) + "px";
        n.style.top = (c.y * H).toFixed(1) + "px";
        n.style.setProperty("--w", w.toFixed(1) + "px");
        var rot = c.rot ? "rotate(" + c.rot + "deg)" : "";
        if (imgs[i]) imgs[i].style.transform = rot;
        if (balls[i]) balls[i].style.transform = rot;
        var r = balls[i] ? balls[i].getBoundingClientRect() : null;
        geo[i] = {
          x: c.x * W, y: c.y * H, depth: c.depth,
          r: r ? r.width / 2 : w / 2, rh: r ? r.height / 2 : w / 2
        };
      }
      applyCam();
    }

    function placeCard(card, ax, ay, cx, cy, R) {
      var W = root.clientWidth, H = root.clientHeight;
      var pad = cssNum(root, "--pad", 20, 0, 200);
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var sides = [
        { k: "right", v: W - (cx + R) - w },
        { k: "left", v: (cx - R) - w },
        { k: "above", v: (cy - R) - h },
        { k: "below", v: H - (cy + R) - h }
      ];
      sides.sort(function (a, b) { return b.v - a.v; });
      var lx, ly;
      switch (sides[0].k) {
        case "right": lx = cx + R + GAP; ly = cy - h / 2; break;
        case "left": lx = cx - R - GAP - w; ly = cy - h / 2; break;
        case "above": lx = cx - w / 2; ly = cy - R - GAP - h; break;
        default: lx = cx - w / 2; ly = cy + R + GAP;
      }
      lx = clamp(lx, pad, Math.max(pad, W - pad - w));
      ly = clamp(ly, pad, Math.max(pad, H - pad - h));
      card.style.transform = "translate3d(" + (lx - ax).toFixed(1) + "px," + (ly - ay).toFixed(1) + "px,0)";
      card.classList.add("is-on");
      if (!svg) return;
      var tx = lx + w / 2, ty = ly + h / 2;
      var ax2 = tx - cx, ay2 = ty - cy;
      var len = Math.max(1, Math.hypot(ax2, ay2));
      var sx = cx + (ax2 / len) * (R + 2), sy = cy + (ay2 / len) * (R + 2);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.appendChild(mk("path", {
        d: "M" + sx.toFixed(1) + " " + sy.toFixed(1) + " L" + tx.toFixed(1) + " " + ty.toFixed(1),
        "class": "solar-lead"
      }));
      svg.appendChild(mk("circle", { cx: sx.toFixed(1), cy: sy.toFixed(1), r: 2.2, "class": "solar-node-dot" }));
    }

    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      placeCard(card, g.x, g.y, g.x + (g.dx || 0), g.y + (g.dy || 0), Math.max(g.r, g.rh) * (g.s || 1));
    }

    function showStar() {
      var g = geo.sun;
      if (!starCard || !g) return;
      placeCard(starCard, g.x, g.y, g.x + (g.dx || 0), g.y + (g.dy || 0), g.r * (g.s || 1));
    }

    function refreshCard() {
      if (onIndex === STAR_KEY) showStar();
      else if (onIndex >= 0) show(onIndex);
    }

    function closeCards() {
      var i;
      for (i = 0; i < cards.length; i++) {
        if (cards[i]) { cards[i].classList.remove("is-on"); cards[i].style.transform = ""; }
        if (nodes[i]) nodes[i].classList.remove("is-on");
      }
      if (starCard) { starCard.classList.remove("is-on"); starCard.style.transform = ""; }
      if (sun) sun.classList.remove("is-on");
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;
    }

    function focus(i) {
      if (onIndex === i) return;
      closeCards();
      if (i === STAR_KEY) {
        if (sun) sun.classList.add("is-on");
        onIndex = i;
        showStar();
        return;
      }
      if (i < 0) return;
      onIndex = i;
      nodes[i].classList.add("is-on");
      show(i);
    }

    var stale = root.querySelectorAll(".solar-drag");
    for (var si = 0; si < stale.length; si++) stale[si].remove();
    var hint = document.createElement("span");
    hint.className = "solar-drag";
    hint.textContent = "DRAG";
    root.appendChild(hint);
    function moveHint(e) {
      hint.style.transform = "translate3d(" + (e.clientX + 16) + "px," + (e.clientY + 16) + "px,0)";
    }
    function hintOn(on) { root.classList.toggle("is-cursor", !!on); }
    function hintText(t) { hint.textContent = t; }

    nodes.forEach(function (n, i) {
      var ball = balls[i];
      if (!ball) return;
      ball.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch" || cam.drag) return;
        focus(i);
      });
      ball.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      ball.addEventListener("focus", function () { if (active) focus(i); });
      ball.addEventListener("blur", function () { if (active && onIndex === i) focus(-1); });
      ball.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch" || cam.moved > CLICK_TOL) return;
        focus(onIndex === i ? -1 : i);
      });
    });

    if (starHit) {
      starHit.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch" || cam.drag) return;
        focus(STAR_KEY);
      });
      starHit.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      starHit.addEventListener("focus", function () { if (active) focus(STAR_KEY); });
      starHit.addEventListener("blur", function () { if (active && onIndex === STAR_KEY) focus(-1); });
      starHit.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch" || cam.moved > CLICK_TOL) return;
        focus(onIndex === STAR_KEY ? -1 : STAR_KEY);
      });
    }

    function onDown(e) {
      if (!active || narrow || e.button) return;
      cam.drag = true;
      cam.moved = 0;
      cam.px = e.clientX; cam.py = e.clientY;
      cam.bx = cam.yawT; cam.by = cam.pitchT;
      root.classList.add("is-drag");
      if (e.pointerType !== "touch") { hintText("RELEASE"); moveHint(e); hintOn(true); }
      focus(-1);
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!active) return;
      if (cam.drag) {
        var dx = e.clientX - cam.px, dy = e.clientY - cam.py;
        cam.moved += Math.abs(dx) + Math.abs(dy);
        cam.yawT = clamp(cam.bx - dx * ORBIT, -yawMax, yawMax);
        cam.pitchT = clamp(cam.by - dy * ORBIT * PITCH_K, -pitchMax, pitchMax);
        kickCam();
      }
      if (e.pointerType !== "touch") { moveHint(e); hintOn(true); }
    }
    function onUp(e) {
      if (!cam.drag) return;
      cam.drag = false;
      root.classList.remove("is-drag");
      hintText("DRAG");
      if (e && e.pointerType !== "touch") moveHint(e);
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("pointerleave", function () { hintOn(false); });

    imgs.forEach(function (im) {
      if (im && !im.complete) im.addEventListener("load", function () { if (active) place(); }, { once: true });
    });
    if (sunVideo) sunVideo.muted = true;

    var sceneOpen = document.body.classList.contains("scene-open");
    function onSceneOpen() {
      var now = document.body.classList.contains("scene-open");
      if (now === sceneOpen) return;
      sceneOpen = now;
      if (now) {
        photonStop();
        if (sunVideo) { try { sunVideo.pause(); } catch (e) {} }
      } else if (active) {
        photonStart();
        if (sunVideo) { try { sunVideo.play(); } catch (e) {} }
      }
    }
    if (window.MutationObserver) {
      new MutationObserver(onSceneOpen).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    return {
      root: root, nodes: nodes, cfgOf: cfgOf, place: place, sunNode: sun,
      key: key,
      activate: function (on) {
        active = on;
        if (on) {
          place();
          root.classList.remove("is-live");
          requestAnimationFrame(function () { if (active) root.classList.add("is-live"); });
          photonStart();
          if (sunVideo) { try { sunVideo.play(); } catch (e) {} }
        } else {
          root.classList.remove("is-live");
          root.classList.remove("is-drag");
          root.classList.remove("is-cursor");
          focus(-1);
          hintText("DRAG");
          cam.yaw = cam.yawT = 0; cam.pitch = cam.pitchT = 0; cam.drag = false;
          stopCam();
          applyCam();
          photonStop();
          if (sunVideo) { try { sunVideo.pause(); } catch (e) {} }
        }
      },
      repaint: function () { place(); if (active) photonStart(); },
      novaNow: function () { nova.next = 0; },
      starState: function () {
        var hit = starHit ? starHit.getBoundingClientRect() : null;
        var card = starCard ? starCard.getBoundingClientRect() : null;
        var rb = root.getBoundingClientRect();
        return {
          hasHit: !!starHit, hasCard: !!starCard, open: onIndex === STAR_KEY,
          hit: hit ? { x: Math.round(hit.x), y: Math.round(hit.y), w: Math.round(hit.width), h: Math.round(hit.height), cx: Math.round(hit.x + hit.width / 2), cy: Math.round(hit.y + hit.height / 2) } : null,
          ball: geo.sun ? {
            cx: Math.round(rb.x + geo.sun.x + (geo.sun.dx || 0)),
            cy: Math.round(rb.y + geo.sun.y + (geo.sun.dy || 0)),
            r: Math.round(geo.sun.r * (geo.sun.s || 1))
          } : null,
          box: card ? { x: Math.round(card.x), y: Math.round(card.y), w: Math.round(card.width), h: Math.round(card.height), on: starCard.classList.contains("is-on") } : null,
          title: starCard ? (starCard.querySelector(".solar-title") || {}).textContent : null
        };
      },
      state: function () {
        return {
          key: key, active: active, narrow: narrow, bodies: geo.length, open: onIndex,
          cam: {
            yaw: +cam.yaw.toFixed(4), pitch: +cam.pitch.toFixed(4),
            yawT: +cam.yawT.toFixed(4), pitchT: +cam.pitchT.toFixed(4),
            drag: cam.drag, yawMax: yawMax, pitchMax: pitchMax,
            dx: +cam.dx.toFixed(1), dy: +cam.dy.toFixed(1)
          },
          photons: ph.length,
          nova: { t: +nova.t.toFixed(0), next: +nova.next.toFixed(0), dur: +nova.dur.toFixed(0) },
          sun: sunCfg,
          geo: geo.filter(Boolean).map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r * 2)]; })
        };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
