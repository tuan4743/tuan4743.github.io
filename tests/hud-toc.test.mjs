/* 侧边目录:构建产物 + 运行时行为 + 样式三层验收。 跑法见 tests/README.md */
import fs from 'node:fs';

const WS = 'C:/Users/hp/Desktop/GLM-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
const noC = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const B = fs.existsSync(`${WS}/.tmp/t1/study/hello-world/index.html`) ? `${WS}/.tmp/t1` : `${BH}/public`;
const post = rd(`${B}/study/hello-world/index.html`);
const deploy = rd(`${B}/tech/github-actions-deploy/index.html`);
const techList = rd(`${B}/tech/index.html`);
const about = rd(`${B}/about/index.html`);
const home = rd(`${B}/home/index.html`);
const tpl = rd(`${BH}/layouts/_partials/hud-toc.html`);
const tplCode = noC(tpl);
const hudTpl = rd(`${BH}/layouts/_partials/page-hud.html`);
const css = noC(rd(`${BH}/assets/css/hud-toc.css`));
const js = rd(`${BH}/assets/js/hud-toc.js`);
const jsCode = noC(js);

const strip = (h) => h.replace(/="([^"]*)"/g, '=$1');

const sPost = strip(post);
ok('文章页有目录块', sPost.includes('<div class=hud-toc id=hud-toc'));
ok('文章页目录条目数 = 5(4 个 h2 小节 + 1 个 h1 章标题)',
  (sPost.match(/class=hud-toc__item /g) || []).length === 5,
  String((sPost.match(/class=hud-toc__item /g) || []).length));
ok('另一篇文章的条目数 = 5', (strip(deploy).match(/class=hud-toc__item /g) || []).length === 5);
ok('★ 目录里有文章大标题(lvl=1)+ 4 个 lvl=2 小节',
  (sPost.match(/data-hud-toc-lvl=1/g) || []).length === 1 &&
  (sPost.match(/data-hud-toc-lvl=2/g) || []).length === 4,
  '顶层片段(h1)现在按 lvl=1 收进目录');
ok('条目的锚点指向真实标题 id',
  sPost.includes('data-hud-toc-id=这是我的第一篇博客') && post.includes('id=这是我的第一篇博客'));
ok('★ 列表页没有目录 DOM 块(没有正文小节可列)',
  !strip(techList).includes('<div class=hud-toc') && !strip(about).includes('<div class=hud-toc'));
ok('首页也没有目录 DOM 块',
  !strip(home).includes('<div class=hud-toc') && !/<body[^>]*class=[^>]*hud-toc/.test(home));
ok('标题少于 2 条时不渲染(partial 里有门槛)', /ge \(len \$items\) 2/.test(tplCode));

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
  (sPost.match(/data-hud-toc-size=/g) || []).length === 4 &&
  (sPost.match(/data-hud-toc-track=/g) || []).length === 4,
  '面板里两组各两个 + 左栏那枚备用胶囊里两组各两个 = 每页 4 个(见下一节)');
ok('★ 字号/字距各有自己的行标签(不再共用一个"正文")',
  /class=hud-toc__size-lab[^>]*>字号</.test(sPost) && /class=hud-toc__size-lab[^>]*>字距</.test(sPost) &&
  !/class=hud-toc__size-lab[^>]*>正文</.test(sPost),
  '标签:字号 / 字距');
ok('★ 两行各有自己的读数元素(id 不同)',
  /id=hud-toc-size-val/.test(sPost) && /id=hud-toc-track-val/.test(sPost) &&
  !/hud-toc__size-val[^>]*id=hud-toc-size-val[^>]*hud-toc-track/.test(sPost));
ok('★★★ 字号/字距那组:8 个元素按每行 4 格排成 2 行(写 3 列会排成 5 行)',
  (tplCode.match(/class="hud-toc__(?:size-lab|step|size-val)"/g) || []).length === 8 &&
  /grid-template-columns:\s*26px auto auto auto/.test(css) &&
  !/grid-template-columns:\s*[^;]*\b\d+px\s+auto\s+\d+px/.test(css),
  '子元素 ' + (tplCode.match(/class="hud-toc__(?:size-lab|step|size-val)"/g) || []).length +
  ' 个,列数 ' + (((/grid-template-columns:\s*([^;]+)/.exec(css) || [])[1]) || '?').trim());
ok('★ 面板最小宽 176(够放"字距 [−][+] 0.003"一整行)',
  /MIN_W = 176/.test(js), 'MIN_W');

ok('page-hud.html 里渲染了 hud-toc', /partial "hud-toc\.html"/.test(hudTpl));
ok('extend_head 挂了 hud-toc.css', /hud-toc\.css/.test(rd(`${BH}/layouts/partials/extend_head.html`)));
ok('extend_footer 挂了 hud-toc.js', /hud-toc\.js/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('产物里两个资源都带上指纹', /hud-toc\.[0-9a-f]{20,}\.css/.test(post) && /hud-toc\.[0-9a-f]{20,}\.js/.test(post));

ok('★ 位置变量一律是 px 口径(不掺百分比)',
  /--hud-toc-cx:\s*70vw/.test(css) &&
  /--hud-toc-lane:\s*calc\(70vw \+ 12px\)/.test(css) &&
  /--hud-toc-x:\s*calc\(70vw \+ 30px\)/.test(css),
  '百分比会和 px 在 calc 里混算错(见 CSS 注释)');
ok('★ JS 写进去的也是 px(不是百分比)',
  /setProperty\("--hud-toc-lane",\s*bar \+ "px"\)/.test(js) &&
  /setProperty\("--hud-toc-x",\s*left \+ "px"\)/.test(js) &&
  !/setProperty\("--hud-toc-x",\s*pct\(/.test(js));
ok('面板宽度由变量驱动(可大可小)',
  /\.hud-toc__panel\s*\{[^}]*width:\s*var\(--hud-toc-panel-w\)/.test(css));
ok('缝太窄时整块收掉(.is-tight)',
  /\.hud-toc\.is-tight\s*\{\s*display:\s*none/.test(css) && /MIN_W/.test(js));
ok('整块默认不吃鼠标事件(和 HUD 一个规矩)',
  /\.hud-toc\s*\{[^}]*pointer-events:\s*none/.test(css) &&
  /\.hud-toc__box\s*\{[^}]*pointer-events:\s*auto/.test(css));

ok('★ 目录的收起页签已停用(hidden),标记留着给导航栏复用',
  /class="hud-toc__toggle"[^>]*\bhidden\b/.test(tpl) &&
  /\.hud-toc__toggle\s*\{[^}]*display:\s*none/.test(css) &&
  /\.hud-toc__toggle:not\(\[hidden\]\)/.test(css));
ok('模块也认 hidden(停用后不再初始化 aria)',
  /if \(toggle && !toggle\.hidden/.test(js));

ok('★ 目录字号固定成用户挑的 16px / 0.04em(不再跟着按钮变)',
  /--toc-fs:\s*calc\(16px \* var\(--hud-s/.test(css) && /--toc-ls:\s*0\.04em/.test(css) &&
  /\.hud-toc__title\s*\{[^}]*font-size:\s*calc\(21px \* var\(--hud-s/.test(css),
  '16px/21px 是基准值(1600×900),现在再乘 --hud-s —— 大屏上跟着一起放大');
ok('字体大小/字距可调并存 localStorage(现在存的是正文那组)',
  /localStorage\.setItem\(KEY/.test(js) && /localStorage\.getItem\(KEY/.test(js) &&
  /KEY = "content-type"/.test(js));

ok('★ 面板有四角直角括号装饰(和笔那排的框同一套美术)',
  (sPost.match(/class=hud-toc__deco|<span class="hud-toc__deco"/g) || []).length === 1 &&
  /\.hud-toc__deco i\s*\{[^}]*border:\s*1px solid var\(--hud-toc-cyan\)/.test(css));
ok('装饰不吃鼠标事件(纯装饰)',
  /\.hud-toc__deco\s*\{[^}]*pointer-events:\s*none/.test(css));
ok('当前小节有青色底衬(不只是左边条)',
  /\.hud-toc__item\.is-current\s*\{[^}]*background:\s*linear-gradient/.test(css));

ok('★ 进度条高度 = 面板高度(不是盒子高、更不是百分比)',
  /\.hud-toc__prog\s*\{[^}]*height:\s*var\(--hud-toc-panel-h\)/.test(css) &&
  /\.hud-toc\s*\{[^}]*height:\s*var\(--hud-toc-h\)/.test(css));
ok('★ 三者共用一个垂直中心:整层 flex 居中 + 槽线自己 align-self + 面板与圆按钮竖排',
  /\.hud-toc\s*\{[^}]*align-items:\s*center/.test(css) &&
  /\.hud-toc__prog\s*\{[^}]*align-self:\s*center/.test(css) &&
  /\.hud-toc__box\s*\{[^}]*justify-content:\s*center/.test(css));
ok('高度由 JS 按宽度定比例后写进 --hud-toc-h 和 --hud-toc-panel-h',
  /setProperty\("--hud-toc-h",\s*boxH \+ "px"\)/.test(js) &&
  /setProperty\("--hud-toc-panel-h",\s*panelH \+ "px"\)/.test(js) && /H_RATIO/.test(js));

function fakeDom(opts) {
  const noToc = !!(opts && opts.noToc);
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
      getBoundingClientRect() {
        const r = el._rect || { left: 0, top: 0, right: 0, bottom: 0 };
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.right - r.left, height: r.bottom - r.top };
      },
      querySelector: (s) => el._q[s] || null,
      querySelectorAll: (s) => el._qa[s] || [],
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
    a.attrs['data-hud-toc-id'] = id; a.attrs['data-hud-toc-lvl'] = '2';
    a.textContent = id;
    return a;
  });

  const list = mk('nav');
  const panel = mk('div'), toggle = mk('button'), prog = mk('div'), thumb = mk('span');
  const sizeVal = mk('span'), trackVal = mk('span');
  const typePillEl = mk('div'), typeSizeVal = mk('span'), typeTrackVal = mk('span');
  typePillEl.hidden = true;
  toggle.hidden = false;
  const topBtn = mk('button'), themeTop = mk('a');
  themeTop._cls.add("hidden");
  const root = mk('div');
  root._q = { '.hud-toc__prog': prog, '.hud-toc__prog-thumb': thumb, '.hud-toc__list': list };
  root._qa = { '.hud-toc__item': items };

  const main = mk('main');
  main.offsetHeight = 3000;
  main._rect = { left: 600, top: 200, right: 1320, bottom: 1174 };

  const navEl = mk('nav');
  navEl._rect = { left: 1470, top: 300, right: 1700, bottom: 700 };

  const heads = {};  const secTopDoc = { s1: 600, s2: 1300, s3: 2000 };
  secIds.forEach((id) => {
    const h = mk('h2');
    h.attrs.id = id;
    h._topDoc = secTopDoc[id];
    h._rect = { left: 600, top: h._topDoc, right: 1320, bottom: h._topDoc + 40 };
    heads[id] = h;
  });

  const elVars = {};
  const docElStyle = {
    setProperty: (k, v) => { elVars[k] = String(v); },
    getPropertyValue: (k) => (k in elVars ? elVars[k] : ''),
    removeProperty: (k) => { delete elVars[k]; }
  };

  const doc = {
    documentElement: { clientWidth: 1700, clientHeight: 1000, style: docElStyle, classList: { add() {}, remove() {}, contains: () => false } },
    getElementById: (id) => {
      if (noToc && (id === 'hud-toc' || id === 'hud-toc-panel' || id === 'hud-toc-toggle' ||
        id === 'hud-toc-size-val' || id === 'hud-toc-track-val' || id === 'hud-toc-top')) return null;
      if (id === 'hud-toc') return root;
      if (id === 'hud-toc-panel') return panel;
      if (id === 'hud-toc-toggle') return toggle;
      if (id === 'hud-toc-size-val') return sizeVal;
      if (id === 'hud-toc-track-val') return trackVal;
      if (id === 'hud-type') return typePillEl;
      if (id === 'hud-type-size-val') return typeSizeVal;
      if (id === 'hud-type-track-val') return typeTrackVal;
      if (id === 'hud-toc-top') return topBtn;
      if (id === 'top-link') return themeTop;
      return secIds.indexOf(id) >= 0 ? heads[id] : null;
    },
    querySelector: (s) => {
      if (s.indexOf('main') === 0) return main;
      if (s.indexOf('.hud-nav') === 0) return navEl;
      return null;
    },
    body: main,
    addEventListener() {}
  };

  const wins = [];
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
    root, panel, toggle, prog, thumb, list, items, sizeVal, trackVal, heads, main, doc, win,
    typePillEl, typeSizeVal, typeTrackVal,
    mkBtn,
    buttons: { sizeDown, sizeUp, trackDown, trackUp },
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
  env.flush();
  return env.win.__hudToc;
}

function press(el) {
  if (!el || !el._ev || !el._ev.click) return 0;
  el._ev.click.forEach((f) => f({ preventDefault() {}, target: el._target || el }));
  return el._ev.click.length;
}
function pressOn(rootEl, target) {
  rootEl._target = target;
  try { return press(rootEl); } finally { rootEl._target = null; }
}

{
  const env = fakeDom();
  const api = boot(env);
  ok('模块启动后暴露排障出口 __hudToc', !!api);
  ok('数出了 3 个条目', api && api.items === 3, api && String(api.items));

  env.scrollTo(0);
  env.fireScroll();
  ok('★ 没开始读时进度 = 0', api.p() === 0, String(api.p()));

  env.scrollTo(700);
  env.fireScroll();
  ok('★ 进度按 (滚动 - 正文顶) / (正文高 - 视口高) 算', Math.abs(api.p() - 0.25) < 1e-6, String(api.p()));

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

{
  const env = fakeDom();
  const api = boot(env);
  env.scrollTo(700);
  env.fireScroll();
  ok('★ 进度条和光点都吃到了 --hud-toc-p',
    env.prog.style.getPropertyValue('--hud-toc-p') === '0.2500' &&
    env.thumb.style.getPropertyValue('--hud-toc-p') === '0.2500',
    env.prog.style.getPropertyValue('--hud-toc-p'));

  const cur = env.items.filter((a) => a.classList.contains('is-current'));
  ok('★ 当前小节只有一个高亮', cur.length === 1, `高亮 ${cur.length} 个`);
  ok('★ 刚进正文时高亮第一个小节(s1)',
    cur[0] === env.items[0] && api.active() === 's1', api.active());

  env.scrollTo(900);
  env.fireScroll();
  ok('★ 滚一个小节后仍高亮 s1', api.active() === 's1', api.active());

  env.scrollTo(1900);
  env.fireScroll();
  const cur2 = env.items.filter((a) => a.classList.contains('is-current'));
  ok('★ 继续下滚会切到后面的小节(s3)', cur2.length === 1 && api.active() === 's3', api.active());
}

{
  const env = fakeDom();
  const api = boot(env);
  ok('默认是展开的', api.collapsed() === false && env.toggle.getAttribute('aria-expanded') === 'true');
  press(env.toggle);
  ok('★ 点页签后挂上 is-collapsed(= max-width 收到 0 的那个类)', api.collapsed() === true);
  ok('★ aria-expanded 同步变 false(无障碍)', env.toggle.getAttribute('aria-expanded') === 'false');
  ok('页签的 title 也跟着改', env.toggle.title === '展开目录', String(env.toggle.title));
  press(env.toggle);
  ok('再点一次展开回来', api.collapsed() === false && env.toggle.getAttribute('aria-expanded') === 'true');
}

{
  const env = fakeDom();
  const api = boot(env);
  ok('★ 默认写的是【正文】的字号变量(不是目录的)',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '17px' &&
    env.root.style.getPropertyValue('--toc-fs') === '',
    '正文 ' + env.doc.documentElement.style.getPropertyValue('--article-fs') +
    ' / 目录 ' + (env.root.style.getPropertyValue('--toc-fs') || '(没被碰过)'));
  ok('行距跟着一起写(字越大行距比例略收)',
    Number(env.doc.documentElement.style.getPropertyValue('--article-lh')) > 1.5 &&
    Number(env.doc.documentElement.style.getPropertyValue('--article-lh')) < 1.8,
    env.doc.documentElement.style.getPropertyValue('--article-lh'));
  pressOn(env.root, env.buttons.sizeUp); pressOn(env.root, env.buttons.sizeUp);
  pressOn(env.root, env.buttons.trackUp);
  ok('★ 字号 +2 ⇒ 19px(正文)', env.doc.documentElement.style.getPropertyValue('--article-fs') === '19px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));
  ok('★ 字距 +1 ⇒ 0.001em(正文)', env.doc.documentElement.style.getPropertyValue('--article-ls') === '0.001em',
    env.doc.documentElement.style.getPropertyValue('--article-ls'));
  ok('★ 目录自己的字号不受影响(用户挑好的 16px 固定)',
    env.root.style.getPropertyValue('--toc-fs') === '', '目录变量从头到尾没被写过');
  ok('字号写进了 localStorage', /"fs":19/.test(env.store['content-type'] || ''), env.store['content-type']);
  ok('★ 字号那一行的读数 = "19px"(带单位、只讲字号)',
    env.sizeVal.textContent === '19px', String(env.sizeVal.textContent));
  ok('★ 字距那一行的读数 = "0.001"(只讲字距)',
    env.trackVal.textContent === '0.001', String(env.trackVal.textContent));
  ok('★ 读数不再拼成含糊的 "19/1"',
    !/^\d+\/\d+$/.test(String(env.sizeVal.textContent)));
  for (let i = 0; i < 30; i++) pressOn(env.root, env.buttons.sizeUp);
  ok('★ 字号有上限 22px', env.doc.documentElement.style.getPropertyValue('--article-fs') === '22px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));
  for (let i = 0; i < 40; i++) pressOn(env.root, env.buttons.sizeDown);
  ok('★ 字号有下限 14px', env.doc.documentElement.style.getPropertyValue('--article-fs') === '14px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));
  for (let i = 0; i < 40; i++) pressOn(env.root, env.buttons.trackDown);
  ok('★ 字距下限是 0em(不会变负)', env.doc.documentElement.style.getPropertyValue('--article-ls') === '0.000em',
    env.doc.documentElement.style.getPropertyValue('--article-ls'));
}

{
  const env = fakeDom();
  const api = boot(env);
  ok('产物里有我们自己的回到顶部按钮', /id=hud-toc-top|id="hud-toc-top"/.test(sPost));
  ok('主题原来那枚被让位(不是删掉:它的类和滚动逻辑还被借用)',
    /:root\[data-theme\]\.shell-page \.top-link\s*\{[^}]*opacity:\s*0/.test(css) &&
    /:root\[data-theme\]\.shell-page \.top-link\s*\{[^}]*pointer-events:\s*none/.test(css));
  ok('★ 按钮在面板下方(盒子里是竖向排列)',
    /\.hud-toc__box\s*\{[^}]*flex-direction:\s*column/.test(css) &&
    /\.hud-toc__panel\s*\{[^}]*flex:\s*0 0 auto/.test(css));
  ok('★ 面板高 = 盒子高 − 圆按钮 − 间距 − 上下留白(JS 算)',
    /panelH = boxH - TOP_H - TOP_GAP - BOX_PAD/.test(js) &&
    /setProperty\("--hud-toc-panel-h"/.test(js));
  ok('默认不吃鼠标事件,滚动到位才亮(和主题那枚一致)',
    /\.hud-toc__top\s*\{[^}]*opacity:\s*0/.test(css) && /\.hud-toc__top\.is-on\s*\{[^}]*opacity:\s*1/.test(css));
  ok('点击交给主题那套滚动(不重复实现)', /themeTop\.click\(\)/.test(js));
  ok('显隐跟着主题那枚走(MutationObserver + scroll 双保险)',
    /MutationObserver/.test(js) && /topBtn\.classList\.toggle\("is-on"/.test(js));
}

{
  ok('★ 槽线高度 = 面板高(不依赖内容)',
    /\.hud-toc__prog\s*\{[^}]*height:\s*var\(--hud-toc-panel-h\)/.test(css));
  ok('★ __prog 自己 align-self:center(不再靠父级 align-items)',
    /\.hud-toc__prog\s*\{[^}]*align-self:\s*center/.test(css) &&
    /\.hud-toc__lane\s*\{[^}]*justify-content:\s*center/.test(css) &&
    !/\.hud-toc__lane\s*\{[^}]*align-items:\s*center/.test(css));
  ok('槽线有可见的轨道色(不是透明)',
    /\.hud-toc__prog\s*\{[^}]*background:\s*var\(--hud-toc-line\)/.test(css));
  ok('和面板同心(父级居中 + 面板下方多出圆按钮的补偿)',
    /\.hud-toc\s*\{[^}]*align-items:\s*center/.test(css) &&
    /\.hud-toc__prog\s*\{[^}]*translateY\(-22px\)/.test(css));
}

{
  const env = fakeDom();
  const api = boot(env);
  const lay = () => api.layout();

  ok('★ 缝太窄时整块收掉(is-tight)', api.tight() === true, JSON.stringify(lay()));

  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0 ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 缝够宽就显示出来', api.tight() === false, JSON.stringify(lay()));
  ok('★ 进度条 = 正文右缘 + 12', env.root.style.getPropertyValue('--hud-toc-lane') === '1332px',
    env.root.style.getPropertyValue('--hud-toc-lane'));
  ok('★ 面板左缘 = 进度条 + 18', env.root.style.getPropertyValue('--hud-toc-x') === '1350px',
    env.root.style.getPropertyValue('--hud-toc-x'));
  ok('★ 面板宽 = 一直撑到竖栏左边留 6px', env.root.style.getPropertyValue('--hud-toc-panel-w') === '244px',
    env.root.style.getPropertyValue('--hud-toc-panel-w'));
  ok('★ 面板右缘 ≤ 竖栏左缘(绝不压导航)',
    parseFloat(env.root.style.getPropertyValue('--hud-toc-x')) + parseFloat(env.root.style.getPropertyValue('--hud-toc-panel-w')) <= 1600);

  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0 ? { getBoundingClientRect: () => ({ left: 1520, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 竖栏左移后重新量(不会被"视口没变"挡住)',
    env.root.style.getPropertyValue('--hud-toc-panel-w') === '164px',
    env.root.style.getPropertyValue('--hud-toc-panel-w'));
  ok('★ 重算后缝不够就收掉', api.tight() === true, JSON.stringify(lay()));

  env.main._rect = { left: 600, top: 200, right: 1280, bottom: 1174 };
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0 ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 正文右缘变了也跟着重算', api.tight() === false &&
    env.root.style.getPropertyValue('--hud-toc-lane') === '1292px' &&
    env.root.style.getPropertyValue('--hud-toc-panel-w') === '284px',
    env.root.style.getPropertyValue('--hud-toc-lane') + ' / ' + env.root.style.getPropertyValue('--hud-toc-panel-w'));
}

{
  const env = fakeDom();
  env.store['content-type'] = JSON.stringify({ fs: 20, ls: 5 });
  boot(env);
  ok('★ 下次打开沿用上次的【正文】字号/字距',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '20px' &&
    env.doc.documentElement.style.getPropertyValue('--article-ls') === '0.005em',
    env.doc.documentElement.style.getPropertyValue('--article-fs') + ' / ' +
    env.doc.documentElement.style.getPropertyValue('--article-ls'));
}

{
  const env = fakeDom();
  env.doc.getElementById = () => null;
  let threw = null;
  try { boot(env); } catch (e) { threw = e.message; }
  ok('★ 页面上没有目录时不报错(列表页/首页也加载这个脚本)', threw === null, String(threw));
}

{
  const env = fakeDom();
  const api = boot(env);
  ok('★ 目录收掉时(.is-tight)备用胶囊顶上来',
    api.tight() === true && api.pill() === true,
    'tight=' + api.tight() + ' pill=' + api.pill());
  ok('胶囊上的读数也写上了当前值',
    env.typeSizeVal.textContent === '17px' && env.typeTrackVal.textContent === '0',
    env.typeSizeVal.textContent + ' / ' + env.typeTrackVal.textContent);

  const pillUp = env.mkBtn('data-hud-toc-size', 1);
  pressOn(env.root, pillUp);
  ok('★ 点胶囊里的 + 也能改正文字号(同一套 data 属性)',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '18px' &&
    env.typeSizeVal.textContent === '18px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));

  env.main._rect = { left: 600, top: 200, right: 1280, bottom: 1174 };
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0
    ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 目录能用时胶囊收起来(不在屏幕上出现两份字号控件)',
    api.tight() === false && api.pill() === false,
    'tight=' + api.tight() + ' pill=' + api.pill());
}

{
  const env = fakeDom({ noToc: true });
  const api = boot(env);
  ok('★ 没有目录 DOM 时备用胶囊顶上(列表页也能调正文)',
    api.pill() === true, 'pill=' + api.pill());
  ok('★ 没有目录时不报错,而且读数照写',
    env.typeSizeVal.textContent === '17px', env.typeSizeVal.textContent);
  const pillUp = env.mkBtn('data-hud-toc-size', 1);
  pressOn(env.typePillEl, pillUp);
  ok('★ 列表页上点胶囊真的改到了正文字号',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '18px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));

  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0
    ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  const laneRight = 1600 - 6;
  const pillW = 180;
  ok('★★★ 没有目录时,胶囊【贴着竖栏】站(不浮在屏幕中段,也不在左上角)',
    env.typePillEl.classList.contains('hud-type--lane') &&
    Number(String(env.typePillEl.style.left).replace('px', '')) + pillW === laneRight &&
    /px$/.test(String(env.typePillEl.style.top)),
    'lane=' + env.typePillEl.classList.contains('hud-type--lane') +
    ' left=' + env.typePillEl.style.left + ' top=' + env.typePillEl.style.top +
    '(期望 left=' + (laneRight - pillW) + 'px,右缘正好贴 ' + laneRight + ')');

  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0
    ? { getBoundingClientRect: () => ({ left: 1480, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★★ 缝太窄就退回左栏(不硬塞着压住正文)',
    !env.typePillEl.classList.contains('hud-type--lane') && !env.typePillEl.style.left,
    'lane=' + env.typePillEl.classList.contains('hud-type--lane') + ' left=' + env.typePillEl.style.left);

  ok('★★ 两个位置共用同一套量法(laneBox 只写一遍)+ 那个类有样式',
    (js.match(/function laneBox\(/g) || []).length === 1 && /PILL_W/.test(js) &&
    /\.hud-type--lane\s*\{/.test(noC(rd(`${BH}/assets/css/page-hud.css`))),
    '.hud-type--lane 的样式跟着基类放在 page-hud.css 里');
}

let bad = 0;
const pad = (s, n) => String(s).padEnd(n);
rows.forEach(([p, n, i]) => {
  if (!p) bad++;
  console.log(`${p ? 'PASS' : 'FAIL'}  ${pad(n, 60)} ${i}`);
});
console.log(`\n${rows.length - bad}/${rows.length} 通过` + (bad ? `  ★ ${bad} 条失败` : ''));
process.exit(bad ? 1 : 0);
