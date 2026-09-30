/* ============================================================
   启动页 —— 输入 tuagfey.com 时落地的第一屏
   ─────────────────────────────────────────────────────────────
   用户:"在输入 https://tuagfey.com 的时候,不要直接跳转到首页,而是跳转到一个启动页。
   启动页很干净,屏幕中一个动态的 ASCII 码组成的大眼睛,瞳孔跟人,眼睛下一句话:你好。
   下面两个选项:'你是谁?' 和 '别废话'。设定中这个大眼睛就是方舟总控 AI,假设用户不知道,
   那就会选择'你是谁?',接着跳转至首页,正好接上了设定中'人格未及时稳定'。
   否则则认为用户不是第一次看博客页,则跳转到技术页。"

   这一份钉的是【路由】和【这一屏自己那几个元素】。
   ASCII 眼睛的几何靠 .tmp/eye4.mjs 与 CDP 探针量(不在单测里跑浏览器)。

   ★★ 搬家:启动页占住站点根之后,原来住在根上的"仿真屏幕"搬到了 /home/。
      于是三页的关系变成:
        /       → 一跳 → /start/         (layouts/home.html)
        /start/ → 两个按钮 → /home/ 或 /tech/   (layouts/start/list.html)
        /home/  → 仿真屏幕本身            (layouts/home/list.html)
      这里最值钱的一条是【不会来回跳】:每一跳都只在"确实站在根上"时才发生。
   ============================================================ */

import fs from 'node:fs';

const WS = 'C:/Users/hp/Desktop/deep-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);
const rd = (p) => fs.readFileSync(p, 'utf8');
const noC = (s) => String(s)
  .replace(/\{\{\/\*[\s\S]*?\*\/\}\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const rootTpl = rd(`${BH}/layouts/home.html`);
const startTpl = rd(`${BH}/layouts/start/list.html`);
const homeTpl = rd(`${BH}/layouts/home/list.html`);
const startCss = noC(startTpl);
/* ★★★ 眼睛的代码【搬出了模板】,现在住在两个外部脚本里(第二轮改的):
     · assets/js/ascii-eye.js —— 逐帧几何/瞳孔/数据流(首页也要同一只眼睛,
       两处各写一份迟早会漂:这只眼睛的几何被来回修了七八轮);
     · assets/js/start-wire.js —— 启动页自己的接线(出场时间线 + 按住确认)。
   ⇒ 断言的"源码"就是这两个文件;但【链接方式】那几条仍然要看模板与构建产物 ——
     这两个脚本必须是【外部 + defer】,写回内联会踩两个坑(见下面那两条)。 */
const eyeJs = noC(rd(`${BH}/assets/js/ascii-eye.js`));
const wireJs = noC(rd(`${BH}/assets/js/start-wire.js`));
const startJs = eyeJs + '\n' + wireJs;
const builtRoot = rd(`${WS}/.tmp/t1/index.html`);
const builtStart = rd(`${WS}/.tmp/t1/start/index.html`);
const builtHome = rd(`${WS}/.tmp/t1/home/index.html`);
/* ---------- ① 站点根:只有一跳 ---------- */
ok('★★ 站点根有自己的模板(layouts/home.html)',
  /location\.replace\(/.test(rootTpl),
  'PaperMod 没有 home.html,Hugo 会一路退到主题的 list.html —— 那样根上长的是主题那套个人资料页');
ok('★★ 站点根真的把浏览器送到 /start/',
  /location\.replace\('\/start\/'\)|location\.replace\("\/start\/"\)/.test(builtRoot),
  'GitHub Pages 是静态托管,没有服务端重定向 —— 这一跳只能在客户端做');
ok('★★ 站点根上【没有】平板机器,也没有主题那套个人资料页',
  !/tablet__/.test(builtRoot) && !/first-entry/.test(builtRoot),
  '根页现在只该是个重定向壳');
ok('★ 站点根被标了 noindex,canonical 指到 /start/',
  /name=robots content="noindex/.test(builtRoot) && /rel=canonical href=\S*\/start\//.test(builtRoot),
  '它没有任何内容,只是启动页的影子 —— 别让搜索引擎收两份');

/* ---------- ② 不会来回跳(这一条是这一批的核心风险) ---------- */
ok('★★★ 每一跳都只在"确实站在根上"时才发生',
  /pathname\.replace\(\/\\\/\+\$\/, ?''\) \|\| ?'\/'/.test(noC(rootTpl)) &&
  /p === '\/' \|\| p === '\/index\.html'/.test(noC(rootTpl)),
  '无脑 replace 会让 /start/ 也往 /start/ 跳');
ok('★★★ 启动页自己【不含】任何跳根或跳 /start/ 的代码',
  !/location\.replace/.test(startJs) && !/location\.href\s*=\s*['"]\//.test(startJs),
  '启动页只往外走(/home/ 或 /tech/),不往根走 ⇒ 逻辑上不可能成环');
ok('★★★ 启动页两个按钮的去向',
  /href="\/home\/"[^>]*data-start-go="who"/.test(startTpl) &&
  /href="\/tech\/"[^>]*data-start-go="skip"/.test(startTpl) &&
  /你是谁\?/.test(startTpl) && /别废话/.test(startTpl),
  '"你是谁?" → /home/("人格未稳定"那一段在首页);"别废话" → /tech/(老读者直接进站)');
ok('★★ 平板主界面上那枚"主页"图标指向 /home/,不再指根',
  /identifier = "home"[\s\S]{0,220}?url = "\/home\/"/.test(rd(`${BH}/hugo.toml`)),
  '它要是还指 "/",点一下就被弹去启动页 —— 那才是真正的死循环');
ok('★★ 仿真屏幕搬到了 /home/,而且 body 上多了 home-page 标记',
  /class="intro-page home-page"/.test(homeTpl) && /tablet__/.test(builtHome),
  '过场平移与背景那几条 CSS 挂在这两个类上');

/* ---------- ③ 那一屏自己的东西 ---------- */
ok('★ 只有一个 <pre> 装眼睛(id=start-eye)',
  (builtStart.match(/id=start-eye/g) || []).length === 1);
ok('★ 屏幕上就一句问句,而且是浮着的(没有输入框、没有面板)',
  /<p class="?start-say"?>你好\?<\/p>/.test(builtStart) &&
  !/<input/.test(builtStart) && !/<textarea/.test(builtStart) &&
  /\.start-say\s*\{[^}]*letter-spacing/.test(startCss),
  '用户:"启动页不说话,整体就那一句问句:你好?一直显示,去掉文本框,文字是直接浮在屏幕上的"');
ok('★★ 这一屏不加载站内其它外壳(干净)',
  !/page-hud/.test(builtStart) && !/shell-page/.test(builtStart) &&
  !/page-cosmos/.test(builtStart) && !/proj-node/.test(builtStart),
  '底带 / 星云背景 / 投影 / ECHO 一个都不该在这一页上');

/* ---------- ④ 眼睛:跟人 + 眨眼 ---------- */
/* ★★ 断言分【模板源码】与【构建产物】两路,别混:
   模板里是 'mousemove' / function fromPointer / gz.x += …;
   构建产物被压缩过 —— 事件名保留(字符串),但函数名与变量名都改了。
   第一版把两者写在同一条里,于是这条永远红(模板过不了压缩后的那半条)。 */
ok('★★★ 瞳孔跟鼠标:鼠标位置 → 归一化视线 → 平滑趋近',
  /* ★ 眼睛搬进共用模块之后,"跟鼠标"这件事在 ascii-eye.js 里 ——
     构建产物里已经没有这段内联脚本了,所以两半都看源码。
     (原来那半看 builtStart,是因为它当时还是内联的。) */
  /addEventListener\(\s*["']mousemove["']/.test(eyeJs) &&
  /function fromPointer/.test(eyeJs) &&
  /e\.clientX/.test(eyeJs) && /e\.clientY/.test(eyeJs) &&
  /gz\.x \+= \(tx - gz\.x\) \* kk;/.test(eyeJs),
  '用户:"瞳孔跟人"');
ok('★★★ 视线用【像素】算,不玩归一化',
  /EYE_HY = HALF_W \/ EYE_AR/.test(startJs) && /function lidAt\(px, open, up\)/.test(startJs),
  '归一化那版把圆虹膜压成椭圆,眼睛画出来是圆的而不是细长的(踩过)');
ok('★★★ 虹膜按【开孔高度】取比例,不按眼半径',
  /IRIS_R = EYE_HY \* LID_UP \* LID_FIT \* IRIS_OF_LID/.test(startJs),
  '★★ 按眼半径取时开孔永远被虹膜塞满 —— 画出来是一团圆盘/曼陀罗,不是眼睛(连试 6 组参数都是)');
ok('★★ 有眨眼,而且按随机间隔',
  /function blink\(/.test(startJs) && /nextBlink = now \+ 2500 \+ Math\.random\(\) \* 3000/.test(startJs),
  '完全不动的大眼睛会像一张图');
ok('★★ 尊重 prefers-reduced-motion(系统关了动效就不眨、不漂)',
  /prefers-reduced-motion: reduce/.test(startJs) && /if \(blinkOff\) return 1;/.test(startJs),
  '同时把结果暴露在 __startEye.reduced 上,探针才分得清"没眨眼"和"被系统关了"');
ok('★★ 眼睛与"你好?"之间没有文本框,按钮是纯文字 + 下划线',
  /\.start-act a\s*\{[^}]*border-bottom/.test(startCss) &&
  !/\.start-act a\s*\{[^}]*background/.test(startCss));
ok('★ 网格行数按眼睑峰值反推(带一个量出来的补偿系数)',
  /ROWS = Math\.max\(12, Math\.round\(EYE_HY \* LID_UP \* LID_FIT \* 2 \/ CELL_H \* 1\.\d+\)\)/.test(startJs),
  '不带补偿的话网格比开孔矮,最上/最下几行被切平 ⇒ 眼睛变成两头削平的椭圆(实测量到 3.27 而设定是 2.35)');

/* ---------- ④a 第二轮:眼睛抽成共用模块(启动页 + 首页同一只)---------- */
/* ★★★ 这一条是第二轮最值钱的一条:
   首页也要这只眼睛,两处各写一份的话,这只被来回修了七八轮的几何迟早会漂 ——
   而漂了看不出来(两页不会同时出现在一个屏幕上)。 */
ok('★★★ 眼睛是【共用模块】,启动页和首页加载的是同一份',
  /resources\.Get "js\/ascii-eye\.js"/.test(startTpl) &&
  /resources\.Get "js\/ascii-eye\.js"/.test(homeTpl) &&
  /window\.AsciiEye = \{ create: create/.test(eyeJs) &&
  /ascii-eye\.[0-9a-f]+\.js/.test(builtStart) && /ascii-eye\.[0-9a-f]+\.js/.test(builtHome),
  '两页各写一份 = 迟早漂,而且漂了看不出来');
ok('★★★ 眼睛与接线的脚本必须是【外部 + defer】,不能是内联',
  /<script defer src="\{\{ \$eye\.RelPermalink \}\}"><\/script>/.test(startTpl) &&
  /<script defer src="\{\{ \$wire\.RelPermalink \}\}"><\/script>/.test(startTpl) &&
  !/<script>\s*\(function \(\) \{\s*var eyeEl/.test(startTpl),
  '★★ 内联经典脚本在解析期执行,而 defer 模块要等解析完才跑 ⇒ window.AsciiEye 还是 undefined,' +
  '守卫静默退出:没有异常、没有日志,页面上就是一双不动的眼睛(踩过)');
ok('★★★ 内联脚本的 JS 压缩必须关掉(hugo.toml)',
  /disableJS\s*=\s*true/.test(rd(`${BH}/hugo.toml`)),
  '★★ 压缩器会把内层函数的局部变量和外层 IIFE 的压成同一个名字:' +
  'create(eyeEl, …) 拿到一个布尔值 ⇒ 眼睛建不起来,而且控制台一声不响(踩过)');
ok('★★★ 渲染循环外面包了 try/catch(rAF 里抛异常是静默的)',
  /function frameSafe\(now\)/.test(eyeJs) && /window\.__eyeError = String/.test(eyeJs) &&
  /requestAnimationFrame\(frameSafe\)/.test(eyeJs) && !/requestAnimationFrame\(frame\);/.test(eyeJs),
  'rAF 回调抛异常时控制台可能一声不响,表现只是"眼睛不动" —— 这个出口就是为那种时候留的');

/* ---------- ④b 用户第二轮的四条:光标 / 眼眶 / 竖瞳 / 出场顺序 ---------- */
ok('★★★ 这一页挂上了磁力光标脚本(否则整页没有鼠标指针)',
  /resources\.Get "js\/magnetic-cursor\.js"/.test(startTpl) &&
  /magnetic-cursor\.[0-9a-f]+\.js/.test(builtStart),
  '用户:"扫描框鼠标没出现" —— custom.css 里那句 cursor:none!important 是全站的,而画框的脚本只在博客页的 footer 链里');
ok('★★★ 竖瞳:用【解析竖缝】,不是"放大半径再取整"',
  /var SLIT_W = [0-9.]+, SLIT_H = [0-9.]+;/.test(startJs) &&
  /var sl = Math\.abs\(ix\) < IRIS_R \* SLIT_W && Math\.abs\(iy\) < IRIS_R \* SLIT_H;/.test(startJs),
  '★★ 老写法 hypot(px*SQUEEZE, py) < PUPIL_R 在正中间那列会被取整挤掉,镜像一补就成两个瞳孔');
ok('★★★ 竖缝【不能】用最暗那两级(那是空格,缝会看不见)',
  /if \(sl\) q = 0\.1[0-9];/.test(startJs),
  '实测:q=0.02 时缝落进空格,眼球中间直接缺一块 —— 纯黑格数 0');
ok('★★★ 上下眼睑是【两条】曲线(上睑盖得多、下睑浅),不是一条取绝对值',
  /LID_UP = 1\.0, LID_DOWN = 0\.8/.test(startJs) &&
  /function lidAt\(px, open, up\)/.test(startJs) &&
  /var lidU = lidAt\(px, open, true\);/.test(startJs) &&
  /var lidD = lidAt\(px, open, false\);/.test(startJs),
  '用户:"眼眶还是歪的,上下两边左右不对称"。一条曲线取绝对值 = 上下镜像 = 梭形;两条曲线才是眼睛');
ok('★★★ 开孔判据必须同时判上睑与下睑',
  /if \(py < lidU && py > -lidD\)/.test(startJs),
  '睑高不等之后只判一条,另一侧会豁出去一块(点上睑之内、下睑之外 ⇒ 眼角多出一片肉)');
ok('★★★ 巩膜/虹膜/竖瞳三层落在【不同的字符档】上',
  /return \(0\.6[0-9] \+ 0\.1[0-9] \* Math\.pow\(depth/.test(startJs) &&
  /q = 0\.3[0-9];/.test(startJs) && /if \(sl\) q = 0\.1[0-9];/.test(startJs),
  '梯度只有 10 级,差一档 = 同一个字符 ⇒ 巩膜和虹膜糊成一片(踩过两次)');
ok('★★ 出场是一条时间线:一线 → 抖动 → 猛地睁开 → 文字 → 选项',
  /var PH = \{ BOOT: 0, JITTER: 1, OPEN: 2, IDLE: 3, CLOSING: 4/.test(startJs) &&
  /phase === PH\.BOOT/.test(startJs) && /phase === PH\.JITTER/.test(startJs) &&
  /phase === PH\.OPEN/.test(startJs) && /function onOpened\(\)/.test(startJs),
  '用户:"刚进入屏幕中央只有一条线,然后开始抖动突然猛地睁开,文字随后出现,过一点时间再出现两个选项"');
ok('★★ 开眼用 easeOutBack(过冲),"猛地睁开"要的就是那一下',
  /function easeOutBack/.test(startJs) && /easeOutBack\(k\)/.test(startJs));
ok('★★ 开眼时长 ≥ 400ms(用户:"最初睁开的时间可以再拉长一点")',
  /var T_BOOT = \d+, T_JITTER = \d+, T_OPEN = (\d+)/.test(startJs) &&
  Number(/T_OPEN = (\d+)/.exec(startJs)[1]) >= 400,
  '180ms 那版太快,看不出"撑开"的过程');
ok('★★ 抖动 = 整行上下错位(比"改字符"更像线在跳)',
  /if \(phase === PH\.JITTER\) py \+= \(Math\.random\(\) - 0\.5\) \* jitterAmp \* FCH;/.test(startJs));
/* ★★★ 镜像【必须不存在】—— 这是用户最后指出的那个 bug:
   "上一轮有未删干净的对称代码,导致瞳孔移动到一边会对称出来一个"。
   镜像会把"瞳孔跟随视线偏移"这种【本来就该不对称】的意图也复制一份 ⇒ 两个瞳孔。
   对称必须由几何本身保证(虹膜圆心在中轴、瞳孔是解析竖缝),不能靠复制一半。 */
ok('★★★ 渲染循环里【不许】有镜像/左右复制',
  !/\.reverse\(\)\.join/.test(startJs) &&
  !/halfN|tailCh|mirrorCheck/.test(startJs) &&
  /for \(var c = 0; c <= w; c\+\+\) \{/.test(startJs),
  '残留镜像会把跟随视线的瞳孔复制成两个(实测:瞳孔出现在列 31..60 的两处)');
ok('★★★ 每行必须补满到 COLS(否则 <pre> 宽度与坐标系不一致,眼睛整体偏)',
  /if \(s\.length < COLS\) s \+= new Array\(COLS - s\.length \+ 1\)\.join\(" "\);/.test(startJs) &&
  /pre\.style\.width = \(COLS \* CELL_W\) \+ "px";/.test(startJs),
  '实测:行只有 92 格而坐标系按 96 格算 ⇒ 眼睛偏左 2 格');
ok('★★★ 不许 trim 行尾空格(它是"偏左"的另一个来源)',
  !/s\.replace\(\/\\s\+\$\/, ?''\)/.test(startJs),
  '一 trim 每行字符数就不定,<pre> 按实际宽度居中而坐标系按 COLS 算 ⇒ 画布比坐标系窄几格');

/* ---------- ④d 背景数据流(用户:"向上移动的 ASCII 码线,模拟数据流")---------- */
ok('★★ 背景有一层 ASCII 数据流,而且是【背景】(在内容之后、不吃点击)',
  /class="start-flow"/.test(startTpl) &&
  /\.start-flow\s*\{[^}]*position:\s*fixed/.test(startCss) &&
  /\.start-flow\s*\{[^}]*pointer-events:\s*none/.test(startCss) &&
  /\.start-flow\s*\{[^}]*z-index:\s*0/.test(startCss) &&
  /\.start-wrap\s*\{[^}]*z-index:\s*1/.test(startCss),
  '它必须铺满视口、画在所有内容后面、且不可交互 —— 否则会挡住两个选项');
ok('★★ 数据流是【向上】滚动的竖线,不是静态装饰',
  /st\.head \+= st\.speed;/.test(startJs) &&
  /var d = \(h - r\) % span;/.test(startJs) &&
  /if \(st\.head >= span\)/.test(startJs),
  '流头向上推进 + 环形取模(第一版用"走出边界就重置",每次回卷会在底部留一条空白)');
/* ★★★ 这一条是整场"乱流只在左半边"的根因,必须钉死:
   flowMeasure() 里曾经在【建 streams 之前】调了一次 flowDraw() ——
   而 flowDraw 按 FL.cols 遍历 FL.streams,于是读 undefined.on 抛 TypeError,
   后面建流的代码整段不执行,<pre> 里就只剩那串测量用的 '0000…'(40 字符),
   画在屏幕上正好是"左边一小段"。用户连着两轮报的就是它。
   ⇒ 断言:flowMeasure 里在 FL.streams 赋值【之后】才允许出现 flowDraw()。 */
ok('★★★ flowMeasure 里必须先建 streams 再 flowDraw(顺序反了会抛异常,整段初始化被跳过)',
  (() => {
    const fn = /function flowMeasure\(\)[\s\S]*?\n    \}/.exec(startJs);
    if (!fn) return false;
    const body = fn[0];
    const iStreams = body.indexOf('FL.streams = []');
    const iDraw = body.indexOf('flowDraw()');
    return iStreams >= 0 && iDraw > iStreams;
  })(),
  '实测症状:提前画 → undefined.on 抛错 → 建流代码不执行 → 屏幕上只剩测量串,看着像"只铺了左半边"');
ok('★★ 数据流起飞前必须有内容(不能停在测量串上)',
  /flow\.textContent = probeTxt;/.test(startJs) &&
  /flowMeasure\(\);\s*\n\s*requestAnimationFrame\(flowTick\);/.test(startJs),
  'flowMeasure 结尾自己会 flowDraw,启动时再挂上 rAF');
/* ★★★ 字宽必须实测,而且要在设完 fontSize 之后量 —— 顺序反了量到的是回退字体 */
ok('★★★ 列数按【实测字宽】算,且测量在设置字号之后',
  (() => {
    const fn = /function flowMeasure\(\)[\s\S]*?\n    \}/.exec(startJs);
    if (!fn) return false;
    const b = fn[0];
    return b.indexOf('flow.style.fontSize = fs') < b.indexOf('getBoundingClientRect().width') &&
      /FL\.cols = Math\.max\(8, Math\.floor\(\(vw - \d+\) \/ cw\)\)/.test(b);
  })(),
  '按 fs×0.62 估字宽会算多列 ⇒ 行比 <pre> 宽 ⇒ 右边被裁,就是"只在左半边"');
ok('★★ 字体加载完要重量一次(否则量的是回退字体)',
  /document\.fonts\.ready\.then\(function \(\) \{ flowMeasure\(\); \}\)/.test(startJs),
  '首帧量到 5.93px/字(回退字体),真字体更宽');
ok('★ 数据流按 ~12fps 跑(背景不该抢注意力,也省 CPU)',
  /if \(now - FL\.last < 80\) return;/.test(startJs));
ok('★ 数据流尊重 prefers-reduced-motion(不跑动画)',
  /var flowOff = !!opt\.reduced;/.test(startJs));
ok('★★★ 离场:先缓缓闭眼,【闭到底】之后再跳',
  /phase = PH\.CLOSING/.test(startJs) &&
  /var T_CLOSE = \d+/.test(startJs) &&
  /openVal = 1 - \(1 - OPEN_LINE\) \* \(kc \* kc \* \(3 - 2 \* kc\)\)/.test(startJs) &&
  /if \(kc >= 1\) \{[\s\S]{0,80}?closedDone = true;/.test(startJs) &&
  /* 跳转不能在"闭眼动画还没跑完"时发生:close(cb) 的回调 + 兜底定时器 */
  /api\.close\(function \(\) \{ setTimeout\(function \(\) \{ window\.location\.href = href; \}, 260\); \}\)/.test(startJs) &&
  /setTimeout\(function \(\) \{ window\.location\.href = href; \}, api\.T_CLOSE \+ 1600\)/.test(startJs),
  '用户:"按住按钮读条完毕后,眼睛应该逐渐闭合,闭上之后再跳转" —— 跳转挂在闭合完成的回调上,不能只看定时器');
ok('★★★ 裂缝要看得见:线的最小开度必须能占满一整行',
  /var OPEN_LINE = 0\.0[4-9]/.test(startJs) &&
  /openVal = OPEN_LINE;/.test(startJs) &&
  /openVal = OPEN_LINE \+ \(1 - OPEN_LINE\) \* easeOutBack\(k\)/.test(startJs),
  '用户:"最开始的裂缝逐渐变大的效果也没了" —— open=0.02 时开孔半高只有 5px,一行都占不满,屏幕上什么都没有');

/* ---------- ④c 按住确认 ---------- */
ok('★★★ 两个选项都要按住,时长写在 DOM 上',
  /data-start-hold="\d+"/.test(startTpl) &&
  (builtStart.match(/data-start-hold=/g) || []).length === 2,
  '用户:"按选项可以做成需要按住一会时间"');
ok('★★★ 松手 = 取消,不能让它跳走',
  /function cancelHold/.test(startJs) && /window\.addEventListener\(ev, cancelHold/.test(startJs) &&
  /\["pointerup", "pointercancel", "pointerleave", "blur"\]/.test(startJs),
  '"按住"这套交互一旦让 <a> 的默认跳转漏过去,300ms 松手也会跳 —— 实测踩到过');
ok('★★★ 必须显式拦住 <a> 的默认跳转',
  /document\.addEventListener\("click", function \(e\) \{[\s\S]{0,260}?e\.preventDefault\(\);[\s\S]{0,80}?e\.stopImmediatePropagation\(\);[\s\S]{0,20}?\}, true\)/.test(startJs),
  '光在 pointerdown 上 preventDefault 不够:pointerup 之后浏览器还会补一个 click,那就是 <a> 的默认行为' +
  '(挂在捕获阶段,顺带把后面所有监听一起挡掉)');
ok('★★★ 按住进度用独立的 rAF 跑(跟眼睛的渲染循环解耦)',
  /function holdLoop\(now\)/.test(wireJs) &&
  /requestAnimationFrame\(holdLoop\)/.test(wireJs) &&
  /holdEl\.style\.setProperty\(["']--hold["']/.test(wireJs),
  '眼睛一旦被 stop() 或出错停摆,读条不能跟着停 —— 否则用户按满 900ms 也不会跳');
ok('★★★ 只有"你是谁?"会错乱;"别废话"正常按住',
  /a\.getAttribute\(["']data-start-go["']\) === ["']who["']/.test(wireJs) && /api\.glitch\(true\)/.test(wireJs),
  '用户:"按你是谁的时候,眼睛会出现极短的错乱,比如乱码,错位,变红等,模拟进行初始化过程。按别废话就没必要了"');
ok('★★ 错乱是三样一起:乱码 + 错位 + 闪红',
  /junkChar\(\)/.test(startJs) && /lines\[g\] = " "\.repeat\(sh\)/.test(startJs) &&
  /--eye-glitch/.test(startJs) && /is-glitch/.test(startCss),
  '乱码只换一部分格子(整屏换就成了雪花),错位是整行横移,闪红在红/黄/白之间交替');
/* ★★★ 用户:"你这个左下角按钮的乱序的效果,范围是一个小方框,而且范围和频率有点大。"
   ⇒ 三个量都要压住:爆发间隔、乱码率、错位率。这一条防的是"以后又调回去"。 */
ok('★★★ 错乱要【克制】:爆发间隔 ≥ 200ms、乱码率 ≤ 5%、错位率 ≤ 10%',
  /glitchNext = now \+ (\d+) \+ Math\.random\(\) \* (\d+)/.test(startJs) &&
  Number(/glitchNext = now \+ (\d+)/.exec(startJs)[1]) >= 200 &&
  /if \(glitching && Math\.random\(\) < 0\.0[0-9]+\)/.test(startJs) &&
  Number(/glitching && Math\.random\(\) < (0\.0[0-9]+)/.exec(startJs)[1]) <= 0.05 &&
  /if \(Math\.random\(\) < 0\.0[0-9]+\) \{\s*\n\s*var sh = 1/.test(startJs),
  '用户:"范围和频率有点大" —— 原来 60~190ms 一次、乱码 10%、错位 18%,观感是整屏在抖');
ok('★ 键盘也能按住(Enter / Space)',
  /e\.key === ["']Enter["'] \|\| e\.key === ["'] ["']/.test(wireJs));

/* ---------- ⑤ 一屏装得下 ---------- */
/* 眼睛的像素高度由高度预算推出来,不是拍的:
   网格高度 = ROWS × CELL_H,而 ROWS 又由 EYE_HY×LID_PEAK 反推 ⇒
   眼睛 + "你好?" + 两个按钮必须落在视口里。这里把三个百分比钉住,
   免得以后调参把按钮挤出屏幕(第一版就是网格吃到 81% 视口高,按钮没了)。 */
ok('★★ 眼睛宽度按视口定(EYE_W_FRAC),行数由眼睑峰值反推 —— 不是写死的行数',
  /EYE_W_FRAC = 0\.\d+/.test(startJs) && !/ROWS = \d+;/.test(startJs),
  '写死行数的话,换屏就错位');
ok('★★★ 宽屏下网格高度必须封顶(否则文字被挤出视口)',
  /var maxRows = Math\.max\(12, Math\.floor\(vh \* 0\.\d+ \/ CELL_H\)\)/.test(startJs) &&
  /if \(ROWS > maxRows\)/.test(startJs),
  '实测 2560×1080:只按宽度算得 42 行 = 882px,眼睛吃光视口,wrap 跑到 y=-33,"你好?"和选项全被挤出屏幕');
ok('★★★ 封顶时必须【同步缩列数】,不能只砍行数',
  /COLS = Math\.max\(40, Math\.min\(COLS,\s*\n?\s*Math\.round\(ROWS \* CELL_H/.test(startJs),
  '只砍行数会把眼睛压扁,比例就毁了');
ok('★ 三段式纵向布局:眼睛 / 问句 / 两个选项,间距也跟着视口走',
  /\.start-wrap\s*\{[^}]*flex-direction:\s*column/.test(startCss) &&
  /gap:\s*clamp\(/.test(startCss),
  '间距写死像素的话,矮屏上会把按钮压出视口');
ok('★ 整屏禁止滚动条(overflow:hidden 在 body 上)',
  /body\.start-page\s*\{[^}]*overflow:\s*hidden/.test(startCss),
  '这一屏是"一屏",不该出现滚动条');

/* ---------- 汇总 ---------- */
const pass = rows.filter((r) => r[0]).length;
const w = Math.max(...rows.map((r) => r[1].length));
for (const [p, n, i] of rows) {
  console.log(`${p ? '  ✓' : '  ✗'} ${n}${i ? '   [' + i + ']' : ''}`);
}
console.log(`\n${pass}/${rows.length} 通过`);
process.exit(pass === rows.length ? 0 : 1);
