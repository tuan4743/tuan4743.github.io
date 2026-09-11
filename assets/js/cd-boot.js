/* 主界面"开机动画"——每张盘一套
   ------------------------------------------------------------------
   约定:每个 scene 返回 { total, draw(el) },runner(intro.js)只负责
   清屏、计时、收尾。scene 自己负责"怎么盖住页面"和"怎么把页面揭开"。

   5 套:
     emoji   自我 —— 大号小黄脸铺满屏幕(格内随机、互不重叠)→ 整块掉落
     hex     成长 —— 一整块六边形面板 → 描边随机画出 → 从中心塌缩
     water   迷茫 —— 水从底部漫上来 → 鱼群游过(含 logo 彩蛋)→ 水退回
     glitch  技术 —— RGB 分离 + 切片错位的故障画面 → 横向切片飞走
     fractal 未来 —— 雪花分形展开(父级长满后六角分裂成子级)→ 露出页面
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

  /* ================= 素材:小黄脸 emoji =================
     用户的 svg 有三点要处理,否则 canvas 里画出来是错的:
       1) 没有 width/height → <img> 里会给 300x150 的视口,画出来会被压扁
       2) 自带 <style> 描边动画(dashoffset/fill-opacity)→ 抓到的可能是"画了一半"的样子
       3) 右下角有 emojiall.com 的水印 <a><text>
     所以取回文本 → 去掉 style 和水印 → 补上 36x36 → 转成 blob 再给 Image 用 */
  var EMOJI_CODES = [0x1f603, 0x1f602, 0x1f60e, 0x1f618, 0x1f61d, 0x1f621, 0x1f62d, 0x1f630, 0x1f914, 0x1f9d0];
  var _emoji = [];
  var _emojiByCode = {};
  var _emojiLoading = false;

  function loadEmojis() {
    if (_emojiLoading) return;
    _emojiLoading = true;
    EMOJI_CODES.forEach(function (cp) {
      var url = "/assets/emoji/" + encodeURIComponent(String.fromCodePoint(cp)) + ".svg";
      fetch(url).then(function (r) { return r.ok ? r.text() : ""; }).then(function (svg) {
        if (!svg) return;
        svg = svg.replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<a[\s\S]*?<\/a>/gi, "")
          .replace(/<svg /, '<svg width="36" height="36" stroke="none" ');
        var im = new Image();
        im.onload = function () { _emojiByCode[cp] = im; if (_emoji.indexOf(im) < 0) _emoji.push(im); };
        im.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      }).catch(function () { });
    });
  }

  /* 兜底:素材没加载好时自己画一张小黄脸 */
  function drawFallbackFace(ctx, s) {
    ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcc4d"; ctx.fill();
    ctx.fillStyle = "#664500";
    ctx.beginPath(); ctx.arc(-s * 0.17, -s * 0.14, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.17, -s * 0.14, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 0.02, s * 0.28, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.lineWidth = s * 0.06; ctx.strokeStyle = "#664500"; ctx.stroke();
  }

  /* ================= 1. emoji:铺满 → 掉落(自我) ================= */
  function sceneEmoji(ctx, W, H) {
    loadEmojis();
    var cols = 8, rows = 4;
    var cw = W / cols, ch = H / rows;
    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        /* 关键:抖动范围取"格内剩余空间的一半",所以怎么随机都不会越界、不会重叠 */
        var size = Math.min(cw, ch) * rand(0.86, 0.98);
        var sx = Math.max(0, (cw - size) / 2), sy = Math.max(0, (ch - size) / 2);
        cells.push({
          gx: c * cw, gy: r * ch,
          x: c * cw + cw / 2 + rand(-sx, sx),
          y: r * ch + ch / 2 + rand(-sy, sy),
          size: size,
          rot: rand(-0.5, 0.5) + (Math.random() > 0.5 ? Math.PI : 0),
          spin: rand(-3, 3),
          cp: pick(EMOJI_CODES),
          popAt: rand(0, 430),
          fallAt: rand(0, 300)
        });
      }
    }
    var T = { fill: 700, hold: 240, fall: 800 };

    function faceImg(code) { return _emojiByCode[code] || null; }

    return {
      total: T.fill + T.hold + T.fall + 80,
      draw: function (el) {
        for (var i = 0; i < cells.length; i++) {
          var e = cells[i];
          var pop = clamp((el - e.popAt) / 250, 0, 1);
          if (pop <= 0) continue;
          var ft = el - T.fill - T.hold - e.fallAt;
          var fy = 0, rot = e.rot, sc = easeOutBack(pop);
          if (ft > 0) {
            var t = ft / 1000;
            fy = 0.5 * 5200 * t * t;                     /* 自由落体,够快 */
            rot += e.spin * t;
            if (fy > H * 1.8) continue;                  /* 掉出屏幕就不画了 */
          }
          ctx.save();
          ctx.globalAlpha = ft > 0 ? 1 - clamp((ft - T.fall * 0.75) / (T.fall * 0.25), 0, 1) * 0.5 : 1;
          /* 底板按格子画(不抖动)→ 整屏严丝合缝,页面的任何一角都不会漏出来 */
          ctx.fillStyle = "#0b111a";
          ctx.fillRect(e.gx, e.gy, cw + 1, ch + 1);
          ctx.translate(e.x, e.y + fy);
          ctx.rotate(rot);
          ctx.scale(sc, sc);
          var im = faceImg(e.cp);
          if (im && im.complete && im.naturalWidth) {
            ctx.drawImage(im, -e.size / 2, -e.size / 2, e.size, e.size);
          } else {
            drawFallbackFace(ctx, e.size);
          }
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
      var x = Math.cos(a) * R, y = Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function sceneHex(ctx, W, H, accent, cfg) {
    var HX = cfg || {};
    var cols = HX.cols || 15, rows = HX.rows || 10;
    var R = Math.max(W / (cols * 1.732), H / (rows * 1.49));
    var hw = 1.732 * R, stepY = 1.49 * R, per = 6 * R;
    var gridW = (cols + 2) * hw, gridH = (rows + 2) * stepY;
    var ox = (W - gridW) / 2, oy = (H - gridH) / 2;
    var hexes = [];
    var maxD = Math.hypot(gridW / 2, gridH / 2);
    for (var r = -1; r <= rows; r++) {
      for (var c = -1; c <= cols + 1; c++) {
        var x = ox + c * hw + (Math.abs(r % 2) ? hw / 2 : 0);
        var y = oy + r * stepY;
        hexes.push({ x: x, y: y, drawAt: Math.random(), dir: Math.random() > 0.5 ? 1 : -1, dist: Math.hypot(x - W / 2, y - H / 2) / maxD });
      }
    }
    var drawWindow = hexes.length * (HX.drawEach || 2.2);
    var tDraw0 = 0;
    var tCol0 = tDraw0 + (HX.draw || 430) + drawWindow;
    var maxColDelay = hexes.length * (HX.collapseEach || 2.0) * 0.5;
    return {
      total: tCol0 + (HX.collapse || 640) + maxColDelay,
      draw: function (el) {
        for (var i = 0; i < hexes.length; i++) {
          var h = hexes[i];
          var dp = clamp((el - tDraw0 - h.drawAt * drawWindow) / (HX.draw || 430), 0, 1);
          var cp = clamp((el - tCol0 - h.dist * maxColDelay) / (HX.collapse || 640), 0, 1);
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
            ctx.lineWidth = Math.max(1, R * 0.035);
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
        boss: i === 0
      });
    }
    fish[0].r *= 2.1;

    function level(el) {                                   /* 水位 0~1.12 */
      if (el < RISE) return easeOutQuad(el / RISE) * 1.12;
      if (el < RISE + HOLD) return 1.12;
      return 1.12 * (1 - easeInOut(clamp((el - RISE - HOLD) / EBB, 0, 1)));
    }
    function surface(base, x, el) {
      return base
        + Math.sin(x / W * Math.PI * 6 + el / 620) * (7 + 9 * Math.min(1, base / H))
        + Math.sin(x / W * Math.PI * 15 - el / 380) * 4
        + Math.sin(x / W * Math.PI * 2.5 + el / 900) * 6;
    }
    function fishPath(x, y, r, wig, dir) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, 1);
      ctx.beginPath();                                     /* 身体(两段二次曲线拼的梭形)*/
      ctx.moveTo(-r * 1.5, 0);
      ctx.quadraticCurveTo(-r * 0.15, -r * 0.9, r * 1.15, 0);
      ctx.quadraticCurveTo(-r * 0.15, r * 0.9, -r * 1.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();                                     /* 尾鳍 */
      ctx.moveTo(-r * 1.42, 0);
      ctx.lineTo(-r * 2.35, -r * (0.62 + wig));
      ctx.lineTo(-r * 1.95, 0);
      ctx.lineTo(-r * 2.35, r * (0.62 - wig));
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();                                     /* 背鳍 */
      ctx.moveTo(-r * 0.35, -r * 0.62);
      ctx.lineTo(r * 0.15, -r * 1.15);
      ctx.lineTo(r * 0.45, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    return {
      total: RISE + HOLD + EBB + 60,
      draw: function (el) {
        var lv = level(el);
        var base = H * (1 - lv);
        /* 水体(不透明,保证盖得住页面)*/
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
        /* 水面高光 */
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        for (var x2 = -20; x2 <= W + 20; x2 += 24) {
          if (x2 === -20) ctx.moveTo(x2, surface(base, x2, el)); else ctx.lineTo(x2, surface(base, x2, el));
        }
        ctx.strokeStyle = "rgba(190,240,255,0.55)";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        /* 鱼只画在水里 */
        var t = el / 1000;
        for (var i = 0; i < fish.length; i++) {
          var f = fish[i];
          var fx = ((f.x + f.sp * t) % 1.6 + 1.6) % 1.6 - 0.3;
          var px = fx * W, py = f.y * H;
          if (py < surface(base, px, el) + f.r * 0.4) continue;     /* 露在水面上的不画 */
          var wig = Math.sin(t * 7 + f.ph) * 0.55;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = f.boss ? "hsl(" + Math.round(f.hue * 360) + " 55% 78%)"
            : "hsl(" + Math.round(f.hue * 360) + " " + Math.round(45 + f.r * 2) + "% " + Math.round(58 + Math.sin(f.ph) * 12) + "%)";
          fishPath(px, py, f.r, wig, f.sp > 0 ? 1 : -1);
          if (f.boss) {                                             /* 彩蛋:大鱼身上写着站名 */
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#04222f";
            ctx.font = "700 " + Math.round(f.r * 0.42) + "px ui-monospace, Consolas, monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.save();
            ctx.translate(px, py);
            ctx.scale(f.sp > 0 ? 1 : -1, 1);
            ctx.fillText("TUAGFEY", -f.r * 0.15, 0);
            ctx.restore();
          }
        }
        ctx.globalAlpha = 1;
        /* 气泡 */
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

  /* ================= 4. 故障(faulttext 风格,技术) ================= */
  function sceneGlitch(ctx, W, H, accent) {
    var G = 1500, REV = 950;
    var word = "TUAGFEY";
    var big = Math.round(Math.min(W, H) * 0.26);
    var bands = 22;

    function glitchFrame(el) {
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
      /* RGB 分离大字 */
      ctx.font = "900 " + big + "px Impact, 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalCompositeOperation = "screen";
      var jx = (Math.random() - 0.5) * big * 0.2, jy = (Math.random() - 0.5) * big * 0.12;
      ctx.fillStyle = "#ff0033"; ctx.fillText(word, W / 2 + jx + big * 0.04, H / 2 + jy);
      ctx.fillStyle = "#0066ff"; ctx.fillText(word, W / 2 + jx - big * 0.04, H / 2 + jy);
      ctx.fillStyle = "#eaf8ff"; ctx.fillText(word, W / 2 + jx, H / 2 + jy);
      /* 随机切片剪裁(照参考实现的 clipPath)*/
      for (var k = 0; k < 3; k++) {
        var cx = Math.random() * W * 0.8, cy = Math.random() * H * 0.8;
        var cw2 = rand(0.12, 0.4) * W, ch2 = rand(0.06, 0.3) * H;
        ctx.save();
        ctx.beginPath(); ctx.rect(cx, cy, cw2, ch2); ctx.clip();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = Math.random() > 0.5 ? "#ff0033" : "#0066ff";
        ctx.fillText(word, W / 2 + rand(-0.12, 0.12) * W, H / 2 + rand(-0.08, 0.08) * H);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      /* 扫描线 */
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (var sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    }

    return {
      total: G + REV,
      draw: function (el) {
        if (el < G) { glitchFrame(el); return; }
        /* 揭示:整个画面切成横条,逐条向两侧飞走 */
        var p = clamp((el - G) / REV, 0, 1);
        var bh = H / bands;
        for (var i = 0; i < bands; i++) {
          var d = clamp((p - (i / bands) * 0.55) / 0.45, 0, 1);
          if (d >= 1) continue;                              /* 这条已经飞走 → 露出页面 */
          var dir = i % 2 ? 1 : -1;
          var off = dir * easeOutQuart(d) * (W * 1.25 + 200);
          ctx.save();
          ctx.beginPath(); ctx.rect(0, i * bh, W, bh + 0.6); ctx.clip();
          ctx.translate(off, 0);
          ctx.globalAlpha = 1 - d * 0.25;
          glitchFrame(el);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ================= 5. 雪花分形展开(未来) ================= */
  function sceneFractal(ctx, W, H, accent) {
    var GROW = 440, MAXD = 2;
    var flakes = [];
    (function build(x, y, r, depth, at) {
      if (depth > MAXD || r < 16) return;
      flakes.push({ x: x, y: y, r: r, depth: depth, at: at });
      var end = at + GROW * 0.72 + depth * 50;
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 - Math.PI / 2;
        build(x + Math.cos(a) * r * 2.05, y + Math.sin(a) * r * 2.05, r * 0.5, depth + 1, end + i * 45);
      }
      build(x, y, r * 0.5, depth + 1, end + 260);
    })(W / 2, H / 2, Math.min(W, H) * 0.46, 0, 0);

    var last = 0;
    flakes.forEach(function (f) { last = Math.max(last, f.at + GROW); });

    function snowSilhouette(x, y, r) {                       /* 雪花剪影(用来"挖"出页面)*/
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 - Math.PI / 2;
        var na = a + Math.PI / 6;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);                 /* 主臂尖 */
        ctx.lineTo(x + Math.cos(na) * r * 0.34, y + Math.sin(na) * r * 0.34); /* 主臂之间的凹口 */
      }
      ctx.closePath();
    }

    function snowArms(x, y, r, alpha) {                      /* 冰晶枝(画在挖开的洞上面)*/
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#dff6ff";
      ctx.lineWidth = Math.max(0.7, r * 0.035);
      ctx.lineCap = "round";
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 - Math.PI / 2;
        var ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        /* 每条主枝上两对小枝 */
        for (var b = 1; b <= 2; b++) {
          var t = 0.34 + b * 0.28;
          var bx = x + Math.cos(a) * r * t, by = y + Math.sin(a) * r * t;
          var bl = r * (0.30 - b * 0.06);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a - 0.9) * bl, by + Math.sin(a - 0.9) * bl);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + 0.9) * bl, by + Math.sin(a + 0.9) * bl);
        }
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = "#dff6ff";
      ctx.fill();
      ctx.restore();
    }

    return {
      total: last + 420,
      draw: function (el) {
        /* 底:一块深色板,负责盖住页面 */
        ctx.fillStyle = "#070c14";
        ctx.fillRect(0, 0, W, H);
        /* 雪花越长越大,一路把板子"挖"穿 → 页面从雪花里透出来 */
        ctx.globalCompositeOperation = "destination-out";
        for (var i = 0; i < flakes.length; i++) {
          var f = flakes[i];
          var p = clamp((el - f.at) / GROW, 0, 1);
          if (p <= 0) continue;
          var rr = f.r * easeOutQuad(p);
          snowSilhouette(f.x, f.y, rr);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        /* 冰晶枝 */
        for (var j = 0; j < flakes.length; j++) {
          var g = flakes[j];
          var q = clamp((el - g.at) / GROW, 0, 1);
          if (q <= 0.55) continue;
          var fade = clamp((last + 420 - el) / 300, 0, 1);
          snowArms(g.x, g.y, g.r * easeOutQuad(q), (q - 0.55) / 0.45 * 0.9 * fade);
        }
        /* 收尾:把残余的底板整体淡掉 */
        if (el > last - 120) {
          var outA = clamp((el - (last - 120)) / 380, 0, 1);
          ctx.globalCompositeOperation = "destination-out";
          ctx.globalAlpha = outA;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
      }
    };
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
    preload: loadEmojis,
    loadedEmojis: function () { return _emoji.length; },     /* 供验证/调试 */
    create: function (style, ctx, W, H, accent, cfg) {
      var fn = SCENES[style] || SCENES.hex;
      try {
        return fn(ctx, W, H, accent, cfg);
      } catch (e) {
        return SCENES.hex(ctx, W, H, accent, cfg);          /* 任何一套出问题都不至于白屏 */
      }
    }
  };
})();
