/* 首页介绍页 v0.2:屏幕+CD架刚体场景,CD轮以插入点(hub)为轴心 */
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
  var activeKey = null;      /* 当前"正在播放"的主题(持久化用) */
  var insertedKey = null;    /* 真正位于光驱内的那张盘(刷新后为空) */
  var locked = false;
  var STEP = 22;              /* 相邻 CD 角度步长(度) */

  /* ---------- 轮盘几何:轴心 = hub(插入点,靠近屏幕接缝),CD 在其左侧绕转 ---------- */
  var rackInfo = Array.prototype.slice.call(document.querySelectorAll(".rack-info-item"));
  var rackPainted = null;

  /* 反色:#RRGGBB → 每通道 255-x */
  function invertHex(hex) {
    var h = String(hex || "").trim().replace(/^#/, "");
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
    return "#" + ("000000" + (0xffffff - parseInt(h, 16)).toString(16)).slice(-6);
  }

  /* 相对亮度(用于"背景换成深蓝黑之后,文字选哪个颜色才看得清")*/
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

  /* 文字实际压在"菱形(主题色 50%)叠在深底上"的结果上,所以要拿这个合成色比对比度 */
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

  /* 文字/按钮/音频条的颜色:在"主题色"和"它的反色"里挑一个更稳的。
     注意它们不只压在菱形上,也压在深底上,所以要取"两处里更差的那个"来比 ——
     否则像"未来"这种白色主题会选出黑色,菱形上勉强能看,深底上直接消失 */
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

  /* 主题色若和深底太接近(比如"技术"的纯黑),菱形会看不见 —— 往白里提一点点 */
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

  /* 菱形平铺图案:一个 45° 旋转的正方形,填当前主题色、50% 透明
     (正方形比格子小一圈 → 菱形之间留出呼吸感;调 17/40 这个比例或 CSS 的 --bg-tile 都能改间距)*/
  function diamondBg(hex) {
    var c = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : "#888888";
    c = liftForBase(c);
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'>" +
      "<rect x='11.5' y='11.5' width='17' height='17' transform='rotate(45 20 20)' fill='" + c + "' fill-opacity='0.5'/></svg>";
    return 'url("data:image/svg+xml,' +
      svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/#/g, "%23") + '")';
  }

  /* CD 架文字介绍 + 背景色:都跟随"当前选中的那张盘"(滚动换选即变色)*/
  function paintRackInfo(key) {
    if (key === rackPainted) return;
    rackPainted = key;
    var active = null;
    rackInfo.forEach(function (el) {
      var on = el.getAttribute("data-panel") === key;
      el.classList.toggle("is-active", on);
      if (on) active = el;
    });
    if (!active) return;
    var bg = active.getAttribute("data-bg") || "";
    var fg = active.getAttribute("data-fg") || pickInk(bg);
    if (fg) rack.style.setProperty("--rack-fg", fg);
    /* 菱形平铺背景:主题色 + 50% 透明 */
    if (rackBg && bg) rackBg.style.backgroundImage = diamondBg(bg);
    if (cd3dApi && cd3dApi.setFxColor) cd3dApi.setFxColor(fg);   /* 可视化跟着一起换色 */
    window.__rackDebug = {
      key: key, bg: bg, fg: fg, diamond: rackBg ? rackBg.style.backgroundImage.indexOf("data:image/svg") === 0 : false,
      readBack: rackBg ? rackBg.style.backgroundImage.slice(0, 400) : "",
      at: Math.round(performance.now())
    };
  }

  /* 3D 就绪后要把颜色重推一次(fx 是后来才创建的)*/
  function repaintRack() {
    rackPainted = null;
    paintRackInfo(cdOrder[selIndex]);
  }

  function layout() {
    var rect = wheel.getBoundingClientRect();
    var R = Math.max(96, Math.min(190, rect.height * 0.34, rect.width * 0.38));
    var hubX = Math.max(rect.width * 0.7, rect.width - R - 60);  /* hub 靠右(接缝侧) */
    var hubY = rect.height * 0.5;
    var hubW = hub.offsetWidth;
    var hubH = hub.offsetHeight;

    cds.forEach(function (cd, i) {
      var deg = 180 - (i - selIndex) * STEP;   /* 选中位在 hub 左侧(180°) */
      var rad = deg * Math.PI / 180;
      var x = hubX + R * Math.cos(rad) - cd.offsetWidth / 2;
      var y = hubY + R * Math.sin(rad) - cd.offsetHeight / 2;
      var counter = 180 - deg;                 /* 保持盘面立正 */
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
    paintRackInfo(cdOrder[selIndex]);   /* 文字介绍 + 背景色跟随选中盘 */
  }

  function paintHubCd() {
    var c = getComputedStyle(hubCd).getPropertyValue("--sl-color").trim() || "rgba(128,128,128,.6)";
    hubCd.style.borderColor = c;
    hubCd.style.boxShadow = "0 0 12px " + c;
  }

  /* ---------- 选择 ---------- */
  function select(i) {
    if (locked) return;
    if (i < 0 || i >= cds.length) return;
    if (i === selIndex) { confirmTheme(); return; }
    selIndex = i;
    layout();
    if (cd3dApi) cd3dApi.setSelection(selIndex);
  }

  /* 换选:只跳过"真正在光驱里"的那张;到边界即停(不循环) */
  function step(dir) {
    var i = selIndex;
    var n = cdOrder.length;
    for (var k = 0; k < n; k++) {
      i += dir;
      if (i < 0 || i >= n) return;
      if (cdOrder[i] !== insertedKey) { select(i); return; }
    }
  }

  /* ---------- 插拔时序:拔出 → 插入 → 切换面板 ---------- */
  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function playPanel(key) {
    panels.forEach(function (p) {
      p.classList.toggle("is-active", p.getAttribute("data-panel") === key);
    });
  }

  /* 插入某张盘后,把"架位中心/选中项"挪到最近的仍在架上的盘(避免整排跳位) */
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
    /* 只有"该盘已在光驱内"才阻止重复插入;刷新后光驱为空,即使主题相同也能插 */
    if (insertedKey !== null && key === insertedKey) return;
    locked = true;
    if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(false);  /* 插入期间别再切预览 */
    /* 插入动画开始:音乐停、可视化关(否则几何体/音频条会跟着盘飞进光驱)*/
    if (cd3dApi) {
      if (cd3dApi.audio && cd3dApi.audio.music.stop) cd3dApi.audio.music.stop();
      if (cd3dApi.setFxEnabled) cd3dApi.setFxEnabled(false);
    }

    /* 3D 模式:让「真实选中的那张 CD」飞入光驱(前端补间) */
    var use3d = !!cd3dApi;
    /* 只要光驱是弹出的,就走"光驱流程"(换盘时也一样) */
    var useDriveFlow = use3d && cd3dApi.isDriveOut && cd3dApi.isDriveOut();
    var insertDelay = use3d ? cd3dApi.timings.insert + 80 : 820;
    var ejectDelay = use3d ? cd3dApi.timings.eject + 60 : 720;

    function finish() {
      activeKey = key;
      insertedKey = key;          /* 记录"盘已在光驱内" */
      /* 先把这张盘的音乐升格为背景音乐(接着预览继续放,不重启),
         再补位/换中心 —— 顺序反了的话"换中心"会顺带请求下一张盘的预览 */
      if (cd3dApi && cd3dApi.audio) cd3dApi.audio.music.toBgm(key);
      moveSelectionOff(key);      /* 飞入完成后再补位/换中心,避免穿模 */
      playPanel(key);
      hub.classList.add("is-playing");
      try { localStorage.setItem("intro-theme", key); } catch (e) {}
      locked = false;
      if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      setOpen(false);   /* 插入完成后回到主界面 */
      /* 回到主界面:重新开始这首的背景音乐,并把可视化打开(等镜头平移完再开)*/
      setTimeout(function () {
        if (cd3dApi && cd3dApi.setFxEnabled) cd3dApi.setFxEnabled(true);
      }, 900);
    }

    /* 光驱已弹出的新流程:CD 从上方落入 → CD+光驱一起插回(末尾停顿后干脆插入) */
    if (useDriveFlow) {
      cd3dApi.insertCd(key, function () {
        cd3dApi.retractDrive(function () {
          setTimeout(finish, 200);      /* 动画播完再停 0.2s,然后回主界面 */
        });
      });
      return;
    }

    function insert() {
      if (use3d) {
        cd3dApi.setInserted(key);      /* 旧盘(若有)自动飞回自己的架位 */
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
        /* 旧盘飞回架位 → 新盘飞入 */
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

  /* ---------- 花屏(电视雪花)/ 黑屏 ---------- */
  var staticWrap = document.getElementById("screen-static");       /* 定位/状态在外面这层 */
  var staticCv = document.getElementById("screen-static-cv");       /* 画雪花用里面的 canvas */
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
    window.__staticLastMs = ms;      /* 供验证:本次花屏设定的时长 */
    buildStaticTiles();
    /* 画布尺寸按屏幕可视区(DPR 限 1.5,雪花不需要那么细)*/
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    staticWrap.classList.remove("is-black");
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
        staticRAF = 0;
        return;
      }
      /* 每 ~55ms 换一张噪点图 ≈ 18fps 的雪花(rAF 时间戳可能略早于 t0,要做成正模)*/
      var n = staticTiles.length;
      var idx = Math.abs(Math.floor(Math.max(0, el) / 55)) % n;
      if (idx !== patIdx) {
        pattern = staticCtx.createPattern(staticTiles[idx], "repeat");
        patIdx = idx;
      }
      staticCtx.globalAlpha = el > ms - 260 ? Math.max(0, (ms - el) / 260) : 1;   /* 末尾淡出 */
      staticCtx.fillStyle = pattern || "#000";
      staticCtx.save();
      staticCtx.translate(Math.random() * 40 - 20, Math.random() * 40 - 20);      /* 抖动 */
      staticCtx.fillRect(-40, -40, staticCv.width + 80, staticCv.height + 80);
      staticCtx.restore();
      staticRAF = requestAnimationFrame(frame);
    }
    staticRAF = requestAnimationFrame(frame);
  }

  /* 黑屏:CD 架打开(= 光驱拔出)时屏幕就是没信号的黑屏,一直黑到插盘 */
  function screenOff() {
    if (!staticWrap) return;
    if (staticRAF) { cancelAnimationFrame(staticRAF); staticRAF = 0; }
    if (staticCtx) staticCtx.clearRect(0, 0, staticCv.width, staticCv.height);
    staticWrap.classList.remove("is-on");
    staticWrap.classList.add("is-black");
  }
  /* 调试/验证入口:手动放一段花屏 */
  window.__runStatic = runStatic;

  /* ---------- 状态栏:上缘箭头显示 / 隐藏(记忆在 localStorage)---------- */
  var sbToggle = document.getElementById("statusbar-toggle");
  var SB_KEY = "cd-statusbar";

  function setStatusbar(show) {
    body.classList.toggle("statusbar-hidden", !show);
    if (sbToggle) sbToggle.setAttribute("aria-expanded", show ? "true" : "false");
    try { localStorage.setItem(SB_KEY, show ? "1" : "0"); } catch (e) {}
  }

  (function initStatusbar() {
    var saved = null;
    try { saved = localStorage.getItem(SB_KEY); } catch (e) {}
    setStatusbar(saved !== "0");
    if (sbToggle) {
      sbToggle.addEventListener("click", function () {
        setStatusbar(body.classList.contains("statusbar-hidden"));
      });
    }
  })();

  /* ---------- 场景平移开合(视角平移,刚体) ---------- */
  function setOpen(open) {
    body.classList.toggle("scene-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    rack.setAttribute("aria-hidden", open ? "false" : "true");
    if (cd3dApi) cd3dApi.setPaused(!open);
    /* 打开 CD 架(= 光驱拔出)= 屏幕黑掉,一直黑到插盘;
       回到主界面 = 先花屏 1.5 秒,再出画面 */
    if (open) screenOff();
    else runStatic(1500);
    if (open) {
      setTimeout(layout, 80);
      scheduleEject();                 /* 每次打开都重新弹出光驱 */
      /* 回到 CD 页 → 当前选中的盘小声预览(背景音乐让位)*/
      if (cd3dApi && cd3dApi.previewCurrent) cd3dApi.previewCurrent();
    } else if (cd3dApi && cd3dApi.isDriveOut() && !locked) {
      clearTimeout(ejectTimer);
      cd3dApi.retractDrive();          /* 收起架子时把弹出的光驱收回去 */
    }
    /* 收起架子:结束预览;光驱里那张盘的背景音乐继续放 */
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
      !(e.target.closest && e.target.closest(".header"))   /* 点顶栏(导航/明暗/配色)不收起 CD 架 */
    ) {
      setOpen(false);
    }
  });

  /* ---------- 滚轮 / 方向键 ---------- */
  var lastWheel = 0;
  rack.addEventListener("wheel", function (e) {
    if (cd3dApi) return;              /* 3D 模式:滚轮由 Three.js 画布接管 */
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

  /* ---------- CD 点击 ---------- */
  cds.forEach(function (cd) {
    cd.addEventListener("click", function () {
      var i = cds.indexOf(cd);
      if (i === selIndex) confirmTheme();
      else { selIndex = i; layout(); }
    });
  });

  /* ---------- CD 随鼠标微倾斜 ---------- */
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

  /* ---------- 加载页 ---------- */
  var loader = document.getElementById("intro-loader");
  var loaderFill = document.getElementById("intro-loader-fill");
  var loaderPct = document.getElementById("intro-loader-pct");
  var loaderDone = false;
  var loaderKick = setTimeout(function () {
    if (!loaderDone && loader) loader.classList.add("is-active");   /* 超过 250ms 才显示,避免闪现 */
  }, 250);

  function setProgress(p, label) {
    if (loaderDone) return;
    if (!loader || !loader.classList.contains("is-active")) {
      if (loader) loader.classList.add("is-active");
    }
    if (loaderFill) loaderFill.style.width = Math.max(0, Math.min(100, p)) + "%";
    if (loaderPct) loaderPct.textContent = (label ? label + " · " : "") + Math.min(100, Math.round(p)) + "%";
  }

  function hideLoader() {
    if (loaderDone) return;
    loaderDone = true;
    clearTimeout(loaderKick);
    if (loader) {
      loader.classList.remove("is-active");
      loader.classList.add("is-done");
    }
  }

  /* ---------- 进入 CD 界面(加载完成后) ---------- */
  var ejectTimer = null;

  /* 每次打开 CD 架:等 1 秒后光驱弹出(可重复触发) */
  function scheduleEject() {
    clearTimeout(ejectTimer);
    if (!cd3dApi) return;
    ejectTimer = setTimeout(function () {
      if (body.classList.contains("scene-open") && cd3dApi) {
        cd3dApi.ejectDrive();          /* 等 1 秒后:光驱弹出 */
      }
    }, cd3dApi.timings.driveEjectDelay || 1000);
  }

  function startIntro() {
    hideLoader();
    setOpen(true);                       /* 视角左移,CD 架滑出(内部会调度光驱弹出) */
  }

  /* ---------- 音频可视化开关(左侧竖排,可叠加,记在 localStorage)---------- */
  var fxButtons = Array.prototype.slice.call(document.querySelectorAll(".fx-switch"));
  var FX_KEY = "cd-fx";

  function saveFx() {
    var s = {};
    fxButtons.forEach(function (b) { s[b.getAttribute("data-fx")] = b.getAttribute("aria-pressed") === "true"; });
    try { localStorage.setItem(FX_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function pushFx() {
    if (!cd3dApi || !cd3dApi.setFxMode) return;
    fxButtons.forEach(function (b) {
      cd3dApi.setFxMode(b.getAttribute("data-fx"), b.getAttribute("aria-pressed") === "true");
    });
  }

  fxButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      pushFx();
      saveFx();
    });
  });

  /* 恢复上次的开关状态(没存过就用 HTML 里的默认值)*/
  (function restoreFx() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(FX_KEY) || "null"); } catch (e) {}
    if (!saved) return;
    fxButtons.forEach(function (b) {
      var k = b.getAttribute("data-fx");
      if (typeof saved[k] === "boolean") b.setAttribute("aria-pressed", saved[k] ? "true" : "false");
    });
  })();

  /* ---------- Three.js 懒加载(资产缺失/无WebGL/减少动效 → DOM 降级) ---------- */
  var cd3dApi = null;
  var cd3dTried = false;

  function tryInit3D() {
    if (cd3dTried) return;
    cd3dTried = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.info("[cd3d] 跳过:系统开启了减少动效,继续使用 DOM 轮盘");
      startIntro();
      return;
    }
    if (!window.WebGLRenderingContext) {
      console.info("[cd3d] 跳过:浏览器不支持 WebGL,继续使用 DOM 轮盘");
      startIntro();
      return;
    }

    import(body.dataset.cd3d || "/js/cd3d.js")
      .then(function (mod) {
        return mod.initCd3d({
          container: wheel,
          selIndex: selIndex,
          audioUrl: body.dataset.cdAudio,     /* 光驱音效 + 音乐(Web Audio 合成/解码,无第三方库)*/
          fxUrl: body.dataset.cdFx,           /* 音频可视化(音频条 / 律动几何体)*/
          onProgress: function (p, label) { setProgress(p, label); },
          onReady: function (api) {
            cd3dApi = api;
            body.classList.add("cd3d-on");
            api.setSelection(selIndex);
            /* 可视化就绪:显示左侧开关 + 把当前状态和颜色推给它 */
            if (api.fx) {
              document.documentElement.classList.add("has-cd-fx");
              pushFx();
              repaintRack();
            }
            console.info("[cd3d] 3D 模式已激活");
            setProgress(100, "加载完成");
            startIntro();            /* 隐藏加载页 → 打开 CD 架 → 光驱弹出 */
          },
          onCdClick: function (key) {
            var i = cdOrder.indexOf(key);
            if (i === -1) return;
            console.info("[cd3d] 点击 CD:", key);
            /* 单击即选中并插入(无需点两次) */
            if (i !== selIndex) {
              selIndex = i;
              layout();
              cd3dApi.setSelection(i);
            }
            confirmTheme();
          },
          onScroll: function (dir) { step(dir); }
        }).then(function (api) {
          if (!api) {
            console.warn("[cd3d] 未能初始化(资产缺失/加载失败),继续使用 DOM 轮盘");
            startIntro();           /* 降级:直接进入 CD 界面,不播光驱动画 */
          }
        });
      })
      .catch(function (e) {
        console.warn("[cd3d] 模块加载失败:", e && e.message);
        startIntro();
      });
  }

  /* ---------- 初始状态 ---------- */
  var restored = false;
  var savedKey = null;
  try { savedKey = localStorage.getItem("intro-theme"); } catch (e) {}

  if (savedKey && panels.length) {
    /* 回访:面板先显示上次的主题(光驱内为空) */
    restored = true;
    activeKey = savedKey;
    playPanel(savedKey);
    cds.forEach(function (cd, i) {
      if (cd.getAttribute("data-panel") === savedKey) selIndex = i;
    });
    layout();
  } else {
    layout();
  }

  /* 先加载 3D(显示加载页),就绪后再进入 CD 界面;失败/超时则降级 */
  tryInit3D();
  setTimeout(function () {
    if (!loaderDone) {
      console.warn("[cd3d] 加载超时,进入降级模式");
      startIntro();
    }
  }, 9000);

  window.addEventListener("resize", layout);
})();
