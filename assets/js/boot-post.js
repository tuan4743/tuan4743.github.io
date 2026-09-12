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

  /* 对外:拿到离屏 ctx 给场景画画 */
  function context(W, H) {
    ensure(W, H);
    return octx;
  }

  /* 对外:把离屏内容过一遍后期,输出到可见画布 */
  function present(ctx, W, H, el, strength) {
    ensure(W, H);
    buildGrain();
    var s = strength == null ? 1 : strength;

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
    ctx.globalAlpha = 0.32 * s;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, W, H);
    ctx.restore();

    /* ③ 扫描线 */
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();

    /* ④ 滚动扫描带(一条缓慢下移的亮带 + 一条更亮的细线)*/
    var bandY = ((el * 0.12) % (H + 200)) - 100;   /* 速度:0.06 → 0.12(快一倍)*/
    var grad = ctx.createLinearGradient(0, bandY - 60, 0, bandY + 60);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(210,240,255," + (0.05 * s).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY - 60, W, 120);
    ctx.fillStyle = "rgba(220,245,255," + (0.06 * s).toFixed(3) + ")";
    ctx.fillRect(0, bandY, W, 1);

    /* ⑤ 暗角 */
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    /* ⑥ 噪点 + 闪动 */
    grainAge += 1;
    if (grainAge % 3 === 0) { grainIdx = (grainIdx + 1) % grainTiles.length; grain = grainTiles[grainIdx]; }
    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.5 * s;
      var pat = ctx.createPattern(grain, "repeat");
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }
    var flick = 0.985 + Math.random() * 0.03;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0,0,0," + ((1 - flick) * 0.9).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
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
