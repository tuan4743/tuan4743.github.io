(function () {
  "use strict";

  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var easeOutQuart = function (t) { return 1 - Math.pow(1 - t, 4); };
  var easeOutQuad = function (t) { return 1 - (1 - t) * (1 - t); };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeOutBack = function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };

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
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "#9fe8ff";
        g.fillRect(0, 0, 254, 200);
        _whale = c;
      } catch (e) { _whale = null; }
    };
    im.onerror = function () { _whale = null; };
    im.src = "/assets/eggs/deepseek.svg";
  }

  var _techImg = null;
  function loadTechCover() {
    if (_techImg) return;
    var im = new Image();
    im.onload = function () { _techImg = im; };
    im.src = "/assets/cd/cds/tech.webp";
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

    var tLastFall = T.fill + T.hold + 520;
    var FACE = { at: tLastFall, dur: 420 };

    return {
      total: Math.max(T.fill + T.hold + T.fall + 60, FACE.at + FACE.dur + 80),
      blackUntil: T.fill + T.hold,
      draw: function (el) {
        for (var i = 0; i < pieces.length; i++) {
          var e = pieces[i];
          var pop = clamp((el - e.popAt) / 240, 0, 1);
          if (pop <= 0) continue;
          var ft = el - T.fill - T.hold - e.fallAt;
          var dy = 0, rot = e.rot, sc = easeOutBack(pop);
          if (ft > 0) {
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

        var fa = clamp((el - FACE.at) / FACE.dur, 0, 1);
        if (fa <= 0) return;
        var side = Math.min(W, H) * 0.30;
        var w = side * 0.80, h = side;
        var r = side * 0.22;
        var x = (W - w) / 2, y = (H - h) / 2;
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = "#2f3a4d";
        ctx.fill();
        ctx.strokeStyle = "rgba(206, 228, 255, " + (0.30 * fa).toFixed(3) + ")";
        ctx.lineWidth = Math.max(1.5, side * 0.016);
        ctx.stroke();
        ctx.restore();
      }
    };
  }

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
    var T = (window.CDBootFx && window.CDBootFx.hexTiming) || { outAt: 990, total: 2890 };
    return {
      total: T.total,
      blackUntil: T.outAt,
      draw: function () {}
    };
  }

  var _gdArt = null, _gdArtLoading = false;
  /* GD 美术:gd-art.png 是从【游戏本体】抽出来的小图集(见 gd-web),
     spike01/block1 各占 30×30,1 px = 1 世界单位 ⇒ 过场里一格 = 一格,和游戏同尺度 */
  function loadGdArt() {
    if (_gdArtLoading) return;
    _gdArtLoading = true;
    var im = new Image();
    im.onload = function () { _gdArt = im; };
    im.onerror = function () { _gdArt = null; };
    im.src = "/assets/gd-art.png";
  }
  var _gdCube = null, _gdCubeLoading = false;
  /* 玩家 cube:官方图标贴图 player_348(主体+第二色两帧都在 cube.png 里,plist: 主体@{131,1} 120×120,
     第二色@{1,133} 110×110)。游戏里染 P1 绿(125,255,0)/P2 青(0,255,255) —— 见 main.ts PLAYER_C1/C2。 */
  function loadGdCube() {
    if (_gdCubeLoading) return;
    _gdCubeLoading = true;
    var im = new Image();
    im.onload = function () {
      try {
        var c = document.createElement("canvas");
        c.width = 120; c.height = 120;
        var g = c.getContext("2d");
        g.drawImage(im, 131, 1, 120, 120, 0, 0, 120, 120);
        /* 染玩家色 1(亮绿):source-atop 只染非透明像素,黑描边也会被染 ——
           所以先拷主体,再用第二色层(_2_)当"内芯"原样叠回,内芯保持贴图原色 */
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgb(125, 255, 0)";
        g.fillRect(0, 0, 120, 120);
        g.globalCompositeOperation = "source-over";
        g.drawImage(im, 1, 133, 110, 110, 5, 5, 110, 110);
        _gdCube = c;
      } catch (e) { _gdCube = null; }
    };
    im.onerror = function () { _gdCube = null; };
    im.src = "/icons/cube.png";
  }

  /* 失落:GD WATER 关卡的前置演示——摄影机固定,cube 从左边缘一路跑到右边缘,
     物理 = 游戏真值(见 gd-web/src/sim/constants.ts):
       速度 0.9 档 vx = 5.77000189×0.9 = 5.193 单位/帧 = 10.386 块/秒;
       方块重力 0.958199024 单位/帧²,起跳初速 11.1800318 单位/帧(Y_TIME_SCALE 0.9 只影响时间轴);
       一跳滞空 = 2v/(g·0.9·60) ≈ 0.4327s,跨距 ≈ 4.494 块,峰值 = v²/(2g) ≈ 65.2 单位 ≈ 2.17 块。
     美术 = 游戏真图(尖刺/方块从 gd-art.png 取,cube 用官方图标),配色取关卡 kS38:
       BG rgb(40,125,255)、Ground rgb(0,102,255)、Line 白、玩家色 P1 绿/P2 青。 */
  function sceneWater(ctx, W, H) {
    loadGdArt(); loadGdCube();
    var T = { typeAt: 480, bpm: 170, end: 3050, total: 3480 };
    var STEP = 60000 / T.bpm / 2;               /* 八分音符一跳 */
    /* ---- 物理常数(逐字对齐 sim/constants.ts,单位/帧@60fps)---- */
    var PHYS_VX = 5.77000189 * 0.9;             /* 单位/帧,0.9 档 */
    var PHYS_G = 0.958199024;                   /* 单位/帧²,方块 */
    var PHYS_V0 = 11.1800318;                   /* 单位/帧,起跳 */
    var Y_SCALE = 0.9;                          /* Y_TIME_SCALE */
    /* ---- 关卡 kS38 真色(不压暗:过场看着和真游戏一致)---- */
    var COL_BG = "rgb(40, 125, 255)";
    var COL_BG_TOP = "rgb(26, 88, 190)";
    var COL_GND = "rgb(0, 102, 255)";
    var COL_GND_DK = "rgb(0, 68, 178)";
    var COL_LINE = "rgba(255, 255, 255, 0.95)";
    var COL_PLAYER1 = "#7dff00";                /* kS38 1005:P1 亮绿 */
    var COL_PLAYER2 = "#00ffff";                /* kS38 1006:P2 青(方块内芯) */
    function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    var snapCv = null;

    /* 与加载器/CD4 同款的结尾关屏 */
    function collapse(el) {
      if (!snapCv) snapCv = document.createElement("canvas");
      if (snapCv.width !== W || snapCv.height !== H) { snapCv.width = W; snapCv.height = H; }
      var sg = snapCv.getContext("2d");
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.clearRect(0, 0, W, H);
      sg.drawImage(ctx.canvas, 0, 0, W, H);
      var kk = Math.min(1, (el - T.end) / (T.total - T.end));
      var ke = kk * kk;
      var sq = Math.max(0.004, 1 - ke);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#04060a";
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(0, (H / 2) * (1 - sq));
      ctx.scale(1, sq);
      ctx.drawImage(snapCv, 0, 0, W, H);
      ctx.restore();
      if (ke > 0.55) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(190,245,255," + (0.75 * Math.min(1, (ke - 0.55) / 0.2)).toFixed(3) + ")";
        ctx.fillRect(0, H / 2 - 1.5 * (1 - ke), W, 3 * (1 - ke) + 1);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    /* 铺面(确定性):按真实节奏排 —— 刺链间隔 = 一跳跨距(4.494 块),
       cube 落地即刻再起跳,整个过场就是一条节奏匀整的刺链(和游戏里
       "连跳段"同一观感)。尺度对齐游戏:屏高 = 10.67 块(原版口径),
       一块 = H/10.67 ⇒ cube 一跳在屏上占 40% 高度的抛物线,看得清。 */
    var JUMP_SPAN = 4.494;                      /* 块,见文件头换算 */
    var RUN_START = 900;                        /* 起跑拍:标题亮完后,cube 从左缘起跑 */
    var SPIKE_START = 6.0;                      /* 第一根刺离起跑点的块数(留足助跑) */
    var spikes = [];
    for (var si = 0; si < 5; si++) {
      spikes.push({ x: SPIKE_START + si * JUMP_SPAN });   /* 块,起跑点起算 */
    }
    var LINES = [
      "> NOW LOADING — WATER",
      "> BPM 170.00 · FIRST BEAT 0.33s",
      "> DON'T STOP MOVING"
    ];

    return {
      total: T.total,
      blackUntil: 0,
      draw: function (el) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;

        /* GD 背景:整屏蓝色(关卡 BG 色真值),带缓慢明暗呼吸 */
        var pulse = 0.94 + 0.06 * Math.sin(el / 900);
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, COL_BG_TOP);
        bg.addColorStop(1, COL_BG);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        /* GD 背景装饰:大块方形暗纹缓慢横移(GD 经典 bg 方块图案) */
        ctx.save();
        ctx.globalAlpha = 0.08 * pulse;
        ctx.fillStyle = "#000";
        var bs = Math.min(W, H) * 0.30;
        var bOff = (el * 0.012) % (bs * 2) - bs * 2;
        for (var bxg = bOff; bxg < W; bxg += bs * 2) {
          ctx.fillRect(bxg, H * 0.06, bs, bs * 0.62);
          ctx.fillRect(bxg + bs, H * 0.30, bs, bs * 0.62);
        }
        ctx.restore();

        /* 开屏横线展开(与加载器的关屏压缩互为镜像)—— 由 intro 的 WIPE 统一做,
           这里不重复画;T.wipe 只用来安排淡入 */
        var T_WIPE = 320;
        if (el < 40) return;

        var fs = Math.max(11, Math.round(Math.min(W, H) * 0.019));
        var groundY = H * 0.76;
        /* 尺度 = 原版口径:设计高 320 单位、1 块 30 单位 ⇒ 屏高 10.67 块。
           cube 一跳峰值 2.17 块 = 屏高的 20%,滞空 0.433s —— 在真速度下看得清。 */
        var unit = H / (320 / 30);              /* 一块的像素数 */
        var fadeK = Math.min(1, (el - T_WIPE) / 420);   /* 场景淡入 */

        /* 地面:GD 双色地块 + 顶部白线 + 地块竖缝 */
        ctx.save();
        var gg = ctx.createLinearGradient(0, groundY, 0, H);
        gg.addColorStop(0, COL_GND);
        gg.addColorStop(1, COL_GND_DK);
        ctx.fillStyle = gg;
        ctx.fillRect(0, groundY, W, H - groundY);
        /* 地面竖缝(GD ground 分块) */
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        for (var gx2 = 0; gx2 < W; gx2 += unit * 4) {
          ctx.beginPath();
          ctx.moveTo(gx2, groundY);
          ctx.lineTo(gx2, H);
          ctx.stroke();
        }
        /* 顶部白线(GD line) */
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = COL_LINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();
        ctx.restore();

        /* 尖刺:官方贴图(gd-art.png spike01,30×30 = 1 格),贴地朝上 */
        var artOk = !!(_gdArt && _gdArt.complete && _gdArt.naturalWidth);
        /* 铺面坐标 → 屏幕 x:块 0 = cube 起跑点(左缘外一格) */
        var X0 = -unit;
        for (var p = 0; p < spikes.length; p++) {
          var sxp = X0 + spikes[p].x * unit;
          if (sxp < -unit || sxp > W + unit) continue;
          ctx.save();
          ctx.globalAlpha = 0.98 * fadeK;
          if (artOk) {
            ctx.drawImage(_gdArt, 618, 1, 30, 30, sxp - unit / 2, groundY - unit, unit, unit);
          } else {
            ctx.fillStyle = "rgba(6, 16, 30, 0.96)";
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sxp - unit * 0.46, groundY);
            ctx.lineTo(sxp, groundY - unit);
            ctx.lineTo(sxp + unit * 0.46, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }

        /* cube:真速度横穿(10.386 块/秒,块 = H/10.67)。整条动画就是游戏的
           "连跳段"演示:起跑 → 按节拍连过 5 根刺(每跳都按真物理积分)
           → 冲出右缘,白线一道横扫收屏。 */
        var RUN_MS = 2700;                       /* 横穿用时 = 28 块 ÷ 10.386 块/秒 */
        var runT = el - RUN_START;               /* 起跑后毫秒 */
        var px = X0 + Math.max(0, runT / RUN_MS) * 28 * unit;
        var pxBlocks = (px - X0) / unit;         /* cube 起跑点起算的块数 */
        /* 连跳:每根刺一个起跳点(刺前 跨距/2 块),落点正好接下一跳的起跳点 */
        var jumpAge = -1;
        var AIRTIME_S = (2 * PHYS_V0 / (PHYS_G * Y_SCALE)) / 60;   /* 秒,≈0.433 */
        for (var q = 0; q < spikes.length; q++) {
          var jumpAtB = spikes[q].x - JUMP_SPAN / 2;    /* 起跳点(块) */
          if (pxBlocks >= jumpAtB && pxBlocks < jumpAtB + AIRTIME_S * 10.386) {
            jumpAge = (pxBlocks - jumpAtB) / 10.386 * 1000;   /* 起跳后毫秒 */
            break;
          }
        }
        var jump = 0, rot = 0;
        if (jumpAge >= 0) {
          var tj = jumpAge / 1000;                       /* 起跳后秒数 */
          var frames = tj * 60;
          var yu = PHYS_V0 * frames - 0.5 * PHYS_G * Y_SCALE * frames * frames;  /* 单位 */
          jump = (yu / 30) * unit;                       /* 30 单位 = 1 块 */
          /* GD 方块空中转半圈:滞空 0.433s 内转 180° */
          rot = Math.min(1, tj / AIRTIME_S) * Math.PI;
        }
        var byy = groundY - unit / 2 - Math.max(0, jump);
        ctx.save();
        ctx.translate(px, byy);
        ctx.rotate(rot);
        /* 官方 cube 贴图(玩家色已烘好);退化时画 GD 默认方块(绿体+青内芯+白框) */
        var cubeOk = !!(_gdCube && _gdCube.complete && _gdCube.naturalWidth);
        if (cubeOk) {
          ctx.drawImage(_gdCube, -unit / 2, -unit / 2, unit, unit);
        } else {
          ctx.fillStyle = COL_PLAYER1;
          ctx.fillRect(-unit / 2, -unit / 2, unit, unit);
          ctx.lineWidth = Math.max(2, unit * 0.09);
          ctx.strokeStyle = "#ffffff";
          ctx.strokeRect(-unit / 2, -unit / 2, unit, unit);
          ctx.fillStyle = COL_PLAYER2;
          ctx.fillRect(-unit * 0.26, -unit * 0.26, unit * 0.52, unit * 0.52);
          ctx.fillStyle = "#062033";
          ctx.fillRect(-unit * 0.20, -unit * 0.16, unit * 0.13, unit * 0.2);
          ctx.fillRect(unit * 0.07, -unit * 0.16, unit * 0.13, unit * 0.2);
        }
        ctx.restore();

        /* 角落登录行 */
        ctx.font = fs + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (var b = 0; b < LINES.length; b++) {
          var bt = el - T.typeAt - b * 380;
          if (bt <= 0) continue;
          var shown2 = LINES[b].slice(0, Math.max(1, Math.round(LINES[b].length * Math.min(1, bt / 320))));
          ctx.save();
          ctx.globalAlpha = 0.62 * Math.min(1, bt / 320) * fadeK;
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(255,255,255,0.6)";
          ctx.shadowBlur = b === LINES.length - 1 ? 8 : 0;
          ctx.fillText(shown2, W * 0.062, H * 0.07 + b * Math.round(fs * 1.6));
          ctx.restore();
        }

        /* 结尾:cube 到达右边缘后,白线一道横扫(像 GD 通关白色闪),再关屏 */
        var outT = (el - (T.end - 460)) / 460;
        if (outT > 0) {
          var ok2 = Math.min(1, outT);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - ok2) * 0.9;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, H / 2 - 2, W * ok2, 4);
          ctx.restore();
        }

        if (el > T.end) collapse(el);
      }
    };
  }

  var _cloudBuf = null;
  function buildCloudStrip(w, h) {
    var stripW = w * 2;
    var cv = document.createElement("canvas");
    cv.width = stripW; cv.height = Math.max(8, h);
    var g = cv.getContext("2d");
    var low = Math.round(h * 0.56);
    var bandH = Math.max(6, h - low);
    var img = g.createImageData(stripW, bandH);
    var d = img.data;
    function hash(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }
    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), e = hash(xi + 1, yi + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + e * u * v;
    }
    for (var y = 0; y < bandH; y++) {
      var depth = y / bandH;
      for (var x = 0; x < stripW; x++) {
        var n = noise(x * 0.045, y * 0.16) * 0.65 + noise(x * 0.11, y * 0.34) * 0.35;
        var th = 0.62 - depth * 0.20;
        var v = Math.max(0, (n - th) / (1 - th));
        var shade = Math.min(1, v * (0.55 + depth * 0.75));
        var i = (y * stripW + x) * 4;
        var r = Math.round(38 + 168 * shade);
        var gg = Math.round(62 + 178 * shade);
        var b = Math.round(104 + 150 * shade);
        d[i] = Math.max(r, 10); d[i + 1] = Math.max(gg, 16); d[i + 2] = Math.max(b, 34);
        d[i + 3] = Math.round(255 * Math.min(1, shade * 1.5));
      }
    }
    g.putImageData(img, 0, 0);
    _cloudBuf = { buf: cv, ctx: cv.getContext("2d"), strip: cv, stripW: stripW, w: w, h: h };
  }

  function sceneGlitch(ctx, W, H, accent) {
    loadTechCover();
    var HALF = 1150, REV = 900;
    var _glitchEl = 0;
    var WARN_LINES = [
      "E: SECTOR 0x3F2A UNREADABLE",
      "E: TRACK 04 CHECKSUM MISMATCH",
      "W: RETRY 3/5 ... FAILED",
      "E: DISK ERROR 0x0C1D",
      "W: FALLBACK TO PARITY",
      "E: HEAD REALIGN REQUIRED"
    ];
    var bands = 22;

    function corrupt(drawWhat) {
      ctx.fillStyle = "#05070c";
      ctx.fillRect(0, 0, W, H);
      var step = 34;
      for (var y = 0; y < H; y += step) {
        if (Math.random() > 0.34) continue;
        var segW = W * rand(0.12, 0.42);
        var segX = Math.random() * (W - segW);
        ctx.save();
        ctx.globalAlpha = rand(0.03, 0.09);
        ctx.fillStyle = Math.random() > 0.5 ? accent : "#ff2d55";
        ctx.fillRect(segX + (Math.random() - 0.5) * 40, y + rand(4, step - 6), segW, 1);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      drawWhat();
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
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      for (var sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    }

    function coverPlusText() {
      cover();
      errorText();
    }

    function cover() {
      if (_techImg && _techImg.complete && _techImg.naturalWidth) {
        var dh = H * 0.5;
        var dw = dh * (_techImg.naturalWidth / _techImg.naturalHeight);
        var jx = (Math.random() - 0.5) * 10, jy = (Math.random() - 0.5) * 8;
        var dx = (W - dw) / 2, dy = (H - dh) / 2;
        ctx.drawImage(_techImg, dx + jx, dy + jy, dw, dh);
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
      var big = Math.round(Math.min(W * 0.06, H * 0.18));
      var jx = (Math.random() - 0.5) * big * 0.22, jy = (Math.random() - 0.5) * big * 0.14;
      var lw = Math.max(2, big * 0.07);
      ctx.font = "900 " + big + "px Impact, 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      var fs3 = Math.max(11, Math.round(Math.min(W, H) * 0.026));
      ctx.font = fs3 + "px \"Alpha Sector\", ui-monospace, Menlo, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (var wi = 0; wi < WARN_LINES.length; wi++) {
        var line = WARN_LINES[wi];
        var ly = H * (0.16 + wi * 0.13);
        var spd = 0.32 + (wi % 3) * 0.10;
        var total2 = W + ctx.measureText(line).width + 40;
        var lx = W + 20 - ((_glitchEl * spd + wi * 150) % total2);
        var a = 0.85;
        ctx.globalCompositeOperation = "screen";
        ctx.lineWidth = 2;
        ctx.globalAlpha = a * 0.55;
        ctx.strokeStyle = "#ff0033";
        ctx.strokeText(line, lx + 2.2, ly);
        ctx.strokeStyle = "#0066ff";
        ctx.strokeText(line, lx - 2.2, ly);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = a;
        ctx.fillStyle = "#ffe9ec";
        ctx.fillText(line, lx, ly);
      }
      ctx.globalAlpha = 1;
    }

    return {
      total: HALF * 2 + REV,
      draw: function (el) {
        _glitchEl = el;
        if (el < HALF * 0.35) { corrupt(cover); return; }
        if (el < HALF * 2) { corrupt(coverPlusText); return; }
        var p = clamp((el - HALF * 2) / REV, 0, 1);
        var bh = H / bands;
        for (var i = 0; i < bands; i++) {
          var d = clamp((p - (i / bands) * 0.55) / 0.45, 0, 1);
          if (d >= 1) continue;
          var dir = i % 2 ? 1 : -1;
          ctx.save();
          ctx.beginPath(); ctx.rect(0, i * bh, W, bh + 0.6); ctx.clip();
          ctx.save();
          ctx.globalAlpha = (1 - d) * 0.62;
          ctx.fillStyle = "#7b2ff7";
          ctx.fillRect(0, i * bh, W, bh + 0.6);
          ctx.globalAlpha = (1 - d) * 0.45;
          ctx.fillStyle = "#c46bff";
          ctx.fillRect(0, i * bh + bh * 0.3, W, bh * 0.4);
          ctx.restore();
          ctx.translate(dir * easeOutQuart(d) * (W * 1.25 + 200), 0);
          ctx.globalAlpha = 1 - d * 0.25;
          corrupt(errorText);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* 未来:过场 = 面板的【同一扇窗】——夜空、雪、霜都和 page-frost 面板同源同色,
     过场从"霜盖满"走到"霜被呵气化开一块、碎片透出来",结束在霜还盖着大半的瞬间;
     面板接手时盖着同色霜雾进场再散开(css .frost::after),所以过场→面板没有跳变。
     收尾 = 霜重新合拢(不是关屏压缩):黑场由外层的 is-black 负责。 */
  function sceneFrost(ctx, W, H) {
    /* 时间轴:夜空/雪先单独亮 1.4s ⇒ 霜用 2s 慢慢爬上来(带边缘感,不是一帧盖满)
       ⇒ 呵气化开(碎片透出 1s+)⇒ 合拢淡黑交面板 */
    var T = { veil: 2000, breath: 2200, melt: 2350, showAt: 2550, reFrost: 3050, end: 3400, total: 3750 };
    var SHARDS = [
      "愿未来的你,依然对世界好奇。",
      "愿你还会为一件与你无关的事停下来。"
    ];
    function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
    var snapCv = null;

    /* 夜空:和面板 buildSky 同一条配方 —— 顶部近黑 rgb(4,7,16),地平线亮到 rgb(16,40,60),
       雪坡剪影 rgb(26,36,58),前景地 rgb(4,6,12); HOR = 0.73H */
    function paintSky() {
      var HOR = H * 0.73;
      var BANDS = 90;
      for (var b = 0; b < BANDS; b++) {
        var t = b / (BANDS - 1);
        var lift = (0.12 + 0.88 * t * t) * (0.35 + 0.65 * (t * t * (3 - 2 * t)));
        var r = 4 + 9 * lift, g = 7 + 16 * lift, bl = 16 + 30 * lift;
        ctx.fillStyle = "rgb(" + (r | 0) + "," + (g | 0) + "," + (bl | 0) + ")";
        ctx.fillRect(0, Math.floor(b * HOR / BANDS), W, Math.ceil(HOR / BANDS) + 2);
      }
      /* 远山剪影(面板 buildSky 的 groundTop 同款三正弦,振幅压到过场尺度) */
      function groundTop(x, back) {
        var t = x / W;
        var h = Math.sin(t * 3.1 + 0.7 - 1.6) * 0.088
          + Math.sin(t * 7.3 + 2.1 - 1.6) * 0.034
          + Math.sin(t * 1.6 - 1.6) * 0.070;
        if (back) {
          h = h * 0.62 + Math.sin(t * 2.2 + 3.4) * 0.013 - 0.004;
          h *= 0.55 + 0.45 * Math.sin(Math.PI * t);
        }
        return HOR + h * H;
      }
      var step = Math.max(2, Math.round(W / 400));
      for (var x = 0; x < W + step; x += step) {
        var gyb = groundTop(x + step * 0.5, true);
        ctx.fillStyle = "rgb(26, 36, 58)";
        ctx.fillRect(x, gyb, step, Math.max(1, H - gyb));
      }
      for (var x2 = 0; x2 < W + step; x2 += step) {
        var gy = groundTop(x2 + step * 0.5, false);
        var g = ctx.createLinearGradient(0, gy, 0, H);
        g.addColorStop(0, "rgb(4, 6, 12)");
        g.addColorStop(1, "rgb(2, 3, 7)");
        ctx.fillStyle = g;
        ctx.fillRect(x2, gy, step, Math.max(1, H - gy));
      }
    }

    /* 霜:面板同色的结晶白(206,226,246),但【从不盖满】——
       上来就留出中央一块"呵气区"是透明→淡霜的渐变,屏幕四角才浓;
       clear = 呵气把中央这块也化掉的程度(0=没化,1=全化) */
    function frost(g, clear, el, veil) {
      g.save();
      /* 基底:边缘浓、中央透的径向霜 —— 中央留给夜空和碎片 */
      var base = g.createRadialGradient(W / 2, H * 0.44, Math.min(W, H) * 0.30, W / 2, H * 0.46, Math.max(W, H) * 0.62);
      base.addColorStop(0, "rgba(206, 226, 246, " + (0.34 * veil).toFixed(3) + ")");
      base.addColorStop(0.55, "rgba(200, 222, 244, " + (0.62 * veil).toFixed(3) + ")");
      base.addColorStop(1, "rgba(196, 220, 242, " + (0.88 * veil).toFixed(3) + ")");
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      /* 结晶短线:固定种子 ⇒ 不闪烁;中央少、边缘密(跟基底浓度一致) */
      g.strokeStyle = "rgba(255, 255, 255, 0.5)";
      g.lineWidth = 1;
      for (var i = 0; i < 210; i++) {
        var x = hash(i * 1.31) * W, y = hash(i * 2.17) * H;
        var dC = Math.min(1, Math.hypot(x - W / 2, y - H * 0.44) / (Math.min(W, H) * 0.42));
        var ang = (hash(i * 3.7) * 3 | 0) * (Math.PI / 3) + (hash(i * 5.9) - 0.5) * 0.5;
        var len = 3 + hash(i * 7.7) * 8;
        g.globalAlpha = veil * dC * (0.14 + hash(i * 9.1) * 0.2);
        g.beginPath();
        g.moveTo(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2);
        g.lineTo(x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2);
        g.stroke();
      }
      /* 晶格亮点(同样避开中央) */
      g.fillStyle = "rgba(248, 252, 255, 0.8)";
      for (var j = 0; j < 90; j++) {
        var qx = hash(j * 6.1) * W, qy = hash(j * 8.3) * H;
        var qd = Math.min(1, Math.hypot(qx - W / 2, qy - H * 0.44) / (Math.min(W, H) * 0.42));
        g.globalAlpha = veil * qd * (0.2 + hash(j * 4.3) * 0.4);
        g.fillRect(qx, qy, 1.6, 1.6);
      }
      g.restore();
      /* 化开的中央区:呵气把中央仅剩的淡霜也擦掉,夜空和碎片透出 */
      if (clear > 0.01) {
        var mr = Math.min(W, H) * 0.34;
        var mg = g.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, mr);
        mg.addColorStop(0, "rgba(0,0,0," + clear.toFixed(3) + ")");
        mg.addColorStop(0.62, "rgba(0,0,0," + (clear * 0.8).toFixed(3) + ")");
        mg.addColorStop(1, "rgba(0,0,0,0)");
        g.save();
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = mg;
        g.fillRect(W / 2 - mr, H * 0.44 - mr, mr * 2, mr * 2);
        /* 洞缘的水痕:几条往下淌的细水线(化玻璃的真实细节) */
        g.globalAlpha = clear * 0.5;
        g.strokeStyle = "rgba(210, 232, 250, 0.9)";
        g.lineWidth = 1.4;
        for (var d = 0; d < 6; d++) {
          var dx = W / 2 + (hash(d * 13.1) - 0.5) * mr * 1.2;
          var dy0 = H * 0.44 + (hash(d * 17.3) - 0.3) * mr * 0.6;
          var dl = mr * (0.3 + hash(d * 19.7) * 0.5) * clear;
          g.beginPath();
          g.moveTo(dx, dy0);
          g.lineTo(dx + (hash(d * 23.1) - 0.5) * 6, dy0 + dl);
          g.stroke();
        }
        g.restore();
      }
    }

    /* 呵气:一团白雾从屏幕下缘中部升起(比旧版更薄,不抢戏) */
    function puff(t0) {
      var t = el0 - t0;
      if (t < 0 || t > 1100) return;
      var k = t / 1100;
      var cy = H * 0.95 - k * H * 0.5;
      var r = Math.min(W, H) * (0.08 + k * 0.26);
      var g2 = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, r);
      g2.addColorStop(0, "rgba(215, 235, 250, " + (0.16 * (1 - k)).toFixed(3) + ")");
      g2.addColorStop(1, "rgba(215, 235, 250, 0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g2;
      ctx.fillRect(W / 2 - r, cy - r, r * 2, r * 2);
      ctx.restore();
    }

    var el0 = 0;
    return {
      total: T.total,
      blackUntil: 0,
      draw: function (el) {
        el0 = el;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;

        /* 0..veil:夜空先亮出来,雪一直在下 */
        paintSky();

        /* 极光:面板同款只给极淡一缕(过场不抢,面板里才是主角) */
        var aurA = 0.16 * Math.min(1, el / 1200);
        if (aurA > 0.01) {
          var ag = ctx.createLinearGradient(0, 0, W, H * 0.5);
          ag.addColorStop(0.2, "rgba(60, 220, 190, 0)");
          ag.addColorStop(0.5, "rgba(80, 230, 200, " + (aurA * 0.5).toFixed(3) + ")");
          ag.addColorStop(0.8, "rgba(120, 180, 255, 0)");
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = ag;
          ctx.fillRect(0, 0, W, H * 0.55);
          ctx.restore();
        }

        /* 飘雪:细小粒子,近大远小(和面板 SNOW 同口味) */
        ctx.save();
        for (var f = 0; f < 80; f++) {
          var sp2 = 24 + hash(f * 5.1) * 56;
          var sy = (hash(f * 3.3) * H + el * 0.001 * sp2) % (H + 20) - 10;
          var sx = (hash(f * 9.9) * W + el * 0.0006 * sp2 * -0.34) % (W + 20) - 10;
          var dep = 0.3 + hash(f * 7.1) * 0.7;
          ctx.globalAlpha = (0.16 + 0.4 * dep) * Math.min(1, el / 600);
          ctx.fillStyle = "#dcefff";
          ctx.beginPath();
          ctx.arc(sx, sy, 0.8 + dep * 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        /* 霜:0..veil 从边缘慢慢爬进来(中央始终留一口"待呵气的窗");
           melt 后中央化开,reFrost 起重新合拢 */
        var veil = Math.min(1, el / T.veil);
        var clear = 0;
        if (el > T.melt) clear = Math.min(1, (el - T.melt) / 550);
        if (el > T.reFrost) clear *= Math.max(0, 1 - (el - T.reFrost) / (T.end - T.reFrost));
        if (veil > 0.01) frost(ctx, clear, el, veil);

        /* 呵气雾(两次) */
        if (el > T.breath && el < T.melt + 1100) puff(T.breath);
        if (el > T.reFrost - 350) puff(T.reFrost - 350);

        /* 碎片:洞里透出的字 —— 取面板真实碎片的头两句,字体同面板(浅蓝,发光) */
        if (el > T.showAt && clear > 0.25 && clear < 0.98) {
          var vis = Math.min(1, (el - T.showAt) / 450) * Math.min(1, clear * 3) * (1 - Math.max(0, (el - T.reFrost) / (T.end - T.reFrost)));
          var fs = Math.max(13, Math.round(Math.min(W, H) * 0.023));
          ctx.font = '500 ' + fs + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (var s3 = 0; s3 < SHARDS.length; s3++) {
            ctx.save();
            ctx.globalAlpha = vis * (s3 === 0 ? 0.95 : 0.75);
            ctx.shadowColor = "rgba(176, 220, 255, 0.9)";
            ctx.shadowBlur = 12;
            ctx.fillStyle = "#eaf4ff";
            ctx.fillText(SHARDS[s3], W / 2, H * (0.40 + s3 * 0.085));
            ctx.restore();
          }
          /* 暗示行:面板的玩法提示,提前一拍出现 */
          ctx.save();
          ctx.globalAlpha = vis * 0.55;
          ctx.fillStyle = "#9fd4ee";
          ctx.font = Math.max(10, Math.round(fs * 0.72)) + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
          ctx.fillText("—— 暖一暖,底下写着几句话", W / 2, H * (0.40 + SHARDS.length * 0.085) + fs * 0.5);
          ctx.restore();
        }

        /* 角落登录行 */
        var fs2 = Math.max(11, Math.round(Math.min(W, H) * 0.019));
        ctx.font = fs2 + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        var TAIL = [
          "> FROST.LAYER — WINDOW SEALED",
          "> ONE BREATH, THEN READ"
        ];
        for (var b = 0; b < TAIL.length; b++) {
          var bt = el - 500 - b * 400;
          if (bt <= 0) continue;
          var shown2 = TAIL[b].slice(0, Math.max(1, Math.round(TAIL[b].length * Math.min(1, bt / 320))));
          ctx.save();
          ctx.globalAlpha = 0.5 * Math.min(1, bt / 320) * Math.min(1, veil * 2);
          ctx.fillStyle = "#cfeaff";
          if (b === TAIL.length - 1) { ctx.shadowColor = "rgba(190,230,255,0.7)"; ctx.shadowBlur = 8; }
          ctx.fillText(shown2, W * 0.062, H * 0.07 + b * Math.round(fs2 * 1.6));
          ctx.restore();
        }

        /* 收尾 = 霜重新合拢盖满(回到 veil=1、clear=0 的那一帧),然后整帧淡黑交给面板进场霜雾 */
        if (el > T.end) {
          var kk = Math.min(1, (el - T.end) / (T.total - T.end));
          ctx.fillStyle = "rgba(4, 6, 10, " + (kk * kk).toFixed(3) + ")";
          ctx.fillRect(0, 0, W, H);
        }
      }
    };
  }


  var SCENES = {
    emoji: sceneEmoji,
    hex: sceneHex,
    water: sceneWater,
    glitch: sceneGlitch,
    fractal: sceneFrost
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
        return SCENES.hex(ctx, W, H, accent, cfg);
      }
    }
  };
})();
