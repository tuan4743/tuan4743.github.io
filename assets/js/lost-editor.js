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
    { k: "echo", n: "回响", c: "#a0f0ff" },
    /* ★ 斜轨固定 45°,而且自动接到上下边界:点哪一行,另一端就接到天花板或地面 */
    { k: "railUpTop", n: "斜轨↗ 接上边", c: "#6ee7ff", t: "rail", dir: 1, anchor: "top" },
    { k: "railUpBottom", n: "斜轨↗ 接下边", c: "#6ee7ff", t: "rail", dir: 1, anchor: "bottom" },
    { k: "railDownBottom", n: "斜轨↘ 接下边", c: "#6ee7ff", t: "rail", dir: -1, anchor: "bottom" },
    { k: "railDownTop", n: "斜轨↘ 接上边", c: "#6ee7ff", t: "rail", dir: -1, anchor: "top" },
    { k: "hole", n: "坑洞", c: "#ffb36b" },
    { k: "platform", n: "平台(可踩)", c: "#b8e986" },
    { k: "ground", n: "地面", c: "#9fb8d0" },
    { k: "decoText", n: "文字", c: "#ffffff" },
    { k: "decoLight", n: "光源", c: "#ffe9a8" },
    { k: "portal", n: "圆环(切形态)", c: "#ffe17a" }
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
      type: "block", orb: "yellow", row: 0, snap: "onset", zoom: 26, scroll: 0,
      sel: null, drag: null, resize: null, playing: false, t: 0, dirty: false, status: "", beatsInfo: null,
      A: { ctx: null, buf: null, src: null, gain: null, offset: 0, startCtx: 0, err: "" }
    };
    /* 编辑用的物件表(带 id,方便选中/拖动)*/
    var items = [], nextId = 1;
    function loadItems(list) {
      items = (list || []).map(function (it) {
        var o = { id: nextId++, t: it.t, row: it.row | 0, type: it.type, w: it.w || 1, h: it.h || 1, orb: it.orb || "yellow",
          t2: it.t2, row2: it.row2, text: it.text || "", deco: it.deco || "" };
        if (o.type === "rail") railFit(o);     /* ★ 斜轨一律归一到 45°(用户:不需要自定义角度)*/
        return o;
      });
    }
    loadItems(E.chart.items && E.chart.items.length ? E.chart.items : api.dev.draft());
    E.status = (E.chart.items && E.chart.items.length) ? "已载入铺面 " + items.length + " 个物件" : "铺面是空的 → 已用节拍自动铺了一版草稿";

    /* ---------------- 本地草稿 ----------------
       ★ 用户报的:"导出后刷新界面就打不开了,整张铺白做"。
         原来的导出只是把 JSON 塞进一个隐藏文本框 + 复制剪贴板,既没有文件也没有本地保存,
         一刷新全没了;导入在框是空的时候还会【自动填入当前铺面】再导进去 —— 看着成功其实白做。
         现在:改动即存草稿,打开编辑器自动恢复,导出会真的下载文件 */
    var DRAFT_KEY = "lost-chart-draft";
    var draftTimer = 0;
    function itemsOf(ch) { return (ch && ch.items && ch.items.length) ? ch.items : api.dev.draft(); }
    /* force=true 时即使"不脏"也写(导出/导入之后)*/
    function saveDraft(force) {
      if (!E.open) return;
      if (!force && !E.dirty) return;            /* 只有真改动过才写盘 */
      try {
        var now = Date.now();
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, at: now, chart: curChart() }));
        E.draftAt = now;
        E.dirty = false;
      } catch (e) { E.status = "草稿存不进浏览器存储:" + ((e && e.message) || e); }
    }
    function queueDraft() {                       /* 改动很频繁,攒 700ms 再写一次 */
      if (!E.open || draftTimer) return;
      draftTimer = window.setTimeout(function () { draftTimer = 0; saveDraft(); }, 700);
    }
    function loadDraft() {
      try {
        var raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        return (d && d.chart && d.chart.segments && d.chart.segments.length) ? d : null;
      } catch (e) { return null; }
    }
    function dropDraft() { try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) {} E.draftAt = 0; }

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
    /* ---- 段:选段 → 移速 / 存档点 ---- */
    var segSel = el("select", "lost-ed__sel");
    (E.chart.segments || []).forEach(function (s, i) { var o = el("option", null, "ST-0" + (i + 1) + " " + (s.mode || "")); o.value = String(i); segSel.appendChild(o); });
    bar.appendChild(el("i", "lost-ed__tag", "段"));
    bar.appendChild(segSel);
    var spdIn = el("input", "lost-ed__num"); spdIn.type = "number"; spdIn.step = "0.5"; spdIn.min = "3"; spdIn.max = "24";
    var segTIn = el("input", "lost-ed__num"); segTIn.type = "number"; segTIn.step = "0.1"; segTIn.min = "0";
    var chkIn = el("input", "lost-ed__num"); chkIn.type = "number"; chkIn.step = "0.1"; chkIn.min = "0";
    bar.appendChild(el("i", "lost-ed__tag", "起点"));
    bar.appendChild(segTIn);
    bar.appendChild(el("i", "lost-ed__tag", "移速"));
    bar.appendChild(spdIn);
    bar.appendChild(el("i", "lost-ed__tag", "存档点"));
    bar.appendChild(chkIn);
    function segNow() { return E.chart.segments[+segSel.value] || E.chart.segments[0]; }
    function syncSeg() {
      var s = segNow();
      if (!s) return;
      segTIn.value = String(+s.t.toFixed(2));
      spdIn.value = String(s.speed || E.chart.speed || 10.4);
      chkIn.value = String(+(s.check != null ? s.check : s.t).toFixed(2));
      if (E.pendingText != null) txtIn.value = E.pendingText;
    }
    segSel.addEventListener("change", function () { syncSeg(); draw(); });
    segTIn.addEventListener("change", function () {
      var s = segNow();
      var v = clamp(parseFloat(segTIn.value) || 0, 0, E.dur - 1);   /* ★ 允许 0:第一段可以就设在开头 */
      s.t = v; if (s.check == null || s.check < v) s.check = v;
      E.dirty = true; E.status = "段起点改成 " + v + "s"; syncBar(); draw();
    });
    spdIn.addEventListener("change", function () { var s = segNow(); s.speed = clamp(parseFloat(spdIn.value) || 10.4, 3, 24); E.dirty = true; E.status = "ST-0" + (+segSel.value + 1) + " 移速 " + s.speed + " 块/秒"; syncBar(); });
    chkIn.addEventListener("change", function () { var s = segNow(); s.check = snapT(clamp(parseFloat(chkIn.value) || s.t, 0, E.dur));   /* ★ 下限 0:第一个存档点可以调到 0 */ chkIn.value = String(s.check); E.dirty = true; E.status = "ST-0" + (+segSel.value + 1) + " 存档点 " + s.check + "s"; syncBar(); draw(); });
    syncSeg();
    /* ---- 装饰文字内容 ---- */
    var txtIn = el("input", "lost-ed__txt"); txtIn.type = "text"; txtIn.placeholder = "装饰文字";
    bar.appendChild(el("i", "lost-ed__tag", "文字"));
    bar.appendChild(txtIn);
    txtIn.addEventListener("change", function () {
      var it = items.filter(function (q) { return q.id === E.sel; })[0];
      if (it) { it.text = txtIn.value; it.type = "deco"; it.deco = "text"; E.dirty = true; E.status = "文字改成 " + txtIn.value; syncBar(); draw(); }
      else { E.pendingText = txtIn.value; }
    });
    var playBtn = btn("▶ 播放", function () { togglePlay(); });
    b2 = playBtn;
    btn("试玩", function () { applyAll(); api.preview(E.t); E.playing = true; playBtn.textContent = "⏸ 暂停"; });
    btn("自动铺一版", function () {
      if (!window.confirm("用节拍重新自动铺一版?当前铺面会被替换(可以先导出)")) return;
      loadItems(api.dev.draft()); E.dirty = true; E.status = "已重新生成草稿 " + items.length + " 个物件"; syncBar(); draw();
    });
    btn("采音参数", function () { tone.toggle = !tone.toggle; tone.el.style.display = tone.toggle ? "flex" : "none"; resize(); });
    btn("套用", function () { applyAll(); });
    btn("导出", function () { exportJson(); });
    btn("导入", function () { importJson(); });
    btn("清草稿", function () { resetFromRepo(); });
    btn("关闭", function () { close(); });
    bar.appendChild(status);
    wrap.appendChild(bar);
    /* ★ 导入:真的选一个 .json 文件(以前只能靠隐藏文本框,刷新后框是空的就没法导)*/
    var fileIn = el("input", "lost-ed__file");
    fileIn.type = "file"; fileIn.accept = ".json,application/json";
    fileIn.style.display = "none";
    wrap.appendChild(fileIn);
    fileIn.addEventListener("change", function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { doImport(String(fr.result), f.name); fileIn.value = ""; };
      fr.onerror = function () { E.status = "读文件失败:" + f.name; syncBar(); };
      fr.readAsText(f);
    });

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

    /* ---------------- 音频(时间轴的主人)----------------
       编辑器自己播这首 mp3:播放头 = 音频时钟,拖波形即 seek(音频跟着跳)。
       这样"看到的那条线"就是"听到的那一刻",铺面对的就是音乐本身 */
    function audioInit() {
      if (E.A.ctx || E.A.buf || E.A.err) return;
      if (!window.GDBeat) { E.A.err = "no GDBeat"; return; }
      window.GDBeat.decode(E.chart.song).then(function (r) {
        E.A.ctx = r.ctx; E.A.buf = r.buffer;
        E.A.gain = E.A.ctx.createGain();
        var v = 1;
        try { if (window.__cdAudio && window.__cdAudio.getVolume) v = window.__cdAudio.getVolume(); } catch (err) {}
        E.A.gain.gain.value = Math.max(0.05, Math.min(1, v)) * 0.9;
        E.A.gain.connect(E.A.ctx.destination);
        if (E.playing) audioStart(E.t);
      }).catch(function (err) { E.A.err = (err && err.message) || "音频加载失败"; });
    }
    function audioStop() { if (E.A.src) { try { E.A.src.stop(); } catch (err) {} E.A.src = null; } }
    function audioStart(at) {
      if (!E.A.ctx || !E.A.buf) return;
      audioStop();
      try { E.A.ctx.resume(); } catch (err) {}
      E.A.src = E.A.ctx.createBufferSource();
      E.A.src.buffer = E.A.buf; E.A.src.connect(E.A.gain);
      E.A.offset = clamp(at, 0, Math.max(0, E.A.buf.duration - 0.05));
      E.A.startCtx = E.A.ctx.currentTime + 0.02;
      E.A.src.start(E.A.startCtx, E.A.offset);
    }
    /* 拖动播放头/点波形 → 音频跟着定位 */
    function seek(t) {
      E.t = clamp(t, 0, E.dur);
      if (E.playing) audioStart(E.t);
      followPlay(false);
      draw();
    }
    /* ★ 让播放头留在视野里(往右跑出去、往左跑出去都跟)。
       原来只处理"右边跑出去"这一种:从后面往回跳一下,播放头就跑到屏幕外,想在那儿放东西也看不见 */
    function followPlay(force) {
      if (!V.w) return;
      var px = t2x(E.t);
      if (force || px > V.w * 0.7 || px < V.w * 0.15) E.scroll = clamp(xAt(E.t) - (V.w * 0.25) / E.zoom, xAt(0), maxScrollX());
    }

    /* ---------------- 坐标换算 ---------------- */
    var V = { w: 0, h: 0, dpr: 1 };
    function gridTop() { return RULER_H; }
    function gridH() { return V.h - WAVE_H - RULER_H; }
    function rowH() { return gridH() / 10; }
    /* ★ 横轴 = 游戏世界里的"块",不是秒:x = xAt(t) —— 和游戏里 xOf() 同一套分段积分。
       原来这里是 (t - scroll) * zoom(秒→像素),同一块 w=6 的地面:编辑器画成约 2 秒长,
       游戏里只有 6/10.4 ≈ 0.58 秒;而且物件按 t 【居中】画、游戏是以 t 为【左边缘】。
       位置和长度就是这么对不上的(用户报的"地面不准")。 */
    function segSpeedOf(s) { return (s && s.speed) || E.chart.speed || 10.4; }
    function xAt(t) {
      var sg = E.chart.segments || [], lead = E.chart.lead || 0, i, k = 0;
      if (!sg.length) return (t - lead) * (E.chart.speed || 10.4);
      var cum = [Math.max(0, sg[0].t - lead) * segSpeedOf(sg[0])];
      for (i = 1; i < sg.length; i++) cum[i] = cum[i - 1] + (sg[i].t - sg[i - 1].t) * segSpeedOf(sg[i - 1]);
      for (i = 0; i < sg.length; i++) if (t >= sg[i].t) k = i;
      if (t < sg[0].t) return (t - lead) * segSpeedOf(sg[0]);
      return cum[k] + (t - sg[k].t) * segSpeedOf(sg[k]);
    }
    function tOfX(x) {                       /* 块 → 时间(段内线性,反查) */
      var sg = E.chart.segments || [], lead = E.chart.lead || 0, i;
      if (!sg.length) return x / (E.chart.speed || 10.4) + lead;
      for (i = sg.length - 1; i >= 0; i--) {
        var x0 = xAt(sg[i].t);
        if (x >= x0 - 1e-9) return sg[i].t + (x - x0) / segSpeedOf(sg[i]);
      }
      return lead + x / segSpeedOf(sg[0]);
    }
    function t2x(t) { return (xAt(t) - E.scroll) * E.zoom; }     /* 时间 → 屏幕 x */
    function pxOf(t) { return t2x(t); }
    function x2t(px) { return tOfX(px / E.zoom + E.scroll); }     /* 屏幕 x → 时间 */
    function maxScrollX() { return Math.max(xAt(0), xAt(E.dur) - V.w / E.zoom); }
    /* ★ 行与像素:世界里 row 是【底边】(游戏里矩形占 [row, row+h],脚踩在 row+h)
       —— 编辑器必须一样,否则竖着也对不上 */
    function yPx(wy) { return gridTop() + (10 - wy) * rowH(); }
    function yTopOf(row, h) { return yPx(row + (h || 1)); }
    function yBotOf(row) { return yPx(row); }
    function row2y(r) { return yPx(r + 0.5); }                     /* 行的中心 */
    function y2row(y) { return clamp(9 - Math.floor((y - gridTop()) / rowH()), 0, 9); }
    /* ★ 软吸附:传了 px 就"靠得近才吸"(8 像素以内),否则按你点的位置放。
       原来是不管多远都吸 —— onset 网格一格约 50 像素,点哪儿都被拉走,
       用户反馈"位置不能随意摆放" */
    function snapT(t, px) {
      var cand = snapNear(t);
      if (px == null) return cand;
      if (E.snap === "off") return +t.toFixed(3);
      return Math.abs(pxOf(cand) - px) <= 8 ? cand : +t.toFixed(3);
    }
    function snapNear(t) {
      if (E.snap === "off") return +t.toFixed(3);
      var best = t, bd = 1e9, i;
      if (E.snap === "grid") {
        var k = Math.round((t - E.offset) / (E.period / 2));
        return +(E.offset + k * (E.period / 2)).toFixed(3);
      }
      for (i = 0; i < E.beats.length; i++) { var d = Math.abs(E.beats[i] - t); if (d < bd) { bd = d; best = E.beats[i]; } }
      /* ★ 第一个 onset 之前(曲子开头那段静音)没有 onset 可吸 → 退回等比网格,
         这样 t 从 0 附近也能放东西,不用非等 3.22 秒 */
      if (E.beats.length && t < E.beats[0] - 1e-6) {
        var gk = Math.round((t - E.offset) / (E.period / 2));
        var gt = E.offset + gk * (E.period / 2);
        if (Math.abs(gt - t) <= bd) return +Math.max(0, gt).toFixed(4);
      }
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
      var tA = x2t(0), tB = x2t(V.w);
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
        var isel = E.sel === it.id;
        var iy = row2y(it.row);                       /* 行的中心:装饰物/光源用 */
        var bb = boxOf(it);                           /* ★ 和游戏同一个盒子 */
        var ix = bb.x, iw = bb.w;
        var T = TYPES.filter(function (q) { return q.k === it.type || q.t === it.type; })[0] || TYPES[0];
        ctx.fillStyle = T.c;
        if (it.type === "deco") {
          if ((it.deco || "light") === "text") {
            ctx.globalAlpha = 0.9; ctx.fillStyle = "#ffffff";
            /* 游戏里:字号 = 块高 × ppb,基线贴在【这一行的底边】—— 这里一样 */
            ctx.font = "600 " + Math.max(9, Math.round(E.zoom * (it.h || 0.7))) + "px ui-monospace, Consolas, monospace";
            ctx.fillText(it.text || "(文字)", ix, yBotOf(it.row));
            ctx.globalAlpha = 1;
          } else {
            var lr2 = Math.max(6, (it.w || 2) * E.zoom);
            var lg2 = ctx.createRadialGradient(ix, iy, 0, ix, iy, lr2);
            lg2.addColorStop(0, "rgba(255,233,168,0.55)");
            lg2.addColorStop(1, "rgba(255,233,168,0)");
            ctx.fillStyle = lg2; ctx.fillRect(ix - lr2, iy - lr2, lr2 * 2, lr2 * 2);
          }
          continue;
        }
        if (it.type === "rail") {
          var rax = t2x(it.t), ray = row2y(it.row);
          var rbx = t2x(it.t2 != null ? it.t2 : it.t + E.period * 2), rby = row2y(it.row2 != null ? it.row2 : it.row);
          ctx.globalAlpha = 0.95; ctx.strokeStyle = T.c; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(rax, ray); ctx.lineTo(rbx, rby); ctx.stroke(); ctx.lineWidth = 1;
          if (E.sel === it.id) { ctx.fillStyle = "#ffffff"; ctx.fillRect(rax - 4, ray - 4, 8, 8); ctx.fillRect(rbx - 4, rby - 4, 8, 8); }
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.globalAlpha = it.type === "block" || it.type === "spike" ? 0.85 : 0.6;
        ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
        ctx.globalAlpha = 1;
        if (isel) {
          var bb = boxOf(it);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
          ctx.strokeRect(bb.x - 1, bb.y - 1, bb.w + 2, bb.h + 2);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(bb.x + bb.w - 3, bb.cy - 4, 6, 8);      /* 右边手柄:宽 */
          ctx.fillRect(bb.cx - 4, bb.y - 3, 8, 6);             /* 上边手柄:高 */
          ctx.lineWidth = 1;
        }
      }
      /* 存档点小旗 */
      (E.chart.segments || []).forEach(function (s, i) {
        var ct = (s.check != null ? s.check : s.t);
        var cx2 = t2x(ct);
        if (cx2 < -20 || cx2 > V.w + 20) return;
        ctx.strokeStyle = "rgba(255,225,122,0.9)";
        ctx.beginPath(); ctx.moveTo(cx2, gridTop()); ctx.lineTo(cx2, gridTop() + 14); ctx.stroke();
        ctx.fillStyle = "rgba(255,225,122,0.9)";
        ctx.beginPath(); ctx.moveTo(cx2, gridTop()); ctx.lineTo(cx2 + 11, gridTop() + 4); ctx.lineTo(cx2, gridTop() + 8);
        ctx.closePath(); ctx.fill();
      });
      /* 播放头 */
      var px = t2x(E.t);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, V.h); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(226,246,255,0.85)";
      ctx.font = "600 11px ui-monospace, Consolas, monospace";
      ctx.fillText(E.t.toFixed(3) + "s", px + 4, V.h - 8);
      queueDraft();               /* ★ 每次重画都排一次存草稿(700ms 合并)*/
    }
    function rulerY() { return 12; }

    /* ---------------- 交互 ---------------- */
    function boxOf(it) {
      /* ★ 和游戏同一个盒子:左边缘 = t 处的世界 x,宽度 = w 块,底边 = 第 row 行 */
      var ix = t2x(it.t);
      var iw = Math.max(6, (it.w || 1) * E.zoom);
      var ih = Math.max(6, (it.h || 1) * rowH());
      var iy = yTopOf(it.row, it.h);
      return { x: ix, y: iy, w: iw, h: ih, cx: ix + iw / 2, cy: iy + ih / 2 };
    }
    /* ---------------- 斜轨(固定 45°)----------------
       ★ 45° = 世界坐标里 |Δ行| = |Δ块|;长度用"几行"表示(横竖相等)。
         原来两端点能拖成任意角度、而且拖完 t2/row2 和长度对不上  */
    function railDir(it) { return (it.row2 != null && it.row2 < it.row) ? -1 : 1; }
    function railLen(it) { return Math.max(1, Math.abs((it.row2 != null ? it.row2 : it.row + 1) - it.row)); }
    /* ★ 横向【永远向右】走 len 块,只有行号按方向走。
       原来横向写成 d*len:↘ 轨的 x2 < x,游戏 prepare() 看见 x2 < x 会把两端对调 →
       放下去是"向下",到游戏里变成"向上"(用户报的 bug)。 */
    function railFit(it) {
      var d = railDir(it), len = Math.max(1, Math.abs((it.row2 != null ? it.row2 : it.row + d) - it.row));
      it.row = clamp(it.row, 0, 9);
      len = clamp(len, 1, d > 0 ? 9 - it.row : it.row);
      it.row2 = it.row + d * len;
      it.t2 = +tOfX(xAt(it.t) + len).toFixed(4);
      return it;
    }
    /* 端点都往右:len = |Δ行| = 横向块数 */
    function railSet(it, aRow, bRow) {
      it.row = clamp(aRow, 0, 9);
      it.row2 = clamp(bRow, 0, 9);
      if (it.row2 === it.row) it.row2 = it.row + (it.row < 9 ? 1 : -1);
      var len = Math.abs(it.row2 - it.row);
      it.t2 = +tOfX(xAt(it.t) + len).toFixed(4);
      return it;
    }
    function railSeg(it) {
      return { ax: t2x(it.t), ay: row2y(it.row),
        bx: t2x(it.t2 != null ? it.t2 : it.t), by: row2y(it.row2 != null ? it.row2 : it.row) };
    }
    function distToSeg(px, py, ax, ay, bx, by) {
      var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      var k = L > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / L, 0, 1) : 0;
      return Math.hypot(px - (ax + dx * k), py - (ay + dy * k));
    }
    /* 命中尺寸手柄:右边 = 改宽,上边 = 改高(只有选中的物件有手柄)*/
    /* 斜轨两端的端点手柄(先于普通命中判断)*/
    function hitRailEnd(x, y) {
      if (E.sel == null) return null;
      var it = items.filter(function (q) { return q.id === E.sel && q.type === "rail"; })[0];
      if (!it) return null;
      var ax = t2x(it.t), ay = row2y(it.row);
      var bx = t2x(it.t2 != null ? it.t2 : it.t + E.period * 2), by = row2y(it.row2 != null ? it.row2 : it.row);
      if (Math.hypot(x - ax, y - ay) <= 9) return { it: it, k: "railA" };
      if (Math.hypot(x - bx, y - by) <= 9) return { it: it, k: "railB" };
      return null;
    }
    function hitHandle(x, y) {
      if (E.sel == null) return null;
      var it = items.filter(function (q) { return q.id === E.sel; })[0];
      if (!it || it.type === "rail") return null;      /* 斜轨只有两端手柄,没有 w/h */
      var b = boxOf(it);
      if (x >= b.x + b.w - 5 && x <= b.x + b.w + 7 && Math.abs(y - b.cy) <= b.h / 2 + 4) return { it: it, k: "w" };
      if (y >= b.y - 7 && y <= b.y + 5 && Math.abs(x - b.cx) <= b.w / 2 + 4) return { it: it, k: "h" };
      return null;
    }
    function hit(x, y) {
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.type === "rail") {
          /* ★ 点到线段的距离:整条斜线都能点中(原来只有起点那一小块能点到 → 选不中、删不掉、拖不动)*/
          var g = railSeg(it);
          if (distToSeg(x, y, g.ax, g.ay, g.bx, g.by) <= 8) return it;
          continue;
        }
        var b = boxOf(it);
        if (Math.abs(x - b.cx) <= b.w / 2 + 3 && Math.abs(y - b.cy) <= b.h / 2 + 3) return it;
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
      if (p.y > V.h - WAVE_H) { seek(x2t(p.x)); return; }   /* 点波形 = 播放头跳过去,音频也跳 */
      var hd = hitRailEnd(p.x, p.y) || hitHandle(p.x, p.y);
      if (hd) { E.resize = hd; try { cv.setPointerCapture(ev.pointerId); } catch (err) {} draw(); return; }
      if (hitIt) {
        E.sel = hitIt.id;
        E.drag = { it: hitIt, dx: p.x - t2x(hitIt.t), y0: p.y, row0: hitIt.row, rowAtY0: y2row(p.y) };
        if (hitIt.type === "rail") {            /* 斜轨:抓住哪一点,平移时就保持那个抓点 */
          E.drag.grabT = x2t(p.x) - hitIt.t;
          E.drag.grabRow = y2row(p.y) - hitIt.row;
        }
        try { cv.setPointerCapture(ev.pointerId); } catch (err) {}   /* 合成的 PointerEvent 没有真指针,捕获会抛错 */
      } else {
        /* 空白处:按当前类型放一个 */
        var nt = { id: nextId++, t: snapT(x2t(p.x), p.x), row: y2row(p.y), type: E.type, w: 1, orb: E.orb };
        var TT = TYPES.filter(function (q) { return q.k === E.type; })[0];
        if (TT && TT.t) nt.type = TT.t;                    /* 「斜轨↗/↘」落到铺面里都是 rail */
        if (nt.type === "rail") {
          /* ★ 固定 45° + 自动接边界:点的那一行是"自由端",另一端接到天花板(9)或地面(0) */
          var rd = (TT && TT.dir) || 1, anc = (TT && TT.anchor) || "top";
          var cRow = y2row(p.y), aRow, bRow;
          if (rd > 0) { if (anc === "top") { aRow = clamp(cRow, 0, 8); bRow = 9; } else { aRow = 0; bRow = clamp(cRow, 1, 9); } }
          else { if (anc === "bottom") { aRow = clamp(cRow, 1, 9); bRow = 0; } else { aRow = 9; bRow = clamp(cRow, 0, 8); } }
          railSet(nt, aRow, bRow);
          nt.t2 = +(+nt.t2).toFixed(4);
          E.status = "斜轨从第 " + nt.row + " 行到第 " + nt.row2 + " 行(" + Math.abs(nt.row2 - nt.row) + " 行长,45°," +
            (anc === "top" ? "接天花板" : "接地面") + ")";
        }
        if (E.type === "hole") { nt.row = 0; nt.w = 2; }
        if (E.type === "platform") { nt.w = 3; nt.h = 1; }
        if (E.type === "ground") { nt.w = 4; nt.h = 1; }
        if (E.type === "decoText") { nt.type = "deco"; nt.deco = "text"; nt.w = 2; nt.text = (E.pendingText || ""); }
        if (E.type === "decoLight") { nt.type = "deco"; nt.deco = "light"; nt.w = 2; }
        if (E.type === "portal") { nt.w = 2; nt.to = "plane"; }
        items.push(nt); E.sel = nt.id; E.row = nt.row; E.dirty = true;
        if (nt.type !== "rail") E.status = "放了 " + nt.type + " @ " + nt.t + "s / 行 " + nt.row + "(共 " + items.length + ")";
        else E.status = E.status + "(共 " + items.length + " 件)";   /* 斜轨保留上面那句"从第几行到第几行"*/
        syncBar();
      }
      draw();
    });
    cv.addEventListener("pointermove", function (ev) {
      var ph = pos(ev);
      if (E.resize) {
        /* 斜轨端点 */
        if (E.resize.k === "railA" || E.resize.k === "railB") {
          var itR = E.resize.it;
          if (E.resize.k === "railA") {
            /* ★ A 点随便放,但长度不变、B 点跟着保持 45° */
            var dA = railDir(itR), lenA = railLen(itR);
            itR.t = snapT(x2t(ph.x), ph.x);
            itR.row = dA > 0 ? clamp(y2row(ph.y), 0, 9 - lenA) : clamp(y2row(ph.y), lenA, 9);
            itR.row2 = itR.row + dA * lenA;
            itR.t2 = +tOfX(xAt(itR.t) + lenA).toFixed(4);
          } else {
            /* ★ B 点只能沿 45° 线走 = 就是拖长度 */
            var dB = railDir(itR);
            var lenB = clamp(Math.abs(y2row(ph.y) - itR.row), 1, dB > 0 ? 9 - itR.row : itR.row);
            itR.row2 = itR.row + dB * lenB;
            itR.t2 = +tOfX(xAt(itR.t) + lenB).toFixed(4);
          }
          E.status = "斜轨 " + (E.resize.k === "railA" ? "A 点" : "长度") + " → 行 " + itR.row + "~" + itR.row2 + "(" + railLen(itR) + " 行长,45°)";
          E.dirty = true; syncBar(); draw(); return;
        }
        /* 改尺寸:0.5 块一档 */
        var b0 = boxOf(E.resize.it);
        if (E.resize.k === "w") {
          var w = Math.max(0.5, Math.round(((ph.x - b0.x) / E.zoom) * 2) / 2);
          E.resize.it.w = w;
          E.status = "宽 " + w + " 块";
        } else {
          /* ★ 从这一行的【底边】往上量:高 = 几块,整数(游戏里 h 就是占几行)*/
          var h2 = clamp(Math.round((yBotOf(E.resize.it.row) - ph.y) / rowH()), 1, 10 - E.resize.it.row);
          E.resize.it.h = h2;
          E.status = "高 " + h2 + " 块";
        }
        E.dirty = true; syncBar(); draw(); return;
      }
      if (!E.drag) return;
      var p = ph;
      if (E.drag.it.type === "rail") {
        /* ★ 整根斜轨一起平移:横轴、纵轴都能动,长度和 45° 不变 */
        var itR3 = E.drag.it, dR = railDir(itR3), lenR = railLen(itR3);
        var tNew = x2t(p.x) - E.drag.grabT;                 /* A 点应该落在的时刻 */
        var pxA = (xAt(tNew) - E.scroll) * E.zoom;          /* 它在屏幕上的位置(软吸附按像素判远近)*/
        itR3.t = snapT(tNew, pxA);
        var wantRow = y2row(p.y) - E.drag.grabRow;
        itR3.row = dR > 0 ? clamp(wantRow, 0, 9 - lenR) : clamp(wantRow, lenR, 9);
        itR3.row2 = itR3.row + dR * lenR;
        itR3.t2 = +tOfX(xAt(itR3.t) + lenR).toFixed(4);
        E.dirty = true;
        E.status = "斜轨平移到 " + itR3.t.toFixed(2) + "s / 行 " + itR3.row + "~" + itR3.row2 + "(45°、" + lenR + " 行长)";
        syncBar(); draw();
        return;
      }
      var dragPx = p.x - E.drag.dx;                 /* 被拖物件的左边缘在屏幕上的位置 */
      E.drag.it.t = snapT(x2t(dragPx), dragPx);
      E.drag.it.row = y2row(p.y);
      E.dirty = true;
      E.status = "拖到 " + E.drag.it.t + "s / 行 " + E.drag.it.row;
      syncBar(); draw();
    });
    cv.addEventListener("pointerup", function () { E.drag = null; E.resize = null; draw(); });
    cv.addEventListener("wheel", function (ev) {
      ev.preventDefault();
      if (ev.shiftKey) {
        var p = pos(ev);
        var bx = p.x / E.zoom + E.scroll;                 /* 鼠标底下那一块,缩放前后不动 */
        E.zoom = clamp(E.zoom * (ev.deltaY < 0 ? 1.18 : 0.85), 6, 220);
        E.scroll = bx - p.x / E.zoom;
      } else {
        /* ★ 一格滚轮 ≈ 视野的 1/4:原来按"像素/块"算,一格才挪 10 像素,压根走不动 */
        E.scroll = clamp(E.scroll + (ev.deltaY / 100) * (V.w / Math.max(1, E.zoom)) * 0.25, xAt(0), maxScrollX());
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
      if (E.playing) { audioInit(); audioStart(E.t); playT = performance.now(); requestAnimationFrame(tickPlay); }
      else audioStop();
    }
    function tickPlay() {
      if (!E.playing || !E.open) return;
      var now = performance.now();
      /* ★ 播放头以音频时钟为准(音频还没解好时退回墙钟)*/
      if (E.A.src && E.A.ctx) E.t = clamp(E.A.offset + (E.A.ctx.currentTime - E.A.startCtx), 0, E.dur);
      else E.t = clamp(E.t + (now - playT) / 1000, 0, E.dur);
      playT = now;
      followPlay(false);
      if (E.t >= E.dur - 0.02) { E.playing = false; audioStop(); if (b2) b2.textContent = "▶ 播放"; return; }
      draw();
      requestAnimationFrame(tickPlay);
    }
    var b2 = null;

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
        if ((it.h || 1) !== 1) o.h = it.h;
        if (it.type === "rail") { railFit(it); o.t2 = +(+it.t2).toFixed(4); o.row2 = it.row2; }
        if (it.type === "deco") { o.deco = it.deco || "light"; if (it.text) o.text = it.text; }
        if (it.type === "portal") o.to = it.to || "plane";
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
      var ch = applyAll();
      var txt = JSON.stringify(ch, null, 1);
      jsonBox.style.display = "block";
      jsonBox.value = txt;
      var fname = "lost-chart.json";
      try {
        /* ★ 真的下载一个文件:只复制到剪贴板太容易丢(用户就是"导出后刷新,整张白做")*/
        var blob = new Blob([txt], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        window.setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 3000);
        E.status = "已导出 " + fname + "(" + items.length + " 件):放进 static/assets/cd/ 覆盖同名文件,再推上去;本地草稿也存了";
      } catch (e) {
        try { jsonBox.select(); document.execCommand("copy"); E.status = "已复制 JSON 到剪贴板(下载不可用);本地草稿也存了"; }
        catch (e2) { E.status = "JSON 在下面的框里,手动复制;本地草稿也存了"; }
      }
      saveDraft(true);
      syncBar();
    }
    /* 点「导入」:框里有内容就导框里的,框是空的就直接弹选文件 ——
       绝不"自动填入当前铺面"假装成功(那是白做的根源)*/
    function importJson() {
      jsonBox.style.display = "block";
      var txt = (jsonBox.value || "").trim();
      if (txt) { doImport(txt, "文本框"); return; }
      E.status = "请选一个铺面 .json 文件(或把 JSON 粘到下面的框里再点导入)";
      syncBar();
      try { fileIn.click(); } catch (e) { E.status = "这个浏览器不让自动弹选择框,请把 JSON 粘到下面的框里"; syncBar(); }
    }
    function doImport(text, src) {
      var ch;
      try {
        ch = JSON.parse(text);
        if (!ch || !ch.segments || !ch.segments.length) throw new Error("不是铺面 JSON(缺少 segments)");
      } catch (err) {
        E.status = "导入失败:" + ((err && err.message) || err);
        syncBar(); draw();
        return;
      }
      if (!window.confirm("载入" + (src ? "「" + src + "」" : "") + "的铺面?共 " + ((ch.items || []).length) + " 件,会替换当前编辑内容(当前草稿会被覆盖)")) return;
      E.chart = ch;
      if (ch.period) E.period = ch.period;
      if (ch.offset != null) E.offset = ch.offset;
      if (ch.duration) E.dur = ch.duration;
      loadItems(itemsOf(ch));
      applyAll();
      saveDraft(true);
      jsonBox.value = "";
      E.status = "已导入 " + items.length + " 个物件(来源:" + (src || "文本") + ")";
      syncBar(); draw();
    }
    /* 丢掉本地草稿,回到仓库里的 static/assets/cd/lost-chart.json */
    function resetFromRepo() {
      if (!window.confirm("丢掉本地草稿,载入仓库里的铺面?")) return;
      dropDraft();
      fetch("/assets/cd/lost-chart.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (ch) {
        E.chart = ch;
        if (ch.period) E.period = ch.period;
        if (ch.offset != null) E.offset = ch.offset;
        if (ch.duration) E.dur = ch.duration;
        loadItems(itemsOf(ch));
        applyAll();
        E.status = "已清掉草稿,载入仓库铺面:" + items.length + " 件";
        syncBar(); draw();
      })["catch"](function (e) { E.status = "取仓库铺面失败:" + ((e && e.message) || e); syncBar(); });
    }
    /* ---------------- 开关 ---------------- */
    function open() {
      if (E.open) return;
      E.open = true;
      var a2 = api.data();
      if (a2 && a2.chart) { E.chart = JSON.parse(JSON.stringify(a2.chart)); if (a2.beats) E.beats = a2.beats.slice(); }
      loadItems(itemsOf(E.chart));
      wrap.style.display = "block";
      api.editorOpen(true);
      E.status = "编辑中;游戏已暂停 —— 点「试玩」从播放头开始跑";
      /* ★ 有本地草稿就先恢复(刷新/关页面都不再丢)*/
      var d = loadDraft();
      if (d) {
        E.chart = d.chart;
        if (d.chart.period) E.period = d.chart.period;
        if (d.chart.offset != null) E.offset = d.chart.offset;
        if (d.chart.duration) E.dur = d.chart.duration;
        loadItems(itemsOf(d.chart));
        E.draftAt = d.at;
        E.status = "已恢复上次的草稿:" + items.length + " 件(" + new Date(d.at).toLocaleString() + ")。要仓库版点「清草稿」;改完点「导出」下载铺面文件";
      }
      syncBar();
      resize();
      followPlay(true);            /* ★ 打开时视野落在播放头附近(默认就在 0 秒那一段)*/
    }
    function close() {
      if (!E.open) return;
      E.open = false;
      wrap.style.display = "none";
      api.editorOpen(false);
    }
    wrap.style.display = "none";

    /* ★ 验收用:列出编辑器【画出来】的每个盒子,并换算回世界块(px → 块)。
       这样就能直接和游戏里 dev.items() 的 x/x2/row 对比,验证"编辑器所见 = 游戏所得" */
    function probe() {
      return items.map(function (it) {
        if (it.type === "rail") {
          var g = railSeg(it);
          return { t: it.t, type: it.type, row: it.row, h: 1, w: 1, t2: it.t2, row2: it.row2,
            px0: +g.ax.toFixed(2), px1: +g.bx.toFixed(2), py0: +g.ay.toFixed(2), py1: +g.by.toFixed(2),
            wx0: +(E.scroll + g.ax / E.zoom).toFixed(3), wx1: +(E.scroll + g.bx / E.zoom).toFixed(3),
            wy0: +(10 - (g.ay - gridTop()) / rowH()).toFixed(3), wy1: +(10 - (g.by - gridTop()) / rowH()).toFixed(3) };
        }
        var b = boxOf(it);
        return { t: it.t, type: it.type, row: it.row, h: it.h || 1, w: it.w || 1,
          px0: +b.x.toFixed(2), px1: +(b.x + b.w).toFixed(2), py0: +b.y.toFixed(2), py1: +(b.y + b.h).toFixed(2),
          wx0: +(E.scroll + b.x / E.zoom).toFixed(3), wx1: +(E.scroll + (b.x + b.w) / E.zoom).toFixed(3),
          wy0: +(10 - (b.y + b.h - gridTop()) / rowH()).toFixed(3), wy1: +(10 - (b.y - gridTop()) / rowH()).toFixed(3) };
      });
    }
    return { open: open, close: close, toggle: function () { E.open ? close() : open(); }, isOpen: function () { return E.open; }, E: E, items: function () { return items; }, curChart: curChart, apply: applyAll, probe: probe, pxOf: pxOf, xAt: xAt, tOfX: tOfX, x2t: x2t, data: function () { return api.data(); } };
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
    /* ★ 快捷键保护:只认【纯 Alt+E】——
       Ctrl+E / Cmd+E / Shift+Alt+E 这些是浏览器的快捷键(搜索栏、开发者工具…),
       一律放行,不 preventDefault、也不开编辑器;
       再要求当前确实停在第三张盘上,不然在别的页面按也会弹出来 */
    window.addEventListener("keydown", function (ev) {
      if (!(ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey)) return;
      if (ev.key !== "e" && ev.key !== "E" && ev.code !== "KeyE") return;
      var panel = document.querySelector('[data-panel="lost"]');
      if (!panel || !panel.classList.contains("is-active")) return;
      if (ev.repeat) return;
      ev.preventDefault();
      ev.stopPropagation();
      toggle();
    }, true);
    window.__lostEditor = { toggle: toggle, ensure: ensure };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
