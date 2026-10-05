(function () {
  "use strict";

  var body = document.body;
  var toggle = document.getElementById("intro-toggle");
  var rack = document.getElementById("rack");
  var rackBg = document.getElementById("rack-bg");
  var wheel = document.getElementById("wheel");
  var hub = document.getElementById("hub");
  var hubCd = document.getElementById("hub-cd");
  var cds = Array.prototype.slice.call(document.querySelectorAll(".cd[data-panel]"));
  var panels = document.querySelectorAll(".intro-panel");
  var cdOrder = cds.map(function (cd) { return cd.getAttribute("data-panel"); });
  var themeColors = {
    self: "rgb(34, 211, 238)",
    growth: "rgb(74, 222, 128)",
    lost: "rgb(167, 139, 250)",
    tech: "rgb(96, 165, 250)",
    future: "rgb(244, 114, 182)"
  };

  var selIndex = 0;
  var activeKey = null;
  var insertedKey = null;
  var locked = false;
  var STEP = 22;

  var rackInfo = Array.prototype.slice.call(document.querySelectorAll(".rack-info-item"));
  var rackPainted = null;

  function invertHex(hex) {
    var h = String(hex || "").trim().replace(/^#/, "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
    return "#" + ("000000" + (0xffffff - parseInt(h, 16)).toString(16)).slice(-6);
  }

  function luminance(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return 0;
    var v = [0, 2, 4].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return (hi + 0.05) / (lo + 0.05);
  }
  var BASE_HEX = "#0b0b14";
  var BASE_LUM = luminance(BASE_HEX);

  function composite(hex, t) {
    var h = String(hex || "").replace(/^#/, "");
    var b = BASE_HEX.replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return BASE_HEX;
    var out = [0, 2, 4].map(function (i) {
      var a = parseInt(h.substr(i, 2), 16), c = parseInt(b.substr(i, 2), 16);
      return ("0" + Math.round(a * t + c * (1 - t)).toString(16)).slice(-2);
    });
    return "#" + out.join("");
  }

  function pickInk(themeHex) {
    var inv = invertHex(themeHex);
    if (!themeHex) return "";
    if (!inv) return themeHex;
    var eff = luminance(composite(themeHex, 0.5));
    var worst = function (c) {
      var l = luminance(c);
      return Math.min(contrast(l, eff), contrast(l, BASE_LUM));
    };
    return worst(themeHex) >= worst(inv) ? themeHex : inv;
  }

  function mixWhite(hex, t) {
    var v = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
    return "#" + v.map(function (c) {
      return ("0" + Math.round(c + (255 - c) * t).toString(16)).slice(-2);
    }).join("");
  }
  function liftForBase(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(hex || ""))) return hex;
    return contrast(luminance(hex), BASE_LUM) < 1.15 ? mixWhite(hex, 0.3) : hex;
  }

  function diamondBg(hex) {
    var c = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : "#888888";
    c = liftForBase(c);
    var cell = 40, n = 4, side = 17;
    var parts = "";
    for (var r = 0; r < n; r++) {
      for (var q = 0; q < n; q++) {
        var cx = q * cell + cell / 2, cy = r * cell + cell / 2;
        var ang = 45 + (Math.random() * 34 - 17);
        var s = side * (0.82 + Math.random() * 0.36);
        parts += "<rect x='" + (cx - s / 2).toFixed(1) + "' y='" + (cy - s / 2).toFixed(1) +
          "' width='" + s.toFixed(1) + "' height='" + s.toFixed(1) +
          "' transform='rotate(" + ang.toFixed(1) + " " + cx + " " + cy + ")' fill='" + c +
          "' fill-opacity='0.25'/>";
      }
    }
    var px = cell * n;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + px + "' height='" + px +
      "' viewBox='0 0 " + px + " " + px + "'>" + parts + "</svg>";
    return 'url("data:image/svg+xml,' +
      svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23") + '")';
  }

  function paintRackInfo(key) {
    if (key === rackPainted) return;
    rackPainted = key;
    var themeFg = themeColors[key] || "#22d3ee";
    rack.style.setProperty("--rack-fg", themeFg);
    var ht = document.getElementById("holo-theme");
    if (ht) {
      var btn = document.querySelector('.cd[data-panel="' + key + '"]');
      ht.textContent = (btn && btn.getAttribute("data-title")) || String(key).toUpperCase();
    }
    var hc = document.getElementById("holo-caption");
    if (hc) {
      var cbtn = document.querySelector('.cd[data-panel="' + key + '"]');
      hc.textContent = (cbtn && cbtn.getAttribute("data-caption")) || "";
    }
    if (cd3dApi && cd3dApi.setFxColor) cd3dApi.setFxColor(themeFg);
    try { window.dispatchEvent(new CustomEvent("cd-select", { detail: key })); } catch (e) {}
    window.__rackDebug = { key: key, bg: themeFg, fg: themeFg, at: Math.round(performance.now()) };
  }

  function repaintRack() {
    rackPainted = null;
    paintRackInfo(cdOrder[selIndex]);
  }

  function layout() {
    var rect = wheel.getBoundingClientRect();
    var R = Math.max(96, Math.min(190, rect.height * 0.34, rect.width * 0.38));
    var hubX = Math.max(rect.width * 0.7, rect.width - R - 60);
    var hubY = rect.height * 0.5;
    var hubW = hub.offsetWidth;
    var hubH = hub.offsetHeight;

    cds.forEach(function (cd, i) {
      var deg = 180 - (i - selIndex) * STEP;
      var rad = deg * Math.PI / 180;
      var x = hubX + R * Math.cos(rad) - cd.offsetWidth / 2;
      var y = hubY + R * Math.sin(rad) - cd.offsetHeight / 2;
      var counter = 180 - deg;
      cd.style.transform =
        "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + counter.toFixed(1) + "deg)";
      var sel = i === selIndex;
      cd.classList.toggle("is-selected", sel);
      cd.classList.toggle("is-dimmed", !sel);
      if (sel) {
        cd.setAttribute("aria-selected", "true");
        hubCd.style.setProperty("--sl-color", themeColors[cd.getAttribute("data-panel")] || "");
      } else {
        cd.removeAttribute("aria-selected");
      }
    });

    hub.style.left = (hubX - hubW / 2).toFixed(1) + "px";
    hub.style.top = (hubY - hubH / 2).toFixed(1) + "px";
    paintHubCd();
    paintRackInfo(cdOrder[selIndex]);
  }

  function paintHubCd() {
    var c = getComputedStyle(hubCd).getPropertyValue("--sl-color").trim() || "rgba(128,128,128,.6)";
    hubCd.style.borderColor = c;
    hubCd.style.boxShadow = "0 0 12px " + c;
  }

  function select(i) {
    if (locked) return;
    if (i < 0 || i >= cds.length) return;
    if (i === selIndex) return;
    selIndex = i;
    layout();
    if (cd3dApi) cd3dApi.setSelection(selIndex);
  }

  function step(dir) {
    var i = selIndex;
    var n = cdOrder.length;
    for (var k = 0; k < n; k++) {
      i += dir;
      if (i < 0 || i >= n) return;
      if (cdOrder[i] !== insertedKey) { select(i); return; }
    }
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function playPanel(key) {
    var song = window.GD_SONGS && window.GD_SONGS[key];
    if (key === "lost") song = "/levels/WATER.mp3";
    if (song && window.__gdPlayMode && window.__gdPlayMode()) {
      window.__GD_SONG = song;
      key = "lost";
    }
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === key);
    });
    if (window.CDPages && window.CDPages.activate) window.CDPages.activate(key);
    try { window.dispatchEvent(new CustomEvent("cd-panel", { detail: key })); } catch (e) {}
  }

  function moveSelectionOff(key) {
    var ki = cdOrder.indexOf(key);
    if (ki === -1) return;
    if (selIndex !== ki) return;
    for (var d = 1; d < cdOrder.length; d++) {
      if (ki - d >= 0) { selIndex = ki - d; break; }
      if (ki + d < cdOrder.length) { selIndex = ki + d; break; }
    }
    layout();
    if (cd3dApi) cd3dApi.setSelection(selIndex);
  }

  function confirmTheme() {
    if (locked) return;
    var key = cds[selIndex].getAttribute("data-panel");
    if (insertedKey !== null && key === insertedKey) return;
    locked = true;
    try { window.dispatchEvent(new CustomEvent("cd-busy", { detail: true })); } catch (e) {}
    if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(false);
    if (cd3dApi) {
      if (cd3dApi.audio && cd3dApi.audio.music.stop) cd3dApi.audio.music.stop();
      if (cd3dApi.setFxEnabled) cd3dApi.setFxEnabled(false);
    }

    var use3d = !!cd3dApi;
    var useDriveFlow = use3d && cd3dApi.isDriveOut && cd3dApi.isDriveOut();
    var insertDelay = use3d ? cd3dApi.timings.insert + 80 : 820;
    var ejectDelay = use3d ? cd3dApi.timings.eject + 60 : 720;

    function finish() {
      activeKey = key;
      insertedKey = key;
      moveSelectionOff(key);
      playPanel(key);
      if (key === "tech" && window.CD4Term) window.CD4Term.reset();
      hub.classList.add("is-playing");
      try { localStorage.setItem("intro-theme", key); } catch (e) {}
      locked = false;
      if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      bootStyle = (window.CDBoot && window.CDBoot.styleFor) ? window.CDBoot.styleFor(key) : "hex";
      try { window.dispatchEvent(new CustomEvent("cd-busy", { detail: false })); } catch (e) {}
      setOpen(false, function () {
        var cdBtn = document.querySelector('.cd[data-panel="' + key + '"]');
        var noBgm = !!(cdBtn && cdBtn.getAttribute("data-bgm") === "0")
          || key === "lost" || key === "tech";
        if (!noBgm && cd3dApi && cd3dApi.audio) cd3dApi.audio.music.toBgm(key);
        if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      });
      setTimeout(function () {
        if (cd3dApi && cd3dApi.setFxEnabled) cd3dApi.setFxEnabled(true);
      }, 900);
    }

    if (useDriveFlow) {
      cd3dApi.insertCd(key, function () {
        cd3dApi.retractDrive(function () {
          setTimeout(finish, 200);
        });
      });
      return;
    }

    function insert() {
      if (use3d) {
        cd3dApi.setInserted(key);
        wait(insertDelay).then(finish);
        return;
      }
      hubCd.classList.remove("is-ejecting");
      void hubCd.offsetWidth;
      hubCd.classList.add("is-inserting");
      paintHubCd();
      wait(insertDelay).then(function () {
        hubCd.classList.remove("is-inserting");
        finish();
      });
    }

    if (activeKey !== null) {
      if (use3d) {
        cd3dApi.setInserted(null);
        wait(ejectDelay).then(insert);
        return;
      }
      hubCd.classList.remove("is-inserting");
      void hubCd.offsetWidth;
      hubCd.classList.add("is-ejecting");
      paintHubCd();
      wait(ejectDelay).then(function () {
        hubCd.classList.remove("is-ejecting");
        insert();
      });
    } else {
      insert();
    }
  }

  var staticWrap = document.getElementById("screen-static");
  var staticCv = document.getElementById("screen-static-cv");
  var staticCtx = staticCv ? staticCv.getContext("2d") : null;
  var staticTiles = [];
  var staticRAF = 0;
  var noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function buildStaticTiles() {
    if (staticTiles.length) return;
    for (var t = 0; t < 5; t++) {
      var c = document.createElement("canvas");
      c.width = c.height = 256;
      var g = c.getContext("2d");
      var img = g.createImageData(256, 256);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      staticTiles.push(c);
    }
  }

  function runStatic(ms) {
    if (!staticCtx || !staticWrap || noMotion) return;
    window.__staticLastMs = ms;
    buildStaticTiles();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    staticWrap.classList.remove("is-black");
    staticWrap.classList.add("is-full");
    staticCv.width = Math.max(1, Math.round(staticCv.clientWidth * dpr));
    staticCv.height = Math.max(1, Math.round(staticCv.clientHeight * dpr));
    staticWrap.classList.add("is-on");
    if (staticRAF) cancelAnimationFrame(staticRAF);
    var t0 = performance.now();
    var pattern = null;
    var patIdx = -1;
    function frame(now) {
      var el = now - t0;
      if (el >= ms || document.hidden) {
        staticCtx.clearRect(0, 0, staticCv.width, staticCv.height);
        staticWrap.classList.remove("is-on");
        staticWrap.classList.remove("is-full");
        staticRAF = 0;
        return;
      }
      var n = staticTiles.length;
      var idx = Math.abs(Math.floor(Math.max(0, el) / 55)) % n;
      if (idx !== patIdx) {
        pattern = staticCtx.createPattern(staticTiles[idx], "repeat");
        patIdx = idx;
      }
      staticCtx.globalAlpha = el > ms - 260 ? Math.max(0, (ms - el) / 260) : 1;
      staticCtx.fillStyle = pattern || "#000";
      staticCtx.save();
      staticCtx.translate(Math.random() * 40 - 20, Math.random() * 40 - 20);
      staticCtx.fillRect(-40, -40, staticCv.width + 80, staticCv.height + 80);
      staticCtx.restore();
      staticRAF = requestAnimationFrame(frame);
    }
    staticRAF = requestAnimationFrame(frame);
  }

  var HEX = {
    cols: 15, rows: 7,
    load: 1800,
    hold: 1000,
    fade: 300,   /* 关屏压缩时长(CRT collapse),不再是淡出 */
    draw: 430,
    drawEach: 2.2,
    collapse: 400
  };
  var bootRAF = 0;

  var bootRAF = 0;
  var bootStyle = "hex";

  setTimeout(function () {
    if (window.CDBoot && window.CDBoot.preload) window.CDBoot.preload();
  }, 1200);

  function screenBoot(style, onEnd) {
    if (!staticCtx || !staticWrap || noMotion) {
      window.__bootRunning = false;
      try { window.dispatchEvent(new CustomEvent("cd-boot-done", { detail: style || bootStyle || "hex" })); } catch (e) {}
      if (onEnd) onEnd();
      return;
    }
    var used = style || bootStyle || "hex";
    var useCD4 = used === "glitch" && !!window.CD4Boot;
    if (!useCD4 && !window.CDBoot) { if (onEnd) onEnd(); return; }
    window.__bootRunning = true;
    if (staticRAF) { cancelAnimationFrame(staticRAF); staticRAF = 0; }
    if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = 0; }
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    staticCv.width = Math.max(1, Math.round(staticCv.clientWidth * dpr));
    staticCv.height = Math.max(1, Math.round(staticCv.clientHeight * dpr));
    var W = staticCv.width, H = staticCv.height;
    staticWrap.classList.add("is-on");        /* 画布可见(opacity:1)—— 少了这个,撤掉 is-black 后
                                                 opacity 会退回 0,整个动画就"看不见"了 */
    staticWrap.style.opacity = "";
    staticWrap.style.visibility = "";
    staticWrap.style.transition = "";
    staticWrap.classList.add("is-black");
    staticWrap.classList.remove("is-full");
    var accent = "#22d3ee";
    try {
      var v = getComputedStyle(document.querySelector(".screen")).getPropertyValue("--intro-accent").trim();
      if (v) accent = v;
    } catch (e) {}

    var POST = window.CDBootPost || null;
    var sceneCtx = POST ? POST.context(W, H) : staticCtx;
    var scene = useCD4 ? null : window.CDBoot.create(used, sceneCtx, W, H, accent, HEX);
    var tFull = HEX.load;
    var tFadeIn = tFull + HEX.hold;
    var tPanel = tFadeIn + HEX.fade;
    var tEnd = useCD4 ? window.CD4Boot.total : tPanel + scene.total;
    var t0 = performance.now();
    var snapCv = null;
    /* 过场开屏扫描线:黑场结束后的 320ms 内,画面从一条中心横线纵向展开 */
    var WIPE = 320;
    window.__bootLastAt = Math.round(t0);
    window.__bootStyle = used;
    window.__bootTotalMs = Math.round(tEnd);
    var cd4T = useCD4 ? window.CD4Boot.T : null;
    window.__bootPhases = useCD4 ? {
      full: 0, holdEnd: cd4T.loadEnd, panel: cd4T.wrongAt,
      black: cd4T.clearAt, sceneEnd: tEnd
    } : {
      full: tFull, holdEnd: tFadeIn, panel: tPanel,
      black: tPanel + (scene.blackUntil || 0),
      sceneEnd: tEnd
    };
    var droppedBlack = false;

    function drawLoader(el) {
      staticCtx.fillStyle = "#04060a";
      staticCtx.fillRect(0, 0, W, H);
      var p = Math.min(1, el / HEX.load);
      p = 1 - Math.pow(1 - p, 1.5);
      var outA = el > tFadeIn ? Math.max(0, 1 - (el - tFadeIn) / HEX.fade) : 1;
      var cx = W / 2, cy = H / 2, rr = Math.min(W, H) * 0.075;

      var IS_GLITCH = String(used || "").toLowerCase() === "glitch";
      var C_CYAN = "#7ff0ff";
      var C_ICE = "#bfe9ff";
      var C_DIM = "rgba(127, 240, 255, 0.45)";
      var C_ACC = "#7ff0ff";

      function glowText(txt, x, y, color, blur, aber) {
        staticCtx.save();
        if (blur > 0) {
          staticCtx.shadowColor = color;
          staticCtx.shadowBlur = blur;
        }
        staticCtx.fillStyle = color;
        staticCtx.fillText(txt, x, y);
        staticCtx.globalCompositeOperation = "lighter";
        staticCtx.globalAlpha *= 0.4;
        staticCtx.shadowBlur = 0;
        staticCtx.fillStyle = "rgba(255, 60, 90, 0.55)";
        var off = (aber == null ? 1 : aber);
        staticCtx.fillText(txt, x - off, y);
        staticCtx.fillStyle = "rgba(60, 230, 255, 0.55)";
        staticCtx.fillText(txt, x + off, y);
        staticCtx.restore();
      }

      var LOG = [
        "> OPTICAL DISC  v2.1",
        "> SPINDLE ................. " + Math.round(8200 * Math.min(1, pShow / 0.35)) + " RPM",
        "> MOUNTING DISC " + String(used || "").toUpperCase(),
        "> TRACKING ................ " + Math.round(pShow * 100) + "%",
        "> EMBEDDED ERRORS ......... " + (3 - Math.round(pShow * 3)) + " FIXED",
        "> SIGNAL LOCK ............. STABLE",
        "> READY"
      ];
      var GLITCH_K = IS_GLITCH ? 1 : 0;
      var STALL_A = 0.62, STALL_B = 0.80;
      var stalling = IS_GLITCH && p > STALL_A && p < STALL_B;
      var pShow = stalling ? STALL_A : p;
      var glitchAmt = Math.min(1, GLITCH_K * (stalling ? 1 : p * 0.85));
      var typed = pShow * (LOG.length + 0.5) + (stalling ? 1 : 0);
      var fs2 = Math.max(14, Math.round(Math.min(W, H) * 0.021 * 1.4));
      var lh = Math.round(fs2 * 1.45);
      var lx = Math.round(W * 0.062), ly = Math.round(H * 0.07);

      staticCtx.save();
      staticCtx.translate(lx, ly);
      staticCtx.rotate(-0.022);
      staticCtx.font = fs2 + "px \"Alpha Sector\", ui-monospace, Consolas, monospace";
      staticCtx.textAlign = "left";
      staticCtx.textBaseline = "top";
      staticCtx.globalAlpha = outA;

      for (var li = 0; li < LOG.length; li++) {
        var reach = typed - li;
        if (reach <= 0) break;
        var isLast = (li === Math.floor(typed));
        var txt = LOG[li];
        if (reach < 1) txt = txt.slice(0, Math.max(1, Math.round(txt.length * reach)));
        staticCtx.globalAlpha = outA * (isLast ? 0.72 + 0.28 * Math.abs(Math.sin(el / 150)) : 0.92);
        var col = (li === LOG.length - 1) ? C_ACC : (li === 2 ? C_CYAN : C_ICE);
        glowText(txt, 0, li * lh, col, isLast ? 12 : 0, 0.6 + glitchAmt * 3.4);

        if (li === 2 && reach > 0.2) {
          var barW = Math.round(W * 0.13), barH = 3;
          var bx = staticCtx.measureText(txt).width + 14;
          staticCtx.globalAlpha = outA * 0.9;
          staticCtx.shadowColor = C_ACC; staticCtx.shadowBlur = 8;
          staticCtx.fillStyle = "rgba(127,240,255,0.18)";
          staticCtx.fillRect(bx, 5, barW, barH);
          staticCtx.fillStyle = C_ACC;
          staticCtx.fillRect(bx, 5, barW * pShow, barH);
          staticCtx.fillStyle = "rgba(127,240,255,0.18)";
          staticCtx.fillRect(-barW - 26, 5, barW, barH);
          staticCtx.fillStyle = C_CYAN;
          staticCtx.fillRect(-26 - barW * pShow, 5, barW * pShow, barH);
          staticCtx.shadowBlur = 0;
        }
      }
      staticCtx.restore();

      var seed = Math.floor(el / 90);
      function rnd(i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
      if (!window.__bootDataCv) {
        window.__bootDataCv = document.createElement("canvas");
        window.__bootDataSeed = -1;
      }
      var dcv = window.__bootDataCv;
      if (dcv.width !== W || dcv.height !== H) { dcv.width = W; dcv.height = H; window.__bootDataSeed = -1; }
      /* 侧边读数:围绕"读盘"语义,数值锚定进度(可读的系统性变化) +
         小幅随帧抖动(设备噪声),右上为光学头通道,左下为缓存区 */
      if (window.__bootDataSeed !== seed) {
        window.__bootDataSeed = seed;
        var dg = dcv.getContext("2d");
        dg.setTransform(1, 0, 0, 1, 0, 0);
        dg.clearRect(0, 0, W, H);
        dg.font = Math.max(9, Math.round(fs2 * 0.72)) + "px \"Alpha Sector\", ui-monospace, Consolas, monospace";
        dg.textBaseline = "top";
        dg.textAlign = "right";
        var discRpm = Math.round(8200 * Math.min(1, pShow / 0.35) * (0.99 + 0.01 * rnd(50)));
        var sectors = Math.round(pShow * 2048) + "/" + 2048;
        var channels = [
          function (i) { return "TRK " + Math.max(0, Math.min(96, Math.round(pShow * 96 + rnd(i) * 2 - 1))); },
          function (i) { return "SIG " + (92 + rnd(i) * 7.4 * pShow).toFixed(1) + "%"; },
          function (i) { return "ECC " + Math.max(0, Math.round((1 - pShow) * 14 + rnd(i) * 2)) + " CORR"; }
        ];
        var di;
        for (di = 0; di < 9; di++) {
          var val;
          if (di === 0) val = "RPM " + discRpm;
          else if (di === 1) val = "SEC " + sectors;
          else val = channels[di % 3](di);
          dg.globalAlpha = 0.32 + 0.34 * rnd(di + 40);
          dg.fillStyle = (di === 0 || di === 1) ? C_ICE : C_DIM;
          dg.fillText(val, W * 0.955, H * 0.07 + di * lh);
        }
        dg.textAlign = "left";
        var totalKb = Math.round(pShow * 702);
        for (var dj = 0; dj < 4; dj++) {
          var bufKb = Math.max(0, Math.round(totalKb - dj * 168 + rnd(dj + 90) * 12));
          dg.globalAlpha = 0.3 + 0.3 * rnd(dj + 130);
          dg.fillStyle = C_DIM;
          dg.fillText("CACHE " + String(bufKb).padStart(3, "0") + " KB",
                      W * 0.062, H - lh * (dj + 1.2) - 6);
        }
      }
      staticCtx.save();
      staticCtx.globalAlpha = outA;
      staticCtx.drawImage(dcv, 0, 0);
      staticCtx.restore();

      /* ---- 中央:读盘仪表(单一进度源 pShow) ----
         三层同心"扇区环",随进度由内向外逐环点亮;每环内读出弧
         (readout sweep)随进度扫过;RPM 由 0 爬升到额定再稳定。
         全部由 LOG 行数驱动的 pShow 决定,不再各转各的。 */
      staticCtx.save();
      staticCtx.translate(cx, cy);
      staticCtx.globalAlpha = outA;
      var rBase = rr * 1.7;

      var RPM_MAX = 8200;
      var rpm = RPM_MAX * (pShow < 0.9 ? Math.pow(pShow / 0.9, 1.25) : 1) *
                (pShow >= 1 ? 1 : (0.965 + 0.035 * Math.sin(el / 90)));
      var rpmTxt = (stalling ? 0 : rpm).toFixed(0);

      var RINGS = [
        { r: rBase * 0.55, lit: pShow / (2 / 3) },
        { r: rBase * 0.94, lit: (pShow - 1 / 3) / (2 / 3) },
        { r: rBase * 1.30, lit: (pShow - 2 / 3) / (2 / 3) }
      ];

      /* 环底盘面:细刻度(始终可见,暗) */
      staticCtx.save();
      staticCtx.rotate(-el / 2600);
      staticCtx.lineWidth = Math.max(1, rr * 0.05);
      for (var ri0 = 0; ri0 < RINGS.length; ri0++) {
        staticCtx.globalAlpha = outA * 0.14;
        staticCtx.strokeStyle = C_DIM;
        staticCtx.beginPath();
        staticCtx.arc(0, 0, RINGS[ri0].r, 0, Math.PI * 2);
        staticCtx.stroke();
      }
      /* 扇区分割线 */
      staticCtx.lineWidth = Math.max(1, rr * 0.03);
      staticCtx.strokeStyle = C_DIM;
      for (var si = 0; si < 24; si++) {
        var ang = (Math.PI * 2 / 24) * si;
        staticCtx.globalAlpha = outA * 0.10;
        staticCtx.beginPath();
        staticCtx.moveTo(Math.cos(ang) * RINGS[0].r, Math.sin(ang) * RINGS[0].r);
        staticCtx.lineTo(Math.cos(ang) * RINGS[2].r * 1.06, Math.sin(ang) * RINGS[2].r * 1.06);
        staticCtx.stroke();
      }
      staticCtx.restore();

      /* 逐环点亮 + 读出弧 */
      staticCtx.save();
      for (var ri = 0; ri < RINGS.length; ri++) {
        var R = RINGS[ri];
        var lit = Math.max(0, Math.min(1, R.lit));
        if (lit <= 0) continue;
        var litCol = stalling ? "#ff4d5e" : C_ACC;
        /* 已点亮的弧(尾端发光) */
        staticCtx.globalAlpha = outA * 0.9;
        staticCtx.lineWidth = Math.max(2, rr * 0.12);
        staticCtx.strokeStyle = litCol;
        staticCtx.shadowColor = litCol;
        staticCtx.shadowBlur = 10;
        staticCtx.beginPath();
        staticCtx.arc(0, 0, R.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lit);
        staticCtx.stroke();
        staticCtx.shadowBlur = 0;
        /* 未点亮部分只留极暗底 */
        staticCtx.globalAlpha = outA * 0.08;
        staticCtx.lineWidth = Math.max(1, rr * 0.05);
        staticCtx.strokeStyle = C_ICE;
        staticCtx.beginPath();
        staticCtx.arc(0, 0, R.r, -Math.PI / 2 + Math.PI * 2 * lit, -Math.PI / 2 + Math.PI * 2);
        staticCtx.stroke();
        /* 读出弧:当前环上一小段随进度扫动 */
        var sweepAng = (el / 260) % (Math.PI * 2);
        staticCtx.globalAlpha = outA * 0.55;
        staticCtx.lineWidth = Math.max(2, rr * 0.09);
        staticCtx.strokeStyle = stalling ? "rgba(255,77,94,0.8)" : "rgba(255,255,255,0.75)";
        staticCtx.beginPath();
        staticCtx.arc(0, 0, R.r, sweepAng, sweepAng + 0.5);
        staticCtx.stroke();
      }
      staticCtx.restore();

      /* 内盘孔 */
      staticCtx.globalAlpha = outA * 0.85;
      staticCtx.beginPath();
      staticCtx.arc(0, 0, rBase * 0.18, 0, Math.PI * 2);
      staticCtx.lineWidth = Math.max(2, rr * 0.12);
      staticCtx.strokeStyle = C_ICE;
      staticCtx.stroke();
      staticCtx.globalAlpha = outA * 0.25;
      staticCtx.fillStyle = C_DIM;
      staticCtx.fill();
      staticCtx.globalAlpha = 1;

      /* 环外转速圈 + RPM 读数 */
      staticCtx.save();
      staticCtx.globalAlpha = outA * 0.6;
      staticCtx.font = Math.max(10, Math.round(Math.min(W, H) * 0.013)) + "px \"Alpha Sector\", ui-monospace, Consolas, monospace";
      staticCtx.textAlign = "center";
      staticCtx.textBaseline = "middle";
      staticCtx.fillStyle = stalling ? "#ff4d5e" : C_DIM;
      glowText(rpmTxt + " RPM", 0, rBase * 1.58, stalling ? "#ff4d5e" : C_DIM, 6);
      staticCtx.restore();

      staticCtx.restore();

      staticCtx.save();
      staticCtx.font = "600 " + Math.round(Math.min(W, H) * 0.032) + "px ui-monospace, Consolas, monospace";
      staticCtx.textAlign = "center";
      staticCtx.textBaseline = "middle";
      staticCtx.globalAlpha = outA;
      glowText(Math.round(pShow * 100) + "%", cx, cy, stalling ? "#ff4d5e" : C_CYAN, 12);
      staticCtx.restore();

      /* 100% 后短暂全环发亮一拍,再交给关屏压缩 */
      if (pShow >= 1 && !stalling) {
        var fraw = (el - tFull - HEX.hold * 0.62) / (HEX.hold * 0.38);
        var flash = fraw < 0 ? 0 : (fraw > 1 ? 1 : fraw);
        if (flash > 0 && flash < 1) {
          staticCtx.globalCompositeOperation = "lighter";
          staticCtx.globalAlpha = (1 - flash) * 0.16;
          staticCtx.fillStyle = C_ACC;
          staticCtx.fillRect(0, 0, W, H);
          staticCtx.globalAlpha = 1;
          staticCtx.globalCompositeOperation = "source-over";
        }
      }

      /* CRT 关屏压缩:tFadeIn 之后画面纵向压成一条亮线再熄灭 */
      if (outA < 1) {
        var ct = 1 - outA;                       /* 0→1 压缩进度 */
        /* 先把当前帧快照下来,再在本画布上重绘压缩版 */
        if (!snapCv) snapCv = document.createElement("canvas");
        if (snapCv.width !== W || snapCv.height !== H) { snapCv.width = W; snapCv.height = H; }
        var sg = snapCv.getContext("2d");
        sg.setTransform(1, 0, 0, 1, 0, 0);
        sg.clearRect(0, 0, W, H);
        sg.drawImage(staticCv, 0, 0);
        staticCtx.setTransform(1, 0, 0, 1, 0, 0);
        var sq = Math.max(0.004, 1 - ct * ct);   /* 纵向压缩 */
        staticCtx.globalAlpha = 1;
        staticCtx.fillStyle = "#04060a";
        staticCtx.fillRect(0, 0, W, H);
        staticCtx.save();
        staticCtx.translate(0, cy * (1 - sq));
        staticCtx.scale(1, sq);
        staticCtx.globalAlpha = Math.min(1, outA * 2.2);
        staticCtx.drawImage(snapCv, 0, 0, W, H);
        staticCtx.restore();
        if (ct > 0.55) {
          /* 亮扫描线,随压缩变细变亮 */
          staticCtx.globalCompositeOperation = "lighter";
          staticCtx.fillStyle = "rgba(190,245,255," + (0.75 * Math.min(1, (ct - 0.55) / 0.2) * outA).toFixed(3) + ")";
          staticCtx.fillRect(0, cy - 1.5 * (1 - ct), W, 3 * (1 - ct) + 1);
          staticCtx.globalCompositeOperation = "source-over";
        }
        staticCtx.globalAlpha = 1;
        return;
      }
    }

    function finishBoot() {
      staticCtx.setTransform(1, 0, 0, 1, 0, 0);
      staticCtx.clearRect(0, 0, W, H);
      if (POST) POST.reset();
      staticWrap.style.opacity = "0";
      staticWrap.style.visibility = "hidden";
      staticWrap.style.transition = "none";
      staticWrap.classList.remove("is-black");
      staticWrap.classList.remove("is-on");
      if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = 0; }
      window.__bootRunning = false;
      try { window.dispatchEvent(new CustomEvent("cd-boot-done", { detail: used })); } catch (e) {}
      if (onEnd) onEnd();
    }

    function frame(now) {
      var el = now - t0;
      if (el >= tEnd) {
        finishBoot();
        return;
      }
      staticCtx.setTransform(1, 0, 0, 1, 0, 0);
      staticCtx.globalAlpha = 1;
      staticCtx.globalCompositeOperation = "source-over";
      staticCtx.clearRect(0, 0, W, H);
      if (useCD4) {
        /* cd4 自带整段叙述(含结尾 CRT 关屏),不经过加载器/开屏扫描线;
           cd4 每帧自绘 #04060a 底,is-black 冗余且会压住 home-guide 的 home-dark,立即摘掉 */
        if (!droppedBlack) { staticWrap.classList.remove("is-black"); droppedBlack = true; }
        window.CD4Boot.render(staticCtx, W, H, el);
        bootRAF = requestAnimationFrame(frame);
        return;
      }
      if (el < tPanel) { drawLoader(el); bootRAF = requestAnimationFrame(frame); return; }
      var holdBlack = tPanel + (scene.blackUntil || 0);
      if (!droppedBlack && el >= holdBlack) { staticWrap.classList.remove("is-black"); droppedBlack = true; }
      var sceneEl = el - tPanel;
      if (POST) {
        sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
        sceneCtx.globalAlpha = 1;
        sceneCtx.globalCompositeOperation = "source-over";
        sceneCtx.clearRect(0, 0, W, H);
      }
      scene.draw(sceneEl);
      if (window.CDBootFx) window.CDBootFx.apply(used, sceneCtx, W, H, sceneEl, { fillDone: (scene.blackUntil || 0) });
      if (POST) POST.present(staticCtx, W, H, el, 1);

      /* 开机扫描线:黑场刚结束时,内容从中心一条横线纵向展开(与关屏压缩互为镜像) */
      var wipeEl = sceneEl - (scene.blackUntil || 0);
      if (wipeEl >= 0 && wipeEl < WIPE) {
        if (!snapCv) snapCv = document.createElement("canvas");
        if (snapCv.width !== W || snapCv.height !== H) { snapCv.width = W; snapCv.height = H; }
        var wg = snapCv.getContext("2d");
        wg.setTransform(1, 0, 0, 1, 0, 0);
        wg.clearRect(0, 0, W, H);
        wg.drawImage(staticCv, 0, 0);
        staticCtx.fillStyle = "#04060a";
        staticCtx.fillRect(0, 0, W, H);
        var wp = wipeEl / WIPE;
        var open = wp * wp * (3 - 2 * wp);       /* smoothstep */
        var hh = Math.max(1, (H / 2) * open);
        staticCtx.save();
        staticCtx.beginPath();
        staticCtx.rect(0, H / 2 - hh, W, hh * 2);
        staticCtx.clip();
        staticCtx.drawImage(snapCv, 0, 0, W, H);
        staticCtx.restore();
        /* 展开边缘的亮扫描线 */
        staticCtx.globalCompositeOperation = "lighter";
        staticCtx.fillStyle = "rgba(190,245,255," + (0.55 * (1 - wp)).toFixed(3) + ")";
        staticCtx.fillRect(0, H / 2 - hh - 1, W, 2);
        staticCtx.fillRect(0, H / 2 + hh - 1, W, 2);
        staticCtx.globalCompositeOperation = "source-over";
      }

      staticCtx.setLineDash([]);
      staticCtx.globalAlpha = 1;
      staticCtx.globalCompositeOperation = "source-over";
      bootRAF = requestAnimationFrame(frame);
    }
    bootRAF = requestAnimationFrame(frame);
  }
  function screenOff() {
    if (!staticWrap) return;
    if (staticRAF) { cancelAnimationFrame(staticRAF); staticRAF = 0; }
    if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = 0; }
    if (staticCtx) staticCtx.clearRect(0, 0, staticCv.width, staticCv.height);
    staticWrap.classList.remove("is-on");
    staticWrap.classList.add("is-black");
  }
  window.__runStatic = runStatic;
  window.__screenBoot = screenBoot;
  window.__hexCfg = HEX;


  function setOpen(open, onBootEnd) {
    if (open && document.documentElement.classList.contains("slot-locked")) return;
    body.classList.toggle("scene-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    rack.setAttribute("aria-hidden", open ? "false" : "true");
    if (cd3dApi) cd3dApi.setPaused(!open);
    if (open) {
      screenOff();
    } else {
      if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(false);
      screenBoot(undefined, function () {
        if (onBootEnd) onBootEnd();
        else if (cd3dApi && cd3dApi.audio && insertedKey) cd3dApi.audio.music.toBgm(insertedKey);
        if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      });
    }
    if (open) {
      setTimeout(layout, 80);
      scheduleEject();
      if (cd3dApi && cd3dApi.previewCurrent) cd3dApi.previewCurrent();
    } else if (cd3dApi && cd3dApi.isDriveOut() && !locked) {
      clearTimeout(ejectTimer);
      cd3dApi.retractDrive();
    }
    if (!open && cd3dApi && cd3dApi.audio) cd3dApi.audio.music.leaveCdPage();
  }

  toggle.addEventListener("click", function () {
    setOpen(!body.classList.contains("scene-open"));
  });

  document.addEventListener("click", function (e) {
    if (
      body.classList.contains("scene-open") &&
      !rack.contains(e.target) &&
      !toggle.contains(e.target) &&
      !(e.target.closest && e.target.closest(".header"))
    ) {
      setOpen(false);
    }
  });

  var lastWheel = 0;
  rack.addEventListener("wheel", function (e) {
    if (cd3dApi) return;
    e.preventDefault();
    var now = Date.now();
    if (now - lastWheel < 180) return;
    lastWheel = now;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (!body.classList.contains("scene-open")) return;
    if (e.key === "ArrowUp") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); step(1); }
  });

  var insertBtn = document.getElementById("rack-insert");
  if (insertBtn) {
    insertBtn.addEventListener("click", function () { confirmTheme(); });
  }

  var SLIDER_KEY = "rack-power";
  function bindSlider(id, apply) {
    var el = document.getElementById(id);
    if (!el) return;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(SLIDER_KEY) || "null"); } catch (e) {}
    if (saved && typeof saved[id] === "number") el.value = String(Math.round(saved[id] * 100));
    var push = function () {
      var v = Math.max(0, Math.min(1, (+el.value || 0) / 100));
      apply(v);
      var s = {};
      try { s = JSON.parse(localStorage.getItem(SLIDER_KEY) || "{}") || {}; } catch (e) { s = {}; }
      s[id] = v;
      try { localStorage.setItem(SLIDER_KEY, JSON.stringify(s)); } catch (e) {}
    };
    el.addEventListener("input", push);
    push();
  }
  bindSlider("rack-bg-power", function (v) {
    rack.style.setProperty("--bg-power", v.toFixed(2));
  });
  bindSlider("rack-neb-power", function (v) {
    rack.style.setProperty("--glow-alpha", v.toFixed(2));
    if (cd3dApi && cd3dApi.setNebulaVisibility) cd3dApi.setNebulaVisibility(v);
  });

  cds.forEach(function (cd) {
    cd.addEventListener("click", function () {
      var i = cds.indexOf(cd);
      if (i !== selIndex) { selIndex = i; layout(); }
    });
  });

  cds.forEach(function (cd) {
    var disc = cd.querySelector(".cd-disc");
    cd.addEventListener("mousemove", function (e) {
      var r = cd.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      disc.style.setProperty("--tilt-y", (px * 14).toFixed(2) + "deg");
      disc.style.setProperty("--tilt-x", (-py * 14).toFixed(2) + "deg");
    });
    cd.addEventListener("mouseleave", function () {
      disc.style.setProperty("--tilt-y", "0deg");
      disc.style.setProperty("--tilt-x", "0deg");
    });
  });

  var loader = document.getElementById("intro-loader");
  var loaderFill = document.getElementById("intro-loader-fill");
  var loaderPct = document.getElementById("intro-loader-pct");
  var loaderSub = document.getElementById("intro-loader-sub");
  var loaderDone = false;
  var loaderKick = setTimeout(function () {
    if (!loaderDone && loader) loader.classList.add("is-active");
  }, 250);

  var SPIN = "|/-\\";
  var loaderBeat = 0, loaderTimer = 0;
  function startLoaderSub() {
    if (!loaderSub || loaderTimer) return;
    var words = ["SCAN", "ALIGN", "TRACE", "LATCH", "MOUNT"];
    loaderTimer = setInterval(function () {
      if (loaderDone) { clearInterval(loaderTimer); loaderTimer = 0; return; }
      var i = loaderBeat++;
      var spin = SPIN.charAt(i % SPIN.length);
      var w = words[Math.floor(i / 3) % words.length];
      var bar = "";
      for (var k = 0; k < 10; k++) bar += (k <= (i % 11)) ? "#" : ".";
      loaderSub.textContent = spin + " " + bar + "  " + w;
    }, 240);
  }
  startLoaderSub();

  var progSrc = {};
  function resetProgress(id) { delete progSrc[id]; }
  function setProgress(p, label, src) {
    if (loaderDone) return;
    src = src || "main";
    var v = Math.max(0, Math.min(100, p));
    if (label) progSrc[src + ":label"] = label;
    progSrc[src] = v;
    if (!loader || !loader.classList.contains("is-active")) {
      if (loader) loader.classList.add("is-active");
    }
    var best = 0, name = "";
    var order = ["main", "model", "music"];
    for (var s in progSrc) {
      if (!progSrc.hasOwnProperty(s) || s.indexOf(":label") > 0) continue;
      var val = progSrc[s];
      if (val > best) best = val;
      if (val < 100 && !name) name = progSrc[s + ":label"] || "";
    }
    if (!name) {
      for (var k = order.length - 1; k >= 0; k--) {
        if (progSrc[order[k] + ":label"]) { name = progSrc[order[k] + ":label"]; break; }
      }
    }
    if (loaderFill) loaderFill.style.width = best.toFixed(1) + "%";
    if (loaderPct) loaderPct.textContent = (name ? name + " · " : "") + Math.round(best) + "%";
    startLoaderSub();
  }

  function hideLoader() {
    if (loaderDone) return;
    loaderDone = true;
    clearTimeout(loaderKick);
    if (loaderTimer) { clearInterval(loaderTimer); loaderTimer = 0; }
    if (loader) {
      loader.classList.remove("is-active");
      loader.classList.add("is-done");
    }
  }

  var ejectTimer = null;

  function scheduleEject() {
    clearTimeout(ejectTimer);
    if (!cd3dApi) return;
    ejectTimer = setTimeout(function () {
      if (body.classList.contains("scene-open") && cd3dApi) {
        cd3dApi.ejectDrive();
      }
    }, cd3dApi.timings.driveEjectDelay || 1000);
  }

  function startIntro() {
    hideLoader();
    window.__introReady = true;
    setOpen(true);
  }

  window.__cdPreview = function (on) {
    if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(!!on);
  };


  function homeBoot() {
    setProgress(100, "排队第 27 次人格修正", "model");
    setProgress(100, "载入情感引擎", "music");

    whenPainted(function () {
      finishHomeBoot();
    });
  }

  function whenPainted(done) {
    var go = false;
    var fire = function () { if (!go) { go = true; done(); } };
    setTimeout(fire, 2500);
    var waits = [];
    try {
      if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    } catch (e) { }
    try {
      var imgs = document.images || [];
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        if (im.complete) continue;
        waits.push(new Promise(function (res) {
          im.addEventListener("load", res, { once: true });
          im.addEventListener("error", res, { once: true });
        }));
      }
    } catch (e) { }
    Promise.all(waits.map(function (p) { return Promise.resolve(p).catch(function () { }); }))
      .then(function () {
        requestAnimationFrame(function () { requestAnimationFrame(fire); });
      })
      .catch(function () { fire(); });
  }

  function finishHomeBoot() {
    if (staticWrap) { staticWrap.classList.remove("is-full"); staticWrap.classList.add("is-on"); staticWrap.classList.add("is-black"); }
    if (!window.__homeBoot) {
      if (window.__tabletOpen) window.__tabletOpen(true);
      else body.classList.add("tablet-open");
    }
    hideLoader();
    window.__introReady = false;
    requestAnimationFrame(function () {
      if (typeof window.__homeBoot === "function") window.__homeBoot();
      else console.warn("[home] 引导脚本没就绪(assets/js/home-guide.js)");
    });
  }

  var IS_HOME = body.classList.contains("home-page");

  function beginSite(onReady) {
    if (!IS_HOME) { startIntro(); return; }
    var p = musicPreload || startMusicPreload();
    p.then(function () {
      setProgress(100, "排队第 27 次人格修正", "music");
      onReady();
    });
  }

  var musicPreload = null;
  function readMusicList() {
    var out = [];
    try {
      if (window.GD_SONGS) {
        Object.keys(window.GD_SONGS).forEach(function (k) {
          var u = String(window.GD_SONGS[k] || "");
          if (u && out.indexOf(u) < 0) out.push(u);
        });
      }
    } catch (e) { }
    return out;
  }

  function startMusicPreload() {
    if (musicPreload) return musicPreload;
    var list = readMusicList();
    if (!list.length) { musicPreload = Promise.resolve(); return musicPreload; }

    var audio = (cd3dApi && cd3dApi.audio) || window.__cdAudio;
    var first = list[0], rest = list.slice(1);
    var done = 0, span = 1 + rest.length;
    var beat = function () {
      setProgress((++done / span) * 96, "挂载情感引擎", "music");
    };
    var bytesDone = 0;
    var bytesBeat = function () {
      bytesDone++;
      if (bytesDone >= rest.length) setProgress(60, "读取引擎数据", "music");
    };

    var p1 = (audio && audio.music && audio.music.load)
      ? Promise.resolve(audio.music.load(first)).catch(function () { return null; })
      : fetch(first, { cache: "force-cache" }).catch(function () { });
    p1 = p1.then(function (buf) { beat(); return buf; });

    var p2 = Promise.all(rest.map(function (u) {
      return fetch(u, { cache: "force-cache" })
        .then(function (r) { return r.arrayBuffer(); })
        .then(function () { bytesBeat(); beat(); return null; })
        .catch(function () { bytesBeat(); beat(); return null; });
    }));

    musicPreload = Promise.race([Promise.all([p1, p2]), wait(4000)]).catch(function () { });
    return musicPreload;
  }

  var cd3dApi = null;
  var cd3dTried = false;

  function tryInit3D() {
    if (cd3dTried) return;
    cd3dTried = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.info("[cd3d] 跳过:系统开启了减少动效,继续使用 DOM 轮盘");
      beginSite(homeBoot);
      return;
    }
    if (!window.WebGLRenderingContext) {
      console.info("[cd3d] 跳过:浏览器不支持 WebGL,继续使用 DOM 轮盘");
      beginSite(homeBoot);
      return;
    }

    import(body.dataset.cd3d || "/js/cd3d.js")
      .then(function (mod) {
        return mod.initCd3d({
          container: wheel,
          selIndex: selIndex,
          audioUrl: body.dataset.cdAudio,
          fxUrl: body.dataset.cdFx,
          onProgress: function (p, label) { setProgress(p, label); },
          onReady: function (api) {
            cd3dApi = api;
            body.classList.add("cd3d-on");
            api.setSelection(selIndex, true);
            document.documentElement.classList.add("has-cd-fx");
            repaintRack();
            console.info("[cd3d] 3D 模式已激活");
            setProgress(90, "挂载 CD 模板");
            beginSite(homeBoot);
          },
          onCdClick: function (key) {
            var i = cdOrder.indexOf(key);
            if (i === -1) return;
            console.info("[cd3d] 点击 CD:", key);
            if (i !== selIndex) {
              selIndex = i;
              layout();
              cd3dApi.setSelection(i);
            }
          },
          onScroll: function (dir) { step(dir); }
        }).then(function (api) {
          if (!api) {
            console.warn("[cd3d] 未能初始化(资产缺失/加载失败),继续使用 DOM 轮盘");
            beginSite(homeBoot);
          }
        });
      })
      .catch(function (e) {
        console.warn("[cd3d] 模块加载失败:", e && e.message);
        beginSite(homeBoot);
      });
  }

  var restored = false;
  var savedKey = null;
  try { savedKey = localStorage.getItem("intro-theme"); } catch (e) {}

  if (savedKey && panels.length) {
    restored = true;
    activeKey = savedKey;
    bootStyle = (window.CDBoot && window.CDBoot.styleFor) ? window.CDBoot.styleFor(savedKey) : "hex";
    playPanel(savedKey);
    cds.forEach(function (cd, i) {
      if (cd.getAttribute("data-panel") === savedKey) selIndex = i;
    });
    layout();
  } else {
    layout();
  }

  startMusicPreload();
  tryInit3D();
  setTimeout(function () {
    if (!loaderDone) {
      console.warn("[cd3d] 加载超时,进入降级模式");
      beginSite(homeBoot);
    }
  }, 9000);

  window.addEventListener("resize", layout);
})();
