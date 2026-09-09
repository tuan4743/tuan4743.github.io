/* 首页介绍页 v0.1:CD 弧形滚轮 + 光驱槽口交互(占位资产) */
(function () {
  "use strict";

  var body = document.body;
  var toggle = document.getElementById("intro-toggle");
  var drawer = document.getElementById("intro-drawer");
  var arc = document.getElementById("cd-arc");
  var slot = document.getElementById("cd-slot");
  var slotCd = document.getElementById("slot-cd");
  var hint = document.getElementById("tray-hint");
  var cds = Array.prototype.slice.call(document.querySelectorAll(".cd[data-panel]"));
  var panels = document.querySelectorAll(".intro-panel");
  var themeColors = {
    self: "rgb(34, 211, 238)",
    growth: "rgb(74, 222, 128)",
    lost: "rgb(167, 139, 250)",
    tech: "rgb(96, 165, 250)",
    future: "rgb(244, 114, 182)"
  };

  var selIndex = 0;
  var activeKey = null;      /* 当前机内 CD(已插入的主题) */
  var locked = false;        /* 插拔动画期间锁输入 */
  var arcRect = null;
  var R = 110;
  var STEP = 20;             /* 相邻 CD 的弧度步长(度) */
  var STORAGE = "intro-theme";

  /* ---------- 几何:CD 沿圆弧排布,选中位为 0°(弧中点) ---------- */
  function layout() {
    arcRect = arc.getBoundingClientRect();
    var cx = arcRect.width * 0.42;
    var cy = arcRect.height * 0.5;
    cds.forEach(function (cd, i) {
      var a = ((i - selIndex) * STEP) * Math.PI / 180;
      var x = cx + R * Math.cos(a) - cd.offsetWidth / 2;
      var y = cy + R * Math.sin(a) - cd.offsetHeight / 2;
      cd.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      var sel = i === selIndex;
      cd.classList.toggle("is-selected", sel);
      cd.classList.toggle("is-dimmed", !sel);
      if (sel) {
        cd.setAttribute("aria-selected", "true");
        slotCd.style.setProperty("--sl-color", themeColors[cd.getAttribute("data-panel")] || "");
      } else {
        cd.removeAttribute("aria-selected");
      }
    });
  }

  /* 占位槽口 CD 配色(真实资产替换后移除) */
  function paintSlotCd() {
    var c = getComputedStyle(slotCd).getPropertyValue("--sl-color").trim() || "rgba(128,128,128,.6)";
    slotCd.style.borderColor = c;
    slotCd.style.boxShadow = "0 0 12px " + c;
  }

  /* ---------- 选择 ---------- */
  function select(i) {
    if (locked) return;
    if (i < 0 || i >= cds.length) return;
    if (i === selIndex) { confirmTheme(); return; }
    selIndex = i;
    layout();
  }

  function step(dir) {
    select(selIndex + dir);
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

  function confirmTheme() {
    if (locked) return;
    var key = cds[selIndex].getAttribute("data-panel");
    if (key === activeKey) return;
    locked = true;

    (function cycle() {
      var ejecting = activeKey !== null;
      if (!ejecting) {
        insert();
        return;
      }
      slotCd.classList.remove("is-inserting");
      void slotCd.offsetWidth;
      slotCd.classList.add("is-ejecting");
      paintSlotCd();
      wait(720).then(function () {
        slotCd.classList.remove("is-ejecting");
        insert();
      });
    })();

    function insert() {
      slotCd.classList.remove("is-ejecting");
      void slotCd.offsetWidth;
      slotCd.classList.add("is-inserting");
      paintSlotCd();
      wait(820).then(function () {
        slotCd.classList.remove("is-inserting");
        activeKey = key;
        playPanel(key);
        slot.classList.add("is-playing");
        try { localStorage.setItem(STORAGE, key); } catch (e) {}
        locked = false;
        /* 首次选择完成后收起托盘,进入内容页 */
        if (!restored) {
          setOpen(false);
        }
      });
    }
  }

  /* ---------- 托盘开合 ---------- */
  function setOpen(open) {
    body.classList.toggle("intro-open", open);
    body.classList.toggle("intro-selecting", open && activeKey === null);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) {
      setTimeout(function () { layout(); }, 60);
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(!body.classList.contains("intro-open"));
  });

  document.addEventListener("click", function (e) {
    if (
      body.classList.contains("intro-open") &&
      !drawer.contains(e.target) &&
      !toggle.contains(e.target)
    ) {
      setOpen(false);
    }
  });

  /* ---------- 滚轮 / 方向键 ---------- */
  var lastWheel = 0;
  drawer.addEventListener("wheel", function (e) {
    e.preventDefault();
    var now = Date.now();
    if (now - lastWheel < 200) return;
    lastWheel = now;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener("keydown", function (e) {
    if (!body.classList.contains("intro-open")) return;
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

  /* ---------- CD 随鼠标微倾斜(占位,真实资产到位后升级为帧插值) ---------- */
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

  /* ---------- 初始状态 ---------- */
  var restored = false;
  var savedKey = null;
  try { savedKey = localStorage.getItem(STORAGE); } catch (e) {}

  if (savedKey && panels.length) {
    /* 老访客:直接播放上次主题,托盘关闭 */
    restored = true;
    activeKey = savedKey;
    playPanel(savedKey);
    cds.forEach(function (cd, i) {
      if (cd.getAttribute("data-panel") === savedKey) selIndex = i;
    });
    setOpen(false);
    layout();
    slot.classList.add("is-playing");
  } else {
    /* 新访客:显示 CD 选择页 */
    showSelection();
  }

  function showSelection() {
    setOpen(true);
    layout();
    if (hint) hint.textContent = "滚轮 / ↑↓ 选择 · 点击 CD 确认";
  }

  window.addEventListener("resize", layout);
})();
