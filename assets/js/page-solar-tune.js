/* ============================================================
   行星微调面板(page-solar.js 的配套):位置 x/y、大小 w、旋转 rot
   ─────────────────────────────────────────────────────────────
   两种打开方式:
     · 网址加 ?tune            → 自动打开(线上也能用:https://tuagfey.com/?tune)
     · 按 Alt + T              → 随时开关(平时不加载任何 DOM,零影响)
   每一行 = 一个星体,四根滑条 + 一个可输入的数字框:
     · 滑条步长 0.001(1440px 宽的面板上约 1.4px),方向键还能再微调
     · 数字框可以直接敲精确值,敲完立刻生效
   点「复制 TOML」→ 生成能直接贴回 hugo.toml 的片段(含恒星那三行)
   值写在 window.__solarTune,page-solar.js 每次重排都会读它。
   ============================================================ */
(function () {
  "use strict";

  var WANT = location.search.indexOf("tune") >= 0;
  var FIELDS = [
    { f: "x", label: "x", min: 0, max: 1, step: 0.001, dflt: 0.5 },
    { f: "y", label: "y", min: 0, max: 1, step: 0.001, dflt: 0.5 },
    { f: "w", label: "宽", min: 0.02, max: 0.7, step: 0.001, dflt: 0.12 },
    { f: "rot", label: "旋转", min: -180, max: 180, step: 0.5, dflt: 0 }
  ];
  var SUN_FIELDS = [
    { f: "x", label: "x", min: 0, max: 1, step: 0.001, dflt: 0.19 },
    { f: "y", label: "y", min: 0, max: 1, step: 0.001, dflt: 0.34 },
    { f: "w", label: "宽", min: 0.05, max: 0.7, step: 0.001, dflt: 0.26 }
  ];

  var panel = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function attrNum(node, name, dflt) {
    if (!node) return dflt;
    var v = parseFloat(node.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function fmt(v) { return (Math.round(v * 1000) / 1000).toString(); }
  function api() { return window.CDPages && window.CDPages.get ? window.CDPages.get("growth") : null; }

  function build() {
    var a = api();
    var solar = document.querySelector("[data-solar]");
    if (!a || !solar) return null;

    var TUNE = window.__solarTune || (window.__solarTune = {});
    var p = el("div", "solar-tune");
    var head = el("div", "solar-tune__head",
      "<b>行星微调</b><span>滑条 / 数字框都能改 · Alt+T 关闭</span>");
    var copyBtn = el("button", "solar-tune__btn", "复制 TOML");
    var resetBtn = el("button", "solar-tune__btn", "复位");
    head.appendChild(copyBtn);
    head.appendChild(resetBtn);
    p.appendChild(head);

    var out = el("textarea", "solar-tune__out");
    out.readOnly = true;
    out.rows = 7;
    var rows = [];

    function addRow(title, node, fields, key) {
      var row = el("div", "solar-tune__row");
      row.appendChild(el("b", null, title));
      fields.forEach(function (d) {
        var box = el("label");
        box.appendChild(el("i", null, d.label));
        var cur = (TUNE[key] && isFinite(TUNE[key][d.f])) ? TUNE[key][d.f] : attrNum(node, "data-" + d.f, d.dflt);
        var range = document.createElement("input");
        range.type = "range"; range.min = d.min; range.max = d.max; range.step = d.step;
        range.value = String(cur);
        var num = document.createElement("input");
        num.type = "number"; num.min = d.min; num.max = d.max; num.step = d.step;
        num.value = fmt(cur);
        function push(v) {
          v = Math.min(d.max, Math.max(d.min, v));
          TUNE[key] = TUNE[key] || {};
          TUNE[key][d.f] = v;
          range.value = String(v);
          num.value = fmt(v);
          api().repaint();
          render();
        }
        range.addEventListener("input", function () { push(parseFloat(range.value)); });
        num.addEventListener("input", function () { var v = parseFloat(num.value); if (isFinite(v)) push(v); });
        box.appendChild(range);
        box.appendChild(num);
        row.appendChild(box);
      });
      p.appendChild(row);
      rows.push({ title: title, node: node, key: key, fields: fields });
    }

    addRow("★ 蓝巨星", a.sunNode, SUN_FIELDS, "__sun");
    a.nodes.forEach(function (node, i) {
      var code = node.getAttribute("data-code") || ("SS-0" + (i + 1));
      var t = node.querySelector(".solar-title");
      addRow(code + " " + (t ? t.textContent.trim() : ""), node, FIELDS, code);
    });

    p.appendChild(out);
    document.body.appendChild(p);

    function val(r, f) {
      var v = window.__solarTune[r.key] && window.__solarTune[r.key][f.f];
      return isFinite(v) ? v : attrNum(r.node, "data-" + f.f, f.dflt);
    }
    function render() {
      var lines = ["    [params.intro.solar]"];
      lines.push('      bg = "/planet/bg.jpg"');
      lines.push('      bg_dim = 0.45');
      lines.push('      sun = "/planet/sun.webp"');
      var sun = rows[0];
      lines.push("      sun_x = " + fmt(val(sun, SUN_FIELDS[0])));
      lines.push("      sun_y = " + fmt(val(sun, SUN_FIELDS[1])));
      lines.push("      sun_w = " + fmt(val(sun, SUN_FIELDS[2])));
      lines.push("");
      rows.slice(1).forEach(function (r) {
        var code = r.key;
        lines.push("    [[params.intro.decks.growth]]   # " + r.title);
        lines.push('      code = "' + code + '"');
        lines.push('      tex = "' + (r.node.getAttribute("data-tex") || "") + '"');
        FIELDS.forEach(function (f) { lines.push("      " + f.f + " = " + fmt(val(r, f))); });
        var kind = (r.node.className.match(/solar-node--(\w+)/) || [])[1];
        if (kind) lines.push('      kind = "' + kind + '"');
        lines.push("");
      });
      out.value = lines.join("\n");
    }

    copyBtn.addEventListener("click", function () {
      out.select();
      var done = function () { copyBtn.textContent = "已复制 ✓"; setTimeout(function () { copyBtn.textContent = "复制 TOML"; }, 1500); };
      try {
        navigator.clipboard.writeText(out.value).then(done, function () { document.execCommand("copy"); done(); });
      } catch (e) { document.execCommand("copy"); done(); }
    });
    resetBtn.addEventListener("click", function () {
      for (var k in window.__solarTune) delete window.__solarTune[k];
      close();
      open();
    });

    render();
    api().repaint();
    return p;
  }

  function open() {
    if (panel) return;
    panel = build();
    if (!panel) { panel = null; setTimeout(function () { if (WANT) open(); }, 400); }
    else console.log("[solar-tune] 微调面板已打开(Alt+T 可关闭);当前值在 window.__solarTune");
  }
  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
  }
  function toggle() { panel ? close() : open(); }

  document.addEventListener("keydown", function (e) {
    if (e.altKey && (e.key === "t" || e.key === "T")) { e.preventDefault(); toggle(); }
    else if (e.key === "Escape" && panel) close();
  });

  if (WANT) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { open(); });
    else open();
  }
  window.__solarTunePanel = { open: open, close: close, toggle: toggle };
})();
