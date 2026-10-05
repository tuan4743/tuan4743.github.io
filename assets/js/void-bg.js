/* ============================================================
   void-bg.js — 站点背景:缺陷海密度场 / 旧真空驻波网络
   ─────────────────────────────────────────────────────────────
   世界观口径(《数据方舟与意识锚点》):
   · 暗模式 = 新真空的拓扑泡沫(缺陷海密度场)。俯视序参量场 φ(x,t):
     - 极淡白点 = 局部密度峰值,随场涨落,从不生灭(A4:新真空允许拓扑缺陷)
     - 等高线 = 密度梯度等值线 |∇φ|²=c(同一函数的等值线天然不交叉,
       只渲染 2~4 条 ⇒ 稀疏、无交叉)
     - 圆形漩涡→纯黑圆盘 = 界生成核事件(设定 8.1:序参量无定义处才可成核;
       拓扑荷守恒 ⇒ 掏空的荷挤到边界,盘缘密度略增)
     - 白点密度带 = 锚点间纠错网络的共识流(低带宽协议)
   · 亮模式 = 旧真空残余(里世界)。被抑制场撑着的、正在溃散的相:
     - 驻波节点网 = 边界条件本征模,节点线永远静止(驻波定义)
     - 拍频亮斑 = 近频模叠加的差频包络,缓慢游移
     - 节点断点 = 旧真空维持不住本征模,节点"漏"(振幅不再严格为零)
     - 失相区 = 泡壁残余涨落拍在膜上,网纹局部错位又平复
     整网对比度以 ~10min 周期缓慢衰减再勉强回复,永远回不到满 —— 在坏。
   · 信息 = 相位差,波 = 载体(UL-1 三行):白点亮度 = 相位余弦。

   实现纪律:
   · 全部确定性 hash 驱动,无随机闪烁;reduced-motion 时画一帧凝固。
   · 亮度纪律:整层 ≤0.30;线 ≤0.10;事件单次 ≤0.12 且同时只一个;
     中央阅读区(内容页)用径向遮罩再压一层。
   · 亮模式不进 CD 首页(那个模板自己挂,见 void-bg CSS 挂载)。
   ============================================================ */
(function () {
  "use strict";

  var docEl = document.documentElement;
  var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- 画布 ---------- */
  var cv = document.createElement("canvas");
  cv.className = "void-bg";
  cv.setAttribute("aria-hidden", "true");
  /* 首页(CD)挂进 .intro-bg(z-index:0 的那层);其余页面挂 .page-cosmos(fixed -1)。
     都没有就直接钉 body。 */
  var holder = document.querySelector(".intro-bg") || document.querySelector(".page-cosmos");
  if (!holder) { cv.style.cssText = "position:fixed;inset:0;z-index:-1;pointer-events:none;"; (document.body || docEl).appendChild(cv); }
  else { holder.insertBefore(cv, holder.firstChild); }
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- 共享:密度势场(暗模式等高线的 φ) ----------
     3 个缓慢漂移的高斯势阱叠加,幅度呼吸。φ 值域约 [-1,1]。 */
  var TRAPS = [
    { x: 0.28, y: 0.30, r: 0.55, amp: 0.55, w: 1.00, dx: 0.010, dy: -0.006 },
    { x: 0.72, y: 0.62, r: 0.70, amp: 0.48, w: 0.83, dx: -0.007, dy: 0.009 },
    { x: 0.50, y: 0.85, r: 0.50, amp: 0.40, w: 1.21, dx: 0.005, dy: -0.004 }
  ];
  function phi(nx, ny, tSec) {
    var v = 0;
    for (var i = 0; i < TRAPS.length; i++) {
      var tp = TRAPS[i];
      var tx = tp.x + Math.sin(tSec * 0.011 * tp.w + i * 2.1) * tp.dx * 60;
      var ty = tp.y + Math.cos(tSec * 0.009 * tp.w + i * 1.7) * tp.dy * 60;
      var dx = nx - tx, dy = ny - ty;
      var g = Math.exp(-(dx * dx + dy * dy) / (tp.r * tp.r * 0.35));
      v += tp.amp * g * (0.7 + 0.3 * Math.sin(tSec * 0.02 * tp.w + i * 4.0));
    }
    return v;
  }

  /* ---------- 暗模式:拓扑泡沫白点 ---------- */
  var NDOTS = 1440;
  var dots = [];
  function buildDots() {
    dots.length = 0;
    for (var i = 0; i < NDOTS; i++) {
      dots.push({
        bx: hash(i * 1.31), by: hash(i * 2.17),          /* 基准位置(屏幕比例) */
        ph: hash(i * 3.7) * Math.PI * 2,                  /* 相位 θ */
        om: 0.15 + hash(i * 5.9) * 0.35,                  /* 固有频率 rad/s */
        sz: 0.5 + hash(i * 7.1) * 1.1,                    /* 半径 px(小而多) */
        bob: 5 + hash(i * 9.1) * 14,                      /* 涨落幅度 px */
        bw: 0.10 + hash(i * 11.3) * 0.25,                 /* 涨落频率 */
        drift: 2 + hash(i * 13.1) * 9,                    /* 缓慢自漂移幅度 px */
        dw: 0.02 + hash(i * 15.7) * 0.06,                 /* 自漂移频率 */
        dp: hash(i * 17.3) * Math.PI * 2                  /* 自漂移相位 */
      });
    }
  }

  /* ---------- 暗模式:成核事件(漩涡 → 黑盘) ---------- */
  var core = { active: false, t0: 0, x: 0.5, y: 0.5, next: 8000, phase: 0 };
  function coreSpawn(now) {
    core.active = true;
    core.t0 = now;
    /* 避开中央(内容区):在边环带里取点 */
    var a = hash(now * 0.001) * Math.PI * 2;
    var rr = 0.36 + hash(now * 0.002) * 0.14;
    core.x = 0.5 + Math.cos(a) * rr;
    core.y = 0.5 + Math.sin(a) * rr * 0.9;
  }
  /* 生命周期:旋进 4s → 停留 6s(黑盘缓慢扩) → 回填 8s → 冷却 */
  function coreDraw(g, now) {
    if (!core.active) return;
    var t = now - core.t0;
    var SWIRL = 4000, HOLD = 6000, FILL = 8000, COOL = 26000;
    var cx = core.x * W, cy = core.y * H;
    var R = Math.min(W, H) * 0.11;
    if (t < SWIRL) {
      /* 旋进:粒子群螺旋向心(三层:外圈宽疏→内圈细密→核心),
         盘从 0 长出 —— "圆形粒子向中心漩涡移动消失" */
      var k = t / SWIRL;
      g.save();
      /* 三层粒子:外 20 / 中 14 / 核 10,内层转得快(角速度守恒) */
      var LAYERS = [
        { n: 20, r0: 2.4, spin: 2.2, sz: 1.1, al: 0.09 },
        { n: 14, r0: 1.7, spin: 3.0, sz: 0.9, al: 0.12 },
        { n: 10, r0: 1.15, spin: 4.0, sz: 0.8, al: 0.16 }
      ];
      for (var li = 0; li < LAYERS.length; li++) {
        var Ly = LAYERS[li];
        for (var i = 0; i < Ly.n; i++) {
          var base = hash((i + li * 37) * 13.7) * Math.PI * 2;
          var spin = base + k * Ly.spin * (1 + hash(i * 3.1) * 0.35);
          var rad = R * Ly.r0 * (1 - k) * (0.75 + hash((i + li * 11) * 5.3) * 0.5);
          if (rad < 1.5) continue;                        /* 已落入核心,消失 */
          var px = cx + Math.cos(spin) * rad, py = cy + Math.sin(spin) * rad * 0.85;
          g.globalAlpha = Ly.al * (0.5 + 0.5 * k);
          g.fillStyle = "#dfeeff";
          g.beginPath();
          g.arc(px, py, Ly.sz * (0.8 + hash(i * 7.9) * 0.6), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      /* 黑盘淡入 */
      g.save();
      g.globalAlpha = k * 0.85;
      g.fillStyle = "#000";
      g.beginPath(); g.arc(cx, cy, R * k, 0, Math.PI * 2); g.fill();
      g.restore();
    } else if (t < SWIRL + HOLD) {
      /* 黑盘驻留,极缓慢扩张;盘缘一圈密度略增(荷被挤到边界);
         边缘持续有少量粒子沿切向滑落进盘里(真空还在吞) */
      var k2 = (t - SWIRL) / HOLD;
      var rr2 = R * (1 + k2 * 0.18);
      g.save();
      g.globalAlpha = 0.88;
      g.fillStyle = "#000";
      g.beginPath(); g.arc(cx, cy, rr2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(223, 238, 255, 0.10)";
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(cx, cy, rr2 + 3, 0, Math.PI * 2); g.stroke();
      /* 边缘吞咽粒子:沿盘缘切向移动并逐渐贴近盘缘、隐没 */
      var nEat = 8;
      for (var e2 = 0; e2 < nEat; e2++) {
        var ePh = hash(e2 * 17.3) * Math.PI * 2 + t * 0.0011 * (1 + e2 * 0.13);
        var eR = rr2 * (1.14 - ((t * 0.00013 + hash(e2 * 5.1)) % 1) * 0.14);
        g.globalAlpha = 0.12;
        g.fillStyle = "#dfeeff";
        g.beginPath();
        g.arc(cx + Math.cos(ePh) * eR, cy + Math.sin(ePh) * eR * 0.88, 0.9, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    } else if (t < SWIRL + HOLD + FILL) {
      /* 回填:黑盘被密度场漫回来(乱流回填),透明度降回 0 */
      var k3 = (t - SWIRL - HOLD) / FILL;
      g.save();
      g.globalAlpha = 0.88 * (1 - k3 * k3);
      g.fillStyle = "#000";
      g.beginPath(); g.arc(cx, cy, R * 1.18, 0, Math.PI * 2); g.fill();
      g.restore();
    } else {
      core.active = false;
      core.next = now + 32000 + hash(now * 0.003) * 40000;   /* 32~72s 后下一次 */
    }
  }

  /* ---------- 暗模式:洋流(共识流) ----------
     不是一条线,是【多股带状流】:3 股流,每股是一根缓慢变形的"河道中心线"
     (多正弦叠加,分量相位速度本身也被慢波调制 → 路径长期不重复),
     沿河道撒 1440 个点,横向高斯散布;每股内拆 7 条流丝(独立相位/微摆),
     带的内部有翻涌结构。点很小(0.4~1.1px)但数量多 → 流动的雾带。 */
  var CURRENTS = [
    { y0: 0.26, amp: [0.10, 0.045, 0.02], speed: 0.030, n: 420, width: 0.055, dir: 1,  drift: 0.9 },
    { y0: 0.63, amp: [0.13, 0.060, 0.03], speed: 0.022, n: 620, width: 0.075, dir: 1,  drift: -0.7 },
    { y0: 0.88, amp: [0.07, 0.035, 0.05], speed: 0.041, n: 400, width: 0.045, dir: -1, drift: 1.3 }
  ];
  var STRANDS = 7;                       /* 每股内的流丝数 */
  /* 河道中心线:s 处(0..1)的 y。多正弦叠加 + 相位速度被慢波调制 → 多变 */
  function currentY(c, s, tSec, strand) {
    var st = strand || 0;
    var mod = Math.sin(tSec * 0.013 + st * 0.9) * 0.5 + 0.5;   /* 慢波调制 0..1 */
    var y = c.y0
      + Math.sin(s * 2.2 + tSec * c.speed * (0.8 + mod * 0.5) + 0.7 + st * 0.35) * c.amp[0]
      + Math.sin(s * 5.1 - tSec * c.speed * (1.2 + mod * 0.9) + 2.1 + st * 0.8) * c.amp[1]
      + Math.sin(s * 9.7 + tSec * c.speed * (2.0 + mod * 1.4) + 4.0 + st * 1.3) * c.amp[2];
    /* 流丝自身的微摆(细结构,不改变河道大势) */
    if (st > 0) y += Math.sin(s * 14 + tSec * 0.09 + st * 2.4) * 0.006;
    /* 整条河缓慢上下漂移(周期 ~90s) */
    y += Math.sin(tSec * 0.07 * c.drift + c.y0 * 9.0) * 0.05;
    return y;
  }
  /* 每个流点:固定 seed(股/序号),沿流向以微小速度差移动 → 带内有剪流感 */
  var flowDots = [];
  function buildFlow() {
    flowDots.length = 0;
    var k = 0;
    for (var ci = 0; ci < CURRENTS.length; ci++) {
      var c = CURRENTS[ci];
      for (var i = 0; i < c.n; i++) {
        flowDots.push({
          ci: ci,
          off: (i / c.n + hash(k * 1.7) * (1 / c.n)) % 1,      /* 沿河道的固有相位 */
          strand: (hash(k * 2.9) * STRANDS) | 0,                /* 属于哪条流丝 */
          lat: (hash(k * 2.3) + hash(k * 3.1) - 1) * 0.5,      /* 横向高斯散布 [-0.5,0.5] */
          sz: 0.4 + hash(k * 4.3) * 0.7,
          vj: 0.85 + hash(k * 5.9) * 0.3,                      /* 速度差(剪流) */
          tw: hash(k * 7.7) * Math.PI * 2,                     /* 闪烁相位 */
          k: k
        });
        k++;
      }
    }
  }

  /* ---------- 亮模式:驻波网络(膜本征模 + 溃散) ---------- */
  /* 矩形膜前 5 个本征模 (m,n),节点线 = sin(mπx)sin(nπy) 的零点。
     振幅互质频率呼吸;整体对比度带慢衰减(抑制场在撑)。 */
  var MODES = [
    { m: 1, n: 2, w: 0.21, ph: 0.0 },
    { m: 2, n: 1, w: 0.16, ph: 1.9 },
    { m: 2, n: 3, w: 0.12, ph: 3.7 },
    { m: 3, n: 2, w: 0.10, ph: 5.1 },
    { m: 1, n: 1, w: 0.27, ph: 2.6 }
  ];
  function psi(nx, ny, tSec, decay) {
    var v = 0;
    for (var i = 0; i < MODES.length; i++) {
      var md = MODES[i];
      var A = 0.7 + 0.3 * Math.sin(tSec * md.w * Math.PI * 2 * 0.37 + md.ph);
      v += A * Math.sin(md.m * Math.PI * nx) * Math.sin(md.n * Math.PI * ny);
    }
    return v * decay;
  }

  /* 亮模式事件:波包(孤立高包络路过,同时最多一个) + 观测注记层 */
  var packet = { active: false, t0: 0, dur: 8, wi: 0, next: 12 };
  var waveNotes = [];

  /* 节点线采样:对每个 (m,n) 模取其竖直/水平节点线的参数化采样 */
  var NODE_LINES = [];
  function buildNodeLines() {
    NODE_LINES.length = 0;
    MODES.forEach(function (md, mi) {
      /* 竖直节点:x = k/m (k=1..m-1) 沿 y 全长;水平同理 */
      for (var k = 1; k < md.m; k++) {
        NODE_LINES.push({ mi: mi, kind: "v", pos: k / md.m, seed: mi * 31 + k * 7 });
      }
      for (var k2 = 1; k2 < md.n; k2++) {
        NODE_LINES.push({ mi: mi, kind: "h", pos: k2 / md.n, seed: mi * 47 + k2 * 11 });
      }
    });
  }

  function drawBreak(g, br, now, decay) {
    var ln = NODE_LINES[br.line % NODE_LINES.length];
    if (!ln) return;
    var t = (now - br.t0) / br.life;              /* 0..1 */
    if (t < 0 || t > 1) return;
    /* 强度:中段最弱(断开),两端衰减 */
    var depth = Math.sin(Math.PI * t);            /* 0→1→0 */
    var segN = 90;
    var gapC = br.u, gapW = 0.05 + depth * 0.05;  /* 断口中心/半宽 */
    g.save();
    g.strokeStyle = "rgba(96, 104, 118, " + (0.12 * decay).toFixed(3) + ")";
    g.lineWidth = 1;
    g.beginPath();
    for (var i = 0; i <= segN; i++) {
      var s = i / segN;
      var dd = Math.abs(s - gapC);
      if (dd < gapW) continue;                    /* 断口不画 */
      var wob = (1 - depth * 0.8) * 0;            /* 断口边缘微移 */
      var px, py;
      if (ln.kind === "v") { px = ln.pos * W + wob; py = s * H; }
      else { px = s * W; py = ln.pos * H + wob; }
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
    /* 断口边缘微亮(能量漏出):奶白底上是暖赭色 */
    g.strokeStyle = "rgba(178, 128, 84, " + (0.12 * depth * decay).toFixed(3) + ")";
    g.lineWidth = 1.4;
    var e1 = clamp(gapC - gapW, 0, 1), e2 = clamp(gapC + gapW, 0, 1);
    g.beginPath();
    if (ln.kind === "v") {
      g.moveTo(ln.pos * W, e1 * H); g.lineTo(ln.pos * W, (e1 - 0.04) * H);
      g.moveTo(ln.pos * W, e2 * H); g.lineTo(ln.pos * W, (e2 + 0.04) * H);
    } else {
      g.moveTo(e1 * W, ln.pos * H); g.lineTo((e1 - 0.04) * W, ln.pos * H);
      g.moveTo(e2 * W, ln.pos * H); g.lineTo((e2 + 0.04) * W, ln.pos * H);
    }
    g.stroke();
    g.restore();
  }

  function drawPatch(g, now) {
    if (!patch.active) return;
    var t = (now - patch.t0) / 3500;              /* 0..1 失相,1..1.6 平复 */
    if (t < 0) return;
    if (t > 1.6) { patch.active = false; patch.next = now + 45000 + hash(now * 0.005) * 30000; return; }
    /* 强度:3.5s 起伏(sin),之后 0.6 个周期线性松掉(原来 sin(PI)=0,平复段等于消失) */
    var strength = t < 1 ? Math.sin(Math.PI * t) : Math.max(0, 1 - (t - 1) / 0.6);
    strength = clamp(strength, 0, 1) * 0.10;
    var px = patch.x * W, py = patch.y * H, pr = Math.min(W, H) * 0.14;
    /* 失相区:径向错位重绘网纹 —— 把该区域内的 psi 采样偏移一个随半径衰减的量 */
    g.save();
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.clip();
    g.globalAlpha = strength;
    /* 重画该区的等相位线,相位被"顶"了一个偏移 */
    var step = Math.max(14, Math.round(pr / 5));
    for (var yy = py - pr; yy <= py + pr; yy += step) {
      g.beginPath();
      for (var xx = px - pr; xx <= px + pr; xx += 6) {
        var nx = xx / W, ny = yy / H;
        var v = psi(nx, ny, now / 1000 + strength * 6, 1);
        var off = v * step * 0.6;
        if (xx === px - pr) g.moveTo(xx, yy + off); else g.lineTo(xx, yy + off);
      }
      g.strokeStyle = "rgba(96, 104, 118, 0.5)";
      g.lineWidth = 0.8;
      g.stroke();
    }
    g.restore();
  }

  /* ---------- 主渲染 ---------- */
  var frameT = 0, lastT = 0, running = false;
  var FPS_BG = 30;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = W + "px";
    cv.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildDots();
    buildFlow();
    buildNodeLines();
  }

  function isDark() {
    var t = docEl.dataset.theme;
    if (t === "light") return false;
    if (t === "dark") return true;
    /* auto / 未设:跟系统 */
    try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return true; }
  }
  function isHome() { return document.body.classList.contains("home-page") || document.body.classList.contains("intro-page"); }

  function render(now) {
    if (!running) return;
    if (now - lastT < 1000 / FPS_BG) { requestAnimationFrame(render); return; }
    var dt = Math.min(100, now - lastT);
    lastT = now;
    frameT = now;

    var dark = isDark();
    var tS = now / 1000;
    ctx.clearRect(0, 0, W, H);

    if (dark) {
      /* ============ 新真空:缺陷海密度场 ============ */
      /* 底:纯黑 */
      ctx.fillStyle = "#020409";
      ctx.fillRect(0, 0, W, H);

      /* 等高线:2~4 条 |∇φ|² 等值线(marching squares),加粗到可辨 */
      var LEVELS = [0.16, 0.30, 0.44];
      var cells = 34;
      var cw = W / cells, ch = H / Math.max(10, Math.round(cells * H / W));
      ctx.save();
      ctx.strokeStyle = "rgba(190, 220, 255, 0.14)";
      ctx.lineWidth = 1.8;
      for (var li = 0; li < LEVELS.length; li++) {
        var lv = LEVELS[li];
        ctx.beginPath();
        for (var cy = 0; cy < H; cy += ch) {
          for (var cx = 0; cx < W; cx += cw) {
            var v00 = phi(cx / W, cy / H, tS) - lv;
            var v10 = phi((cx + cw) / W, cy / H, tS) - lv;
            var v01 = phi(cx / W, (cy + ch) / H, tS) - lv;
            var v11 = phi((cx + cw) / W, (cy + ch) / H, tS) - lv;
            /* 简易 marching squares:只画穿越线段 */
            var pts = [];
            if (v00 * v10 < 0) pts.push([cx + cw * (v00 / (v00 - v10)), cy]);
            if (v10 * v11 < 0) pts.push([cx + cw, cy + ch * (v10 / (v10 - v11))]);
            if (v01 * v11 < 0) pts.push([cx + cw * (v01 / (v01 - v11)), cy + ch]);
            if (v00 * v01 < 0) pts.push([cx, cy + ch * (v00 / (v00 - v01))]);
            if (pts.length >= 2) {
              ctx.moveTo(pts[0][0], pts[0][1]);
              ctx.lineTo(pts[1][0], pts[1][1]);
            }
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      /* 拓扑泡沫白点:亮度 = 相位余弦,位置随场涨落 + 自漂移 */
      ctx.save();
      for (var d = 0; d < dots.length; d++) {
        var dt0 = dots[d];
        var tw = 0.5 + 0.5 * Math.cos(dt0.ph + tS * dt0.om * Math.PI * 2 * 0.12);
        var px2 = (dt0.bx + 0.008 * Math.sin(tS * dt0.bw + d) + 0.004 * Math.sin(tS * dt0.dw + dt0.dp)) * W;
        var py2 = (dt0.by + 0.008 * Math.cos(tS * dt0.bw * 0.8 + d * 1.3) + 0.004 * Math.cos(tS * dt0.dw * 1.3 + dt0.dp * 1.7)) * H + Math.sin(tS * dt0.bw * Math.PI * 2 * 0.3 + dt0.ph) * dt0.bob * 0.5;
        /* 自由点不进洋流:离任一股【任一流丝】中心线近的压暗。
           ★ 上一版只对 strand=0 那条中心线避让 —— 洋流实际画了 7 条
             流丝,其余 6 条上自由点照旧出没(= 撞上)。现在对全部流丝取
             最小余量。 */
        var suppress = 1;
        for (var ci2 = 0; ci2 < CURRENTS.length; ci2++) {
          var stCount = 7;
          for (var st2 = 0; st2 < stCount; st2++) {
            var cy2 = currentY(CURRENTS[ci2], px2 / W, tS, st2);
            var halfW = CURRENTS[ci2].width * 0.55;          /* 单丝半宽 */
            var dBand = Math.abs(py2 / H - cy2);
            if (dBand < halfW) {
              suppress = Math.min(suppress, Math.max(0, dBand / halfW));
            }
          }
        }
        var a = (0.07 + 0.38 * tw * tw) * suppress;       /* ≤0.45 */
        ctx.globalAlpha = a;
        ctx.fillStyle = "#e8f2ff";
        ctx.beginPath();
        ctx.arc(px2, py2, dt0.sz * (0.8 + 0.4 * tw), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      /* 洋流(共识流):3 股河道、480 个小点,沿河道流、横向散布、
         河道本身随时间弯曲摆动漂移 */
      ctx.save();
      for (var f = 0; f < flowDots.length; f++) {
        var fd = flowDots[f];
        var c3 = CURRENTS[fd.ci];
        var s = (fd.off + tS * 0.018 * fd.vj * c3.dir) % 1;
        if (s < 0) s += 1;
        var cyc = fd.off + (tS * 0.018 * fd.vj) % 1;      /* 用于闪烁 */
        var cxp = s * W;
        var cyp = currentY(c3, s, tS, fd.strand) * H + fd.lat * c3.width * H;
        var fa = 0.18 + 0.26 * (0.5 + 0.5 * Math.sin(tS * 1.1 + fd.tw));
        /* 内容页避开中央阅读区 */
        var dCtr3 = Math.hypot(cxp - W * 0.5, cyp - H * 0.5) / Math.min(W, H);
        if (!isHome() && dCtr3 < 0.30) fa *= 0.35;
        ctx.globalAlpha = fa;
        ctx.fillStyle = "#dcecff";
        ctx.beginPath();
        ctx.arc(cxp, cyp, fd.sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      /* 成核事件 */
      if (!core.active && now > core.next) coreSpawn(now);
      coreDraw(ctx, now);

      /* 中央阅读遮罩(内容页):把背景再压暗一点 */
      if (!isHome()) {
        var mg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.22, W / 2, H * 0.5, Math.max(W, H) * 0.52);
        mg.addColorStop(0, "rgba(2, 4, 9, 0.55)");
        mg.addColorStop(1, "rgba(2, 4, 9, 0)");
        ctx.fillStyle = mg;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      /* ============ 亮模式:波(载体) ============
         画成【看得出的正弦波】:真正的波形线(正弦曲线描出来),
         几列波横过屏幕,各自波长/振幅/速度,肉眼可辨地在传播。
         · 底:奶白
         · 4 列主波:清晰的正弦曲线线稿(深灰,1.5px,0.16),
           振幅 4~9% 屏高,波长 1/3~1/2 屏宽,整条波形向右行进
         · 每列波下方 2 道淡淡的余辉(前几个时刻的样子,扩散感)
         · 波峰上撒极小的亮点(波峰的"高光",不是暗模式那种密度点,
           是跟随波峰运动的少量高光,共 ~40 个)
         · 波包:20~40s 一次,某列上鼓起一个明显的峰包从左跑到右
         全部元素一眼读出"这是波"。 */
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, W, H);

      /* 4 列主波:基线 y、波长(屏宽)、振幅(屏高)、速度(周期 s)、相位。
         ★ 波向【左】传播(速度项取负:相位 +t·w → 峰向 -x 移动);
           色散也反 ---------------------------- 方向:崩溃在【前沿 = 左侧】,
           右侧是完整的波(源头),越靠左越撕裂 —— 前沿在崩。
         1) 逐点色散 —— 有效波数随【接近左缘】递增(短波在前沿堆积)。
         2) 振幅衰减 —— 每列波独立慢塌包络(40~90s),生死不同步。
         3) 谐波撕裂 —— 前沿区高频毛刺,越靠左越碎。 */
      var WAVES = [
        { y0: 0.22, k: 2.2, a: 0.055, w: 0.10, ph: 0.0, dec: 0.023, dph: 0.0 },
        { y0: 0.42, k: 1.6, a: 0.080, w: 0.07, ph: 2.1, dec: 0.016, dph: 2.4 },
        { y0: 0.63, k: 2.8, a: 0.045, w: 0.13, ph: 4.2, dec: 0.030, dph: 4.1 },
        { y0: 0.82, k: 1.9, a: 0.070, w: 0.08, ph: 5.5, dec: 0.019, dph: 1.3 }
      ];
      /* 逐点色散:离左缘越近波数越大(前沿堆积短波);dis = 1- 的位置权重 */
      function dispK(wv, nx) {
        return wv.k * (1 + 0.35 * clamp(1 - nx, 0, 1));
      }
      function waveYs(wv, nx, tSec) {
        var kk = dispK(wv, nx);
        /* 波向左传:相位 +t·w·2π(峰随时间向 -x 移动) */
        var y = Math.sin(nx * kk * Math.PI * 2 + tSec * wv.w * Math.PI * 2 + wv.ph) * H * wv.a;
        /* 谐波撕裂:前沿(左)高频毛刺,只在 x<0.45 处起 */
        if (nx < 0.45) {
          var tear = (0.45 - nx) / 0.45;
          y += Math.sin(nx * wv.k * 5.7 * Math.PI * 2 - tSec * wv.w * 3.1 * Math.PI * 2) * H * wv.a * 0.16 * tear;
        }
        /* 振幅包络:慢塌慢起(0.25..1) */
        var env = 0.625 + 0.375 * Math.sin(tSec * wv.dec * Math.PI * 2 + wv.dph);
        return H * wv.y0 + y * env;
      }
      /* 主波形线稿 + 余辉 */
      for (var wvi = 0; wvi < WAVES.length; wvi++) {
        var wv = WAVES[wvi];
        /* 余辉 2 道(0.5s / 1.1s 前的波形,更淡) */
        for (var gh = 2; gh >= 1; gh--) {
          ctx.save();
          ctx.strokeStyle = "rgba(110, 104, 88, " + (0.05 * (3 - gh) / 2).toFixed(3) + ")";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (var gx = 0; gx <= W; gx += 8) {
            var gy = waveYs(wv, gx / W, tS - gh * 0.55);
            if (gx === 0) ctx.moveTo(gx, gy); else ctx.lineTo(gx, gy);
          }
          ctx.stroke();
          ctx.restore();
        }
        /* 主线 */
        ctx.save();
        ctx.strokeStyle = "rgba(96, 92, 78, 0.16)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var wx = 0; wx <= W; wx += 6) {
          var wy = waveYs(wv, wx / W, tS);
          if (wx === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.restore();
        /* 波峰高光点:只标主频段(x<0.5)的波峰,随峰移动;色散区不标 */
        ctx.save();
        ctx.fillStyle = "rgba(150, 138, 110, 0.20)";
        var nPk = Math.round(wv.k);
        for (var pk = 0; pk < nPk; pk++) {
          var peakPh = -tS * wv.w * Math.PI * 2 - wv.ph + pk * Math.PI * 2;
          var peakX = (peakPh / (wv.k * Math.PI * 2)) * W;
          peakX = ((peakX % (W * 0.55)) + W * 0.55) % (W * 0.55);   /* 限制在未撕裂区 */
          var peakY = H * wv.y0 - H * wv.a;
          ctx.beginPath();
          ctx.arc(peakX, peakY, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      /* 波包:某列上鼓起一个明显峰包,从右向左跑(波向左传) */
      if (packet.active) {
        var pt = (tS - packet.t0) / packet.dur;
        if (pt > 1) { packet.active = false; packet.next = tS + 20 + hash(tS * 7) * 20; }
        else {
          var pw = WAVES[packet.wi % WAVES.length];
          var pPos = 1 - pt;                              /* 1..0:从右向左 */
          var pEnv = Math.sin(Math.PI * pt);              /* 鼓起→收平 */
          var pkX2 = pPos * W;
          var pkY2 = H * pw.y0 - H * pw.a * 2.2 * pEnv;
          ctx.save();
          /* 波包轮廓:一小段高起的弧 */
          ctx.strokeStyle = "rgba(96, 92, 78, " + (0.22 * pEnv).toFixed(3) + ")";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (var dx4 = -0.09; dx4 <= 0.09; dx4 += 0.01) {
            var lx = pkX2 + dx4 * W;
            var ly = waveYs(pw, lx / W, tS) - H * pw.a * 2.2 * pEnv * Math.cos((dx4 / 0.09) * Math.PI / 2);
            if (dx4 === -0.09) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
          }
          ctx.stroke();
          /* 波包内的高光 */
          ctx.fillStyle = "rgba(150, 138, 110, " + (0.30 * pEnv).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(pkX2, pkY2, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      if (!packet.active && tS > packet.next) {
        packet.active = true;
        packet.t0 = tS;
        packet.dur = 7 + hash(tS * 3) * 5;
        packet.wi = (hash(tS * 5) * WAVES.length) | 0;
      }

      /* 研究视角的文字层:观测注记【锚在波列上实时演算】——
         每条注记绑定一列波,横向位置固定、纵向贴着该列波的波形走
         (标注就在被标注的波上),随波起伏;透明度 0.14~0.20,
         中央区(内容页)由奶白轻压自然变淡。 */
      if (!waveNotes.length) {
        var NOTE_POOL = [
          "λ = 0.42 m", "v_phase = 0.61c", "∇·φ ≠ 0", "amp ↓ 12.4%",
          "k² → ω²/c²", "nodes: 7", "f = 41.7 Hz", "包络塌陷中",
          "Δφ = 0.31 rad", "前沿 x = 0.08", "色散区续宽", "谱宽 +3.2%",
          "波腹 m=2", "反射系数 ≈ 0", "损耗 0.9%/周期", "驻点消失",
          "E↓ 渐近", "相干长度 −", "谐波 h3 = 0.16", "边界层湮灭"
        ];
        for (var wn = 0; wn < 16; wn++) {
          waveNotes.push({
            txt: NOTE_POOL[wn % NOTE_POOL.length],
            wi: wn % WAVES.length,                       /* 绑定哪列波 */
            nx: 0.08 + hash(wn * 3.3) * 0.84,            /* 在波上的横向位置 */
            lift: -1 + hash(wn * 5.1) * 2,               /* 相对波面的上下偏移 */
            a: 0.14 + hash(wn * 7.7) * 0.06,
            blink: hash(wn * 9.1) * Math.PI * 2,
            rot: (hash(wn * 11.3) - 0.5) * 0.06
          });
        }
      }
      ctx.save();
      var nfs = Math.max(10, Math.round(Math.min(W, H) * 0.016));
      ctx.font = nfs + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
      for (var wn2 = 0; wn2 < waveNotes.length; wn2++) {
        var wnn = waveNotes[wn2];
        var na = wnn.a * (0.75 + 0.25 * Math.sin(tS * 0.11 + wnn.blink));
        /* 纵向实时贴波:取该列波在此 x 的瞬时 y,再按 lift 偏移半行 */
        var waveHere = waveYs(WAVES[wnn.wi], wnn.nx, tS);
        ctx.save();
        ctx.translate(wnn.nx * W, waveHere + wnn.lift * nfs * 0.9);
        ctx.rotate(wnn.rot);
        ctx.globalAlpha = na;
        ctx.fillStyle = "#5d584a";
        ctx.fillText(wnn.txt, 0, 0);
        ctx.restore();
      }
      ctx.restore();

      /* 中央阅读区轻压(内容页):主波透明度本来低,这里再保一层 */
      if (!isHome()) {
        var mg2 = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.55);
        mg2.addColorStop(0, "rgba(244, 241, 233, 0.45)");
        mg2.addColorStop(1, "rgba(244, 241, 233, 0)");
        ctx.fillStyle = mg2;
        ctx.fillRect(0, 0, W, H);
      }
    }

    requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = performance.now() - 100;   /* 首帧立刻画,不等 33ms 节流窗 */
    if (reduced) {
      /* reduced-motion:画一帧凝固的,不循环 */
      var now0 = performance.now();
      frameT = now0;
      renderStatic(now0);
      running = false;
      return;
    }
    requestAnimationFrame(render);
  }

  /* 凝固帧(reduced-motion 用):同一条渲染路径,只画一次 */
  function renderStatic(now) {
    var dark = isDark();
    var tS = now / 1000;
    ctx.clearRect(0, 0, W, H);
    if (dark) {
      ctx.fillStyle = "#020409";
      ctx.fillRect(0, 0, W, H);
      for (var d = 0; d < dots.length; d++) {
        var dt0 = dots[d];
        var tw = 0.5 + 0.5 * Math.cos(dt0.ph);
        ctx.globalAlpha = 0.04 + 0.26 * tw * tw;
        ctx.fillStyle = "#e8f2ff";
        ctx.beginPath();
        ctx.arc(dt0.bx * W, dt0.by * H, dt0.sz, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      /* 波(载体)的凝固帧:4 列静止正弦线稿 */
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, W, H);
      var WAVES0 = [
        { y0: 0.22, k: 2.2, a: 0.055, ph: 0.0 },
        { y0: 0.42, k: 1.6, a: 0.080, ph: 2.1 },
        { y0: 0.63, k: 2.8, a: 0.045, ph: 4.2 },
        { y0: 0.82, k: 1.9, a: 0.070, ph: 5.5 }
      ];
      for (var wv0 = 0; wv0 < WAVES0.length; wv0++) {
        var w0 = WAVES0[wv0];
        ctx.strokeStyle = "rgba(96, 92, 78, 0.13)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var gx0 = 0; gx0 <= W; gx0 += 6) {
          var gy0 = H * w0.y0 + Math.sin(gx0 / W * w0.k * Math.PI * 2 + w0.ph) * H * w0.a;
          if (gx0 === 0) ctx.moveTo(gx0, gy0); else ctx.lineTo(gx0, gy0);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* 主题切换时立即生效( observing data-theme ) */
  if (window.MutationObserver) {
    new MutationObserver(function () { }).observe(docEl, { attributes: true, attributeFilter: ["data-theme"] });
  }

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      resize();
      if (reduced && !running) { renderStatic(performance.now()); }
    }, 160);
  });

  resize();
  start();
})();
