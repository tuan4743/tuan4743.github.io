/* 路线规划器 v2:一趟连通的走廊 + "站得住"的物理罚项(给搜索当向导)。
 *
 * 为什么是 v2(用户口径:"把向导修对"):
 *   v1 纯几何 —— 只避开实心/刺/锯,不管重力、不管站不站得住,也不管门。
 *   实测代价:第 35 站(x=768.5)的速度门 + UFO 门都挂在 **y=20**,而 v1 给的走廊是 y≈11.5
 *   (半空、脚下什么都没有)⇒ 向导给"爬高到 20"扣分、把搜索往地面死路上推,那一站卡了一个多小时。
 * v2 加一条:**悬空罚** —— 每个格子算"脚下最近的面有多远",超过 3 块就按超出量扣分
 *   (不硬禁:飞行段本来就要腾空,但平地段不该悬在空中)。
 *
 * 也试过"按门分段规划"(每段终点 = 门的格心),实测不行:66 段规划不到
 *   (门的格心落在砖/刺上、或两门之间没有可通行格),走廊断成好几截。
 *   所以:一趟 A* 保证【全程连通】;门的"高度对齐"交给搜索侧的 --goaly(分站驱动本来就在用)。
 *
 * 用法:cd gd-web && node tools/plan.ts [--support=3] [--supportpen=0.6] [--out=...]
 * 输出:走廊采样点 + 悬空/穿门自检(每次跑都打印,数据不对一眼能看出来)。
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
const SUPPORT_OK = arg('support', 3);        // 脚下 <= 这么多块内有面就不罚
const SUPPORT_PEN = arg('supportpen', 0.6);  // 每超 1 块扣多少

const w = new World(WATER_CHART);
const COLS = Math.ceil(WATER_CHART.length / STEP) + 2;
const ROWS = WATER_CHART.rows;

interface R { x0: number; x1: number; y0: number; y1: number }
const obs: R[] = [];
const push = (x0: number, x1: number, y0: number, y1: number) =>
  obs.push({ x0: x0 / U - 0.5 - CLEAR, x1: x1 / U + 0.5 + CLEAR, y0: y0 / U - 0.5 - CLEAR, y1: y1 / U + 0.5 + CLEAR });
for (const b of w.solids) push(b.x0, b.x1, b.y0, b.y1);
for (const b of w.hazards) push(b.x0, b.x1, b.y0, b.y1);
for (const c of w.circles) push(c.cx - c.r, c.cx + c.r, c.cy - c.r, c.cy + c.r);
console.log('障碍 ' + obs.length + ' 个(实心 ' + w.solids.length + ' · 刺 ' + w.hazards.length + ' · 锯 ' + w.circles.length + ')');

const colObs: R[][] = Array.from({ length: COLS }, () => []);
for (const o of obs) {
  const c0 = Math.max(0, Math.floor(o.x0 / STEP)), c1 = Math.min(COLS - 1, Math.floor(o.x1 / STEP));
  for (let c = c0; c <= c1; c++) colObs[c].push(o);
}
const free = (cx: number, cy: number): boolean => {
  if (cy < 0 || cy >= ROWS || cx < 0 || cx >= COLS) return false;
  const bx = cx * STEP + STEP / 2, by = cy + 0.5;
  for (const o of colObs[cx]) if (bx > o.x0 && bx < o.x1 && by > o.y0 && by < o.y1) return false;
  return true;
};

/* 悬空度:脚下最近的面有多远(块)。面 = 地面 + 实心块的顶面 */
const topsByCol: number[][] = Array.from({ length: COLS }, () => []);
const addTop = (x0: number, x1: number, y1: number) => {
  const c0 = Math.max(0, Math.floor(x0 / U / STEP)), c1 = Math.min(COLS - 1, Math.floor(x1 / U / STEP));
  for (let c = c0; c <= c1; c++) topsByCol[c].push(y1 / U);
};
for (const f of w.floors) addTop(f.x0, f.x1, f.y1);
for (const b of w.solids) addTop(b.x0, b.x1, b.y1);
for (const t of topsByCol) t.sort((a, b) => a - b);
const supportGap = (cx: number, cy: number): number => {
  const tops = topsByCol[Math.max(0, Math.min(COLS - 1, cx))];
  let best = Infinity;
  for (const t of tops) { if (t <= cy + 1e-6) best = Math.min(best, cy - t); else break; }
  return best === Infinity ? 99 : best;
};

const idx = (cx: number, cy: number) => cx * ROWS + cy;
/* ★★ 门引力(2026-09 加):光靠"悬空罚"会把走廊压到地面(y=2~15),而第 35 站那两扇门挂在 y=20 ⇒
   实测"3 块内有走廊的门"只有 9/108,向导照样把搜索往地面死路推 ✗。
   所以再给一条【朝下一扇门的高度靠】的软引力:离门 30 块以内开始生效,越近权重越大。 */
const doors = WATER_CHART.objects
  .filter((o) => ['portal', 'gravity', 'speed', 'size'].includes(o.kind))
  .sort((a, b) => a.b - b.b);
const doorX = doors.map((o) => o.b + 0.5);
const doorY = doors.map((o) => o.r + 0.5);
function nextDoor(cxBlock: number): number {
  let lo = 0, hi = doorX.length - 1, ans = doorX.length;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (doorX[mid] >= cxBlock) { ans = mid; hi = mid - 1; } else lo = mid + 1; }
  return ans;
}
const GATE_PULL = arg('gatepull', 0.5);
function gatePen(cx: number, cy: number): number {
  const bx = cx * STEP;
  const i = nextDoor(bx);
  if (i >= doorX.length) return 0;
  const distX = doorX[i] - bx;
  if (distX < -2 || distX > 30) return 0;
  const w = 1 - Math.max(0, distX) / 30;
  return GATE_PULL * Math.abs(cy + 0.5 - doorY[i]) * w;
}
function plan(from: { x: number; y: number }, to: { x: number; y: number }): Array<[number, number]> | null {
  const g = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const closed = new Uint8Array(COLS * ROWS);
  const heap: Array<{ i: number; f: number }> = [];
  const h = (cx: number) => Math.abs(to.x - cx);
  const pushH = (i: number, f: number) => {
    heap.push({ i, f });
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p].f <= heap[k].f) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const popH = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1; let m = k;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
      }
    }
    return top;
  };
  const si = idx(from.x, from.y);
  g[si] = 0; pushH(si, h(from.x));
  let visited = 0;
  while (heap.length && visited < 900000) {
    const { i } = popH();
    if (closed[i]) continue;
    closed[i] = 1; visited++;
    const cx = Math.floor(i / ROWS), cy = i % ROWS;
    if (cx >= to.x) {
      const out: Array<[number, number]> = [];
      for (let k = i; k >= 0; k = prev[k]) out.push([Math.floor(k / ROWS) * STEP, k % ROWS]);
      return out.reverse();
    }
    for (let dx = 1; dx <= 4; dx++) {
      for (let dy = -12; dy <= 3; dy++) {
        if (dy > 0 && dx > 3) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny)) continue;
        let blocked = false;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let t = 1; t < steps; t++) {
          const mx = cx + Math.round(dx * t / steps), my = cy + Math.round(dy * t / steps);
          if (!free(mx, my)) { blocked = true; break; }
        }
        if (blocked) continue;
        const ni = idx(nx, ny);
        const hang = Math.max(0, supportGap(nx, ny) - SUPPORT_OK) * SUPPORT_PEN;
        const cost = dx + (dy > 0 ? dy * 1.6 : -dy * 0.25) + hang + gatePen(nx, ny);
        const ng = g[i] + cost;
        if (ng < g[ni]) { g[ni] = ng; prev[ni] = i; pushH(ni, ng + h(nx)); }
      }
    }
  }
  return null;
}

const start = { x: Math.max(0, Math.round((WATER_CHART.start?.b ?? 0) / STEP)), y: WATER_CHART.start?.r ?? 0 };
const path = plan(start, { x: COLS - 2, y: start.y });
if (!path) { console.log('没找到通路(净空 ' + CLEAR + ' 太严?)'); process.exit(1); }
console.log('OK 走廊 ' + path.length + ' 步(一趟连通)· 悬空罚:超 ' + SUPPORT_OK + ' 块 x ' + SUPPORT_PEN);

let hangMax = 0, hangAt = 0;
for (const [x, y] of path) { const gp = supportGap(Math.round(x / STEP), y); if (gp > hangMax) { hangMax = gp; hangAt = x; } }
console.log('悬空自检:最长"脚下没面" ' + hangMax.toFixed(1) + ' 块(x=' + hangAt + ')');

let near = 0, worst = { d: 0, label: '(none)' };
for (const o of doors) {
  const dx = o.b + 0.5, dy = o.r + 0.5;
  let best = Infinity;
  for (const [x, y] of path) if (Math.abs(x - dx) <= 4) best = Math.min(best, Math.abs(y + 0.5 - dy));
  if (best <= 3) near++;
  if (Number.isFinite(best) && best > worst.d) worst = { d: best, label: o.kind + '@' + dx };
}
console.log('穿门自检:' + near + '/' + doors.length + ' 扇门 3 块内有走廊 · 最差 ' + worst.label + ' 偏 ' + worst.d.toFixed(1) + ' 块');

const pts = path.filter((_, i) => i % Math.max(1, Math.round(6 / STEP)) === 0 || i === path.length - 1);
const ys = pts.map((p) => p[1]);
console.log('采样点 ' + pts.length + ' · 高度 y=' + Math.min(...ys) + '~' + Math.max(...ys) + '(关卡高 ' + ROWS + ')');
fs.writeFileSync(OUT, JSON.stringify({ step: STEP, clear: CLEAR, points: pts.map(([x, y]) => [x, y + 0.5]) }));
console.log('向导已写:' + OUT);
