/* ★ 路线规划器:用【已知的地图】直接算一条走得通的走廊,给搜索当向导。
 *
 * 为什么要有它(用户口径:"我们知道地图,能不能直接为bot规划算出一条路?省的bot来回搜索耗费大量时间.
 * 现在自动演示还在偷鸡,第一个UFO段直接靠反重力穿墙飞天了"):
 *   现在的搜索是"从起点一路试错",分数只看 x 走得远不远 —— 于是它天然偏爱"往上飞、绕过一切"的作弊线,
 *   而真正的关卡走廊(作者摆的方块/门/弹簧)对它毫无吸引力。整关搜一次要几小时。
 *   这一版把地图变成一张【可通行网格】,用 A* 直接算出"从起点到终点的一条走廊",
 *   再把它作为【向导】喂给搜索(离向导越远扣分越多),搜索就再也不会跑到天上去了。
 *
 * 口径(有意保守):
 *   · 玩家盒子 = 1×1 块(30×30 单位),格心采样;
 *   · 障碍 = 实心(含线框) + 尖刺 + 锯片(按圆的外接方);判定用【真实判定盒】,不是贴图;
 *   · `--clear=<块>` 额外净空(默认 0 = 盒子刚好塞得进;0.5 会要求 2 格宽的通道);
 *   · 允许的步子:横走(±1 格)+ 上跳(前 1~4 格、上 1~3 格)+ 下落(前 1~4 格、下 1~12 格)
 *     —— 这是"方块/球/机器人大概能到哪"的粗模型,不模拟物理(向导只需要指明走廊)。
 *
 * 用法:cd gd-web && node tools/plan.ts [--clear=0] [--step=1] [--out=../../.tmp/gd/water-guide.json]
 * 输出:走廊的采样点 + 净空剖面 + 最窄处在哪(给"这段是不是要飞过去"提供依据)。
 */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const arg = (n: string, d: number) => {
  const hit = process.argv.find((a) => a.startsWith('--' + n + '='));
  return hit ? Number(hit.split('=')[1]) : d;
};
const OUT = (process.argv.find((a) => a.startsWith('--out='))?.slice(6)) ?? '../../.tmp/gd/water-guide.json';
const STEP = arg('step', 1);
const CLEAR = arg('clear', 0);

const w = new World(WATER_CHART);
const COLS = Math.ceil(WATER_CHART.length / STEP) + 2;
const ROWS = WATER_CHART.rows;

/* ---- 障碍:全部用判定盒(单位 → 块),把"玩家盒子"的半径并进去 ---- */
interface R { x0: number; x1: number; y0: number; y1: number; kind: string }
const obs: R[] = [];
const push = (x0: number, x1: number, y0: number, y1: number, kind: string) =>
  obs.push({ x0: x0 / U - 0.5 - CLEAR, x1: x1 / U + 0.5 + CLEAR, y0: y0 / U - 0.5 - CLEAR, y1: y1 / U + 0.5 + CLEAR, kind });
for (const b of w.solids) push(b.x0, b.x1, b.y0, b.y1, b.o.kind === 'frame' ? 'frame' : 'block');
for (const b of w.hazards) push(b.x0, b.x1, b.y0, b.y1, 'spike');
for (const c of w.circles) push(c.cx - c.r, c.cx + c.r, c.cy - c.r, c.cy + c.r, 'saw');
console.log('障碍 ' + obs.length + ' 个(实心 ' + w.solids.length + ' · 刺 ' + w.hazards.length + ' · 锯 ' + w.circles.length
  + ')· 净空 ' + CLEAR + ' 块 · 格 ' + STEP + ' 块');

/* 每列一个"障碍区间表",查格子是否可走时只扫这一列(比全表扫快几百倍) */
const colObs: R[][] = Array.from({ length: COLS }, () => []);
for (const o of obs) {
  const c0 = Math.max(0, Math.floor(o.x0 / STEP)), c1 = Math.min(COLS - 1, Math.floor(o.x1 / STEP));
  for (let c = c0; c <= c1; c++) colObs[c].push(o);
}
const free = (cx: number, cy: number): boolean => {
  if (cy < 0 || cy >= ROWS) return false;
  const bx0 = cx * STEP + STEP / 2, by0 = cy + 0.5;      // 玩家盒子中心
  for (const o of colObs[cx]) {
    if (bx0 > o.x0 && bx0 < o.x1 && by0 > o.y0 && by0 < o.y1) return false;
  }
  return true;
};

/* ---- A* ---- */
const startX = Math.round((WATER_CHART.start?.b ?? 0) / STEP);
const startY = WATER_CHART.start?.r ?? 0;
const goalCx = COLS - 2;
const idx = (cx: number, cy: number) => cx * ROWS + cy;
const gScore = new Float64Array(COLS * ROWS).fill(Infinity);
const cameFrom = new Int32Array(COLS * ROWS).fill(-1);
const closed = new Uint8Array(COLS * ROWS);
const heap: Array<{ i: number; f: number }> = [];
const h = (cx: number, cy: number) => (goalCx - cx);                 // 只按横向距离,越快往右越好
const pushHeap = (i: number, f: number) => {
  heap.push({ i, f });
  let k = heap.length - 1;
  while (k > 0) { const p = (k - 1) >> 1; if (heap[p].f <= heap[k].f) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
};
const popHeap = () => {
  const top = heap[0], last = heap.pop()!;
  if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } }
  return top;
};

const si = idx(startX, startY);
gScore[si] = 0;
pushHeap(si, h(startX, startY));
/* 步子:dx/dy 组合(横向每步 1 格,纵向按"跳/落"给范围) */
const MOVES: Array<[number, number]> = [];
for (let dy = -12; dy <= 3; dy++) for (let dx = 1; dx <= 4; dx++) {
  if (dy > 0 && dx > 3) continue;                                   // 上跳不会太远
  if (dy < 0 && dx > 4) continue;
  MOVES.push([dx, dy]);
}
let visited = 0, found = -1;
while (heap.length) {
  const { i } = popHeap();
  if (closed[i]) continue;
  closed[i] = 1; visited++;
  const cx = Math.floor(i / ROWS), cy = i % ROWS;
  if (cx >= goalCx) { found = i; break; }
  for (const [dx, dy] of MOVES) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || nx >= COLS) continue;
    if (!free(nx, ny)) continue;
    /* 上跳/下落途中不能穿墙:把中间那几格也查一遍(粗查,每格只看中点) */
    let blocked = false;
    for (let t = 1; t < Math.max(Math.abs(dx), Math.abs(dy)); t++) {
      const mx = cx + Math.round(dx * t / Math.max(Math.abs(dx), Math.abs(dy)));
      const my = cy + Math.round(dy * t / Math.max(Math.abs(dx), Math.abs(dy)));
      if (!free(mx, my)) { blocked = true; break; }
    }
    if (blocked) continue;
    const ni = idx(nx, ny);
    const cost = dx + (dy > 0 ? dy * 1.6 : -dy * 0.25);             // 上跳贵一点、下落便宜
    const g2 = gScore[i] + cost;
    if (g2 < gScore[ni]) { gScore[ni] = g2; cameFrom[ni] = i; pushHeap(ni, g2 + h(nx, ny)); }
  }
}
if (found < 0) {
  console.log('✗ 没找到通路(净空 ' + CLEAR + ' 太严?)· 展开 ' + visited + ' 个格子');
  process.exit(1);
}
const path: Array<[number, number]> = [];
for (let i = found; i >= 0; i = cameFrom[i]) path.push([Math.floor(i / ROWS) * STEP, i % ROWS]);
path.reverse();
console.log('✓ 通路:' + path.length + ' 步 · 展开 ' + visited + ' 格 · 代价 ' + gScore[found].toFixed(1));

/* ---- 采样 + 净空剖面 ---- */
const pts = path.filter((_, i) => i % Math.max(1, Math.round(6 / STEP)) === 0 || i === path.length - 1);
console.log('采样点 ' + pts.length + ' 个,前 12 个:x,y = ' + pts.slice(0, 12).map((p) => p[0] + ',' + p[1]).join(' | '));
/* 每个采样点的"上下最近障碍":反映这条走廊有多宽 */
const gaps: Array<{ x: number; y: number; gap: number }> = [];
for (const [x, y] of pts) {
  let up = ROWS, down = 0;
  for (const o of colObs[Math.min(COLS - 1, Math.floor(x / STEP))]) {
    if (y + 0.5 > o.y0 && y + 0.5 < o.y1) { up = Math.min(up, 0); continue; }
    if (o.y1 <= y) down = Math.max(down, o.y1 + 0.5 + (CLEAR ? 0 : 0));
    if (o.y0 >= y + 1) up = Math.min(up, o.y0 - 0.5);
  }
  gaps.push({ x, y, gap: Math.max(0, up - down) });
}
gaps.sort((a, b) => a.gap - b.gap);
console.log('最窄的 6 处(x, y, 竖直净空块):' + gaps.slice(0, 6).map((g) => g.x + ',' + g.y + ',' + g.gap.toFixed(1)).join(' | '));
const ys = pts.map((p) => p[1]);
console.log('高度范围 y=' + Math.min(...ys) + '~' + Math.max(...ys) + '(关卡高 ' + ROWS + ' 格)');

fs.writeFileSync(OUT, JSON.stringify({ step: STEP, clear: CLEAR, points: pts.map(([x, y]) => [x, y + 0.5]) }));
console.log('向导已写:' + OUT);
