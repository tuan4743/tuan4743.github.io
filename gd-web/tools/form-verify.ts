/* 逐形态验证(可重复运行)。目标第 6 轮修正:
 *  ① 平地选择器改成【自证】:必须能站住(放上去 3 帧内 onGround 且 y 稳定)才算平地 ✗
 *  ② 重力栏除以帧数(上一轮打印的是 3 帧累计 ✗)
 *  ③ 增加 robot 的【点按 vs 长按】对照
 * 跑法:cd gd-web && node tools/form-verify.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const objs = WATER_CHART.objects as Array<Record<string, unknown>>;
const MODES = ['cube', 'ball', 'robot', 'spider', 'ufo', 'ship'] as const;
const G = 0.958199 * 0.9;   // gravity × 0.9

function mk(mode: string, x: number, y: number) {
  const w = new World(WATER_CHART);
  w.reset(x * U, mode as never, y * U);
  w.x = x * U; w.y = y * U; w.mode = mode as never; w.vy = 0; w.onGround = true;
  return w;
}
/* 自证平地:放上去不按,6 帧后仍在原地(±0.05 格)且 onGround ⇒ 是平整地面 ✓ */
function isFlat(x: number): boolean {
  const w = mk('cube', x, 0.5);
  const y0 = w.y;
  for (let i = 0; i < 6; i++) w.frame(false);
  return w.onGround && !w.dead && Math.abs(w.y - y0) < 0.05 * U;
}
function findFlat(): number {
  const solidish = objs.filter((o) => o.kind !== 'platform');
  for (let x = 20; x < 3600; x++) {
    if (solidish.some((o) => Math.abs((o.b as number) - x) < 15)) continue;
    if (isFlat(x)) return x;
  }
  return -1;
}
function jump(mode: string, x: number, holdFrames = 1, frames = 400) {
  const w = mk(mode, x, 0.5);
  let v0 = 0, peak = -1e9, air = 0, started = false, g0 = w.gdir;
  for (let i = 0; i < frames; i++) {
    w.frame(i < holdFrames);
    if (i === 0) v0 = w.vy;
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; } else if (started) break;
    if (w.dead) break;
  }
  return { v0, peak, air, g0, gdir: w.gdir };
}

const flat = findFlat();
console.log('① 跳跃表 @ 自证平地 x=' + flat + '(放上去 6 帧原地不动才采用)');
console.log('   形态      初速      峰值(格)  滞空(帧)');
for (const m of MODES) {
  const r = jump(m, flat);
  console.log('     ' + m.padEnd(7) + r.v0.toFixed(3).padStart(9) + r.peak.toFixed(2).padStart(11) + String(r.air).padStart(11));
}

console.log('\n② robot 点按 vs 长按(源码 updateJump:7 shouldJump = hasJustHeld & isHolding)');
for (const hf of [1, 40]) {
  const r = jump('robot', flat, hf);
  console.log('     ' + (hf === 1 ? '点按 1 帧 ' : '长按 40 帧') + '⇒ 初速 ' + r.v0.toFixed(3) + ' · 峰值 ' + r.peak.toFixed(2) + ' 格 · 滞空 ' + r.air + ' 帧');
}

console.log('\n③ 重力倍率(Δvy ÷ ' + G.toFixed(4) + ',单帧)');
for (const m of MODES) {
  const w = mk(m, flat, 40);
  w.onGround = false;
  const before = w.vy;
  w.frame(false);
  const dv = Math.abs(w.vy - before);
  console.log('     ' + m.padEnd(7) + 'Δvy=' + dv.toFixed(4) + '  倍率 ' + (dv / G).toFixed(3)
    + '  (源码:cube 1.0 / ball 0.6 / spider 0.6 / robot 0.9 / 飞行类另算)');
}
