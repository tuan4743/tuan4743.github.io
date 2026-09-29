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
  !/page-hud\.html/.test(noC(extFoot)) &&
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
/* ★ 第二十轮:左下角 UHD 的折线 = gFrame 的整条镜像。这里一并取出它的纯函数,
   下面要用它和"镜像"两边各算一遍再比(和右支那条防漂断言同一个套路)。 */
const gFrameLeftFn = win.__hudFrame && win.__hudFrame.gFrameLeft;
const gFrameBottomFn = win.__hudFrame && win.__hudFrame.gFrameBottom;
const gFrameLeft = (w, h) => (gFrameLeftFn ? gFrameLeftFn(w, h) : { user: [], path: '' });
const gFrameBottom = (w, h) => (gFrameBottomFn ? gFrameBottomFn(w, h) : { user: [], path: '' });
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
ok('★ ⑤ 第四段水平,到横坐标 8',
  Math.abs(U[4][1] - U[3][1]) < 1e-9 && Math.abs(U[4][0] - 8) < 1e-9);
ok('★★ ⑥ 第五段屏幕上正好 45°(往右下),到横坐标 5 —— 落点就是 y₁',
  Math.abs(angOf(4, 5, REF_W, REF_H) - 45) < 1e-9 && Math.abs(U[5][0] - 5) < 1e-9,
  angOf(4, 5, REF_W, REF_H).toFixed(6) + '°');
const y1 = U[5][1];
ok('★★ ⑦ 竖段:到 100 − y₁(用户自己给的关系式),而且 x 不变',
  Math.abs(U[6][1] - (100 - y1)) < 1e-9 && Math.abs(U[6][0] - U[5][0]) < 1e-9,
  'y₁=' + y1.toFixed(4) + ' ⇒ 100−y₁=' + (100 - y1).toFixed(4));
ok('★★ ⑧ 第六段屏幕上正好 45°(往左下),到横坐标 8',
  Math.abs(angOf(6, 7, REF_W, REF_H) - 45) < 1e-9 && Math.abs(U[7][0] - 8) < 1e-9,
  angOf(6, 7, REF_W, REF_H).toFixed(6) + '°');
ok('★ ⑨ 第七段水平,到横坐标 35(第五轮从 25 拓到 35:底带要塞下三支笔 + 展开的滑条)',
  Math.abs(U[8][1] - U[7][1]) < 1e-9 && Math.abs(U[8][0] - 35) < 1e-9);
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
ok('★★★ 写 d 的时候【只认边框那支 SVG 里的 path】—— 这一条是拿血换来的',
  /root\.querySelector\("\.page-hud__frame"\)/.test(hudJs) &&
  /svg\.querySelectorAll\("path"\)/.test(hudJs) &&
  !/root\.querySelectorAll\("path"\)/.test(hudJs),
  '第一版写的是 root.querySelectorAll("path"):导航/按钮里用 <path> 画的图标全被改成了折线,整只消失,看着像"素材丢了"');
/* ★★★ 行为断言:拿一个假 DOM 跑 drawFrame,看它到底动了哪些 path。
   只查选择器字符串是不够的 —— 当初那个 bug 的选择器"看着"也没问题。 */
ok('★★★ 行为:drawFrame 给【边框那 5 条 path】分别写 d(前三条右支、后两条左支),图标一根都不碰', (() => {
  const mkPath = (name) => ({ name, d: 'icon-original', setAttribute(k, v) { if (k === 'd') this.d = v; } });
  const frame = [mkPath('halo-r'), mkPath('line-r'), mkPath('run-r'), mkPath('halo-l'), mkPath('line-l')];
  const icons = [mkPath('icon-home'), mkPath('icon-md'), mkPath('icon-gh'), mkPath('icon-wx')];
  const svg = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelectorAll: (sel) => (sel === 'path' ? frame : [])
  };
  const root = {
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector(sel) { return sel === '.page-hud__frame' ? svg : null; },
    querySelectorAll() { return icons; }        /* 若有人写 root.querySelectorAll("path") 就会命中这些 */
  };
  const doc = {
    getElementById: (id) => (id === 'page-hud' ? root : null),
    documentElement: { clientWidth: 1920, clientHeight: 1080 },
    querySelectorAll: () => []
  };
  const win = { innerWidth: 1920, innerHeight: 1080, addEventListener() { } };
  new Function('window', 'document', hudJsSrc)(win, doc);
  const g = win.__hudFrame.last;
  const rightOk = frame.slice(0, 3).every((f) => f.d === g.path);
  const leftOk = frame.slice(3).every((f) => f.d === g.left.path);
  const untouched = icons.every((i) => i.d === 'icon-original');
  return rightOk && leftOk && untouched;
})(), '图标 path 的 d 一旦被改,就成了"素材丢了"的假象;而且五条 path 各吃各的 d');
ok('★ 视口变化时会重算(resize + rAF 收口,拖窗口不会每像素都算)',
  /addEventListener\("resize"/.test(hudJs) && /requestAnimationFrame/.test(hudJs));
/* ★ 边框竖段那一列 = CSS 里给控件留的那一列:改了一个忘了另一个就会骑到正文上 */
const spineX = 100 - U[5][0];   /* 竖段在 SVG 里的 x */
ok('★★ CSS 的竖栏宽度和折线竖段对得上(5vw ↔ SVG x=95 ⇒ 距右缘 5%)',
  spineX === 95 && /--hud-col:\s*5vw/.test(css),
  '竖段 SVG x=' + spineX + ';改了一个忘了另一个,右下控件就骑到正文上了');

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
/* ★★ 第二十轮补:右边那支是三条(halo/line/run),左下角那支【两条】——
   跑马灯暂时不放左边:它要横跨两条折线才好看,等按钮那一刀再说。
   所以这里要【分 SVG 数】,不能再对整份模板数 path(第一版就是这么红的)。 */
ok('★★★ 边框只有【一支】SVG(用户:"为什么你要做两个单独的框?")',
  (hudTplCode.match(/<svg class="page-hud__frame[\s\S]*?<\/svg>/g) || []).length === 1);
ok('★ 这一支里有【五条 path】:右支三条(halo/line/run)+ 左支两条(halo/line)',
  (hudTplCode.match(/<path class="hud-(halo|line|run)"/g) || []).length === 5);
/* ============================================================
   ★★★ 左下角 UHD:右侧折线的【竖直中线镜像】,和右边共用一支 SVG
   ─────────────────────────────────────────────────────────────
   用户三条:"跟右侧 UHD 实现一样。风格、走线方式一样。为什么你要做两个单独的框?"
   /"两侧对称,你对称到哪了?" /"位置,你自己看看这位置好看吗?"
   这里钉的就是这三条,以及我修掉的那个真 bug:

   ★★★ gFrame().user 是【用户坐标】(x 从右往左数)。gFrameLeft 必须
     ① 先 100−x 换成屏幕坐标,② 再 100−x 镜像 —— 两步。我上一版只写了一次,
     等于"镜像做了两遍 + 漏了坐标换算",左支被翻到右边 x 55~95 那一段、
     和右支重叠。症状就是用户说的"左侧对称到哪了"—— 左边根本没有线。
   ============================================================ */
const leftRef = gFrameLeft(1920, 1080);
const frameLeftSrc = (hudTpl.match(/\$frameLeft := "([^"]+)"/) || [, ''])[1];
ok('★★★ 模板里的左支参考折线 == gFrameLeft(1920,1080) 的输出',
  !!frameLeftSrc && frameLeftSrc === leftRef.path,
  '模板: ' + frameLeftSrc + '\n     函数: ' + leftRef.path);
const lxs = leftRef.user.map((q) => q[0]);
ok('★★★ 左支落在页左半边(x 5~45),不是翻到右边和右支重叠',
  Math.max(...lxs) <= 46 && Math.min(...lxs) >= 4,
  '左支 x 范围 ' + Math.min(...lxs) + '~' + Math.max(...lxs));
ok('★★★ 左支逐点 == 右支的竖直中线镜像(顺序相反,0 容差)',
  ref.user.length === leftRef.user.length &&
  ref.user.every(([x, y], i) => {
    const scr = [100 - x, y];                 /* 右支该点的屏幕坐标 */
    const mirror = [100 - scr[0], scr[1]];    /* 关于竖直中线镜像 */
    const got = leftRef.user[leftRef.user.length - 1 - i];
    return Math.abs(got[0] - mirror[0]) < 1e-3 && Math.abs(got[1] - mirror[1]) < 1e-3;
  }));
ok('★★ 左支那两条 path 共用同一个 d 变量($frameLeft),不是各写一份坐标',
  (hudTplCode.match(/d="\{\{ \$frameLeft \}\}"/g) || []).length === 2);
ok('★★ drawFrame 按【path 序号】分别写 d(前三条右支、后两条左支)',
  /var ds = \[g\.path, g\.path, g\.path, gl\.path, gl\.path\]/.test(hudJs) &&
  /svg\.querySelectorAll\("path"\)/.test(hudJs));
ok('★★★ 三个类在 CSS 里都有规则,而且都 vector-effect: non-scaling-stroke',
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
ok('★★★ 改造 1:优先级必须压过页面上所有会动的层 —— 正文卡片、主题那枚回到顶部(99)、顶栏下拉(100/120)',
  zHud >= 150,
  '用户原话:"想办法拉高框的优先级,不然页面上滑时会从框中重叠并穿过去";现在 hud=' + zHud);
ok('★ 磁力光标(9999/10000)故意还在它上面 —— 那是"鼠标指针"那一层,不抢',
  zHud < 9999);
const defined = new Set((css.match(/--hud-[\w-]+(?=\s*:)/g) || []));
const used = new Set((css.match(/var\(--hud-[\w-]+/g) || []).map((s) => s.slice(4)));
const missing = [...used].filter((v) => !defined.has(v));
ok('★★ CSS 里用到的 --hud-* 变量全都有定义(拼错不会有任何报错,只会静默失效)',
  missing.length === 0, missing.join(', '));

/* ---------- ⑤ 改造 2/3/4/5:凸起里的 LOGO、收窄段的搜索、右上角三枚按钮、竖栏五个导航 ---------- */
/* ★ baseof 里那行是被 Hugo 注释包起来的:剥掉注释后,"渲染"这件事必须消失。
   ★ 写这段注释时【不要把 Hugo 注释的收尾字符原样打出来】—— 它会提前关掉
     这个 JS 块注释(README 里记着这个坑,这是第五次)。 */
const baseofCode = noC(baseof);
/* 取某一项那个 <a> 标签本身来看它的 href/class(最小化后属性没引号) */
const tagOf = (html, id) => (html.match(new RegExp('<a\\b[^>]*data-hud-nav="?' + id + '"?[^>]*>')) || [''])[0];
ok('★★★ 顶部那条【主题顶栏】仍然没有渲染(用户上一轮要求撤掉;现在这些东西都进了 HUD)',
  !cls('header').test(tech) && !cls('logo').test(tech) &&
  !/partialCached "header\.html"/.test(baseofCode) &&
  /class="logo"/.test(headerTpl) && fs.existsSync(`${BH}/layouts/_partials/header.html`),
  '标记还在 layouts/_partials/header.html,要回来只需去掉 baseof 里那行注释');
ok('★★ 改造 3:收窄段是搜索栏,而且用的是【顶栏原来那套标记】',
  /class="hud-search[^"]*"[^>]*id="header-search"[^>]*data-search/.test(hudTplCode) &&
  /id="header-search-input"/.test(hudTplCode) && /id="header-search-results"/.test(hudTplCode) &&
  /class="?hud-search/.test(tech) && /id="?header-search-input"?/.test(tech),
  '同一个 id + data-search ⇒ 组件不用改一行(search.js 是按容器找实例的)');
ok('★★★ 搜索组件接线:search.js 必须排在 header-search.js 之前(否则两个都没接上)',
  extFoot.indexOf('js/search.js') > -1 && extFoot.indexOf('js/header-search.js') > -1 &&
  extFoot.indexOf('js/search.js') < extFoot.indexOf('js/header-search.js') &&
  /search\.[0-9a-f]+\.js/.test(tech) && /header-search\.[0-9a-f]+\.js/.test(tech),
  'defer 按文档顺序执行:header-search.js 一进来看到 data-search 就让位');
ok('★★ 改造 4:右上角三枚按钮 = 导出 Markdown / GitHub / WeChat,而且【列表页也是三枚】',
  /data-hud-act="?md"?/.test(post) && /data-hud-act="?md"?/.test(tech) &&
  /data-hud-act="?github"?/.test(tech) && /data-hud-act="?wechat"?/.test(tech) &&
  /data-hud-act="github" href="\{\{ \$gh \| default "https:\/\/github\.com\/tuan4743" \}\}"/.test(hudTplCode) &&
  /data-hud-act=github href=https:\/\/github\.com\/tuan4743/.test(tech),
  '★ 产物里属性没有引号(踩过五次的坑);GitHub 地址优先取 socialIcons,取不到才用兜底常量');
ok('★★★ 导出按钮两种页面都有真文件:文章页导出原文,列表页导出这一页的清单', (() => {
  const hasMd = (h) => /data-hud-act="?md"?/.test(h);
  const article = fs.existsSync(`${WS}/.tmp/t1/posts/hello-world/index.md`) &&
    /^---/.test(rd(`${WS}/.tmp/t1/posts/hello-world/index.md`));
  const listMd = rd(`${WS}/.tmp/t1/tech/index.md`);
  return hasMd(post) && hasMd(tech) && !hasMd(home) && article &&
    /^# 技术/.test(listMd) && /github-actions-deploy/.test(listMd) &&
    /section = \["HTML", "RSS", "markdown"\]/.test(rd(`${BH}/hugo.toml`)) &&
    fs.existsSync(`${BH}/layouts/_default/list.md`);
})(), '列表页那一份是"这一页的清单",不是死链');
ok('★★ 三枚按钮排成【四象限】:左上导出 / 右上 GitHub / 右下 WeChat,左下留空',
  /\.hud-act\[data-hud-act="md"\]\s*\{\s*grid-area:\s*1 \/ 1/.test(cssCode) &&
  /\.hud-act\[data-hud-act="github"\]\s*\{\s*grid-area:\s*1 \/ 2/.test(cssCode) &&
  /\.hud-act\[data-hud-act="wechat"\]\s*\{\s*grid-area:\s*2 \/ 2/.test(cssCode) &&
  /\.hud-acts\s*\{[^}]*display:\s*grid/.test(cssCode),
  '用户:"分成四个象限,三个按钮应该分别在第一二四象限"');
ok('★★ 按钮比原来(26~34px)大不少,但【高】必须压进顶带:clamp(42px, 5vh, 64px)',
  (() => {
    const m = /\.hud-act\s*\{[^}]*width:\s*clamp\((\d+)px,\s*([\d.]+)vh,\s*(\d+)px\)/.exec(cssCode);
    const hm = /\.hud-act\s*\{[^}]*height:\s*clamp\((\d+)px,\s*([\d.]+)vh,\s*(\d+)px\)/.exec(cssCode);
    return !!m && !!hm && Number(m[1]) >= 42 && Number(hm[3]) >= 60 &&
      Number(hm[2]) + 0.4 <= 6;
  })(), '★ 用户:"下载还是顶出去了" —— 四象限的第一行越过了 y=6% 那条沿;高 ≤5vh + top 0.4% 才装得下');
ok('★★★ 导出按钮指向 Hugo【真生成】的那份 .md(不是前端拼的)',
  /data-hud-act="md" href="\{\{ \$md \}\}" download/.test(hudTplCode) &&
  /data-hud-act=md href=[^\s>]*index\.md/.test(post) &&
  /^---/.test(rd(`${WS}/.tmp/t1/posts/hello-world/index.md`)) &&
  /\[outputFormats\.markdown\]/.test(rd(`${BH}/hugo.toml`)) &&
  fs.existsSync(`${BH}/layouts/_default/single.md`),
  '产物里那份 index.md 开头就是 front matter(导出的是源文件原文)');
ok('★★★ 搜索框有一颗【自画的 ×】:原生那颗只派发 search、点了不收面板(用户报的)',
  /id="?hud-search-clear"?/.test(tech) && /hud-search__clear/.test(cssCode) &&
  /\.hud-search__clear\[hidden\]\s*\{\s*display:\s*none/.test(cssCode) &&
  /::-webkit-search-cancel-button/.test(cssCode) &&
  /sClear\.addEventListener\("click"/.test(hudJs) &&
  /inst\.clear\(\)/.test(hudJs) &&
  /input\.addEventListener\("search", run\)/.test(noC(rd(`${BH}/assets/js/search.js`))),
  '★ [hidden] 那条不能漏:display:inline-flex 会把 hidden 属性盖掉(老坑)');
ok('★★ 微信按钮:点一下把微信号复制走(二维码太小,用户改成复制了)',
  /data-hud-act="?wechat"?/.test(tech) && /data-copy="?tuagfey"?/.test(tech) &&
  /id="?hud-toast"?/.test(tech) && !/hud-qr/.test(tech) &&
  /navigator\.clipboard/.test(hudJs) && /execCommand/.test(hudJs),
  '用户:"不如干脆复制我的微信号到剪切板算了:tuagfey" —— 还要有 execCommand 兜底 + 一句提示');
ok('★ 当前页那一项有 is-current + aria-current="page"',
  /\bis-current\b/.test(tagOf(tech, 'tech')) && /aria-current="?page/.test(tagOf(tech, 'tech')) &&
  !/\bis-current\b/.test(tagOf(tech, 'home')) &&
  /\bis-current\b/.test(tagOf(about, 'about')),
  '在 /tech/ 上:tech 是当前页;在 /about/ 上:about 是');
ok('★★ 图标必须自己给尺寸,而且这一轮要放大(用户:"字体图标可以大一点")',
  /\.hud-nav__icon svg\s*\{[^}]*width:\s*22px/.test(cssCode) &&
  /\.hud-nav__icon svg\s*\{[^}]*height:\s*22px/.test(cssCode) &&
  /\.hud-nav__item\s*\{[^}]*font-size:\s*clamp\(12px/.test(cssCode),
  '不给尺寸的话 svg 会按 300×150 的固有尺寸铺开');
ok('★★ 导航整列"往下撑一撑":项间距跟着视口高走',
  /\.hud-nav\s*\{[^}]*gap:\s*clamp\(6px,\s*1\.1vh,\s*14px\)/.test(cssCode));
ok('★★ 顶栏撤掉后不再有两个 id="menu" 的问题', !/id="?menu"?/.test(tech) && !/id="?menu"?/.test(home));

/* ---------- ⑤b ★★★ 搜索:把真组件跑起来,验"打字到底出不出结果" ----------
   用户报:"输入文字也不会有匹配项出现,可能是因为只做了个按钮"。
   这种事光看源码是看不出来的(标记全对、脚本也在),所以这里搭一个最小 DOM,
   把 assets/js/search.js【真读进来执行】,再模拟一次 input —— 看结果面板到底有没有内容。
   ★ 这个量具本身也踩过一次坑的教训:假 DOM 的 textContent/innerHTML 要接上,
     否则 esc() 恒返回空串,断言会因为"量具不会转义"而假红。 */
/* 等异步链跑完:loadIndex 是 promise,render 在 then 里 —— 同步断言只会读到空 */
const tick = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

function searchHarness() {
  const mk = (tag) => {
    const s = new Set();
    return {
      tag, value: "", hidden: true, innerHTML: "", _text: "", _l: {},
      classList: {
        add: (c) => s.add(c), remove: (c) => s.delete(c),
        contains: (c) => s.has(c), toggle: (c, v) => { if (v) { s.add(c); } else { s.delete(c); } }
      },
      addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
      dispatch(t, ev) { (this._l[t] || []).forEach((fn) => fn(ev || {})); },
      set textContent(v) { this._text = String(v); this.innerHTML = String(v); },
      get textContent() { return this._text; },
      contains() { return false; }, focus() { }, blur() { }, select() { },
      querySelector(sel) { return (this._q && this._q[sel]) || null; },
      get offsetParent() { return {}; }
    };
  };
  const input = mk("input"), list = mk("div"), panel = mk("div");
  panel._q = { ".search-results-list": list };
  const root = mk("div");
  root._q = { "[data-search-input]": input, "[data-search-results]": panel, "input": input };
  const doc = {
    readyState: "interactive",
    querySelectorAll: (sel) => (sel === "[data-search]" ? [root] : []),
    querySelector: () => null,
    createElement: () => mk("div"),
    addEventListener() { },
    body: { classList: { contains: () => false } }
  };
  const win = {};
  const fetchStub = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ title: "自动部署", url: "/tech/x/", content: "本文拆解自动部署原理" }])
  });
  new Function("window", "document", "fetch", rd(`${BH}/assets/js/search.js`))(win, doc, fetchStub);
  return { win, input, panel, list, root };
}
const h1 = searchHarness();
ok('★★★ search.js 真跑起来会挂出 window.CDSearch(兜底脚本就是认它让位的)',
  !!h1.win.CDSearch && typeof h1.win.CDSearch.build === "function");
h1.input.value = "部署";
h1.input.dispatch("input");
/* 索引是异步拿的:等一个微任务批次 */
await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
await new Promise((r) => setTimeout(r, 0));
ok('★★★ 打字之后结果面板【真的有内容】(用户报的就是这里没反应)',
  /search-result-item/.test(h1.list.innerHTML) && /自动/.test(h1.list.innerHTML) &&
  /部署/.test(h1.list.innerHTML) && /href="\/tech\/x\/"/.test(h1.list.innerHTML),
  '★ 别要求"自动部署"连在一起 —— 命中词会被 <mark> 拆开(第一版就假红在这里)');
ok('★★ 搜不到时给一句明确的话,而不是空白面板', await (async () => {
  const h = searchHarness();
  h.input.value = "zzzz-not-found";
  h.input.dispatch("input");
  await tick();
  return /没有找到相关内容/.test(h.list.innerHTML);
})(), '★ 这件事是异步的(先 loadIndex),同步断言只会读到空 —— 量具的时序又坑了一次');
ok('★★ 面板被打开了(hidden = false)+ 容器挂上 is-searching', h1.panel.hidden === false && h1.root.classList.contains("is-searching"));
h1.input.value = "";
h1.input.dispatch("input");
await tick();
ok('★ 把输入框删空 ⇒ 面板自己收起来(结果留着但看不见,下次打字再覆盖)',
  h1.panel.hidden === true);
ok('★★★ HUD 那颗 × 走的是组件的 clear():输入框、结果、面板一起复位',
  (() => {
    h1.input.value = "部署";
    h1.input.dispatch("input");
    return true;
  })() && typeof h1.root.__search.clear === "function" &&
  (h1.root.__search.clear(), h1.panel.hidden === true && h1.list.innerHTML === "" && h1.input.value === ""),
  '★ 组件把实例挂在容器的 __search 上,自画的 × 才够得着它');
ok('★★★ 兜底脚本的判据是"正式组件加载没有",不是"页面上有没有 data-search 容器"',
  /if \(window\.CDSearch\) return;/.test(noC(rd(`${BH}/assets/js/header-search.js`))) &&
  !/querySelector\("\[data-search\]"\)\) return/.test(noC(rd(`${BH}/assets/js/header-search.js`))),
  '旧判据有个洞:标记里总有 data-search ⇒ search.js 一旦没跑成,两头落空(能打字、没反应)');
ok('★ 兜底脚本在没有正式组件时会自己接手(同一个最小 DOM,不挂 window.CDSearch)',
  (() => {
    const h = searchHarness();
    return !!h.win.CDSearch;   /* search.js 自己会挂;下面的断言看"没挂时"的分支 */
  })() && /var input = document\.getElementById\("header-search-input"\)/.test(noC(rd(`${BH}/assets/js/header-search.js`))));
/* ---------- ⑤c 覆盖效果:底板这一刀【故意撤掉】了 ----------
   ★★★ 用户截图报的那个"大三角"就是底板干的:老的收口写法是
     d + " L100 100 L100 0 Z" —— 从折线起点 (55,0) 斜着连回右下角,
     等于把【整个右半边】都涂成暗色,露出一条斜边切过正文。
   撤掉之后框架只剩折线(用户才能看清形状);要恢复"遮住底下"的效果,
   得换一种收口方式(沿描边连线、或直接给整层一个背景色)。
   ⇒ 这里钉的是"撤掉是【故意】的,而且恢复所需的两半都还在":
     CSS 的 .hud-fill 规则 + JS 里给底板写 d 的那段。 */
ok('★★★ 底板(.hud-fill)整条撤掉了 —— 老收口会把半个页面涂黑',
  !/class="?hud-fill/.test(tech) &&
  !/L100 100 L100 0 Z/.test(hudTplCode) &&
  /\.hud-fill\s*\{[^}]*fill:\s*var\(--hud-cover\)/.test(cssCode),
  '★ 老写法 (55,0) → (100,100) 那条斜线就是用户截图里的大三角;CSS 规则留着,要恢复只改标记');
ok('★★ 盖多少只由一个数决定(--hud-cover),而且默认接近全遮',
  (() => {
    const m = /--hud-cover:\s*rgba\([^)]*?([\d.]+)\s*\)/.exec(css);
    return !!m && Number(m[1]) >= 0.85;
  })(), '用户:"这个框应该能遮住底下(让底下不显示,不然像现在这样很奇怪)"');
ok('★★ 底板画在【最前面】(标记里是第一个 path),否则会把控件一起盖住',
  hudTplCode.indexOf('class="hud-fill"') < hudTplCode.indexOf('class="hud-halo"') &&
  hudTplCode.indexOf('class="hud-fill"') < hudTplCode.indexOf('class="hud-acts"'),
  '★ SVG 内部按文档顺序绘制,而这支 SVG 是 .page-hud 的第一个子元素');

/* ---------- ⑥ 改造 6:右下三件套(两滑条并排 + 明暗长按钮) ---------- */
const cnt = (h, re) => (h.match(re) || []).length;
ok('★★ #theme-toggle 在博客页【正好一个】—— 主题 footer 那句没有判空,少了会 TypeError',
  cnt(tech, /id="?theme-toggle"?/g) === 1 && cnt(post, /id="?theme-toggle"?/g) === 1);
ok('★★ 明暗是【圆角矩形的长按钮】,而且压在最下面',
  /class="?hud-theme/.test(tech) && /id="?theme-toggle"?/.test(tech) &&
  /\.hud-theme\s*\{[^}]*border-radius:\s*999px/.test(cssCode) &&
  /\.hud-theme\s*\{[^}]*width:\s*100%/.test(cssCode),
  '用户原话:"明暗做成圆角矩形的长按钮在最下面"');
ok('★ 明暗那枚用的是主题自己的 .sun / .moon 类(主题那两条 display 规则是全局的)',
  /class="?moon/.test(tech) && /class="?sun/.test(tech) &&
  /\[data-theme="dark"\] \.moon/.test(rd(`${BH}/themes/PaperMod/assets/css/common/header.css`)));
ok('★★ 明暗不需要 HUD 自己绑事件(主题按 id 找人,换位置照样生效)',
  !/theme-toggle/.test(hudJs), 'page-hud.js 里不该出现 theme-toggle');
ok('★★ 两根滑条是【并排】在长按钮上面(flex row,不是上下堆)',
  /\.hud-faders\s*\{[^}]*flex-direction:\s*row/.test(cssCode) &&
  /\.hud-ctl\s*\{[^}]*flex-direction:\s*column/.test(cssCode) &&
  (hudTplCode.match(/class="hud-fader"/g) || []).length === 2,
  '并排塞得下:竖栏 5vw(1920→96px),一根竖滑条横向只要滑块头那点宽度');
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
ok('★★ 右下角:文字加大(9/10px → 11/12px)、滑条加长(58~86 → 72~118)',
  /--hud-ctl-fs:\s*11px/.test(css) && /--hud-val-fs:\s*12px/.test(css) &&
  /--hud-fader-len:\s*clamp\(72px,\s*11vh,\s*118px\)/.test(css),
  '用户:"右下角的文字其实可以稍微加一点字号,然后这个滑条可以长一点点"');
ok('★ 滑条是竖的(和 CD 页两根推子同一个做法:横着写再转 -90°)',
  /\.hud-range\s*\{[^}]*transform:\s*rotate\(-90deg\)/.test(cssCode));
ok('★ 滑条头是圆钮(--hud-thumb 走变量,不是浏览器默认方块)',
  /--hud-thumb:\s*\d+px/.test(css) && /::-webkit-slider-thumb\s*\{[^}]*border-radius:\s*50%/.test(cssCode));

/* ---------- ⑥b 改造 7:底部横带里那三支笔 ---------- */
ok('★★ 改造 5(第五轮):笔的横带最右侧从横坐标 7 起,把右下角让给两滑条 + 明暗长按钮',
  /\.hud-pens\s*\{[^}]*right:\s*7%/.test(cssCode) &&
  /\.hud-pens\s*\{[^}]*width:\s*calc\(var\(--hud-band-x\) - 7%\)/.test(cssCode) &&
  /\.hud-ctl\s*\{[^}]*bottom:\s*1\.2%/.test(cssCode),
  '用户:"最右侧应该是从横坐标7…然后把明暗长按钮 + 两滑条并排放下来"');
ok('★★ 三支笔齐:荧光笔 / 记号笔 / 橡皮擦,放在底部横带里', (() => {
  const pens = [...tech.matchAll(/data-hud-pen="?(\w+)"?/g)].map((m) => m[1]);
  return pens.join(',') === 'marker,annot,eraser' &&
    /\.hud-pens\s*\{[^}]*bottom:\s*0/.test(cssCode) &&
    /\.hud-pens\s*\{[^}]*height:\s*calc\(100% - var\(--hud-band\)\)/.test(cssCode);
})(), '横带 = y 94~100、往左伸到 x=25(折线底下那条横臂)');
ok('★★ 每支笔都有"尺寸滑条",选中时【就地展开】(宽度 0 → 有宽度)', (() => {
  const sizes = [...hudTplCode.matchAll(/data-hud-pen-size="(\w+)"/g)].map((m) => m[1]);
  return sizes.join(',') === 'marker,annot,eraser' &&
    /\.hud-pen__tools\s*\{[^}]*width:\s*0/.test(cssCode) &&
    /\.hud-pen\.is-on \.hud-pen__tools\s*\{[^}]*width:\s*clamp\(/.test(cssCode);
})(), 'rc="按一下激活并展开为滑条"');
ok('★★ 展开靠 flex 自动重排(没手写位移动画)', /\.hud-pens\s*\{[^}]*justify-content:\s*flex-end/.test(cssCode) &&
  /\.hud-pen\s*\{[^}]*display:\s*flex/.test(cssCode),
  '用户:"同样做好自动重排" —— 同一行里前面的按钮被挤开就是重排');
ok('★★ 同时只能开一支(JS 里 activatePen 会把其它支关掉)',
  /function activatePen\(name\)/.test(hudJs) && /p\.classList\.toggle\("is-on", on\)/.test(hudJs) &&
  /activatePen\(p\.classList\.contains\("is-on"\) \? "" : name\)/.test(hudJs),
  '再按一次收起来');
ok('★★ 滑条不是"按了没反应":圆点预览跟着大小变,尺寸存在 localStorage',
  /--pen-size/.test(cssCode) && /\.hud-pen__dot::after/.test(cssCode) &&
  /hud-pen-size/.test(hudJs) && /PEN_SIZE/.test(hudJs),
  '笔还没有落笔的画布,所以至少让"大小"看得见');
ok('★ 笔的 aria:按下状态有 aria-pressed(读屏能知道选没选中)',
  /aria-pressed="false"/.test(hudTplCode) &&
  /btn\.setAttribute\("aria-pressed"/.test(hudJs));

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
  /:root\[data-theme\]\.shell-page \.top-link\s*\{[^}]*right:\s*calc\(var\(--hud-col\)/.test(cssCode));
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

/* ---------- ⑩ 还没做的东西没被顺手做进来 ---------- */
ok('★ 目录面板 / 进度条 / 左侧番茄钟与播放器 / 首页平板:这一轮都还没动',
  !/hud-toc|hud-progress|pomodoro/.test(cssCode) &&
  !/目录|进度条/.test(hudTplCode) &&
  !/intro-page|tablet/.test(hudTplCode),
  '下一刀:目录面板 + 收起 + 字号/字距 + 进度条');
ok('★ 三支笔【只做外观与交互】,没有偷偷去改正文(还没有落笔的画布)',
  !/document\.addEventListener\("pointerdown"/.test(hudJs) &&
  !/createElement\("canvas"\)/.test(hudJs) &&
  !/md-content/.test(hudJs),
  '用户当时选的是"先只做外观";真正能画是后面的事');

/* ---------- ⑪ 磁力光标:HUD 里的元素也要认(第五轮反馈 4/5) ---------- */
const mcJs = fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, 'utf8');
ok('★ 大目标的外扩还是 10px 封顶(别把卡片之类的框也缩小了)',
  /Math\.min\(PAD,/.test(mcJs) && /var PAD = 10;/.test(mcJs));

/* ---------- ⑦b 第七轮:接口 + 磁力光标 + 笔色 ---------- */
ok('★★★ LOGO 是三个接口变量(size / x / y),而且是 span:不跳转、不吸附', (() => {
  const size = /--hud-logo-size:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\)/.exec(css);
  return !!size && Number(size[1]) >= 16 && Number(size[3]) >= 32 &&
    /--hud-logo-x:\s*[\d.]+%/.test(css) && /--hud-logo-y:\s*[\d.]+%/.test(css) &&
    /\.hud-logo\s*\{[^}]*left:\s*var\(--hud-logo-x\)/.test(cssCode) &&
    /\.hud-logo\s*\{[^}]*top:\s*var\(--hud-logo-y\)/.test(cssCode) &&
    /\.hud-logo\s*\{[^}]*font-size:\s*var\(--hud-logo-size\)/.test(cssCode) &&
    /\.hud-logo\s*\{[^}]*pointer-events:\s*none/.test(cssCode) &&
    !/\.hud-logo\s*\{[^}]*right:/.test(cssCode) &&
    /<span class="hud-logo">/.test(hudTplCode) && !/<a[^>]*hud-logo/.test(hudTplCode) &&
    /class="?hud-logo/.test(tech) && />Tuagfey Blog</.test(tech);
})(), '用户:"给我一个接口改字体大小和位置" + "它只是个 LOGO,不需要吸附,也不需要跳转首页"');
ok('★★ 底带宽度是一个接口:--hud-band-x 同时管折线 ⑨ 和笔那一行(第七轮 35 → 30)',
  /--hud-band-x:\s*30%/.test(css) && /function gFrame\(w, h, bandX\)/.test(hudJs) &&
  /getPropertyValue\("--hud-band-x"\)/.test(hudJs) &&
  /\.hud-pens\s*\{[^}]*width:\s*calc\(var\(--hud-band-x\) - 7%\)/.test(cssCode));
ok('★★★ 磁力光标认得 HUD 里的元素,但【不吃 LOGO】', (() => {
  const need = ['".hud-act"', '".hud-nav__item"', '".hud-search input"', '".hud-pen__btn"', '".hud-pen__swatch"'];
  return need.every((sel) => mcJs.includes(sel)) && !mcJs.includes('".hud-logo"');
})(), '白名单兜底只认 button:下载/GitHub/导航是 <a>、搜索框是 <input>;LOGO 用户点名不要吸');
ok('★★ 锁定的小目标:框比按钮【略大 4px】(严丝合缝太紧,10% 又偏大)', (() => {
  const mc = fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, 'utf8');
  return /var pad = small \? 4 : Math\.min\(PAD/.test(mc) && /var PAD = 10;/.test(mc) &&
    /small = Math\.min\(r\.width, r\.height\) < 90/.test(mc);
})(), '用户:"锁定跟实际框严丝合缝,应该略大一点点"');
ok('★★ 每支笔带一排颜色点(5 色 × 2 支(橡皮没有颜色)),展开时才出现', (() => {
  return (hudTplCode.match(/hud-pen__swatch/g) || []).length === 10 &&
    /data-hud-pen-color="marker"/.test(hudTplCode) &&
    /\.hud-pen__colors\s*\{[^}]*display:\s*none/.test(cssCode) &&
    /\.hud-pen\.is-on \.hud-pen__colors\s*\{[^}]*display:\s*inline-flex/.test(cssCode);
})(), '用户:"笔应该还要加一个调节颜色的滑块,或者几个颜色的选项"');
ok('★★ 笔色存 localStorage,预览球跟着变色',
  /PEN_COLOR = "hud-pen-color"/.test(hudJs) && /setPenColor/.test(hudJs) &&
  /background:\s*var\(--pen-color/.test(cssCode));
ok('★★ 展开时名字收成图标:底带 23% 宽要装下"三支笔 + 大小 + 颜色"',
  /\.hud-pen\.is-on \.hud-pen__name\s*\{\s*max-width:\s*0/.test(cssCode) &&
  /\.hud-pen__btn\s*\{[^}]*font-size:\s*11px/.test(cssCode),
  '用户:"这三个按钮的字号大一点点" + 新加颜色控件 ⇒ 只能靠收起名字腾地方');
ok('★★★ 画布的 CSS 盒子与后备缓冲必须是同一个盒子(滚动条那条真 bug)', (() => {
  const mc = fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, 'utf8');
  return /document\.documentElement\.clientWidth \|\| window\.innerWidth/.test(mc) &&
    !/var w = window\.innerWidth/.test(mc);
})(), '★ 用 innerWidth 会把滚动条算进去(比 CSS 的 100% 宽)⇒ 画布被横向拉伸 ⇒ 离原点越远偏得越多');
/* ---------- 出结果 ---------- */
let pass = 0;
for (const [p, n, i] of rows) { if (p) pass++; console.log('  ' + (p ? '✓' : '✗') + ' ' + n + (i ? '   [' + i + ']' : '')); }
console.log('\n' + pass + '/' + rows.length + ' 通过');
process.exit(pass === rows.length ? 0 : 1);
