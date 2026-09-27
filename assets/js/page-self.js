/* ============================================================
   第一张盘「自我」的主页内容:Emoji 拼贴自我介绍
   ─────────────────────────────────────────────────────────────
   一句话:屏幕中央一张【没有五官的灰脸】,四周飘着 9 个 emoji;
           每个 emoji 是一个特质,点一下(或拖上去)就贴到脸上、
           同时蹦出一句自我介绍;九个贴满 → 脸变成那个夸张形象,并汇总一段话。

   为什么是"点"为主、"拖"为辅:
     拖拽在触屏和触控板上成功率不稳(手指一抖就丢了),点击才是主力;
     拖拽是给愿意动手的人多的一点乐子。两者共用一套 pointer 事件,
     靠位移阈值(DRAG_T)区分,不写两份代码。

   三件必须成立的事(不然这个交互就不好玩):
     1) 每次放置都要有【立刻可见的反馈】—— 脸变了 + 一句话蹦出来,中间不等待。
        所以脸的变化是纯 CSS 过渡,不等飞行动画结束。
     2) 每次放置都要能【撤销】—— 放错了敢重来,观众才敢乱点。
        "放"和"拿"是同一个 is-placed 开关的两个方向。
     3) 剩下的 emoji 要【肉眼可数】—— 放一个少一个,进度感本身就是钩子,
        再配合左上角 00 / 09 的计数。

   两个时机问题(这一页特有的):
     · 这张盘的开机动画是「emoji 贴满屏幕 → 掉到屏幕底下」,而这一页要的正是
       【掉完之后只剩一张空脸】。所以动画还在放时不能自己亮相(否则空脸会从
       emoji 雨里透出来),等 cd-boot-done 再起。
     · 也不能死等:从别的盘切回来时根本没动画在放,那时要立刻自己起来。
       ⇒ 于是有"live(该显示)"和"revealed(已显示)"两个独立状态。

   数据从哪来:DOM 上的 data-self-* 属性(Hugo 从 hugo.toml 渲染出来),
   所以文案一个字都不在这个文件里 —— 想改就去改 hugo.toml。
   ============================================================ */
(function () {
  "use strict";

  /* 飘浮 emoji 的散布:奇数个时均匀铺满整圈(180° 起,避开正上方的标题);
     偶数个时两边对称。半径在 R0~R1 之间按 index 抖动,免得像一串珠子。
     ★ 特质从 9 个加到 15 个之后这两个值调过一次:
       15 个挤在一圈上会互相压住,所以外圈往外推、内圈也留出脸的宽度。 */
  var R0 = 0.36;          /* 内圈半径:占"飘浮区短边"的比例 */
  var R1 = 0.50;          /* 外圈半径:同上 */
  var DRAG_T = 6;         /* 位移超过这么多 px 才算"拖",否则算"点" */
  var FLY_MS = 460;       /* 飞向脸、贴上、落座:时长(ms)。与 pages.css 的 .self-pod 一致 */
  var U = 360;            /* 脸的 viewBox 边长(与 self.html 里的 SVG 一致) */
  var SEP = ",";          /* 汇总那句话里,几个特质碎片之间怎么隔开 */
  /* 背景装饰撒多少颗星(见 decorate)*/
  var STARS = 30;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function rnd(v) { var r = v | 0; return r < 0 ? 0 : r; }
  function later0(fn) { setTimeout(fn, 0); }   /* 别把重活塞进同一个 tick */

  /* 每张盘一个实例;多个面板同时存在时互不干扰 */
  function build(root) {
    var field = $("[data-self-field]", root);
    var stage = $("[data-self-stage]", root);
    var face = $(".self-face", root);
    var facebox = $(".self-facebox", root);
    var list = $("[data-self-list]", root);
    var countEl = $("[data-self-count]", root);
    var hintEl = $("[data-self-hint]", root);
    var card = $("[data-self-card]", root);
    var chipsEl = $("[data-self-chips]", root);
    var outEl = $("[data-self-out]", root);
    var deco = $("[data-self-deco]", root);
    if (!field || !stage || !face || !list || !countEl || !facebox) return null;

    var pods = $$("[data-self-pod]", root).map(function (btn, i) {
      return {
        btn: btn,
        key: btn.getAttribute("data-self-pod"),
        emoji: btn.getAttribute("data-self-emoji") || "",
        text: btn.getAttribute("data-self-text") || "",
        idx: i,
        placed: false,
        homeX: 0, homeY: 0
      };
    });
    /* pod 类型不从按钮上读,而是从脸那边对应的部件上读 —— 部件的 data-pod 才是
       "这个东西怎么贴"的唯一出处(self.html),按钮只管"飘着的是哪个 emoji"。
       这样两边不会各写一份、然后对不上。 */
    var POD_OF = {};
    $$(".self-face-part[data-part]", face).forEach(function (el) {
      POD_OF[el.getAttribute("data-part")] = el.getAttribute("data-pod") || "socket";
    });
    pods.forEach(function (p) { p.pod = POD_OF[p.key] || "socket"; });
    if (!pods.length) return null;
    var byKey = {};
    pods.forEach(function (p) { byKey[p.key] = p; });
    var total = pods.length;

    /* ★ 「贴满」到底算多少件?
       因为 skin 类互斥(融化 / 半透明 / 睁不开眼 同时只能有一层),
       所以【永远不可能 15 件同时在脸上】—— 如果判据写成 "n === total",
       那张身份证就一辈子弹不出来。
       正确的判据是:所有 socket 都贴上了,而且皮肤那一层也有了。
       于是把"同时最多能贴几件"单独算出来:
         slots = socket 的个数 + (有没有 skin ? 1 : 0) */
    var skinKeys = pods.filter(function (p) { return p.pod === "skin"; }).map(function (p) { return p.key; });
    var slots = pods.length - skinKeys.length + (skinKeys.length ? 1 : 0);

    var nPlaced = function () {
      var n = 0;
      pods.forEach(function (p) { if (p.placed) n++; });
      return n;
    };
    /* 贴满 = 每件 socket 都在,并且皮肤层有且只有一层 */
    var isFull = function () {
      var skins = 0, ok = true;
      pods.forEach(function (p) {
        if (p.pod === "skin") { if (p.placed) skins++; }
        else if (!p.placed) ok = false;
      });
      return ok && skins === (skinKeys.length ? 1 : 0);
    };

    var active = false, live = false, drag = null, flashT = 0, timers = [];
    var lines = {};   /* key -> 那句话的 <li>(放上去才建,拿下来就删)*/

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    /* 数的排列用【Halton 低差异序列】,不是 Math.random,也不是等比数列。
       · 不能用 Math.random:每次 resize 都重排,位置会跳,看着像在抖;
       · 也不能用等比数列(上一版就是 k*0.618… 那种):它会在有限个点里
         显出明显的螺旋/斜纹 —— 用户一眼就看出来了("星点排布太有规律")。
       Halton 既确定(刷新/改窗口都不变)又铺得均匀、没有可见的周期花纹。 */
    function halton(i, b) {
      var f = 1, r = 0;
      while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
      return r;
    }

    /* ---------- 飘浮:把每个 emoji 的"家"算成 CSS 变量(不用 JS 逐帧推) ----------
       ★ 版式是【脸在左、字在右】,emoji 要散布在【台词列左侧的整片地方】,
         而不是只围着脸绕一圈(用户 3rd 反馈)。
       做法:在这块矩形里用 Halton 撒候选点,逐个挑出满足两条约束的位置:
         · 不落在"脸的领地"里(半径 faceR + 一点余量);
         · 彼此至少隔开 minGap(免得两个 emoji 叠在一起分不清)。
       ★★ 关键:落点【必须】能接到指针。脸的领地只是"别摆在那儿",
          真正的点击判定是 JS 自己算距离的(见 onDown / onMove)——
          所以就算某个 emoji 贴得离脸很近,点它也不会被脸吃掉。 */
    function scatter() {
      var w = field.clientWidth, h = field.clientHeight;
      if (!w || !h) return;
      var fm = faceCenter();
      var pad = 44, yTop = 108;
      /* 右下角那片留给台词列,不越过它 */
      var rightLimit = w - Math.min(w * 0.40, 430) - 12;
      var leftLimit = pad;
      var bottomLimit = h - pad;
      var stageW = Math.min(w * 0.52, 620);
      var faceKeep = Math.min(stageW, Math.min(h, 600) * 0.57) / 2 + 30;
      /* 最小间距别开太大:emoji 泡本身直径约 62px,间距取 62~84。
         太小两个会糊在一起;太大则在脸右侧那条窄带里排不下 16 个 ——
         排不下就会退到下面的"绕脸一圈"兜底,那个明显比散布丑,
         所以这里宁可放宽间距,也要让散布本身成功。 */
      var minGap = Math.min(84, Math.max(62, w * 0.052));

      var chosen = [];
      var tries = 0, i = 1;
      while (chosen.length < pods.length && tries++ < 4000) {
        var px = leftLimit + halton(i, 2) * (rightLimit - leftLimit);
        var py = yTop + halton(i, 3) * (bottomLimit - yTop);
        i++;
        var dx = px - fm.x, dy = py - fm.y;
        if (dx * dx + dy * dy < faceKeep * faceKeep) continue;
        var clash = false;
        for (var c = 0; c < chosen.length; c++) {
          if (Math.hypot(chosen[c].x - px, chosen[c].y - py) < minGap) { clash = true; break; }
        }
        if (clash) continue;
        chosen.push({ x: px, y: py });
      }
      /* 万一地方实在太小(极端窄屏)排不下,剩下的就退回到"绕脸一圈"补位 */
      var k = 0;
      while (chosen.length < pods.length) {
        var deg = -90 + (k++ / pods.length) * 320;
        var rad = deg * Math.PI / 180;
        chosen.push({
          x: Math.max(pad, Math.min(rightLimit, fm.x + Math.cos(rad) * faceKeep * 1.25)),
          y: Math.max(yTop, Math.min(bottomLimit, fm.y + Math.sin(rad) * faceKeep * 1.05))
        });
      }
      pods.forEach(function (p, idx) {
        p.homeX = chosen[idx].x;
        p.homeY = chosen[idx].y;
        /* 没贴上去的才需要"家";贴上去的是 position:fixed,与布局无关 */
        if (!p.placed) {
          p.btn.style.setProperty("--x", p.homeX.toFixed(1) + "px");
          p.btn.style.setProperty("--y", p.homeY.toFixed(1) + "px");
        }
        p.btn.style.setProperty("--wob", (2.6 + (idx % 5) * 0.55).toFixed(2) + "s");
        p.btn.style.setProperty("--wob-d", (-(idx * 0.47)).toFixed(2) + "s");
      });
    }

    /* 脸的中心与半径 —— 脸上的落点换算和"点没点到脸"都靠这两个。
       ★ 现在有【两个】地方需要知道脸在哪(落点、命中判定),
         所以抽出来,免得两处各算一份然后对不上。 */
    function faceCenter() {
      var m = facebox.getBoundingClientRect();
      return { x: m.left + m.width / 2, y: m.top + m.height / 2, r: m.width / 2 };
    }

    function layout() {
      var m = facebox.getBoundingClientRect();
      root.style.setProperty("--self-face-w", m.width.toFixed(1) + "px");
      decorate();
      scatter();
    }

    /* ---------- 背景装饰:星星 + 准星环 + 刻度 ----------
       全都在一个 SVG 里、按面板实际尺寸现画,所以换窗口大小会跟着重排。
       ★ 三条规矩(不然装饰会变成干扰):
         1) 准星环【以脸为中心】(不是以面板为中心)—— 脸靠左,环也得靠左;
         2) 星星避开"脸的领地";右侧那一列留给台词,也不撒;
         3) 位置用固定乘数算(不是 Math.random),刷新/改变窗口时分布不变 ——
            随机会让版面看起来"在抖"。 */
    function decorate() {
      var svg = deco;
      if (!svg) return;
      var W = field.clientWidth || root.clientWidth;
      var H = field.clientHeight || root.clientHeight;
      if (!W || !H) return;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var base = Math.min(W, H);
      /* 脸的中心 = 左边那一列的正中(与 .self-stage / scatter 一致)*/
      var stageW = Math.min(W * 0.52, 620);
      var cx = stageW * 0.5, cy = H / 2;
      /* 脸的领地半径:脸最多 430px,半径就是 215,再留一点余量 */
      var faceR = Math.max(base * 0.30, 232);
      /* 台词列从这儿往右,星星不进去 */
      var textX = W - Math.min(W * 0.40, 430) - 14;
      var parts = [];

      /* 1) 准星环:大小两层,慢慢反向自转(脸像被"标定"着)*/
      parts.push('<g class="deco-ring" style="--spin:64s">');
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (faceR * 1.06).toFixed(1) + '"></circle>');
      parts.push('</g><g class="deco-ring deco-ring--rev" style="--spin:96s">');
      parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (faceR * 1.34).toFixed(1) + '" stroke-dasharray="3 11"></circle>');
      parts.push('</g>');

      /* 2) 四角刻度:一条一条短横线,像仪表的对位标记 */
      var tickR = faceR * 1.34;
      for (var a = 0; a < 32; a++) {
        var ang = (a / 32) * Math.PI * 2;
        var r1 = tickR + (a % 4 === 0 ? 12 : 6);
        var x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1;
        var x2 = cx + Math.cos(ang) * (r1 + (a % 4 === 0 ? 12 : 6));
        var y2 = cy + Math.sin(ang) * (r1 + (a % 4 === 0 ? 12 : 6));
        parts.push('<line class="deco-tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
          '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"></line>');
      }

      /* 3) 星星:撒在"脸的领地之外、标题带之下" */
      /* ★ 星星的位置用 Halton 低差异序列。
         上一版是 k*0.618… 这种等比数列 —— 确定是确定,但有限个点里会显出
         明显的螺旋/斜纹,用户一眼就看出来了("星点排布太有规律")。
         Halton 同样确定,却铺得均匀、没有肉眼可见的周期花纹。 */
      var put = 0, guard = 0;
      while (put < STARS && guard++ < STARS * 40) {
        var k = put + guard * 0.37;
        var sx = (halton(Math.round(k) + 1, 2) * 0.94 + 0.03) * W;
        var sy = (halton(Math.round(k) + 1, 3) * 0.86 + 0.10) * H;
        var dx = sx - cx, dy = sy - cy;
        if (dx * dx + dy * dy < faceR * faceR * 1.10) continue;   /* 压在脸上 → 重撒 */
        if (sx > textX) continue;                                  /* 落在台词列里 → 重撒 */
        var s = 1.6 + ((put * 7) % 5) * 0.85;
        var tw = (2.4 + (put % 6) * 0.7).toFixed(2);
        var dly = (-(put * 0.41)).toFixed(2);
        /* ★ 四角星:两条相对的凹弧拼成,没有十字也没有外框 ——
           旧的"十字 + 中心圆"缩到几像素就是一个带叉的小方框,
           用户直接把它当成了"左上角的撤回按钮"(见文件头注释)。 */
        var d = "M" + sx.toFixed(1) + " " + (sy - s).toFixed(2) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + (sx + s).toFixed(2) + " " + sy.toFixed(1) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + sx.toFixed(1) + " " + (sy + s).toFixed(2) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + (sx - s).toFixed(2) + " " + sy.toFixed(1) +
          "Q" + sx.toFixed(1) + " " + sy.toFixed(1) + " " + sx.toFixed(1) + " " + (sy - s).toFixed(2) + "z";
        parts.push('<g class="deco-star" style="--tw:' + tw + 's;--tw-d:' + dly + 's;transform-origin:' +
          sx.toFixed(1) + 'px ' + sy.toFixed(1) + 'px">' +
          '<path d="' + d + '"></path>' +
          '<circle class="deco-star__core" cx="' + sx.toFixed(1) + '" cy="' + sy.toFixed(1) +
          '" r="' + (s * 0.30).toFixed(2) + '"></circle>' +
          '</g>');
        put++;
      }
      svg.innerHTML = parts.join("");
    }

    /* ---------- 落点:把"点在屏幕上的哪一点"换算进 SVG 的坐标系 ---------- */
    function localToFace(clientX, clientY) {
      var m = facebox.getBoundingClientRect();
      var u = m.width / U;
      return {
        x: ((clientX - m.left) / u).toFixed(1),
        y: ((clientY - m.top) / u).toFixed(1),
        u: u, p: { x: clientX, y: clientY }
      };
    }
    function faceCenterPoint() {
      var m = facebox.getBoundingClientRect();
      return { x: m.left + m.width * 0.55, y: m.top + m.height * 0.48 };
    }

    /* ---------- 一句话蹦出来 ---------- */
    function addLine(p) {
      var li = document.createElement("li");
      li.className = "self-say__line";
      li.setAttribute("data-line", p.key);
      var em = document.createElement("span");
      em.className = "self-say__emoji";
      em.textContent = p.emoji;
      var tx = document.createElement("span");
      tx.className = "self-say__tx";
      tx.textContent = p.text;
      /* ★ 每行末尾一个 ×,而【整行】都可以点 —— 点这句话就把对应的 emoji
         从脸上拿下来(用户 6th 反馈要的"在右侧文本栏撤回")。
         × 只是个"这里能点"的提示,真正好按的是整行。 */
      var undo = document.createElement("span");
      undo.className = "self-say__undo";
      undo.setAttribute("aria-hidden", "true");
      undo.textContent = "×";
      li.appendChild(em);
      li.appendChild(tx);
      li.appendChild(undo);
      list.appendChild(li);
      lines[p.key] = li;
      syncHint();
      /* 台词长到超出这条带子的高度之后,要一直停在最新那一句上 ——
         否则第 15 句蹦出来的时候人还在看第 4 句。 */
      var sayEl = list.parentNode;
      if (sayEl && sayEl.scrollHeight > sayEl.clientHeight) sayEl.scrollTop = sayEl.scrollHeight;
    }
    function killLine(key) {
      var li = lines[key];
      if (!li) return;
      delete lines[key];
      li.classList.add("is-gone");
      later(function () { if (li.parentNode) li.parentNode.removeChild(li); }, 260);
      /* ★ 注意:这里不能用 syncHint() —— 此刻那条 <li> 还在 DOM 里(正在淡出),
         要等 260ms 之后才真的移除。所以拿下最后一条时,提示语得等到那一刻才回来。 */
      later(syncHint, 300);
    }

    /* 一句指令的来去:一句台词都没有的时候它应该在那儿(否则空屏幕上没字可读,
       用户不知道该干什么);一旦有人开始贴,它退场,把地方让给台词。
       ★ 放 / 拿两个方向都要走到这里 —— 只写"放上去时收起"的话,
         全部拿下来之后提示就再也不回来了。 */
    function syncHint() {
      if (!hintEl) return;
      hintEl.hidden = list.children.length > 0;
    }

    /* ---------- 脸:开 / 关一个特质对应的那组部件 ----------
       两种部件(由 DOM 上的 data-pod 声明,数据来自 hugo.toml 的 pod 字段):
         socket —— 往脸上【加】一样东西(眼镜、耳机、杯子、手柄、火苗……),可以叠加
         skin   —— 改整张脸【本身】的性质(融化 / 半透明 / 睁不开眼)
       ★ skin 类要靠 facebox 上的 is-* 类来驱动(轮廓遮罩、透明度、飘动),
         所以这里把每个 skin 都映射到一个类名上 —— 加新的 skin 特质时,
         在这里补一行,并在 pages.css 里给那个类写规则。 */
    var SKIN_CLASS = { melt: "is-melt", clear: "is-clear", heavy: "is-heavy" };

    function paintFace() {
      var has = function (k) { return !!(byKey[k] && byKey[k].placed); };
      var n = nPlaced();
      root.setAttribute("data-count", String(n));
      facebox.classList.toggle("is-done", isFull());
      facebox.classList.toggle("is-tint", n > 0);
      /* skin 类互斥:同时只留一个(见 place() 里为什么要把上一个顶掉)*/
      for (var k in SKIN_CLASS) {
        if (Object.prototype.hasOwnProperty.call(SKIN_CLASS, k)) {
          facebox.classList.toggle(SKIN_CLASS[k], has(k));
        }
      }
      /* 形变强度按"还能再贴几件"归一化,这样 socket 贴满时会显得最夸张 */
      facebox.style.setProperty("--deform", Math.min(1, n / slots).toFixed(3));
      $$(".self-face-part[data-part]", face).forEach(function (el) {
        el.toggleAttribute("data-on", has(el.getAttribute("data-part")));
      });
    }

    function flash() {
      facebox.classList.remove("is-flash");
      void facebox.offsetWidth;              /* 强制重排,让动画能重新开始 */
      facebox.classList.add("is-flash");
      if (flashT) clearTimeout(flashT);
      flashT = later(function () { facebox.classList.remove("is-flash"); }, 340);
    }

    function updateCount() {
      var n = nPlaced();
      countEl.textContent = ("0" + n).slice(-2) + " / " + ("0" + total).slice(-2);
      paintFace();
      return n;
    }

    /* ---------- 汇总:「自我 Emoji 身份证」----------
       从每个特质的句子里取【第一个逗号之前】那半句当碎片,按 hugo.toml 的顺序拼起来。
       为什么这么拼:加减一个特质汇总会跟着变,而且每块碎片都还是"他自己说过的话",
       不是我另编的一套形容词。 */
    function sum() {
      var frags = pods.filter(function (p) { return p.placed; })
        .map(function (p) { return p.text.split(/[,。;!?]/)[0]; });
      return "我是" + frags.join(SEP) + ",大概就是这样。";
    }
    function cardPaint() {
      var on = pods.filter(function (p) { return p.placed; });
      if (chipsEl) chipsEl.textContent = on.map(function (p) { return p.emoji; }).join(" ");
      if (outEl) outEl.textContent = sum();
    }

    /* ---------- 放上去 / 拿下来(同一个开关的两个方向) ---------- */
    function fly(p, target) {
      p.btn.style.setProperty("--fly-x", (p.homeX - target.x).toFixed(1) + "px");
      p.btn.style.setProperty("--fly-y", (p.homeY - target.y).toFixed(1) + "px");
      p.btn.classList.remove("is-flown");
      void p.btn.offsetWidth;
      p.btn.classList.add("is-flying");
      later(function () {
        if (!p.placed) return;               /* 半路被撤销了就别落座 */
        p.btn.classList.remove("is-flying");
        p.btn.classList.add("is-flown");
      }, FLY_MS);
    }

    function place(p, at) {
      if (p.placed) return;
      /* ★ skin 类互斥:融化 / 半透明 / 睁不开眼 改的都是"脸本身",
         两个同时上会互相打架(一边化掉一边又飘起来,看着就是坏的)。
         所以贴一个新的 skin 时,把已经在脸上的那个 skin 悄悄摘掉 ——
         像换一层皮,而不是往上叠。socket 类不受影响(眼镜和耳机本来就该能同时戴)。 */
      if (p.pod === "skin") {
        pods.forEach(function (q) { if (q !== p && q.pod === "skin" && q.placed) unplace(q); });
      }
      p.placed = true;
      var t = at || localToFace(faceCenterPoint().x, faceCenterPoint().y);
      p.btn.style.setProperty("--tx", t.x);
      p.btn.style.setProperty("--ty", t.y);
      p.btn.style.setProperty("--tu", t.u.toFixed(4));
      p.btn.style.setProperty("--tr", rnd(-16 + Math.random() * 32) + "deg");
      p.btn.style.setProperty("--hit", (t.u * 150).toFixed(1) + "px");
      p.btn.classList.add("is-placed");
      fly(p, t.p);
      addLine(p);
      flash();
      if (updateCount() === slots) later(complete, FLY_MS + 140);
    }

    function unplace(p) {
      if (!p.placed) return;
      p.placed = false;
      p.btn.classList.remove("is-flying", "is-flown", "is-placed");
      killLine(p.key);
      if (card) { card.hidden = true; card.classList.remove("is-in"); }
      updateCount();
    }

    function complete() {
      if (!card) return;
      cardPaint();
      card.hidden = false;
      card.classList.remove("is-in");
      void card.offsetWidth;
      card.classList.add("is-in");
      if (outEl && outEl.scrollHeight > outEl.clientHeight + 2) outEl.classList.add("is-long");
    }

    function reset() {
      pods.slice().forEach(unplace);
      if (hintEl) syncHint();
      updateCount();
    }

    /* ---------- 输入:点击 / 拖拽 / 键盘 ---------- */
    function podOf(t) { return (t && t.closest) ? t.closest("[data-self-pod]") : null; }

    /* 点到脸了吗 —— ★ 自己算距离,不用 DOM 命中测试。
       这是用户反复报的那个 bug 的根治办法:只要判定不看 DOM,
       "脸盖住了 emoji"这件事在结构上就不可能发生。
       R_HIT 比脸的半径略大一点,是因为拖拽时 emoji 是【飞进去】的:
       松手差几像素也应该算数,不该让人对着脸边缘反复试。 */
    var R_HIT = 1.18;
    function onFace(cx, cy) {
      var f = faceCenter();
      return Math.sqrt((cx - f.x) * (cx - f.x) + (cy - f.y) * (cy - f.y)) <= f.r * R_HIT;
    }

    function onDown(e) {
      if (!active || e.button) return;
      var btn = podOf(e.target);
      if (btn && btn.classList.contains("is-placed")) return;   /* 贴上去的走"点一下拿下来" */
      drag = {
        x0: e.clientX, y0: e.clientY, btn: btn, moved: false, shot: null,
        key: btn ? btn.getAttribute("data-self-pod") : ""
      };
      /* 指针捕获挂在 field 上:它就是这块面板,所有 pointer 事件都归它收。
         捕获之后即使指针扫到脸上(或扫出面板),move/up 仍然送到这里 ——
         拖拽不会中途丢掉。 */
      try { field.setPointerCapture(e.pointerId); } catch (err) { /* 无所谓 */ }
    }

    function onMove(e) {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < DRAG_T) return;
      if (!drag.moved) {
        drag.moved = true;
        root.classList.add("is-drag");
        if (drag.btn) {
          drag.shot = document.createElement("span");
          drag.shot.className = "self-shot";
          drag.shot.setAttribute("aria-hidden", "true");
          drag.shot.textContent = drag.btn.getAttribute("data-self-emoji") || "";
          root.appendChild(drag.shot);
        }
      }
      if (drag.shot) {
        drag.shot.style.left = e.clientX + "px";
        drag.shot.style.top = e.clientY + "px";
        /* 只要【离脸够近】就给高亮,比"必须严格落进方框"宽容 ——
           手上有个明确的"放这儿"的信号,才好对准 */
        var near = onFace(e.clientX, e.clientY);
        drag.shot.classList.toggle("is-hot", near);
        facebox.classList.toggle("is-hot", near);
      }
    }

    function onUp(e) {
      if (!drag) return;
      var d = drag;
      drag = null;
      root.classList.remove("is-drag");
      facebox.classList.remove("is-hot");
      if (d.shot && d.shot.parentNode) d.shot.parentNode.removeChild(d.shot);
      if (!d.key) return;
      var inside = onFace(e.clientX, e.clientY);
      var p = byKey[d.key];
      if (!p) return;
      if (d.moved) {
        /* 拖到脸上 → 在落点贴上;拖到别处 → 什么都不做(不算数,也不惩罚) */
        if (inside) place(p, localToFace(e.clientX, e.clientY));
      } else if (inside) {
        place(p);
      }
    }

    /* 点一下 = 拿下来。两个入口:
         1) 点脸上那个已经贴上去的 emoji;
         2) ★ 点右侧台词栏里对应的那一句(用户 6th 反馈要的)——
            眼睛本来就在读那列字,手落在那里最自然。 */
    function onClick(e) {
      if (!active) return;
      var btn = podOf(e.target);
      if (btn && btn.classList.contains("is-placed")) {
        var q = byKey[btn.getAttribute("data-self-pod")];
        if (q) unplace(q);
        return;
      }
      var row = (e.target && e.target.closest) ? e.target.closest("[data-line]") : null;
      if (row) {
        var p2 = byKey[row.getAttribute("data-line")];
        if (p2 && p2.placed) unplace(p2);
      }
    }

    function onKey(e) {
      if (!active) return;
      if (e.key === "Escape") { reset(); return; }
      if (e.key !== "Enter" && e.key !== " ") return;
      var btn = podOf(e.target);
      if (!btn) return;
      e.preventDefault();
      var p = byKey[btn.getAttribute("data-self-pod")];
      if (!p) return;
      if (p.placed) unplace(p); else place(p);
    }

    field.addEventListener("pointerdown", onDown);
    field.addEventListener("pointermove", onMove);
    field.addEventListener("pointerup", onUp);
    field.addEventListener("pointercancel", onUp);
    field.addEventListener("click", onClick);
    /* 台词栏不在 .self-field 里(它在右侧那列),所以点击要再挂一份在 root 上 */
    root.addEventListener("click", onClick);
    /* ★ 键盘监听挂在 root 而不是 field 上:field 只盖住飘浮区,
       焦点跑到右侧的台词区 / "再来一次"按钮上时,Escape 就收不到了。
       挂在 root 上整页都算数(处理函数里仍然只认 [data-self-pod])。 */
    root.addEventListener("keydown", onKey);
    root.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-self-reset]")) reset();
    });

    /* ---------- live:该显示了(空脸 + 飘浮 emoji 该出场了) ---------- */
    function gotoLive() {
      if (live) return;
      live = true;
      layout();
      root.classList.add("is-live");
    }

    updateCount();
    if (card) card.hidden = true;

    return {
      key: root.getAttribute("data-self") || "self",
      /* 面板被选中/换下。注意:被选中 ≠ 立刻显示 —— 还要等开机动画放完(见文件头)*/
      activate: function (on) {
        active = on;
        if (on) {
          if (!window.__bootRunning) gotoLive();
        } else {
          if (drag) onUp({ clientX: 0, clientY: 0 });
          clearTimers();
        }
      },
      /* 开机动画放完了(或确认没有动画) —— 现在可以亮相 */
      reveal: gotoLive,
      repaint: function () { if (active) layout(); },
      /* 调试 / 验收入口:window.CDPages.get("self").state() */
      state: function () {
        return {
          key: "self", active: active, live: live,
          total: total,
          /* 同时最多能贴几件(socket 全上 + 皮肤一层);判"贴满"看的是它 */
          slots: slots,
          placed: pods.filter(function (p) { return p.placed; }).map(function (p) { return p.key; }),
          lines: list.children.length,
          done: !!(card && !card.hidden),
          out: outEl ? outEl.textContent : ""
        };
      },
      /* 让验收脚本不用鼠标也能走完全程 */
      place: function (key) { var p = byKey[key]; if (p) place(p); return !!(p && p.placed); },
      unplace: function (key) { var p = byKey[key]; if (p) unplace(p); },
      reset: reset
    };
  }

  if (window.CDPages && window.CDPages.register) {
    window.CDPages.register("self", function (root) {
      var api = build(root);
      if (!api) return api;
      function go() { api.reveal(); }
      /* 开机动画放完 → 亮相。这就是"所有 emoji 掉出屏幕后只剩一张空脸"那一刻 */
      document.addEventListener("cd-boot-done", go);
      /* 切到这一页时:没有动画在放就立刻亮相(从别的盘切回来的情况)*/
      document.addEventListener("cd-panel", function (e) {
        if (e.detail !== "self") return;
        if (!window.__bootRunning) later0(go);
      });
      /* 兜底:注册时这一页已经是选中的那张(首屏就是它),而且没有动画在放 */
      later0(function () {
        if (!window.__bootRunning &&
          document.querySelector(".intro-panel.is-active[data-panel='self']")) go();
      });
      return api;
    });
  }
})();
