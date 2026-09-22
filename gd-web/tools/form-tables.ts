/* 逐形态物理参量表(目标:对动画 + 全部形态参量做可复现审计)
 * 跑法:cd gd-web && node tools/form-tables.ts
 * 输出:每个形态的 下落加速度(每帧 Δvy)· 终端速度 · 跳跃峰值/滞空 · 特殊动作
 * 对照:cube 理论 gravity*0.9=0.8624/帧;ball/spider 应为 ×0.6;终端速度 15(源码 max(-15, gravity))
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U, P, Y_TIME_SCALE, cubeGravityOf } from '../src/sim/constants.ts';

const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'] as const;
const G = P.gravity * Y_TIME_SCALE;

function fresh(mode: string, y = 40, x = 60) {
  const w = new World(WATER_CHART);
  w.reset(x * U, mode as never, y * U);
  w.x = x * U; w.y = y * U; w.onGround = false; w.vy = 0; w.mode = mode as never;
  return w;
}

console.log('每帧重力基准 gravity×0.9 = ' + G.toFixed(4) + ' 单位/帧²  ·  理论终端速度 = 15(源码 max(-15,gravity))');
console.log('\n=== 下落(自由落体 12 帧)===');
console.log('形态      第1帧Δvy   第6帧Δvy   第12帧Δvy   vy@12帧    是否触到终端');
for (const m of MODES) {
  const w = fresh(m);
  const dv: number[] = []; let last = w.vy;
  for (let i = 0; i < 12; i++) { w.frame(false); dv.push(w.vy - last); last = w.vy; }
  console.log('  ' + m.padEnd(7) + dv[0].toFixed(4).padStart(9) + dv[5].toFixed(4).padStart(11)
    + dv[11].toFixed(4).padStart(12) + w.vy.toFixed(3).padStart(11) + '   ' + (Math.abs(w.vy) >= 14.9 ? '是' : '否'));
}

console.log('\n=== 跳跃(平地按住一帧起跳)===');
console.log('形态      峰值(格)   滞空(帧)   起跳初速(单位/帧)');
for (const m of MODES) {
  if (m === 'wave') { console.log('  wave     ——(无重力,45° 斜坡,见 gd 引擎 dash 表)'); continue; }
  const w = new World(WATER_CHART);
  w.reset(60 * U, m as never, 6 * U);
  w.mode = m as never; w.vy = 0; w.onGround = true;
  let peak = -1e9, air = 0, v0 = 0, started = false;
  for (let i = 0; i < 240; i++) {
    w.frame(i === 0);
    if (i === 0) v0 = w.vy;
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; }
    else if (started) break;
  }
  console.log('  ' + m.padEnd(7) + (peak - 6).toFixed(2).padStart(9) + String(air).padStart(11) + v0.toFixed(3).padStart(16));
}

console.log('\n=== 特殊动作 ===');
/* robot:点一下 vs 长按 */
for (const holdFrames of [1, 30]) {
  const w = new World(WATER_CHART);
  w.reset(60 * U, 'robot' as never, 6 * U);
  w.mode = 'robot' as never; w.vy = 0; w.onGround = true;
  let peak = -1e9, air = 0, started = false;
  for (let i = 0; i < 400; i++) {
    w.frame(i < holdFrames);
    peak = Math.max(peak, w.y / U);
    if (!w.onGround) { air++; started = true; } else if (started) break;
  }
  console.log('  robot ' + (holdFrames === 1 ? '点一下' : '长按30帧') + ' ⇒ 峰值 ' + (peak - 6).toFixed(2) + ' 格 · 滞空 ' + air + ' 帧');
}
/* spider:空中按一下应该没反应(只有落地才跳) */
{
  const w = fresh('spider', 40);
  const y0 = w.y;
  for (let i = 0; i < 10; i++) w.frame(i === 0);
  console.log('  spider 空中按一下 ⇒ y 位移 ' + ((w.y - y0) / U).toFixed(2) + ' 格(应只有下落,不该起跳)');
}
console.log('\n方块重力查表(cubeGravityOf 各档):' + [0, 1, 2, 3, 4].map((i) => i + '档=' + cubeGravityOf(i).toFixed(4)).join(' · '));
