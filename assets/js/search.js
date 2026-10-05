(function () {
  "use strict";

  var index = null;
  var indexLoading = null;
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
      .catch(function () { index = []; return index; });
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

  function build(root) {
    var input = root.querySelector("[data-search-input]") || root.querySelector("input");
    if (!input) return null;
    var panel = root.querySelector("[data-search-results]");
    if (!panel) return null;
    var listEl = panel.querySelector(".search-results-list") || panel;

    function open() { panel.hidden = false; root.classList.add("is-searching"); }
    function close() { panel.hidden = true; root.classList.remove("is-searching"); }

    input.addEventListener("focus", function () { if (input.value.trim()) open(); });

    function run() {
      var q = input.value;
      loadIndex().then(function () {
        if (!q.trim()) { close(); return; }
        render(listEl, q);
        open();
      });
    }

    input.addEventListener("input", run);
    input.addEventListener("search", run);

    function clear() {
      input.value = "";
      listEl.innerHTML = "";
      close();
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = listEl.querySelector("a");
        if (first) { e.preventDefault(); window.location.href = first.getAttribute("href"); }
      } else if (e.key === "Escape") {
        close(); input.blur();
      } else if (e.key === "ArrowDown") {
        var f2 = listEl.querySelector("a");
        if (f2) { e.preventDefault(); f2.focus(); }
      }
    });

    var inst = { root: root, input: input, panel: panel, close: close, clear: clear };
    instances.push(inst);
    root.__search = inst;
    return inst;
  }

  function boot() {
    var roots = document.querySelectorAll("[data-search]");
    for (var i = 0; i < roots.length; i++) build(roots[i]);

    document.addEventListener("click", function (e) {
      for (var k = 0; k < instances.length; k++) {
        var it = instances[k];
        if (!it.panel.contains(e.target) && !it.input.contains(e.target)) it.close();
      }
    });

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
        if (it.input.offsetParent !== null) {
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
