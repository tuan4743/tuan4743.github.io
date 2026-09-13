/* ============================================================
   第三张盘「迷茫」的铺面编辑器(?chart 或 Alt+E)
   ─────────────────────────────────────────────────────────────
   它读写的就是游戏那份 static/assets/cd/lost-chart.json:
     · 上面:时间轴 —— 波形 + 节拍网格(默认吸附 onset)+ 四段色带 + 物件 + 播放头
     · 下面:工具栏 —— 类型 / 轨道行 / 吸附方式 / 播放 / 试玩 / 自动铺一版 /
             重新采音(调百分位·最小间隔·RMS↔onset)/ 导出 / 导入
   操作:
     左键空白处 = 按当前类型在【吸附到的拍】+【当前轨道行】放一个
     左键物件   = 选中并拖动(横向按拍吸附,纵向换轨道行)
     右键物件   = 删掉;Delete 删选中的
     滚轮 = 横向滚动,Shift+滚轮 = 缩放,点波形区 = 把播放头挪过去
     1..6 换类型,↑/↓ 换轨道行,空格 播放/暂停,Esc 关闭
   改完点「套用」把铺面立刻装进游戏试玩;点「导出」把 JSON 复制/下载回仓库
   ============================================================ */
(function () {
  "use strict";

  var TYPES = [
    { k: "block", n: "方块", c: "#8fd8ff" },
    { k: "spike", n: "尖刺", c: "#ff7a6b" },
    { k: "orb", n: "跳点", c: "#ffe17a" },
    { k: "gravity", n: "重力", c: "#c6a0ff" },
    { k: "shield", n: "护盾", c: "#7ff0c0" },
    { k: "echo", n: "回响", c: "#a0f0ff" }
  ];
  var ROW_H = 22, WAVE_H = 76, RULER_H = 18;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function mount(root) {
    var api = (window.CDPages && window.CDPages.get && window.CDPages.get("lost")) || null;
    if (!api || !api.data) return null;
    var D = api.data();
    if (!D.chart) return null;

    var E = {
      open: false, chart: JSON.parse(JSON.stringify(D.chart)), beats: D.beats.slice(),
      period: D.period, offset: D.offset, dur: D.dur, env: D.env || [], envStep: D.envStep || 0,
      type: "block", orb: "yellow", row: 0, snap: "onset", zoom: 150, scroll: 0,
      sel: null, drag: null, playing: false, t: 0, dirty: false, status: "", beatsInfo: null
    };
    /* 编辑用的物件表(带 id,方便选中/拖动)*/
    var items = [], nextId = 1;
    function loadItems(list) {
      items = (list || []).map(function (it) {
        return { id: nextId++, t: it.t, row: it.row | 0, type: it.type, w: it.w || 1, orb: it.orb || "yellow" };
      });
    }
    loadItems(E.chart.items && E.chart.items.length ? E.chart.items : api.dev.draft());
    E.status = (E.chart.items && E.chart.items.length) ? "已载入铺面 " + items.length + " 个物件" : "铺面是空的 → 已用节拍自动铺了一版草稿";

    /* ---------------- DOM ---------------- */
    var wrap = el("div", "lost-ed");
    var bar = el("div", "lost-ed__bar");
    var title = el("b", "lost-ed__title", "铺面编辑器");
    var status = el("span", "lost-ed__status", "");
    bar.appendChild(title);

    function btn(txt, fn, cls) { var b = el("button", "lost-ed__btn" + (cls ? " " + cls : ""), txt); b.type = "button"; b.addEventListener("click", fn); bar.appendChild(b); return b; }
    var typeSel = el("select", "lost-ed__sel");
    TYPES.forEach(function (T) { var o = el("option", null, T.n); o.value = T.k; typeSel.appendChild(o); });
    typeSel.addEventListener("change", function () { E.type = typeSel.value; syncBar(); });
    bar.appendChild(typeSel);
    var orbSel = el("select", "lost-ed__sel");
    ["yellow", "pink"].forEach(function (o) { var t2 = el("option", null, o === "yellow" ? "黄(高)" : "粉(低)"); t2.value = o; orbSel.appendChild(t2); });
    orbSel.addEventListener("change", function () { E.orb = orbSel.value; });
    bar.appendChild(orbSel);
    var rowIn = el("input", "lost-ed__num"); rowIn.type = "number"; rowIn.min = "0"; rowIn.max = "9"; rowIn.value = "0";
    rowIn.addEventListener("change", function () { E.row = clamp(parseInt(rowIn.value, 10) || 0, 0, 9); syncBar(); });
    bar.appendChild(el("i", "lost-ed__tag", "行"));
    bar.appendChild(rowIn);
    var snapSel = el("select", "lost-ed__sel");
    [["onset", "吸附 onset"], ["grid", "吸附 8 分格"], ["off", "不吸附"]].forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; snapSel.appendChild(o); });
    snapSel.addEventListener("change", function () { E.snap = snapSel.value; });
    bar.appendChild(snapSel);
    var playBtn = btn("▶ 播放", function () { togglePlay(); });
    btn("试玩", function () { applyAll(); api.preview(E.t); E.playing = true; playBtn.textContent = "⏸ 暂停"; });
    btn("自动铺一版", function () {
      if (!window.confirm("用节拍重新自动铺一版?当前铺面会被替换(可以先导出)")) return;
      loadItems(api.dev.draft()); E.dirty = true; E.status = "已重新生成草稿 " + items.length + " 个物件"; syncBar(); draw();
    });
    btn("采音参数", function () { tone.toggle = !tone.toggle; tone.el.style.display = tone.toggle ? "flex" : "none"; resize(); });
    btn("套用", function () { applyAll(); });
    btn("导出", function () { exportJson(); });
    btn("导入", function () { importJson(); });
    btn("关闭", function () { close(); });
    bar.appendChild(status);
    wrap.appendChild(bar);

    /* 采音参数面板 */
    var tone = el("div", "lost-ed__tone");
    tone.el = tone;
    tone.style.display = "none";
    var mSel = el("select", "lost-ed__sel");
    [["onset", "onset(打击感强)"], ["rms", "RMS(能量)"]].forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; mSel.appendChild(o); });
    tone.appendChild(el("i", "lost-ed__tag", "包络"));
    tone.appendChild(mSel);
    var pRange = el("input"); pRange.type = "range"; pRange.min = "50"; pRange.max = "95"; pRange.step = "1"; pRange.value = "75";
    var pNum = el("input", "lost-ed__num"); pNum.type = "number"; pNum.value = "75"; pNum.min = "50"; pNum.max = "95";
    tone.appendChild(el("i", "lost-ed__tag", "百分位"));
    tone.appendChild(pRange); tone.appendChild(pNum);
    var sRange = el("input"); sRange.type = "range"; sRange.min = "40"; sRange.max = "220"; sRange.step = "5"; sRange.value = "90";
    var sNum = el("input", "lost-ed__num"); sNum.type = "number"; sNum.value = "90"; sNum.min = "40"; sNum.max = "220";
    tone.appendChild(el("i", "lost-ed__tag", "最小间隔ms"));
    tone.appendChild(sRange); tone.appendChild(sNum);
    var toneOut = el("span", "lost-ed__status", "");
    tone.appendChild(toneOut);
    var recBtn = el("button", "lost-ed__btn", "重新采音");
    recBtn.type = "button";
    recBtn.addEventListener("click", function () { recount(+pNum.value, +sNum.value / 1000, mSel.value, toneOut); });
    tone.appendChild(recBtn);
    pRange.addEventListener("input", function () { pNum.value = pRange.value; });
    sRange.addEventListener("input", function () { sNum.value = sRange.value; });
    wrap.appendChild(tone);

    var cv = el("canvas", "lost-ed__cv");
    wrap.appendChild(cv);
    var ctx = cv.getContext("2d");
    var jsonBox = el("textarea", "lost-ed__json");
    jsonBox.style.display = "none";
    wrap.appendChild(jsonBox);
    var hint = el("div", "lost-ed__hint", "左键放/选中拖动 · 右键删 · 滚轮滚动 · Shift+滚轮缩放 · 1..6 类型 · ↑↓ 行 · 空格播放 · Esc 关");
    wrap.appendChild(hint);
    root.appendChild(wrap);

    function syncBar() { rowIn.value = String(E.row); typeSel.value = E.type; status.textContent = E.status; }
    syncBar();

    /* ---------------- 坐标换算 ---------------- */
    var V = { w: 0, h: 0, dpr: 1 };
    function gridTop() { return RULER_H; }
    function gridH() { return V.h - WAVE_H - RULER_H; }
    function rowH() { return gridH() / 10; }
    function t2x(t) { return (t - E.scroll) * E.zoom; }
    function x2t(x) { return x / E.zoom + E.scroll; }
    function row2y(r) { return gridTop() + (9 - r + 0.5) * rowH(); }
    function y2row(y) { return clamp(9 - Math.floor((y - gridTop()) / rowH()), 0, 9); }
    function snapT(t) {
      if (E.snap === "off") return +t.toFixed(3);
      var best = t, bd = 1e9, i;
      if (E.snap === "grid") {
        var k = Math.round((t - E.offset) / (E.period / 2));
        return +(E.offset + k * (E.period / 2)).toFixed(3);
      }
      for (i = 0; i < E.beats.length; i++) { var d = Math.abs(E.beats[i] - t); if (d < bd) { bd = d; best = E.beats[i]; } }
      return +best.toFixed(4);
    }
    function resize() {
      var r = wrap.getBoundingClientRect();
      V.w = Math.max(2, Math.round(r.width));
      V.h = Math.max(120, Math.round(r.height - bar.offsetHeight - tone.offsetHeight - hint.offsetHeight - 6));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      V.dpr = dpr;
      cv.width = Math.round(V.w * dpr); cv.height = Math.round(V.h * dpr);
      cv.style.width = V.w + "px"; cv.style.height = V.h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    window.addEventListener("resize", function () { if (E.open) resize(); });

    /* ---------------- 画 ---------------- */
    function draw() {
      if (!E.open) return;
      ctx.clearRect(0, 0, V.w, V.h);
      ctx.fillStyle = "rgba(4,7,14,0.96)";
      ctx.fillRect(0, 0, V.w, V.h);
      /* 四段色带 */
      var segs = E.chart.segments || [];
      for (var s = 0; s < segs.length; s++) {
        var t0 = segs[s].t, t1 = s + 1 < segs.length ? segs[s + 1].t : E.dur;
        var x0 = t2x(t0), x1 = t2x(t1);
        if (x1 < 0 || x0 > V.w) continue;
        ctx.fillStyle = ["rgba(127,240,255,0.055)", "rgba(255,225,122,0.055)", "rgba(127,240,192,0.055)", "rgba(198,160,255,0.055)"][s % 4];
        ctx.fillRect(x0, 0, Math.max(1, x1 - x0), V.h);
        ctx.strokeStyle = "rgba(127,240,255,0.35)";
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, V.h); ctx.stroke();
        ctx.fillStyle = "rgba(226,246,255,0.75)";
        ctx.font = "600 11px ui-monospace, Consolas, monospace";
        ctx.fillText("ST-0" + (s + 1) + " " + (segs[s].mode || "") + "/" + (segs[s].ability || ""), x0 + 6, rulerY());
      }
      /* 8 分格 + onset 节拍线 */
      var step = Math.max(1, Math.round((E.period / 2) / (1 / (E.zoom / 1000)) / 1000 * 1000));
      ctx.strokeStyle = "rgba(127,240,255,0.08)";
      var tA = E.scroll, tB = x2t(V.w);
      for (var tt = Math.floor((tA - E.offset) / (E.period / 2)) * (E.period / 2) + E.offset; tt < tB; tt += E.period / 2) {
        var x = t2x(tt);
        if (x < 0 || x > V.w) continue;
        ctx.beginPath(); ctx.moveTo(x, gridTop()); ctx.lineTo(x, gridTop() + gridH()); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(127,240,255,0.22)";
      for (var b = 0; b < E.beats.length; b++) {
        var bt = E.beats[b];
        if (bt < tA - 0.2 || bt > tB + 0.2) continue;
        var bx = t2x(bt);
        ctx.beginPath(); ctx.moveTo(bx, gridTop()); ctx.lineTo(bx, gridTop() + gridH()); ctx.stroke();
      }
      /* 轨道行分隔 */
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (var r2 = 0; r2 <= 10; r2++) {
        var y = gridTop() + r2 * rowH();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(V.w, y); ctx.stroke();
      }
      /* 地面/天花板 */
      ctx.strokeStyle = "rgba(127,240,255,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, gridTop() + gridH()); ctx.lineTo(V.w, gridTop() + gridH()); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, gridTop()); ctx.lineTo(V.w, gridTop()); ctx.stroke();
      ctx.lineWidth = 1;
      /* 波形 */
      var wy = V.h - WAVE_H, wh = WAVE_H - 6;
      ctx.fillStyle = "rgba(8,12,22,0.9)";
      ctx.fillRect(0, wy, V.w, WAVE_H);
      if (E.env.length) {
        ctx.strokeStyle = "rgba(127,240,255,0.5)";
        ctx.beginPath();
        var stepT = (E.envStep || 8 * 256) / 44100;
        for (var e = 0; e < E.env.length; e++) {
          var et = e * stepT, ex = t2x(et);
          if (ex < -2 || ex > V.w + 2) continue;
          var v = Math.min(1, E.env[e] * 2.2);
          ctx.moveTo(ex, wy + wh / 2 - v * wh / 2);
          ctx.lineTo(ex, wy + wh / 2 + v * wh / 2);
        }
        ctx.stroke();
        ctx.strokeStyle = "rgba(127,240,255,0.18)";
        ctx.beginPath(); ctx.moveTo(0, wy + wh / 2); ctx.lineTo(V.w, wy + wh / 2); ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(226,246,255,0.35)";
        ctx.font = "12px ui-monospace, Consolas, monospace";
        ctx.fillText("(没有波形数据:点「采音参数 → 重新采音」)", 10, wy + 22);
      }
      /* 物件 */
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var ix = t2x(it.t), iy = row2y(it.row), isel = E.sel === it.id;
        var iw = Math.max(3, (it.w || 1) * (E.zoom * 0.34));
        var T = TYPES.filter(function (q) { return q.k === it.type; })[0] || TYPES[0];
        ctx.fillStyle = T.c;
        ctx.globalAlpha = it.type === "block" || it.type === "spike" ? 0.85 : 0.6;
        ctx.fillRect(ix - iw / 2, iy - rowH() * 0.36, iw, rowH() * 0.72);
        ctx.globalAlpha = 1;
        if (isel) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.strokeRect(ix - iw / 2 - 1, iy - rowH() * 0.36 - 1, iw + 2, rowH() * 0.72 + 2); ctx.lineWidth = 1; }
      }
      /* 播放头 */
      var px = t2x(E.t);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, V.h); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(226,246,255,0.85)";
      ctx.font = "600 11px ui-monospace, Consolas, monospace";
      ctx.fillText(E.t.toFixed(3) + "s", px + 4, V.h - 8);
    }
    function rulerY() { return 12; }

    /* ---------------- 交互 ---------------- */
    function hit(x, y) {
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        var ix = t2x(it.t), iy = row2y(it.row);
        var iw = Math.max(6, (it.w || 1) * (E.zoom * 0.34));
        if (Math.abs(x - ix) <= iw / 2 + 3 && Math.abs(y - iy) <= rowH() * 0.5 + 2) return it;
      }
      return null;
    }
    function pos(ev) {
      var r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    cv.addEventListener("contextmenu", function (ev) { ev.preventDefault(); });
    cv.addEventListener("pointerdown", function (ev) {
      var p = pos(ev), hitIt = hit(p.x, p.y);
      if (ev.button === 2) {                     /* 右键:删 */
        if (hitIt) { items.splice(items.indexOf(hitIt), 1); E.dirty = true; E.status = "删掉 1 个(共 " + items.length + ")"; syncBar(); draw(); }
        return;
      }
      if (p.y > V.h - WAVE_H) { E.t = clamp(x2t(p.x), 0, E.dur); draw(); return; }   /* 点波形 = 挪播放头 */
      if (hitIt) {
        E.sel = hitIt.id; E.drag = { it: hitIt, dx: p.x - t2x(hitIt.t) };
        try { cv.setPointerCapture(ev.pointerId); } catch (err) {}   /* 合成的 PointerEvent 没有真指针,捕获会抛错 */
      } else {
        /* 空白处:按当前类型放一个 */
        var nt = { id: nextId++, t: snapT(x2t(p.x)), row: y2row(p.y), type: E.type, w: 1, orb: E.orb };
        items.push(nt); E.sel = nt.id; E.row = nt.row; E.dirty = true;
        E.status = "放了 " + nt.type + " @ " + nt.t + "s / 行 " + nt.row + "(共 " + items.length + ")";
        syncBar();
      }
      draw();
    });
    cv.addEventListener("pointermove", function (ev) {
      if (!E.drag) return;
      var p = pos(ev);
      E.drag.it.t = snapT(x2t(p.x - E.drag.dx));
      E.drag.it.row = y2row(p.y);
      E.dirty = true;
      E.status = "拖到 " + E.drag.it.t + "s / 行 " + E.drag.it.row;
      syncBar(); draw();
    });
    cv.addEventListener("pointerup", function () { E.drag = null; });
    cv.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      if (ev.shiftKey) {
        var p = pos(ev), tAt = x2t(p.x);
        E.zoom = clamp(E.zoom * (ev.deltaY < 0 ? 1.18 : 0.85), 12, 1600);
        E.scroll = tAt - p.x / E.zoom;
      } else {
        E.scroll = clamp(E.scroll + ev.deltaY / E.zoom * 0.5, 0, Math.max(0, E.dur - 1));
      }
      draw();
    }, { passive: false });

    /* ---------------- 键盘 ---------------- */
    function onKey(e) {
      if (!E.open) return;
      if (e.target && /input|textarea|select/i.test(e.target.tagName || "")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        var k = items.map(function (q) { return q.id; }).indexOf(E.sel);
        if (k >= 0) { items.splice(k, 1); E.sel = null; E.dirty = true; E.status = "删掉 1 个(共 " + items.length + ")"; syncBar(); draw(); }
        return;
      }
      if (e.key === "ArrowUp") { e.preventDefault(); E.row = clamp(E.row + 1, 0, 9); rowIn.value = String(E.row); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); E.row = clamp(E.row - 1, 0, 9); rowIn.value = String(E.row); return; }
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= TYPES.length) { E.type = TYPES[n - 1].k; syncBar(); return; }
    }
    document.addEventListener("keydown", onKey);

    /* ---------------- 播放 / 试玩 ---------------- */
    var playT = 0;
    function togglePlay() {
      E.playing = !E.playing;
      var b = bar.querySelectorAll(".lost-ed__btn")[0];
      if (b) b.textContent = E.playing ? "⏸ 暂停" : "▶ 播放";
      if (E.playing) { playT = performance.now(); requestAnimationFrame(tickPlay); }
    }
    function tickPlay() {
      if (!E.playing || !E.open) return;
      var now = performance.now();
      E.t = clamp(E.t + (now - playT) / 1000, 0, E.dur);
      playT = now;
      /* 播放头跟着走出屏幕就滚一下 */
      if (t2x(E.t) > V.w * 0.8) E.scroll = clamp(E.t - V.w * 0.2 / E.zoom, 0, Math.max(0, E.dur - 1));
      draw();
      requestAnimationFrame(tickPlay);
    }

    /* ---------------- 采音 ---------------- */
    function recount(percentile, minSep, mode, out) {
      if (!window.GDBeat) { out.textContent = "没有 GDBeat(采音模块没加载)"; return; }
      out.textContent = "采音中…(解码 + 分析,约 3~6 秒)";
      window.GDBeat.decode(E.chart.song).then(function (r) {
        var a = window.GDBeat.analyze(r.buffer, { mode: mode, percentile: percentile, minSep: minSep });
        E.beats = a.beats.slice(); E.period = a.grid.period; E.offset = a.grid.offset; E.dur = a.duration;
        E.env = a.env; E.envStep = a.envStep;
        E.chart.bpm = a.grid.bpm; E.chart.period = a.grid.period; E.chart.offset = a.grid.offset; E.chart.duration = a.duration;
        /* 让游戏也用上刚采出来的节拍(不然两边不同步)*/
        if (api.applyBeats) api.applyBeats(E.beats, E.period, E.offset, E.dur, E.env, E.envStep);
        E.beatsInfo = { n: a.beats.length, bpm: a.grid.bpm, res: a.grid.residual };
        E.status = "重新采音:" + a.beats.length + " 个节拍 / " + a.grid.bpm + " BPM / 平均偏差 " + (a.grid.residual * 1000).toFixed(0) + "ms";
        out.textContent = E.status;
        syncBar(); draw();
      }).catch(function (err) { out.textContent = "采音失败:" + ((err && err.message) || err); });
    }

    /* ---------------- 导出 / 导入 / 套用 ---------------- */
    function curChart() {
      var ch = JSON.parse(JSON.stringify(E.chart));
      ch.bpm = +E.period ? +(60 / E.period).toFixed(2) : ch.bpm;
      ch.period = E.period; ch.offset = E.offset; ch.duration = E.dur;
      ch.items = items.slice().sort(function (a, b) { return a.t - b.t; }).map(function (it) {
        var o = { t: +(+it.t).toFixed(4), row: it.row, type: it.type, w: it.w || 1 };
        if (it.type === "orb") o.orb = it.orb || "yellow";
        return o;
      });
      return ch;
    }
    function applyAll() {
      var ch = curChart();
      var n = api.applyChart(ch);
      E.chart = ch; E.dirty = false;
      E.status = "已套用 " + n + " 个物件到游戏(点「试玩」从播放头开始跑)";
      syncBar();
      return ch;
    }
    function exportJson() {
      jsonBox.style.display = "block";
      jsonBox.value = JSON.stringify(applyAll(), null, 1);
      jsonBox.select();
      try { document.execCommand("copy"); E.status = "已套用并复制 JSON 到剪贴板;也可以手动复制这里的内容"; } catch (e) { E.status = "已套用;JSON 在下面的框里,手动复制"; }
      syncBar();
    }
    function importJson() {
      jsonBox.style.display = "block";
      jsonBox.value = jsonBox.value || JSON.stringify(curChart(), null, 1);
      if (!window.confirm("把下面框里的 JSON 当铺面载入?(会替换当前编辑内容)")) return;
      try {
        var ch = JSON.parse(jsonBox.value);
        if (!ch.segments) throw new Error("缺少 segments");
        E.chart = ch;
        if (ch.period) E.period = ch.period;
        if (ch.offset != null) E.offset = ch.offset;
        if (ch.duration) E.dur = ch.duration;
        loadItems(ch.items || []);
        applyAll();
        E.status = "已载入 " + items.length + " 个物件";
      } catch (err) { E.status = "导入失败:" + ((err && err.message) || err); }
      syncBar(); draw();
    }

    /* ---------------- 开关 ---------------- */
    function open() {
      if (E.open) return;
      E.open = true;
      var a2 = api.data();
      if (a2 && a2.chart) { E.chart = JSON.parse(JSON.stringify(a2.chart)); if (a2.beats) E.beats = a2.beats.slice(); }
      wrap.style.display = "block";
      api.editorOpen(true);
      E.status = "编辑中;游戏已暂停 —— 点「试玩」从播放头开始跑";
      syncBar();
      resize();
    }
    function close() {
      if (!E.open) return;
      E.open = false;
      wrap.style.display = "none";
      api.editorOpen(false);
    }
    wrap.style.display = "none";

    return { open: open, close: close, toggle: function () { E.open ? close() : open(); }, isOpen: function () { return E.open; }, E: E, items: function () { return items; }, curChart: curChart, apply: applyAll, data: function () { return api.data(); } };
  }

  /* ---------------- 入口:?chart / Alt+E ---------------- */
  function boot() {
    var root = document.querySelector("[data-lost]");
    if (!root) return;
    var ed = null;
    function ensure() {
      if (!ed) ed = mount(root);
      return ed;
    }
    function toggle() { var e = ensure(); if (e) e.toggle(); }
    if (/[?&]chart(=|&|$)/.test(location.search)) {
      var tries = 0;
      (function wait() {
        var e = ensure();
        if (e) { e.open(); return; }
        if (tries++ < 60) setTimeout(wait, 250);
      })();
    }
    window.addEventListener("keydown", function (ev) {
      if (ev.altKey && (ev.key === "e" || ev.key === "E")) { ev.preventDefault(); toggle(); }
    });
    window.__lostEditor = { toggle: toggle, ensure: ensure };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
