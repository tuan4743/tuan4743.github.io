/* 顶栏即时搜索:加载 /index.json,输入即搜,下拉展示结果 */
(function () {
  "use strict";
  var input = document.getElementById("header-search-input");
  if (!input) return;
  var panel = document.getElementById("header-search-results");
  var listEl = panel.querySelector(".search-results-list");

  var index = null;
  var indexLoaded = false;
  var MAX_RESULTS = 8;

  function loadIndex() {
    if (indexLoaded) return Promise.resolve();
    return fetch("/index.json")
      .then(function (r) {
        if (!r.ok) throw new Error("index load failed");
        return r.json();
      })
      .then(function (d) {
        index = d;
        indexLoaded = true;
      })
      .catch(function () {
        indexLoaded = true; // 下次不再重试,静默降级
        index = null;
      });
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function highlight(text, terms) {
    var re;
    try {
      re = new RegExp(
        "(" +
          terms
            .map(function (t) {
              return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            })
            .join("|") +
          ")",
        "gi"
      );
    } catch (e) {
      return esc(text);
    }
    return esc(text).replace(re, "<mark>$1</mark>");
  }

  function render(query) {
    var ql = query.trim().toLowerCase();
    if (!index || !ql) {
      listEl.innerHTML = "";
      return;
    }
    var terms = ql.split(/\s+/).slice(0, 5);
    var results = [];
    for (var i = 0; i < index.length && results.length < MAX_RESULTS; i++) {
      var p = index[i];
      if (
        (p.title || "").toLowerCase().indexOf(ql) !== -1 ||
        (p.content || "").toLowerCase().indexOf(ql) !== -1
      ) {
        results.push(p);
      }
    }
    if (!results.length) {
      listEl.innerHTML =
        '<span class="search-results-empty">没有找到相关内容</span>';
      return;
    }
    listEl.innerHTML = results
      .map(function (p) {
        var c = p.content || "";
        var at = c.toLowerCase().indexOf(ql);
        var snippet;
        if (at >= 0) {
          var start = Math.max(0, at - 40);
          snippet =
            (start > 0 ? "…" : "") +
            c.slice(start, Math.min(c.length, at + ql.length + 70)) +
            (at + ql.length + 70 < c.length ? "…" : "");
        } else {
          snippet = c.slice(0, 120) + (c.length > 120 ? "…" : "");
        }
        return (
          '<a class="search-result-item" href="' +
          esc(p.url) +
          '"><div class="sr-title">' +
          highlight(p.title, terms) +
          '</div><div class="sr-snippet">' +
          highlight(snippet, terms) +
          "</div></a>"
        );
      })
      .join("");
  }

  function openPanel() {
    panel.hidden = false;
  }

  function closePanel() {
    panel.hidden = true;
  }

  input.addEventListener("focus", function () {
    if (input.value.trim()) openPanel();
  });

  input.addEventListener("input", function () {
    var q = input.value;
    loadIndex().then(function () {
      if (!q.trim()) {
        closePanel();
        return;
      }
      render(q);
      openPanel();
    });
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var first = listEl.querySelector("a");
      if (first) {
        e.preventDefault();
        window.location.href = first.getAttribute("href");
      }
    } else if (e.key === "Escape") {
      closePanel();
      input.blur();
    } else if (e.key === "ArrowDown") {
      var first = listEl.querySelector("a");
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.addEventListener("click", function (e) {
    if (!panel.contains(e.target) && !input.contains(e.target)) closePanel();
  });

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
})();
