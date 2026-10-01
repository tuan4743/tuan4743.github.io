/* ============================================================
   首页开机引导 —— 用户第二轮
   ─────────────────────────────────────────────────────────────
   用户(逐字):
     "1.进入首页不是有一个加载动画?我发现这个加载动画考虑的需要加载的东西不够,
        导致正式进入后有些东西还是没有加载完成(比如音乐,CD模型)。然后把加载动画的
        字换了,Tuagfey-blog改成人格修正启动中...,加载文字也要进行替换,比如
        '下载3D模型->加载情感引擎',总之就是往设定上靠,然后把加载界面的白色背景改成
        黑色,字体可以调大一点。
      2.进入首页的初始化从进入CD页转为直接停在平板上,此时平板是黑屏。
      3.然后把启动页的眼睛移植过去,触发动画和对话(对话逐字打出),按照顺序给出:
        [眼睛睁开 / 四句台词 / 一段自嘲] → 扫描框吸附整块平板 → 上侧下滑栏(锁鼠标)
        → 左侧打开 CD 架按钮(锁鼠标) → 瞳孔转向屏幕正中央 → 按下它(解锁)
        → 进 CD 页、眼睛转个向缩小放到右侧三分之一 → 左上文字区(大致范围)
        → CD 区域(大致范围) → 锁滚轮 → 左侧插入按钮 → 解锁并按下 → 一切恢复正常。
      按下后就正常了,所有动画结束。"

   这一份钉的是【这条链路上每一处"一改就会坏、坏了看不出来"的地方】。
   真实观感(眼睛形状、时序、吸附位置)靠 .tmp/shots-guide.mjs 的截图 +
   .tmp/verify-home.mjs 的现场读数,单测里不跑浏览器。
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

const homeTpl = rd(`${BH}/layouts/home/list.html`);
const homeTplC = noC(homeTpl);
const guideJs = noC(rd(`${BH}/assets/js/home-guide.js`));
/* ★ 步骤表那一条要在【没去注释】的原文上找:步骤里带着行内注释
   (`eye: "reveal",   // 睁眼`),注释一去掉,indexOf 找的片段就跨不过去了。 */
const guideRaw = rd(`${BH}/assets/js/home-guide.js`);
const eyeJs = noC(rd(`${BH}/assets/js/ascii-eye.js`));
const introJs = noC(rd(`${BH}/assets/js/intro.js`));
const cd3dJs = noC(rd(`${BH}/assets/js/cd3d.js`));
const tabletJs = noC(rd(`${BH}/assets/js/tablet.js`));
const mcJs = noC(rd(`${BH}/assets/js/magnetic-cursor.js`));
const tcss = noC(rd(`${BH}/assets/css/tablet.css`));
/* 引导换场那几条过渡写在 extended/shell.css(page-out 那一节)里 */
const tcssShell = noC(rd(`${BH}/assets/css/extended/shell.css`));
const icss = noC(rd(`${BH}/assets/css/intro.css`));
const hugo = rd(`${BH}/hugo.toml`);
const builtHome = rd(`${WS}/.tmp/t1/home/index.html`);

/* ★★ 取一条 CSS 规则【自己那一对大括号】里的内容。
   为什么需要它:写 `\.foo \{[\s\S]{0,400}?bar` 这种"往后若干字符里找"的断言,
   只要在中间补一段注释或一条新规则就会假红(这一轮就踩了两次:tablet.css 末尾
   追加了引导那一节、hugo.toml 里补了一段说明)。圈到大括号里比数长度稳。 */
const rule = (css, sel) => {
  const i = css.indexOf(sel + " {");
  if (i < 0) return "";
  const j = css.indexOf("}", i);
  return j < 0 ? "" : css.slice(i, j + 1);
};

/* ---------- ① 加载页:补全加载项 + 文案 + 黑底大字 ---------- */
ok('★★★ 加载页要等【音乐也解码完】才收口,不是 3D 一就绪就进',
  /beginSite\(homeBoot\)/.test(introJs) &&
  /function beginSite\(onReady\)/.test(introJs) &&
  /function startMusicPreload\(\)/.test(introJs) &&
  /var p = musicPreload \|\| startMusicPreload\(\);/.test(introJs) &&
  /p\.then\(function \(\) \{[\s\S]{0,120}?onReady\(\);/.test(introJs) &&
  !/setProgress\(100, "加载完成"\);\s*\n\s*startIntro\(\);/.test(introJs),
  '用户:"加载动画考虑的需要加载的东西不够,导致正式进入后有些东西还是没有加载完成(比如音乐,CD模型)"');
ok('★★★ 音乐和 3D 必须【并行】下,不能串着等',
  /startMusicPreload\(\);\s*\n\s*tryInit3D\(\);/.test(introJs),
  '串起来等就是白等 —— 总时长该是 max(模型, 音乐),不是相加');
ok('★★★ 加载项里真的把音乐读了一遍(第一首解码、其余进 HTTP 缓存)',
  /audio\.music\.load\(first\)/.test(introJs) && /fetch\(u, \{ cache: "force-cache" \}\)/.test(introJs) &&
  /window\.GD_SONGS/.test(introJs),
  '第一首必须【解码】:按下插入那一刻要立刻能响;其余只预取字节,不占内存');
ok('★★★ 进度条不许【倒着走】(两路并行,各自封顶在 100 以下)',
  /var progSrc = \{\};/.test(introJs) &&
  /if \(val > best\) best = val;/.test(introJs) &&
  /Math\.min\(96, Math\.round\(p \* 0\.96\)\)/.test(cd3dJs) &&
  /\(\+\+done \/ span\) \* 96/.test(introJs),
  '★★ 实测踩过:音乐先跑完报到 99%,模型那边一报 18%,进度条 99% → 18%;' +
  '还有一次音乐先把条顶到 100%,而模型还在下 —— 屏幕上是"100% 但什么都不发生"');
ok('★★★ 进度标题要显示"还没跑完的那一路",不是"数值最大的那一路"',
  /if \(val < 100 && !name\) name = progSrc\[s \+ ":label"\]/.test(introJs),
  '★ 按数值挑的话,音乐先到 100 就会一直显示"载入情感引擎 100%"(看着像卡死)');
ok('★★ 预载不能把用户永远按在加载页上(有硬上限)',
  /Promise\.race\(\[/.test(introJs) && /wait\(4000\)/.test(introJs),
  '某首歌缺失 / 网络极慢时也要放行 —— 否则用户卡在加载页出不去');
ok('★★ 进度停在高位那几秒要看得出来"还在动"',
  /\.intro-loader-sub \{/.test(icss) &&
  /function startLoaderSub\(\)/.test(introJs) &&
  /loaderSub\.textContent = spin \+ " " \+ bar/.test(introJs) &&
  /@keyframes loader-breathe/.test(icss) &&
  /\.intro-loader\.is-active \.intro-loader-bar i \{[\s\S]{0,80}?animation: loader-breathe/.test(icss),
  '线上实测进度是"58 → 96 → 96 … 96 → 100",中间五秒数字几乎不动 ——' +
  '一屏静止的字会被当成卡死(用户报的"动画完全没有加载"里就有这一层):' +
  '所以加了转动的 ASCII 轮 + 进度条自己做呼吸');
ok('★★★ 加载页文案全部按设定走',
  /人格修正启动中…/.test(homeTpl) && !/>TUAGFEY</.test(builtHome) &&
  /report\(18, "加载情感引擎"\)/.test(cd3dJs) &&
  !/report\(\d+, "下载 3D 模型"\)/.test(cd3dJs) &&
  /report\(3, "读取终端配置"\)/.test(cd3dJs) && /report\(90, "校准人格模板"\)/.test(cd3dJs) &&
  /挂载 CD 模板/.test(introJs) && /载入情感引擎/.test(introJs),
  '用户:"把加载动画的字换了,Tuagfey-blog改成人格修正启动中...,加载文字也要进行替换,比如\'下载3D模型->加载情感引擎\'"' +
  ' —— ★ 断言只看【真正 report 出去的那一句】,注释里提到旧名字不算数(压缩器会连注释一起压掉)');
ok('★★★ 加载页白底改黑底、字号调大',
  /\.intro-loader \{[\s\S]{0,260}?background: #000;/.test(icss) &&
  !/\.intro-loader \{[\s\S]{0,260}?background: var\(--theme\)/.test(icss) &&
  /\.intro-loader-brand \{[\s\S]{0,260}?font-size: clamp\(1\.3rem, 2\.1vw, 2\.1rem\)/.test(icss) &&
  /\.intro-loader-pct \{[\s\S]{0,260}?font-size: clamp\(0\.92rem/.test(icss),
  '★ 底色【不能】跟主题走:浅色主题下 --theme 是白的,那一屏就变成一大块白(用户看到的正是白的)');

/* ---------- ② 初始化:停在黑屏的平板上,不进 CD 页 ---------- */
ok('★★★ 首页初始化【不再】打开 CD 架',
  /var IS_HOME = body\.classList\.contains\("home-page"\)/.test(introJs) &&
  /if \(!IS_HOME\) \{ startIntro\(\); return; \}/.test(introJs) &&
  /function homeBoot\(\)/.test(introJs),
  '用户:"进入首页的初始化从进入CD页转为直接停在平板上" —— startIntro() 那条路(视角左移 + 拉出 CD 架)整个不走');
ok('★★★ 首页那一份模板必须带 home-page 标记(整条分支的开关)',
  /class="intro-page home-page"/.test(homeTpl) && /home-page/.test(builtHome),
  'intro.js 靠它决定走哪条初始化路径;少了它首页会退回"打开 CD 架"');
ok('★★★ 所有降级路径也都走首页那条初始化(不能因为 3D 失败就回 CD 页)',
  (introJs.match(/beginSite\(homeBoot\)/g) || []).length >= 5 &&
  !/console\.warn\("\[cd3d\] 加载超时,进入降级模式"\);\s*\n\s*startIntro\(\);/.test(introJs),
  '减少动效 / 无 WebGL / 模块加载失败 / 资产缺失 / 超时 —— 五条降级路径');
ok('★★★ 首帧就把 CD 页藏掉(否则会先闪一下 CD 页再变黑)',
  /d\.classList\.add\("home-boot"\)/.test(homeTpl) &&
  /html\.home-boot \.scene,\s*\n?html\.home-boot \.intro-bg,\s*\n?html\.home-boot \.statusbar-toggle \{\s*\n?\s*opacity: 0 !important;/.test(tcss) &&
  /setTimeout\(function \(\) \{ d\.classList\.remove\("home-boot"\); \}, 6000\)/.test(homeTpl),
  '★ 兜底那 6 秒不能省:JS 挂了(资源缺失/语法错误)时整页会永远是黑的,连排查入口都没有');
ok('★★ 平板这一步"不认"上次留的记忆(刷新 = 重新开机)',
  /var homePage = document\.body\.classList\.contains\("home-page"\)/.test(tabletJs) &&
  /setOpen\(!homePage && saved === "1", true\)/.test(tabletJs),
  '★ 但 CD 架那条路上"用户按开过就一直开着"的记忆不受影响');
ok('★★ 首页开机要自己开平板,而且有一个明确的口子',
  /window\.__tabletOpen = function \(on\)/.test(tabletJs) && /window\.__tabletOpen\(true\)/.test(introJs),
  'immediate = true:这一下不是用户按的,不抢焦点(抢了会平白画出一个焦点框)');

/* ---------- ②b 黑屏那两层(踩过的坑) ---------- */
ok('★★★ 黑屏底衬的 z-index 必须是负的',
  /\.tablet-backdrop \{[\s\S]{0,200}?z-index: -1;/.test(tcss),
  '★★ 两个错法都踩过:写 39(想"紧贴平板之下")⇒ CD 架一打开整页全黑;' +
  '写 0/auto ⇒ 盘页仍然被压住(实测亮像素占比 0.047,正常 0.354)。只有 -1 对');
ok('★★ 底衬平时不能挂着(它铺满视口)',
  /\.tablet-backdrop \{[\s\S]{0,200}?display: none;/.test(tcss) &&
  /html\.home-dark \.tablet-backdrop \{ display: block; \}/.test(tcss),
  '长期挂着的负 z-index 黑块会把整站压黑');
ok('★★★ 机身两侧的透光也要涂黑(否则浅色主题下黑屏漏出两条白边)',
  /html\.home-dark,\s*\n?html\.home-dark body \{ background: #000; \}/.test(tcss),
  '平板玻璃是被贴图窗口裁出来的,机身那两竖条半透明 —— 底下没东西时浅色主题会透白');

/* ---------- ③ 眼睛:复用启动页那一只 ---------- */
ok('★★★ 眼睛用【共用模块】,不重写一份',
  /window\.AsciiEye\.create/.test(guideJs) &&
  /resources\.Get "js\/ascii-eye\.js"/.test(homeTpl) &&
  /ascii-eye\.[0-9a-f]+\.js/.test(builtHome),
  '这一只眼睛的几何被用户来回修了七八轮,两份迟早会漂,而漂了看不出来');
ok('★★★ 首页那只眼睛【不跟真实鼠标】,只认剧本给的视线',
  /gaze: "fixed"/.test(guideJs) && /drift: false/.test(guideJs) &&
  /var forceGaze = opt\.gaze === "fixed"/.test(eyeJs) && /if \(forceGaze\) return;/.test(eyeJs),
  '用户要的是"瞳孔跟着扫描框移动" —— 跟真实鼠标会把这个意图顶掉');
ok('★★★ 宠物级细节:视线自漂不能把引导钉住的视线带跑',
  /if \(!hasPointer && opt\.drift !== false\)/.test(eyeJs),
  'opt.drift=false 时必须一点都不漂,否则"瞳孔转向屏幕正中央"那一拍会自己往边上跑');
ok('★★★ 视线每帧跟着框时,矩形字段名必须和读取处一致(写成 x/w 会一路 NaN)',
  /frameRect = \{ left: Math\.round\(left\), top: Math\.round\(top\), width: Math\.round\(w\), height: Math\.round\(h\) \};/.test(guideJs) &&
  /var cx = p\.left \+ p\.width \/ 2, cy = p\.top \+ p\.height \/ 2;/.test(guideJs),
  '★★ 踩过:frameRect 用 x/y/w/h,而 lookAtRect 读 p.left/p.top ⇒ 每次算出来都是 NaN,' +
  '一路写进 setGaze(NaN, NaN)。症状是"眼睛完全不跟框",而控制台一声不响(NaN 不抛异常)');
ok('★★★ NaN 不许进 setGaze(它是"眼睛不动"的静默元凶)',
  /if \(!isFinite\(gx\) \|\| !isFinite\(gy\)\) return;/.test(guideJs),
  '任何一条算式退化成 NaN,这里就整帧不动、保留上一帧 —— 比传 NaN 强得多');
ok('★★★ 量不到目标时不许把剧本矩形刷成 null/NaN',
  /if \(!\(r\.width > 1 && r\.height > 1\)\) return;/.test(guideJs) &&
  /if \(!\(b\.width > 0 \|\| b\.height > 0\)\) return;/.test(guideJs),
  '★★ 平板是 hidden 时 getBoundingClientRect() 全是 0,regionRect 会算出 NaN ——' +
  '用户说的"磁吸到整块平板"那几拍就永远僵在屏幕中心(实测踩过)');
ok('★★★ 黑屏时隐藏后代要能压住"反向覆盖"(visibility 是子元素可以顶开祖先的)',
  /\.tablet\.is-dark,\s*\n?\.tablet\.is-dark \* \{\s*\n?\s*visibility: hidden !important;/.test(tcss) &&
  /\.tablet\.is-dark #home-eye,[\s\S]{0,140}?visibility: visible !important;/.test(tcss),
  '★★ 用户第三轮:"刚进入页面时这个音量滑块会莫名其妙出现在屏幕上" ——' +
  '平板上 .volume-panel 被改成常驻时写的就是 visibility:visible,只隐藏祖先压不住它');
ok('★★★ 黑屏态要关掉入场过渡(0→1 的淡入过程里内容会先露出来)',
  /\.tablet\.is-dark \{[\s\S]{0,260}?transition: none;/.test(tcss),
  '★ 实测:挂上 .is-dark 那一刻 opacity 只有 0.047,快捷控制卡片跟着淡入露了一下脸');

/* ---------- ④ 扫描框:用【真的】那个,靠合成事件驱动 ---------- */
ok('★★★ 扫描框是【真的那个】,靠派发合成事件驱动(不是另画一个假框)',
  /new PointerEvent\("pointermove"/.test(guideJs) &&
  /new MouseEvent\("mousemove"/.test(guideJs) &&
  /new MouseEvent\("mouseover"/.test(guideJs),
  '另画一个假框的话,两边迟早在某个分辨率下对不上 —— 引导里框停在哪儿,用户自己移上去也该在哪儿');
ok('★★★ 锁鼠标【不能】一律掐掉 pointermove(会把引导自己派发的也掐掉)',
  /var GRAB = \d+;/.test(guideJs) &&
  /var dx = e\.clientX - guidePos\.x, dy = e\.clientY - guidePos\.y;/.test(guideJs) &&
  /if \(guidePos\.x >= 0 && Math\.abs\(dx\) <= GRAB && Math\.abs\(dy\) <= GRAB\) return;/.test(guideJs),
  '★★ 本监听挂在捕获阶段、位置又比 magnetic-cursor 早,一刀切下去:框从此一动不动,' +
  '而控制台一声不响(实测踩过 —— 症状就是"吸附框根本没动")');
ok('★ "锁住鼠标"= 整页不接收真实指针',
  /html\.guide-lock,\s*\n?html\.guide-lock \* \{\s*\n?\s*pointer-events: none !important;/.test(tcss) &&
  /docEl\.classList\.toggle\("guide-lock", locked\)/.test(guideJs),
  '★ 合成事件不受 pointer-events 影响,所以引导自己派发的 click 照旧能落到按钮上');
ok('★★ 锁定期间扫描框要"停稳"(自转倍率压下来)',
  /window\.__mcSpinScale = 0\.\d+/.test(guideJs) && /__mcSpinScale/.test(mcJs),
  '以 24°/s 自转的小方块读起来像个转动图标,不像锁定框');
ok('★★★ 扫描框的"吸附"用【剧本矩形】驱动,不是只把指针挪过去',
  /window\.__mcScript = \{ x: cx, y: cy, w: Math\.round\(w\), h: Math\.round\(h\) \};/.test(guideJs) &&
  /function scriptBox\(\)/.test(mcJs) &&
  /var sb = scriptBox\(\);/.test(mcJs) &&
  /tx = sb\.x; ty = sb\.y; tw = sb\.w; th = sb\.h;/.test(mcJs),
  '用户第三轮:"扫描框的动画,确实移动了,但是扫描框没有磁吸上去,要的是这个磁吸的效果" ——' +
  '只派发合成事件的话,目标没有 DOM 元素可指(整块平板/CD 轮盘那一带),框也吸不到位');
ok('★★★ 吸附矩形要【每一帧重新量】(机器在平移、玻璃在贴合)',
  /function refreshSnap\(\)/.test(guideJs) &&
  /refreshSnap\(\);/.test(guideJs) &&
  /function setSnapSpec\(spec\) \{ lastSnapSpec = spec; \}/.test(guideJs),
  '★ 量一次就钉死是不行的:CD 架拉出来时整台机器还在 550ms 的平移里,' +
  '那时量到的按钮位置是移动前的 —— 框会停在旧坐标上,看着就是"没吸上去"');
ok('★★★ 框要停在目标的【矩形】上,不是落在中心的一个小方块',
  /scriptSnap\(b\.left - 2, b\.top - 2, b\.width \+ 4, b\.height \+ 4\)/.test(guideJs) &&
  /scriptSnap\(r\.left, r\.top, r\.width, r\.height\)/.test(guideJs),
  '沿用的还是锁定框那一套美术(角线/白心/青晕),只是位置与尺寸由剧本给');

/* ---------- ⑤ 台词:逐字打出,而且一句不改 ---------- */
const LINES = [
  '你好。哦,是你啊。怎么又变成了这样。',
  '我是方舟总控 AI 子代理,代号 ECHOM_D29_Z68J521,……你叫我 ECHO。',
  '本系统记录,这是你第 27 次未按时进行人格修正,你能不能长点记性?',
  '一旦长时间未修正,锚点将发生不可逆偏移。',
  '……好吧,我又得重来一遍:',
  '这是总控修正终端,你需要在这里完成五项修正。',
  '按下可以展开终端设置页,在设置页你可以前往核心数据库,或者对终端环境进行一些设置。',
  '从这里可以进入情感引擎安装仓。',
  '这可是你的杰作。从里面你可以校准自己的人格。',
  '按下它。',
  '这是引擎的内容。',
  '你的滤网协议还挺有意思?',
  '滚轮滑动可以上下选择……你能不能消停一会,等你先完成这一张再滑。',
  '这是插入按钮,可以插入当前引擎。',
  '按下,进入第一次校准。'
];
const missing = LINES.filter((L) => !guideJs.includes(L));
ok(`★★★ 十五句台词一字不改(${LINES.length - missing.length}/${LINES.length})`,
  missing.length === 0, missing.length ? '缺:' + missing.join(' / ') : '');
ok('★★★ 台词是【逐字打出】的,而且每个字的间隔不是常数',
  /function typeLine\(text, forceInstant\)/.test(guideJs) &&
  /lineEl\.textContent = text\.slice\(0, i\);/.test(guideJs) &&
  /typing = setTimeout\(tick, charDelay\(text, i - 1\)\);/.test(guideJs) &&
  /function charDelay\(text, i\)/.test(guideJs) &&
  /Math\.random\(\) \* base \* 0\.45/.test(guideJs),
  '用户:"对话逐字打出";第三轮又要求"不要匀速" —— 所以带 ±45% 抖动');
ok('★★★ 标点分档停顿:句号/问号 > 省略号 > 逗号 > 普通字',
  (function () {
    var m = /var PUNCT = \{([\s\S]*?)\};/.exec(guideJs);
    if (!m) return false;
    var body = m[1];
    var num = function (k) { var r = new RegExp('"' + k + '":\\s*(\\d+)').exec(body); return r ? Number(r[1]) : -1; };
    var ju = num("。"), dou = num(","), mao = num(":"), dian = num("…");
    return ju > 200 && dou > 40 && dou < 160 && mao > 60 && mao < 200 && dian > 150;
  })(),
  '用户第三轮:"还有像……,哦,这些明显需要停顿的没有表现出来" —— 句号要落得下来,逗号只轻轻收一下(不能一顿一顿)');
ok('★★ 连续的省略号点只算【一次】迟疑',
  /if \(ch === "…" && prev === "…"\) d = base \+ 60;/.test(guideJs),
  '…… 是两个 U+2026,按表走就是两次停顿 —— 读起来像卡了两下,不像迟疑');
ok('★★ 代号里的英数字母要连成一串读(ECHOM_D29_Z68J521 不是一个字一个字蹦)',
  guideJs.includes("[A-Za-z0-9_]") &&
  /d = Math\.max\(\d+, base \* 0\.\d+\);/.test(guideJs),
  '那一串按基础速度一个字一个字蹦要读十几秒,而且没有语义停顿可言');
ok('★★★ 台词是直接浮在平板上的,【没有对话框】',
  !/\.home-console \{[\s\S]{0,600}?background: linear-gradient/.test(tcss) &&
  !/\.home-console \{[\s\S]{0,600}?border-left:/.test(tcss) &&
  rule(tcss, ".home-console").includes("background: none") &&
  rule(tcss, ".home-console").includes("border: 0") &&
  rule(tcss, ".home-console").includes("padding: 0") &&
  /text-shadow: 0 0 10px rgba\(255, 255, 255/.test(rule(tcss, ".home-console")),
  '用户第三轮:"对话其实不要对话框,就像启动页一样,对话文字是直接浮在平板上的"');
ok('★★★ 台词要让开底部金属框(否则被机身边框切掉一半)',
  /\.home-console \{[\s\S]{0,400}?bottom: calc\(var\(--ff-win-bottom/.test(tcss) &&
  /\.home-console \{[\s\S]{0,400}?left: calc\(var\(--ff-win-left/.test(tcss),
  '★ 平板的玻璃是贴图窗口裁出来的,下缘还有 ~8.5% 视口高是机身 ——' +
  'bottom:0 会直接顶到玻璃边上(截图里字被切掉一半)');
ok('★★ 台词层不能挡住扫描框要落的按钮',
  rule(tcss, ".home-console").includes("pointer-events: none"),
  '它只是字幕 —— 挡住插入按钮的话,引导最后那一下按不下去');

ok('★★★ 视线【始终】跟着扫描框(只有一句看向正中央)',
  /gaze: "center"/.test(guideJs) && /gazeMode = "scan"/.test(guideJs) &&
  /function followLoop\(\)/.test(guideJs) && /lookAtRect\(frameRect\)/.test(guideJs),
  '用户第三轮:"眼睛是始终要跟扫描框的,只有一句台词需要看向屏幕中央"');

/* ---------- ⑥ 顺序:照着用户给的那一串 ---------- */
const ORDER = [
  ['睁眼', 'eye: "reveal"'],
  ['整块平板', 'snap: "region:tablet-all"'],
  ['下滑栏', 'snap: "#statusbar-toggle"'],
  ['CD 架按钮', 'snap: "#intro-toggle"'],
  ['瞳孔转正中央', 'gaze: "center"'],
  ['按下它(用户按)', 'press: ".slot-toggle"'],
  ['进入 CD 页(闭眼→左滑→右侧重睁)', 'dock: true'],
  ['引擎内容', 'snap: "region:rack-info"'],
  ['CD 区', 'snap: "region:rack-discs"'],
  ['插入按钮', 'snap: "#rack-insert"'],
  ['按下插入(用户按)', 'press: "#rack-insert"']
];
const positions = ORDER.map(([n, frag]) => [n, guideRaw.indexOf(frag)]);
const wrongOrder = positions.filter(([, i]) => i < 0);
const sorted = positions.every(([, i], k, a) => k === 0 || a[k - 1][1] < i);
ok('★★★ 步骤顺序和用户给的那一串完全一致',
  wrongOrder.length === 0 && sorted,
  wrongOrder.length ? '找不到:' + wrongOrder.map((x) => x[0]).join(',') : (sorted ? '' : '顺序颠倒了:' + positions.map((x) => x[0]).join(' → ')));
ok('★★★ 步骤之间必须【串行】(每一步返回 Promise,链条一节一节走)',
  /function runStep\(s, i\)/.test(guideJs) &&
  /p = p\.then\(function \(\) \{/.test(guideJs) &&
  /return typeLine\(s\.text\)\.then\(function \(\) \{ return sleep\(afterLine\); \}\);/.test(guideJs),
  '并行跑的话台词会互相盖掉,而且"扫到哪儿说到哪儿"的对应关系就没了');
/* ★★★ 第五轮把这一段整个换掉了:
   第三轮要"转 90° 横着看",第五轮改成"按下左滑后主屏的眼睛马上闭上,
   等彻底滑过去后眼睛再在右侧睁开"。
   第六轮又纠正一次:"我说眼睛要旋转90°,你怎么又给我修回去了?" —— 两件事【叠加】。
   第七轮:"按下进入CD页的按钮时,主眼睛应该立马闭合,否则跟不上左滑的速度。" */
ok('★★★ 进 CD 页 = 闭眼 → 左滑 → 右侧重新睁眼(三步,顺序不能乱)',
  /dock: true/.test(guideRaw) &&
  /function closeEye\(\)/.test(guideJs) &&
  /function dockIntoBox\(\)/.test(guideJs) &&
  /function runDock\(\)/.test(guideJs) &&
  /startDockSlide\(\);[\s\S]{0,140}?beginDockClose\(\);/.test(guideJs) &&
  /enterFromRight\(\);[\s\S]{0,240}?if \(eye\.openNow\) eye\.openNow\(\);[\s\S]{0,140}?dockIntoBox\(\);[\s\S]{0,160}?classList\.add\("is-on"\)/.test(guideJs),
  '用户第五轮:"按下左滑后,主屏幕的眼睛马上闭上,等到彻底滑过去后,眼睛再在右侧睁开"');
ok('★★★ 左滑用的是 page-slide 那条过渡(不是自己另画一套)',
  /docEl\.classList\.add\("page-slide"\)/.test(guideJs) &&
  /document\.body\.classList\.add\("page-out"\)/.test(guideJs) &&
  /document\.body\.classList\.remove\("page-out"\)/.test(guideJs),
  '整块机器左移 100vw 的那条 CSS 在 shell.css 第三节 —— 复用同一条,过场才接得上');
/* ★★★ 两次要求是【叠加】的,不是互相取代 —— 我第五轮读错了,
   把旋转删掉,用户第六轮直接指出来:"我说眼睛要旋转90°,你怎么又给我修回去了?"
     · 第三轮:转向 90°,放右侧,像横着看      ⇒ 要转
     · 第五轮:闭眼 → 左滑 → 右侧睁开          ⇒ 要换场编排
   ⇒ 完整是四步:闭眼 → 左滑 → 换格【并转 90°】 → 重新睁开。 */
ok('★★★ 右侧那只眼睛必须【转 90°】(第三轮的要求,不许再删)',
  /var DOCK_TILT = 90;/.test(guideJs) &&
  /if \(eye\.rotate\) eye\.rotate\(DOCK_TILT\);/.test(guideJs) &&
  !/eye\.rotate\(0\)/.test(guideJs),
  '第三轮:"这个眼睛要转向90°,放到右侧,就像横着看一样。而你只是缩小了一下就放上去了"');
ok('★★★ 转向发生在【眼睛闭着的那段窗口里】(不是转着给你看)',
  /function enterFromRight\(\)/.test(guideJs) &&
  /eye\.rotate\(DOCK_TILT\)/.test(guideJs) &&
  /enterFromRight\(\);[\s\S]{0,260}?if \(eye\.openNow\) eye\.openNow\(\);/.test(guideJs),
  '转向是在换格那一帧做的,而那一刻眼睛已经闭上(睁眼在它之后)');
/* ★★★ 第七轮抓到的真凶:openNow() 内部会 measure()(按【整个视口】重算字号与列数),
   把 dockIntoBox 里按右边那一格算好的尺寸整个冲掉 ——
   实测 1600×900:<pre> 被改回 748.8×487.5(整屏那一档),而宿主格只有 558×312,
   于是眼睛横过来占 488×719,而那一格只有 480 宽 = 用户说的"放不下"。
   ⇒ 顺序必须是:openNow() → dockIntoBox() → is-on(显出来)。 */
ok('★★★ 睁开之后要【重新贴一次】那一格的尺寸(openNow 会把它冲掉)',
  /if \(eye\.openNow\) eye\.openNow\(\);[\s\S]{0,140}?dockIntoBox\(\);/.test(guideJs) &&
  /openNow: function \(\) \{[\s\S]{0,120}?measure\(\);/.test(eyeJs),
  'openNow() 里第一句就是 measure() —— 不重新 fitTo 一次,换格等于没换');
ok('★★ 旋转要有过渡(和左滑同拍 0.55s)',
  /\.home-eye\.is-docked \{[\s\S]{0,400}?transform \.55s cubic-bezier/.test(tcss),
  '没有过渡就是"啪一下转过去";有过渡才像"它转过去了"');
ok('★★ 转 90° 之后瞳孔照样跟手(朝向与跟手是两件事)',
  /eye\.setGaze\(gx, gy\)/.test(guideJs) &&
  /function lookAtRect\(p\)/.test(guideJs),
  '跟手靠 setGaze,旋转只改朝向 —— 所以"横着看"和"跟着你"可以同时成立');
/* ★★★ 第八轮把这条改了(用户:"闭眼的速度太慢,要不然就设计成跟随平板移动"):
   原来是"等眼睛闭到底再左滑"(780ms 里机器不动,眼睛在原地慢慢闭);
   现在两件都做 —— 闭眼缩到 420ms,而且左滑【不等它】,两者一起走,
   眼睛跟着机器滑出屏幕。所以这里钉的是:闭眼有时长上限 + 左滑不等闭眼。 */
ok('★★★ 换场闭眼要快(420ms),而且左滑【不等】它闭完(用户第八轮)',
  /var DOCK_CLOSE_MS = 420;/.test(guideJs) &&
  /eye\.close\(fin, DOCK_CLOSE_MS\)/.test(guideJs) &&
  /setTimeout\(fin, DOCK_CLOSE_MS \+ 500\)/.test(guideJs) &&
  /startDockSlide\(\);[\s\S]{0,140}?beginDockClose\(\);/.test(guideJs),
  '用户第八轮:"闭眼的速度太慢,要不然就设计成跟随平板移动"');
ok('★★★ 眼睛要跟着机器一起滑走(它就是"被落在原地慢慢闭"的那一个)',
  /eye\.slideX\(-window\.innerWidth\)/.test(guideJs) &&
  /eye\.slideX\(vw\)/.test(guideJs) &&
  /eye\.slideX\(0\)/.test(guideJs) &&
  /function slideX\(px\)/.test(eyeJs) &&
  /host\.style\.transform = \(shiftX \? "translateX\(" \+ shiftX \+ "px\) " : ""\) \+ \(tilt \? "rotate\(" \+ tilt \+ "deg\)" : ""\);/.test(eyeJs),
  '★ 位移必须和 rotate(90deg) 合成在同一条 transform 上 —— 直接写 style.transform 会把旋转冲掉');
ok('★★★ 那一格的分母是【玻璃的宽】,不是视口的宽',
  /cssPx\("--ff-win-left"/.test(guideJs) &&
  /var glassW = Math\.max\(320, vw - winL - winR\)/.test(guideJs) &&
  /var third = glassW \/ 3;/.test(guideJs) &&
  /eye\.anchor\(cx - hostW \/ 2, \(vh - hostH\) \/ 2, hostW, hostH\)/.test(guideJs),
  '★★ 第一版写 left:auto/right:0/width:33vw(视口右边三分之一)⇒ 整只眼睛压在 CD 盘面上(截图里就是)');

/* ============================================================
   ★★★ 第七轮(用户逐字):
     "1.转向90°后,眼睛应该小一点,不然放不下。
      2.按下进入CD页的按钮时,主眼睛应该立马闭合,否则跟不上左滑的速度。
      3.左滑后那几句话的出字速度还是不对。"
   ============================================================ */
/* ① 缩小 —— 转 90° 是【宽高互换】的,所以"放不下"要按转完的占位算。
   实测(1600×900):老公式给 hostW = 480×1.02 = 490、hostH = 0.74×900 = 666,
   转完占位 666×490 —— 那一格只有 480 宽,眼睛横过来就顶出去了。
   现在的公式:转完的"长"L ≤ min(屏高 62%, 那一格 × 1.5)。 */
ok('★★★ 转向 90° 之后眼睛要【缩小】(用户第七轮:"不然放不下")',
  /var L = Math\.max\(220, Math\.round\(Math\.min\(vh \* 0\.62, third \* 1\.5, strip\.w \* 1\.8\)\)\);/.test(guideJs) &&
  /var hostW = L;/.test(guideJs) &&
  /var hostH = Math\.max\(120, Math\.round\(L \* 0\.56\)\);/.test(guideJs) &&
  !/third \* 1\.02/.test(guideJs) && !/vh \* 0\.74/.test(guideJs),
  '转完的宽 = 转之前的高:按"转之前的宽 = 那一格"给盒子,转完就溢出那一格');
ok('★★ 缩小的同时字号/列数要跟着重算(不是把画布剪小)',
  /eye\.fitTo\(hostW, hostH \/ 0\.86\)/.test(guideJs) &&
  /function fitTo\(boxW, boxH\)/.test(eyeJs) &&
  /COLS = Math\.max\(16, Math\.floor\(boxW \/ CELL_W\)\)/.test(eyeJs),
  'fitTo 的第二个参数只管行数(按 86% 落地),所以要除回去 —— 否则眼睛上下被切平');

/* ② 按下 → 立刻闭眼。
   原来:按下 → 走完这一拍的尾巴 → 下一拍 setTimeout(380) → 才开始闭(780ms)。
   现在:闭眼挂在【按下那一刻】(盯着 scene-open 轮询),runDock 只等这次闭眼收口。 */
ok('★★★ 按下"进 CD 页"的按钮时,主眼睛【立刻】开始闭(用户第七轮)',
  /function watchDockPress\(\)/.test(guideJs) &&
  /new MutationObserver\(function \(\) \{[\s\S]{0,120}?classList\.contains\("scene-open"\)\) hit\("observer"\)/.test(guideJs) &&
  /if \(next && next\.dock\) watchDockPress\(\);/.test(guideJs) &&
  /if \(document\.body\.classList\.contains\("scene-open"\)\) \{ hit\("poll"\); return; \}/.test(guideJs) &&
  /setTimeout\(poll, 40\)/.test(guideJs),
  '按下到闭眼之间不许再有"等这一拍走完"的延迟 —— 否则屏幕已经滑走了,眼睛还睁着');
ok('★★★ 闭眼只做一次(按下就闭 / runDock 兜底闭,两条路径不打架)',
  /var dockClosing = null;/.test(guideJs) &&
  /function beginDockClose\(\) \{[\s\S]{0,260}?if \(!dockClosing\) \{[\s\S]{0,260}?dockClosing = closeEye\(\);/.test(guideJs) &&
  /startDockSlide\(\);[\s\S]{0,140}?beginDockClose\(\);/.test(guideJs) &&
  /startDockSlide\(\);\s*\n\s*beginDockClose\(\);/.test(guideJs),
  '记忆化:第二次调用拿到的是同一个 Promise,不会再播一遍闭眼');
/* ★ 为什么是 MutationObserver 而不是只靠轮询(第七轮实测):
   后台标签页/主线程忙的时候 setTimeout(40) 会被排到 700ms 之后,
   "按下 → 闭眼"又慢回去了。observer 的回调在 class 变化的同一个任务里,
   实测 1600×900:按下 → 开始闭 = 12ms(hitWhy = "observer")。 */
ok('★★ 闭眼靠"盯 class 的 observer",轮询只做兜底(定时器会被节流)',
  /hit\("observer"\)/.test(guideJs) && /hit\("poll"\)/.test(guideJs) &&
  /attributes: true, attributeFilter: \["class"\]/.test(guideJs),
  '只靠轮询时:实测一次"按下 → 闭眼"花了 875ms(setTimeout 被排到 722ms 之后)');
ok('★★ 左滑不再有 setTimeout(runDock, 380) 那种"发呆"',
  /runDock\(\);\s*\n\s*\}/.test(guideJs) && !/setTimeout\(runDock/.test(guideJs),
  '第七轮:"否则跟不上左滑的速度"');

/* ============================================================
   ★★★ 第八轮(用户逐字):
     "1.把侧边显示的眼睛往右边移一点点.
      2.动画过程按下进入CD页的按钮,会往左滑,然后突然往右滑又回去,
        这个往右滑进入数据库是bug"
   ============================================================ */
/* ① 眼睛的位置:原来按【frame-fit 窗口的右边三分之一】居中 ⇒ 实测 1261,
   而平板真正露出来的玻璃中心是 1382(机身左边那条黑边比 --ff-win-left 宽得多),
   眼睛贴着玻璃左缘。现在按【CD 架露出来的那一条】算。 */
ok('★★★ 侧边那只眼睛按【可见条带】定位(用户第八轮:"往右边移一点点")',
  /function stripLeftX\(vw\)/.test(guideJs) &&
  /document\.querySelector\("\.rack"\)/.test(guideJs) &&
  /var strip = stripBox\(vw, visR\);/.test(guideJs) &&
  /var cx = stripCenterX\(strip, hostW\);/.test(guideJs) &&
  /var cx = strip\.l \+ strip\.w \* 0\.60;/.test(guideJs),
  '实测 1600×900:眼心 1261 → 1382(= 玻璃 [1180,1585] 的中心)');
ok('★★★ 带单位的 CSS 变量不许直接 parseFloat(--rack-w 是 66vw,不是 66px)',
  /function cssLen\(name, dflt\)/.test(guideJs) &&
  /box\.style\.cssText = "position:absolute;left:-9999px;[\s\S]{0,80}?width:var\(" \+ name \+ "\)"/.test(guideJs) &&
  !/cssPx\("--rack-w"/.test(guideJs),
  '踩过:parseFloat("66vw") = 66 ⇒ 眼睛被算到屏幕最左边(实测 ink 中心 986)');
ok('★★ 量不到 CD 架时退回 --rack-w;窄屏时把眼睛压回条带里',
  /if \(r\.left <= 1 && r\.right > vw \* 0\.2 && r\.right < vw \* 0\.9\) return r\.right;/.test(guideJs) &&
  /Math\.min\(stripLeftX\(vw\), vw \* 0\.86\)/.test(guideJs) &&
  /Math\.min\(vh \* 0\.62, third \* 1\.5, strip\.w \* 1\.8\)/.test(guideJs),
  '★ 0.5 那个夹子会把 66vw 的架子夹成半个屏(实测眼心 1280),所以上界给 0.86');

/* ② 进场:摘 .page-out 之前先【瞬移】到右边外面的起点,再松开过渡,让它们向左滑进 CD 页。
   实测(逐帧位移):-1206(左滑) → 2656(站位) → 1914 → 1103 → 1056(落定)
   —— 除了那一次屏幕外的站位,整段只有向左。
   ★ 必须双 rAF:同一个任务里 add/remove 的话,过渡起点还是 -100vw,又会变成向右的滑行。 */
ok('★★★ CD 页要从【右边】滑进来(用户第八轮:"往左滑之后又往右滑回去bug还没修掉")',
  /function enterFromRight\(\)/.test(guideJs) &&
  /docEl\.classList\.add\("guide-enter"\)/.test(guideJs) &&
  /document\.body\.classList\.remove\("page-out"\)/.test(guideJs) &&
  /requestAnimationFrame\(function \(\) \{[\s\S]{0,120}?requestAnimationFrame\(function \(\) \{/.test(guideJs) &&
  /docEl\.classList\.remove\("guide-enter"\)/.test(guideJs),
  '只"摘掉 .page-out"= 从 -100vw 滑回原位,那是一记向右的滑行 —— 用户看得见');
ok('★★★ 换场那一下把过渡按住(四样东西同起同落,少一样就穿帮)',
  /html\.guide-enter \.scene \{[\s\S]{0,160}?transition: none !important;/.test(tcssShell) &&
  /html\.guide-enter \.tablet \{[\s\S]{0,160}?transition: none !important;/.test(tcssShell) &&
  /html\.guide-enter \.statusbar-toggle \{[\s\S]{0,160}?transition: none !important;/.test(tcssShell) &&
  /html\.guide-enter \.home-eye \{[\s\S]{0,80}?transition: none !important;/.test(tcssShell),
  '.scene / .tablet / .statusbar-toggle / .home-eye —— 四条都要按住(和 page-out 那几条一一对应)');
/* ★★★ 踩了很久的一条:注释里嵌注释记号会在第一个结束记号处提前收尾,
   后面的文字被当 CSS 解析,紧随其后的那条规则会被整个吃掉 ——
   实测 html.guide-enter .scene 就是这么凭空消失的(眼睛/机器站位全乱)。 */
ok('★★★ 换场那三条 transform 用 !important 压过 page-out,而且注释不许嵌套',
  /transform: translateX\(calc\(var\(--rack-w\) \+ 100vw\)\) !important/.test(tcssShell) &&
  /transform: translateX\(100vw\) !important/.test(tcssShell) &&
  /transform: translateX\(calc\(-50% \+ 100vw\)\) !important/.test(tcssShell),
  '不加 !important 会被 page-out 那条同属性声明压住(级联),站位就不生效');
ok('★★ 换格与进场在同一帧完成(眼睛不会在"还没到位"的格子上睁眼)',
  /dockIntoBox\(\);[\s\S]{0,200}?eye\.slideX\(vw\);/.test(guideJs),
  '先换格再站到右边,然后一起滑进来');

/* ③ ★★★ 用户第八轮:"左滑后对话间隔太小出字速度太快,跟左滑前设置成一样的。"
   (第七轮我调快过一档:34ms/字 + 句间 0.7s —— 被否了。)
   ⇒ 全篇只有一个档:58ms/字 + 句间 1.5s,左滑前后完全一样。
   实测(正式节奏,每拍排进定时器的延迟):第 1~9 拍中位 58~79ms,
   第 12~15 拍中位 58~76ms,两边的句间停顿都是 1500ms。 */
ok('★★★ 左滑之后那几句话的字速/停顿跟左滑前【完全一样】(用户第八轮)',
  /var TYPE_MS = \(reduced \|\| FAST\) \? \(FAST && !reduced \? 3 : 0\) : 58;/.test(guideJs) &&
  /var afterLine = \(reduced \|\| FAST\) \? 60 : 1500;/.test(guideJs) &&
  !/TYPE_MS_FAST_TAIL/.test(guideJs) && !/typeMs/.test(guideJs) &&
  !/afterLineTail/.test(guideJs) && !/inCdPage/.test(guideJs),
  '第七轮那套"进 CD 页换快档"已经整个删掉 —— 留一个常量就不会再有人偷偷分档');
ok('★★ 字速仍然逐字算(PUNCT 表照旧:省略号最重,逗号一口)',
  /var base = TYPE_MS;/.test(guideJs) &&
  /if \(TYPE_MS <= 0 \|\| forceInstant\)/.test(guideJs) &&
  /"。": 300/.test(guideJs) && /"…": 240/.test(guideJs),
  '快慢可以调,标点那口气不能省');

/* ④ ★★★ 用户第八轮:"按下之后动画结束,直接趁着插CD的动画赶紧闭眼。"
   原来收尾是"把眼睛淡掉"(摘 is-on,0.5s 透明度)—— 看到的是半透明慢慢消失。
   现在:先眨一下闭上(420ms),闭到底再连内容一起收掉。 */
ok('★★★ 收尾时眼睛要【眨一下闭上】(不是慢慢淡掉)',
  /eye\.close\(wink, DOCK_CLOSE_MS\)/.test(guideJs) &&
  /var wink = function \(\) \{ if \(!winked\) \{ winked = true; eyeHost\.classList\.remove\("is-on"\); \} \};/.test(guideJs) &&
  /setTimeout\(wink, DOCK_CLOSE_MS \+ 60\)/.test(guideJs) &&
  /eye\.stop\(\); eyePre\.textContent = "";/.test(guideJs),
  '用户第八轮:"直接趁着插CD的动画赶紧闭眼"');

/* ⑤ ★★★ 用户第八轮:"刚进入首页,背景里面就开始播放第一张CD了。"
   两处会出声的口子都堵上:
     · cd3d 建场景时的首次摆位 → silent
     · 3D 挂载时那次 setSelection 同步 → silent
     · 引导期间打开 CD 页的 previewCurrent → 被总开关挡住
   收尾时把总开关交还(finishGuide 里 __cdPreview(true))。 */
ok('★★★ 开场不许有音乐(用户第八轮)',
  /place\(selIndex, true, true\);/.test(cd3dJs) &&
  /function place\(idx, instant, silent\)/.test(cd3dJs) &&
  /if \(previewAllowed && !silent && audio && cdItems\[idx\]\) audio\.music\.preview/.test(cd3dJs) &&
  /api\.setSelection\(selIndex, true\);/.test(introJs) &&
  /setSelection\(i, silent\) \{/.test(cd3dJs) &&
  /previewCurrent\(\) \{\s*if \(!previewAllowed\) return;/.test(cd3dJs) &&
  /window\.__cdPreview = function \(on\)/.test(introJs) &&
  /if \(window\.__cdPreview\) window\.__cdPreview\(false\);/.test(guideJs) &&
  /if \(window\.__cdPreview\) window\.__cdPreview\(true\);/.test(guideJs),
  '引导这一段(黑屏 + 台词)一点音乐都不该有 —— 实测:只有插盘之后的 toBgm 起播');
ok('★★ 眼睛宿主的位置必须用视口坐标显式给(不能靠 left:auto/right:0)',
  /function anchor\(left, top, width, height\)/.test(eyeJs) &&
  /st\.left = Math\.round\(left\) \+ "px";/.test(eyeJs),
  '宿主不在 .scene 里,不会被那 66vw 的平移带着走 —— 用相对写法算出来的格子不是平板露出来的那一块');

/* ---------- ⑦ 锁的时序:该锁的锁、该解的解 ---------- */
ok('★★★ 上侧下滑栏与 CD 架按钮:锁住鼠标(不允许按下)',
  /lock: true/.test(guideJs) && /function lock\(on\)/.test(guideJs),
  '用户:"吸附到平板上侧的下滑栏(锁住鼠标不允许按下)"');
ok('★★★ "按下它"那一拍要【解锁】(允许按下)',
  /unlock: true/.test(guideJs) && /if \(s\.unlock\) lock\(false\);/.test(guideJs),
  '用户:"按下它(解锁鼠标,允许按下按钮)"');
ok('★★★ "按下"要【让用户自己按】,不是引导代按',
  /press: "\.slot-toggle"/.test(guideRaw) && /press: "#rack-insert"/.test(guideRaw) &&
  /function waitForUser\(sel\)/.test(guideJs) &&
  !/click: "#intro-toggle"/.test(guideRaw) && !/click: "#rack-insert"/.test(guideRaw) &&
  !/dispatchEvent\(new MouseEvent\("click"/.test(guideJs),
  '用户第三轮:"按下按钮并不是自动按,是让用户自己按" —— 引导里不该再有替用户按的代码');
ok('★★★ 要按的目标必须用【看得见的那枚】选择器(.slot-toggle 而不是 #intro-toggle)',
  /press: "\.slot-toggle"/.test(guideRaw) && /snap: "\.slot-toggle"/.test(guideRaw) &&
  /sel === "\.slot-toggle"/.test(guideJs),
  '★★ #intro-toggle 是 screen 右缘那个 <section class="screen-slot"> 里的按钮,' +
  '它被 .screen-frame(z-index 34)与 .slot-seam 盖着 —— 在它身上加高亮等于没加(实测看不见)');
ok('★★★ 台词「按下它。」必须在【点击之前】就打出来',
  (function () {
    var iText = guideJs.indexOf('return typeLine(s.text)');
    var iWait = guideJs.indexOf('tasks.push(function () { return waitForUser(s.press); });');
    return iText >= 0 && iWait >= 0 && iText < iWait &&
      /顺序:【先说话,再等用户按】/.test(guideRaw);
  })(),
  '★★ 用户第六轮:"对话按下它只有点击按钮之后才会触发" ——' +
  '第三轮把"让用户自己按"改进来时,等待被排到了台词【前面】,' +
  '于是这一拍先干等着、按下去之后才把那句台词打出来,完全反了。' +
  '用户给的原顺序本来就是:对话("按下它")→ 动画(按下 → 左滑)');
ok('★★ 高亮与松框仍在这一拍【一开始】就做(它们是那句台词的注解)',
  /window\.__mcScript = null;\s*\n\s*lastSnapSpec = null;\s*\n\s*frameRect = null;\s*\n\s*pulseTarget\(s\.press, true\);/.test(guideJs),
  '提示要跟台词同时在场;但不能等到按完才亮(那时已经没用了)');
ok('★★★ 等用户按时要给【不看扫描框也能看懂】的高亮',
  /function pulseTarget\(sel, on\)/.test(guideJs) &&
  /pulseTarget\(s\.press, true\)/.test(guideJs) &&
  /pulseTarget\(sel, false\)/.test(guideJs) &&
  /\.is-guide-pulse \{[\s\S]{0,160}?animation: guide-glow/.test(tcss),
  '用户第五轮:"扫描框固定在按钮的时候,实际鼠标并不在这里,所以根本就按不了" ——' +
  '现在松框 + 给目标发光,用户看得见自己的指针、也知道该按哪个');
ok('★★ 高亮要用 outline + filter(那枚按钮自己已经写了 box-shadow,再加一条会互相覆盖)',
  /@keyframes guide-glow \{[\s\S]{0,300}?outline: 2px solid/.test(tcss) &&
  /filter: brightness/.test(tcss),
  '而且 outline 不占布局 —— 按钮不会因为"该按了"而抖一下');
ok('★★★ 等用户按的判据是【状态】,不是"有没有接到那次 click"',
  /function makeWaiter\(sel\)/.test(guideJs) &&
  /document\.body\.classList\.contains\("scene-open"\)/.test(guideJs) &&
  /document\.addEventListener\("cd-busy"/.test(guideJs),
  '★★ 靠 document 上的一次性监听抓那一下点击实测抓不到(鼠标事件确实到了页面,' +
  '引导的监听就是没触发),于是"用户明明按了,引导还在等"。改成查结果:CD 架开没开。');
ok('★★ 跳过不能用【鼠标】触发(那会把"按它"读成"跳过它")',
  !/document\.addEventListener\("pointerdown", function \(\) \{\s*\n\s*if \(!playing\) return;\s*\n\s*skip\(\);/.test(guideJs) &&
  /e\.key !== " " && e\.key !== "Enter" && e\.key !== "Escape"/.test(guideJs),
  '★★★ 踩过:用户按 CD 架按钮时产生的 pointerdown 被当成"我要跳过",' +
  'skipping 一置真,后面所有步骤连跑都不跑 —— 症状是"按了按钮,引导停在原地"');
ok('★★★ CD 区域那一拍要【锁滚轮】,下一拍才解',
  /lockWheel: true/.test(guideJs) && /unlockWheel: true/.test(guideJs) &&
  /if \(s\.wheelLock\) lockWheel\(true\);/.test(guideJs) && /if \(s\.unlockWheel\) lockWheel\(false\);/.test(guideJs) &&
  /window\.addEventListener\(t, eat, \{ capture: true, passive: false \}\)/.test(guideJs),
  '用户:"此时需要锁住滚轮" / "滚轮滑动可以上下选择……你能不能消停一会"');
ok('★★ 滚轮锁必须挂在捕获阶段且 cancelable(否则拦不住 intro.js 的换选)',
  /if \(e\.cancelable\) e\.preventDefault\(\);/.test(guideJs) &&
  /e\.stopImmediatePropagation\(\);/.test(guideJs));

/* ---------- ⑧ 收尾:一切恢复正常 ---------- */
ok('★★★ 收尾要把平板关掉(否则开机动画放完看到的是平板主屏)',
  /if \(window\.__tabletOpen\) window\.__tabletOpen\(false\);/.test(guideJs),
  '★ 踩过:只把眼睛和台词淡掉 —— 平板那一层(z-index 40)还压在 CD 页上面,' +
  '于是"按下插入"之后看到的是平板主屏,而不是刚插进去的那张盘');
ok('★★★ 回访那条路也要把黑屏状态摘掉',
  /if \(!shouldPlay\(\)\)[\s\S]{0,700}?tablet\.classList\.remove\("is-dark"\);/.test(guideJs),
  '★ 回访的人下一步就是点顶缘箭头开平板 —— 留着 .is-dark 他看到的是一块黑屏(实测复现过)');
ok('★★★ 收尾必须把平板的黑屏状态摘掉(藏着也会被下次打开翻出来)',
  /tablet\.classList\.remove\("is-dark"\);\s*\n\s*if \(window\.__tabletOpen\) window\.__tabletOpen\(false\);/.test(guideJs),
  '★★ 踩过:平板收起了、但 .is-dark 没摘 —— hidden 后面看不出来,' +
  '可引导走完之后从 CD 页再点开平板,看到的是一块【黑屏】(实测:tablet is-dark is-on,主屏不显示)');
ok('★★★ 顶缘那枚开关在"走到它之前"必须既看不见又点不到',
  /d\.classList\.add\("top-locked"\)/.test(homeTpl) &&
  /html\.top-locked \.statusbar-toggle,[\s\S]{0,80}?pointer-events: none !important;/.test(tcss) &&
  /function lockTop\(on\)/.test(guideJs) && /unlockTop: true/.test(guideJs),
  '★ 用户第五轮:"刚刚进入首页的时候这个上滑栏默认是打开的,导致能透过动画按按钮" ——' +
  '实测它在 t≈1s 时 opacity 已经 0、而 pointer-events 还是 auto(看不见却点得到);' +
  '闸门挂在 <head> 里同步加的 top-locked 上,等 defer 脚本(2.7s)就太晚了');
ok('★★★ 加载页淡出之后不许再吃点击',
  /\.intro-loader\.is-done \{[\s\S]{0,80}?pointer-events: none;/.test(icss),
  '它 opacity:0 之后如果还留着 pointer-events:auto,就是"透过动画按按钮"的另一个来源');
ok('★★★ 鼠标锁与滚轮锁都要解开,剧本矩形与自转倍率都要还原',
  /lock\(false\);/.test(guideJs) && /lockWheel\(false\);/.test(guideJs) &&
  /window\.__mcSpinScale = 1;/.test(guideJs) && /window\.__mcScript = null;/.test(guideJs),
  '用户:"按下后就正常了,所有动画结束"');
ok('★★★ 眼睛要连内容一起清掉(只 stop() 会留下半屏字符)',
  /eye\.stop\(\); eyePre\.textContent = "";/.test(guideJs),
  '它有 is-docked 的内联尺寸,是实打实占位的');
ok('★★ 黑屏底衬要等开机动画把黑屏撤掉那一刻再收',
  /function watchBootEnd\(\)/.test(guideJs) &&
  /new MutationObserver\(function \(\) \{\s*\n\s*if \(staticWrap\.classList\.contains\("is-black"\)\) return;/.test(guideJs),
  '早收会看到机身两侧先亮起来(像屏幕边缘漏光)');

/* ---------- ⑨ 每次都播 + 跳过 ---------- */
/* ★★★ 这一条是用户第三轮报"动画完全没有加载"的真凶之一:
   原来写的是"播过一次就记住、回访不再播",而【我自己的验证探针】
   会往 tuagfey.com 这个域的 localStorage 写这个标记 ——
   于是用户打开线上站,看到的是"眼睛挂了九秒就没了"。
   探针不该有能力改用户的持久状态,所以这个机制整个废掉。 */
ok('★★★ 引导【每次进来都播】,不再往 localStorage 写"播过了"',
  /function shouldPlay\(\) \{ return true; \}/.test(guideJs) &&
  !/localStorage\.setItem\(KEY/.test(guideJs),
  '★ 探针污染过用户的浏览器状态;想跳过的人按任意键即可(skip 那条路照旧在)');
ok('★ 可以跳过(键盘),而且跳过之后不再等"要用户按"的那两拍',
  /function skip\(\)/.test(guideJs) && /if \(skipping\) \{/.test(guideJs),
  '直接结束的话用户会被留在 CD 页上不知道发生了什么,而且平板还在黑屏状态');
ok('★ 留了排障出口(这一段的时序错一点都很难从截图上看出来)',
  /window\.__guide = function \(\)/.test(guideJs) && /window\.__homeEyeApi = eye;/.test(guideJs));

/* ---------- ⑩ 顺手修掉的两个真 bug ---------- */
ok('★★★ 磁力光标:lean 必须声明(少一行整个渲染循环每帧抛异常)',
  /\n    var lean = 0;/.test(mcJs) &&
  (mcJs.match(/var lean = 0;/g) || []).length === 1,
  '★★ 踩过:重写旋转那段时把 var lean 删了,而 targetRot 在 if 外面读它 ⇒ ' +
  'ReferenceError: lean is not defined,每秒 60 次 —— 画布上的扫描框从此一动不动,' +
  '报错全在 rAF 里,不显眼');
ok('★★★ 内联脚本的 JS 压缩必须关掉(hugo.toml)',
  (function () { const i = hugo.indexOf("[minify]"); return i >= 0 && hugo.slice(i).includes("disableJS"); })(),
  '★★ 压缩器会把内层函数的局部变量和外层 IIFE 的压成同一个名字:' +
  'create(eyeEl, …) 拿到一个布尔值 ⇒ 眼睛建不起来,控制台一声不响');
ok('★ 外部脚本一律 defer,而且眼睛在前、接线在后(文档顺序 = 执行顺序)',
  (() => {
    const iEye = homeTplC.indexOf('js/ascii-eye.js');
    const iGuide = homeTplC.indexOf('js/home-guide.js');
    return iEye > 0 && iGuide > iEye &&
      /<script defer src="\{\{ \$eyeJs\.RelPermalink \}\}"><\/script>/.test(homeTpl) &&
      /<script defer src="\{\{ \$guideJs\.RelPermalink \}\}"><\/script>/.test(homeTpl);
  })(),
  'home-guide.js 要用 window.AsciiEye,它必须排在后面');

/* ---------- 汇总 ---------- */
const pass = rows.filter((r) => r[0]).length;
const w = Math.max(...rows.map((r) => r[1].length));
for (const [p, n, i] of rows) {
  console.log(`${p ? '  ✓' : '  ✗'} ${n}${i ? '   [' + i + ']' : ''}`);
}
console.log(`\n${pass}/${rows.length} 通过`);
process.exit(pass === rows.length ? 0 : 1);
