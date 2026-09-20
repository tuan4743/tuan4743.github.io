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
/* --padmul=N —— 弹簧/跳环力度微调(和页面上的 [ / ] 同一个旋钮),用来做定点实验:
   "这一段到底要多大力度才过得去"比"猜一个常数"靠谱得多。 */
const PADMUL = Number(arg('padmul', 1));
if (PADMUL !== 1) { w.padMul = PADMUL; console.log('弹簧力度 ×' + PADMUL); }

/* ---------------- ★ 不许跳过事件门(否则搜出来的"通关"是飞过去的,证明不了任何东西) ----------------
 * 踩过的坑:第一版搜索报"通关",可回放一看 —— 玩家在第 2000 帧左右进了 UFO,
 * 然后一路贴着天花板(y≈110~124 块)飞完全关,46 个门【一个都没碰到】:
 *    门 x=439.5 → 想去 spider · 跨过时 y=121.46,门中心 y=7.50 · 当时形态=ufo
 * 这不是物理错(GD 里门是"外框相交"才算碰到,飞得高确实碰不到),但它意味着
 * 那次"通关"没有验证飞机/蜘蛛/波浪/机器人任何一段 —— 而这张图里那几个门本来就是
 * 关卡设计的一部分(作者自己设了存档点,说明他指望玩家按这条路线走)。
 * 所以给搜索加一条约束:任何必过门(形态/重力/速度/尺寸)完全过去之后,
 * 它在世界里的 armed 标记必须已经置位,否则这条路判死(只在搜索里生效,不改物理)。
 * 约束只做剪枝:搜出来的输入卷在【不带约束】的物理上照样成立(verify-run 就是不带约束验的)。 */
const MUSTPASS = (arg('noskip', 'portal,gravity,speed,size') || '').split(',').filter(Boolean);
/* --start=395,8,ufo —— 从半路起搜(诊断用:整关搜不动时,把搜索根挪到某一段单独啃)。
   起点之前的必过门自动算"已经过了",不然一开局就被判跳过。 */
const START = arg('start', '');
const startAt = START ? START.split(',').map(Number) : null;
const startX = startAt ? startAt[0] * U : 0;
const mustPass = w.portals
  .filter((b) => MUSTPASS.includes(b.o.kind) && b.x1 > startX)
  .sort((a, b) => a.x1 - b.x1);
const armedOf = (world: World) => (world as unknown as { armedPortals: Set<unknown> }).armedPortals;
const NOSKIP = mustPass.length > 0;
console.log('必过门 ' + mustPass.length + ' 个(' + MUSTPASS.join('/') + ')· 跳过即判死');

/** 推进一帧(搜索里所有推进都要走这里,约束才生效) */
function step(hold: boolean) {
  w.frame(hold);
  if (!NOSKIP || w.dead || w.done) return;
  const armed = armedOf(w);
  for (const b of mustPass) {
    if (w.x < b.x1) break;                       // 还没完全越过这个门
    if (armed.has(b)) continue;                  // 碰到了 ✓
    w.dead = true;                               // 完全越过了却没碰到 → 这条路作废
    return;
  }
}

/* ---------------- ★ 朝门口的梯度(只有"跳过就判死"是不够的) ----------------
 * 光加硬约束,搜索会一直卡在门口:贴天花板那条路 x 走得最远,**分数最高**,
 * 可它在剩下几十块里根本降不到门口的 y —— 于是最优优先一遍遍展开这些"走得远但到不了门"的路,
 * 7 万节点、6 次重启都卡在 x=421(整关搜索),而从 x=390 起搜(前沿干净)90 秒就过去了。
 * 加一条启发:快到下一个必过门时(60 块内),按【玩家盒子到门盒子的纵向距离】扣分 ——
 * 离门口越近的路越优先,"飞得高"的路自然沉下去。 */
const APPROACH = Number(arg('approach', 60)) * U;
function vertGap(u: { y0: number; y1: number }, b: { y0: number; y1: number }): number {
  return Math.max(0, Math.max(b.y0 - u.y1, u.y0 - b.y1));
}
function portalPull(): number {
  if (!NOSKIP) return 0;
  const armed = armedOf(w);
  let next: (typeof mustPass)[number] | null = null;
  for (const b of mustPass) if (!armed.has(b)) { next = b; break; }
  if (!next) return 0;
  if (w.x < next.x0 - APPROACH || w.x > next.x1 + 2 * U) return 0;   // 还没进入"最后这一段"就不管
  /* ★ 权重必须压过"横向领先":贴天花板那条路比贴地路多走了 30 块,可它纵向差着 117 块 ——
     如果只按"离门口多高"扣一点点,它照样排第一(实测:扣 24 块时它仍然是堆顶,搜索继续绕圈)。
     所以留 2 块容差,超出部分按 3 倍扣:差 117 块 ≈ 扣掉 345 块的分,
     于是"落后但走在对的路上"一定排在"冲到门口却够不着"前面。 */
  const gap = vertGap({ x0: w.x, x1: w.x + w.box, y0: w.y, y1: w.y + w.box }, next);
  return Math.min(Math.max(0, gap - 2 * U) * 3, 400 * U);
}

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

/* ---------------- ★ 前沿聚焦(不加这条,搜索会在一处死磕到天荒地老) ----------------
 * 现象:加"必过门"约束后,整关搜索卡在 x=421 那一处 6 万节点也过不去;
 * 而把搜索根直接挪到 x=390 单独搜,同一段 90 秒就过了(x=526)。
 * 原因不是那一段没法过,而是【前沿里堆满了同一个岔路口的近似状态】(分数全是 421.x),
 * 最优优先退化成"把所有平局状态挨个展开一遍"。
 * 对策:前沿只保留"离已到达的最远进度 WINDOW 块以内"的节点 —— 备选分支还在(同一段里的
 * 其它走法都留着),但不会再去啃几十块之前的老岔路。 */
const WINDOW = Number(arg('window', 30)) * U;
let frontierBest = 0, focused = 0;
function focusFrontier() {
  if (heap.length <= 800) return;
  const cut = frontierBest - WINDOW;
  let kept = 0;
  for (let i = 0; i < heap.length; i++) if (heap[i].score >= cut) heap[kept++] = heap[i];
  if (kept === heap.length) return;
  focused += heap.length - kept;
  heap.length = Math.max(kept, 64);              // 至少留一点,别把路走绝
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
    step(h);
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
    step(bit(c.pat, i));
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
  const score = Math.max(r.maxX, snap.x) + (r.alive && !r.stalled ? 2 * U : 0) - portalPull();
  const needTap = endSnap !== null || r.done;
  return { snap, endSnap, tap: needTap ? rollTape.slice() : [], score, done: r.done };
}

/* ---------------- ★ 分阶段重启(整关搜索卡住时的救命招) ----------------
 * 现象:加了"必过门"约束后,整关搜索 7 万节点卡在 x=421(那个 cube 门);可从 x=390 起搜,
 * 同一段 90 秒就过去了。差别不在算力,在【前沿的位置】:
 *   贴天花板那条路(x=390 时 y≈120)在 31 块的距离内根本降不到门口(y=5),
 *   而分数只按 x 排 —— 天花板路和贴地路同分,搜索在成千上万个"同分不同高度"的状态里打转。
 * 对策:每跑 PHASE 秒,把前沿清空、只留【活着走到最远】那条路的节点链,重新展开。
 *   重启后 = 换一局心态从那里接着搜:同样的动作试过就跳过(seen 还在),于是自动换下一个走法。
 *   —— 这就是从 x=390 起搜为什么会成功:前沿是干净的,没有几十块之前的老岔路拖后腿。 */
const PHASE = Number(arg('phase', 45)) * 1000;
let nextPhase = PHASE, restarts = 0;
function restartFromBest() {
  if (!bestNode) return;
  const chain: Node[] = [];
  for (let p: Node | null = bestNode; p; p = p.parent) chain.push(p);
  heap.length = 0;
  for (let i = chain.length - 1; i >= 0; i--) pushHeap(chain[i]);
  frontierBest = bestNode.score;
  restarts++;
}

/* ---------------- 状态去重(同 tick 同状态的节点没必要重复展开) ---------------- */
const seen = new Set<string>();
function stateKey(s: WorldSnap): string {
  return s.tick + '|' + s.mode + '|' + s.gdir + '|' + s.sizeMul.toFixed(3) + '|' + (s.onGround ? 1 : 0)
    + '|' + s.x.toFixed(2) + '|' + s.y.toFixed(2) + '|' + s.vy.toFixed(2)
    + '|' + s.boostDir + '|' + (s.dash ? s.dash.kind + s.dash.t : '-')
    + '|' + s.sets[5].length + ',' + s.sets[6].length + ',' + s.sets[1].length;
}

/* ---------------- 输入卷拼装:沿父指针把每段落子的按键接起来 ----------------
 * ★ 这里踩过一个很贵的坑:`for (p = n; p && p.parent; ...)` 会把【链根】那一段按键丢掉。
 *   出生点是根时它的 inputs 本来是空的,看不出问题;可 --seed 热启动时根是半路的一个节点,
 *   它的 inputs 是一整段前缀 —— 丢掉的后果是【存下来的卷子自己回放不出来】:
 *   分站搜到 x=512.9 的那一卷,重新回放第 182 帧就死了(少了一整段)。所以根也要算。 */
function tapeOf(n: Node): boolean[] {
  const segs: boolean[][] = [];
  let total = 0;
  for (let p: Node | null = n; p; p = p.parent) { segs.push(p.inputs); total += p.inputs.length; }
  const out: boolean[] = new Array(total);
  let k = 0;
  for (let i = segs.length - 1; i >= 0; i--) for (const h of segs[i]) out[k++] = h;
  return out;
}

/* ---------------- 热启动:把一条已知可行的输入卷铺成一条链,推进堆 ---------------- */
let nodes = 0, deadEnds = 0, dups = 0, bestAlive = 0, macros = 0, bestNode: Node | null = null;
if (SEED && fs.existsSync(SEED)) {
  let t: boolean[] = JSON.parse(fs.readFileSync(SEED, 'utf8')).tape;
  /* --seedtrim=块 —— 把种子的尾巴剪掉这么多块再接着搜。
     为什么要它:分站搜有时会"卡在自己的尾巴上" —— 上一次的最优前缀末端是个死状态
     (实测 x=512.9 那一步是个在天上 75 格往上飞的球),从那一点往后怎么搜都没有出路,
     而重新规划必须【退回到岔路口】。剪掉尾巴 = 把搜索根往前挪一点,换一条微路线重来。 */
  const trimBlocks = Number(arg('seedtrim', 0));
  if (trimBlocks > 0 && t.length > 60) {
    const rawX = JSON.parse(fs.readFileSync(SEED, 'utf8')).x ?? 0;
    const perBlock = rawX > 1 ? t.length / rawX : 6.5;
    const cut = Math.min(t.length - 60, Math.round(trimBlocks * perBlock));
    t = t.slice(0, t.length - cut);
    console.log('种子剪尾 ' + trimBlocks + ' 块(约 ' + cut + ' 帧)→ 从 ' + t.length + ' 帧重新规划');
  }
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
    step(t[i]);
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
  if (startAt) {
    /* 半路起搜:把人放到指定位置/形态(诊断用)。y 用块、x 用块。 */
    w.x = startAt[0] * U; w.y = startAt[1] * U; w.vy = 0; w.onGround = false;
    w.mode = (arg('startmode', 'cube') as typeof w.mode);
    w.checkX = w.x; w.checkY = w.y;
    console.log('半路起搜:x=' + startAt[0] + ' y=' + startAt[1] + ' 形态=' + w.mode
      + ' · 之后的必过门 ' + mustPass.length + ' 个(最近一个 x=' + (mustPass[0] ? (mustPass[0].x1 / U).toFixed(1) : '-') + ')');
  }
  pushHeap({ snap: w.snapshot(), parent: null, inputs: [], score: w.x, gen: -1 });   // 根
}

/* ---------------- 主循环 ---------------- */
const t0 = performance.now();
const endX = lv.length * U;
const GOAL = arg('goal', '') ? Number(arg('goal')) * U : Infinity;
let goalHit = false;
let solution: boolean[] | null = null;
let lastLog = 0;
const stuckAt = new Map<number, number>();     // 死胡同的 x 直方图(按 10 块一格)
const LOGSTEP = Number(arg('log', 15));

function saveBest() {
  if (!bestNode) return;
  fs.mkdirSync(path.dirname(BESTTAPE), { recursive: true });
  const tape = tapeOf(bestNode);
  /* ★ 存之前先自检:这一卷输入从出生点原样回放,必须走到 bestNode 那个 x。
     不查这一条的话,一卷"走不通的输入卷"会被写进文件,而分站搜下一站时用它当种子 ——
     错误会一路滚下去(踩过:文件写着 512.9 块,回放 182 帧就死)。 */
  const check = new World(lv);
  for (const h of tape) { if (check.dead || check.done) break; check.frame(h); }
  const drift = Math.abs(check.x - bestNode.snap.x);
  if (drift > 1) {
    console.log('⚠ 存盘自检不过:回放走到 ' + (check.x / U).toFixed(1) + ' 块,节点状态是 '
      + (bestNode.snap.x / U).toFixed(1) + ' 块(差 ' + (drift / U).toFixed(2) + ' 块)—— 输入卷拼错了,不写文件');
    return;
  }
  /* ★ 只准变好:分站搜里后一次尝试(比如"种子剪尾 45 块重规划")可能只走到一半,
     直接覆盖就把冠军卷子弄丢了(踩过:跑到 521.3 又被 512.9 盖掉)。 */
  const prevX = fs.existsSync(BESTTAPE) ? (JSON.parse(fs.readFileSync(BESTTAPE, 'utf8')).x ?? 0) : 0;
  if (bestNode.snap.x / U < prevX) return;
  fs.writeFileSync(BESTTAPE, JSON.stringify({ level: lv.name, tape, x: bestNode.snap.x / U }));
}

while (nodes < MAXNODES) {
  const el = (performance.now() - t0) / 1000;
  if (el > BUDGET) break;
  /* --goal=块 —— 分站搜:到了这一站就收工(外面套一层循环,一站一站往终点推)。
     为什么要分站:整关一次性搜时,每到一个门就是一个"卡口"(实测 x=421 / 512 各卡住几万节点),
     而把根挪到卡口前面单独搜,几十秒就过去了 —— 分站等于自动做这件事。 */
  if (bestAlive >= GOAL) { goalHit = true; break; }
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
    if (k.score > frontierBest) frontierBest = k.score;
    if (k.snap.x > bestAlive) { bestAlive = k.snap.x; bestNode = n; }
  }
  if (!pushed) deadEnds++;
  pruneHeap();
  focusFrontier();
  if (performance.now() - t0 > nextPhase) { nextPhase += PHASE; restartFromBest(); }

  if (!QUIET && LOGSTEP > 0 && el - lastLog >= LOGSTEP) {
    lastLog = el;
    console.log('[' + el.toFixed(0) + 's] 展开 ' + nodes + ' · 堆 ' + heap.length + ' · 死胡同 ' + deadEnds
      + ' · 宏 ' + macros + ' · 重复 ' + dups + ' · 聚焦丢 ' + focused + ' · 重启 ' + restarts
      + ' · 最远(活) ' + (bestAlive / U).toFixed(1)
      + '/' + lv.length + ' 块 = ' + (bestAlive / endX * 100).toFixed(1) + '%');
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
if (goalHit) console.log('★ 到站:--goal=' + (GOAL / U).toFixed(1) + ' 块(前缀已写进 best 文件,可以接着下一站)');
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
