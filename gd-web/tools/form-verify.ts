/* 逐形态验证(可重复运行):把"人工找点"的过程固化下来,以后每次改物理都跑一遍。
 * 跑法:cd gd-web && node tools/form-verify.ts
 * 三项检查:
 *   ① 跳跃表(干净平地:±15 格内除地面无任何物件)⇒ cube 峰值应 ≈2.17 格(原作值)
 *   ② 天花板段:ball 峰值应≈天花板(球翻重力后贴天花板)✓ spider 峰值应=天花板(瞬移)✓
 *   ③ 重力倍率:cube 1.0 / ball 0.6 / spider 0.6 / robot 0.9(源码 updateJump:947)
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const objs = WATER_CHART.objects as Array<Record<string, unknown>>;
const MODES = ['cube', 'ball', 'robot', 'spider', 'ufo', 'ship'] as const;

function flatSpot(): number {
  const solidish = objs.filter((o) => o.kind !== 'platform');
  for (let x = -40; x < 3600; x++) if (!solidish.some((o) => Math.abs((o.b as number) - x) < 15)) return x;
  return -1;
}
function ceilSpot(): { x: number; ceil: number } {
  for (let x = 120; x < 3400; x++) {
    const above = objs.filter((o) => (o.kind === 'block' || o.kind === 'platform')
      && (o.b as number) <= x + 1 && (o.b as number) + 1 >= x && (o.r as number) >= 3 && (o.r as number) <= 6);
    if (above.length) return { x, ceil: Math.min(...above.map((o) => o.r as number)) };
  }
  return { x: -1, ceil: 0 };
}
function jump(mode: string, x: number, frames = 400) {
  const w = new World(WATER_CHART);
  w.reset(x * U, mode as never, 0.5 * U);
  w.x = x * U; w.y = 0.2 * U; w.mode = mode as never; w.vy = 0; w.onGround = true;
  let v0 = 0, peak = -1e9, air = 0, started = false, gdir0 = w.gdir;
  for (let i = 0; i < frames; i++) {
    w.frame(i === 0);
    if (i === 0) v0 = w.vy;
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; } else if (started) break;
    if (w.dead) break;
  }
  return { v0, peak, air, gdir0, gdir: w.gdir, onGround: w.onGround };
}

const flat = flatSpot();
console.log('① 跳跃表 @ 干净平地 x=' + flat);
console.log('   形态      初速      峰值(格)  滞空(帧)');
for (const m of MODES) {
  const r = jump(m, flat);
  console.log('     ' + m.padEnd(7) + r.v0.toFixed(3).padStart(9) + r.peak.toFixed(2).padStart(11) + String(r.air).padStart(11));
}

const { x: cx, ceil } = ceilSpot();
console.log('\n② 天花板段 @ x=' + cx + '(天花板 y=' + ceil + ')');
for (const m of ['ball', 'spider'] as const) {
  const r = jump(m, cx, 200);
  const ok = Math.abs(r.peak - ceil) < 1.2;
  console.log('     ' + m.padEnd(7) + '峰值 ' + r.peak.toFixed(2) + ' 格 · 滞空 ' + r.air + ' 帧 · gdir ' + r.gdir0 + '→' + r.gdir
    + (ok ? '  ✓ 顶到天花板(合理)' : '  ✗ 与天花板 ' + ceil + ' 不符'));
}

console.log('\n③ 重力倍率(每帧 Δvy ÷ 0.8624 = gravity×0.9)');
for (const m of MODES) {
  const w = new World(WATER_CHART);
  w.reset(flat * U, m as never, 40 * U);
  w.x = flat * U; w.y = 40 * U; w.mode = m as never; w.vy = 0; w.onGround = false;
  let last = w.vy;
  for (let i = 0; i < 3; i++) w.frame(false);
  const dv = Math.abs(w.vy - last);
  console.log('     ' + m.padEnd(7) + 'Δvy=' + dv.toFixed(4) + '  倍率 ' + (dv / 0.8624).toFixed(3)
    + '  (源码:cube 1.0 / ball 0.6 / spider 0.6 / robot 0.9 / 飞行类另算)');
}
