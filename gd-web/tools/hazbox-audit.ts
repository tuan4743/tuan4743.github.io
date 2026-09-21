/* 判定口径 A/B:把一卷"活着"的输入按【玩家外框 vs 刺盒】再判一遍,
 * 看看有多少帧会因为"原版危险物用外框(30×30)而不是内框(7.5×7.5)"而变成死亡。
 *
 * 为什么要它:两份反编译在"危险物用玩家哪个盒子"上冲突 ——
 *   · gdp@2.11 `checkCollisions.cpp:440-445`:`playerRect = player->getObjectRect()`(和实心碰撞同一个盒子)
 *   · OpenGD `playlayer.cpp:1494-1502`:`playerOuterBounds.intersectsCircle/Rect`(危险物一律外框)
 * 我们现在刺走【内框】(7.5),锯片(圆)走外框 —— 内框比外框每边小 0.375 块,也就是"贴刺过去"的容错。
 * 这条命令把差值量化:当前这条路线有多少帧是"内框口径侥幸活着"。
 *
 * 用法:cd gd-web && node tools/hazbox-audit.ts <卷子.json> [最多报几条]
 * 输出:外框口径下的【死亡帧数/占比】、最紧的分离量(块)、最危险的那几个点的坐标。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-free.best.json';
const TOP = Number(process.argv[3] ?? 8);
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const tape: boolean[] = j.tape;

const w = new World(WATER_CHART);
let frames = 0, badFrames = 0, worst = Infinity;
const hits: Array<{
  x: number; y: number; gap: number; f: number;
  spike?: { x0: number; x1: number; y0: number; y1: number };
  out?: { x0: number; x1: number; y0: number; y1: number };
  inner?: { x0: number; x1: number; y0: number; y1: number };
}> = [];

/* 矩形分离量:>0 = 没碰上(块),<0 = 已经相交了多少块 */
const sep = (a: { x0: number; x1: number; y0: number; y1: number },
  b: { x0: number; x1: number; y0: number; y1: number }) => {
  const dx = Math.max(b.x0 - a.x1, a.x0 - b.x1);
  const dy = Math.max(b.y0 - a.y1, a.y0 - b.y1);
  return Math.max(dx, dy) / U;
};

for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  frames++;
  const out = w.outer();
  let worstHere = Infinity, which = null as null | { x: number; y: number };
  for (const hz of w.hazards) {                       // hazards 里只有刺(锯片已经走 circles)
    const g = sep(out, hz);
    if (g < worstHere) { worstHere = g; which = { x: (hz.x0 + hz.x1) / 2 / U, y: (hz.y0 + hz.y1) / 2 / U }; }
  }
  if (worstHere < worst) worst = worstHere;
  if (worstHere <= 0 && which) {
    badFrames++;
    if (hits.length < 200) {
      const inn = w.inner();
      let box = null as null | { x0: number; x1: number; y0: number; y1: number };
      for (const hz of w.hazards) if (sep(out, hz) === worstHere) box = hz;
      hits.push({
        x: w.x / U, y: w.y / U, gap: worstHere, f: frames,
        spike: box ? { x0: box.x0 / U, x1: box.x1 / U, y0: box.y0 / U, y1: box.y1 / U } : undefined,
        out: { x0: out.x0 / U, x1: out.x1 / U, y0: out.y0 / U, y1: out.y1 / U },
        inner: { x0: inn.x0 / U, x1: inn.x1 / U, y0: inn.y0 / U, y1: inn.y1 / U },
      });
    }
  }
}

console.log('卷子 ' + FILE + ' · 回放到 ' + frames + ' 帧(x=' + (w.x / U).toFixed(1)
  + (w.dead ? ' 死了' : w.done ? ' 通关' : ' 活着') + ')');
console.log('刺的判定:内框(现状,7.5×7.5)');
console.log('若改成【外框 30×30】:会多出 ' + badFrames + ' 个死亡帧('
  + (100 * badFrames / Math.max(1, frames)).toFixed(2) + '% of ' + frames + ')');
console.log('全程离刺最近的外框分离量 = ' + (worst === Infinity ? '—' : worst.toFixed(3)) + ' 块'
  + '(内框比外框每边松 0.375 块)');
if (hits.length) {
  console.log('前 ' + Math.min(TOP, hits.length) + ' 处"外框口径会死"的点(x,y 是玩家位置;gap<0 = 外框已经压进刺盒):');
  for (const h of hits.slice(0, TOP)) {
    console.log('  帧 ' + String(h.f).padStart(5) + '  x=' + h.x.toFixed(2).padStart(8)
      + '  y=' + h.y.toFixed(2).padStart(7) + '  外框分离 ' + h.gap.toFixed(3) + ' 块'
      + (h.spike ? '   刺盒 y[' + h.spike.y0.toFixed(2) + ',' + h.spike.y1.toFixed(2) + '] x['
        + h.spike.x0.toFixed(2) + ',' + h.spike.x1.toFixed(2) + ']' : '')
      + (h.inner && h.out ? '   玩家 内框 y[' + h.inner.y0.toFixed(2) + ',' + h.inner.y1.toFixed(2)
        + '] 外框 y[' + h.out.y0.toFixed(2) + ',' + h.out.y1.toFixed(2) + ']' : ''));
  }
  if (hits.length > TOP) console.log('  …共 ' + hits.length + '+ 处');
}
console.log('\n再用【外框口径】真的把这卷输入跑一遍(看它死在哪一帧):');
{
  const wo = new World(WATER_CHART, undefined, undefined, { hazOuter: true });
  let f = 0;
  for (const h of tape) {
    if (wo.dead || wo.done) break;
    wo.frame(h);
    f++;
  }
  console.log('  外框口径 → ' + (wo.dead ? '死在 x=' + (wo.x / U).toFixed(2) + '(帧 ' + f + ')'
    : wo.done ? '通关' : '活着到 x=' + (wo.x / U).toFixed(2))
    + '   |   内框口径同一卷 → x=' + (w.x / U).toFixed(2) + (w.dead ? '(死了)' : ''));
}
