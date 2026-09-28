import fs from 'node:fs';

/* ============================================================
   右侧 HUD —— 第二阶段第二刀:边框(多边形)
   ─────────────────────────────────────────────────────────────
   用户第一刀之后的原话:"效果不对,先去掉顶部的所有东西,画出边框先。
   边框并不是一个正统的矩形,而是一个多边形。"然后给了走向:

     以页面右上角为坐标原点,水平向左为 x 轴,页面比例为坐标(0~100):
       ① 起点在页面顶部、横坐标 30
       ② 与水平成 60° 往右下,到竖坐标 8
       ③ 接着向右直到横坐标 10
       ④ 与水平 45° 往右下直到横坐标 8(记此时竖坐标为 y₁)
       ⑤ 往下直到竖坐标 100 − y₁
       ⑥ 与水平 45° 往左下直到横坐标 10
       ⑦ 接着到横坐标 20
       ⑧ 与水平 60° 往左下直到下边框

   ★★ 这一套断言的主心骨是【把每个顶点算出来对账】,不是"看着像":
      · 45° 的判据是 |dx| == dy(坐标空间,不是屏幕角度);
      · y₁ = 10 不是拍的 —— 它由"⑤ 用 100 − y₁、且 ④ 的 45° 走 2 格"推出来;
      · 60° 的水平位移必须等于 8 ÷ tan(60°) = 4.6188022。
     这条链上任何一环改了,下面就会红。

   ★ 这一刀【不做】的(用户按顺序往后排):三枚按钮(导出 md / GitHub / WeChat)、
     三支笔、目录面板、进度条、左侧番茄钟与播放器。
   ============================================================ */

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
/* ★ 扫源码之前先剥注释 —— 解释性注释里会原样写着这些东西(踩过四次)。 */
const noC = (s) => String(s)
  .replace(/\{\{\/\*[\s\S]*?\*\/\}\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const home = rd(`${WS}/.tmp/t1/index.html`);
const tech = rd(`${WS}/.tmp/t1/tech/index.html`);
const post = rd(`${WS}/.tmp/t1/posts/hello-world/index.html`);
const about = rd(`${WS}/.tmp/t1/about/index.html`);
const css = rd(`${BH}/assets/css/page-hud.css`);
const cssCode = noC(css);
const hudTpl = rd(`${BH}/layouts/_partials/page-hud.html`);
const hudTplCode = noC(hudTpl);
const extHead = rd(`${BH}/layouts/partials/extend_head.html`);
const extFoot = rd(`${BH}/layouts/partials/extend_footer.html`);
const baseof = rd(`${BH}/layouts/baseof.html`);
const headerTpl = noC(rd(`${BH}/layouts/_partials/header.html`));
const hudJs = noC(rd(`${BH}/assets/js/page-hud.js`));
const palJs = noC(rd(`${BH}/assets/js/hud-palette.js`));
const holo = noC(rd(`${BH}/assets/css/holo.css`));
/* ★ 最小化产物里属性【没有引号】(class=page-hud),带引号的写法一个都匹配不到。 */
const cls = (name) => new RegExp('class="?' + name + '(?![\\w-])');
const headOf = (h) => h.slice(0, h.indexOf('<body'));

/* ---------- ① 这一条边框出现在哪些页面 ---------- */
ok('★★ 博客页有这条 HUD', cls('page-hud').test(tech) && cls('page-hud').test(post) && cls('page-hud').test(about));
ok('★★ 首页【没有】(首页有它自己那套平板主界面,两套会撞 id)',
  !cls('page-hud').test(home) && !/page-hud\.[0-9a-f]+\.(css|js)/.test(home),
  '首页既不该有这条 HUD,也不该白下它的样式和脚本');
ok('★ 样式只从 extend_head 里挂、而且带 if not .IsHome',
  /if not \.IsHome/.test(extHead) &&
  extHead.indexOf('if not .IsHome') < extHead.indexOf('css/page-hud.css') &&
  /page-hud\.[0-9a-f]+\.css/.test(tech) && /page-hud\.[0-9a-f]+\.js/.test(tech));
ok('★★ partial 只在 baseof 里调用一次,而且【不在 footer 链里】',
  (baseof.match(/partial "page-hud\.html"/g) || []).length === 1 &&
  !/page-hud\.html/.test(extFoot) &&
  !/page-hud\.html/.test(rd(`${BH}/layouts/index.html`)),
  '见 ⑨:主题的 footer 是 partialCached 的,按页面变的东西放进去会被"整类页面共用"');
ok('★ 样式表是【单独挂】的,没放进 assets/css/extended/(那是全站都加载的包)',
  fs.existsSync(`${BH}/assets/css/page-hud.css`) &&
  !fs.existsSync(`${BH}/assets/css/extended/page-hud.css`));

/* ---------- ② ★★★ 边框几何:逐顶点对着用户给的走向对账 ---------- */
const frameSrc = (hudTpl.match(/\$frame := "([^"]+)"/) || [, ''])[1];
const pts = [...frameSrc.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-3 : tol);
const T60 = Math.tan(Math.PI / 3);            /* tan60° = 1.7320508… */
const D60 = 8 / T60;                          /* 60° 走 8 格竖 → 水平 4.6188022 */
/* SVG 的 x 向右为正,用户的 x 向左为正 ⇒ 换算 */
const U = pts.map(([x, y]) => [100 - x, y]);

ok('★★ 边框是一条 8 个顶点的【折线】(不是闭合多边形:起于上边框、止于下边框)',
  pts.length === 8 && !/[Zz]/.test(frameSrc), frameSrc);
ok('★★ 顶点逐个对账(用户坐标:起点 (30,0) → … → 终点 (24.6188,100))',
  U.length === 8 &&
  near(U[0][0], 30) && near(U[0][1], 0) &&
  near(U[1][0], 30 - D60) && near(U[1][1], 8) &&
  near(U[2][0], 10) && near(U[2][1], 8) &&
  near(U[3][0], 8) && near(U[3][1], 10) &&
  near(U[4][0], 8) && near(U[4][1], 90) &&
  near(U[5][0], 10) && near(U[5][1], 92) &&
  near(U[6][0], 20) && near(U[6][1], 92) &&
  near(U[7][0], 20 + D60) && near(U[7][1], 100),
  U.map(([x, y]) => '(' + x.toFixed(4) + ',' + y.toFixed(4) + ')').join(' '));
ok('★ ① 起点在页面顶部(y=0)、横坐标 30', near(U[0][0], 30) && near(U[0][1], 0));
ok('★★ ② 第一段与水平成 60°(坐标空间:水平位移 = 8 ÷ tan60°)',
  near(Math.abs(U[1][0] - U[0][0]), D60, 1e-3) && near(U[1][1] - U[0][1], 8),
  'Δx=' + Math.abs(U[1][0] - U[0][0]).toFixed(4) + ' Δy=' + (U[1][1] - U[0][1]).toFixed(4));
ok('★ ③ 第二段是水平线(到横坐标 10)',
  near(U[2][1] - U[1][1], 0) && near(U[2][0], 10) && U[2][0] < U[1][0],
  '用户坐标 x 从 ' + U[1][0].toFixed(2) + ' 走到 10 = 屏幕上的"向右"');
ok('★★ ④ 第三段是 45° 内收:dx = dy = 2,于是 y₁ = 10',
  near(Math.abs(U[3][0] - U[2][0]), Math.abs(U[3][1] - U[2][1])) &&
  near(Math.abs(U[3][0] - U[2][0]), 2) && near(U[3][1], 10),
  'y₁ = ' + U[3][1] + '(不是拍的:45° 且走了 2 格 ⇒ 8+2)');
const y1 = U[3][1];
ok('★★ ⑤ 竖段一直下到 100 − y₁ = 90(用户自己给的关系式)',
  near(U[4][1], 100 - y1) && near(U[4][0], U[3][0]),
  'y₁=' + y1 + ' ⇒ 100−y₁=' + (100 - y1));
ok('★★ ⑥ 第四段是 45° 外扩:dx = dy = 2',
  near(Math.abs(U[5][0] - U[4][0]), Math.abs(U[5][1] - U[4][1])) &&
  near(Math.abs(U[5][0] - U[4][0]), 2),
  '对称:上端 10→8 内收,下端 8→10 外扩');
ok('★ ⑦ 第五段回到横坐标 20',
  near(U[6][1] - U[5][1], 0) && near(U[6][0], 20));
ok('★★ ⑧ 最后一段 60° 落到下边框(y=100)',
  near(Math.abs(U[7][0] - U[6][0]), D60, 1e-3) && near(U[7][1], 100),
  'Δx=' + Math.abs(U[7][0] - U[6][0]).toFixed(4));
ok('★★ 整条线不回到右缘、也不闭合 —— 它就是一条"从页顶拉到页底"的边框',
  U.every(([x]) => x >= 8 - 1e-6) && U.some(([x]) => x > 20));

/* ---------- ③ 形状层:同一条 d 画三层 + 屏幕像素的虚线 ---------- */
const dOf = (html, klass) => {
  const m = html.match(new RegExp('class="?' + klass + '"?\\s+d="([^"]+)"'));
  return m ? m[1] : '';
};
const dHalo = dOf(tech, 'hud-halo');
const dLine = dOf(tech, 'hud-line');
const dRun = dOf(tech, 'hud-run');
ok('★★ 光晕 / 主线 / 跑马灯 用的是【同一条 d】(抄成三份迟早漂)',
  !!dHalo && dHalo === dLine && dHalo === dRun, dHalo);
/* ★★ 最小化会把路径数据改写掉:产物里是 M70 0 74.6188 8H90l2 2V90l-2 2H80L75.3812 1e2 ——
   h/v 相对命令被换掉、100 被写成 1e2。所以"结构"看源码、"同不同"看产物。 */
ok('★ 产物里那三条 path 也确实是同一条(最小化改写它,但改的是同一种改法)',
  dHalo === dLine && dLine === dRun && /1e2|100/.test(dHalo),
  '注意 100 在产物里是 1e2');
ok('★ 边框在标记里是【三条 path】(halo / line / run;短刺这一刀没画)',
  (hudTplCode.match(/<path class="hud-(halo|line|run)"/g) || []).length === 3);
ok('★★ 三个类在 CSS 里都有规则,而且都 vector-effect: non-scaling-stroke',
  ['hud-halo', 'hud-line', 'hud-run'].every((k) => new RegExp('\\.' + k + '\\s*[,{]').test(cssCode)) &&
  /\.hud-halo,\s*\.hud-line,\s*\.hud-run\s*\{[^}]*vector-effect:\s*non-scaling-stroke/.test(cssCode),
  '★ 这一条不只是"线宽不变粗":non-scaling-stroke 让 dash* 也按【屏幕像素】算,' +
  '所以虚线节拍才能和 CD 页逐字相同(svgwg#323)');
ok('★ preserveAspectRatio=none + viewBox 就是 0 0 100 100(坐标即百分比)',
  /preserveAspectRatio="?none/.test(hudTplCode) && /viewBox="0 0 100 100"/.test(hudTplCode) &&
  /preserveAspectRatio="?none/.test(tech));
ok('★★ 断续节拍和 CD 页那条主线【一模一样】(同一套语言,漂一眼就看得出)',
  /--hud-dash:\s*([^;]+);/.exec(css)[1].trim() === /--line-dash:\s*([^;]+);/.exec(holo)[1].trim());
ok('★ 跑马灯的 dasharray / 偏移 / 时长都走变量',
  /\.hud-run\s*\{[^}]*stroke-dasharray:\s*var\(--hud-run-len\)/.test(cssCode) &&
  /@keyframes hud-run\s*\{[^}]*stroke-dashoffset:\s*var\(--hud-run-total\)/.test(cssCode) &&
  /animation:\s*hud-run var\(--hud-run-dur\)/.test(cssCode));
ok('★★ 跑马灯的起始偏移要 > 折线的屏幕总长,否则白线跑不完全程就跳回去',
  Number(/--hud-run-total:\s*(\d+)/.exec(cssCode)[1]) > 0.97 * 1080 + 0.25 * 1920,
  '1080 高 / 1920 宽这一档算下来折线约 1536px');
ok('★ CD 页那套"音乐电平点亮线条"的口子留着(--hud-glow)',
  /--hud-glow:\s*0;/.test(css) && /calc\(var\(--hud-line-a\) \+ var\(--hud-glow\)/.test(cssCode));

/* ---------- ④ 这一层不能吃点击、不能盖住东西 ---------- */
ok('★★ 整层 pointer-events: none(否则正文右半边的点击和划词全被吃掉)',
  /\.page-hud\s*\{[^}]*pointer-events:\s*none/.test(cssCode));
ok('★★ 控件自己开 auto(右下三件套要能点)',
  /\.hud-ctl\s*\{[^}]*pointer-events:\s*auto/.test(cssCode));
ok('★★ 必须固定在整个视口:边框是按【整页百分比】定位的',
  /\.page-hud\s*\{[^}]*position:\s*fixed/.test(cssCode) &&
  /\.page-hud\s*\{[^}]*inset:\s*0/.test(cssCode),
  '第一刀它是一条窄栏(top:--header-height + width);这一刀改成整页');
const zHud = Number(/\.page-hud\s*\{[^}]*z-index:\s*(\d+)/.exec(cssCode)[1]);
const zHeader = Number(/\.header\s*\{[^}]*z-index:\s*(\d+)/.exec(noC(rd(`${BH}/assets/css/extended/custom.css`)))[1]);
ok('★★ z-index 要大于正文、小于顶栏(顶栏回来时它的下拉面板得压得住)',
  zHud > 0 && zHud < zHeader, `hud=${zHud} header=${zHeader}`);
const defined = new Set((css.match(/--hud-[\w-]+(?=\s*:)/g) || []));
const used = new Set((css.match(/var\(--hud-[\w-]+/g) || []).map((s) => s.slice(4)));
const missing = [...used].filter((v) => !defined.has(v));
ok('★★ CSS 里用到的 --hud-* 变量全都有定义(拼错不会有任何报错,只会静默失效)',
  missing.length === 0, missing.join(', '));
ok('★ 三件套落在折线竖段(x=8)【右边】那一列里(--hud-w 就是那 8%)',
  /--hud-w:\s*clamp\([^)]*\b8%/.test(css) &&
  /\.hud-ctl\s*\{[^}]*right:\s*var\(--hud-pad\)/.test(cssCode) &&
  /\.hud-ctl\s*\{[^}]*width:\s*calc\(var\(--hud-w\)/.test(cssCode),
  '骑到竖线上就会压进正文区');

/* ---------- ⑤ 顶部已清空(用户第二刀的要求)---------- */
/* ★ baseof 里那行是被 Hugo 注释包起来的:剥掉注释后,"渲染"这件事必须消失。
   ★ 写这段注释时【不要把 Hugo 注释的收尾字符原样打出来】—— 它会提前关掉
     这个 JS 块注释(README 里记着这个坑,这是第五次)。 */
const baseofCode = noC(baseof);
ok('★★★ 顶栏(品牌 + 搜索)在博客页上【不再渲染】',
  !cls('header').test(tech) && !cls('logo').test(tech) && !/data-search/.test(tech) &&
  !/partialCached "header\.html"/.test(baseofCode),
  '用户原话:"先去掉顶部的所有东西,画出边框先"');
ok('★★★ 顶栏是"取消渲染",不是删文件 —— 标记还在,把它那行的注释去掉就能回来',
  /layouts\/_partials\/header\.html/.test(baseof) &&
  /class="logo"/.test(headerTpl) &&
  fs.existsSync(`${BH}/layouts/_partials/header.html`),
  '把"顶栏要不要"变成一行注释的事,而不是一场考古');
ok('★★ 第一刀那列导航(menu.main)也撤了,而且样式没留成死代码',
  !/data-hud-nav/.test(tech) && !/hud-nav/.test(hudTplCode) && !/hud-nav/.test(cssCode),
  '标记与样式一起撤;要取回见 commit ad55235');
ok('★★ 顶栏撤掉后不再有两个 id="menu" 的问题(整条都没了)',
  !/id="?menu"?/.test(tech) && !/id="?menu"?/.test(home));

/* ---------- ⑥ 右下三件套 ---------- */
const cnt = (h, re) => (h.match(re) || []).length;
ok('★★ #theme-toggle 在博客页【正好一个】—— 主题 footer 那句没有判空,少了会 TypeError',
  cnt(tech, /id="?theme-toggle"?/g) === 1 && cnt(post, /id="?theme-toggle"?/g) === 1);
ok('★ 明暗那枚用的是主题自己的 .sun / .moon 类(主题那两条 display 规则是全局的)',
  /class="?hud-knob/.test(tech) && /class="?moon/.test(tech) && /class="?sun/.test(tech) &&
  /\[data-theme="dark"\] \.moon/.test(rd(`${BH}/themes/PaperMod/assets/css/common/header.css`)));
ok('★ 旋钮的指针有深浅两个位置(不是"点一下什么都不动")',
  /\.hud-knob__dial\s*\{[^}]*--hud-knob-a:\s*-?\d+deg/.test(cssCode) &&
  /:root\[data-theme="dark"\] \.hud-knob__dial\s*\{[^}]*--hud-knob-a:\s*-?\d+deg/.test(cssCode));
ok('★★ 明暗不需要 HUD 自己绑事件(主题按 id 找人,换位置照样生效)',
  !/theme-toggle/.test(hudJs), 'page-hud.js 里不该出现 theme-toggle');
ok('★ 音量滑条:0~100,一个', /id="?volume-range"?/.test(tech) &&
  /id="volume-range"[^>]*min="?0"?[^>]*max="?100"?/.test(hudTplCode) &&
  cnt(tech, /id="?volume-range"?/g) === 1);
ok('★★ 音量写的是 cd-audio.js 读的那个键(两边永远是同一个音量,不各存一份)',
  /cd-audio-vol/.test(hudJs) && /VOL_KEY = "cd-audio-vol"/.test(noC(rd(`${BH}/assets/js/cd-audio.js`))));
ok('★ 配色滑条:0~360,一个', /id="?palette-hue"?/.test(tech) &&
  /id="palette-hue"[^>]*min="?0"?[^>]*max="?360"?/.test(hudTplCode) &&
  cnt(tech, /id="?palette-hue"?/g) === 1);
ok('★★ 三件套【不是弹出面板】(用户:"不是展开,是右下角那三个控件本身就长这样")',
  !/palette-panel/.test(tech) && !/volume-panel/.test(tech) && !/palette-panel/.test(hudTplCode),
  '老的两块悬停面板是从 nav-switches 来的,这一页根本不该有');
ok('★ 滑条是竖的(和 CD 页两根推子同一个做法:横着写再转 -90°)',
  /\.hud-range\s*\{[^}]*transform:\s*rotate\(-90deg\)/.test(cssCode));
ok('★ 滑条头是圆钮(--hud-thumb 走变量,不是浏览器默认方块)',
  /--hud-thumb:\s*\d+px/.test(css) && /::-webkit-slider-thumb\s*\{[^}]*border-radius:\s*50%/.test(cssCode));

/* ---------- ⑦ 配色:HSV 连续调,而且算法只有一份 ---------- */
ok('★★ 色相键只有一处读写(hud-palette.js):抄成两份,首帧还原和拖动生效就会各算各的',
  /pref-palette-hue/.test(palJs) && !/pref-palette-hue/.test(hudJs));
ok('★★ 配色算法被【内联进 <head>】(首帧之前就要位,否则先闪一下默认配色)',
  /resources\.Get "js\/hud-palette\.js"/.test(extHead) &&
  /\.Content \| safeJS/.test(extHead) && headOf(tech).includes('pref-palette-hue'),
  '内联的是同一个文件,不是抄一份算法');
ok('★ 首页不内联(它有自己的配色面板,两套会互相按死)', !headOf(home).includes('pref-palette-hue'));
ok('★★ 只对 .shell-page 生效 —— 首页那块平板的配色面板不能被这里按死成"点了没反应"',
  /classList\.contains\("shell-page"\)/.test(palJs) && /if \(!isShell\(\)\) return;/.test(palJs));
ok('★★ 没拖过就一个字都不写(不偷偷改用户的观感,沿用站点自己的配色/旧预设)',
  /var saved = stored\(\);/.test(palJs) && /if \(saved !== null\) apply\(saved\);/.test(palJs));
ok('★ 主题切换时重算一遍(同一组变量在深浅两套下不是同一套值)',
  /MutationObserver/.test(hudJs) && /attributeFilter:\s*\["data-theme"\]/.test(hudJs));
const palVars = ['--theme', '--entry', '--border', '--primary', '--secondary', '--tertiary', '--content', '--code-bg'];
ok('★★ 八个主题变量深浅两套都算齐了(少一个就会露主题的默认值,深浅不一致)',
  palVars.every((v) => (palJs.match(new RegExp('\\["' + v + '"', 'g')) || []).length === 2), palVars.join(' '));
ok('★ 旧预设名 → 色相 的迁移表在(老用户的 pref-palette 不会突然变成默认色)',
  /LEGACY/.test(palJs) && /mist/.test(palJs) && /violet/.test(palJs));
ok('★ 色相滑条会跟着主题变化重算(hue 存的是角度,不是颜色)',
  /function pal\(h, dark\)/.test(palJs) && /dataset\.theme === "dark"/.test(palJs));

/* ---------- ⑧ 别和页面上原有的东西抢位置 ---------- */
ok('★★ 「回到顶部」那枚圆按钮让开了右下三件套(它是 fixed + right:2rem + z-index:99)',
  /:root\[data-theme\]\.shell-page \.top-link\s*\{[^}]*right:\s*calc\(var\(--hud-w\)/.test(cssCode));
ok('★★ 窄屏:整条藏掉,让位那条也要一起撤回(不然右边会空出一块)',
  /@media \(max-width: 1180px\)\s*\{[\s\S]*?\.page-hud\s*\{[^}]*display:\s*none/.test(cssCode) &&
  (cssCode.match(/@media \(max-width: 1180px\)\s*\{([\s\S]*?)\n\}/) || ['', ''])[1].includes('right: 2rem'));
ok('★ reduced-motion:跑马灯和旋钮过渡都关掉',
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.hud-run\s*\{[^}]*animation:\s*none/.test(cssCode));
ok('★ 第一刀那条"给顶栏搜索框让位"的 padding-right 已经删了(顶栏都没了)',
  !/header-nav/.test(cssCode));

/* ---------- ⑨ ★★★ 缓存陷阱:按页面变的东西不能进 footer 链 ----------
   根因(第一刀踩的,症状是"同一个模板连跑三次,结果三个样"):
     主题 baseof.html:
       partialCached "footer.html" . .Layout .Kind (.Param "hideFooter") (.Param "ShowCodeCopyButtons")
     缓存键只到【页面种类】这一层:/about/ 和 /posts/hello-world/ 都是 page
     ⇒ 共用同一份 footer 渲染结果。HUD 曾经挂在 extend_footer.html 里,
       于是"当前页"那类按页变的东西会写死成别人的,而且并行渲染谁先谁后不定。
   现在:HUD 由 layouts/baseof.html 按页渲染(不在 partialCached 里)。
   ★★★ 逐页对账是这一批里最值钱的:只要 HUD 再被挪回 footer 链,整批页面立刻变红。 */
ok('★★★ 主题确实是 partialCached 缓存 footer 的(缓存键 = Layout + Kind + …)',
  /partialCached "footer\.html" \. \.Layout \.Kind/.test(rd(`${BH}/themes/PaperMod/layouts/baseof.html`)),
  '这条是根因,别删');
ok('★★★ 自家 baseof 里 HUD 排在 partialCached footer【之前】渲染', (() => {
  /* ★ 必须先剥注释:baseof 顶上的说明里就原样写着那句 partialCached,
     不剥的话 indexOf 撞到的是注释,这条断言会假红。 */
  const b = noC(baseof);
  return b.includes('partial "page-hud.html" .') &&
    b.indexOf('page-hud.html') < b.indexOf('partialCached "footer.html"');
})(), '位置也必须在 footer.html 之前 —— 那个 partial 末尾按 id 找 #theme-toggle(没判空)');

const walkPages = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walkPages(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
};
let withHud = 0, mismatch = [], homeHasHud = false;
for (const f of walkPages(`${WS}/.tmp/t1`)) {
  const h = rd(f);
  const rel = '/' + f.slice(`${WS}/.tmp/t1/`.length).replace(/index\.html$/, '');
  /* 分页第 1 页那种产物是"跳转壳"(只有 head 没有 body),不算页面 */
  if (!h.includes('<body') || /http-equiv=refresh/.test(h)) continue;
  const m = h.match(/data-hud-page=(?:"([^"]*)"|([^\s>]+))/);
  if (rel === '/') { homeHasHud = !!m; continue; }
  if (!m) { mismatch.push(`${rel} 没有 HUD`); continue; }
  withHud++;
  const c = h.match(/rel=canonical href=(?:"([^"]*)"|([^\s>]+))/) || [, '', ''];
  const canonPath = String(c[1] || c[2] || '').replace(/^https?:\/\/[^/]+/, '');
  const stamp = m[1] || m[2];
  if (stamp !== canonPath) mismatch.push(`${rel}: hud-page=${stamp} ≠ canonical=${canonPath}`);
}
ok('★★★ 逐页对账:每个产物里 HUD 的页面标记 == 这个文件自己的 canonical',
  withHud >= 10 && mismatch.length === 0,
  `扫了 ${withHud} 个带 HUD 的页面;` + (mismatch.length ? ' 出问题的:' + mismatch.join(' | ') : '全部一致'));
ok('★★ 首页不在这次逐页扫描里(它没有 HUD,也不该有)', !homeHasHud);

/* ---------- ⑩ 这一刀【不做】的东西没被顺手做进来 ---------- */
ok('★ 三枚按钮 / 三支笔 / 目录面板 / 进度条 / 左上角投影之类:都还没做',
  !/hud-toc|hud-progress|hud-pen|hud-export|pomodoro|hud-btn/.test(cssCode) &&
  !/目录|进度条/.test(hudTplCode) &&
  !/github\.com\/tuan4743/.test(hudTplCode) && !/wechat/.test(hudTplCode));

/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, n, i] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + n + (i ? '   [' + i + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
