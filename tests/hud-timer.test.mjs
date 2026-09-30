/* ============================================================
   番茄钟(左栏,可收起):构建产物 + 运行时行为 + 样式 三层验收
   ─────────────────────────────────────────────────────────────
   用户:"可以先继续做番茄钟,番茄钟做成可收起的。"

   为什么这块必须写测试(而不是"打开页面看一眼"):
   · 它有一台【真正的状态机】(专注/小憩 × 跑/停/刚跑完 × 收起/展开),
     而且状态要跨刷新存活。肉眼只能看到"当前这一屏",看不出
     "刷新回来还剩多少""切模式时长会不会串台"。
   · 计时【不能自己数秒】:setInterval 在后台标签页会被节流,
     按秒减一的写法切回来就少算好几分钟。这条只能靠"时钟不动、
     跑 200 次 tick、读数一丝不变"来钉住 —— 人手点不出来。
   · 收起/展开是"同一块 DOM 的两个形态"(CSS 按 .is-min 切),
     所以断言要落在类名和 caption 上,不能靠"宽度看起来变了"。

   跑法(先在工作区根目录构建,见 README):
     node tuagfey-blog/tests/hud-timer.test.mjs
   ============================================================ */
import fs from 'node:fs';

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
/* ★ 记住【真的 Date】:后面要把它换成假时钟,但模块里 new Date()(算"今天")
   还得靠真构造器。不给它留一份,那句会抛 TypeError,而错报出来是
   "今日计数没存下来" —— 完全指错方向。 */
globalThis.__RealDate = Date;
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
const noC = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const strip = (h) => h.replace(/="([^"]*)"/g, '=$1');

const post = rd(`${WS}/.tmp/t1/posts/hello-world/index.html`);
const about = rd(`${WS}/.tmp/t1/about/index.html`);
/* ★ 仿真屏幕搬到了 /home/(启动页占了站点根)—— 见 content/home/_index.md */
const home = rd(`${WS}/.tmp/t1/home/index.html`);
const sPost = strip(post);
const sHome = strip(home);
const tpl = rd(`${BH}/layouts/_partials/page-hud.html`);
const css = noC(rd(`${BH}/assets/css/hud-timer.css`));
const js = rd(`${BH}/assets/js/hud-timer.js`);
const jsCode = noC(js);

/* ============================================================
   ① 构建产物:DOM 在、样式脚本都发出去、首页没有
   ============================================================ */
ok('博客页有番茄钟 DOM 块', sPost.includes('<div class=hud-timer'));
ok('★ 默认就是收起态(class 里带 is-min)',
  /<div class=hud-timer is-min/.test(sPost),
  '★ 第二轮:收起态从"悬浮胶囊"改成"整块不显示" —— 番茄钟的入口是左下角那枚模块按钮,' +
  '收起后"还在跑"由按钮上的小进度圈表示(见 page-hud.test.mjs 那几条)');
for (const [name, needle] of [
  ['表盘按钮', 'id=hud-timer-ring'],
  ['进度弧', 'id=hud-timer-arc'],
  ['时间读数', 'id=hud-timer-time'],
  ['状态文字', 'id=hud-timer-state'],
  ['开始/暂停', 'id=hud-timer-toggle'],
  ['重置', 'id=hud-timer-reset'],
  ['收起按钮', 'id=hud-timer-min'],
  ['今日计数', 'id=hud-timer-meta'],
  ['两个模式', 'data-hud-timer-phase=break'],
  ['四个时长档', 'data-hud-timer-min=45']
]) {
  ok(`产物里有「${name}」`, sPost.includes(needle));
}
ok('★★★ 那枚悬浮胶囊【已经删掉】(用户:"原本的番茄钟按钮没删")',
  !sPost.includes('hud-timer-pill') && !tpl.includes('hud-timer__pill') &&
  !/pill/.test(css) && !/pill/i.test(js),
  '胶囊的 DOM / 样式 / 逻辑三处都要清干净,留一处就是"没删"');
ok('★ 每页只有一台番茄钟(不能出现两份 DOM)',
  (sPost.match(/\bid=hud-timer(?![-\w])/g) || []).length === 1,
  '第一版用 \\b 收尾 ⇒ 每个 id=hud-timer-xxx(表盘/胶囊/读数…)都被算成一台,数出 13:'
  + String((sPost.match(/\bid=hud-timer\b/g) || []).length));
ok('首页没有番茄钟 DOM(那块屏是 CD 架 + 平板,左栏没位置)',
  !sHome.includes('class=hud-timer') && !/id=hud-timer\b/.test(sHome));
ok('css/js 都挂上并带指纹',
  /hud-timer\.[0-9a-f]{20,}\.css/.test(post) && /hud-timer\.[0-9a-f]{20,}\.js/.test(post));
ok('★ 脚本只在博客页发(首页没有,省一次请求)',
  !/hud-timer\.[0-9a-f]{20,}\.js/.test(home));
ok('模板里只有一处番茄钟标记',
  (tpl.match(/class="hud-timer is-min"/g) || []).length === 1);

/* ============================================================
   ② 样式:两种形态、不吃事件、窄屏收掉
   ============================================================ */
ok('★ 收起/展开由 .is-min 一把切(不是两套 DOM):收起 = 整块 display:none',
  /\.hud-timer\.is-min\s*\{\s*display:\s*none/.test(css) &&
  /\.hud-timer\.is-min \.hud-timer__shell\s*\{[^}]*opacity:\s*0/.test(css),
  '★ 第二轮:卡片只在被投影进面板时露面(hud-left.js 搬进去时摘掉 is-min),' +
  '其余时间不显示 —— 所以 offsetHeight 是 0,搬进面板的顺序不能反');
ok('★ 收起时不留一片看不见的占位(高度不占地方)',
  /\.hud-timer\.is-min\s*\{\s*display:\s*none/.test(css));
ok('整层默认不吃事件、卡片自己开 auto(和 HUD 一个规矩)',
  /\.hud-timer\s*\{[^}]*pointer-events:\s*none/.test(css) &&
  /\.hud-timer__shell\s*\{[^}]*pointer-events:\s*auto/.test(css));
ok('★ 进度弧用变量驱动(--hud-timer-p 一个数一个真相)',
  /\.hud-timer__arc\s*\{[^}]*stroke-dashoffset:\s*calc\(339\.29 \* \(1 - var\(--hud-timer-p/.test(css));
ok('弧从 12 点方向起(rotate -90deg + transform-box)',
  /\.hud-timer__arc\s*\{[^}]*transform:\s*rotate\(-90deg\)/.test(css) &&
  /transform-box:\s*view-box/.test(css));
ok('★★★ 收起后"还在跑"看得见:进度写进 :root 的 --hud-tomato-p / -run(模块按钮上那个圈读它)',
  /setProperty\("--hud-tomato-p"/.test(js) && /setProperty\("--hud-tomato-run"/.test(js) &&
  /\.hud-mod__ring\s*\{[\s\S]*?conic-gradient[\s\S]*?var\(--hud-tomato-p/.test(
    fs.readFileSync(`${BH}/assets/css/hud-left.css`, 'utf8')),
  '跨脚本只传 CSS 变量,不去戳别人的 DOM');
ok('窄屏整块收掉(1180 以下会压正文)',
  /@media \(max-width:\s*1180px\)\s*\{\s*\.hud-timer\s*\{\s*display:\s*none/.test(css));
ok('矮屏把卡片压矮(不顶到顶带/底带)',
  /@media \(max-height:\s*760px\)/.test(css));
ok('减动效偏好被尊重',
  /@media \(prefers-reduced-motion:\s*reduce\)/.test(css) &&
  /\.hud-timer__shell,\s*\.hud-timer__arc\s*\{\s*transition:\s*none/.test(css));

/* ============================================================
   ③ 运行时:假 DOM + 假时钟
   ─────────────────────────────────────────────────────────────
   时钟必须【自己拿着】:模块是按 Date.now() 算剩余时间的,
   不接管它就等于每次断言都在跟真实世界的毫秒赛跑。
   ============================================================ */
function fakeDom(opts) {
  const o = opts || {};
  const mk = (tag) => {
    const el = {
      tagName: tag.toUpperCase(), attrs: {}, children: [], style: {},
      _ev: {}, _cls: new Set(), _q: {}, _qa: {}, hidden: false,
      textContent: '', title: '',
      style: {
        _v: {},
        setProperty(k, v) { this._v[k] = String(v); },
        getPropertyValue(k) { return k in this._v ? this._v[k] : ''; }
      },
      classList: {
        add: (c) => el._cls.add(c),
        remove: (c) => el._cls.delete(c),
        contains: (c) => el._cls.has(c),
        toggle: (c, on) => { const v = on === undefined ? !el._cls.has(c) : !!on; if (v) el._cls.add(c); else el._cls.delete(c); return v; }
      },
      getAttribute: (k) => (k in el.attrs ? el.attrs[k] : null),
      setAttribute: (k, v) => { el.attrs[k] = String(v); },
      addEventListener: (t, f) => { (el._ev[t] = el._ev[t] || []).push(f); },
      querySelector: (s) => el._q[s] || null,
      querySelectorAll: (s) => el._qa[s] || [],
      closest: (s) => {
        /* ★ 委托点击靠它:模块写的是 e.target.closest("[data-hud-timer-min],[data-hud-timer-phase]")。
           假 DOM 的 closest 必须真的能认出【属性选择器】,而且要认【逗号列表】——
           第一版只写了 ^\[([a-z-]+)\]$,遇到逗号直接返回 null ⇒ 所有点击都落空,
           报出来却是"点了 45 时长没变",看着像模块没实现。
           真实浏览器里这个列表是"任一命中即返回",这里照做。 */
        const parts = String(s).split(',').map((x) => x.trim());
        for (const p of parts) {
          const m = /^\[([a-zA-Z-]+)\]$/.exec(p);
          if (m && (m[1] in el.attrs)) return el;
        }
        return null;
      },
      click() { (el._ev.click || []).forEach((f) => f({ preventDefault() {}, target: el })); }
    };
    return el;
  };

  const ids = {};
  ['hud-timer-ring', 'hud-timer-arc', 'hud-timer-time', 'hud-timer-state',
    'hud-timer-toggle', 'hud-timer-reset', 'hud-timer-min', 'hud-timer-pill',
    'hud-timer-pill-time', 'hud-timer-meta', 'hud-timer-presets'].forEach((id) => { ids[id] = mk('div'); });

  const root = ids['hud-timer'] = mk('div');
  root._cls.add('is-min');
  root._q = {
    '.hud-timer__prog': null
  };
  /* 四个时长档 + 两个模式按钮(都是 root.querySelectorAll 找出来的) */
  const presets = [25, 45, 5, 15].map((v) => { const b = mk('button'); b.attrs['data-hud-timer-min'] = String(v); return b; });
  const modes = ['focus', 'break'].map((p) => { const b = mk('button'); b.attrs['data-hud-timer-phase'] = p; return b; });
  root._qa = {
    '[data-hud-timer-min]': presets,
    '[data-hud-timer-phase]': modes
  };

  /* documentElement 要带 style:第二轮起番茄钟会往 :root 写
     --hud-tomato-p / --hud-tomato-run(给左下角那枚模块按钮上的小进度圈用) */
  const rootStyle = {
    _v: {},
    setProperty(k, v) { this._v[k] = String(v); },
    getPropertyValue(k) { return this._v[k] || ''; }
  };
  const doc = {
    hidden: false,
    getElementById: (id) => (id === 'hud-timer' ? root : (ids[id] || null)),
    addEventListener() {},
    documentElement: { clientWidth: 1440, clientHeight: 900, style: rootStyle }
  };

  /* ---- 可控时钟 ----
     ★ start 可传:模拟"刷新"时必须让第二台接着第一台的时刻走 ——
       第一版的 env2 从默认的 1000000 重新开始,而第一台已经走到 1120000,
       于是"关了 5 分钟"实际只算成 3 分钟,断言差 120000ms
       (报出来是"跑过的那 2 分钟没接上",其实接上了,是时钟没接上)。 */
  let now = (opts && typeof opts.start === 'number') ? opts.start : 1000000;
  const timers = new Map();
  let seq = 0;

  /* ★★ 假 Date 要挂【两个地方】:globalThis(模块里的裸 Date.now())和 window
     (模块里 Date / AudioContext 都是防御式取法,可能写成 window.Date.now())。
     ★ 它必须是"真构造器 + now":模块 loadDone() 走 new Date().getMonth(),
       只给 { now } 会抛 TypeError —— 报出来却是"今日计数没存下来",指错方向。
     ★ 第一版只在 boot() 里装 globalThis.Date,漏了 window.Date ⇒ 模块每帧拿到的
       都是真实墙钟(1.7e12),而 startedAt 是假钟的 1e6,两者差二十天,
       elapsed 直接爆表 ⇒ 报"刷新回来只剩 20 分钟"这种离谱值。 */
  const makeFakeDate = (getNow) => {
    const Real = globalThis.__RealDate;
    const D = function (...args) {
      return args.length ? new Real(...args) : new Real(getNow());
    };
    D.now = () => getNow();
    D.UTC = Real.UTC;
    D.parse = Real.parse;
    D.prototype = Real.prototype;
    return D;
  };

  const win = {
    Date: makeFakeDate(() => now),
    AudioContext: function () {
      return {
        state: 'running', currentTime: 0, destination: {},
        resume() {},
        createOscillator: () => ({ type: '', frequency: {}, connect() {}, start() {}, stop() {} }),
        createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} })
      };
    },
    addEventListener() {}
  };

  const store = {};
  const env = {
    root, ids, presets, modes, doc, win, store,
    el: (id) => ids[id],
    now: () => now,
    advance(ms) { now += ms; },
    /* 跑一次 250ms 心跳 —— 模块内部就是 setInterval(step, 250) */
    beat(times) {
      for (let i = 0; i < (times || 1); i++) {
        const fns = [...timers.values()];
        fns.forEach((f) => f());
      }
    },
    timerCount: () => timers.size,
    click(el) { el.click(); },
    /* 委托点击:事件派发给 root,target 指向某个按钮(真浏览器里就是这样冒泡的) */
    clickOn(target) {
      (root._ev.click || []).forEach((f) => f({ preventDefault() {}, target }));
    },
    storage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  };
  env._install = () => {
    globalThis.window = win;
    globalThis.document = doc;
    globalThis.localStorage = env.storage;
    globalThis.setInterval = (fn) => { const id = ++seq; timers.set(id, fn); return id; };
    globalThis.clearInterval = (id) => { timers.delete(id); };
  };
  return env;
}

function boot(env) {
  env._install();
  /* ★ 只有 now() 走假时钟,new Date() 仍然是真的(模块靠它算"今天")。
     每次 boot 都重装:上一条用例的时钟不能留给下一条。 */
  globalThis.Date = env.win.Date;
  new Function(js)();
  return env.win.__hudTomato;
}

/* ---- ③a 初始状态 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  const st = api.state();
  ok('模块启动后暴露排障出口 __hudTomato', !!api);
  ok('★ 默认:专注 25 分钟、收起、没在跑',
    st.phase === 'focus' && st.mins === 25 && st.collapsed === true && st.running === false,
    JSON.stringify(st));
  ok('开始前环是空的(进度 0),读数写进 DOM',
    env.el('hud-timer-time').textContent === '25:00' &&
    env.el('hud-timer-arc').style.getPropertyValue('--hud-timer-p') === '0.0000',
    env.el('hud-timer-time').textContent + ' / ' + env.el('hud-timer-arc').style.getPropertyValue('--hud-timer-p'));
  ok('★ 展开态带 .is-min(默认收起,不是整块消失)',
    env.root.classList.contains('is-min') === (st.collapsed === true));
  ok('只显示当前模式的两档时长(专注 25/45,小憩 5/15 先藏起来)',
    env.presets[0].hidden === false && env.presets[1].hidden === false &&
    env.presets[2].hidden === true && env.presets[3].hidden === true,
    env.presets.map((b) => (b.hidden ? '—' : b.getAttribute('data-hud-timer-min'))).join(','));
}

/* ---- ③b 计时:按墙钟算,不是"每跳减一秒" ---- */
{
  const env = fakeDom();
  const api = boot(env);
  api.start();
  ok('开始后进入 running 并起了一个心跳', api.state().running === true && env.timerCount() === 1,
    'running=' + api.state().running + ' timers=' + env.timerCount());
  ok('★ 心跳跑 200 次、时钟一动没动 ⇒ 读数一丝不变(不是每秒减一)',
    (() => { env.beat(200); return env.el('hud-timer-time').textContent === '25:00' && api.state().remain === 1500000; })(),
    env.el('hud-timer-time').textContent + ' / remain=' + api.state().remain);

  env.advance(60000);          /* 真的过去 1 分钟 */
  env.beat(1);
  ok('★ 时钟走 60s ⇒ 剩 24:00,进度 1/25',
    env.el('hud-timer-time').textContent === '24:00' && api.state().remain === 1440000,
    env.el('hud-timer-time').textContent + ' remain=' + api.state().remain);
  ok('★ 环形进度 = 已过时间 / 总时长(0.04)',
    Math.abs(Number(env.el('hud-timer-arc').style.getPropertyValue('--hud-timer-p')) - 0.04) < 1e-6,
    env.el('hud-timer-arc').style.getPropertyValue('--hud-timer-p'));
  ok('★★ 同一份进度也写给了 :root 的 --hud-tomato-p(按钮上那个小圈读的就是它)',
    Math.abs(Number(env.doc.documentElement.style.getPropertyValue('--hud-tomato-p')) - 0.04) < 1e-6 &&
    env.doc.documentElement.style.getPropertyValue('--hud-tomato-run') === '1',
    env.doc.documentElement.style.getPropertyValue('--hud-tomato-p') + ' / run=' +
    env.doc.documentElement.style.getPropertyValue('--hud-tomato-run'));

  /* ★★ 最关键的一条:标签页被后台节流 10 分钟(心跳一次都没跑),
     切回来第一帧就必须是对的 —— 这正是"按墙钟算"换来的好处。 */
  env.advance(600000);
  env.beat(1);
  ok('★★ 心跳停了 10 分钟才跑一次,读数照样是对的(墙钟口径)',
    env.el('hud-timer-time').textContent === '14:00' && api.state().remain === 840000,
    env.el('hud-timer-time').textContent);
}

/* ---- ③c 暂停 / 继续 / 重置 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  api.start();
  env.advance(30000);
  api.pause();
  ok('暂停:running 关掉、心跳清掉、已过 30s 被【存下来】',
    api.state().running === false && env.timerCount() === 0 &&
    Math.abs(api.state().p - 0.02) < 1e-6,
    'p=' + api.state().p);
  env.advance(600000);          /* 暂停期间时钟照样走 */
  env.beat(5);
  ok('★ 暂停期间时钟走 10 分钟,剩余时间【不动】(不是"暂停了还在跑")',
    api.state().remain === 1470000, String(api.state().remain));
  api.start();
  env.advance(10000);
  env.beat(1);
  ok('继续:接在原来的 30s 后面 ⇒ 已过 40s',
    api.state().remain === 1460000, String(api.state().remain));
  api.reset();
  ok('重置:回到 25:00、进度 0、不在跑,心跳也清了',
    api.state().remain === 1500000 && api.state().p === 0 && api.state().running === false &&
    env.timerCount() === 0 && env.el('hud-timer-time').textContent === '25:00');
}

/* ---- ③d 跑完:计数 + 状态文案 + 只算专注 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  api.start();
  env.advance(1500000);
  env.beat(1);
  const st = api.state();
  ok('★ 时间到:自动停、置 ended、进度满格',
    st.running === false && st.ended === true && st.p === 1 && env.timerCount() === 0,
    JSON.stringify(st));
  ok('★ 专注跑完记一个番茄', st.done === 1, String(st.done));
  ok('文案说清是"已完成"(不是简单回到待机)',
    /已完成/.test(env.el('hud-timer-state').textContent),
    env.el('hud-timer-state').textContent);
  ok('今日计数写进 DOM 和 localStorage',
    /今日完成 1 个番茄/.test(env.el('hud-timer-meta').textContent) &&
    env.store['hud-tomato-done'] === '1',
    env.el('hud-timer-meta').textContent);
  ok('按钮从"暂停"变回"开始/继续"这类可点文案',
    env.el('hud-timer-toggle').textContent !== '暂停',
    env.el('hud-timer-toggle').textContent);

  /* 小憩跑完不计数(不然今日完成就注水了) */
  env.clickOn(env.modes[1]);
  ok('切到小憩:时长换成小憩自己的 5 分钟',
    api.state().phase === 'break' && api.state().mins === 5, JSON.stringify(api.state()));
  api.start();
  env.advance(300000);
  env.beat(1);
  ok('★ 小憩跑完【不】加番茄数', api.state().done === 1, String(api.state().done));
}

/* ---- ③e 模式 / 时长 / 收起:三个开关各有各的记忆 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  env.clickOn(env.presets[1]);                 /* 专注选 45 */
  ok('点 45 ⇒ 时长变 45,读数跟着变',
    api.state().mins === 45 && env.el('hud-timer-time').textContent === '45:00',
    env.el('hud-timer-time').textContent);
  ok('选中的那一档有 is-on,别的没有',
    env.presets[1].classList.contains('is-on') && !env.presets[0].classList.contains('is-on'));

  env.clickOn(env.modes[1]);                   /* 切小憩 */
  ok('★ 切到小憩不会被 45 带走(用回小憩自己的 5)',
    api.state().mins === 5 && api.state().phase === 'break', JSON.stringify(api.state()));
  ok('小憩档位亮起来、专注档位藏起来',
    env.presets[2].hidden === false && env.presets[3].hidden === false &&
    env.presets[0].hidden === true && env.presets[1].hidden === true);

  env.clickOn(env.presets[3]);                 /* 小憩选 15 */
  env.clickOn(env.modes[0]);                   /* 切回专注 */
  ok('★ 切回专注记着刚才的 45(不是打回 25)',
    api.state().mins === 45, String(api.state().mins));

  /* 收起 / 展开 */
  env.click(env.el('hud-timer-min'));
  ok('★ 点收起:加 .is-min、aria-expanded=false',
    env.root.classList.contains('is-min') &&
    env.el('hud-timer-min').getAttribute('aria-expanded') === 'false');
  ok('收起状态被记住(下次打开还是收起的)',
    env.store['hud-tomato-min'] === '1', String(env.store['hud-tomato-min']));
  /* ★ 第二轮:胶囊没了 —— 展开回到卡片这一侧仍然要有路子(hud-left.js 会摘 is-min),
     这里直接走 api.expand()(模块按钮调的就是它) */
  api.expand();
  ok('★ 展开(aaria-expanded=true、类名去掉)',
    !env.root.classList.contains('is-min') &&
    env.el('hud-timer-min').getAttribute('aria-expanded') === 'true');
  env.click(env.el('hud-timer-min'));
  ok('收起时计时【不受影响】(收起只是形态,不是停止)',
    (() => { api.start(); const a = api.state().running; env.click(env.el('hud-timer-min')); return a && api.state().running === true; })());
}

/* ---- ③f 跨刷新:状态和"跑着的那段时间"都要接上 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  env.click(env.el('hud-timer-min'));           /* 收起(默认态,再点一次仍是收起) */
  api.setMin(false);                            /* ★ 用 API 展开:这条用例要验的是"刷新后还记得",
                                                   而不是"点击能不能切换"(③e 已经验过) */
  ok('展开后 .is-min 被摘掉', !env.root.classList.contains('is-min'));
  api.start();
  env.advance(120000);                          /* 跑了 2 分钟 */
  env.beat(1);                                  /* ★ 浏览器里心跳每秒都在跑;
                                                   模块只在"状态切换"时才写 localStorage,
                                                   所以这块时间要靠心跳渲染出来 */
  const saved = env.store['hud-tomato'];

  /* 模拟"关掉页面再打开":同一份 localStorage、新的时钟与 DOM */
  /* 模拟"关掉页面再打开":同一份 localStorage、新 DOM,时钟接着上一台走 */
  const env2 = fakeDom({ start: env.now() });
  env2.store['hud-tomato'] = saved;
  env2.store['hud-tomato-min'] = env.store['hud-tomato-min'];
  env2.advance(300000);                         /* 关着页面的这 5 分钟,现实里也在流逝 */
  const api2 = boot(env2);
  const st2 = api2.state();
  ok('★ 刷新回来:跑的还在跑、没被打回待机',
    st2.running === true, JSON.stringify(st2));
  ok('★ 刷新回来:累计的 2 分钟 + 关着页面的 5 分钟都在(剩 18 分钟)',
    st2.remain === 1080000,
    '剩 ' + st2.remain + 'ms(期望 1080000);少了 120000 说明"跑过的这段时间没接上"');
  ok('★ 展开/收起的选择也活过了刷新(用户选过展开就还是展开)',
    st2.collapsed === false && !env2.root.classList.contains('is-min'));
  ok('刷新后立刻又起了心跳(不会"看着在跑其实不走")', env2.timerCount() === 1);
}

/* ---- ③g 关页面期间就跑完了:回来应该是"已完成",不能是负数 ---- */
{
  const env = fakeDom();
  const api = boot(env);
  api.start();
  env.advance(600000);
  env.beat(1);
  const saved = env.store['hud-tomato'];

  const env2 = fakeDom();
  env2.store['hud-tomato'] = saved;
  env2._install();
  env2.advance(3600000);                        /* 关了一小时 */
  const api2 = boot(env2);
  const st2 = api2.state();
  ok('★ 关页面期间跑完 ⇒ 回来是 ended,剩余不可能是负数',
    st2.ended === true && st2.remain === 0 && st2.running === false, JSON.stringify(st2));
  ok('读数停在 00:00 而不是负号',
    env2.el('hud-timer-time').textContent === '00:00', env2.el('hud-timer-time').textContent);
}

/* ---- ③h 没有 DOM 时静默退出(模板改了不能把别的脚本带崩) ---- */
{
  const env = fakeDom();
  env._install();
  globalThis.document = { getElementById: () => null, addEventListener() {}, documentElement: { clientWidth: 1440 } };
  let threw = null;
  try { new Function(js)(); } catch (e) { threw = e; }
  ok('★ 拿不到 #hud-timer 时静默退出(不抛错)',
    threw === null && !env.win.__hudTomato, threw && threw.message);
}

/* ============================================================
   ④ 表
   ============================================================ */
let pass = 0;
for (const [good, name, info] of rows) {
  if (good) pass++;
  console.log(`${good ? '  OK  ' : '  FAIL'} ${name}${info ? '   → ' + info : ''}`);
}
console.log(`\n${pass}/${rows.length} 通过`);
process.exit(pass === rows.length ? 0 : 1);
