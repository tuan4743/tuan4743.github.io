/* ============================================================
   每张盘"自己的主页内容"页 —— 核心(注册 / 切换 / 重排)
   ─────────────────────────────────────────────────────────────
   各个页面模块自己注册(按 DOM 上的 data-<type> 找元素):
     page-deck.js   → register("deck",  …)  第一张:滑动分页
     page-solar.js  → register("solar", …)  第二张:太阳系 HUD
     (后面第三/四/五张照这个模式加)
   模块要实现两个方法:
     api.key                这一页对应哪张盘(hugo.toml 里的 key)
     api.activate(true|false)  被选中 / 被换下
     api.repaint()          尺寸变了重排(可选)
   谁触发切换:intro.js 的 playPanel() → CDPages.activate(key)
   ============================================================ */
(function () {
  "use strict";

  var builds = {};   /* type -> build(el, key) -> api */
  var live = {};     /* 盘 key -> api */
  var errors = [];   /* 初始化出错时记下来(验收脚本会读)*/

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
      /* ★ 注册可能发生在核心首次扫描之后(脚本执行顺序、或某个页面模块后加载),
         所以注册完立刻补扫一次并把当前那张盘激活 —— 这样不依赖加载顺序 */
      buildAll();
      var k = activeKey();
      if (k) activate(k);
    },
    activate: activate,
    repaint: function () {
      for (var k in live) if (live[k] && live[k].repaint) live[k].repaint();
    },
    /* 调试 / 验收入口 */
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
