/* 主界面"开机动画"——每张盘一套
   ------------------------------------------------------------------
   约定:每个 scene 返回 { total, draw(el) },runner(intro.js)只负责
   清屏、计时、收尾。scene 自己负责"怎么盖住页面"和"怎么把页面揭开"。

   5 套:
     emoji   自我 —— 大黄脸随机贴满屏幕(后贴的盖前面的)→ 一起掉到屏幕底下
     hex     成长 —— 一整块六边形面板 → 描边随机画出 → 从第 4 行开始向上下逐行消失
     water   迷茫 —— 水从底部漫上来 → 鱼群游过(含 DeepSeek 鲸鱼)→ 水退回
     glitch  技术 —— 先是这张盘的封面 → 再是 WARING!!!DISK ERROR!!!(等长)→ 切片飞走
     fractal 未来 —— 六角枝晶雪花边生长边从中心融化 → 迭代完成后圆形扩散清掉黑底
   ------------------------------------------------------------------
   依赖:必须在 intro.js 之前加载(window.CDBoot) */
(function () {
  "use strict";

  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeOutQuad = function (t) { return 1 - (1 - t) * (1 - t); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeOutBack = function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };

  /* ================= 素材加载 ================= */
  /* 小黄脸:用户的 svg 有三点要处理,否则 canvas 里画出来是错的 ——
       1) 没有 width/height → <img> 里给 300x150 视口,画出来会被压扁
       2) 自带 <style> 描边动画 → 抓到的可能是"画了一半"的样子
       3) 右下角有 emojiall.com 水印 <a><text> */
  var EMOJI_CODES = [0x1f603, 0x1f602, 0x1f60e, 0x1f618, 0x1f61d, 0x1f621, 0x1f62d, 0x1f630, 0x1f914, 0x1f9d0];
  var _emoji = [];
  var _emojiByCode = {};
  var _emojiLoading = false;

  function blobImage(svg) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    });
  }

  function loadEmojis() {
    if (_emojiLoading) return;
    _emojiLoading = true;
    EMOJI_CODES.forEach(function (cp) {
      fetch("/assets/emoji/" + encodeURIComponent(String.fromCodePoint(cp)) + ".svg")
        .then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (svg) {
          if (!svg) return null;
          svg = svg.replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<a[\s\S]*?<\/a>/gi, "")
            .replace(/<svg /, '<svg width="36" height="36" stroke="none" ');
          return blobImage(svg);
        })
        .then(function (im) {
          if (!im) return;
          _emojiByCode[cp] = im;
          _emoji.push(im);
        })
        .catch(function () { });
    });
  }

  /* DeepSeek 鲸鱼:原图是单条纯黑路径,画在深色水里看不见 → 重新上色。
     注意这个 svg 自己带 width/height,直接当图片加载即可 ——
     之前走 fetch+改文本的路子,给它又加了一对 width/height,
     属性重复 → XML 非法 → 图片加载失败,所以鲸鱼一直没出现 ✗ */
  var _whale = null, _whaleLoading = false;
  function loadWhale() {
    if (_whaleLoading) return;
    _whaleLoading = true;
    var im = new Image();
    im.onload = function () {
      try {
        var c = document.createElement("canvas");
        c.width = 254; c.height = 200;
        var g = c.getContext("2d");
        g.drawImage(im, 0, 0, 254, 200);
        g.globalCompositeOperation = "source-atop";     /* 只刷已有像素 → 保持鲸鱼轮廓 */
        g.fillStyle = "#9fe8ff";
        g.fillRect(0, 0, 254, 200);
        _whale = c;
      } catch (e) { _whale = null; }
    };
    im.onerror = function () { _whale = null; };
    im.src = "/assets/eggs/deepseek.svg";
  }

  /* 故障那套要用的盘封面 */
  var _techImg = null;
  function loadTechCover() {
    if (_techImg) return;
    var im = new Image();
    im.onload = function () { _techImg = im; };
    im.src = "/assets/cd/cds/tech.webp";               /* 方形封面,画的时候缩到屏幕中间 */
  }

  function drawFallbackFace(ctx, s) {
    ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcc4d"; ctx.fill();
    ctx.fillStyle = "#664500";
    ctx.beginPath(); ctx.arc(-s * 0.17, -s * 0.14, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.17, -s * 0.14, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.28, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.lineWidth = s * 0.06; ctx.strokeStyle = "#664500"; ctx.stroke();
  }

  /* ================= 1. emoji:随机贴满 → 掉到屏幕底下(自我) =================
     随机撒点,后贴的盖在前面的上面;靠"覆盖采样点"判断是否贴满:
     每次挑一个还没被盖住的采样点,在它附近贴一张,然后把它圆内的采样点标掉。
     没有底板 —— 页面之所以被盖住,完全靠这些互相重叠的脸。 */
  function sceneEmoji(ctx, W, H) {
    loadEmojis();
    var S = Math.min(W, H) * 0.20;
    var step = Math.max(20, Math.round(S * 0.2));
    var samples = [];
    for (var sy = step / 2; sy < H; sy += step) {
      for (var sx = step / 2; sx < W; sx += step) samples.push({ x: sx, y: sy });
    }
    var open = samples.map(function (_, i) { return i; });
    var pieces = [];
    var guard = 0;
    while (open.length && pieces.length < 260 && guard++ < 900) {
      var c0 = samples[open[(Math.random() * open.length) | 0]];
      var size = S * rand(0.9, 1.4);
      var px = c0.x + rand(-0.22, 0.22) * size;
      var py = c0.y + rand(-0.22, 0.22) * size;
      pieces.push({
        x: px, y: py, size: size,
        rot: rand(-0.7, 0.7) + (Math.random() > 0.5 ? Math.PI : 0),
        spin: rand(-3.2, 3.2),
        cp: pick(EMOJI_CODES),
        popAt: pieces.length * 8 + rand(0, 70),
        fallAt: rand(0, 340)
      });
      var r2 = (size * 0.5) * (size * 0.5);
      open = open.filter(function (idx) {
        var dx = samples[idx].x - px, dy = samples[idx].y - py;
        return dx * dx + dy * dy > r2;
      });
    }
    var T = { fill: Math.min(1100, pieces.length * 8 + 320), hold: 220, fall: 900 };

    return {
      total: T.fill + T.hold + T.fall + 60,
      draw: function (el) {
        for (var i = 0; i < pieces.length; i++) {
          var e = pieces[i];
          var pop = clamp((el - e.popAt) / 240, 0, 1);
          if (pop <= 0) continue;
          var ft = el - T.fill - T.hold - e.fallAt;
          var dy = 0, rot = e.rot, sc = easeOutBack(pop);
          if (ft > 0) {                                     /* 自由落体,一路掉到屏幕底下 */
            var t = ft / 1000;
            dy = 0.5 * 5600 * t * t;
            rot += e.spin * t;
            if (e.y + dy > H + e.size * 1.4) continue;
          }
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.translate(e.x, e.y + dy);
          ctx.rotate(rot);
          ctx.scale(sc, sc);
          var im = _emojiByCode[e.cp];
          if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -e.size / 2, -e.size / 2, e.size, e.size);
          else drawFallbackFace(ctx, e.size);
          ctx.restore();
        }
      }
    };
  }

  /* ================= 2. 六边形矩阵(成长) ================= */
  function hexPath(ctx, R) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i - 90);
      if (i === 0) ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      else ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    }
    ctx.closePath();
  }

  function sceneHex(ctx, W, H, accent, cfg) {
    var HX = cfg || {};
    var rows = HX.rows || 7, cols = HX.cols || 15;          /* 7 行:消失顺序 4→3/5→2/6→1/7 */
    var R = Math.max(W / (cols * 1.732), H / (rows * 1.49));
    var hw = 1.732 * R, stepY = 1.49 * R, per = 6 * R;
    var gridW = (cols + 2) * hw, gridH = (rows + 2) * stepY;
    var ox = (W - gridW) / 2;
    /* 行号从 -1 铺到 rows,所以纵向要多让一行才真的居中 ——
       否则屏幕中线上的其实是 r+1 那一行,"中间行最先消失"就会变成"第三行先消失" */
    var oy = (H - gridH) / 2 + stepY;
    var midRow = (rows - 1) / 2, midCol = cols / 2;
    var COLLAPSE = HX.collapse || 620;
    var ROW_STEP = COLLAPSE * 0.5;                          /* 上一行消失一半,下一行才开始 */
    var COL_STEP = COLLAPSE * 0.0018;                       /* 行内:中间先,两边后 */
    var hexes = [];
    for (var r = -1; r <= rows; r++) {
      for (var c = -1; c <= cols + 1; c++) {
        var x = ox + c * hw + (Math.abs(r % 2) ? hw / 2 : 0);
        var y = oy + r * stepY;
        var rowD = Math.abs(r - midRow);
        var colD = Math.abs(c - midCol);
        hexes.push({
          x: x, y: y,
          drawAt: Math.random(),
          dir: Math.random() > 0.5 ? 1 : -1,
          colDelay: rowD * ROW_STEP + colD * COL_STEP
        });
      }
    }
    var drawWindow = hexes.length * (HX.drawEach || 2.2);
    var maxColDelay = 0;
    hexes.forEach(function (h) { if (h.colDelay > maxColDelay) maxColDelay = h.colDelay; });
    var tCol0 = (HX.draw || 430) + drawWindow;
    return {
      total: tCol0 + COLLAPSE + maxColDelay,
      draw: function (el) {
        for (var i = 0; i < hexes.length; i++) {
          var h = hexes[i];
          var dp = clamp((el - h.drawAt * drawWindow) / (HX.draw || 430), 0, 1);
          var cp = clamp((el - tCol0 - h.colDelay) / COLLAPSE, 0, 1);
          if (cp >= 1) continue;
          var scale = cp > 0 ? 1 - easeOutQuad(cp) : 1;
          if (scale <= 0.012) continue;
          ctx.save();
          ctx.translate(h.x, h.y);
          if (cp > 0) ctx.scale(scale, scale);
          hexPath(ctx, R);
          ctx.globalAlpha = 1 - cp * 0.15;
          ctx.fillStyle = "#141b26";
          ctx.fill();
          if (dp > 0) {
            ctx.globalAlpha = Math.min(1, dp * 1.15) * (1 - cp * 0.55);
            ctx.setLineDash([per]);
            ctx.lineDashOffset = -h.dir * per * (1 - easeOutQuart(dp));
            ctx.strokeStyle = accent;
            ctx.lineWidth = Math.max(0.6, R * 0.018);   /* 边框细一点 */
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ================= 3. 水面 + 鱼群(迷茫) ================= */
  function sceneWater(ctx, W, H, accent) {
    loadWhale();
    var RISE = 950, HOLD = 1500, EBB = 850;
    var fish = [];
    for (var i = 0; i < 10; i++) {
      fish.push({
        y: rand(0.12, 0.92),
        r: rand(0.035, 0.085) * Math.min(W, H),
        sp: rand(0.10, 0.26) * (Math.random() > 0.5 ? 1 : -1),
        x: Math.random(),
        ph: rand(0, 6.28),
        hue: rand(0.48, 0.56),
        boss: i === 0                       /* 第一条大鱼 = 写着站名的彩蛋鱼 */
      });
    }
    fish[0].r *= 2.15;
    fish[0].y = 0.62;                        /* 位置固定一点,保证在"水盖满"那段里看得见 */
    fish[0].sp = 0.16;
    /* DeepSeek 鲸鱼:横穿的时间固定在水盖满的那一段,保证一定看得到 */
    var whale = { y: 0.4 };

    function level(el) {
      if (el < RISE) return easeOutQuad(el / RISE) * 1.12;
      if (el < RISE + HOLD) return 1.12;
      return 1.12 * (1 - easeInOut(clamp((el - RISE - HOLD) / EBB, 0, 1)));
    }
    function surface(base, x, el) {
      return base
        + Math.sin(x / W * Math.PI * 6 + el / 620) * (7 + 9 * Math.min(1, Math.max(0, base) / H))
        + Math.sin(x / W * Math.PI * 15 - el / 380) * 4
        + Math.sin(x / W * Math.PI * 2.5 + el / 900) * 6;
    }
    /* 鱼:梭形身 + 尾鳍(没有背鳍了 —— 之前那个立起来的鳍看着像独角) */
    function fishBody(x, y, r, wig, dir) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, 1);
      ctx.beginPath();
      ctx.moveTo(-r * 1.5, 0);
      ctx.quadraticCurveTo(-r * 0.15, -r * 0.88, r * 1.15, 0);
      ctx.quadraticCurveTo(-r * 0.15, r * 0.88, -r * 1.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();                                   /* 尾鳍(接头往身体里多伸一点,免得看着断开)*/
      ctx.moveTo(-r * 1.15, 0);
      ctx.lineTo(-r * 2.35, -r * (0.62 + wig));
      ctx.lineTo(-r * 1.95, 0);
      ctx.lineTo(-r * 2.35, r * (0.62 - wig));
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();                                   /* 眼睛 */
      ctx.arc(r * 0.62, -r * 0.1, Math.max(1.1, r * 0.09), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(4,22,31,0.85)";
      ctx.fill();
      ctx.restore();
    }

    return {
      total: RISE + HOLD + EBB + 60,
      draw: function (el) {
        var lv = level(el);
        var base = H * (1 - lv);
        var g = ctx.createLinearGradient(0, Math.min(base, 0), 0, H);
        g.addColorStop(0, "#1d6b8c");
        g.addColorStop(0.25, "#0d4460");
        g.addColorStop(1, "#04141f");
        ctx.beginPath();
        ctx.moveTo(-20, H + 40);
        for (var x = -20; x <= W + 20; x += 24) ctx.lineTo(x, surface(base, x, el));
        ctx.lineTo(W + 20, H + 40);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        for (var x2 = -20; x2 <= W + 20; x2 += 24) {
          if (x2 === -20) ctx.moveTo(x2, surface(base, x2, el)); else ctx.lineTo(x2, surface(base, x2, el));
        }
        ctx.strokeStyle = "rgba(190,240,255,0.55)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        var t = el / 1000;
        /* 小鱼 */
        for (var i = 0; i < fish.length; i++) {
          var f = fish[i];
          var fx = ((f.x + f.sp * t) % 1.6 + 1.6) % 1.6 - 0.3;
          var px = fx * W, py = f.y * H;
          if (py < surface(base, px, el) + f.r * 0.4) continue;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "hsl(" + Math.round(f.hue * 360) + " " + Math.round(45 + f.r * 2) + "% " + Math.round(58 + Math.sin(f.ph) * 12) + "%)";
          fishBody(px, py, f.r, Math.sin(t * 7 + f.ph) * 0.55, f.sp > 0 ? 1 : -1);
          if (f.boss) {                                      /* 彩蛋:大鱼身上写着站名 */
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#04222f";
            ctx.font = "700 " + Math.round(f.r * 0.42) + "px ui-monospace, Consolas, monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(f.sp > 0 ? 1 : -1, 1);
            ctx.fillText("TUAGFEY", -f.r * 0.15, 0);
            ctx.restore();
          }
        }
        /* DeepSeek 鲸鱼(彩蛋):在"水盖满"那段时间里从左边横穿到右边 */
        if (_whale) {
          var wp = clamp((el - RISE * 0.55) / (HOLD * 0.95), 0, 1);
          if (wp > 0 && wp < 1) {
            var wr = Math.min(W, H) * 0.032;             /* 缩小五倍的小鲸鱼 */
            var ww = wr * 2.4, wh = ww * (200 / 254);
            var wpx = (-0.2 + wp * 1.4) * W;
            var wpy = whale.y * H + Math.sin(t * 1.1) * 16;
            if (wpy > surface(base, wpx, el) + wh * 0.5) {
              ctx.save();
              ctx.globalAlpha = 0.95;
              ctx.translate(wpx, wpy);
              ctx.rotate(Math.sin(t * 1.1) * 0.07);
              ctx.drawImage(_whale, -ww / 2, -wh / 2, ww, wh);
              ctx.restore();
            }
          }
        }
        ctx.globalAlpha = 1;
        for (var b = 0; b < 26; b++) {
          var bx = ((b * 97 % 100) / 100) * W + Math.sin(t * 1.4 + b) * 14;
          var by = H - ((t * (24 + b % 7 * 9) + b * 61) % (H + 60));
          if (by < base) continue;
          ctx.beginPath();
          ctx.arc(bx, by, 1.6 + (b % 3), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(200,240,255,0.35)";
          ctx.fill();
        }
        ctx.restore();
      }
    };
  }

  /* ================= 4. 故障(技术) =================
     先放这张盘的封面,再放 WARING!!!DISK ERROR!!!,两者时长相同;
     都是"故障"的样子:RGB 分离 + 横向条带错位 + 随机切片 + 扫描线。
     最后整个画面切成横带向两侧飞走,露出页面。 */
  function sceneGlitch(ctx, W, H, accent) {
    loadTechCover();
    var HALF = 1150, REV = 900;
    var word = "WARING!!!DISK ERROR!!!";
    var bands = 22;

    function corrupt(drawWhat) {
      ctx.fillStyle = "#05070c";
      ctx.fillRect(0, 0, W, H);
      /* 随机横向条带错位 */
      var step = 24;
      for (var y = 0; y < H; y += step) {
        if (Math.random() > 0.45) continue;
        var off = (Math.random() - 0.5) * 90;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, y, W, step - 2); ctx.clip();
        ctx.globalAlpha = rand(0.05, 0.2);
        ctx.fillStyle = Math.random() > 0.5 ? accent : "#ff2d55";
        ctx.fillRect(off, y, W, step - 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      drawWhat();
      /* 随机切片剪裁 */
      for (var k = 0; k < 4; k++) {
        var cx = Math.random() * W * 0.8, cy = Math.random() * H * 0.8;
        ctx.save();
        ctx.beginPath(); ctx.rect(cx, cy, rand(0.1, 0.4) * W, rand(0.05, 0.26) * H); ctx.clip();
        ctx.globalAlpha = 0.6;
        ctx.translate(rand(-0.1, 0.1) * W, rand(-0.05, 0.05) * H);
        drawWhat();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      /* 扫描线 */
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      for (var sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    }

    function cover() {
      if (_techImg && _techImg.complete && _techImg.naturalWidth) {
        /* 正方形封面:缩到纵向占屏幕一半,居中放,四周留出黑底 */
        var dh = H * 0.5;
        var dw = dh * (_techImg.naturalWidth / _techImg.naturalHeight);
        var jx = (Math.random() - 0.5) * 10, jy = (Math.random() - 0.5) * 8;
        var dx = (W - dw) / 2, dy = (H - dh) / 2;
        ctx.drawImage(_techImg, dx + jx, dy + jy, dw, dh);
        /* 通道错位(故障感)*/
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.45;
        ctx.drawImage(_techImg, dx + jx - 7, dy + jy, dw, dh);
        ctx.fillStyle = "#ff0033";
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35;
        ctx.drawImage(_techImg, dx + jx + 7, dy + jy, dw, dh);
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = accent;
        ctx.fillRect(W * 0.35, H * 0.25, W * 0.3, H * 0.5);
      }
    }

    function errorText() {
      var big = Math.round(Math.min(W / (word.length * 0.62), H * 0.24));
      var jx = (Math.random() - 0.5) * big * 0.22, jy = (Math.random() - 0.5) * big * 0.14;
      var lw = Math.max(2, big * 0.07);
      ctx.font = "900 " + big + "px Impact, 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      /* 红蓝分离的描边重影 */
      ctx.globalCompositeOperation = "screen";
      ctx.lineWidth = lw;
      ctx.strokeStyle = "#ff0033";
      ctx.strokeText(word, W / 2 + jx + big * 0.035, H / 2 + jy);
      ctx.strokeStyle = "#0066ff";
      ctx.strokeText(word, W / 2 + jx - big * 0.035, H / 2 + jy);
      ctx.globalCompositeOperation = "source-over";
      /* 正体:红色描边 + 深色内填 */
      ctx.lineWidth = lw;
      ctx.strokeStyle = "#ff2d4d";
      ctx.strokeText(word, W / 2 + jx, H / 2 + jy);
      ctx.fillStyle = "#0a0d14";
      ctx.fillText(word, W / 2 + jx, H / 2 + jy);
      ctx.globalAlpha = 1;
    }

    return {
      total: HALF * 2 + REV,
      draw: function (el) {
        if (el < HALF) { corrupt(cover); return; }
        if (el < HALF * 2) { corrupt(errorText); return; }
        var p = clamp((el - HALF * 2) / REV, 0, 1);
        var bh = H / bands;
        for (var i = 0; i < bands; i++) {
          var d = clamp((p - (i / bands) * 0.55) / 0.45, 0, 1);
          if (d >= 1) continue;                            /* 这条已飞走 → 露出页面 */
          var dir = i % 2 ? 1 : -1;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, i * bh, W, bh + 0.6); ctx.clip();
          ctx.translate(dir * easeOutQuart(d) * (W * 1.25 + 200), 0);
          ctx.globalAlpha = 1 - d * 0.25;
          corrupt(errorText);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ================= 5. 暴风雪 + 雪线刷新(未来) =================
     很多小雪花从右上角飘向左下角(暴风雪),然后一条斜线从右上角扫到左下角,
     扫过的区域露出页面。线上的雪特别密,把这条硬边盖住 ——
     看起来就是"一阵雪把屏幕刷了一遍"。 */
  var W0 = 0, H0 = 0;
  function sceneFractal(ctx, W, H, accent) {
    W0 = W; H0 = H;
    var BUILD = 650, SWEEP = 1500, TAIL = 450;
    var SPAN = W + H;                      /* 斜坐标 s=(W-x)+y:右上角 0 → 左下角 W+H */
    var flakes = [];
    for (var i = 0; i < 200; i++) {
      flakes.push({
        s0: Math.random() * SPAN * 1.25,        /* 沿"右上→左下"的初始位置 */
        p0: rand(-H * 0.25, SPAN + H * 0.25),   /* 垂直方向的坐标 */
        size: rand(2.5, 11),
        rot0: rand(0, Math.PI),
        ph: rand(0, 6.28),
        spd: rand(0.7, 1.4),
        a: rand(0.5, 1)
      });
    }
    /* 六角小雪花:三条短线交叉(小尺寸下足够像) */
    function flake(x, y, r, rot, alpha, tint) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = tint || "#dff3ff";
      ctx.lineWidth = Math.max(0.7, r * 0.22);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var k = 0; k < 3; k++) {
        var a = k * Math.PI / 3;
        ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.restore();
    }
    /* 斜坐标 (s,p) → 屏幕坐标:s 从右上角的小值涨到左下角的大值,就是暴风雪的方向。
       s=(W-x)+y、p=x+y 反解出 x=(p-s+W)/2、y=(p+s-W)/2 */
    function place(f, t) {
      var s = (f.s0 + t * f.spd * 300) % (SPAN * 1.25);
      if (s < 0) s += SPAN * 1.25;
      s -= SPAN * 0.12;
      return { x: (f.p0 - s + W) / 2, y: (f.p0 + s - W) / 2, s: s };
    }

    return {
      total: BUILD + SWEEP + TAIL,
      draw: function (el) {
        var t = el / 1000;
        /* 底:黑屏(扫过的部分用 destination-out 挖掉)*/
        ctx.fillStyle = "#05080f";
        ctx.fillRect(0, 0, W, H);
        /* 雪线位置:BUILD 之后从右上扫到左下 */
        var T = -1;
        if (el > BUILD) {
          var sp = clamp((el - BUILD) / SWEEP, 0, 1);
          T = easeInOut(sp) * (SPAN + 260) - 130;
          var poly = revealPoly(T);
          if (poly.length > 2) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.beginPath();
            ctx.moveTo(poly[0][0], poly[0][1]);
            for (var q = 1; q < poly.length; q++) ctx.lineTo(poly[q][0], poly[q][1]);
            ctx.closePath();
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
        /* 雪花(线上的更亮更大 → 把硬边盖住)*/
        var fade = el > BUILD + SWEEP ? clamp(1 - (el - BUILD - SWEEP) / TAIL, 0, 1) : 1;
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          var p = place(f, t);
          if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
          var band = T >= 0 ? Math.abs(p.s - T) : 9999;
          var near = clamp(1 - band / 150, 0, 1);            /* 越靠近雪线越密越亮 */
          var r = f.size * (1 + near * 1.6);
          var alpha = f.a * fade * (0.55 + 0.45 * near) * (1 - near * 0.15);
          flake(p.x, p.y, r, f.rot0 + t * 1.2 * (f.spd - 1) + near, alpha, near > 0.4 ? "#ffffff" : "#dff3ff");
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* 用 (W-x)+y <= T 切出"已刷新"的多边形(Sutherland-Hodgman 单边裁剪)*/
  function revealPoly(T) {
    var pts = [[0, 0], [W0, 0], [W0, H0], [0, H0]];
    var out = [];
    var f = function (p) { return (W0 - p[0]) + p[1] - T; };
    for (var i = 0; i < 4; i++) {
      var a = pts[i], b = pts[(i + 1) % 4];
      var fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if ((fa <= 0) !== (fb <= 0)) {
        var k = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      }
    }
    return out;
  }

  /* ================= 出口 ================= */
  var SCENES = {
    emoji: sceneEmoji,
    hex: sceneHex,
    water: sceneWater,
    glitch: sceneGlitch,
    fractal: sceneFractal
  };
  var BY_KEY = { self: "emoji", growth: "hex", lost: "water", tech: "glitch", future: "fractal" };

  window.CDBoot = {
    styles: Object.keys(SCENES),
    styleFor: function (key) { return BY_KEY[key] || "hex"; },
    preload: function () { loadEmojis(); loadWhale(); loadTechCover(); },
    loadedEmojis: function () { return _emoji.length; },
    ready: function () { return { emoji: _emoji.length, whale: !!_whale, cover: !!( _techImg && _techImg.complete) }; },
    create: function (style, ctx, W, H, accent, cfg) {
      var fn = SCENES[style] || SCENES.hex;
      try {
        return fn(ctx, W, H, accent, cfg);
      } catch (e) {
        return SCENES.hex(ctx, W, H, accent, cfg);      /* 任何一套出问题都不至于白屏 */
      }
    }
  };
})();
