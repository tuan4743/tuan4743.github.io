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
const home = rd(`${WS}/.tmp/t1/home/index.html`);
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
  (sPost.match(/data-hud-toc-size=/g) || []).length === 4 &&
  (sPost.match(/data-hud-toc-track=/g) || []).length === 4,
  '面板里两组各两个 + 左栏那枚备用胶囊里两组各两个 = 每页 4 个(见下一节)');
/* ★★ 用户第五轮:"你把字号字距改成了一个正文,导致现在是一个配文四个按钮,
   不知道具体哪个是哪个。" ⇒ 两行各有自己的标签和读数(见 ③d 的读数断言)。 */
ok('★ 字号/字距各有自己的行标签(不再共用一个"正文")',
  /class=hud-toc__size-lab[^>]*>字号</.test(sPost) && /class=hud-toc__size-lab[^>]*>字距</.test(sPost) &&
  !/class=hud-toc__size-lab[^>]*>正文</.test(sPost),
  '标签:字号 / 字距');
ok('★ 两行各有自己的读数元素(id 不同)',
  /id=hud-toc-size-val/.test(sPost) && /id=hud-toc-track-val/.test(sPost) &&
  !/hud-toc__size-val[^>]*id=hud-toc-size-val[^>]*hud-toc-track/.test(sPost));
/* ★★★ 用户第六轮:"右侧目录栏那两个按钮组件排布不对"。
   原因:列数写成了 3(26px auto auto),而这一组有 8 个子元素
   (2 标签 + 4 按钮 + 2 读数)⇒ 排成五行:字号 / − + / 字距 / 17px − / + 0。
   列数必须等于"每行的元素数" = 4。
   ★ 这算一次教训:下面这条断言原来把 `26px auto auto` 当成正确值钉住了 ——
     测试把 bug 一起保下来了。所以这里改成【先数元素、再核列数】。 */
ok('★★★ 字号/字距那组:8 个元素按每行 4 格排成 2 行(写 3 列会排成 5 行)',
  (tplCode.match(/class="hud-toc__(?:size-lab|step|size-val)"/g) || []).length === 8 &&
  /grid-template-columns:\s*26px auto auto auto/.test(css) &&
  !/grid-template-columns:\s*[^;]*\b\d+px\s+auto\s+\d+px/.test(css),
  '子元素 ' + (tplCode.match(/class="hud-toc__(?:size-lab|step|size-val)"/g) || []).length +
  ' 个,列数 ' + (((/grid-template-columns:\s*([^;]+)/.exec(css) || [])[1]) || '?').trim());
ok('★ 面板最小宽 176(够放"字距 [−][+] 0.003"一整行)',
  /MIN_W = 176/.test(js), 'MIN_W');

/* 挂载链:HUD 里渲染 + 样式和脚本都发出去 */
ok('page-hud.html 里渲染了 hud-toc', /partial "hud-toc\.html"/.test(hudTpl));
ok('extend_head 挂了 hud-toc.css', /hud-toc\.css/.test(rd(`${BH}/layouts/partials/extend_head.html`)));
ok('extend_footer 挂了 hud-toc.js', /hud-toc\.js/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('产物里两个资源都带上指纹', /hud-toc\.[0-9a-f]{20,}\.css/.test(post) && /hud-toc\.[0-9a-f]{20,}\.js/.test(post));

/* ============================================================
   ② 样式:位置规则(具体数值由 JS 量出来 → 见 ③g)
   ============================================================ */
/* ★★★ 用户第二轮:"这个位置明显就不对啊,遮住了内容页" —— 原因就是位置写成了
   视口百分比,而正文是 720px 居中、右缘百分比随窗口宽度变(1920 ⇒ 68.7%,
   1416 ⇒ 70.4%)。现在位置只能由 JS 量(正文右缘 + 竖栏左缘)后写成 px。 */
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

/* ★ 用户第四条:"这个右滑的收起页我其实本意是想给导航栏的" ⇒ 目录的页签停用 */
ok('★ 目录的收起页签已停用(hidden),标记留着给导航栏复用',
  /class="hud-toc__toggle"[^>]*\bhidden\b/.test(tpl) &&
  /\.hud-toc__toggle\s*\{[^}]*display:\s*none/.test(css) &&
  /\.hud-toc__toggle:not\(\[hidden\]\)/.test(css));
ok('模块也认 hidden(停用后不再初始化 aria)',
  /if \(toggle && !toggle\.hidden/.test(js));

/* ★ 用户第四轮挑定:"目录页的字号16,字间距4我觉得很好看" ⇒ 目录固定这一组 */
ok('★ 目录字号固定成用户挑的 16px / 0.04em(不再跟着按钮变)',
  /--toc-fs:\s*calc\(16px \* var\(--hud-s/.test(css) && /--toc-ls:\s*0\.04em/.test(css) &&
  /\.hud-toc__title\s*\{[^}]*font-size:\s*calc\(21px \* var\(--hud-s/.test(css),
  '16px/21px 是基准值(1600×900),现在再乘 --hud-s —— 大屏上跟着一起放大');
ok('字体大小/字距可调并存 localStorage(现在存的是正文那组)',
  /localStorage\.setItem\(KEY/.test(js) && /localStorage\.getItem\(KEY/.test(js) &&
  /KEY = "content-type"/.test(js));

/* ★ 用户第三条:"卡片整体我觉得可以再装饰一下" */
ok('★ 面板有四角直角括号装饰(和笔那排的框同一套美术)',
  (sPost.match(/class=hud-toc__deco|<span class="hud-toc__deco"/g) || []).length === 1 &&
  /\.hud-toc__deco i\s*\{[^}]*border:\s*1px solid var\(--hud-toc-cyan\)/.test(css));
ok('装饰不吃鼠标事件(纯装饰)',
  /\.hud-toc__deco\s*\{[^}]*pointer-events:\s*none/.test(css));
ok('当前小节有青色底衬(不只是左边条)',
  /\.hud-toc__item\.is-current\s*\{[^}]*background:\s*linear-gradient/.test(css));

/* ★ "卡片怎么没有居中对齐":面板和进度条必须【同高 + 同中心】
   (第四轮又在面板下面加了一枚回到顶部,所以高度分成了"盒子高"和"面板高") */
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

/* ============================================================
   ③ 运行时:拿真模块 + 假 DOM 跑一遍
   ============================================================ */
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
  const panel = mk('div'), toggle = mk('button'), prog = mk('div'), thumb = mk('span');
  /* ★ 两个读数各一个元素(用户第五轮:一个"正文"配四个按钮认不出谁管谁)
     ⇒ 模块分别写 #hud-toc-size-val 和 #hud-toc-track-val。
     少给 trackVal 这一条,第二个读数就永远是空字符串,断言会假失败。 */
  const sizeVal = mk('span'), trackVal = mk('span');
  /* ★ 左栏那枚备用胶囊(窄屏/列表页上的字号控件):默认 hidden,
     模块按"目录还能不能用"决定要不要把它顶上来。 */
  const typePillEl = mk('div'), typeSizeVal = mk('span'), typeTrackVal = mk('span');
  typePillEl.hidden = true;
  /* ★ 生产环境里这个页签是 hidden 的(用户要把"收起"给导航栏用)⇒ 模块不绑事件。
     测试里把它标成"没隐藏",好把"收起/展开"这套逻辑本身继续钉住 ——
     导航栏那一版会直接复用同一段代码。 */
  toggle.hidden = false;
  /* 「回到顶部」:我们那枚 + 主题那枚(模块靠主题那枚的 .hidden 同步显隐) */
  const topBtn = mk('button'), themeTop = mk('a');
  themeTop._cls.add("hidden");
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

  /* 竖栏(导航):布局靠它的左缘算"缝有多宽"。给它一个真值,
     否则 --hud-toc-panel-w 会拿到兜底宽度,位置断言就假了。 */
  const navEl = mk('nav');
  navEl._rect = { left: 1470, top: 300, right: 1700, bottom: 700 };

  const heads = {};  const secTopDoc = { s1: 600, s2: 1300, s3: 2000 };   /* 三个小节在文档里的位置 */
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

  /* documentElement 上要能写 CSS 变量(正文字号就写在它身上) */
  const elVars = {};
  const docElStyle = {
    setProperty: (k, v) => { elVars[k] = String(v); },
    getPropertyValue: (k) => (k in elVars ? elVars[k] : ''),
    removeProperty: (k) => { delete elVars[k]; }
  };

  const doc = {
    /* ★ documentElement.clientWidth 是【视口宽、不含滚动条】——
       布局计算全按它算(和真浏览器一个口径);少给一个就会直接崩。 */
    documentElement: { clientWidth: 1700, clientHeight: 1000, style: docElStyle, classList: { add() {}, remove() {}, contains: () => false } },
    /* ★ 正文标题走 id 属性(真浏览器里就是 id="s1");目录内部的几个固定 id 直接给。 */
    getElementById: (id) => {
      /* ★★ 列表页/首页根本没有目录 DOM:整块 hud-toc* 都要返回 null ——
         模块就是从"拿不到目录"推出"该把备用胶囊顶上来"的。 */
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
      if (s.indexOf('.hud-nav') === 0) return navEl;   /* 布局要量它的左缘 */
      return null;
    },
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
    root, panel, toggle, prog, thumb, list, items, sizeVal, trackVal, heads, main, doc, win,
    typePillEl, typeSizeVal, typeTrackVal,
    /* ★ 备用胶囊那几条用例要在块外造按钮点击,所以把造按钮的工具一起交出去
       (mk 是块内私有的,不交出来外面就只能手搓对象,重复一遍反而更容易写错) */
    mkBtn,
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

/* ---- ③d 字号 / 字距:★ 调的是【正文】,不是目录(用户第四轮)---- */
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
  /* ★ 用户第五轮:"一个配文四个按钮,不知道具体哪个是哪个" ⇒ 两个读数各写各的 */
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

/* ---- ③d2 回到顶部:在目录下面、和主题那枚同步 ----
   ★ 用户第四轮:"左下角有一个圆的 go to top 按钮……这个按钮给他放到目录页
     下面靠内容页的地方吧" */
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

/* ---- ③d3 进度条槽线:第四轮坏过一次(只剩一个光点)----
   根因:.hud-toc__prog 是 flex 子项,又被设成 align-items:center,
        高度变成"内容高度" ⇒ 里面只有绝对定位的光点 ⇒ 高度 0 ⇒ 整条槽没了。
   ⇒ 现在:__lane 自身 stretch,__prog 用 align-self:center + 显式高度。 */
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

/* ---- ③g 位置:量出来的三个数必须"面板永远不压导航"(用户第一个问题) ----
   ★ 这一组是【不依赖浏览器】的那道保险:真浏览器里我用 CDP 扫了 9 档宽度
     (2560/1920/1700/1600/1500/1416/1366/1280/1180)确认零重叠,
     但那要靠手动跑;这里把同一条不变量钉进测试,以后改坏了立刻红。 */
{
  const env = fakeDom();
  const api = boot(env);
  const lay = () => api.layout();

  /* 默认夹具:正文右缘 1320、竖栏左缘 1470 ⇒ 缝 = 1470-6-(1320+30) = 114px < 168 ⇒ 收掉 */
  ok('★ 缝太窄时整块收掉(is-tight)', api.tight() === true, JSON.stringify(lay()));

  /* 缝够宽的情况:竖栏挪到 1600 ⇒ 缝 244px */
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

  /* ★★ 回归:同一个视口宽下,正文/竖栏的位置后来变了,必须重算 ——
     以前的守卫是"视口没变就跳过",于是旧的宽度一直留着,
     实测就让面板压住导航 7px。 */
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0 ? { getBoundingClientRect: () => ({ left: 1520, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 竖栏左移后重新量(不会被"视口没变"挡住)',
    env.root.style.getPropertyValue('--hud-toc-panel-w') === '164px',
    env.root.style.getPropertyValue('--hud-toc-panel-w'));
  /* 164 < MIN_W(168) ⇒ 应该收掉 */
  ok('★ 重算后缝不够就收掉', api.tight() === true, JSON.stringify(lay()));

  /* 正文右缘也变了(字体加载完变宽) */
  env.main._rect = { left: 600, top: 200, right: 1280, bottom: 1174 };
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0 ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 正文右缘变了也跟着重算', api.tight() === false &&
    env.root.style.getPropertyValue('--hud-toc-lane') === '1292px' &&
    env.root.style.getPropertyValue('--hud-toc-panel-w') === '284px',
    env.root.style.getPropertyValue('--hud-toc-lane') + ' / ' + env.root.style.getPropertyValue('--hud-toc-panel-w'));
}

/* ---- ③e 读回上次存的【正文】字号 ---- */
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

/* ---- ③f 没有这块 DOM 时必须静默退出(列表页/首页会加载同一个脚本) ---- */
{
  const env = fakeDom();
  env.doc.getElementById = () => null;
  let threw = null;
  try { boot(env); } catch (e) { threw = e.message; }
  ok('★ 页面上没有目录时不报错(列表页/首页也加载这个脚本)', threw === null, String(threw));
}

/* ---- ③g 备用胶囊:目录用不了的时候,字号控件必须还在 ----
   ★ 用户第五轮之后从 CDP 扫描里发现的:目录面板在缝太窄时整块 display:none,
     而字号控件住在面板里 ⇒ 1280 及以下的窗口上【根本调不了正文字号】,
     可"方便用户调内容页"正是用户这一轮点名的需求。 */
{
  /* g1:有目录、缝太窄 ⇒ 胶囊顶上 */
  const env = fakeDom();
  const api = boot(env);
  ok('★ 目录收掉时(.is-tight)备用胶囊顶上来',
    api.tight() === true && api.pill() === true,
    'tight=' + api.tight() + ' pill=' + api.pill());
  ok('胶囊上的读数也写上了当前值',
    env.typeSizeVal.textContent === '17px' && env.typeTrackVal.textContent === '0',
    env.typeSizeVal.textContent + ' / ' + env.typeTrackVal.textContent);

  /* 点胶囊里的 + :模块的委托点击挂在 root 上,而 root 里有面板那四个按钮 ——
     这里直接按胶囊上的按钮点(root 上的处理器会收到冒泡)。 */
  const pillUp = env.mkBtn('data-hud-toc-size', 1);
  pressOn(env.root, pillUp);
  ok('★ 点胶囊里的 + 也能改正文字号(同一套 data 属性)',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '18px' &&
    env.typeSizeVal.textContent === '18px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));

  /* g2:缝够宽 ⇒ 胶囊让位(同一个控件不该出现两份) */
  env.main._rect = { left: 600, top: 200, right: 1280, bottom: 1174 };
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0
    ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  ok('★ 目录能用时胶囊收起来(不在屏幕上出现两份字号控件)',
    api.tight() === false && api.pill() === false,
    'tight=' + api.tight() + ' pill=' + api.pill());
}

/* ---- ③h 列表页/首页(完全没有目录 DOM):胶囊必须顶上 ----
   第一版这里写的是 if (!root) return; ⇒ 那些页面上字号控件一个都没有。 */
{
  const env = fakeDom({ noToc: true });
  const api = boot(env);
  ok('★ 没有目录 DOM 时备用胶囊顶上(列表页也能调正文)',
    api.pill() === true, 'pill=' + api.pill());
  ok('★ 没有目录时不报错,而且读数照写',
    env.typeSizeVal.textContent === '17px', env.typeSizeVal.textContent);
  const pillUp = env.mkBtn('data-hud-toc-size', 1);
  pressOn(env.typePillEl, pillUp);     /* root 为 null ⇒ 处理器挂在胶囊自己身上 */
  ok('★ 列表页上点胶囊真的改到了正文字号',
    env.doc.documentElement.style.getPropertyValue('--article-fs') === '18px',
    env.doc.documentElement.style.getPropertyValue('--article-fs'));

  /* ★★★ 它不能再一个人留在左上角,也【不能浮在屏幕中段】——
     要贴着竖栏站。
     用户第七轮:"如果没有目录,那么目录里面的字体大小调节模块就会单独跑到左上角,
     比如六十年这一篇"(那一篇没有小标题 ⇒ hud-toc.html 整块不渲染)。
     用户第十轮:"换到27寸屏幕……单独放的字体字号按钮,跑到了屏幕正中央。"
     ⇒ 改成【贴缝的右端】:缝的净宽 = navLeft − GAP_NAV − left(这里 1600−6−1350 = 244),
       胶囊左缘 = 缝右端 − 它自己的宽。屏幕多宽都紧挨着竖栏。 */
  env.doc.querySelector = (s) => (s.indexOf('.hud-nav') === 0
    ? { getBoundingClientRect: () => ({ left: 1600, right: 1700, top: 0, bottom: 0 }) } : env.main);
  api.relayout();
  const laneRight = 1600 - 6;          /* 竖栏左边 − GAP_NAV */
  const pillW = 180;                   /* 假 DOM 量不出 offsetWidth ⇒ 走 PILL_W 兜底 */
  ok('★★★ 没有目录时,胶囊【贴着竖栏】站(不浮在屏幕中段,也不在左上角)',
    env.typePillEl.classList.contains('hud-type--lane') &&
    Number(String(env.typePillEl.style.left).replace('px', '')) + pillW === laneRight &&
    /px$/.test(String(env.typePillEl.style.top)),
    'lane=' + env.typePillEl.classList.contains('hud-type--lane') +
    ' left=' + env.typePillEl.style.left + ' top=' + env.typePillEl.style.top +
    '(期望 left=' + (laneRight - pillW) + 'px,右缘正好贴 ' + laneRight + ')');

  /* 缝不够宽(胶囊 218px 站不进去)⇒ 老老实实退回左栏那套,别硬塞着压正文 */
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

/* ---------------- 输出 ---------------- */
let bad = 0;
const pad = (s, n) => String(s).padEnd(n);
rows.forEach(([p, n, i]) => {
  if (!p) bad++;
  console.log(`${p ? 'PASS' : 'FAIL'}  ${pad(n, 60)} ${i}`);
});
console.log(`\n${rows.length - bad}/${rows.length} 通过` + (bad ? `  ★ ${bad} 条失败` : ''));
process.exit(bad ? 1 : 0);
