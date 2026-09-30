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
   ⇒ 现在钉的是【三步的顺序】,而不是转多少度。 */
ok('★★★ 进 CD 页 = 闭眼 → 左滑 → 右侧重新睁眼(三步,顺序不能乱)',
  /dock: true/.test(guideRaw) &&
  /function closeEye\(\)/.test(guideJs) &&
  /function dockIntoBox\(\)/.test(guideJs) &&
  /function runDock\(\)/.test(guideJs) &&
  /closeEye\(\)\.then\(function \(\) \{[\s\S]{0,200}?classList\.add\("page-out"\)/.test(guideJs) &&
  /dockIntoBox\(\);[\s\S]{0,200}?eye\.openNow\(\)/.test(guideJs),
  '用户第五轮:"按下左滑后,主屏幕的眼睛马上闭上,等到彻底滑过去后,眼睛再在右侧睁开"');
ok('★★★ 左滑用的是 page-slide 那条过渡(不是自己另画一套)',
  /docEl\.classList\.add\("page-slide"\)/.test(guideJs) &&
  /document\.body\.classList\.add\("page-out"\)/.test(guideJs) &&
  /document\.body\.classList\.remove\("page-out"\)/.test(guideJs),
  '整块机器左移 100vw 的那条 CSS 在 shell.css 第三节 —— 复用同一条,过场才接得上');
ok('★★★ 第五轮取消了旋转(转 90° 之后"跟鼠标"在视觉上是反的)',
  /if \(eye\.rotate\) eye\.rotate\(0\);/.test(guideJs) &&
  !/eye\.rotate\(90\)/.test(guideJs),
  '用户第五轮明确要的是"同一只眼睛换个位置继续跟鼠标" —— 朝向由 setGaze 决定,与旋转无关');
ok('★★ 闭眼要等它真的闭到底(不是拍一下就开始滑)',
  /eye\.close\(fin\)/.test(guideJs) && /setTimeout\(fin, \(eye\.T_CLOSE \|\| 780\) \+ 400\)/.test(guideJs),
  '闭眼动画 780ms;不等它跑完就滑,用户会看到"眼睛还睁着就飞走了"');
ok('★★★ 那一格的分母是【玻璃的宽】,不是视口的宽',
  /cssPx\("--ff-win-left"/.test(guideJs) &&
  /var glassW = Math\.max\(320, vw - winL - winR\)/.test(guideJs) &&
  /var third = glassW \/ 3;/.test(guideJs) &&
  /var left = Math\.max\(winL \+ \d+, visR - hostW - \d+\)/.test(guideJs),
  '★★ 第一版写 left:auto/right:0/width:33vw(视口右边三分之一)⇒ 整只眼睛压在 CD 盘面上(截图里就是)');
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
