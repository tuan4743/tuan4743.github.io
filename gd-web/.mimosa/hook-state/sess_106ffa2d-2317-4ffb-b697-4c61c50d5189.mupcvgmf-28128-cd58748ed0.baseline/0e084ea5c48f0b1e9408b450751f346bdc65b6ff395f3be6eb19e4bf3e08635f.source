/* 诊断:打印铺面某一段的原始物件 + 一张 ASCII 剖面,用来"看清这一站到底是什么地形"。
 * 用法:cd gd-web && node tools/diag-area.ts <x0块> <x1块> [yMax格]
 *
 * 为什么要它:分站驱动只告诉我们"走到 606.9 就死"(死胡同 600→54 次),
 * 但"600 那一带有什么、门在哪儿、要爬多高"必须看原始表格才知道 ——
 * 靠猜地形改搜索参数就是碰运气。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';

const X0 = Number(process.argv[2] ?? 585);
const X1 = Number(process.argv[3] ?? 620);
const YMAX = Number(process.argv[4] ?? 30);

const objs = WATER_CHART.objects
  .filter((o) => o.b + o.w >= X0 - 1 && o.b <= X1 + 1)
  .sort((a, b) => a.b - b.b || a.r - b.r);

console.log('物件 ' + objs.length + ' 个 · 区间 ' + X0 + '~' + X1 + ' 块');
for (const o of objs) {
  const extra = [
    o.to ? '→' + o.to : '', o.pad ? 'pad=' + o.pad : '', o.orb ? 'orb=' + o.orb : '',
    o.arrow ? 'arrow=' + o.arrow : '', o.speed != null && o.kind === 'speed' ? 'speed=' + o.speed : '',
    o.gdir != null ? 'gdir=' + o.gdir : '', o.size != null && o.kind === 'size' ? 'size=' + o.size : '',
    o.rot != null ? 'rot=' + o.rot : '', o.text ? 'text=' + o.text : '',
  ].filter(Boolean).join(' ');
  console.log('  ' + o.kind.padEnd(9) + ' b=' + o.b.toFixed(2).padStart(8)
    + ' r=' + String(o.r).padStart(3) + ' w=' + o.w + ' h=' + o.h + (extra ? '  ' + extra : ''));
}

/* ASCII 剖面:每个 (块, 行) 格子放一个字符,行 0 在下。
 * 实心 B 方块 / F 线框 / # 危险(刺锯) / o 环 / = 弹簧 / P 门 / c 存档 / - 平台 */
const W = Math.round(X1 - X0) + 1;
const grid: string[][] = [];
for (let y = YMAX; y >= 0; y--) grid.push(new Array(W).fill(' '));
const put = (bx: number, by: number, ch: string) => {
  const cx = Math.round(bx - X0);
  /* ★ r 可以是小数(锯片 r=25.403),行号必须取整,不然 grid[4.597] 直接是 undefined(踩过) */
  const row = Math.round(YMAX - by);
  if (!Number.isFinite(cx) || cx < 0 || cx >= W || row < 0 || row >= grid.length) return;
  if (grid[row][cx] === ' ' || ch !== '.') grid[row][cx] = ch;
};
for (const o of objs) {
  if (o.w > 200) continue;                 // 整条地板(3652 块宽),画进剖面只会糊成一片
  const ch = o.kind === 'block' ? 'B' : o.kind === 'frame' ? 'F' : o.kind === 'breakable' ? 'b'
    : o.kind === 'spike' || o.kind === 'saw' ? '#' : o.kind === 'orb' ? 'o' : o.kind === 'pad' ? '='
      : o.kind === 'portal' ? 'P' : o.kind === 'speed' ? 'S' : o.kind === 'gravity' ? 'G'
        : o.kind === 'check' ? 'c' : o.kind === 'platform' ? '-' : o.kind === 'size' ? 'z'
          : o.kind === 'coin' ? '$' : o.kind === 'arrow' ? '>' : o.kind === 'teleport' ? 'T'
            : o.kind === 'trigger' ? 't' : o.kind === 'deco' ? '.' : '?';
  for (let dx = 0; dx < Math.max(1, Math.round(o.w)); dx++) {
    for (let dy = 0; dy < Math.max(1, Math.round(o.h)); dy++) put(o.b + dx, o.r + dy, ch);
  }
}
console.log('\n剖面(北/上 = 行大):');
const hdr = '     ' + Array.from({ length: W }, (_, i) => (Math.round(X0 + i) % 10 === 0 ? '|' : ' ')).join('');
console.log(hdr);
for (let y = YMAX; y >= 0; y--) {
  const row = grid[YMAX - y].join('');
  if (row.trim() === '' && y > 0 && y % 5 !== 0) continue;
  console.log(String(y).padStart(3) + '  ' + row);
}
console.log('     ' + Array.from({ length: W }, (_, i) => (Math.round(X0 + i) % 10 === 0 ? String(Math.round(X0 + i) / 10 % 10) : ' ')).join(''));
