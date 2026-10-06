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
  /* 裂纹画布:<html> 直下(body 外)—— 全页模糊挂 body,裂纹不参与 */
  crisp.style.cssText = "position:fixed;inset:0;z-index:99980;pointer-events:none;";
  (docEl).appendChild(crisp);
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, DPR = 1;

  /* ---------- 裂纹专用顶层画布(crisp-cv) ----------
     挂在 <html> 直下(body 外):爆发期的全页模糊滤镜挂 body,
     这块 canvas 在 body 外 ⇒ 裂纹永不模糊。z-index 高于内容,
     pointer-events:none。 */
  var crisp = document.createElement("canvas");
  crisp.className = "void-bg-crisp";
  crisp.setAttribute("aria-hidden", "true");
  var cctx = crisp.getContext("2d");

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
  var surge = { p: 0, rate: 0, q: 0, qStart: 0, armed: false, reloaded: false, reloadCb: null };

  /* 前期强度:0..1 —— ★ 直接吃整个 p(0..1 线性)。
     曾经 0..0.75 封顶:水位后 25% 视觉全停(速度不变、条还在涨)
     —— 用户读作"速度复原"。现在速度/亮度/拖尾全程跟条走,
     到 1 瞬间无缝接爆发(q 的 ×6 项继续加速),没有平台段。 */
  function surgeCharge(p) { return clamp(p, 0, 1); }

  /* 爆发期子相位(全部基于 q,0.11/s ≈ 9s 总长):
     震动 0..0.45 渐强;炫光 0..0.45;光带成形 0.30..0.70;
     裂纹 0.30..0.92;覆屏白幕 0.88..1.0 */
  var CRACKS = [];                    /* 裂纹对象池,爆发开始时生成 */
  /* 裂纹:【从洋流中心向外放射】—— 起点在河道带中心,主方向
     朝最近的屏幕边缘径向生长,带小折角;沿途小角度劈出岔缝
     (裂缝被劈开的感觉,不是树杈)。 */
  function crackSpawn(qStart, tNow) {
    CRACKS.length = 0;
    var n = 4;
    for (var i = 0; i < n; i++) {
      var ci = (hash(tNow * 0.011 + i * 7.7) * CURRENTS.length) | 0;
      var sx = 0.06 + hash(tNow * 0.017 + i * 3.1) * 0.88;
      var sy = CURRENTS[ci].y0;
      /* 主方向:朝最近的水平边缘(上/下),小偏角 */
      var towardBottom = sy < 0.5;
      var baseA = towardBottom ? Math.PI / 2 : -Math.PI / 2;
      var a = baseA + (hash(tNow * 0.023 + i * 5.3) - 0.5) * 0.8;
      var len = 0.30 + hash(tNow * 0.031 + i * 9.9) * 0.24;   /* 更长:向外贯穿 */
      var segs = [];
      var branches = [];
      var x = sx, y = sy;
      var N = 12;
      for (var s = 0; s < N; s++) {
        var nx = x + Math.cos(a) * len / N;
        var ny = y + Math.sin(a) * len / N;
        segs.push([x, y, nx, ny]);
        /* 岔缝:小角度劈开(≤0.5rad),直而短 —— 裂缝劈开状 */
        if (s > 1 && s < N - 2 && hash(tNow * 0.041 + i * 13.7 + s) > 0.35) {
          var ba = a + (hash(tNow * 0.053 + s * 3 + i) > 0.5 ? 1 : -1) * (0.25 + hash(tNow + s) * 0.3);
          var blen = len * (0.18 + hash(tNow * 0.09 + s) * 0.14);
          branches.push([nx, ny, nx + Math.cos(ba) * blen, ny + Math.sin(ba) * blen]);
        }
        x = nx; y = ny;
        a += (hash(tNow * 0.061 + s * 7 + i * 3) - 0.5) * 0.5;   /* 折角小:总体径直 */
      }
      CRACKS.push({ ci: ci, segs: segs, branches: branches, born: qStart + i * 0.06 });
    }
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
    /* 裂纹画布同尺寸(它挂在 html 下,见定义处) */
    crisp.width = cv.width;
    crisp.height = cv.height;
    crisp.style.width = W + "px";
    crisp.style.height = H + "px";
    cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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
       ★ 爆发段入口放在帧尾(q 推进处),这里只管涨落:
         后 25%(0.75..1)charge 已封顶,速度/亮度【不回落】——
         p 继续走向 1 只是"临门"的呼吸段,所有前期效果保持在满档。 */
    if (surge.q === 0 && surge.rate) {
      surge.p = clamp(surge.p + surge.rate * dt / 1000, 0, 1);
      if (surge.p <= 0) surge.rate = 0;
      /* 到顶:武装,进入爆发(帧尾推进 q) */
      if (surge.p >= 1 && !surge.armed) {
        surge.armed = true;
        surge.q = 0.0001;
        surge.qStart = 0;
        crackSpawn(tS, tS);
      }
    }
    /* 爆发段推进:0.11/s ≈ 9s 走完(用户:爆发期不要这么快) */
    if (surge.q > 0) {
      if (!surge.qStart) surge.qStart = tS;
      surge.q = clamp(surge.q + 0.11 * dt / 1000, 0, 1);
      if (surge.p < 1) surge.p = 1;
    }
    var charge = dark ? surgeCharge(surge.p) : 0;
    var q = dark ? surge.q : 0;

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
         河道本身随时间弯曲摆动漂移。
         ★ 过境前期(charge):流速乘 (1+charge*2.2);亮度抬升;
           charge>0.55 后单个点拖成短线(运动方向上,长度随 charge 长);
           爆发期(q):真发光 —— shadowBlur + 多层重绘,光晕随 q 变粗,
           q>0.35 光晕互相咬合连成光带。 */
      var glow = q > 0 ? Math.min(1, q / 0.40) : 0;          /* 炫光强度 0..1(稍早进入) */
      var band = q > 0.35 ? clamp((q - 0.35) / 0.35, 0, 1) : 0;  /* 光带成形 */
      ctx.save();
      for (var f = 0; f < flowDots.length; f++) {
        var fd = flowDots[f];
        var c3 = CURRENTS[fd.ci];
        /* ★ 速度:前期拉满后不回落(charge 封顶 1);爆发期再 ×3 */
        var speed = 0.018 * (1 + charge * 5.0 + q * 6);   /* charge 全程跟水位,无缝接爆发 */
        var s = (fd.off + tS * speed * fd.vj * c3.dir) % 1;
        if (s < 0) s += 1;
        var cyc = fd.off + (tS * speed * fd.vj) % 1;      /* 用于闪烁 */
        var cxp = s * W;
        var cyp = currentY(c3, s, tS, fd.strand) * H + fd.lat * c3.width * H;
        var fa = 0.18 + 0.26 * (0.5 + 0.5 * Math.sin(tS * 1.1 + fd.tw));
        /* 内容页避开中央阅读区(爆发期取消避让:洪峰盖一切) */
        var dCtr3 = Math.hypot(cxp - W * 0.5, cyp - H * 0.5) / Math.min(W, H);
        if (!isHome() && dCtr3 < 0.30 && !q) fa *= 0.35;
        /* 前期增亮(不变大);爆发期按发光强度再抬 */
        fa = Math.min(1, fa + charge * 0.5 + glow * 0.55);
        ctx.globalAlpha = fa;
        /* ★ 炫光:shadowBlur 本体 + 一层放大重描(外晕)。
           单靠 shadowBlur 在小点上不显眼 —— 炫光=核心亮 + 外圈大晕。 */
        if (glow > 0.01) {
          ctx.shadowColor = "rgba(150, 215, 255, 0.95)";
          ctx.shadowBlur = (10 + 46 * glow) * (0.6 + 0.4 * fd.vj);
        } else ctx.shadowBlur = 0;
        ctx.fillStyle = glow > 0.01 ? "#f2f9ff" : "#dcecff";
        /* 前期末段:点拖成线(沿运动方向);爆发期线更长 → 光带。
           ★ 贯穿全屏直线的根因:回退点跨过 x=0/1 屏幕边界时,
             pxp 会跳到屏幕另一端,两点直连 = 横贯线。
             处理:拖尾统一折线化(3 段),并检测跨边界 ——
             跨边界的点直接不画(那一帧少一截拖尾,看不出)。 */
        var streak = charge > 0.4 ? (charge - 0.4) / 0.6 : 0;   /* 更早开始拖尾,随条全程加深 */
        var streakLen = (streak * 34 + band * 60 + glow * 10) * fd.vj;   /* px */
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
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      /* ===== 爆发期:光带成形(q 0.30..0.70) =====
         沿三条河道画发光粗线;★ 线宽要盖过洋流整个带宽:
         河道带宽 = width*H*2(±lat 散布)+ 流丝摆动 →
         lineWidth 用 width*H*2.6 起步(实测覆盖),不 then 点缀 */
      if (band > 0.001) {
        ctx.save();
        for (var cb = 0; cb < CURRENTS.length; cb++) {
          var cc3 = CURRENTS[cb];
          var lw = (cc3.width * H * 2.6) * (0.25 + 0.75 * band);   /* 满档:带宽 2.6 倍 */
          ctx.shadowColor = "rgba(170, 228, 255, 0.98)";
          ctx.shadowBlur = 46 + 70 * band;
          ctx.strokeStyle = "rgba(226, 244, 255, " + (0.55 + 0.4 * band).toFixed(2) + ")";
          ctx.lineWidth = lw;
          ctx.lineCap = "round";
          ctx.beginPath();
          for (var seg = 0; seg <= 60; seg++) {
            var ss2 = seg / 60;
            var yy2 = currentY(cc3, ss2, tS, 0) * H;
            if (seg === 0) ctx.moveTo(ss2 * W, yy2); else ctx.lineTo(ss2 * W, yy2);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      /* ===== 爆发期:裂纹(q 0.30..0.92) =====
         ★ 裂纹画在独立顶层 canvas(crisp-cv,CSS 不给它 blur)
           —— 全页模糊(html filter)会让根元素下所有东西都糊,
           唯独顶层第二 canvas 同样在 html 下也会糊 ⇒ 用
           【反向补锐】不行;真解法:模糊滤镜挂 body 而不是 html,
           裂纹 canvas 挂在 html 直下(body 外)→ 不参与模糊。
         裂纹形态:【从洋流中心向外放射】的裂纹 —— 每条裂纹起点在
         河道带中心,径直朝屏幕外生长(允许轻微折角),不断分叉
         (岔口角度小,呈裂缝劈开状,非树杈)。 */
      if (q > 0.30 && q < 0.92 && CRACKS.length) {
        cctx.save();
        cctx.clearRect(0, 0, W, H);
        for (var cr = 0; cr < CRACKS.length; cr++) {
          var ck = CRACKS[cr];
          var ckT = clamp((q - (0.30 + cr * 0.05)) / 0.30, 0, 1);   /* 各条错峰生长 */
          if (ckT <= 0) continue;
          var segN = Math.ceil(ck.segs.length * ckT);
          var wMain = 3.5 + 2.8 * (1 - ckT * 0.35);
          cctx.shadowColor = "rgba(190, 230, 255, 0.98)";
          cctx.shadowBlur = 26;
          cctx.strokeStyle = "rgba(200, 234, 255, 0.55)";
          cctx.lineWidth = wMain * 2.2;
          cctx.lineCap = "round";
          cctx.beginPath();
          for (var sgi = 0; sgi < segN; sgi++) {
            var sg = ck.segs[sgi];
            if (sgi === 0) cctx.moveTo(sg[0] * W, sg[1] * H);
            cctx.lineTo(sg[2] * W, sg[3] * H);
          }
          cctx.stroke();
          cctx.strokeStyle = "rgba(242, 250, 255, 0.98)";
          cctx.lineWidth = wMain;
          cctx.stroke();
          /* 岔缝:细、直劈(小角度分叉,非树杈) */
          cctx.lineWidth = wMain * 0.5;
          cctx.strokeStyle = "rgba(226, 242, 255, 0.8)";
          for (var bi = 0; bi < ck.branches.length; bi++) {
            var br = ck.branches[bi];
            if ((bi + 2) > segN) break;
            cctx.beginPath();
            cctx.moveTo(br[0] * W, br[1] * H);
            cctx.lineTo(br[2] * W, br[3] * H);
            cctx.stroke();
          }
        }
        cctx.shadowBlur = 0;
        cctx.restore();
      } else if (cctx) {
        cctx.clearRect(0, 0, W, H);
      }

      /* ===== 爆发期:震动 + 全页模糊(html.surge-run) =====
         ★ 震动/模糊/变暗都挂在 <html> 的 class 上,CSS 里对
           html 元素本身做 filter —— filter 作用在根元素会连同
           所有 fixed 面板(HUD/顶栏)一起模糊,这才是"整个页面"。
         ★ 不能用 <html>.transform 做震动(创建包含块 → fixed 全错位);
           震动仍走 body.surge-shake(.main/.m-hud/面板都平移)。
         ★ 裂纹不受模糊影响:裂纹是 canvas 内画的,会跟着模糊 ——
           把裂纹也搬到独立 DOM?不必:模糊分段,裂纹窗口(0.30+)
           模糊已封顶稳定,且裂纹 blur 补偿 —— 给 canvas 滤镜在
           裂纹期适当降低,裂纹靠自身 26px 炫光突出。 */
      if (q > 0 && q < 0.88) {
        var shakeA = (q / 0.45) * (q < 0.45 ? 1 : 1 - (q - 0.45) / 0.43 * 0.4);
        document.body.classList.add("surge-shake");
        docEl.style.setProperty("--surge-shake-x", ((hash(Math.floor(tS * 60)) - 0.5) * 9 * shakeA).toFixed(1) + "px");
        docEl.style.setProperty("--surge-shake-y", ((hash(Math.floor(tS * 60) + 99) - 0.5) * 7 * shakeA).toFixed(1) + "px");
        /* 全页模糊(含 HUD):blur 挂 body(class 驱动);裂纹画布在 body 外,不参与 */
        document.body.classList.add("surge-blur");
        docEl.style.setProperty("--surge-blur", (shakeA * 3.2).toFixed(2) + "px");
      } else {
        document.body.classList.remove("surge-shake");
        document.body.classList.remove("surge-blur");
        docEl.style.removeProperty("--surge-shake-x");
        docEl.style.removeProperty("--surge-shake-y");
        docEl.style.removeProperty("--surge-blur");
        docEl.style.removeProperty("--surge-dim");
      }

      /* ===== 爆发期:覆屏白幕(q 0.88..1) =====
         光带突然变宽盖住一切 → 全白 → 通知触发侧重载 */
      if (q >= 0.88) {
        var wh = clamp((q - 0.88) / 0.10, 0, 1);
        ctx.globalAlpha = wh;
        ctx.fillStyle = "#f2f8ff";
        ctx.fillRect(0, 0, W, H);
        if (q >= 1 && !surge.reloaded) {
          surge.reloaded = true;
          document.body.classList.remove("surge-shake");
          document.body.classList.remove("surge-blur");
          docEl.style.removeProperty("--surge-shake-x");
          docEl.style.removeProperty("--surge-shake-y");
          docEl.style.removeProperty("--surge-blur");
          var cb = surge.reloadCb;
          setTimeout(function () { if (cb) { try { cb(); } catch (e) { } } try { location.reload(); } catch (e) { } }, 320);
        }
      }

      /* ===== 前期:四周往中心渐暗(环形暗角,页面级) =====
         ★ 用户:变暗是【四周往内】,不是糊一层黑罩。
         实现:mask 渐进 —— .surge-dim 罩不用纯色 fill,改用
         径向渐变(中心透明 → 四周黑),随 charge 内环收缩,
         且罩在页面内容之上 ⇒ 正文和 HUD 的四周一起沉,中心可读。
         canvas 内的暗角同步(背景侧同形)。 */
      if ((charge > 0.001 || q > 0) && q < 0.88) {
        var ek = q > 0 ? Math.max(charge, 0.9) : charge;
        var rIn = Math.max(0.08, 0.62 - 0.5 * ek);            /* 内环半径(短边比例) */
        /* 背景侧:canvas 暗角 */
        var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * rIn, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, "rgba(0, 2, 6, 0)");
        vg.addColorStop(1, "rgba(0, 2, 6, " + (0.72 * ek).toFixed(2) + ")");
        ctx.globalAlpha = 1;
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
        /* 页面侧:环形渐变暗罩(中心透明四周黑),深度 0 → 0.55 */
        docEl.style.setProperty("--surge-dim", (0.55 * ek).toFixed(2));
        docEl.style.setProperty("--surge-dim-r", rIn.toFixed(3));
      } else {
        docEl.style.removeProperty("--surge-dim");
        docEl.style.removeProperty("--surge-dim-r");
      }

      /* ===== 前期末段:噪点(charge > 0.6 起,渐密) =====
         预生成噪点雪花:每帧随机取子集闪,密度随 charge 涨。
         爆发期延续并加剧,直到白幕。 */
      if ((charge > 0.6 || q > 0) && q < 0.88) {
        var nk = q > 0 ? 1 : (charge - 0.6) / 0.4;
        var n = Math.round(140 * nk);
        ctx.save();
        ctx.fillStyle = "#cfe4f4";
        for (var ni = 0; ni < n; ni++) {
          var seed = Math.floor(tS * 30) * 131 + ni * 7.77;
          var nx2 = hash(seed) * W;
          var ny2 = hash(seed + 0.5) * H;
          ctx.globalAlpha = 0.10 + hash(seed + 0.9) * 0.22 * nk;
          ctx.fillRect(nx2, ny2, 1 + (hash(seed + 2) > 0.85 ? 1.4 : 0), 1);
        }
        ctx.restore();
      }

      /* 成核事件(过境期间暂停:界面被吞,不给新事件) */
      if (!charge && !q) {
        if (!core.active && now > core.next) coreSpawn(now);
        coreDraw(ctx, now);
      }

      /* 中央阅读遮罩(内容页):把背景再压暗一点 */
      if (!isHome() && !q) {
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

  /* ---------- 共流过境:触发侧接口 ----------
     hold/release/p:水位控制(前期);
     phase():0=平时 1=前期 2=爆发期(触发条据此关自己的交互);
     reloadAt():爆发完成回调 —— 触发侧也可自行重载,渲染侧已带兜底。 */
  window.__voidSurge = {
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
