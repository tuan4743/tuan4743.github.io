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

  /* ---------- 亮模式:微观粒子球(3D 点云) ----------
     世界观:微观粒子结构。主体球心在屏幕右侧偏下,半径 > 半屏
     ⇒ 只露一小段弧;远景散布几颗小球(模糊+小,模拟远近)。
     球面粒子:斐波那契均匀分布 + 整体旋转 + 呼吸样径向起伏。
     现象:几秒一次向外扩散波(粒子径向抖出一圈);局部不稳定:
       · 闪烁:某区域透明度骤变,持续一段后恢复
       · 裂隙:某区域断裂,少量粒子飞出
     过境(charge):失稳加剧 + 外扩波越来越快越来越淡;
       远景球收缩→炸成粒子云。
     爆发(q):真空壁从左往右扫过 —— 扫过的粒子被"抹除",
       主体球最终碎裂,白幕重载(变暗/震动沿用 --surge-*)。 */
  var orbs = [];            /* 所有球:orbs[0] = 主体,其余远景 */
  var orbFrag = [];         /* 裂隙碎片池(复用) */
  var ORB_ROT = 0.05;       /* 主体球自转速率(rad/s) */

  function buildOrbs() {
    orbs.length = 0;
    orbFrag.length = 0;
    /* 主体球:球心在屏幕右缘外一点(露出左弧),半径 > 半屏 */
    orbs.push({
      main: true,
      cx: 1.18, cy: 0.62,            /* 球心(归一化):右侧偏下 */
      r: 0.62,                        /* 半径(min(W,H) 的倍数):>0.5 ⇒ 只露弧 */
      n: 420,                         /* 球面粒子数 */
      rotSpd: ORB_ROT,
      rot: 0,
      brPh: hash(3.1) * Math.PI * 2,  /* 呼吸相位 */
      breathAmp: 0.018,               /* 呼吸径向起伏幅度 */
      waveNext: 3 + hash(7.7) * 4,    /* 下一道外扩波(秒) */
      waves: [],                      /* 活动的外扩波 [{r0, t0, life}] */
      flick: null,                    /* 局部闪烁 {dir(单位向量), r, t0, life} */
      crack: null,                    /* 裂隙 {dir, r, t0, life} */
      crackNext: 14 + hash(9.3) * 10,
      flickNext: 9 + hash(5.7) * 8,
      unstable: 0                     /* 过境失稳水位(渲染循环写入) */
    });
    /* 远景球:小、模糊、散布在左侧/上部的"远处" */
    var REMOTE = [
      { cx: 0.16, cy: 0.20, r: 0.10, n: 90, blur: 1.4 },
      { cx: 0.34, cy: 0.78, r: 0.075, n: 70, blur: 1.8 },
      { cx: 0.06, cy: 0.55, r: 0.055, n: 50, blur: 2.2 },
      { cx: 0.55, cy: 0.10, r: 0.045, n: 40, blur: 2.6 }
    ];
    for (var ri = 0; ri < REMOTE.length; ri++) {
      var rc = REMOTE[ri];
      orbs.push({
        main: false,
        cx: rc.cx, cy: rc.cy, r: rc.r, n: rc.n, blur: rc.blur,
        rotSpd: ORB_ROT * (0.5 + hash(ri * 3.7) * 0.8) * (hash(ri * 9.1) > 0.5 ? 1 : -1),
        rot: hash(ri * 5.3) * Math.PI * 2,
        brPh: hash(ri * 7.1) * Math.PI * 2,
        breathAmp: 0.02,
        waveNext: 5 + hash(ri * 2.9) * 6,
        waves: [],
        flick: null, crack: null,
        crackNext: 18 + hash(ri * 11.7) * 14,
        flickNext: 12 + hash(ri * 4.3) * 10,
        unstable: 0,
        dieT: 0                         /* 过境:碎裂启动时刻(0=未启动) */
      });
    }
    /* 球面粒子:斐波那契球均匀分布 */
    var GA = Math.PI * (3 - Math.sqrt(5));
    for (var oi = 0; oi < orbs.length; oi++) {
      var ob = orbs[oi];
      ob.pts = [];
      for (var pi = 0; pi < ob.n; pi++) {
        var y = 1 - (pi / (ob.n - 1)) * 2;
        var rr = Math.sqrt(Math.max(0, 1 - y * y));
        var th = GA * pi;
        ob.pts.push({
          dx: Math.cos(th) * rr, dy: y, dz: Math.sin(th) * rr,
          sz: 0.5 + hash(oi * 131 + pi * 1.7) * 1.1,          /* 粒径(px 基准) */
          tw: hash(oi * 71 + pi * 2.3) * Math.PI * 2,          /* 闪烁相位 */
          frag: false
        });
      }
    }
    /* 裂隙碎片池:每球最多 26 枚,复用 */
    for (var fi = 0; fi < 26 * orbs.length; fi++) {
      orbFrag.push({ oi: fi % orbs.length, on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, t0: 0, sz: 1 });
    }
  }

  /* 画一颗粒子球。lk = 过境失稳水位(0 平时), q = 爆发水位,
     wallX = 爆发真空壁位置(归一化 x,壁右侧的粒子被抹除;-1 = 无壁) */
  function drawOrb(g, ob, tS, lk, q, wallX, ink) {
    var R = ob.r * Math.min(W, H);
    var cx = ob.cx * W, cy = ob.cy * H;
    var breath = 1 + Math.sin(tS * 0.5 + ob.brPh) * ob.breathAmp;   /* 整体呼吸 */
    var unstable = Math.max(ob.unstable || 0, lk);
    g.save();
    /* 粒子:旋转(绕 y 轴)+ 投影(x=x·cos+ z·sin,z 作深度) */
    var cosR = Math.cos(ob.rot), sinR = Math.sin(ob.rot);
    for (var i = 0; i < ob.pts.length; i++) {
      var pt = ob.pts[i];
      var px = pt.dx * cosR + pt.dz * sinR;          /* 旋转后的 x */
      var pz = -pt.dx * sinR + pt.dz * cosR;         /* 深度(-1..1) */
      var py = pt.dy;
      /* 呼吸样的球面上下起伏:按纬度加一点正弦位移 */
      py += Math.sin(py * 4 + tS * 0.7 + ob.brPh) * 0.045 * ob.breathAmp / 0.018 * 0.5;
      /* 深度缩放:z 越大(靠观察者)越亮越大 */
      var depth = (pz + 1) / 2;                       /* 0..1 */
      var sx = cx + px * R * breath;
      var sy = cy + py * R * breath;
      /* 基础闪烁(tw 驱动的慢呼吸)+ 深度调制 */
      var a = (0.10 + 0.22 * (0.5 + 0.5 * Math.sin(tS * 0.8 + pt.tw))) * (0.45 + 0.55 * depth);
      if (!ob.main) a *= 0.62;                        /* 远景整体更淡 */
      /* 外扩波:波前经过的粒子径向外抖 + 增亮 */
      for (var wv = 0; wv < ob.waves.length; wv++) {
        var ww = ob.waves[wv];
        var wt = (tS - ww.t0) / ww.life;
        if (wt < 0 || wt > 1) continue;
        var wRad = R * (1 + wt * 0.24);               /* 波前半径:略大于球面 */
        var wBand = R * 0.05;
        var dEdge = Math.abs(R * breath - wRad);
        if (dEdge < wBand) {
          var wk = 1 - dEdge / wBand;
          var push = wk * (1 - wt) * R * 0.035;
          sx += px * push; sy += py * push;
          a += wk * (1 - wt) * 0.30;
        }
      }
      /* 局部闪烁(不稳定):以 (flick.dir×R) 为中心的角域内,透明度高频骤变 */
      if (ob.flick) {
        var ft = (tS - ob.flick.t0) / ob.flick.life;
        if (ft >= 0 && ft < 1) {
          var fdot = px * ob.flick.dx + py * ob.flick.dy + pz * ob.flick.dz;  /* 夹角余弦 */
          if (fdot > ob.flick.cos) {
            var fk = (fdot - ob.flick.cos) / (1 - ob.flick.cos);
            var envF = Math.sin(Math.PI * Math.min(1, ft * 1.15));
            a *= 1 - fk * envF * (0.55 + 0.45 * Math.sin(tS * 17 + pt.tw * 3));
          }
        }
      }
      /* 裂隙:裂口角域内的粒子标记为 frag(不再画在球上,交给碎片池) */
      if (ob.crack && !pt.frag) {
        var ct = (tS - ob.crack.t0) / ob.crack.life;
        if (ct >= 0 && ct < 0.4) {
          var cdot = px * ob.crack.dx + py * ob.crack.dy + pz * ob.crack.dz;
          if (cdot > ob.crack.cos) {
            pt.frag = true;                            /* 永久脱落(直到重建) */
            spawnFrag(ob, sx, sy, px, py, ink);
          }
        }
      }
      /* 爆发真空壁:壁左侧(x < wallX)的粒子被抹除(快速淡出) */
      if (wallX >= 0 && sx < wallX * W) a *= Math.max(0, 1 - (wallX * W - sx) / (W * 0.06));
      /* 远景模糊:粒子画大而淡(失焦感) */
      var sz = pt.sz * (ob.main ? 1 : (1 + (ob.blur || 1) * 0.8));
      if (!ob.main) a *= 0.55 / (ob.blur || 1);
      if (a <= 0.004) continue;
      g.globalAlpha = Math.min(0.6, a);
      g.fillStyle = ink;
      g.beginPath();
      g.arc(sx, sy, sz, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    /* 碎片(裂隙飞出的粒子) */
    for (var f2 = 0; f2 < orbFrag.length; f2++) {
      var fp = orbFrag[f2];
      if (!fp.on || fp.oi !== orbs.indexOf(ob)) continue;
      var fpt = (tS - fp.t0) / fp.life;
      if (fpt >= 1) { fp.on = false; continue; }
      g.globalAlpha = (1 - fpt) * 0.5;
      g.fillStyle = ink;
      g.fillRect(fp.x, fp.y, fp.sz, fp.sz);
    }
  }

  function spawnFrag(ob, sx, sy, px, py, ink) {
    var oi = orbs.indexOf(ob);
    for (var i = 0; i < orbFrag.length; i++) {
      var fp = orbFrag[i];
      if (fp.on || fp.oi !== oi) continue;
      fp.on = true;
      fp.x = sx; fp.y = sy;
      fp.vx = px * 46 + (hash(i * 3.3) - 0.5) * 34;
      fp.vy = py * 46 + (hash(i * 7.7) - 0.5) * 34 - 12;
      fp.life = 1.6 + hash(i * 9.1) * 1.4;
      fp.t0 = frameT / 1000;
      fp.sz = 1 + hash(i * 5.5) * 1.6;
      return;
    }
  }

  /* 显式速度/寿命版:远景球炸云、主体球碎裂用(全员一次进池) */
  function spawnFragAt(ob, x, y, vx, vy, sz) {
    var oi = orbs.indexOf(ob);
    for (var i = 0; i < orbFrag.length; i++) {
      var fp = orbFrag[i];
      if (fp.on || fp.oi !== oi) continue;
      fp.on = true;
      fp.x = x; fp.y = y;
      fp.vx = vx; fp.vy = vy;
      fp.life = 2.4 + hash(oi * 13.7 + i) * 1.6;
      fp.t0 = frameT / 1000;
      fp.sz = sz;
      return;
    }
  }

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
    buildOrbs();          /* 亮模式粒子球(几何依赖视口尺寸) */
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
      /* ============ 亮模式:微观粒子球 ============
         世界观:微观粒子结构(设定 28:普朗克尺度下时空是弦网,
         集体激发 = "波—信息—意识"的底层自由度)。
         · 主体球:屏幕右侧偏下,半径 > 半屏 ⇒ 只露一小段弧;
           球面 ~420 粒子,斐波那契均匀分布,整体自转 + 呼吸样起伏
         · 远景:散布 4 颗小球(小/淡/粒子更散 = 失焦),模拟远近
         · 现象(平时):几秒一次向外扩散波;局部闪烁(某角域透明度
           骤变后恢复);裂隙(某角域断裂,少量粒子飞出)
         · 过境(charge):失稳加剧——闪烁/裂隙更频、外扩波越来越快
           越来越淡;远景球先向中心收缩再炸成一片粒子云
         · 爆发(q):无形的真空壁从屏幕左侧往右扫,扫过的元素被抹除;
           壁到达时主体球碎裂 → 白幕 → 重载(收束动画沿用)。
         变暗/震动/模糊沿用 DOM 侧 --surge-* 演出。 */
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, W, H);

      if (!orbs.length) buildOrbs();

      /* 真空壁位置:q 期从左往右扫(q 0..0.8 扫完全屏;0.88 后白幕接管) */
      var wallX = q > 0 ? clamp((q - 0.02) / 0.78, 0, 1.15) : -1;
      var inkOrb = q > 0
        ? "rgb(8, 10, 8)"
        : "rgb(" + Math.round(96 - charge * 62) + ", " + Math.round(92 - charge * 58) + ", " + Math.round(78 - charge * 42) + ")";

      /* 每球:推进旋转/呼吸/事件调度,再画 */
      for (var obi = 0; obi < orbs.length; obi++) {
        var ob = orbs[obi];
        ob.rot += ob.rotSpd * dt / 1000;
        /* 过境失稳水位写入(远景球另有 dieT 碎裂时序) */
        ob.unstable = charge;
        /* --- 外扩波调度:平时几秒一次;过境越来越快、越来越淡 --- */
        if (tS > ob.waveNext) {
          ob.waves.push({ t0: tS, life: 1.6 });
          if (ob.waves.length > 4) ob.waves.shift();
          var wGap = 3.5 + hash(Math.floor(tS * 1.7) + obi) * 4 - charge * 2.6;   /* 失稳 → 间隔缩短 */
          ob.waveNext = tS + Math.max(0.8, wGap);
        }
        for (var wdi = ob.waves.length - 1; wdi >= 0; wdi--) {
          if (tS - ob.waves[wdi].t0 > ob.waves[wdi].life) ob.waves.splice(wdi, 1);
        }
        /* --- 局部闪烁调度 --- */
        if (!ob.flick && tS > ob.flickNext) {
          var fa = hash(Math.floor(tS * 3.1) + obi * 17) * Math.PI * 2;
          var fb = (hash(Math.floor(tS * 5.3) + obi * 29) - 0.5) * 2;
          var fc = Math.sqrt(Math.max(0.02, 1 - fb * fb));
          ob.flick = { dx: Math.cos(fa) * fc, dy: fb, dz: Math.sin(fa) * fc, cos: 0.82, t0: tS, life: 1.2 + hash(Math.floor(tS) + obi) * 1.6 };
          var flickGap = 9 + hash(Math.floor(tS * 2.3) + obi * 7) * 8 - ob.unstable * 7.5;   /* 失稳 → 更频 */
          ob.flickNext = tS + Math.max(1.6, flickGap);
        }
        if (ob.flick && tS - ob.flick.t0 > ob.flick.life) ob.flick = null;
        /* --- 裂隙调度(过境时更频) --- */
        if (!ob.crack && tS > ob.crackNext) {
          var ka = hash(Math.floor(tS * 7.9) + obi * 13) * Math.PI * 2;
          var kb = (hash(Math.floor(tS * 2.7) + obi * 5) - 0.5) * 1.6;
          var kc = Math.sqrt(Math.max(0.05, 1 - kb * kb));
          ob.crack = { dx: Math.cos(ka) * kc, dy: kb, dz: Math.sin(ka) * kc, cos: 0.86, t0: tS, life: 1.0 };
          var crackGap = 16 + hash(Math.floor(tS * 1.3) + obi * 3) * 14 - ob.unstable * 12;
          ob.crackNext = tS + Math.max(3, crackGap);
        }
        if (ob.crack && tS - ob.crack.t0 > ob.crack.life) ob.crack = null;
        /* --- 远景球过境碎裂:先向中心收缩,再炸成一片粒子云 --- */
        if (!ob.main && charge > 0.55 && !ob.dieT) ob.dieT = tS + hash(obi * 3.9) * (1.1 - charge);   /* 失稳越深死得越早 */
        if (!ob.main && ob.dieT && !ob.dead) {
          var dtD = tS - ob.dieT;
          if (dtD > 0) {
            /* 阶段 1(0..0.9s):整体收缩;阶段 2:炸开成云(粒子改由云驱动) */
            if (dtD < 0.9) {
              ob.shrink = 1 - dtD / 0.9 * 0.55;          /* 收缩到 45% */
            } else {
              ob.dead = true;                            /* 不再按球画;云交给 frag 池 */
              for (var ei = 0; ei < ob.pts.length; ei++) {
                var ept = ob.pts[ei];
                var cosE = Math.cos(ob.rot), sinE = Math.sin(ob.rot);
                var exn = ept.dx * cosE + ept.dz * sinE;
                var ezn = -ept.dx * sinE + ept.dz * cosE;
                var erx = ob.cx * W + exn * ob.r * Math.min(W, H) * (ob.shrink || 0.5);
                var ery = ob.cy * H + ept.dy * ob.r * Math.min(W, H) * (ob.shrink || 0.5);
                spawnFragAt(ob, erx, ery, exn * 60 + (hash(obi * 31 + ei) - 0.5) * 90,
                  ept.dy * 60 + (hash(obi * 17 + ei) - 0.5) * 90, 1.4 + hash(obi + ei) * 1.2);
              }
            }
          }
        }
        /* 真空壁:壁已越过球心右侧 → 主体球碎裂(全部粒子进碎片池) */
        if (ob.main && wallX >= 0 && wallX > ob.cx - ob.r * 0.4 && !ob.dead) {
          ob.dead = true;
          var cosM = Math.cos(ob.rot), sinM = Math.sin(ob.rot);
          for (var mi = 0; mi < ob.pts.length; mi += 2) {           /* 采样一半,量可控 */
            var mpt = ob.pts[mi];
            var mxn = mpt.dx * cosM + mpt.dz * sinM;
            var mzn = -mpt.dx * sinM + mpt.dz * cosM;
            var mrx = ob.cx * W + mxn * ob.r * Math.min(W, H);
            var mry = ob.cy * H + mpt.dy * ob.r * Math.min(W, H);
            spawnFragAt(ob, mrx, mry, mxn * 40 - 60 + (hash(obi + mi) - 0.5) * 50,
              mpt.dy * 40 + (hash(mi * 3.1) - 0.5) * 50, 1 + hash(mi * 7.7));
          }
        }
        /* --- 画(远景球失焦感 = 粒子画大画淡;dead 球只画碎片云) --- */
        if (!(ob.dead && !ob.main)) {
          if (ob.main || !ob.dieT) drawOrb(ctx, ob, tS, charge, q, wallX, inkOrb);
          else if (!ob.dead) {
            /* 收缩中的远景球:临时缩半径画 */
            var saveR = ob.r;
            ob.r = saveR * (ob.shrink || 1);
            drawOrb(ctx, ob, tS, charge, q, wallX, inkOrb);
            ob.r = saveR;
          }
        }
      }
      /* 碎片推进(全局池):重力微下沉 + 阻尼 */
      for (var fpi = 0; fpi < orbFrag.length; fpi++) {
        var fgp = orbFrag[fpi];
        if (!fgp.on) continue;
        fgp.x += fgp.vx * dt / 1000;
        fgp.y += fgp.vy * dt / 1000;
        fgp.vy += 26 * dt / 1000;
        fgp.vx *= (1 - 0.4 * dt / 1000);
      }
      /* 全局碎片绘制(drawOrb 内已画各自球的;dead 球的碎片在这补画) */
      for (var fdx = 0; fdx < orbFrag.length; fdx++) {
        var fdp = orbFrag[fdx];
        if (!fdp.on || !orbs[fdp.oi] || !orbs[fdp.oi].dead) continue;
        var fdt = (tS - fdp.t0) / fdp.life;
        if (fdt < 0 || fdt >= 1) continue;
        ctx.globalAlpha = (1 - fdt) * 0.5;
        ctx.fillStyle = inkOrb;
        ctx.fillRect(fdp.x, fdp.y, fdp.sz, fdp.sz);
      }
      ctx.globalAlpha = 1;

      /* 中央阅读区轻压(内容页):平时压淡背景,过境停 */
      if (!isHome() && !charge && !q) {
        var mg2 = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.max(W, H) * 0.55);
        mg2.addColorStop(0, "rgba(244, 241, 233, 0.45)");
        mg2.addColorStop(1, "rgba(244, 241, 233, 0)");
        ctx.fillStyle = mg2;
        ctx.fillRect(0, 0, W, H);
      }
      /* 环形暗角(暖褐;白幕期退出) */
      if ((charge > 0.001 || q > 0) && q < 0.88) {
        var ek2 = q > 0 ? Math.max(charge, 0.9) : charge;
        var rIn2 = Math.max(0.06, 0.62 - 0.54 * ek2);
        var vg2 = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * rIn2, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg2.addColorStop(0, "rgba(64, 54, 30, 0)");
        vg2.addColorStop(1, "rgba(64, 54, 30, " + (0.62 * ek2).toFixed(2) + ")");
        ctx.globalAlpha = 1;
        ctx.fillStyle = vg2;
        ctx.fillRect(0, 0, W, H);
      }
      /* 白幕(q 0.88..1),与暗模式同格 */
      if (q >= 0.88) {
        ctx.globalAlpha = clamp((q - 0.88) / 0.10, 0, 1);
        ctx.fillStyle = "#f2f8ff";
        ctx.fillRect(0, 0, W, H);
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
      /* 粒子球的凝固帧:铺底 + 各球画一帧(不推进事件) */
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, W, H);
      if (!orbs.length) buildOrbs();
      for (var so = 0; so < orbs.length; so++) {
        drawOrb(ctx, orbs[so], tS, 0, 0, -1, "rgb(96, 92, 78)");
      }
    }
    ctx.globalAlpha = 1;
  }

  /* 主题切换时:canvas 不吃 CSS 颜色过渡,直接换主题会硬切。
     把当前帧快照到一张叠在上面的 canvas,让它 1.6s 淡出 ——
     底下的主 canvas 已经按新主题在画,交叉之后就是渐变。
     ★ 淡出走类驱动(.is-fading),不走内联 transition ——
       theme-fade 的全局 !important 过渡会把内联的顶掉/冻住
       (实测快照 opacity 冻在起点,背景读作"突变")。
       CSS 里 .void-bg-snap 的过渡规则带 !important,永远赢。 */
  var snap = document.createElement("canvas");
  snap.className = "void-bg void-bg-snap";
  snap.setAttribute("aria-hidden", "true");
  var snapT = 0;
  function crossfade() {
    if (reduced || !cv.width) return;
    try {
      snap.width = cv.width;
      snap.height = cv.height;
      snap.getContext("2d").drawImage(cv, 0, 0);
      if (!snap.parentNode && cv.parentNode) cv.parentNode.insertBefore(snap, cv.nextSibling);
      clearTimeout(snapT);
      /* 时序:is-fading(立即显形,无过渡)→ 一帧后换 is-out
         (1.6s 淡出)。快照内容是【旧主题】的最后一帧,盖在新主题
         的主画布上淡出,交叉即渐变。 */
      snap.classList.remove("is-out");
      snap.classList.add("is-fading");
      void snap.offsetWidth;
      requestAnimationFrame(function () {
        snap.classList.remove("is-fading");
        snap.classList.add("is-out");
      });
      snapT = setTimeout(function () { snap.classList.remove("is-out"); }, 1750);
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
