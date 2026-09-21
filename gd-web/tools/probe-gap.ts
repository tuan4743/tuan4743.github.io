/* 定点缝隙搜索:只问一个问题 —— "从这卷的某个位置起,有没有一串按键能让【某个门】生效"。
 * 用法:cd gd-web && node tools/probe-gap.ts <卷子> <起点块x> <目标门x> [步长帧] [束宽] [最多帧]
 *
 * 为什么不用 autoplay:它是【通用启发式】搜索,状态去重里带着 tick(同 x/y 不同帧不算重复),
 * 而且目标是"往前推得越远越好"。到了"门缝只有 0.3 块"的地方这两条都不合适:
 *   · 状态爆炸:同一条轨迹的等价状态反复进堆,束宽全被它们占了;
 *   · 目标错位:它要的是"走得远",我们要的是"进门" —— 一条贴着天花板飞得远的路
 *     在它眼里分数最高,而我们要的那条得先"往下贴"。
 * 这个工具反其道而行:
 *   · 去重键【不带 tick】—— 只按 (形态|重力|x|y|vy|贴地) 量化,等价状态只留一个;
 *   · 目标就是 armedPortals.has(目标门);
 *   · 束宽给得很大(默认 4000),步长默认 1 帧(每一帧都能改主意)。
 * ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, type WorldSnap } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM_X = Number(process.argv[3] ?? 1036);
const DOOR_X = Number(process.argv[4] ?? 1060);
const STEP = Math.max(1, Number(process.argv[5] ?? 1));
const BEAM = Number(process.argv[6] ?? 4000);
const MAXF = Number(process.argv[7] ?? 400);
/** 去重量化(块)。★ 别用 0.1 —— 本关这个门缝只有 0.05 块,0.1 的量化会把"擦着锯片过"的
 *  那条唯一活路和"撞上锯片"的死路合并成同一个状态,搜索直接失去解。 */
const Q = Number(process.argv[8] ?? 0.02);

const base: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;
/* ★ 目标门的 Box 必须从【搜索用的那个 World】里取 —— 每个 World 各自建一套 Box 实例,
   拿另一个 World 的 Box 去 `armedPortals.has(...)` 永远返回 false(踩过:工具因此
   "证明"了三个门都无解,而其中一个门本来就是路线正常经过的 —— 自检当场穿帮)。 */
const w = new World(WATER_CHART, undefined, undefined,
  { sawUnscaled: process.argv.includes('--sawbase') });
if (process.argv.includes('--sawbase')) console.log('锯片判定盒:不缩放(基础尺寸)');
const door = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes]
  .find((b) => Math.abs(b.o.b - DOOR_X) < 0.01);
if (!door) throw new Error('没找到 x=' + DOOR_X + ' 的门');
/** 必过门的完整清单(按右沿排),以及和 autoplay 一字不差的"生效"判据 ——
 *  ★ 缝隙搜索也必须守这条:只盯着目标门的话,搜出来的尾段会【从别的门旁边飞过去】
 *  (实测:第一版找到的 28 帧尾段确实让 robot 门生效了,但顺手跳过了 1054 那个 cube 门,
 *    拼进路线后审计报"跳过 2",不能当种子)。 */
const mustDoors = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes].sort((a, b) => a.x1 - b.x1);
function gateOk(): boolean {
  for (const b of mustDoors) {
    if (w.x < b.x1) break;
    if (w.armedPortals.has(b) || w.handledPortals.has(b)) continue;
    const o = b.o;
    const sat = o.kind === 'portal' ? w.mode === o.to
      : o.kind === 'gravity' ? w.gdir === (o.gdir ?? 1)
        : o.kind === 'speed' ? w.speedIdx === (o.speed ?? 1)
          : o.kind === 'size' ? (o.mini === false ? w.sizeMul === 1 : w.sizeMul !== 1) : false;
    if (sat) { w.handledPortals.add(b); continue; }
    return false;
  }
  return true;
}
console.log('目标门 b=' + door.o.b + ' ' + door.o.kind + (door.o.to ? '→' + door.o.to : '')
  + ' 盒 x[' + (door.x0 / U).toFixed(2) + ',' + (door.x1 / U).toFixed(2) + '] y['
  + (door.y0 / U).toFixed(2) + ',' + (door.y1 / U).toFixed(2) + ']');

/* 回放到起点块。★ 回放时必须【每帧跑一次 gateOk】——它是"越过那一刻"记账的:
   不跑的话,像 1002 那种迷你门在当时是满足的,可人已经变回普通大小了,
   到起点再回头问就变成"没生效" → 束一上来就全被判死(踩过:第 5525 帧束里全死)。 */
let i = 0;
for (; i < base.length; i++) {
  if (w.dead || w.done || w.x / U >= FROM_X) break;
  w.frame(base[i]);
  gateOk();
}
const root: WorldSnap = w.snapshot();
const rootFrames = i;
console.log('起点:第 ' + i + ' 帧 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' vy=' + (w.vy / U).toFixed(2) + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓')
  + ' 速度档=' + w.speedIdx + ' 迷你=' + w.mini);

interface Item { snap: WorldSnap; inputs: boolean[] }
let beam: Item[] = [{ snap: root, inputs: [] }];
const seen = new Set<string>();
const keyOf = () => w.mode + '|' + w.gdir + '|' + (w.onGround ? 1 : 0)
  + '|' + Math.round(w.x / U / Q) + '|' + Math.round(w.y / U / Q) + '|' + Math.round(w.vy / U / Q);

let done: boolean[] | null = null;
const t0 = Date.now();
for (let f = 0; f < MAXF && !done; f += STEP) {
  const next: Item[] = [];
  seen.clear();
  for (const it of beam) {
    for (let pat = 0; pat < (1 << STEP); pat++) {
      w.restore(it.snap);
      let held: boolean[] = [];
      let bad = false;
      for (let k = 0; k < STEP; k++) {
        const h = ((pat >> k) & 1) === 1;
        held.push(h);
        w.frame(h);
        if (w.dead || w.done) { bad = true; break; }
        /* ★ 违规必须【整条作废】,不能只是跳出这一帧的循环 —— 第一版就是 break 完还把它
           当成活状态推进束里(gate 违规的状态在真正的搜索里是判死的),束被这些"假活"状态
           灌满,合法的低空路线反而挤不进去。 */
        if (!gateOk()) { bad = true; break; }
        if (w.armedPortals.has(door)) { done = it.inputs.concat(held); break; }
      }
      if (done || bad) continue;
      if (w.dead || w.done) continue;
      const key = keyOf();
      if (seen.has(key)) continue;
      seen.add(key);
      if (next.length < BEAM) next.push({ snap: w.snapshot(), inputs: it.inputs.concat(held) });
    }
    if (done) break;
  }
  if (done) break;
  if (!next.length) { console.log('第 ' + (rootFrames + f + STEP) + ' 帧束里全死,停'); break; }
  beam = next;
  if ((f / STEP) % 40 === 0) {
    const xs = beam.map((b) => b.snap.x / U);
    console.log('  +' + f + ' 帧 · 束 ' + beam.length + ' · x ' + Math.min(...xs).toFixed(1) + '~'
      + Math.max(...xs).toFixed(1) + ' · 用时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
}

if (!done) {
  console.log('没找到能让这个门生效的按键序列(搜了 ' + MAXF + ' 帧 · 束宽 ' + BEAM + ')');
  process.exit(1);
}
console.log('\n★ 找到:' + done.length + ' 帧按键(从第 ' + rootFrames + ' 帧起)');
console.log('按键序列(1=按住):' + done.map((h) => (h ? '1' : '0')).join(''));
const full = base.slice(0, rootFrames).concat(done);
const w2 = new World(WATER_CHART);
let fmode = '';
for (const h of full) {
  if (w2.dead || w2.done) break;
  w2.frame(h);
  if (w2.armedPortals.has(door) && !fmode) fmode = '门在第 ' + (full.indexOf(h) + 1) + ' 帧生效';
}
console.log('拼进原卷后回放:x=' + (w2.x / U).toFixed(2) + ' y=' + (w2.y / U).toFixed(2)
  + ' ' + w2.mode + (w2.dead ? ' 【死了】' : '') + ' · ' + fmode);
fs.writeFileSync('../../.tmp/gd/gap-tail.json', JSON.stringify({ from: rootFrames, inputs: done }));
console.log('尾段写到 ../../.tmp/gd/gap-tail.json(--startfrom 或手工拼接时用得上)');
