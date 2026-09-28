import fs from 'node:fs';

/* ============================================================
   平板主界面的验收(用户要求:按下顶缘箭头 → 整块屏幕变成平板主屏)
   ─────────────────────────────────────────────────────────────
   这套断言和 frost-panel 一样跑【假 DOM / 纯文本解析】,理由相同:这个环境没有浏览器。
   ★ 它验不了的:转场顺不顺、图标排得好不好看 —— 那只能靠用户的眼睛;
     这里钉的是结构与约束,尤其是"内容有没有落在玻璃窗口里"这种几何约束
     (用户第二轮报的六条里,有四条都出在这件事上)。
   ★★ 教训(写在这里免得下次又犯):第一版有一条断言叫
      "平板层和黑屏层【用同一套定位变量】",它把 inset: var(--sp-t) … 当成对的钉住了。
      实际上那组变量只定义在 .screen 上,站在 body 的平板根本取不到 ——
      断言钉的是一个本来就不成立的东西,所以它是绿的,而页面是错的。
      ⇒ 断言要钉【可推导的事实】(数值/父子关系/渲染结果),不要钉"我当时那么写的"。
   ============================================================ */

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (name, pass, info) => rows.push([!!pass, name, info === undefined ? '' : String(info)]);

/* ---------- 素材 ---------- */
const tpl = fs.readFileSync(`${BH}/layouts/index.html`, 'utf8');
const built = fs.readFileSync(`${WS}/.tmp/t1/index.html`, 'utf8');   /* 构建产物:验"真正发出去的那份" */
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const tcss = strip(fs.readFileSync(`${BH}/assets/css/tablet.css`, 'utf8'));
const icss = strip(fs.readFileSync(`${BH}/assets/css/intro.css`, 'utf8'));
const tjs = fs.readFileSync(`${BH}/assets/js/tablet.js`, 'utf8');
const sjs = fs.readFileSync(`${BH}/assets/js/search.js`, 'utf8');
const hjs = fs.readFileSync(`${BH}/assets/js/header-search.js`, 'utf8');
const hdr = fs.readFileSync(`${BH}/layouts/_partials/header.html`, 'utf8');
const mjs = strip(fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, 'utf8'));

/* 取同名规则的全部声明拼起来(浏览器算层叠时的输入就是这个)
   ★ 不能用 indexOf 只取第一条:.tablet 有基础/is-on/窄屏好几条 */
const allBlocks = (css, sel) => {
  const out = [];
  let i = -1;
  while ((i = css.indexOf(sel, i + 1)) >= 0) out.push(css.slice(i, css.indexOf('}', i)));
  return out.join('\n');
};
/* 只取"选择器块"里的某条声明 */
const decl = (block, prop) => {
  const m = new RegExp('(?:^|[;{\\s])' + prop + '\\s*:\\s*([^;}]+)').exec(block);
  return m ? m[1].trim() : '';
};
/* 用标签配对找出某个元素在【渲染产物】里的真实范围 —— 最小化 HTML 没有换行,靠深度数 */
function elemRange(src, startPat) {
  const s = src.search(startPat);
  if (s < 0) return null;
  const re = /<(\/?)(div|section|button|a|main|nav|span|svg)\b[^>]*?(\/?)>/g;
  re.lastIndex = s;
  let depth = 0, m, started = false;
  while ((m = re.exec(src))) {
    if (!started) { started = true; depth = 1; continue; }
    if (m[3] === '/') continue;
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return [s, m.index + m[0].length];
  }
  return null;
}

/* ---------- ① 标记 ---------- */
ok('平板主界面的标记在首页模板里',
  /data-tablet-home/.test(tpl) && /id="tablet"/.test(tpl));
ok('★ 导航变成 APP:菜单项 + 每项一个图标(取自菜单项的 .Pre,和顶栏同一份)',
  /\$m\.Pre/.test(tpl) && /range\s+\$i,\s*\$m\s*:=\s*\$items/.test(tpl) && /safeHTML/.test(tpl),
  '用了 site.Menus.main(range $i, $m := $items)与 $m.Pre');
ok('★ 搜索是【独立一张卡片】,不是塞在顶栏里',
  /class="tablet__card tablet__search"\s+data-search/.test(tpl) && /data-search-input/.test(tpl),
  '搜索卡片 = .tablet__card + .tablet__search + data-search 契约');
ok('★ 时钟卡片在(用户点名要的"时钟的卡片")',
  /data-tablet-time/.test(tpl) && /data-tablet-clock/.test(tpl));
ok('有日期与电量(让它像一块真平板)',
  /data-tablet-date/.test(tpl) && /data-tablet-battery/.test(tpl));
ok('★ 没有"播放器"这个 APP(用户:播放器按钮本来就在左缘、融进边框了)',
  !/data-tablet-player/.test(tpl) && !/data-tablet-player/.test(built) &&
  !/tablet__app-name"?>播放器/.test(built) && !/tablet__app-name">\s*播放器/.test(tpl.replace(/\/\*[\s\S]*?\*\//g, '')),
  '模板与渲染产物里都没有该按钮(注释里提到"播放器"三个字不算)');
ok('★ 卡片不止一张:最近更新 / 标签填的是真实内容(用户:"目前看有点空")',
  /tablet__recent/.test(tpl) && /tablet__tag/.test(tpl) &&
  /site\.Taxonomies\.tags/.test(tpl) && /site\.RegularPages/.test(tpl),
  '最近更新来自 site.RegularPages,标签来自 site.Taxonomies.tags');
ok('★ 渲染产物里确实生成了列表项(不是空卡片)',
  (built.match(/class=tablet__recent-item/g) || []).length >= 2 &&
  (built.match(/class=tablet__tag\b/g) || []).length >= 2,
  `最近更新 ${(built.match(/class=tablet__recent-item/g) || []).length} 条 · 标签 ${(built.match(/class=tablet__tag\b/g) || []).length} 个`);

/* ---------- ② 层级:根层叠上下文 ----------
   ★ 这是第二轮用户报的第 5 条("图层比下拉按钮要高,实际应该是下拉按钮最高")。
     根因不是数字大小,是【层叠上下文】:.scene 是 position:fixed,
     而 fixed 元素自己就创建层叠上下文 —— 里面的 z-index:41 对外一律算 0 级,
     于是被 .scene 外面 z-index:40 的平板整块盖住。
     所以这里验的是【结构】:开关必须在 .scene 之外。 */
const zTab = Number((/z-index:\s*(\d+)/.exec(allBlocks(tcss, '.tablet {')) || [])[1]);
ok('★ 平板层在【所有盘的上面】(用户:"会挡住或被当前 CD 的页面遮挡")',
  zTab >= 40, 'z-index = ' + zTab + '(霜那一页最高到 8,窗框 34,顶栏 20)');
const toggleZ = Number((/z-index:\s*(\d+)/.exec(allBlocks(icss, '.statusbar-toggle {')) || [])[1]);
ok('★ 但仍在【顶缘那枚开关】下面(它必须随时能把平板收回去)',
  zTab < toggleZ, '平板 ' + zTab + ' < 开关 ' + toggleZ);
const scene = elemRange(built, /<div class=scene\b/);
const iToggle = built.search(/class=statusbar-toggle/);
ok('★★ 开关在【.scene 外面】—— 否则 fixed 的 .scene 会把它的 z-index 封死,永远压不过平板',
  !!scene && iToggle > 0 && (iToggle < scene[0] || iToggle > scene[1]),
  scene ? `开关 @${iToggle},.scene = [${scene[0]}, ${scene[1]}]` : '.scene 没找到');
ok('★ 开关的 top 用 --ff-win-top(它已经不在 .screen 里,--sp-* 取不到了)',
  /top:\s*calc\(var\(--ff-win-top/.test(allBlocks(icss, '.statusbar-toggle {')),
  'top: calc(var(--ff-win-top, 13vh) - 10px)');
ok('★ CD 架拉出来时开关收起来(它在 .scene 外不会跟着场景左移)',
  /body\.scene-open\s+\.statusbar-toggle\s*\{[^}]*pointer-events:\s*none/.test(icss),
  'body.scene-open 下 opacity:0 + pointer-events:none');

/* ---------- ③ 定位/尺寸:内容必须落在玻璃窗口里 ----------
   ★★ 第二轮用户的第一、二、六条全是这件事:
      "大小不对,不能贴到屏幕的框" / "搜索栏太大,顶出去了" / "有些卡片貌似没生效"。
      根因:平板用 inset:0 + clip-path 裁形状时,【内边距是从视口边缘算起的】,
      而玻璃是往里缩了一块(下面 G 那四个数),于是内容被裁掉上面一条、左边一条:
      日期/电量整行没了、时钟只剩半截、搜索卡片左半截在玻璃外。
   ⇒ 这里把 CSS 里的 clamp()/var()/calc() 真的解成 px,和玻璃四边【比大小】。
     这不是"看代码像不像",是算出来的结论 —— 也就不会像我第一版那样把错的钉成绿的。 */
const W = 1850, H = 848;                       /* 参考视口(和用户截图同量级)*/
const G = { top: 68, right: 93, bottom: 67, left: 95 };   /* 玻璃窗口四边(--ff-win-*)*/
const px = (s) => {
  s = String(s).trim();
  if (/vh$/.test(s)) return parseFloat(s) * H / 100;
  if (/vw$/.test(s)) return parseFloat(s) * W / 100;
  return parseFloat(s);
};
const clampOf = (s) => {
  const m = /^clamp\(([^)]+)\)$/.exec(String(s).trim());
  if (!m) return px(s);
  const p = m[1].split(',').map(px);
  return Math.min(Math.max(p[0], p[1]), p[2]);
};
const tBlock = allBlocks(tcss, '.tablet {');
const VARS = {
  '--ff-win-top': G.top, '--ff-win-right': G.right, '--ff-win-bottom': G.bottom, '--ff-win-left': G.left,
  '--tab-gap-y': clampOf(decl(tBlock, '--tab-gap-y')),
  '--tab-gap-x': clampOf(decl(tBlock, '--tab-gap-x')),
};
const val = (s) => {
  s = String(s).trim();
  /* var() 的兜底值是可选的:写 var(--x) 时没有逗号 —— 正则必须容忍,
     否则会掉到 px() 里变成 NaN(这个坑刚踩过)。 */
  const v = /^var\((--[a-z-]+)\s*(?:,\s*(.+))?\)$/.exec(s);
  if (v) return VARS[v[1]] !== undefined ? VARS[v[1]] : (v[2] !== undefined ? clampOf(v[2]) : NaN);
  return px(s);
};
/* --tab-g-* 自己是 `var(--ff-win-top, 13vh)` 这种,递归解一层(声明顺序上放这里,
   因为 val 要先能用) */
['t', 'r', 'b', 'l'].forEach((k) => { VARS['--tab-g-' + k] = val(decl(tBlock, '--tab-g-' + k)); });
const calc = (s) => {
  s = String(s).trim();
  const m = /^calc\((.+)\)$/.exec(s);
  if (!m) return val(s);
  return m[1].split('+').map((t) => val(t)).reduce((a, b) => a + b, 0);
};
/* ★ 拆简写的三个值时【必须自己配对括号】:calc(var(--a) + var(--b)) 里有嵌套的 `)`,
   用 /calc\([^)]*\)/ 会在第一个 `)` 就断掉(这个坑本项目踩过好几次了)。 */
const shorthand = (s) => {
  const out = []; let depth = 0, cur = '';
  for (const ch of String(s)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
};
ok('★ 平板的基础定位用【玻璃窗口】那组变量(--ff-win-*),不是视口',
  /inset:\s*var\(--tab-g-t\)\s*var\(--tab-g-r\)\s*var\(--tab-g-b\)\s*var\(--tab-g-l\)/.test(tBlock) &&
  /--tab-g-t:\s*var\(--ff-win-top/.test(tBlock),
  'inset 走 --tab-g-* → --ff-win-*(量不到才退回 13vh/5vw/7.5vh)');

const fitPad = decl(allBlocks(tcss, 'html.frame-fitted .tablet'), 'padding');
const padTokens = shorthand(fitPad);
const P = { top: calc(padTokens[0]), right: calc(padTokens[1]), bottom: calc(padTokens[2]) };
P.left = P.right;   /* 三值简写:左 = 右 */
ok('★ 已贴合时把窗口那一圈尺寸【还成内边距】(inset:0 的内容盒从视口算起,不还会被裁)',
  /^calc\(/.test(fitPad) && P.top > 0, `padding-top = ${P.top.toFixed(1)}px`);
ok('★★ 内容四边都落在玻璃里(上/左两条正是被裁掉过的那两条)',
  P.top >= G.top && P.left >= G.left && P.right >= G.right && P.bottom >= G.bottom,
  `内容内边距 ${P.top.toFixed(0)}/${P.right.toFixed(0)}/${P.bottom.toFixed(0)} ≥ 玻璃 ${G.top}/${G.right}/${G.bottom}/${G.left}`);
ok('★ 而且玻璃四边都用上了(不是"躲得远远的"把屏幕缩成一小块)',
  P.top - G.top <= 40 && P.left - G.left <= 40 && P.bottom - G.bottom <= 40,
  `比玻璃再多让 ${(P.top - G.top).toFixed(0)}/${(P.left - G.left).toFixed(0)}px(≤40)`);
ok('★ frame-fitted 的剪裁规则仍然把平板列进去了(背景要跟着四角的斜切走)',
  /html\.frame-fitted \.screen-static,\s*\n?html\.frame-fitted \.tablet/.test(icss),
  '同一条 clip-path 规则覆盖两层');

/* ---------- ④ 转场 ----------
   ★ 取时长不能写 `transition:\s*([\s\S]*?);` —— 那会在第一条属性后的分号就截断。
      直接在整块声明里找 `transform .NNs`。
   ★ 单位要盯住:CSS 里写的是 `.36s`(省略前导 0),`\.(\d+)s` 抓出来是整数 36 ——
      拿它去和"2~5 秒"比当然不过。读成秒:抓到数字后补 0. 前缀。 */
const dur = Number('0.' + (/transition:[\s\S]*?transform\s*\.(\d+)s[\s\S]*?;/.exec(tBlock) || [])[1]);
ok('★ 有【短的】过场动画(用户要求"加一个短的过场动画")',
  dur >= 0.2 && dur <= 0.5, 'transform 过渡 ' + dur.toFixed(2) + 's(要在 .20~.50s:再长显拖,再短像闪)');
ok('★ 转场有起点(不是直接出现)',
  /transform:\s*translateY\(-?\d+px\)\s*scale\(\.\d+\)/.test(tBlock) && /opacity:\s*0/.test(tBlock),
  '初始态:' + ((/transform:\s*([^;]+)/.exec(tBlock) || [])[1] || '?'));
ok('APP 图标【错开】落位(不是一起蹦出来)',
  /transition-delay:\s*calc\([^)]*var\(--app-i/.test(tcss),
  '用 --app-i 算延迟');
ok('卡片也跟着入场(先铺底再落图标)',
  /\.tablet\.is-on\s+\.tablet__card/.test(tcss) && /transition-delay:\s*70ms/.test(tcss));
ok('★ "减少动态效果"下不平移、不错开(只直接出现)',
  /prefers-reduced-motion[\s\S]*?\.tablet__hint\s*\{[\s\S]*?opacity:\s*1/.test(tcss),
  '有 reduced-motion 分支');

/* ---------- ⑤ 尺寸与磁吸(用户:"APP按钮有点小"、"扫描框移上去不会吸附")---------- */
const iconPx = clampOf(decl(allBlocks(tcss, '.tablet__app-icon {'), 'width') || '0px');ok('★ APP 图标够大(第一版 848px 高的屏上只有 44px,用户说太小)',
  iconPx >= 56, `图标 ${iconPx.toFixed(0)}px(clamp 下限 ≥56,按屏高 8%)`);
ok('★ 磁吸光标认 .tablet__app(它们是 <a>,兜底那条 button:not(.frost-shard) 罩不到)',
  /\.tablet__app/.test(mjs.split('var SELECTOR')[1].split('].join')[0]),
  'SELECTOR 里加了 .tablet__app / .tablet__recent-item / .tablet__tag');
ok('★ APP 用 flex 居中排,不是 auto-fit 网格(auto-fit 会把 5 个图标摊成一排 300px 宽的大格子)',
  /\.tablet__apps\s*\{[^}]*display:\s*flex/.test(tcss) && /justify-content:\s*center/.test(tcss));

/* ---------- ⑥ 第三轮:三件事 ----------
   ① 平板要【完全盖住】整块屏幕 —— 第一版用的是给黑屏层那份轮廓(--ff-clip),
      而那份被 frame-fit 刻意往中心收过 k 倍(留给黑屏一点余量),
      于是平板四周有一圈盖不到,底下那张 CD 页从那一圈露出来。
      现在多算一份"覆盖轮廓"(--ff-clip-cover),只给平板用。
      ★ 数值证明(把贴图解码、按同一套算法复算,看覆盖轮廓的四边是不是真的
        都超过窗口)放在 .tmp/frame-gap.mjs —— 这里钉的是【结构不变量】:
        黑屏层仍然用收过的那份、平板用放出去的那份,两者不能互换。
   ② 搜索结果要【在搜索卡片里面】,而且展开要顺(用 animation 不是 transition)。
   ③ 明暗 + 音量两枚控件要回到平板、放在时钟卡片右边,而且不许另起一套逻辑。 */
const ffjs = fs.readFileSync(`${BH}/assets/js/frame-fit.js`, 'utf8');
ok('★ frame-fit 另外算了一份【覆盖轮廓】并写进 --ff-clip-cover',
  /coverClip/.test(ffjs) && /--ff-clip-cover/.test(ffjs) && /var PADT = 5/.test(ffjs),
  '黑屏层那条 --ff-clip 不动,新增 --ff-clip-cover');
ok('★ 覆盖轮廓 = 未收缩的逐行轮廓 + 每行各自往外让 PADT',
  /var raw = pts\.map/.test(ffjs) && /var poly = raw\.map\(shrink\)/.test(ffjs) &&
  /raw\.map\(function \(p\) \{[\s\S]{0,240}p\[0\] < cxm \? -PADT : PADT/.test(ffjs),
  '★ 不能用整体放大:倍数会被"电源键凹口"那一行带偏(算出来 1.028),所有行一起被推出去 23px,啃掉一条边框');
/* 数值证明(把外框贴图解码、按同一套算法复算)在 .tmp/frame-gap.mjs —— 1850×848 下:
     玻璃四边 101/70/94/75;旧轮廓(--ff-clip)没盖住 7/8/18/7 px;
     新轮廓(--ff-clip-cover)四边都翻过去了(最外那行 -14,其余 -3~-4)。*/
ok('★★ 平板用覆盖轮廓,黑屏层仍用收过的那份(两者不能互换)',
  /html\.frame-fitted \.tablet \{[^}]*clip-path: var\(--ff-clip-cover, var\(--ff-clip\)\)/.test(icss) &&
  /html\.frame-fitted \.screen-static,\s*\n?html\.frame-fitted \.tablet \{[\s\S]*?clip-path: var\(--ff-clip\)/.test(icss),
  '平板:--ff-clip-cover · .screen-static:--ff-clip');

/* ---- 玻璃垫层(用户提的"把边框的透明区域填充一下")----
   它不补缝(平板自己已经盖满),它解决两件缝补不掉的事:
   ① clip-path 的抗锯齿边缘像素会和【底下的东西】混色 —— 底下是 CD 页就透出一圈浅描边;
   ② 平板是 opacity 淡入的,淡入过程中底下那页会透出来。
   所以它必须:和平板同一份剪裁、同一个底色、只在平板开着时可见、不吃点击。 */
const gbBlock = allBlocks(tcss, '.glass-backing');
ok('★ 玻璃垫层在标记里(aria-hidden,纯装饰)',
  /class="glass-backing"\s+aria-hidden="true"/.test(tpl) && /class=glass-backing/.test(built));
ok('★★ 垫层的形状和平板【同一份剪裁】(差一点就又能透出别的东西)',
  /clip-path: var\(--ff-clip-cover, var\(--ff-clip\)\)/.test(gbBlock),
  '--ff-clip-cover');
ok('★★ 垫层的底色和平板【同一个变量】(颜色差一点,"边缘混色"就白做了)',
  /--tab-bg:\s*linear-gradient/.test(allBlocks(tcss, ':root {')) &&
  /background: var\(--tab-bg\)/.test(gbBlock) &&
  /var\(--tab-bg\)/.test(tBlock),
  '两边都写 var(--tab-bg),底色只定义一次');
{
  const zTab2 = Number((/z-index:\s*(\d+)/.exec(tBlock) || [])[1]);
  const zGb = Number((/z-index:\s*(\d+)/.exec(gbBlock) || [])[1]);
  ok('★ 垫层紧贴在平板【下面】一层(39 < 40),而且在所有盘上面',
    zGb > 0 && zGb < zTab2 && zGb > 20, `垫层 ${zGb} < 平板 ${zTab2}`);
}
ok('★ 垫层只在平板开着时可见,而且不吃点击、不动画错拍',
  /body\.tablet-open \.glass-backing \{\s*opacity: 1;/.test(tcss) &&
  /pointer-events: none/.test(gbBlock) && /transition: opacity \.26s ease/.test(gbBlock),
  'body.tablet-open + pointer-events:none + 与平板同为 .26s');
ok('★ 量不到窗口轮廓时垫层不出场(那时没有可裁的形状)',
  /html\.frame-fitted \.glass-backing \{\s*display: block;/.test(tcss) && /display: none/.test(gbBlock));

ok('★ 搜索结果面板【在卡片里】(不再绝对定位挂到卡片下面)',
  /\.tablet__search-results \{[\s\S]*?flex: 1 1 auto/.test(tcss) &&
  !/\.tablet__search-results \{[\s\S]*?position: absolute/.test(tcss),
  '用户:"不太丝滑,展开后不是在卡片内的"');
ok('★ 结果面板的入场用 animation(display 从 none 变可见时 transition 不会跑)',
  /@keyframes tabletSearchIn/.test(tcss) && /animation: tabletSearchIn/.test(tcss),
  'keyframes tabletSearchIn');
ok('★ 搜索卡片里输入框在上、结果在下面排(不再垂直居中)',
  /\.tablet__search \{ justify-content: flex-start; \}/.test(tcss));

ok('★ 明暗 / 音量两枚控件回到了平板(用户:放到时钟卡片右边)',
  /data-tablet-theme/.test(tpl) && /data-tablet-mute/.test(tpl) &&
  /data-tablet-volume\b/.test(tpl) && /data-tablet-volume-out/.test(tpl),
  '四个钩子都在模板里');
{
  const iClock = built.indexOf('tablet__clock');
  const iCtl = built.indexOf('tablet__controls');
  const iSear = built.indexOf('tablet__search"');
  ok('★ 位置就在时钟卡片右边(时钟 → 控件 → 搜索,渲染顺序)',
    iClock > 0 && iCtl > iClock && iSear > iCtl,
    `时钟@${iClock} < 控件@${iCtl} < 搜索@${iSear}`);
  const wRow = allBlocks(tcss, '.tablet__row--widgets {');
  ok('★ 三列:时钟 | 控件(auto)| 搜索',
    (decl(wRow, 'grid-template-columns').match(/minmax|auto/g) || []).length === 3,
    decl(wRow, 'grid-template-columns'));
}
ok('★★ 控件【不另起一套逻辑】:去点顶栏那两个 + 往 #volume-range 派发 input',
  /getElementById\("theme-toggle"\)/.test(tjs) && /getElementById\("volume-range"\)/.test(tjs) &&
  /volRange\.dispatchEvent\(new Event\("input"/.test(tjs) && /themeBtn\.click\(\)/.test(tjs),
  '明暗 = 点顶栏那枚;音量 = 写进去再派发 input');
ok('★★ 平板自己【不写】主题/音量那两个存储键(否则两边会各存一份状态)',
  /* ★ 必须先剥注释:这段代码的注释里【本来就写着 "pref-theme"】(解释为什么不去写它),
     不剥就会把自己的说明当成证据判红 —— 本轮就踩了一次(README 里那条"注释会毒化
     源码扫描"的老坑,又一次)。 */
  !/pref-theme/.test(tjs.replace(/\/\*[\s\S]*?\*\//g, '')) &&
  !/VOL_KEY/.test(tjs) &&
  !/localStorage[\s\S]{0,40}volume/i.test(tjs.replace(/\/\*[\s\S]*?\*\//g, '')),
  '持久化仍然只由 theme-palette.js / cd-audio.js 做');
ok('★ 顶栏那边一动,平板跟着同步(两处都挂监听)',
  /themeBtn\.addEventListener\("click", syncControls\)/.test(tjs) &&
  /volRange\.addEventListener\("input", syncControls\)/.test(tjs));

/* ---------- ⑦ 搜索组件:两处实例 ---------- */
ok('搜索抽成了可复用组件(一个容器 = 一个实例)',
  /document\.querySelectorAll\("\[data-search\]"\)/.test(sjs) && /function build\(/.test(sjs));
ok('★ 顶栏那份也换成了组件契约(不是只给平板另写一套)',
  /data-search>/.test(hdr) && /data-search-input/.test(hdr) && /data-search-results/.test(hdr),
  'header.html 上加了三个 data-search* 属性');
ok('★ 旧的 header-search.js 会【让位】给新组件(两套同时挂会各渲染一遍)',
  /if \(document\.querySelector\("\[data-search\]"\)\) return;/.test(hjs),
  '有那条守卫');
/* ★ 顺序要查【渲染结果】,不是查模板源码的先后 —— defer 脚本按文档顺序执行,
   所以运行时 search.js 必须排在 header-search.js 前面,守卫才来得及生效。 */
const scriptSrcs = [...built.matchAll(/<script defer src=([^ >]+)><\/script>/g)].map((m) => m[1]);
const iSearch = scriptSrcs.findIndex((x) => /\/search\.[0-9a-f]+\.js/.test(x));
const iHeader = scriptSrcs.findIndex((x) => /header-search/.test(x));
ok('★ 渲染出来的 <script> 里 search.js 排在 header-search.js 之前(defer 按序执行)',
  iSearch >= 0 && iHeader >= 0 && iSearch < iHeader,
  `search 第 ${iSearch + 1} 个 · header-search 第 ${iHeader + 1} 个`);

/* ---------- ⑦ 行为 ---------- */
ok('★ 按下顶缘开关 = 开/合平板,而且【拦下】原来那套状态栏逻辑',
  /addEventListener\("click",\s*function \(e\) \{[\s\S]{0,260}stopImmediatePropagation\(\)/.test(tjs) &&
  /,\s*true\);/.test(tjs),
  '捕获阶段 + stopImmediatePropagation');
ok('★ Esc 能收起来 —— 但焦点在输入框里时不收(那只该收起搜索结果)',
  /e\.key === "Escape"[\s\S]{0,220}tagName === "INPUT"/.test(tjs),
  'Esc 分支里先看焦点');
ok('★★ 平板的记忆键和状态栏【不是同一个】',
  /var KEY = "cd-tablet"/.test(tjs) && !/var KEY = "cd-statusbar"/.test(tjs),
  'intro.js 每加载一次就往 cd-statusbar 写 "1",共用一个键的话平板会自己弹出来');
ok('★ 开关两个方向都记(不然刷新后关不掉)',
  /localStorage\.setItem\(KEY, on \? "1" : "0"\)/.test(tjs));
ok('★ CD 架拉出来时自动收起平板(平板不在 .scene 里,不会跟着场景左移)',
  /MutationObserver[\s\S]{0,200}scene-open/.test(tjs),
  '盯 body 的 class(那边是 classList.toggle,没有事件可听)');
ok('[hidden] 与 .is-on 分两拍(否则过渡不跑)',
  /root\.hidden = false;[\s\S]{0,160}void root\.offsetWidth/.test(tjs),
  '先揭 [hidden],强制布局,再加 .is-on');
ok('键盘能进得来(焦点交给第一个 APP)',
  /firstApp[\s\S]{0,80}\.focus\(/.test(tjs) && /immediate \? null : root\.querySelector\("\.tablet__app"\)/.test(tjs),
  '只在用户按下开关时抢焦点,页面加载恢复状态时不抢');
ok('留了现场读数 __tablet()(这个环境没浏览器)',
  /window\.__tablet = function/.test(tjs));
ok('★ 读数里带几何(平板盒 / 玻璃四边)—— 这一层最容易错的就是"内容有没有落在玻璃里"',
  /glass:\s*rs\s*\?/.test(tjs) && /--ff-win-top/.test(tjs) && /getBoundingClientRect/.test(tjs));

/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, name, info] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + name + (info ? '   [' + info + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
