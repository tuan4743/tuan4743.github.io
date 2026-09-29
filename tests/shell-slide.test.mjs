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
ok('★★ 技术页【一直有】投影 —— 用户:"博客页是一直出现"',
  cls('proj-node').test(tech) && /partial "projection-node\.html"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('★ 宇宙背景是两处共用的(首页 + 其余页面)',
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/index.html`)) &&
  /partial "cosmos\.html"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));
ok('★ 投影两处各渲染一次(首页一份、博客页一份),用的是同一个 partial',
  (rd(`${BH}/layouts/index.html`).match(/partial "projection-node\.html"/g) || []).length === 1 &&
  (rd(`${BH}/layouts/partials/extend_footer.html`).match(/partial "projection-node\.html"/g) || []).length === 1);

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
  (() => { const m = /(?:^|[^.\w-])\.proj-node\s*\{[^}]*width:\s*clamp\((\d+)px,\s*[\d.]+vw,\s*(\d+)px\)/.exec(shellCode);
    return m && Number(m[2]) <= 140 && Number(m[1]) >= 60; })(),
  ((/(?:^|[^.\w-])\.proj-node\s*\{[^}]*width:\s*(clamp\([^)]*\))/.exec(shellCode) || [])[1] || '?'));
ok('★★ 首页那一份是【机器的一部分】:在 .scene 里,跟着机器平移',
  (() => {
    const i = idx.indexOf('partial "projection-node.html"');
    const scene = idx.indexOf('<div class="scene"');
    const rack = idx.indexOf('<div class="rack"');
    return i > scene && i < rack;
  })(),
  '用户:"我要的是贴着屏幕,跟着屏幕移动"');
ok('★★ 它贴在屏幕右缘【外侧】(left: 100vw)⇒ 静止时在视口外,平时看不见',
  /\.intro-page \.proj-node\s*\{[^}]*position: absolute/.test(shellCode) &&
  /\.intro-page \.proj-node\s*\{[^}]*left: 100vw/.test(shellCode) &&
  /\.intro-page \.proj-node\s*\{[^}]*top: 0/.test(shellCode));
/* ★ 这条是这一版的关键几何:机器的位移(-100vw)和投影的起始位置(+100vw)必须
   正好抵消,它才会停在视口左上角、和博客页那一份(0,0)对齐。
   所以从两处各自把数读出来比,而不是"看着像"。 */
{
  const shift = /body\.intro-page\.page-out \.scene\s*\{[^}]*translateX\((-?[\d.]+)vw\)/.exec(shellCode);
  const start = /\.intro-page \.proj-node\s*\{[^}]*left:\s*([\d.]+)vw/.exec(shellCode);
  /* ★ 博客页那条写的是 `left: 0`(没有单位,0 不用单位)——
     正则要容忍"裸 0",否则读出来是 NaN(这一版就踩了)。 */
  const land = /:root\[data-theme\]\.shell-page \.proj-node\s*\{[^}]*left:\s*(0|[\d.]+vw)/.exec(shellCode);
  const s = shift ? Number(shift[1]) : NaN, a = start ? Number(start[1]) : NaN;
  const b = land ? Number(String(land[1]).replace('vw', '')) : NaN;
  ok('★★ 平移量 + 起始位置 = 落地位置(它正好停在左上角,和博客页对齐)',
    Number.isFinite(s) && Number.isFinite(a) && Number.isFinite(b) && a + s === b,
    `${a}vw ${s >= 0 ? '+' : '-'} ${Math.abs(s)}vw = ${a + s}vw,博客页在 ${b}vw`);
}
ok('★★ 它自己【没有任何动画】(用户:"动画没播放完这东西直接就跑到屏幕上")',
  !/\.proj-node[^{]*\{[^}]*animation:/.test(shellCode) &&
  !/\.intro-page[^{]*\.proj-node[^{]*\{[^}]*opacity: 0/.test(shellCode) &&
  !/\.intro-page\.page-out \.proj-node/.test(shellCode),
  '节奏完全由机器那 0.55s 的平移决定,不给自己排时间线');
ok('★ 它不吃点击、也不盖住机器上的东西(z-index 与屏幕贴图同层)',
  /\.proj-node\s*\{[^}]*pointer-events: none/.test(shellCode) &&
  /\.intro-page \.proj-node\s*\{[^}]*z-index: 34/.test(shellCode));
ok('★ 博客页那一份在左上角、压在内容下面(z-index -1),否则会盖住 logo',
  /:root\[data-theme\]\.shell-page \.proj-node\s*\{[^}]*position: fixed/.test(shellCode) &&
  /:root\[data-theme\]\.shell-page \.proj-node\s*\{[^}]*z-index: -1/.test(shellCode));
ok('★ 博客页顶栏跟着做成半透明磨砂 —— 不然它会把投影的上面一截切掉,同时保住可读性',
  /:root\[data-theme\]\.shell-page \.header\s*\{[^}]*color-mix\(in srgb, var\(--theme\) 72%/.test(shellCode));
ok('★ 加了小装饰:斜边虚线 + 斜边刻度 + 两条直角边的标尺',
  /\.pn-dash\s*\{/.test(shellCode) && /\.pn-tick\s*\{/.test(shellCode) && /\.pn-ruler\s*\{/.test(shellCode) &&
  /class="pn-dash"/.test(nodeHtml) && /class="pn-tick"/.test(nodeHtml) && /class="pn-ruler"/.test(nodeHtml));
ok('★ 风格仍然是 HUD(扫描线漂移 + 角上节点呼吸)',
  /@keyframes pn-sweep/.test(shellCode) && /@keyframes pn-pulse/.test(shellCode) &&
  /\.pn-scan path\s*\{/.test(shellCode));

/* ---------- ⑤b ECHO:那个三角形的副摄像头 + 它右边的对话框(用户第七轮)----------
   用户:"看到左上角那个SVG画出的三角了吗?……那个就是 ECHO 的副摄像头
        (主摄像头就是平板本体)。……那个三角里面的光点做出摄像头探头,放大,
        往右下角移一点。会跟着鼠标移动。"
   用户:"我想的是在它的右侧加一个小小的对话框就足够了,正好缺点东西。
        在进行某些交互时有反应。(触发别太密集,搞得跟一个描述框一样)" */
const echoJs = rd(`${BH}/assets/js/hud-echo.js`);
ok('★★★ 角上那个光点已经换成镜头(旧的 pn-core / pn-ring 一个不剩)',
  /class="pn-eye" id="pn-eye"/.test(nodeHtml) && /id="pn-pupil"/.test(nodeHtml) &&
  /class="pn-eye__case"/.test(nodeHtml) && /class="pn-eye__iris"/.test(nodeHtml) &&
  !/pn-core|pn-ring/.test(nodeHtml),
  '外圈 / 虹膜 / 瞳孔 / 高光');
ok('★★★ 镜头往右下挪了、也放大了(原来在 20,20 半径 7)',
  (() => {
    const m = /class="pn-eye__case"\s+cx="(\d+)"\s+cy="(\d+)"\s+r="([\d.]+)"/.exec(nodeHtml);
    if (!m) return false;
    return +m[1] === +m[2] && +m[1] > 40 && +m[3] >= 12;
  })(),
  ((/class="pn-eye__case"[^>]*/.exec(nodeHtml) || [])[0] || '?').trim());
ok('★★★ 眼睛跟鼠标,而且中心是【按节点方框的比例反推】的 —— 不能读镜头自己的 rect(会自己追自己)',
  /node\.getBoundingClientRect\(\)/.test(echoJs) &&
  !/eye\.getBoundingClientRect\(\)/.test(echoJs) &&
  /pointermove/.test(echoJs) && /prefers-reduced-motion/.test(echoJs),
  '系统开了"减少动态效果"就整个不追');
ok('★★ 对话框挂在三角形右侧,而且和 .proj-node 共用同一个宽度算式(改一处就得改两处)',
  (() => {
    const a = /(?:^|[^.\w-])\.proj-node\s*\{[^}]*width:\s*(clamp\([^)]*\))/.exec(shellCode);
    const b = /\.echo-say\s*\{[^}]*left:\s*calc\((clamp\([^)]*\))/.exec(shellCode);
    return !!a && !!b && a[1].replace(/\s/g, '') === b[1].replace(/\s/g, '');
  })());
ok('★★★ 触发很稀:每个触发一个会话只响一次 + 全局冷却(不变成碎嘴的描述框)',
  /sessionStorage/.test(echoJs) && /COOL\s*=\s*\d{4,}/.test(echoJs) &&
  /echo-said/.test(echoJs) && /echo-last/.test(echoJs));
ok('★ 台词写在 JS 里、不在模板里;ECHO 的语气是老朋友那一路',
  /arrive:/.test(echoJs) && /archive:/.test(echoJs) && /LINES/.test(echoJs) &&
  /回来了|醒了|又是你/.test(echoJs) && !/echo-say__text[^>]*>.*[\u4e00-\u9fa5]/.test(nodeHtml));
ok('★ 首页那份不显示对话框(它跟着平板在视口外,不需要说话)',
  /^\.echo-say\s*\{\s*display:\s*none/m.test(shellCode) &&
  /:root\[data-theme\]\.shell-page \.echo-say\s*\{[^}]*display:\s*flex/.test(shellCode));
ok('★ 脚本挂上了(排在最后:它只【看】别人,不要求别人先就位)',
  /resources\.Get "js\/hud-echo\.js"/.test(rd(`${BH}/layouts/partials/extend_footer.html`)));

/* ---------- ⑤c ECHO 的四个特殊互动(用户第八轮)----------
   用户:"可以写一些特殊互动,比如番茄钟一轮结束/没结束就暂停,笔形态时鼠标移到
        ECHO 上,读世界观档案里的某篇具体文章时一直点摄像头它会不情愿的给一点点提示。" */
ok('★★★ 摄像头有个【热区】—— .proj-node 自己是 pointer-events:none + z-index:-1,收不到鼠标',
  /id="echo-hot"/.test(nodeHtml) &&
  /:root\[data-theme\]\.shell-page \.echo-hot\s*\{[^}]*position:\s*fixed/.test(shellCode) &&
  /:root\[data-theme\]\.shell-page \.echo-hot\s*\{[^}]*display:\s*block/.test(shellCode),
  '★ display:block 不能漏 —— 基础规则是 display:none,漏了就是个 0×0 的隐形元素(实测踩过)');
ok('★★ 热区位置 = 节点宽的 1/3(镜头中心 56/168),和 .proj-node 的 width 同一组数',
  (() => {
    const w = /(?:^|[^.\w-])\.proj-node\s*\{[^}]*width:\s*(clamp\([^)]*\))/.exec(shellCode);
    const h = /\.echo-hot\s*\{[^}]*left:\s*calc\((clamp\([^)]*\))\s*\/\s*3/.exec(shellCode);
    return !!w && !!h && w[1].replace(/\s/g, '') === h[1].replace(/\s/g, '');
  })());
ok('★★★ 番茄钟靠【盯 :root 的两个变量】,不去改 hud-timer.js',
  /--hud-tomato-run/.test(echoJs) && /--hud-tomato-p/.test(echoJs) &&
  /MutationObserver/.test(echoJs) && /attributeFilter:\s*\["style"\]/.test(echoJs));
ok('★★ 跑完 / 没跑完是两句话;归零(重置)不吭声 —— 那是重来,不是放弃',
  /p >= 0\.999/.test(echoJs) && /p > 0\.0005/.test(echoJs) &&
  /done:/.test(echoJs) && /giveUp:/.test(echoJs),
  '阈值 0.0005:重置写 0.0000,跑一秒也有 0.0007');
ok('★★★ 笔激活时鼠标扫过镜头有反应,而且带 force(刚拿笔就扫过来正是最自然的时机)',
  /pointerenter/.test(echoJs) && /\[data-hud-pen\]\.is-on/.test(echoJs) &&
  /hoverPen:\s*\{\s*cool:\s*\d+,\s*force:\s*true\s*\}/.test(echoJs));
ok('★★★ 计数【按页面】存(换一篇重新数)+ 700ms 节流,不受全局冷却管',
  /echo-poke:" \+ location\.pathname/.test(echoJs) &&
  /if \(now - pokeAt < 700\) return;/.test(echoJs),
  '不受全局冷却管 —— 不然连点四下要等一分多钟,那就不叫"一直戳"了');
ok('★★★ 提示的来源链:world/提示.md → archive.hint → data-echo-hint',
  /提示\.md/.test(rd(`${BH}/scripts/sync-world.mjs`)) &&
  /hints\[no\]/.test(rd(`${BH}/scripts/sync-world.mjs`)) &&
  /data-echo-hint="\{\{ \$echoHint \}\}"/.test(rd(`${BH}/layouts/_partials/page-hud.html`)));
ok('★★ 提示【不能】放在被 partialCached 缓存过的 footer 链里(会串页)',
  !/echoHint|archive\.hint/.test(rd(`${BH}/layouts/partials/extend_footer.html`)),
  '主题按 Layout + Kind 缓存整个 footer —— 按页面变的东西进去就被第一页写死');
ok('★ 提示一共 48 条,一篇一条',
  (rd(`${BH}/world/提示.md`).match(/^\s*\|\s*\d{2}\s*\|/gm) || []).length === 48);

/* ---------- ⑤d 戳摄像头是一条【阶梯】:语库随机 → 提示 → 威胁 → 真的关掉 ----------
   用户第八轮:"话的种类有点少,来回点就三句,我觉得前两句可以在一个语库中随机抽……
   '……再点我就把你的带宽共识协议关掉',接着点就会真的黑屏然后重进网站。" */
const pool = (name) => {
  const m = new RegExp("var " + name + " = \\[([\\s\\S]*?)\\];").exec(echoJs);
  return m ? (m[1].match(/"[^"]*"/g) || []).length : 0;
};
ok('★★★ 三个语库都够大(A ≥ 6 / B ≥ 5 / C ≥ 4)',
  pool("POKE_A") >= 6 && pool("POKE_B") >= 5 && pool("POKE_C") >= 4,
  "A=" + pool("POKE_A") + " B=" + pool("POKE_B") + " C=" + pool("POKE_C"));
ok('★★ 统计那句里的数字是【五到六位随机数】', (() => {
  const m = /我统计了一下[\s\S]{0,40}?\{n\}/.exec(echoJs);
  return !!m && /10000 \+ Math\.floor\(Math\.random\(\) \* 989999\)/.test(echoJs);
})());
ok('★★★ 阶梯的每一档都接对了(1~2 语库 / 3 提示 / 4~5 语库 / 6 威胁 / 7 通牒 / 8 关掉)',
  /n <= 2/.test(echoJs) && /n === 3/.test(echoJs) && /n <= 5/.test(echoJs) &&
  /n === 6/.test(echoJs) && /n === 7/.test(echoJs) &&
  /POKE_THREAT/.test(echoJs) && /POKE_END = 8/.test(echoJs) && /blackout\(\)/.test(echoJs));
ok('★★★ 威胁之后【真的关】:黑幕 + reload,而且黑幕要盖住滚动条',
  /带宽共识协议关掉/.test(echoJs) && /location\.reload\(\)/.test(echoJs) &&
  /style\.overflow = "hidden"/.test(echoJs) &&
  /id="echo-black"/.test(nodeHtml) &&
  /\.echo-black\s*\{[^}]*position:\s*fixed/.test(shellCode) &&
  /\.echo-black\s*\{[^}]*inset:\s*0/.test(shellCode) &&
  /\.echo-black\[hidden\]\s*\{\s*display:\s*none/.test(shellCode),
  '黑幕用 [hidden] 关着 —— 那条特异性比 .echo-black 高,不会被 display:flex 顶掉');
ok('★★ 关完要给个交代:回来接一句、计数归零(不然回来它装没事人)',
  /echo-blackout/.test(echoJs) && /那玩意儿重启要三十秒/.test(echoJs) &&
  /set\("echo-poke:" \+ location\.pathname, "0"\)/.test(echoJs));

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
