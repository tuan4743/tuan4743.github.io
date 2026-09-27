/* ============================================================
   第一张盘「自我」:脸的下半部分 —— 参数化的几何 + 微调面板
   ─────────────────────────────────────────────────────────────
   为什么有这个文件:用户连着几轮说"裙摆/融化的位置不对"。
   我看不见渲染(沙箱起不了浏览器),只能靠坐标推,结果改了六轮还是不对。
   于是把这一块做成【可调】的:所有尺寸都是一个数,
   在页面上拖滑条就能改,改完复制一段贴回代码即可固化。

   怎么用:
     · 网址加 ?selftune   → 自动打开(线上也能用:https://tuagfey.com/?selftune)
     · 或按 Alt + S        → 随时开关(平时不加载任何 DOM)
     · 面板里每根滑条都实时生效;"复制参数"给你一段能直接贴回
       layouts/partials/pages/self.html 与 assets/js/page-self-tune.js 的值。

   几何全部相对【锚点】(默认 180,268 —— 就是剪影遮罩的切线位置):
     锚点在"脸的底缘"上,所以"位置对不对"就是锚点这两个数。
     形状的路径由参数现算,所以改锚点/改大小都不需要重写路径。
   ============================================================ */
(function () {
  "use strict";

  var R = 118, CX = 180, CY = 180;        /* 脸的圆(与 self.html 一致)*/

  /* 默认参数 —— 与 self.html / pages.css 里的现值对齐 */
  var DEF = {
    /* 遮罩切线 + 融化水滴 用的锚点(用户:融化保持之前那一版)*/
    ax: 180,
    ay: 268,
    /* 裙摆自己的锚点与形状(用户 2026-09 调定)*/
    skirtAx: 254,
    skirtAy: 237,
    skirtW: 0.3,
    skirtDrop: 1.69,
    dripSpread: 1,
    dripLen: 1,
    gooW: 91,
    gooH: 61
  };

  var TUNE = window.__selfSkinTune || (window.__selfSkinTune = {});

  function num(k) {
    var v = TUNE[k];
    return isFinite(v) ? v : DEF[k];
  }
  function fmt(v) { return (Math.round(v * 1000) / 1000).toString(); }

  function halfW(y) {
    var d = R * R - (y - CY) * (y - CY);
    return d > 0 ? Math.sqrt(d) : 0;
  }

  /* ---------- 裙摆:顶边贴着脸的弧,往下展开成三个波 ---------- */
  function skirtPath(P) {
    var half = halfW(P.skirtAy);   /* ★ 用裙摆自己的锚点高度算半宽 */
    var l = -half * P.skirtW, r = half * P.skirtW;
    var k = P.skirtDrop;
    return 'M' + l.toFixed(1) + ' 0' +
      'A' + R + ' ' + R + ' 0 0 1 ' + r.toFixed(1) + ' 0' +
      'c-6 ' + Math.round(16 * k) + '-' + 10 + ' ' + Math.round(30 * k) + '-' + 14 + ' ' + Math.round(44 * k) +
      '-6 ' + Math.round(24 * k) + '-' + 12 + ' ' + Math.round(48 * k) + '-' + 12 + ' ' + Math.round(30 * k) +
      ' 0 4-' + 10 + '-' + Math.round(14 * k) + '-' + 24 + '-' + Math.round(22 * k) +
      '-' + 14 + '-' + Math.round(8 * k) + '-' + 34 + '-' + Math.round(12 * k) + '-' + 54 + '-' + Math.round(12 * k) +
      's-' + 40 + ' ' + Math.round(4 * k) + '-' + 54 + ' ' + Math.round(12 * k) +
      'c-' + 14 + ' ' + Math.round(8 * k) + '-' + 24 + ' ' + Math.round(26 * k) + '-' + 24 + ' ' + Math.round(22 * k) +
      ' 0 ' + Math.round(18 * k) + '-' + 6 + '-' + Math.round(6 * k) + '-' + 12 + '-' + Math.round(30 * k) +
      '-' + 4 + '-' + Math.round(14 * k) + '-' + 8 + '-' + Math.round(28 * k) + '-' + 14 + '-' + Math.round(44 * k) + 'z';
  }

  /* ---------- 一滴:上收腰、下圆滴 ---------- */
  function dropPath(cx, r, t) {
    var a = Math.round(t * 0.22), b = Math.round(t * 0.56), c = Math.round(t * 0.78);
    return 'M' + cx + ' 0c' + r + ' ' + a + ' ' + r + ' ' + b + ' ' + r + ' ' + c +
      'a' + r + ' ' + r + ' 0 0 1 ' + (-2 * r) + ' 0' +
      'c0-' + a + ' 0-' + b + ' ' + r + '-' + c + 'z';
  }

  var DRIBS = [[-28, 15, 34], [0, 20, 46], [28, 14, 30]];   /* cx, r, 长度 */
  function dripPaths(P) {
    return DRIBS.map(function (d) {
      return dropPath(Math.round(d[0] * P.dripSpread), d[1], Math.round(d[2] * P.dripLen));
    });
  }

  /* ---------- 把参数写进 DOM ---------- */
  function apply() {
    var P = { ax: num('ax'), ay: num('ay'),
      skirtAx: num('skirtAx'), skirtAy: num('skirtAy'),
      skirtW: num('skirtW'), skirtDrop: num('skirtDrop'),
      dripSpread: num('dripSpread'), dripLen: num('dripLen'), gooW: num('gooW'), gooH: num('gooH') };
    /* ★★ 两个锚点,别混:
         meltT  = 遮罩切线 + 融化水滴(ax, ay)
         skirtT = 裙摆自己的起始位置(skirtAx, skirtAy)
       混用一个的后果:裙摆的起始位置(237)会被当成"圆的切线",
       而圆的底在 298 —— 脸的下半会被整块切掉 61 个单位。 */
    var meltT = 'translate(' + P.ax + ' ' + P.ay + ')';
    var skirtT = 'translate(' + P.skirtAx + ' ' + P.skirtAy + ')';

    /* 融化的挖回口 + 三滴:跟 meltT */
    var goo = document.querySelector('.self-trim-goo');
    if (goo) {
      goo.setAttribute('transform', meltT);
      goo.setAttribute('d', 'M' + (-P.gooW / 2) + ' 0h' + P.gooW + 'v' + P.gooH + 'h-' + P.gooW + 'z');
    }
    var melt = document.querySelector('.self-melt');
    if (melt) {
      var g = melt.querySelector('g[transform]');
      if (g) {
        g.setAttribute('transform', meltT);
        var ps = dripPaths(P);
        var paths = g.querySelectorAll('.self-melt__drip');
        for (var i = 0; i < paths.length && i < ps.length; i++) paths[i].setAttribute('d', ps[i]);
      }
    }
    /* 遮罩切线(黑区):也跟 meltT —— 它管的是"圆的哪儿被收掉",和裙摆起始位置无关 */
    document.querySelectorAll('#selfTrimMelt > path:nth-child(2), #selfTrimClear > path:nth-child(2)').forEach(function (n) {
      n.setAttribute('d', 'M0 ' + P.ay + 'h360v' + Math.max(0, 360 - P.ay) + 'H0z');
    });

    /* 裙摆(面板上那一块 + 遮罩里的挖回口):跟 skirtT */
    var sk = document.querySelector('.self-ghost-path');
    if (sk) { sk.setAttribute('transform', skirtT); sk.setAttribute('d', skirtPath(P)); }
    var skm = document.querySelector('#selfTrimClear path[transform]');
    if (skm) { skm.setAttribute('transform', skirtT); skm.setAttribute('d', skirtPath(P)); }
  }
  window.__selfSkinApply = apply;
  apply();

  /* ============================================================
     微调面板
     ============================================================ */

  /* ★ 精确判断某个查询参数存在(不再用 indexOf 子串匹配)。
     教训:原来写 location.search.indexOf("tune") >= 0,
     于是 "?selftune" 里因为含有 "tune",把太阳系那块面板也一起打开了,
     两块面板又都在右上角,互相覆盖。 */
  function hasFlag(name) {
    var q = location.search.replace(/^\?/, "").split("&");
    for (var i = 0; i < q.length; i++) {
      if (q[i] === name || q[i].indexOf(name + "=") === 0) return true;
    }
    return false;
  }
  var WANT = hasFlag("selftune");
  var FIELDS = [
    /* ---- 裙摆(clear):锚点 + 形状 ---- */
    { k: 'skirtAx', label: '裙摆锚点 x', min: 60, max: 300, step: 0.5 },
    { k: 'skirtAy', label: '裙摆锚点 y', min: 180, max: 330, step: 0.5 },
    { k: 'skirtW', label: '裙摆宽', min: 0.05, max: 1.6, step: 0.01 },
    { k: 'skirtDrop', label: '裙摆长', min: 0.3, max: 2.5, step: 0.01 },
    /* ---- 融化(melt):切线锚点 + 水滴 + 挖回口 ---- */
    { k: 'ax', label: '切线锚点 x', min: 60, max: 300, step: 0.5 },
    { k: 'ay', label: '切线锚点 y', min: 180, max: 330, step: 0.5 },
    { k: 'dripSpread', label: '水滴间距', min: 0.3, max: 2.5, step: 0.01 },
    { k: 'dripLen', label: '水滴长', min: 0.3, max: 2.5, step: 0.01 },
    { k: 'gooW', label: '挖回口宽', min: 30, max: 200, step: 1 },
    { k: 'gooH', label: '挖回口高', min: 10, max: 120, step: 1 }
  ];
  var panel = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function build() {
    var p = el('div', 'self-tune');
    var head = el('div', 'self-tune__head',
      '<b>脸下半部分微调</b><span>拖动即生效 · Alt+S 关闭</span>');
    var copyBtn = el('button', 'self-tune__btn', '复制参数');
    var resetBtn = el('button', 'self-tune__btn', '复位');
    head.appendChild(copyBtn);
    head.appendChild(resetBtn);
    p.appendChild(head);

    var out = el('textarea', 'self-tune__out');
    out.readOnly = true;
    out.rows = 10;

    FIELDS.forEach(function (d) {
      var box = el('label', 'self-tune__row');
      box.appendChild(el('i', null, d.label));
      var cur = num(d.k);
      var range = document.createElement('input');
      range.type = 'range'; range.min = d.min; range.max = d.max; range.step = d.step; range.value = String(cur);
      var nb = document.createElement('input');
      nb.type = 'number'; nb.min = d.min; nb.max = d.max; nb.step = d.step; nb.value = fmt(cur);
      function push(v) {
        v = Math.min(d.max, Math.max(d.min, v));
        TUNE[d.k] = v;
        range.value = String(v); nb.value = fmt(v);
        apply(); render();
      }
      range.addEventListener('input', function () { push(parseFloat(range.value)); });
      nb.addEventListener('input', function () { var v = parseFloat(nb.value); if (isFinite(v)) push(v); });
      box.appendChild(range);
      box.appendChild(nb);
      p.appendChild(box);
    });

    p.appendChild(out);
    document.body.appendChild(p);

    function render() {
      out.value =
        '# 贴回 layouts/partials/pages/self.html 与 assets/js/page-self-tune.js 的 DEF\n' +
        FIELDS.map(function (d) { return d.k + ' = ' + fmt(num(d.k)); }).join('\n') +
        '\n\n# 对应的锚点 transform(直接替换 SVG 里那个 translate 即可)\n' +
        'translate(' + fmt(num('ax')) + ' ' + fmt(num('ay')) + ')';
    }

    copyBtn.addEventListener('click', function () {
      out.select();
      var done = function () { copyBtn.textContent = '已复制 ✓'; setTimeout(function () { copyBtn.textContent = '复制参数'; }, 1500); };
      try { navigator.clipboard.writeText(out.value).then(done, function () { document.execCommand('copy'); done(); }); }
      catch (e) { document.execCommand('copy'); done(); }
    });
    resetBtn.addEventListener('click', function () {
      for (var k in TUNE) delete TUNE[k];
      close(); open();
    });

    render();
    return p;
  }

  function open() {
    if (panel) return;
    panel = build();
    console.log('[self-tune] 面板已打开(Alt+S 关闭);当前值在 window.__selfSkinTune');
  }
  function close() { if (panel) { panel.remove(); panel = null; } }
  function toggle() { panel ? close() : open(); }

  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); toggle(); }
    else if (e.key === 'Escape' && panel) close();
  });

  if (WANT) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open);
    else open();
  }
  window.__selfSkinTunePanel = { open: open, close: close, toggle: toggle };
})();
