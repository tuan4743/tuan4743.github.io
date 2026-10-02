/* 定点:飞行类(飞机/UFO/波浪)碰到实心到底会怎样 —— 落地 / 擦过去 / 撞死?
 * 为什么:用户实测"UFO 不会踩上任何东西,碰到线框或者砖块直接穿过去"。
 *   我们现在的规则是 `flySolid` 一开就【碰到即死】(6 单位容差),而原版里飞行类是
 *   "撞侧面死、落到顶面上会贴着滑"—— 两条都要能量出来才能改。
 * 用法:cd gd-web && node tools/probe-fly.ts <起点x> <起点y> <形态> [按住帧数] [总帧数] [按键串H/R]
 *   例:node tools/probe-fly.ts 227.5 3 ufo 0 60      ← 不按,从细杆正上方落下来
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const X0 = Number(process.argv[2] ?? 227.5);
const Y0 = Number(process.argv[3] ?? 3);
const MODE = (process.argv[4] ?? 'ufo') as 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
const N = Number(process.argv[6] ?? 60);
const PAT = process.argv[7] ?? '';

const w = new World(WATER_CHART);
w.windowed = true;
w.reset(X0 * U, MODE, Y0 * U);
w.speedIdx = Number(process.env.SPEED ?? 1);
w.gdir = 1; w.vy = 0; w.onGround = false;
console.log('起点 (' + X0 + ',' + Y0 + ') 形态 ' + MODE + ' 速度档 ' + w.speedIdx + ' · flySolid=' + w.flySolid);

/* 起点附近有什么(实心/线框) */
for (const b of w.solids) {
  const x0 = b.x0 / U, x1 = b.x1 / U, y0 = b.y0 / U, y1 = b.y1 / U;
  if (x1 > X0 - 1.5 && x0 < X0 + 1.5 && y1 > Y0 - 4 && y0 < Y0 + 1) {
    console.log('  实心 ' + String(b.o.kind).padEnd(9) + ' x[' + x0.toFixed(3) + ',' + x1.toFixed(3) + '] y[' + y0.toFixed(3) + ',' + y1.toFixed(3) + ']');
  }
}

let last = '';
for (let f = 0; f < N && !w.dead && !w.done; f++) {
  const hold = PAT ? PAT[f % PAT.length] === 'H' : false;
  w.frame(hold);
  const st = 'x=' + (w.x / U).toFixed(3) + ' y=' + (w.y / U).toFixed(3) + ' vy=' + (w.vy / U).toFixed(3)
    + (w.onGround ? ' 地' : '') + ' gdir=' + w.gdir;
  if (f % 5 === 0 || w.dead || st.slice(0, 22) !== last.slice(0, 22)) console.log('  帧 ' + String(f).padStart(3) + ' ' + st);
  last = st;
}
console.log('结果:' + (w.dead ? '✗ 死' : w.done ? '通关' : '活着') + ' · 末态 x=' + (w.x / U).toFixed(3)
  + ' y=' + (w.y / U).toFixed(3) + ' vy=' + (w.vy / U).toFixed(3) + (w.onGround ? ' 站在地上' : ''));
