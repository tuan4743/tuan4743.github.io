(function () {
  "use strict";

  var root = document.getElementById("tablet");
  var toggle = document.getElementById("statusbar-toggle");
  if (!root) return;

  var body = document.body;
  var KEY = "cd-tablet";
  var open = false;
  var hideT = 0;
  var clockT = 0;

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

  function setOpen(on, immediate) {
    on = !!on;
    if (on === open && !immediate) return;
    open = on;
    clearTimeout(hideT);

    if (on) {
      root.hidden = false;
      void root.offsetWidth;
      root.classList.add("is-on");
      root.setAttribute("aria-hidden", "false");
      body.classList.add("tablet-open");
      tickClock();
      clearInterval(clockT);
      clockT = setInterval(tickClock, 20000);
      var firstApp = immediate ? null : root.querySelector(".tablet__app");
      if (firstApp) { try { firstApp.focus({ preventScroll: true }); } catch (e) { } }
    } else {
      root.classList.remove("is-on");
      root.setAttribute("aria-hidden", "true");
      body.classList.remove("tablet-open");
      clearInterval(clockT); clockT = 0;
      if (immediate) {
        /* 引导收尾等程序化关闭:禁止收起动画。is-dark 一摘,平板子内容
           立即可见,若还走 .26s 淡出就会"闪出一瞬间平板界面"。 */
        root.style.transition = "none";
        hideT = setTimeout(function () {
          if (!open) { root.hidden = true; root.style.transition = ""; }
        }, 50);
      } else {
        hideT = setTimeout(function () { if (!open) root.hidden = true; }, 420);
        if (toggle) { try { toggle.focus({ preventScroll: true }); } catch (e) { } }
      }
    }
    if (toggle) toggle.setAttribute("aria-expanded", on ? "true" : "false");
    if (toggle) toggle.title = on ? "收起平板主界面,回到 CD" : "打开平板主界面";
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { }
  }

  if (toggle) {
    toggle.addEventListener("click", function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (body.classList.contains("scene-open")) return;
      setOpen(!open);
    }, true);
  }

  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (open && body.classList.contains("scene-open")) setOpen(false);
    }).observe(body, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setOpen(false);
    }
  });

  root.addEventListener("click", function (e) {
    var a = e.target && e.target.closest && e.target.closest("a.tablet__app");
    if (a) { try { localStorage.setItem(KEY, "0"); } catch (err) { } }
  });


  (function init() {
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { }
    var homePage = document.body.classList.contains("home-page");
    setOpen(!homePage && saved === "1", true);
    initBattery();
  })();

  window.__tabletOpen = function (on) {
    setOpen(on !== false, true);
    return open;
  };

  window.__tablet = function () {
    var cs = null;
    try { cs = window.getComputedStyle(root); } catch (e) { }
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
      switches: {
        theme: !!document.getElementById("theme-toggle"),
        sound: !!document.getElementById("sound-toggle"),
        volume: !!document.getElementById("volume-range"),
        palette: !!document.getElementById("palette-toggle")
      },
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
