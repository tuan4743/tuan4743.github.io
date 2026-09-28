import fs from 'node:fs';

/* ============================================================
   右侧 HUD —— 第二阶段第一刀(导航栏 + 右下三件套 + 边框)
   ─────────────────────────────────────────────────────────────
   用户给的布局图:最右侧是一条 HUD 栏,从上到下 =
     导航栏(menu.main,从顶栏搬过来)/ 三个按钮 / 右下三件套(音量·明暗·配色)。
   实现照 CD 选择页左侧那块 HUD(.holo)的语言:SVG 画边框 + 按钮压在线上。

   这一刀【不做】的(按用户要求往后排):目录面板 / 进度条 / 三支笔 / 顶栏搜索条 /
   左侧番茄钟与播放器 —— 断言里会检查它们没被顺手做进来。

   ★ 这里钉的都是"看着没问题、其实会出事"的地方:
     · pointer-events:整条 fixed 层不吃点击 → 正文右半边点不动、划不了词;
     · 顶栏那条 <ul id="menu"> 没删干净 → 同页两个 id,主题脚本绑错人;
     · #theme-toggle 少一个 → 主题 footer 那句 getElementById(...).addEventListener
       没有判空,直接 TypeError(整段脚本都不跑了);
     · viewBox 比例和这条栏差太多 → 虚线段横向竖向不一样长;
     · 配色算法抄成两份 → 首帧还原和拖动生效用的不是同一个算法,迟早漂。
   ============================================================ */

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
/* ★ 扫源码之前先剥注释 —— 解释性注释里会原样写着这些东西(踩过三次)。 */
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
const header = noC(rd(`${BH}/layouts/_partials/header.html`));
const hudJs = noC(rd(`${BH}/assets/js/page-hud.js`));
const palJs = noC(rd(`${BH}/assets/js/hud-palette.js`));
const holo = noC(rd(`${BH}/assets/css/holo.css`));
/* ★ 最小化产物里属性【没有引号】(class=page-hud),带引号的写法一个都匹配不到。 */
const cls = (name) => new RegExp('class="?' + name + '(?![\\w-])');
/* head 段(首帧前的那一段) */
const headOf = (h) => h.slice(0, h.indexOf('<body'));

/* ---------- ① 这一条栏出现在哪些页面 ---------- */
ok('★★ 博客页有这条 HUD', cls('page-hud').test(tech) && cls('page-hud').test(post) && cls('page-hud').test(about));
ok('★★ 首页【没有】(首页有它自己那套平板主界面,两套会撞 id)',
  !cls('page-hud').test(home) && !/page-hud\.[0-9a-f]+\.(css|js)/.test(home),
  '首页既不该有这条栏,也不该白下它的样式和脚本');
ok('★ 样式只从 extend_head 里挂、而且带 if not .IsHome',
  /if not \.IsHome/.test(extHead) &&
  extHead.indexOf('if not .IsHome') < extHead.indexOf('css/page-hud.css') &&
  /page-hud\.[0-9a-f]+\.css/.test(tech) && /page-hud\.[0-9a-f]+\.js/.test(tech));
ok('★★ partial 只在 baseof 里调用一次,而且【不在 footer 链里】',
  (rd(`${BH}/layouts/baseof.html`).match(/partial "page-hud\.html"/g) || []).length === 1 &&
  !/page-hud\.html/.test(extFoot) &&
  !/page-hud\.html/.test(rd(`${BH}/layouts/index.html`)),
  '见 ⑨:主题的 footer 是 partialCached 的,按页面变的东西放进去会被"整类页面共用"');
ok('★ 样式表是【单独挂】的,没放进 assets/css/extended/(那是全站都加载的包)',
  fs.existsSync(`${BH}/assets/css/page-hud.css`) &&
  !fs.existsSync(`${BH}/assets/css/extended/page-hud.css`));

/* ---------- ② SVG 边框:同一条 d 画四层 ---------- */
const dOf = (html, klass) => {
  const m = html.match(new RegExp('class="?' + klass + '"?\\s+d="([^"]+)"'));
  return m ? m[1] : '';
};
const dFrame = dOf(tech, 'hud-halo');
const dLine = dOf(tech, 'hud-line');
const dRun = dOf(tech, 'hud-run');
const dLock = dOf(tech, 'hud-lock');
ok('★★ 光晕 / 主线 / 跑马灯 用的是【同一条 d】(抄成三份迟早漂)',
  !!dFrame && dFrame === dLine && dFrame === dRun, dFrame);
ok('★ 拐点短刺是另一条路径(顶点上的垂直短线),不能和主线同 d',
  !!dLock && dLock !== dFrame &&
  (dLock.match(/[Mm]/g) || []).length === 12 &&
  /M92 8 h8 M92 8 v-8/.test(hudTplCode),
  '★ 最小化会把 h-8/v-8 改写成 H2/V0,所以"结构"看源码、"不是同一条"看产物');
ok('★ 边框在标记里是【四条 path】(halo/line/lock/run)',
  (hudTplCode.match(/<path class="hud-(halo|line|lock|run)"/g) || []).length === 4);
ok('★★ 四个类在 CSS 里都有规则',
  ['hud-halo', 'hud-line', 'hud-lock', 'hud-run'].every((k) => new RegExp('\\.' + k + '\\s*[,{]').test(cssCode)));
ok('★★ 四条线都 vector-effect: non-scaling-stroke(否则线宽跟着拉伸变粗)',
  /\.hud-halo,\s*\.hud-line,\s*\.hud-run\s*\{[^}]*vector-effect:\s*non-scaling-stroke/.test(cssCode) &&
  /\.hud-lock\s*\{[^}]*vector-effect:\s*non-scaling-stroke/.test(cssCode),
  '前三条共用一个规则块,短刺自己一块 —— 两处都要有');
ok('★ preserveAspectRatio=none(框要能拉到任意长宽比)',
  /preserveAspectRatio="?none/.test(hudTplCode) && /preserveAspectRatio="?none/.test(tech));

/* ★★ viewBox 比例 = 这条栏的真实长宽比(数值断言)
   栏宽 clamp(150px, 9vw, 196px);栏高 = 视口高 - 顶栏 60px。
   常见桌面视口下算出来的比值都在 4.9~5.9 之间 —— 差太多,虚线段就会
   横向竖向不一样长(见 page-hud.css 形状层那段注释)。 */
const vb = (hudTpl.match(/viewBox="0 0 (\d+) (\d+)"/) || []).slice(1).map(Number);
const vbRatio = vb.length === 2 ? vb[1] / vb[0] : NaN;
ok('★★ viewBox 比例落在 4.6~6.8 之间(实测栏体约 1:4.9~5.9)',
  vbRatio >= 4.6 && vbRatio <= 6.8, vbRatio.toFixed(2) + ' (100×' + vb[1] + ')');
const clampW = (css.match(/--hud-w:\s*clamp\((\d+)px,\s*9vw,\s*(\d+)px\)/) || []).slice(1).map(Number);
const ratios = [[1440, 900], [1920, 1080], [1280, 800]].map(([w, h]) =>
  (h - 60) / Math.min(clampW[1], Math.max(clampW[0], w * 0.09)));
ok('★ 三个常见视口算出来的真实比值和 viewBox 的差都在 30% 以内',
  ratios.every((r) => Math.abs(r - vbRatio) / r < 0.3),
  ratios.map((r) => r.toFixed(2)).join(' / ') + ' vs ' + vbRatio.toFixed(2));

ok('★ 断续节拍和 CD 页那条主线【一模一样】(同一套语言,漂一眼就看得出)',
  /--hud-dash:\s*([^;]+);/.exec(css)[1].trim() === /--line-dash:\s*([^;]+);/.exec(holo)[1].trim());
ok('★ 跑马灯的 dasharray / 偏移 / 时长都走变量',
  /\.hud-run\s*\{[^}]*stroke-dasharray:\s*var\(--hud-run-len\)/.test(cssCode) &&
  /@keyframes hud-run\s*\{[^}]*stroke-dashoffset:\s*var\(--hud-run-total\)/.test(cssCode) &&
  /animation:\s*hud-run var\(--hud-run-dur\)/.test(cssCode));
ok('★ CD 页那套"音乐电平点亮线条"的口子留着(--hud-glow,这一页留给阅读进度)',
  /--hud-glow:\s*0;/.test(css) && /calc\(var\(--hud-line-a\) \+ var\(--hud-glow\)/.test(cssCode));

/* ---------- ③ 这一层不能吃点击、不能盖住东西 ---------- */
ok('★★ 整条 pointer-events: none(否则正文右半边的点击和划词全被吃掉)',
  /\.page-hud\s*\{[^}]*pointer-events:\s*none/.test(cssCode));
ok('★★ 控件自己开 auto(导航和右下三件套都要能点)',
  /\.hud-nav\s*\{[^}]*pointer-events:\s*auto/.test(cssCode) &&
  /\.hud-ctl\s*\{[^}]*pointer-events:\s*auto/.test(cssCode));
ok('★★ 必须 position: fixed(挂在 <footer> 里,absolute 的包含块会变成文档初始包含块)',
  /\.page-hud\s*\{[^}]*position:\s*fixed/.test(cssCode) &&
  /\.page-hud\s*\{[^}]*top:\s*var\(--hud-top\)/.test(cssCode));
ok('★ --hud-top 就是主题的 --header-height(从顶栏下面开始)',
  /--hud-top:\s*var\(--header-height\)/.test(css));
/* ★★ 层叠:这条栏要压在正文之上、又要被顶栏的下拉面板压住 */
const zHud = Number(/\.page-hud\s*\{[^}]*z-index:\s*(\d+)/.exec(cssCode)[1]);
const zHeader = Number(/\.header\s*\{[^}]*z-index:\s*(\d+)/.exec(noC(rd(`${BH}/assets/css/extended/custom.css`)))[1]);
ok('★★ z-index 要大于正文、小于顶栏(顶栏的搜索/配色下拉面板得压得住它)',
  zHud > 0 && zHud < zHeader, `hud=${zHud} header=${zHeader}`);
/* ★ 自检:CSS 里用到的每个 --hud-* 变量都定义过(拼错一个就是"没生效"且毫无提示) */
const defined = new Set((css.match(/--hud-[\w-]+(?=\s*:)/g) || []));
const used = new Set((css.match(/var\(--hud-[\w-]+/g) || []).map((s) => s.slice(4)));
const missing = [...used].filter((v) => !defined.has(v));
ok('★★ CSS 里用到的 --hud-* 变量全都有定义(拼错不会有任何报错,只会静默失效)',
  missing.length === 0, missing.join(', '));

/* ---------- ④ 导航栏:数据是真的,而且是搬过来的 ---------- */
const navIds = [...tech.matchAll(/data-hud-nav="?([\w-]+)"?/g)].map((m) => m[1]);
ok('★★ 导航项 = site.Menus.main 五项,顺序按 weight(home/tech/archives/guestbook/about)',
  navIds.join(',') === 'home,tech,archives,guestbook,about', navIds.join(','));
/* ★ 取每一项那个 <a> 标签本身来看它的 href/class ——
   最小化后属性【没有引号】、href 又是 absLangURL 出来的绝对网址,
   用"锚定在某个属性旁边"的正则去匹配只会误判(这一条第一版就写错了)。 */
const tagOf = (html, id) => (html.match(new RegExp('<a\\b[^>]*data-hud-nav="?' + id + '"?[^>]*>')) || [''])[0];
const hrefOf = (t) => ((t.match(/href=(?:"([^"]*)"|([^\s>]+))/) || [, '', '']).slice(1).find(Boolean)) || '';
const navTags = [...tech.matchAll(/<a\b[^>]*data-hud-nav=[^>]*>/g)].map((m) => m[0]);
ok('★ 每一项的 href 都是真网址(绝对网址或站内路径,绝不能是 #)',
  navTags.length === 5 && navTags.every((t) => /^(https?:\/\/|\/)/.test(hrefOf(t)) && !/^#/.test(hrefOf(t))),
  navTags.map(hrefOf).join(' '));
ok('★ 当前页那一项有 is-current + aria-current="page"',
  /\bis-current\b/.test(tagOf(tech, 'tech')) && /aria-current="?page/.test(tagOf(tech, 'tech')) &&
  !/\bis-current\b/.test(tagOf(tech, 'home')) &&
  /\bis-current\b/.test(tagOf(about, 'about')) && /\bis-current\b/.test(tagOf(post, 'home')) === false,
  '在 /tech/ 上:tech 是当前页、home 不是;在 /about/ 上:about 是');
ok('★ 图标沿用菜单项的 $m.Pre(和顶栏旧址、平板 APP 同一批 SVG)',
  /\$m\.Pre/.test(hudTplCode) && /with \$m\.Pre/.test(hudTplCode));
ok('★★ 图标必须自己给尺寸:菜单项的 svg 没写 width/height,不在 .menu 里就没有规则量它',
  /\.hud-nav__icon svg\s*\{[^}]*width:\s*var\(--hud-icon\)/.test(cssCode) &&
  /\.hud-nav__icon svg\s*\{[^}]*height:\s*var\(--hud-icon\)/.test(cssCode),
  '不给的话 svg 会按 300×150 的固有尺寸铺开');
ok('★★ 顶栏里的老导航删干净了(同页两个 id="menu" 的话,主题脚本会绑错人)',
  !/id="menu"/.test(tech) && !/id="?menu"?/.test(header) && !/<ul[^>]*class="?menu/.test(header));
ok('★★ 顶栏里的三个开关也撤了(它们现在在 HUD 里,同页不能有两套同 id)',
  !/nav-switches\.html/.test(header) && /logo-switches/.test(rd(`${BH}/layouts/_partials/nav-switches.html`)) &&
  !/logo-switches/.test(tech) && /nav-switches\.html/.test(rd(`${BH}/layouts/index.html`)),
  'partial 本身留着 —— 首页那块平板还在用');
ok('★ 顶栏只剩下品牌 + 搜索(布局图上顶栏就只有这两样)',
  /class="?logo/.test(tech) && /data-search/.test(tech) && !/class="?nav-right"?[^>]*>\s*<ul/.test(tech));

/* ---------- ⑤ 右下三件套 ---------- */
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
  !/palette-panel/.test(tech) && !/volume-panel/.test(tech) &&
  !/palette-panel/.test(hudTplCode),
  '老的两块悬停面板是从 nav-switches 来的,这一页根本不该有');
ok('★ 滑条是竖的(和 CD 页两根推子同一个做法:横着写再转 -90°)',
  /\.hud-range\s*\{[^}]*transform:\s*rotate\(-90deg\)/.test(cssCode));
ok('★ 滑条头是圆钮(--hud-thumb 走变量,不是浏览器默认方块)',
  /--hud-thumb:\s*\d+px/.test(css) && /::-webkit-slider-thumb\s*\{[^}]*border-radius:\s*50%/.test(cssCode));

/* ---------- ⑥ 配色:HSV 连续调,而且算法只有一份 ---------- */
ok('★★ 色相键只有一处读写(hud-palette.js):抄成两份,首帧还原和拖动生效就会各算各的',
  /pref-palette-hue/.test(palJs) && !/pref-palette-hue/.test(hudJs));
ok('★★ 配色算法被【内联进 <head>】(首帧之前就要位,否则先闪一下默认配色)',
  /resources\.Get "js\/hud-palette\.js"/.test(extHead) &&
  /\.Content \| safeJS/.test(extHead) &&
  headOf(tech).includes('pref-palette-hue'),
  '内联的是同一个文件,不是抄一份算法');
ok('★ 首页不内联(它有自己的配色面板,两套会互相按死)',
  !headOf(home).includes('pref-palette-hue'));
ok('★★ 只对 .shell-page 生效 —— 首页那块平板的配色面板不能被这里按死成"点了没反应"',
  /classList\.contains\("shell-page"\)/.test(palJs) && /if \(!isShell\(\)\) return;/.test(palJs));
ok('★★ 没拖过就一个字都不写(不偷偷改用户的观感,沿用站点自己的配色/旧预设)',
  /var saved = stored\(\);/.test(palJs) && /if \(saved !== null\) apply\(saved\);/.test(palJs));
ok('★ 主题切换时重算一遍(同一组变量在深浅两套下不是同一套值)',
  /MutationObserver/.test(hudJs) && /attributeFilter:\s*\["data-theme"\]/.test(hudJs));
const palVars = ['--theme', '--entry', '--border', '--primary', '--secondary', '--tertiary', '--content', '--code-bg'];
ok('★★ 八個主题变量深浅两套都算齐了(少一个就会露主题的默认值,深浅不一致)',
  palVars.every((v) => (palJs.match(new RegExp('\\["' + v + '"', 'g')) || []).length === 2),
  palVars.join(' '));
ok('★ 旧预设名 → 色相 的迁移表在(老用户的 pref-palette 不会突然变成默认色)',
  /LEGACY/.test(palJs) && /mist/.test(palJs) && /violet/.test(palJs));
ok('★ 色相滑条会跟着主题变化重算(hue 存的是角度,不是颜色)',
  /function pal\(h, dark\)/.test(palJs) && /dataset\.theme === "dark"/.test(palJs));

/* ---------- ⑦ 别和页面上原有的东西抢位置 ---------- */
ok('★★ 「回到顶部」那枚圆按钮让开了这条栏(它是 fixed + right:2rem + z-index:99,会正好压住右下三件套)',
  /:root\[data-theme\]\.shell-page \.top-link\s*\{[^}]*right:\s*calc\(var\(--hud-w\)/.test(cssCode));
ok('★ 顶栏右边的搜索框也让开了(否则顶到视口右缘正好撞上这条栏)',
  /:root\[data-theme\]\.shell-page \.header-nav\s*\{[^}]*padding-right:\s*calc\(var\(--hud-w\)/.test(cssCode));
ok('★★ 窄屏:整条藏掉,而且上面那两条让位也要一起撤回(不然右边会空出一块)',
  /@media \(max-width: 1180px\)\s*\{[\s\S]*?\.page-hud\s*\{[^}]*display:\s*none/.test(cssCode) &&
  (cssCode.match(/@media \(max-width: 1180px\)\s*\{([\s\S]*?)\n\}/) || ['', ''])[1]
    .includes('right: 2rem'),
  '正文是 720px 居中列,视口不够宽时两边留白撑不下这条栏');
ok('★ reduced-motion:跑马灯和旋钮过渡都关掉',
  /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.hud-run\s*\{[^}]*animation:\s*none/.test(cssCode));

/* ---------- ⑧ 这一刀【不做】的东西没被顺手做进来 ---------- */
ok('★ 目录面板 / 进度条 / 三支笔 / 导出·GitHub·WeChat / 番茄钟 / 播放器:都还没做',
  !/hud-toc|hud-progress|hud-pen|hud-export|pomodoro/.test(cssCode) &&
  !/目录|进度条/.test(hudTplCode));

/* ---------- ⑨ ★★★ 缓存陷阱:按页面变的东西不能进 footer 链 ----------
   根因(本轮踩了,而且症状是"同一个模板连跑三次,结果三个样"):
     主题 baseof.html 是这么调 footer 的 ——
       partialCached "footer.html" . .Layout .Kind (.Param "hideFooter") (.Param "ShowCodeCopyButtons")
     缓存键只到【页面种类】这一层:/about/ 和 /posts/hello-world/ 都是 page
     ⇒ 共用同一份 footer 渲染结果。HUD 曾经挂在 extend_footer.html 里,
       于是导航的"当前页"高亮写死成【第一次渲染那个页面】的 permalink,
       而且并行渲染谁先谁后不定 ⇒ 每次构建结果都不一样。
   现在的结构:HUD 由 layouts/baseof.html 按页渲染(不在 partialCached 里)。
   ★★★ 下面这条逐页对账是这一批里最值钱的:只要 HUD 又被人挪回 footer 链,
     整批页面立刻变红,而不是表现为"某几页的高亮看着有点怪"。 */
const themeBaseof = rd(`${BH}/themes/PaperMod/layouts/baseof.html`);
ok('★★★ 主题确实是 partialCached 缓存 footer 的(缓存键 = Layout + Kind + …)',
  /partialCached "footer\.html" \. \.Layout \.Kind/.test(themeBaseof),
  '这条是根因,别删:它解释了为什么按页变的东西不能进 footer 链');
ok('★★★ 自家 baseof 里 HUD 排在 partialCached footer【之前】渲染',
  (() => {
    /* ★ 必须先剥注释:baseof 顶上的说明里就原样写着那句 partialCached,
       不剥的话 indexOf 撞到的是注释,这条断言会假红(这个坑踩过三次了)。 */
    const b = noC(rd(`${BH}/layouts/baseof.html`));
    return b.includes('partial "page-hud.html" .') &&
      b.indexOf('page-hud.html') < b.indexOf('partialCached "footer.html"');
  })(),
  '位置也必须在 footer.html 之前 —— 那个 partial 末尾按 id 找 #theme-toggle(没判空)');

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

/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, n, i] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + n + (i ? '   [' + i + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
