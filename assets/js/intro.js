/* 首页介绍页 v0.2:屏幕+CD架刚体场景,CD轮以插入点(hub)为轴心 */
(function () {
  "use strict";

  var body = document.body;
  var toggle = document.getElementById("intro-toggle");
  var closeBtn = document.getElementById("rack-close");
  var rack = document.getElementById("rack");
  var wheel = document.getElementById("wheel");
  var hub = document.getElementById("hub");
  var hubCd = document.getElementById("hub-cd");
  var hint = document.getElementById("tray-hint");
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

    /* 3D 模式:让「真实选中的那张 CD」飞入光驱(前端补间) */
    var use3d = !!cd3dApi;
    var insertDelay = use3d ? cd3dApi.timings.insert + 80 : 820;
    var ejectDelay = use3d ? cd3dApi.timings.eject + 60 : 720;

    function finish() {
      activeKey = key;
      insertedKey = key;          /* 记录"盘已在光驱内" */
      moveSelectionOff(key);      /* 飞入完成后再补位/换中心,避免穿模 */
      playPanel(key);
      hub.classList.add("is-playing");
      try { localStorage.setItem("intro-theme", key); } catch (e) {}
      locked = false;
      setOpen(false);   /* 插入完成后收起 CD 架 */
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

  /* ---------- 场景平移开合(视角平移,刚体) ---------- */
  function setOpen(open) {
    body.classList.toggle("scene-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    rack.setAttribute("aria-hidden", open ? "false" : "true");
    if (cd3dApi) cd3dApi.setPaused(!open);
    if (open) {
      setTimeout(layout, 80);
      tryInit3D();
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(!body.classList.contains("scene-open"));
  });

  closeBtn.addEventListener("click", function () {
    setOpen(false);
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

  /* ---------- Three.js 懒加载(资产缺失/无WebGL/减少动效 → DOM 降级) ---------- */
  var cd3dApi = null;
  var cd3dTried = false;

  function tryInit3D() {
    if (cd3dTried) return;
    cd3dTried = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      console.info("[cd3d] 跳过:系统开启了减少动效,继续使用 DOM 轮盘");
      return;
    }
    if (!window.WebGLRenderingContext) {
      console.info("[cd3d] 跳过:浏览器不支持 WebGL,继续使用 DOM 轮盘");
      return;
    }

    import(body.dataset.cd3d || "/js/cd3d.js")
      .then(function (mod) {
        return mod.initCd3d({
          container: wheel,
          selIndex: selIndex,
          onReady: function (api) {
            cd3dApi = api;
            body.classList.add("cd3d-on");
            api.setSelection(selIndex);
            console.info("[cd3d] 3D 模式已激活");
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
          if (!api) console.warn("[cd3d] 未能初始化(资产缺失/加载失败),继续使用 DOM 轮盘");
        });
      })
      .catch(function (e) {
        console.warn("[cd3d] 模块加载失败:", e && e.message);
      });
  }

  /* ---------- 初始状态 ---------- */
  var restored = false;
  var savedKey = null;
  try { savedKey = localStorage.getItem("intro-theme"); } catch (e) {}

  if (savedKey && panels.length) {
    /* 回访:面板先显示上次的主题(光驱内为空),同时打开 CD 架进入选择界面 */
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
  /* 每次进入首页都默认打开 CD 选择界面(光驱内为空) */
  setOpen(true);

  window.addEventListener("resize", layout);
})();
