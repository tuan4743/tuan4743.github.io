(function () {
  "use strict";

  var off = null;
  var octx = null;
  var small = null;
  var sctx = null;
  var bandGrad = null, bandGradW = 0;
  var vigGrad = null, vigW = 0, vigH = 0;
  var grain = null;
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
        img.data[i + 3] = 16;
      }
      g.putImageData(img, 0, 0);
      grainTiles.push(c);
    }
    grain = grainTiles[0];
  }

  var overlays = [];
  var overlayW = 0, overlayH = 0, overlayIdx = 0, overlayAge = 0;

  function buildOverlay(W, H) {
    overlays = [];
    for (var k = 0; k < 4; k++) {
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.fillStyle = "rgba(0, 0, 0, 0.16)";
      for (var y = 0; y < H; y += 3) g.fillRect(0, y, 1 * W, 1);
      var vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
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

  function context(W, H) {
    ensure(W, H);
    return octx;
  }

  function present(ctx, W, H, el, strength) {
    ensure(W, H);
    buildGrain();
    var s_ = strength == null ? 1 : strength;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    ctx.drawImage(off, 0, 0, W, H);

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
    og.drawImage(off, 0, 0, W, H);
    og.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, 0, 0, W, H);
    var flick = 0.985 + Math.random() * 0.03;
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(0,0,0," + ((1 - flick) * 0.9).toFixed(3) + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  var _obuf = null;
  function overlayBuf(W, H) {
    if (!_obuf) _obuf = document.createElement("canvas");
    if (_obuf.width !== W || _obuf.height !== H) { _obuf.width = W; _obuf.height = H; }
    return _obuf;
  }

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
