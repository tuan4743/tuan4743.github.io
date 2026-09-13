/* 定点模拟核心:零依赖、零引擎、零随机、可在 Node 里跑。
 *
 * 时间模型:外部按【帧】驱动(60 帧/秒),内部一律拆成 4 个子步(1/240 秒),
 * 和原作"每帧 4 个子步"的结构一致,但我们的步长是固定的 ——
 * 于是"同一串输入 → 同一串状态"永远成立,可以录回放、可以写指纹测试。
 *
 * 坐标:一律用 GD 口径的【单位】(1 块 = 30 单位),x 向右、y 向上,玩家 (x,y) 是【左下角】。
 */

import { P, U, ROWS, JUMP_SPAN_BLOCKS } from './constants.ts';
import type { Level, Mode, Obj } from './level.ts';

export interface RunState {
  tick: number; x: number; y: number; vy: number; onGround: boolean;
  mode: Mode; gdir: number; speed: number; dead: boolean; done: boolean;
  attempts: number; checkX: number; progress: number;
}

interface Box { x0: number; x1: number; y0: number; y1: number; o: Obj }

const SUB = 4;                 // 每帧 4 个子步
const FRAME = 1 / 60;

export class World {
  level: Level;
  readonly solids: Box[] = [];      // 实心:踩上面能站,撞侧面死
  readonly floors: Box[] = [];      // 平台/地面:只从上面接住,不致死
  readonly hazards: Box[] = [];     // 尖刺
  readonly portals: Box[] = [];
  readonly speeds: Box[] = [];
  readonly gravs: Box[] = [];
  readonly checks: Box[] = [];
  readonly decos: Obj[] = [];

  tick = 0;
  x = 0; y = 0; vy = 0; onGround = true;
  mode: Mode = 'cube';
  gdir = 1;
  speedIdx = 1;
  dead = false; done = false; deadT = 0;
  attempts = 1;
  checkX = 0; checkMode: Mode = 'cube';
  private armedChecks = new Set<Box>();
  private armedPortals = new Set<Box>();
  private armedSpeeds = new Set<Box>();
  private armedGravs = new Set<Box>();

  constructor(level: Level, startX = 0) {
    this.level = level;
    for (const o of level.objects) {
      const b: Box = { x0: o.b * U, x1: (o.b + o.w) * U, y0: o.r * U, y1: (o.r + o.h) * U, o };
      switch (o.kind) {
        case 'block': this.solids.push(b); break;
        case 'platform': this.floors.push(b); break;
        case 'spike': {
          const inset = (1 - P.spikeHitScale) / 2 * (o.w * U);
          this.hazards.push({ x0: b.x0 + inset, x1: b.x1 - inset, y0: b.y0, y1: b.y0 + 0.7 * U, o });
          break;
        }
        case 'portal': this.portals.push(b); break;
        case 'speed': this.speeds.push(b); break;
        case 'gravity': this.gravs.push(b); break;
        case 'check': this.checks.push(b); break;
        case 'deco': this.decos.push(o); break;
      }
    }
    this.reset(startX, 'cube');
  }

  /** 速度(单位/帧) */
  get vx() { return P.xVel * P.speedMul[this.speedIdx]; }

  /** 内判定框(比外框小得多 —— 原作就是靠这个"看着撞上却没死") */
  private inner() {
    const off = P.innerOff;
    return { x0: this.x + off, x1: this.x + off + P.inner, y0: this.y + off, y1: this.y + off + P.inner };
  }

  reset(startX: number, mode: Mode) {
    this.tick = 0;
    this.x = startX; this.y = 0; this.vy = 0; this.onGround = true;
    this.mode = mode; this.gdir = 1; this.speedIdx = 1;
    this.dead = false; this.done = false; this.deadT = 0;
    this.armedChecks.clear(); this.armedPortals.clear(); this.armedSpeeds.clear(); this.armedGravs.clear();
  }

  /** 死后重来:回到最近跨过的存档点(没有就用关卡起点) */
  respawn() {
    this.attempts++;
    this.reset(this.checkX, this.checkMode);
  }

  get progress() { return Math.max(0, Math.min(1, this.x / (this.level.length * U))); }

  /** 这一列有没有地板?没有就是坑(机器人靠它判断) */
  floorTopAt(x: number, y: number): number | null {
    let best: number | null = null;
    for (const f of this.floors) {
      if (x < f.x0 || x > f.x1) continue;
      if (f.y1 <= y + 0.001) { if (best === null || f.y1 > best) best = f.y1; }
    }
    return best;
  }

  /** 推进一帧。hold = 是否按住(方块:长按连跳;飞机:按住上升) */
  frame(hold: boolean) {
    if (this.dead || this.done) { this.deadT += FRAME; return; }
    for (let i = 0; i < SUB; i++) this.substep(FRAME / SUB, hold);
    this.tick++;
  }

  private substep(dt: number, hold: boolean) {
    const s = dt * 60;                     // 帧当量:表里的常量按"每帧"给
    const prevX = this.x, prevY = this.y, prevVy = this.vy;

    this.x += this.vx * s;

    if (this.mode === 'ship') {
      const acc = hold ? (this.gdir * P.shipAccelUp) : (this.gdir * P.shipAccelDown);
      this.vy += acc * s;
      this.vy = Math.max(-P.shipVyMax, Math.min(P.shipVyMax, this.vy));
      this.y += this.vy * s;
      if (this.y < 0 || this.y + P.box > ROWS * U) { this.die(); return; }
    } else {
      /* 方块:按住且在落地状态就起跳 —— 按住不放 = 落地自动连跳(原作手感) */
      if (hold && this.onGround) { this.vy = P.jump * this.gdir; this.onGround = false; }
      this.vy -= P.gravity * this.gdir * s;
      this.vy = Math.max(-P.vyMax, Math.min(P.vyMax, this.vy));
      this.y += this.vy * s;
    }

    /* --- 踩实体:下落时脚底穿过台面就接住(单向地板,永不致死) --- */
    if (this.mode === 'cube') {
      let support: number | null = null;
      for (const f of this.floors) {
        if (this.x + P.box <= f.x0 || this.x >= f.x1) continue;
        if (prevY >= f.y1 - 0.01 && this.y <= f.y1) { if (support === null || f.y1 > support) support = f.y1; }
      }
      for (const b of this.solids) {
        if (this.x + P.box <= b.x0 || this.x >= b.x1) continue;
        if (prevY >= b.y1 - 0.01 && this.y <= b.y1) { if (support === null || b.y1 > support) support = b.y1; }
      }
      if (support !== null && this.vy <= 0) { this.y = support; this.vy = 0; this.onGround = true; }
      else this.onGround = false;

      // 掉出世界 = 死(坑)
      if (this.y < -2.5 * U) { this.die(); return; }

      // 实心方块:从侧面/下方撞上就死
      const inn = this.inner();
      for (const b of this.solids) {
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        // 上面那种情况已经在"踩实体"里处理了
        if (prevY >= b.y1 - 0.01 && this.y <= b.y1) continue;
        this.die(); return;
      }
    }

    /* --- 尖刺:内框相交就死 --- */
    {
      const inn = this.inner();
      for (const hz of this.hazards) {
        if (inn.x1 > hz.x0 && inn.x0 < hz.x1 && inn.y1 > hz.y0 && inn.y0 < hz.y1) { this.die(); return; }
      }
    }

    /* --- 触发器:必须先真的跨过去(交叉判定),复活点落在它右边时不会误触发 --- */
    for (const b of this.portals) {
      if (this.armedPortals.has(b)) continue;
      if (prevX + P.box <= b.x0 || this.x >= b.x1) continue;
      this.armedPortals.add(b);
      this.mode = (b.o.to ?? 'cube');
      this.vy = 0;
      if (this.mode === 'ship') { this.y = Math.max(this.y, 3 * U); this.gdir = 1; }
      else this.onGround = false;
    }
    for (const b of this.speeds) {
      if (this.armedSpeeds.has(b)) continue;
      if (prevX + P.box <= b.x0 || this.x >= b.x1) continue;
      this.armedSpeeds.add(b);
      this.speedIdx = Math.max(0, Math.min(P.speedMul.length - 1, b.o.speed ?? 1));
    }
    for (const b of this.gravs) {
      if (this.armedGravs.has(b)) continue;
      if (prevX + P.box <= b.x0 || this.x >= b.x1) continue;
      this.armedGravs.add(b);
      this.gdir = -this.gdir;
      this.vy = 0;
    }
    for (const b of this.checks) {
      if (this.armedChecks.has(b)) continue;
      if (prevX + P.box <= b.x0 || this.x >= b.x1) continue;
      this.armedChecks.add(b);
      this.checkX = b.x0;
      this.checkMode = this.mode;
    }

    if (this.x >= this.level.length * U) { this.done = true; }
    void prevVy;
  }

  private die() { if (!this.dead) { this.dead = true; this.deadT = 0; } }

  get state(): RunState {
    return {
      tick: this.tick, x: this.x, y: this.y, vy: this.vy, onGround: this.onGround,
      mode: this.mode, gdir: this.gdir, speed: this.speedIdx, dead: this.dead, done: this.done,
      attempts: this.attempts, checkX: this.checkX, progress: this.progress,
    };
  }
}

/* ---------------- 自动播放机器人(验收用:证明"这一版铺面真的能过") ----------------
   刻意写得笨一点:只看"前方最近要跳的东西"和"这一列有没有地板"。
   它的存在不是为了好玩,而是当作"铺面可通过性"的自动化证明。 */
export function botThink(w: World): boolean {
  const BL = U;
  if (w.mode === 'ship') {
    // 目标:前方 3 块处那一列里,最大空隙的中心
    const probeX = w.x + 3 * BL;
    let y0 = 0, y1 = ROWS * U;
    const blocks = [...w.solids].filter((b) => probeX >= b.x0 && probeX <= b.x1).sort((a, b) => a.y0 - b.y0);
    let bestGap = { a: 0, b: ROWS * U, size: ROWS * U };
    let cursor = 0;
    for (const b of blocks) {
      if (b.y0 - cursor > bestGap.size) bestGap = { a: cursor, b: b.y0, size: b.y0 - cursor };
      cursor = Math.max(cursor, b.y1);
    }
    if (ROWS * U - cursor > bestGap.size) bestGap = { a: cursor, b: ROWS * U, size: ROWS * U - cursor };
    const target = (bestGap.a + bestGap.b) / 2 - P.box / 2;
    void y0; void y1;
    return w.y < target - 2;
  }
  /* 方块:两条判据都要按【内框】算,不能按外框 ——
     实测教训:按"前缘到远边"算会早跳约 0.8 块,弧线顶点落在障碍之前,落地时正好压在尖刺上。
     内框左缘在 x + innerOff 处,所以起跳后它能前进的距离 = 一跳跨度 − innerOff − 余量。 */
  const span = JUMP_SPAN_BLOCKS * U;
  const reach = span - P.innerOff - 6;
  let best: { x0: number; x1: number } | null = null;
  for (const o of [...w.hazards.filter((h) => h.y0 < 2 * U), ...w.solids.filter((s) => s.y1 <= 2 * U)]) {
    if (o.x1 - w.x < 0) continue;                          // 已经过去了
    if (!best || o.x0 < best.x0) best = o;
  }
  if (best && best.x1 - w.x <= reach) return true;
  /* 坑:先找出脚下的地板、以及它右边下一块地板 —— 两者之间就是缺口。
     必须在"落到对面"的窗口里起跳:太早会掉进坑,太晚就来不及。 */
  for (const f of w.floors) {
    if (w.x + P.box <= f.x0 || w.x >= f.x1) continue;      // 玩家不站在这块地板上
    let next: number | null = null;
    for (const g of w.floors) {
      if (g.x0 >= f.x1 - 1 && (next === null || g.x0 < next)) next = g.x0;
    }
    if (next === null) continue;                           // 右侧没地板了(关卡尾部)
    const pitFar = next;
    const jumpFrom = pitFar - span + 24;                   // 落点要越过缺口对面
    if (w.x >= jumpFrom && w.x < f.x1) return true;
  }
  return false;
}
