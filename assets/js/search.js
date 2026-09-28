/* 即时搜索:【可复用组件】
   ─────────────────────────────────────────────────────────────
   原来它只服务顶栏那一处:直接 getElementById("header-search-input"),
   所以「平板主界面」里的搜索卡片没法用同一套逻辑 ——
   要加第二处,就得复制一份(两份迟早会漂)。

   现在改成:凡是带 data-search 的容器,都挂一个独立实例。
     <div class="search-widget" data-search>
       <input data-search-input ...>
       <div data-search-results hidden><div class="search-results-list"></div></div>
     </div>
   一个实例 = 一份输入框 + 一个结果面板;索引(/index.json)全局只加载一次。
   ★ 顶栏那处的 id 保留着(页面里可能有别的东西按 id 引用它),
     但组件本身【不再依赖 id】—— 依赖关系从"页面上唯一"改成"容器内查找",
     这是它能被复用第二处的关键。
   ============================================================ */
(function () {
  "use strict";

  var index = null;
  var indexLoading = null;        /* 索引只加载一次,多处共用 */
  var MAX_RESULTS = 8;
  var instances = [];

  function loadIndex() {
    if (index !== null) return Promise.resolve(index);
    if (indexLoading) return indexLoading;
    indexLoading = fetch("/index.json")
      .then(function (r) {
        if (!r.ok) throw new Error("index load failed");
        return r.json();
      })
      .then(function (d) { index = d; return d; })
      .catch(function () { index = []; return index; });   /* 静默降级,不重试 */
    return indexLoading;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function highlight(text, terms) {
    var re;
    try {
      re = new RegExp("(" + terms.map(function (t) {
        return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("|") + ")", "gi");
    } catch (e) { return esc(text); }
    return esc(text).replace(re, "<mark>$1</mark>");
  }

  function render(listEl, query) {
    var ql = query.trim().toLowerCase();
    if (!index || !ql) { listEl.innerHTML = ""; return; }
    var terms = ql.split(/\s+/).slice(0, 5);
    var results = [];
    for (var i = 0; i < index.length && results.length < MAX_RESULTS; i++) {
      var p = index[i];
      if ((p.title || "").toLowerCase().indexOf(ql) !== -1 ||
          (p.content || "").toLowerCase().indexOf(ql) !== -1) results.push(p);
    }
    if (!results.length) {
      listEl.innerHTML = '<span class="search-results-empty">没有找到相关内容</span>';
      return;
    }
    listEl.innerHTML = results.map(function (p) {
      var c = p.content || "";
      var at = c.toLowerCase().indexOf(ql);
      var snippet;
      if (at >= 0) {
        var start = Math.max(0, at - 40);
        snippet = (start > 0 ? "…" : "") +
          c.slice(start, Math.min(c.length, at + ql.length + 70)) +
          (at + ql.length + 70 < c.length ? "…" : "");
      } else {
        snippet = c.slice(0, 120) + (c.length > 120 ? "…" : "");
      }
      return '<a class="search-result-item" href="' + esc(p.url) + '">' +
        '<div class="sr-title">' + highlight(p.title, terms) + '</div>' +
        '<div class="sr-snippet">' + highlight(snippet, terms) + '</div></a>';
    }).join("");
  }

  /* 建一个实例;root 里找不到输入框就返回 null(不报错) */
  function build(root) {
    var input = root.querySelector("[data-search-input]") || root.querySelector("input");
    if (!input) return null;
    var panel = root.querySelector("[data-search-results]");
    if (!panel) return null;
    var listEl = panel.querySelector(".search-results-list") || panel;

    function open() { panel.hidden = false; root.classList.add("is-searching"); }
    function close() { panel.hidden = true; root.classList.remove("is-searching"); }

    input.addEventListener("focus", function () { if (input.value.trim()) open(); });

    input.addEventListener("input", function () {
      var q = input.value;
      loadIndex().then(function () {
        if (!q.trim()) { close(); return; }
        render(listEl, q);
        open();
      });
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = listEl.querySelector("a");
        if (first) { e.preventDefault(); window.location.href = first.getAttribute("href"); }
      } else if (e.key === "Escape") {
        close(); input.blur();
        /* ★ 平板主界面里,搜索卡片的 Escape 还要能把整个主界面收起来 ——
           那是页面级的事,由 tablet 自己监听 keydown,这里不去管它。 */
      } else if (e.key === "ArrowDown") {
        var f2 = listEl.querySelector("a");
        if (f2) { e.preventDefault(); f2.focus(); }
      }
    });

    var inst = { root: root, input: input, panel: panel, close: close };
    instances.push(inst);
    return inst;
  }

  function boot() {
    var roots = document.querySelectorAll("[data-search]");
    for (var i = 0; i < roots.length; i++) build(roots[i]);

    /* 点空白处收起(所有实例一起收) */
    document.addEventListener("click", function (e) {
      for (var k = 0; k < instances.length; k++) {
        var it = instances[k];
        if (!it.panel.contains(e.target) && !it.input.contains(e.target)) it.close();
      }
    });

    /* Ctrl/⌘+K 聚焦到【当前可见】的那个搜索框
       ★ 这里踩过一次:offsetParent 不为 null 【不等于】用户看得见 ——
         平板主界面开着时,顶栏那一处还在 DOM 里、也没 display:none,
         于是焦点被塞进一个【被平板整个盖住】的输入框:用户对着空气打字。
         所以平板开着的时候,只认平板里那一处(用 data-tablet-home 认,不认类名)。 */
    document.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== "k") return;
      var order = instances;
      if (document.body.classList.contains("tablet-open")) {
        for (var j = 0; j < instances.length; j++) {
          var r = instances[j].root;
          if (r.closest && r.closest("[data-tablet-home]")) { order = [instances[j]]; break; }
        }
      }
      for (var k = 0; k < order.length; k++) {
        var it = order[k];
        if (it.input.offsetParent !== null) {      /* 可见的那个 */
          e.preventDefault();
          it.input.focus();
          it.input.select();
          return;
        }
      }
    });

    window.__search = { instances: instances, loadIndex: loadIndex };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.CDSearch = { build: build, loadIndex: loadIndex };
})();
