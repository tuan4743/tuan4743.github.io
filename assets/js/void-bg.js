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

  /* ---------- 性能基建(离屏预渲染) ----------
   * ★ glow sprite:炫光=一张预渲染的高斯光晕贴图,drawImage 贴,
   *   替代逐点 shadowBlur(shadowBlur 是 canvas 最贵的操作之一,
   *   480 点 × 每帧 = 灾难;drawImage 贴图几乎免费)。
   *   光晕"变大变亮"= 贴图尺寸/透明度随 glow 插值 —— 视觉等价。
   * ★ noise sprite:噪点也是一张预渲染的 pattern,整屏一次 drawImage,
   *   替代每帧 140 个 fillRect + hash。
   * ★ DPR 上限:1(背景是模糊雾带,DPR>1 的成本全在像素填充,
   *   视觉上几乎无差 —— 高分屏最大头)。 */
  var DPR_CAP = 1;
  var glowSprite = document.createElement("canvas");
  function buildGlowSprite() {
    var S = 128;                                 /* 贴图边长(px,画时缩放) */
    glowSprite.width = S; glowSprite.height = S;
    var g = glowSprite.getContext("2d");
    var grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, "rgba(242, 249, 255, 1)");
    grad.addColorStop(0.25, "rgba(190, 232, 255, 0.55)");
    grad.addColorStop(0.6, "rgba(150, 215, 255, 0.16)");
    grad.addColorStop(1, "rgba(150, 215, 255, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  buildGlowSprite();
  /* 噪点:两帧交替的半透明纹理(128×128,随机白点),画时随机平移 */
  var noiseSprite = document.createElement("canvas");
  function buildNoiseSprite() {
    var S = 160;
    noiseSprite.width = S; noiseSprite.height = S;
    var g = noiseSprite.getContext("2d");
    for (var i = 0; i < 240; i++) {
      g.globalAlpha = 0.10 + hash(i * 3.7) * 0.30;
      g.fillStyle = "#cfe4f4";
      g.fillRect(hash(i * 1.3) * S, hash(i * 2.9) * S, hash(i * 5.1) > 0.85 ? 2.2 : 1, 1);
    }
  }
  buildNoiseSprite();

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
      /* ★ 位移尺度:曾经 ×60 —— 漂移半径 ±0.6 屏宽,势阱会整个漂出屏幕,
         等值线(等高线)随之长时间消失(实测 0.44 档 24h 内 30% 时间整条蒸发)。
         ×12 把漂移压在 ±0.12 屏宽以内,势阱永远留在画面里。 */
      var tx = tp.x + Math.sin(tSec * 0.011 * tp.w + i * 2.1) * tp.dx * 12;
      var ty = tp.y + Math.cos(tSec * 0.009 * tp.w + i * 1.7) * tp.dy * 12;
      var dx = nx - tx, dy = ny - ty;
      var g = Math.exp(-(dx * dx + dy * dy) / (tp.r * tp.r * 0.35));
      /* ★ 呼吸下限 0.7 → 0.85:呼吸过深时三阱同时塌到低幅,phi 峰值
         跌破 0.44 档,最高那条等值线也会短暂消失。 */
      v += tp.amp * g * (0.85 + 0.15 * Math.sin(tSec * 0.02 * tp.w + i * 4.0));
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
    /* 整条河缓慢上下漂移(周期 ~90s)。
       ★ 漂移曾是 ×0.05(±3.6% 屏高)—— 太大:河道会被推出原本的 y0 带,
         视觉上"波动幅度随时间变大"。压到 ×0.02(±1.4% 屏高),
         只保留"活着"的缓沉浮,不改变带的位置。 */
    y += Math.sin(tSec * 0.07 * c.drift + c.y0 * 9.0) * 0.02;
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
  var nfs2 = 0;

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

  /* ---------- 暗模式:共流过境(手动触发) ----------
     两段周期:surge.p ∈ [0,1] 是触发条水位(前期),由 hud-surge.js
     推进;p 到 1 进入爆发段 surge.q ∈ [0,1](独立计时,不可逆,
     唯一出口是光带覆屏 → 页面重载)。
     前期(p,0..0.75 区间有效):
       · 洋流粒子变亮(不变大)、流速加快;快到极限时单个点拖成线
       · 画面四周往中心渐暗(环形暗角内收),整体轻微降透明度
       · 末段(p>0.6)屏幕出现噪点
     爆发期(q):
       · 页面震动 + 模糊;粒子真发光(shadowBlur 叠加),光晕变粗
         最终整条洋流连成光带
       · 光带里长出裂纹(枝干状,底层粗,同时最多 4 条),扩散
       · q 末段:光带突然变宽覆盖全屏 → 白 → 重载 */
  var surge = { p: 0, rate: 0, q: 0, qStart: 0, armed: false, reloaded: false, reloadCb: null, target: 0 };

  /* 前期强度:0..1 —— ★ 带 ease-in 曲线(拖尾加速感):
     c = p²(3-2p)? 不够陡 —— 用 c = p^1.8,前段慢(酝酿)后段陡
     (冲刺),条快满时速度已经在往爆发级冲,到顶瞬间和 q 的
     增量项 [q*3] 无缝咬合(爆发起步 = 前期终点,不再跳变)。
     ★ 配套:爆发期的速度增量从 ×6 压到 ×3 —— 前期终点速度已经
       拉到位,爆发期只负责"继续推",不负责"从零再加速"。 */
  function surgeCharge(p) { var c = clamp(p, 0, 1); return c * c * (3 - 2 * c) * 0.35 + Math.pow(c, 1.8) * 0.65; }

  /* 爆发期子相位(全部基于 q,0.11/s ≈ 9s 总长):
     震动 0..0.45 渐强;炫光 0..0.45;覆屏白幕 0.88..1.0 */

  /* ---------- 主渲染 ---------- */
  var frameT = 0, lastT = 0, running = false;
  var FPS_BG = 30;
  var phiGridArr = null, phiGridW = 0, phiGridH = 0;   /* φ 网格缓存(marching squares 共用) */

  function resize() {
    DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1);
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

    /* 共流过境:水位推进(前期)。
       ★ chase 模式:单击只设目标 surge.target,水位 p 每帧向目标
         平滑追赶 —— 时间加速感:差距大时追得快(指数收敛),
         接近后缓缓泊入,阶段之间连续无跳变。追到 1 才武装爆发。 */
    if (surge.q === 0) {
      if (surge.rate) {
        /* 兜底速率推进(hold/release 路径,阶段条不用) */
        surge.p = clamp(surge.p + surge.rate * dt / 1000, 0, 1);
        if (surge.p <= 0) surge.rate = 0;
      }
      /* chase:指数趋近(每帧收窄剩余距离的 ~45%,帧率无关) */
      var tgt = clamp(surge.target || 0, 0, 1);
      if (tgt > surge.p) {
        surge.p += (tgt - surge.p) * (1 - Math.exp(-dt / 1000 * 3.4));
        if (tgt - surge.p < 0.004) surge.p = tgt;      /* 泊入 */
      } else if (tgt < surge.p) {
        surge.p -= (surge.p - tgt) * (1 - Math.exp(-dt / 1000 * 2.2));  /* 回落慢些 */
        if (surge.p - tgt < 0.004) surge.p = tgt;
      }
      if (surge.p >= 1 && !surge.armed) {
        surge.armed = true;
        surge.q = 0.0001;
        surge.qStart = 0;
      }
    }
    /* 爆发段推进:0.11/s ≈ 9s 走完(用户:爆发期不要这么快) */
    if (surge.q > 0) {
      if (!surge.qStart) surge.qStart = tS;
      surge.q = clamp(surge.q + 0.11 * dt / 1000, 0, 1);
      if (surge.p < 1) surge.p = 1;
    }
    var charge = surgeCharge(surge.p);
    var q = surge.q;
    /* ★ 帧积分洋流位移:speed 随 charge/q 变化时,s = off + tS*speed
       会让 tS(全程)乘上全新速度 → 整条河瞬移、粒子"消失一段"。
       改为 surge.adv 每帧累加 speed*dt,速度再猛也平滑续接。
       ★ 极限速度 28 倍基速(charge=1 时 1+27;爆发期同式已含)。 */
    var flowSpeed = 0.018 * (1 + charge * 27 + q * 3.0);
    surge.adv = (surge.adv || 0) + flowSpeed * dt / 1000;

    /* ★ 自适应帧率:平时 30fps;演出激活(p>0 或 q>0)提到 60fps
       (演出细,需要跟手的帧间隔),平时掉回 30 —— rAF 本身是 60,
       这里只是节流窗。页面不可见时 rAF 自动暂停,不用管。 */
    FPS_BG = (charge > 0 || q > 0) ? 60 : 30;

    if (dark) {
      /* ============ 新真空:缺陷海密度场 ============ */
      /* 底:纯黑 */
      ctx.fillStyle = "#020409";
      ctx.fillRect(0, 0, W, H);

      /* 等高线:2~4 条 |∇φ|² 等值线(marching squares)。
         ★ 性能:φ 采样是全脚本最贵的循环(34×~20 网格 × 3 档 × 4 角)。
           改为【每帧只算一张 φ 网格】(各档共用),角点值查缓存 ——
           采样次数从 ~8160 → ~2040。 */
      var LEVELS = [0.16, 0.30, 0.44];
      var cells = 34;
      var cCols = cells + 1, cRows = Math.max(10, Math.round(cells * H / W)) + 1;
      var cw = W / (cCols - 1), ch = H / Math.max(10, cRows - 1);
      var phiGrid = phiGridArr || (phiGridArr = new Float32Array(cCols * cRows));
      if (phiGridW !== cCols || phiGridH !== cRows) { phiGridArr = phiGrid = new Float32Array(cCols * cRows); phiGridW = cCols; phiGridH = cRows; }
      var gi = 0;
      for (var gy = 0; gy < cRows; gy++) {
        var gny = gy * ch / H;
        for (var gx = 0; gx < cCols; gx++, gi++) {
          phiGrid[gi] = phi(gx * cw / W, gny, tS);
        }
      }
      ctx.save();
      ctx.strokeStyle = "rgba(190, 220, 255, 0.14)";
      ctx.lineWidth = 1.8;
      for (var li = 0; li < LEVELS.length; li++) {
        var lv = LEVELS[li];
        ctx.beginPath();
        for (var cy = 0; cy < cRows - 1; cy++) {
          for (var cx = 0; cx < cCols - 1; cx++) {
            var i00 = cy * cCols + cx;
            var v00 = phiGrid[i00] - lv;
            var v10 = phiGrid[i00 + 1] - lv;
            var v01 = phiGrid[i00 + cCols] - lv;
            var v11 = phiGrid[i00 + cCols + 1] - lv;
            if ((v00 > 0) === (v10 > 0) && (v10 > 0) === (v01 > 0) && (v01 > 0) === (v11 > 0)) continue;  /* 无穿越,跳过 */
            var px0 = cx * cw, py0 = cy * ch;
            var pts = [];
            if (v00 * v10 < 0) pts.push([px0 + cw * (v00 / (v00 - v10)), py0]);
            if (v10 * v11 < 0) pts.push([px0 + cw, py0 + ch * (v10 / (v10 - v11))]);
            if (v01 * v11 < 0) pts.push([px0 + cw * (v01 / (v01 - v11)), py0 + ch]);
            if (v00 * v01 < 0) pts.push([px0, py0 + ch * (v00 / (v00 - v01))]);
            if (pts.length >= 2) {
              ctx.moveTo(pts[0][0], pts[0][1]);
              ctx.lineTo(pts[1][0], pts[1][1]);
            }
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      /* 拓扑泡沫白点:亮度 = 相位余弦,位置随场涨落 + 自漂移。
         ★ 性能:避让的 currentY 每点 3 股 × 7 丝 = 21 次三角函数 ——
           预计算【每帧每股每丝在采样列上的 y】没用(点 x 各不同),
           改为快速预筛:点先按 y0±带宽粗判"可能进带"才细算 ——
           带外点(绝大多数)零三角函数。 */
      ctx.save();
      for (var d = 0; d < dots.length; d++) {
        var dt0 = dots[d];
        var tw = 0.5 + 0.5 * Math.cos(dt0.ph + tS * dt0.om * Math.PI * 2 * 0.12);
        var px2 = (dt0.bx + 0.008 * Math.sin(tS * dt0.bw + d) + 0.004 * Math.sin(tS * dt0.dw + dt0.dp)) * W;
        var py2 = (dt0.by + 0.008 * Math.cos(tS * dt0.bw * 0.8 + d * 1.3) + 0.004 * Math.cos(tS * dt0.dw * 1.3 + dt0.dp * 1.7)) * H + Math.sin(tS * dt0.bw * Math.PI * 2 * 0.3 + dt0.ph) * dt0.bob * 0.5;
        /* 快速预筛:ny 到任何河道 y0 的距离超过(amp 总和 + 漂移 + 半宽)就直接跳过 */
        var ny2 = py2 / H;
        var suppress = 1;
        for (var ci2 = 0; ci2 < CURRENTS.length; ci2++) {
          var cc0 = CURRENTS[ci2];
          var far = Math.abs(ny2 - cc0.y0) - (cc0.amp[0] + cc0.amp[1] + cc0.amp[2] + 0.022);
          if (far > cc0.width) continue;                 /* 带外,不可能碰河道 */
          for (var st2 = 0; st2 < 7; st2++) {
            var cy2 = currentY(cc0, px2 / W, tS, st2);
            var halfW = cc0.width * 0.55;                /* 单丝半宽 */
            var dBand = Math.abs(ny2 - cy2);
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
         河道本身随时间弯曲摆动漂移。
         ★ 过境前期(charge):流速乘 (1+charge*2.2);亮度抬升;
           charge>0.55 后单个点拖成短线(运动方向上,长度随 charge 长);
           爆发期(q):真发光 —— shadowBlur + 多层重绘,光晕随 q 变粗,
           q>0.35 光晕互相咬合连成光带。 */
      /* ★ 炫光强度:不再等爆发 —— 前期最后 25%(p>0.75,q=0)就开始
         从 0 爬到 0.5,爆发期再从 0.5 爬到 1 —— 两段之间连续无台阶。
         (charge 封顶后 p 继续走,glowPre 正好利用那段"临门"。) */
      var glowPre = q === 0 && surge.p > 0.75 ? (surge.p - 0.75) / 0.25 * 0.5 : 0;
      var glow = q > 0 ? 0.5 + Math.min(1, q / 0.40) * 0.5 : glowPre;
      ctx.save();
      for (var f = 0; f < flowDots.length; f++) {
        var fd = flowDots[f];
        var c3 = CURRENTS[fd.ci];
        /* ★ 速度:用帧积分 surge.adv(上面每帧累加),速度变化不跳相;
           前期顶速 28 倍基速(charge=1 → 1+27),爆发期在此之上再 +q*3 */
        var s = (fd.off + surge.adv * fd.vj * c3.dir) % 1;
        if (s < 0) s += 1;
        var cyc = fd.off + (surge.adv * fd.vj) % 1;       /* 用于闪烁 */
        var cxp = s * W;
        var cyp = currentY(c3, s, tS, fd.strand) * H + fd.lat * c3.width * H;
        var fa = 0.18 + 0.26 * (0.5 + 0.5 * Math.sin(tS * 1.1 + fd.tw));
        /* 内容页避开中央阅读区(爆发期取消避让:洪峰盖一切) */
        var dCtr3 = Math.hypot(cxp - W * 0.5, cyp - H * 0.5) / Math.min(W, H);
        if (!isHome() && dCtr3 < 0.30 && !q) fa *= 0.35;
        /* 前期增亮(不变大);爆发期按发光强度再抬 */
        fa = Math.min(1, fa + charge * 0.5 + glow * 0.55);
        ctx.globalAlpha = fa;
        /* ★ 炫光 = 预渲染光晕贴图(替代逐点 shadowBlur):
           核心点照常画,glow 起来后在其上贴 glowSprite,
           尺寸随 glow 膨胀(点本体不变大 —— 光晕大,核不变)。 */
        ctx.fillStyle = glow > 0.01 ? "#f2f9ff" : "#dcecff";
        /* 前期末段:点拖成线(沿运动方向);爆发期线更长 → 光带。
           ★ 贯穿全屏直线的根因:回退点跨过 x=0/1 屏幕边界时,
             pxp 会跳到屏幕另一端,两点直连 = 横贯线。
             处理:拖尾统一折线化(3 段),并检测跨边界 ——
             跨边界的点直接不画(那一帧少一截拖尾,看不出)。 */
        var streak = charge > 0.4 ? (charge - 0.4) / 0.6 : 0;   /* 更早开始拖尾,随条全程加深 */
        var streakLen = (streak * 34 + glow * 10) * fd.vj;   /* px */
        if (streakLen > 1.2) {
          var backS = (streakLen / W) * c3.dir;      /* s 空间回退量(带方向) */
          var m2s = ((s - backS * 0.33) % 1 + 1) % 1;
          var m1s = ((s - backS * 0.66) % 1 + 1) % 1;
          var sPrevW = ((s - backS) % 1 + 1) % 1;
          /* 跨屏边界检测:任一相邻采样点的 |Δs| 超过回退量一半即视为跨边界 */
          var jump = Math.abs(s - m2s) > Math.abs(backS) * 0.55 ||
                     Math.abs(m2s - m1s) > Math.abs(backS) * 0.55 ||
                     Math.abs(m1s - sPrevW) > Math.abs(backS) * 0.55;
          ctx.strokeStyle = glow > 0.01 ? "#f2f9ff" : "#dcecff";
          ctx.lineWidth = fd.sz * 2;
          ctx.lineCap = "round";
          if (!jump) {
            ctx.beginPath();
            ctx.moveTo(sPrevW * W, currentY(c3, sPrevW, tS, fd.strand) * H + fd.lat * c3.width * H);
            ctx.lineTo(m1s * W, currentY(c3, m1s, tS, fd.strand) * H + fd.lat * c3.width * H);
            ctx.lineTo(m2s * W, currentY(c3, m2s, tS, fd.strand) * H + fd.lat * c3.width * H);
            ctx.lineTo(cxp, cyp);
            ctx.stroke();
          }
        } else {
          ctx.beginPath();
          ctx.arc(cxp, cyp, fd.sz, 0, Math.PI * 2);
          ctx.fill();
        }
        /* 炫光外晕:预渲染贴图一次 drawImage(点循环末尾统一贴) */
        if (glow > 0.02) {
          var gr = (4 + 30 * glow) * (0.6 + 0.4 * fd.vj);
          ctx.globalAlpha = Math.min(1, fa) * Math.min(1, 0.35 + glow);
          ctx.drawImage(glowSprite, cxp - gr, cyp - gr, gr * 2, gr * 2);
        }
      }
      ctx.restore();

      /* (光带与裂纹已删:效果不真实,直接去掉。
         爆发期的视觉落点 = 炫光粒子 + 震动模糊 + 变暗 + 白幕。) */

      /* ===== 页面侧演出(微震/爆发震动/模糊/白幕/暗角罩)已上移到
         渲染分支外 —— 暗/亮共用同一套 --surge-* 驱动,不再重复。 */

      /* ===== 前期末段:噪点(charge > 0.6 起,渐密) =====
         ★ 预渲染噪点纹理整屏平铺两遍(随机相位),α 随 nk 涨 ——
           替代每帧 140 个 fillRect + 4 次 hash/点。 */
      if ((charge > 0.45 || q > 0) && q < 0.88) {
        var nk = q > 0 ? 1 : (charge - 0.45) / 0.55;
        var pat = ctx.createPattern(noiseSprite, "repeat");
        ctx.save();
        ctx.globalAlpha = Math.min(1, nk);
        ctx.translate(Math.floor(hash(Math.floor(tS * 30)) * 160), Math.floor(hash(Math.floor(tS * 30) + 7) * 160));
        ctx.fillStyle = pat;
        ctx.fillRect(-160, -160, W + 320, H + 320);
        ctx.restore();
      }

      /* 成核事件(过境期间暂停:界面被吞,不给新事件) */
      if (!charge && !q) {
        if (!core.active && now > core.next) coreSpawn(now);
        coreDraw(ctx, now);
      }

      /* 中央阅读遮罩(内容页):把背景再压暗一点
         ★ 过境期间(charge>0 或 q>0)必须停 —— 它画在洋流之后,
           0.55 的黑径向罩会把整个中央区的洋流盖回去。 */
      if (!isHome() && !q && !charge) {
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
      /* ★ 张力层 1:浪涌 —— 每列波的波幅被 2 个沿波跑的"涌包"
         调制(高斯型,涌包处波高局部 ×1.2~2.2),涌包速度不同、
         相位漂移 → 波形不再均匀,而是有可见的"这一段在鼓、那一段在塌"。
         涌包初始相位随机 → 每次加载走位不同,第二遍看不重复。 */
      function waveSwell(wvi, nx, tSec) {
        var k = 1;
        for (var si = 0; si < 2; si++) {
          var ph = hash(wvi * 17.3 + si * 7.7) * 10;
          var sp = 0.02 + hash(wvi * 5.1 + si * 3.3) * 0.03;     /* 涌包速度(归一化/s) */
          var sc = (((tSec * sp + ph) % 1) + 1) % 1;
          var d = Math.min(Math.abs(nx - sc), 1 - Math.abs(nx - sc));
          var wdt = 0.10 + hash(wvi * 9.7 + si) * 0.10;
          k += (1.2 + hash(wvi * 3.1 + si * 2.9) * 1.0) * Math.exp(-(d * d) / (wdt * wdt));
        }
        return k;
      }
      /* ★ 过境净化水位:由渲染循环每帧写入(平时 0)。只收"涌包"
         (波包乱鼓,群魔乱舞的主源);谐波撕裂是设定里的色散崩塌,
         过境保留 —— 崩塌该在过境时更凶,不该消失。 */
      var lkClean = 0;
      /* 爆发期崩塌区右界(默认 0.45;渲染循环在 q 期写入更大的值) */
      var tearEdge = 0.45;
      function waveYs(wv, nx, tSec, wvi, tEdge) {
        var kk = dispK(wv, nx);
        /* 波向左传:相位 +t·w·2π(峰随时间向 -x 移动) */
        var y = Math.sin(nx * kk * Math.PI * 2 + tSec * wv.w * Math.PI * 2 + wv.ph) * H * wv.a;
        /* 谐波撕裂:前沿高频毛刺,起于左缘、崩塌区右界可扩(爆发吞全屏) */
        var te = tEdge || tearEdge;
        if (nx < te) {
          var tear = (te - nx) / te;
          y += Math.sin(nx * wv.k * 5.7 * Math.PI * 2 - tSec * wv.w * 3.1 * Math.PI * 2) * H * wv.a * (0.16 + lkClean * 0.14) * tear;
        }
        /* 振幅包络:慢塌慢起(0.25..1);涌包调制在过境时退场(回 1) */
        var env = 0.625 + 0.375 * Math.sin(tSec * wv.dec * Math.PI * 2 + wv.dph);
        var swell = waveSwell(wvi, nx, tSec);
        swell = 1 + (swell - 1) * (1 - lkClean);
        return H * wv.y0 + y * env * swell;
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
            var gy = waveYs(wv, gx / W, tS - gh * 0.55, wvi);
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
          var wy = waveYs(wv, wx / W, tS, wvi);
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
            var ly = waveYs(pw, lx / W, tS, packet.wi % WAVES.length) - H * pw.a * 2.2 * pEnv * Math.cos((dx4 / 0.09) * Math.PI / 2);
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
        var waveHere = waveYs(WAVES[wnn.wi], wnn.nx, tS, wnn.wi);
        ctx.save();
        ctx.translate(wnn.nx * W, waveHere + wnn.lift * nfs * 0.9);
        ctx.rotate(wnn.rot);
        ctx.globalAlpha = na;
        ctx.fillStyle = "#5d584a";
        ctx.fillText(wnn.txt, 0, 0);
        ctx.restore();
      }
      ctx.restore();

      /* 中央阅读区轻压(内容页):主波透明度本来低,这里再保一层。
         ★ 过境期间(charge/q)必须停 —— 白压罩会把洪峰盖回去。 */
      if (!isHome() && !charge && !q) {
        var mg2 = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.55);
        mg2.addColorStop(0, "rgba(244, 241, 233, 0.45)");
        mg2.addColorStop(1, "rgba(244, 241, 233, 0)");
        ctx.fillStyle = mg2;
        ctx.fillRect(0, 0, W, H);
      }

      /* ===== 亮模式 · 共流过境(charge/q 与暗模式同一套水位) =====
         ★ 用户定稿口径(最早就说了,别再自作主张):
           · 四列振幅统一(不再各压各的,整屏一个节奏)
           · 波幅拉高(高度就是力道)
           · 波速加快(行进提速)
         加上墨色随水位加深 —— 就这四件事,不加线、不加粒子、
         不加网纹、不搞墨面。
         ★ "群魔乱舞"根因:常态波形自带的涌包(波包乱鼓)和谐波撕裂
           (前沿毛刺)在过境时被振幅放大后跟着一起放大 —— 净化水位
           lkClean 把这两个乱源按水位收掉,过境只剩整齐的大波。
         爆发期沿用同一套 DOM 侧演出(震动/模糊/白幕,custom.css
         的 --surge-*)。 */
      if (charge > 0.001 || q > 0) {
        var lk = Math.max(charge, q > 0 ? 1 : 0);
        lkClean = lk;                                  /* 写给 waveYs:乱源随水位退场 */
        var lks = lk * lk * (3 - 2 * lk);              /* smoothstep */
        var inkR = Math.round(96 - lk * 62), inkG = Math.round(92 - lk * 58), inkB = Math.round(78 - lk * 42);
        /* ★ 爆发期要有自己的"事件的样子",不能只是前期最后阶段的延续:
           前期(charge):统一大波,高、快、黑 —— 量变;
           爆发(q):波开始"拍岸"——
             1) 振幅随 q 再冲一截(2.35x → 3.1x),但相位速度不再加
                (不是无限加速,是越来越陡);
             2) 波形整体向下沉:基线随 q 往下压(4 列全部涌向屏幕下沿,
                像水墙压过来)——爆发最直观的空间变化;
             3) 撕裂区随 q 从左前沿往右吞:崩塌区宽度 (0.45→0.8),
                满屏进入崩塌;
             4) 墨色顶格纯黑,线宽 4.5px。 */
        var qK = q > 0 ? 1 : 0;
        var uniAmp = 1 + lks * 1.35 + qK * q * 0.75;   /* 爆发再冲:最高 ~3.1x */
        var uniT = 1 + lk * 2.2;                       /* 波速:爆发不再加(前期已到顶) */
        var sink = q * H * 0.10;                       /* 爆发:基线下沉最多 10% 屏高 */
        var tearGrow = 0.45 + q * 0.35;                /* 爆发:崩塌区向右吞 */
        for (var wvi2 = 0; wvi2 < WAVES.length; wvi2++) {
          var wv2 = WAVES[wvi2];
          /* 统一采样:时间提速用统一的 uniT,振幅归一到 uniAmp */
          var wpx = [], wpy = [];
          for (var wx2 = 0; wx2 <= W; wx2 += 4) {
            var nx2 = wx2 / W;
            var yB = waveYs(wv2, nx2, tS * uniT, wvi2, tearGrow);
            var rel = (yB - H * wv2.y0) / (H * wv2.a);        /* 归一化相对波幅 */
            var aUni = H * 0.062 * uniAmp;                     /* 统一振幅(屏高 6.2% 基准) */
            wpx.push(wx2);
            wpy.push(H * wv2.y0 + sink + rel * aUni);
          }
          /* 波带填墨:爆发期再压深一档(q 期 0.34,前期顶 0.265) */
          ctx.beginPath();
          ctx.moveTo(wpx[0], H * wv2.y0);
          for (var fi2 = 0; fi2 < wpx.length; fi2++) ctx.lineTo(wpx[fi2], wpy[fi2]);
          ctx.lineTo(W, H * wv2.y0);
          ctx.closePath();
          ctx.fillStyle = "rgba(" + inkR + ", " + inkG + ", " + inkB + ", " + (0.045 + lk * 0.22 + qK * q * 0.12).toFixed(3) + ")";
          ctx.fill();
          /* 主线描深:爆发期顶格纯黑 */
          ctx.beginPath();
          for (var fi3 = 0; fi3 < wpx.length; fi3++) {
            if (fi3 === 0) ctx.moveTo(wpx[fi3], wpy[fi3]); else ctx.lineTo(wpx[fi3], wpy[fi3]);
          }
          ctx.strokeStyle = qK
            ? "rgba(8, 10, 8, " + (0.80 + q * 0.18).toFixed(2) + ")"
            : "rgba(" + inkR + ", " + inkG + ", " + inkB + ", " + (0.16 + lk * 0.62).toFixed(2) + ")";
          ctx.lineWidth = 1.5 + lk * 2.2 + qK * q * 0.8;
          ctx.stroke();
        }
        ctx.restore();
        /* 注记被冲散:透明度抬升 + 抖动位移(q 期直接糊掉) */
        if (waveNotes.length) {
          ctx.save();
          ctx.font = (nfs2 = nfs2 || Math.max(10, Math.round(Math.min(W, H) * 0.016))) + 'px "Alpha Sector", ui-monospace, Consolas, monospace';
          for (var wn3 = 0; wn3 < waveNotes.length; wn3++) {
            var wnn3 = waveNotes[wn3];
            var jitter = lk * (q > 0 ? 14 : 5);
            ctx.save();
            ctx.translate(
              wnn3.nx * W + (hash(Math.floor(tS * 9) + wn3) - 0.5) * jitter,
              waveYs(WAVES[wnn3.wi], wnn3.nx, tS, wnn3.wi) + wnn3.lift * nfs2 * 0.9 + (hash(Math.floor(tS * 9) + wn3 * 31) - 0.5) * jitter);
            ctx.globalAlpha = Math.min(0.85, wnn3.a + lk * 0.5);
            ctx.fillStyle = "#3d4436";
            ctx.fillText(wnn3.txt, 0, 0);
            ctx.restore();
          }
          ctx.restore();
        }
        /* 3) 背景侧环形暗角(暖褐,亮模式口径;白幕期退出) */
        if (q < 0.88) {
          var rIn2 = Math.max(0.06, 0.62 - 0.54 * lk);
          var vg2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * rIn2, W / 2, H / 2, Math.max(W, H) * 0.75);
          vg2.addColorStop(0, "rgba(64, 54, 30, 0)");
          vg2.addColorStop(1, "rgba(64, 54, 30, " + (0.62 * lk).toFixed(2) + ")");
          ctx.globalAlpha = 1;
          ctx.fillStyle = vg2;
          ctx.fillRect(0, 0, W, H);
        }
        /* 4) 白幕:亮模式也走全白(q 0.88..1),与暗模式同格 */
        if (q >= 0.88) {
          ctx.globalAlpha = clamp((q - 0.88) / 0.10, 0, 1);
          ctx.fillStyle = "#f2f8ff";
          ctx.fillRect(0, 0, W, H);
        }
      }
    }

    /* ===== 过境·页面侧演出(暗/亮共用,放分支外) =====
       微震/爆发震动/模糊/白幕/环形暗罩由 --surge-* 驱动;
       白幕期(q>=0.88)震动/模糊保持,停用只允许在 q===0。 */
    if (q > 0) {
      var shakeA = (q / 0.45) * (q < 0.45 ? 1 : 1 - (q - 0.45) / 0.43 * 0.4);
      if (q >= 0.88) shakeA *= 0.65;
      document.body.classList.add("surge-shake");
      document.body.classList.add("surge-lock");
      docEl.style.setProperty("--surge-shake-x", ((hash(Math.floor(tS * 60)) - 0.5) * 9 * shakeA).toFixed(1) + "px");
      docEl.style.setProperty("--surge-shake-y", ((hash(Math.floor(tS * 60) + 99) - 0.5) * 7 * shakeA).toFixed(1) + "px");
      document.body.classList.add("surge-blur");
      docEl.style.setProperty("--surge-blur", (shakeA * 3.2).toFixed(2) + "px");
      docEl.style.setProperty("--surge-white", clamp((q - 0.88) / 0.10, 0, 1).toFixed(2));
      /* 收束期(q>=1):演出停 —— 终端字要清晰,不抖不糊;
         白幕(覆盖)保持,震动/模糊(演出)摘除。 */
      if (q >= 1) {
        document.body.classList.remove("surge-shake");
        document.body.classList.remove("surge-blur");
        docEl.style.removeProperty("--surge-shake-x");
        docEl.style.removeProperty("--surge-shake-y");
        docEl.style.removeProperty("--surge-blur");
      }
    } else {
      document.body.classList.remove("surge-shake");
      document.body.classList.remove("surge-blur");
      document.body.classList.remove("surge-lock");
      docEl.style.removeProperty("--surge-shake-x");
      docEl.style.removeProperty("--surge-shake-y");
      docEl.style.removeProperty("--surge-blur");
      docEl.style.removeProperty("--surge-white");
    }
    /* 环形暗角罩(页面侧):暗模式黑、亮模式暖褐 — 走同一变量,
       色差交给 CSS 的 data-theme 分支;白幕期与平时摘掉。
       ★ 底边黑边根因:radial-gradient 的 circle 默认 farthest-corner,
         屏幕底边距中心最远,dim-r 收缩后底边先到 100% 全黑 —— 读作
         "页面下面有一条黑边"。修法:暗角渐变改 ellipse farthest-side
         (custom.css),四边同步收;JS 侧 dim-r 下限放宽不再压到 0.06。 */
    if ((charge > 0.001 || q > 0) && q < 0.88) {
      var ekP = q > 0 ? Math.max(charge, 0.9) : charge;
      var rInP = Math.max(0.14, 0.62 - 0.54 * ekP);
      docEl.style.setProperty("--surge-dim", (0.68 * ekP).toFixed(2));
      docEl.style.setProperty("--surge-dim-r", rInP.toFixed(3));
    } else {
      docEl.style.removeProperty("--surge-dim");
      docEl.style.removeProperty("--surge-dim-r");
    }
    /* 前期末微震(charge>0.55):爆发前页面先"怕" */
    if (q === 0 && charge > 0.55) {
      var preP = (charge - 0.55) / 0.45;
      document.body.classList.add("surge-shake");
      docEl.style.setProperty("--surge-shake-x", ((hash(Math.floor(tS * 60)) - 0.5) * 2.2 * preP).toFixed(1) + "px");
      docEl.style.setProperty("--surge-shake-y", ((hash(Math.floor(tS * 60) + 99) - 0.5) * 1.8 * preP).toFixed(1) + "px");
    }
    /* 爆发收束:q 走满 → 不直接刷新。相变完成的动画:
       白幕里亮起一行终端字(新真空重新点亮 / 旧真空已归零,按主题),
       停 ~1.6s 再淡出刷新 —— 回到正常页面,像重启完成。
       ★ 收束层出现的同时摘掉震动/模糊 —— 终端字要清晰,白屏上的
         报文不能跟着页面一起抖/糊。 */
    if (q >= 1 && !surge.reloaded) {
      surge.reloaded = true;
      var cbP = surge.reloadCb;
      try { if (cbP) cbP(); } catch (e) { }
      surgeFinale();
    }

    requestAnimationFrame(render);
  }

  /* ---------- 爆发收束动画(白幕终端字 → 淡出 → 刷新) ---------- */
  function surgeFinale() {
    /* 摘震动/模糊(白幕仍在:canvas 白幕 + DOM --surge-white 保持,
       只停"演出",不停"覆盖") */
    document.body.classList.remove("surge-shake");
    document.body.classList.remove("surge-blur");
    document.body.classList.remove("surge-lock");
    docEl.style.removeProperty("--surge-shake-x");
    docEl.style.removeProperty("--surge-shake-y");
    docEl.style.removeProperty("--surge-blur");
    var dark = isDark();
    var el = document.createElement("div");
    el.className = "surge-finale";
    el.innerHTML =
      '<span class="surge-finale__code">' + (dark ? "TOPOLOGICAL DEFECT RE-LIT" : "OLD VACUUM · PHASE TERMINATED") + "</span>" +
      '<span class="surge-finale__note">' + (dark ? "新真空 · 缺陷中的纠错信息域已点亮" : "旧真空 · 抑制场能量耗尽,相变完成") + "</span>" +
      '<span class="surge-finale__bar"><i></i></span>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("is-on"); });
    setTimeout(function () { el.classList.add("is-out"); }, 1900);
    setTimeout(function () { try { location.reload(); } catch (e) { } }, 2600);
  }

  /* ---------- 共流过境:触发侧接口 ----------
     setLevel(v):触发条单击设定的【目标水位】(0..1)。渲染侧不再
       突跳 —— 用 chase 平滑追赶(每帧向目标靠近一段,时间加速式:
       距离远追得快、接近后减速泊),阶段之间连续无跳变。
     hold/release/p:保留(速率推进式,阶段条不用但兜底兼容)。
     phase():0=平时 1=前期 2=爆发期(触发条据此关自己的交互);
     onReload():爆发完成回调 —— 触发侧也可自行重载,渲染侧已带兜底。 */
  window.__voidSurge = {
    setLevel: function (v) {
      if (surge.armed) return;
      surge.target = clamp(v, 0, 1);        /* 只设目标;水位在渲染循环里追 */
      if (surge.target >= 1 && !surge.armed) {
        /* 目标即满:等 chase 追到 1 再武装(见渲染循环),这里不突跳 */
      }
    },
    hold: function (on) { if (!surge.armed) surge.rate = on ? 0.20 : 0.028; },
    release: function () { if (!surge.armed && surge.p > 0) surge.rate = -0.05; },
    p: function () { return surge.p; },
    phase: function () { return surge.armed ? 2 : (surge.p > 0 ? 1 : 0); },
    onReload: function (fn) { surge.reloadCb = fn; }
  };

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

  /* 主题切换时:canvas 不吃 CSS 颜色过渡,直接换主题会硬切。
     把当前帧快照到一张叠在上面的 canvas,让它 1.6s 淡出 ——
     底下的主 canvas 已经按新主题在画,交叉之后就是渐变。 */
  var snap = document.createElement("canvas");
  snap.className = "void-bg";
  snap.setAttribute("aria-hidden", "true");
  function crossfade() {
    if (reduced || !cv.width) return;
    try {
      snap.width = cv.width;
      snap.height = cv.height;
      snap.getContext("2d").drawImage(cv, 0, 0);
      if (!snap.parentNode && cv.parentNode) cv.parentNode.insertBefore(snap, cv.nextSibling);
      snap.style.transition = "none";
      snap.style.opacity = "1";
      void snap.offsetWidth;
      snap.style.transition = "opacity 1.6s ease";
      snap.style.opacity = "0";
    } catch (e) { }
  }
  if (window.MutationObserver) {
    new MutationObserver(crossfade).observe(docEl, { attributes: true, attributeFilter: ["data-theme"] });
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
