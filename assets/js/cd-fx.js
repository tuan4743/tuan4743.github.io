/* ============================================================
   CD 界面音频可视化 v3.0
   五种效果(可任意叠加,左侧开关控制):
     arc       盘左侧 135°~225° 的音频条(2D 叠加层,严格贴着盘缘)
     particles 从盘底向外弹射的小几何体(3D;实心/空心随机,彩色,速度随机)
     rays      从盘缘向四周放射的细长条(3D;带真实宽度,LineBasicMaterial 的 linewidth 无效)
     rings     低频概率触发的"分瓣圆环"(多段圆弧,每段微微内外浮动)
     lines     背景固定位置的随机线条(位置/朝向/长度随机一次生成),随节奏拉长变粗
   颜色:默认彩色(色相缓慢流动,只用于几何体和圆环);音频条/背景线/放射线用"背景反色"

   用法:createFx({ THREE, scene, container, cfg, levels, color, behind, cdRadius })
     behind   = 特效平面在盘后面的 z(必须比盘更靠后,否则盘一倾斜特效就跑到前面)
     cdRadius = CD 的模型半径(由 cd3d 从几何体量出来;所有"发射位置"都按它算)
   ============================================================ */

const rad = (d) => (d * Math.PI) / 180;

export function createFx(opts) {
  const THREE = opts.THREE;
  const scene = opts.scene;
  const container = opts.container;
  const levelsFn = opts.levels;
  const behindZ = opts.behind != null ? opts.behind : -0.5;
  let R0 = opts.cdRadius != null ? opts.cdRadius : 1.0;   /* CD 模型半径 */

  let cfg = Object.assign({
    on: { arc: true, particles: true, rays: false, rings: false, lines: true },
    colorful: { on: true, speed: 0.045, sat: 0.95, light: 0.5, spread: 0.14 },
    arc: { bars: 48, from: 125, to: 235, gap: 3, minLen: 4, maxLen: 70, gain: 1.0, width: 3.2, taper: 0, alpha: 0.92, pulse: 5 },
    particles: { count: 13, size: 0.085, speed: 2.1, speedMin: 0.2, life: 1.5, dist: 2.6, spawn: 0.9, hollowRatio: 0.5, alpha: 0.85 },
    rays: { count: 64, minLen: 0.12, maxLen: 1.5, width: 0.018, alpha: 0.95 },
    rings: { max: 4, speed: 1.125, width: 0.022, grow: 4.6, cooldown: 0.45, chance: 0.45, threshold: 0.3, alpha: 1.0, segments: 14, wobble: 0.075, drift: 0.1 },
    lines: { count: 9, lenMin: 0.22, lenMax: 0.85, width: 2.4, widthGrow: 2.4, grow: 0.25, alpha: 1.0 },
    polys: { count: 26, sizeMin: 0.03, sizeMax: 0.13, alphaMin: 0.06, alphaMax: 0.3, sat: 0.7, light: 0.5, rotate: 0.45 },
    agc: { floor: 0.12, decay: 0.5 },      /* 每频段自动增益:中间的条子不再"一有声就顶满" */
    beat: { avg: 1.1, thresh: 1.15, gain: 3.0, decay: 2.8 },  /* 鼓点检测:低频突增 → 快速起、快速落 */
    smooth: 0.3,
    idle: true
  }, opts.cfg || {});
  cfg.on = Object.assign({}, cfg.on);
  cfg.colorful = Object.assign({}, cfg.colorful);
  ["arc", "particles", "rays", "rings", "lines", "polys", "agc", "beat"].forEach((k) => { cfg[k] = Object.assign({}, cfg[k]); });

  let baseColor = opts.color || "#ffffff";
  let huePhase = 0;

  /* ---------- 画布:背景线(盘后面)+ 音频条(盘前面)---------- */
  function makeCanvas(cls, z) {
    const c = document.createElement("canvas");
    c.className = cls;
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:" + z + ";";
    return c;
  }
  const bgCanvas = makeCanvas("fx-bg", 0);
  container.insertBefore(bgCanvas, container.firstChild);
  const bg2d = bgCanvas.getContext("2d");
  const arcCanvas = makeCanvas("fx-arc", 3);
  container.appendChild(arcCanvas);
  const arc2d = arcCanvas.getContext("2d");

  let W = 1, H = 1;
  /* 背景图案:只生成一次(位置/朝向/长度/大小/颜色随机),之后只有长度和粗细会动 */
  let linePattern = [];
  let polyPattern = [];
  function makePattern() {
    const L = cfg.lines;
    const n = Math.max(1, L.count | 0);
    linePattern = [];
    for (let i = 0; i < n; i++) {
      linePattern.push({
        x: Math.random(),
        y: (i + 0.5) / n + (Math.random() - 0.5) * (0.6 / n),
        ang: Math.random() * Math.PI * 2,
        len: L.lenMin + Math.random() * Math.max(0, L.lenMax - L.lenMin),
        w: L.width * (0.6 + Math.random() * 0.8)
      });
    }
    /* 随机透明色多边形(参考《冰与火之舞》铺面编辑器背景)*/
    const P = cfg.polys;
    const pn = Math.max(0, P.count | 0);
    polyPattern = [];
    for (let i = 0; i < pn; i++) {
      const mx = (P.sizeMax + P.sizeMin) / 2;
      const w = (P.sizeMin + Math.random() * (P.sizeMax - P.sizeMin)) * (0.7 + Math.random() * 0.6);
      polyPattern.push({
        x: Math.random(),
        y: Math.random(),
        w: w,
        h: w * (Math.random() < 0.35 ? mx / Math.max(0.01, w) * (0.5 + Math.random()) : (0.75 + Math.random() * 0.8)),
        rot: Math.random() < P.rotate ? Math.random() * Math.PI : 0,
        hue: Math.random(),
        alpha: P.alphaMin + Math.random() * Math.max(0, P.alphaMax - P.alphaMin),
        tri: Math.random() < 0.18
      });
    }
  }
  makePattern();

  function resize() {
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    [bgCanvas, arcCanvas].forEach((c) => {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  resize();

  /* ---------- 3D 容器 ---------- */
  const group = new THREE.Group();
  scene.add(group);
  const inner = new THREE.Group();
  group.add(inner);

  /* ---------- 粒子 ---------- */
  function polyShape(sides, innerRatio) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a), y = Math.sin(a);
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    if (innerRatio > 0) {
      const hole = new THREE.Path();
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * innerRatio, y = Math.sin(a) * innerRatio;
        if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
      }
      shape.holes.push(hole);
    }
    return new THREE.ShapeGeometry(shape);
  }
  const solidGeos = [polyShape(3, 0), polyShape(4, 0), polyShape(6, 0), polyShape(3, 0)];
  const hollowGeos = [polyShape(3, 0.58), polyShape(4, 0.62), polyShape(6, 0.66), polyShape(3, 0.58)];

  const parts = [];
  for (let i = 0; i < cfg.particles.count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: baseColor, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false
    });
    const m = new THREE.Mesh(solidGeos[i % solidGeos.length], mat);
    m.visible = false;
    inner.add(m);
    parts.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, spin: 0, rot: 0, hue: 0 });
  }

  /* ---------- 射线:细长四边形(有真实宽度)---------- */
  const rayCount = cfg.rays.count;
  const rayGeo = new THREE.BufferGeometry();
  rayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rayCount * 4 * 3), 3));
  const ridx = [];
  for (let i = 0; i < rayCount; i++) {
    const a = i * 4;
    ridx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  rayGeo.setIndex(ridx);
  const rayMat = new THREE.MeshBasicMaterial({
    color: baseColor, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false
  });
  const rays = new THREE.Mesh(rayGeo, rayMat);
  rays.frustumCulled = false;
  rays.visible = false;
  inner.add(rays);

  /* ---------- 圆环:多段圆弧 ---------- */
  const RSEG = 96;
  function ringGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((RSEG + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < RSEG; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      idx.push(a, b, d, a, d, c);
    }
    g.setIndex(idx);
    return g;
  }
  const rings = [];
  for (let i = 0; i < cfg.rings.max; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: baseColor, transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false
    });
    const m = new THREE.Mesh(ringGeometry(), mat);
    m.frustumCulled = false;
    m.visible = false;
    inner.add(m);
    rings.push({ mesh: m, t: -1, offs: new Float32Array(cfg.rings.segments) });
  }
  let ringCool = 0;

  let smoothBands = new Float32Array(64);
  let bandPeak = new Float32Array(64);        /* 每频段的自动增益参考值 */
  let smoothLevel = 0, smoothBass = 0, time = 0;
  let bassSlow = 0, beatEnv = 0;      /* 鼓点检测用 */
  let prevBands = new Float32Array(64);
  let fluxAvg = 0, fxBass = 0, fxFlux = 0, fxFluxAvg = 0, fxRaw = [];

  /* 彩色(只给几何体和圆环用)*/
  function hueFor(i) {
    if (!cfg.colorful.on) return null;
    return (huePhase + i * cfg.colorful.spread) % 1;
  }
  function applyHue(mat, i, alpha) {
    const h = hueFor(i);
    if (h == null) mat.color.set(baseColor);
    else mat.color.setHSL(h < 0 ? h + 1 : h, cfg.colorful.sat, cfg.colorful.light);
    mat.opacity = alpha;
  }

  function setColor(hex) {
    if (!hex) return;
    baseColor = hex;
    if (!cfg.colorful.on) {
      const c = new THREE.Color(hex);
      parts.forEach((p) => p.mesh.material.color.copy(c));
      rayMat.color.copy(c);
      rings.forEach((r) => r.mesh.material.color.copy(c));
    }
  }

  /* CD 半径若被外部更新(改模型/改大小),重算发射位置 */
  function setCdRadius(r) { if (r > 0) R0 = r; }

  function setMode(name, on) {
    if (!(name in cfg.on)) return;
    cfg.on[name] = !!on;
    if (name === "rays") rays.visible = !!on;
    if (name === "particles" && !on) parts.forEach((p) => { p.life = 0; p.mesh.visible = false; });
    if (name === "rings" && !on) rings.forEach((r) => { r.t = -1; r.mesh.visible = false; });
    if (!cfg.on.arc) arc2d.clearRect(0, 0, W, H);
    if (!cfg.on.lines) bg2d.clearRect(0, 0, W, H);
  }

  function update(dt, info) {
    time += dt;
    const raw = levelsFn ? levelsFn() : null;
    const idle = !raw || !raw.playing;
    const k = Math.min(1, dt / Math.max(0.016, cfg.smooth));

    let level, bass;
    if (idle) {
      const b = cfg.idle ? 0.12 + 0.08 * Math.sin(time * 1.1) : 0;
      level = b; bass = b * 0.9;
      for (let i = 0; i < smoothBands.length; i++) {
        smoothBands[i] += ((cfg.idle ? 0.07 + 0.06 * Math.sin(time * 1.1 + i * 0.4) : 0) - smoothBands[i]) * k;
      }
    } else {
      level = raw.level; bass = raw.bass;
      /* 频带数变了就重建(音频模块以后改段数也不会崩)*/
      if (smoothBands.length !== raw.bands.length) {
        smoothBands = new Float32Array(raw.bands.length);
        bandPeak = new Float32Array(raw.bands.length);
      }
      /* 每频段自动增益:低频天然比高频响得多,直接映射会让中间的条子一直顶满。
         这里记下每个频段自己的峰值(缓慢衰减),再用当前值除以它 → 每根条子都能跳满自己的量程 */
      const A = cfg.agc;
      const decay = Math.min(1, dt * (A.decay != null ? A.decay : 0.5));
      for (let i = 0; i < smoothBands.length; i++) {
        const v = raw.bands[i];
        if (v > bandPeak[i]) bandPeak[i] = v;
        else bandPeak[i] += (v - bandPeak[i]) * decay;
        const nv = v / Math.max(bandPeak[i], A.floor != null ? A.floor : 0.12);
        smoothBands[i] += (Math.min(1.15, nv) - smoothBands[i]) * k;
      }
    }
    smoothLevel += (level - smoothLevel) * k;
    smoothBass += (bass - smoothBass) * k;

    /* ---- 鼓点检测 ----
       平滑后的总音量几乎是恒定的(所以背景看不出律动)。这里用**低频的"突增"(谱通量)**做onset:
       只看低频那几段每帧涨了多少,再跟它自己的平均涨速比 —— 突然涨得多就是一下鼓点。
       比"低频绝对值超过某个阈值"稳:低频常年饱和在 1.0,绝对阈值法根本分不出来 */
    {
      const B = cfg.beat;
      const nb = raw.bands ? raw.bands.length : smoothBands.length;
      if (prevBands.length !== nb) prevBands = new Float32Array(nb);
      const lowN = Math.max(4, Math.round(nb * (B.lowRatio != null ? B.lowRatio : 0.25)));
      let flux = 0;
      for (let i = 0; i < lowN && i < nb; i++) {
        const v = raw.bands ? raw.bands[i] : 0;
        const d = v - prevBands[i];
        if (d > 0) flux += d;
        prevBands[i] = v;
      }
      flux /= Math.max(1, lowN);
      fluxAvg += (flux - fluxAvg) * Math.min(1, dt * (B.avg != null ? B.avg : 1.2));
      /* 用"相对涨速"判断,跟音量大小无关;gain 决定灵敏度 */
      const rel = flux / Math.max(0.004, fluxAvg);
      const over = Math.max(0, rel - (B.thresh != null ? B.thresh : 1.4));
      const hit = Math.min(1, over * (B.gain != null ? B.gain : 4));
      if (hit > beatEnv) beatEnv = hit;
      /* 半衰期式衰减:帧率低的时候也不会被一帧清空(线性衰减会) */
      beatEnv *= Math.pow(0.5, dt / Math.max(0.02, B.halfLife != null ? B.halfLife : 0.12));
      fxBass = bass; fxFlux = flux; fxFluxAvg = fluxAvg;
      fxRaw = raw.bands ? Array.from(raw.bands.slice(0, 6)).map((v) => +v.toFixed(3)) : [];
      if (idle) beatEnv = Math.max(beatEnv, 0.10 + 0.10 * Math.sin(time * 1.4));
    }

    if (cfg.colorful.on) huePhase = (huePhase + dt * cfg.colorful.speed * (0.6 + smoothLevel * 1.6)) % 1;

    const visible = !!(info && info.visible);
    if (visible) {
      group.position.set(info.x, info.y, behindZ);
      group.visible = true;
    } else {
      group.visible = false;
    }

    /* ---- 粒子:从盘底向外弹射(发射半径按 CD 半径算)---- */
    if (cfg.on.particles && visible) {
      const rel = Math.max(0, smoothLevel);
      const P = cfg.particles;
      parts.forEach((p, i) => {
        if (p.life <= 0) {
          /* 一直都有:不再等"有声音才发",只是大小/速度仍然跟着音乐走 */
          if (Math.random() > P.spawn) return;
          const a = Math.random() * Math.PI * 2;
          const r0 = R0 * (0.15 + Math.random() * 0.5);
          p.mesh.position.set(Math.cos(a) * r0, Math.sin(a) * r0, 0);
          const sMin = P.speedMin != null ? P.speedMin : 0.2;
          const sp = P.speed * R0 * (sMin + Math.random() * (1 - sMin)) * (0.6 + rel * 1.6);
          p.vx = Math.cos(a) * sp;
          p.vy = Math.sin(a) * sp;
          /* 寿命按"目标飞行距离 / 速度"算,而不是固定时间 ——
             以前慢的粒子刚走一小段就没了,现在快慢都会飞差不多远 */
          const travel = (P.dist != null ? P.dist : 2.6) * R0 * (0.7 + Math.random() * 0.6) * (0.7 + rel * 0.8);
          p.max = Math.max(P.life * 0.5, Math.min(P.life * 5, travel / Math.max(0.05, sp)));
          p.life = p.max;
          p.rot = Math.random() * 6.28;
          p.spin = (Math.random() - 0.5) * 5;
          const s = P.size * R0 * (0.6 + Math.random() * 0.9);
          p.mesh.scale.set(s, s, s);
          p.mesh.geometry = Math.random() < P.hollowRatio
            ? hollowGeos[i % hollowGeos.length]
            : solidGeos[i % solidGeos.length];
          p.hue = i;
          p.mesh.visible = true;
        } else {
          p.life -= dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.rot += p.spin * dt;
          p.mesh.rotation.z = p.rot;
          const t = Math.max(0, p.life / p.max);
          applyHue(p.mesh.material, p.hue, Math.min(1, t * 1.15) * (P.alpha != null ? P.alpha : 0.85) * (0.75 + rel * 0.45));
          if (p.life <= 0) p.mesh.visible = false;
        }
      });
    }

    /* ---- 射线:细长四边形,长度/宽度都随频谱 ---- */
    if (cfg.on.rays && visible) {
      const RA = cfg.rays;
      const nb = smoothBands.length;
      const pos = rayGeo.attributes.position.array;
      const halfW = RA.width * 0.5;
      for (let i = 0; i < rayCount; i++) {
        const a = (i / rayCount) * Math.PI * 2;
        const band = smoothBands[Math.floor((i / rayCount) * nb) % nb];
        const len = RA.minLen + band * RA.maxLen * (0.4 + smoothLevel);
        const ca = Math.cos(a), sa = Math.sin(a);
        const px = -sa * halfW, py = ca * halfW;      /* 垂直方向 */
        const r0 = R0, r1 = R0 + len;
        const o = i * 12;
        pos[o] = ca * r0 + px; pos[o + 1] = sa * r0 + py; pos[o + 2] = 0;
        pos[o + 3] = ca * r0 - px; pos[o + 4] = sa * r0 - py; pos[o + 5] = 0;
        pos[o + 6] = ca * r1 + px; pos[o + 7] = sa * r1 + py; pos[o + 8] = 0;
        pos[o + 9] = ca * r1 - px; pos[o + 10] = sa * r1 - py; pos[o + 11] = 0;
      }
      rayGeo.attributes.position.needsUpdate = true;
      const h = hueFor(2);
      if (h == null) rayMat.color.set(baseColor); else rayMat.color.setHSL(h, cfg.colorful.sat, cfg.colorful.light);
      rayMat.opacity = RA.alpha * (0.35 + smoothLevel * 1.05);
      rays.visible = true;
    } else {
      rays.visible = false;
    }

    /* ---- 圆环:概率触发 + 分瓣微浮动(基准半径 = CD 半径)---- */
    if (cfg.on.rings && visible) {
      ringCool -= dt;
      const R = cfg.rings;
      if (ringCool <= 0 && (smoothBass > R.threshold || idle)) {
        if (Math.random() < R.chance || idle) {
          const r = rings.find((x) => x.t < 0);
          if (r) {
            r.t = 0;
            r.mesh.visible = true;
            for (let i = 0; i < R.segments; i++) r.offs[i] = (Math.random() * 2 - 1) * R.wobble;
          }
          ringCool = R.cooldown;
        } else {
          ringCool = R.cooldown * 0.35;
        }
      }
      rings.forEach((r, ri) => {
        if (r.t < 0) return;
        r.t += dt * R.speed * (0.6 + smoothBass);
        for (let i = 0; i < R.segments; i++) {
          r.offs[i] += (Math.random() * 2 - 1) * R.drift * dt * 0.35;
          const lim = R.wobble * 1.8;
          if (r.offs[i] > lim) r.offs[i] = lim;
          if (r.offs[i] < -lim) r.offs[i] = -lim;
        }
        const base = R0 * (1 + r.t);
        const half = R.width * 0.5;
        const pos = r.mesh.geometry.attributes.position.array;
        const seg = R.segments;
        for (let i = 0; i <= RSEG; i++) {
          const tt = i / RSEG;
          const f = tt * seg;
          const i0 = Math.floor(f) % seg, i1 = (i0 + 1) % seg;
          const fr = f - Math.floor(f);
          const s = fr * fr * (3 - 2 * fr);
          const off = r.offs[i0] * (1 - s) + r.offs[i1] * s;
          const rr = base * (1 + off);
          const a = tt * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          const o = i * 6;
          pos[o] = ca * (rr - half); pos[o + 1] = sa * (rr - half); pos[o + 2] = 0;
          pos[o + 3] = ca * (rr + half); pos[o + 4] = sa * (rr + half); pos[o + 5] = 0;
        }
        r.mesh.geometry.attributes.position.needsUpdate = true;
        const o2 = Math.max(0, 1 - r.t / (R.grow != null ? R.grow : 1.8));
        applyHue(r.mesh.material, ri + 3, o2 * R.alpha * (0.75 + smoothBass * 0.7));
        if (o2 <= 0.01) { r.t = -1; r.mesh.visible = false; }
      });
    }

    /* ---- 2D:音频条 ---- */
    if (cfg.on.arc && visible && info) {
      arc2d.clearRect(0, 0, W, H);
      const A = cfg.arc;
      const n = Math.max(6, A.bars | 0);
      const r0 = info.screenR + A.gap + smoothBass * (A.pulse || 0);
      arc2d.save();
      arc2d.lineCap = "round";
      arc2d.lineWidth = A.width;
      arc2d.strokeStyle = baseColor;
      arc2d.globalAlpha = A.alpha;
      const nb = smoothBands.length;
      /* 左墙:条子最长只能顶到这里(左侧开关列的位置),避免压住开关 */
      const wall = info.leftLimit && info.leftLimit > 0 ? info.leftLimit : 0;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ang = rad(A.from + (A.to - A.from) * t);
        const ux = Math.cos(ang), uy = -Math.sin(ang);
        /* 关键:一根条子对一个独立频段(不再镜像),这样才有"频谱一根根各跳各的"的样子;
           125° 那端是低频,235° 那端是高频 */
        const band = smoothBands[Math.min(nb - 1, Math.round(t * (nb - 1)))];
        const win = 1;
        const b = Math.min(1, band * (A.gain != null ? A.gain : 1));
        let len = A.minLen + b * (A.maxLen - A.minLen) * win;
        if (wall && ux < -0.01) {
          const room = (info.screenX - wall) / -ux - r0;    /* 这条方向最多能伸多长 */
          if (room < len) len = Math.max(A.minLen * 0.5, room);
        }
        arc2d.beginPath();
        arc2d.moveTo(info.screenX + ux * r0, info.screenY + uy * r0);
        arc2d.lineTo(info.screenX + ux * (r0 + len), info.screenY + uy * (r0 + len));
        arc2d.stroke();
      }
      arc2d.restore();
    } else if (!cfg.on.arc) {
      arc2d.clearRect(0, 0, W, H);
    }

    /* ---- 2D:背景(随机透明色多边形 + 随音量伸缩的线,同一个"背景"开关)---- */
    if (cfg.on.lines) {
      bg2d.clearRect(0, 0, W, H);
      const S = Math.min(W, H);
      /* 多边形:位置/大小/旋转/颜色全都固定不动(它们只是背景纹理,不跟着鼓点闪) */
      if (cfg.polys.count > 0) {
        const P = cfg.polys;
        for (const q of polyPattern) {
          bg2d.save();
          bg2d.globalAlpha = q.alpha;
          bg2d.fillStyle = "hsl(" + Math.round(q.hue * 360) + " " + Math.round(P.sat * 100) + "% " + Math.round(P.light * 100) + "%)";
          bg2d.translate(q.x * W, q.y * H);
          if (q.rot) bg2d.rotate(q.rot);
          const w = q.w * S, h = q.h * S;
          if (q.tri) {
            bg2d.beginPath();
            bg2d.moveTo(-w / 2, h / 2);
            bg2d.lineTo(w / 2, h / 2);
            bg2d.lineTo(0, -h / 2);
            bg2d.closePath();
            bg2d.fill();
          } else {
            bg2d.fillRect(-w / 2, -h / 2, w, h);
          }
          bg2d.restore();
        }
      }
      /* 线:只有它们跟着鼓点一下一下地伸长/变粗 */
      {
        const L = cfg.lines;
        const b = beatEnv;
        bg2d.strokeStyle = baseColor;
        bg2d.lineCap = "round";
        bg2d.globalAlpha = L.alpha != null ? L.alpha : 1;
        for (const ln of linePattern) {
          const len = Math.max(6, ln.len * (1 + b * L.grow) * W);
          bg2d.lineWidth = Math.min(ln.w * 3, ln.w + b * L.widthGrow);
          const x0 = ln.x * W, y0 = ln.y * H;
          bg2d.beginPath();
          bg2d.moveTo(x0, y0);
          bg2d.lineTo(x0 + Math.cos(ln.ang) * len, y0 + Math.sin(ln.ang) * len);
          bg2d.stroke();
        }
        bg2d.globalAlpha = 1;
      }
    } else {
      bg2d.clearRect(0, 0, W, H);
    }

    /* ---- 调试 ---- */
    fxdbg.level = +smoothLevel.toFixed(3);
    fxdbg.bass = +smoothBass.toFixed(3);
    fxdbg.bands = Array.from(smoothBands.slice(0, 8)).map((v) => +v.toFixed(3));
    fxdbg.particlesVisible = parts.filter((p) => p.mesh.visible).length;
    fxdbg.ringVisible = rings.filter((r) => r.mesh.visible).length;
    fxdbg.modes = Object.assign({}, cfg.on);
    fxdbg.visible = visible;
    fxdbg.hue = +huePhase.toFixed(3);
    fxdbg.cdRadius = +R0.toFixed(3);
    fxdbg.beat = +beatEnv.toFixed(3);
    fxdbg.beatPeak = Math.max(fxdbg.beatPeak || 0, beatEnv);
    fxdbg.flux = +fxFlux.toFixed(4);
    fxdbg.fluxAvg = +fxFluxAvg.toFixed(4);
    fxdbg.bassRaw = +fxBass.toFixed(3);
    fxdbg.raw = fxRaw;
    if (visible && info) {
      const A = cfg.arc;
      fxdbg.arc0 = [Math.round(info.screenX), Math.round(info.screenY), Math.round(info.screenR)];
      let maxLen = 0;
      let minTip = null;
      const wall = info.leftLimit && info.leftLimit > 0 ? info.leftLimit : 0;
      const base0 = info.screenR + A.gap + (A.pulse || 0);
      for (let i = 0; i < A.bars; i++) {
        const t = A.bars === 1 ? 0.5 : i / (A.bars - 1);
        const band = smoothBands[Math.min(31, Math.round(t * (smoothBands.length - 1)))];
        const win = 1;
        const b = Math.min(1, band * A.gain);
        let len = A.minLen + b * (A.maxLen - A.minLen) * win;
        const ang = rad(A.from + (A.to - A.from) * t);
        const ux = Math.cos(ang);
        if (wall && ux < -0.01) {
          const room = (info.screenX - wall) / -ux - base0;
          if (room < len) len = Math.max(A.minLen * 0.5, room);
        }
        maxLen = Math.max(maxLen, len);
        const tip = info.screenX + ux * (base0 + len);
        if (minTip == null || tip < minTip) minTip = tip;
      }
      fxdbg.arcMaxLen = Math.round(maxLen);
      fxdbg.arcWall = Math.round(wall);
      fxdbg.arcLeftMost = Math.round(minTip != null ? minTip : info.screenX);
    }
  }

  const fxdbg = {
    level: 0, bass: 0, bands: [], particlesVisible: 0, ringVisible: 0,
    modes: Object.assign({}, cfg.on), visible: false, arc0: null, arcLeftMost: null,
    arcMaxLen: 0, hue: 0, behindZ: behindZ, cdRadius: R0, lines: cfg.lines.count,
    beat: 0, beatPeak: 0
  };
  if (typeof window !== "undefined") window.__cdFxDebug = fxdbg;

  return {
    group: group,
    canvas: arcCanvas,
    bgCanvas: bgCanvas,
    update: update,
    resize: resize,
    setColor: setColor,
    setCdRadius: setCdRadius,
    setMode: setMode,
    modes: function () { return Object.assign({}, cfg.on); },
    config: function () { return cfg; },
    debug: function () { return fxdbg; },
    pattern: function () { return linePattern; },
    destroy: function () {
      scene.remove(group);
      [arcCanvas, bgCanvas].forEach((c) => { if (c.parentNode) c.parentNode.removeChild(c); });
    }
  };
}
