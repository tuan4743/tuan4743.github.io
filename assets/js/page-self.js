(function () {
  "use strict";

  var R0 = 0.36;
  var R1 = 0.50;
  var DRAG_T = 6;
  var FLY_MS = 460;
  var U = 360;
  var SEP = ",";
  var STARS = 30;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function rnd(v) { var r = v | 0; return r < 0 ? 0 : r; }
  function later0(fn) { setTimeout(fn, 0); }

  function build(root) {
    var field = $("[data-self-field]", root);
    var stage = $("[data-self-stage]", root);
    var face = $(".self-face", root);
    var facebox = $(".self-facebox", root);
    var list = $("[data-self-list]", root);
    var countEl = $("[data-self-count]", root);
    var hintEl = $("[data-self-hint]", root);
    var card = $("[data-self-card]", root);
    var chipsEl = $("[data-self-chips]", root);
    var outEl = $("[data-self-out]", root);
    var deco = $("[data-self-deco]", root);
    if (!field || !stage || !face || !list || !countEl || !facebox) return null;

    var pods = $$("[data-self-pod]", root).map(function (btn, i) {
      return {
        btn: btn,
        key: btn.getAttribute("data-self-pod"),
        emoji: btn.getAttribute("data-self-emoji") || "",
        text: btn.getAttribute("data-self-text") || "",
        idx: i,
        placed: false,
        homeX: 0, homeY: 0
      };
    });
    var POD_OF = {};
    $$(".self-face-part[data-part]", face).forEach(function (el) {
      POD_OF[el.getAttribute("data-part")] = el.getAttribute("data-pod") || "socket";
    });
    pods.forEach(function (p) { p.pod = POD_OF[p.key] || "socket"; });
    if (!pods.length) return null;
    var byKey = {};
    pods.forEach(function (p) { byKey[p.key] = p; });
    var total = pods.length;

    var skinKeys = pods.filter(function (p) { return p.pod === "skin"; }).map(function (p) { return p.key; });
    var slots = pods.length - skinKeys.length + (skinKeys.length ? 1 : 0);

    var nPlaced = function () {
      var n = 0;
      pods.forEach(function (p) { if (p.placed) n++; });
      return n;
    };
    var isFull = function () {
      var skins = 0, ok = true;
      pods.forEach(function (p) {
        if (p.pod === "skin") { if (p.placed) skins++; }
        else if (!p.placed) ok = false;
      });
      return ok && skins === (skinKeys.length ? 1 : 0);
    };

    var active = false, live = false, drag = null, flashT = 0, timers = [];
    var lines = {};

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function halton(i, b) {
      var f = 1, r = 0;
      while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
      return r;
    }

    function scatter() {
      var w = field.clientWidth, h = field.clientHeight;
      if (!w || !h) return;
      var fm = faceCenter();
      var pad = 44, yTop = 108;
      var rightLimit = w - Math.min(w * 0.40, 430) - 12;
      var leftLimit = pad;
      var bottomLimit = h - pad;
      var stageW = Math.min(w * 0.52, 620);
      var faceKeep = Math.min(stageW, Math.min(h, 600) * 0.57) / 2 + 30;
      var minGap = Math.min(84, Math.max(62, w * 0.052));

      var chosen = [];
      var tries = 0, i = 1;
      while (chosen.length < pods.length && tries++ < 4000) {
        var px = leftLimit + halton(i, 2) * (rightLimit - leftLimit);
        var py = yTop + halton(i, 3) * (bottomLimit - yTop);
        i++;
        var dx = px - fm.x, dy = py - fm.y;
        if (dx * dx + dy * dy < faceKeep * faceKeep) continue;
        var clash = false;
        for (var c = 0; c < chosen.length; c++) {
          if (Math.hypot(chosen[c].x - px, chosen[c].y - py) < minGap) { clash = true; break; }
        }
        if (clash) continue;
        chosen.push({ x: px, y: py });
      }
      var k = 0;
      while (chosen.length < pods.length) {
        var deg = -90 + (k++ / pods.length) * 320;
        var rad = deg * Math.PI / 180;
        chosen.push({
          x: Math.max(pad, Math.min(rightLimit, fm.x + Math.cos(rad) * faceKeep * 1.25)),
          y: Math.max(yTop, Math.min(bottomLimit, fm.y + Math.sin(rad) * faceKeep * 1.05))
        });
      }
      pods.forEach(function (p, idx) {
        p.homeX = chosen[idx].x;
        p.homeY = chosen[idx].y;
        /* 已安放的表情在飞行瞬间(is-placed+is-flying)也依赖 --x/--y,
           不给值会落到 CSS 默认 0px → 飞到视口左上角,所以统一写入。 */
        p.btn.style.setProperty("--x", p.homeX.toFixed(1) + "px");
        p.btn.style.setProperty("--y", p.homeY.toFixed(1) + "px");
        p.btn.style.setProperty("--wob", (2.6 + (idx % 5) * 0.55).toFixed(2) + "s");
        p.btn.style.setProperty("--wob-d", (-(idx * 0.47)).toFixed(2) + "s");
      });
    }

    function faceCenter() {
      var m = facebox.getBoundingClientRect();
      return { x: m.left + m.width / 2, y: m.top + m.height / 2, r: m.width / 2 };
    }

    function layout() {
      var m = facebox.getBoundingClientRect();
      root.style.setProperty("--self-face-w", m.width.toFixed(1) + "px");
      decorate();
      scatter();
    }

    function decorate() {
      var svg = deco;
      if (!svg) return;
      var W = field.clientWidth || root.clientWidth;
      var H = field.clientHeight || root.clientHeight;
      if (!W || !H) return;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var base = Math.min(W, H);
      var stageW = Math.min(W * 0.52, 620);
      var cx = stageW * 0.5, cy = H / 2;
      var faceR = Math.max(base * 0.30, 232);
      var textX = W - Math.min(W * 0.40, 430) - 14;
      var parts = [];

      parts.push('<g class="deco-ring" style="--spin:64s">');
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (faceR * 1.06).toFixed(1) + '"></circle>');
      parts.push('</g><g class="deco-ring deco-ring--rev" style="--spin:96s">');
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (faceR * 1.34).toFixed(1) + '" stroke-dasharray="3 11"></circle>');
      parts.push('</g>');

      var tickR = faceR * 1.34;
      for (var a = 0; a < 32; a++) {
        var ang = (a / 32) * Math.PI * 2;
        var r1 = tickR + (a % 4 === 0 ? 12 : 6);
        var x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1;
        var x2 = cx + Math.cos(ang) * (r1 + (a % 4 === 0 ? 12 : 6));
        var y2 = cy + Math.sin(ang) * (r1 + (a % 4 === 0 ? 12 : 6));
        parts.push('<line class="deco-tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
          '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"></line>');
      }

      var put = 0, guard = 0;
      while (put < STARS && guard++ < STARS * 40) {
        var k = put + guard * 0.37;
        var sx = (halton(Math.round(k) + 1, 2) * 0.94 + 0.03) * W;
        var sy = (halton(Math.round(k) + 1, 3) * 0.86 + 0.10) * H;
        var dx = sx - cx, dy = sy - cy;
        if (dx * dx + dy * dy < faceR * faceR * 1.10) continue;
        if (sx > textX) continue;
        var s = 1.6 + ((put * 7) % 5) * 0.85;
        var tw = (2.4 + (put % 6) * 0.7).toFixed(2);
        var dly = (-(put * 0.41)).toFixed(2);
        var d = "M" + sx.toFixed(1) + " " + (sy - s).toFixed(2) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + (sx + s).toFixed(2) + " " + sy.toFixed(1) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + sx.toFixed(1) + " " + (sy + s).toFixed(2) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + (sx - s).toFixed(2) + " " + sy.toFixed(1) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + sx.toFixed(1) + " " + (sy - s).toFixed(2) + "z";
        parts.push('<g class="deco-star" style="--tw:' + tw + 's;--tw-d:' + dly + 's;transform-origin:' +
          sx.toFixed(1) + 'px ' + sy.toFixed(1) + 'px">' +
          '<path d="' + d + '"></path>' +
          '<circle class="deco-star__core" cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) +
          '" r="' + (s * 0.30).toFixed(2) + '"></circle>' +
          '</g>');
        put++;
      }
      svg.innerHTML = parts.join("");
    }

    function localToFace(clientX, clientY) {
      var m = facebox.getBoundingClientRect();
      var u = m.width / U;
      return {
        x: ((clientX - m.left) / u).toFixed(1),
        y: ((clientY - m.top) / u).toFixed(1),
        u: u, p: { x: clientX, y: clientY }
      };
    }
    function faceCenterPoint() {
      var m = facebox.getBoundingClientRect();
      return { x: m.left + m.width * 0.55, y: m.top + m.height * 0.48 };
    }

    function addLine(p) {
      var li = document.createElement("li");
      li.className = "self-say__line";
      li.setAttribute("data-line", p.key);
      var em = document.createElement("span");
      em.className = "self-say__emoji";
      em.textContent = p.emoji;
      var tx = document.createElement("span");
      tx.className = "self-say__tx";
      tx.textContent = p.text;
      var undo = document.createElement("span");
      undo.className = "self-say__undo";
      undo.setAttribute("aria-hidden", "true");
      undo.textContent = "×";
      li.appendChild(em);
      li.appendChild(tx);
      li.appendChild(undo);
      list.appendChild(li);
      lines[p.key] = li;
      syncHint();
      var sayEl = list.parentNode;
      if (sayEl && sayEl.scrollHeight > sayEl.clientHeight) sayEl.scrollTop = sayEl.scrollHeight;
    }
    function killLine(key) {
      var li = lines[key];
      if (!li) return;
      delete lines[key];
      li.classList.add("is-gone");
      later(function () { if (li.parentNode) li.parentNode.removeChild(li); }, 260);
      later(syncHint, 300);
    }

    function syncHint() {
      if (!hintEl) return;
      hintEl.hidden = list.children.length > 0;
    }

    var SKIN_CLASS = { melt: "is-melt", clear: "is-clear", heavy: "is-heavy" };

    function paintFace() {
      var has = function (k) { return !!(byKey[k] && byKey[k].placed); };
      var n = nPlaced();
      root.setAttribute("data-count", String(n));
      facebox.classList.toggle("is-done", isFull());
      facebox.classList.toggle("is-tint", n > 0);
      for (var k in SKIN_CLASS) {
        if (Object.prototype.hasOwnProperty.call(SKIN_CLASS, k)) {
          facebox.classList.toggle(SKIN_CLASS[k], has(k));
        }
      }
      facebox.style.setProperty("--deform", Math.min(1, n / slots).toFixed(3));
      $$(".self-face-part[data-part]", face).forEach(function (el) {
        el.toggleAttribute("data-on", has(el.getAttribute("data-part")));
      });
    }

    function flash() {
      facebox.classList.remove("is-flash");
      void facebox.offsetWidth;
      facebox.classList.add("is-flash");
      if (flashT) clearTimeout(flashT);
      flashT = later(function () { facebox.classList.remove("is-flash"); }, 340);
    }

    function updateCount() {
      var n = nPlaced();
      countEl.textContent = ("0" + n).slice(-2) + " / " + ("0" + total).slice(-2);
      paintFace();
      return n;
    }

    function sum() {
      var frags = pods.filter(function (p) { return p.placed; })
        .map(function (p) { return p.text.split(/[,。;!?]/)[0]; });
      return "我是" + frags.join(SEP) + ",大概就是这样。";
    }
    function cardPaint() {
      var on = pods.filter(function (p) { return p.placed; });
      if (chipsEl) chipsEl.textContent = on.map(function (p) { return p.emoji; }).join(" ");
      if (outEl) outEl.textContent = sum();
    }

    function fly(p, target) {
      /* scatter() 可能还没跑过(field 尺寸为 0 或尚未 gotoLive),
         homeX/homeY 仍是 0 —— 先布一次,否则 --fly 会算成 -target,
         表情从视口左上角起飞。 */
      if (!p.homeX && !p.homeY) scatter();
      p.btn.style.setProperty("--fly-x", (p.homeX - target.x).toFixed(1) + "px");
      p.btn.style.setProperty("--fly-y", (p.homeY - target.y).toFixed(1) + "px");
      p.btn.classList.remove("is-flown");
      void p.btn.offsetWidth;
      p.btn.classList.add("is-flying");
      later(function () {
        if (!p.placed) return;
        p.btn.classList.remove("is-flying");
        p.btn.classList.add("is-flown");
      }, FLY_MS);
    }

    function place(p, at) {
      if (p.placed) return;
      if (p.pod === "skin") {
        pods.forEach(function (q) { if (q !== p && q.pod === "skin" && q.placed) unplace(q); });
      }
      p.placed = true;
      var t = at || localToFace(faceCenterPoint().x, faceCenterPoint().y);
      p.btn.style.setProperty("--tx", t.x);
      p.btn.style.setProperty("--ty", t.y);
      p.btn.style.setProperty("--tu", t.u.toFixed(4));
      p.btn.style.setProperty("--tr", rnd(-16 + Math.random() * 32) + "deg");
      p.btn.style.setProperty("--hit", (t.u * 150).toFixed(1) + "px");
      p.btn.classList.add("is-placed");
      fly(p, t.p);
      addLine(p);
      flash();
      if (updateCount() === slots) later(complete, FLY_MS + 140);
    }

    function unplace(p) {
      if (!p.placed) return;
      p.placed = false;
      p.btn.classList.remove("is-flying", "is-flown", "is-placed");
      killLine(p.key);
      if (card) { card.hidden = true; card.classList.remove("is-in"); }
      updateCount();
    }

    function complete() {
      if (!card) return;
      cardPaint();
      card.hidden = false;
      card.classList.remove("is-in");
      void card.offsetWidth;
      card.classList.add("is-in");
      if (outEl && outEl.scrollHeight > outEl.clientHeight + 2) outEl.classList.add("is-long");
    }

    function reset() {
      pods.slice().forEach(unplace);
      if (hintEl) syncHint();
      updateCount();
    }

    function podOf(t) { return (t && t.closest) ? t.closest("[data-self-pod]") : null; }

    var R_HIT = 1.18;
    function onFace(cx, cy) {
      var f = faceCenter();
      return Math.sqrt((cx - f.x) * (cx - f.x) + (cy - f.y) * (cy - f.y)) <= f.r * R_HIT;
    }

    function onDown(e) {
      if (!active || e.button) return;
      var btn = podOf(e.target);
      if (btn && btn.classList.contains("is-placed")) return;
      drag = {
        x0: e.clientX, y0: e.clientY, btn: btn, moved: false, shot: null,
        key: btn ? btn.getAttribute("data-self-pod") : ""
      };
      try { field.setPointerCapture(e.pointerId); } catch (err) { }
    }

    function onMove(e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < DRAG_T) return;
      if (!drag.moved) {
        drag.moved = true;
        root.classList.add("is-drag");
        if (drag.btn) {
          drag.shot = document.createElement("span");
          drag.shot.className = "self-shot";
          drag.shot.setAttribute("aria-hidden", "true");
          drag.shot.textContent = drag.btn.getAttribute("data-self-emoji") || "";
          root.appendChild(drag.shot);
        }
      }
      if (drag.shot) {
        drag.shot.style.left = e.clientX + "px";
        drag.shot.style.top = e.clientY + "px";
        var near = onFace(e.clientX, e.clientY);
        drag.shot.classList.toggle("is-hot", near);
        facebox.classList.toggle("is-hot", near);
      }
    }

    function onUp(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      root.classList.remove("is-drag");
      facebox.classList.remove("is-hot");
      if (d.shot && d.shot.parentNode) d.shot.parentNode.removeChild(d.shot);
      if (!d.key) return;
      var inside = onFace(e.clientX, e.clientY);
      var p = byKey[d.key];
      if (!p) return;
      if (d.moved) {
        if (inside) place(p, localToFace(e.clientX, e.clientY));
      } else if (inside) {
        place(p);
      }
    }

    function onClick(e) {
      if (!active) return;
      var btn = podOf(e.target);
      if (btn && btn.classList.contains("is-placed")) {
        var q = byKey[btn.getAttribute("data-self-pod")];
        if (q) unplace(q);
        return;
      }
      var row = (e.target && e.target.closest) ? e.target.closest("[data-line]") : null;
      if (row) {
        var p2 = byKey[row.getAttribute("data-line")];
        if (p2 && p2.placed) unplace(p2);
      }
    }

    function onKey(e) {
      if (!active) return;
      if (e.key === "Escape") { reset(); return; }
      if (e.key !== "Enter" && e.key !== " ") return;
      var btn = podOf(e.target);
      if (!btn) return;
      e.preventDefault();
      var p = byKey[btn.getAttribute("data-self-pod")];
      if (!p) return;
      if (p.placed) unplace(p); else place(p);
    }

    field.addEventListener("pointerdown", onDown);
    field.addEventListener("pointermove", onMove);
    field.addEventListener("pointerup", onUp);
    field.addEventListener("pointercancel", onUp);
    field.addEventListener("click", onClick);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    root.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-self-reset]")) reset();
    });

    function gotoLive() {
      if (live) return;
      live = true;
      layout();
      root.classList.add("is-live");
    }

    updateCount();
    if (card) card.hidden = true;

    return {
      key: root.getAttribute("data-self") || "self",
      activate: function (on) {
        active = on;
        if (on) {
          if (!window.__bootRunning) gotoLive();
        } else {
          if (drag) onUp({ clientX: 0, clientY: 0 });
          clearTimers();
        }
      },
      reveal: gotoLive,
      repaint: function () { if (active) layout(); },
      state: function () {
        return {
          key: "self", active: active, live: live,
          total: total,
          slots: slots,
          placed: pods.filter(function (p) { return p.placed; }).map(function (p) { return p.key; }),
          lines: list.children.length,
          done: !!(card && !card.hidden),
          out: outEl ? outEl.textContent : ""
        };
      },
      place: function (key) { var p = byKey[key]; if (p) place(p); return !!(p && p.placed); },
      unplace: function (key) { var p = byKey[key]; if (p) unplace(p); },
      reset: reset
    };
  }

  if (window.CDPages && window.CDPages.register) {
    window.CDPages.register("self", function (root) {
      var api = build(root);
      if (!api) return api;
      function go() { api.reveal(); }
      document.addEventListener("cd-boot-done", go);
      document.addEventListener("cd-panel", function (e) {
        if (e.detail !== "self") return;
        if (!window.__bootRunning) later0(go);
      });
      later0(function () {
        if (!window.__bootRunning &&
          document.querySelector(".intro-panel.is-active[data-panel='self']")) go();
      });
      return api;
    });
  }
})();
