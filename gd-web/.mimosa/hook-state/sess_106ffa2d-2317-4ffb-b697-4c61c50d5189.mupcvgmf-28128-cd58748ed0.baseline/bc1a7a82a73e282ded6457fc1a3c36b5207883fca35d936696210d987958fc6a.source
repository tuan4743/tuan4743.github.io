/* 飞行段的"走廊体检":逐列算【最大空隙】,找出飞行类(飞机/UFO/波浪)真正过不去的地方。
 * 为什么要它:上一轮修掉"飞行类穿墙不死"之后,飞行段必须真的从缝里过 ——
 *   以前靠穿墙抄近路的地方现在会死,而"这一段到底有没有缝"以前只能靠搜索试出来(几小时)。
 *   这里用几何直接算:每 0.5 块取一列,把【实心 + 刺 + 圆锯】都算障碍(飞行类碰到都死),
 *   求最大空隙;空隙 < 2 块(玩家 1 块 + 余量)的列就是"卡口"。
 * 用法:cd gd-web && node tools/corridor-check.ts [只报前 N 个卡口=12] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const TOP = Number(process.argv[2] ?? 12);
const arg = (k: string, d: string) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const FROM = Number(arg('from', '0'));
const TO = Number(arg('to', String(WATER_CHART.length)));
const w = new World(WATER_CHART);
const top = w.rows * U;

/** 某一列 x 上的障碍区间(合并后) */
function blocked(xc: number): Array<[number, number]> {
  const raw: Array<[number, number]> = [];
  for (const b of w.nearSolids) if (xc > b.x0 - 15 && xc < b.x1 + 15) raw.push([b.y0, b.y1]);
  for (const b of w.hazards) if (xc > b.x0 - 15 && xc < b.x1 + 15) raw.push([b.y0, b.y1]);
  for (const c of w.circles) {
    if (xc > c.cx - c.r - 15 && xc < c.cx + c.r + 15) {
      const dx = Math.abs(xc - c.cx);
      const dy = Math.sqrt(Math.max(0, c.r * c.r - dx * dx));
      raw.push([c.cy - dy, c.cy + dy]);
    }
  }
  raw.sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const [a, b] of raw) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

/** 最大空隙(块)+ 它的中心 y(块) */
function biggestGap(xc: number): { size: number; y: number } {
  let cursor = 0, best = { size: 0, y: 0 };
  for (const [a, b] of blocked(xc)) {
    if (a - cursor > best.size) best = { size: (a - cursor) / U, y: (cursor + a) / 2 / U };
    cursor = Math.max(cursor, b);
  }
  if (top - cursor > best.size) best = { size: (top - cursor) / U, y: (cursor + top) / 2 / U };
  return best;
}

const pinches: Array<{ x: number; size: number; y: number }> = [];
let minGap = Infinity, minX = 0;
for (let bx = FROM; bx <= TO; bx += 0.5) {
  const g = biggestGap(bx * U);
  if (g.size < minGap) { minGap = g.size; minX = bx; }
  if (g.size < 2) pinches.push({ x: bx, size: g.size, y: g.y });
}
console.log('关卡 ' + WATER_CHART.name + ' · 长 ' + WATER_CHART.length + ' 块 · 障碍 = 实心 + 刺 + 圆锯');
console.log('全关【最窄的最大空隙】= ' + minGap.toFixed(2) + ' 块(x=' + minX + ')');
console.log('最大空隙 < 2 块的列:' + pinches.length + ' 个(占 ' + (100 * pinches.length / (WATER_CHART.length * 2)).toFixed(2) + '%)');
for (const p of pinches.slice(0, TOP)) {
  console.log('  x=' + p.x.toFixed(1).padStart(8) + '  最大空隙 ' + p.size.toFixed(2) + ' 块(中心 y=' + p.y.toFixed(1) + ')');
}
if (pinches.length > TOP) console.log('  …共 ' + pinches.length + ' 个');
