/* 动画逐帧角度表(目标第 11 轮)。
 * 说明:角度公式写在渲染层(main.ts drawIconPlayer / 自转状态机),不能直接 import ⇒
 *   这里把【公式原文】逐条抄下来,用真实的 sim 逐帧状态(onGround/x/vy)驱动,打印出曲线。
 *   用途:① 让人一眼看出曲线的形状对不对(船随 vy 倾斜、球随 x 滚动、波浪 ±45°、方块 180°/跳);
 *        ② 若某条曲线不合理(如倾斜恒为 0、方块角度不收敛),说明公式或状态有问题。
 * 跑法:cd gd-web && node tools/anim-angles.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U, P, Y_TIME_SCALE } from '../src/sim/constants.ts';

const SPIN_STEP = 2 * P.jump / (P.gravity * Y_TIME_SCALE);   // 标称滞空(帧)

function run(mode: string, hold: boolean, frames: number) {
  const w = new World(WATER_CHART);
  w.reset(-1 * U, mode as never, 0.5 * U);
  w.x = -1 * U; w.y = 0.2 * U; w.mode = mode as never; w.vy = 0; w.onGround = true;
  const rows: string[] = [];
  /* 方块自转状态机(抄自 main.ts 帧循环):airT 与 spinLast */
  let spin = 0;
  for (let i = 0; i < frames; i++) {
    w.frame(hold && i < 1);
    let ang: string;
    if (mode === 'cube') {
      /* main.ts:空中 目标 = 当前 − 180°,step = min(1, 0.175×spd/n);落地 目标 = 最近 90° 倍数 */
      const spd = Math.max(0.5, Math.abs(w.vx) / 5.7700018);
      const step = Math.min(1, 0.175 * spd);
      if (w.onGround) {
        const near = Math.round(spin / (Math.PI / 2)) * (Math.PI / 2);
        spin += (near - spin) * step;
      } else {
        spin += (spin - Math.PI - spin) * step;
      }
      ang = (spin * 180 / Math.PI).toFixed(1) + '°';
    } else if (mode === 'ship') {
      ang = (Math.max(-0.55, Math.min(0.55, w.vy / P.shipVyMax * 0.55)) * 180 / Math.PI).toFixed(1) + '°';
    } else if (mode === 'ufo') {
      ang = (Math.max(-0.3, Math.min(0.3, w.vy / P.flyUpMax * 0.3)) * 180 / Math.PI).toFixed(1) + '°';
    } else if (mode === 'ball') {
      ang = ((w.x / U) * 1.2 * 180 / Math.PI % 360).toFixed(1) + '°';
    } else if (mode === 'wave') {
      ang = ((w.vy >= 0 ? 1 : -1) * 45) + '°';
    } else {
      ang = '0°(robot/spider 不旋转)';
    }
    rows.push('  帧' + String(i).padStart(3) + '  onGround=' + (w.onGround ? 'Y' : 'n')
      + '  x=' + (w.x / U).toFixed(2).padStart(8) + '  vy=' + w.vy.toFixed(2).padStart(7) + '   角度=' + ang);
  }
  return rows;
}

console.log('标称滞空 = ' + SPIN_STEP.toFixed(1) + ' 帧(方块自转以它为基准)\n');
for (const [mode, hold, n] of [['cube', true, 30], ['ship', true, 14], ['ufo', true, 14], ['ball', true, 14], ['wave', true, 10], ['robot', true, 14]] as const) {
  console.log('=== ' + mode + ' (第 0 帧按住,其余松开)===');
  const rows = run(mode, hold, n);
  for (const r of rows.filter((_, i) => i % 4 === 0 || i === n - 1)) console.log(r);
  console.log('');
}
