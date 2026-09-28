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

/* ---------- ② ★★★ 边框几何:把算法跑起来,验【屏幕角度】 ----------
   用户纠正过一次:"你的角度理解错了,你现在画的是与水平方向30°,而我要的是60°,
   陡一点的线。而且你这个45°完全不是45°啊。"
   ⇒ 45°/60° 是【屏幕上的角度】,换算是 Δx% = Δy% × (视口高 ÷ 视口宽) ÷ tan(角)。
   ⇒ 所以这条折线只能在运行时算:真值在 assets/js/page-hud.js 的 gFrame(w, h)。
     这里把它拿真源码跑起来(给一个最小的 window,不要 document ⇒ 它直接 return),
     然后对着"每段的屏幕角度"和"每个顶点"验 —— 不是比字符串。 */
const hudJsSrc = rd(`${BH}/assets/js/page-hud.js`);
const win = {};
new Function('window', 'document', hudJsSrc)(win, undefined);   /* document=undefined ⇒ 只导函数 */
const gFrame = win.__hudFrame && win.__hudFrame.gFrame;
ok('★★ 几何函数 gFrame(w,h) 能在没有 DOM 的环境里单独跑(测试靠它验真值)',
  typeof gFrame === 'function');
const REF_W = 1920, REF_H = 1080;
const ref = gFrame ? gFrame(REF_W, REF_H) : { user: [], path: '' };
const U = ref.user;
/* 屏幕角度:两点的像素位移算 atan */
const angOf = (i, j, W, H, pts) => {
  const p = pts || U;
  const dx = (Math.abs(p[j][0] - p[i][0]) / 100) * W;
  const dy = (Math.abs(p[j][1] - p[i][1]) / 100) * H;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};
ok('★★ 十个顶点(用户坐标:x 从右缘向左,单位是页宽的 %)',
  U.length === 10, U.map(([x, y]) => '(' + x.toFixed(3) + ',' + y.toFixed(3) + ')').join(' '));
ok('★ ① 起点 = 横坐标 45、页顶', Math.abs(U[0][0] - 45) < 1e-9 && Math.abs(U[0][1]) < 1e-9);
ok('★★ ② 第一段屏幕上正好 60°(陡的那条),到竖坐标 9',
  Math.abs(angOf(0, 1, REF_W, REF_H) - 60) < 1e-9 && Math.abs(U[1][1] - 9) < 1e-9,
  angOf(0, 1, REF_W, REF_H).toFixed(6) + '°');
ok('★ ③ 第二段水平,到横坐标 30',
  Math.abs(U[2][1] - U[1][1]) < 1e-9 && Math.abs(U[2][0] - 30) < 1e-9);
ok('★★ ④ 第三段屏幕上正好 45°(往右上),到竖坐标 6',
  Math.abs(angOf(2, 3, REF_W, REF_H) - 45) < 1e-9 && Math.abs(U[3][1] - 6) < 1e-9,
  angOf(2, 3, REF_W, REF_H).toFixed(6) + '°');
ok('★ ⑤ 第四段水平,到横坐标 10',
  Math.abs(U[4][1] - U[3][1]) < 1e-9 && Math.abs(U[4][0] - 10) < 1e-9);
ok('★★ ⑥ 第五段屏幕上正好 45°(往右下),到横坐标 6 —— 落点就是 y₁',
  Math.abs(angOf(4, 5, REF_W, REF_H) - 45) < 1e-9 && Math.abs(U[5][0] - 6) < 1e-9,
  angOf(4, 5, REF_W, REF_H).toFixed(6) + '°');
const y1 = U[5][1];
ok('★★ ⑦ 竖段:到 100 − y₁(用户自己给的关系式),而且 x 不变',
  Math.abs(U[6][1] - (100 - y1)) < 1e-9 && Math.abs(U[6][0] - U[5][0]) < 1e-9,
  'y₁=' + y1.toFixed(4) + ' ⇒ 100−y₁=' + (100 - y1).toFixed(4));
ok('★★ ⑧ 第六段屏幕上正好 45°(往左下),到横坐标 10',
  Math.abs(angOf(6, 7, REF_W, REF_H) - 45) < 1e-9 && Math.abs(U[7][0] - 10) < 1e-9,
  angOf(6, 7, REF_W, REF_H).toFixed(6) + '°');
ok('★ ⑨ 第七段水平,到横坐标 25',
  Math.abs(U[8][1] - U[7][1]) < 1e-9 && Math.abs(U[8][0] - 25) < 1e-9);
ok('★★ ⑩ 最后一段屏幕上正好 60°,落到下边框(y=100)',
  Math.abs(angOf(8, 9, REF_W, REF_H) - 60) < 1e-9 && Math.abs(U[9][1] - 100) < 1e-9,
  angOf(8, 9, REF_W, REF_H).toFixed(6) + '°');
ok('★★ 45° 那两段互为镜像 ⇒ ⑧ 的落点恒等于 y=94(与视口长宽比无关)',
  Math.abs(U[7][1] - 94) < 1e-9, 'y=' + U[7][1].toFixed(6));
/* ★★ 换视口:角度必须【一个都不变】—— 这正是"按屏幕角度"的定义 */
const views = [[2560, 1440], [1440, 900], [1850, 848], [1280, 1024], [3440, 1440]];
const angErr = [];
for (const [W, H] of views) {
  const g = gFrame(W, H);
  const chk = [[0, 1, 60], [2, 3, 45], [4, 5, 45], [6, 7, 45], [8, 9, 60]];
  for (const [i, j, want] of chk) {
    const got = angOf(i, j, W, H, g.user);
    if (Math.abs(got - want) > 1e-9) angErr.push(`${W}×${H} P${i + 1}→P${j + 1}: ${got.toFixed(6)}≠${want}`);
  }
}
ok('★★★ 换五种视口(含 21:9),五段斜线的屏幕角度一个都不变',
  angErr.length === 0, angErr.length ? angErr.join(' | ') : views.map((v) => v.join('×')).join(' '));
ok('★★ 视口一变,长宽比换算确实动了顶点(否则说明根本没在按屏幕角度算)',
  Math.abs(gFrame(1920, 1080).y1 - gFrame(2560, 1440).y1) < 1e-9 &&
  Math.abs(gFrame(1440, 900).y1 - gFrame(1920, 1080).y1) > 0.1,
  '16:9 的 y₁=' + gFrame(1920, 1080).y1.toFixed(4) + ',16:10 的 y₁=' + gFrame(1440, 900).y1.toFixed(4));

/* ★★★ 防漂:模板里那份参考折线必须就是 gFrame(1920,1080) 的输出 */
const frameSrc = (hudTpl.match(/\$frame := "([^"]+)"/) || [, ''])[1];
ok('★★★ 模板里的参考折线 == gFrame(1920,1080) 的输出(两边各算一遍再比,逐字相同)',
  !!frameSrc && frameSrc === ref.path,
  '模板: ' + frameSrc + '\n     函数: ' + ref.path);
ok('★★★ 构建产物里那份参考折线也一致(模板 → 产物这一段没被改写)',
  (tech.match(/data-hud-frame=(?:"([^"]*)"|([^\s>]+))/) || [, '', '']).slice(1).includes(frameSrc),
  '产物里 data-hud-frame 是根节点上的那份 16:9 参考值,页面一跑会被 JS 覆盖成真值');
ok('★★ 三层 path 用的是同一条 d(光晕 / 主线 / 跑马灯一起按真实视口重画)',
  /var paths = svg\.querySelectorAll\("path"\)/.test(hudJs) &&
  /paths\[i\]\.setAttribute\("d", g\.path\)/.test(hudJs),
  'JS 是遍历 path 统一写 d,不是各写各的');
ok('★ 视口变化时会重算(resize + rAF 收口,拖窗口不会每像素都算)',
  /addEventListener\("resize"/.test(hudJs) && /requestAnimationFrame/.test(hudJs));
/* ★ 边框竖段那一列 = CSS 里给控件留的那一列:改了一个忘了另一个就会骑到正文上 */
const spineX = 100 - U[5][0];   /* 竖段在 SVG 里的 x */
ok('★★ CSS 的 --hud-w 和折线竖段对得上(6vw ↔ SVG x=94 ⇒ 距右缘 6%)',
  spineX === 94 && /--hud-w:\s*6vw/.test(css),
  '竖段 SVG x=' + spineX);

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
/* ★★ 最小化会把路径数据整个改写:M55 0 L57.9228 9 … L73.0514 100
   变成了 M55 0l2.9228 9H70l1.6875-3H90l4 7.1111V86.8889L90 94H75l-1.9486 6 ——
   相对命令、V/H、连最后的 100 都被并进 "l-1.9486 6" 里去了。
   所以【别用正则去产物里找数字】:老老实实按 SVG 路径语法走一遍,拿到顶点再比。 */
const walkPath = (d) => {
  const toks = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e-?\+?\d+)?/gi) || [];
  const pts = [];
  let i = 0, x = 0, y = 0, cmd = '';
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    const n = () => Number(toks[i++]);
    if (cmd === 'M' || cmd === 'L') { x = n(); y = n(); pts.push([x, y]); if (cmd === 'M') cmd = 'L'; }
    else if (cmd === 'm' || cmd === 'l') { x += n(); y += n(); pts.push([x, y]); if (cmd === 'm') cmd = 'l'; }
    else if (cmd === 'H') { x = n(); pts.push([x, y]); }
    else if (cmd === 'h') { x += n(); pts.push([x, y]); }
    else if (cmd === 'V') { y = n(); pts.push([x, y]); }
    else if (cmd === 'v') { y += n(); pts.push([x, y]); }
    else if (cmd === 'Z' || cmd === 'z') { i++; }
    else throw new Error('不会解析的路径段: ' + cmd + ' @' + i);
  }
  return pts;
};
const builtUser = walkPath(dHalo).map(([x, y]) => [100 - x, y]);
ok('★★★ 把产物里那条 minify 过的 d 解析回顶点,和参考折线逐点相同',
  builtUser.length === ref.user.length &&
  builtUser.every(([x, y], k) => Math.abs(x - ref.user[k][0]) < 1e-3 && Math.abs(y - ref.user[k][1]) < 1e-3),
  builtUser.map(([x, y]) => '(' + x.toFixed(3) + ',' + y.toFixed(3) + ')').join(' '));
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
  Number(/--hud-run-total:\s*(\d+)/.exec(cssCode)[1]) > 0.9 * 1080 + 0.83 * 1920 / 1.6,
  '这一版折线屏幕总长 ≈ 0.9×视口高 + 0.55×视口宽;1080/1920 下约 2030px');
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
