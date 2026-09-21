/* 把【定点缝隙搜索】找到的尾段拼进一卷输入,产出一卷新的前缀(并自检回放)。
 * 用法:cd gd-web && node tools/tape-splice.ts <原卷> <尾段json> <输出卷>
 *   尾段 json 由 tools/probe-gap.ts 写出:{from: 起帧, inputs: [true/false...]}
 *
 * 为什么要有它:缝隙搜索(probe-gap)只负责"从某帧起,有没有一串按键能让门生效";
 * 找到之后要把它接回路线前缀里 —— 而且必须【回放自检】:拼出来的卷子要从头跑一遍,
 * 确认它真的走到那个位置、门真的生效(这是所有搜索产出的硬规矩)。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const SRC = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const TAIL = process.argv[3] ?? '../../.tmp/gd/gap-tail.json';
const DST = process.argv[4] ?? '../../.tmp/gd/water-route.spliced.json';

const src = JSON.parse(fs.readFileSync(SRC, 'utf8')) as { level: string; tape: boolean[] };
const tail = JSON.parse(fs.readFileSync(TAIL, 'utf8')) as { from: number; inputs: boolean[] };
const tape = src.tape.slice(0, tail.from).concat(tail.inputs);
console.log('原卷 ' + src.tape.length + ' 帧 · 截到 ' + tail.from + ' 帧 + 尾段 ' + tail.inputs.length
  + ' 帧 → ' + tape.length + ' 帧');

/* 回放自检:顺便把"门生效了没有"和末态一起报出来 */
const w = new World(WATER_CHART);
const all = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes];
let armed = 0, skipped = 0;
const done0 = new Set<unknown>();
for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  for (const b of all) {
    if (done0.has(b)) continue;
    if (w.x < b.x1) continue;
    done0.add(b);
    const sat = b.o.kind === 'portal' ? w.mode === b.o.to
      : b.o.kind === 'gravity' ? w.gdir === (b.o.gdir ?? 1)
        : b.o.kind === 'speed' ? w.speedIdx === (b.o.speed ?? 1)
          : b.o.kind === 'size' ? (b.o.mini === false ? w.sizeMul === 1 : w.sizeMul !== 1)
            : false;
    if (w.armedPortals.has(b) || sat) armed++; else skipped++;
  }
}
console.log('回放:' + (w.dead ? '【死了】' : w.done ? '【通关】' : '活着') + ' · x=' + (w.x / U).toFixed(2)
  + ' y=' + (w.y / U).toFixed(2) + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓')
  + ' · 门 生效 ' + armed + ' / 跳过 ' + skipped);
if (skipped) {
  console.log('⚠ 有跳过的门 —— 这卷不能当路线种子(gateOk 会在搜索里判死它)');
  process.exit(2);
}
fs.writeFileSync(DST, JSON.stringify({
  level: src.level, tape, x: w.x / U, score: w.x / U, maxX: w.x / U,
}));
console.log('写到 ' + DST);
