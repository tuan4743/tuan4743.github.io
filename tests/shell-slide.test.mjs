import fs from 'node:fs';

/* ============================================================
   外壳与右滑过场(用户第四/五轮的要求,第一批)
   ─────────────────────────────────────────────────────────────
   设计:首页是"仿真屏幕"(重在交互),博客页住在【这块屏幕的右侧】——
   不是同一页里的东西,而是另一张页面;点平板上的 APP 时整块机器【完全右滑】
   100vw 出去,滑完再跳过去。为了不穿帮,滑走时露出来的背景必须和落地页
   是【同一个样式】,于是看起来像"在同一个页面里右滑"。

   第一批交三样:宇宙背景 / 投影节点 / 右滑过场。
   这套断言钉的就是这三样,外加它们之间那几条"必须一致"的约定。
   ============================================================ */

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
/* ★ 扫源码之前先剥注释 —— 解释性注释里会原样写着这些东西(本轮第三次踩)。 */
const noC = (s) => String(s)
  .replace(/\{\{\/\*[\s\S]*?\*\/\}\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const home = rd(`${WS}/.tmp/t1/index.html`);          /* 构建产物:验真正发出去的那份 */
const tech = rd(`${WS}/.tmp/t1/tech/index.html`);
const shell = rd(`${BH}/assets/css/extended/shell.css`);
const shellCode = noC(shell);
const intro = noC(rd(`${BH}/assets/css/intro.css`));
const idx = noC(rd(`${BH}/layouts/index.html`));
const slideJs = rd(`${BH}/assets/js/page-slide.js`);
/* ★ 最小化产物里属性【没有引号】(class=intro-bg),带引号的写法一个都匹配不到。 */
const cls = (name) => new RegExp('class="?' + name + '(?![\\w-])');

/* ---------- ① 三样东西在首页都在 ---------- */
ok('首页:宇宙背景装进【不跟着滑】的那一层(.intro-bg)',
  /class="?intro-bg"?>\s*<div class="?cosmos/.test(home),
  '右滑露出来的就是它 —— 装在会滑的 .scene 里就白做了');
ok('首页:投影节点在', cls('proj-node').test(home));
ok('★ 首页:APP 带 data-slide(过场只认这个属性,不认类名)',
  /data-slide/.test(idx) && /data-slide/.test(home));
ok('首页:page-slide.js 发出来了', /page-slide\.[0-9a-f]+\.js/.test(home));
ok('首页:没有 shell-page 类(它的底是那块屏幕,不是整页星云)',
  /if not \.IsHome/.test(rd(`${BH}/layouts/partials/extend_head.html`)),
  'extend_head 里带了 if not .IsHome');

/* ---------- ② 其余页面拿到同一套 ---------- */
ok('技术页:挂了 shell-page', /classList\.add\("shell-page"\)/.test(tech));
ok('技术页:宇宙背景在', cls('cosmos').test(tech));
ok('技术页:page-slide.js 在', /page-slide\.[0-9a-f]+\.js/.test(tech));
ok('技术页:没有重复的 .intro-bg(那是首页的)', !/intro-bg/.test(tech));
ok('★★ 技术页【没有】投影 —— 它只属于平板主界面',
  !cls('proj-node').test(tech) && !/projection-node/.test(rd(`${BH}/layouts/partials/extend_footer.html`)),
  '用户:"固定在了首页的左上角,导致 CD 页和内容页都会出现"');
ok('★ 宇宙背景是两处共用的(首页 + 其余页面)',
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/index.html`)) &&
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('★ 投影只在一处渲染:平板里面',
  /partial "projection-node\.html"/.test(rd(`${BH}/layouts/index.html`)) &&
  (rd(`${BH}/layouts/index.html`).match(/partial "projection-node\.html"/g) || []).length === 1);

/* ---------- ③ 宇宙背景:CD 架和页面背景是同一份 ---------- */
ok('★ .cosmos-nebula 的星云声明只有一份(在 shell.css)',
  /\.cosmos-nebula\s*\{[\s\S]*?radial-gradient\(52% 42%/.test(shellCode) &&
  !/radial-gradient\(52% 42%/.test(intro),
  'intro.css 里那句已经搬走 —— 抄两份迟早会漂');
ok('★ .cosmos-grid 的网格声明同样只有一份',
  /\.cosmos-grid\s*\{[\s\S]*?repeating-linear-gradient\(0deg/.test(shellCode) &&
  !/repeating-linear-gradient\(0deg/.test(intro));
ok('★ 星云参数的默认值提到了 :root(两处共用)',
  /:root\s*\{[^}]*--neb-1:/.test(shellCode) && !/--neb-1:/.test(intro),
  'intro.css 的 .rack 里只剩一句"已搬走"的说明');
ok('★ CD 架的标记挂上了共用类', /class="rack-bg cosmos-nebula"/.test(idx) && /class="rack-grid cosmos-grid"/.test(idx));
ok('★ CD 架那两根推子照旧只作用在 .rack 上(内联变量,不吃到整页背景)',
  /--bg-power/.test(noC(rd(`${BH}/assets/js/intro.js`))) && /var\(--bg-power/.test(shellCode));
ok('★ 背景【不跟深浅主题走】(用户:切换深浅背景也不变)',
  !/:root\[data-theme="light"\][\s\S]{0,80}cosmos-nebula/.test(shellCode) &&
  !/\.cosmos-nebula[\s\S]{0,200}data-theme/.test(shellCode),
  'cosmos 那两条规则里没有任何 data-theme 分支');

/* ---------- ④ 向左滑过场 ----------
   ★ 方向要说清楚,免得下次又做反:世界坐标从左到右是
     【CD 选择页 | 首页 | 其他页】——其他页在首页【右边】,
     所以"去右边的页面"= 视口往右移 = 内容【向左】平移。 */
ok('★ 三条一起滑,而且是【向左】100vw(其他页在首页右边)',
  /body\.intro-page\.page-out \.scene\s*\{[^}]*translateX\(-100vw\)/.test(shellCode) &&
  /body\.intro-page\.page-out \.tablet\s*\{[^}]*translateX\(-100vw\)/.test(shellCode) &&
  /body\.intro-page\.page-out \.statusbar-toggle\s*\{[^}]*translateX\(calc\(-50% - 100vw\)\)/.test(shellCode),
  '平板和按钮不在 .scene 里(层级原因),必须单独带上,否则一眼穿帮');
/* ★ 时长要把前导点带上再 parseFloat:`.55s` 用 [\d.]+ 抓到的是 "55"(= 55 秒)。
   这个坑本轮又踩了一次(探针里),测试里记下来。 */
const durOf = (s, re) => { const m = re.exec(s); return m ? parseFloat(m[1]) : NaN; };
const dScene = durOf(intro, /\.scene\s*\{[^}]*transition:\s*transform\s*(\.?\d+(?:\.\d+)?)s/);
const dTab = durOf(shellCode, /body\.intro-page\.page-out \.tablet\s*\{[^}]*transition:\s*transform\s*(\.?\d+(?:\.\d+)?)s/);
const dTog = durOf(shellCode, /body\.intro-page\.page-out \.statusbar-toggle\s*\{[^}]*transform\s*(\.?\d+(?:\.\d+)?)s/);
ok('★ 三条的过渡时长必须是同一个数(读出来比,不数字符串出现几次)',
  dScene === dTab && dTab === dTog && dScene > 0,
  `.scene ${dScene}s · 平板 ${dTab}s · 按钮 ${dTog}s`);
ok('★ JS 的 SLIDE_MS 和 CSS 时长对得上', Math.round(dScene * 1000) === Number((/var SLIDE_MS = (\d+)/.exec(slideJs) || [])[1]),
  `${dScene * 1000}ms`);
ok('★ 过场时禁点 + 不让滚动条冒出来',
  /body\.page-out\s*\{[^}]*(pointer-events:\s*none|overflow:\s*hidden)/.test(shellCode));
ok('★ JS 只认 [data-slide],不拦修饰键 / 中键 / 新窗口打开',
  /closest\("\[data-slide\]"\)/.test(slideJs) && /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/.test(slideJs) &&
  /e\.button !== 0/.test(slideJs) && /a\.target !== "_self"/.test(slideJs),
  '拦了它们会让"中键开新标签"这种正常操作失效');
ok('★ 先滑完再跳(transitionend + 兜底定时器两道路)',
  /transitionend/.test(slideJs) && /setTimeout\(go, FALLBACK_MS\)/.test(slideJs));
ok('★ "减少动态效果"下直接跳,不播动画',
  /prefers-reduced-motion/.test(slideJs) && /prefers-reduced-motion/.test(shellCode));
ok('留了现场读数 __pageSlide()(这个环境没浏览器)', /window\.__pageSlide = function/.test(slideJs));

/* ---------- ⑤ 投影:平板左上角那面等腰直角三角形 ---------- */
const nodeHtml = rd(`${BH}/layouts/_partials/projection-node.html`);
/* ★ 形状是【算出来】的:从 pn-fill 的 path 里把三条边读出来,
   断言两条直角边相等(等腰直角三角形),而不是看字符串像不像。 */
const tri = /<path class="pn-fill" d="M0 0 H(\d+) L0 (\d+) Z"/.exec(nodeHtml);
const legX = tri ? Number(tri[1]) : NaN, legY = tri ? Number(tri[2]) : NaN;
ok('★★ 是【等腰直角三角形】(两条直角边一样长,直角在左上角)',
  Number.isFinite(legX) && legX === legY && legX > 0,
  `直角边 ${legX} × ${legY}`);
ok('★ 比上一版小(clamp 的上限 ≤ 140px,上一版是 210px)',
  (() => { const m = /\.tablet \.proj-node\s*\{[^}]*width:\s*clamp\((\d+)px,\s*[\d.]+vw,\s*(\d+)px\)/.exec(shellCode);
    return m && Number(m[2]) <= 140 && Number(m[1]) >= 60; })(),
  ((/\.tablet \.proj-node\s*\{[^}]*width:\s*(clamp\([^)]*\))/.exec(shellCode) || [])[1] || '?'));
ok('★★ 它住在【平板里面】(不再是钉在视口上的一层)',
  /\.tablet \.proj-node\s*\{[^}]*position: absolute/.test(shellCode) &&
  !/^\.proj-node\s*\{[^}]*position: fixed/m.test(shellCode) &&
  /class="tablet"[^>]*>[\s\S]{0,200}projection-node/.test(idx),
  '只随平板出现/消失、过场时随平板滑走');
ok('★ 贴住左上角、且不吃点击', /\.tablet \.proj-node\s*\{[^}]*left: 0/.test(shellCode) &&
  /\.tablet \.proj-node\s*\{[^}]*top: 0/.test(shellCode) &&
  /\.tablet \.proj-node\s*\{[^}]*pointer-events: none/.test(shellCode));
ok('★ 加了小装饰:斜边虚线 + 斜边刻度 + 两条直角边的标尺',
  /\.pn-dash\s*\{/.test(shellCode) && /\.pn-tick\s*\{/.test(shellCode) && /\.pn-ruler\s*\{/.test(shellCode) &&
  /class="pn-dash"/.test(nodeHtml) && /class="pn-tick"/.test(nodeHtml) && /class="pn-ruler"/.test(nodeHtml));
ok('★ 风格仍然是 HUD(扫描线漂移 + 角上节点呼吸)',
  /@keyframes pn-sweep/.test(shellCode) && /@keyframes pn-pulse/.test(shellCode) &&
  /\.pn-scan path\s*\{/.test(shellCode));

/* ---------- ⑥ 背景必须是"钉在视口的最底层" ----------
   用户报过一次:"你直接把它固定在了滑动界面内,不仅挡住了主页面,
   滚轮一滚还跟着走"。根因:这份标记是在 <footer> 里渲染的(主题的 footer.html
   调 extend_footer),而 cosmos.html 那层是 position:absolute ——
   包含块变成文档初始包含块,于是变成钉在文档顶部的一张图,既压住正文又跟着滚。
   ⇒ 必须套一层 .page-cosmos(fixed + inset:0 + z-index:-1)。 */
const extFooter = rd(`${BH}/layouts/partials/extend_footer.html`);
ok('★★ 其余页面的背景套了 .page-cosmos 容器',
  /<div class="page-cosmos">\{\{ partial "cosmos\.html"/.test(extFooter) &&
  /class="?page-cosmos/.test(tech),
  '不套的话就是"压在正文上、还跟着滚轮走"那张图');
ok('★★ .page-cosmos 钉在视口 + 画在所有内容后面(z-index 负数)',
  /\.page-cosmos\s*\{[^}]*position: fixed/.test(shellCode) &&
  /\.page-cosmos\s*\{[^}]*inset: 0/.test(shellCode) &&
  /\.page-cosmos\s*\{[^}]*z-index: -1/.test(shellCode),
  '定位元素写 z-index:0 也会画在静态正文之上 —— 必须负数');
ok('★ 页面底色给了 html(body 透明),否则 body 的背景会盖住负 z-index 那层',
  /:root\[data-theme\]\.shell-page\s*\{[^}]*background: var\(--bg-base/.test(shellCode) &&
  /:root\[data-theme\]\.shell-page body\s*\{[^}]*background: transparent/.test(shellCode));

/* ---------- ⑦ 内容的背景【按主题正常变化】(用户澄清过)----------
   用户原话:"底层背景是不随深暗变化,但是原本内容的背景,就是你现在这种文本框的形式,
   这个框是正常变化的"。第一版把 --primary/--content/--entry 整套都按成深底浅字,
   等于把主题按死了 —— 错。现在只动"页面底色",卡片走主题自己的变量。 */
const shellPageRules = (shellCode.match(/:root\[data-theme\]\.shell-page[^{]*\{[^}]*\}/g) || []).join('\n');
ok('★★ 不再覆盖主题调色板(--primary / --content / --entry / --border 一律别碰)',
  !/--primary:/.test(shellPageRules) && !/--content:/.test(shellPageRules) &&
  !/--entry:/.test(shellPageRules) && !/--border:/.test(shellPageRules) &&
  !/--theme:/.test(shellPageRules),
  '把主题按死的话,浅色主题下也是深底浅字 —— 那不是用户要的');
ok('★★ 正文面板跟着主题走(用主题自己的 --theme 调出来)',
  /:root\[data-theme\]\.shell-page \.main\s*\{[^}]*color-mix\(in srgb, var\(--theme\)/.test(shellCode) &&
  /:root\[data-theme\]\.shell-page \.main\s*\{[^}]*var\(--border\)/.test(shellCode),
  '浅色主题=浅卡,深色主题=深卡');

/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, n, i] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + n + (i ? '   [' + i + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
