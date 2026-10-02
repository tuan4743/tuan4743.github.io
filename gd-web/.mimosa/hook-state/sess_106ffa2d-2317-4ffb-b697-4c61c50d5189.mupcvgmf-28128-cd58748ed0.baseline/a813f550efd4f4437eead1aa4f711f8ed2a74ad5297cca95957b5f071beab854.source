/* 定点:飞行类(UFO/飞机/波浪)撞到实心方块到底会怎样?
 * 背景:卷子里 UFO 在 x≈655 穿过了细杆(0.05 块厚),而实心侧撞判定那段代码看起来写在
 *   `if (mode !== ship/ufo/wave)` 里面 —— 如果真是那样,飞行类就是"穿墙不死"。
 *   先用【合成关卡】干净地问一遍,再回真关卡问一次(塔段入口 x=546.97 那堵竖墙)。
 * 用法:cd gd-web && node tools/fly-solid.ts */
import { World } from '../src/sim/world.ts';
import type { Level } from '../src/sim/level.ts';
import { U } from '../src/sim/constants.ts';
import { WATER_CHART } from '../src/sim/charts/water.ts';

const mk = (objs: Level['objects']): Level => ({
  name: 'fly', rows: 30, length: 60,
  segments: [{ from: 0, to: 60, mode: 'cube', speed: 1, difficulty: 0 }],
  objects: objs, song: '', songOffset: 0, start: { b: 0, r: 0 },
});

console.log('合成关卡:一块 6 格厚实心(x 20~26,顶面 y=1),方块从 (18,6) 落下:');
const lvSolid = mk([{ kind: 'block', b: 20, r: 0, w: 6, h: 1 }]);
for (const mode of ['cube', 'ufo', 'ship', 'wave', 'ball'] as const) {
  const w = new World(lvSolid);
  w.reset(18 * U, mode, 6 * U);
  w.speedIdx = 1; w.gdir = 1; w.vy = 0; w.onGround = false;
  let out = '';
  for (let f = 0; f < 300 && !w.dead && !w.done && w.y > -4 * U; f++) {
    w.frame(false);
    if (f % 30 === 0) out += ' ' + (w.y / U).toFixed(2);
    if (w.x / U > 40) break;
  }
  /* 撞方块应死在 y≈1(顶面);死在 y≈0 或更低 = 从方块里穿过去了 */
  console.log('  ' + mode.padEnd(5) + ' → x=' + (w.x / U).toFixed(1) + ' y=' + (w.y / U).toFixed(2)
    + (w.dead ? ' ✗ 死了' : w.onGround ? ' ⚠ 停在方块上' : ' ⚠ 还活着')
    + '  | y 轨迹' + out);
}

console.log('\n真关卡:从 x=540,y=3 一路按住(x=546.97 有一堵 y=0.5~6.5 的竖墙):');
for (const mode of ['cube', 'ufo', 'wave'] as const) {
  const w = new World(WATER_CHART, 540 * U, 3 * U);
  w.reset(540 * U, mode, 3 * U);
  w.speedIdx = 1; w.gdir = 1; w.vy = 0; w.onGround = false;
  for (let f = 0; f < 200 && !w.dead && !w.done && w.x < 552 * U; f++) w.frame(mode !== 'cube');
  console.log('  ' + mode.padEnd(5) + ' → x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
    + (w.dead ? ' ✗ 死了' : ' ⚠ 还活着(墙在 546.97 —— 穿过去了)'));
}
