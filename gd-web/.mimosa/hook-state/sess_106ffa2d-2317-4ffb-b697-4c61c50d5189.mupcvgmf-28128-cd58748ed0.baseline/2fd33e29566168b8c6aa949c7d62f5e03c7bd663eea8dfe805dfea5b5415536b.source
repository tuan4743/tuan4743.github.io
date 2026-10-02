/* 实心判定用【内框】还是【外框】?把差值量化。
 * 背景(与 tools/hazbox-audit.ts 同一类问题,只是对象换成"墙/砖"):
 *   · gdp@2.11 `checkCollisions.cpp:440-445` 危险物用 `player->getObjectRect()`(和实心同一个 rect);
 *   · OpenGD `playlayer.cpp:750-751` 把玩家拆成【外框 30×30】与【内框 7.5×7.5】,
 *     实心交互用内框、危险物用外框。
 *   我们现在"实心侧撞"用的是内框(7.5,每边比外框松 0.375 块)—— 也就是"贴着墙蹭过去"这一档
 *   比外框口径宽松。这一条到底对不对,关卡 A/B 只能给"能不能过",给不出"差多少";
 *   所以把差值量出来:当前这条路线上有多少帧是"外框已经压进墙里、内框还没"。
 * 用法:cd gd-web && node tools/solidbox-audit.ts <卷子.json> [最多报几条]
 * 输出:外框口径下会判死的帧数、最深的压入量(块)、最危险的点。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-free.best.json';
const TOP = Number(process.argv[3] ?? 6);
const tape: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;

const w = new World(WATER_CHART);
let frames = 0, bad = 0, worst = 0;
const hits: Array<{ x: number; y: number; pen: number; f: number; mode: string }> = [];

/** 外框压进实心的深度(块);<=0 表示没压进去 */
const pen = (a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number }) => {
  const dx = Math.min(a.x1 - b.x0, b.x1 - a.x0);
  const dy = Math.min(a.y1 - b.y0, b.y1 - a.y0);
  return Math.min(dx, dy) / U;
};

for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  frames++;
  const out = w.outer(), inn = w.inner();
  let deepest = 0;
  for (const b of w.nearSolids) {
    /* 内框已经相交 = 现状就会判死,不算差值 */
    if (inn.x1 > b.x0 && inn.x0 < b.x1 && inn.y1 > b.y0 && inn.y0 < b.y1) continue;
    if (!(out.x1 > b.x0 && out.x0 < b.x1 && out.y1 > b.y0 && out.y0 < b.y1)) continue;
    const p = pen(out, b);
    if (p > deepest) deepest = p;
  }
  if (deepest > 0) {
    bad++;
    if (deepest > worst) worst = deepest;
    if (hits.length < 500) hits.push({ x: w.x / U, y: w.y / U, pen: deepest, f: frames, mode: w.mode });
  }
}

console.log('卷子 ' + FILE + ' · 回放 ' + frames + ' 帧(x=' + (w.x / U).toFixed(1)
  + (w.dead ? ' 死了' : w.done ? ' 通关' : ' 活着') + ')');
console.log('实心侧撞:内框(现状,7.5×7.5)');
console.log('若改成【外框 30×30】:会多出 ' + bad + ' 个死亡帧(' + (100 * bad / Math.max(1, frames)).toFixed(2)
  + '% of ' + frames + ') · 最深压进墙里 ' + worst.toFixed(3) + ' 块(内框每边比外框松 0.375 块)');
for (const h of hits.sort((a, b) => b.pen - a.pen).slice(0, TOP)) {
  console.log('  帧 ' + String(h.f).padStart(5) + ' x=' + h.x.toFixed(2).padStart(8) + ' y=' + h.y.toFixed(2).padStart(7)
    + ' ' + h.mode.padEnd(5) + ' 压进 ' + h.pen.toFixed(3) + ' 块');
}
if (hits.length) {
  const byBucket = new Map<number, number>();
  for (const h of hits) { const k = Math.floor(h.x / 100) * 100; byBucket.set(k, (byBucket.get(k) ?? 0) + 1); }
  console.log('  按 x 段统计: ' + [...byBucket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, n]) => k + '→' + n).join(' '));
}
