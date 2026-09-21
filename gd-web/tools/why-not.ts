/* "这门为什么没生效?" —— 回放一卷输入,把它【没吃到】的、就在身边的门连盒子一起打出来。
 * 为什么要它:分站驱动报"到不了下一站"时,第一件要问的就是"最后一帧到底离门多远、门盒在哪" ——
 * 以前靠肉眼读 SVG,现在一句话。
 * 用法:cd gd-web && node tools/why-not.ts <卷子.json> [半径块数,默认 4] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const R = Number(process.argv[3] ?? 4);
/* --from=<块>:不是看"卷子末尾",而是看"第一次走到这个 x 时"的状态 —— 查中段门没生效时最有用 */
const fromArg = process.argv.find((a) => a.startsWith('--from='));
const FROM = fromArg ? Number(fromArg.slice(7)) : null;
const tape: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;

const w = new World(WATER_CHART);
let f = 0;
for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  f++;
  if (FROM != null && w.x / U >= FROM) break;
}
const out = w.outer();
console.log((FROM != null ? '第一次走到 x≥' + FROM + ' 时(帧 ' + f + ')' : '回放 ' + f + '/' + tape.length + ' 帧')
  + ' → x=' + (w.x / U).toFixed(3) + ' y=' + (w.y / U).toFixed(2)
  + ' 形态=' + w.mode + ' gdir=' + w.gdir + ' 速度档=' + w.speedIdx
  + (w.dead ? ' 【死了】' : w.done ? ' 【通关】' : ''));
console.log('玩家外框 x[' + (out.x0 / U).toFixed(3) + ',' + (out.x1 / U).toFixed(3)
  + '] y[' + (out.y0 / U).toFixed(3) + ',' + (out.y1 / U).toFixed(3) + ']'
  + '  内框 x[' + (w.inner().x0 / U).toFixed(3) + ',' + (w.inner().x1 / U).toFixed(3)
  + '] y[' + (w.inner().y0 / U).toFixed(3) + ',' + (w.inner().y1 / U).toFixed(3) + ']');

const near = [
  ...w.portals.map((b) => ['形态门', b] as const),
  ...w.gravs.map((b) => ['重力门', b] as const),
  ...w.speeds.map((b) => ['速度门', b] as const),
  ...w.sizes.map((b) => ['尺寸门', b] as const),
].filter(([, b]) => Math.abs((b.x0 + b.x1) / 2 / U - w.x / U) <= R);

console.log('\n身边 ' + R + ' 块内的门(右沿在前):');
for (const [kind, b] of near.sort((p, q) => p[1].x1 - q[1].x1)) {
  const what = b.o.kind === 'portal' ? '→' + b.o.to
    : b.o.kind === 'gravity' ? 'gdir=' + b.o.gdir
      : b.o.kind === 'speed' ? 'spd=' + b.o.speed : 'size=' + (b.o.mini === false ? 'normal' : 'mini');
  const dx = Math.max(b.x0 - out.x1, out.x0 - b.x1) / U;
  const dy = Math.max(b.y0 - out.y1, out.y0 - b.y1) / U;
  const sep = Math.max(dx, dy);
  const past = b.x1 <= out.x0 ? '【已经过去了】' : (b.x0 >= out.x1 ? '还没碰到(在前方 ' + ((b.x0 - out.x1) / U).toFixed(3) + ' 块)' : '★ 正压在上面');
  console.log('  ' + kind + ' ' + what.padEnd(12)
    + ' 盒 x[' + (b.x0 / U).toFixed(3) + ',' + (b.x1 / U).toFixed(3) + ']'
    + ' y[' + (b.y0 / U).toFixed(3) + ',' + (b.y1 / U).toFixed(3) + ']'
    + '  分离 ' + sep.toFixed(3) + ' 块 → ' + past);
}
