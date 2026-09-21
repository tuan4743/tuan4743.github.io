/* 把手接尾段的回放逐帧打出来(调试"为什么没进门"用)。
 * 用法:cd gd-web && node tools/hand-trace.ts <卷子> <尾段json> [从第几帧开始打] [打多少帧] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const SRC = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const TAIL = process.argv[3] ?? '../../.tmp/gd/gap-stair.json';
const FROM = Number(process.argv[4] ?? 0);
const N = Number(process.argv[5] ?? 60);
const base: boolean[] = JSON.parse(fs.readFileSync(SRC, 'utf8')).tape;
const tail = JSON.parse(fs.readFileSync(TAIL, 'utf8')) as { from: number; inputs: boolean[] };
const all = base.slice(0, tail.from).concat(tail.inputs);

const w = new World(WATER_CHART);
const doors = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes];
let i = 0;
for (const h of all) {
  if (w.dead || w.done) break;
  w.frame(h);
  const bx = w.x / U;
  if (i >= (FROM || tail.from - 10) && i < (FROM || tail.from - 10) + N) {
    const near = doors.filter((b) => w.x + w.box > b.x0 && w.x < b.x1 && w.y + w.box > b.y0 && w.y < b.y1)
      .map((b) => b.o.kind + '@' + b.o.b).join(',');
    console.log(i + ': x=' + bx.toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' vy=' + (w.vy / U).toFixed(2)
      + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓') + ' 按=' + (h ? 1 : 0)
      + (near ? ' 盒压着:' + near : '') + (w.dead ? ' 【死了】' : ''));
  }
  i++;
}
console.log('末态:' + (w.dead ? '【死了】' : '') + ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' ' + w.mode + ' · 生效门 ' + w.armedPortals.size);
