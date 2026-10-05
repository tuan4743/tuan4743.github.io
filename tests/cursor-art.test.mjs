/* 磁吸光标:源码 + 样式 + 指纹三层验收。 跑法见 tests/README.md */
import fs from 'node:fs';
import path from 'node:path';

const WS = 'C:/Users/hp/Desktop/GLM-workspace';
const BH = `${WS}/tuagfey-blog`;
const rows = [];
const ok = (n, p, i) => rows.push([!!p, n, i === undefined ? '' : String(i)]);

function makeCtx(rec) {
  const ctx = {
    __lastRot: 0,
    m: [1, 0, 0, 1, 0, 0], stack: [],
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, lineCap: 'butt',
    globalAlpha: 1, shadowColor: 'transparent', shadowBlur: 0,
    save() { this.stack.push({ m: this.m.slice(), g: this.globalAlpha, ss: this.strokeStyle, fs: this.fillStyle, lw: this.lineWidth, sc: this.shadowColor, sb: this.shadowBlur }); },
    restore() { const s = this.stack.pop(); if (!s) return; this.m = s.m; this.globalAlpha = s.g; this.strokeStyle = s.ss; this.fillStyle = s.fs; this.lineWidth = s.lw; this.shadowColor = s.sc; this.shadowBlur = s.sb; },
    setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; },
    translate(x, y) { this.m[4] += this.m[0] * x + this.m[2] * y; this.m[5] += this.m[1] * x + this.m[3] * y; },
    scale(x, y) { this.m[0] *= x; this.m[1] *= x; this.m[2] *= y; this.m[3] *= y; },
    rotate(r) { this.__lastRot = r; const c = Math.cos(r), s = Math.sin(r); this.m = [this.m[0] * c + this.m[2] * s, this.m[1] * c + this.m[3] * s, this.m[0] * -s + this.m[2] * c, this.m[1] * -s + this.m[3] * c, this.m[4], this.m[5]]; },
    clearRect() {},
    createLinearGradient(x1, y1, x2, y2) { const g = { stops: [], x1, y1, x2, y2 }; g.addColorStop = (o, c) => g.stops.push([o, c]); return g; },
    createRadialGradient(x1, y1, r1, x2, y2, r2) { const g = { stops: [], radial: [x1, y1, r1, x2, y2, r2] }; g.addColorStop = (o, c) => g.stops.push([o, c]); return g; },
    beginPath() { this.cur = { moveTo: null, lineTo: null, arcs: [] }; },
    tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    moveTo(x, y) { this.cur.moveTo = this.tp(x, y); },
    lineTo(x, y) { this.cur.lineTo = this.tp(x, y); },
    arc(x, y, r, a0, a1) { this.cur.arcs.push({ x: this.tp(x, y)[0], y: this.tp(x, y)[1], r, a0, a1 }); },
    closePath() {},
    stroke() {
      const rot = this.__lastRot;
      rec.push({
        op: 'stroke', deg: +(rot * 180 / Math.PI).toFixed(3), alpha: this.globalAlpha,
        stops: this.strokeStyle && this.strokeStyle.stops ? this.strokeStyle.stops.slice() : null,
        style: typeof this.strokeStyle === 'string' ? this.strokeStyle : null,
        lineWidth: this.lineWidth, shadowBlur: this.shadowBlur, shadowColor: this.shadowColor,
        moveTo: this.cur.moveTo, lineTo: this.cur.lineTo, arcs: this.cur.arcs.slice()
      });
      ctx.rotate(-rot); ctx.__lastRot = 0;
    },    fill() {
      rec.push({
        op: 'fill', deg: +(this.__lastRot * 180 / Math.PI).toFixed(3), alpha: this.globalAlpha,
        fillStyle: this.fillStyle, fillStops: this.fillStyle && this.fillStyle.stops ? this.fillStyle.stops.slice() : null,
        shadowBlur: this.shadowBlur, shadowColor: this.shadowColor, arcs: this.cur.arcs.slice()
      });
    }
  };
  return ctx;
}

let BOOT_ID = 0;
function boot() {
  const MY = ++BOOT_ID;
  const rec = [];
  const listeners = {};
  const ctx = makeCtx(rec);
  const mkEl = (tag) => {
    const cls = new Set();
    return {
      tagName: String(tag).toUpperCase(), className: '', style: {}, dataset: {}, attrs: {},
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c) => (cls.has(c) ? cls.delete(c) : cls.add(c)), contains: (c) => cls.has(c) },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      appendChild() {}, removeChild() {}, contains() { return false; },
      addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
      querySelectorAll() { return []; }, querySelector() { return null; },
      getContext() { return ctx; }
    };
  };
  const root = mkEl('html');
  root.clientWidth = 1920; root.clientHeight = 1080;
  const body = mkEl('body');
  let rafCb = null, clock = 0;
  const win = {
    __MC_BOOT: MY,
    matchMedia: (q) => ({ matches: false, media: q }),
    innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
    requestAnimationFrame: (cb) => { if (MY !== BOOT_ID) return 0; rafCb = cb; return 1; },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' })
  };
  const doc = {
    documentElement: root, body, createElement: mkEl,
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener() {},
    querySelectorAll: () => [], querySelector: () => null, elementFromPoint: () => null
  };
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.requestAnimationFrame = win.requestAnimationFrame;
  globalThis.performance = { now: () => clock };
  globalThis.devicePixelRatio = 1;
  globalThis.getComputedStyle = win.getComputedStyle;

  const code = fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, 'utf8');
  new Function(code)();

  const fire = (t, ev) => (listeners[t] || []).forEach((f) => f(ev));
  const frame = (ms) => { clock = ms; const cb = rafCb; rafCb = null; if (cb) cb(clock); };
  return { rec, win, fire, frame };
}

{
  const rec = [];
  const c = makeCtx(rec);
  c.save(); c.translate(100, 50); c.rotate(Math.PI / 2);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(10, 0); c.stroke();
  const s = rec[0];
  ok('自检:录制器把旋转后的坐标还原成世界坐标',
    Math.abs(s.lineTo[0] - 100) < 1e-6 && Math.abs(s.lineTo[1] - 60) < 1e-6,
    `lineTo=${JSON.stringify(s.lineTo)}`);
  ok('自检:录制器读到了旋转角 90°', Math.abs(s.deg - 90) < 1e-6, `deg=${s.deg}`);
  ok('自检:配平之后矩阵恢复恒等', Math.abs(c.m[0] - 1) < 1e-9 && Math.abs(c.m[1]) < 1e-9);
}

{
  const { rec, win, fire, frame } = boot();
  rec.length = 0;
  win.__mcPenCfg = { shape: 'x', size: 26, on: true };
  fire('mousemove', { clientX: 900, clientY: 500, target: null });
  for (let i = 0; i < 90; i++) {
    fire('mousemove', { clientX: 900 + i * 6, clientY: 500 + i * 3, target: null });
    frame(400 + i * 16);
  }
  const arms = rec.filter((r) => r.op === 'stroke' && r.moveTo && r.lineTo);
  ok('× 形态:四条臂每帧都画了(4 臂 × 2 笔)', arms.length === 90 * 8, `arms=${arms.length}`);

  const degs = arms.map((a) => a.deg);
  const uniq = new Set(degs.map((d) => Math.round(d)));
  ok('★ × 的四条臂真的吃到 rot(不再恒为 0)', uniq.size > 30 && degs.some((d) => Math.abs(d) > 5),
    `不同角度=${uniq.size} 例:${[...uniq].slice(0, 6).join(',')}`);
  const perFrame = [];
  for (let i = 0; i + 8 <= arms.length; i += 8) perFrame.push(arms[i].deg);
  let swept = 0, rising = 0;
  for (let i = 1; i < perFrame.length; i++) {
    const d = perFrame[i] - perFrame[i - 1];
    swept += d;
    if (d > 0) rising++;
  }
  ok('★ × 随时间持续单向转动(不是抖一下就停)',
    rising >= (perFrame.length - 1) * 0.9 && swept > 25,
    `单调上升 ${rising}/${perFrame.length - 1} 帧,累计转过 ${swept.toFixed(1)}°,末帧 ${perFrame[perFrame.length - 1]}°`);
  ok('★ 笔形态下也能读到自转角(排障出口不再被 return 吃掉)',
    !!win.__mc && Object.prototype.hasOwnProperty.call(win.__mc, 'pen') && win.__mc.pen === 'x',
    JSON.stringify(win.__mc));

  const coreAt = (r) => {
    if (!r.stops) return null;
    const w = r.stops.find((s) => s[0] > 0 && /255,255,255/.test(s[1]));
    return w ? w[0] : 0;
  };
  const coreVals = arms.map(coreAt).filter((v) => v !== null);
  const spread = Math.max(...coreVals) - Math.min(...coreVals);
  ok('★ × 的白芯随 rot 沿臂移动(90° 对称下唯一看得见的旋转线索)', spread > 0.3,
    `白芯位置 0~${Math.max(...coreVals).toFixed(2)},跨度 ${spread.toFixed(2)}`);

  const starts = new Set(arms.slice(-8).map((a) => a.moveTo.join(',')));
  const want = [(900 + 89 * 6), (500 + 89 * 3)].join(',');
  ok('× 的臂从光标真实位置出发', starts.size === 1 && starts.has(want), `起点=${[...starts].join(' / ')} 期望=${want}`);

  const fills = rec.filter((r) => r.op === 'fill');
  ok('★ 记号笔下中心光点每帧都画(不再消失)', fills.length === 90 * 2, `fills=${fills.length}`);
  const solid = fills.filter((r) => r.fillStyle === '#eaf3ff');
  const dotR = solid.length ? solid[solid.length - 1].arcs[0].r : 0;
  ok('★ 中心光点半径回到 DOT/2 级别(不是 DOT/5 = 1.2px)', dotR >= 2.5 && dotR <= 4,
    `r=${dotR} (--mc-dot:6px ⇒ DOT/2 = 3)`);
  ok('中心光点画在鼠标真实位置', solid.length > 0 && Math.abs(solid[solid.length - 1].arcs[0].x - (900 + 89 * 6)) < 1,
    JSON.stringify(solid.length ? solid[solid.length - 1].arcs[0] : null));
}

{
  const { rec, win, fire, frame } = boot();
  rec.length = 0;
  win.__mcPenCfg = { shape: 'ring', size: 30, on: true };
  fire('mousemove', { clientX: 900, clientY: 500, target: null });
  for (let i = 0; i < 90; i++) {
    fire('mousemove', { clientX: 900 + i * 6, clientY: 500, target: null });
    frame(400 + i * 16);
  }
  const arcs = rec.filter((r) => r.op === 'stroke' && r.arcs.length);
  const degs = arcs.map((a) => a.deg);
  ok('圆框:四段弧每帧都画了', arcs.length === 90 * 8, `arcs=${arcs.length}`);
  ok('★ 圆框跟着 rot 转', Math.max(...degs) - Math.min(...degs) > 20,
    `角度范围 ${Math.min(...degs).toFixed(1)}° ~ ${Math.max(...degs).toFixed(1)}°`);
  ok('圆框仍带青色外发光(内发光没丢)', arcs.some((a) => a.shadowBlur > 0 && /127,240,255/.test(a.shadowColor)));
  const rf = rec.filter((r) => r.op === 'fill' && r.fillStyle === '#eaf3ff');
  ok('圆框下中心光点也在', rf.length === 90 * 1, `fills=${rf.length}`);
}

{
  const { rec, win, fire, frame } = boot();
  rec.length = 0;
  win.__mcPenCfg = null;
  fire('mousemove', { clientX: 600, clientY: 300, target: null });
  for (let i = 0; i < 30; i++) frame(100 + i * 16);
  const f = rec.filter((r) => r.op === 'fill' && r.fillStyle === '#eaf3ff');
  ok('未锁定:中心光点画了', f.length === 30, `fills=${f.length}`);
  const idleR = f[0].arcs[0].r;
  ok('未锁定:光点半径 = DOT/2 带呼吸(2.2~3.8px)', idleR >= 2.2 && idleR <= 3.8, `r=${idleR.toFixed(2)}`);
  ok('未锁定:光点是一层柔光 + 一颗实心(两份 fill)',
    rec.filter((r) => r.op === 'fill' && r.fillStops).length === 30);
  const solidR = f.map((r) => r.arcs[0].r);
  ok('未锁定与笔形态的光点半径同源(呼吸幅度之内)',
    Math.abs(Math.max(...solidR) - Math.min(...solidR)) <= 3 * 0.26 + 0.001,
    `半径范围 ${Math.min(...solidR).toFixed(2)} ~ ${Math.max(...solidR).toFixed(2)}`);
}

{
  src_check: {
    const src = fs.readFileSync(`${BH}/assets/js/magnetic-cursor.js`, "utf8");
    const block = (src.match(/var SELECTOR = \[([\s\S]*?)\]\.join\(","\)/) || [, ""])[1]
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = (block.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
    const sel = rules.join(",");
    ok('选择器条目能正常切出来(逐条,不按行)', rules.length > 20, `rule 数=${rules.length}`);
    ok('★ 正文里所有链接都进白名单(main.main a,排除锚点)',
      /main\.main a:not\(\.anchor\)/.test(sel), '没有再犯"只认 button"的老毛病');
    ok('标签在列表里', /\.post-tags a/.test(sel) || /\.terms-tags a/.test(sel));
    ok('上下一页/翻页在列表里', /\.paginav a/.test(sel) && /\.post-nav a/.test(sel));
    ok('面包屑/页脚链接在列表里', /\.breadcrumbs a/.test(sel) && /\.footer a/.test(sel));
    const bodyWide = rules.filter((r) => /^(main\.main a|\.post-single a|\.post-content a)(:|$)/.test(r));
    const leaky = bodyWide.filter((r) => !/:not\(\.anchor\)/.test(r));
    ok('★ 覆盖整篇正文的那几条规则都排除了 .anchor', bodyWide.length >= 3 && leaky.length === 0,
      `正文级规则 ${bodyWide.length} 条,漏的:${leaky.join(" | ") || "无"}`);
    ok('碎片的排除还在(那是用户明确要求不吸的)', /button:not\(\.frost-shard\)/.test(sel));
    ok('LOGO 仍然不吸(用户:"它只是个 LOGO")',
      !rules.some((r) => r.trim() === ".hud-logo"), rules.filter((r) => r.indexOf("hud-logo") >= 0).join(" | ") || "(未出现)");
  }
}

let bad = 0;
const pad = (s, n) => String(s).padEnd(n);
rows.forEach(([p, n, i]) => {
  if (!p) bad++;
  console.log(`${p ? 'PASS' : 'FAIL'}  ${pad(n, 52)} ${i}`);
});
console.log(`\n${rows.length - bad}/${rows.length} 通过` + (bad ? `  ★ ${bad} 条失败` : ''));
process.exit(bad ? 1 : 0);
