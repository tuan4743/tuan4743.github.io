/* ============================================================
   第二张盘「成长」的主页内容:太空站视角(贴图版 + 视频恒星)
   ─────────────────────────────────────────────────────────────
   素材:static/planet/ —— 宇宙背景 / 蓝巨星(可换成 mp4 视频)/ 五颗行星
   数据:hugo.toml:[params.intro.solar](背景+恒星)+ [[params.intro.decks.growth]]
        x / y = 星体中心  w = 宽度占面板宽的比例  rot = 贴图旋转
        depth = 纵深(越小越远):决定它随摄像机怎么动、透视缩放多少
   微调面板:Alt+T(或 ?tune)
   ─────────────────────────────────────────────────────────────
   摄像机(拖动 = 转动视角,不是平移):
     · 横向拖 → 绕竖直轴 yaw 旋转;纵向拖 → pitch
       → 离画面中心越远的东西转得越多,近的还会跟着放大/缩小(透视),
         所以看起来是绕着场景转,而不是整块平移
     · 限位:--cam-yaw / --cam-pitch(弧度)
     · 阻尼:--cam-tau(ms);松手【停在原地】,不回中
     · 太阳 depth 默认 0.02 → 转视角时它只轻微动一点点,不再像贴死的图
     · 鼠标移动不再驱动视角(已去掉)
   光子特效:
     · 独立 canvas ~70 个光子随机明灭(淡入→淡出→换地方再来),
       跟随摄像机做远景视差;只在选中这张盘时跑
   ============================================================ */
(function () {
  "use strict";

  var NARROW = 780;
  var GAP = 16;
  var CLICK_TOL = 6;
  var ORBIT = 0.00095;     /* 每像素拖动 = 多少弧度(约 0.054°/px)*/
  var PITCH_K = 0.45;      /* 纵向拖动 → pitch 的比例 */
  var BASE = 0.30;         /* 运动系数=1 时的最大横向位移(面板宽的比例)*/
  var BASY = 0.22;         /* 纵向同理(面板高的比例)*/
  var SCALE_K = 0.95;      /* 旋转感:离画面中心越远,缩放变化越大 */
  /* 运动系数:太阳 depth 0.02 → 0.066(只轻微动);行星 depth 3 → 0.96 */
  function motion(d) { return 0.06 + 0.30 * (isFinite(d) ? d : 0.7); }
  var PHOTONS = 70;        /* 背景光子数量 */
  var STAR_KEY = -2;       /* 恒星在 onIndex 里的虚拟序号(0..n-1 = 行星,-1 = 都没锁定)*/

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function attrNum(el, name, dflt) {
    var v = parseFloat(el && el.getAttribute(name));
    return isFinite(v) ? v : dflt;
  }
  function cssNum(el, name, dflt, lo, hi) {
    var v = parseFloat(getComputedStyle(el).getPropertyValue(name));
    return isFinite(v) && v >= lo && v <= hi ? v : dflt;
  }
  function mk(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function build(root, key) {
    var sun = root.querySelector(".solar-node--star");
    var sunVideo = root.querySelector(".solar-sun-video");
    var starHit = root.querySelector(".solar-planet--star");   /* 恒星自己的命中按钮(透明)*/
    var starCard = root.querySelector(".solar-card--star");    /* 恒星自己的 HUD 卡片 */
    var nodes = Array.prototype.slice.call(root.querySelectorAll(".solar-node:not(.solar-node--star)"));
    var balls = nodes.map(function (n) { return n.querySelector(".solar-planet"); });
    var imgs = nodes.map(function (n) { return n.querySelector(".solar-tex"); });
    var cards = nodes.map(function (n) { return n.querySelector(".solar-card"); });
    var svg = root.querySelector(".solar-svg");

    var TUNE = window.__solarTune || (window.__solarTune = {});
    function cfgOf(node) {
      var id = node.getAttribute("data-code") || "";
      var base = {
        x: attrNum(node, "data-x", 0.5), y: attrNum(node, "data-y", 0.5),
        w: attrNum(node, "data-w", 0.12), rot: attrNum(node, "data-rot", 0),
        depth: attrNum(node, "data-depth", 0.7)
      };
      var t = TUNE[id];
      if (t) for (var k in t) if (isFinite(t[k])) base[k] = t[k];
      return base;
    }

    var active = false, onIndex = -1, geo = [], narrow = false, sunCfg = null;

    /* ---------------- 摄像机状态 ---------------- */
    var cam = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0, drag: false, px: 0, py: 0, bx: 0, by: 0, moved: 0, dx: 0, dy: 0 };
    var camRaf = 0, camLast = 0;
    var yawMax = 0.16, pitchMax = 0.10, camTau = 110;

    /* 投影:静止时精确等于原构图(dx=dy=0, s=1)*/
    function project(g, W, H) {
      var bx = g.x - W * 0.5, by = g.y - H * 0.5;
      var sx = Math.sin(cam.yaw), sy = Math.sin(cam.pitch);
      var m = motion(g.depth);
      var dx = -sx * BASE * W * m;
      var dy = -sy * BASY * H * m;
      /* 透视:离画面中心越远,缩放变化越大 → 转视角时整体像在绕着一个点转 */
      var s = 1 + (bx / W) * sx * SCALE_K + (by / H) * sy * SCALE_K * 0.6;
      return { dx: dx, dy: dy, s: Math.max(0.5, Math.min(2, s)) };
    }

    function applyCam() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2) return;
      var i, p;
      /* 画面中心的位移(给背景层当作远景平移量)*/
      p = project({ x: W * 0.5, y: H * 0.5, depth: 0.06 }, W, H);
      cam.dx = p.dx; cam.dy = p.dy;
      root.style.setProperty("--cam-x", p.dx.toFixed(2) + "px");
      root.style.setProperty("--cam-y", p.dy.toFixed(2) + "px");
      if (sun && geo.sun) {
        p = project(geo.sun, W, H);
        geo.sun.dx = p.dx; geo.sun.dy = p.dy; geo.sun.s = p.s;
        /* ★ 变量写在 .solar-sun 上,由它继承给 video/img;
           transform 只作用在 video/img 自己身上(祖先带 transform 会隔离混合)*/
        var ball = sun.querySelector(".solar-sun");
        if (ball) {
          ball.style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
          ball.style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
          ball.style.setProperty("--cam-s", p.s.toFixed(4));
        }
        /* 命中按钮跟着球体一起动(它画在视频【上面】,所以写在自己身上最安全)*/
        if (starHit) {
          starHit.style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
          starHit.style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
          starHit.style.setProperty("--cam-s", p.s.toFixed(4));
        }
      }
      for (i = 0; i < nodes.length; i++) {
        if (!geo[i]) continue;
        p = project(geo[i], W, H);
        geo[i].dx = p.dx; geo[i].dy = p.dy; geo[i].s = p.s;
        nodes[i].style.setProperty("--cam-dx", p.dx.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-dy", p.dy.toFixed(2) + "px");
        nodes[i].style.setProperty("--cam-s", p.s.toFixed(4));
      }
      if (onIndex >= 0 || onIndex === STAR_KEY) refreshCard();
    }
    function camFrame(now) {
      camRaf = 0;
      var dt = Math.min(64, Math.max(1, now - camLast));
      camLast = now;
      var a = 1 - Math.exp(-dt / camTau);
      var dy = cam.yawT - cam.yaw, dp = cam.pitchT - cam.pitch;
      if (Math.abs(dy) < 1e-5 && Math.abs(dp) < 1e-5) { cam.yaw = cam.yawT; cam.pitch = cam.pitchT; }
      else { cam.yaw += dy * a; cam.pitch += dp * a; }
      applyCam();
      if (cam.yaw !== cam.yawT || cam.pitch !== cam.pitchT) camRaf = requestAnimationFrame(camFrame);
    }
    function kickCam() { if (!camRaf && active) { camLast = performance.now(); camRaf = requestAnimationFrame(camFrame); } }
    function stopCam() { if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; } }

    /* ---------------- 背景光子 ---------------- */
    var phCv = null, phCtx = null, phSprite = null, ph = [], phRaf = 0, phLast = 0;
    function newPhoton(rand) {
      return {
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 2.6,          /* 用户要求:比原来小一半 */
        depth: 0.06 + Math.random() * 0.4,
        dur: 1600 + Math.random() * 2600,
        t: rand ? -Math.random() * 2600 : -Math.random() * 500,
        drift: (Math.random() - 0.5) * 0.00004
      };
    }
    /* ---------- 远距离瞬变:超新星 ---------- */
    var novaSpriteCv = null;
    var nova = { next: 2500 + Math.random() * 6000, t: -1, dur: 0, x: 0, y: 0, size: 0, spin: 0 };
    var NOVA_DUR = 320;      /* 一闪的总时长(ms):前 15% 冲上去,后面快速衰减 */
    function novaBuild() {
      var S = 160, c = S / 2;
      novaSpriteCv = document.createElement("canvas");
      novaSpriteCv.width = novaSpriteCv.height = S;
      var g = novaSpriteCv.getContext("2d");
      var core = g.createRadialGradient(c, c, 0, c, c, S * 0.17);
      core.addColorStop(0, "rgba(255,255,255,1)");
      core.addColorStop(0.3, "rgba(215,240,255,0.8)");
      core.addColorStop(1, "rgba(150,205,255,0)");
      g.fillStyle = core;
      g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = "lighter";
      for (var i = 0; i < 2; i++) {            /* 十字光芒 */
        g.save();
        g.translate(c, c);
        g.rotate(i * Math.PI / 2);
        var lg = g.createLinearGradient(-c, 0, c, 0);
        lg.addColorStop(0, "rgba(170,215,255,0)");
        lg.addColorStop(0.5, "rgba(240,250,255,0.95)");
        lg.addColorStop(1, "rgba(170,215,255,0)");
        g.fillStyle = lg;
        g.fillRect(-c, -S * 0.011, S, S * 0.022);
        g.restore();
      }
      g.globalCompositeOperation = "source-over";
    }
    function novaSpawn() {
      /* 深空角落:四个角里挑一个,再往画面内缩一点,避开太阳和行星 */
      var left = Math.random() < 0.5;
      var top = Math.random() < 0.5;
      nova.x = left ? 0.05 + Math.random() * 0.17 : 0.78 + Math.random() * 0.17;
      nova.y = top ? 0.08 + Math.random() * 0.16 : 0.74 + Math.random() * 0.18;
      nova.size = 26 + Math.random() * 26;
      nova.spin = (Math.random() - 0.5) * 0.6;
      nova.t = 0;
      nova.dur = NOVA_DUR * (0.85 + Math.random() * 0.3);
      nova.next = 4000 + Math.random() * 7000;
    }
    function novaDraw(W, H) {
      if (!novaSpriteCv) return;
      var k = nova.t / nova.dur;
      /* 亮度包络:15% 快速冲上去,然后二次衰减 */
      var a = k < 0.15 ? k / 0.15 : Math.pow(1 - (k - 0.15) / 0.85, 2);
      if (a <= 0.01) return;
      var x = nova.x * W + cam.dx * 0.05;      /* 纵深极小 ⇒ 几乎不动,看起来很远 */
      var y = nova.y * H + cam.dy * 0.05;
      var R = nova.size * (1 + 0.5 * k);
      phCtx.save();
      phCtx.globalCompositeOperation = "lighter";
      phCtx.translate(x, y);
      phCtx.rotate(nova.spin);
      phCtx.globalAlpha = Math.min(1, a * 1.15);
      phCtx.drawImage(novaSpriteCv, -R, -R, R * 2, R * 2);
      /* 一圈快速扩散的环 */
      var rk = Math.max(0, (k - 0.1) / 0.9);
      if (rk < 1) {
        phCtx.globalAlpha = (1 - rk) * 0.35 * a;
        phCtx.strokeStyle = "rgba(200,235,255,1)";
        phCtx.lineWidth = 1;
        phCtx.beginPath();
        phCtx.arc(0, 0, R * (0.5 + rk * 1.6), 0, Math.PI * 2);
        phCtx.stroke();
      }
      phCtx.restore();
    }

    function photonInit() {
      phCv = document.createElement("canvas");
      phCv.className = "solar-photons";
      phCv.setAttribute("aria-hidden", "true");
      root.insertBefore(phCv, root.firstChild.nextSibling);
      phCtx = phCv.getContext("2d");
      var R = 32;                                  /* 预渲染一颗光子,之后只 drawImage */
      phSprite = document.createElement("canvas");
      phSprite.width = phSprite.height = R * 2;
      var g = phSprite.getContext("2d");
      var grd = g.createRadialGradient(R, R, 0, R, R, R);
      grd.addColorStop(0, "rgba(216, 242, 255, 1)");
      grd.addColorStop(0.35, "rgba(170, 220, 255, 0.5)");
      grd.addColorStop(1, "rgba(140, 200, 255, 0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(R, R, R, 0, Math.PI * 2);
      g.fill();
      if (!novaSpriteCv) novaBuild();
      for (var i = 0; i < PHOTONS; i++) ph.push(newPhoton(true));
    }
    function photonFrame(now) {
      phRaf = 0;
      if (!active || narrow || !phCtx) return;
      var dt = phLast ? Math.min(80, now - phLast) : 16;
      phLast = now;
      var W = root.clientWidth, H = root.clientHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (phCv.width !== Math.round(W * dpr) || phCv.height !== Math.round(H * dpr)) {
        phCv.width = Math.round(W * dpr);
        phCv.height = Math.round(H * dpr);
      }
      phCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      phCtx.clearRect(0, 0, W, H);
      phCtx.globalCompositeOperation = "lighter";
      for (var i = 0; i < ph.length; i++) {
        var p = ph[i];
        p.t += dt;
        if (p.t > p.dur) { ph[i] = newPhoton(false); p = ph[i]; }
        if (p.t < 0) continue;
        var a = Math.sin(Math.PI * (p.t / p.dur));      /* 淡入 → 淡出 */
        if (a <= 0.01) continue;
        var px = (p.x + p.drift * p.t) * W + cam.dx * p.depth;
        var py = p.y * H + cam.dy * p.depth;
        var rr = p.r * (1 + 0.25 * Math.sin(p.t / 700 + i));
        phCtx.globalAlpha = Math.min(1, a * 0.85);
        phCtx.drawImage(phSprite, px - rr * 1.5, py - rr * 1.5, rr * 3, rr * 3);
      }
      /* 远距离瞬变:到点了就闪一下 */
      if (nova.t < 0) {
        nova.next -= dt;
        if (nova.next <= 0) novaSpawn();
      } else {
        nova.t += dt;
        if (nova.t > nova.dur) nova.t = -1;
        else novaDraw(W, H);
      }
      phCtx.globalAlpha = 1;
      phCtx.globalCompositeOperation = "source-over";
      phRaf = requestAnimationFrame(photonFrame);
    }
    function photonStart() {
      if (narrow) return;
      if (!phCv) photonInit();
      if (!phRaf) { phLast = 0; phRaf = requestAnimationFrame(photonFrame); }
    }
    function photonStop() { if (phRaf) { cancelAnimationFrame(phRaf); phRaf = 0; } }

    /* ---------------- 位置计算 ---------------- */
    function place() {
      var W = root.clientWidth, H = root.clientHeight;
      if (W < 2 || H < 2) return;
      narrow = W < NARROW;
      root.classList.toggle("is-narrow", narrow);
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      /* 换尺寸:锚点全变了,旧卡片的位置没意义 → 全部收起来(宽屏/窄屏切换也走这里)*/
      closeCards();
      yawMax = cssNum(root, "--cam-yaw", 0.16, 0, 1);
      pitchMax = cssNum(root, "--cam-pitch", 0.10, 0, 1);
      camTau = cssNum(root, "--cam-tau", 110, 10, 900);

      sunCfg = {
        x: attrNum(sun, "data-x", 0.19), y: attrNum(sun, "data-y", 0.34),
        w: attrNum(sun, "data-w", 0.26), depth: attrNum(sun, "data-depth", 0.02),
        /* 球体占视频宽的比例:视频里只有中间的球是有用的,元素要放大到 1/这个比例 */
        sphere: attrNum(sun, "data-sphere", 0.52)
      };
      var st = TUNE.__sun;
      if (st) for (var k in st) if (isFinite(st[k])) sunCfg[k] = st[k];
      if (sun) {
        sun.style.left = (sunCfg.x * W).toFixed(1) + "px";
        sun.style.top = (sunCfg.y * H).toFixed(1) + "px";
      }
      /* 有视频时:元素宽度 = 目标球体直径 ÷ 球体占比(这样 sun_w 仍然表示球体宽度)*/
      var sunElW = sunCfg.w * W;
      if (sunVideo && sunCfg.sphere > 0.05) sunElW = sunElW / sunCfg.sphere;
      root.style.setProperty("--sun-w", sunElW.toFixed(1) + "px");
      /* 恒星的可点/可磁吸范围:按【球体】直径算,略微放大一点好点中(最小 56px 保底)*/
      root.style.setProperty("--sun-hit", Math.max(56, sunCfg.w * W * 1.16).toFixed(1) + "px");
      /* 遮罩外缘半径:球体半径 × 1.32(px 精确值,不再靠百分比猜)*/
      var sunBallEl = sun ? sun.querySelector(".solar-sun") : null;
      if (sunBallEl) sunBallEl.style.setProperty("--sun-mask-rp", (sunCfg.w * W * 0.5 * 1.32).toFixed(1) + "px");
      geo.sun = {
        x: sunCfg.x * W, y: sunCfg.y * H, depth: sunCfg.depth,
        r: sunCfg.w * W / 2, rh: sunCfg.w * W / 2, dx: 0, dy: 0, s: 1
      };
      root.__sunElW = sunElW;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var c = cfgOf(n);
        var w = Math.max(8, c.w * W);
        n.style.left = (c.x * W).toFixed(1) + "px";
        n.style.top = (c.y * H).toFixed(1) + "px";
        n.style.setProperty("--w", w.toFixed(1) + "px");
        var rot = c.rot ? "rotate(" + c.rot + "deg)" : "";
        if (imgs[i]) imgs[i].style.transform = rot;
        if (balls[i]) balls[i].style.transform = rot;
        var r = balls[i] ? balls[i].getBoundingClientRect() : null;
        geo[i] = {
          x: c.x * W, y: c.y * H, depth: c.depth,
          r: r ? r.width / 2 : w / 2, rh: r ? r.height / 2 : w / 2
        };
      }
      applyCam();
    }

    /* ---------------- HUD 卡片(五颗行星 + 恒星共用同一套) ----------------
       ax/ay = 卡片所在节点的锚点(卡片是 position:absolute left:0/top:0,原点在这里)
       cx/cy = 星体【当前】的屏幕上中心(锚点 + 摄像机位移);R = 星体屏幕半径 */
    function placeCard(card, ax, ay, cx, cy, R) {
      var W = root.clientWidth, H = root.clientHeight;
      var pad = cssNum(root, "--pad", 20, 0, 200);
      var w = card.offsetWidth || 240, h = card.offsetHeight || 120;
      var sides = [
        { k: "right", v: W - (cx + R) - w },
        { k: "left", v: (cx - R) - w },
        { k: "above", v: (cy - R) - h },
        { k: "below", v: H - (cy + R) - h }
      ];
      sides.sort(function (a, b) { return b.v - a.v; });
      var lx, ly;
      switch (sides[0].k) {
        case "right": lx = cx + R + GAP; ly = cy - h / 2; break;
        case "left": lx = cx - R - GAP - w; ly = cy - h / 2; break;
        case "above": lx = cx - w / 2; ly = cy - R - GAP - h; break;
        default: lx = cx - w / 2; ly = cy + R + GAP;
      }
      lx = clamp(lx, pad, Math.max(pad, W - pad - w));
      ly = clamp(ly, pad, Math.max(pad, H - pad - h));
      card.style.transform = "translate3d(" + (lx - ax).toFixed(1) + "px," + (ly - ay).toFixed(1) + "px,0)";
      card.classList.add("is-on");
      if (!svg) return;
      var tx = lx + w / 2, ty = ly + h / 2;
      var ax2 = tx - cx, ay2 = ty - cy;
      var len = Math.max(1, Math.hypot(ax2, ay2));
      var sx = cx + (ax2 / len) * (R + 2), sy = cy + (ay2 / len) * (R + 2);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.appendChild(mk("path", {
        d: "M" + sx.toFixed(1) + " " + sy.toFixed(1) + " L" + tx.toFixed(1) + " " + ty.toFixed(1),
        "class": "solar-lead"
      }));
      svg.appendChild(mk("circle", { cx: sx.toFixed(1), cy: sy.toFixed(1), r: 2.2, "class": "solar-node-dot" }));
    }

    function show(i) {
      var card = cards[i], g = geo[i];
      if (!card || !g) return;
      placeCard(card, g.x, g.y, g.x + (g.dx || 0), g.y + (g.dy || 0), Math.max(g.r, g.rh) * (g.s || 1));
    }

    /* 恒星的卡片:锚点/中心都来自 sunCfg(球体半径 × 透视缩放)*/
    function showStar() {
      var g = geo.sun;
      if (!starCard || !g) return;
      placeCard(starCard, g.x, g.y, g.x + (g.dx || 0), g.y + (g.dy || 0), g.r * (g.s || 1));
    }

    /* 摄像机在动的时候,顺手把已经打开的卡片重新贴回星体上 */
    function refreshCard() {
      if (onIndex === STAR_KEY) showStar();
      else if (onIndex >= 0) show(onIndex);
    }

    /* 全部收起来(行星 + 恒星):换尺寸、开始拖动、指针移开都走这里 */
    function closeCards() {
      var i;
      for (i = 0; i < cards.length; i++) {
        if (cards[i]) { cards[i].classList.remove("is-on"); cards[i].style.transform = ""; }
        if (nodes[i]) nodes[i].classList.remove("is-on");
      }
      if (starCard) { starCard.classList.remove("is-on"); starCard.style.transform = ""; }
      if (sun) sun.classList.remove("is-on");
      if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
      onIndex = -1;
    }

    function focus(i) {
      if (onIndex === i) return;
      closeCards();
      if (i === STAR_KEY) {
        if (sun) sun.classList.add("is-on");
        onIndex = i;
        showStar();
        return;
      }
      if (i < 0) return;              /* onIndex 已在 closeCards 里归 -1 */
      onIndex = i;
      nodes[i].classList.add("is-on");
      show(i);
    }

    /* ---------------- 光标小字提示 ---------------- */
    var stale = root.querySelectorAll(".solar-drag");
    for (var si = 0; si < stale.length; si++) stale[si].remove();
    var hint = document.createElement("span");
    hint.className = "solar-drag";
    hint.textContent = "DRAG";
    root.appendChild(hint);
    function moveHint(e) {
      hint.style.transform = "translate3d(" + (e.clientX + 16) + "px," + (e.clientY + 16) + "px,0)";
    }
    function hintOn(on) { root.classList.toggle("is-cursor", !!on); }
    function hintText(t) { hint.textContent = t; }

    /* ---------------- 事件 ---------------- */
    nodes.forEach(function (n, i) {
      var ball = balls[i];
      if (!ball) return;
      ball.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch" || cam.drag) return;
        focus(i);
      });
      ball.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      ball.addEventListener("focus", function () { if (active) focus(i); });
      ball.addEventListener("blur", function () { if (active && onIndex === i) focus(-1); });
      ball.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch" || cam.moved > CLICK_TOL) return;
        focus(onIndex === i ? -1 : i);
      });
    });

    /* 恒星:跟行星一模一样的一套(指针移上去锁定、触屏点一下锁定)*/
    if (starHit) {
      starHit.addEventListener("pointerenter", function (e) {
        if (!active || e.pointerType === "touch" || cam.drag) return;
        focus(STAR_KEY);
      });
      starHit.addEventListener("pointerleave", function (e) {
        if (!active || e.pointerType === "touch") return;
        focus(-1);
      });
      starHit.addEventListener("focus", function () { if (active) focus(STAR_KEY); });
      starHit.addEventListener("blur", function () { if (active && onIndex === STAR_KEY) focus(-1); });
      starHit.addEventListener("click", function (e) {
        if (!active || e.pointerType !== "touch" || cam.moved > CLICK_TOL) return;
        focus(onIndex === STAR_KEY ? -1 : STAR_KEY);
      });
    }

    function onDown(e) {
      if (!active || narrow || e.button) return;
      cam.drag = true;
      cam.moved = 0;
      cam.px = e.clientX; cam.py = e.clientY;
      cam.bx = cam.yawT; cam.by = cam.pitchT;
      root.classList.add("is-drag");
      if (e.pointerType !== "touch") { hintText("RELEASE"); moveHint(e); hintOn(true); }
      focus(-1);
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMove(e) {
      if (!active) return;
      if (cam.drag) {
        var dx = e.clientX - cam.px, dy = e.clientY - cam.py;
        cam.moved += Math.abs(dx) + Math.abs(dy);
        /* ★ 拖动 = 转视角:横向给 yaw、纵向给 pitch(抓住画面的手感,带限位)*/
        cam.yawT = clamp(cam.bx - dx * ORBIT, -yawMax, yawMax);
        cam.pitchT = clamp(cam.by - dy * ORBIT * PITCH_K, -pitchMax, pitchMax);
        kickCam();
      }
      if (e.pointerType !== "touch") { moveHint(e); hintOn(true); }
    }
    function onUp(e) {
      if (!cam.drag) return;
      cam.drag = false;
      root.classList.remove("is-drag");
      hintText("DRAG");
      if (e && e.pointerType !== "touch") moveHint(e);
      try { root.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    /* ★ 指针移出只收小字:视角停在原地,不回中、也不再有"跟随鼠标"的视差 */
    root.addEventListener("pointerleave", function () { hintOn(false); });

    imgs.forEach(function (im) {
      if (im && !im.complete) im.addEventListener("load", function () { if (active) place(); }, { once: true });
    });
    if (sunVideo) sunVideo.muted = true;      /* 保险:绝不出声 */

    /* CD 架打开(=黑屏状态):暂停视频、停掉光子;收起后恢复。
       既省电,也避免视频层在黑屏上留下任何动静 */
    var sceneOpen = document.body.classList.contains("scene-open");
    function onSceneOpen() {
      var now = document.body.classList.contains("scene-open");
      if (now === sceneOpen) return;
      sceneOpen = now;
      if (now) {
        photonStop();
        if (sunVideo) { try { sunVideo.pause(); } catch (e) {} }
      } else if (active) {
        photonStart();
        if (sunVideo) { try { sunVideo.play(); } catch (e) {} }
      }
    }
    if (window.MutationObserver) {
      new MutationObserver(onSceneOpen).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }

    return {
      root: root, nodes: nodes, cfgOf: cfgOf, place: place, sunNode: sun,
      key: key,
      activate: function (on) {
        active = on;
        if (on) {
          place();
          root.classList.remove("is-live");
          requestAnimationFrame(function () { if (active) root.classList.add("is-live"); });
          photonStart();
          if (sunVideo) { try { sunVideo.play(); } catch (e) {} }
        } else {
          root.classList.remove("is-live");
          root.classList.remove("is-drag");
          root.classList.remove("is-cursor");
          focus(-1);
          hintText("DRAG");
          cam.yaw = cam.yawT = 0; cam.pitch = cam.pitchT = 0; cam.drag = false;
          stopCam();
          applyCam();
          photonStop();
          if (sunVideo) { try { sunVideo.pause(); } catch (e) {} }
        }
      },
      repaint: function () { place(); if (active) photonStart(); },
      /* 验收用:立刻触发一次超新星 */
      novaNow: function () { nova.next = 0; },
      /* 验收用:恒星 HUD(命中圈 / 球体 / 卡片)的实测数据,全部用【视口坐标】*/
      starState: function () {
        var hit = starHit ? starHit.getBoundingClientRect() : null;
        var card = starCard ? starCard.getBoundingClientRect() : null;
        var rb = root.getBoundingClientRect();
        return {
          hasHit: !!starHit, hasCard: !!starCard, open: onIndex === STAR_KEY,
          hit: hit ? { x: Math.round(hit.x), y: Math.round(hit.y), w: Math.round(hit.width), h: Math.round(hit.height), cx: Math.round(hit.x + hit.width / 2), cy: Math.round(hit.y + hit.height / 2) } : null,
          ball: geo.sun ? {
            cx: Math.round(rb.x + geo.sun.x + (geo.sun.dx || 0)),
            cy: Math.round(rb.y + geo.sun.y + (geo.sun.dy || 0)),
            r: Math.round(geo.sun.r * (geo.sun.s || 1))
          } : null,
          box: card ? { x: Math.round(card.x), y: Math.round(card.y), w: Math.round(card.width), h: Math.round(card.height), on: starCard.classList.contains("is-on") } : null,
          title: starCard ? (starCard.querySelector(".solar-title") || {}).textContent : null
        };
      },
      state: function () {
        return {
          key: key, active: active, narrow: narrow, bodies: geo.length, open: onIndex,
          cam: {
            yaw: +cam.yaw.toFixed(4), pitch: +cam.pitch.toFixed(4),
            yawT: +cam.yawT.toFixed(4), pitchT: +cam.pitchT.toFixed(4),
            drag: cam.drag, yawMax: yawMax, pitchMax: pitchMax,
            dx: +cam.dx.toFixed(1), dy: +cam.dy.toFixed(1)
          },
          photons: ph.length,
          nova: { t: +nova.t.toFixed(0), next: +nova.next.toFixed(0), dur: +nova.dur.toFixed(0) },
          sun: sunCfg,
          geo: geo.filter(Boolean).map(function (g) { return [Math.round(g.x), Math.round(g.y), Math.round(g.r * 2)]; })
        };
      }
    };
  }

  if (window.CDPages && window.CDPages.register) window.CDPages.register("solar", build);
})();
