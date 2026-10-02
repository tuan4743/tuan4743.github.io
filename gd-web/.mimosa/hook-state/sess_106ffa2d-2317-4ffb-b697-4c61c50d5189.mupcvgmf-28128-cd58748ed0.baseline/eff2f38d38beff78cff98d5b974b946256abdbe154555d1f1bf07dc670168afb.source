/* 铺面构成分析:各类物件有多少、分别落在哪些区段(密度调优看这个) */
import { generateLevel, blocksPerSec } from '../src/sim/level.ts';

const lv = generateLevel({ seed: Number(process.argv[2] ?? 20260913) });
const kinds: Record<string, number> = {};
for (const o of lv.objects) {
  const k = o.kind === 'orb' ? 'orb:' + o.orb : o.kind === 'pad' ? 'pad:' + o.pad : o.kind;
  kinds[k] = (kinds[k] ?? 0) + 1;
}
console.log('总长 ' + lv.length.toFixed(1) + ' 块;物件:');
for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) console.log('  ' + k.padEnd(12) + n);

console.log('\n分段:');
for (const sg of lv.segments) {
  const inside = lv.objects.filter((o) => o.b >= sg.from && o.b < sg.to);
  const plays = inside.filter((o) => o.kind === 'spike' || o.kind === 'pad' || o.kind === 'orb' || o.kind === 'pit');
  const secs = (sg.t1 ?? 0) - (sg.t0 ?? 0);
  console.log(
    '  ' + (sg.label ?? sg.mode).padEnd(12) + ' x ' + sg.from.toFixed(0) + '~' + sg.to.toFixed(0) +
    ' (' + secs.toFixed(0) + 's, ' + blocksPerSec(sg.speed).toFixed(1) + ' 块/秒, 难度 ' + sg.difficulty + ')' +
    ' 玩法物件 ' + plays.length + ' = ' + (plays.length / secs).toFixed(2) + '/秒'
  );
}
/* 弹簧连:相邻两个弹簧 ≤ 8 块算一串 */
const pads = lv.objects.filter((o) => o.kind === 'pad').sort((a, b) => a.b - b.b).map((o) => o.b);
const runs: number[][] = [];
for (const b of pads) {
  const last = runs[runs.length - 1];
  if (last && b - last[last.length - 1] <= 8) last.push(b);
  else runs.push([b]);
}
console.log('\n弹簧连 ' + runs.length + ' 串:' + runs.map((r) => r.length + '根@' + r[0].toFixed(0)).join(', '));
