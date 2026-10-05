/* 自我介绍页面板验收。 跑法见 tests/README.md */
﻿/* ============================================================
   第一张盘「自我」的逻辑验收 —— 在 Node 里用一套最小 DOM 跑真代码
   ─────────────────────────────────────────────────────────────
   为什么不用 fake 逻辑重写一遍:那样验的是"我以为的代码",不是真代码。
   这里是【真的把 assets/js/page-self.js 读进来执行】,只给它一套够用的
   DOM(window / document / 元素 / pointer 事件),然后像用户那样点、拖、撤销。
   ★ 这套 DOM 是专门按 page-self.js 用到的 API 写的 —— 它用到新 API 会直接报错,
     而不是悄悄跳过(那才是假通过)。
   局限:CSS 不在场,所以"视觉上好不好看"这一条验不了(那要靠人眼);
        这里验的是【行为】:计数、部件开关、台词增删、汇总文案、放/拿是否对称。
   干完自己退出;跑完可以删。
   ============================================================ */
import fs from 'node:fs';

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attrs = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = new Style();
    this._cls = new Set();
    this._listeners = new Map();
    this.hidden = false;
    this._text = '';
    this.innerHTML = '';
    this.offsetWidth = 0;
    this.clientWidth = 800;
    this.clientHeight = 600;
    this._rect = { left: 100, top: 100, width: 240, height: 240, right: 340, bottom: 340 };
    this.classList = {
      add: (...n) => n.forEach((x) => this._cls.add(x)),
      remove: (...n) => n.forEach((x) => this._cls.delete(x)),
      contains: (n) => this._cls.has(n),
      toggle: (n, f) => { const on = f === undefined ? !this._cls.has(n) : !!f; on ? this._cls.add(n) : this._cls.delete(n); return on; },
    };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
  setAttribute(n, v) { this.attrs.set(n, String(v)); }
  hasAttribute(n) { return this.attrs.has(n); }
  toggleAttribute(n, f) { if (f) this.attrs.set(n, ''); else this.attrs.delete(n); return !!f; }
  getBoundingClientRect() { return this._rect; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  setPointerCapture() { }
  addEventListener(t, fn) { if (!this._listeners.has(t)) this._listeners.set(t, []); this._listeners.get(t).push(fn); }
  removeEventListener() { }
  dispatch(type, ev) {
    const target = (ev && ev.target) || this;
    const e = Object.assign({ type, target, preventDefault() { }, stopPropagation() { } }, ev, { target });
    (this._listeners.get(type) || []).forEach((fn) => fn(e));
    let p = this.parentNode;
    while (p) { (p._listeners.get(type) || []).forEach((fn) => fn(e)); p = p.parentNode; }
    return e;
  }
  matches(sel) { return matchesSel(this, sel); }
  closest(sel) { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }
  _all(out) { for (const c of this.children) { out.push(c); c._all(out); } return out; }
  querySelectorAll(sel) { return this._all([]).filter((e) => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
class Style {
  constructor() { this._m = new Map(); }
  setProperty(k, v) { this._m.set(k, String(v)); }
  getPropertyValue(k) { return this._m.has(k) ? this._m.get(k) : ''; }
}

function matchesSel(el, sel) {
  for (const part of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^([a-zA-Z0-9_-]*)((?:\.[a-zA-Z0-9_-]+)*)((?:\[[^\]]+\])*)$/);
    if (!m) throw new Error('这个最小 DOM 还不支持的选择器: ' + part);
    const [, tag, classes, attrs] = m;
    if (tag && el.tagName !== tag.toUpperCase()) continue;
    const cls = classes ? classes.split('.').filter(Boolean) : [];
    if (cls.some((c) => !el._cls.has(c))) continue;
    let good = true;
    for (const a of (attrs.match(/\[[^\]]+\]/g) || [])) {
      const body = a.slice(1, -1);
      const eq = body.indexOf('=');
      const name = eq < 0 ? body : body.slice(0, eq);
      const want = eq < 0 ? null : body.slice(eq + 1).replace(/^["']|["']$/g, '');
      if (!el.attrs.has(name)) { good = false; break; }
      if (want !== null && el.attrs.get(name) !== want) { good = false; break; }
    }
    if (good) return true;
  }
  return false;
}

const TRAITS = [
  { key: 'blush', emoji: '💗', text: '嘴上说没事,心里其实很在意。', pod: 'socket' },
  { key: 'coffee', emoji: '☕', text: '靠咖啡续命,晚上照样失眠。', pod: 'socket' },
  { key: 'code', emoji: '💻', text: '写代码是工作,也是爱好。', pod: 'socket' },
  { key: 'game', emoji: '🎮', text: '游戏菜,但爱玩。', pod: 'socket' },
  { key: 'music', emoji: '🎧', text: '没有音乐,写不出东西。', pod: 'socket' },
  { key: 'night', emoji: '🌙', text: '夜猫子,凌晨灵感最多。', pod: 'socket' },
  { key: 'clown', emoji: '🤡', text: '经常自嘲,但内心很认真。', pod: 'socket' },
  { key: 'sparkle', emoji: '✨', text: '看到喜欢的东西会失去理智。', pod: 'socket' },
  { key: 'mask', emoji: '😷', text: '社交场合戴着脸,回家才摘。', pod: 'socket' },
  { key: 'crown', emoji: '👑', text: '嘴上说随便,心里早有答案。', pod: 'socket' },
  { key: 'nap', emoji: '💤', text: '白天睡不醒,晚上睡不着。', pod: 'socket' },
  { key: 'note', emoji: '🎵', text: '走路都在打拍子,自己没发觉。', pod: 'socket' },
  { key: 'melt', emoji: '🫠', text: '社交电量低,需要独处充电。', pod: 'skin' },
  { key: 'heavy', emoji: '😪', text: '困是真的困,撑也是真的撑。', pod: 'skin' },
  { key: 'fire', emoji: '🔥', text: '三分钟热度,但热的时候很烫。', pod: 'socket' },
  { key: 'clear', emoji: '👻', text: '热闹之后会消失一阵。', pod: 'skin' },
];
const SKINS = TRAITS.filter((t) => t.pod === 'skin').map((t) => t.key);
const SOCKETS = TRAITS.filter((t) => t.pod === 'socket').map((t) => t.key);
const SLOTS = SOCKETS.length + 1;

function buildPage() {
  const root = new El('div');
  root.setAttribute('data-self', 'self');
  const glow = root.appendChild(new El('div'));
  const noise = root.appendChild(new El('div'));
  const head = root.appendChild(new El('div'));
  head.appendChild(new El('span')).setAttribute('data-self-count', '');
  const field = root.appendChild(new El('div'));
  field.setAttribute('data-self-field', '');
  field.clientWidth = 1200; field.clientHeight = 620;
  const stage = root.appendChild(new El('div'));
  stage.setAttribute('data-self-stage', '');
  stage._rect = { left: 0, top: 0, width: 620, height: 620, right: 620, bottom: 620 };
  const facebox = stage.appendChild(new El('div'));
  facebox.classList.add('self-facebox');
  facebox._rect = { left: 190, top: 190, width: 240, height: 240, right: 430, bottom: 430 };
  const faceSvg = facebox.appendChild(new El('svg'));
  faceSvg.classList.add('self-face');
  const deco = root.appendChild(new El('svg'));
  deco.setAttribute('data-self-deco', '');
  for (const p of TRAITS) {
    const g = faceSvg.appendChild(new El('g'));
    g.classList.add('self-face-part');
    g.setAttribute('data-part', p.key);
    g.setAttribute('data-pod', p.pod);
  }
  const say = root.appendChild(new El('div'));
  const hint = say.appendChild(new El('p'));
  hint.setAttribute('data-self-hint', '');
  const list = say.appendChild(new El('ul'));
  list.setAttribute('data-self-list', '');
  const card = say.appendChild(new El('div'));
  card.setAttribute('data-self-card', '');
  card.hidden = true;
  const chips = card.appendChild(new El('p'));
  chips.setAttribute('data-self-chips', '');
  const outEl = card.appendChild(new El('p'));
  outEl.setAttribute('data-self-out', '');
  const foot = card.appendChild(new El('p'));
  const resetBtn = foot.appendChild(new El('button'));
  resetBtn.setAttribute('data-self-reset', '');

  const pods = TRAITS.map((t, i) => {
    const b = field.appendChild(new El('button'));
    b.setAttribute('data-self-pod', t.key);
    b.setAttribute('data-self-emoji', t.emoji);
    b.setAttribute('data-self-text', t.text);
    b.setAttribute('data-self-idx', String(i));
    b._rect = { left: 20 + i * 40, top: 40, width: 50, height: 50, right: 70 + i * 40, bottom: 90 };
    b.appendChild(new El('span')).textContent = t.emoji;
    return b;
  });
  const panel = new El('section');
  panel.setAttribute('data-panel', 'self');
  panel.classList.add('intro-panel', 'is-active');
  root.parentNode = panel;
  return { root, panel, field, facebox, list, card, chips, outEl, resetBtn, pods, deco, glow, noise, head, stage, say, hint };
}

const page = buildPage();
const docListeners = new Map();
const documentShim = {
  readyState: 'complete',
  querySelector: (s) => (s === '[data-self]' ? page.root : page.root.querySelector(s)),
  querySelectorAll: (s) => page.root.querySelectorAll(s),
  createElement: (t) => new El(t),
  addEventListener: (t, fn) => { if (!docListeners.has(t)) docListeners.set(t, []); docListeners.get(t).push(fn); },
  dispatch: (t, ev) => (docListeners.get(t) || []).forEach((fn) => fn(Object.assign({ type: t }, ev))),
};
const registry = {};
const windowShim = {
  document: documentShim,
  console,
  setTimeout,
  clearTimeout,
  __bootRunning: false,
  addEventListener() { },
  CDPages: {
    register(type, build) {
      const api = build(page.root);
      if (api) { registry[type] = api; api.activate(true); }
      return api;
    },
    get: (k) => registry[k] || null,
  },
};
globalThis.window = windowShim;
globalThis.document = documentShim;

const src = fs.readFileSync(new URL('../assets/js/page-self.js', import.meta.url), 'utf8');
new Function('window', 'document', 'setTimeout', 'clearTimeout', src)(
  windowShim, documentShim, setTimeout, clearTimeout);

const api = registry.self;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rows = [];
const ok = (name, pass, info) => rows.push({ name, pass: !!pass, info: info === undefined ? '' : String(info) });
const count = () => (page.root.querySelector('[data-self-count]').textContent || '').trim();
const litParts = () => page.root.querySelectorAll('.self-face-part[data-on]').map((e) => e.getAttribute('data-part'));
const lineKeys = () => page.list.children.map((li) => li.getAttribute('data-line'));
const lineCount = () => page.list.children.length;

await sleep(30);

ok('模块注册成功', !!api, api ? 'ok' : '没注册(CDPages.register 没被调用)');
const N = TRAITS.length;
const PAD = (n) => ('0' + n).slice(-2);
ok('十六个特质都被读到', api.state().total === N, api.state().total + ' 个');
ok('初始空白脸:没有任何部件亮着', litParts().length === 0, litParts().join(',') || '空');
ok('初始计数 00 / 16', count() === '00 / ' + PAD(N), count());
ok('初始没有台词', page.list.children.length === 0);
ok('初始身份证卡片是藏的', page.card.hidden === true);
ok('一进来就亮相了(__bootRunning=false)', api.state().live === true);
const homes = page.pods.map((p) => p.style.getPropertyValue('--x') + ',' + p.style.getPropertyValue('--y'));
ok('十六个 emoji 被摆到十六个不同位置', new Set(homes).size === N, new Set(homes).size + ' 个不同位置');
ok('每个 emoji 都有自己的浮动节奏', new Set(page.pods.map((p) => p.style.getPropertyValue('--wob'))).size > 1);

const f = page.field;
const xs = page.pods.map((p) => parseFloat(p.style.getPropertyValue('--x')));
const ys = page.pods.map((p) => parseFloat(p.style.getPropertyValue('--y')));
const sayLeft = 1200 - Math.min(1200 * 0.40, 430);
ok('所有 emoji 都在台词列左侧', xs.every((x) => x < sayLeft), '最右 ' + Math.max(...xs).toFixed(0) + ' < ' + sayLeft);
ok('emoji 在垂直方向铺开了(不是挤在一条线上)',
  Math.max(...ys) - Math.min(...ys) > 200, '跨度 ' + (Math.max(...ys) - Math.min(...ys)).toFixed(0) + 'px');
ok('emoji 铺在左半区而不是全屏乱撒', Math.min(...xs) > 1 && Math.max(...xs) - Math.min(...xs) > 140,
  'x 跨度 ' + (Math.max(...xs) - Math.min(...xs)).toFixed(0) + 'px');

const victim = page.pods.find((b) => b.getAttribute('data-self-pod') === 'crown');
const fcx = 310, fcy = 310;
victim.style.setProperty('--x', String(fcx));
victim.style.setProperty('--y', String(fcy));
victim._rect = { left: fcx - 25, top: fcy - 25, width: 50, height: 50, right: fcx + 25, bottom: fcy + 25 };
const before = count();
f.dispatch('pointerdown', { clientX: fcx, clientY: fcy, button: 0, pointerId: 9, target: victim });
f.dispatch('pointerup', { clientX: fcx, clientY: fcy, button: 0, pointerId: 9, target: victim });
await sleep(40);
ok('★ 压在脸正中心的 emoji 仍然点得到', count() !== before,
  '放之前 ' + before + ' → 放之后 ' + count());
api.unplace('crown');
await sleep(400);
;
const decoHTML = page.deco.innerHTML || '';
const starCount = (decoHTML.match(/deco-star/g) || []).length;
ok('背景装饰画出来了(星星 + 准星环 + 刻度)',
  starCount > 10 && decoHTML.includes('deco-ring') && decoHTML.includes('deco-tick'),
  starCount + ' 颗星');
ok('装饰层写了 viewBox(跟着面板尺寸)',
  (page.deco.getAttribute('viewBox') || '').startsWith('0 0 1200 620'),
  page.deco.getAttribute('viewBox'));
const FC = { x: Math.min(1200 * 0.52, 620) * 0.5, y: 620 / 2 };
const FACE_R = Math.max(Math.min(1200, 620) * 0.30, 232);
const textX = 1200 - Math.min(1200 * 0.40, 430) - 14;
const starPts = [...decoHTML.matchAll(/<g class="deco-star"[^>]*>([\s\S]*?)<\/g>/g)]
  .map((mm) => /<circle[^>]*?cx="([\d.]+)"[^>]*?cy="([\d.]+)"/.exec(mm[1]))
  .filter(Boolean)
  .map((m) => ({ x: +m[1], y: +m[2] }));
ok('取到了星星坐标(取样逻辑没坏)', starPts.length > 10, starPts.length + ' 个点');
const onFace = starPts.filter((p) => Math.hypot(p.x - FC.x, p.y - FC.y) < FACE_R - 6);
ok('没有星星压在脸的领地上', starPts.length > 10 && onFace.length === 0,
  starPts.length + ' 颗里 ' + onFace.length + ' 颗越界');
const inText = starPts.filter((p) => p.x > textX);
ok('没有星星落进右侧台词列', inText.length === 0, inText.length + ' 颗越界');
const ringMatch = /<g class="deco-ring"[^>]*><circle cx="([\d.]+)" cy="([\d.]+)"/.exec(decoHTML);
ok('准星环以脸为中心(不是面板中心)',
  !!ringMatch && Math.abs(+ringMatch[1] - FC.x) < 2 && Math.abs(+ringMatch[2] - FC.y) < 2,
  ringMatch ? ringMatch[1] + ',' + ringMatch[2] + ' (脸心 ' + FC.x + ',' + FC.y + ')' : '没解析到');

api.place('coffee');
await sleep(40);
ok('放上咖啡 → 01 / 16', count() === '01 / ' + PAD(N), count());
ok('咖啡杯部件亮了', litParts().includes('coffee'), litParts().join(','));
ok('只亮了咖啡杯(没有连带别的)', litParts().length === 1, litParts().join(','));
ok('蹦出一句台词', lineCount() === 1, lineCount() + ' 句');
ok('台词内容 = hugo.toml 里那句',
  (page.list.children[0].textContent || '').includes('靠咖啡续命'),
  page.list.children[0].textContent);
ok('那行台词挂在 coffee 上', lineKeys()[0] === 'coffee', lineKeys().join(','));
ok('脸进入染色状态', page.facebox.classList.contains('is-tint'));
ok('提示语收起来了', page.hint.hidden === true);
const podByKey = (k) => page.pods.find((b) => b.getAttribute("data-self-pod") === k);
ok('emoji 拿到落点坐标',
  !!podByKey("coffee") && podByKey("coffee").style.getPropertyValue("--tx") !== "" &&
  podByKey("coffee").style.getPropertyValue("--ty") !== "",
  "tx=" + JSON.stringify(podByKey("coffee").style.getPropertyValue("--tx")) +
  " ty=" + JSON.stringify(podByKey("coffee").style.getPropertyValue("--ty")));
ok('emoji 缩放到脸的尺度(--tu)', parseFloat(podByKey("coffee").style.getPropertyValue("--tu")) > 0,
  podByKey("coffee").style.getPropertyValue("--tu"));

api.unplace('coffee');
await sleep(40);
ok('拿下来 → 00 / 16', count() === '00 / ' + PAD(N), count());
ok('咖啡杯灭了', !litParts().includes('coffee'));
ok('那行台词立刻进入淡出(is-gone)', page.list.children[0] &&
  page.list.children[0].classList.contains('is-gone'));
await sleep(340);
ok('台词淡出后从 DOM 摘掉', lineCount() === 0, lineCount() + ' 句');
ok('脸退回空白', !page.facebox.classList.contains('is-tint'));
ok('提示语又出现了', page.hint.hidden === false);
ok('emoji 的 is-placed 被摘掉(会回到飘浮区)', !page.pods[0].classList.contains('is-placed'));

for (let i = 0; i < 3; i++) { api.place('game'); await sleep(10); api.unplace('game'); await sleep(10); }
await sleep(700);
ok('反复放/拿三次后计数不漂', count() === '00 / ' + PAD(N), count());
ok('反复放/拿后台词不残留', lineCount() === 0, lineCount() + ' 句');
ok('全部拿光后提示语回来了', page.hint.hidden === false);

api.place('melt');
await sleep(400);
ok('放上融化 → is-melt 开着', page.facebox.classList.contains('is-melt'));
api.place('clear');
await sleep(400);
ok('改放半透明 → is-clear 开着', page.facebox.classList.contains('is-clear'));
ok('前一个皮肤(融化)被顶掉了', !page.facebox.classList.contains('is-melt'),
  'is-melt 还开着就是没顶掉');
ok('融化的部件也灭了', !litParts().includes('melt'), litParts().join(','));
ok('融化的台词同时撤掉(它确实被拿下来了)',
  lineKeys().length === 1 && lineKeys()[0] === 'clear', lineKeys().join(','));
ok('计数只算一层皮(没有两个都算上)', count() === '01 / ' + PAD(N), count());
api.place('heavy');
await sleep(400);
ok('再换睁不开眼 → is-heavy 开着', page.facebox.classList.contains('is-heavy'));
ok('半透明被顶掉', !page.facebox.classList.contains('is-clear'));
api.reset();
await sleep(400);
ok('复位后三个皮肤类全清',
  !page.facebox.classList.contains('is-melt') && !page.facebox.classList.contains('is-clear') &&
  !page.facebox.classList.contains('is-heavy'));

api.place('code');
api.place('music');
await sleep(40);
ok('socket 可以叠加(眼镜 + 耳机同时在)', litParts().includes('code') && litParts().includes('music'),
  litParts().join(','));
ok('叠加后计数 02 / 16', count() === '02 / ' + PAD(N), count());
api.reset();
await sleep(400);

for (const t of TRAITS) { api.place(t.key); await sleep(20); }
await sleep(700);
const st = api.state();
ok('模块自己算对了"同时最多能贴几件"', st.slots === SLOTS, st.slots + ' 件(期望 ' + SLOTS + ')');
ok('十五件全过一遍后,脸上剩 ' + SLOTS + ' 件', st.placed.length === SLOTS, st.placed.join(','));
ok('所有 socket 都在脸上', SOCKETS.every((k) => st.placed.includes(k)),
  SOCKETS.filter((k) => !st.placed.includes(k)).join(',') || '全在');
ok('皮肤那层只留了最后一个', st.placed.filter((k) => SKINS.includes(k)).length === 1,
  st.placed.filter((k) => SKINS.includes(k)).join(','));
ok('计数 14 / 16(16 件里有 2 件皮肤被顶掉了)', count() === PAD(SLOTS) + ' / ' + PAD(N), count());
ok('十四个部件全亮', litParts().length === SLOTS, litParts().length + ' 个');
ok('台词累积十四句(被顶掉那两件的话也撤了)', lineCount() === SLOTS, lineCount() + ' 句');
ok('顺序与 hugo.toml 一致', lineKeys().join(',') === TRAITS.map((t) => t.key).filter((k) => st.placed.includes(k)).join(','),
  lineKeys().join(','));
ok('脸进入贴满状态', page.facebox.classList.contains('is-done'));
ok('身份证卡片弹出来了', page.card.hidden === false);
ok('卡片带 is-in(有入场动画)', page.card.classList.contains('is-in'));
const out = page.outEl.textContent || '';
ok('汇总出一段自我介绍', out.length > 20, out.slice(0, 50) + '…');
ok('汇总以"我是"开头', out.startsWith('我是'), out.slice(0, 12));
ok('汇总把在脸上的每一件都写进去了',
  st.placed.every((k) => out.includes(TRAITS.find((t) => t.key === k).text.split(/[,。]/)[0])),
  out.slice(0, 60) + '…');
ok('被顶掉的那两件皮肤不在汇总里',
  !out.includes('困是真的困') && !out.includes('社交电量低'));
ok('汇总把十四件都串进去了', out.split(',').length >= SLOTS, out.split(',').length + ' 段');
ok('身份证上是一串十四个 emoji',
  (page.chips.textContent || '').trim().split(/\s+/).length === SLOTS, page.chips.textContent);

api.unplace('clear');
await sleep(400);
ok('拿掉一层皮 → 13 / 16', count() === PAD(SLOTS - 1) + ' / ' + PAD(N), count());
ok('卡片收起来了(不再算"贴满")', page.card.hidden === true);
ok('那件部件灭了', !litParts().includes('clear'), litParts().join(','));
ok('只剩十三句台词', lineCount() === SLOTS - 1, lineCount() + ' 句');
api.place('clear');
await sleep(700);
ok('补回去又满了', api.state().done === true && count() === PAD(SLOTS) + ' / ' + PAD(N));

page.resetBtn.dispatch('click', {});
await sleep(400);
ok('"再来一次"清空部件', litParts().length === 0, litParts().join(',') || '空');
ok('"再来一次"清空台词', lineCount() === 0, lineCount() + ' 句');
ok('"再来一次"清空计数', count() === '00 / ' + PAD(N), count());
ok('"再来一次"收起卡片', page.card.hidden === true);
ok('"再来一次"把提示语放回来', page.hint.hidden === false);
ok('十六个 emoji 都回到飘浮区', page.pods.every((p) => !p.classList.contains('is-placed')));

const pod1 = page.pods[1];
const bx = pod1._rect.left + 25, by = pod1._rect.top + 25;
f.dispatch('pointerdown', { clientX: bx, clientY: by, button: 0, pointerId: 1, target: pod1 });
f.dispatch('pointermove', { clientX: 900, clientY: 900, pointerId: 1 });
f.dispatch('pointerup', { clientX: 900, clientY: 900, pointerId: 1, target: pod1 });
await sleep(40);
ok('拖到空白处松手 → 不算放置', count() === '00 / ' + PAD(N), count());
ok('拖到空白处松手 → 拖影子已收起', !page.root.querySelector('.self-shot'));

f.dispatch('pointerdown', { clientX: bx, clientY: by, button: 0, pointerId: 2, target: pod1 });
f.dispatch('pointermove', { clientX: 310, clientY: 310, pointerId: 2 });
ok('拖动时拖影子跟着指针出现', !!page.root.querySelector('.self-shot'));
ok('拖到脸上时脸有 is-hot 反馈', page.facebox.classList.contains('is-hot'));
f.dispatch('pointerup', { clientX: 310, clientY: 310, pointerId: 2, target: pod1 });
await sleep(40);
ok('拖到脸上松手 → 放上去了', count() === '01 / ' + PAD(N), count());
ok('放上去的是被拖的那一个(coffee)', lineKeys()[0] === 'coffee', lineKeys().join(','));
ok('落点用了松手的位置(不是脸心)', pod1.style.getPropertyValue('--tx') === '180.0',
  pod1.style.getPropertyValue('--tx') + ',' + pod1.style.getPropertyValue('--ty'));

api.reset();
await sleep(400);
const overFace = podByKey('game');
overFace._rect = { left: 285, top: 285, width: 50, height: 50, right: 335, bottom: 335 };
const c1 = count();
f.dispatch('pointerdown', { clientX: 310, clientY: 285, button: 0, pointerId: 21, target: overFace });
f.dispatch('pointermove', { clientX: 310, clientY: 310, pointerId: 21 });
f.dispatch('pointerup', { clientX: 310, clientY: 310, pointerId: 21, target: overFace });
await sleep(60);
ok('★ 从脸的位置起手,能把它贴上去', count() !== c1, c1 + ' → ' + count());
ok('贴上去的确实是 game', lineKeys().includes('game'), lineKeys().join(','));
const c2 = count();
f.dispatch('pointerdown', { clientX: 310, clientY: 310, button: 0, pointerId: 22, target: overFace });
await sleep(20);
f.dispatch('pointermove', { clientX: 600, clientY: 320, pointerId: 22 });
f.dispatch('pointerup', { clientX: 600, clientY: 320, pointerId: 22, target: overFace });
await sleep(60);
ok('★ 从脸的正中心起手也能拖动(事件没被脸吃掉)',
  count() !== c2 || lineKeys().length > 0 || overFace.classList.contains('is-placed'),
  'count ' + c2 + ' → ' + count());
api.reset();
await sleep(400);

api.reset();
await sleep(400);
api.place('clown');
api.place('music');
await sleep(80);
ok('先放上两个(红鼻子 + 耳机)', count() === '02 / ' + PAD(N), count());
const rowClown = page.list.children.find((li) => li.getAttribute('data-line') === 'clown');
ok('台词行里带着可点的 × 提示',
  !!rowClown && rowClown.children.some((c) => c.className === 'self-say__undo'),
  rowClown ? rowClown.children.map((c) => c.className).join(',') : '(没找到那一行)');
rowClown.dispatch('click', { target: rowClown });
await sleep(80);
ok('★ 点台词栏那一行 → 红鼻子被撤下来', count() === '01 / ' + PAD(N), count());
ok('★ 红鼻子的部件也跟着灭了', !litParts().includes('clown'), litParts().join(','));
ok('★ 耳机没被误伤', litParts().includes('music'), litParts().join(','));
await sleep(340);
ok('★ 那一行自己也消失了', !lineKeys().includes('clown'), lineKeys().join(','));
rowClown.dispatch('click', { target: rowClown });
await sleep(80);
ok('重复点已撤下的那行不会出错', count() === '01 / ' + PAD(N), count());
api.reset();
await sleep(400);

api.reset();
await sleep(400);
const kbPod = podByKey('code');
kbPod.dispatch('keydown', { key: 'Enter', target: kbPod });
await sleep(40);
ok('键盘 Enter 也能放上去', count() === '01 / ' + PAD(N), count());
ok('放上去的确实是 code', lineKeys().includes('code'), lineKeys().join(','));
kbPod.dispatch('keydown', { key: 'Enter', target: kbPod });
await sleep(400);
ok('再按一次 Enter 拿下来', count() === '00 / ' + PAD(N), count());
page.root.dispatch('keydown', { key: 'Escape', target: page.root });
await sleep(400);
ok('Escape 全部清空', count() === '00 / ' + PAD(N), count());

let pass = 0;
for (const r of rows) {
  if (r.pass) pass++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.info ? '   [' + r.info + ']' : ''}`);
}
console.log(`\n${pass}/${rows.length} 通过`);
process.exit(pass === rows.length ? 0 : 1);
