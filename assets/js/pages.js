(function () {
  "use strict";

  var builds = {};
  var live = {};
  var errors = [];

  function buildAll() {
    for (var type in builds) {
      if (!Object.prototype.hasOwnProperty.call(builds, type)) continue;
      var list = document.querySelectorAll("[data-" + type + "]");
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var key = el.getAttribute("data-" + type);
        if (!key || live[key]) continue;
        var api = null;
        try { api = builds[type](el, key); } catch (e) {
          errors.push(type + " / " + key + ": " + (e && e.message ? e.message : e));
          if (window.console) console.warn("[CDPages] " + type + " 初始化失败:", e);
        }
        if (api) { api.key = key; live[key] = api; }
      }
    }
  }

  function activeKey() {
    var on = document.querySelector(".intro-panel.is-active[data-panel]");
    return on ? on.getAttribute("data-panel") : null;
  }

  function activate(key) {
    buildAll();
    for (var k in live) {
      if (!Object.prototype.hasOwnProperty.call(live, k)) continue;
      live[k].activate(k === key);
    }
  }

  window.CDPages = {
    register: function (type, build) {
      builds[type] = build;
      buildAll();
      var k = activeKey();
      if (k) activate(k);
    },
    activate: activate,
    repaint: function () {
      for (var k in live) if (live[k] && live[k].repaint) live[k].repaint();
    },
    get: function (key) { return live[key] || null; },
    state: function () {
      var out = {};
      for (var k in live) out[k] = live[k].state ? live[k].state() : { active: true };
      return out;
    },
    keys: function () { return Object.keys(live); },
    errors: function () { return errors.slice(); }
  };

  function boot() {
    buildAll();
    var k = activeKey();
    if (k) activate(k);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  var rt = 0;
  window.addEventListener("resize", function () {
    if (rt) cancelAnimationFrame(rt);
    rt = requestAnimationFrame(function () { rt = 0; window.CDPages.repaint(); });
  });
})();
