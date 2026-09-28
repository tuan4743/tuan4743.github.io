/* ============================================================
   侧边目录(TOC):构建产物 + 运行时行为 + 样式 三层验收
   ─────────────────────────────────────────────────────────────
   用户这一轮:"加一个侧边目录,就放在内容页和侧边栏的中间"。
   为什么三块都要验:
     · 构建产物 —— 目录是 Hugo 端算出来的(拿 .Fragments),模板写错在本地
       一点报错都没有,只有产物里"什么都没有"。本轮就真踩了:
       .Fragments.Headings 的第一层是文章自己的 h1,我当时拿它当小节用,
       再加上"至少两条才渲染"的门槛 ⇒ 所有文章一块目录都出不来。
     · 运行时 —— 进度、高亮、收起、字号字距全靠 JS 改内联变量/类名,
       静态扫源码看不出对不对(和 cursor-art 那次一个道理)。
     · 样式 —— 位置是用户唯一的硬要求("放在内容页和侧边栏中间"),
       所以位置必须能被断言钉住,不能靠"我觉得差不多"。
   跑法(先在工作区根目录构建,见 README):node tuagfey-blog/tests/hud-toc.test.mjs
   ============================================================ */
import fs from 'node:fs';

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
const noC = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const post = rd(`${WS}/.tmp/t1/posts/hello-world/index.html`);
const deploy = rd(`${WS}/.tmp/t1/tech/github-actions-deploy/index.html`);
const techList = rd(`${WS}/.tmp/t1/tech/index.html`);
const about = rd(`${WS}/.tmp/t1/about/index.html`);
const home = rd(`${WS}/.tmp/t1/index.html`);
const tpl = rd(`${BH}/layouts/_partials/hud-toc.html`);
const tplCode = noC(tpl);
const hudTpl = rd(`${BH}/layouts/_partials/page-hud.html`);
const css = noC(rd(`${BH}/assets/css/hud-toc.css`));
const js = rd(`${BH}/assets/js/hud-toc.js`);
const jsCode = noC(js);

/* 被压缩过的产物里属性没有引号,统一去掉引号再匹配 */
const strip = (h) => h.replace(/="([^"]*)"/g, '=$1');

/* ============================================================
   ① 构建产物:该有的页面有、不该有的页面没有
   ============================================================ */
const sPost = strip(post);
ok('文章页有目录块', sPost.includes('<div class=hud-toc id=hud-toc'));
ok('文章页目录条目数 = 3 个小节', (sPost.match(/class=hud-toc__item /g) || []).length === 3,
  String((sPost.match(/class=hud-toc__item /g) || []).length));
ok('另一篇文章的条目数 = 4', (strip(deploy).match(/class=hud-toc__item /g) || []).length === 4);
ok('★ 目录里【没有】文章大标题(h1 只是标题,不是小节)',
  !sPost.includes('data-hud-toc-lvl=1') &&
  (sPost.match(/data-hud-toc-lvl=2/g) || []).length === 3,
  '条目应当只有 3 个 lvl=2,一个 lvl=1 都没有');
ok('条目的锚点指向真实标题 id',
  sPost.includes('data-hud-toc-id=这是我的第一篇博客') && post.includes('id=这是我的第一篇博客'));
/* ★ 注意:所有博客页都会加载 hud-toc.css / hud-toc.js,所以不能用
   "页面里有没有 hud-toc 这几个字"来判断 —— 那永远为真。
   要判的是【DOM 块】在不在。 */
ok('★ 列表页没有目录 DOM 块(没有正文小节可列)',
  !strip(techList).includes('<div class=hud-toc') && !strip(about).includes('<div class=hud-toc'));
ok('首页也没有目录 DOM 块',
  !strip(home).includes('<div class=hud-toc') && !/<body[^>]*class=[^>]*hud-toc/.test(home));
ok('标题少于 2 条时不渲染(partial 里有门槛)', /ge \(len \$items\) 2/.test(tplCode));

/* 图上那四样东西必须都在 */
for (const [name, needle] of [
  ['进度条', 'class=hud-toc__prog'],
  ['进度光点', 'class=hud-toc__prog-thumb'],
  ['目录标题', 'class=hud-toc__title'],
  ['收起按钮', 'id=hud-toc-toggle'],
  ['字号按钮', 'data-hud-toc-size='],
  ['字距按钮', 'data-hud-toc-track=']
]) {
  ok(`图上的「${name}」在产物里`, sPost.includes(needle));
}
ok('字号/字距是两组各两个按钮(图上那四个小方块)',
  (sPost.match(/data-hud-toc-size=/g) || []).length === 2 &&
  (sPost.match(/data-hud-toc-track=/g) || []).length === 2);

/* 挂载链:HUD 里渲染 + 样式和脚本都发出去 */
ok('page-hud.html 里渲染了 hud-toc', /partial "hud-toc\.html"/.test(hudTpl));
ok('extend_head 挂了 hud-toc.css', /hud-toc\.css/.test(rd(`${BH}/layouts/partials/extend_head.html`)));
ok('extend_footer 挂了 hud-toc.js', /hud-toc\.js/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('产物里两个资源都带上指纹', /hud-toc\.[0-9a-f]{20,}\.css/.test(post) && /hud-toc\.[0-9a-f]{20,}\.js/.test(post));

/* ============================================================
   ② 样式:位置必须钉在"内容页和侧边栏的中间"
   ============================================================ */
const num = (v) => parseFloat(String(v).replace('%', ''));
const barX = num((css.match(/--hud-toc-bar-x:\s*([\d.]+%)/) || [, '0'])[1]);
const tocX = num((css.match(/--hud-toc-x:\s*([\d.]+%)/) || [, '0'])[1]);
/* 正文:--main-width 720px 居中 ⇒ x 31.3~68.7(1920 下);竖栏 x 89~95 */
ok('★ 进度条落在正文右缘之外(x > 69)', barX > 69 && barX < 78, `bar-x=${barX}%`);
ok('★ 目录面板在进度条右边', tocX > barX, `toc-x=${tocX}% > bar-x=${barX}%`);
ok('目录面板左缘不出正文右缘', tocX >= 69, `${tocX}%`);
ok('面板宽度封顶,不会顶进竖栏(150~220px,竖栏在 89%)',
  /--hud-toc-panel-w:\s*clamp\(150px,\s*11\.5vw,\s*220px\)/.test(css));
ok('窄屏整块收掉(≤1400px)', /@media \(max-width: 1400px\)[\s\S]{0,80}\.hud-toc\s*\{\s*display:\s*none/.test(css));
ok('整块默认不吃鼠标事件(和 HUD 一个规矩)',
  /\.hud-toc\s*\{[^}]*pointer-events:\s*none/.test(css) &&
  /\.hud-toc__box\s*\{[^}]*pointer-events:\s*auto/.test(css));

/* 收起靠 max-width → 0(不是 display:none,那样没有过渡) */
ok('★ 收起是 max-width 收到 0 + 透明(有动画)',
  /\.hud-toc\.is-collapsed \.hud-toc__panel\s*\{[\s\S]{0,120}?max-width:\s*0/.test(css) &&
  /max-width 0\.34s/.test(css));
ok('收起的页签贴在面板右缘(row-reverse)',
  /\.hud-toc__box\s*\{[\s\S]{0,300}?flex-direction:\s*row-reverse/.test(css));
ok('收起后箭头翻转 180°', /\.hud-toc\.is-collapsed \.hud-toc__toggle svg\s*\{[\s\S]{0,80}?rotate\(180deg\)/.test(css));

/* ============================================================
   ③ 运行时:拿真模块 + 假 DOM 跑一遍
   ============================================================ */
function fakeDom() {
  const mk = (tag) => {
    const vars = {};
    const el = {
      tagName: String(tag).toUpperCase(), _cls: new Set(), attrs: {}, dataset: {}, children: [],
      style: {
        setProperty: (k, v) => { vars[k] = String(v); },
        getPropertyValue: (k) => (k in vars ? vars[k] : ''),
        removeProperty: (k) => { delete vars[k]; }
      },
      _vars: vars,
      classList: {
        add: (c) => el._cls.add(c), remove: (c) => el._cls.delete(c),
        contains: (c) => el._cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !el._cls.has(c) : !!on; v ? el._cls.add(c) : el._cls.delete(c); return v; }
      },
      setAttribute(k, v) { el.attrs[k] = String(v); },
      getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
      addEventListener(t, f) { (el._ev = el._ev || {})[t] = (el._ev[t] || []).concat(f); },
      /* ★ 不能写成 Object.assign({width,height}, el._rect):
         el._rect 只有 {top} 时,Object.assign 会把缺席的 left 留成 undefined,
         于是 main.getBoundingClientRect().top + pageYOffset = NaN —— 进度静默算错。
         (本轮测试第一版就是这么骗过自己的:进度条 0.6 而不是 0。) */
      getBoundingClientRect() {
        const r = el._rect || { left: 0, top: 0, right: 0, bottom: 0 };
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top };
      },
      querySelector: (s) => el._q[s] || null,
      querySelectorAll: (s) => el._qa[s] || [],
      /* ★ 委托点击靠它:模块写的是 e.target.closest("[data-hud-toc-size],…")。
         第一版这里恒返回 null(占位实现),于是"点了一堆次、字号纹丝不动" ——
         那是假 DOM 的错、不是模块的错,但症状和真 bug 一模一样,极容易误判。 */
      closest(sel) {
        const want = String(sel).split(',').map((s) => s.trim().replace(/^\[|\]$/g, ''));
        let n = el;
        while (n) {
          for (const w of want) if (w in n.attrs) return n;
          n = n._parent || null;
        }
        return null;
      },
      contains: () => false,
      appendChild(c) { el.children.push(c); c._parent = el; return c; }
    };
    el._q = {}; el._qa = {};
    return el;
  };

  const mkBtn = (attr, val) => { const b = mk('button'); b.attrs[attr] = String(val); return b; };
  const sizeDown = mkBtn('data-hud-toc-size', -1), sizeUp = mkBtn('data-hud-toc-size', 1);
  const trackDown = mkBtn('data-hud-toc-track', -1), trackUp = mkBtn('data-hud-toc-track', 1);

  const secIds = ['s1', 's2', 's3'];
  const items = secIds.map((id) => {
    const a = mk('a');
    /* ★ 目录条目上必须有 data-hud-toc-id:模块是靠它在 items 和正文标题之间牵线的
       (a.getAttribute("data-hud-toc-id") → 再 document.getElementById)。
       少了这一条,模块里所有 el 都取不到 ⇒ 高亮永远停在第一个小节,
       看起来像"高亮逻辑不工作",其实是假 DOM 少给了一个属性。 */
    a.attrs['data-hud-toc-id'] = id; a.attrs['data-hud-toc-lvl'] = '2';
    a.textContent = id;
    return a;
  });

  const list = mk('nav');
  const panel = mk('div'), toggle = mk('button'), prog = mk('div'), thumb = mk('span'), sizeVal = mk('span');
  const root = mk('div');
  root._q = { '.hud-toc__prog': prog, '.hud-toc__prog-thumb': thumb, '.hud-toc__list': list };
  root._qa = { '.hud-toc__item': items };

  const main = mk('main');
  main.offsetHeight = 3000;
  /* ★★ getBoundingClientRect 是【视口坐标】:元素在文档里的 top = rect.top + 滚动量。
     模块算的是 (滚动量 − 文档top) / (正文高 − 视口高)。
     所以"正文从文档 y=1200 开始"在这里写成 rect.top = 1200 − pageYOffset。
     第一版我直接往 rect.top 里写文档坐标,进度就整整齐齐差了 0.5 —— 假 DOM 骗人。 */
  main._rect = { left: 600, top: 200, right: 1320, bottom: 1174 };

  const heads = {};
  const secTopDoc = { s1: 600, s2: 1300, s3: 2000 };   /* 三个小节在文档里的位置 */
  secIds.forEach((id) => {
    const h = mk('h2');
    /* ★ 正文标题上必须有 id:模块是 document.getElementById(条目里的 data-hud-toc-id)。
       少了它 getElementById 全返回 null ⇒ 每个小节都被 continue 跳过 ⇒
       best 永远是 items[0] ⇒ 高亮卡在第一项("切小节"这件事看起来完全没实现)。 */
    h.attrs.id = id;
    h._topDoc = secTopDoc[id];
    h._rect = { left: 600, top: h._topDoc, right: 1320, bottom: h._topDoc + 40 };
    heads[id] = h;
  });

  const doc = {
    /* ★ 正文标题走 id 属性(真浏览器里就是 id="s1");目录内部的几个固定 id 直接给。 */
    getElementById: (id) => {
      if (id === 'hud-toc') return root;
      if (id === 'hud-toc-panel') return panel;
      if (id === 'hud-toc-toggle') return toggle;
      if (id === 'hud-toc-size-val') return sizeVal;
      return secIds.indexOf(id) >= 0 ? heads[id] : null;
    },
    querySelector: (s) => (s.indexOf('main') === 0 ? main : null),
    body: main,
    addEventListener() {}
  };

  const wins = [];
  /* ★★ requestAnimationFrame 必须【按浏览器的规矩】模拟,不能直接同步调回调。
     模块用的是这个模式:
         function paint()   { raf = 0; ... }
         function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }
     意思是"已经排了一帧还没跑,就别重复排"。如果桩函数立刻执行回调却不让
     "已排的帧"结束,那么浏览器里那一帧永远不来 ⇒ 第二次滚动开始 onScroll 看到
     raf 非 0,再也不排帧 ⇒ 进度和高亮从此冻住。
     (本轮就在这儿绕了很久:真浏览器里一切正常,只有测试里"第二次滚动没反应"。)
     所以这里维护队列 + flush():滚动时只入队,滚动结束后统一跑一次。 */
  let rafSeq = 0;
  let rafQueue = [];
  const schedule = (cb) => { rafQueue.push({ id: ++rafSeq, cb }); return rafSeq; };
  const flushFrames = () => {
    for (let guard = 0; guard < 20 && rafQueue.length; guard++) {
      const q = rafQueue;
      rafQueue = [];
      q.forEach((j) => j.cb(0));
    }
  };
  const win = {
    innerHeight: 1000, pageYOffset: 0,
    matchMedia: () => ({ matches: false }),
    addEventListener: (t, f) => { if (t === 'scroll') wins.push(f); },
    requestAnimationFrame: schedule,
    cancelAnimationFrame: (id) => { rafQueue = rafQueue.filter((j) => j.id !== id); },
    history: { replaceState() {} }
  };
  const storage = {};
  const env = {
    root, panel, toggle, prog, thumb, list, items, sizeVal, heads, main, doc, win,
    buttons: { sizeDown, sizeUp, trackDown, trackUp },
    /* ★ 滚一下:光标元素(正文/小节)的视口坐标自动跟着变 —— 真实浏览器就是这样。
       手改 rect 很容易把两套坐标系搞混(第一版就是这么错的)。 */
    scrollTo(y, mainTopDoc) {
      win.pageYOffset = y;
      if (typeof mainTopDoc === 'number') main._topDoc = mainTopDoc;
      const mt = typeof main._topDoc === 'number' ? main._topDoc : 200;
      main._rect = { left: 600, top: mt - y, right: 1320, bottom: mt - y + 3000 };
      for (const id of Object.keys(heads)) {
        const t = heads[id]._topDoc;
        heads[id]._rect = { left: 600, top: t - y, right: 1320, bottom: t - y + 40 };
      }
    },
    fireScroll() { wins.forEach((f) => f()); flushFrames(); },
    flush: flushFrames,
    store: storage
  };
  env.scrollTo(0);
  return env;
}

function boot(env) {
  globalThis.window = env.win;
  globalThis.document = env.doc;
  globalThis.localStorage = {
    getItem: (k) => (k in env.store ? env.store[k] : null),
    setItem: (k, v) => { env.store[k] = String(v); }
  };
  globalThis.requestAnimationFrame = env.win.requestAnimationFrame;
  new Function(js)();
  env.flush();     /* 清掉启动时可能排下的那一帧(模块末尾是直接调 paint 的) */
  return env.win.__hudToc;
}

/* 模拟一次点击。★ 关键:模块用的是【事件委托】—— 处理器挂在 root 上,
   靠 e.target.closest(...) 认按钮。真实浏览器里点击会从按钮冒泡到 root;
   假 DOM 没有冒泡,所以必须【把事件派发给 root、把 target 指向按钮】。
   第一版我派发给了按钮自己(它身上一个处理器都没有)⇒ 返回 0、字号纹丝不动,
   看着像模块坏了,其实是模拟方式不对。
   ★ 也不要在块里再写一份同名 const:块内声明在整个块里都处在 TDZ,
     块外那个同名函数会被遮蔽 ⇒ 后面的块直接 ReferenceError(报过一次)。 */
function press(el) {
  if (!el || !el._ev || !el._ev.click) return 0;
  el._ev.click.forEach((f) => f({ preventDefault() {}, target: el._target || el }));
  return el._ev.click.length;
}
/* 点 root 上的委托处理器,target 指定成某个按钮 */
function pressOn(rootEl, target) {
  rootEl._target = target;
  try { return press(rootEl); } finally { rootEl._target = null; }
}

/* ---- ③a 进度:只按正文算,并且夹在 0~1 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  ok('模块启动后暴露排障出口 __hudToc', !!api);
  ok('数出了 3 个条目', api && api.items === 3, api && String(api.items));

  env.scrollTo(0);                       /* 正文从文档 y=200 开始,还没滚到 */
  env.fireScroll();
  ok('★ 没开始读时进度 = 0', api.p() === 0, String(api.p()));

  /* 正文高 3000,视口 1000 ⇒ 可滚 2000;滚 700 ⇒ (700-200)/2000 = 0.25 */
  env.scrollTo(700);
  env.fireScroll();
  ok('★ 进度按 (滚动 - 正文顶) / (正文高 - 视口高) 算', Math.abs(api.p() - 0.25) < 1e-6, String(api.p()));

  /* 正文从文档 y=0 开始、滚 1500 ⇒ (1500-0)/2000 = 0.75 */
  env.scrollTo(1500, 0);
  env.fireScroll();
  ok('★ 正文顶在文档开头时:滚 1500/2000 ⇒ 0.75', Math.abs(api.p() - 0.75) < 1e-6, String(api.p()));

  env.scrollTo(9000, 0);
  env.fireScroll();
  ok('★ 滚过正文末尾时进度夹在 1(不会溢出)', api.p() === 1, String(api.p()));

  env.scrollTo(0, 3000);
  env.fireScroll();
  ok('★ 还没滚到正文时夹在 0(不会负数)', api.p() === 0, String(api.p()));
}

/* ---- ③b 进度条/光点真的写进了 CSS 变量,高亮跟着滚 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  env.scrollTo(700);                     /* 正文从文档 y=200 起 ⇒ 进度 0.25 */
  env.fireScroll();
  ok('★ 进度条和光点都吃到了 --hud-toc-p',
    env.prog.style.getPropertyValue('--hud-toc-p') === '0.2500' &&
    env.thumb.style.getPropertyValue('--hud-toc-p') === '0.2500',
    env.prog.style.getPropertyValue('--hud-toc-p'));

  const cur = env.items.filter((a) => a.classList.contains('is-current'));
  ok('★ 当前小节只有一个高亮', cur.length === 1, `高亮 ${cur.length} 个`);
  ok('★ 刚进正文时高亮第一个小节(s1)',
    cur[0] === env.items[0] && api.active() === 's1', api.active());

  /* 小节在文档里是 s1 600 / s2 1300 / s3 2000,判定线在视口上沿下方 320px。
     滚 y 时小节的视口 top = 文档top − y:
       y=900  ⇒ s1(-300)、s2(400)、s3(1100) ⇒ 只有 s1 越线
       y=1900 ⇒ s1、s2 越线,s3(100) 也越线 ⇒ 高亮 s3 */
  env.scrollTo(900);
  env.fireScroll();
  ok('★ 滚一个小节后仍高亮 s1', api.active() === 's1', api.active());

  env.scrollTo(1900);                    /* 三个小节的视口 top:-1300 / -600 / 100 ⇒ 全越线 */
  env.fireScroll();
  const cur2 = env.items.filter((a) => a.classList.contains('is-current'));
  ok('★ 继续下滚会切到后面的小节(s3)', cur2.length === 1 && api.active() === 's3', api.active());
}

/* ---- ③c 收起 / 展开 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  ok('默认是展开的', api.collapsed() === false && env.toggle.getAttribute('aria-expanded') === 'true');
  press(env.toggle);   /* ★ 收起页签是【直接挂在自己身上】的,不走委托 */
  ok('★ 点页签后挂上 is-collapsed(= max-width 收到 0 的那个类)', api.collapsed() === true);
  ok('★ aria-expanded 同步变 false(无障碍)', env.toggle.getAttribute('aria-expanded') === 'false');
  ok('页签的 title 也跟着改', env.toggle.title === '展开目录', String(env.toggle.title));
  press(env.toggle);   /* ★ 收起页签是【直接挂在自己身上】的,不走委托 */
  ok('再点一次展开回来', api.collapsed() === false && env.toggle.getAttribute('aria-expanded') === 'true');
}

/* ---- ③d 字号 / 字距 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  ok('默认字号 12px / 字距 0.04em',
    env.root.style.getPropertyValue('--toc-fs') === '12px' &&
    env.root.style.getPropertyValue('--toc-ls') === '0.04em',
    env.root.style.getPropertyValue('--toc-fs') + ' / ' + env.root.style.getPropertyValue('--toc-ls'));
  pressOn(env.root, env.buttons.sizeUp); pressOn(env.root, env.buttons.sizeUp);
  pressOn(env.root, env.buttons.trackUp);
  ok('★ 字号 +2 ⇒ 14px', env.root.style.getPropertyValue('--toc-fs') === '14px', env.root.style.getPropertyValue('--toc-fs'));
  ok('★ 字距 +1 ⇒ 0.05em', env.root.style.getPropertyValue('--toc-ls') === '0.05em', env.root.style.getPropertyValue('--toc-ls'));
  ok('字号写进了 localStorage', /"fs":14/.test(env.store['hud-toc-type'] || ''), env.store['hud-toc-type']);
  for (let i = 0; i < 20; i++) pressOn(env.root, env.buttons.sizeUp);
  ok('★ 字号有上限(不越界)', env.root.style.getPropertyValue('--toc-fs') === '17px', env.root.style.getPropertyValue('--toc-fs'));
  for (let i = 0; i < 30; i++) pressOn(env.root, env.buttons.sizeDown);
  ok('★ 字号有下限(不越界)', env.root.style.getPropertyValue('--toc-fs') === '11px', env.root.style.getPropertyValue('--toc-fs'));
  for (let i = 0; i < 30; i++) pressOn(env.root, env.buttons.trackDown);
  ok('★ 字距下限是 0em(不会变负)', env.root.style.getPropertyValue('--toc-ls') === '0.00em', env.root.style.getPropertyValue('--toc-ls'));
}

/* ---- ③e 读回上次存的字号 ---- */
{
  const env = fakeDom();
  env.store['hud-toc-type'] = JSON.stringify({ fs: 16, ls: 8 });
  boot(env);
  ok('★ 下次打开沿用上次的字号/字距',
    env.root.style.getPropertyValue('--toc-fs') === '16px' &&
    env.root.style.getPropertyValue('--toc-ls') === '0.08em',
    env.root.style.getPropertyValue('--toc-fs') + ' / ' + env.root.style.getPropertyValue('--toc-ls'));
}

/* ---- ③f 没有这块 DOM 时必须静默退出(列表页/首页会加载同一个脚本) ---- */
{
  const env = fakeDom();
  env.doc.getElementById = () => null;
  let threw = null;
  try { boot(env); } catch (e) { threw = e.message; }
  ok('★ 页面上没有目录时不报错(列表页/首页也加载这个脚本)', threw === null, String(threw));
}

/* ---------------- 输出 ---------------- */
let bad = 0;
const pad = (s, n) => String(s).padEnd(n);
rows.forEach(([p, n, i]) => {
  if (!p) bad++;
  console.log(`${p ? 'PASS' : 'FAIL'}  ${pad(n, 60)} ${i}`);
});
console.log(`\n${rows.length - bad}/${rows.length} 通过` + (bad ? `  ★ ${bad} 条失败` : ''));
process.exit(bad ? 1 : 0);
