/* 定点模拟核心:零依赖、零引擎、零随机、可在 Node 里跑。
 *
 * 时间模型:外部按【帧】驱动(60 帧/秒),内部一律拆成 4 个子步(1/240 秒),
 * 和原作"每帧 4 个子步"的结构一致,但我们的步长是固定的 ——
 * 于是"同一串输入 → 同一串状态"永远成立,可以录回放、可以写指纹测试。
 *
 * 坐标:一律用 GD 口径的【单位】(1 块 = 30 单位),x 向右、y 向上,玩家 (x,y) 是【左下角】。
 */

import { P, U, ROWS, Y_TIME_SCALE, vxOf, arcSpan, ORB, PAD } from './constants.ts';
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
  readonly orbs: Box[] = [];        // 跳环:要玩家按(按住也算)才生效
  readonly pads: Box[] = [];        // 弹簧:碰到就生效,不用手
  readonly pits: Box[] = [];        // 坑(纯标记,给机器人判"脚下有没有地板"用)
  readonly decos: Obj[] = [];

  tick = 0;
  x = 0; y = 0; vy = 0; onGround = true;
  mode: Mode = 'cube';
  gdir = 1;
  speedIdx = 1;
  dead = false; done = false; deadT = 0;
  attempts = 1;
  checkX = 0; checkMode: Mode = 'cube';
  /** ★ 跳环要"一次新的按键"才生效(原作口径:按一下消耗一次,按住不放串不起环)。
   *  按下的那一瞬间 pressFresh 置位,被一次起跳或一个环用掉;松手再按才会有新的一次。 */
  pressFresh = false;
  /** 上一帧是否按着(botThink 要靠它凑出"松一帧再按"的新按键) */
  prevHold = false;
  /** 机器人"抵消重力"已经撑了多久(秒) */
  floatT = 0;
  private armedChecks = new Set<Box>();
  private armedPortals = new Set<Box>();
  private armedSpeeds = new Set<Box>();
  private armedGravs = new Set<Box>();
  private armedOrbs = new Set<Box>();
  private armedPads = new Set<Box>();

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
        case 'orb': this.orbs.push(b); break;
        case 'pad': this.pads.push(b); break;
        case 'pit': this.pits.push(b); break;
        case 'deco': this.decos.push(o); break;
      }
    }
    this.reset(startX, 'cube');
  }

  /** 速度(单位/帧)—— 速度门给的是"速度值 × 倍率",不是直接的每帧位移 */
  get vx() { return vxOf(this.speedIdx); }

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
    this.pressFresh = false; this.prevHold = false;
    this.armedChecks.clear(); this.armedPortals.clear(); this.armedSpeeds.clear(); this.armedGravs.clear();
    this.armedOrbs.clear(); this.armedPads.clear();
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
    /* 按键的"上升沿":原作 pushButton 就是在这个时刻清掉环的可用标记 */
    if (hold && !this.prevHold) this.pressFresh = true;
    this.prevHold = hold;
    if (this.dead || this.done) { this.deadT += FRAME; return; }
    for (let i = 0; i < SUB; i++) this.substep(FRAME / SUB, hold);
    this.tick++;
  }

  private substep(dt: number, hold: boolean) {
    const s = dt * 60;                     // 帧当量:表里的常量按"每帧"给
    const sY = s * Y_TIME_SCALE;           // ★ y 轴(含重力)按 dt×0.9 走 —— 原作就是这么积分的
    const prevX = this.x, prevY = this.y, prevVy = this.vy;

    this.x += this.vx * s;

    if (this.mode === 'ship') {
      const acc = hold ? (this.gdir * P.shipAccelUp) : (this.gdir * P.shipAccelDown);
      this.vy += acc * sY;
      this.vy = Math.max(-P.shipVyMax, Math.min(P.shipVyMax, this.vy));
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + P.box > ROWS * U) { this.die(); return; }
    } else if (this.mode === 'wave') {
      /* 波浪:垂直速度【每步直接赋值】= ±水平速度 → 永远 45°(反编译口径,y 轴不夹)
         —— 这形态没有重力,按住就往上、松开就往下。 */
      this.vy = (hold ? 1 : -1) * this.vx;
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + P.box > ROWS * U) { this.die(); return; }
    } else if (this.mode === 'ufo') {
      /* UFO:点一下给一个上冲,平时往下掉;在 GD 里它和飞机共用那套飞行夹取(上 8 / 下 -6.4) */
      if (hold && this.pressFresh) { this.vy = P.ufoImpulse; this.pressFresh = false; }
      this.vy -= P.gravity * sY;
      this.vy = Math.max(P.flyDownMax, Math.min(P.flyUpMax, this.vy));
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + P.box > ROWS * U) { this.die(); return; }
    } else if (this.mode === 'ball') {
      /* 球:重力 ×0.6;点一下【翻重力】并把垂直速度 ×0.6(反编译口径) */
      if (hold && this.pressFresh) { this.gdir = -this.gdir; this.vy *= P.ballFlipVelMul; this.pressFresh = false; }
      this.vy -= P.gravity * P.ballGravityMul * this.gdir * sY;
      if (this.vy * this.gdir < 0) this.vy = Math.max(-P.vyMax, Math.min(P.vyMax, this.vy));
      this.y += this.vy * sY;
    } else if (this.mode === 'spider') {
      /* 蜘蛛:点一下【传送到对面】再翻重力(反编译:搜索带厚度 = 体积 ×8) */
      if (hold && this.pressFresh) { this.spiderJump(); this.pressFresh = false; }
      this.vy -= P.gravity * this.gdir * sY;
      if (this.vy * this.gdir < 0) this.vy = Math.max(-P.vyMax, Math.min(P.vyMax, this.vy));
      this.y += this.vy * sY;
    } else {
      /* 方块 / 机器人:按住且在落地状态就起跳 —— 按住不放 = 落地自动连跳(原作手感)。
         起跳会消耗掉这次按键,所以"按着不放"串不起跳环(和原作一致)。
         机器人起跳只有普通的一半,但按住不放可以"抵消重力"一段时间(浮着走)。 */
      if (hold && this.onGround) {
        const power = this.mode === 'robot' ? P.jump * P.robotJumpMul : P.jump;
        this.vy = power * this.gdir;
        this.onGround = false;
        this.pressFresh = false;
        if (this.mode === 'robot') this.floatT = 0;
      }
      if (this.mode === 'robot') {
        this.floatT += FRAME / 4;                       // 每次子步推进(4 步 = 一帧)
        const floating = hold && !this.onGround && this.floatT < P.robotFloat;
        if (!floating) this.vy -= P.gravity * this.gdir * sY;   // 浮着的时候重力被抵消
      } else {
        this.vy -= P.gravity * this.gdir * sY;
      }
      /* ★ 终端速度只夹【下落】方向(原作在 falling 分支里夹):
         所以黄弹簧的 16 能原样生效,峰值才有 4.45 块,而不是被夹到 3.9 */
      if (this.vy * this.gdir < 0) this.vy = Math.max(-P.vyMax, Math.min(P.vyMax, this.vy));
      this.y += this.vy * sY;
    }

    /* --- 踩实体:顺着重力方向接住(正重力踩上面;反重力贴天花板与方块底面) ---
     * 方块 / 球 / 机器人 / 蜘蛛都走这段;飞机、UFO、波浪是"飞行类",碰到即死。 */
    if (this.mode !== 'ship' && this.mode !== 'ufo' && this.mode !== 'wave') {
      const boxTop = this.y + P.box, prevTop = prevY + P.box;
      let support: number | null = null;
      if (this.gdir > 0) {
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
      } else {
        /* 反重力:场地顶就是一层实心天花板,方块/平台的底面也能贴住 */
        support = ROWS * U;
        for (const f of this.floors) {
          if (this.x + P.box <= f.x0 || this.x >= f.x1) continue;
          if (prevTop <= f.y0 + 0.01 && boxTop >= f.y0 && f.y0 < support) support = f.y0;
        }
        for (const b of this.solids) {
          if (this.x + P.box <= b.x0 || this.x >= b.x1) continue;
          if (prevTop <= b.y0 + 0.01 && boxTop >= b.y0 && b.y0 < support) support = b.y0;
        }
        if (this.vy >= 0) { this.y = support - P.box; this.vy = 0; this.onGround = true; }
        else this.onGround = false;
        if (this.y + P.box > ROWS * U + 2.5 * U) { this.die(); return; }
      }

      // 实心方块:从侧面撞上就死(正重力时"落在顶面"、反重力时"贴住底面"都不算撞)
      const inn = this.inner();
      for (const b of this.solids) {
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        if (this.gdir > 0 && prevY >= b.y1 - 0.01 && this.y <= b.y1) continue;
        if (this.gdir < 0 && prevTop <= b.y0 + 0.01 && boxTop >= b.y0) continue;
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

    /* --- 弹簧(跳板):碰到就生效,不用按键 —— "连续鼓点用弹簧连起来"靠的就是这条 --- */
    {
      const inn = this.inner();
      for (const b of this.pads) {
        if (this.armedPads.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedPads.add(b);
        if (b.o.pad) this.applyTrigger(PAD[b.o.pad]);
      }
    }

    /* --- 跳环:要一次【新的按键】才生效 —— 空中二段跳靠它,而"按住不放"串不起一串环(原作口径) --- */
    if (hold && this.pressFresh) {
      const inn = this.inner();
      for (const b of this.orbs) {
        if (this.armedOrbs.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedOrbs.add(b);
        if (b.o.orb) this.applyTrigger(ORB[b.o.orb], true);
        break;
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

  /** 蜘蛛点一下:在"当前重力的反方向"那个带子里找最近的一层地面/方块底面,传送过去再翻重力 */
  private spiderJump() {
    const band = P.spiderBand * U;
    const top = () => this.y + P.box;
    let best: number | null = null;
    if (this.gdir > 0) {
      /* 正重力:往【上】找最近的底面(方块底 / 平台底 / 场地顶) */
      best = ROWS * U;
      for (const s of this.solids) {
        if (this.x + P.box <= s.x0 || this.x >= s.x1) continue;
        if (s.y0 < top() + 1) continue;
        if (best === null || s.y0 < best) best = s.y0;
      }
      for (const f of this.floors) {
        if (this.x + P.box <= f.x0 || this.x >= f.x1) continue;
        if (f.y0 < top() + 1) continue;
        if (best === null || f.y0 < best) best = f.y0;
      }
      this.y = best - P.box;
    } else {
      /* 反重力:往【下】找最近的顶面 */
      best = 0;
      for (const s of this.solids) {
        if (this.x + P.box <= s.x0 || this.x >= s.x1) continue;
        if (s.y1 > this.y - 1) continue;
        if (best === null || s.y1 > best) best = s.y1;
      }
      for (const f of this.floors) {
        if (this.x + P.box <= f.x0 || this.x >= f.x1) continue;
        if (f.y1 > this.y - 1) continue;
        if (best === null || f.y1 > best) best = f.y1;
      }
      this.y = best;
    }
    void band;
    this.gdir = -this.gdir;
    this.vy = -P.spiderVel * this.gdir;      // 极小的一点速度,方向朝"新的上方"
    this.onGround = true;
  }

  private die() { if (!this.dead) { this.dead = true; this.deadT = 0; } }

  /** 弹簧 / 跳环生效。
   *  ★ 用【绝对赋值】而不是叠加:于是弹簧连的每一跳几何完全一样,
   *    玩家被第一根弹簧弹起来之后,会自动落进下一根弹簧 —— 这就是"弹簧连不用出手"的原理。
   *  ★ 重力的翻转时机分两种(反编译口径):蓝的"先给速度再翻",绿的"先翻再给速度"。 */
  private applyTrigger(spec: { v: number; flip: 'none' | 'before' | 'after' }, consumePress = false) {
    if (spec.flip === 'before') {
      this.vy = spec.v * this.gdir;                     // 按【旧】重力方向给速度
      if (this.mode === 'cube') this.gdir = -this.gdir; // 然后才翻重力
    } else if (spec.flip === 'after') {
      if (this.mode === 'cube') this.gdir = -this.gdir; // 先翻重力
      this.vy = spec.v * this.gdir;                     // 再按【新】重力方向给速度
    } else {
      this.vy = spec.v * this.gdir;
    }
    if (this.mode === 'ship') this.vy = Math.max(-P.shipVyMax, Math.min(P.shipVyMax, this.vy));
    this.onGround = false;
    if (consumePress) this.pressFresh = false;
  }

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
     内框左缘在 x + innerOff 处,所以起跳后它能前进的距离 = 一跳跨度 − innerOff − 余量。
     ★ 跨距必须跟着【当前速度档】走:速度越快,同样的滞空时间跑得越远。
       老版本这里写死了常速的跨距,在 1.24 倍速那段就会早跳(level.ts 的图案几何也用同一条公式)。 */
  const span = arcSpan(P.jump, w.speedIdx) * U;
  const reach = span - P.innerOff - 6;
  /* 跳环:空中二段跳要按一下 —— 而且必须是【新的一下】(按住不放串不起环,和原作一致)。
     环在眼前、高度又对得上时:手上有"没用掉的一下"就按着,没有就先松一帧再按。
     这一条必须排在"看到危险就跳"前面,否则一直被按住、根本凑不出新的一下。 */
  for (const o of w.orbs) {
    if (o.x1 < w.x || o.x0 - w.x > 1.6 * U) continue;
    const iy0 = w.y + P.innerOff, iy1 = iy0 + P.inner;
    if (iy1 < o.y0 - 8 || iy0 > o.y1 + 8) continue;
    /* 要一次"新的按下":手上有没用掉的一下就按着,没有就先松一帧、下一帧再按下去 */
    return w.pressFresh ? true : !w.prevHold;
  }
  let best: { x0: number; x1: number } | null = null;
  for (const o of [...w.hazards.filter((h) => h.y0 < 2 * U), ...w.solids.filter((s) => s.y1 <= 2 * U)]) {
    /* ★ "已经过去了"要按【内框】判:危险判定框的右边缘一旦退到内框左缘后面,就真的踩不到了。
       按外框判(老写法)会让机器人为一根刚过去 0.3 块的刺按住不放,落地瞬间被动起跳,
       而那一跳的落点正好压在下一个障碍上 —— 实测就是这么死的。 */
    if (o.x1 <= w.x + P.innerOff) continue;
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
