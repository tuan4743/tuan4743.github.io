/* 第五张盘霜窗/碎片/星图行为验收(真执行 page-frost.js + 最小假 DOM)。 跑法见 tests/README.md */
import fs from 'node:fs';

let capture = null;
const CTXES = [];

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parentNode = null;
    this._cls = new Set();
    this._lis = new Map();
    this._pe = null;         /* ★ 默认必须是"没声明",不是 'auto' ——
                                pointer-events 是继承属性,默认值会让继承断掉:
                                碎片化开可点(内联 auto)、没化时不可点(继承 .frost-shards 的 none)
                                全靠这条继承链。第一版默认 'auto',于是"霜还没化就能点开"。 */
    this._text = '';
    this.hidden = false;
    this._isHidden = false;
    this.style = {
      _m: new Map(),
      setProperty(k, v) { this._m.set(k, String(v)); },
      getPropertyValue(k) { return this._m.get(k) || ''; },
      removeProperty(k) { const v = this._m.get(k) || ''; this._m.delete(k); return v; },
    };
    this.classList = {
      add: (...n) => n.forEach((x) => this._cls.add(x)),
      remove: (...n) => n.forEach((x) => this._cls.delete(x)),
      contains: (n) => this._cls.has(n),
      toggle: (n, f) => { const on = f === undefined ? !this._cls.has(n) : !!f; on ? this._cls.add(n) : this._cls.delete(n); return on; },
    };
    this._rect = { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };
    this.offsetWidth = 200; this.offsetHeight = 44;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get width() { return this._w || 0; }
  set width(v) { this._w = v; if (this._ctx) this._ctx.calls.rects.length = 0; }
  get height() { return this._h || 0; }
  set height(v) { this._h = v; if (this._ctx) this._ctx.calls.rects.length = 0; }
  get textContent() { return this._text || this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get hidden() { return this._isHidden; }
  set hidden(v) { this._isHidden = !!v; }
  get firstChild() { return this.children[0] || null; }
  getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
  setAttribute(n, v) { this.attrs.set(n, String(v)); }
  hasAttribute(n) { return this.attrs.has(n); }
  toggleAttribute(n, f) { if (f) this.attrs.set(n, ''); else this.attrs.delete(n); return !!f; }
  getBoundingClientRect() {
    if (this._forceRect) return Object.assign({}, this._forceRect);
    for (let n = this; n; n = n.parentNode) {
      if (n._isHidden) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    }
    const num = (k, d) => { const v = parseFloat(this.style.getPropertyValue(k)); return isNaN(v) ? d : v; };
    const lx = num('left', 0), ty = num('top', 0);
    const w = num('width', this._rect.width), h = num('height', this._rect.height);
    const ox = this._parentX || 0, oy = this._parentY || 0;
    return { left: ox + lx, top: oy + ty, width: w, height: h, right: ox + lx + w, bottom: oy + ty + h };
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  setPointerCapture(id) { void id; capture = this; }
  releasePointerCapture() { capture = null; }
  addEventListener(t, fn) { if (!this._lis.has(t)) this._lis.set(t, []); this._lis.get(t).push(fn); }
  dispatch(type, ev) {
    const target = (ev && ev.target) || this;
    const e = Object.assign({ type, target, preventDefault() { } }, ev, { target });
    (this._lis.get(type) || []).forEach((fn) => fn(e));
    let p = this.parentNode;
    while (p) { (p._lis.get(type) || []).forEach((fn) => fn(e)); p = p.parentNode; }
    return e;
  }
  matches(sel) {
    const m = sel.match(/^([a-zA-Z0-9_-]*)((?:\.[a-zA-Z0-9_-]+)*)((?:\[[^\]]+\])*)$/);
    if (!m) return false;
    const [, tag, cls, attrs] = m;
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    if ((cls ? cls.split('.').filter(Boolean) : []).some((c) => !this._cls.has(c))) return false;
    for (const a of (attrs.match(/\[[^\]]+\]/g) || [])) if (!this.attrs.has(a.slice(1, -1))) return false;
    return true;
  }
  closest(sel) { let n = this; while (n) { if (n.matches(sel)) return n; n = n.parentNode; } return null; }
  _all(o) { for (const c of this.children) { o.push(c); c._all(o); } return o; }
  querySelectorAll(s) { return this._all([]).filter((e) => e.matches(s)); }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  getContext() { return this._ctx || (this._ctx = fakeCtx()); }
}

function fakeCtx() {
  const calls = { fillRect: 0, clearRect: 0, stroke: 0, drawImage: 0, putImageData: 0, rects: [], gradients: 0, grads: [] };
  const ctx = {
    calls,
    setTransform() { },
    clearRect() { calls.clearRect++; calls.rects.length = 0; },
    fillRect(x, y, w, h) { calls.fillRect++; if (calls.rects.length < 20000) calls.rects.push([x, y, w, h, this._f]); },
    beginPath() { }, moveTo() { }, lineTo() { }, stroke() { calls.stroke++; },
    drawImage() { calls.drawImage++; },
    createLinearGradient(x0, y0, x1, y1) {
      calls.gradients++;
      const stops = [];
      const g = {
        stops,
        addColorStop(p, c) { stops.push([p, c]); },
        _x0: x0, _y0: y0, _x1: x1, _y1: y1,
        toString() { return 'gradient(' + stops.map((s) => s[1]).join('→') + ')'; },
      };
      calls.grads.push(g);
      return g;
    },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() { calls.putImageData++; },
    set fillStyle(v) { this._f = v; }, get fillStyle() { return this._f; },
    set strokeStyle(v) { this._s = v; }, get strokeStyle() { return this._s; },
    lineWidth: 1, lineCap: 'butt', globalAlpha: 1,
    globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
  };
  CTXES.push(ctx);
  return ctx;
}

const LINES = 9;
const root = new El('div'); root.setAttribute('data-frost', 'future');
root._rect = { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };

const scene = root.appendChild(new El('div')); scene.className = 'frost-scene';
const sky = scene.appendChild(new El('canvas')); sky.className = 'frost-sky'; sky.setAttribute('data-frost-sky', '');
const aur = scene.appendChild(new El('canvas')); aur.className = 'frost-aurora'; aur.setAttribute('data-frost-aurora', '');
const snow = scene.appendChild(new El('canvas')); snow.className = 'frost-snow'; snow.setAttribute('data-frost-snow', '');

const layer = root.appendChild(new El('div')); layer.className = 'frost-shards'; layer.setAttribute('data-frost-shards', '');
layer._rect = { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };
const shards = [];
for (let i = 0; i < LINES; i++) {
  const b = layer.appendChild(new El('button'));
  b.className = 'frost-shard';
  b.setAttribute('data-frost-shard', String(i));
  b.setAttribute('data-theme', ['好奇', '创造', '生活'][i % 3]);
  const t = b.appendChild(new El('span')); t.className = 'frost-shard__text';
  t.textContent = '第' + i + '句:愿未来的你,依然对世界好奇。';
  shards.push(b);
}
const cv = root.appendChild(new El('canvas')); cv.className = 'frost-ice'; cv.setAttribute('data-frost-cv', '');
const mainCtx = cv.getContext();
const glints = root.appendChild(new El('div')); glints.className = 'frost-glints'; glints.setAttribute('data-frost-glints', '');
const mapEl = root.appendChild(new El('div')); mapEl.className = 'frost-map'; mapEl.setAttribute('data-frost-map', '');
const head = root.appendChild(new El('div')); head.className = 'frost-head';
head._rect = { left: 0, top: 0, width: 420, height: 120, right: 420, bottom: 120 };
const hint = root.appendChild(new El('p')); hint.className = 'frost-hint'; hint.setAttribute('data-frost-hint', '');
hint._rect = { left: 0, top: 0, width: 300, height: 34, right: 300, bottom: 34 };
hint.style.setProperty('top', '560px');
const countEl = root.appendChild(new El('p')); countEl.className = 'frost-count'; countEl.setAttribute('data-frost-count', '');
const readEl = root.appendChild(new El('div')); readEl.className = 'frost-read'; readEl.setAttribute('data-frost-read', ''); readEl.hidden = true;
const readCard = readEl.appendChild(new El('button')); readCard.className = 'frost-read__card'; readCard.setAttribute('data-frost-readcard', '');
const readMark = readCard.appendChild(new El('span')); readMark.className = 'frost-read__mark';
readMark._rect = { left: 0, top: 0, width: 96, height: 96, right: 96, bottom: 96 };
const readSvg = readMark.appendChild(new El('svg'));
const readPoly = readSvg.appendChild(new El('polygon')); readPoly.setAttribute('points', '');
const readText = readCard.appendChild(new El('span')); readText.className = 'frost-read__text'; readText.setAttribute('data-frost-readtext', '');
const doneEl = root.appendChild(new El('div')); doneEl.className = 'frost-finale'; doneEl.setAttribute('data-frost-finale', '');
doneEl.setAttribute('aria-hidden', 'true');

const pagesCss = fs.readFileSync('./assets/css/pages.css', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
function peDecl(sel) {
  const lit = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(lit + '\\s*\\{([^}]*)\\}', 'g');
  let m, val = null;
  while ((m = re.exec(pagesCss))) {
    const d = /pointer-events\s*:\s*([a-z]+)/.exec(m[1]);
    if (d) val = d[1];
  }
  return val;
}
function peOf(sel) { return peDecl(sel) || 'auto'; }
const PE = {
  '.frost': peOf('.frost'), '.frost-scene': peOf('.frost-scene'), '.frost-shards': peOf('.frost-shards'),
  '.frost-ice': peOf('.frost-ice'), '.frost-map': peOf('.frost-map'), '.frost-glints': peOf('.frost-glints'),
  '.frost-frame': peOf('.frost-frame'), '.frost-head': peOf('.frost-head'), '.frost-hint': peOf('.frost-hint'),
  '.frost-read': peOf('.frost-read'),
};
for (const el of [root, scene, sky, aur, snow, layer, cv, glints, mapEl, head, hint, countEl, readEl, readCard, readText, doneEl, ...shards]) {
  const cls = (el.className || '').split(/\s+/).filter(Boolean)[0];
  if (!cls) continue;
  const v = peDecl('.' + cls);
  if (v) el._pe = v;
}

function peOfEl(el) {
  const inline = el.style.getPropertyValue('pointer-events');
  if (inline) return inline;
  let n = el;
  while (n) {
    if (n._pe) return n._pe;
    n = n.parentNode;
  }
  return 'auto';
}
function hitTest(el, x, y) {
  for (let i = el.children.length - 1; i >= 0; i--) {
    const c = el.children[i];
    if (c.hidden) continue;
    const r = c.getBoundingClientRect();
    if (!(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
    const deeper = hitTest(c, x, y);
    if (deeper) return deeper;
    if (peOfEl(c) !== 'none') return c;
  }
  return null;
}
function hitAt(x, y) {
  const inner = hitTest(root, x, y);
  if (inner) return inner;
  if (peOfEl(root) === 'none') return null;
  const r = root.getBoundingClientRect();
  return (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) ? root : null;
}
let downTarget = null;
function commonAncestor(a, b) {
  const chain = new Set();
  for (let n = a; n; n = n.parentNode) chain.add(n);
  for (let n = b; n; n = n.parentNode) if (chain.has(n)) return n;
  return null;
}
function pointer(type, x, y, id, ptype) {
  const target = capture || hitAt(x, y);
  if (!target) return null;
  const e = target.dispatch(type, {
    clientX: x, clientY: y, pointerId: id, pointerType: ptype || 'mouse', target,
  });
  if (type === 'pointerdown') downTarget = target;
  if (type === 'pointerup' || type === 'pointercancel') {
    if (downTarget) {
      const c = commonAncestor(downTarget, target);
      if (c) c.dispatch('click', { clientX: x, clientY: y, target: c });
    }
    downTarget = null;
    capture = null;
  }
  return e;
}
function tap(x, y, id) {
  pointer('pointerdown', x, y, id || 7, 'mouse');
  pointer('pointerup', x, y, id || 7, 'mouse');
}

const reg = {};
const docLis = new Map();
const documentShim = {
  readyState: 'complete',
  querySelector: (s) => (s === '[data-frost]' ? root : root.querySelector(s)),
  querySelectorAll: (s) => root.querySelectorAll(s),
  createElement: (t) => new El(t),
  addEventListener: (t, fn) => { if (!docLis.has(t)) docLis.set(t, []); docLis.get(t).push(fn); },
  dispatch: (t, ev) => (docLis.get(t) || []).forEach((fn) => fn(Object.assign({ type: t }, ev))),
};
let rafQ = [];
const windowShim = {
  document: documentShim, console, setTimeout, clearTimeout,
  __bootRunning: false,
  devicePixelRatio: 1,
  addEventListener() { },
  requestAnimationFrame(fn) { rafQ.push(fn); return rafQ.length; },
  CDPages: {
    register(type, buildFn) { const a = buildFn(root); if (a) { reg[type] = a; a.activate(true); } return a; },
    get: (k) => reg[k] || null,
  },
};
globalThis.window = windowShim;
globalThis.document = documentShim;
globalThis.requestAnimationFrame = windowShim.requestAnimationFrame;

const src = fs.readFileSync('./assets/js/page-frost.js', 'utf8');
try {
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', src)(
    windowShim, documentShim, setTimeout, clearTimeout, windowShim.requestAnimationFrame);
} catch (e) {
  console.log('★★ 模块装载抛错: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n    ') : e));
}

const api = reg.frost;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function frames(n = 1) {
  for (let i = 0; i < n; i++) {
    await sleep(55);
    const q = rafQ; rafQ = [];
    for (const fn of q) { try { fn(Date.now()); } catch (e) { console.log('  ! rAF 抛错: ' + e); } }
  }
}

const rows = [];
const ok = (name, pass, info) => rows.push({ name, pass: !!pass, info: info === undefined ? '' : String(info) });
const clearOf = (i) => parseFloat(shards[i].style.getPropertyValue('--clear'));
const frost = () => api.state().frost;

await sleep(60); await frames(6);

ok('模块注册成功', !!api, api ? 'ok' : '没注册');
ok('读到 ' + LINES + ' 片碎片', api.state().shards === LINES, api.state().shards + ' 片');
ok('一开始整块都是霜', frost() === 1, 'frost=' + frost());
ok('一开始碎片都压在霜底下(暗的)', shards.every((_, i) => clearOf(i) < 0.05),
  '最大 clear=' + Math.max(...shards.map((_, i) => clearOf(i))).toFixed(3));
ok('碎片都摆开了(不是全叠在 0,0)',
  new Set(shards.map((s) => s.style.getPropertyValue('left'))).size === LINES,
  new Set(shards.map((s) => s.style.getPropertyValue('left'))).size + ' 个不同 left');
ok('碎片是不规则多边形(不是方块)',
  shards.every((s) => {
    const p = s.style.getPropertyValue('clip-path');
    return p.indexOf('polygon(') === 0 && p.split(',').length >= 6;
  }), shards[0].style.getPropertyValue('clip-path').slice(0, 34) + '…');
ok('刚进来计数条就写着 0 / N(观众知道要找几片)',
  countEl.textContent.indexOf('0 / ' + LINES) === 0, '「' + countEl.textContent + '」');

const owners = [];
for (const [name, el] of [['.frost', root], ['.frost-shards', layer], ['canvas.frost-ice', cv]]) {
  if ((el._lis.get('pointerdown') || []).length) owners.push(name);
}
ok('pointerdown 挂在【能被指针命中】的元素上(.frost)', owners.length === 1 && owners[0] === '.frost',
  '实际挂在:' + (owners.join(' / ') || '没有(整页收不到事件)'));
ok('除 .frost 之外的层都是 pointer-events:none',
  PE['.frost'] === 'auto' && ['.frost-scene', '.frost-shards', '.frost-ice', '.frost-map', '.frost-frame', '.frost-head', '.frost-hint']
    .every((k) => PE[k] === 'none'),
  JSON.stringify(PE));
ok('面板正中按下 → 命中的就是 .frost', hitAt(500, 300) === root,
  (() => { const h = hitAt(500, 300); return h === root ? 'ok' : '命中了 ' + (h ? h.className || h.tagName : 'null'); })());
ok('没有一片碎片被标题挡着(挡着就白写了)',
  shards.every((s) => {
    const b = s.getBoundingClientRect();
    return !(b.left < 430 && b.right > -10 && b.top < 130 && b.bottom > -10);
  }), '第一片在 ' + Math.round(shards[0].getBoundingClientRect().left) + ',' + Math.round(shards[0].getBoundingClientRect().top));

const target = shards[0];
const tb = target.getBoundingClientRect();
const cxp = (tb.left + tb.right) / 2, cyp = (tb.top + tb.bottom) / 2;

tap(cxp, cyp, 31);
ok('对着还没化的霜点碎片 → 什么也不会发生', api.state().open === -1, 'open=' + api.state().open);

const lb = layer.getBoundingClientRect();
const CELLPX = 7;
const rowYs = [];
for (let r = Math.floor((tb.top - lb.top) / CELLPX); r <= Math.ceil((tb.bottom - lb.top) / CELLPX); r++) rowYs.push(r * CELLPX + 3);
const inset = Math.max(2, Math.min(9, tb.width * 0.28));
const wx0 = tb.left - lb.left + inset, wx1 = tb.right - lb.left - inset;
const stepX = Math.max(7, (wx1 - wx0) / 3);

for (let pass = 0; pass < 2; pass++) {
  for (const y of rowYs) {
    for (let x = wx0; x <= wx1; x += stepX) {
      pointer('pointerdown', x, y, 3, 'mouse');
      pointer('pointermove', Math.min(x + stepX, wx1), y, 3, 'mouse');
      pointer('pointerup', Math.min(x + stepX, wx1), y, 3, 'mouse');
    }
  }
}
await frames(3);
ok('暖过之后霜变少了', frost() < 1, 'frost=' + frost());
ok('提示语收起来了(is-used)', hint.classList.contains('is-used'));

const beforeIdle = frost();
await sleep(700); await frames(12);
ok('停手之后霜【不会】自己长回来(单向融化)', frost() <= beforeIdle + 1e-6,
  'frost ' + beforeIdle + ' → ' + frost());
const restMax0 = Math.max(...shards.map((_, i) => (i === 0 ? 0 : clearOf(i))));
ok('暖到的那一片明显比别片清楚', clearOf(0) > 0.4 && clearOf(0) > restMax0 + 0.3,
  '第0片 clear=' + clearOf(0).toFixed(3) + ',其余最大 ' + restMax0.toFixed(3));
const restMax = Math.max(...shards.map((_, i) => (i === 0 ? 0 : clearOf(i))));
ok('没暖到的碎片仍然盖着霜', restMax < 0.5, '其余最大 clear=' + restMax.toFixed(3));
ok('霜化开之后碎片才可点(pointer-events=auto)', target.style.getPropertyValue('pointer-events') === 'auto',
  '第0片 = ' + target.style.getPropertyValue('pointer-events'));
ok('还盖着霜的碎片点不到', shards[LINES - 1].style.getPropertyValue('pointer-events') === 'none',
  '第' + (LINES - 1) + '片 = ' + shards[LINES - 1].style.getPropertyValue('pointer-events'));

api.freezeAll();
await frames(2);
ok('重新冻上之后第 1 片又被霜盖住', clearOf(1) < 0.2, 'clear=' + clearOf(1).toFixed(3));
const dbgBefore = api.state().frost;
shards[1].dispatch('focus', { target: shards[1] });
const dbgAfter = api.state().frost;
shards[1].dispatch('focus', { target: shards[1] });
await frames(2);
ok('Tab 到那一片就会化开它(键盘用户也能一路收完)', clearOf(1) > 0.5, 'clear=' + clearOf(1).toFixed(3));
api.meltAll();
await frames(2);

pointer('pointerdown', cxp, cyp, 41);
pointer('pointermove', cxp + 18, cyp + 12, 41);
pointer('pointerup', cxp + 18, cyp + 12, 41);
ok('在碎片上拖着划 → 松手不会顺手打开它', api.state().open === -1, 'open=' + api.state().open);

tap(cxp, cyp, 32);
ok('点开一片 → 中央的读数层出现', readEl.hidden === false && readEl.classList.contains('is-on'),
  'open=' + api.state().open);
ok('读数层打开时给根元素挂上 is-reading(碎片从 Tab 顺序里退出去)',
  root.classList.contains('is-reading'));
const markPoly = readMark && readMark.querySelector('polygon');
const shardPoly = target.style.getPropertyValue('clip-path').replace(/^polygon\(|\)$/g, '');
ok('读数卡左边有一个槽(用户:"可以把碎片放在文本框的左侧")', !!readMark,
  readMark ? '有' : '没有');
const stripPct = (s) => String(s).replace(/[()]/g, ' ').replace(/polygon/gi, '')
  .replace(/%/g, '').replace(/\s+/g, ' ').trim();
ok('槽里的多边形逐顶点照抄了这一片碎片的形状(拾起的"就是刚才那一片")',
  !!markPoly && stripPct(markPoly.getAttribute('points')) === stripPct(shardPoly),
  markPoly ? ('槽=' + JSON.stringify(stripPct(markPoly.getAttribute('points')).slice(0, 34)) +
    ' vs 碎片=' + JSON.stringify(stripPct(shardPoly).slice(0, 34))) : '没有 polygon');
ok('拾起动画飞的是碎片形状,不是读数卡(卡片上不该再出现 --flip-*)',
  !readCard.style.getPropertyValue('--flip-x') && !readCard.style.getPropertyValue('--flip-y') &&
  !readCard.style.getPropertyValue('--flip-s'),
  'flip-x=' + (readCard.style.getPropertyValue('--flip-x') || '(空)'));
const markS = parseFloat(readMark.style.getPropertyValue('--mark-s'));
const markX = parseFloat(readMark.style.getPropertyValue('--mark-x'));
const markY = parseFloat(readMark.style.getPropertyValue('--mark-y'));
ok('点开瞬间:形状被反推到碎片的位置和大小(FLIP 起点,所以起点一定对)',
  markS > 0.05 && markS < 4 && markS !== 1 && (Math.abs(markX) > 5 || Math.abs(markY) > 5),
  '起点 scale=' + markS.toFixed(3) + ' 位移=' + markX.toFixed(0) + ',' + markY.toFixed(0));
ok('反推值不是默认值(否则"飞过去"根本不会发生)',
  readMark.style.getPropertyValue('--mark-x') !== '0px' &&
  readMark.style.getPropertyValue('--mark-s') !== '1',
  'x=' + readMark.style.getPropertyValue('--mark-x') + ' s=' + readMark.style.getPropertyValue('--mark-s'));
ok('文字直接放在屏幕上,不再贴在碎片形状里(用户:"没必要非得展示在碎片上")',
  !readCard.style.getPropertyValue('clip-path'),
  '卡片 clip-path = ' + (readCard.style.getPropertyValue('clip-path') || '(空)'));
await frames(2);
ok('下一帧清掉反推值 → 形状自己飞进左边的槽(落位是 scale 1 / 位移 0 / 角度回正)',
  parseFloat(readMark.style.getPropertyValue('--mark-s')) === 1 &&
  parseFloat(readMark.style.getPropertyValue('--mark-x')) === 0 &&
  parseFloat(readMark.style.getPropertyValue('--mark-rot')) === 0,
  '终点 scale=' + readMark.style.getPropertyValue('--mark-s') +
  ' 位移=' + readMark.style.getPropertyValue('--mark-x') +
  ' 角度=' + readMark.style.getPropertyValue('--mark-rot'));
ok('读数层上是这一片的文字', readText.textContent.indexOf('第0句') === 0, readText.textContent.slice(0, 12));
tap(500, 300, 33);
await sleep(1600); await frames(3);
ok('收下之后计数 +1', api.state().kept === 1, 'kept=' + api.state().kept);
ok('收下的碎片从霜上消失(is-kept)', target.classList.contains('is-kept'));
ok('计数条写出来了', countEl.textContent.indexOf('/ ' + LINES) > 0, '「' + countEl.textContent + '」');
ok('夜空里多了一颗星', api.state().stars === 1, api.state().stars + ' 颗');
ok('一个主题还没齐 → 不连线', api.state().lines === 0, api.state().lines + ' 条');

api.meltAll();
await frames(2);
ok('全化开之后所有碎片都清楚了', shards.every((_, i) => clearOf(i) > 0.55),
  '最小 clear=' + Math.min(...shards.map((_, i) => clearOf(i))).toFixed(3));
for (const i of [3, 6]) { api.open(i); api.keep(); }
await sleep(1600); await frames(3);
const st = api.state();
ok('集齐一个主题(3 片)→ 星座连线出来了', st.lines >= 6, st.lines + ' 条线');
ok('星星数 = 收下的碎片数(伴星不算在里面)', st.stars === 3, st.stars + ' 颗');
ok('集齐的星座还补了伴星(三颗亮星撑不起一个星座)',
  mapEl.querySelectorAll('.frost-companion').length > 0,
  mapEl.querySelectorAll('.frost-companion').length + ' 颗伴星');
ok('主题统计对得上', st.themes['好奇'] && st.themes['好奇'].kept === 3 && st.themes['创造'].kept === 0,
  JSON.stringify(st.themes));

api.collectAll();
await frames(3);
const done = api.state();
ok('全部收下 → 宣言出现(is-done)', done.done === true, 'kept=' + done.kept + '/' + LINES);
ok('星星全在夜空里', done.stars === LINES, done.stars + ' 颗');
ok('三块星座都连上了(连线走整条图案,不是只连三颗)',
  done.lines >= 18, done.lines + ' 条线');
ok('三块星座各补了一组伴星',
  mapEl.querySelectorAll('.frost-companion').length === 12,
  mapEl.querySelectorAll('.frost-companion').length + ' 颗伴星');
ok('宣言不再是 aria-hidden', doneEl.getAttribute('aria-hidden') === 'false');

const markCss = pagesCss.slice(pagesCss.indexOf('.frost-read__mark'), pagesCss.indexOf('.frost-read__keep'));
const markW = /width:\s*(\d+)px/.exec(markCss);
const markH = /height:\s*(\d+)px/.exec(markCss);
ok('★ 槽的尺寸是写死的像素(不跟文字长短变,否则每片的落点都不一样)',
  !!markW && !!markH && markW[1] === markH[1] && Number(markW[1]) >= 64 && Number(markW[1]) <= 140,
  markW && markH ? (markW[1] + '×' + markH[1] + 'px') : 'CSS 里没找到固定尺寸');
ok('槽排在文字【左边】(用户:"可以把碎片放在文本框的左侧")',
  /display:\s*flex/.test(pagesCss.slice(pagesCss.indexOf('.frost-read__card'), pagesCss.indexOf('.frost-read__mark'))) &&
  /flex:\s*0 0 auto/.test(markCss),
  '卡片是 flex + 槽 flex:0 0 auto');
ok('★ 卡片上不再有 --flip-* 那套变量(动画主体已经从卡片换成碎片)',
  !/--flip-/.test(pagesCss.slice(pagesCss.indexOf('.frost-read'), pagesCss.indexOf('.frost-finale'))),
  /--flip-/.test(pagesCss.slice(pagesCss.indexOf('.frost-read'), pagesCss.indexOf('.frost-finale')))
    ? 'CSS 里还留着 --flip-' : '干净');
ok('文字比形状晚一点出现(先"拿到东西",再"看清字")',
  /readTextIn[^;]*\.\d+s\s+both/.test(pagesCss),
  (pagesCss.match(/animation:\s*readTextIn[^;]*/) || ['没找到'])[0]);



const allStrokes = CTXES.reduce((n, c) => n + c.calls.stroke, 0);
const allFill = CTXES.reduce((n, c) => n + c.calls.fillRect, 0);
ok('冰晶是用线段画的(stroke 被调用)', allStrokes >= 4, allStrokes + ' 次 stroke');
ok('夜空 / 极光 / 飘雪都画了东西', allFill > 200, allFill + ' 次 fillRect');
ok('主画布上没有逐格方块(旧"像素风"画法会是几十万次)', mainCtx.calls.fillRect < 2000,
  mainCtx.calls.fillRect + ' 次 fillRect(只该是水滴;逐格画法一次就是 ' + (1000 / 7 | 0) * (600 / 7 | 0) + ' 次)');
ok('主画布每帧两次 drawImage(贴纹理 → 用覆霜场裁切)',
  mainCtx.calls.drawImage >= 2 && mainCtx.calls.drawImage % 2 === 0,
  mainCtx.calls.drawImage + ' 次 drawImage');

pointer('pointermove', 260, 240, 21, 'mouse');
ok('鼠标移过 → 处于"暖着"的状态', api.state().warm === true, 'warm=' + api.state().warm);
root.dispatch('pointerleave', { target: root });
ok('鼠标移出窗 → 不再暖', api.state().warm === false, 'warm=' + api.state().warm);

pointer('pointermove', 300, 260, 22, 'touch');
ok('触摸【没按住】时划过 → 不暖', api.state().warm === false, 'warm=' + api.state().warm);
pointer('pointerdown', 300, 260, 22, 'touch');
ok('触摸按住 → 暖', api.state().warm === true, 'warm=' + api.state().warm);
pointer('pointermove', 330, 280, 22, 'touch');
pointer('pointerup', 330, 280, 22, 'touch');
ok('★ 手指抬起 → 立刻不再暖(否则松手后还会继续化、一直滴水)',
  api.state().warm === false, 'warm=' + api.state().warm + ' / pressing=' + api.state().pressing);


const PW2 = 375, PH2 = 660;
root._rect = { left: 0, top: 0, width: PW2, height: PH2, right: PW2, bottom: PH2 };
layer._rect = { left: 0, top: 0, width: PW2, height: PH2, right: PW2, bottom: PH2 };
head._rect = { left: 0, top: 0, width: 240, height: 120, right: 240, bottom: 120 };
hint.style.setProperty('top', (PH2 - 40) + 'px');
api.repaint();
await frames(2);
const boxes = shards.map((s) => s.getBoundingClientRect());
ok('窄屏:12 片都有位置', new Set(shards.map((s) => s.style.getPropertyValue('left'))).size === LINES,
  new Set(shards.map((s) => s.style.getPropertyValue('left'))).size + ' 个不同位置');
ok('窄屏:没有一片出界',
  boxes.every((b) => b.left >= 0 && b.top >= 0 && b.right <= PW2 + 1 && b.bottom <= PH2 + 1),
  boxes.map((b) => Math.round(b.left) + ',' + Math.round(b.top)).join(' '));
ok('窄屏:碎片不至于小到点不着(≥38)', boxes.every((b) => Math.min(b.width, b.height) >= 38),
  '最小 ' + Math.round(Math.min(...boxes.map((b) => b.width))) + '×' + Math.round(Math.min(...boxes.map((b) => b.height))));
let overlap = 0;
for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
  const a = boxes[i], b = boxes[j];
  if (a.left < b.right - 6 && a.right > b.left + 6 && a.top < b.bottom - 6 && a.bottom > b.top + 6) overlap++;
}
ok('窄屏:碎片之间基本不叠', overlap <= 2, overlap + ' 对重叠');
ok('窄屏:没有一片被标题/提示压住',
  boxes.every((b) => !(b.left < 250 && b.right > -10 && b.top < 130 && b.bottom > -10)),
  '第一片在 ' + Math.round(boxes[0].left) + ',' + Math.round(boxes[0].top));

root._rect = { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };
layer._rect = { left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600 };
head._rect = { left: 0, top: 0, width: 420, height: 120, right: 420, bottom: 120 };
hint.style.setProperty('top', '560px');
api.repaint();
await frames(2);
const dbox = shards.map((s) => s.getBoundingClientRect());
const maxW = Math.max(...dbox.map((b) => b.width)), maxH = Math.max(...dbox.map((b) => b.height));
ok('碎片又小了一半(桌面上面板宽的 2%~4.5%)', maxW <= 1000 * 0.045 && maxH <= 1000 * 0.05,
  '最大 ' + Math.round(maxW) + '×' + Math.round(maxH) + '(上一版是 76×69)');
ok('不再"全是一个宽的碎片":长宽比是多样的',
  new Set(dbox.map((b) => Math.round(b.width))).size >= 5 &&
  new Set(dbox.map((b) => (b.width / b.height).toFixed(2))).size >= 5,
  new Set(dbox.map((b) => Math.round(b.width) + '×' + Math.round(b.height))).size + ' 种尺寸');

const glintEls = glints.querySelectorAll('.frost-glint');
ok('每片碎片都有一个爆闪点', glintEls.length === LINES, glintEls.length + ' 个');
const gpos = glintEls.map((g, i) => {
  const gx = parseFloat(g.style.getPropertyValue('left')), gy = parseFloat(g.style.getPropertyValue('top'));
  const b = dbox[i];
  return {
    nx: (gx - (b.left + b.width / 2)) / (b.width / 2),
    ny: (gy - (b.top + b.height / 2)) / (b.height / 2),
    edge: g.style.getPropertyValue('--edge'),
    dur: g.style.getPropertyValue('animation-duration'),
  };
});
ok('★ 爆闪点在碎片【边上】而不是中心(离中心 0.25~1.1 个半宽)',
  gpos.every((p) => Math.hypot(p.nx, p.ny) >= 0.25 && Math.hypot(p.nx, p.ny) <= 1.15),
  gpos.map((p) => Math.hypot(p.nx, p.ny).toFixed(2)).join(' '));
ok('爆闪点带着从中心指向它的角度(--edge 给星芒定向)',
  gpos.every((p) => /deg$/.test(p.edge)), gpos[0].edge);
ok('爆闪的周期是错开的(一起闪就成了呼吸灯)',
  new Set(gpos.map((p) => p.dur)).size >= 4, new Set(gpos.map((p) => p.dur)).size + ' 种周期');

const skyRects = sky.getContext().calls.rects;
const HOR = 600 * 0.735;
const SKY_TOP = HOR - 30;
const above = skyRects.filter((r) => r[1] + r[3] < SKY_TOP);
const bandLike = above.filter((r) => r[2] >= 1000 - 1);
ok('地平线以上只有整幅宽的渐变带 —— 天上没有背景星',
  above.length > 100 && bandLike.length === above.length,
  above.length + ' 笔在地平线以上,其中整幅宽 ' + bandLike.length + ' 笔;窄的 ' +
  (above.length - bandLike.length) + ' 笔(那些就是"贴上去的星星")');
const below = skyRects.filter((r) => r[1] > HOR);
ok('地平线以下画了地面(按列铺的雪地,一直铺到画面底部)',
  below.length > 300 && below.some((r) => r[1] + r[3] > 600 * 0.98),
  below.length + ' 笔在地平线以下,最深到 ' +
  Math.round(Math.max(...below.map((r) => r[1] + r[3]))));
const snowR = snow.getContext().calls.rects;

windowShim.devicePixelRatio = 2;
api.repaint();
await frames(2);
const cvBox = cv.getBoundingClientRect();
ok('dpr=2:霜画布的 CSS 盒子仍然 == 面板尺寸(不是它的两倍)',
  Math.round(cvBox.width) === 1000 && Math.round(cvBox.height) === 600,
  'CSS 盒子 ' + Math.round(cvBox.width) + '×' + Math.round(cvBox.height) +
  ';后备缓冲 ' + cv.width + '×' + cv.height + '(应为 2000×1200)');
ok('dpr=2:后备缓冲确实按 dpr 放大了(HiDPI 不糊)', cv.width === 2000 && cv.height === 1200,
  cv.width + '×' + cv.height);
api.freezeAll();
await frames(1);
const hitShard = 4;
const hb = shards[hitShard].getBoundingClientRect();
const hx = (hb.left + hb.right) / 2, hy = (hb.top + hb.bottom) / 2;
for (let i = 0; i < 16; i++) {
  pointer('pointerdown', hx, hy, 70 + i, 'mouse');
  pointer('pointermove', hx + 2, hy + 2, 70 + i, 'mouse');
  pointer('pointerup', hx + 2, hy + 2, 70 + i, 'mouse');
}
await frames(2);
const restMax2 = Math.max(...shards.map((_, i) => (i === hitShard ? 0 : clearOf(i))));
ok('dpr=2:光标底下那一片真的会亮起来(不是"化了却没反应")',
  clearOf(hitShard) > 0.5 && restMax2 < clearOf(hitShard),
  '第' + hitShard + '片 clear=' + clearOf(hitShard).toFixed(3) + ',其余最大 ' + restMax2.toFixed(3));
const xs0 = snowR.map((r) => r[0]);
ok('dpr=2:雪花铺满整块画布(位置与半径用同一套设备像素)',
  snowR.length > 50 && Math.min(...xs0) < 100 && Math.max(...xs0) > 1900,
  snowR.length + ' 笔,x 范围 ' + Math.round(Math.min(...xs0)) + '..' + Math.round(Math.max(...xs0)) + '(画布宽 2000)');
windowShim.devicePixelRatio = 1;
api.repaint();
api.freezeAll();
await frames(2);

cv._forceRect = { left: 0, top: 0, width: 1600, height: 960, right: 1600, bottom: 960 };
pointer('pointerdown', 800, 480, 61, 'mouse');
pointer('pointerup', 800, 480, 61, 'mouse');
await frames(1);
ok('屏幕被缩放时,融化落在光标真正对应的格子上(而不是视觉坐标那个点)',
  api.covAt(500, 300) < 0.98 && api.covAt(800, 480) > 0.99,
  '内部中心 ' + api.covAt(500, 300) + '(应被化开),视觉那点 ' + api.covAt(800, 480) + '(应还是 1)');
cv._forceRect = null;


api.freezeAll();
await frames(1);
const px = 300, py = 300;
pointer('pointermove', px, py, 81, 'mouse');
await frames(1);
ok('刚靠近(不到 0.25 秒)不会开始化', api.covAt(px, py) > 0.99, 'covAt=' + api.covAt(px, py));
await frames(6);
ok('停留超过 0.25 秒之后才开始化', api.covAt(px, py) < 0.99, 'covAt=' + api.covAt(px, py));
ok('融化范围收紧了(80px 之外不受影响)', api.covAt(px + 80, py) > 0.99,
  '80px 外 covAt=' + api.covAt(px + 80, py) + '(WARM_R=62)');
root.dispatch('pointerleave', { target: root });
await frames(4);
const frostBeforeIdle = frost();
const dropsAlive = api.state().drops;
await frames(14);
ok('★ 松手之后水滴不再继续化霜(那"一长串"就是它拉的)',
  frost() >= frostBeforeIdle - 1e-6,
  '水滴 ' + dropsAlive + ' 颗;frost ' + frostBeforeIdle + ' → ' + frost());

const radiiOf = (str) => [...String(str).matchAll(/([\d.]+)% ([\d.]+)%/g)]
  .map((m) => Math.hypot(parseFloat(m[1]) - 50, parseFloat(m[2]) - 50) / 50);
const allR = shards.flatMap((s) => radiiOf(s.style.getPropertyValue('clip-path')));
ok('碎片有凹进去的顶点(半径 < 0.45 的缺口)', allR.filter((r) => r < 0.45).length >= 3,
  '最深 ' + Math.min(...allR).toFixed(2) + ',共 ' + allR.filter((r) => r < 0.45).length + ' 个凹顶点');

const skyAll = sky.getContext().calls.rects;
const HOR2 = 600 * 0.80;
const groundBody = skyAll.filter((r) => r[1] > HOR2 - 30 && r[2] < 1000 && r[3] > 3);
const ridgeLit = skyAll.filter((r) => r[1] > HOR2 - 30 && r[2] < 1000 && r[3] <= 2);
const lum255 = (styleStr) => {
  const m = String(styleStr).match(/rgba?\(([^)]+)\)/);
  if (!m) return 0;
  const p = m[1].split(',').map(Number);
  return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
};
const brightBody = groundBody.filter((r) => lum255(r[4]) > 92);
ok('地面剪影是近黑的(没有发亮的大块)', groundBody.length > 200 && brightBody.length === 0,
  groundBody.length + ' 笔剪影里,亮于 92 的有 ' + brightBody.length + ' 笔(最亮 ' +
  (groundBody.length ? Math.max(...groundBody.map((r) => lum255(r[4]))).toFixed(0) : '-') + ')');
const groundLit = skyAll.filter((r) => r[1] > HOR2 - 40 && r[2] < 1000);
const ridgeFar = groundLit.filter((r) => lum255(r[4]) >= 24 && lum255(r[4]) <= 60);
const ridgeNear = groundLit.filter((r) => lum255(r[4]) <= 18);
const thinLit = groundLit.filter((r) => r[3] <= 2 && lum255(r[4]) > 60);
ok('地面有【两层】山脊:远的一层比夜空亮、近的一层近黑(纵深靠这两层,不靠一条亮边)',
  ridgeFar.length > 20 && ridgeNear.length > 20,
  '远脊 ' + ridgeFar.length + ' 笔(最亮 ' +
  (ridgeFar.length ? Math.max(...ridgeFar.map((r) => lum255(r[4]))).toFixed(0) : '-') +
  '),近脊 ' + ridgeNear.length + ' 笔');
ok('★ 地平线上不再有那条"细亮边"(用户说"剪影就是一条线",那条线就是它)',
  thinLit.length === 0,
  thinLit.length + ' 笔细亮边' + (thinLit.length ? '(亮度 ' + thinLit.map((r) => lum255(r[4]).toFixed(0)).join(',') + ')' : ''));
const ridgeTops = groundLit.filter((r) => r[2] < 40).map((r) => r[1]);
const spread = ridgeTops.length ? Math.max(...ridgeTops) - Math.min(...ridgeTops) : 0;
ok('山脊是起伏的,不是一条水平线(峰谷差要够大)',
  spread > 20, '峰谷差 ' + spread.toFixed(0) + 'px(面板高 600)');
const HOR_ = 600 * 0.80;
const ridgeAbove = HOR_ - Math.min(...ridgeTops);
ok('★ 山脊真的高出地平线一截(不是贴着地平线的一条线)',
  ridgeAbove > 0.02 * 600,
  '最高处高出地平线 ' + ridgeAbove.toFixed(0) + 'px = 画面高的 ' + (ridgeAbove / 600 * 100).toFixed(1) +
  '%(要求 ≥2%:再高会顶到提示语)');
ok('远脊是另一档亮度(远近靠色调层次读出来,不是靠高度差)',
  ridgeFar.length > 20 && ridgeNear.length > 20 &&
  Math.max(...ridgeFar.map((r) => lum255(r[4]))) > Math.min(...ridgeNear.map((r) => lum255(r[4]))) + 10,
  '远脊最亮 ' + (ridgeFar.length ? Math.max(...ridgeFar.map((r) => lum255(r[4]))).toFixed(0) : '-') +
  ' vs 近脊最暗 ' + (ridgeNear.length ? Math.min(...ridgeNear.map((r) => lum255(r[4]))).toFixed(0) : '-'));

const srcTxt = fs.readFileSync('./assets/js/page-frost.js', 'utf8');
const patBlock = srcTxt.slice(srcTxt.indexOf('var PATTERNS = ['), srcTxt.indexOf('var ANCHOR = ['));
const patSrc = patBlock.slice(patBlock.indexOf('['));
const PATTERNS_SRC = new Function('return ' + patSrc.slice(0, patSrc.lastIndexOf('];') + 2))();
ok('三套星座图案都写在源码里(固定样式,不是运行时摆出来的)',
  PATTERNS_SRC.length === 3, PATTERNS_SRC.map((p) => p.name).join(' / '));
ok('每套图案都有名字(北斗 / 猎户 / 仙后 —— 形状有名字才认得出)',
  PATTERNS_SRC.every((p) => typeof p.name === 'string' && p.name.length > 0),
  PATTERNS_SRC.map((p) => p.name).join(' / '));
ok('每套图案都有一张【显式连线表】(不再靠"把点绕一圈"连)',
  PATTERNS_SRC.every((p) => Array.isArray(p.edges) && p.edges.length >= 4 &&
    p.edges.every((e) => Array.isArray(e) && e.length === 2 && e[0] !== e[1])),
  PATTERNS_SRC.map((p) => p.name + ':' + p.edges.length + '条').join(' '));
ok('★ 连线【不是闭合的环】("随便连线"的病根就是绕圈连成多边形)',
  PATTERNS_SRC.every((p) => {
    const n = p.pts.length;
    const has = (a, b) => p.edges.some((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a));
    return !has(n - 1, 0);
  }),
  PATTERNS_SRC.map((p) => p.name).join(' '));
ok('源码里已经没有"绕圈连线"那段代码了(否则随时会退回去)',
  !/addStarLine\(full\[a\], full\[\(a \+ 1\) % full\.length\]\)/.test(srcTxt),
  /% full\.length/.test(srcTxt) ? '还留着 % full.length' : '干净');
ok('每片碎片位之间隔得够开(三片先连出一个三角形就又变成多边形了)',
  PATTERNS_SRC.every((p) => {
    const a = p.shard.map((i) => p.pts[i]);
    const d = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    const sides = [d(a[0], a[1]), d(a[1], a[2]), d(a[0], a[2])].sort((x, y) => x - y);
    const all = [];
    for (let i = 0; i < p.pts.length; i++) for (let j = i + 1; j < p.pts.length; j++) all.push(d(p.pts[i], p.pts[j]));
    all.sort((x, y) => x - y);
    return sides[0] > all[0] * 1.15;
  }),
  PATTERNS_SRC.map((p) => p.name + ':' + JSON.stringify(p.shard)).join(' '));
const shapeOf = (pts) => {
  const d = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d.push(Math.hypot(a[0] - b[0], a[1] - b[1]));
  }
  d.sort((p, q) => p - q);
  const m = d[d.length - 1] || 1;
  return d.map((v) => +(v / m).toFixed(2)).join('/');
};
const shapes = PATTERNS_SRC.map((p) => shapeOf(p.pts));
ok('三块星座的形状【不一样】(用户:"你这个星座为啥只有一种样式")',
  new Set(shapes).size === 3, JSON.stringify(shapes));

const HZ_SRC = Number((/var HOR = DH \* ([0-9.]+)/.exec(srcTxt) || [])[1]);
const HZ_AUR = Number((/var HZ = ([0-9.]+)/.exec(srcTxt) || [])[1]);
const groundCss = pagesCss.slice(pagesCss.indexOf('.frost-ground {'), pagesCss.indexOf('.frost-shards'));
const HZ_CSS = Number((/height:\s*([0-9.]+)%/.exec(groundCss) || [])[1]);
const bdFloor = /var MIN_ALT = ([0-9.]+)/.exec(srcTxt);
const auroraLow = 1 - Number(bdFloor && bdFloor[1]);
function ridgePeakY() {
  const fnSrc = srcTxt.slice(srcTxt.indexOf('function groundTop'),
    srcTxt.indexOf('return HOR + h * DH;') + 'return HOR + h * DH;'.length);
  const clean = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '') + '\n}';
  const HOR = 390 * HZ_SRC;
  const f = new Function('x', 'DW', 'DH', 'HOR', clean + '\nreturn groundTop(x, false);');
  let top = Infinity;
  for (let x = 0; x < 1024; x += 2) top = Math.min(top, f(x, 1024, 390, HOR));
  return top / 390;
}
const ridgeMax = ridgePeakY();
const BASE_SRC = Number((/var BASE = ([0-9.]+)/.exec(srcTxt) || [])[1]);
const HZ_ = HZ_SRC, TOP0_ = 1 - (0.39 - HZ_) / (1 - HZ_), TOP1_ = 1 - (0.02 - HZ_) / (1 - HZ_);
let wSum = 0, wTop = 0;
for (let k = 0; k <= 400; k++) {
  const alt = k / 400;
  const rel = alt - (BASE_SRC - 0.04);
  if (rel <= 0 || alt <= 0) continue;
  const A = (0.12 + 0.88 * Math.exp(-rel * 3.0)) * (1 - Math.min(1, Math.max(0, (alt - TOP0_) / (TOP1_ - TOP0_))));
  const y = 1 - alt;
  wSum += A; if (y < 0.5) wTop += A;
}
const massTop = wSum ? wTop / wSum : 0;
const groundH = HZ_CSS / 100;
ok('★ 地面占画面的比例够画山(不是贴着底边的一条窄带)',
  groundH >= 0.25,
  '地面占 ' + (groundH * 100).toFixed(0) + '%H(要求 ≥25%;上一版只有 20%,390px 上 78px,画不出山)');
const ridgeAbove2 = (HZ_SRC - ridgePeakY()) * 100;
ok('★ 山脊的峰真的高出地平线(不是只在地平线下面起伏)',
  ridgeAbove2 > 3,
  '峰高出地平线 ' + ridgeAbove2.toFixed(1) + '%H(要求 >3%;修之前是 -2.1%,即峰在地平线【下面】)');

const zOf = (sel) => {
  const i = pagesCss.indexOf(sel + ' {');
  const m = i >= 0 ? /z-index:\s*(\d+)/.exec(pagesCss.slice(i, i + 700)) : null;
  return m ? Number(m[1]) : NaN;
};
const zMap = zOf('.frost-map'), zFrame = zOf('.frost-frame'),
  zRead = zOf('.frost-read'), zFin = zOf('.frost-finale');
ok('★ 星图画在窗框【之上】(否则星座会被窗棂拦腰切断)',
  zMap > zFrame, '星图 z=' + zMap + ' 窗框 z=' + zFrame);
ok('星图仍在读数卡与宣言【之下】(读字的界面要压住星图)',
  zMap < zRead && zMap < zFin, '星图 ' + zMap + ' < 读数层 ' + zRead + ' / 宣言 ' + zFin);
ok('★ 星座确实横跨窗框的横梁(所以上面那条层高不是多余的)',
  PATTERNS_SRC.every((p, i) => {
    const s = 163.8, W = 1024, H = 390;
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const ox = [0.19, 0.52, 0.81][i] * W - (mnx + mxx) / 2 * s;
    const oy = [0.30, 0.21, 0.29][i] * H - (mny + mxy) / 2 * s;
    const y0 = oy + mny * s, y1 = oy + mxy * s, bar = H * 0.34;
    return y0 < bar && y1 > bar;
  }), '三套都跨过 y=' + (390 * 0.34).toFixed(0) + 'px 那条横梁');

const snowCtx = snow.getContext();
const rA = snowCtx.calls.rects.map((r) => [r[0] + r[2] / 2, r[1] + r[3] / 2]);
await frames(1);
const rB = snowCtx.calls.rects.map((r) => [r[0] + r[2] / 2, r[1] + r[3] / 2]);
const dxs = [], dys = [];
for (const a of rA) {
  let best = null, bd = 1e9;
  for (const b of rB) {
    const d = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best || bd > 24) continue;
  dxs.push(best[0] - a[0]); dys.push(best[1] - a[1]);
}
dxs.sort((p, q) => p - q); dys.sort((p, q) => p - q);
const med = (v) => (v.length ? v[v.length >> 1] : 0);
const medDx = med(dxs), medDy = med(dys);
const ratio = medDy ? medDx / medDy : 0;
const wide = snowCtx.calls.rects.reduce((m, r) => Math.max(m, Math.min(r[2], r[3])), 0);
ok('雪真的在动(量到了位置变化)', dxs.length > 40, dxs.length + ' 笔可比');
ok('雪是【斜着】飞的(横向/纵向 ≈ -0.34)', ratio < -0.12 && ratio > -0.7,
  '实测斜率 ' + ratio.toFixed(3) + '(中位位移 ' + medDx.toFixed(2) + ',' + medDy.toFixed(2) + ')');
ok('雪比以前快(每帧下落 ≥1 设备像素)', medDy >= 1.0, '中位每帧 ' + medDy.toFixed(2) + ' 像素');
ok('雪比以前大(一笔就有 ≥2 设备像素)', wide >= 2, '最大一笔 ' + wide.toFixed(1) + ' 像素');

const secStart = pagesCss.indexOf('--frost-night');
const secEnd = pagesCss.indexOf('.solar {');
const frostCss = (secStart >= 0 && secEnd > secStart) ? pagesCss.slice(secStart, secEnd) : '';
ok('浅色模式:这一段样式真的取到了(量具自检)', frostCss.length > 1200, frostCss.length + ' 字符');
ok('浅色模式:这一页的样式里【没有】data-theme 分支',
  frostCss.length > 1200 && frostCss.indexOf('data-theme') < 0,
  (frostCss.match(/data-theme/g) || []).length + ' 处 data-theme');
ok('浅色模式:窗底色与字色都来自 .frost 自己那套变量',
  /--frost-night:/.test(frostCss) && /--frost-ink:/.test(frostCss) && /--frost-dim:/.test(frostCss),
  'ok');
const tpl = fs.readFileSync('./layouts/partials/pages/future.html', 'utf8');
const srcCode = srcTxt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const selUsed = [...srcCode.matchAll(/q\("(\[[a-z-]+\]|\.[a-z_-]+)"/g)].map((m) => m[1]);
const uniqSel = [...new Set(selUsed)];
const missing = uniqSel.filter((sel) => {
  if (sel.startsWith('.')) return !new RegExp('class="[^"]*' + sel.slice(1) + '[ "]').test(tpl);
  return !tpl.includes(sel.slice(1, -1));
});
ok('★ 模块取元素用的每个选择器都能在 future.html 里找到(契约不许各写各的)',
  uniqSel.length >= 8 && missing.length === 0,
  uniqSel.length + ' 个选择器;找不到的:' + (missing.length ? missing.join(' ') : '无'));
ok('★ 读数卡的槽:模板用 class,模块也按 class 找(上一版就是这里对不上)',
  /class="frost-read__mark"/.test(tpl) && srcTxt.includes('q(".frost-read__mark"'),
  'future.html 有 class="frost-read__mark" · JS 里有 q(".frost-read__mark")');


const aurPath = './assets/shaders/aurora.glsl';
const aurSrc = fs.existsSync(aurPath) ? fs.readFileSync(aurPath, 'utf8') : '';
ok('★ 极光 GLSL 在仓库里', aurSrc.length > 1000, aurSrc.length + ' 字符');
ok('★ 极光那份算法【原样保留】:fbmAurora / aurora 都在',
  /float fbmAurora\(/.test(aurSrc) && /vec4 aurora\(/.test(aurSrc) &&
  /tri2\(/.test(aurSrc) && /mm2\(/.test(aurSrc),
  'fbmAurora / aurora / tri2 / mm2 都在');
const sceneParts = ['raymarch', 'float map(', 'setColor', 'fbmM', 'fbmH', 'fbmL',
  'struct light', 'calcLights', 'vec3 stars(', 'setSkyColor', 'calcLookAtMatrix',
  'mainImage( out vec4 fragColor, in vec2 fragCoord ) 里面不许有相机'];
const leftovers = sceneParts.slice(0, 11).filter((s) => {
  const re = new RegExp(s.replace(/[()]/g, '\\$&').replace('float map\\(', 'float\\s+map\\s*\\('), '');
  return re.test(aurSrc.replace(/\/\*[\s\S]*?\*\//g, ''));
});
ok('★★ 场景那一半【已经删掉】了(地形 / 云海 / 相机 / 星空 / 光照都不许剩)',
  leftovers.length === 0,
  leftovers.length ? '★ 还留着:' + leftovers.join(' , ') : '只剩极光(fbmAurora + aurora)');
ok('★★ 没有再改原作者的相机(上一版加的 CAM_PITCH 补丁已删)',
  !/CAM_PITCH/.test(aurSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
  /CAM_PITCH/.test(aurSrc.replace(/\/\*[\s\S]*?\*\//g, "")) ? '★ CAM_PITCH 还在代码里 —— 那是"在别人的画上挪镜头"' : '代码里没有相机补丁 ✓(注释里提它的历史是对的)');
ok('★ 极光层是黑底发光 ⇒ 必须 mix-blend-mode: screen(黑=没画)',
  /\.frost-aurora\s*\{[^}]*mix-blend-mode:\s*screen/.test(pagesCss),
  /\.frost-aurora\s*\{[^}]*mix-blend-mode:\s*normal/.test(pagesCss)
    ? '★ 还是 normal —— 那是"它画整幅天"时的写法,现在黑底会被画成黑板' : 'screen,对了');
const aurCode = aurSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('★ 适配点只有一处:u_time → uTime(宿主里没有 iTime 这个名字)',
  !/\bu_time\b/.test(aurCode) && /\buTime\b/.test(aurCode) && !/\biTime\b/.test(aurCode),
  /\bu_time\b/.test(aurCode) ? '代码里还留着 u_time(宿主不认识,会编译失败)'
    : (/\biTime\b/.test(aurCode) ? '代码里有 iTime(宿主里没这个名字)' : '已换成 uTime'));
ok('★ 入口交给宿主:文件里不写 main(),宿主会补 mainImage 的调用',
  !/void\s+main\s*\(\s*\)/.test(aurSrc) && /void mainImage\s*\(/.test(aurSrc),
  /void\s+main\s*\(\s*\)/.test(aurSrc) ? '文件里自己写了 main()' : '没有 main(),由宿主补');
const idxTpl = fs.readFileSync('./layouts/home/list.html', 'utf8');
ok('★ 模板把它注册进 window.__SHADERS(aurora)',
  /auroraGlsl := resources\.Get "shaders\/aurora\.glsl"/.test(idxTpl) &&
  /aurora: "\{\{ with \$auroraGlsl/.test(idxTpl),
  'index.html 里有 resources.Get + __SHADERS.aurora');
ok('★ 模块里接上了:preload + 每帧 render(拿不到就退回手写那版)',
  srcTxt.includes('CDBootGlsl.preload("aurora"') && srcTxt.includes('CDBootGlsl.render("aurora"') &&
  srcTxt.includes('__SHADERS && window.__SHADERS.aurora'),
  'preload / render / __SHADERS.aurora 三处都有');

const introCss = fs.readFileSync('./assets/css/intro.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const cssRules = [...introCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), decl: m[2] }))
  .filter((r) => r.sel.includes('.screen-static'));
const bgOf = (decl) => {
  const m = /(^|;)\s*background\s*:\s*([^;]+)/.exec(decl);
  return m ? m[2].trim() : null;
};
const opaqueBg = cssRules
  .map((r) => ({ sel: r.sel, bg: bgOf(r.decl) }))
  .filter((r) => r.bg && !/^transparent$/i.test(r.bg) && !/rgba\([^)]*,\s*0\s*\)$/.test(r.bg));
const statelessOpaque = opaqueBg.filter((r) => !/\.is-black|\.is-full|\.is-on/.test(r.sel));
ok('★ 黑屏那层【只在带状态类的时候】才不透明(常驻黑底 = 揭不开页面)',
  cssRules.length >= 3 && opaqueBg.length >= 1 && statelessOpaque.length === 0,
  cssRules.length + ' 条规则、' + opaqueBg.length + ' 条有不透明背景;不带状态类的 ' +
  statelessOpaque.length + ' 条' +
  (statelessOpaque.length ? ':' + statelessOpaque.map((r) => r.sel + ' → ' + r.bg).join(' | ') : '') +
  ' · 基础规则是 ' + JSON.stringify(bgOf((cssRules.find((r) => r.sel === '.screen-static') || {}).decl || '')));
ok('★ 那条 frame-fitted 规则还在(铺满屏幕,但不再裁形状)',
  cssRules.some((r) => r.sel.includes('frame-fitted') && /inset:\s*0/.test(r.decl)) &&
  !cssRules.some((r) => r.sel.includes('frame-fitted') && /clip-path/.test(r.decl)),
  'found: ' + cssRules.filter((r) => r.sel.includes('frame-fitted')).map((r) => r.sel).join(' | '));
const postSrc = fs.readFileSync('./assets/js/boot-post.js', 'utf8');
ok('★ 后期覆盖图(扫描线/暗角)必须乘上画面 alpha,不能整屏 source-over 压黑',
  /destination-in[\s\S]{0,120}og\.drawImage\(off/.test(postSrc) &&
  !/ctx\.drawImage\(overlays\[overlayIdx\], 0, 0, W, H\);/.test(postSrc),
  /ctx\.drawImage\(overlays\[overlayIdx\], 0, 0, W, H\);/.test(postSrc)
    ? '还在整屏铺覆盖图(揭开的地方会被再压一层黑)' : '已按画面 alpha 裁过');

const moteMs = Number((/var MOTE_MS = (\d+);/.exec(srcTxt) || [])[1]);
const cardMs = Number((/var CARD_MS = (\d+);/.exec(srcTxt) || [])[1]);
const keepMs = Number((/var KEEP_MS = (\d+);/.exec(srcTxt) || [])[1]);
const moteAnim = /\.frost-read__mark\.is-kept\s+\.frost-read__mote\s*\{[^}]*animation:\s*shardMote\s*([\d.]+)s/.exec(pagesCss);
const moteAnimMs = moteAnim ? Number(moteAnim[1]) * 1000 : NaN;
const cardRule = /\.frost-read__card\.is-flying\s*\{[^}]*animation:\s*cardOut\s+([\d.]+)s\s+\S+\s+([\d.]+)s/.exec(pagesCss);
const cardDelayMs = cardRule ? Number(cardRule[2]) * 1000 : NaN;
ok('★ 收下动画:MOTE_MS == CSS 的 shardMote 时长(否则光点被半路掐掉)',
  !!moteMs && !!moteAnimMs && Math.abs(moteMs - moteAnimMs) < 1,
  'MOTE_MS=' + moteMs + 'ms · CSS shardMote=' + moteAnimMs + 'ms');
ok('★ 卡片淡出的【延迟】== MOTE_MS(动画演完卡片才走)',
  !!cardMs && !!cardDelayMs && Math.abs(cardDelayMs - moteAnimMs) < 1 && cardMs >= moteAnimMs,
  'CSS cardOut 延迟=' + cardDelayMs + 'ms · shardMote=' + moteAnimMs + 'ms · CARD_MS=' + cardMs + 'ms');
ok('★ KEEP_MS 比 CARD_MS 晚(收尾在卡片淡出之后,不是同一拍)',
  !!keepMs && !!cardMs && keepMs > cardMs,
  'KEEP_MS=' + keepMs + 'ms > CARD_MS=' + cardMs + 'ms');
const offTimers = [...srcTxt.matchAll(/setTimeout\(function \(\) \{\s*\n\s*if \(readEl\) readEl\.classList\.add\("is-off"\);\s*\n\s*\}, CARD_MS\)/g)];
ok('★ is-off(带 animation:none)是【晚一拍】挂的,不和 is-kept 同拍',
  offTimers.length === 1 && !/readEl\.classList\.add\("is-off"\);\s*\n\s*if \(dialogT\)/.test(srcTxt),
  offTimers.length === 1 ? 'CARD_MS 之后才挂 is-off ✓' : '★ 还是同拍挂的 —— 光点动画会被取消');
ok('★ 光点是【槽内的真元素】,不是伪元素(伪元素的定位基准容易差几个像素)',
  /class="frost-read__mote"/.test(tpl) &&
  /\.frost-read__mote\s*\{[^}]*position:\s*absolute/.test(pagesCss) &&
  /\.frost-read__mote\s*\{[^}]*inset:\s*0[^}]*margin:\s*auto/.test(pagesCss),
  '模板里有 .frost-read__mote · CSS 里是 inset:0 + margin:auto(居中不依赖外部数值)');
ok('★ 光点与碎片形状是【兄弟】,共享槽这一个原点(不是两个东西交接)',
  !!readMark && /svg[\s\S]{0,200}frost-read__mote/.test(tpl),
  '模板里 svg 与 .frost-read__mote 同在 .frost-read__mark 里');
const condenseKeys = /@keyframes shardCondense\s*\{([\s\S]*?)\n\}/.exec(pagesCss);
const cond = condenseKeys ? condenseKeys[1] : '';
const opacAt = (pct) => {
  const m = new RegExp(pct + '%\\s*\\{([^}]*)\\}').exec(cond);
  const o = m ? /opacity:\s*([\d.]+)/.exec(m[1]) : null;
  const br = m ? /brightness\(([\d.]+)\)/.exec(m[1]) : null;
  const sc = m ? /scale\(([\d.]+)\)/.exec(m[1]) : null;
  return { op: o ? Number(o[1]) : NaN, br: br ? Number(br[1]) : NaN, sc: sc ? Number(sc[1]) : NaN };
};
const k34 = opacAt(34), k62 = opacAt(62);
ok('★ 凝聚:碎片在收拢【过程中】仍然不透明(消失 = opacity 掉到 0,那是错的)',
  !!cond && k34.op === 1 && k62.op === 1,
  `34% → opacity ${k34.op} · 62% → opacity ${k62.op}(都必须是 1)`);
ok('★ 凝聚:碎片【越缩越亮】(被压紧,不是被擦淡)',
  !!cond && k62.br > k34.br && k34.br > 1,
  `brightness 34% = ${k34.br} → 62% = ${k62.br}(必须递增且 >1)`);
ok('★ 凝聚:碎片缩到很小但【不是 0】(真的消失交给最后一刻的接管)',
  !!cond && k62.sc > 0 && k62.sc < 0.2,
  `62% 的 scale = ${k62.sc}(要在 0~0.2 之间;scale(0) 就是"消失",不是"凝聚")`);
const moteKeys = /@keyframes shardMote\s*\{([\s\S]*?)\n\}/.exec(pagesCss);
const moteEarly = moteKeys ? /0%,\s*\n?\s*(\d+)%\s*\{[^}]*opacity:\s*0/.test(moteKeys[1]) : false;
const moteBloom = moteKeys ? /(\d+)%\s*\{[^}]*opacity:\s*1/.test(moteKeys[1]) : false;
const bloomPct = moteKeys ? Number((/(\d+)%\s*\{[^}]*opacity:\s*1/.exec(moteKeys[1]) || [])[1]) : NaN;
ok('★ 光点【晚于】碎片收拢才亮(它是碎片压出来的,不是同时出现的另一样东西)',
  moteEarly && moteBloom && bloomPct >= 50,
  moteKeys ? `光点亮的时刻 = ${bloomPct}%(必须 ≥50%,也就是碎片缩到底之后)` : '没找到 shardMote keyframes');

const aurCall = /if \(!reduced \|\| !aurFrames\) \{\s*\n\s*paintAuroraGlsl\(/.exec(srcTxt);
ok('★ "减少动态效果"下也要画一帧极光(不能整层消失)',
  !!aurCall && !/if \(!reduced && active\) paintAuroraGlsl/.test(srcTxt),
  aurCall ? '画一帧的写法在' : (/if \(!reduced && active\) paintAuroraGlsl/.test(srcTxt) ? '★ 还是 !reduced && 的旧写法' : '找不到调用点'));

const noneRule = /\.frost-read__mark\.is-kept\s*,\s*\n?\s*\.frost-read\.is-off \.frost-read__mark\s*\{[^}]*animation:\s*none/.test(pagesCss);
ok('★ 没有哪条规则一边挂 is-kept 一边把动画关掉(伪元素会被一起关掉)',
  !noneRule && /\.frost-read\.is-off \.frost-read__mark\s*\{[^}]*animation:\s*none/.test(pagesCss),
  noneRule ? '★ 还有 is-kept, .is-off { animation: none } 这种自相矛盾的写法' : '只有 is-off 关动画 ✓');

const hostSrc = fs.readFileSync('./assets/js/boot-glsl.js', 'utf8');
const headBlock = /var FRAG_HEAD = \[([\s\S]*?)\]\.join/.exec(hostSrc);
const headStr = headBlock ? headBlock[1] : '';
const shaderTimeNames = ['uTime', 'iTime', 'u_time'].filter((n) => {
  const re = new RegExp('\\b' + n + '\\b');
  return re.test(aurCode);
});
const undeclared = shaderTimeNames.filter((n) => {
  const declName = n === 'u_time' ? 'uTime' : n;
  return !new RegExp('uniform\\s+float\\s+' + declName + '\\s*;').test(headStr);
});
ok('★★ 着色器用到的时间名字,宿主 FRAG_HEAD 里都声明了(少一个就编译失败)',
  shaderTimeNames.length > 0 && undeclared.length === 0,
  '正文用到 ' + shaderTimeNames.join('/') + ';宿主的头里 ' +
  (headStr.match(/uniform\s+float\s+\w+/g) || []).join(' ') +
  (undeclared.length ? ' —— ★ 缺:' + undeclared.join('/') : ''));
ok('★★ 宿主把 uTime 也喂进去了(只声明不赋值 = 画面静止)',
  /getUniformLocation\(pr,\s*"uTime"\)/.test(hostSrc) && /uniform1f\(prog\.u\.utime/.test(hostSrc),
  'getUniformLocation + uniform1f 都在');

const markKeptOpacity = /\.frost-read__mark\.is-kept\s*\{[^}]*opacity:\s*([\d.]+)/.exec(pagesCss);
ok('★ is-kept 时【容器】仍然不透明(否则光点在透明父元素里演,谁也看不见)',
  !!markKeptOpacity && Number(markKeptOpacity[1]) > 0.99,
  markKeptOpacity ? ('.frost-read__mark.is-kept 的 opacity = ' + markKeptOpacity[1]) : '★ 找不到这条规则');
const cssRulesOf = (sel) => [...pagesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].trim().replace(/\s+/g, ' ') === sel)
  .map((m) => m[2]);
const markRules = cssRulesOf('.frost-read__mark');
const svgRules = cssRulesOf('.frost-read__mark svg');
ok('★ 收拢动画挂在 svg 上(容器不参与演出)',
  svgRules.some((d) => /animation:\s*shardCondense/.test(d)) &&
  !markRules.some((d) => /(^|;)\s*animation\s*:/.test(d)),
  'svg 的规则 ' + svgRules.length + ' 条(有 shardCondense:' +
  svgRules.some((d) => /animation:\s*shardCondense/.test(d)) + ') · 容器的规则 ' +
  markRules.length + ' 条(有 animation:' + markRules.some((d) => /(^|;)\s*animation\s*:/.test(d)) + ')');

const svgCondRule = cssRulesOf('.frost-read__mark svg').join(' ');
ok('★ 凝聚动画平时是【暂停】的(否则第一个关键帧会在拿起时就生效)',
  /animation:\s*shardCondense/.test(svgCondRule) && /animation-play-state:\s*paused/.test(svgCondRule),
  'svg 规则里有 paused:' + /animation-play-state:\s*paused/.test(svgCondRule));
const keptRun = cssRulesOf('.frost-read__mark.is-kept svg').join(' ');
ok('★ 只有 is-kept 才放开它(running)',
  /animation-play-state:\s*running/.test(keptRun),
  keptRun ? 'is-kept svg → running ✓' : '★ 没有 running');
const openBody = /function openShard[\s\S]*?\n    \}/.exec(srcTxt)[0];
const keepBody = /function keepShard[\s\S]*?\n    \}/.exec(srcTxt)[0];
ok('★ openShard(拿起)【不】挂 is-kept —— 收起动画属于 keepShard(收下)',
  !/classList\.add\("is-kept"\)/.test(openBody.replace(/shards\[i\]\.classList\.add\("is-kept"\);?/g, '')) ||
  !/readMark\.classList\.add\("is-kept"\)/.test(openBody),
  /readMark\.classList\.add\("is-kept"\)/.test(openBody) ? '★ openShard 里挂了 is-kept' : 'openShard 没挂 ✓');
ok('★ keepShard(收下)才是挂 is-kept 的地方',
  /readMark\.classList\.add\("is-kept"\)/.test(keepBody),
  /readMark\.classList\.add\("is-kept"\)/.test(keepBody) ? 'keepShard 挂 ✓' : '★ keepShard 里没有');
ok('★ 开卡那一帧把动画按住(内联 animation-name:none),落位后再交还',
  /markSvg\.style\.setProperty\("animation-name", "none"\)/.test(openBody) &&
  /markSvg\.style\.removeProperty\("animation-name"\)/.test(openBody),
  'openShard 里有按住 + 交还');

let pass = 0;
for (const r of rows) { if (r.pass) pass++; console.log('  ' + (r.pass ? '✓' : '✗') + ' ' + r.name + (r.info ? '   [' + r.info + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');

process.exit(pass === rows.length ? 0 : 1);
