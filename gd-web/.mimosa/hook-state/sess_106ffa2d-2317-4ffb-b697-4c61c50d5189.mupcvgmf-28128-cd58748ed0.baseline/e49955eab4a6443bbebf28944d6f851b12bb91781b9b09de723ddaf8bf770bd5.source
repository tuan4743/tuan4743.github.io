/* 搜索式机器人的算法选型要先看速度:一帧物理多少钱、存档/读档多少钱、
   有没有"会动的盒子"(有就不许窗口裁剪,搜索会慢一个数量级)。
   跑法:node tools/bench-sim.ts
   ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const lv = WATER_CHART;
const w = new World(lv);
console.log('铺面 ' + lv.name + ' · 物件 ' + lv.objects.length + ' · 长 ' + lv.length + ' 块 · 高 ' + lv.rows + ' 格');
console.log('判定盒:实心 ' + w.solids.length + ' · 线框 ' + w.frames.length + ' · 平台 ' + w.floors.length
  + ' · 刺 ' + w.hazards.length + ' · 弹簧 ' + w.pads.length + ' · 跳环 ' + w.orbs.length
  + ' · 门 ' + w.portals.length + ' · 会动 ' + w.movables.length + ' · 触发器 ' + w.triggers.length);

try { w.windowed = true; console.log('窗口裁剪:开'); }
catch (e) { console.log('窗口裁剪:开不了 —— ' + (e as Error).message); }

/* 0. 预热(JIT:第一次跑的那 182 帧里有一半是在编译,别拿它当速度) */
w.resetToStart();
const tw = performance.now();
while (!w.dead && !w.done && w.tick < 3000) w.frame(botThink(w));
console.log('预热 ' + w.tick + ' 帧 · ' + ((performance.now() - tw) / 1000).toFixed(3) + 's');

/* 1a. 空跑(不调机器人) */
function timeRun(useBot: boolean, frames: number) {
  w.resetToStart();
  const t = performance.now();
  for (let i = 0; i < frames; i++) { if (w.dead || w.done) break; w.frame(useBot ? botThink(w) : (i % 7 < 3)); }
  const dt = (performance.now() - t) / 1000;
  return { dt, tick: w.tick, x: w.x };
}
const a = timeRun(false, 1200), b = timeRun(true, 1200);
console.log('空跑 ' + a.tick + ' 帧 · ' + a.dt.toFixed(3) + 's → ' + (a.dt / a.tick * 1e6).toFixed(1) + ' µs/帧(到 x=' + (a.x / U).toFixed(0) + ')');
console.log('机器人 ' + b.tick + ' 帧 · ' + b.dt.toFixed(3) + 's → ' + (b.dt / b.tick * 1e6).toFixed(1) + ' µs/帧(到 x=' + (b.x / U).toFixed(0) + ')');
const t0 = performance.now();
void t0;

/* 2. 存档 / 读档 */
w.resetToStart();
for (let i = 0; i < 60; i++) w.frame(botThink(w));
const snaps = [];
const t1 = performance.now();
for (let i = 0; i < 20000; i++) snaps.push(w.snapshot());
const dt1 = performance.now() - t1;
const t2 = performance.now();
for (let i = 0; i < 20000; i++) w.restore(snaps[i]);
const dt2 = performance.now() - t2;
console.log('存档 ' + (dt1 / 20).toFixed(2) + ' µs/次 · 读档 ' + (dt2 / 20).toFixed(2) + ' µs/次');

/* 3. 真实搜索节奏:存档→跑 N 帧→再存档(一次试算的样子) */
const base = w.snapshot();
const t3 = performance.now();
let trials = 0;
for (let k = 0; k < 2000; k++) {
  w.restore(base);
  for (let i = 0; i < 12; i++) w.frame(true);
  w.snapshot();
  trials++;
}
const dt3 = (performance.now() - t3) / 1000;
console.log('试算 12 帧 ×' + trials + ' 次 · ' + dt3.toFixed(3) + 's → ' + Math.round(trials / dt3) + ' 次/秒');
