/* ============================================================
   第五张盘「未来」的主页内容:夜窗 · 极光 · 记忆碎片
   ─────────────────────────────────────────────────────────────
   一句话(方案由用户给):
     你坐在温暖的室内,看着一扇结满冰霜的窗。窗外是夜空、极光和慢雪。
     鼠标靠近的地方,霜被"暖"化、化成水滴滑下来;霜底下浮出半透明的记忆碎片。
     点开一片,它飞到屏幕中央放大、显出文字;收下的碎片变成夜空里的一颗星。
     同主题的星连成星座;全部收齐 —— 中央浮出未来宣言,窗外亮起极光。

   ★★ 这一版推翻了两件事,都记在这里,免得以后又绕回去 ★★

   ① 【霜不再"结回来"】。上一版是"擦开 → 停手结回 → 再擦,像记忆"。
      这一版是收集玩法:霜要是自己长回来,收过的碎片会被重新盖住,
      和"集齐十二片"直接打架;而且用户这一版的叙事是单向的 ——
      窗被暖开了就是暖开了。所以融化【不可逆】。
   ② 【霜不能是方块】。上上版每个 7px 格子画一个色块,用户的原话是
      "像素风格的整体美感好不到哪去,也不搭"。霜现在由线段构成
      (密针 / 羽状小蕨 / 六角枝晶,见 buildFrost),而且只在尺寸变了才画一次。

   ★ 三个必须成立的点:
     1) 一划就要有反应 —— 融化逐格即时生效,不是等一整笔算完。
     2) 霜要"看着像霜,又能看清窗外" —— 所以霜是【成片、有厚有薄】的:
        厚处几乎不透(白),薄处基本没结霜。不是一层均匀的磨砂膜。
     3) 字要真的在霜底下 —— 每片碎片的可见度 = 它那一带的覆霜量,是连续值。
   ============================================================ */
(function () {
  "use strict";

  var CELL = 7;             /* 覆霜场的格子边长(CSS px)。越小越细腻、越费 */
  var WARM_R = 62;          /* "暖"的作用半径(屏幕像素)。
                               ★ 原来 96,用户说"融化的范围还可以再小一点" */
  var MELT_HIT = 0.075;     /* 指针停留够久之后,正中心一次化掉多少 */
  var MELT_DWELL = 0.007;   /* 停着不动时每帧继续化多少(手心的温度)*/
  /* ★ 前置停留:指针要在几乎同一个点上待够这么久才开始化。
     用户的原话:"融化的判定最好加个前置时间,鼠标靠近大于 0.25 秒才能开始融化,
     不然开幕就会有一小部分开始融化了"。顺带的好处是——鼠标只是【路过】时
     不再留下一串化痕。按住不放(触摸/拖动)算明确动作,不受这条限制。 */
  var DWELL_MS = 250;
  var DWELL_SLOP = 14;      /* "同一个点"的容差(像素)*/
  var TEXT_STRIDE = 2;      /* 算"这一带的覆霜量"时隔几格取一个样本 */
  var TICK = 40;            /* 环境帧间隔(飘雪 / 水滴)—— 25fps,够用且省 */
  var SNOW_N = 130;         /* 雪花数 */
  var SNOW_SLANT = -0.34;   /* 雪的斜度:横向速度 = 纵向速度 × 这个值(负 = 往左下)*/
  var SNOW_SPD_MIN = 1.1;   /* 每帧下落多少【设备像素】(用户嫌原来太慢)*/
  var SNOW_SPD_MAX = 2.8;
  var DRIP_MAX = 44;        /* 同时存在的水滴上限 */
  /* 霜化到这个程度,碎片才可以点。
     ★ 原来是 0.50,但实测"来回擦好几遍"也就到 0.49 左右 —— 门槛卡在
       用户刚好够不着的地方,看起来就是"擦开了却点不动"。降到 0.42。 */
  var OPEN_AT = 0.42;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function slice(nl) { return Array.prototype.slice.call(nl); }

  function build(root) {
    var cv = q("[data-frost-cv]", root);
    var layer = q("[data-frost-shards]", root);
    var skyCv = q("[data-frost-sky]", root);
    var aurCv = q("[data-frost-aurora]", root);
    var snowCv = q("[data-frost-snow]", root);
    var mapEl = q("[data-frost-map]", root);
    var glintLayer = q("[data-frost-glints]", root);
    var glintEls = [];
    var headEl = q(".frost-head", root);
    var hintEl = q("[data-frost-hint]", root);
    var countEl = q("[data-frost-count]", root);
    var readEl = q("[data-frost-read]", root);
    var readCard = q("[data-frost-readcard]", root);
    var readText = q("[data-frost-readtext]", root);
    /* ★★ 这里曾经是 q("[data-frost-readmark]", root) —— 而 future.html 里那个
       <span> 只有 class="frost-read__mark",【没有】data-frost-readmark 属性。
       于是 readMark 在浏览器里恒为 null,`if (readMark && ...)` 永远不成立,
       整个飞行分支一次都没跑过:用户连着三轮说"没有动画",这是最后一层原因。
       ★ 为什么测试是绿的:我的假 DOM 是【照着我以为的 HTML】手搭的,
         里面给那个 span 补上了 data-frost-readmark ——
         量具把被测对象的接口【替它圆了谎】。
         这比前面那个 getBoundingClientRect 的坑更隐蔽:那一个是【行为】不对,
         这一个是【契约】不对,而契约错了以后每一行代码看起来都是对的。
       ★ 修法两条一起上:
         ① 选择器按 class 找(和模板一致,class 本来就是这个槽的语义);
         ② 测试改成从 future.html 里抠出真实标记再比对,不再手搭 ——
            模板和量具从此不可能各自漂移。 */
    var readMark = q(".frost-read__mark", root);
    var doneEl = q("[data-frost-finale]", root);
    var shards = slice(root.querySelectorAll("[data-frost-shard]"));
    if (!cv || !layer || !shards.length) return null;

    var ctx = cv.getContext("2d");
    var W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
    var cov = null;                    /* 覆霜量 1 → 0(单向,融化不可逆)*/
    var bA = null, bAw = 0, bAh = 0;   /* "厚薄"噪声:大片那一层 */
    var bB = null, bBw = 0, bBh = 0;   /* 中间那一层 */
    var bC = null, bCw = 0, bCh = 0;   /* 细的那一层 */
    /* 渲染层(见 paintFrost 上面的注释):
       tex    静态冰晶纹理(白 on 透明,只在尺寸变了才重画)
       covCv  低分辨率覆霜场(每格一个像素),脏了才重画 —— 很小 */
    var tex = null, texCtx = null;
    var covCv = null, covCtx = null, covImg = null;
    var zone = [];                     /* 每片碎片落在哪几行几列格子(量尺寸时算一次)*/
    var starAt = [];                   /* 每片碎片对应的那颗星:{x,y}(0..1 比例)*/
    var collected = [];                /* 收下了没有 */
    var themeOf = [];                  /* 碎片 → 主题。★ 主题 → 图案序号由 patternFor 现算,
                                          不再另存一份编号数组:两份编号迟早会对不上。 */
    var openIdx = -1;                  /* 正在中央放大看的那一片 */
    var openMark = -1;                 /* 槽里现在放着哪一片的形状 */
    var dialogT = 0;                   /* 收下之后收尾的定时器(收起读数层) */
    var markFrom = -1;                 /* 槽里那片形状还在"从碎片飞来"的路上 */
    var flake = [], drip = [];
    var warm = { on: false, x: 0, y: 0, type: "mouse", ax: -9999, ay: -9999, since: 0 };
    var dirty = false;                 /* 覆霜场变了 → 下一帧要重画霜 */
    var active = false, raf = 0, timer = 0, kept = 0, pressing = false, captured = false;
    var downX = 0, downY = 0, dragDist = 0;   /* 用来区分"点一下"和"拖着划" */
    var meltCalls = 0, lastMelt = null;   /* 只给验收脚本看:最后一次"暖"打在哪 */
    /* 系统开了"减少动态效果"→ 雪不飘、极光不晃(见 CSS 的 media query)*/
    var reduced = false;
    try { reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { reduced = false; }
    var diag = [];                     /* 每帧的"每片碎片覆霜量"快照,只给验收脚本看 */

    function idx(c, r) { return r * cols + c; }
    function halton(n, b) { var f = 1, r = 0; while (n > 0) { f /= b; r += f * (n % b); n = Math.floor(n / b); } return r; }
    /* 画布尺寸:CSS 盒子 = 传入的【CSS 尺寸】;后备缓冲按 dpr 放大(HiDPI 才不糊)。
       ★★ 这两件事必须【分开写】。以前 cv 传进来的是 W*dpr,于是 CSS 盒子也被写成
          W*dpr —— 在 dpr=2 的屏幕上,霜那张画布会变成面板的两倍大:
          只露出左上四分之一,而且一格从 7px 变成 14px,而 measureZones/covAt/
          melt 全都按"一格 7 CSS px"算 —— 结果就是用户报的
          "霜在光标底下化了,可底下那片字不亮、点不动"。
          这个是子代理做只读排查时量出来的(它在 dpr=1/1.25/2 下真跑了模块)。 */
    function sizeCanvas(c, wCss, hCss) {
      if (!c) return null;
      c.width = Math.max(1, Math.round(wCss * dpr));
      c.height = Math.max(1, Math.round(hCss * dpr));
      c.style.setProperty("width", Math.round(wCss) + "px");
      c.style.setProperty("height", Math.round(hCss) + "px");
      return c.getContext("2d");
    }

    /* ---------- 一个"柔和的点"(雪花用它)----------
       ★ 别用"方框套方框":在 1~8 像素这种尺寸下,方框的四个角会露出来 ——
         自检放大图里,一片雪就是"带边框的小方块",用户说"雪花跟流星一样",
         根子在这儿(不是大小、也不是速度)。
         这里用:一个核 + 一个"十"字光晕(横竖两笔)+ 最中心一点白。
         十比方的角少得多,缩到 3 像素时看起来是圆的。 */
    function softDot(c, x, y, r, a) {
      c.fillStyle = "rgba(226, 238, 255, " + (a * 0.26).toFixed(3) + ")";
      c.fillRect(x - r * 1.8, y - r * 0.40, r * 3.6, Math.max(1, r * 0.80));
      c.fillRect(x - r * 0.40, y - r * 1.8, Math.max(1, r * 0.80), r * 3.6);
      c.fillStyle = "rgba(226, 238, 255, " + (a * 0.58).toFixed(3) + ")";
      c.fillRect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
      c.fillStyle = "rgba(248, 252, 255, " + a.toFixed(3) + ")";
      c.fillRect(x - r * 0.34, y - r * 0.34, Math.max(1, r * 0.68), Math.max(1, r * 0.68));
    }

    /* 两张离屏画布。取不到 2d 上下文就退化成"没有霜"——
       不白屏、不抛错(真机上不该发生,但别让它把整页带崩)。 */
    tex = document.createElement("canvas");
    texCtx = tex.getContext("2d");
    covCv = document.createElement("canvas");
    covCtx = covCv.getContext("2d");
    /* ★ 这里原来还有一张极光噪声场的离屏画布(aurOff / aurImg)。
       手写那版极光删掉之后(用户:"为什么老极光还没删"),它们没有用了。 */

    for (var si = 0; si < shards.length; si++) {
      collected[si] = false;
      themeOf[si] = shards[si].getAttribute("data-theme") || "";
    }
    /* 每片碎片配一个"反光"(单独一层,见 future.html 的注释):
       它比碎片大一圈,闪到最亮时能把碎片整个盖住 —— 那就是"提示"。 */
    if (glintLayer) {
      for (var gi = 0; gi < shards.length; gi++) {
        var gEl = document.createElement("i");
        gEl.className = "frost-glint";
        glintLayer.appendChild(gEl);
        glintEls.push(gEl);
      }
    }

    /* 窗外 ①:夜空 + 地面剪影(画一次,之后不动)
       ★★ 这一层【一颗背景星都不画】。用户的原话是:
           "天上的星星是收下碎片后才出现的"、"背景的星星像贴图一样,背景融不进去"。
           —— 原来那一堆程序生成的小点是"布景",而这一页的星星应该是【观众收下的】。
           所以星空 = `.frost-map` 那一层里那十二颗,一开始天上是空的。
       ★ 地面:用户看了第一版说"太丑了,做成黑色的剪影。现在跟海面一样,
         而且把地面再往下放一点"。为什么像海面:上亮下暗的【平滑渐变】+ 一条
         横贯画面的【亮边】,那就是水面反光的读感。
         所以改成:近黑的剪影铺满,只在山脊最上缘留一道极细的冷光;
         地平线从 73.5% 下移到 80%(留出更多天空)。
       ============================================================ */
    function buildSky() {
      var s = sizeCanvas(skyCv, W, H);
      if (!s) return;
      /* 后备缓冲是 W*dpr × H*dpr,所以这里一律用【设备像素】作图 */
      var DW = W * dpr, DH = H * dpr;
      /* 地平线高度(用户要求往下放)。
         ★★ 第三轮:0.80 → 0.73。用户第三次说"地面剪影还是一条直线",
            而我前两轮都在改【脊线的形状】—— 改错了地方。真正的原因是
            **地面那一带太扁**:地平线在 0.80 时,地面只占画面最下面 20%,
            真面板 390px 上就是 78px,而 78px 里还要容下 .frost-hint 那行提示语。
            一条只有 78px 高的暗带里画不出山 —— 不管脊线多弯,它都是一条线。
            所以把地平线【抬上去】给地面让出高度:0.73 ⇒ 地面占 27%(105px),
            脊线峰谷差能拉开到 40px 以上,远脊也才有地方露出来。
         ★ 这个数被三处依赖,改它必须三处一起改(都在这个文件里):
            buildSky 的 HOR、极光着色器的 HZ 与 MIN_ALT、CSS 的 .frost-ground
            高度 27% 与那几个百分比断点。测试里有断言钉着这三处一致。 */
      var HOR = DH * 0.73;
      var BANDS = 150;
      for (var b = 0; b < BANDS; b++) {
        var t = b / (BANDS - 1);
        /* ★★ 第四轮:天光【并进天空本身】,不再单独铺一层。
           用户第三次说"地面这是什么玩意,怎么还搞出海了"。
           我上一版是在地平线上方单独铺了一条"天光带" ——
           只要它是【一层等亮的横带】,不管多淡,它读起来就是水面反光:
           一条横贯全宽的亮带 + 下面一片蓝灰 = 海。
           所以现在把"靠地平线更亮"直接写进天空的纵向曲线里:
             lift = (0.12 + 0.88·t²)·(0.35 + 0.65·smoothstep) ——
           越靠地平线越亮,而且是一条【连续上升的曲线】,没有任何等亮的段。
           最亮处 rgb(13,23,46)(亮度约 27),10% 高度处只有 rgb(4,7,16) ——
           峰值在地平线,单调向上变暗,所以它读成"天光",不是"一条带"。 */
        var lift = (0.12 + 0.88 * t * t) * (0.35 + 0.65 * (t * t * (3 - 2 * t)));
        var r = 4 + 9 * lift, g = 7 + 16 * lift, bl = 16 + 30 * lift;
        s.fillStyle = "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
        s.fillRect(0, Math.floor(b * HOR / BANDS) - 1, DW, Math.ceil(HOR / BANDS) + 2);
      }
      /* ============================================================
         地面剪影:两道山脊 + 一块有厚度的暗面
         ─────────────────────────────────────────────────────────────
         ★★ 用户第二次说地面不对。第一次他说"现在跟海面一样",我给了
            "上暗下更暗 + 一条 1px 冷光边";第二次他说得更准:"地面的剪影就是一条线"。
         ★ 病根不在颜色,在【结构】。一个剪影要成立,需要三样东西:
             ① 一条【起伏的边】(有峰有谷,不是一条水平线);
             ② 边之下的【大块暗面】(有厚度,占画面的下半部分);
             ③ 边【后面】还有一层(远脊),不然那块暗面就是贴在地平线上的一张纸。
           我上一版只有 ① 的弱化版(振幅 0.045H 的低频正弦)+ ② 的一半,
           而 ③ 完全没有 —— 所以它读起来是一根压在地平线上的线,不是"远处的山"。
         ★ 这一版(第二次改):
             · 山脊振幅从 0.045DH 提到 0.085DH —— 面板高 390px 时峰能比地平线
               高出约 27px,是画面的 7%。0.045DH 那版只高出 14px,
               在地平线附近就是"一条线"(用户的原话);
               周期性正弦不取整数倍(3.1 / 7.3 / 1.6),免得峰谷规律地排队;
             · 远脊压在近脊【后面】:同一组波收窄、整体下移一点点,于是它只在
               近脊的谷口露出一条 —— 它比近脊【亮】、比天空【暗】。实测像素:
               远脊 rgb≈(24,34,55) 亮度 37,近脊脊线 rgb≈(7,10,19) 亮度 12,
               天空 17~18。"远 / 近"是靠【色调层次】读出来的,不是靠高度差 ——
               ★ 别反过来让远脊比近脊高,那样它就成了前面那座山;
             · 山脊上那道 1px 冷光【删掉了】。它原来既不是地面也不是天光的来源,
               删掉之后边缘靠"暗剪影 / 亮天光"本身的对比立住,反而更干净。
         ★ 图层顺序:天空 → 天光 → 远脊 → 近脊。远脊【必须】在天光之后画:
           先画的话天光会把远脊洗掉(它是半透明叠加),纵深就没了。
         ★ 山脊高度有个【硬上限】,不是想抬多高就抬多高:
           .frost-hint 那行提示语压在画面底部(bottom = 窗台 + 余量 ⇒
           实测它的顶端约在 0.79H)。山脊高过它就从"地面"变成"压在提示语上的黑影"。
           地平线在 0.73 之后,留给山脊的余量是 0.73→0.79 这 6%H ——
           所以振幅取 0.044/0.024/0.032,叠起来最高把峰抬到约 0.66H,够用且不越界。
         ============================================================ */
      function groundTop(x, back) {
        var t = x / DW;
        /* 近脊:三组正弦,周期互不成整数倍。
           ★★ 相位被整体挪了 -1.6 弧度 —— 这一个数是量出来的,不是凑的:
              原来三组的峰正好错开,叠加后的最高点只到 75.1%H,
              而地平线在 73.0%H —— 也就是说【山脊从来没有高出过地平线】,
              它只是在地平线下面起伏。难怪怎么看都是"一条线":
              一条平的天际线 + 一条起不来的脊,合起来就是一条线。
              把三组一起平移之后,峰到了 0.66H,真正立在地平线之上;
              周期没动(仍然互不成整数倍),所以峰谷还是不规则。 */
        var h = Math.sin(t * 3.1 + 0.7 - 1.6) * 0.088
          + Math.sin(t * 7.3 + 2.1 - 1.6) * 0.034
          + Math.sin(t * 1.6 - 1.6) * 0.070;
        if (back) {
          /* 远脊:同一组波收窄 + 整体下移一点 —— 大部分藏在近脊后面,只露谷口。
             靠近画布两侧再压回地平线:远处的地平线在风景里都【往两头收】。 */
          h = h * 0.62 + Math.sin(t * 2.2 + 3.4) * 0.013 - 0.004;
          h *= 0.55 + 0.45 * Math.sin(Math.PI * t);
        }
        return HOR + h * DH;
      }
      var SX = Math.max(2, Math.round(dpr * 2));
      /* ① 远脊:亮一点、淡一点 —— 它是"另一座山在后面",不是地面本体 */
      for (var xb = -SX; xb < DW + SX; xb += SX) {
        var gyb = groundTop(xb + SX * 0.5, true);
        s.fillStyle = "rgb(26, 36, 58)";
        s.fillRect(xb, gyb, SX, Math.max(1, DH - gyb));
      }
      /* ② 近脊:一块有厚度的暗面。
         ★★ 第三轮的关键修改:整体【压到近黑】。
            实测改之前(820×512 的 onlysky 渲染):山脊段亮度 26.4、天空段 31.4 ——
            只差 16%,再叠上山脊自身那一点点起伏,整块地面就是一条【看不出起伏的暗带】。
            用户说"地面剪影还是一条直线",量出来正是这个:**峰谷差 0px**。
            所以病根不是"脊线不够弯",是【剪影和背景的对比不够】:
            剪影要成立,它必须显著暗于身后的天。
            现在脊线处 rgb(4,6,12)(亮度约 7),对面天空 27~32 ⇒ 对比 4 倍以上,
            那 40px 的峰谷起伏才看得见。
         ★ 从脊线往下【不再变亮】:原来写成"先压暗再加深"是想做立体感,
           但那点立体感在 390px 的面板上根本读不出来,反而把对比吃掉了。 */
      for (var x = -SX; x < DW + SX; x += SX) {
        var gy = groundTop(x + SX * 0.5, false);
        var g = s.createLinearGradient(0, gy, 0, DH);
        g.addColorStop(0, "rgb(4, 6, 12)");
        g.addColorStop(0.55, "rgb(3, 5, 10)");
        g.addColorStop(1, "rgb(2, 3, 7)");
        s.fillStyle = g;
        s.fillRect(x, gy, SX, Math.max(1, DH - gy));
      }
    }

    /* ============================================================
       窗外 ②:极光
       ─────────────────────────────────────────────────────────────
       ★★ 这一版是重写的。上一版用"屏幕竖条 × 横向高斯"画,画出来是一条条横带,
          用户的原话:"极光太丑了,而且一点也不真实,你说它是背景我都行,
          看看网上有没有正经模拟极光的代码"。
       ★ 真实的极光为什么是"竖直的帘子"而不是横带:
         它是一层几十到几百公里高的发光气体,视线穿过去时【沿视线方向】累积发光,
         从地面看上去就是一片片竖着的帘幕;帘幕的底边(裙边)最亮,
         往上逐渐散开变淡;颜色按高度分层——低处是最强的绿色(557.7nm 氧原子),
         上面过渡到红/紫(630nm 氧原子、氮分子)。
       ★ 所以这一版按"场"来画,而不是按"条"来画:
           ① 在一张【小分辨率离屏画布】上逐像素算噪声场(约面板的 1/3),再平滑放大 ——
              和霜的覆霜场同一套办法(小图 + drawImage 平滑放大),所以看不出格子;
           ② fBm 噪声:中频一层定"一条条帘幕",高频一层定"细射线";
           ③ domain warp:用一层更低频的噪声把帘边【推弯】,帘子才会飘,不是竖线;
           ④ 纵向:以"裙边"为中心的高斯 × 底边加权;颜色按高度绿→青→紫。
         这都是实时渲染里极光着色器的通行做法(噪声场 + 竖直衰减 + 颜色梯度),
         这里只是把它落到 2D 的 ImageData 上。
       ============================================================ */

    /* 值噪声:整数哈希 + 五次平滑插值。
       ★ 哈希【不用 sin(dot())】那一套:sin 版在不同精度/平台上结果会飘,
         而且慢。这里用 fract 混合那一版(出处见 aurora-algorithm-research.md §2.1)。
       ★ 五次插值(6t⁵-15t⁴+10t³)而不是线性/三次:方格边界看不出来。 */
    function fr(v) { return v - Math.floor(v); }
    function h12(x, y) {
      var a = fr(x * 0.1031), b = fr(y * 0.1030), c = fr(x * 0.0973);
      var d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
      return fr((fr(a + d) + fr(b + d)) * fr(c + d));
    }
    function vnoise(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      var uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      var a = h12(ix, iy), b = h12(ix + 1, iy), c = h12(ix, iy + 1), e = h12(ix + 1, iy + 1);
      var p = a + (b - a) * ux, q = c + (e - c) * ux;
      return p + (q - p) * uy;
    }
    /* fBm:每个倍频【旋转 36.87° 并平移】去相关 —— 不这么做,各层的格子会对齐出
       一张肉眼可见的网格(这叫"贴图感")。lacunarity 用 2.03 而不是 2:整数倍频
       同样会让各层格子重合。 */
    var FC = Math.cos(0.6435), FS = Math.sin(0.6435);
    function fbm(x, y, o) {
      var v = 0, amp = 0.5;
      for (var i = 0; i < o; i++) {
        v += amp * vnoise(x, y);
        var nx = FC * x - FS * y, ny = FS * x + FC * y;
        x = nx * 2.03 + 19.7; y = ny * 2.03 + 7.3;
        amp *= 0.5;
      }
      return v / (1 - Math.pow(0.5, o));
    }
    function cl01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function sstep(a, b, x) { var u = cl01((x - a) / (b - a)); return u * u * (3 - 2 * u); }
    function mixC(a, b, u) {
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }

    

    /* ============================================================
       极光:直接跑用户给的那份 GLSL(assets/shaders/aurora.glsl)
       ─────────────────────────────────────────────────────────────
       ★★★ 用户的原话:"算了,你样式也用那个,直接照搬,你这个什么玩意。"
           这一节是【唯一】的极光实现。
       ★★ 第六轮用户又问:"为什么老极光还没删?" —— 问得对。
           那一版手写的 2D 噪声场(原 buildAurora)我当初留作"WebGL 不可用时的降级",
           但它根本当不了降级:
             · 它画的是【完全不动的静态图】,正是用户嫌"像彩虹"的那一版;
             · 更要紧的是它和着色器结果【会一起显示】—— 那不是降级,是两版叠着放,
               用户看到的依然是那张彩虹图叠在真极光旁边。
           所以整段删掉了(连它的离屏画布 aurOff/aurImg 一起)。
           没有 WebGL 时会怎样?天空还有 buildSky 那一层(渐变 + 天光 + 地形剪影),
           窗外不会空 —— 那才是真正的降级路径。
       ★ 几点工程上的取舍,写在这儿免得以后有人问"为什么不直接用整屏":
         · 半分辨率渲染:这个片元着色器每像素要跑 256 步 raymarch、
           每步一个 8 次迭代的 fbm —— 全分辨率在这个面板尺寸下会掉帧。
           雪那一场也是这么做的(见 cd-boot.js 的 gw/gh)。
         · 每帧渲染一次:极光在动(iTime)。它是独立的一张小画布,
           和霜/雪/星图各自独立,不影响它们的脏检查。
         · 加载是异步的(preload → fetch → 编译),第一帧很可能拿不到 ——
           那几帧窗外就是 buildSky 的天空,加载好了自动接上。
       ============================================================ */
    var AUR_URL = (window.__SHADERS && window.__SHADERS.aurora) || "/shaders/aurora.glsl";
    var AUR_SCALE = 0.5;               /* 渲染分辨率系数(见上面第 1 条)*/
    var aurT0 = 0;                     /* 着色器 iTime 的原点(激活那一刻)*/
    /* ★★ 收下动画的三段时长,必须和 CSS 对齐(改一处要改两处,测试钉着):
         MOTE_MS 碎片收拢 + 光点升上去       ← .frost-read__mark.is-kept::after 的 shardMote 1s
         CARD_MS 从挂类算起,卡片开始淡出的时刻 ← .frost-read__card.is-flying 里 cardOut 的延迟 1s
         KEEP_MS 全部结束、收尾摘类           ← 1s + cardOut 的 .3s + 读数层淡出的余量
       ★ 为什么 is-off 要等到 CARD_MS 才挂:它带 `animation: none`(给收尾用的),
         和 is-kept 同一拍挂上会把光点动画当场取消 —— 上一版就是这么"什么都没有"的。 */
    var MOTE_MS = 1000;
    var CARD_MS = 1300;
    var KEEP_MS = 1450;
    var aurReady = false, aurFailed = false;
    var aurPreloading = false, aurFrames = 0, aurLastErr = "";
    function preloadAurora() {
      if (aurReady || aurFailed || aurPreloading) return;
      if (!window.CDBootGlsl) {
        /* ★ 宿主还没到(defer 顺序理论上保证它在前面,但不值得赌):
           下一帧再试,而不是静默什么都不做 —— "宿主不在"曾经就是极光不出现的一个可能原因。 */
        if (!aurPreloading) { aurPreloading = true; setTimeout(function () { aurPreloading = false; preloadAurora(); }, 80); }
        return;
      }
      aurPreloading = true;
      window.CDBootGlsl.preload("aurora", AUR_URL).then(function (ok) {
        aurPreloading = false;
        if (ok) aurReady = true; else { aurFailed = true; aurLastErr = "preload 失败(拿不到 " + AUR_URL + ")"; }
      })["catch"](function (e) {
        aurPreloading = false; aurFailed = true; aurLastErr = "preload 抛错: " + e;
      });
    }
    /* 跑一帧真着色器;成功返回 true,失败(还没加载好/编译不过)返回 false */
    function paintAuroraGlsl(t) {
      if (!aurReady || !window.CDBootGlsl || !aurCv) return false;
      var gw = Math.max(64, Math.round(W * AUR_SCALE));
      var gh = Math.max(40, Math.round(H * AUR_SCALE));
      var gl = null;
      try {
        gl = window.CDBootGlsl.render("aurora", AUR_URL, t, gw, gh);
      } catch (e) {
        aurFailed = true; aurLastErr = "render 抛错: " + e; return false;
      }
      if (!gl) { aurFailed = true; aurLastErr = aurLastErr || "render 返回空(多半是着色器编译失败,看控制台的 [boot-glsl])"; return false; }
      var a = aurCv.getContext("2d");
      if (!a) { aurLastErr = "aurora 画布拿不到 2d 上下文"; return false; }
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.globalCompositeOperation = "source-over";
      a.globalAlpha = 1;
      a.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in a) a.imageSmoothingQuality = "high";
      a.clearRect(0, 0, aurCv.width, aurCv.height);
      a.drawImage(gl, 0, 0, gw, gh, 0, 0, aurCv.width, aurCv.height);
      aurFrames++;
      return true;
    }
    /* ★★ 极光的现场读数 —— 和 __frostMark 同一个用意:
       我在这个环境里看不到页面,所以必须留一个"一眼问出答案"的口子。
       打开 CD-05 那一页,控制台执行:
           __frostAurora()
       它会说清楚:宿主在不在、着色器加载到哪一步、渲染了几帧、
       画布多大、那一层是不是被 CSS 藏起来了(opacity/blend)。 */
    window.__frostAurora = function () {
      var cs = null;
      try { cs = aurCv ? window.getComputedStyle(aurCv) : null; } catch (e) { }
      return {
        host: !!window.CDBootGlsl,
        url: AUR_URL,
        ready: aurReady,
        failed: aurFailed,
        err: aurLastErr || "(无)",
        frames: aurFrames,
        canvas: aurCv ? { w: aurCv.width, h: aurCv.height } : null,
        panel: { W: W, H: H },
        css: cs ? { opacity: cs.opacity, blend: cs.mixBlendMode, zIndex: cs.zIndex, display: cs.display } : "(没有 getComputedStyle)",
        reducedMotion: reduced,
        active: active
      };
    };

    /* ============================================================
       霜:静态冰晶纹理(线段画一次)+ 覆霜场(脏了才重画)
       ★★ 上上版是【每个 7px 格子画一个方块】,用户说"像素风格…也不搭"。
          这一站的语汇是细线 / 辉光 / 矢量,所以霜由线段构成,三级尺度:
            密针(颗粒)→ 羽状小蕨(中景)→ 六角枝晶(点缀,和开机动画同一个形状)。
       ============================================================ */
    function buildFrost() {
      var TW = Math.max(1, cv.width), TH = Math.max(1, cv.height);
      tex.width = TW; tex.height = TH;          /* 赋值即清空,也重置了 ctx 状态 */
      var t = texCtx;
      if (!t) return;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = "source-over";
      t.globalAlpha = 1;
      t.lineCap = "round";
      t.clearRect(0, 0, TW, TH);

      /* ① 乳白薄膜:霜的"体"。★ 别做厚 —— 厚了整个屏幕就退化成一张白纸。
         0.50 是"霜明显看得见、窗外也还看得清"的那个位置(0.24 太薄像脏玻璃,
         0.7 以上窗外就糊没了)。 */
      t.fillStyle = "rgba(206, 226, 246, 0.50)";
      t.fillRect(0, 0, TW, TH);

      var s0 = 0x9e3779b9 | 0;
      function rnd() { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; s0 |= 0; return ((s0 >>> 0) % 1048576) / 1048576; }

      /* 低频"厚薄"场:这一层决定哪里"几乎没结霜"(能看清窗外)*/
      var DW = 11, DH = 8;
      var densA = new Float32Array((DW + 1) * (DH + 1));
      for (var q2 = 0; q2 < densA.length; q2++) densA[q2] = 0.22 + rnd() * 0.78;
      function dens(x, y) {
        var fx = Math.min(DW - 1e-4, Math.max(0, x / TW * DW)), fy = Math.min(DH - 1e-4, Math.max(0, y / TH * DH));
        var x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
        var i0 = y0 * (DW + 1) + x0;
        var a = densA[i0], b = densA[i0 + 1], c = densA[i0 + DW + 1], d = densA[i0 + DW + 2];
        return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
      /* 大画布要减密:线段数按面积涨,不控制的话大屏上建纹理会有一次卡顿 */
      var thin = Math.min(1, 1400000 / (TW * TH));
      var k = 1 / Math.sqrt(Math.max(0.08, thin));

      var buckets = [[], [], [], [], []];
      var ALPHA = [0.05, 0.09, 0.15, 0.23, 0.34];
      function seg(x1, y1, x2, y2, lvl) { var b = buckets[lvl]; b.push(x1, y1, x2, y2); }

      /* ② 密针:颗粒层 */
      var S1 = Math.max(3, Math.round(2.1 * dpr * k));
      for (var y = -S1; y < TH + S1; y += S1) {
        for (var x = -S1; x < TW + S1; x += S1) {
          var px = x + rnd() * S1, py = y + rnd() * S1;
          var d0 = dens(px, py);
          if (rnd() > 0.30 + d0 * 0.62) continue;
          var ang = (rnd() * 3 | 0) * (Math.PI / 3) + (rnd() - 0.5) * 0.5;
          var len = dpr * (1.6 + rnd() * 4.0);
          var lv = d0 < 0.35 ? 0 : d0 < 0.55 ? 1 : d0 < 0.78 ? 2 : 3;
          var hx = Math.cos(ang) * len * 0.5, hy = Math.sin(ang) * len * 0.5;
          seg(px - hx, py - hy, px + hx, py + hy, lv);
        }
      }

      /* ③ 羽状小蕨:一根主脉 + 两侧各两根小枝 */
      var S2 = Math.max(7, Math.round(5.5 * dpr * k));
      for (var gy2 = 0; gy2 < TH + S2; gy2 += S2) {
        for (var gx2 = 0; gx2 < TW + S2; gx2 += S2) {
          var fx2 = gx2 + rnd() * S2, fy2 = gy2 + rnd() * S2;
          var d2 = dens(fx2, fy2);
          if (rnd() > 0.22 + d2 * 0.55) continue;
          var a2 = (rnd() * 3 | 0) * (Math.PI / 3) + (rnd() - 0.5) * 0.35;
          var ux = Math.cos(a2), uy = Math.sin(a2);
          var L2 = dpr * (3.5 + rnd() * 6.0) * (0.7 + d2 * 0.5);
          var lv2 = d2 < 0.45 ? 1 : d2 < 0.78 ? 2 : 3;
          seg(fx2 - ux * L2 * 0.5, fy2 - uy * L2 * 0.5, fx2 + ux * L2 * 0.5, fy2 + uy * L2 * 0.5, lv2);
          for (var sgn = -1; sgn <= 1; sgn += 2) {
            for (var bno = 0; bno < 2; bno++) {
              var at = (0.18 + bno * 0.42) * sgn;
              var bx = fx2 + ux * L2 * at, by = fy2 + uy * L2 * at;
              var bl = L2 * (0.30 - bno * 0.08);
              seg(bx, by, bx + Math.cos(a2 + sgn * 1.05) * bl, by + Math.sin(a2 + sgn * 1.05) * bl, lv2);
            }
          }
        }
      }

      /* ④ 六角枝晶:点缀(和开机动画同一个形状)。
         ★ 要小、要少 —— 上一版每 30 设备像素就有一朵,霜一加厚,
           整片看起来就像"贴了一堆雪花贴纸"。现在拉开间距、降低密度。 */
      var S3 = Math.max(44, Math.round(42 * dpr * k));
      for (var gy3 = 0; gy3 < TH + S3; gy3 += S3) {
        for (var gx3 = 0; gx3 < TW + S3; gx3 += S3) {
          if (rnd() > 0.42) continue;
          var cx3 = gx3 + rnd() * S3, cy3 = gy3 + rnd() * S3;
          var rot = rnd() * Math.PI, L3 = dpr * (3 + rnd() * 4.5);
          var lv3 = dens(cx3, cy3) < 0.6 ? 2 : 3;
          for (var arm = 0; arm < 3; arm++) {
            var a3 = rot + arm * Math.PI / 3;
            var vx = Math.cos(a3), vy = Math.sin(a3);
            seg(cx3 - vx * L3, cy3 - vy * L3, cx3 + vx * L3, cy3 + vy * L3, lv3);
            for (var sg2 = -1; sg2 <= 1; sg2 += 2) {
              var mx = cx3 + vx * L3 * 0.55 * sg2, my = cy3 + vy * L3 * 0.55 * sg2;
              seg(mx, my, mx + Math.cos(a3 + sg2 * 1.05) * L3 * 0.42, my + Math.sin(a3 + sg2 * 1.05) * L3 * 0.42, lv3);
            }
          }
        }
      }

      /* ⑤ 反光小十字 */
      t.fillStyle = "rgba(255, 255, 255, 0.34)";
      var nGlint = Math.round(TW * TH / 26000);
      for (var g2 = 0; g2 < nGlint; g2++) {
        var sx2 = rnd() * TW, sy2 = rnd() * TH, rr = dpr * (0.5 + rnd() * 0.9);
        t.fillRect(sx2 - rr, sy2 - rr * 0.20, rr * 2, rr * 0.40);
        t.fillRect(sx2 - rr * 0.20, sy2 - rr, rr * 0.40, rr * 2);
      }

      /* ⑥ 分档描线:五档 = 五次 stroke(不是几万次),一次性的开销 */
      for (var b2 = 0; b2 < buckets.length; b2++) {
        var arr = buckets[b2];
        if (!arr.length) continue;
        t.beginPath();
        for (var i = 0; i + 3 < arr.length; i += 4) {
          t.moveTo(arr[i], arr[i + 1]);
          t.lineTo(arr[i + 2], arr[i + 3]);
        }
        t.lineWidth = Math.max(0.6, dpr * (b2 >= 4 ? 0.95 : b2 >= 3 ? 0.8 : 0.65));
        t.strokeStyle = "rgba(255, 255, 255, " + ALPHA[b2] + ")";
        t.stroke();
      }
    }

    /* ---------- 低频"厚薄"噪声(双线性插值;每个数组按自己的尺度取样)---------- */
    function blotchAt(arr, aw, c, r, size) {
      var fx = c / size, fy = r / size;
      var c0 = fx | 0, r0 = fy | 0;
      var tx = fx - c0, ty = fy - r0;
      var i0 = r0 * aw + c0;
      var a = arr[i0], b = arr[i0 + 1], d = arr[i0 + aw], e = arr[i0 + aw + 1];
      return (a + (b - a) * tx) * (1 - ty) + (d + (e - d) * tx) * ty;
    }
    /* 这一格结多厚的霜:0 = 基本没结(能看清窗外),1 = 结满。
       ★ 这里是"霜的透明度"的总开关。
         第一版 0.62~1.0:几乎处处是霜,窗外看不清;
         改成 0~1 之后用户又说"霜可以再厚一点点" —— 所以阈值从 0.26 降到 0.20,
         分母 0.52 → 0.46:结霜的面积更大、薄处也更厚一点,但仍然留得下"没结霜"的地方。 */
    function thickAt(c, r) {
      var t = 0.50 * blotchAt(bA, bAw, c, r, 9)
        + 0.30 * blotchAt(bB, bBw, c, r, 3.4)
        + 0.20 * blotchAt(bC, bCw, c, r, 1.6);
      var v = (t - 0.20) / 0.46;
      return v <= 0 ? 0 : v >= 1 ? 1 : v;
    }

    /* ---------- 碎片:位置 + 不规则多边形 + 对应的那颗星 ----------
       ★ 尺寸改了两轮:第一版太大(用户:"碎片太大,而且全是一个宽的碎片"),
         缩到 1/3 之后用户又说"再小一倍" —— 所以现在是【桌面上面板宽的 2.8%】,
         大约 24~38 像素。长宽比逐片不同,形状的半径也逐片不同。
       ★ 用户又说"碎片的变形只有凸没有凹" —— 原来顶点半径都在 0.62~1.0 之间,
         画出来全是凸多边形(像鹅卵石)。现在允许顶点深深凹进去(0.30~1.0),
         于是有缺口、有尖角,像碎玻璃。
       ★ 逐个顶点还要用一次:每个碎片边缘上挑一个点当"爆闪点"(见 layoutShards)。 */
    function polyPoints(seedIdx) {
      var s = (seedIdx * 2654435761) | 0;
      if (!s) s = 12345;
      function r2() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return ((s >>> 0) % 10000) / 10000; }
      var n = 7 + ((r2() * 4) | 0);          /* 7~10 个顶点:点多才出得来凹口 */
      var pts = [];
      var base = 0.80 + r2() * 0.20;
      for (var i = 0; i < n; i++) {
        var a = i / n * Math.PI * 2 + (r2() - 0.5) * 0.38;
        /* 0.30 = 深凹口,1.0 = 尖角。相邻顶点的半径差越大,轮廓越"碎" */
        var rr = 50 * base * (0.30 + r2() * 0.70);
        pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]);
      }
      return pts;
    }
    function polyStr(pts) {
      var out = [];
      for (var i = 0; i < pts.length; i++) out.push(pts[i][0].toFixed(1) + "% " + pts[i][1].toFixed(1) + "%");
      return "polygon(" + out.join(",") + ")";
    }

    function layoutShards() {
      if (!W || !H) return;
      var pad = Math.round(W * 0.055);
      var top = Math.min(140, H * 0.24);
      var bottom = H - Math.min(70, H * 0.14);
      var placed = [];
      var blocked = [];
      [[headEl, 16], [hintEl, 14]].forEach(function (pair) {
        var el = pair[0];
        if (!el) return;
        var b = el.getBoundingClientRect();
        if (!b.width || !b.height) return;
        blocked.push({ x: b.left - pad, y: b.top - pad, w: b.width + pad * 2, h: b.height + pad * 2 });
      });
      function hits(x, y, w, h) {
        for (var i = 0; i < blocked.length; i++) {
          var b = blocked[i];
          if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
        }
        return false;
      }

      var i = 1, guard = 0;
      /* ★ 缝隙:碎片是"撒点 + 互不重叠"摆的。以前碎片很大,小窗上会撞车,
         所以按"每片摊到多少面积"自动收紧。现在碎片小了,这个开关基本不会触发。 */
      var tight = (W * H) / Math.max(1, shards.length) < 16000;
      var gapX = tight ? 9 : 16, gapY = tight ? 8 : 14;
      /* ★ 用户:"碎片太大,而且全是一个宽的碎片,而且都挤在一起了。
         我想的是碎片小小的,闪光能遮住,这样能给提示。"
         所以基准尺寸从 W 的 13%~17% 降到 5%~7.5%(大约三分之一),
         长宽比逐片不同(0.72~1.35),再让形状本身也不一样(见 polyPoints)。 */
      /* ★ 用户:"碎片再小一倍" —— 桌面上面板宽的 2.8%(约 24~38px)。
         手机上给一个下限,不然点不着;但也不再撑到 44。 */
      var base = Math.max(24, Math.min(38, W * 0.028));
      var minSide = W < 560 ? 40 : Math.max(18, Math.round(base * 0.62));
      for (var k = 0; k < shards.length; k++) {
        var el = shards[k];
        var ar = [1.0, 0.78, 1.22, 0.9, 1.34, 0.72][k % 6];      /* 长宽比:一片一个样 */
        var sc = [1.0, 0.86, 1.14, 0.94][k % 4];                 /* 大小也差一点 */
        var bw = Math.max(minSide, Math.round(base * ar * sc));
        var bh = Math.max(minSide, Math.round(base * (1.55 - ar * 0.45) * sc));
        var x = pad, y = top, ok = false;
        while (!ok && guard++ < 14000) {
          x = pad + halton(i, 2) * Math.max(10, W - bw - pad * 2);
          y = top + halton(i, 3) * Math.max(10, bottom - top - bh);
          i++;
          ok = !hits(x, y, bw, bh);
          if (!ok) continue;
          for (var j = 0; j < placed.length; j++) {
            var p = placed[j];
            if (Math.abs(p.y - y) < (p.h + bh) * 0.5 + gapY && Math.abs(p.x - x) < (p.w + bw) * 0.5 + gapX) { ok = false; break; }
          }
        }
        var pts = polyPoints(k);
        var poly = polyStr(pts);
        el.style.setProperty("left", x.toFixed(1) + "px");
        el.style.setProperty("top", y.toFixed(1) + "px");
        el.style.setProperty("width", bw + "px");
        el.style.setProperty("height", bh + "px");
        el.style.setProperty("clip-path", poly);
        el.style.setProperty("-webkit-clip-path", poly);
        el.style.setProperty("--shard-delay", ((k * 0.7) % 6).toFixed(2) + "s");
        /* 爆闪点:挑这个碎片多边形上的【某个顶点】(每片挑的不一样)。
           ★ 用户:"闪光不对,是类似超星星爆发那种突然在碎片边缘的某个点闪一下" ——
             所以它不是覆盖碎片的大光晕,而是边缘上的一点爆闪。
             这里把点的位置和"从中心指向它的角度"一起交给 CSS(--edge 给星芒定向)。 */
        var gl = glintEls[k];
        if (gl) {
          var vi = (k * 3 + 2) % pts.length;
          var vx2 = pts[vi][0] / 100, vy2 = pts[vi][1] / 100;
          gl.style.setProperty("left", (x + bw * vx2).toFixed(1) + "px");
          gl.style.setProperty("top", (y + bh * vy2).toFixed(1) + "px");
          gl.style.setProperty("--edge", (Math.atan2(vy2 - 0.5, vx2 - 0.5) * 180 / Math.PI).toFixed(1) + "deg");
          /* 相位和周期都错开:一起闪就成了呼吸灯,错开才像偶然的爆闪。
             ★ 周期拉长到 9~21.8s:12 片各闪 0.9s,同时平均只有半片在闪 ——
               短周期会让整块窗一直在噼啪闪,那就不是"偶尔"了。 */
          gl.style.setProperty("animation-delay", (-(k * 1.37) % 9).toFixed(2) + "s");
          gl.style.setProperty("animation-duration", (9 + (k % 5) * 3.2).toFixed(2) + "s");
        }
        placed.push({ x: x, y: y, w: bw, h: bh });
      }
    }

    /* ============================================================
       星图 ②:三个【固定样式】的星座
       ─────────────────────────────────────────────────────────────
       ★★ 用户原话:"星座,这个问题最大,实在不行做成固定样式的,
          反正不能像现在这样随便连线"。
       ★ 他说对了。病根有两条,我之前两条都犯了:
         ① 【连线是"把点绕一圈连起来"】—— 上一版就是
            `for (a = 0; a < full.length; a++) addStarLine(full[a], full[(a+1) % len])`。
            五根手指绕圈连,画出来就是一个五边形:那不是星座,那是多边形。
            星座的读法来自【形状有名字】—— 勺子、腰带、W。
            所以这一版每个星座带一张【显式连线表】(edges),线段一条条写死,
            而且【不闭合】:北斗有一根柄,柄的尽头就是尽头。
         ② 【坐标是"锚点 + 抽象小偏移",再由 CSS 按百分比铺开】,
            于是同一个图案在宽高比不同的屏幕上会被拉成不同的形状 ——
            本该认得出来的形状就认不出来了(2.6:1 和 1:1 的面板上差 2.6 倍)。
            所以这一版把图案写在【自己的单位盒】里(0..1),
            绘制时取 s = starScale(),x 和 y 乘【同一个 s】——
            宽高比只影响它放在哪儿,不影响它是什么形状。
       ★ 三个星座是北斗、猎户、仙后:形状有名、好认,而且"勺 / 人 / 折线"
         三套一眼能分开(用户上一轮抱怨过"星座为啥只有一种样式")。
       ★ 碎片(亮星)只占图案里【散开的】三个位置(见各套的 shard):
         三片碎片之间隔着一整片天,连线一条条亮起来的过程才像"星座正在成形";
         要是碎片占了相邻的三个点,那三片会先连出一个三角形,又回到"多边形"。
       ★ 锚点都在画面上半部(y 0.21~0.30),避开中间的标题文字带、
         下方的提示 / 计数,以及窗框的十字。
       ★ 关于构图(第一张盘那种没有主题的碎片):SINGLE 里散开摆,
         和三个星座的锚点离得远,不会挤在一起。
       ============================================================ */
    var PATTERNS = [
      {
        name: "北斗",
        pts: [[0.02, 0.50], [0.18, 0.72], [0.40, 0.80], [0.62, 0.78], [0.66, 0.52], [0.90, 0.42], [0.98, 0.14]],
        /* 斗口的四边形 → 斗柄那道弯。★ 七条边,不闭合 */
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
        shard: [0, 3, 5]
      },
      {
        name: "猎户",
        pts: [[0.22, 0.06], [0.78, 0.04], [0.86, 0.40], [0.50, 0.52], [0.14, 0.40], [0.24, 0.94], [0.76, 0.90]],
        /* 肩(0,1)→ 腰(2,3,4)→ 膝(5,6) */
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 6], [4, 5]],
        shard: [0, 3, 6]
      },
      {
        name: "仙后",
        pts: [[0.02, 0.60], [0.24, 0.16], [0.46, 0.66], [0.72, 0.06], [0.98, 0.54], [0.62, 0.92], [0.34, 0.90]],
        /* 0~4 连成那个 W(四条边),5、6 是挂在 W 中间那颗下面的两颗伴星 */
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5]],
        shard: [0, 2, 4]
      }
    ];
    /* 三套图案的锚点(比例)。★ 图案是【居中】画在锚点上的(见 patternPoints),
       所以锚点就是"这个星座在天上的位置",不是它的左上角。 */
    var ANCHOR = [[0.19, 0.30], [0.52, 0.21], [0.81, 0.29]];
    /* 凑不满一个主题的碎片(第一张盘那种没有主题的):散开当单独的星。
       ★ 用户:"保留几颗单独的,不然整体全是星座反而不好看"。 */
    var SINGLE = [[0.86, 0.30], [0.09, 0.50], [0.74, 0.58], [0.30, 0.62]];

    /* 星座的尺度:在【固定的屏幕像素】里画,不按百分比铺开 ——
       这是"固定样式"能成立的关键(见上面 ②)。
       ★ 下限 74px:再小就认不出形状了;上限 178px:再大就压到标题文字上。
       ★ 取 min(W*0.185, H*0.42) 而不是只看 W:面板很扁的时候(H 小),
         按宽度算出来的星座会从上下两头溢出画面。 */
    function starScale() { return Math.max(74, Math.min(178, Math.min(W * 0.185, H * 0.42))); }

    /* 把一套图案算成像素坐标:先把单位盒缩放到 s,再把【它的中心】挪到锚点上。
       ★ 取中心而不是左上角:图案的 pts 不一定占满单位盒,
         按左上角对的话三套星座会各自偏出去一截,锚点也就不是它真正的位置了。 */
    function patternPoints(pi, s) {
      var p = PATTERNS[pi % PATTERNS.length];
      var xs = [], ys = [], i;
      for (i = 0; i < p.pts.length; i++) { xs.push(p.pts[i][0]); ys.push(p.pts[i][1]); }
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var an = ANCHOR[pi % ANCHOR.length];
      var ox = an[0] * W - (minX + maxX) * 0.5 * s, oy = an[1] * H - (minY + maxY) * 0.5 * s;
      var out = [];
      for (i = 0; i < p.pts.length; i++) {
        out.push({ x: ox + p.pts[i][0] * s, y: oy + p.pts[i][1] * s, i: i });
      }
      return out;
    }

    /* 主题 → 图案序号(按主题【第一次出现的顺序】分,页面一加载就定死)。
       ★ 以前有【两套编号】:layoutStars 里的 seen[th] 和 rebuildMap 里的
         themeIds.indexOf(th)。两套各算各的,星座和连线就可能对不上同一套图案。 */
    function patternFor(th) {
      var k = 0;
      for (var i = 0; i < shards.length; i++) {
        var t2 = themeOf[i];
        if (!t2) continue;
        if (t2 === th) return k % PATTERNS.length;
        var first = true;
        for (var j = 0; j < i; j++) if (themeOf[j] === t2) { first = false; break; }
        if (first) k++;
      }
      return 0;
    }

    /* 每片碎片对应的那颗星。
       ★ 存成【比例】:rebuildMap 和 keepShard 都按比例用它。 */
    function layoutStars() {
      var s = starScale(), singleK = 0;
      for (var k = 0; k < shards.length; k++) {
        var th = themeOf[k];
        if (!th) {
          var p = SINGLE[singleK % SINGLE.length];
          singleK++;
          starAt[k] = { x: p[0] + (k % 2 ? 0.012 : -0.012), y: p[1] + (k % 3 ? 0.012 : -0.012) };
          continue;
        }
        var pi = patternFor(th);
        var si = 0;
        for (var j = 0; j < k; j++) if (themeOf[j] === th) si++;
        var full = patternPoints(pi, s);
        var slots = PATTERNS[pi].shard;
        var pt = full[slots[si % slots.length]] || full[0];
        starAt[k] = { x: pt.x / W, y: pt.y / H };
      }
    }
    /* ---------- 星图:收下的星 + 主题齐了就连线 ---------- */
    function rebuildMap() {
      if (!mapEl || !W || !H) return;
      while (mapEl.firstChild) mapEl.removeChild(mapEl.firstChild);
      var s = starScale();
      /* ① 主题齐了的:整条图案一起点亮(伴星 + 显式连线)。
         ★ 判断"齐没齐"只看【这一套图案对应的那个主题】,
           不再遍历 themeIds —— 编号现在只有 patternFor 一个来源。 */
      for (var pi = 0; pi < PATTERNS.length; pi++) {
        var th = null;
        for (var k = 0; k < shards.length; k++) {
          var t2 = themeOf[k];
          if (t2 && patternFor(t2) === pi) { th = t2; break; }
        }
        if (!th) continue;
        var total = 0, got = 0;
        for (var j = 0; j < shards.length; j++) {
          if (themeOf[j] !== th) continue;
          total++;
          if (collected[j]) got++;
        }
        if (total < 2 || got < total) continue;          /* 没集齐就不连线 */
        var full = patternPoints(pi, s);
        var slots2 = PATTERNS[pi].shard;
        for (var c = 0; c < full.length; c++) {
          if (slots2.indexOf(full[c].i) >= 0) continue;  /* 碎片自己的星已经画过了 */
          addDot("frost-companion", full[c].x / W, full[c].y / H, th);
        }
        /* ★ 连线【只画 edges 里写死的那些】,不绕圈、不闭合 */
        var eds = PATTERNS[pi].edges;
        for (var e2 = 0; e2 < eds.length; e2++) {
          var pa = full[eds[e2][0]], pb = full[eds[e2][1]];
          if (pa && pb) addStarLine({ x: pa.x / W, y: pa.y / H }, { x: pb.x / W, y: pb.y / H });
        }
      }
      /* ② 收下的碎片:变成一颗亮星。★ 放在连线【之后】,让亮星压在线上 */
      for (var i2 = 0; i2 < shards.length; i2++) {
        if (!collected[i2]) continue;
        var st = starAt[i2] || { x: 0.5, y: 0.3 };
        addDot("frost-star", st.x, st.y, themeOf[i2]);
      }
    }
    /* 画一颗星(亮星 / 伴星共用)。★ 上一版这段在两个循环里各抄了一遍,
       抄第二遍的时候就漏掉了 data-theme —— 于是伴星和亮星分了家。 */
    function addDot(cls, xr, yr, th) {
      var el = document.createElement("i");
      el.className = cls;
      el.style.setProperty("left", (xr * 100).toFixed(2) + "%");
      el.style.setProperty("top", (yr * 100).toFixed(2) + "%");
      if (th) el.setAttribute("data-theme", th);
      mapEl.appendChild(el);
      return el;
    }
    function addStarLine(p, q) {
      if (!p || !q) return;
      var dx = (q.x - p.x) * W, dy = (q.y - p.y) * H;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (!len) return;
      var el = document.createElement("i");
      el.className = "frost-starline";
      el.style.setProperty("left", (p.x * 100).toFixed(2) + "%");
      el.style.setProperty("top", (p.y * 100).toFixed(2) + "%");
      el.style.setProperty("width", len.toFixed(1) + "px");
      el.style.setProperty("transform", "rotate(" + (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + "deg)");
      mapEl.appendChild(el);
    }

    /* ---------- 点开 / 收下 ----------
       ★ 无障碍:这一页是"鼠标/手指划过才化霜"的玩法,键盘用户本来进不来。
         做法有三条:
           ① 碎片是 <button>,Tab 本来就能到(pointer-events 不影响键盘焦点);
           ② Tab 到哪一片,就在那一片上"呵一口气"(focus → 局部化霜),
              等于把"注意力"当成温度,键盘也能一路收完;
           ③ 打开读数层时把焦点移到那张卡上,关上时还回原来那一片 ——
              不然读屏用户会停在"已经看不见的碎片"上,不知道发生了什么。 */
    function shardText(i) {
      var t = q(".frost-shard__text", shards[i]);
      return t && t.textContent ? t.textContent : "";
    }
    function warmShard(i) {
      var b = shards[i].getBoundingClientRect(), lr = layer.getBoundingClientRect();
      var cx = b.left - lr.left + b.width * 0.5, cy = b.top - lr.top + b.height * 0.5;
      /* ★ 呵三口气,沿碎片的长轴分布:只呵一口的话,整片的平均覆霜量只降到
         0.6 左右(--clear ≈ 0.47),还差一点才到"可点"的阈值 ——
         键盘用户 Tab 过来却打不开,等于这条路是假的(自检里就是这么发现的)。 */
      melt(cx, cy - b.height * 0.18, 0.55);
      melt(cx, cy + b.height * 0.18, 0.55);
      melt(cx, cy, 0.55);
      if (hintEl) hintEl.classList.add("is-used");
      kick();
    }
    /* ============================================================
       读数层:碎片【自己】飞到卡片左边那个槽里
       ─────────────────────────────────────────────────────────────
       ★★ 用户连着两轮说"没有动画",而我两轮都以为做过了 —— 值得把教训写下来。
       第一轮我把"动画"理解成【卡片从碎片的位置飞过来】,还用了 FLIP:
       卡片先被反推到碎片的位置和大小,下一帧再放开,由浏览器补间。
       技术上是"有动画"的,可是看起来是【一整块发光面板横扫过屏幕】——
       用户看到的是屏幕被擦了一下,不是"我点的那片东西飞出来了",
       所以他第二次还是说"拾起碎片的动画还是没有"。
       ★ 动画的主体错了:该飞的是【那片碎片】,不是读数卡。
       这一版:
         ① 卡片【不再动】。它就在中央淡入(见 CSS 的 .frost-read__card),
            面板是"背景板",不是"被拾起的那个东西";
         ② 被拾起的是卡片左边槽里的【碎片形状】(.frost-read__mark)——
            它是一个 <svg>,多边形逐顶点照抄碎片的 clip-path,
            所以"就是刚才那一片",不是另画的一个图标;
         ③ 它【从碎片当时在屏幕上的位置和大小】飞进槽里,再轻轻放大、回正。
            这里仍然是 FLIP(反推 → 下一帧放开)——
            这样无论碎片在哪、屏幕有没有被缩放,起点都是对的,不用手写关键帧;
         ④ 文字比形状【晚一点】出现(见 CSS 的 --fly 动画延迟):
            "东西先落到手里,字再亮起来",顺序反过来就变成"面板上先有字、
            然后飘来一个图形",又回到"没有动画"。
       ★★ 第三轮:用户说"捡起碎片的动画一点都没做,也就是说你这一轮啥也没干"。
          他是对的。上面 ②③ 写了、代码里也有,但【那个分支一次都没进去过】:
          上一版先 `readEl.hidden = false`,紧接着就读
          `readMark.getBoundingClientRect()`。浏览器在【同一帧内】刚把元素从
          display:none 改回可见时,布局还没重算,这个矩形【全是 0】——
          于是 `if (b.width > 0 && mb.width > 0)` 恒为假,飞行整段被跳过。
       ★ 为什么 107 条断言全绿也没拦住:我的假 DOM 里 getBoundingClientRect()
         返回的是父元素的尺寸,【从来不返回 0】。量具把一个"永远走不进去的分支"
         照成了"走通了"。这是这个项目里第一次【测试绿、功能根本没运行】——
         比测试红危险得多:红会逼我查,绿只会让我以为做完了。
       ★ 修法:不去量那个可能还没布局的元素,改成用【已知几何】算 ——
         面板是 W×H、卡片是居中的、槽是卡片内固定 96px 的一项,
         这些都算得出来,且不受"这一帧布局算没算"影响。
         代价:卡片尺寸公式在两处(CSS 的 min() 和这里的 CARD_W/CARD_H),
         改一处必须改另一处 —— 两边都有注释指回对方,测试里也钉着这几个数。
       ============================================================ */
    function openShard(i) {
      if (openIdx >= 0 || collected[i]) return false;
      openIdx = i;
      shards[i].classList.add("is-open");
      root.classList.add("is-reading");
      if (readText) readText.textContent = shardText(i);
      if (readEl) { readEl.hidden = false; readEl.classList.add("is-on"); }
      /* ★★ 起点与落点都用【算】的,绝不 measure 那个槽 —— 见上面那段注释:
         刚把 readEl.hidden 改成 false 的同一帧里,槽的 getBoundingClientRect()
         全是 0,上一版就是被这一条挡在 if 外面,一次都没飞过。 */
      var b = shards[i].getBoundingClientRect();
      if (readMark && b.width > 0 && W > 0) {
        setMarkPoly(readMark, shards[i].style.getPropertyValue("clip-path") || "");
        /* 卡片几何:居中 + CSS 里那条 min() 公式。 */
        var CARD_W = Math.min(W * 0.62, 620);
        var CARD_H = Math.min(H * 0.38, 320);
        var MARK_SLOT = 96;            /* ★ 必须和 CSS 的 .frost-read__mark 一致 */
        var cardLeft = (W - CARD_W) * 0.5, cardTop = (H - CARD_H) * 0.5;
        /* 落点:卡片左内边距(padding 左 5%)之后的第一个 flex 项,垂直居中 */
        var markCX = cardLeft + CARD_W * 0.05 + MARK_SLOT * 0.5;
        var markCY = cardTop + CARD_H * 0.5;
        /* 起点:碎片自己的中心 */
        var shardCX = b.left + b.width * 0.5;
        var shardCY = b.top + b.height * 0.5;
        /* 缩放:让槽里那片和碎片【一样宽】(槽是 96px 见方,碎片 24~40px) */
        var sc = Math.max(0.06, Math.min(1.6, b.width / MARK_SLOT));
        /* ★ 顺序:加 is-flying(关掉过渡)→ 写反推值 → 下一帧去掉。
           元素刚从 display:none 变可见的那一帧不跑过渡,反推值会直接落位。 */
        readMark.style.setProperty("--mark-x", (shardCX - markCX).toFixed(1) + "px");
        readMark.style.setProperty("--mark-y", (shardCY - markCY).toFixed(1) + "px");
        readMark.style.setProperty("--mark-s", sc.toFixed(3));
        /* 起飞带一点角度、落位回正:直线平移像"贴纸被拖过去",有角度才像"被拿起来"。
           角度固定 ±7°,不随机 —— 每次一样的动作才像一个动作。 */
        readMark.style.setProperty("--mark-rot", (i % 2 ? 7 : -7) + "deg");
        /* ★★★ 开卡这一帧,把碎片形状上那条【凝聚动画】按住(内联,优先级最高)。
           为什么必须这么做:CSS 里 `.frost-read__mark svg` 挂着 shardCondense,
           而 `animation-fill-mode: forwards` 的填充是双向的 ——
           它会把第一个关键帧的 scale(1) 填上去,【盖掉】JS 这里写的 --mark-s。
           于是槽里那片碎片会先按原始尺寸铺开,等 is-kept 才开始收拢:
           用户第六轮报的"为什么拿起碎片就开始播放收起动画了!!!"就是这一下。
           这里按住之后,【进入槽里】这一段完全由内联过渡负责(定位归过渡),
           等用户点"收下"再放开动画(凝聚归动画)—— 两件事各管一段。 */
        var markSvg = readMark.querySelector("svg");
        if (markSvg) {
          markSvg.style.setProperty("animation-name", "none");
          markSvg.style.setProperty("animation-play-state", "paused");
        }
        readMark.classList.add("is-flying");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            readMark.classList.remove("is-flying");
            readMark.style.setProperty("--mark-x", "0px");
            readMark.style.setProperty("--mark-y", "0px");
            readMark.style.setProperty("--mark-s", "1");
            readMark.style.setProperty("--mark-rot", "0deg");
            /* 落位过渡跑完(约 .3s)再把动画交还给 CSS —— 那时碎片已经在槽里,
               凝聚动画从 0% 开始跑,不会和"飞进槽里"抢同一段时间。 */
            setTimeout(function () {
              if (markSvg) {
                markSvg.style.removeProperty("animation-name");
                markSvg.style.removeProperty("animation-play-state");
              }
            }, 340);
          });
        });
      }
      openMark = i;
      if (readCard && readCard.focus) { try { readCard.focus(); } catch (e) { } }
      return true;
    }
    /* ★★ 拾起动画的【现场读数】—— 留给"看不见页面"时的唯一办法。
       用户连着三轮说"没有动画",而我在这个环境里没有浏览器:
       假 DOM 的能量已经用尽(它自己的缺陷让我绿着交过一次货)。
       所以留一个能在真浏览器里一眼问出答案的口子:
           console.log(JSON.stringify(window.__frostMark()))
       它把"此刻槽里那片东西"实测出来 —— 位置、尺度、起飞角度、过渡有没有挂上。
       点开一片碎片之后立刻执行,那几行数字就能说明它到底飞没飞。 */
    window.__frostMark = function () {
      if (!readMark) return { ok: false, why: "页面上没有 .frost-read__mark" };
      var r = readMark.getBoundingClientRect();
      var cs = window.getComputedStyle ? window.getComputedStyle(readMark) : null;
      var poly = readMark.querySelector("polygon");
      return {
        slot: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        flying: readMark.classList.contains("is-flying"),
        varX: readMark.style.getPropertyValue("--mark-x"),
        varY: readMark.style.getPropertyValue("--mark-y"),
        varS: readMark.style.getPropertyValue("--mark-s"),
        varRot: readMark.style.getPropertyValue("--mark-rot"),
        transform: cs ? cs.transform : "(没有 getComputedStyle)",
        transition: cs ? cs.transitionDuration : "",
        polyPoints: poly ? String(poly.getAttribute("points")).slice(0, 40) : "(没有 polygon)",
        openIdx: openIdx
      };
    };
    /* 把碎片的 clip-path 原样搬到槽里那个 <svg> 上 ——
       "拾起的是刚才那一片"靠的就是这一句:形状是抄来的,不是另画的。 */
    function setMarkPoly(svg, poly) {
      var m = /polygon\(([^)]*)\)/.exec(poly);
      if (!m) return false;
      var polyEl = svg.querySelector("polygon");
      if (!polyEl) return false;
      polyEl.setAttribute("points", m[1].replace(/%/g, "").trim());
      return true;
    }
    function closeShard() {
      if (openIdx < 0) return;
      var i = openIdx;
      shards[i].classList.remove("is-open");
      openIdx = -1;
      openMark = -1;
      root.classList.remove("is-reading");
      if (readEl) { readEl.hidden = true; readEl.classList.remove("is-on", "is-off"); }
      if (shards[i].focus) { try { shards[i].focus(); } catch (e) { } }
    }
    function keepShard() {
      if (openIdx < 0) return false;
      var i = openIdx;
      collected[i] = true;
      kept++;
      openIdx = -1;
      shards[i].classList.remove("is-open");
      shards[i].classList.add("is-kept");
      if (glintEls[i]) glintEls[i].classList.add("is-kept");   /* 收下了就不再闪 */
      /* 收下那一下:槽里那片碎片【凝成一个光点往上飞】。
         ★★ 用户的原话:"收下碎片的时候,我希望碎片凝聚成一个光点往上飞。"
         ★ 这里【不再】写 --mark-fly-x / --mark-fly-y:光点是【垂直往上】飞的,
           不是朝天上那颗星飞过去。上一版把它做成"朝星位平移"是"搬运",
           不是"凝聚成光点上升" —— 方向错了。
         ★★ 三段串行(和 CSS 那段注释一一对应,改一处必须改另一处):
              0           挂 is-kept        → 碎片收拢、光点升起(1s)
              MOTE_MS     (1.00s) 卡片才开始淡出(见 CSS 的 cardOut 延迟 1s)
              CARD_MS     (1.30s) 读数层淡出、is-off 挂上、光点停住
              KEEP_MS     (1.45s) 收尾:隐藏、摘类、刷新星图与计数
            ★ 关键点:is-off 【不能】和 is-kept 同一拍挂上 ——
              它带一条 `animation: none`(给收尾用的),同拍挂上会把刚点起来的光点动画当场取消。
              上一版就是同拍挂的,所以"什么都没有"。 */
      if (readMark) readMark.classList.add("is-kept");
      if (readCard) readCard.classList.add("is-flying");
      root.classList.remove("is-reading");
      if (dialogT) clearTimeout(dialogT);
      dialogT = setTimeout(function () {
        if (readEl) readEl.classList.add("is-off");
      }, CARD_MS);
      dialogT = setTimeout(function () {
        dialogT = 0;
        if (readEl) { readEl.hidden = true; readEl.classList.remove("is-on", "is-off"); }
        if (readCard) readCard.classList.remove("is-flying");
        if (readMark) readMark.classList.remove("is-kept", "is-flying");
        openMark = -1;
        rebuildMap();
        updateCount();
        checkDone();
      }, KEEP_MS);
      return true;
    }
    function updateCount() {
      if (!countEl) return;
      countEl.textContent = kept + " / " + shards.length;
    }
    function checkDone() {
      if (kept < shards.length) return false;
      root.classList.add("is-done");
      if (doneEl) doneEl.setAttribute("aria-hidden", "false");
      return true;
    }

    /* ---------- 尺寸 + 重建 ---------- */
    function measureZones() {
      var lr = layer.getBoundingClientRect();
      for (var i = 0; i < shards.length; i++) {
        var b = shards[i].getBoundingClientRect();
        var z = zone[i] || (zone[i] = {});
        if (!b.width || !cols || !rows) { z.ok = false; continue; }
        z.ok = true;
        z.c0 = Math.max(0, Math.floor((b.left - lr.left) / CELL));
        z.c1 = Math.min(cols - 1, Math.ceil((b.right - lr.left) / CELL));
        z.r0 = Math.max(0, Math.floor((b.top - lr.top) / CELL));
        z.r1 = Math.min(rows - 1, Math.ceil((b.bottom - lr.top) / CELL));
      }
    }

    function resize() {
      var m = layer.getBoundingClientRect();
      W = Math.max(1, Math.round(m.width));
      H = Math.max(1, Math.round(m.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cols = Math.ceil(W / CELL);
      rows = Math.ceil(H / CELL);

      sizeCanvas(cv, W, H);          /* ★ 传【CSS 尺寸】:后备缓冲会自动乘 dpr */
      layoutShards();
      measureZones();
      layoutStars();

      var n = cols * rows;
      var old = cov;
      cov = new Float32Array(n);
      if (old && old.length === n) cov.set(old);
      else for (var i = 0; i < n; i++) cov[i] = 1;      /* 一开始:整块都是霜 */

      /* ★ 厚薄场用【固定种子】:窗口一变大变小就重掷的话,霜的图案会整块换一张脸。
         同一块窗应该一直是同一块窗。 */
      var sr = 0x1b873593 | 0;
      function rnd() { sr ^= sr << 13; sr ^= sr >>> 17; sr ^= sr << 5; sr |= 0; return ((sr >>> 0) % 1048576) / 1048576; }
      bAw = Math.ceil(cols / 9) + 2; bAh = Math.ceil(rows / 9) + 2;
      bA = new Float32Array(bAw * bAh);
      for (var t = 0; t < bA.length; t++) bA[t] = rnd();
      bBw = Math.ceil(cols / 3.4) + 2; bBh = Math.ceil(rows / 3.4) + 2;
      bB = new Float32Array(bBw * bBh);
      for (var u = 0; u < bB.length; u++) bB[u] = rnd();
      bCw = Math.ceil(cols / 1.6) + 2; bCh = Math.ceil(rows / 1.6) + 2;
      bC = new Float32Array(bCw * bCh);
      for (var v = 0; v < bC.length; v++) bC[v] = rnd();

      if (covCtx) {
        covCv.width = cols; covCv.height = rows;
        covImg = covCtx.createImageData(cols, rows);
      }
      buildSky();
      preloadAurora();
      buildFrost();
      buildSnow();
      rebuildMap();
      updateCount();
      dirty = true;
    }

    /* ---------- 飘雪(每帧重画;量小,便宜)---------- */
    function buildSnow() {
      sizeCanvas(snowCv, W, H);
      flake.length = 0;
      var s0 = 0x7ab3c1d5 | 0;
      function rnd() { s0 ^= s0 << 13; s0 ^= s0 >>> 17; s0 ^= s0 << 5; s0 |= 0; return ((s0 >>> 0) % 1048576) / 1048576; }
      var n = Math.round(SNOW_N * Math.min(1.6, W / 900 + 0.35));
      for (var i = 0; i < n; i++) {
        var vy = dpr * (SNOW_SPD_MIN + rnd() * (SNOW_SPD_MAX - SNOW_SPD_MIN));
        flake.push({
          /* ★ 位置和半径都按【设备像素】:雪那张画布的后备缓冲也是 W*dpr × H*dpr。
             以前位置用 CSS px、半径用设备 px、卷回边界又用 W*dpr ——
             三套混着,在 dpr=2 的屏幕上雪花会落到画布外面去。 */
          x: rnd() * W * dpr, y: rnd() * H * dpr,
          /* ★ 用户的三条:斜着飞、快一点、大一点。
             原来 r = 0.6~2.1 设备像素、每帧 0.16~0.58 像素 —— 又小又慢,
             在深色天上就是几个不动的小点(和"雪"没关系)。
             现在:3~8 设备像素、每帧 1.1~2.8 像素,并且带一个固定的横向分量。
             横向 = 纵向 × SLANT,所以越快的雪花斜得越明显,和真雪一样。 */
          r: dpr * (1.6 + rnd() * 2.4),
          vy: vy,
          vx: vy * SNOW_SLANT,
          sway: 0.18 + rnd() * 0.5,
          ph: rnd() * Math.PI * 2,
          a: 0.24 + rnd() * 0.5
        });
      }
      snowStep();          /* 先画一帧:减少动态效果时这就是唯一的一帧 */
    }
    function snowStep() {
      var s = snowCv && snowCv.getContext("2d");
      if (!s) return;
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, snowCv.width, snowCv.height);
      var wpx = W * dpr, hpx = H * dpr;
      for (var i = 0; i < flake.length; i++) {
        var f = flake[i];
        f.y += f.vy;
        f.x += f.vx + Math.sin(f.ph) * f.sway;
        f.ph += 0.02;
        /* 从下面飘出去就从上面回来;横向也一样,只是错开一点 */
        if (f.y > hpx + 6) { f.y = -6; f.x = Math.random() * (wpx + 80) - 40; }
        if (f.x < -8) f.x = wpx + 6;
        if (f.x > wpx + 8) f.x = -6;
        /* 一片雪 = 一个柔和的点(见 softDot 的注释:方框会露出四个角)。
           大一点的额外点一笔很淡的十字,像冰晶。 */
        softDot(s, f.x, f.y, Math.max(0.8, f.r * 0.62), f.a, false);
        if (f.r > dpr * 2.2) {
          s.fillStyle = "rgba(226, 240, 255, " + (f.a * 0.20).toFixed(3) + ")";
          var arm = f.r * 1.25;
          s.fillRect(f.x - arm, f.y - dpr * 0.35, arm * 2, Math.max(1, dpr * 0.7));
          s.fillRect(f.x - dpr * 0.35, f.y - arm, Math.max(1, dpr * 0.7), arm * 2);
        }
      }
    }

    /* ---------- 暖化:把霜化掉(单向)----------
       falloff 用平方衰减:正中心化得快,边缘只是"潮"了一点 —— 手靠近就是这样。 */
    function melt(cx, cy, amount) {
      if (!cols || !rows) return;
      meltCalls++;
      lastMelt = [Math.round(cx), Math.round(cy), amount];
      cx *= dpr; cy *= dpr;
      var R = WARM_R * dpr, cs = CELL * dpr;
      var c0 = Math.max(0, Math.floor((cx - R) / cs));
      var c1 = Math.min(cols - 1, Math.ceil((cx + R) / cs));
      var r0 = Math.max(0, Math.floor((cy - R) / cs));
      var r1 = Math.min(rows - 1, Math.ceil((cy + R) / cs));
      var changed = false;
      for (var r = r0; r <= r1; r++) {
        for (var c = c0; c <= c1; c++) {
          var i = idx(c, r);
          if (cov[i] <= 0) continue;
          var dx = (c + 0.5) * cs - cx, dy = (r + 0.5) * cs - cy;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > R) continue;
          var k = 1 - d / R;
          var nv = cov[i] - amount * k * k;
          cov[i] = nv < 0 ? 0 : nv;
          changed = true;
        }
      }
      if (changed) dirty = true;
    }

    /* ---------- 水滴:霜化到薄处挂不住,顺着玻璃滑下来 ----------
       ★★ 水滴【不再化霜】。原来它一路往下掉、沿途 melt(),于是在光标下面拉出
          一条长长的化痕 —— 用户的原话是"鼠标放上去,那下面的一长串全会融化",
          他把它当成 bug(确实是:那不是"手暖到的地方",是水痕在替他化)。
          现在水滴纯粹是视觉:短命、边掉边淡,只负责"霜在化"的这个感觉。 */
    function spawnDrips(cx, cy) {
      if (drip.length >= DRIP_MAX || Math.random() >= 0.22) return;
      drip.push({
        x: cx + (Math.random() - 0.5) * 22, y: cy + (Math.random() - 0.3) * 16,
        vy: 0.25 + Math.random() * 0.5,
        r: 0.9 + Math.random() * 1.5,
        life: 90 + (Math.random() * 60 | 0)
      });
    }
    function dripStep() {
      for (var i = drip.length - 1; i >= 0; i--) {
        var d = drip[i];
        d.vy += 0.055;
        if (d.vy > 3.4) d.vy = 3.4;
        d.y += d.vy;
        d.life--;
        if (d.y > H + 8 || d.life <= 0) drip.splice(i, 1);
      }
    }
    function paintDrips() {
      if (!drip.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   /* 之后都用 CSS px 坐标 */
      for (var i = 0; i < drip.length; i++) {
        var d = drip[i];
        var fade = Math.min(1, d.life / 40);    /* 快没的时候淡出,不拖尾 */
        ctx.fillStyle = "rgba(196, 226, 250, " + (0.5 * fade).toFixed(3) + ")";
        ctx.fillRect(d.x - d.r * 0.5, d.y - d.r * 0.5, d.r, d.r * 1.5);
        ctx.fillStyle = "rgba(240, 250, 255, " + (0.75 * fade).toFixed(3) + ")";
        ctx.fillRect(d.x - d.r * 0.30, d.y - d.r * 0.40, d.r * 0.5, d.r * 0.6);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* ---------- 画霜 ----------
       每帧只做:
         ① 把覆霜量写进一张 cols×rows 的小图(每格一个像素,很小)
         ② 主画布 = 冰晶纹理 ∩ 覆霜场(两次 drawImage,浏览器自己做平滑放大)
       ★ 没有逐格方块 —— 霜的边缘是平滑的,也不会有"像素格"。 */
    function paintFrost() {
      if (!covImg) return;
      var d = covImg.data;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var v = cov[idx(c, r)];
          var i = (r * cols + c) * 4;
          d[i] = 255; d[i + 1] = 255; d[i + 2] = 255;
          if (v <= 0.01) { d[i + 3] = 0; continue; }
          var th = thickAt(c, r);
          d[i + 3] = th <= 0 ? 0 : (Math.pow(v, 0.85) * th * 255) | 0;
        }
      }
      covCtx.putImageData(covImg, 0, 0);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(tex, 0, 0, tex.width, tex.height, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(covCv, 0, 0, cols, rows, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = "source-over";
      paintDrips();
      dirty = false;
    }

    /* ---------- 每片碎片的可见度 = 它那一带的覆霜量 ---------- */
    function refreshShards() {
      diag.length = 0;
      var anyOpen = false;
      for (var i = 0; i < shards.length; i++) {
        var z = zone[i];
        if (!z || !z.ok) continue;
        var sum = 0, n = 0;
        for (var r = z.r0; r <= z.r1; r += TEXT_STRIDE) {
          for (var c = z.c0; c <= z.c1; c += TEXT_STRIDE) { sum += cov[idx(c, r)]; n++; }
        }
        var frost = n ? sum / n : 1;
        var clear = Math.max(0, Math.min(1, (1 - frost - 0.05) / 0.75));
        diag.push({ i: i, frost: +frost.toFixed(4), clear: +clear.toFixed(4), c0: z.c0, c1: z.c1, r0: z.r0, r1: z.r1 });
        shards[i].style.setProperty("--clear", clear.toFixed(3));
        /* 霜化得差不多了才允许点它 —— 免得对着白霜乱点也能捡到东西 */
        if (!collected[i]) {
          shards[i].style.setProperty("pointer-events", clear > OPEN_AT ? "auto" : "none");
          shards[i].style.setProperty("cursor", clear > OPEN_AT ? "pointer" : "default");
          if (clear > OPEN_AT) anyOpen = true;
        }
      }
      root.classList.toggle("is-openable", anyOpen);
    }

    /* ---------- 环境循环:飘雪一直在,霜只在脏了才重画 ---------- */
    function frame() {
      raf = 0;
      if (!active) return;
      /* 手停在那儿(而且待够了 DWELL_MS)→ 一直是化的 */
      if (warm.on && (pressing || Date.now() - warm.since >= DWELL_MS)) {
        melt(warm.x, warm.y, MELT_DWELL);
        spawnDrips(warm.x, warm.y);
      }
      if (drip.length) dripStep();
      if (!reduced) snowStep();               /* 系统要"减少动态效果"→ 雪就停住 */
      /* 极光:每帧跑一次真 GLSL(iTime 在动)。没有 WebGL 时天空仍有 buildSky 那层,不会空。
         ★★ 这里【不能】写成 `if (!reduced && ...)` —— 那是我上一版的写法,
            后果是:系统开了"减少动态效果"的人【一帧极光都看不到】,
            因为下面那句 `if (reduced && ...) return` 会让循环在画极光之前就退出。
            雪停住是对的(飘雪是纯粹的运动),但极光不能整层消失:
            它是这一页的画面本身,不是动效。所以"减少动态效果"下【画一帧就够】——
            静态的一帧极光,正是那个设置想要的东西。 */
      if (!reduced || !aurFrames) {
        paintAuroraGlsl(((window.performance && performance.now) ? performance.now() : Date.now()) / 1000 - aurT0 / 1000);
      }
      if (dirty || drip.length) { paintFrost(); refreshShards(); }
      /* 静态模式(减少动态效果)下,没有东西在动就把循环停掉,别白烧 CPU */
      if (reduced && !dirty && !drip.length && !warm.on) return;
      raf = requestAnimationFrame(function () { timer = setTimeout(frame, TICK); });
    }
    function kick() {
      if (raf || !active) return;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(timer);
      raf = 0;
    }

    /* ---------- 输入 ----------
       ★ 坐标一律以 canvas 为准(canvas 就是"霜"那张画布,格子行列就是按它算的)。
       ★ 事件挂在 root(.frost)上 —— 它是这一页唯一 pointer-events 不是 none 的元素;
         挂到 layer / canvas 上等于一个事件都收不到(踩过,见 tests/README.md)。 */
    function local(e) {
      var m = cv.getBoundingClientRect();
      /* ★ 屏幕可能被【整体缩放】(这台设备的屏幕是贴到机身/3D 平面上的,
         见 frame-fit.js)。那时 rect 给出的是"视觉尺寸",而 canvas 内部用的是
         CSS 像素 —— 直接 clientX - rect.left 会随离原点的距离线性偏掉,
         正是用户报的"光标和实际清除霜的位置有偏差"。
         按"canvas 内部尺寸 / 视觉尺寸"的比例换算回来;没有缩放时这个比例就是 1。 */
      var sx = (m.width > 0) ? W / m.width : 1;
      var sy = (m.height > 0) ? H / m.height : 1;
      return { x: (e.clientX - m.left) * sx, y: (e.clientY - m.top) * sy };
    }
    function onMove(e, fromDown) {
      if (!active) return;
      var isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      if (isTouch && !pressing) return;         /* 触摸:按住才算"手放上去" */
      var p = local(e);
      if (pressing) {
        var mdx = p.x - downX, mdy = p.y - downY;
        var md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md > dragDist) dragDist = md;
      }
      /* ★ 停留计时:指针挪出 DWELL_SLOP 之外就重新计时(见文件头 DWELL_MS 的注释)*/
      var now = Date.now();
      var jx = p.x - warm.ax, jy = p.y - warm.ay;
      if (!warm.on || jx * jx + jy * jy > DWELL_SLOP * DWELL_SLOP) {
        warm.ax = p.x; warm.ay = p.y; warm.since = now;
      }
      warm.on = true; warm.x = p.x; warm.y = p.y; warm.type = isTouch ? "touch" : "mouse";
      /* 按住 = 明确动作,立刻化;只是悬停 = 要待够 DWELL_MS */
      if (pressing || now - warm.since >= DWELL_MS) melt(p.x, p.y, MELT_HIT);
      if (hintEl) hintEl.classList.add("is-used");
      /* ★ 指针捕获【只在真的拖起来之后】才要(不是按下就要):
         一旦捕获,pointerup 会被重定向到 .frost,而浏览器合成 click 时取的是
         "按下目标与抬起目标的最近公共祖先" —— 于是碎片永远收不到 click,
         用户报的"碎片点不动"就是这个(测试也没抓到,因为它直接给碎片派发 click)。
         现在:轻点 → 不捕获 → 碎片拿到 click;拖起来 → 捕获 → 划出窗也能继续化霜。 */
      if (pressing && !fromDown && !captured) {
        captured = true;
        try { root.setPointerCapture(e.pointerId); } catch (err) { }
      }
      kick();
    }
    function onDown(e) {
      if (!active) return;
      pressing = true;
      captured = false;
      dragDist = 0;
      var p0 = local(e);
      downX = p0.x; downY = p0.y;
      onMove(e, true);
    }
    function onUp() {
      pressing = false;
      captured = false;
      /* ★ 手指抬起来了,就不能再"暖"在那里 —— 鼠标可以一直悬停,
         触摸不行:人走了,手也走了。不写这条的话,松手之后霜会继续化、
         水滴会一直往下掉(自检里"松手后还在化"就是这么发现的)。 */
      if (warm.type !== "mouse") warm.on = false;
    }
    function onLeave() { warm.on = false; }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    root.addEventListener("pointerleave", onLeave);

    for (var ci = 0; ci < shards.length; ci++) {
      (function (i) {
        shards[i].addEventListener("click", function () {
          if (!active) return;
          /* ★ 拖着划过去松手,浏览器照样会在公共祖先上补一个 click。
             那不是"点这一片",所以按住期间走过超过 6px 就当成拖,不打开。 */
          if (dragDist > 6) return;
          openShard(i);
        });
        /* ★ 键盘:Tab 到哪一片,就在那一片上呵一口气(焦点 = 你的注意力)。
           这样"霜化开才点得到"这条规则不会把键盘用户挡在门外。 */
        shards[i].addEventListener("focus", function () { if (active && !collected[i]) warmShard(i); });
      })(ci);
    }
    if (readCard) readCard.addEventListener("click", function () { if (active) keepShard(); });
    if (readEl) readEl.addEventListener("click", function (e) { if (e.target === readEl) closeShard(); });
    document.addEventListener("keydown", function (e) {
      if (!active) return;
      if ((e.key === "Escape" || e.keyCode === 27) && openIdx >= 0) closeShard();
    });

    window.addEventListener("resize", function () {
      if (!active) return;
      clearTimeout(resize._t);
      resize._t = setTimeout(function () { resize(); paintFrost(); refreshShards(); }, 180);
    });

    return {
      key: root.getAttribute("data-frost") || "future",
      activate: function (on) {
        active = on;
        if (on) {
          /* 着色器的 iTime 从这一页被激活算起 —— 和雪那一场同一个口径
             (cd-boot.js 传的是 el/1000,el 是场景自己走过的毫秒数)。 */
          aurT0 = (window.performance && performance.now) ? performance.now() : Date.now();
          preloadAurora();
          /* 这一页的开机动画是"六分枝晶生长 → 从中心融化",放完才轮到我们 */
          if (!cols) requestAnimationFrame(function () { resize(); paintFrost(); refreshShards(); updateCount(); kick(); });
          else { resize(); paintFrost(); refreshShards(); updateCount(); kick(); }
        } else {
          stop();
          warm.on = false;
        }
      },
      reveal: function () { kick(); },
      /* 只重算可见度,不推进任何模拟 —— 给验收脚本用 */
      refresh: function () { measureZones(); refreshShards(); return diag.slice(); },
      repaint: function () { if (active) { resize(); paintFrost(); refreshShards(); } },
      state: function () {
        var sum = 0;
        for (var i = 0; i < cov.length; i++) sum += cov[i];
        var themes = {};
        for (var t = 0; t < shards.length; t++) {
          if (!themeOf[t]) continue;
          themes[themeOf[t]] = themes[themeOf[t]] || { total: 0, kept: 0 };
          themes[themeOf[t]].total++;
          if (collected[t]) themes[themeOf[t]].kept++;
        }
        return {
          key: "future", active: active, cols: cols, rows: rows,
          diag: diag.slice(),
          frost: +(sum / (cov.length || 1)).toFixed(3),
          shards: shards.length,
          kept: kept,
          open: openIdx,
          stars: mapEl ? mapEl.querySelectorAll(".frost-star").length : 0,
          lines: mapEl ? mapEl.querySelectorAll(".frost-starline").length : 0,
          themes: themes,
          done: root.classList.contains("is-done"),
          /* 交互状态:验收脚本靠它判"松手之后还在不在暖"(触摸的坑)*/
          warm: warm.on, warming: warm.type, pressing: pressing, reduced: reduced,
          meltCalls: meltCalls, lastMelt: lastMelt,
          drops: drip.length,
          count: countEl ? countEl.textContent : "",
          visible: shards.filter(function (e) { return parseFloat(e.style.getPropertyValue("--clear")) > 0.55; }).length
        };
      },
      /* 给验收脚本的"手":不用鼠标也能走完全程 */
      warmAt: function (x, y, amount) {
        melt(x, y, amount === undefined ? 0.25 : amount);
        paintFrost(); refreshShards();
        return true;
      },
      focusShard: function (i) { warmShard(i); rebuildMap(); return true; },
      /* 直接问"这个 CSS 坐标上的覆霜量是多少" —— 定位"暖化打偏了"这类问题用。
         (没有它的时候,我只能靠 diag 的每片均值去猜,绕了好几轮。) */
      covAt: function (x, y) {
        if (!cols || !rows) return -1;
        var c = Math.floor(x / CELL), r = Math.floor(y / CELL);
        if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
        return +cov[idx(c, r)].toFixed(3);
      },
      meltAll: function () { for (var i = 0; i < cov.length; i++) cov[i] = 0; paintFrost(); refreshShards(); return true; },
      freezeAll: function () { for (var i = 0; i < cov.length; i++) cov[i] = 1; paintFrost(); refreshShards(); return true; },
      open: function (i) { return openShard(i); },
      close: function () { closeShard(); return true; },
      keep: function () { return keepShard(); },
      collectAll: function () {
        for (var i = 0; i < shards.length; i++) {
          if (collected[i]) continue;
          openShard(i);
          keepShard();
        }
        rebuildMap(); updateCount(); checkDone();
        return kept;
      }
    };
  }

  if (window.CDPages && window.CDPages.register) {
    window.CDPages.register("frost", function (root) {
      var api = build(root);
      if (!api) return api;
      document.addEventListener("cd-boot-done", function () { api.reveal(); });
      document.addEventListener("cd-panel", function (e) {
        if (e.detail === "future" && !window.__bootRunning) setTimeout(api.reveal, 0);
      });
      setTimeout(function () {
        if (!window.__bootRunning &&
          document.querySelector(".intro-panel.is-active[data-panel='future']")) api.reveal();
      }, 0);
      return api;
    });
  }
})();
