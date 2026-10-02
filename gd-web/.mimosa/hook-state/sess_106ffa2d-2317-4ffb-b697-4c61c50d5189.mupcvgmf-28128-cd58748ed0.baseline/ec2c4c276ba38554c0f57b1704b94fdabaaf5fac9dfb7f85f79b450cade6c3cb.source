/* 只读探针:在铺面里找"连续 N 个跳环 + 紧跟一个冲刺箭头"的段落(激光光束特效要挂在环上)
   跑法:cd gd-web && node tools/probe-beam-run.ts [最少环数=6] [断开间隔=6] [箭头窗口=14]
   ★ 纪律:本文件只能用编辑工具改 —— PowerShell 文本替换会把中文编码弄坏(踩过两次)✗ */
import { WATER_CHART } from '../src/sim/charts/water.ts';

const MIN = Number(process.argv[2] ?? 6);
const GAP = Number(process.argv[3] ?? 6);          // 间隔超过这个格数就算断开(可调,避免把长链切断)
const ARROW_WIN = Number(process.argv[4] ?? 14);   // 段尾往后多少格内算"紧跟箭头"

const objs = WATER_CHART.objects.slice().sort((a, b) => a.b - b.b);
const isOrb = (o: any) => o.kind === 'orb';
const isArrow = (o: any) => o.kind === 'arrow';
const orbs = objs.filter(isOrb) as any[];
const arrows = objs.filter(isArrow) as any[];

type Run = { from: number; to: number; n: number; kinds: string[]; yMin: number; yMax: number; next: string | null };
const runs: Run[] = [];
let i = 0;
while (i < orbs.length) {
  const start = i;
  let prevX = orbs[i].b;
  const kinds: string[] = [String(orbs[i].orb ?? '?')];
  let yMin = orbs[i].r, yMax = orbs[i].r;
  i++;
  while (i < orbs.length) {
    const x = orbs[i].b;
    if (x - prevX > GAP) break;
    kinds.push(String(orbs[i].orb ?? '?'));
    yMin = Math.min(yMin, orbs[i].r); yMax = Math.max(yMax, orbs[i].r);
    prevX = x; i++;
  }
  if (kinds.length < MIN) continue;
  let next: string | null = null;
  for (const a of arrows) {
    if (a.b < prevX || a.b > prevX + ARROW_WIN) continue;
    next = 'arrow id=' + a.id + ' ' + (a.arrow ?? '?') + ' x=' + a.b + ' y=' + a.r +
      (a.rot ? ' rot=' + a.rot : '') + ' dz=' + (a.b - prevX).toFixed(1);
    break;
  }
  runs.push({ from: orbs[start].b, to: prevX, n: kinds.length, kinds, yMin, yMax, next });
}
console.log('候选段落(≥' + MIN + ' 环,间隔 ≤' + GAP + ' 格,箭头窗口 ' + ARROW_WIN + ' 格):' + runs.length + ' 处');
for (const r of runs) {
  console.log('  x ' + r.from.toFixed(1) + '→' + r.to.toFixed(1) + ' · ' + r.n + ' 环 · y ' + r.yMin + '~' + r.yMax +
    ' [' + r.kinds.join(',') + ']' +
    ' ⇒ ' + (r.next ?? '【段尾 ' + ARROW_WIN + ' 格内没有箭头】'));
}
console.log('\n其中"恰好 8 环"的段落:');
const eight = runs.filter((r) => r.n === 8);
if (!eight.length) console.log('  (无)');
for (const r of eight) {
  const list = orbs.filter((o) => o.b >= r.from - 0.01 && o.b <= r.to + 0.01).map((o) => o.orb + '@(' + o.b + ',' + o.r + ')');
  console.log('  x ' + r.from + '→' + r.to + ' ⇒ ' + (r.next ?? '后面没有箭头') + '\n    ' + list.join('  '));
}
