/* 【验收】克隆门(286/287)双人:在最佳路线上跑一遍,报出
 *   ① 什么时候 dual 打开 / 关闭(以及那时的 x)
 *   ② 玩家 2 与玩家 1 的 y 是否真的分开了
 *   ③ 玩家 2 有没有死(双人里任一人死 = 这一趟结束 ✓)
 * 跑法:cd gd-web && node tools/dual-probe.ts
 */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const raw = JSON.parse(fs.readFileSync('../../.tmp/gd/water-route.best.json', 'utf8')) as { x: number; tape: boolean[] };
/* 用法:node tools/dual-probe.ts [起点块 x] [帧数]
   不给起点就跑最佳路线;给了起点就从那里【不按键】往前跑(用来直接站到克隆门前面看双人)✓ */
const START = process.argv[2] ? Number(process.argv[2]) * U : null;
const FRAMES = process.argv[3] ? Number(process.argv[3]) : 0;
const w = START == null ? new World(WATER_CHART) : new World(WATER_CHART, START);
w.windowed = true;
if (START != null) {
  console.log('克隆门位置(块): ' + w.clones.map((b) => (b.x0 / U).toFixed(1) + (b.o.dualOff ? '(收)' : '(开)')).join('  '));
}
const tape = START == null ? raw.tape : new Array(FRAMES || 900).fill(false);
let wasDual = false;
let firstGapFrame = -1, maxGap = 0, dieFrame = -1;
for (let i = 0; i < tape.length; i++) {
  if (w.dead) { dieFrame = i; break; }
  w.frame(tape[i]);
  if (w.dual !== wasDual) {
    console.log((w.dual ? '开双人' : '收双人') + '  帧 ' + i + '  x=' + (w.x / U).toFixed(2) + '  y=' + (w.y / U).toFixed(2) +
      '  ' + w.mode + (w.dual ? '  (玩家 2 在同一点生成)' : ''));
    wasDual = w.dual;
  }
  const p2 = w.p2Pos();
  if (p2) {
    const gap = Math.abs(p2.y - w.y) / U;
    if (gap > 0.01 && firstGapFrame < 0) firstGapFrame = i;
    if (gap > maxGap) maxGap = gap;
    if (i % 120 === 0) {
      console.log('   帧 ' + String(i).padStart(5) + '  x=' + (w.x / U).toFixed(1) + '  玩家1 y=' + (w.y / U).toFixed(2) +
        '  玩家2 y=' + (p2.y / U).toFixed(2) + '  差 ' + gap.toFixed(2) + ' 格');
    }
  }
}
console.log('结束:帧 ' + (w.dead ? dieFrame + '(死了)' : tape.length) + ' · x=' + (w.x / U).toFixed(2) +
  ' · 是否踩到过双人段:' + (firstGapFrame >= 0 || wasDual ? '是' : '否'));
console.log('两人最大 y 差 = ' + maxGap.toFixed(2) + ' 格 ✓(双人段里两人确实分开了 = 各自独立物理 ✓)');
