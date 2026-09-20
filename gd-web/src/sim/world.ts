/* 定点模拟核心:零依赖、零引擎、零随机、可在 Node 里跑。
 *
 * 时间模型:外部按【帧】驱动(60 帧/秒),内部一律拆成 4 个子步(1/240 秒),
 * 和原作"每帧 4 个子步"的结构一致,但我们的步长是固定的 ——
 * 于是"同一串输入 → 同一串状态"永远成立,可以录回放、可以写指纹测试。
 *
 * 坐标:一律用 GD 口径的【单位】(1 块 = 30 单位),x 向右、y 向上,玩家 (x,y) 是【左下角】。
 */

import { P, U, Y_TIME_SCALE, vxOf, arcSpan, ORB, PAD } from './constants.ts';
import { hitboxOf } from './gdids.ts';
import type { Level, Mode, Obj } from './level.ts';

/** 每个物理子步最多走多少单位。最薄的实心是 468 线框(1.5 单位厚),取 1.2 < 1.5 ——
 *  这样无论纵向速度多大,都不会"一步跨过一堵墙"(见 frame() 里的自适应切分)。 */
const SUBSTEP_MAX = 1.2;

export interface RunState {
  tick: number; x: number; y: number; vy: number; onGround: boolean;
  mode: Mode; gdir: number; speed: number; dead: boolean; done: boolean;
  attempts: number; checkX: number; progress: number;
  /** 会动的物件(移动平台之类)当前偏移的合计 —— 指纹用它把"动的东西"也算进去 */
  moved?: number;
}

interface Box { x0: number; x1: number; y0: number; y1: number; o: Obj }

/** World 的可存档状态(搜索式机器人:回放、试验、回退都靠它) */
export interface WorldSnap {
  tick: number; x: number; y: number; vy: number; onGround: boolean;
  mode: Mode; gdir: number; speedIdx: number;
  dead: boolean; done: boolean; deadT: number; attempts: number;
  checkX: number; checkY: number; checkMode: Mode; checkSize: number;
  pressFresh: boolean; prevHold: boolean; floatT: number; sizeMul: number;
  boostDir: 1 | -1 | 0;
  tint: number | null; tintGround: boolean; flash: number;
  dash: { ang: number; kind: 'green' | 'pink' | 'purple'; t: number } | null;
  sets: Array<Array<Box>>;
}

/** 会被触发器推动的物件:记下它的判定盒与"原始坐标",每帧按偏移重写 */
interface Movable {
  o: Obj;
  box: Box | null;
  bx0: number; bx1: number; by0: number; by1: number;
  dx: number; dy: number;
}

/** 不动的物件共享这一个零偏移 —— offsetOf 每帧要被问上万次,别再每次 new 一个对象 */
const ZERO_OFF = { dx: 0, dy: 0 };

/** 一次触发产生的动画(位移 / 往返) */
interface Anim {
  ms: Movable[];
  from: Array<{ dx: number; dy: number }>;
  dx: number; dy: number;
  t: number; dur: number;           // 帧数
  ease: 'linear' | 'sine';
  loop: boolean;
  dir: number;                      // loop 用:1 去 / −1 回
  rest: number;                     // loop 用:到位之后停几帧
}

const SUB = 4;                 // 每帧 4 个子步
const FRAME = 1 / 60;

export class World {
  level: Level;
  readonly solids: Box[] = [];      // 实心:踩上面能站,撞侧面死
  readonly frames: Box[] = [];      // 线框的细杆(也是实心,判定与绘制共用 frameRects)
  readonly breakables: Box[] = [];  // 可破坏砖块:撞到即碎
  readonly broken = new Set<Box>(); // 已经碎掉的(每局重来时清空)
  readonly coins: Box[] = [];       // 硬币
  readonly gotCoins = new Set<Box>();
  readonly arrows: Box[] = [];      // 冲刺箭头 / 紫色上跳箭头
  readonly clones: Box[] = [];      // 克隆门(只标记,不生效)
  readonly floors: Box[] = [];      // 平台/地面:只从上面接住,不致死
  readonly hazards: Box[] = [];     // 尖刺
  readonly portals: Box[] = [];
  readonly speeds: Box[] = [];
  readonly gravs: Box[] = [];
  readonly checks: Box[] = [];
  readonly orbs: Box[] = [];        // 跳环:要玩家按(按住也算)才生效
  readonly pads: Box[] = [];        // 弹簧:碰到就生效,不用手
  readonly forces: Box[] = [];      // 力场:人在里面就被推
  readonly pits: Box[] = [];        // 坑(纯标记,给机器人判"脚下有没有地板"用)
  readonly triggers: Box[] = [];    // 触发器:越过它的 x 就开火
  readonly sizes: Box[] = [];       // 尺寸门:迷你 / 放大
  readonly teleports: Box[] = [];   // 传送门:蓝(入口) → 橙(出口),单向
  /* ★ 会动的东西:带 groups 的物件都在这里,触发器改的是它们的【运行时偏移】,
     判定表里的 Box 每帧跟着偏移重写 —— 于是"移动平台/移动尖刺"对判定是真的移动了。 */
  readonly movables: Movable[] = [];
  private byGroup = new Map<number, Movable[]>();
  private anims: Anim[] = [];
  tint: number | null = null;       // color 触发器改的全局色
  tintGround = false;               // true = 只染地面
  flash = 0;                        // pulse 触发器:全屏闪一下,1 → 0
  readonly decos: Obj[] = [];

  tick = 0;
  x = 0; y = 0; vy = 0; onGround = true;
  mode: Mode = 'cube';
  gdir = 1;
  speedIdx = 1;
  dead = false; done = false; deadT = 0;
  attempts = 1;
  checkX = 0; checkY = 0; checkMode: Mode = 'cube'; checkSize = 1;
  /** 最近一次跨过的形态门的中心 y(相机在飞行类形态里"钉视口"要用,原版口径) */
  portalY = 0;
  /** 这张铺面是不是"GD 导出的真实关卡"(决定事件物件用相交判还是跨 x 判,见 hitEvent) */
  private strict = false;
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
  private armedSizes = new Set<Box>();
  private armedGravs = new Set<Box>();
  private armedOrbs = new Set<Box>();
  private armedPads = new Set<Box>();
  private armedArrows = new Set<Box>();
  private armedTriggers = new Set<Box>();

  constructor(level: Level, startX?: number, startY?: number) {
    this.level = level;
    const st = level.start;                       // 出生点(物件 31):不传就按铺面标的来
    if (startX == null) startX = (st?.b ?? 0) * U;
    if (startY == null) startY = (st?.r ?? 0) * U;
    this.strict = !!level.fromGD;
    /* ★ 原版判定盒(照搬 LongData.cpp 的表):以【物件中心】为心、用表里的宽高。
       有这个表的物件一律用它 —— 之前的"贴图盒/整格/向外 0.5 格"都是我猜的,
       跳板宽 5~7 倍、跳环大近一倍、尖刺判高一倍,全是"本该能过却过不去"的来源。 */
    const hbBox = (o: Obj): Box | null => {
      const hb = hitboxOf(o);
      if (!hb) return null;
      let [w, h] = hb;
      const rot = (((o.rot ?? 0) % 360) + 360) % 360;
      if (rot === 90 || rot === 270) { const t = w; w = h; h = t; }   // 横过来:宽高对调
      const cx = (o.b + o.w / 2) * U, cy = (o.r + o.h / 2) * U;
      return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, o };
    };
    for (const o of level.objects) {
      const b: Box = { x0: o.b * U, x1: (o.b + o.w) * U, y0: o.r * U, y1: (o.r + o.h) * U, o };
      switch (o.kind) {
        case 'block': this.solids.push(b); break;
        case 'frame': {
          /* ★ 原版口径:线框族(467~475 / 661~663)的判定盒就是 LongData.cpp 那张表给的【外框】——
             OpenGD GameObject.cpp:751-772 把它直接 setOuterBounds,碰撞用的就是它:
               468 / 475 → 30×1.5(细杆,我们自己的包围盒就是 1 格×0.05 格 = 30×1.5 ✓)
               469 / 470 / 471 → 30×30(【整格实心】)
               661 → 15×15、662/663 → 30×15
             L 形 / U 形只是【贴图】,判定是整格。我们以前按"看得见的 2~3 根杆"判,
             于是 L 形那块剩下的空档能直接穿过去 —— 用户报的"线框平台碰撞逻辑错误"。
             现在:判定 = 物件自己的包围盒(和表一致);画法照旧走 frameRects(见 main.ts),
             所以还是"线框"的样子,只是不再漏。 */
          this.frames.push(b);
          this.solids.push(b);
          break;
        }
        case 'breakable': this.breakables.push(b); this.solids.push(b); break;
        case 'coin': this.coins.push(b); break;
        case 'arrow': this.arrows.push(b); break;
        case 'clone': this.clones.push(b); break;
        case 'platform': {
          /* 单向平台:只从上面接住,不致死(自动铺面的浮空平台就是它)。
             ★ 662(半格线框块)不在这里 —— 它在原版是【实心】的,走 kind 'frame' + fm=box,
               见下面的 case 'frame'。以前把 662 也归到这一类,人能从下面直接穿上去
               (用户:"能直接从几格高的平台下面飞到上面")。 */
          this.floors.push(b);
          break;
        }
        case 'spike': {
          /* ★ 用原版判定盒(表里 8→12×6、39→5.6×6、103→7.6×4、392→4.8×2.6),
             以物件中心为心;横着的刺(rot 90/270)宽高对调。
             以前按"0.7×高度、贴格子底边"算,判得比原版高一倍多 —— 本该能蹭过去的判死。 */
          this.hazards.push(hbBox(o) ?? b);
          break;
        }
        case 'saw': {
          /* 锯片:原版 1705 → 85×44(2.8×1.5 格)、1706 → 60×60 —— 都走表 */
          this.hazards.push(hbBox(o) ?? b);
          break;
        }
        case 'portal': this.portals.push(hbBox(o) ?? b); break;
        case 'speed': this.speeds.push(hbBox(o) ?? b); break;
        case 'gravity': this.gravs.push(hbBox(o) ?? b); break;
        case 'check': this.checks.push(hbBox(o) ?? b); break;
        case 'orb': {
          /* ★ 跳环:原版 36×36(1.2 格)。我上一版放大到 2 格(60×60)是错的 —— 环提前 0.3 格
             触发,链式环的节奏全乱(用户:"连一档速度都很难按到"其实是"按早了/按晚了都对不上")。 */
          this.orbs.push(hbBox(o) ?? b);
          break;
        }
        case 'pad': {
          /* ★ 弹簧:原版是一根【很窄的竖条】—— 黄 4×25、蓝 6×25、紫 5×25 单位。
             我上一版做成整格(30×30),宽了 5~7 倍,弹簧一律提前触发。 */
          this.pads.push(hbBox(o) ?? b);
          break;
        }
        case 'arrow': this.arrows.push(hbBox(o) ?? b); break;
        case 'coin': this.coins.push(hbBox(o) ?? b); break;
        case 'force': this.forces.push(b); break;
        case 'pit': this.pits.push(b); break;
        case 'trigger': this.triggers.push(b); break;
        case 'size': this.sizes.push(hbBox(o) ?? b); break;
        case 'teleport': this.teleports.push(hbBox(o) ?? b); break;
        case 'deco': this.decos.push(o); break;
      }
    }
    this.reset(startX, 'cube', startY);
    /* ★ 存档点初值 = 出生点。以前这里留着 (0,0):第一次摔死之后 respawn() 会把人放回
       y=0 —— 而这关的出生点在 y=10 的上一层,于是"复活在平台下面"(用户实测)。 */
    this.checkX = startX; this.checkY = startY; this.checkMode = 'cube'; this.checkSize = 1;
    /* ---- 分组:给每个带 groups 的物件记一份"可动"记录,并把它的判定盒挂上去 ----
       ★ 一个物件挂几个盒子,这里就记几份(线框以前会展开成好几根杆)。
         现在线框的判定也回到"整格一个盒子",所以通常是一物一盒。 */
    const boxesOf = new Map<Obj, Box[]>();
    for (const list of [this.solids, this.floors, this.hazards, this.orbs, this.pads, this.forces, this.pits, this.coins, this.arrows]) {
      for (const b of list) {
        const arr = boxesOf.get(b.o);
        if (arr) arr.push(b); else boxesOf.set(b.o, [b]);
      }
    }
    for (const o of level.objects) {
      if (!o.groups || !o.groups.length) continue;
      const boxes = boxesOf.get(o) ?? [];
      const list: Movable[] = boxes.length ? boxes.map((box) => ({
        o, box,
        bx0: box.x0, bx1: box.x1, by0: box.y0, by1: box.y1, dx: 0, dy: 0,
      })) : [{
        o, box: null,
        bx0: o.b * U, bx1: (o.b + o.w) * U, by0: o.r * U, by1: (o.r + o.h) * U, dx: 0, dy: 0,
      }];
      for (const m of list) {
        this.movables.push(m);
        this.movableOf.set(o, m);
        for (const g of o.groups) {
          const arr = this.byGroup.get(g);
          if (arr) arr.push(m); else this.byGroup.set(g, [m]);
        }
      }
    }
  }

  /** 物件现在的运行时偏移(渲染层按它画;判定盒已经跟着偏移走过了) */
  /** 取某个物件当前的触发器偏移(渲染层每帧要问 8980 个物件两遍)。
   *  ★ 以前这里是 `for (const m of this.movables)` 线性扫 —— 本关有 1167 个可动物件,
   *    于是每帧 2×8980×1167 ≈ 2100 万次比较,量出来单这一项就 99 ms/帧(用户:"帧率有点低")。
   *    改成构造时建一张 Map:O(1),不动的东西直接返回共享的零偏移(不分配对象)。 */
  offsetOf(o: Obj): { dx: number; dy: number } {
    const m = this.movableOf.get(o);
    return m ? { dx: m.dx, dy: m.dy } : ZERO_OFF;
  }
  private readonly movableOf = new Map<Obj, Movable>();

  /* ---------------- 窗口裁剪(搜索式机器人要靠它把 8000 个盒子裁成身边几十个) ----------------
   * 物理与机器人都只跟"玩家附近"的东西打交道,所以每帧重建一次窗口就够:
   * [x − 6 块, x + 45 块]。★ 触发器会推盒子 → 有会动的盒子时不许开(索引会过期)。 */
  private idx: Record<string, XIndex<Box>> | null = null;
  private win: Record<string, Box[]> = {};
  private fast = false;

  /** 开关窗口裁剪(opt-in:默认关,渲染/普通诊断都走完整列表) */
  set windowed(on: boolean) {
    if (on && this.movables.some((m) => m.box)) {
      throw new Error('有会动的判定盒(触发器),不能用窗口裁剪');
    }
    if (on && !this.idx) {
      this.idx = {
        solids: new XIndex(this.solids), floors: new XIndex(this.floors), hazards: new XIndex(this.hazards),
        pads: new XIndex(this.pads), orbs: new XIndex(this.orbs), coins: new XIndex(this.coins),
        arrows: new XIndex(this.arrows),
      };
      for (const k of Object.keys(this.idx)) this.win[k] = [];
    }
    this.fast = on;
  }
  get isWindowed() { return this.fast; }

  /** 本帧相关的判定盒(物理与机器人共用;没开裁剪时就是全部) */
  get nearSolids(): Box[] { return this.fast ? this.win.solids : this.solids; }
  get nearFloors(): Box[] { return this.fast ? this.win.floors : this.floors; }
  get nearHazards(): Box[] { return this.fast ? this.win.hazards : this.hazards; }
  get nearPads(): Box[] { return this.fast ? this.win.pads : this.pads; }
  get nearOrbs(): Box[] { return this.fast ? this.win.orbs : this.orbs; }
  get nearCoins(): Box[] { return this.fast ? this.win.coins : this.coins; }
  get nearArrows(): Box[] { return this.fast ? this.win.arrows : this.arrows; }

  private rebuildWindow() {
    const idx = this.idx;
    if (!idx) return;
    const x0 = this.x - 6 * U, x1 = this.x + 45 * U;
    for (const k of Object.keys(idx)) idx[k].near(x0, x1, this.win[k]);
  }

  /* ---------------- 存档 / 读档(搜索式机器人一帧要回放几百遍) ---------------- */
  snapshot(): WorldSnap {
    return {
      tick: this.tick, x: this.x, y: this.y, vy: this.vy, onGround: this.onGround,
      mode: this.mode, gdir: this.gdir, speedIdx: this.speedIdx,
      dead: this.dead, done: this.done, deadT: this.deadT, attempts: this.attempts,
      checkX: this.checkX, checkY: this.checkY, checkMode: this.checkMode, checkSize: this.checkSize,
      pressFresh: this.pressFresh, prevHold: this.prevHold, floatT: this.floatT, sizeMul: this.sizeMul,
      boostDir: this.boostDir,
      tint: this.tint, tintGround: this.tintGround, flash: this.flash,
      dash: this.dash ? { ...this.dash } : null,
      sets: [
        [...this.armedChecks], [...this.armedPortals], [...this.armedSpeeds], [...this.armedSizes],
        [...this.armedGravs], [...this.armedOrbs], [...this.armedPads], [...this.armedArrows],
        [...this.armedTriggers], [...this.broken], [...this.gotCoins],
      ],
    };
  }

  restore(s: WorldSnap) {
    this.tick = s.tick; this.x = s.x; this.y = s.y; this.vy = s.vy; this.onGround = s.onGround;
    this.mode = s.mode; this.gdir = s.gdir; this.speedIdx = s.speedIdx;
    this.dead = s.dead; this.done = s.done; this.deadT = s.deadT; this.attempts = s.attempts;
    this.checkX = s.checkX; this.checkY = s.checkY; this.checkMode = s.checkMode; this.checkSize = s.checkSize;
    this.pressFresh = s.pressFresh; this.prevHold = s.prevHold; this.floatT = s.floatT; this.sizeMul = s.sizeMul;
    this.boostDir = s.boostDir;
    this.tint = s.tint; this.tintGround = s.tintGround; this.flash = s.flash;
    this.dash = s.dash ? { ...s.dash } : null;
    const [c, p, sp, sz, gv, ob, pd, aw, tg, br, gc] = s.sets;
    this.armedChecks = new Set(c); this.armedPortals = new Set(p); this.armedSpeeds = new Set(sp);
    this.armedSizes = new Set(sz); this.armedGravs = new Set(gv); this.armedOrbs = new Set(ob);
    this.armedPads = new Set(pd); this.armedArrows = new Set(aw); this.armedTriggers = new Set(tg);
    this.broken.clear(); for (const b of br) this.broken.add(b);
    this.gotCoins.clear(); for (const b of gc) this.gotCoins.add(b);
  }

  /** 这块可破坏砖已经碎了吗(渲染层用:碎了就不画) */
  isBroken(o: Obj): boolean {
    for (const b of this.breakables) if (b.o === o) return this.broken.has(b);
    return false;
  }

  /** 这枚硬币收过了吗 */
  isCoinTaken(o: Obj): boolean {
    for (const b of this.coins) if (b.o === o) return this.gotCoins.has(b);
    return false;
  }

  /** 把当前偏移写回判定盒(带 h 缩放的刺也只用加偏移,不用重算) */
  private syncBoxes() {
    for (const m of this.movables) {
      const b = m.box;
      if (!b) continue;
      b.x0 = m.bx0 + m.dx * U; b.x1 = m.bx1 + m.dx * U;
      b.y0 = m.by0 + m.dy * U; b.y1 = m.by1 + m.dy * U;
    }
  }

  /** 触发器开火:按类型给目标分组排一段动画 / 改全局状态 */
  private fire(o: Obj) {
    const gs = o.groups ?? [];
    const targets: Movable[] = [];
    for (const g of gs) for (const m of this.byGroup.get(g) ?? []) if (!targets.includes(m)) targets.push(m);
    const durF = Math.max(1, Math.round((o.dur ?? 0) * 60));
    if (o.trigger === 'move' && targets.length) {
      this.anims.push({
        ms: targets, from: targets.map((m) => ({ dx: m.dx, dy: m.dy })),
        dx: o.dx ?? 0, dy: o.dy ?? 0, t: 0, dur: durF,
        ease: o.ease ?? 'sine', loop: !!o.loop, dir: 1, rest: 0,
      });
    } else if (o.trigger === 'color') {
      this.tint = o.color ?? null;
      this.tintGround = (o.dx ?? 0) > 0;         // dx>0 当作"只染地面"(省一个字段,口径写在文档里)
    } else if (o.trigger === 'pulse') {
      this.flash = 1;
      if (o.color != null) this.tint = o.color;
    }
    /* rotate 只影响画法(判定是轴对齐盒),这里不做几何;颜色/闪烁见上 */
  }

  /** 每帧推进动画(定点:按帧走,所以回放仍然逐帧一致) */
  private stepAnims() {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.08);
    if (!this.anims.length) return;
    const keep: Anim[] = [];
    let moved = false;
    for (const a of this.anims) {
      if (a.dur <= 0) {                                  // 瞬时到位(dur = 0)
        for (let i = 0; i < a.ms.length; i++) { a.ms[i].dx = a.from[i].dx + a.dx; a.ms[i].dy = a.from[i].dy + a.dy; }
        moved = true;
        continue;
      }
      if (a.rest > 0) { a.rest--; keep.push(a); continue; }
      a.t += 1;
      const p = Math.min(1, a.t / a.dur);
      const k = a.ease === 'sine' ? (1 - Math.cos(Math.PI * p)) / 2 : p;
      const kk = a.dir > 0 ? k : 1 - k;                   // 往回走的那一趟用 1−k
      for (let i = 0; i < a.ms.length; i++) {
        a.ms[i].dx = a.from[i].dx + a.dx * kk;
        a.ms[i].dy = a.from[i].dy + a.dy * kk;
      }
      moved = true;
      if (p >= 1) {
        if (a.loop) { a.dir = -a.dir; a.t = 0; a.rest = 20; keep.push(a); }   // 往复:到位停 1/3 秒再走回去
      } else keep.push(a);
    }
    this.anims = keep;
    if (moved) this.syncBoxes();
  }

  /** 速度(单位/帧)—— 速度门给的是"速度值 × 倍率",不是直接的每帧位移 */
  get vx() { return vxOf(this.speedIdx); }

  /** 关卡高度(行)。★ 不再是全局常量 ROWS:第三张盘用户的铺面有 121 格高,
   *  而视口永远只有 10 行 —— 上下边界必须跟着【这一关】走。 */
  get rows() { return this.level.rows; }

  /** 冲刺箭头生效期间的状态(重力关掉,速度按箭头方向给) */
  dash: { ang: number; kind: 'green' | 'pink' | 'purple'; t: number } | null = null;

  /** 体积倍率(迷你门 = 0.6):★ 碰撞盒、内框、内框偏移全都跟着它走,
   *  所以"能不能钻过一条缝"是真的由它决定,而不是画小一点而已。 */
  sizeMul = 1;
  get box() { return P.box * this.sizeMul; }
  get innerOff() { return P.innerOff * this.sizeMul; }
  /** ★ 名字不能叫 inner:类里已经有一个 inner() 方法,同名会被覆盖成方法 → 判定框算成 NaN */
  get innerSize() { return P.inner * this.sizeMul; }
  get mini() { return this.sizeMul < 0.999; }

  /** 内判定框(比外框小得多 —— 原作就是靠这个"看着撞上却没死")。
   *  ★ 用途:撞实心/尖刺/锯片 判死亡(原版:内框 intersect → destroyPlayer)。 */
  private inner() {
    const off = this.innerOff;
    return { x0: this.x + off, x1: this.x + off + this.innerSize, y0: this.y + off, y1: this.y + off + this.innerSize };
  }

  /** 外框(30×30,迷你时 0.6)。
   *  ★ 用途:**碰到就生效**的那一类(弹簧、跳环、门、速度门、硬币)——
   *    原版用的是 playerOuterBounds.intersectsRect(objBounds),不是内框。
   *    以前我们用内框判,等于所有弹簧/跳环都晚触发 0.375 格(用户:"跳点必须还原,不然地点不对")。 */
  private outer() {
    return { x0: this.x, x1: this.x + this.box, y0: this.y, y1: this.y + this.box };
  }

  reset(startX: number, mode: Mode, startY = 0) {
    this.tick = 0;
    this.x = startX; this.y = startY; this.vy = 0; this.onGround = true;
    this.portalY = startY;
    this.mode = mode; this.gdir = 1; this.speedIdx = 1;
    this.sizeMul = this.checkSize;      // 复活要恢复存档点时的体积(迷你/普通)
    this.dead = false; this.done = false; this.deadT = 0;
    this.pressFresh = false; this.prevHold = false;
    this.boostDir = 0;
    this.armedChecks.clear(); this.armedPortals.clear(); this.armedSpeeds.clear(); this.armedGravs.clear();
    this.armedOrbs.clear(); this.armedPads.clear();
    this.armedTriggers.clear(); this.armedSizes.clear(); this.armedArrows.clear();
    /* 碎掉的砖块 / 吃掉的硬币 / 进行中的冲刺都回到初始状态(和原作"重开一局"一致) */
    this.broken.clear();
    this.gotCoins.clear();
    this.dash = null;
    /* 重来 = 会动的东西回到原位、颜色与闪烁清空(和原作"重开一局"一致) */
    this.anims = [];
    this.flash = 0;
    this.tint = null;
    this.tintGround = false;
    for (const m of this.movables) { m.dx = 0; m.dy = 0; }
    this.syncBoxes();
  }

  /** 死后重来:回到最近跨过的存档点(没有就用关卡起点)。
   *  ★ y 也要跟着存档点走:这张铺面有 125 格高,顶点在 y=300 的存档点上复活到 y=0 会直接摔死。 */
  respawn() {
    this.attempts++;
    this.reset(this.checkX, this.checkMode, this.checkY);
  }

  /** 从头来(不碰存档点):回到铺面的出生点(Level.start,没有就是 (0,0)) */
  resetToStart() {
    const s = this.level.start;
    this.checkX = (s?.b ?? 0) * U;
    this.checkY = (s?.r ?? 0) * U;
    this.checkMode = 'cube';
    this.checkSize = 1;
    this.reset(this.checkX, 'cube', this.checkY);
  }

  get progress() { return Math.max(0, Math.min(1, this.x / (this.level.length * U))); }

  /** 这一列有没有地板?没有就是坑(机器人靠它判断) */
  floorTopAt(x: number, y: number): number | null {
    let best: number | null = null;
    for (const f of this.nearFloors) {
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
    /* ★ 无敌模式:不许跑出关卡边界(用户:"无敌模式会卡出墙,这个是最大的问题,同时也无法避免")。
       不无敌时飞出关卡顶/掉出底部都是死,所以"出界"这条以前不用管;无敌之后死不了,
       人就会一路飞出关卡再也回不来 —— 相机跟着走,整关都看不见了。
       现在贴住边界:把往外的那一维速度清零,人可以沿着边界滑,不会卡在墙上。 */
    if (this.god) {
      const maxY = this.rows * U - this.box;
      if (this.y > maxY) { this.y = maxY; if (this.vy > 0) this.vy = 0; }
      if (this.y < 0) { this.y = 0; if (this.vy < 0) this.vy = 0; this.onGround = false; }
      const maxX = this.level.length * U;
      if (this.x < -2 * U) this.x = -2 * U;
      else if (this.x > maxX + 2 * U) this.x = maxX + 2 * U;
    }
    if (this.fast) this.rebuildWindow();   // ★ 每帧把窗口滑到玩家身边(搜索式机器人靠它跑得动)
    this.stepAnims();                      // ★ 先让会动的东西动完,再跑物理(判定盒已同步)
    /* ★ 速度大的时候多切几刀再积分:线框的杆只有 1.5 单位厚,一步跨过去就是"穿模"
       (用户:"蓝跳点还是有bug,貌似速度过快导致直接穿过了线框")。
       每步最多走 MAX_STEP 单位 —— 正常速度下还是原来的 4 步,物理一点不变;
       只有"弹簧推出去"那种高速帧才会切细,而且每一步都会跑完整的碰撞判定。
       ★ 注意:这不做扫掠检测,只是把步长压到比最薄的实心还小,等价于"每步都不会跳过一堵墙"。 */
    const perFrame = Math.abs(this.vy) * Y_TIME_SCALE * FRAME;
    const n = perFrame > SUB * SUBSTEP_MAX ? Math.min(SUB * 8, Math.ceil(perFrame / SUBSTEP_MAX)) : SUB;
    const d = FRAME / n;
    for (let i = 0; i < n; i++) this.substep(d, hold);
    this.tick++;
  }

  /** 终端速度(只在"下落"时夹)—— ★ 但弹簧/跳环刚推出去的那一段【推力飞行】不夹。
   *  出处:原版 PlayerObject::updateJump 里 m_maybeIsBoosted(刚起跳/刚吃到弹簧)那一支
   *  只施加重力,没有 setYVelocity(max(vy,-15)) 那一句 —— 夹终端速度的是 else 那一支。
   *  为什么必须这样:蓝跳点(重力板)给 12.8 同时翻重力,接下来是【顺重力加速】的,
   *  一夹就两帧内顶到 15、然后一直 15 —— 轨迹从抛物线变成一条斜直线(用户实测:
   *  "蓝跳点的力度太大了,成斜线轨道了,原版也是一个抛物线")。
   *  推力用尽(纵向速度反向)之后,终端速度照常生效(黄弹簧落下来那段还是会被夹)。 */
  private applyFallClamp() {
    if (this.boostDir !== 0) {
      if (Math.sign(this.vy) !== this.boostDir) this.boostDir = 0;   // 推力用尽
      else return;                                                    // 推力飞行中:不夹
    }
    if (this.vy * this.gdir < 0) this.vy = Math.max(-P.vyMax, Math.min(P.vyMax, this.vy));
  }

  /** 弹簧 / 跳环给的推力方向(0 = 没有推力飞行)。见 applyFallClamp */
  private boostDir: 1 | -1 | 0 = 0;

  private substep(dt: number, hold: boolean) {
    const s = dt * 60;                     // 帧当量:表里的常量按"每帧"给
    const sY = s * Y_TIME_SCALE;           // ★ y 轴(含重力)按 dt×0.9 走 —— 原作就是这么积分的
    const prevX = this.x, prevY = this.y, prevVy = this.vy;

    this.x += this.vx * s;

    /* --- 冲刺箭头生效期间:重力关掉,纵向速度按箭头方向给 ---
     * 口径是近似:原版 dash 期间横向速度不变、纵向速度按箭头给,按住期间一直有效。 */
    if (this.dash) {
      const d = this.dash;
      d.t += FRAME / 4;
      const dir = arrowDir(d.ang);
      this.vy = Math.abs(this.vx) * dir.y;
      this.y += this.vy * sY;
      if (d.t > 0.5 || !hold) this.dash = null;
      if (this.y < 0 || this.y + this.box > this.rows * U) { this.die(); return; }
      this.onGround = false;
    } else if (this.mode === 'ship') {
      /* 飞机:照 OpenGD PlayerObject::updateJump 的 ship 分支 ——
         加速度 = −重力 × flipMod × shipAccel × extraBoost / playerSize,
         按住 shipAccel = −1.0(extraBoost:下落 0.5、否则 0.4),松开是 0.8(下落)/1.2(上升)。 */
      const falling = this.vy * this.gdir < 0;
      const shipAccel = hold ? -1.0 : (falling ? 0.8 : 1.2);
      const extraBoost = (hold && falling) ? 0.5 : 0.4;
      const size = this.mini ? 0.85 : 1;
      this.vy -= P.gravity * this.gdir * shipAccel * extraBoost / size * sY;
      this.vy = Math.max(P.flyDownMax / size, Math.min(P.flyUpMax / size, this.vy));
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'wave') {
      /* 波浪:垂直速度【每步直接赋值】= ±水平速度 → 永远 45°(反编译口径,y 轴不夹)
         —— 这形态没有重力,按住就往上、松开就往下。 */
      this.vy = (hold ? 1 : -1) * this.vx;
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'ufo') {
      /* UFO:照 OpenGD —— 点一下是【赋值】:newVel = flipMod × (迷你?8:7) × 体积;
         重力只有常重力的一半(上升 0.8 / 下落 1.2 再 ×0.5),所以飞着才跟手。 */
      const size = this.mini ? 0.85 : 1;
      if (hold && this.pressFresh) {
        this.pressFresh = false;
        this.vy = this.gdir * (this.mini ? 8 : 7) * size;
      }
      const falling = this.vy * this.gdir < 0;
      this.vy -= P.gravity * this.gdir * (falling ? 0.8 : 1.2) * 0.5 / size * sY;
      this.vy = Math.max(P.flyDownMax / size, Math.min(P.flyUpMax / size, this.vy));
      this.y += this.vy * sY;
      if (this.y < 0 || this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'ball') {
      /* 球:重力 ×0.6;★ 只有在【地面上】点一下才跳 —— 原版是
         "先按旧重力方向给起跳初速 → 翻重力(速度减半)→ 再 ×0.6"。
         以前我们写成"原地翻重力 + 当前速度 ×0.6",等于球不会跳(用户:形态性能要还原)。 */
      /* ★ 球是"按住就在每个落点翻一次" —— 原版用的是缓冲跳(m_jumpBuffered),
         按住不放时每次落地都翻重力(所以球段都是按住过的)。我们以前要求"新按一下",
         于是按住时球不翻、一路往下砸 —— 用户:"球形态的下落速度太离谱了,铅球吗?"。 */
      const size = this.mini ? 0.8 : 1;
      if (hold && this.onGround) {
        this.pressFresh = false;
        this.vy = P.jump * size * this.gdir;    // 旧重力方向的起跳初速
        this.gdir = -this.gdir;                 // 翻重力(原版 flipGravity 会把速度减半)
        this.vy /= 2;
        this.vy *= P.ballFlipVelMul;
        this.onGround = false;
      }
      this.vy -= P.gravity * P.ballGravityMul * this.gdir * sY;
      this.applyFallClamp();
      this.y += this.vy * sY;
    } else if (this.mode === 'spider') {
      /* 蜘蛛:点一下【传送到对面】再翻重力(反编译:搜索带厚度 = 体积 ×8) */
      if (hold && this.pressFresh) { this.spiderJump(); this.pressFresh = false; }
      /* ★ 蜘蛛的重力也是 ×0.6(原版 updateJump:float_b 对 ball/spider/swing 一律 0.6)——
         以前这里漏了乘,蜘蛛掉得跟方块一样快。 */
      this.vy -= P.gravity * P.ballGravityMul * this.gdir * sY;
      this.applyFallClamp();
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
         所以黄弹簧的 16 能原样生效,峰值才有 4.45 块,而不是被夹到 3.9。
         ★ 而【弹簧/跳环刚推出去的那一段】连下落方向也不夹 —— 见 applyFallClamp。 */
      this.applyFallClamp();
      this.y += this.vy * sY;
    }

    /* --- 踩实体:顺着重力方向接住(正重力踩上面;反重力贴天花板与方块底面) ---
     * 方块 / 球 / 机器人 / 蜘蛛都走这段;飞机、UFO、波浪是"飞行类",碰到即死。 */
    if (this.mode !== 'ship' && this.mode !== 'ufo' && this.mode !== 'wave') {
      const boxTop = this.y + this.box, prevTop = prevY + this.box;
      let support: number | null = null;
      if (this.gdir > 0) {
        for (const f of this.nearFloors) {
          if (this.x + this.box <= f.x0 || this.x >= f.x1) continue;
          if (prevY >= f.y1 - 0.01 && this.y <= f.y1) { if (support === null || f.y1 > support) support = f.y1; }
        }
        for (const b of this.nearSolids) {
          if (this.x + this.box <= b.x0 || this.x >= b.x1) continue;
          if (prevY >= b.y1 - 0.01 && this.y <= b.y1) { if (support === null || b.y1 > support) support = b.y1; }
        }
        if (support !== null && this.vy <= 0) { this.y = support; this.vy = 0; this.onGround = true; }
        else this.onGround = false;

        // 掉出世界 = 死(坑)
        if (this.y < -2.5 * U) { this.die(); return; }
      } else {
        /* 反重力:只有【真的方块/平台底面】能贴住 —— ★ 关卡顶不是天花板(原版口径:
           反重力的人是往上"掉",撞到方块才停;一路飞出去就在关卡顶边界上判死)。
           以前我们把"关卡顶"当成实心天花板,反重力的人会直接吸在顶上(OpenGD 里顶是死区)。 */
        let sup: number | null = null;
        for (const f of this.nearFloors) {
          if (this.x + this.box <= f.x0 || this.x >= f.x1) continue;
          if (prevTop <= f.y0 + 0.01 && boxTop >= f.y0 && (sup === null || f.y0 < sup)) sup = f.y0;
        }
        for (const b of this.nearSolids) {
          if (this.x + this.box <= b.x0 || this.x >= b.x1) continue;
          if (prevTop <= b.y0 + 0.01 && boxTop >= b.y0 && (sup === null || b.y0 < sup)) sup = b.y0;
        }
        if (sup !== null && this.vy >= 0) { this.y = sup - this.box; this.vy = 0; this.onGround = true; }
        else this.onGround = false;
        if (this.y + this.box > this.rows * U + 2.5 * U) { this.die(); return; }
      }

      /* 实心方块:从侧面撞上就死(正重力时"落在顶面"、反重力时"贴住底面"都不算撞)
         ★ 可破坏砖块撞到是【碎掉】而不是死 —— 不实现它,玩家会直接撞死在这条铺面上。 */
      const inn = this.inner();
      for (const b of this.nearSolids) {
        if (b.o.kind === 'breakable') {
          if (this.broken.has(b)) continue;
          if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
          this.broken.add(b);
          continue;
        }
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        /* ★ 原版【落台容错】的真正口径 —— 从 gdp 反编译的
           PlayerObject::collidedWithObjectInternal 里抠出来的(不是猜的):
             double snapUpThreshold = 10.0;
             if (m_stateScale >= 1) snapUpThreshold = 15.0;                     // 正常/大形态
             if (isFly && !m_isPlatformer) snapUpThreshold = gravityMult * 6.0; // 飞行类
             ...
             playerBottom = getPositionY() - 高/2;
             maxSnapY = playerBottom + snapUpThreshold;
             floatG   = maxSnapY - 本帧位移;
             canSnap  = maxSnapY 或 floatG 越过 objRect 的顶面;
           也就是:容错只是"脚底离顶面还差不到 tol 的那点小修正" ——
             · 正常/大形态 tol = 15 单位(半格)
             · 迷你 tol = 10
             · 飞行类(飞机/UFO/波浪) tol = 6
           ★ 我们上一版写的是"外框顶越过砖的中线":那对 1 格高的砖允许抬 30 单位,
             而且【贴着砖侧面往下蹭】也满足 → 人就被整块"抬"到平台上,
             用户看到的"容错直接飞上平台"就是它。现在最多修 15 单位,撞侧面老老实实死。 */
        const snapTol = (this.mode === 'ship' || this.mode === 'ufo' || this.mode === 'wave')
          ? 6 : (this.mini ? 10 : 15);
        /* ★ 用【运动方向】挑擦过的是哪一面,用【重力方向】决定"落上去"还是"擦过去":
             vy ≤ 0(往下):擦到砖的【顶面】附近(脚底离顶面 ≤ snapTol)
             vy ≥ 0(往上):擦到砖的【底面】附近(头顶离底面 ≤ snapTol)
           顺重力擦到 → 落到那个面上站住;逆重力擦到 → 什么也不做,擦过去。
           ★ 原版依据(PlayerObject::collidedWithObjectInternal):
             canSnap 只看几何(maxSnapY 与物件矩形比较),而"下落/上升"决定走哪个分支;
             上升那一支里两个 if 都不成立 → 什么也不做 = 擦过去,既不判死也不抬上去。
           ★ 球形态段 x=286 就靠这条:天花板下的黄板把球往下打,球往【下】擦到 (288,9)
             那块实心线框的顶面附近 —— 球的重力朝上,所以它在自己的重力系里是"上升" →
             擦过去;以前这里只按重力方向判,球直接被判死(用户:"原本能过的过不去了")。 */
        const clearTop = this.y >= b.y1 - snapTol;               // 擦到砖顶面附近
        const clearBot = this.y + this.box <= b.y0 + snapTol;    // 擦到砖底面附近
        if (this.vy <= 0 && clearTop) {
          if (this.gdir > 0) { this.y = b.y1; this.vy = 0; this.onGround = true; }
          continue;                                              // 逆重力 → 擦过去
        }
        if (this.vy >= 0 && clearBot) {
          if (this.gdir < 0) { this.y = b.y0 - this.box; this.vy = 0; this.onGround = true; }
          continue;                                              // 逆重力 → 擦过去
        }
        if (this.gdir > 0 && prevY >= b.y1 - 0.01 && this.y <= b.y1) continue;
        if (this.gdir < 0 && prevTop <= b.y0 + 0.01 && boxTop >= b.y0) continue;
        this.die(); return;
      }
    }

    /* --- 尖刺:内框相交就死 --- */
    {
      const inn = this.inner();
      for (const hz of this.nearHazards) {
        if (inn.x1 > hz.x0 && inn.x0 < hz.x1 && inn.y1 > hz.y0 && inn.y0 < hz.y1) { this.die(); return; }
      }
    }

    /* --- 力场:人进到里面就被推(垂直方向;正的 fy 大于 gravity 就是"上升气流") ---
     * 口径:GD 2.2 的力场本质是"改重力",反编译里那套倍率是
     * 飞机 0.47 / UFO 0.58 / 摇摆 0.4 / 球+蜘蛛 0.6 / 机器人 0.9 / 方块 1.0。
     * 我们这里先做最直接的一种:给一个垂直加速度,叠加在重力之上。 */
    if (this.forces.length) {
      const inn = this.outer();
      for (const b of this.forces) {
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.vy += (b.o.fy ?? 0) * sY;
        break;
      }
    }

    /* --- 弹簧(跳板):碰到就生效,不用按键 —— "连续鼓点用弹簧连起来"靠的就是这条 ---
     * ★ 用【外框】判(原版 playerOuterBounds.intersectsRect)。 */
    {
      const inn = this.outer();
      for (const b of this.nearPads) {
        if (this.armedPads.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedPads.add(b);
        if (b.o.tp) this.spiderJump();                     // 紫色地面跳点:瞬移到头顶方块 + 翻重力
        else if (b.o.pad) this.applyTrigger(PAD[b.o.pad]);
      }
    }

    /* --- 硬币:碰到就收(收集向,不影响能不能过) --- */
    {
      const inn = this.outer();
      for (const b of this.nearCoins) {
        if (this.gotCoins.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.gotCoins.add(b);
      }
    }

    /* --- 冲刺箭头 / 紫色上跳箭头:一次【新的按键】才生效(和跳环同族);外框判 --- */
    if (hold && this.pressFresh) {
      const inn = this.outer();
      for (const b of this.nearArrows) {
        if (this.armedArrows.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedArrows.add(b);
        this.pressFresh = false;
        if (b.o.tp) {
          this.spiderJump();                              // 紫色:瞬移到头顶方块 + 翻重力
        } else {
          this.dash = { ang: b.o.rot ?? 0, kind: b.o.arrow ?? 'green', t: 0 };
          if (b.o.arrow === 'pink' && this.mode === 'cube') this.gdir = -this.gdir;
        }
        break;
      }
    }

    /* --- 跳环:要一次【新的按键】才生效 —— 空中二段跳靠它,而"按住不放"串不起一串环(原作口径) ---
     * ★ 外框判(原版 playerOuterBounds) */
    if (hold && this.pressFresh) {
      const inn = this.outer();
      for (const b of this.nearOrbs) {
        if (this.armedOrbs.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedOrbs.add(b);
        if (b.o.orb) {
          /* ★ 用分形态的力度(原版 ringJump 的倍率表),别再用"方块那一档"套所有形态 */
          const spec = ORB[b.o.orb];
          this.applyTrigger({ v: this.orbVel(b.o.orb), flip: spec.flip }, true);
        }
        break;
      }
    }

    /* --- 触发器:必须先真的跨过去(交叉判定),复活点落在它右边时不会误触发 --- */
    for (const b of this.portals) {
      if (this.armedPortals.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedPortals.add(b);
      const to = (b.o.to ?? 'cube');
      /* ★ 原版口径(PlayLayer::changeGameMode + PlayerObject::setGamemode):
         形态门【只改形态】,不动运动状态 —— 速度保留(只有飞机形态 m_dYVel /= 2)、
         重力方向保留、位置不吸附。
         以前我们写的是 vy=0 + 飞机强行抬到 3 格 + gdir 拉回正常 → 进门那一刻的运动被清掉,
         于是"第一个球门无解"(用户实测:球进门后起不来)。 */
      this.mode = to;
      this.portalY = (b.y0 + b.y1) / 2;
      if (to === 'ship') this.vy /= 2;                                  // setGamemode: 速度减半
      if (to === 'cube' || to === 'ship') this.onGround = false;        // 只有这两种清落地标记
      /* ⚠ 兼容:我们自己【自动铺面】的那套老关卡(非 GD 导出)是围着"进门把人抬到 3 格"
         建的,门改成忠实行为后它在第一个飞机缝前会撞死。真实铺面(level.fromGD)走原版口径,
         老关卡保留旧的抬升 —— 两边都不坏。 */
      if (!this.strict && to === 'ship' && this.y < 3 * U) this.y = 3 * U;
    }
    for (const b of this.speeds) {
      if (this.armedSpeeds.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedSpeeds.add(b);
      this.speedIdx = Math.max(0, Math.min(P.speedMul.length - 1, b.o.speed ?? 1));
    }
    for (const b of this.gravs) {
      if (this.armedGravs.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedGravs.add(b);
      /* ★ 原版的重力门是【指定方向】(向下门 / 向上门),不是"翻一下" ——
         连吃两个同样的门不该把人翻回去,所以这里按 gdir 直接设,没有 gdir 才退回"翻转"。 */
      this.gdir = b.o.gdir ?? -this.gdir;
      this.vy = 0;
    }
    for (const b of this.triggers) {
      if (this.armedTriggers.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedTriggers.add(b);
      this.fire(b.o);
    }
    /* --- 传送门:【单向】蓝门(入口) → 橙门(出口),同频道配对 ---
     * ★ 原版口径:进蓝门就被送到同频道的橙门;橙门自己不送人(所以不会来回弹)。
     * ★ 这关(WATER)有 7 个蓝入口、0 个橙出口 —— 按原版它们不生效(已写在文档里,等用户确认)。 */
    for (const b of this.teleports) {
      if (this.armedPortals.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedPortals.add(b);
      if (b.o.exit) continue;                       // 出口不主动送人
      /* ★ 原版 2.2 的传送门自带【纵向偏移】(键 54,用户确认):进去就在这个门的纵向方向
         挪那么远 —— 所以这关只有 7 个蓝门、没有橙色出口物件也能用。 */
      if (b.o.tpy) {
        this.y = Math.max(0, Math.min(this.rows * U - this.box, this.y + b.o.tpy * U));
        this.vy = 0;
        continue;
      }
      const dst = this.exitOf(b);
      if (!dst) continue;                           // 没有配对出口 → 什么都不发生
      this.armedPortals.add(dst);
      this.x = dst.x0;
      if (this.y + this.box > this.rows * U) this.y = this.rows * U - this.box;
      if (this.y < 0) this.y = 0;
    }
    for (const b of this.sizes) {
      if (this.armedSizes.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedSizes.add(b);
      /* 迷你门:体积 0.6(反编译口径 m_vehicleSize=m_vehicleSize);放大门 = mini:false → 回到 1.0 */
      this.sizeMul = b.o.mini === false ? 1 : P.miniSize;
      this.y = Math.min(this.y, this.rows * U - this.box);      // 别因为变大顶到天花板里
    }
    for (const b of this.checks) {
      if (this.armedChecks.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedChecks.add(b);
      this.checkX = b.x0;
      this.checkY = this.y;                 // ★ 存档点记的是"人越过它时的位置"(原版口径)
      this.checkMode = this.mode; this.checkSize = this.sizeMul;
    }

    if (this.x >= this.level.length * U) { this.done = true; }
    void prevVy;
  }

  /** 蜘蛛点一下:在"当前重力的反方向"找最近的落脚面,传送过去再翻重力。
   *  ★ 可达距离照搬原版 `PlayerObject::checkSnapJumpToObject` 的距离表(再翻重力):
   *      速度档 0.7 → 2 格;0.9(常速) → 3 格;1.1 → 4 格;1.3 → 4.5 格;1.6 → 4 格。
   *    以前我用的是自定的"8 格搜索带" —— 够得太远,蜘蛛段的手感/落点全不对(用户点名的"性能不对")。
   *    够不到任何面时【什么也不做】(原版也是:没有天花板可贴就继续掉)。 */
  private spiderReach(): number {
    return [60, 90, 120, 135, 120][Math.max(0, Math.min(4, this.speedIdx))] ?? 90;
  }

  private spiderJump() {
    const reach = this.spiderReach();
    const top = () => this.y + this.box;
    /* ★ 横向用【窄框】判(内框 7.5 单位宽),不用整个 30 单位的外框:
       外框会让人"和旁边一格的方块也算重叠",于是蜘蛛能横着一格跳到本来够不着的面上
       —— 用户:"蜘蛛的碰撞箱太大了,导致直接跨过了一格的宽度"。 */
    const hx0 = this.x + this.innerOff, hx1 = hx0 + this.innerSize;
    let best: number | null = null;
    if (this.gdir > 0) {
      /* 正重力:往【上】找最近的底面(方块底 / 平台底),必须在可达距离内 */
      for (const s of this.nearSolids) {
        if (hx1 <= s.x0 || hx0 >= s.x1) continue;
        if (s.y0 < top() + 1 || s.y0 > top() + reach) continue;
        if (best === null || s.y0 < best) best = s.y0;
      }
      for (const f of this.nearFloors) {
        if (hx1 <= f.x0 || hx0 >= f.x1) continue;
        if (f.y0 < top() + 1 || f.y0 > top() + reach) continue;
        if (best === null || f.y0 < best) best = f.y0;
      }
      if (best === null) return;                       // 够不到 → 不传送、不翻重力
      this.y = best - this.box;
    } else {
      /* 反重力:往【下】找最近的顶面,同样限可达距离 */
      for (const s of this.nearSolids) {
        if (hx1 <= s.x0 || hx0 >= s.x1) continue;
        if (s.y1 > this.y - 1 || s.y1 < this.y - reach) continue;
        if (best === null || s.y1 > best) best = s.y1;
      }
      for (const f of this.nearFloors) {
        if (hx1 <= f.x0 || hx0 >= f.x1) continue;
        if (f.y1 > this.y - 1 || f.y1 < this.y - reach) continue;
        if (best === null || f.y1 > best) best = f.y1;
      }
      if (best === null) return;
      this.y = best;
    }
    this.gdir = -this.gdir;
    this.vy = -P.spiderVel * this.gdir;      // 极小的一点速度,方向朝"新的上方"
    this.onGround = true;
  }

  /** 事件物件(形态门/速度门/重力门/尺寸门/存档点/传送门/触发器)算不算"碰到了"。
   *  ★ 真实铺面(GD 导出的关卡;`level.fromGD`)按【原版口径】:
   *    玩家【外框】与物件判定盒【相交】—— 含高度!门的盒子是 34×86 单位(竖高),
   *    站在门正下方是碰不到的(以前我们只判"跨过它的 x",不管高度,门在头顶也会触发)。
   *  ★ 我们自己自动铺面的那套关卡,把门摆在 r=3/6 当"段首标记"用,靠的就是"跨过 x",
   *    所以两种口径按来源分流 —— 两边的铺面都不会被搞坏。 */
  private hitEvent(b: Box, prevX: number): boolean {
    if (!this.strict) return !(prevX + this.box <= b.x0 || this.x >= b.x1);
    const u = this.outer();
    return u.x1 > b.x0 && u.x0 < b.x1 && u.y1 > b.y0 && u.y0 < b.y1;
  }

  /** ★ 无敌模式(测试用,页面按 G 切):不判死,撞到刺/侧面也照常穿过去。
   *  die() 直接返回,而调用点后面都是 `return` —— 于是那一帧的后续结算跳过,人继续往前走。
   *  掉出世界(坑)也死不了,所以下面加了一条兜底:掉到地面线以下就放回地面,免得一直往下掉。 */
  god = false;

  private die() {
    if (this.god) return;
    if (!this.dead) { this.dead = true; this.deadT = 0; }
  }

  /** 同频道里"入口要去的那个出口"(橙门)。没有出口(或只有入口)就返回 null —— 什么也不发生。
   *  ★ 原版是"蓝进橙出"的单向配对;同一频道有多个出口时,取入口【右边最近】的那一个。 */
  private exitOf(b: Box): Box | null {
    const ch = b.o.channel ?? 0;
    const exits = this.teleports.filter((t) => t !== b && t.o.exit && (t.o.channel ?? 0) === ch);
    if (!exits.length) return null;
    const after = exits.filter((e) => e.x0 >= b.x1).sort((p, q) => p.x0 - q.x0);
    return after.length ? after[0] : exits.sort((p, q) => p.x0 - q.x0)[0];
  }

  /** 迷你时跳环/弹簧的力度 ×0.8(反编译口径:普通跳环 ×0.8、弹簧力度 ×0.8) */
  private triggerScale() { return this.mini ? P.miniTriggerMul : 1; }

  /** 弹簧 / 跳环生效。
   *  ★ 用【绝对赋值】而不是叠加:于是弹簧连的每一跳几何完全一样,
   *    玩家被第一根弹簧弹起来之后,会自动落进下一根弹簧 —— 这就是"弹簧连不用出手"的原理。
   *  ★ 重力的翻转时机分两种(反编译口径):蓝的"先给速度再翻",绿的"先翻再给速度"。 */
  private applyTrigger(spec: { v: number; flip: 'none' | 'before' | 'after' | 'dash' }, consumePress = false) {
    let v = spec.v * this.triggerScale();             // 迷你时力度 ×0.8
    /* ★ 弹簧的球/蜘蛛折扣(原版 PlayerObject::propellPlayer:m_dYVel *= 0.6)——
       ★★ 但【球】这一档实测是错的,拿本关的几何一算就穿帮:
          球形态段 x=286 天花板下那块黄板,球贴在天花板(r≈13.95)上吃到它之后,
          必须一路【掉到地面线(r≈5.95)】才过得去 —— 要掉 6.95 格。球重力 = 0.958×0.6 = 0.575,
          掉的高度 = v²/(2×0.575):
            v = 16(不打折)  → 7.42 格 ✓ 刚够(原版关卡留的那点余量正好对得上)
            v = 9.6(×0.6)   → 2.67 格 ✗ 球又弹回天花板,必撞死(用户:"原本能过的过不去了")
          所以球形态按【不打折的 16】走;蜘蛛那档没有反例,先维持 0.6。 */
    /* ★ 弹簧的球/蜘蛛折扣(原版 PlayerObject::propellPlayer:m_dYVel *= 0.6)。
       ★ 球形态这一档独立核过:本关球形态段 x=286 天花板下那块黄板,球从天花板(r=13 那块
         实心线框的底面)被往下打,要一路擦过 (288,9) 那块实心线框才进得了后面那条窄走廊。
         球重力 = 0.958×0.6 = 0.575,掉的高度 = v²/(2×0.575):
           v = 16(不打折)→ 7.4 格,直接扎进那块线框,判死;
           v = 9.6(×0.6) → 2.5 格,正好落在它的顶面【容差 15 单位】里 → 按上面的"擦过"规则过去。
         所以这一档维持 0.6(和 OpenGD 的 propellPlayer 一致)。 */
    if (this.mode === 'ball' || this.mode === 'spider') v *= 0.6;
    if (spec.flip === 'before') {
      this.vy = v * this.gdir;                          // 按【旧】重力方向给速度
      if (this.mode === 'cube') this.gdir = -this.gdir; // 然后才翻重力
    } else if (spec.flip === 'after') {
      if (this.mode === 'cube') this.gdir = -this.gdir; // 先翻重力
      this.vy = v * this.gdir;                          // 再按【新】重力方向给速度
    } else if (spec.flip === 'dash') {
      this.vy = -v * this.gdir;                         // 冲刺环:朝重力方向砸下去(常重力下 -15)
    } else {
      this.vy = v * this.gdir;
    }
    if (this.mode === 'ship') this.vy = Math.max(-P.shipVyMax, Math.min(P.shipVyMax, this.vy));
    /* ★ 记下这一推的方向:接下来这段"推力飞行"不夹终端速度(见 applyFallClamp) ——
       蓝跳点全靠它才是抛物线而不是斜直线。 */
    this.boostDir = this.vy > 0 ? 1 : this.vy < 0 ? -1 : 0;
    this.onGround = false;
    if (consumePress) this.pressFresh = false;
  }

  /** 跳环的分形态力度(原版 PlayerObject::ringJump 里的倍率表)。
   *  ★ 我们以前所有形态都用"方块那一档",于是飞行/球/机器人段里的环力度全错 ——
   *    用户说的"性能不对"里有一部分就是这里。表里的倍率是 × 起跳初速(jumpPower)。 */
  private orbVel(kind: OrbKind): number {
    const J = P.jump;
    const mini = this.mini;
    switch (kind) {
      case 'pink':
        return J * (this.mode === 'ship' ? 0.37 : this.mode === 'ufo' ? 0.42 : this.mode === 'ball' ? 0.77 : 0.72);
      case 'red':
        return J * (this.mode === 'ship' ? 1.0
          : this.mode === 'ufo' ? (mini ? 1.36 : 1.02)
            : (this.mode === 'ball' || this.mode === 'spider') ? 1.34
              : this.mode === 'robot' ? 1.28 : 1.38);
      case 'yellow':
        return J * (this.mode === 'robot' ? 0.9 : 1.0);
      case 'green':
        return J * (this.mode === 'ship' ? 0.7 : 1.0);
      case 'blue':
        return J * 0.8;                                   // 重力环:固定 ×0.8,不随形态
      case 'black':                                       // 冲刺(黑)环:按形态给绝对值
        return this.mode === 'ufo' ? 11.2
          : (this.mode === 'ship' || this.mode === 'wave') ? 14
            : this.mode === 'spider' ? 16.5 : 15;
      default:
        return J;
    }
  }

  get state(): RunState {
    return {
      tick: this.tick, x: this.x, y: this.y, vy: this.vy, onGround: this.onGround,
      mode: this.mode, gdir: this.gdir, speed: this.speedIdx, dead: this.dead, done: this.done,
      attempts: this.attempts, checkX: this.checkX, progress: this.progress,
      moved: this.movedHash(),
    };
  }

  /** 会动的物件当前偏移的量化合计(进指纹用:证明"移动的东西"也是逐帧确定的) */
  private movedHash(): number {
    let h = 0;
    for (const m of this.movables) h += Math.round((m.dx + m.dy * 7.13) * 1e4);
    return h / 1e4;
  }
}

/* ---------------- 冲刺箭头的方向 ----------------
 * 口径说明(★ 这是实测不出来、只能先定一个的部分,已写进文档等用户确认):
 *   存档里的旋转角 0 / 90 / 180 / ±45 / 315。按"顺时针、0 = 箭头朝上"解释:
 *     0 → 朝上(爬升)   90 → 水平   180 → 朝下(俯冲)   ±45 → 斜上/斜下
 *   原版的 dash 期间横向速度不变,所以这里只决定【纵向】速度:
 *     y 分量 = 箭头方向的 cos,再用 x 分量做一个下限(0.7)保证"永远在往前走"。
 *   于是 0 → 爬升 ≈ 1.43×水平速度、90 → 水平、180 → 俯冲。 */
export function arrowDir(deg: number): { x: number; y: number } {
  /* ★ GD 口径:未旋转(rot=0)的箭头指向【右】,rot 正角度顺时针(屏幕上往下)。
     出图核对过 x=751 那支 rot=-45 是"右上 45°",x=367 那支 rot=90 是"正下"。
     以前这里按"rot=0 朝上"算(还把横向夹在 sin 上),于是箭头指的方向和冲刺方向整体转了 90°
     —— 用户:"箭头的方向反了,原版的箭头的初始方向是向右的"。
     返回的是【世界坐标】(y 向上)的方向:rot>0(顺时针/向下)→ y 为负。 */
  const a = (deg * Math.PI) / 180;
  const sx = Math.max(Math.cos(a), 0.7);       // 横向分量:永远不小于 0.7(不会往后退)
  return { x: sx, y: -Math.sin(a) / sx };
}

/* ---------------- 空间索引 ----------------
 * 搜索式机器人要在一帧里把状态回放几百遍,每一次都遍历 8000 个判定盒是不可能的
 * (实测:不裁剪 ≈ 4300 帧/秒,一关 21600 帧;搜索要放大 100 倍 → 得先把它裁到"身边几十个")。
 * 做法:按 x 排序 + 二分找窗口;特别宽的(补出来的整条地面)单独放,每次都查。
 * ★ 只对【不动】的物件有效:一旦有触发器在推盒子,索引就会过期 → 由 fast 开关把关(见 useIndex)。 */
class XIndex<T extends { x0: number; x1: number }> {
  private readonly arr: T[] = [];
  private readonly wide: T[] = [];
  private readonly maxW: number;
  constructor(list: T[]) {
    let maxW = 1;
    for (const b of list) {
      const w = b.x1 - b.x0;
      if (w > 50 * U) this.wide.push(b); else { this.arr.push(b); maxW = Math.max(maxW, w); }
    }
    this.arr.sort((a, b) => a.x0 - b.x0);
    this.maxW = maxW;
  }
  /** 与 [qx0,qx1] 横向可能重叠的盒子写进 out(复用数组,不产生垃圾) */
  near(qx0: number, qx1: number, out: T[]): T[] {
    out.length = 0;
    for (const b of this.wide) out.push(b);
    const from = qx0 - this.maxW;
    /* 二分:第一个 x0 >= from 的下标再回退一格(保证不漏) */
    let lo = 0, hi = this.arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.arr[mid].x0 < from) lo = mid + 1; else hi = mid;
    }
    for (let i = lo; i < this.arr.length; i++) {
      const b = this.arr[i];
      if (b.x0 > qx1) break;
      out.push(b);
    }
    return out;
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
    let y0 = 0, y1 = w.rows * U;
    const blocks = [...w.nearSolids].filter((b) => probeX >= b.x0 && probeX <= b.x1).sort((a, b) => a.y0 - b.y0);
    let bestGap = { a: 0, b: w.rows * U, size: w.rows * U };
    let cursor = 0;
    for (const b of blocks) {
      if (b.y0 - cursor > bestGap.size) bestGap = { a: cursor, b: b.y0, size: b.y0 - cursor };
      cursor = Math.max(cursor, b.y1);
    }
    if (w.rows * U - cursor > bestGap.size) bestGap = { a: cursor, b: w.rows * U, size: w.rows * U - cursor };
    const target = (bestGap.a + bestGap.b) / 2 - w.box / 2;
    void y0; void y1;
    return w.y < target - 2;
  }
  /* 方块:两条判据都要按【内框】算,不能按外框 ——
     实测教训:按"前缘到远边"算会早跳约 0.8 块,弧线顶点落在障碍之前,落地时正好压在尖刺上。
     内框左缘在 x + innerOff 处,所以起跳后它能前进的距离 = 一跳跨度 − innerOff − 余量。
     ★ 跨距必须跟着【当前速度档】走:速度越快,同样的滞空时间跑得越远。
       老版本这里写死了常速的跨距,在 1.24 倍速那段就会早跳(level.ts 的图案几何也用同一条公式)。 */
  const span = arcSpan(P.jump, w.speedIdx) * U;
  const reach = span - w.innerOff - 6;
  /* 跳环:空中二段跳要按一下 —— 而且必须是【新的一下】(按住不放串不起环,和原作一致)。
     环在眼前、高度又对得上时:手上有"没用掉的一下"就按着,没有就先松一帧再按。
     这一条必须排在"看到危险就跳"前面,否则一直被按住、根本凑不出新的一下。 */
  for (const o of w.nearOrbs) {
    if (o.x1 < w.x || o.x0 - w.x > 1.6 * U) continue;
    const iy0 = w.y + w.innerOff, iy1 = iy0 + w.innerSize;
    if (iy1 < o.y0 - 8 || iy0 > o.y1 + 8) continue;
    /* 要一次"新的按下":手上有没用掉的一下就按着,没有就先松一帧、下一帧再按下去 */
    return w.pressFresh ? true : !w.prevHold;
  }
  let best: { x0: number; x1: number } | null = null;
  for (const o of [...w.nearHazards.filter((h) => h.y0 < 2 * U), ...w.nearSolids.filter((s) => s.y1 <= 2 * U)]) {
    /* ★ "已经过去了"要按【内框】判:危险判定框的右边缘一旦退到内框左缘后面,就真的踩不到了。
       按外框判(老写法)会让机器人为一根刚过去 0.3 块的刺按住不放,落地瞬间被动起跳,
       而那一跳的落点正好压在下一个障碍上 —— 实测就是这么死的。 */
    if (o.x1 <= w.x + w.innerOff) continue;
    if (!best || o.x0 < best.x0) best = o;
  }
  if (best && best.x1 - w.x <= reach) return true;
  /* 坑:先找出脚下的地板、以及它右边下一块地板 —— 两者之间就是缺口。
     必须在"落到对面"的窗口里起跳:太早会掉进坑,太晚就来不及。
     ★ 这里的两个额外条件都是踩出来的坑:铺面里到处是【浮在半空的平台/线框】,
       不判"是不是脚底那块地板"的话,机器人会把头顶的平台当成坑、凭空起跳 —— 然后撞死在天花板的刺上。 */
  for (const f of w.nearFloors) {
    if (w.x + w.box <= f.x0 || w.x >= f.x1) continue;      // 玩家不站在这块地板上
    if (Math.abs(f.y1 - w.y) > 6) continue;                // ★ 这才是脚底那块(高度对得上)
    let next: number | null = null;
    for (const g of w.nearFloors) {
      if (g.x0 < f.x1 - 1) continue;
      if (Math.abs(g.y1 - f.y1) > 2 * U) continue;         // ★ 坑对面的地板得差不多高
      if (next === null || g.x0 < next) next = g.x0;
    }
    if (next === null) continue;                           // 右侧没地板了(关卡尾部)
    const pitFar = next;
    const jumpFrom = pitFar - span + 24;                   // 落点要越过缺口对面
    if (w.x >= jumpFrom && w.x < f.x1) return true;
  }
  return false;
}
