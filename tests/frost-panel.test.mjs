/* 第五张盘「夜窗 · 极光 · 记忆碎片」的行为验收
   ─────────────────────────────────────────────────────────────
   把 assets/js/page-frost.js 【真读进来执行】,只配一套够用的最小 DOM,
   然后像用户那样:暖窗 → 霜化开 → 点碎片 → 中央读字 → 收下 → 看星图。
   验的是【行为】:化得掉、化了不结回去、字随覆霜量浮出来、收下会变星、
              同主题齐了会连线、全收齐会出现宣言。
   验不了的:好不好看(那要靠人眼 / 光栅化自检,见 README)。
   ★ 这个文件自己踩过的坑都写在注释里 —— 假 DOM 写错会给出假结论。
*/
import fs from 'node:fs';

/* 指针捕获的目标(见 El.setPointerCapture)—— 真实浏览器里由浏览器维护 */
let capture = null;
/* 所有假 ctx:用来断言"画法"(用户报过"像素风格…也不搭") */
const CTXES = [];

/* ---------- 最小 DOM ---------- */
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
    /* ★ _isHidden 是 hidden 属性的镜像,给 getBoundingClientRect 判"这棵子树能不能量"用
       (方法里读 this.hidden 也行,但那样每次量尺寸都要走一遍 getter,
        而且以后有人换成 attribute 写法就会失效 —— 镜像 + setter 更稳)。 */
    this._isHidden = false;
    /* ★ removeProperty 是 CSSOM 的标准方法,浏览器一直有。
       假 DOM 之前只实现了 set/get,于是模块第一次调它就直接 TypeError ——
       而这是"量具不全",不是功能坏了(和早年 fakeCtx 少一个 createLinearGradient 同一个坑)。
       补齐:删掉一个自己设过的属性,并返回它原本的值(和浏览器一致)。 */
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
  /* ★ canvas 改 width/height 等于清空它(浏览器就是这样)—— 记账也要跟着清,
     否则 resize 几次之后,calls.rects 里会混着【以前那几个尺寸】画的东西。
     第一版没清,于是"375 宽那一次画的天"被当成"这一次天上的星星"来判,红了。 */
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
  /* ★ 几何必须【跟着 style 走】:模块是用 style.left/top/width/height 定位的。
     上一版只认 _rect,于是"模块摆好的位置在量具里看不见",
     我曾在"那里根本没东西"的坐标上做判断(测试自己踩过)。
     ★ 但要有办法【强行指定】rect:_forceRect 优先。用来仿真"屏幕被整体缩放",
       因为正常情况下 style 里写了尺寸,_rect 根本不生效(子代理就是靠这条
       发现我那条"缩放"断言其实是空跑的)。 */
  getBoundingClientRect() {
    if (this._forceRect) return Object.assign({}, this._forceRect);
    /* ★★ 第三轮补上的最重要的一条:【display:none 的子树量出来全是 0】。
       浏览器就是这样,而上一版这里返回的是 _rect 的默认值,【从来不返回 0】——
       于是模块里那句
           readEl.hidden = false;  ...  readMark.getBoundingClientRect()
       在真浏览器里恒为 0×0、`if (mb.width > 0)` 恒为假、整个飞行分支一次没跑,
       而 107 条断言全绿。用户的原话是"捡起碎片的动画一点都没做"。
       从今天起,这个量具会像浏览器一样对待隐藏的子树 —— 这一类 bug 才拦得住。
       ★ hidden 是【继承】的:祖先 hidden,后代也量不到(浏览器同理)。 */
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
  /* 模块会用 document.createElement("canvas") 造离屏画布。
     ★ 同一个元素每次 getContext 必须返回【同一个】ctx(浏览器就是这样),
       不然"这一帧画了什么"记账会被分散到好几个对象里,量不到。 */
  getContext() { return this._ctx || (this._ctx = fakeCtx()); }
}

/* 假 canvas 2d:只记账,不真画 —— 我们验的是"化/收"的行为,不是像素。
   ★ 但方法要【齐】:模块把冰晶画成一张静态纹理(线段 + drawImage),
     假 ctx 少一个方法就会把整页带崩 —— 那是"量具不全",不是"功能坏了"。 */
function fakeCtx() {
  const calls = { fillRect: 0, clearRect: 0, stroke: 0, drawImage: 0, putImageData: 0, rects: [], gradients: 0, grads: [] };
  const ctx = {
    calls,
    setTransform() { },
    /* ★ clearRect 时把这一帧的矩形清掉:这样 calls.rects 里就是【当前这一帧】画了什么。
       雪的走向就是靠它量的(对比两帧里同一片雪的位置)。 */
    clearRect() { calls.clearRect++; calls.rects.length = 0; },
    /* ★ 顺手把 fillStyle 也记下来(第 5 个元素):"地面是不是黑色的剪影"
       这种断言只能靠颜色判,而颜色不在坐标里。 */
    fillRect(x, y, w, h) { calls.fillRect++; if (calls.rects.length < 20000) calls.rects.push([x, y, w, h, this._f]); },
    beginPath() { }, moveTo() { }, lineTo() { }, stroke() { calls.stroke++; },
    drawImage() { calls.drawImage++; },
    /* ★ 渐变色:地面剪影是"一块有厚度的暗面",必须用纵向渐变画(纯平涂会像挖空)。
       假 ctx 少了这个方法,整页会在第一帧就带崩 —— 那是"量具不全",不是功能坏了
       (和上面 fakeCtx 开头那段告诫是同一个坑)。 */
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

/* ---------- 搭页面(顺序和 future.html 一致:层次就是这个顺序)---------- */
const LINES = 9;                                   /* 3 主题 × 3 */
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
/* ★★ 这个槽必须【和 future.html 一致】。
   它不是手搭的装饰,而是这个模块和模板之间的【契约】——
   上一版这里我手写了 data-frost-readmark 属性,而真模板里【没有】这个属性,
   于是浏览器里 readMark = null、飞行分支永远不执行,
   而测试全绿(我替被测对象把契约圆了谎)。见下面那条"契约"断言。 */
const readMark = readCard.appendChild(new El('span')); readMark.className = 'frost-read__mark';
readMark._rect = { left: 0, top: 0, width: 96, height: 96, right: 96, bottom: 96 };
const readSvg = readMark.appendChild(new El('svg'));
const readPoly = readSvg.appendChild(new El('polygon')); readPoly.setAttribute('points', '');
const readText = readCard.appendChild(new El('span')); readText.className = 'frost-read__text'; readText.setAttribute('data-frost-readtext', '');
const doneEl = root.appendChild(new El('div')); doneEl.className = 'frost-finale'; doneEl.setAttribute('data-frost-finale', '');
doneEl.setAttribute('aria-hidden', 'true');

/* ---------- 按【真 CSS】给每个元素定 pointer-events ----------
   ★★ 这段拦住的是"测试通过、用户没反应"这类错。
   上一版是拿 layer.dispatch('pointerdown') 直接把事件塞给模块挂载的那个元素 ——
   于是"事件到底能不能到达那个元素"从来没被验过。而在真页面上:
     .frost-shards / .frost-ice / .frost-map / .frost-frame / .frost-head … 全是 none
   → 整页只有 .frost 自己能被指针命中。模块原来却把监听挂在 layer 上,
     结果用户划半天一点反应都没有,而断言全绿。 */
const pagesCss = fs.readFileSync('tuagfey-blog/assets/css/pages.css', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
function peDecl(sel) {                    /* 这个选择器【自己】声明了吗?没声明返回 null */
  const lit = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(lit + '\\s*\\{([^}]*)\\}', 'g');
  let m, val = null;
  while ((m = re.exec(pagesCss))) {
    const d = /pointer-events\s*:\s*([a-z]+)/.exec(m[1]);
    if (d) val = d[1];
  }
  return val;
}
function peOf(sel) { return peDecl(sel) || 'auto'; }   /* 没写就是 auto(浏览器默认)*/
const PE = {
  '.frost': peOf('.frost'), '.frost-scene': peOf('.frost-scene'), '.frost-shards': peOf('.frost-shards'),
  '.frost-ice': peOf('.frost-ice'), '.frost-map': peOf('.frost-map'), '.frost-glints': peOf('.frost-glints'),
  '.frost-frame': peOf('.frost-frame'), '.frost-head': peOf('.frost-head'), '.frost-hint': peOf('.frost-hint'),
  '.frost-read': peOf('.frost-read'),
};
/* ★ 不要手写映射表:页面里每个元素都按【它自己的 class】去真 CSS 里查一遍。
   第一版只给几个元素赋了 _pe,漏掉的(.frost-count)就默认 auto ——
   于是"面板正中按下"命中了那张计数条,断言红,而错的是量具不是页面。
   ★ 而且【只在本类自己声明了 pointer-events 时才记】——
     没声明的元素是按 CSS 规则【继承】父元素的(none 会继承下去)。 */
for (const el of [root, scene, sky, aur, snow, layer, cv, glints, mapEl, head, hint, countEl, readEl, readCard, readText, doneEl, ...shards]) {
  const cls = (el.className || '').split(/\s+/).filter(Boolean)[0];
  if (!cls) continue;
  const v = peDecl('.' + cls);
  if (v) el._pe = v;
}

/* ---------- 命中测试 + 按命中结果派发 ----------
   ★ 命中测试要照浏览器来:
     · [hidden](=display:none)的整棵子树跳过;
     · 元素的 pointer-events 是【内联 > 自己的 class 规则 > 从祖先继承】;
     · ★ 父层是 none【不代表】子树不可命中:子元素只要自己写回 auto 就又能被点到
       (碎片化开之后可点,靠的正是模块写在元素上的那句内联 auto)。
       所以递归要先往下走,再决定"是不是命中它自己"。 */
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
    const deeper = hitTest(c, x, y);        /* 先看更里面的 */
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
/* ---------- 指针 + 浏览器合成 click ----------
   ★★ 这里必须照浏览器来,否则会漏掉一整类"点不动"的 bug:
     浏览器在 pointerup 时合成的 click,目标是【按下目标与抬起目标的最近公共祖先】。
     一旦某处调用了 setPointerCapture,pointerup 会被重定向到捕获元素,
     于是 click 落在祖先上 —— 碎片就永远收不到 click(用户报的"碎片点不动")。
     第一版测试是直接给碎片 dispatch('click'),把这一整条链绕过去了,所以没抓到。 */
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
    /* 合成 click:落在按下与抬起的最近公共祖先上(捕获会把抬起目标换成 .frost)*/
    if (downTarget) {
      const c = commonAncestor(downTarget, target);
      if (c) c.dispatch('click', { clientX: x, clientY: y, target: c });
    }
    downTarget = null;
    capture = null;
  }
  return e;
}
/* 像用户那样点一下:按下 → 抬起(click 由上面合成,不是硬塞给某个元素)*/
function tap(x, y, id) {
  pointer('pointerdown', x, y, id || 7, 'mouse');
  pointer('pointerup', x, y, id || 7, 'mouse');
}

/* ---------- 装 window / document ---------- */
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

const src = fs.readFileSync('tuagfey-blog/assets/js/page-frost.js', 'utf8');
try {
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', src)(
    windowShim, documentShim, setTimeout, clearTimeout, windowShim.requestAnimationFrame);
} catch (e) {
  console.log('★★ 模块装载抛错: ' + (e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n    ') : e));
}

const api = reg.frost;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* ★ frames():跑 n 帧。每帧要等【够长】再跑队列。
   这个模块的循环是 rAF → setTimeout(TICK=40ms) → rAF → …,
   所以每帧之间必须让它那 40ms 的定时器有机会触发 —— 只等 2ms 的话
   队列里是空的,一帧都没跑,而断言会以"功能没生效"的样子红
   (第五张盘又栽了一次:焦点化霜明明打对了地方,却因为没跑帧而读到旧值)。
   ★ 另外每帧先等入队再跑:"清空一次队列就算一帧"会吃掉还没入队的第一帧。 */
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

/* ================= 1. 起来了吗 ================= */
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
/* ★ 这条要在这儿验:下面收完碎片之后计数条当然是满的。
   第一版把它放到收完之后,报出「9 / 9」,我还以为是模块没写初始值。 */
ok('刚进来计数条就写着 0 / N(观众知道要找几片)',
  countEl.textContent.indexOf('0 / ' + LINES) === 0, '「' + countEl.textContent + '」');

/* ================= 2. 交互能不能到达 ================= */
const owners = [];
for (const [name, el] of [['.frost', root], ['.frost-shards', layer], ['canvas.frost-ice', cv]]) {
  if ((el._lis.get('pointerdown') || []).length) owners.push(name);
}
ok('pointerdown 挂在【能被指针命中】的元素上(.frost)', owners.length === 1 && owners[0] === '.frost',
  '实际挂在:' + (owners.join(' / ') || '没有(整页收不到事件)'));
/* ★ .frost-read 是唯一的例外:它是"点开碎片"的读数层,本来就要能点
   (关着的时候靠 [hidden]{display:none} 退出命中,所以不影响下面那条"正中按下")。 */
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

/* ================= 3. 暖化(单向) ================= */
const target = shards[0];
const tb = target.getBoundingClientRect();
const cxp = (tb.left + tb.right) / 2, cyp = (tb.top + tb.bottom) / 2;

/* ★ 先验"隔着霜点不动":碎片这时候是 pointer-events:none,
   浏览器命中到的是 .frost —— 所以点它不该有任何反应。 */
tap(cxp, cyp, 31);
ok('对着还没化的霜点碎片 → 什么也不会发生', api.state().open === -1, 'open=' + api.state().open);

const lb = layer.getBoundingClientRect();
const CELLPX = 7;
const rowYs = [];
for (let r = Math.floor((tb.top - lb.top) / CELLPX); r <= Math.ceil((tb.bottom - lb.top) / CELLPX); r++) rowYs.push(r * CELLPX + 3);
/* ★ 内缩和步长要跟着碎片尺寸走:碎片缩到 ~24px 之后,
   "左右各内缩 20px"会让起止反掉(wx0 > wx1)—— 循环体一次都不执行、
   一个 pointer 事件都不发,断言就以"霜没变化"的样子红。
   量具的几何假设必须跟着被测对象的尺寸变(这是第二次栽在"我的坐标假设"上)。 */
const inset = Math.max(2, Math.min(9, tb.width * 0.28));
const wx0 = tb.left - lb.left + inset, wx1 = tb.right - lb.left - inset;
const stepX = Math.max(7, (wx1 - wx0) / 3);

/* 在那片碎片的位置上来回"暖"几遍(用真的 pointer 事件)*/
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

/* ★ 单向:停手【不会】结回去(上一版是"擦开又结回",这一版推翻了 —— 见模块头注释)*/
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

/* ---- 键盘也能化开(pointer-events 不影响键盘焦点)----
   ★ 这条必须放在"还没收碎片"之前:收下过的碎片不该再被 focus 化开,
     第一版把它放在 collectAll 之后,于是断言红得莫名其妙(其实是我的顺序错了)。 */
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

/* ================= 4. 点开 → 读字 → 收下 ================= */
/* ---- 在碎片上"拖着划"一段,松手不该顺手把它打开 ----
   ★ 这里按下和抬起都在同一片碎片内,所以浏览器【会】在这片碎片上补一个 click ——
     考验的是模块自己那条"按住期间走过超过 6px 就当拖"的判断。 */
pointer('pointerdown', cxp, cyp, 41);
pointer('pointermove', cxp + 18, cyp + 12, 41);
pointer('pointerup', cxp + 18, cyp + 12, 41);
ok('在碎片上拖着划 → 松手不会顺手打开它', api.state().open === -1, 'open=' + api.state().open);

tap(cxp, cyp, 32);
ok('点开一片 → 中央的读数层出现', readEl.hidden === false && readEl.classList.contains('is-on'),
  'open=' + api.state().open);
ok('读数层打开时给根元素挂上 is-reading(碎片从 Tab 顺序里退出去)',
  root.classList.contains('is-reading'));
/* ★★ 用户第二轮说"拾起碎片的动画还是没有",所以动画的【主体】换了:
   以前是读数卡从碎片位置飞过来(FLIP),看起来像一整块面板横扫过屏幕;
   现在是【卡片左边那个槽里的碎片形状】从碎片当时的位置飞进槽里。
   这里验的就是新模型的三件事:
     ① 槽里的多边形 = 这一片碎片的 clip-path(逐顶点照抄,"就是刚才那一片");
     ② 形状被反推到碎片的位置和大小(FLIP 起点);
     ③ 下一帧清掉反推值(过渡打开,它自己飞进槽里)。 */
const markPoly = readMark && readMark.querySelector('polygon');
const shardPoly = target.style.getPropertyValue('clip-path').replace(/^polygon\(|\)$/g, '');
ok('读数卡左边有一个槽(用户:"可以把碎片放在文本框的左侧")', !!readMark,
  readMark ? '有' : '没有');
/* 两边都去掉单位再比:碎片的 clip-path 是 "63.2% 48.4%",SVG 的 points 是
   "63.2 48.4" —— viewBox 就是 0 0 100 100,百分号在这里本来就是单位。
   ★ 不写成"去掉 polygon( 和 )"那种正则:那种写法看着对,实际上漏掉哪一头都
     不会报错,只会让断言莫名其妙地红(第一版就是这么红的)。 */
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
tap(500, 300, 33);                     /* 点中央那张放大的碎片 = 收下 */
await sleep(1600); await frames(3);
ok('收下之后计数 +1', api.state().kept === 1, 'kept=' + api.state().kept);
ok('收下的碎片从霜上消失(is-kept)', target.classList.contains('is-kept'));
ok('计数条写出来了', countEl.textContent.indexOf('/ ' + LINES) > 0, '「' + countEl.textContent + '」');
ok('夜空里多了一颗星', api.state().stars === 1, api.state().stars + ' 颗');
ok('一个主题还没齐 → 不连线', api.state().lines === 0, api.state().lines + ' 条');

/* ================= 5. 集齐一个主题 → 星座 ================= */
api.meltAll();
await frames(2);
ok('全化开之后所有碎片都清楚了', shards.every((_, i) => clearOf(i) > 0.55),
  '最小 clear=' + Math.min(...shards.map((_, i) => clearOf(i))).toFixed(3));
for (const i of [3, 6]) { api.open(i); api.keep(); }
await sleep(1600); await frames(3);
const st = api.state();
/* ★ 连线数不再是"3 条":集齐之后走的是【整条图案】(3 个碎片位 + 4 个伴星位)——
   用户要求"星座多加几颗星星,哪有星座就三颗星的"。所以一个 7 点图案 = 7 条线。 */
ok('集齐一个主题(3 片)→ 星座连线出来了', st.lines >= 6, st.lines + ' 条线');
ok('星星数 = 收下的碎片数(伴星不算在里面)', st.stars === 3, st.stars + ' 颗');
ok('集齐的星座还补了伴星(三颗亮星撑不起一个星座)',
  mapEl.querySelectorAll('.frost-companion').length > 0,
  mapEl.querySelectorAll('.frost-companion').length + ' 颗伴星');
/* ★ 注意 3 和 6 对 3 取模都是 0 —— 它们和第 0 片同属"好奇",
   所以这一组正好把一个主题集齐了。第一版断言写的是"创造 1 片",是我想当然了。 */
ok('主题统计对得上', st.themes['好奇'] && st.themes['好奇'].kept === 3 && st.themes['创造'].kept === 0,
  JSON.stringify(st.themes));

/* ================= 6. 全部收齐 → 宣言 ================= */
api.collectAll();
await frames(3);
const done = api.state();
ok('全部收下 → 宣言出现(is-done)', done.done === true, 'kept=' + done.kept + '/' + LINES);
ok('星星全在夜空里', done.stars === LINES, done.stars + ' 颗');
/* 三个主题 × 每个 7 点图案 = 21 条线(碎片位 3 + 伴星位 4)*/
ok('三块星座都连上了(连线走整条图案,不是只连三颗)',
  done.lines >= 18, done.lines + ' 条线');
ok('三块星座各补了一组伴星',
  mapEl.querySelectorAll('.frost-companion').length === 12,
  mapEl.querySelectorAll('.frost-companion').length + ' 颗伴星');
ok('宣言不再是 aria-hidden', doneEl.getAttribute('aria-hidden') === 'false');

/* ---- 拾起动画的另一半:槽必须是【固定尺寸】的 ----
   ★ 槽的大小要是跟着文字长短走,"飞到左边"这件事每一片的落点都不一样,
     动画就没有"归位"的读法了。CSS 里因此写死了 96px。 */
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



/* ================= 8. 画法(用户报过"像素风格…也不搭") ================= */
const allStrokes = CTXES.reduce((n, c) => n + c.calls.stroke, 0);
const allFill = CTXES.reduce((n, c) => n + c.calls.fillRect, 0);
/* ★ 阈值是"至少几档线",不是固定 5:冰晶按透明度分 5 档,某档这一张图上
   一条线段都没有时会跳过那一次 stroke(密度调低之后就成了 4 次)——
   这不是画法退回去了。 */
ok('冰晶是用线段画的(stroke 被调用)', allStrokes >= 4, allStrokes + ' 次 stroke');
ok('夜空 / 极光 / 飘雪都画了东西', allFill > 200, allFill + ' 次 fillRect');
/* ★ 判据是"数量级",不是"必须为 0":
   · 水滴(paintDrips)本来就画在霜那张画布上,每颗两次 fillRect;
   · 逐格方块那种画法每次重画就是【格子数】级(1000×600 的面板 ≈ 1.2 万格),
     测试里重画了几十次 → 会是几十万次。
   所以 2000 这个分界线既能拦住旧画法,也不会误伤水滴。 */
ok('主画布上没有逐格方块(旧"像素风"画法会是几十万次)', mainCtx.calls.fillRect < 2000,
  mainCtx.calls.fillRect + ' 次 fillRect(只该是水滴;逐格画法一次就是 ' + (1000 / 7 | 0) * (600 / 7 | 0) + ' 次)');
ok('主画布每帧两次 drawImage(贴纹理 → 用覆霜场裁切)',
  mainCtx.calls.drawImage >= 2 && mainCtx.calls.drawImage % 2 === 0,
  mainCtx.calls.drawImage + ' 次 drawImage');

/* ================= 8. 触摸:按住才暖,松手就停 =================
   ★ 这是一个真 bug 的回归测试:onUp 原来只把 pressing 放掉,
     warm.on 留着 —— 手指抬起来之后,霜在那个点继续化、水滴继续掉。 */
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

/* ================= 9. 键盘:焦点 = 呵一口气 =================
   (已经在上面验过了 —— 放在"收碎片"之前,因为收下过的碎片不该再被 focus 化开)*/

/* ================= 10. 窄屏(手机)==================
   ★ 12 片碎片要在一块 375×660 的窗上摊开,不能出界、不能叠、
     也不能小到点不着。布局算法是"撒点 + 约束",这种尺寸最容易露馅。 */
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

/* ================= 12. 用户第二轮提的几条 =================
   碎片再小一倍 / 爆闪改在碎片边缘的一点 / 天上不该有背景星 / 地面要看得见 /
   星座不能都长一个样 / 坐标不能被屏幕缩放带偏。 */
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

/* ---- 爆闪:在碎片【边缘】的某个点上,不是盖住碎片的大光晕 ---- */
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

/* ---- ★ 天上的星星是收下碎片后才出现的 ----
   判据很直接:地平线【以上】只该有整幅宽的渐变带;任何"窄条的方块"都是星星。 */
const skyRects = sky.getContext().calls.rects;
const HOR = 600 * 0.735;
/* ★ 地平线是【起伏的】(三个正弦叠起来,最高能比基准线高约 25px),
   所以判"天上干不干净"要往上看过那段起伏,不能正好卡在基准线上 ——
   第一版卡在基准线上,把 135 笔"坡顶"当成了星星。 */
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
/* 下面两段(dpr / 屏幕缩放)要用到雪的落点,先取一份快照 */
const snowR = snow.getContext().calls.rects;

/* ================= 12. 设备像素比(dpr)—— 子代理只读排查出来的真 bug =================
   ★ 模块原来给霜那张画布写的是 sizeCanvas(cv, W*dpr, H*dpr),而那会【同时】把
     CSS 盒子也写成 W*dpr —— 在 dpr=2 的屏幕上画布变成面板的两倍大(只露左上四分之一)、
     一格从 7px 变成 14px,而 zone / melt / covAt 全按 7px 算:
     症状就是用户说的"霜在光标底下化了,可底下那片字不亮、点不动"。
   ★ dpr=1 永远看不出这个错,所以这一段把 shim 的 devicePixelRatio 改成 2 再重建。
     位置放在这里(面板刚冻结、没有残留水滴),读数才干净。 */
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
/* 光标压在某一篇碎片中心划十几下 → 那一片必须亮起来(zone 与 melt 用同一套格子)*/
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
/* ★ 判据是"铺满整块画布",不是"一笔都不许出界":柔和的点会向外伸出星芒(±8px),
   而出界的判断标准是【铺开的范围】—— 位置/半径/卷回边界三套 dpr 混用时,
   雪花会全部挤在左上四分之一(旧代码就是这样)。 */
const xs0 = snowR.map((r) => r[0]);
ok('dpr=2:雪花铺满整块画布(位置与半径用同一套设备像素)',
  snowR.length > 50 && Math.min(...xs0) < 100 && Math.max(...xs0) > 1900,
  snowR.length + ' 笔,x 范围 ' + Math.round(Math.min(...xs0)) + '..' + Math.round(Math.max(...xs0)) + '(画布宽 2000)');
windowShim.devicePixelRatio = 1;
api.repaint();
api.freezeAll();
await frames(2);

/* ================= 13. 屏幕被整体缩放时,光标位置不能偏 =================
   仿真:强行说 canvas 的视觉尺寸是 1.6 倍(_forceRect —— 不用它的话 _rect 会被
   style 里的尺寸盖掉,断言就是空跑的,子代理一眼看出来了)。
   判据:"融化落在内部中心",而且【视觉坐标那个点不能被化开】。
   ★ 面板此刻是干净的(上面刚 freezeAll),所以可以用绝对读数。 */
cv._forceRect = { left: 0, top: 0, width: 1600, height: 960, right: 1600, bottom: 960 };
pointer('pointerdown', 800, 480, 61, 'mouse');   /* 视觉中心 ↔ 内部 (500,300) */
pointer('pointerup', 800, 480, 61, 'mouse');
await frames(1);
ok('屏幕被缩放时,融化落在光标真正对应的格子上(而不是视觉坐标那个点)',
  api.covAt(500, 300) < 0.98 && api.covAt(800, 480) > 0.99,
  '内部中心 ' + api.covAt(500, 300) + '(应被化开),视觉那点 ' + api.covAt(800, 480) + '(应还是 1)');
cv._forceRect = null;

/* ================= 14. 这一轮用户提的融化机制 + 地面 + 碎片形状 ================= */

/* ---- 前置停留:悬停要待够 0.25 秒才开始化 ----
   用户:"融化的判定最好加个前置时间,鼠标靠近大于 0.25 秒才能开始融化,
        不然开幕就会有一小部分开始融化了"。 */
api.freezeAll();
await frames(1);
const px = 300, py = 300;
pointer('pointermove', px, py, 81, 'mouse');
await frames(1);                       /* 每帧 55ms —— 一帧还远不到 250ms */
ok('刚靠近(不到 0.25 秒)不会开始化', api.covAt(px, py) > 0.99, 'covAt=' + api.covAt(px, py));
await frames(6);                       /* 再等 ~330ms */
ok('停留超过 0.25 秒之后才开始化', api.covAt(px, py) < 0.99, 'covAt=' + api.covAt(px, py));
/* ---- 融化半径:用户说"范围还可以再小一点" ---- */
ok('融化范围收紧了(80px 之外不受影响)', api.covAt(px + 80, py) > 0.99,
  '80px 外 covAt=' + api.covAt(px + 80, py) + '(WARM_R=62)');
/* ---- 水滴不再替用户化霜 ----
   用户:"鼠标放上去,那下面的一长串全会融化" —— 那是水滴一路往下 melt 拉出来的水痕。 */
root.dispatch('pointerleave', { target: root });
await frames(4);
const frostBeforeIdle = frost();
const dropsAlive = api.state().drops;
await frames(14);                      /* 让水滴继续掉一会儿 */
ok('★ 松手之后水滴不再继续化霜(那"一长串"就是它拉的)',
  frost() >= frostBeforeIdle - 1e-6,
  '水滴 ' + dropsAlive + ' 颗;frost ' + frostBeforeIdle + ' → ' + frost());

/* ---- 碎片要有凹口,不能全是凸的(用户:"碎片的变形只有凸没有凹")---- */
const radiiOf = (str) => [...String(str).matchAll(/([\d.]+)% ([\d.]+)%/g)]
  .map((m) => Math.hypot(parseFloat(m[1]) - 50, parseFloat(m[2]) - 50) / 50);
const allR = shards.flatMap((s) => radiiOf(s.style.getPropertyValue('clip-path')));
ok('碎片有凹进去的顶点(半径 < 0.45 的缺口)', allR.filter((r) => r < 0.45).length >= 3,
  '最深 ' + Math.min(...allR).toFixed(2) + ',共 ' + allR.filter((r) => r < 0.45).length + ' 个凹顶点');

/* ---- 地面是"黑色的剪影"(用户:"地面太丑了,做成黑色的剪影。现在跟海面一样")----
   判据:地平线【以下】那些按列铺的矩形,颜色都得是近黑。 */
const skyAll = sky.getContext().calls.rects;
const HOR2 = 600 * 0.80;
/* ★ 要分开判两件事:
   ① 剪影【本体】(高度 > 3px 的那些)必须是近黑 —— 这是"做成黑色剪影"的要求;
   ② 山脊上那道冷光允许亮,但必须【极细】(≤2px),否则又变成"水面反光"那条亮带。 */
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
/* ★ 这一条是【第二次】改地面时换掉的。
   原来验的是"山脊上那道 1px 冷光必须很细"—— 那是在验错的东西:
   用户第二次的原话是"地面的剪影就是一条线",而那道冷光【正是】那条线。
   细不细根本不是重点,重点是不该有它。
   现在验的是剪影【立不立得住】:一层遥远的山脊(比夜空亮)+ 一层近处的剪影
   (近黑),两层都铺满整幅宽 —— 有前后两层,才有"远处"的读法。 */
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
/* 山脊必须【起伏】:同一层里最低和最高的脊线要拉开距离,水平线读不出"山" */
const ridgeTops = groundLit.filter((r) => r[2] < 40).map((r) => r[1]);
const spread = ridgeTops.length ? Math.max(...ridgeTops) - Math.min(...ridgeTops) : 0;
ok('山脊是起伏的,不是一条水平线(峰谷差要够大)',
  spread > 20, '峰谷差 ' + spread.toFixed(0) + 'px(面板高 600)');
/* ★★ 这一条是"剪影就是一条线"的【正面】判据。
   上一版的山脊振幅只有 0.045H(600px 上 27px,而用户的 390px 面板上只剩 17px),
   在地平线附近就是一"条"。所以这里不能只判"有没有起伏"(上面那条已经有了),
   要判【高出地平线多少】以及【占画面高的比例】。
   ★ 阈值为什么是 ≥2% 而不是更高:山脊高度有硬上限 —— .frost-hint 那行提示语
     的顶端约在 0.817H,山脊高过它就从"地面"变成"压在提示语上的黑影"。
     0.80H(地平线)到 0.817H 之间只剩 1.7%H 的余量,所以"高出地平线 2% 以上"
     已经是这个面板尺寸下能给到的最大值附近。这不是将就,是版面约束。 */
const HOR_ = 600 * 0.80;
const ridgeAbove = HOR_ - Math.min(...ridgeTops);
ok('★ 山脊真的高出地平线一截(不是贴着地平线的一条线)',
  ridgeAbove > 0.02 * 600,
  '最高处高出地平线 ' + ridgeAbove.toFixed(0) + 'px = 画面高的 ' + (ridgeAbove / 600 * 100).toFixed(1) +
  '%(要求 ≥2%:再高会顶到提示语)');
/* ★ 远 / 近的纵深是【色调】给的,不是高度 —— 实测:远脊亮度 37、近脊 12、天空 18。
   所以这里判的是"两种亮度都在、而且远脊更亮",不是"远脊更高"
   (第一版我写的就是"远脊要比近脊高",量出来两者同高 —— 判据本身就错了)。 */
ok('远脊是另一档亮度(远近靠色调层次读出来,不是靠高度差)',
  ridgeFar.length > 20 && ridgeNear.length > 20 &&
  Math.max(...ridgeFar.map((r) => lum255(r[4]))) > Math.min(...ridgeNear.map((r) => lum255(r[4]))) + 10,
  '远脊最亮 ' + (ridgeFar.length ? Math.max(...ridgeFar.map((r) => lum255(r[4]))).toFixed(0) : '-') +
  ' vs 近脊最暗 ' + (ridgeNear.length ? Math.min(...ridgeNear.map((r) => lum255(r[4]))).toFixed(0) : '-'));

/* ---- 星座:必须是三个【固定样式】的手绘图案 ----
   ★★ 用户第二轮把这条列为最大的问题:"实在不行做成固定样式的,
      反正不能像现在这样随便连线"。
   ★ 这条断言因此换了对象。原来它量的是"三颗亮星两两之间的距离比"——
      那个量的是【碎片落在哪三个点上】,不是【图案长什么样】;
      而且它量不出"随便连线"这个病:把三个点绕圈连,一样是这个结果。
      现在直接读模块源码里的 PATTERNS:图案、连线表、碎片位都得是写死的。 */
const srcTxt = fs.readFileSync('tuagfey-blog/assets/js/page-frost.js', 'utf8');
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
    return !has(n - 1, 0);                       /* 最后一个点不回连第一个点 */
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
    return sides[0] > all[0] * 1.15;             /* 最短的那条碎片连线不能是"最近的挨着" */
  }),
  PATTERNS_SRC.map((p) => p.name + ':' + JSON.stringify(p.shard)).join(' '));
/* 形状确实三套不一样(现在是拿【图案本身】比,不是拿碎片落点比)*/
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

/* ★★ 极光的下缘必须停在【山脊之上】。
   原因不是审美,是画布顺序:.frost-aurora(z-index 2)在 sky(1)【之上】——
   地面是画在 sky 上的,所以极光只要低到山脊的高度,就会盖在山脊【前面】,
   看着像"发光的雾漫过了山"。
   ★ 两边的数必须用【同一套归一化】比:极光的下限是比例(alt/0.80),
     所以山脊也得按地平线归一算,不能拿上面那条在 600px 画布上量的像素数来比 ——
     第一版就是这么混着比,得出"不满足"的假结论。山脊振幅直接读源码里的三个系数。 */
/* ★★ 地平线这一个数被【三处】依赖,而且必须完全一致 ——
   不一致的症状是"极光/地面各按各的地平线画",看起来像两层没对齐的贴纸。
   三处:buildSky 的 HOR、buildAurora 的 HZ、CSS 里 .frost-ground 的 height。
   (第三轮我把 HOR 从 0.80 抬到 0.73 时,就是靠这一条发现 CSS 那层还写着 28%。) */
const HZ_SRC = Number((/var HOR = DH \* ([0-9.]+)/.exec(srcTxt) || [])[1]);
const HZ_AUR = Number((/var HZ = ([0-9.]+)/.exec(srcTxt) || [])[1]);
const groundCss = pagesCss.slice(pagesCss.indexOf('.frost-ground {'), pagesCss.indexOf('.frost-shards'));
const HZ_CSS = Number((/height:\s*([0-9.]+)%/.exec(groundCss) || [])[1]);
/* ★ 这里原来有一条断言在守护【手写那版极光】的一个数(地平线在三处【一致】(JS 的天 / JS 的极光 / CSS 的地面层))。
   那段代码整段删掉了(用户第五、六轮:"样式也用那个,直接照搬"、"为什么老极光还没删"),
   它的常量(HZ / MIN_ALT / BASE)在源码里已经不存在 —— 留着就是永久假红。
   现在的极光是着色器渲染的【整幅天空】,构图由那份 GLSL 决定,
   不再是这里能钉住的数(能钉的只有"它有没有接上",见后面那一节)。 */
const bdFloor = /var MIN_ALT = ([0-9.]+)/.exec(srcTxt);
/* ★ 画面高度 = (1 - alt) * H,alt=0 是地平线 ⇒ 极光的 hem 在 (1-MIN_ALT)*H。
   ★ 第一版我把这个数当"低于地平线多少"来解释,算式对、读法错 ——
     量出来的数必须用和它同一个坐标系的话去说。 */
const auroraLow = 1 - Number(bdFloor && bdFloor[1]);
/* ★★ 山脊峰值:【把那段函数抠出来真的跑一遍】,不用正则去数正弦项。
   为什么换掉正则:buildSky 里实际有【五组】正弦(近脊三组 + 远脊两组),
   我第一版的正则只抓前三个 —— 于是"山脊最高"少算了 3.5%H,
   断言报出一个根本不存在的矛盾,我又为此改了两次参数。
   ★ 这是这个项目里第三次栽在"用模式匹配去理解代码"上
     (前两次:模糊片段定位把 744 行换掉、注释里的字样被当成代码)。
     规矩:能 eval 就别 parse。 */
function ridgePeakY() {
  const fnSrc = srcTxt.slice(srcTxt.indexOf('function groundTop'),
    srcTxt.indexOf('return HOR + h * DH;') + 'return HOR + h * DH;'.length);
  const clean = fnSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '') + '\n}';
  const HOR = 390 * HZ_SRC;
  const f = new Function('x', 'DW', 'DH', 'HOR', clean + '\nreturn groundTop(x, false);');
  let top = Infinity;
  for (let x = 0; x < 1024; x += 2) top = Math.min(top, f(x, 1024, 390, HOR));
  return top / 390;                       /* 换算成画面高度比例 */
}
const ridgeMax = ridgePeakY();
/* ★ 极光必须【抬到上半屏】—— 用户第三轮的原话:
   "极光的位置不对,现在在星空的下半边,应该在上半边"。
   ★ 判据不是"峰值 < 0.5H"(第一版就是这么写的,把自己写红了):
     帘子是一条【有长度】的东西,它的峰值落在 0.5H 附近是正常的,
     关键在【质量落在哪一边】。所以按实际曲线(|A| 的纵向分布)称一下重心。 */
const BASE_SRC = Number((/var BASE = ([0-9.]+)/.exec(srcTxt) || [])[1]);
const HZ_ = HZ_SRC, TOP0_ = 1 - (0.39 - HZ_) / (1 - HZ_), TOP1_ = 1 - (0.02 - HZ_) / (1 - HZ_);
let wSum = 0, wTop = 0;
for (let k = 0; k <= 400; k++) {
  const alt = k / 400;
  const rel = alt - (BASE_SRC - 0.04);
  if (rel <= 0 || alt <= 0) continue;
  const A = (0.12 + 0.88 * Math.exp(-rel * 3.0)) * (1 - Math.min(1, Math.max(0, (alt - TOP0_) / (TOP1_ - TOP0_))));
  const y = 1 - alt;                       /* 画面高度:alt=0 在地平线 */
  wSum += A; if (y < 0.5) wTop += A;
}
const massTop = wSum ? wTop / wSum : 0;
/* ★ 这里原来有一条断言在守护【手写那版极光】的一个数(极光的质量落在【上半屏】(用户:"应该在上半边"))。
   那段代码整段删掉了(用户第五、六轮:"样式也用那个,直接照搬"、"为什么老极光还没删"),
   它的常量(HZ / MIN_ALT / BASE)在源码里已经不存在 —— 留着就是永久假红。
   现在的极光是着色器渲染的【整幅天空】,构图由那份 GLSL 决定,
   不再是这里能钉住的数(能钉的只有"它有没有接上",见后面那一节)。 */
/* ★ 这里原来有一条断言在守护【手写那版极光】的一个数(极光的下缘停在山脊之上(否则极光会画在山的前面))。
   那段代码整段删掉了(用户第五、六轮:"样式也用那个,直接照搬"、"为什么老极光还没删"),
   它的常量(HZ / MIN_ALT / BASE)在源码里已经不存在 —— 留着就是永久假红。
   现在的极光是着色器渲染的【整幅天空】,构图由那份 GLSL 决定,
   不再是这里能钉住的数(能钉的只有"它有没有接上",见后面那一节)。 */
/* 地面【有厚度】才画得出山:用户三次说"地面剪影就是一条直线",
   前两次我都在改脊线形状,真正的原因是地面太扁。这一条判的是厚度本身。 */
const groundH = HZ_CSS / 100;      /* CSS 那层写 height:27% ⇒ 地面就是面板的 27% */
ok('★ 地面占画面的比例够画山(不是贴着底边的一条窄带)',
  groundH >= 0.25,
  '地面占 ' + (groundH * 100).toFixed(0) + '%H(要求 ≥25%;上一版只有 20%,390px 上 78px,画不出山)');
/* ★★ 山脊必须【立在地平线之上】。
   这是"地面剪影就是一条直线"最直接的判据,也是我前三轮一直没查的地方:
   我量过振幅、量过对比、量过厚度,就是没量过"峰到底有没有高出地平线"。
   量出来的真相是:三组正弦的峰正好错开,叠加后最高只到 75.1%H ——
   而地平线在 73.0%H,也就是说山脊【从来没有高出过地平线】,
   它只是在地平线下面起伏。一条平的天际线 + 一条起不来的脊 = 一条线。
   (把三组相位整体平移 -1.6 弧度之后,峰到了 60.7%H。) */
const ridgeAbove2 = (HZ_SRC - ridgePeakY()) * 100;
ok('★ 山脊的峰真的高出地平线(不是只在地平线下面起伏)',
  ridgeAbove2 > 3,
  '峰高出地平线 ' + ridgeAbove2.toFixed(1) + '%H(要求 >3%;修之前是 -2.1%,即峰在地平线【下面】)');

/* ★★ 星图的层高是【量出来的】:星座的像素框横跨窗框的横梁
   (1024×390 上:北斗 y63..171、猎户 y8..156、仙后 y43..184,横梁在 0.34H=133),
   星图在窗框之下的话,连线会被横梁切断。所以它必须在窗框之上、
   但在读数卡和宣言之下。这一条把它钉住,免得以后有人"顺手"把它调回去。 */
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
/* 星座必须真的横跨横梁 —— 否则上面那条"量出来的理由"就不成立了 */
ok('★ 星座确实横跨窗框的横梁(所以上面那条层高不是多余的)',
  PATTERNS_SRC.every((p, i) => {
    const s = 163.8, W = 1024, H = 390;              /* 用户面板的实算尺度 */
    const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const ox = [0.19, 0.52, 0.81][i] * W - (mnx + mxx) / 2 * s;
    const oy = [0.30, 0.21, 0.29][i] * H - (mny + mxy) / 2 * s;
    const y0 = oy + mny * s, y1 = oy + mxy * s, bar = H * 0.34;
    return y0 < bar && y1 > bar;
  }), '三套都跨过 y=' + (390 * 0.34).toFixed(0) + 'px 那条横梁');

/* ---- 雪:斜着飞、快一点、大一点 ----
   ★ 量的是【真画出来的位置】:同一个 canvas 的 ctx 每帧的 fillRect 会被清空重记。
     ★ 不能假设"每片雪画几笔"—— 一个柔和的点要 4~6 笔(见模块的 softDot),
       笔数还会随大小变。所以改成:拿上一帧的每一笔,去下一帧里找最近的一笔,
       取位移的中位数。这样笔数怎么变都测得准(第一版按"每片两笔"下标配对,
       改了画法之后它就开始说谎)。 */
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
  if (!best || bd > 24) continue;          /* 卷回屏幕另一头的那些不算 */
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

/* ================= 12. 浅色模式 =================
   ★ 这一页永远是一扇【夜里的窗】:每个颜色都压在"这一页自己画的那个面"上,
     跟 data-theme 无关。所以检查方式不是"浅色模式下对比度够不够",
     而是"这一页的样式里有没有 data-theme 分支" —— 有分支才需要担心。
     (对照:第一张盘 .self 的底色跟着屏幕走,所以它【必须】有浅色覆写。
      判断依据是"这个颜色压在什么面上",不是"现在是什么主题"。) */
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
/* ================= 7. 契约:量具和真模板必须一致 =================
   ★★★ 这一节是为一个【测试全绿、功能从没运行】的 bug 补的。
   上一版:JS 用 q("[data-frost-readmark]") 找那个槽,而 future.html 里的 span
   只有 class="frost-read__mark"、没有这个属性 ——
   浏览器里 readMark 恒为 null,飞行分支永远不执行;
   而我的假 DOM 手写了那个属性,于是 111 条断言全绿。
   **量具替被测对象把契约圆了谎** —— 这比断言写错更隐蔽:
   契约错了以后,每一行代码看起来都是对的。
   所以这里做一件事:把模板里真实的选择器抠出来,逐个和模块里用到的对齐。 */
const tpl = fs.readFileSync('tuagfey-blog/layouts/partials/pages/future.html', 'utf8');
/* 模块用到的每一个"取元素"的选择器 —— 从源码里扫出来,不靠人肉维护。
   ★ 必须【先去掉注释】再扫:注释里会提到选择器的历史(比如"这里曾经是
     q(\"[data-frost-readmark]\")"),不剥掉的话扫到的是【散文】不是代码 ——
     第一版就是这么假红的(同一个坑的第四次:用模式匹配去理解代码)。 */
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
/* 那个槽:必须同时满足"模板里有 class"和"模板里别再冒出别的属性名" */
ok('★ 读数卡的槽:模板用 class,模块也按 class 找(上一版就是这里对不上)',
  /class="frost-read__mark"/.test(tpl) && srcTxt.includes('q(".frost-read__mark"'),
  'future.html 有 class="frost-read__mark" · JS 里有 q(".frost-read__mark")');


/* ================= 13. 极光:直接跑用户给的那份 GLSL =================
   ★★★ 用户原话:"算了,你样式也用那个,直接照搬,你这个什么玩意。"
   所以极光不再是 canvas 上手写的 2D 噪声场,而是 assets/shaders/aurora.glsl
   那一份【原样照搬】的着色器(由 boot-glsl.js 这个 Shadertoy 宿主跑)。
   这一节钉三件事:文件在、模板把它注入进来了、模块里接上了。
   ★ 为什么不能更用力地验:着色器能不能【编译】只有 WebGL 说得准,
     这个环境里没有浏览器 —— 所以这里只验"接线的两端都接上了",
     真正的编译结果只能靠用户打开页面看控制台(有 [boot-glsl] 编译失败 会打警告)。 */
const aurPath = 'tuagfey-blog/assets/shaders/aurora.glsl';
const aurSrc = fs.existsSync(aurPath) ? fs.readFileSync(aurPath, 'utf8') : '';
ok('★ 极光 GLSL 在仓库里', aurSrc.length > 1000, aurSrc.length + ' 字符');
ok('★ 极光那份算法【原样保留】:fbmAurora / aurora 都在',
  /float fbmAurora\(/.test(aurSrc) && /vec4 aurora\(/.test(aurSrc) &&
  /tri2\(/.test(aurSrc) && /mm2\(/.test(aurSrc),
  'fbmAurora / aurora / tri2 / mm2 都在');
/* ★★★ 这一条是第七轮的核心:那份 shader 是【一整幅风景】,不是纯极光。
   用户:"你能不能看好了再抄?那份代码根本就不是纯净的极光模拟。"
   我上一版把整份铺上来,于是把别人的【地形、云海、相机】画进了这扇窗。
   所以现在必须验:场景那一半【真的不在】了 ——
   map / raymarch / setColor / 地形 fbm / 星空 / 光照,一个都不许剩。 */
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
/* 也不许再有"改人家相机"那种补丁:上一版我加了 CAM_PITCH 去掰原作者的镜头 */
ok('★★ 没有再改原作者的相机(上一版加的 CAM_PITCH 补丁已删)',
  !/CAM_PITCH/.test(aurSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
  /CAM_PITCH/.test(aurSrc.replace(/\/\*[\s\S]*?\*\//g, "")) ? '★ CAM_PITCH 还在代码里 —— 那是"在别人的画上挪镜头"' : '代码里没有相机补丁 ✓(注释里提它的历史是对的)');
/* 这一层是【黑底上的发光层】,所以那一层必须回到 screen 混合 */
ok('★ 极光层是黑底发光 ⇒ 必须 mix-blend-mode: screen(黑=没画)',
  /\.frost-aurora\s*\{[^}]*mix-blend-mode:\s*screen/.test(pagesCss),
  /\.frost-aurora\s*\{[^}]*mix-blend-mode:\s*normal/.test(pagesCss)
    ? '★ 还是 normal —— 那是"它画整幅天"时的写法,现在黑底会被画成黑板' : 'screen,对了');
/* 宿主(boot-glsl.js)提供 iTime,不提供 u_time —— 所以正文里必须是 uTime。
   ★ 必须【先剥掉注释】再扫:这份文件的头注释里就写着"u_time → uTime"这段历史,
     不剥的话扫到的是散文 —— 这个坑在这个项目里已经踩过两次(契约那一节同理)。 */
const aurCode = aurSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('★ 适配点只有一处:u_time → uTime(宿主里没有 iTime 这个名字)',
  !/\bu_time\b/.test(aurCode) && /\buTime\b/.test(aurCode) && !/\biTime\b/.test(aurCode),
  /\bu_time\b/.test(aurCode) ? '代码里还留着 u_time(宿主不认识,会编译失败)'
    : (/\biTime\b/.test(aurCode) ? '代码里有 iTime(宿主里没这个名字)' : '已换成 uTime'));
ok('★ 入口交给宿主:文件里不写 main(),宿主会补 mainImage 的调用',
  !/void\s+main\s*\(\s*\)/.test(aurSrc) && /void mainImage\s*\(/.test(aurSrc),
  /void\s+main\s*\(\s*\)/.test(aurSrc) ? '文件里自己写了 main()' : '没有 main(),由宿主补');
/* ★ 这份模板在启动页占住站点根之后搬到了 /home/(见 content/home/_index.md)。 */
const idxTpl = fs.readFileSync('tuagfey-blog/layouts/home/list.html', 'utf8');
ok('★ 模板把它注册进 window.__SHADERS(aurora)',
  /auroraGlsl := resources\.Get "shaders\/aurora\.glsl"/.test(idxTpl) &&
  /aurora: "\{\{ with \$auroraGlsl/.test(idxTpl),
  'index.html 里有 resources.Get + __SHADERS.aurora');
ok('★ 模块里接上了:preload + 每帧 render(拿不到就退回手写那版)',
  srcTxt.includes('CDBootGlsl.preload("aurora"') && srcTxt.includes('CDBootGlsl.render("aurora"') &&
  srcTxt.includes('__SHADERS && window.__SHADERS.aurora'),
  'preload / render / __SHADERS.aurora 三处都有');
/* ★ 这里原来有一条断言写着"那一层必须 mix-blend-mode: normal(因为它画的是整幅天空)"。
   那是第五轮的结论 —— 当时我把整份风景 shader 铺在了窗上,所以它当然要 normal。
   第七轮改成【只画极光】(黑底上的发光层)之后这条不成立了:
   黑底 + normal = 一块黑板,必须回到 screen。上面那条断言已按新语义钉住,这里留说明。 */

/* ================= 14. 黑屏那层:不许有"常驻黑底" =================
   ★★★ 这一节是为一个用户报了三轮、而我们一直找错方向的 bug 补的。
   症状("开场动画结束后有一段黑屏 / 大雪花飞过的地方还有黑遮挡"),
   真因不在 JS 的时序里,而在 CSS 的【层叠顺序】:

       html.frame-fitted .screen-static { background: #04060a; }   ← 常驻黑底
       .screen-static.is-black         { background: #04060a; }   ← 该黑的时候才黑

   第一条的 specificity 是 (0,2,1),压过第二条的 (0,2,0),而且【颜色一模一样】——
   于是"移除 is-black"这件事在视觉上什么都没发生:黑底一直在。
   而五套开机动画的收尾全靠把 canvas 擦成透明来露出页面
   (未来 = destination-out 扫线、成长 = 逐格缩没、迷茫 = 圆形清除、
    技术 = 横带飞走、自我 = 脸掉出屏幕),
   透明像素看到的就是【这一层自己的背景】—— 常年黑,所以擦出来的还是黑。

   ★ 判据因此写成"结构性质"而不是"某一条规则长什么样":
     在任何会命中 .screen-static 的规则里,background 只允许出现在
     【带状态类的选择器】(如 .is-black)上;基础规则和 frame-fitted 那条
     都必须是 transparent 或干脆不写。
   ★ 也【不能】在 frame-fitted 那条里写 background: transparent ——
     它比 .is-black 更具体,会把黑屏状态一起按掉(这个陷阱写在源码注释里了)。 */
const introCss = fs.readFileSync('tuagfey-blog/assets/css/intro.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/* 抠出每一条"选择器 { 声明 }",挑出选择器里含 .screen-static 的 */
const cssRules = [...introCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), decl: m[2] }))
  .filter((r) => r.sel.includes('.screen-static'));
/* ★ 判的是"这个背景【会不会挡住东西】",不是"有没有写 background":
     background: transparent 正是我们要的(基础规则里就有这一条),
     有罪的只有【不透明的颜色】。
   ★ 第一版写成"不带状态类就不许出现 background 字样",当场把 background: transparent
     也判红了 —— 判据必须贴着"意图"(挡不挡)写,不能贴着"字面"(写没写)写。 */
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
/* ★★★ 第十轮:用户换了自带背景的新外框 ⇒ 那条 frame-fitted 规则【不再裁形状】,
   只负责"铺满整块屏幕(+ 把开机动画的 canvas 收到内接矩形里)"。
   所以这里改成验:规则还在、而且【没有】clip-path(裁切已经全去掉)。 */
ok('★ 那条 frame-fitted 规则还在(铺满屏幕,但不再裁形状)',
  cssRules.some((r) => r.sel.includes('frame-fitted') && /inset:\s*0/.test(r.decl)) &&
  !cssRules.some((r) => r.sel.includes('frame-fitted') && /clip-path/.test(r.decl)),
  'found: ' + cssRules.filter((r) => r.sel.includes('frame-fitted')).map((r) => r.sel).join(' | '));
/* 收尾靠 canvas 擦成透明 —— 那么后处理就不许往透明像素上刷黑 */
const postSrc = fs.readFileSync('tuagfey-blog/assets/js/boot-post.js', 'utf8');
ok('★ 后期覆盖图(扫描线/暗角)必须乘上画面 alpha,不能整屏 source-over 压黑',
  /destination-in[\s\S]{0,120}og\.drawImage\(off/.test(postSrc) &&
  !/ctx\.drawImage\(overlays\[overlayIdx\], 0, 0, W, H\);/.test(postSrc),
  /ctx\.drawImage\(overlays\[overlayIdx\], 0, 0, W, H\);/.test(postSrc)
    ? '还在整屏铺覆盖图(揭开的地方会被再压一层黑)' : '已按画面 alpha 裁过');

/* ================= 15. 收下动画:两个数字必须对齐 =================
   ★★ 用户第四轮问过"碎片的收下动画呢?" —— 那时两处都错:
     ① JS 写 560ms、CSS 动画 1s ⇒ 光点飞到一半就被隐藏掉;
     ② 更要命的是两个动作【并行】:多边形还在收拢,光点已经飞完了。
   ② 是设计问题(只能在 CSS 里改成串行);
   ① 是【两处数字要对齐】的问题 —— 这一节钉它,
     免得以后谁改了动画长度却忘了改 JS 的收尾定时器。 */
/* ★★★ 三段时长必须两两对齐(CSS 里同样的三个数是硬编码的):
     MOTE_MS  碎片收拢 + 光点升起        ↔ .frost-read__mark.is-kept::after 的 shardMote
     CARD_MS  卡片开始淡出的时刻         ↔ .frost-read__card.is-flying 里 cardOut 的【延迟】
     KEEP_MS  全部结束、收尾摘类         ↔ 上面两段 + 余量
   ★ 还多一条更要紧的:is-off(带 animation:none)必须【晚于】is-kept 挂上 ——
     同一拍挂上会把光点动画当场取消,那正是用户看到"什么都没有"的原因。 */
const moteMs = Number((/var MOTE_MS = (\d+);/.exec(srcTxt) || [])[1]);
const cardMs = Number((/var CARD_MS = (\d+);/.exec(srcTxt) || [])[1]);
const keepMs = Number((/var KEEP_MS = (\d+);/.exec(srcTxt) || [])[1]);
const moteAnim = /\.frost-read__mark\.is-kept\s+\.frost-read__mote\s*\{[^}]*animation:\s*shardMote\s*([\d.]+)s/.exec(pagesCss);
const moteAnimMs = moteAnim ? Number(moteAnim[1]) * 1000 : NaN;
/* cardOut 的简写是 `cardOut .3s ease 1s` —— 时长 .3s、ease、延迟 1s。
   ★ 正则要盯住"简写里的两个时间",第一个是时长、第二个是延迟(顺序不能搞反)。 */
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
/* is-off 必须是【单独的、更晚的】那一次挂类 —— 同拍挂上会取消光点动画 */
const offTimers = [...srcTxt.matchAll(/setTimeout\(function \(\) \{\s*\n\s*if \(readEl\) readEl\.classList\.add\("is-off"\);\s*\n\s*\}, CARD_MS\)/g)];
ok('★ is-off(带 animation:none)是【晚一拍】挂的,不和 is-kept 同拍',
  offTimers.length === 1 && !/readEl\.classList\.add\("is-off"\);\s*\n\s*if \(dialogT\)/.test(srcTxt),
  offTimers.length === 1 ? 'CARD_MS 之后才挂 is-off ✓' : '★ 还是同拍挂的 —— 光点动画会被取消');
/* ★★★ "碎片凝聚成光点"必须是一条【连续】的形变,不能拆成两个元素交接。
   用户的原话:"为什么要拆开?是碎片凝聚成光点,你这个明显位置不对时间不对大小不对"。
   我上一版正是拆开的:先把 svg 收拢淡出(0~30%),再让 ::after 亮起来(30% 起),
   中间那段"等待"就是"时间不对"的来源 —— 而两个元素的落点还得靠人对齐,
   于是"位置不对、大小不对"。
   现在的判据:
     · 光点是【槽里面的一个真元素】(.frost-read__mote),不再是 ::after;
     · 它的动画【从 0% 就开始涨】—— 没有等待段;
     · 它和 svg 是兄弟,共享槽这一个坐标原点。 */
ok('★ 光点是【槽内的真元素】,不是伪元素(伪元素的定位基准容易差几个像素)',
  /class="frost-read__mote"/.test(tpl) &&
  /\.frost-read__mote\s*\{[^}]*position:\s*absolute/.test(pagesCss) &&
  /\.frost-read__mote\s*\{[^}]*inset:\s*0[^}]*margin:\s*auto/.test(pagesCss),
  '模板里有 .frost-read__mote · CSS 里是 inset:0 + margin:auto(居中不依赖外部数值)');
ok('★ 光点与碎片形状是【兄弟】,共享槽这一个原点(不是两个东西交接)',
  !!readMark && /svg[\s\S]{0,200}frost-read__mote/.test(tpl),
  '模板里 svg 与 .frost-read__mote 同在 .frost-read__mark 里');
/* ★★★ 「凝聚」不是「消失」—— 用户的原话:
     "能不能理解我的意思?是碎片凝聚,不是碎片消失"
   ★ 这条断言我【上一轮写反过】:那时我写的是"光点从 0% 就开始涨,不许有等待段",
     并把"碎片 scale(0)"当成正确实现。两轮之后用户点出:那不是凝聚,是消失 ——
     碎片缩没了、另一个光点凭空出现。
   ★ 判据必须贴着"凝聚"这个词写,而不是贴着"两条动画的百分比"写:
       ① 碎片在收拢【之前/之中】必须仍然不透明(物质没少);
       ② 碎片在收拢过程中必须【越来越亮】(被压紧、被点着,不是被擦淡);
       ③ 光点必须【晚于】碎片收拢才亮起来(它是碎片压出来的结果,不是同时的另一样东西);
       ④ 碎片最终缩到很小但**不能是 0** —— 真正的消失交给最后一刻的接管。 */
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
/* ★ 光点必须【晚于】碎片收拢才亮:它是碎片压出来的结果 */
const moteKeys = /@keyframes shardMote\s*\{([\s\S]*?)\n\}/.exec(pagesCss);
const moteEarly = moteKeys ? /0%,\s*\n?\s*(\d+)%\s*\{[^}]*opacity:\s*0/.test(moteKeys[1]) : false;
const moteBloom = moteKeys ? /(\d+)%\s*\{[^}]*opacity:\s*1/.test(moteKeys[1]) : false;
const bloomPct = moteKeys ? Number((/(\d+)%\s*\{[^}]*opacity:\s*1/.exec(moteKeys[1]) || [])[1]) : NaN;
ok('★ 光点【晚于】碎片收拢才亮(它是碎片压出来的,不是同时出现的另一样东西)',
  moteEarly && moteBloom && bloomPct >= 50,
  moteKeys ? `光点亮的时刻 = ${bloomPct}%(必须 ≥50%,也就是碎片缩到底之后)` : '没找到 shardMote keyframes');

/* ★★ "减少动态效果"下极光也必须出现一次。
   我上一版写的是 `if (!reduced && active) paintAuroraGlsl(...)`,
   而紧接着那句 `if (reduced && ...) return` 会让帧循环在画极光之前就退出 ——
   于是开了这个设置的人【一帧极光都看不到】。
   雪停住是对的(飘雪纯粹是运动),但极光是这一页的【画面本身】,不能整层消失;
   正确做法是"画一帧然后停"。 */
const aurCall = /if \(!reduced \|\| !aurFrames\) \{\s*\n\s*paintAuroraGlsl\(/.exec(srcTxt);
ok('★ "减少动态效果"下也要画一帧极光(不能整层消失)',
  !!aurCall && !/if \(!reduced && active\) paintAuroraGlsl/.test(srcTxt),
  aurCall ? '画一帧的写法在' : (/if \(!reduced && active\) paintAuroraGlsl/.test(srcTxt) ? '★ 还是 !reduced && 的旧写法' : '找不到调用点'));

/* ★★★ 和收下动画同一个族的错:一条规则里同时写"开始演"和"别演了"。
   `animation: none` 会作用到【元素及其伪元素】上,所以
   `.frost-read__mark.is-kept { animation: none }` 会把
   `.frost-read__mark.is-kept::after` 那条 shardMote 一起关掉 ——
   于是"收下 → 光点升上去"从加类那一刻就被取消,用户看到的是"什么都没有"。
   这一条禁止那个选择器再出现在 animation:none 那组里。 */
const noneRule = /\.frost-read__mark\.is-kept\s*,\s*\n?\s*\.frost-read\.is-off \.frost-read__mark\s*\{[^}]*animation:\s*none/.test(pagesCss);
ok('★ 没有哪条规则一边挂 is-kept 一边把动画关掉(伪元素会被一起关掉)',
  !noneRule && /\.frost-read\.is-off \.frost-read__mark\s*\{[^}]*animation:\s*none/.test(pagesCss),
  noneRule ? '★ 还有 is-kept, .is-off { animation: none } 这种自相矛盾的写法' : '只有 is-off 关动画 ✓');

/* ★★★ 着色器用的每一个"宿主要提供的名字",宿主都必须声明。
   用户第六轮贴的控制台:
     [boot-glsl] 编译失败 aurora: ERROR: 0:210: 'uTime' : undeclared identifier
   我照搬那份 GLSL 时把它正文里的 u_time 换成了 uTime(对的,宿主用 iTime),
   但【忘了在宿主的 FRAG_HEAD 里声明 uTime】—— 于是着色器一编译就失败,
   而失败的后果是"极光整层不出现"(render 返回 null,那一层一直空着)。
   这一条把"两头对得上"钉死:正文里出现的每个时间名字,FRAG_HEAD 里都得有。 */
const hostSrc = fs.readFileSync('tuagfey-blog/assets/js/boot-glsl.js', 'utf8');
const headBlock = /var FRAG_HEAD = \[([\s\S]*?)\]\.join/.exec(hostSrc);
const headStr = headBlock ? headBlock[1] : '';
const shaderTimeNames = ['uTime', 'iTime', 'u_time'].filter((n) => {
  const re = new RegExp('\\b' + n + '\\b');
  return re.test(aurCode);
});
const undeclared = shaderTimeNames.filter((n) => {
  const declName = n === 'u_time' ? 'uTime' : n;      /* u_time 是 iTime 的别名 */
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

/* ★★★ 光点必须在一个【不透明】的容器里演。
   这是第四轮才找对的机制,前几轮全部栽在同一处:
       .frost-read__mark.is-kept { opacity: 0 }            ← 槽自己透明
       .frost-read__mark.is-kept::after { animation: ... }  ← 光点是槽的伪元素
   opacity 会创建合成组,【整棵子树一起变透明】—— 于是那条动画确实在跑,
   只是在一个 100% 透明的父元素里跑:用户看不见,而"动画有没有开始"全部通过。
   ★ 判据因此要判"容器在 is-kept 时是否仍然不透明",而不是"有没有那条 animation"。
     "动画在跑"和"动画看得见"是两件事 —— 前几轮我只验了前者。 */
const markKeptOpacity = /\.frost-read__mark\.is-kept\s*\{[^}]*opacity:\s*([\d.]+)/.exec(pagesCss);
ok('★ is-kept 时【容器】仍然不透明(否则光点在透明父元素里演,谁也看不见)',
  !!markKeptOpacity && Number(markKeptOpacity[1]) > 0.99,
  markKeptOpacity ? ('.frost-read__mark.is-kept 的 opacity = ' + markKeptOpacity[1]) : '★ 找不到这条规则');
/* ★ 碎片的收拢是 shardCondense 那条动画(已经按"凝聚"的语义在上面钉住了:
   过程中不透明、越缩越亮、缩到很小但不是 0)。
   这里只留一条结构约束:动画挂在 svg 上,而不是挂在容器上 ——
   容器一旦参与演出(变透明/被 transform),里面的光点会跟着受影响。 */
/* ★ 不要用"选择器 + [^}]* + animation"这种正则去判 —— `[^}]` 是【跨行】的,
   于是 `.frost-read.is-off .frost-read__mark { animation: none }` 里的
   "animation" 会被算到【它前面那条规则】头上(我为此白查了一轮,断言红了而规则是对的)。
   正确做法:把规则一条条切出来,按【精配的选择器】查它【自己】的声明块。 */
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

/* ============ 16. "拿起"和"收下"必须是两件事 ============
   ★★★ 用户第六轮的原话:"我说为什么拿起碎片就开始播放收起动画了!!!"
   这是一个真 bug,根因在 CSS 的一个容易忽略的性质:
     `animation-fill-mode: forwards` 的填充是【双向】的 ——
     一条已经写好、但还没开始跑的动画,会把【第一个关键帧】的样式填上去。
   而 shardCondense 的第一个关键帧是 scale(1)(原始尺寸、原始亮度),
   于是【开卡那一刻】槽里的碎片就按原始尺寸铺开了 ——
   用户读成"一拿起就开始播收起动画"。
   ★ 修法是让这条动画【一直挂着、但暂停】,用 animation-play-state 控制播放:
     开卡时它停在 0% 不推进;is-kept 一到才 running。
   ★ 判据因此写三条:
       ① CSS 里 shardCondense 必须带 animation-play-state: paused;
       ② 只有 .is-kept 才把它变成 running;
       ③ JS 里【不能】在 openShard(拿起)时挂 is-kept —— 那是 keepShard 的事。 */
const svgCondRule = cssRulesOf('.frost-read__mark svg').join(' ');
ok('★ 凝聚动画平时是【暂停】的(否则第一个关键帧会在拿起时就生效)',
  /animation:\s*shardCondense/.test(svgCondRule) && /animation-play-state:\s*paused/.test(svgCondRule),
  'svg 规则里有 paused:' + /animation-play-state:\s*paused/.test(svgCondRule));
const keptRun = cssRulesOf('.frost-read__mark.is-kept svg').join(' ');
ok('★ 只有 is-kept 才放开它(running)',
  /animation-play-state:\s*running/.test(keptRun),
  keptRun ? 'is-kept svg → running ✓' : '★ 没有 running');
/* 拿起 vs 收下:两个函数各挂各的类,不许交叉 */
const openBody = /function openShard[\s\S]*?\n    \}/.exec(srcTxt)[0];
const keepBody = /function keepShard[\s\S]*?\n    \}/.exec(srcTxt)[0];
ok('★ openShard(拿起)【不】挂 is-kept —— 收起动画属于 keepShard(收下)',
  !/classList\.add\("is-kept"\)/.test(openBody.replace(/shards\[i\]\.classList\.add\("is-kept"\);?/g, '')) ||
  !/readMark\.classList\.add\("is-kept"\)/.test(openBody),
  /readMark\.classList\.add\("is-kept"\)/.test(openBody) ? '★ openShard 里挂了 is-kept' : 'openShard 没挂 ✓');
ok('★ keepShard(收下)才是挂 is-kept 的地方',
  /readMark\.classList\.add\("is-kept"\)/.test(keepBody),
  /readMark\.classList\.add\("is-kept"\)/.test(keepBody) ? 'keepShard 挂 ✓' : '★ keepShard 里没有');
/* JS 还要在开卡那一帧把动画按住(内联),让内联过渡先完成"飞进槽里" */
ok('★ 开卡那一帧把动画按住(内联 animation-name:none),落位后再交还',
  /markSvg\.style\.setProperty\("animation-name", "none"\)/.test(openBody) &&
  /markSvg\.style\.removeProperty\("animation-name"\)/.test(openBody),
  'openShard 里有按住 + 交还');

/* ---------- 出结果 ---------- */
let pass = 0;
for (const r of rows) { if (r.pass) pass++; console.log('  ' + (r.pass ? '✓' : '✗') + ' ' + r.name + (r.info ? '   [' + r.info + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');

process.exit(pass === rows.length ? 0 : 1);


