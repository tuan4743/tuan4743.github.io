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
ok('技术页:投影节点在', cls('proj-node').test(tech));
ok('技术页:page-slide.js 在', /page-slide\.[0-9a-f]+\.js/.test(tech));
ok('技术页:没有重复的 .intro-bg(那是首页的)', !/intro-bg/.test(tech));
ok('★ 两个 partial 是【两处共用】的,不是各写一份',
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/index.html`)) &&
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)) &&
  /partial "projection-node\.html"/.test(rd(`${BH}/layouts/index.html`)) &&
  /partial "projection-node\.html"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));

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

/* ---------- ④ 右滑过场 ---------- */
ok('★ 三条一起滑:场景 / 平板 / 顶缘按钮',
  /body\.intro-page\.page-out \.scene\s*\{[^}]*translateX\(100vw\)/.test(shellCode) &&
  /body\.intro-page\.page-out \.tablet\s*\{[^}]*translateX\(100vw\)/.test(shellCode) &&
  /body\.intro-page\.page-out \.statusbar-toggle\s*\{[^}]*translateX\(calc\(-50% \+ 100vw\)\)/.test(shellCode),
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

/* ---------- ⑤ 投影节点 ---------- */
ok('★ 节点是 fixed 且不吃点击(它要穿过过场留在原地)',
  /\.proj-node\s*\{[^}]*position: fixed/.test(shellCode) &&
  /\.proj-node\s*\{[^}]*pointer-events: none/.test(shellCode));
ok('★ 节点在所有层最上面(43 > 平板 40 / 顶缘按钮 41)',
  /\.proj-node\s*\{[^}]*z-index: 43/.test(shellCode));
ok('★ 节点是 SVG 画的,风格跟 HUD(细线 + 青色 + 呼吸 + 朝右流动的光束)',
  /<svg viewBox="0 0 92 40"/.test(rd(`${BH}/layouts/_partials/projection-node.html`)) &&
  /@keyframes pn-flow/.test(shellCode) && /@keyframes pn-pulse/.test(shellCode));

/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, n, i] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + n + (i ? '   [' + i + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
