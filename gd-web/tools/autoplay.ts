/* ============================================================
   搜索式自动通关 v3 —— 【带宏动作的最优优先树搜索】(第三张盘:用户自己铺的 WATER)
   ─────────────────────────────────────────────────────────────
   两代人的教训都写在代码里:

   v1(autoplay-greedy.ts,见 git 9b63d6d)每次决定都"从当前状态试几种按法",**没有记忆**——
     全候选都活不下来时退化成"选死得最远的那个",而那恰好是确定性的同一套动作,
     于是每次死后从 x=0 重跑、又在同一根刺上死一次。实测 240 秒全花在 x=216 那一处
     (四次死亡坐标一位不差:x=216.09 y=0.22 vy=-10.38)。

   v2 把它改成搜索树:节点 = 世界快照 + 父指针 + 走过来的 3 帧按键,边 = 按键模式,
     启发 = 交给兜底策略试算能拱多远,按启发值排序的最大堆做最优优先。
     死循环从结构上消失,实测 60 秒走到 15.7%(v1 是 240 秒 6%)。
     但每个节点只推进 3 帧 —— 全关 13500 帧要展开 4500 次,**平坦路段也在烧算力**。

   v3 加【宏动作】:试算时兜底策略要是能活着走完整个视界,那就把这一整段(90 帧)当成
     一个动作直接落子 —— 平地上一次展开顶 30 次。硬路段上兜底会死,宏动作就不成立,
     节点自动退回 3 帧粒度,beam 保留多个分叉做回溯。一句话:
     **能闭眼冲的地方就冲,冲不过去的地方才逐帧搜。**

   跑法:
     cd gd-web
     node tools/autoplay.ts                                   # 默认 600 秒预算
     node tools/autoplay.ts --budget=7200 --log=60            # 两小时
     node tools/autoplay.ts --seed=../../.tmp/gd/water.best.tape.json   # 热启动:接着上次的最优前缀搜
     node tools/autoplay.ts --macro=0                         # 关掉宏动作(v2 行为,做对照)
   ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink, type WorldSnap } from '../src/sim/world.ts';
import { replay, fingerprint } from '../src/sim/replay.ts';
import { U } from '../src/sim/constants.ts';
import type { Level } from '../src/sim/level.ts';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name: string, dflt = '') => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const STEP = Number(arg('step', 3));            // 一次精细决定推进几帧(候选 = 2^STEP 种按键模式)
const HORIZON = Number(arg('horizon', 90));     // 兜底试算多长(帧)= 宏动作最长多少帧
const BEAM = Number(arg('beam', 4));            // 一个节点最多推出几个子节点
const MACRO = arg('macro', '1') === '1';        // 宏动作:兜底活着走完视界就整段落子
const MINMACRO = Number(arg('minmacro', 2)) * U;// 宏动作至少要前进这么多(单位)
const BUDGET = Number(arg('budget', 600));      // 时间预算(秒)
const MAXNODES = Number(arg('maxnodes', 4000000));
const HEAPCAP = Number(arg('heapcap', 200000));
const SEED = arg('seed', '');
const TAPE = arg('tape', '../../.tmp/gd/water.solution.json');
const BESTTAPE = arg('best', '../../.tmp/gd/water.best.tape.json');
const WANT = arg('level', 'water');
const QUIET = arg('quiet', '0') === '1';
const lv: Level = WANT === 'gen' ? generateLevel({ seed: 20260913 }) : WATER_CHART;

const w = new World(lv);
w.windowed = true;                    // 窗口裁剪:搜索要回放上千万帧,必须裁

/* ---------------- 候选:2^STEP 种按键模式 × 两种兜底 ---------------- */
interface Cand { pat: number; mode: 'idle' | 'bot'; }
const CANDS: Cand[] = [];
for (let p = 0; p < (1 << STEP); p++) {
  CANDS.push({ pat: p, mode: 'idle' });
  CANDS.push({ pat: p, mode: 'bot' });
}
const bit = (pat: number, i: number) => ((pat >> i) & 1) === 1;

/* ---------------- 节点与最大堆 ---------------- */
interface Node {
  snap: WorldSnap;
  parent: Node | null;
  inputs: boolean[];            // 父节点 → 本节点之间落子的按键(精细 3 帧,或一整段宏)
  score: number;                // 启发值:优先扩张谁
  gen: number;
}
const heap: Node[] = [];
function siftUp(i: number) {
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].score >= heap[i].score) break;
    const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
  }
}
function siftDown(i: number) {
  for (;;) {
    const l = 2 * i + 1, r = l + 1;
    let m = i;
    if (l < heap.length && heap[l].score > heap[m].score) m = l;
    if (r < heap.length && heap[r].score > heap[m].score) m = r;
    if (m === i) break;
    const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
  }
}
function pushHeap(n: Node) { heap.push(n); siftUp(heap.length - 1); }
function popHeap(): Node | null {
  if (!heap.length) return null;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length) { heap[0] = last; siftDown(0); }
  return top;
}
/** 堆太大就砍掉最差的一半(跑到几十万节点时内存会咬人) */
function pruneHeap() {
  if (heap.length <= HEAPCAP) return;
  heap.sort((a, b) => b.score - a.score);
  heap.length = Math.floor(HEAPCAP / 2);
  for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i);
}

/* ---------------- 试算 ---------------- */
const rollTape: boolean[] = [];        // 兜底那一段的按键(通关 / 宏动作都要它)
interface Roll { maxX: number; alive: boolean; done: boolean; stalled: boolean; frames: number }
function rollout(mode: 'idle' | 'bot', frames: number, collect: boolean): Roll {
  let maxX = w.x, still = 0, i = 0;
  for (; i < frames; i++) {
    if (w.dead || w.done) break;
    const h = mode === 'bot' ? botThink(w) : false;
    if (collect) rollTape.push(h);
    w.frame(h);
    if (w.x > maxX + 1e-9) { maxX = w.x; still = 0; } else still++;
    /* 卡住不动(既没前进也没死)= 这条兜底没意义,提前收工省算力 */
    if (still > 40) return { maxX, alive: !w.dead, done: w.done, stalled: !w.dead, frames: i + 1 };
  }
  return { maxX: Math.max(maxX, w.x), alive: !w.dead, done: w.done, stalled: false, frames: i };
}

interface EdgeOut {
  snap: WorldSnap | null;      // 精细落子:走完 STEP 帧之后的状态
  endSnap: WorldSnap | null;   // 宏落子:兜底活着走完视界之后的状态
  tap: boolean[];              // 兜底那一段的按键(只有宏落子 / 通关时才需要带走)
  score: number;               // 启发值
  done: boolean;
}
/** 走一条边:先按 pat 的 STEP 帧,再交给 mode 兜底最多 HORIZON 帧。
 *  ★ 按键【总是要记】的:宏落子要把这 90 帧的输入一起带走,不记的话拼出来的输入卷是错的
 *    (宏节点只带 STEP 帧的按键、状态却在 90 帧之后 —— 回放立刻分岔)。 */
function walkEdge(c: Cand): EdgeOut {
  rollTape.length = 0;
  for (let i = 0; i < STEP; i++) {
    if (w.dead || w.done) return { snap: null, endSnap: null, tap: [], score: w.x, done: w.done };
    w.frame(bit(c.pat, i));
  }
  if (w.done) return { snap: w.snapshot(), endSnap: null, tap: [], score: w.x, done: true };
  if (w.dead) return { snap: null, endSnap: null, tap: [], score: w.x, done: false };
  const snap = w.snapshot();

  let r = rollout(c.mode, HORIZON, true);
  /* 选中的兜底活不下去 → 换另一种兜底再试一次(松手不行就请反应式机器人,反之亦然) */
  if (!r.alive && !r.done) {
    const other: 'idle' | 'bot' = c.mode === 'idle' ? 'bot' : 'idle';
    const first = rollTape.slice();
    rollTape.length = 0;
    const r2 = rollout(other, HORIZON, true);
    if (r2.maxX > r.maxX || r2.done) r = r2;
    else { rollTape.length = 0; for (const h of first) rollTape.push(h); }
  }
  /* 宏落子:活着走完整个视界(没卡住)、而且真的前进了 → 这一整段可以直接落子 */
  const endSnap = (MACRO && r.alive && !r.done && !r.stalled && w.x - snap.x >= MINMACRO) ? w.snapshot() : null;
  /* 活着走到视界尽头 → 给一点"活着"的奖励(2 块):同样远的两个分支,先扩张没死的那个 */
  const score = Math.max(r.maxX, snap.x) + (r.alive && !r.stalled ? 2 * U : 0);
  const needTap = endSnap !== null || r.done;
  return { snap, endSnap, tap: needTap ? rollTape.slice() : [], score, done: r.done };
}

/* ---------------- 状态去重(同 tick 同状态的节点没必要重复展开) ---------------- */
const seen = new Set<string>();
function stateKey(s: WorldSnap): string {
  return s.tick + '|' + s.mode + '|' + s.gdir + '|' + s.sizeMul.toFixed(3) + '|' + (s.onGround ? 1 : 0)
    + '|' + s.x.toFixed(2) + '|' + s.y.toFixed(2) + '|' + s.vy.toFixed(2)
    + '|' + s.boostDir + '|' + (s.dash ? s.dash.kind + s.dash.t : '-')
    + '|' + s.sets[5].length + ',' + s.sets[6].length + ',' + s.sets[1].length;
}

/* ---------------- 输入卷拼装:沿父指针把每段落子的按键接起来 ---------------- */
function tapeOf(n: Node): boolean[] {
  const segs: boolean[][] = [];
  let total = 0;
  for (let p: Node | null = n; p && p.parent; p = p.parent) { segs.push(p.inputs); total += p.inputs.length; }
  const out: boolean[] = new Array(total);
  let k = 0;
  for (let i = segs.length - 1; i >= 0; i--) for (const h of segs[i]) out[k++] = h;
  return out;
}

/* ---------------- 热启动:把一条已知可行的输入卷铺成一条链,推进堆 ---------------- */
let nodes = 0, deadEnds = 0, dups = 0, bestAlive = 0, macros = 0, bestNode: Node | null = null;
if (SEED && fs.existsSync(SEED)) {
  const t: boolean[] = JSON.parse(fs.readFileSync(SEED, 'utf8')).tape;
  w.resetToStart();
  let seg: boolean[] = [], parent: Node | null = null, made = 0;
  const flush = () => {
    if (!seg.length) return;
    const n: Node = { snap: w.snapshot(), parent, inputs: seg, score: w.x, gen: -1 };
    seen.add(stateKey(n.snap));
    pushHeap(n); parent = n; made++; seg = [];
  };
  for (let i = 0; i < t.length; i++) {
    if (w.dead || w.done) break;
    w.frame(t[i]);
    seg.push(t[i]);
    /* 沿路按 HORIZON 切段:切出来的每一段都是一个可落子的宏,热启动之后能直接复用 */
    if (seg.length >= HORIZON) flush();
  }
  flush();
  console.log('热启动 ' + SEED + ':铺了 ' + made + ' 个节点,最远 ' + (w.x / U).toFixed(1) + ' 块');
  if (parent) { bestAlive = w.x; bestNode = parent; }
}

if (!heap.length) {
  w.resetToStart();
  pushHeap({ snap: w.snapshot(), parent: null, inputs: [], score: w.x, gen: -1 });   // 根:出生点
}

/* ---------------- 主循环 ---------------- */
const t0 = performance.now();
const endX = lv.length * U;
let solution: boolean[] | null = null;
let lastLog = 0;
const stuckAt = new Map<number, number>();     // 死胡同的 x 直方图(按 10 块一格)
const LOGSTEP = Number(arg('log', 15));

function saveBest() {
  if (!bestNode) return;
  fs.mkdirSync(path.dirname(BESTTAPE), { recursive: true });
  fs.writeFileSync(BESTTAPE, JSON.stringify({ level: lv.name, tape: tapeOf(bestNode), x: bestNode.snap.x / U }));
}

while (nodes < MAXNODES) {
  const el = (performance.now() - t0) / 1000;
  if (el > BUDGET) break;
  const node = popHeap();
  if (!node) break;
  node.gen = nodes++;

  /* 展开:每个候选先自己走 STEP 帧(便宜),活下来的才花算力试算 */
  const kids: Array<{ inputs: boolean[]; snap: WorldSnap; score: number }> = [];
  let solved = false;
  for (const c of CANDS) {
    w.restore(node.snap);
    const out = walkEdge(c);
    if (out.done) {                                // 试算走到终点 = 通关
      const tape = tapeOf(node);
      for (let i = 0; i < STEP; i++) tape.push(bit(c.pat, i));
      for (const h of out.tap) tape.push(h);
      solution = tape;
      solved = true;
      break;
    }
    if (!out.snap) continue;                       // 边内就死:这个候选作废
    const fine: boolean[] = [];
    for (let i = 0; i < STEP; i++) fine.push(bit(c.pat, i));
    /* 宏落子优先(它一次顶 30 次精细落子),没有宏就退成精细落子 */
    if (out.endSnap) {
      kids.push({ inputs: fine.concat(out.tap), snap: out.endSnap, score: out.score });
      macros++;
    } else {
      kids.push({ inputs: fine, snap: out.snap, score: out.score });
    }
  }
  if (solved) break;
  if (!kids.length) {                              // 死胡同 → 回溯到堆里下一个分支
    deadEnds++;
    const bx = Math.floor(node.snap.x / U / 10) * 10;
    stuckAt.set(bx, (stuckAt.get(bx) ?? 0) + 1);
    continue;
  }

  kids.sort((a, b) => b.score - a.score);
  let pushed = 0;
  for (const k of kids) {
    if (pushed >= BEAM) break;
    const key = stateKey(k.snap);
    if (seen.has(key)) { dups++; continue; }
    seen.add(key);
    const n: Node = { snap: k.snap, parent: node, inputs: k.inputs, score: k.score, gen: nodes };
    pushHeap(n);
    pushed++;
    if (k.snap.x > bestAlive) { bestAlive = k.snap.x; bestNode = n; }
  }
  if (!pushed) deadEnds++;
  pruneHeap();

  if (!QUIET && el - lastLog >= LOGSTEP) {
    lastLog = el;
    console.log('[' + el.toFixed(0) + 's] 展开 ' + nodes + ' · 堆 ' + heap.length + ' · 死胡同 ' + deadEnds
      + ' · 宏 ' + macros + ' · 重复 ' + dups + ' · 最远(活) ' + (bestAlive / U).toFixed(1) + '/' + lv.length
      + ' 块 = ' + (bestAlive / endX * 100).toFixed(1) + '%');
    saveBest();
  }
}

/* ---------------- 收尾 ---------------- */
const el = (performance.now() - t0) / 1000;
console.log('\n=== 搜索结束 ===');
console.log('铺面 ' + lv.name + ' · ' + lv.objects.length + ' 物件 · 长 ' + lv.length + ' 块 · 高 ' + lv.rows + ' 格');
console.log('展开 ' + nodes + ' 节点 · 死胡同 ' + deadEnds + ' · 宏落子 ' + macros + ' · 重复剪枝 ' + dups
  + ' · 堆剩 ' + heap.length + ' · 用时 ' + el.toFixed(1) + 's · ' + (nodes / Math.max(el, 1e-9)).toFixed(1) + ' 节点/秒');
console.log('最远(活着走到) ' + (bestAlive / U).toFixed(1) + ' 块 = ' + (bestAlive / endX * 100).toFixed(1) + '%');
if (stuckAt.size) {
  const top = [...stuckAt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('死胡同最密的地方(块 → 次数):' + top.map(([x, n]) => x + '→' + n).join(' · '));
}

if (solution) {
  const f = replay(lv, solution);
  const endXs = f.states[f.states.length - 1].x;
  console.log('\n★ 通关!输入卷 ' + solution.length + ' 帧 = ' + (solution.length / 60).toFixed(1) + ' 秒');
  console.log('回放校验:死亡 ' + f.deaths + ' 次 · done=' + f.done + ' · 终点 x=' + (endXs / U).toFixed(1)
    + ' 块 · 指纹 ' + fingerprint(f.states));
  fs.mkdirSync(path.dirname(TAPE), { recursive: true });
  fs.writeFileSync(TAPE, JSON.stringify({ level: lv.name, tape: solution, done: f.done, deaths: f.deaths }));
  console.log('输入卷写到 ' + TAPE);
} else {
  saveBest();
  console.log('没通关 —— 已把【活着走到的最远前缀】写到 ' + BESTTAPE + '(下次 --seed 接着搜)');
}
