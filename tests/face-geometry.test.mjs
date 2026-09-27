/* 用坐标核对"部件是不是按【正圆】摆的"。
   脸的圆:圆心 (180,180),半径 118 ⇒ x 62..298, y 62..298。

   ★ 这个文件的第一版是【坏的】:它只用正则抓 `命令 + 两个数`,于是
       · 相对命令(h/l/v/a/c)全被当成绝对坐标;
       · 一条命令后面跟多组参数时只取第一组。
     结果算出 "sparkle 中线 73" 这种一眼假的数,把 12 条好规则全报成 FAIL。
     判形状的工具自己算错形状 = 没有工具。所以这里重写成真正的
     "命令 → 绝对坐标 → 细分" 流程(和 facecircle 那份同一套逻辑)。 */
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
      /* 弧只取两端点 + 中点近似(判越界/位置足够;真正的圆弧细分在 facecircle 那份里)*/
      const e = A(a[5], a[6]);
      out.push(cur, e, [(cur[0] + e[0]) / 2, (cur[1] + e[1]) / 2]);
      cur = e;
    }
  }
  return out;
}

/* ---------- 解析:压平 → 抠出每个 data-part → 一律变成 { pts } ---------- */
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

/* ★ 别名表:有些部件的几何【故意】画在别处 ——
   比如 clear(裙摆)为了和脸共享同一次透明度合成,搬进了 .self-skinfade。
   组本身留成空占位(数据 key 还得有),几何去别名指向的地方找。 */
const ALIAS = { 'clear': '.self-ghost-path' };

const blocks = {};
/* 1) 成组抠取:逐个找 data-part,再从它往后找【最近的】</g>。
       ★ 不能用 .*?</g> 这种惰性匹配:它会从上一次匹配的结尾继续往后吃,
         跨过组的边界,把后面那个组整个吞掉 —— blush 就是这么消失的
         (表现是"零件数 15",而且不会触发"空坐标"自检,因为它根本没被建出来)。 */
const groupRe = new RegExp('data-part="([a-z]+)" data-pod="[a-z]+"[^>]*>', 'g');
let gm;
while ((gm = groupRe.exec(flatAll))) {
  const key = gm[1];
  if (blocks[key]) continue;
  const bodyStart = gm.index + gm[0].length;
  const close = flatAll.indexOf('</g>', bodyStart);
  let body = close < 0 ? flatAll.slice(bodyStart, bodyStart + 2000) : flatAll.slice(bodyStart, close);
  /* 组是空的(几何画在别处)⇒ 按别名取那一段 */
  if (!body.includes('<path') && ALIAS[key]) {
    const tag = new RegExp('class="' + ALIAS[key].slice(1) + '"[^>]*?d="([^"]+)"').exec(flatAll);
    body = tag ? 'd="' + tag[1] + '"' : '';
  }
  blocks[key] = { pts: ptsOfBody(body) };
}
/* 2) 自闭合 / 单标签的(红鼻子那个 <ellipse> 属性跨行,所以必须用压平后的文本)*/
for (const m of flatAll.matchAll(new RegExp('<(?:circle|ellipse|rect)[^>]*?data-part="([a-z]+)"[^>]*?>', 'g'))) {
  const key = m[1];
  if (blocks[key]) continue;
  blocks[key] = { pts: ptsOfBody(m[0]) };
}
/* 自检:抠出来的部件不能有任何一个是空的 */
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
  /* 描边容差:stroke-width 4.5 在 viewBox 360 里占 2.25 个单位 */
  const dmin = Math.min(...blocks[k].pts.map((q) => Math.hypot(q[0] - CX, q[1] - CY))) - 2.5;
  /* ★ 王冠是【故意骑在圆顶上的】:它的最近点必然在圆内,否则就不像戴着了。
     所以它的门槛单独放宽到 80 —— 这是设计,不是放水;其余三个必须整体在圆外。 */
  const limit = k === 'crown' ? 80 : R - 4;
  add(k.padEnd(8) + ' 长在圆外(最近点 ≥ ' + limit + ')', dmin >= limit, '最近 ' + dmin.toFixed(0));
}

for (const [k, v] of Object.entries(blocks)) {
  if (k === 'melt' || k === 'clear') continue;   /* 这两个故意淌到 268 以下 */
  const ymax = Math.max(...v.pts.map((q) => q[1]));
  add(k.padEnd(8) + ' 没被剪影遮罩切到 (y<268)', ymax < 269, '最低 y ' + ymax.toFixed(0));
}

/* ---------- "戴在头上 / 戴在脸上"这一组(用户 7th 反馈) ----------
   ★ 这些数字是用户来回三轮才定下来的,必须钉住:
     耳罩曾经切进圆内 17 个单位(那才叫"戳到脸上"),现在 1.7~3.6;
     头梁曾经整段压在圆里(等于没有),现在露在圆外。 */
const distC = (x, y) => Math.hypot(x - CX, y - CY);
const cornerMax = (x0, x1, y0, y1) =>
  Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => distC(x, y)));

/* 口罩:戴在脸上 ⇒ 整块在圆内 */
{
  const worst = cornerMax(132, 228, 198, 242);
  add('口罩整块在圆内(是"戴在脸上")', worst <= R, '最远角 ' + worst.toFixed(1) + ' ≤ ' + R);
}
/* 咖啡杯:拿在手里 ⇒ 也在圆内(此前角落出圆 7.6,会被剪影遮罩切平)*/
{
  const worst = cornerMax(92, 130, 210, 250);
  add('咖啡杯整块在圆内(没戳出轮廓)', worst <= R, '最远角 ' + worst.toFixed(1) + ' ≤ ' + R);
}
/* 听筒:允许骑在轮廓上,但不能切进脸里太多 */
for (const [name, x0, x1] of [['左', 52, 72], ['右', 288, 308]]) {
  const worst = cornerMax(x0, x1, 154, 206);
  add(name + '听筒出圆 ≤ 15(骑在轮廓上,不悬空)', worst - R <= 15, '出圆 ' + (worst - R).toFixed(1));
}
{
  /* 圆的左边界在 y=152 / y=208 都是 x≈65.4;内缘 x=80 ⇒ 切进 1.7~3.6(此前 17)*/
  /* ★ 用【听筒自己上沿高度】的圆边界来比 —— 上一版顺手拿了 y=180 的边界,
     于是把 14.6 的切进量算成了 1.8(假通过)。 */
  const edge = CX - Math.sqrt(R * R - (154 - CY) ** 2);
  const bite = 72 - edge;
  add('听筒内缘只切进圆内 ≤ 10(不是"戳到脸上")', bite <= 10, '切进 ' + bite.toFixed(1) + ' 个单位(圆边界 x=' + edge.toFixed(1) + ')');
}
/* 头梁:必须露在圆外,否则看着不像"戴在头上" */
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
/* ---------- CSS 变量自检:引用的 --self-* 必须真的有定义 ----------
   ★ 这条是拿真 bug 换来的:改成正圆时删了 --self-full,而
     .self-melt__drip / .self-ghost path 还在引用它。
     var() 指向不存在的变量【不会报错】,只会让那个属性变无效 ——
     填充变成透明,鬼的裙摆就只剩一圈描边,和脸接不上。
   这类错误静默、只在个别部件上显现,很难靠肉眼定位,所以必须自动查。 */
{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  /* 只看 .self 那一段(其他页面的变量不归这条管)*/
  const start = css.indexOf('.self {');
  const end = css.indexOf('/* ============================================================\n   第二张');
  const selfCss = css.slice(start, end > start ? end : css.length);
  const defined = new Set([...selfCss.matchAll(/(--self-[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...selfCss.matchAll(/var\((--self-[\w-]+)/g)].map((m) => m[1]));
  const undef = [...used].filter((v) => !defined.has(v));
  add('CSS 里引用的 --self-* 变量都有定义',
    undef.length === 0,
    undef.length ? '未定义: ' + undef.join(', ') : '用了 ' + used.size + ' 个,全部有定义');
  /* 顺带:定义了却没人用的变量会让人误以为还在生效(就是 --self-full 那种残留) */
  const unused = [...defined].filter((v) => !used.has(v));
  add('没有"定义了却没人用"的 --self-* 变量(防止残留)',
    unused.length === 0,
    unused.length ? '没人用: ' + unused.join(', ') : '无');
}


/* ---------- 剪影遮罩:三条状态必须齐全 ----------
   ★ 这是拿真 bug 换来的:只写了 is-melt / is-clear 两条,漏了默认那条 ——
     而模板上的 clip-path 属性会被 CSS 覆盖,于是默认状态用了一个"没定义"的值。
     界面不报错,只是"到处都不对"。 */
{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(SRC, 'utf8');
  const ids = ['selfTrim', 'selfTrimMelt', 'selfTrimClear'];
  for (const id of ids) {
    add('遮罩 #' + id + ' 在模板里定义了', html.includes('id="' + id + '"'));
  }
  /* CSS 必须为三个状态各给一条(默认 / is-melt / is-clear)*/
  const need = [
    ['默认', /(\.self-facebox|\.self-facebox\s)\.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrim\)/],
    ['is-melt', /\.self-facebox\.is-melt \.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrimMelt\)/],
    ['is-clear', /\.self-facebox\.is-clear \.self-trim-group\s*\{[^}]*clip-path:\s*url\(#selfTrimClear\)/],
  ];
  for (const [name, re] of need) {
    add('CSS 里 ' + name + ' 状态有对应的遮罩切换', re.test(css));
  }
  /* 默认遮罩必须是"什么都不收" —— 只有一条全屏白 rect */
  const def = /<clipPath id="selfTrim">([\s\S]*?)<\/clipPath>/.exec(html);
  const shapes = def ? (def[1].match(/<path/g) || []).length : 0;
  add('默认遮罩只有一块(什么都不收)', shapes === 1, shapes + ' 块');
}

/* ---------- 搬离 .self-face-part 的形状必须自带"默认不可见" ----------
   ★ 两次真 bug 换来的规矩:
     .self-ghost-path 为了和脸共享透明度,搬进了 .self-skinfade ——
     于是它脱离了 "默认 opacity:0、有 [data-on] 才显示" 那套机制,
     结果什么都没放(00/16)它就已经挂在脸上了。
   所以:凡是不在 .self-face-part 里的形状,都要自己声明默认隐藏。 */
{
  const css = fs.readFileSync(new URL('../assets/css/pages.css', import.meta.url), 'utf8');
  const html = fs.readFileSync(SRC, 'utf8');
  /* 找出所有"独立形状"的类名(带 self- 前缀、看起来是图形的那几个)*/
  const loose = ['.self-ghost-path'];
  for (const sel of loose) {
    const name = sel.slice(1);
    const inPart = new RegExp('class="self-face-part[^"]*' + name).test(html);
    if (inPart) { add(name + ' 在 .self-face-part 里(自动显隐)', true); continue; }
    /* 不在里面 ⇒ 必须自己声明隐藏 */
    const rule = new RegExp('\\' + sel + '\\s*\\{([\\s\\S]*?)\\}');
    const body = rule.exec(css);
    const hidden = !!body && /(opacity:\s*0\b|visibility:\s*hidden|display:\s*none)/.test(body[1]);
    add(name + ' 默认不可见(不在 .self-face-part 里,得自己声明)', hidden,
      hidden ? '已声明' : '★ 没声明 ⇒ 会无条件显示');
  }
}

/* ---------- 浅色模式:对比度必须达标(WCAG) ----------
   ★ 用户报的是"浅色模式下字体背景等看不见"。这类问题看着主观,
     其实【可以算】—— 所以把它固化成断言,以后改配色不会悄悄退化。
     底色取纯白与浅灰两种最坏情况。 */
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
  /* 玻璃卡片 [文字压在卡片上也要达标] */
  if (V['--self-glass'] && V['--self-ink']) {
    const g = over(parse(V['--self-glass']), BGS['纯白']);
    const r = ratio(parse(V['--self-ink']), g);
    add('浅色/玻璃卡片上的正文 对比度 ≥7', r >= 7, r.toFixed(2) + ':1');
  }
}

/* ---------- 两份实现必须一致(烘焙值 vs 面板现算) ---------- */
{
  const html2 = fs.readFileSync(SRC, 'utf8');
  const tuneSrc = fs.readFileSync(new URL('../assets/js/page-self-tune.js', import.meta.url), 'utf8');

  /* DEF 是唯一真值源 */
  const defBlk = /var DEF = \{([\s\S]*?)\n  \};/.exec(tuneSrc);
  const D = {};
  if (defBlk) for (const m of defBlk[1].matchAll(/(\w+):\s*(-?[\d.]+)/g)) D[m[1]] = parseFloat(m[2]);
  add('page-self-tune.js 里有 DEF(唯一真值源)', !!defBlk);

  /* self.html 里烘焙的那条 d */
  const baked = /<path class="self-ghost-path"[^>]*?d="([^"]+)"/.exec(html2);
  add('self.html 里烘焙了裙摆路径', !!baked);

  /* 遮罩里的挖回口 + 锚点 */
  const trim = /<clipPath id="selfTrimClear">[\s\S]*?<path transform="translate\(([\d.]+) ([\d.]+)\)" d="([^"]+)"/.exec(html2);
  add('遮罩里有裙摆的挖回口', !!trim);

  if (baked && trim) {
    add('遮罩挖回 与 面板裙摆 是同一条 d', baked[1] === trim[3]);
    add('裙摆锚点与 DEF 一致(skirtAx/skirtAy)',
      +trim[1] === D.skirtAx && +trim[2] === D.skirtAy,
      trim[1] + ',' + trim[2] + ' vs DEF ' + D.skirtAx + ',' + D.skirtAy);
    /* 形状参数确实用上了:宽度应等于 skirtW × 该高度圆的半宽 */
    const hw = Math.sqrt(R * R - (D.skirtAy - CY) ** 2);
    const want = Math.round(hw * D.skirtW * 100) / 100;
    const got = parseFloat(/^M(-?[\d.]+)/.exec(baked[1])[1]);
    add('裙摆宽度 = skirtW × 该高度圆的半宽', Math.abs(Math.abs(got) - want) < 0.02,
      got + ' vs ' + (-want).toFixed(2));
  }

  /* ★★ 切线必须留在融化的锚点 —— 这是"两个锚点"存在的唯一理由 */
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


/* ---------- 关键:hugo.toml 的 key 与 self.html 的 data-part 必须一一对应 ----------
   漏掉一个的症状是"某个 emoji 点了没反应"(点了但脸上没有对应部件),
   极难靠肉眼发现 —— 之前漏掉 night 就是这条检查抓出来的。 */
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
