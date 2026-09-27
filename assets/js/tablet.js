/* ============================================================
   平板主界面(用户要求)
   ─────────────────────────────────────────────────────────────
   按屏幕顶缘那个箭头 → 整块屏幕变成一块平板的主屏;再按(或 Esc)→ 回到 CD。
   ★ 为什么做成独立的层,而不是改造原来的下拉菜单:
       下拉菜单是浮在页面【上面】的,而页面本身有 5 张盘各自的层级
       (z-index 最大到 8)和各自的画布 —— 只要一处层级算错,菜单就会被
       当前那张盘盖住。用户的抱怨正是"会挡住或被当前 CD 的页面遮挡"。
       做成独立一层、放在屏幕轮廓之内、z-index 高于所有盘,就不会和盘打架。
   ★ 和黑屏那层(.screen-static)同一个方案:.screen 下的绝对定位 + 满铺,
       于是 frame-fitted 给那一层加的剪裁规则能原样复用到这一层,
       严丝合缝待在玻璃里(而不是盖到金属框上)。
   ★ 状态记忆在 localStorage(和原来的状态栏开关同一个键 "cd-statusbar",
       语义从"状态栏显示/隐藏"升级为"平板主界面开/关" —— 用户按一次
       打开平板,刷新后应该还是打开的,不然每次进来都要再按一次)。
   ============================================================ */
(function () {
  "use strict";

  var root = document.getElementById("tablet");
  var toggle = document.getElementById("statusbar-toggle");
  if (!root) return;

  var body = document.body;
  /* ★ 键名【不能】沿用 "cd-statusbar"。
     intro.js 里那套"显示/隐藏状态栏"用的是这个键,而且它每次进页面都会
     setStatusbar(saved !== "0") → setItem(KEY, "1") ——
     两个功能共用一个键的话,intro.js 每加载一次就往里写一个 "1",
     平板就会在【每次刷新时自己弹出来】。用户按过一次开之后永远关不掉。
     ⇒ 各用各的键:cd-statusbar 归状态栏,cd-tablet 归平板。 */
  var KEY = "cd-tablet";
  var open = false;
  var hideT = 0;
  var clockT = 0;

  /* ---------- 时钟 / 日期 / 电量 ---------- */
  var WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  var elTime = root.querySelector("[data-tablet-time]");
  var elWeek = root.querySelector("[data-tablet-weekday]");
  var elDate = root.querySelector("[data-tablet-date]");
  var elBatt = root.querySelector("[data-tablet-battery]");

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  function tickClock() {
    var d = new Date();
    if (elTime) elTime.textContent = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (elWeek) elWeek.textContent = WEEK[d.getDay()];
    if (elDate) elDate.textContent = (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  /* 电量:有 Battery API 就用真的(B 站那类网页常用的东西,这里只是让它更像平板);
     没有就按时间给一个稳定但看着合理的值 —— 不假装在变。 */
  function initBattery() {
    if (!elBatt) return;
    function paint(level, charging) {
      var pct = Math.max(6, Math.min(100, Math.round(level * 100)));
      elBatt.style.setProperty("--batt", pct + "%");
      elBatt.classList.toggle("is-charging", !!charging);
    }
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        paint(b.level, b.charging);
        b.addEventListener("levelchange", function () { paint(b.level, b.charging); });
        b.addEventListener("chargingchange", function () { paint(b.level, b.charging); });
      }).catch(function () { paint(0.86, false); });
    } else {
      paint(0.86, false);
    }
  }

  /* ---------- 开 / 合 ----------
     ★ 转场:整块平板从【略微缩小 + 下移 + 变暗】展开到位,APP 图标依次错开落位。
       全程 ~360ms —— 用户要"短的过场动画":太长会显得卡,太短会像闪一下。
     ★ 用 [hidden] 控制存在性、用 .is-on 控制过渡:两边不同拍会让过渡不跑
       (这个坑在本项目里踩过 —— 见 .frost-read 的注释)。 */
  function setOpen(on, immediate) {
    on = !!on;
    if (on === open && !immediate) return;
    open = on;
    clearTimeout(hideT);

    if (on) {
      root.hidden = false;
      /* 强制一次布局,保证 [hidden]→可见 和 .is-on 是两拍(否则过渡被吃掉) */
      void root.offsetWidth;
      root.classList.add("is-on");
      root.setAttribute("aria-hidden", "false");
      body.classList.add("tablet-open");
      tickClock();
      clearInterval(clockT);
      clockT = setInterval(tickClock, 20000);
      /* 焦点交给第一个 APP,键盘用户 Tab 得进来。
         ★ immediate = 这次是【页面加载时恢复状态】,不是用户按的 ——
           那时抢焦点会平白在页面上画出一个焦点框(而且回车就把它打开了)。 */
      var firstApp = immediate ? null : root.querySelector(".tablet__app");
      if (firstApp) { try { firstApp.focus({ preventScroll: true }); } catch (e) { } }
    } else {
      root.classList.remove("is-on");
      root.setAttribute("aria-hidden", "true");
      body.classList.remove("tablet-open");
      clearInterval(clockT); clockT = 0;
      hideT = setTimeout(function () { if (!open) root.hidden = true; }, 420);
      /* 收起后焦点回到那枚开关 —— 同上,恢复状态时不抢 */
      if (toggle && !immediate) { try { toggle.focus({ preventScroll: true }); } catch (e) { } }
    }
    if (toggle) toggle.setAttribute("aria-expanded", on ? "true" : "false");
    if (toggle) toggle.title = on ? "收起平板主界面,回到 CD" : "打开平板主界面";
    /* 记忆:开关两个方向都写,刷新后是什么状态就是什么状态 */
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { }
  }

  /* ---------- 输入 ---------- */
  /* ★ 按下箭头 = 开/合平板。
     原来的点击处理器(intro.js 里那个)是把状态栏藏起来 ——
     那个功能现在由平板主界面取代了,所以这里用【捕获阶段 + stopImmediatePropagation】
     把这一下截下来,不再让那套逻辑跑。
     ★ 为什么用捕获而不是"后注册":同一个元素上的多个监听是按注册顺序跑的,
       intro.js 先注册就先进,我加在后面只能"事后再补救"。
       捕获阶段在目标阶段之前,才拦得住。 */
  if (toggle) {
    toggle.addEventListener("click", function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      /* CD 架拉出来时不开平板:平板层不在 .scene 里,不会跟着场景左移,
         那时打开它就和金属框错位了(按钮这时也是隐藏的,这里只是兜底)。 */
      if (body.classList.contains("scene-open")) return;
      setOpen(!open);
    }, true);
  }

  /* CD 架一拉出来就把平板收回去 —— 理由同上。
     ★ 用 MutationObserver 盯 body 的 class:intro.js 那边是 classList.toggle,
       没有任何事件可以听。 */
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (open && body.classList.contains("scene-open")) setOpen(false);
    }).observe(body, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) {
      /* ★ 搜索框里按 Esc 只收起搜索结果,不该把整个平板关掉 ——
         所以先看焦点在不在输入框里。 */
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setOpen(false);
    }
  });

  /* 点平板里的 APP 就等于离开这一页,先把状态收起来(免得返回时是开着的) */
  root.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a.tablet__app");
    if (a) { try { localStorage.setItem(KEY, "0"); } catch (err) { } }
  });

  /* ---------- 起来 ---------- */
  (function init() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { }
    /* 记忆:默认关(进来先看 CD)。用户按开之后,刷新仍然是开的。 */
    setOpen(saved === "1", true);
    initBattery();
  })();

  /* 现场读数 —— 和 __frostMark / __frostAurora 同一个用意:
     这个环境没有浏览器,留一个能一眼问出答案的口子。 */
  window.__tablet = function () {
    var cs = null;
    try { cs = window.getComputedStyle(root); } catch (e) { }
    /* 几何也报出来:这一层最容易错的就是"内容有没有落在玻璃窗口里",
       而这环境没有浏览器,只能靠读数对账(玻璃四边 = --ff-win-*)。 */
    var rs = null;
    try { rs = document.documentElement.style; } catch (e) { }
    var box = null;
    try {
      var r = root.getBoundingClientRect();
      box = { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) };
    } catch (e) { }
    return {
      open: open,
      hidden: root.hidden,
      className: root.className,
      apps: root.querySelectorAll(".tablet__app").length,
      cards: root.querySelectorAll(".tablet__card").length,
      hasClock: !!elTime,
      time: elTime ? elTime.textContent : "",
      weekday: elWeek ? elWeek.textContent : "",
      date: elDate ? elDate.textContent : "",
      css: cs ? {
        opacity: cs.opacity, transform: cs.transform, zIndex: cs.zIndex,
        inset: [cs.top, cs.right, cs.bottom, cs.left].join(" "),
        padding: cs.padding
      } : null,
      box: box,
      glass: rs ? {
        t: rs.getPropertyValue("--ff-win-top"), r: rs.getPropertyValue("--ff-win-right"),
        b: rs.getPropertyValue("--ff-win-bottom"), l: rs.getPropertyValue("--ff-win-left")
      } : null,
      toggleFound: !!toggle,
      toggleZ: toggle ? (function () { try { return getComputedStyle(toggle).zIndex; } catch (e) { return null; } })() : null,
      sceneOpen: body.classList.contains("scene-open")
    };
  };
})();
