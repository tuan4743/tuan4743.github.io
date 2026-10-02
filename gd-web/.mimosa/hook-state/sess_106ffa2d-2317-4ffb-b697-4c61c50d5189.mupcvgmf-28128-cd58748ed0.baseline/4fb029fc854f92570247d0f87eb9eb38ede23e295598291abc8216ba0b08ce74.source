/* 平台判定审计:每个实心盒的"引擎判定盒"和"铺面声明的尺寸"逐条比,看有没有被放大。
 * 放大 = 编辑器里看着没碰到、游戏里却被挡住/能站上去 —— 用户报的"平台莫名多判定"。
 * 跑法:cd gd-web && node tools/solid-audit.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const w = new World(WATER_CHART);
console.log('实心盒 ' + w.solids.length + ' 个');
const diff = new Map<string, { n: number; sample: string }>();
let worst = { d: 0, s: '' };
for (const b of w.solids) {
  const o = b.o as unknown as { id?: number; kind?: string; w: number; h: number; b: number; r: number };
  const bw = (b.x1 - b.x0) / U, bh = (b.y1 - b.y0) / U;
  const dw = +(bw - o.w).toFixed(3), dh = +(bh - o.h).toFixed(3);
  const key = (o.kind ?? '?') + ' id=' + (o.id ?? '-') + ' 铺面 ' + o.w.toFixed(2) + 'x' + o.h.toFixed(2)
    + ' → 引擎 +' + dw + '/' + dh;
  const e = diff.get(key) ?? { n: 0, sample: 'x=' + o.b + ' r=' + o.r };
  e.n++; diff.set(key, e);
  const d = Math.max(Math.abs(dw), Math.abs(dh));
  if (d > worst.d) worst = { d, s: key + ' @x=' + o.b };
}
console.log('\n=== 判定盒与铺面尺寸不一致的种类 ===');
const rows = [...diff.entries()].sort((a, b) => b[1].n - a[1].n);
if (!rows.length) console.log('  (没有:每个实心盒都等于铺面尺寸)');
for (const [k, v] of rows.slice(0, 16)) console.log('  ' + k.padEnd(58) + ' x' + String(v.n).padStart(5) + '   例:' + v.sample);
console.log('\n最大偏差 ' + worst.d.toFixed(3) + ' 格  ' + worst.s);

/* 落台容错:代码里 snapTol = 方块 15 单位 / 迷你 10 / 飞行类 6 */
console.log('\n落台容错(代码口径):方块 ' + (15 / U).toFixed(2) + ' 格 · 迷你 ' + (10 / U).toFixed(2) + ' 格 · 飞行类 ' + (6 / U).toFixed(2) + ' 格');
