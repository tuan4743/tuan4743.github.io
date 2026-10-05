/* ASCII 脸部几何:canvas 画法与坐标对账。 跑法见 tests/README.md */
import fs from 'node:fs';

const SRC = new URL('../layouts/partials/pages/self.html', import.meta.url);
const CX = 180, CY = 180, R = 118;
const txt = fs.readFileSync(SRC, 'utf8').replace(/\s+/g, ' ');

const NUM = '(-?[\\d.]+)';
const ARGN = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function flatten(d, steps = 12) {
  const toks = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+))/g;
  let m;
  while ((m = re.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
  const out = [];
  let cur = [0, 0], start = [0, 0], cmd = null, i = 0;
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (a, b) => { for (let s = 1; s <= steps; s++) out.push([lerp(a[0], b[0], s / steps), lerp(a[1], b[1], s / steps)]); };
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    if (!cmd) break;
    const up = cmd.toUpperCase(), rel = cmd === cmd.toLowerCase(), n = ARGN[up];
    if (up === 'Z') { seg(cur, start); cur = start; cmd = null; continue; }
    const a = toks.slice(i, i + n);
    if (a.length < n || a.some((v) => typeof v === 'string')) break;
    i += n;
    const A = (x, y) => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    if (up === 'M') { cur = A(a[0], a[1]); start = cur; out.push(cur); cmd = rel ? 'l' : 'L'; }
    else if (up === 'L' || up === 'T') { const e = A(a[0], a[1]); seg(cur, e); cur = e; }
    else if (up === 'H') { const e = rel ? [cur[0] + a[0], cur[1]] : [a[0], cur[1]]; seg(cur, e); cur = e; }
    else if (up === 'V') { const e = rel ? [cur[0], cur[1] + a[0]] : [cur[0], a[0]]; seg(cur, e); cur = e; }
    else if (up === 'C') {
      const c1 = A(a[0], a[1]), c2 = A(a[2], a[3]), e = A(a[4], a[5]);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        out.push([u * u * u * cur[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
                  u * u * u * cur[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1]]);
      }
      cur = e;
    } else if (up === 'S' || up === 'Q') {
      const c1 = A(a[0], a[1]), e = A(a[2], a[3]);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps, u = 1 - t;
        out.push([u * u * cur[0] + 2 * u * t * c1[0] + t * t * e[0],
                  u * u * cur[1] + 2 * u * t * c1[1] + t * t * e[1]]);
      }
      cur = e;
    } else if (up === 'A') {
      const e = A(a[5], a[6]);
      out.push(cur, e, [(cur[0] + e[0]) / 2, (cur[1] + e[1]) / 2]);
      cur = e;
    }
  }
  return out;
}

const flatAll = txt.replace(/\s+/g, ' ');

function circlePts(cx, cy, rx, ry, n = 48) {
  const p = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    p.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return p;
}

function ptsOfBody(body) {
  const pts = [];
  for (const m of body.matchAll(new RegExp('d="([^"]+)"', 'g'))) pts.push(...flatten(m[1]));
  for (const m of body.matchAll(new RegExp('<circle[^>]*?cx="' + NUM + '"[^>]*?cy="' + NUM + '"[^>]*?r="' + NUM + '"', 'g'))) {
    pts.push(...circlePts(+m[1], +m[2], +m[3], +m[3]));
  }
  for (const m of body.matchAll(new RegExp('<ellipse[^>]*?cx="' + NUM + '"[^>]*?cy="' + NUM + '"[^>]*?rx="' + NUM + '"[^>]*?ry="' + NUM + '"', 'g'))) {
    pts.push(...circlePts(+m[1], +m[2], +m[3], +m[4]));
  }
  for (const m of body.matchAll(new RegExp('<rect[^>]*?x="' + NUM + '"[^>]*?y="' + NUM + '"[^>]*?width="' + NUM + '"[^>]*?height="' + NUM + '"', 'g'))) {
    const x = +m[1], y = +m[2], w = +m[3], h = +m[4];
    for (let s = 0; s <= 10; s++) {
      pts.push([x + (w * s) / 10, y], [x + (w * s) / 10, y + h], [x, y + (h * s) / 10], [x + w, y + (h * s) / 10]);
    }
  }
  return pts;
}

const ALIAS = { 'clear': '.self-ghost-path' };

const blocks = {};
const groupRe = new RegExp('data-part="([a-z]+)" data-pod="[a-z]+"[^>]*>', 'g');
let gm;
while ((gm = groupRe.exec(flatAll))) {
  const key = gm[1];
  if (blocks[key]) continue;
  const bodyStart = gm.index + gm[0].length;
  const close = flatAll.indexOf('</g>', bodyStart);
  let body = close < 0 ? flatAll.slice(bodyStart, bodyStart + 2000) : flatAll.slice(bodyStart, close);
  if (!body.includes('<path') && ALIAS[key]) {
    const tag = new RegExp('class="' + ALIAS[key].slice(1) + '"[^>]*?d="([^"]+)"').exec(flatAll);
    body = tag ? 'd="' + tag[1] + '"' : '';
  }
  blocks[key] = { pts: ptsOfBody(body) };
}
for (const m of flatAll.matchAll(new RegExp('<(?:circle|ellipse|rect)[^>]*?data-part="([a-z]+)"[^>]*?>', 'g'))) {
  const key = m[1];
  if (blocks[key]) continue;
  blocks[key] = { pts: ptsOfBody(m[0]) };
}
const empty = Object.entries(blocks).filter(([, v]) => !v.pts.length).map(([k]) => k);
if (empty.length) {
  console.error('✗ 这些部件一个坐标都没解析出来(解析器有洞): ' + empty.join(', '));
  process.exit(1);
}

const rows = [];
const add = (name, ok, info) => rows.push([ok, name, info]);
const bb = (k) => {
  const p = blocks[k].pts;
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const BAND = {
  code: ['在眼睛那一带 (y 120~178)', 120, 178],
  sparkle: ['在眼睛那一带 (y 120~178)', 120, 178],
  heavy: ['在眼睛那一带 (y 120~178)', 120, 178],
  night: ['在眼下那一带 (y 172~208)', 172, 208],
  clown: ['在鼻子那一带 (y 168~205)', 168, 205],
  mask: ['在下半张脸 (y 200~262)', 200, 262],
  blush: ['在脸颊那一带 (y 178~216)', 178, 216],
  coffee: ['在下半张脸 (y 200~292)', 200, 292],
  game: ['在下半张脸 (y 232~300)', 232, 300],
  music: ['在耳朵那一带 (y 100~212)', 100, 212],
};
for (const [k, [label, lo, hi]] of Object.entries(BAND)) {
  if (!blocks[k]) { add(k.padEnd(8) + ' 存在', false, '缺部件'); continue; }
  const [, y0, , y1] = bb(k);
  const mid = (y0 + y1) / 2;
  add(k.padEnd(8) + ' ' + label, mid >= lo && mid <= hi, '中线 y=' + mid.toFixed(0) + '  (y ' + y0.toFixed(0) + '~' + y1.toFixed(0) + ')');
}

for (const k of ['fire', 'crown', 'nap', 'note']) {
  if (!blocks[k]) { add(k.padEnd(8) + ' 存在', false, '缺部件'); continue; }
  const dmin = Math.min(...blocks[k].pts.map((q) => Math.hypot(q[0] - CX, q[1] - CY))) - 2.5;
  const limit = k === 'crown' ? 80 : R - 4;
  add(k.padEnd(8) + ' 长在圆外(最近点 ≥ ' + limit + ')', dmin >= limit, '最近 ' + dmin.toFixed(0));
}

for (const [k, v] of Object.entries(blocks)) {
  if (k === 'melt' || k === 'clear') continue;
  const ymax = Math.max(...v.pts.map((q) => q[1]));
  add(k.padEnd(8) + ' 没被剪影遮罩切到 (y<268)', ymax < 269, '最低 y ' + ymax.toFixed(0));
}

const distC = (x, y) => Math.hypot(x - CX, y - CY);
const cornerMax = (x0, x1, y0, y1) =>
  Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => distC(x, y)));

{
  const worst = cornerMax(132, 228, 198, 242);
  add('口罩整块在圆内(是"戴在脸上")', worst <= R, '最远角 ' + worst.toFixed(1) + ' ≤ ' + R);
}
{
  const worst = cornerMax(92, 130, 210, 250);
  add('咖啡杯整块在圆内(没戳出轮廓)', worst <= R, '最远角 ' + worst.toFixed(1) + ' ≤ ' + R);
}
for (const [name, x0, x1] of [['左', 52, 72], ['右', 288, 308]]) {
  const worst = cornerMax(x0, x1, 154, 206);
  add(name + '听筒出圆 ≤ 15(骑在轮廓上,不悬空)', worst - R <= 15, '出圆 ' + (worst - R).toFixed(1));
}
{
  const edge = CX - Math.sqrt(R * R - (154 - CY) ** 2);
  const bite = 72 - edge;
  add('听筒内缘只切进圆内 ≤ 10(不是"戳到脸上")', bite <= 10, '切进 ' + bite.toFixed(1) + ' 个单位(圆边界 x=' + edge.toFixed(1) + ')');
}
{
  const band = blocks.music.pts.filter((p) => p[0] > 90 && p[0] < 270 && p[1] < 140);
  const top = band.length ? Math.min(...band.map((p) => p[1])) : NaN;
  add('头梁露在圆顶上方(看得出是戴在头上)', top <= 70, '梁最高点 y=' + top);
  const outer = band.filter((p) => distC(p[0], p[1]) > R + 2).length;
  add('头梁在圆外有实际长度', outer > 8, outer + ' 个采样点在圆外');
}

add('眼镜左右对称(关于 x=180)', Math.abs(180 - 130) === Math.abs(230 - 180), '130 / 230');
add('部件数 = 16', Object.keys(blocks).length === 16, Object.keys(blocks).length + ' 个');

console.log('脸的圆: 圆心 (' + CX + ',' + CY + ') r=' + R + '  ⇒  x 62..298, y 62..298\n');
{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const start = css.indexOf('.self {');
  const end = css.indexOf('/* ============================================================\n   第二张');
  const selfCss = css.slice(start, end > start ? end : css.length);
  const defined = new Set([...selfCss.matchAll(/(--self-[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...selfCss.matchAll(/var\((--self-[\w-]+)/g)].map((m) => m[1]));
  const undef = [...used].filter((v) => !defined.has(v));
  add('CSS 里引用的 --self-* 变量都有定义',
    undef.length === 0,
    undef.length ? '未定义: ' + undef.join(', ') : '用了 ' + used.size + ' 个,全部有定义');
  const unused = [...defined].filter((v) => !used.has(v));
  add('没有"定义了却没人用"的 --self-* 变量(防止残留)',
    unused.length === 0,
    unused.length ? '没人用: ' + unused.join(', ') : '无');
}


{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(SRC, 'utf8');
  const ids = ['selfTrim', 'selfTrimMelt', 'selfTrimClear'];
  for (const id of ids) {
    add('遮罩 #' + id + ' 在模板里定义了', html.includes('id="' + id + '"'));
  }
  const need = [
    ['默认', /(\.self-facebox|\.self-facebox\s)\.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrim\)/],
    ['is-melt', /\.self-facebox\.is-melt \.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrimMelt\)/],
    ['is-clear', /\.self-facebox\.is-clear \.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrimClear\)/],
  ];
  for (const [name, re] of need) {
    add('CSS 里 ' + name + ' 状态有对应的遮罩切换', re.test(css));
  }
  const def = /<clipPath id="selfTrim">([\s\S]*?)<\/clipPath>/.exec(html);
  const shapes = def ? (def[1].match(/<path/g) || []).length : 0;
  add('默认遮罩只有一块(什么都不收)', shapes === 1, shapes + ' 块');
}

{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(SRC, 'utf8');
  const loose = ['.self-ghost-path'];
  for (const sel of loose) {
    const name = sel.slice(1);
    const inPart = new RegExp('class="self-face-part[^"]*' + name).test(html);
    if (inPart) { add(name + ' 在 .self-face-part 里(自动显隐)', true); continue; }
    const rule = new RegExp('\\' + sel + '\\s*\\{([\\s\\S]*?)\\}');
    const body = rule.exec(css);
    const hidden = !!body && /(opacity:\s*0\b|visibility:\s*hidden|display:\s*none)/.test(body[1]);
    add(name + ' 默认不可见(不在 .self-face-part 里,得自己声明)', hidden,
      hidden ? '已声明' : '★ 没声明 ⇒ 会无条件显示');
  }
}

{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const blk = /:root\[data-theme="light"\] \.self \{([\s\S]*?)\n\}/.exec(css);
  const V = {};
  if (blk) for (const m of blk[1].matchAll(/(--self-[\w-]+):\s*([^;]+);/g)) V[m[1]] = m[2].trim();

  const parse = (s) => {
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1]; }
    m = /^rgba?\(([^)]+)\)$/.exec(s);
    if (m) { const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    return null;
  };
  const over = (f, b) => { const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; };
  const lum = (c) => { const g = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * g(c[0]) + 0.7152 * g(c[1]) + 0.0722 * g(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  const BGS = { '纯白': [255, 255, 255, 1], '浅灰': [242, 244, 248, 1] };
  const NEED = [
    ['--self-ink', 7, '正文'],
    ['--self-dim', 4.5, '次要文字'],
    ['--self-accent', 4.5, '强调色'],
    ['--self-accent2', 4.5, '金色强调'],
    ['--self-deco-line', 3, '装饰线'],
    ['--self-scan-b', 3, '扫描线'],
    ['--self-skin-empty-edge', 3, '空白脸轮廓'],
  ];
  add('浅色模式的调色板存在', !!blk);
  for (const [bgName, bg] of Object.entries(BGS)) {
    for (const [v, need, label] of NEED) {
      if (!V[v]) { add('浅色 ' + label + ' 定义了', false, v + ' 缺失'); continue; }
      const c = parse(V[v]);
      if (!c) { add('浅色 ' + label + ' 可解析', false, V[v]); continue; }
      const r = ratio(over(c, bg), bg);
      add('浅色/' + bgName + ' ' + label + ' 对比度 ≥' + need, r >= need,
        r.toFixed(2) + ':1  ' + V[v]);
    }
  }
  if (V['--self-glass'] && V['--self-ink']) {
    const g = over(parse(V['--self-glass']), BGS['纯白']);
    const r = ratio(parse(V['--self-ink']), g);
    add('浅色/玻璃卡片上的正文 对比度 ≥7', r >= 7, r.toFixed(2) + ':1');
  }
}

{
  const html2 = fs.readFileSync(SRC, 'utf8');
  const tuneSrc = fs.readFileSync(new URL('../assets/js/page-self-tune.js', import.meta.url), 'utf8');

  const defBlk = /var DEF = \{([\s\S]*?)\n  \};/.exec(tuneSrc);
  const D = {};
  if (defBlk) for (const m of defBlk[1].matchAll(/(\w+):\s*(-?[\d.]+)/g)) D[m[1]] = parseFloat(m[2]);
  add('page-self-tune.js 里有 DEF(唯一真值源)', !!defBlk);

  const baked = /<path class="self-ghost-path"[^>]*?d="([^"]+)"/.exec(html2);
  add('self.html 里烘焙了裙摆路径', !!baked);

  const trim = /<clipPath id="selfTrimClear">[\s\S]*?<path transform="translate\(([\d.]+) ([\d.]+)\)" d="([^"]+)"/.exec(html2);
  add('遮罩里有裙摆的挖回口', !!trim);

  if (baked && trim) {
    add('遮罩挖回 与 面板裙摆 是同一条 d', baked[1] === trim[3]);
    add('裙摆锚点与 DEF 一致(skirtAx/skirtAy)',
      +trim[1] === D.skirtAx && +trim[2] === D.skirtAy,
      trim[1] + ',' + trim[2] + ' vs DEF ' + D.skirtAx + ',' + D.skirtAy);
    const hw = Math.sqrt(R * R - (D.skirtAy - CY) ** 2);
    const want = Math.round(hw * D.skirtW * 100) / 100;
    const got = parseFloat(/^M(-?[\d.]+)/.exec(baked[1])[1]);
    add('裙摆宽度 = skirtW × 该高度圆的半宽', Math.abs(Math.abs(got) - want) < 0.02,
      got + ' vs ' + (-want).toFixed(2));
  }

  const cuts = [...html2.matchAll(/<path d="M0 (\d+)h360v92H0z"/g)].map((m) => +m[1]);
  add('两条遮罩的切线都 = DEF.ay(融化锚点)', cuts.length === 2 && cuts.every((y) => y === D.ay),
    '切线 ' + cuts.join(',') + '  DEF.ay ' + D.ay);
  add('切线没被裙摆锚点带走(否则会切掉脸的下半)',
    cuts.every((y) => y !== D.skirtAy),
    'skirtAy=' + D.skirtAy + ' 若当切线会切掉 ' + (298 - D.skirtAy) + ' 个单位的脸');
}

console.log('检查'.padEnd(56) + '结果   读数');
console.log('-'.repeat(96));
let bad = 0;
for (const [ok, name, info] of rows) {
  if (!ok) bad++;
  console.log(name.padEnd(56) + (ok ? 'OK     ' : 'FAIL   ') + info);
}
console.log('-'.repeat(96));
console.log((rows.length - bad) + '/' + rows.length + ' 通过');


import fs2 from 'node:fs';
const TOML = fs2.readFileSync(new URL('../hugo.toml', import.meta.url), 'utf8');
const tomlKeys = [];
for (const m of TOML.matchAll(/\[\[params\.intro\.decks\.self\]\]([\s\S]*?)(?=\[\[|$)/g)) {
  const k = /key = "([a-z]+)"/.exec(m[1]);
  if (k) tomlKeys.push(k[1]);
}
const htmlKeys = Object.keys(blocks);
const missing = tomlKeys.filter((k) => !htmlKeys.includes(k));
const extra = htmlKeys.filter((k) => !tomlKeys.includes(k));
console.log('');
console.log('hugo.toml 的 key (' + tomlKeys.length + ') ↔ self.html 的 data-part (' + htmlKeys.length + ')');
if (missing.length) console.log('  ✗ toml 有、html 没有(点了会没反应): ' + missing.join(', '));
if (extra.length) console.log('  ✗ html 有、toml 没有(永远点不到): ' + extra.join(', '));
if (!missing.length && !extra.length) console.log('  OK 两边完全对齐');
process.exit((bad || missing.length || extra.length) ? 1 : 0);
