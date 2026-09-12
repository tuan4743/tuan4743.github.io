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

  /* 菱形平铺图案:一块 tile 里放 4x4 个正方形,每个朝向/大小都随机(否则满屏菱形一模一样,
     一眼就看出是贴图)。填充用主题色 25% 透明。
     注意 tile 变大了(4 格),所以 CSS 的 --bg-tile 也要跟着 ×4 */
  function diamondBg(hex) {
    var c = /^#[0-9a-fA-F]{6}$/.test(String(hex || "")) ? hex : "#888888";
    c = liftForBase(c);
    var cell = 40, n = 4, side = 17;
    var parts = "";
    for (var r = 0; r < n; r++) {
      for (var q = 0; q < n; q++) {
        var cx = q * cell + cell / 2, cy = r * cell + cell / 2;
        var ang = 45 + (Math.random() * 34 - 17);          /* 45° ± 17° */
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

  /* CD 架文字介绍 + 背景色:都跟随"当前选中的那张盘"(滚动换选即变色)*/
  function paintRackInfo(key) {
    if (key === rackPainted) return;
    rackPainted = key;
    /* 主题色:直接取主题色表(老文字块已删)*/
    var themeFg = themeColors[key] || "#22d3ee";
    rack.style.setProperty("--rack-fg", themeFg);
    /* 新全息 UI 里的大标题 + 右侧配字 */
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
    /* 广播:锁定圆那一层会据此快速淡出,切换停稳后再淡回来 */
    try { window.dispatchEvent(new CustomEvent("cd-select", { detail: key })); } catch (e) {}
    window.__rackDebug = { key: key, bg: themeFg, fg: themeFg, at: Math.round(performance.now()) };
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
    /* 点击已经选中的那张盘:不再插入(插入只走侧边按钮)*/
    if (i === selIndex) return;
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
    /* 插入动画开始:锁定圆那一层保持隐藏(节点不隐藏)*/
    try { window.dispatchEvent(new CustomEvent("cd-busy", { detail: true })); } catch (e) {}
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
      /* 这里先不放音乐:等开机动画播完再起 BGM(见下面的 screenBoot 回调)。
         插入动作的音效不属于音乐,照旧 */
      moveSelectionOff(key);      /* 飞入完成后再补位/换中心,避免穿模 */
      playPanel(key);
      hub.classList.add("is-playing");
      try { localStorage.setItem("intro-theme", key); } catch (e) {}
      locked = false;
      if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      /* 用这张盘对应的那套开机动画(emoji / 六边形 / 水面 / 故障 / 雪花分形)*/
      bootStyle = (window.CDBoot && window.CDBoot.styleFor) ? window.CDBoot.styleFor(key) : "hex";
      /* 回到主界面。音乐要等动画彻底放完才开始 —— 开机时是"静音通电"的 */
      try { window.dispatchEvent(new CustomEvent("cd-busy", { detail: false })); } catch (e) {}
      setOpen(false, function () {
        if (cd3dApi && cd3dApi.audio) cd3dApi.audio.music.toBgm(key);
        if (cd3dApi && cd3dApi.setMusicPreview) cd3dApi.setMusicPreview(true);
      });
      /* 可视化等镜头平移完再开 */
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

  /* ---------- 开机动画的公共前缀(黑屏 + 进度)---------- */
  var HEX = {
    cols: 15, rows: 7,     /* 7 行:消失顺序 4 → 3/5 → 2/6 → 1/7 */
    load: 1800,           /* 进度条 0→100% 的时长(ms)—— 已整体 ×2 */
    hold: 1000,           /* 读满后停顿(让 100% 看清楚)—— 已 ×2 */
    fade: 520,            /* loading 淡出 —— 已 ×2 */
    draw: 430,            /* 六边形描边时长(只有成长那套用)*/
    drawEach: 2.2,        /* 描边随机错开的窗口(ms × 个数)*/
    collapse: 400         /* 六边形塌缩时长(消失用时越快越干脆)/ */
  };
  var bootRAF = 0;

  var bootRAF = 0;
  var bootStyle = "hex";        /* 当前这张盘用哪套动画(见 cd-boot.js 的 BY_KEY)*/

  /* 小黄脸素材提前抓好 —— 放到第一次播动画时才抓的话,那 10 个 svg 的取回+解码
     会把首帧卡住,动画开头就会卡成静止画面 */
  setTimeout(function () {
    if (window.CDBoot && window.CDBoot.preload) window.CDBoot.preload();
  }, 1200);

  /* 开机动画的统一流程:黑屏 + 进度条(所有盘共用)→ 各盘的 scene 接管画面
     每个 scene 由 cd-boot.js 提供:{ total, draw(el) } —— 它自己负责盖住/揭开页面 */
  function screenBoot(style, onEnd) {
    if (!staticCtx || !staticWrap || noMotion || !window.CDBoot) { if (onEnd) onEnd(); return; }
    if (staticRAF) { cancelAnimationFrame(staticRAF); staticRAF = 0; }
    if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = 0; }
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    staticCv.width = Math.max(1, Math.round(staticCv.clientWidth * dpr));
    staticCv.height = Math.max(1, Math.round(staticCv.clientHeight * dpr));
    var W = staticCv.width, H = staticCv.height;
    staticWrap.classList.add("is-on");        /* 画布可见(opacity:1)—— 少了这个,撤掉 is-black 后
                                                 opacity 会退回 0,整个动画就"看不见"了 */
    /* 开工前把上一轮收尾留下的内联隐藏清掉,否则这次动画会看不见 */
    staticWrap.style.opacity = "";
    staticWrap.style.visibility = "";
    staticWrap.style.transition = "";
    staticWrap.classList.add("is-black");     /* 起手:黑屏 + 不透明 */
    var accent = "#22d3ee";
    try {
      var v = getComputedStyle(document.querySelector(".screen")).getPropertyValue("--intro-accent").trim();
      if (v) accent = v;
    } catch (e) {}

    var used = style || bootStyle || "hex";
    /* 全息后期层:场景/loading 都画在离屏画布,再统一过一遍成像 */
    var POST = window.CDBootPost || null;
    var sceneCtx = POST ? POST.context(W, H) : staticCtx;
    var scene = window.CDBoot.create(used, sceneCtx, W, H, accent, HEX);
    var tFull = HEX.load;                                  /* 进度读满 */
    var tFadeIn = tFull + HEX.hold;                        /* 停 0.5s 后开始淡出 */
    var tPanel = tFadeIn + HEX.fade;                       /* loading 淡完 → 交给 scene */
    var tEnd = tPanel + scene.total;
    var t0 = performance.now();
    window.__bootLastAt = Math.round(t0);
    window.__bootStyle = used;
    window.__bootTotalMs = Math.round(tEnd);
    window.__bootPhases = {
      full: tFull, holdEnd: tFadeIn, panel: tPanel,
      black: tPanel + (scene.blackUntil || 0),      /* 黑屏撤掉的时刻 */
      sceneEnd: tEnd
    };
    var droppedBlack = false;

    /* 共用的 loading(黑屏 + 转动的六边形 + 百分比)*/
    function drawLoader(el) {
      staticCtx.fillStyle = "#04060a";
      staticCtx.fillRect(0, 0, W, H);
      var p = Math.min(1, el / HEX.load);
      p = 1 - Math.pow(1 - p, 1.5);                        /* 末尾慢一点,读得清 */
      var outA = el > tFadeIn ? Math.max(0, 1 - (el - tFadeIn) / HEX.fade) : 1;
      var cx = W / 2, cy = H / 2, rr = Math.min(W, H) * 0.075;
      staticCtx.globalAlpha = outA;
      staticCtx.save();
      staticCtx.translate(cx, cy);
      staticCtx.rotate(el / 900);
      staticCtx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 180 * (60 * i - 90);
        if (i === 0) staticCtx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else staticCtx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      staticCtx.closePath();
      var per = 6 * rr;
      staticCtx.setLineDash([per * 0.22, per * 0.78]);
      staticCtx.lineDashOffset = -el / 12;
      staticCtx.strokeStyle = accent;
      staticCtx.lineWidth = Math.max(1.5, rr * 0.05);
      staticCtx.stroke();
      staticCtx.setLineDash([]);
      staticCtx.restore();
      staticCtx.fillStyle = accent;
      staticCtx.font = "600 " + Math.round(Math.min(W, H) * 0.032) + "px ui-monospace, Consolas, monospace";
      staticCtx.textAlign = "center";
      staticCtx.textBaseline = "middle";
      staticCtx.globalAlpha = outA * (0.55 + 0.45 * Math.abs(Math.sin(el / 260)));
      /* 中间的 "LOADING xx%" 文字已移除:进度由圆环 + 环内百分比表达 */

      /* ================= 终端启动外壳 =================
         配色:霓虹青 / 冰蓝;第四张(glitch)混入品红
         辉光:画布原生 shadowBlur(不是 CSS filter,安全)
         色差:文字画三遍(红偏移 / 青偏移 / 正本),lighter 叠加
         数据密度:右侧一列十六进制与实时跳动数值
         排版:左侧日志整体轻微倾斜,MOUNTING 行两侧带进度条
         圆环:虚线外圈 + 旋转刻度 + 雷达扫描 + 多层嵌套弧            */
      var IS_GLITCH = String(used || "").toLowerCase() === "glitch";
      var C_CYAN = "#7ff0ff";                       /* 主色:霓虹青 */
      var C_ICE = "#bfe9ff";                        /* 冰蓝:次级文字 */
      var C_DIM = "rgba(127, 240, 255, 0.45)";
      var C_ACC = "#7ff0ff";                        /* 平时一律霓虹青;红色只在"卡住"时出现 */

      function glowText(txt, x, y, color, blur, aber) {
        staticCtx.save();
        /* ★ shadowBlur 很贵:blur<=0 时不画阴影,只留给关键元素(当前行/圆环/百分比)*/
        if (blur > 0) {
          staticCtx.shadowColor = color;
          staticCtx.shadowBlur = blur;
        }
        staticCtx.fillStyle = color;
        staticCtx.fillText(txt, x, y);
        /* 色差:左右各偏一点点,红/青通道错开 */
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
        "> OPTICAL BIOS  v1.4",
        "> DRIVE SPIN-UP ........... OK",
        "> MOUNTING DISC " + String(used || "").toUpperCase(),
        "> READING SECTORS ......... 100%",
        "> SIGNAL LOCK ............. STABLE",
        "> READY",
        "! SECTOR RETRY ... HOLD"
      ];
      /* ---- 逐步故障(第四张最明显)----
         pShow:显示用的进度 —— 在 STALL_A~STALL_B 之间卡住不动,之后猛冲完成
         glitchAmt:0→1,控制 RGB 分离幅度与报警色 */
      var GLITCH_K = IS_GLITCH ? 1 : 0;             /* 逐步故障只给第四张 */
      var STALL_A = 0.62, STALL_B = 0.80;
      var stalling = IS_GLITCH && p > STALL_A && p < STALL_B;   /* ★ 只有第四张会卡住 */
      /* 不卡住时 pShow 就等于 p —— 其它盘进度完全顺滑,只有第四张会在 62% 冻住 */
      var pShow = stalling ? STALL_A : p;
      var glitchAmt = Math.min(1, GLITCH_K * (stalling ? 1 : p * 0.85));
      var typed = pShow * (LOG.length + 0.5) + (stalling ? 1 : 0);   /* 卡住时把告警行顶出来 */
      var fs2 = Math.max(14, Math.round(Math.min(W, H) * 0.021 * 1.4));   /* 字号 ×1.4 */
      var lh = Math.round(fs2 * 1.45);
      var lx = Math.round(W * 0.062), ly = Math.round(H * 0.07);          /* 往右挪一点 */

      staticCtx.save();
      staticCtx.translate(lx, ly);
      staticCtx.rotate(-0.022);                     /* 轻微倾斜,打破死板对齐 */
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

        /* MOUNTING 这一行两侧各加一根进度条 */
        if (li === 2 && reach > 0.2) {
          var barW = Math.round(W * 0.13), barH = 3;
          var bx = staticCtx.measureText(txt).width + 14;
          staticCtx.globalAlpha = outA * 0.9;
          staticCtx.shadowColor = C_ACC; staticCtx.shadowBlur = 8;
          staticCtx.fillStyle = "rgba(127,240,255,0.18)";
          staticCtx.fillRect(bx, 5, barW, barH);
          staticCtx.fillStyle = C_ACC;
          staticCtx.fillRect(bx, 5, barW * pShow, barH);
          /* 左右各一根,右边反方向 */
          staticCtx.fillStyle = "rgba(127,240,255,0.18)";
          staticCtx.fillRect(-barW - 26, 5, barW, barH);
          staticCtx.fillStyle = C_CYAN;
          staticCtx.fillRect(-26 - barW * pShow, 5, barW * pShow, barH);
          staticCtx.shadowBlur = 0;
        }
      }
      staticCtx.restore();

      /* ---------- 数据流(右侧 + 左下):按 90ms 缓存成图,每帧只贴一次 ---------- */
      var seed = Math.floor(el / 90);
      function rnd(i) { var x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
      if (!window.__bootDataCv) {
        window.__bootDataCv = document.createElement("canvas");
        window.__bootDataSeed = -1;
      }
      var dcv = window.__bootDataCv;
      if (dcv.width !== W || dcv.height !== H) { dcv.width = W; dcv.height = H; window.__bootDataSeed = -1; }
      if (window.__bootDataSeed !== seed) {
        window.__bootDataSeed = seed;
        var dg = dcv.getContext("2d");
        dg.setTransform(1, 0, 0, 1, 0, 0);
        dg.clearRect(0, 0, W, H);
        dg.font = Math.max(9, Math.round(fs2 * 0.72)) + "px \"Alpha Sector\", ui-monospace, Consolas, monospace";
        dg.textBaseline = "top";
        dg.textAlign = "right";
        var di;
        for (di = 0; di < 9; di++) {
          var val;
          if (di % 3 === 0) val = "0x" + Math.floor(rnd(di) * 65535).toString(16).toUpperCase().padStart(4, "0");
          else if (di % 3 === 1) val = "SIG " + (95 + rnd(di) * 4.9).toFixed(1) + "%";
          else val = "LAT " + (6 + rnd(di) * 9).toFixed(1) + "ms";
          dg.globalAlpha = 0.35 + 0.35 * rnd(di + 40);
          dg.fillStyle = di % 3 === 0 ? C_DIM : C_ICE;
          dg.fillText(val, W * 0.955, H * 0.07 + di * lh);
        }
        dg.textAlign = "left";
        for (var dj = 0; dj < 4; dj++) {
          dg.globalAlpha = 0.3 + 0.3 * rnd(dj + 130);
          dg.fillStyle = C_DIM;
          dg.fillText("BUF 0x" + Math.floor(rnd(dj + 90) * 65535).toString(16).toUpperCase().padStart(4, "0"),
                      W * 0.062, H - lh * (dj + 1.2) - 6);
        }
      }
      staticCtx.save();
      staticCtx.globalAlpha = outA;
      staticCtx.drawImage(dcv, 0, 0);
      staticCtx.restore();

      /* ---------- 中央圆环:多层嵌套 + 虚线外圈 + 旋转刻度 + 雷达扫描 ---------- */
      staticCtx.save();
      staticCtx.translate(cx, cy);
      staticCtx.globalAlpha = outA;
      var rBase = rr * 1.7;

      /* 1) 虚线外圈(缓慢反向自转)*/
      staticCtx.save();
      staticCtx.rotate(-el / 2600);
      staticCtx.setLineDash([rr * 0.34, rr * 0.26]);
      staticCtx.lineWidth = Math.max(1, rr * 0.07);
      staticCtx.strokeStyle = C_DIM;
      staticCtx.shadowColor = C_CYAN; staticCtx.shadowBlur = 6;
      staticCtx.beginPath();
      staticCtx.arc(0, 0, rBase * 1.26, 0, Math.PI * 2);
      staticCtx.stroke();
      staticCtx.restore();

      /* 2) 旋转刻度(每 15° 一根,长短交替)*/
      staticCtx.save();
      staticCtx.rotate(el / 1700);
      staticCtx.setLineDash([]);
      staticCtx.lineWidth = Math.max(1, rr * 0.055);
      for (var ti = 0; ti < 24; ti++) {
        var ang = (Math.PI * 2 / 24) * ti;
        var long = ti % 2 === 0;
        var r1 = rBase * (long ? 1.06 : 1.12), r2 = rBase * 1.2;
        staticCtx.globalAlpha = outA * (long ? 0.55 : 0.3);
        staticCtx.strokeStyle = long ? C_CYAN : C_ICE;
        staticCtx.beginPath();
        staticCtx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        staticCtx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        staticCtx.stroke();
      }
      staticCtx.restore();

      /* 3) 雷达扫描(一圈渐隐的扇形,持续旋转)*/
      staticCtx.save();
      staticCtx.rotate(el / 620);
      staticCtx.globalAlpha = outA * 0.5;
      var sweep = staticCtx.createConicGradient ? staticCtx.createConicGradient(0, 0, 0) : null;
      if (sweep) {
        sweep.addColorStop(0, "rgba(127,240,255,0)");
        sweep.addColorStop(0.12, "rgba(127,240,255,0.5)");
        sweep.addColorStop(0.25, "rgba(127,240,255,0)");
        sweep.addColorStop(1, "rgba(127,240,255,0)");
        staticCtx.fillStyle = sweep;
        staticCtx.beginPath();
        staticCtx.arc(0, 0, rBase * 1.02, 0, Math.PI * 2);
        staticCtx.fill();
      }
      staticCtx.restore();

      /* 4) 进度主环 + 内侧细环(双向)*/
      staticCtx.setLineDash([]);
      staticCtx.lineWidth = Math.max(2, rr * 0.17);
      staticCtx.strokeStyle = "rgba(127, 240, 255, 0.16)";
      staticCtx.beginPath();
      staticCtx.arc(0, 0, rBase, 0, Math.PI * 2);
      staticCtx.stroke();
      staticCtx.save();
      staticCtx.rotate(-Math.PI / 2);
      var ringCol = stalling ? "#ff4d5e" : C_ACC;
      staticCtx.strokeStyle = ringCol;
      staticCtx.shadowColor = ringCol; staticCtx.shadowBlur = stalling ? 22 : 14;
      staticCtx.beginPath();
      staticCtx.arc(0, 0, rBase, 0, Math.PI * 2 * pShow);
      staticCtx.stroke();
      staticCtx.restore();

      staticCtx.save();
      staticCtx.rotate(el / 900);
      staticCtx.setLineDash([rr * 0.18, rr * 0.3]);
      staticCtx.lineWidth = Math.max(1, rr * 0.07);
      staticCtx.strokeStyle = C_ICE;
      staticCtx.globalAlpha = outA * 0.5;
      staticCtx.shadowBlur = 0;
      staticCtx.beginPath();
      staticCtx.arc(0, 0, rBase * 0.72, 0, Math.PI * 2);
      staticCtx.stroke();
      staticCtx.restore();

      staticCtx.restore();

      /* ---------- 中央百分比(带辉光)*/
      staticCtx.save();
      staticCtx.font = "600 " + Math.round(Math.min(W, H) * 0.032) + "px ui-monospace, Consolas, monospace";
      staticCtx.textAlign = "center";
      staticCtx.textBaseline = "middle";
      staticCtx.globalAlpha = outA * (0.6 + 0.4 * Math.abs(Math.sin(el / 260)));
      glowText(Math.round(pShow * 100) + "%", cx, cy, stalling ? "#ff4d5e" : C_CYAN, 16);
      staticCtx.restore();

      staticCtx.textAlign = "center";
      staticCtx.textBaseline = "middle";
      staticCtx.globalAlpha = 1;
      staticCtx.globalAlpha = 1;
    }

    function frame(now) {
      var el = now - t0;
      if (el >= tEnd) {
        staticCtx.setTransform(1, 0, 0, 1, 0, 0);
        staticCtx.clearRect(0, 0, W, H);
        if (POST) POST.reset();          /* 离屏也清掉,避免收尾时残留最后一帧 */
        /* 确定性收尾:不依赖"清画布"这一件事 ——
           直接把这一层隐掉(内联样式优先级最高),彻底杜绝残留的泛光/扫描线/噪点 */
        staticWrap.style.opacity = "0";
        staticWrap.style.visibility = "hidden";
        staticWrap.style.transition = "none";
        staticWrap.classList.remove("is-black");
        staticWrap.classList.remove("is-on");
        bootRAF = 0;
        if (onEnd) onEnd();        /* 动画放完 → 这时候才开始放背景音乐 */
        return;
      }
      staticCtx.setTransform(1, 0, 0, 1, 0, 0);
      staticCtx.globalAlpha = 1;
      staticCtx.globalCompositeOperation = "source-over";
      staticCtx.clearRect(0, 0, W, H);
      if (el < tPanel) {
        drawLoader(el);
        bootRAF = requestAnimationFrame(frame);
        return;
      }
      /* 交给 scene 之后就不再铺全屏黑底:"谁盖住页面"由 scene 自己负责,
         这样它才能一块一块地把页面露出来。
         但若场景声明了 blackUntil(此刻它还没盖住页面),黑屏就再留一会儿 ——
         否则铺满之前页面会从缝隙里透出来(emoji 场景正是如此) */
      var holdBlack = tPanel + (scene.blackUntil || 0);
      if (!droppedBlack && el >= holdBlack) { staticWrap.classList.remove("is-black"); droppedBlack = true; }
      /* ★ 关键:场景画在离屏画布上,离屏必须【每帧先清空】再画 ——
         否则上一帧残留在下面,和下一帧叠在一起(帧残留/重影)。
         原来场景直接画在可见画布上时,是靠上面那句 clearRect 清掉的。 */
      if (POST) {
        sceneCtx.setTransform(1, 0, 0, 1, 0, 0);
        sceneCtx.globalAlpha = 1;
        sceneCtx.globalCompositeOperation = "source-over";
        sceneCtx.clearRect(0, 0, W, H);
      }
      scene.draw(el - tPanel);
      /* 每张盘的标志性动作(画在离屏上,随后由后期层统一输出)*/
      if (window.CDBootFx) window.CDBootFx.apply(used, sceneCtx, W, H, el - tPanel, { fillDone: (scene.blackUntil || 0) });
      if (POST) POST.present(staticCtx, W, H, el, 1);   /* 过一遍全息成像:泛光/扫描线/暗角/噪点 */
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
    /* 关键:开机动画的循环也要停 —— 否则它在收尾时会 remove("is-black"),
       把这里的黑屏又撤掉(用户在动画播到一半时重新打开 CD 架就会踩到)*/
    if (bootRAF) { cancelAnimationFrame(bootRAF); bootRAF = 0; }
    if (staticCtx) staticCtx.clearRect(0, 0, staticCv.width, staticCv.height);
    staticWrap.classList.remove("is-on");
    staticWrap.classList.add("is-black");
  }
  /* 调试/验证入口:手动放一段花屏 */
  window.__runStatic = runStatic;
  window.__screenBoot = screenBoot;      /* 调试/验证入口:手动放一次开机动画(__screenBoot("emoji") 指定那套)*/
  window.__hexCfg = HEX;                 /* 调试:可以直接改 loading 的时长 */

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
  function setOpen(open, onBootEnd) {
    body.classList.toggle("scene-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    rack.setAttribute("aria-hidden", open ? "false" : "true");
    if (cd3dApi) cd3dApi.setPaused(!open);
    /* 打开 CD 架(= 光驱拔出)= 屏幕黑掉,一直黑到插盘;
       回到主界面 = 先花屏 1.5 秒,再出画面 */
    if (open) screenOff();
    else screenBoot(undefined, onBootEnd);   /* 回到主界面:黑屏 loading → 本盘的动画 → 露出界面 */
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

  /* ---------- 插入按钮(左中)+ 两根纵向滑条 ----------
     插入统一走按钮:点碟片只负责选中,不再插入 */
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
  /* 上:背景整体强度(直接乘在第一层星云上)*/
  bindSlider("rack-bg-power", function (v) {
    rack.style.setProperty("--bg-power", v.toFixed(2));
  });
  /* 下:星云整体可见度(3D 粒子带 + 连线 + 第三层光晕一起)*/
  bindSlider("rack-neb-power", function (v) {
    rack.style.setProperty("--glow-alpha", v.toFixed(2));
    if (cd3dApi && cd3dApi.setNebulaVisibility) cd3dApi.setNebulaVisibility(v);
  });

  /* ---------- CD 点击:只负责"选中",不再插入 ----------
     插入统一走左侧中部的按钮(见下面的 .rack-insert);
     点碟片 = 把它滚到中间选中,点已选中的那张也不再插入 */
  cds.forEach(function (cd) {
    cd.addEventListener("click", function () {
      var i = cds.indexOf(cd);
      if (i !== selIndex) { selIndex = i; layout(); }
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
            /* 可视化就绪:把当前主题色推给星云带(视觉化开关已经去掉了)*/
            document.documentElement.classList.add("has-cd-fx");
            repaintRack();
            console.info("[cd3d] 3D 模式已激活");
            setProgress(100, "加载完成");
            startIntro();            /* 隐藏加载页 → 打开 CD 架 → 光驱弹出 */
          },
          onCdClick: function (key) {
            var i = cdOrder.indexOf(key);
            if (i === -1) return;
            console.info("[cd3d] 点击 CD:", key);
            /* 单击只负责选中,不再插入(插入只走侧边按钮)*/
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
