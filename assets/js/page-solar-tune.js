/* ============================================================
   行星大小 / 位置 微调面板(page-solar.js 的配套,只有 ?tune 时才创建)
   ─────────────────────────────────────────────────────────────
   用途:贴图版的构图靠眼睛调最准,所以给一个滑条面板:
     · 网址后面加 ?tune    → 面板出现(线上也能用:https://tuagfey.com/?tune)
     · 拖滑条 → 实时重排(写 window.__solarTune,page-solar.js 会读)
     · 「复制 TOML」→ 生成可以直接贴进 hugo.toml 的片段
   面板只在 ?tune 时存在,平时零开销、零样式影响。
   ============================================================ */
(function () {
  "use strict";

  if (location.search.indexOf("tune") < 0) return;

  var FIELDS = [
    { f: "x", label: "x", min: 0, max: 1, step: 0.002 },
    { f: "y", label: "y", min: 0, max: 1, step: 0.002 },
    { f: "w", label: "宽", min: 0.02, max: 0.6, step: 0.002 },
    { f: "rot", label: "旋转", min: -180, max: 180, step: 1 }
  ];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function mount() {
    var solar = document.querySelector("[data-solar]");
    var api = window.CDPages && window.CDPages.get ? window.CDPages.get("growth") : null;
    if (!solar || !api) { setTimeout(mount, 400); return; }

    var TUNE = window.__solarTune || (window.__solarTune = {});
    var panel = el("div", "solar-tune");
    var head = el("div", "solar-tune__head",
      "<b>行星微调</b><span>拖完点「复制 TOML」贴回 hugo.toml</span>");
    var copyBtn = el("button", "solar-tune__btn", "复制 TOML");
    var resetBtn = el("button", "solar-tune__btn", "复位");
    head.appendChild(copyBtn);
    head.appendChild(resetBtn);
    panel.appendChild(head);

    var out = el("textarea", "solar-tune__out");
    out.readOnly = true;
    out.rows = 6;

    var rows = [];

    /* 恒星 */
    var sunNode = api.sunNode;
    if (sunNode) {
      var sr = el("div", "solar-tune__row");
      sr.appendChild(el("b", null, "★ 恒星(蓝巨星)"));
      var sunInputs = {};
      [["x", 0, 1, 0.002], ["y", 0, 1, 0.002], ["w", 0.05, 0.6, 0.002]].forEach(function (d) {
        var box = el("label");
        box.appendChild(el("i", null, d[0]));
        var inp = document.createElement("input");
        inp.type = "range"; inp.min = d[1]; inp.max = d[2]; inp.step = d[3];
        inp.value = String(attr(sunNode, "data-" + d[0], d[0] === "w" ? 0.26 : 0.3));
        inp.addEventListener("input", function () {
          TUNE.__sun = TUNE.__sun || {};
          TUNE.__sun[d[0]] = parseFloat(inp.value);
          api.repaint();
          render();
        });
        box.appendChild(inp);
        box.appendChild(el("u", "val", inp.value));
        sr.appendChild(box);
        sunInputs[d[0]] = inp;
      });
      panel.appendChild(sr);
    }

    api.nodes.forEach(function (node, i) {
      var code = node.getAttribute("data-code") || ("SS-0" + (i + 1));
      var title = node.querySelector(".solar-title") ? node.querySelector(".solar-title").textContent.trim() : "";
      var row = el("div", "solar-tune__row");
      row.appendChild(el("b", null, code + " " + title));
      FIELDS.forEach(function (d) {
        var box = el("label");
        box.appendChild(el("i", null, d.label));
        var inp = document.createElement("input");
        inp.type = "range"; inp.min = d.min; inp.max = d.max; inp.step = d.step;
        inp.value = String(attr(node, "data-" + d.f, d.f === "w" ? 0.12 : (d.f === "rot" ? 0 : 0.5)));
        inp.addEventListener("input", function () {
          TUNE[code] = TUNE[code] || {};
          TUNE[code][d.f] = parseFloat(inp.value);
          api.repaint();
          render();
        });
        box.appendChild(inp);
        box.appendChild(el("u", "val", inp.value));
        row.appendChild(box);
      });
      panel.appendChild(row);
      rows.push({ code: code, node: node });
    });

    panel.appendChild(out);
    document.body.appendChild(panel);

    function attr(node, name, dflt) {
      var v = parseFloat(node.getAttribute(name));
      return isFinite(v) ? v : dflt;
    }

    function render() {
      var lines = ["    [params.intro.solar]"];
      var s = TUNE.__sun || {};
      if (sunNode) {
        lines.push('      sun_x = ' + num(s.x, attr(sunNode, "data-x", 0.19)));
        lines.push('      sun_y = ' + num(s.y, attr(sunNode, "data-y", 0.34)));
        lines.push('      sun_w = ' + num(s.w, attr(sunNode, "data-w", 0.26)));
      }
      lines.push("");
      rows.forEach(function (r) {
        var t = TUNE[r.code] || {};
        lines.push("    [[params.intro.decks.growth]]   # " + (r.node.querySelector(".solar-title") || {}).textContent);
        lines.push('      code = "' + r.code + '"');
        lines.push("      x = " + num(t.x, attr(r.node, "data-x", 0.5)));
        lines.push("      y = " + num(t.y, attr(r.node, "data-y", 0.5)));
        lines.push("      w = " + num(t.w, attr(r.node, "data-w", 0.12)));
        if (t.rot || attr(r.node, "data-rot", 0)) lines.push("      rot = " + num(t.rot, attr(r.node, "data-rot", 0)));
        lines.push("");
      });
      out.value = lines.join("\n");
    }
    function num(v, dflt) { return (isFinite(v) ? v : dflt).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); }

    copyBtn.addEventListener("click", function () {
      out.select();
      try {
        navigator.clipboard.writeText(out.value);
        copyBtn.textContent = "已复制 ✓";
      } catch (e) {
        document.execCommand("copy");
        copyBtn.textContent = "已复制 ✓";
      }
      setTimeout(function () { copyBtn.textContent = "复制 TOML"; }, 1500);
    });
    resetBtn.addEventListener("click", function () {
      for (var k in TUNE) delete TUNE[k];
      panel.remove();
      mount();
      api.repaint();
    });

    render();
    api.repaint();
    console.log("[solar-tune] 已开启微调面板;window.__solarTune 里是当前值");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
