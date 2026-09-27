/* ============================================================
   开机动画的"全息后期层"(独立文件)
   ─────────────────────────────────────────────────────────────
   作用:场景照常画在离屏画布上,这一层负责把它"过一遍成像",
        让五套场景看起来处在同一个世界里:
          ① 廉价泛光:把离屏画布缩小再放大画回去(lighter 叠加)
          ② 扫描线:每 3px 一条暗线
          ③ 滚动扫描带:一条缓慢下移的亮带
          ④ 暗角:四周压暗,视线收到中间
          ⑤ 噪点 + 闪动:让静态画面"活着"
   为什么不用 CSS filter / ctx.filter:
     之前踩过坑 —— 覆盖层的 filter 会让 WebGL 画布整块不显示。
     这里全部用"绘制操作"实现,零 filter。
   ============================================================ */
(function () {
  "use strict";

  var off = null;          /* 离屏画布:场景画在这里 */
  var octx = null;
  var small = null;        /* 缩小版:用于廉价泛光 */
  var sctx = null;
  var bandGrad = null, bandGradW = 0;
  var vigGrad = null, vigW = 0, vigH = 0;
  var grain = null;        /* 噪点贴图(预生成几帧,循环使用) */
  var grainTiles = [];
  var grainIdx = 0, grainAge = 0;

  function ensure(W, H) {
    if (!off) { off = document.createElement("canvas"); octx = off.getContext("2d"); }
    if (!small) { small = document.createElement("canvas"); sctx = small.getContext("2d"); }
    if (off.width !== W || off.height !== H) { off.width = W; off.height = H; }
    if (small.width !== Math.max(1, W >> 3) || small.height !== Math.max(1, H >> 3)) {
      small.width = Math.max(1, W >> 3);
      small.height = Math.max(1, H >> 3);
    }
  }

  /* 预生成 4 张噪点(每张 128x128),每帧挑一张平铺,避免每帧画上万个点 */
  function buildGrain() {
    if (grainTiles.length) return;
    for (var k = 0; k < 4; k++) {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var g = c.getContext("2d");
      var img = g.createImageData(128, 128);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 16;                 /* 很淡 */
      }
      g.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
    grain = grainTiles[0];
  }

  /* ===== 预烘焙:扫描线 + 暗角 + 噪声(每种噪声一张),每帧只 drawImage ===== */
  var overlays = [];
  var overlayW = 0, overlayH = 0, overlayIdx = 0, overlayAge = 0;

  function buildOverlay(W, H) {
    overlays = [];
    for (var k = 0; k < 4; k++) {
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var g = c.getContext("2d");
      /* ① 扫描线:每 3px 一条 */
      g.fillStyle = "rgba(0, 0, 0, 0.16)";
      for (var y = 0; y < H; y += 3) g.fillRect(0, y, 1 * W, 1);
      /* ② 暗角 */
      var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
      /* ③ 噪声(4 张各用一份,轮换即为"闪动")*/
      var n = document.createElement("canvas");
      n.width = n.height = 128;
      var ng = n.getContext("2d");
      var img = ng.createImageData(128, 128);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = 120 + Math.random() * 135;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 16;
      }
      ng.putImageData(img, 0, 0);
      g.save();
      g.globalAlpha = 0.5;
      var pat = g.createPattern(n, "repeat");
      if (pat) { g.fillStyle = pat; g.fillRect(0, 0, W, H); }
      g.restore();
      overlays.push(c);
    }
    overlayW = W; overlayH = H;
  }

  /* 对外:拿到离屏 ctx 给场景画画 */
  function context(W, H) {
    ensure(W, H);
    return octx;
  }

  /* 对外:把离屏内容过一遍后期,输出到可见画布 */
  function present(ctx, W, H, el, strength) {
    ensure(W, H);
    buildGrain();
    var s_ = strength == null ? 1 : strength;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    /* ① 清晰原图 */
    ctx.drawImage(off, 0, 0, W, H);

    /* ② 廉价泛光:缩小 → 平滑放大 → lighter 叠回。
       缩小放大两次,近似一次高斯模糊,几乎没有开销 */
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, small.width, small.height);
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(off, 0, 0, small.width, small.height);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.32 * s_;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, W, H);
    ctx.restore();

    /* ③ 扫描线 + ④ 暗角 + ⑤ 噪声:全部来自预烘焙覆盖图(每帧 1 次 drawImage)
       ★★★ 这一层必须【乘上画面的 alpha】再叠回去,不能直接 source-over 铺满。
       为什么:五套开机动画的收尾都是把 canvas 擦成透明的
         (未来 = destination-out 扫线、成长 = 逐格缩没、迷茫 = 圆形清除、
          技术 = 横带飞走、自我 = 脸掉出屏幕),
       擦出来的透明像素本该露出底下的页面 ——
       而这张覆盖图里画的是【不透明的黑】(扫描线 rgba(0,0,0,.16)、暗角到 .55、
       噪声),直接 source-over 铺上去,等于在"已经揭开的地方"又刷了一层黑:
       用户报的"大雪花飞过的地方还有黑屏遮挡",除了 .screen-static 那个常驻黑底之外,
       这里也贡献了一份(实测边缘/四角约 35~40% 的压暗)。
       ★ 做法:把覆盖图先用 destination-in 和画面相乘(alpha_scene × overlay),
         于是"画面是透明的地方,覆盖图也变透明",揭开的地方就真的干净了;
         亮着的地方(雪花、日志、圆环)照样有扫描线和暗角,CRT 的质感一点没少。 */
    if (overlayW !== W || overlayH !== H || !overlays.length) buildOverlay(W, H);
    overlayAge += 1;
    if (overlayAge % 3 === 0) overlayIdx = (overlayIdx + 1) % overlays.length;
    var ov = overlays[overlayIdx];
    var scratch = overlayBuf(W, H);
    var og = scratch.getContext("2d");
    og.setTransform(1, 0, 0, 1, 0, 0);
    og.globalCompositeOperation = "source-over";
    og.globalAlpha = 1;
    og.clearRect(0, 0, W, H);
    og.drawImage(ov, 0, 0, W, H);
    og.globalCompositeOperation = "destination-in";
    og.drawImage(off, 0, 0, W, H);          /* ← 用画面的 alpha 裁覆盖图 */
    og.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, 0, 0, W, H);
    /* ★ 闪烁那一笔同理:它原来也是"整屏压黑",会把揭开的地方再压一次。
       现在只压画面本身有的像素(整屏 source-atop)。 */
    var flick = 0.985 + Math.random() * 0.03;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(0,0,0," + ((1 - flick) * 0.9).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* 给"覆盖图 × 画面 alpha"用的暂存画布(按尺寸缓存一张,不每帧新建) */
  var _obuf = null;
  function overlayBuf(W, H) {
    if (!_obuf) _obuf = document.createElement("canvas");
    if (_obuf.width !== W || _obuf.height !== H) { _obuf.width = W; _obuf.height = H; }
    return _obuf;
  }

  /* 对外:收尾时清空离屏 —— 动画最后一帧不留在离屏上,
     否则它会被 present 反复画出来,配合 is-on 淡出就成了"逐帧拖尾" */
  function reset() {
    if (octx && off) {
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.globalAlpha = 1;
      octx.globalCompositeOperation = "source-over";
      octx.clearRect(0, 0, off.width, off.height);
    }
    if (sctx && small) {
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, small.width, small.height);
    }
  }

  window.CDBootPost = { context: context, present: present, reset: reset };
})();
