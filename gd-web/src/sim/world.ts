/* 定点模拟核心:零依赖、零引擎、零随机、可在 Node 里跑。
 *
 * 时间模型:外部按【帧】驱动(60 帧/秒),内部一律拆成 4 个子步(1/240 秒),
 * 和原作"每帧 4 个子步"的结构一致,但我们的步长是固定的 ——
 * 于是"同一串输入 → 同一串状态"永远成立,可以录回放、可以写指纹测试。
 *
 * 坐标:一律用 GD 口径的【单位】(1 块 = 30 单位),x 向右、y 向上,玩家 (x,y) 是【左下角】。
 */

import { P, U, Y_TIME_SCALE, vxOf, arcSpan, ORB, PAD, jumpOf, cubeGravityOf } from './constants.ts';
import { hitboxOf, circleRadiusOf, GD_SPEC, GD_HITBOX_OFFSET } from './gdids.ts';
import type { Level, Mode, Obj } from './level.ts';

/** 每个物理子步最多走多少单位。最薄的实心是 468 线框(1.5 单位厚),取 1.2 < 1.5 ——
 *  这样无论纵向速度多大,都不会"一步跨过一堵墙"(见 frame() 里的自适应切分)。 */
const SUBSTEP_MAX = 1.2;

/** ★ 翻重力时纵向速度的倍率 —— 两张源直接冲突,最后按【关卡自己的证据】定案 = **0.5(减半)**:
 *
 *  · gdp@2.11 反编译 `PlayerObject::flipGravity`:`m_yAccel *= 1.75;`
 *    (那里的 `yAccel` 确实就是纵向速度:同文件里它被当速度用 —— 飞船夹 ±8/−6.4、
 *     波浪 = ±水平速度、UFO 冲量 ±7/8、黑环 ±15,全都对得上。所以这一行不是"加速度乘 1.75"。)
 *  · OpenGD(面向 GD 2.2)`playerobject.cpp:540`:`m_dYVel /= 2.f;` —— 同一个函数,除以 2。
 *
 *  取 0.5 的三条理由(按分量排序):
 *   ① **关卡自己说话了**。本关是 2.2 的图,x=714~727 那段"垫板走廊"在两种口径下 A/B 实测:
 *        同一处手工状态(反重力贴天花板)、同一套搜索、只改这一个倍率:
 *          (714.2, y=23)  ×1.75 → 死在 718.0   |  ÷2 → 过到 740.6
 *          (716,   y=24)  ×1.75 → 死在 726.6   |  ÷2 → 过到 740.6
 *      也就是说 ×1.75 会让这段**无解**(718 那块天花板蓝板把人以 -22.4 砸下去,
 *      落点必然撞上 722 平台的左脸;而 ÷2 的 -6.4 刚好让人落在平台顶面上)。
 *      作者摆出来的地形,只能按一种口径通 —— 那是 2.2 的口径。
 *   ② 版本对得上:2.2 的通行口径就是"重力门不再给 1.75 倍,而是减半"(社区里 2.2 物理变更之一)。
 *   ③ 手感对得上:×1.75 让蓝板一跳 9 格(实测塔段 546 那块把人从 y=8 直接送到 y=17),
 *      ÷2 约 0.7 格 —— 后者才像原版蓝板"翻重力 + 小推力"的样子。
 *
 *  ★ 改这一条【会让所有输入卷失效】(塔段那条 1.75 弹射路线整个变了),必须重搜:
 *    free 路线:autoplay-stage --free → tape-pack → verify-run → build:embed + hugo → gd-demo-check
 *    legit 路线:autoplay-stage(重头搜)
 *  ★ 想再做定点实验就设 `w.flipMul`(或 autoplay 的 `--flipmul=`),默认已经是 0.5。 */
const FLIP_VEL_MUL = 0.5;

export interface RunState {
  tick: number; x: number; y: number; vy: number; onGround: boolean;
  mode: Mode; gdir: number; speed: number; dead: boolean; done: boolean;
  attempts: number; checkX: number; progress: number;
  /** 会动的物件(移动平台之类)当前偏移的合计 —— 指纹用它把"动的东西"也算进去 */
  moved?: number;
}

interface Box { x0: number; x1: number; y0: number; y1: number; o: Obj }

/** ★ 圆形危险物(锯片族):cx/cy 是【圆心】(= 物件中心),r 是半径(单位)。
 *  box 是它的外接矩形,只给"机器人看危险物"那类粗判据用 —— 判定本身走圆。 */
export interface CircleHazard { cx: number; cy: number; r: number; box: Box; o: Obj }

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
  /** 落块横向吸附用:上一次落在哪块上、当时的相对位置 */
  snapObj: Obj | null; snapDist: number;
  sets: Array<Array<Box>>;
  /** 双人:是否开着、玩家 2 的状态(旧快照没有这两个字段 ⇒ restore 里按单人处理 ✓) */
  dual?: boolean; p2?: PState | null;
}

/** 一个玩家的逐帧状态(双人时玩家 1 用主字段、玩家 2 存这里,物理靠"换进换出"复用同一套 substep) */
export interface PState {
  x: number; y: number; vy: number; onGround: boolean; mode: Mode;
  gdir: number; speedIdx: number; dead: boolean; deadT: number;
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
/** ★ 按"越过 x"触发的四类门(用户口径:形态门/速度门/反转门/尺寸门"到达这一 x 就触发") */
const DOOR_KINDS = new Set(['portal', 'gravity', 'speed', 'size']);
/** 进门钉死视口的形态(= 原版有"限制框"的那几个):球 / 飞船 / UFO / 波浪 ✓ 见 applyAirLimit */
const FIXED_CAM_MODES = new Set<Mode>(['ship', 'ufo', 'wave', 'ball']);

/** ★★★ 2026-09 限高框 =【进门锁定的那一段固定区间】,高度【八格】(用户口径:"原版限高八格")。
 *  八格 = 8 × 30 = 240 单位,中线 = 钉死视口的中点 ⇒ 上下各 4 格 = ±120 ✓
 *  机制源头:上下各一条地面(GJFlyGroundLayer : GJGroundLayer,进门 tweenCeiling 拉进来)✓
 *  判定形式照 PlayLayer::checkCollisions 非方块那一支:
 *     贴地:`center ≥ 下框面 + 半个盒`(源码 90 + 15 = 105)⇒ 我们的 y 是脚底 ⇒ `y ≥ 下框面` ✓
 *     顶头:`center ≤ 上框面 − 12`(源码那个 -12)⇒ `y ≤ 上框面 − 12 − 半个盒`(迷你 +6)✓
 *  ★ 页面画的两条框和这里夹的两条,【共用这一个函数】⇒ 不会再各算一套 ✗ */
export const FLY_BAND = 8 * U;

/** 限高框的两条面(世界 y):给页面画框、给物理夹取,同一个来源 ✓
 *  ★★★ 2026-09 用户:"我在说限框【整体高度/位置】不对" —— 位置按【源码】来,不再锁玩家 ✗:
 *   · 地面层 y = 相机 y + 【91.0】(asm 431211:`v59 = *(float *)(v51 + 4) + *(float *)(a1 + 328) * 91.0`,
 *     v51 是相机节点、+328 是地面缩放 —— 缩放为 1 时就是"地面面 = 取景下边 + 91")✓
 *   · 天花板层贴【窗口顶】(asm 431218:y = 窗口高/2 + A652/2 − 1 ⇒ 取景上边 − 1)✓
 *   · 两者之差 = 屏高 − 91 ≈ 239 ≈ 240 = 八格 ✓✓ —— 和用户口径"空挡就是 8 格"完全吻合 ✓
 *  ⇒ 所以框是【屏幕锚定】的:下框面 = airLo + 91,上框面 = 下框面 + 八格(240)✓
 *    (相机被门锁住 ⇒ 屏幕锚定 = 一段固定的世界区间 ✓,这就是"进门锁定的一段固定区间" ✓) */
export const GROUND_FACE_OFF = 91;

export function frameOf(airLo: number, airHi: number): { lo: number; hi: number } {
  /* 八格空档【在取景里居中】(用户:"空挡就是 8 格" + 上一版把 91 当下框面 ⇒ 整体压到屏幕偏上 ✗"更错了")
     取景 330、空档 240 ⇒ 上下各留 (330−240)/2 = 45 ✓
     带厚 32(= 128 × 0.25)正好放进这 45 里 ⇒ 32 + 13 + 240 + 13 + 32 = 330 = 一屏排满 ✓
     ★ 那个 91 是【地面带】的偏移(原版地面贴屏幕下边往上 91),不是飞行框的下框面 ✗ —— 我上一版用错了 ✗ */
  const margin = Math.max(0, ((airHi - airLo) - FLY_BAND) / 2);
  const lo = airLo + margin;
  return { lo, hi: lo + FLY_BAND };
}

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
  readonly hazards: Box[] = [];     // 尖刺(矩形判定)
  /* ★★ 圆形判定(锯片族):圆心 = 物件中心,半径查 gdids.GD_HITBOX_RADIUS。
     出处 OpenGD playlayer.cpp:1491-1503 —— 有 `_radius` 的物件走 intersectsCircle,
     没半径的才走矩形。以前我们拿 `_pHitboxes` 的矩形当锯齿判定(还把缩放乘上去),
     竖直方向大了一倍多,整关"该过的缝"全被吃掉。 */
  readonly circles: CircleHazard[] = [];
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
  /** ★ 翻重力的纵向速度倍率(原版 flipGravity 里那一下)。默认 0.5 = OpenGD/2.2 口径,
   *  理由见文件头 FLIP_VEL_MUL 那段(关卡 A/B 实测 + 版本 + 手感三条)。
   *  只给【定点实验】用:想知道某一段按另一边才过得去,就设成 1.75 再搜一遍。 */
  flipMul = FLIP_VEL_MUL;
  /** ★ 定点实验:圆判定的半径【不乘缩放】(默认 false = 跟着缩放走,和贴图一致)。
   *  证据:OpenGD 的 `_radius` 从表里取来之后没有再乘缩放(playlayer.cpp:380、1494);
   *  但整个引擎的判定盒(矩形那套)是乘缩放的(gameobject.cpp:766 的 tr.scale),
   *  锯片贴图放大却判定不变说不过去 —— 所以默认乘,`--sawbase=1` 走 OpenGD 原样。 */
  sawUnscaled = false;
  /** ★ 定点实验:刺用【外框 30×30】判(默认 false = 内框 7.5×7.5)。
   *  两份反编译在这一点上冲突,谁也没法一锤定音:
   *    · gdp@2.11 `checkCollisions.cpp:440-445` —— 危险物用 `player->getObjectRect()`,
   *      和实心碰撞【同一个盒子】;
   *    · OpenGD `playlayer.cpp:1494-1502` —— 危险物用 `playerOuterBounds`(外框),
   *      而它把内框留给实心交互(`playerobject.cpp:716,750,777`)。
   *  我们现在的组合是"实心外框 + 刺内框"(两边各取了宽松的那一半),所以这条差值必须能量化:
   *  用 `tools/hazbox-audit.ts` 数"改外框会多死多少帧"(当前自由路线:55/2970 帧,最深压进 0.31 块)。
   *  `autoplay.ts --hazbox=outer` 打开。 */
  /* ★★ 2026-09 默认改成【外框】判险(用户实测:"cube 都快进刺的一半都没死" ✓ = 我们太宽容了)。
     依据是引擎自己早就引过的那条:`gdp@2.11 checkCollisions.cpp:440-445` —— 危险物用
     `player->getObjectRect()`(即 30×30 外框),而不是 7.5×7.5 的内框。
     另一份反编译写的是内框,所以我们之前取了"实心外框 + 刺内框"这个各取宽松的组合 ✗ ——
     实测的后果就是"扎进刺里一大截才死" ✓。现在两边都用外框 ✓。
     (要回到旧行为:`autoplay.ts --hazbox=inner` / 页面里给 hazBoxIsOuter = false 即可。) */
  hazBoxIsOuter = true;
  /** 飞行类(飞机/UFO/波浪):不落地、碰到实心即死(见实心侧撞那一段的注释) */
  get isFlyMode() { return this.mode === 'ship' || this.mode === 'ufo' || this.mode === 'wave'; }
  /** ★★ 飞行类碰实心是否即死。默认【按关卡来源】:
   *   · GD 导出的真实关卡(.dat)= 开 —— 这是原版行为,必须照搬;
   *   · 我们自己生成的铺面(`generateLevel`)= 关 —— 生成器的飞行段还是按旧物理铺的
   *     (实测:一开就 2108 次死亡、只能走到 x=354.5),等生成器按新物理重新校验后再打开。
   *  见 HANDOVER §13.25。 */
  flySolid = false;
  /** ★ 临时定点用:把实心碰撞每一支的判断过程记到 solidTrace(默认关;tools/probe-rod.ts 会打开) */
  traceSolid = false;
  /** ★★ 四类【门】按"越过 x"触发(用户 2026-09 口径),不看高度。见 hitEvent */
  doorByX = true;
  readonly solidTrace: string[] = [];
  speedIdx = 1;
  dead = false; done = false; deadT = 0;
  attempts = 1;
  checkX = 0; checkY = 0; checkMode: Mode = 'cube'; checkSize = 1;
  /** ★★ 存档点还要记【速度档】和【重力方向】:以前只记了形态和体积,
   *  reset() 里又把 gdir/speedIdx 硬写成 1 ⇒ 在"快速档"或"反重力段"摔死后,
   *  复活出来的是常速+正常重力 —— 同一段路完全对不上 ✗(用户:"存档点机制绝对是错的")。 */
  checkSpeed = 1; checkGdir: 1 | -1 = 1;
  /** 最近一次跨过的形态门的中心 y(相机在飞行类形态里"钉视口"要用,原版口径) */
  portalY = 0;
  /** 这张铺面是不是"GD 导出的真实关卡"(决定事件物件用相交判还是跨 x 判,见 hitEvent) */
  private strict = false;
  /** ★ 跳环要"一次新的按键"才生效(原作口径:按一下消耗一次,按住不放串不起环)。
   *  按下的那一瞬间 pressFresh 置位,被一次起跳或一个环用掉;松手再按才会有新的一次。 */
  pressFresh = false;
  /** ★★ 同一次按键还要留给跳环/冲刺箭头用(2026-09 修)。
   *  原作里"按下"会同时喂给两条路:形态自己的动作(飞机/UFO 的扇一下、蜘蛛的瞬移、地面起跳)
   *  和 `ringJump` 里的 `hasQueuedHold`(环/箭头)。我们以前只用一个 pressFresh,
   *  先跑的形态分支把它吃掉 → **UFO 形态下所有跳环和箭头都按不动**(用户实测"紫色冲刺箭头没用,无法交互";
   *  关卡 x=2132~2545 那几个紫箭头正好在方块段,而其它段一样会踩到这个坑)。
   *  现在形态动作消耗 pressFresh 时把这一次"仍然有效"记在 pressAux 上,
   *  环/箭头那一遍用 `pressFresh || pressAux`,用过就一起清掉(同一帧只放行一次)。 */
  pressAux = false;
  /** 紫色箭头/板这一次"没找到头顶的面"用的临时标记(见 tpReach) */
  private tpFailed = false;
  /** 上一帧是否按着(botThink 要靠它凑出"松一帧再按"的新按键) */
  prevHold = false;
  /** 机器人"抵消重力"已经撑了多久(秒) */
  floatT = 0;
  private armedChecks = new Set<Box>();
  private armedPortals = new Set<Box>();
  private armedSpeeds = new Set<Box>();
  private armedSizes = new Set<Box>();
  private armedClones = new Set<Box>();
  private armedGravs = new Set<Box>();
  private armedOrbs = new Set<Box>();
  private armedPads = new Set<Box>();
  private armedArrows = new Set<Box>();
  private armedTriggers = new Set<Box>();

  constructor(level: Level, startX?: number, startY?: number, opts?: { sawUnscaled?: boolean; hazOuter?: boolean; flySolid?: boolean }) {
    this.level = level;
    /* ★ 定点实验开关必须在【建判定盒之前】生效 —— 锯片的盒子是构造时算好的,
       参数化之后再打开开关是没用的(踩过:--sawbase=1 一度完全没起作用)。 */
    this.sawUnscaled = !!opts?.sawUnscaled;
    this.hazBoxIsOuter = !!opts?.hazOuter;
    /* ★ 飞行类碰实心即死:真实关卡默认开(照搬原版),自铺面默认关(见字段注释) */
    this.flySolid = opts?.flySolid ?? !!level.fromGD;
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
      /* ★ 锚点:通式是"以物件中心为心"(-w/2,-h/2),但传送门 747 例外(横向右移 12 单位)——
         见 gdids.GD_HITBOX_OFFSET。以前一律居中,7 个传送门的触发点偏左 0.4 块。 */
      const off = GD_HITBOX_OFFSET[o.kind] ?? [-w / 2, -h / 2];
      return { x0: cx + off[0], x1: cx + off[0] + w, y0: cy + off[1], y1: cy + off[1] + h, o };
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
        /* ★ 硬币 / 冲刺箭头:走【原表】的判定盒 —— 硬币 id 1329 = 40×40、
           冲刺箭头 1704/1751 = 36×36(都是"以物件中心为心"的方盒)。
           以前这里写的是整格 b(30×30),而且下面还重复写了一遍 hbBox 版本 ——
           esbuild 一直警告"重复 case,后面那个永远走不到",也就是说表里那两档从来没生效过:
           箭头/硬币实际比原版小一圈,触发得偏晚。现在删掉前面这两行,让下面的 hbBox 版本生效。
           (3004/3005 紫箭/紫板原表里没有,仍用包围盒兜底。) */
        case 'coin': this.coins.push(hbBox(o) ?? b); break;
        case 'arrow': this.arrows.push(hbBox(o) ?? b); break;
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
          /* ★★ 锯片的判定是【圆】,不是矩形 —— 这是"波浪贴着方块门下沿过"的钥匙。
             出处:OpenGD `LongData.cpp:461` 的 `_pHitboxRadius`(半径表)
                  + `playlayer.cpp:1491-1503`(有半径的走 intersectsCircle,没半径的才走矩形)。
             以前用 `_pHitboxes` 的 85x44 矩形再乘缩放(危险盒顶部 23.65),圆只有 23.14;
             再叠上"旧代码拿玩家内框判、新代码按原版拿外框判",中心门槛从 23.78 降到 23.64 ——
             看着只差 0.14 块,但方块跳坑的净空需求从 10.0 帧变成 16.1 帧(窗口 13.4 帧),
             于是这段从"差一点点就无解"变成"留 2.7 帧余量"。
             ★ 半径乘缩放(和矩形那套一致);`--sawbase=1` 走 OpenGD 的不缩放原样。
             ★ 表里查不到半径的锯片(自铺面的合成关卡)退回原来的包围盒矩形。 */
          const cx = (o.b + o.w / 2) * U, cy = (o.r + o.h / 2) * U;
          /* 半径来源:①铺面里存好的 rad/rad0;②只有 id 时现算(缩放 = 物件 w/h ÷ 表里的基础 w/h)。
             两条路都要有:紧凑铺面文本会带上 id,手搭的合成关卡只写 id。 */
          let base = o.rad0 ?? null, scaled = o.rad ?? null;
          if (base == null && o.id != null) {
            base = circleRadiusOf(o.id);
            if (base != null) {
              const spec = GD_SPEC[o.id];
              const sx = spec?.w ? o.w / spec.w : 1, sy = spec?.h ? o.h / spec.h : 1;
              scaled = base * (Math.abs(sx) + Math.abs(sy)) / 2;
            }
          }
          if (base != null || scaled != null) {
            const r = this.sawUnscaled ? (base ?? scaled!) : (scaled ?? base!);
            this.circles.push({
              cx, cy, r, o,
              box: { x0: cx - r, x1: cx + r, y0: cy - r, y1: cy + r, o },
            });
            break;
          }
          this.hazards.push(b);
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
  this.checkSpeed = this.speedIdx; this.checkGdir = this.gdir;   // ★ 出生档也一起记(reset 会用它)
    /* ---- 分组:给每个带 groups 的物件记一份"可动"记录,并把它的判定盒挂上去 ----
       ★ 一个物件挂几个盒子,这里就记几份(线框以前会展开成好几根杆)。
         现在线框的判定也回到"整格一个盒子",所以通常是一物一盒。 */
    const boxesOf = new Map<Obj, Box[]>();
    for (const list of [this.solids, this.floors, this.hazards, this.orbs, this.pads, this.forces, this.pits, this.coins, this.arrows, this.circles.map((c) => c.box)]) {
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
        circles: new XIndex(this.circles.map((c) => c.box)),
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
  get nearCircles(): Box[] { return this.fast ? this.win.circles : this.circles.map((c) => c.box); }

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
      snapObj: this.snapObj, snapDist: this.snapDist,
      sets: [
        [...this.armedChecks], [...this.armedPortals], [...this.armedSpeeds], [...this.armedSizes],
        [...this.armedGravs], [...this.armedOrbs], [...this.armedPads], [...this.armedArrows],
        [...this.armedTriggers], [...this.broken], [...this.gotCoins], [...this.handledPortals],
        [...this.armedClones],
      ],
      dual: this.dual, p2: this.p2 ? { ...this.p2 } : null,
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
    this.snapObj = s.snapObj; this.snapDist = s.snapDist;
    const [c, p, sp, sz, gv, ob, pd, aw, tg, br, gc, hp, cl] = s.sets;
    this.armedChecks = new Set(c); this.armedPortals = new Set(p); this.armedSpeeds = new Set(sp);
    this.armedSizes = new Set(sz); this.armedGravs = new Set(gv); this.armedOrbs = new Set(ob);
    this.armedPads = new Set(pd); this.armedArrows = new Set(aw); this.armedTriggers = new Set(tg);
    this.armedClones = new Set(cl ?? []);
    this.dual = s.dual ?? false;
    this.p2 = s.p2 ? { ...s.p2 } : null;
    this.dualSave = null;
    this.broken.clear(); for (const b of br) this.broken.add(b);
    this.gotCoins.clear(); for (const b of gc) this.gotCoins.add(b);
    this.handledPortals.clear(); for (const b of hp ?? []) this.handledPortals.add(b);
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
  /* ★★ 2026-09 自由移动(演示铺用,用户:"demo 做成自由移动,不再固定往前")——
     为 true 时横向由 freeDir(−1 左 / 0 停 / +1 右)决定;否则按 GD 的恒速前进 ✓ */
  get vx() { return this.freeMove ? this.freeDir * vxOf(this.speedIdx) : vxOf(this.speedIdx); }

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
    this.mode = mode; this.gdir = this.checkGdir; this.speedIdx = this.checkSpeed;
    /* ★★ 2026-09 修:以前这里写死 `gdir = 1; speedIdx = 1` ⇒
       在"快速/更快档"或"反重力段"摔死后,复活出来的是常速 + 正常重力,整段节奏全错 ✗。
       现在跟形态/体积一样,从存档点恢复 ✓(出生点的存档值就是这一关的初始档 ✓)。 */
    this.sizeMul = this.checkSize;      // 复活要恢复存档点时的体积(迷你/普通)
    this.dead = false; this.done = false; this.deadT = 0;
    this.pressFresh = false; this.prevHold = false; this.pressAux = false; this.tpFailed = false;
    this.boostDir = 0;
    this.armedChecks.clear(); this.armedPortals.clear(); this.armedSpeeds.clear(); this.armedGravs.clear();
    this.armedOrbs.clear(); this.armedPads.clear();
    this.armedTriggers.clear(); this.armedSizes.clear(); this.armedArrows.clear();
    /* 碎掉的砖块 / 吃掉的硬币 / 进行中的冲刺都回到初始状态(和原作"重开一局"一致) */
    this.broken.clear();
    this.gotCoins.clear();
    this.handledPortals.clear();
    this.dash = null;
    this.snapObj = null; this.snapDist = 0;      // 重开一局:落块吸附的记忆也清空
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
  /* ===== 双人(克隆门 286 = 开 · 287 = 收)=====
     出处:.tmp/GDsrc/headers/includes.h:1320 `DualPortal = 23` / 1324 `SoloPortal = 24`
       (OpenGD 的 object.json 里 286 → object_type 23、287 → 24 ✓)
     实现:玩家 2 的【逐帧状态】存这里,物理用"换进换出主字段"的办法跑同一套 substep ✓
     待补(照搬源码前不猜):原版第二个玩家的生成偏移与双人相机口径,见 HANDOVER 待办 ✓ */
  dual = false;
  private p2: PState | null = null;
  private dualSave: PState | null = null;
  private takeState(): PState {
    return {
      x: this.x, y: this.y, vy: this.vy, onGround: this.onGround, mode: this.mode,
      gdir: this.gdir, speedIdx: this.speedIdx, dead: this.dead, deadT: this.deadT,
    };
  }
  private putState(s: PState) {
    this.x = s.x; this.y = s.y; this.vy = s.vy; this.onGround = s.onGround; this.mode = s.mode;
    this.gdir = s.gdir; this.speedIdx = s.speedIdx; this.dead = s.dead; this.deadT = s.deadT;
  }
  /** 渲染/相机用:临时把玩家 2 的状态换进主字段(读完/画完【必须】dualBack() ✓)。
   *  返回 false = 现在没有玩家 2(单人),调用方照旧 ✓ */
  dualInto(): boolean {
    if (!this.dual || !this.p2 || this.dualSave) return false;
    this.dualSave = this.takeState();
    this.putState(this.p2);
    return true;
  }
  dualBack() {
    if (!this.dualSave) return;
    this.p2 = this.takeState();
    this.putState(this.dualSave);
    this.dualSave = null;
  }
  /** 玩家 2 现在在哪(相机要取两人的中点用 ✓);没有玩家 2 就返回 null */
  p2Pos(): { x: number; y: number } | null {
    return this.dual && this.p2 ? { x: this.p2.x, y: this.p2.y } : null;
  }

  frame(hold: boolean) {
    /* 按键的"上升沿":原作 pushButton 就是在这个时刻清掉环的可用标记 */
    if (hold && !this.prevHold) { this.pressFresh = true; this.pressAux = false; }
    this.prevHold = hold;
    this.tpFailed = false;
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
       ★★ 2026-09 修(用户:"线框莫名奇妙可以穿过"):原来只按【纵向】速度决定切几刀,
          横向一步走多远没人管 —— 算一下就知道必然穿透:
            正常档 5.193 单位/帧 ÷ 4 步 = 1.30 单位/步   (< 1.5,勉强)
            快速档 6.457 ÷ 4 = 1.61  ✗  更快档 7.8 ÷ 4 = 1.95 ✗  最快档 9.6 ÷ 4 = 2.40 ✗✗
          杆厚只有 1.5 单位 ⇒ 只要速度高过正常档,一步就跨过整根杆 ✓ 这就是用户报的现象。
          现在横向也一起算:每步位移必须 < SUBSTEP_MAX(1.2 单位),不够就继续切。
          (等价于"每步都不会跳过一堵墙";定步长不变,只是把一帧切成更多子步 ✓) */
    /* ★★ 2026-09 修(用户:"线框莫名奇妙可以穿过"):切几步原来按 `vy*Y*FRAME` 算 ——
       可 vy 的单位本来就是【单位/帧】,再乘 FRAME(=1/60)就小了 60 倍 ⇒ 那段自适应切分
       **从来没触发过** ✗,横向更没人管 ⇒ 每帧 4 步、每步走 vx/4 单位,而线框杆只有 1.5 单位厚:
         正常档 5.193/4 = 1.30(<1.5 勉强) · 快速档 6.457/4 = 1.61 ✗ · 更快 7.8/4 = 1.95 ✗ · 最快 9.6/4 = 2.40 ✗✗
       ⇒ 只要速度高过正常档,一步就跨过整根杆 ✓ 正是用户报的现象。
       现在:x/y 都按【单位/帧】直接比 SUBSTEP_MAX(1.2),不够就继续切 ✓ */
    this.advance(hold);
    /* ★★★ 2026-09 双人(克隆门 286 开 / 287 收):玩家 2 用【同一套 substep】跑 ——
       把它的状态换进主字段、跑完再换回来收好(不复制第二遍物理 ✓)。
       同一帧、同一个 hold ⇒ 两人共用输入,和原版双人一致
       (出处:事件枚举 PortalDualOn/Off = 57/58,见 .tmp/GDsrc/headers/includes.h:1404-1405)✓ */
    if (this.dual && this.p2) {
      const save = this.takeState();
      this.putState(this.p2);
      this.advance(hold);
      this.p2 = this.takeState();
      this.putState(save);
      /* 双人里任一人死 = 这一趟结束(原版:一个死就重开)✓ */
      if (this.p2.dead) { this.dead = true; this.deadT = 0; }
    }
    this.tick++;
  }

  /** 一个玩家的一帧物理(自适应切子步 + 积分)—— 玩家 1 / 玩家 2 共用它 ✓ */
  private advance(hold: boolean) {
    const needY = Math.abs(this.vy) * Y_TIME_SCALE;
    const needX = Math.abs(vxOf(this.speedIdx));
    const need = Math.max(needY, needX) / SUBSTEP_MAX;
    const n = need > SUB ? Math.min(SUB * 8, Math.ceil(need)) : SUB;
    const d = FRAME / n;
    /* ★ 帧初位置:落台容错要用它(原版 m_lastPosition 就是每帧记一次,见 substep 里的说明) */
    this.frameY0 = this.y;
    for (let i = 0; i < n; i++) this.substep(d, hold);
  }

  /** ★ 弹簧/跳环力度的运行时微调(页面上按 [ / ] 改,HUD 会显示)。
   *  为什么留这个口子:蓝跳点的力度 OpenGD 给的是 0.8×16=12.8,但用户实测"太大了";
   *  我们手上没有第二个可核的原版来源,与其反复猜,不如让用户直接把数值调到手感对上再定死。
   *  ?padmul=0.75 也能指定(验收脚本用 __gd.scene.world.padMul 也行)。 */
  padMul = 1;

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

  /** ★★★ 2026-09 限高(限制框)—— 用户:"限高代码需要照搬,机制是类似创建上下两边的地面"
   *  这两块"地面"就是【原版的面板】【上下各一块地面】,由页面每帧写入(世界 y,单位):
   *   · airHi = 取景上边 —— 天花板(第二块地面)的【节点】位置,见 applyAirLimit 里的换算 ✓
   *   · airLo = 取景下边 —— 只作诊断用;原版的下边是【关卡地面本身】,不是屏幕边 ✓
   *  null = 页面还没跑(测试/机器人)⇒ 只夹地面、不夹天花板 ✓ */
  airLo: number | null = null;
  airHi: number | null = null;
  /** 限高诊断:状态一变就打一行(用户在页面里跑一次就能定性 ✓ 不刷屏 ✗) */
  private airDbg = '';
  /** ★★★ 2026-09 限高(限制框)——【照搬源码】✓ 用户:"限高代码需要照搬,机制是类似创建上下两边的地面"
   *
   *  机制(真源码,不是猜的):
   *   · GJFlyGroundLayer : public GJGroundLayer     (headers/Layers/GJFlyGroundLayer.h:12)
   *     ⇒ 原版的"飞行限高"就是【第二块地面】,外观也走地面那一套
   *       (GJFlyGroundLayer::init 只多一句 `this[332]=0`,几何全继承 GJGroundLayer ✓ 反编译 381674-381682)
   *   · GJBaseGameLayer::createGroundLayer          (反编译 418286-418311)
   *     ⇒ 一次建【两块】GJGroundLayer(this+632 = 地面 / this+633 = 天花板),第二块再调一次虚表 +72
   *       传 -1082130432 = 0xC0000000 = -2.0f ⇒ 纵向镜像 —— 天花板就是【倒过来的地面】✓
   *   · GJGroundLayer::init                         (反编译 382185)
   *     `*(float *)(this + 336) = 128.0 - 贴图高` ⇒ 地面【顶面】永远在 节点 + 128
   *     (真贴图 groundSquare_01_001.png 实测就是 128×128 ⇒ 偏移 = 0 ⇒ 顶面 = 节点 + 128 ✓)
   *   · PlayLayer::checkCollisions 的【非方块】那一支(照录,OpenGD PlayLayer.cpp:1259-1282):
   *        y < 地面节点 + 相机 + (迷你 ? 87 : 93)          ⇒ 贴回去 + setYVel(0);正向重力时 hitGround
   *        y > 天花板 − (迷你 ? 234 : 240) + 视口中心 − 12  ⇒ 贴回去 + setYVel(0);反重力时 hitGround
   *
   *  换到我们的坐标(用户口径:"原版限高八格" + "进门时锁定的一段固定区间"):
   *   · 区间 = 进门钉死视口的中点 ± 4 格(八格 = 240 单位)⇒ 上下两条【面】见 frameOf ✓
   *   · 下框面 = 这个形态的"地面"(贴上去 + hitGround + setYVel(0))✓
   *   · 上框面 = 天花板:center ≤ 面 − 12(源码那个 -12)⇒ 脚底上限 = 面 − 12 − 半个判定盒(迷你 +6)✓
   *   · 两条面页面都画出来(原版就是上下各一条地面 ✓)
   *
   *  ★ 只在【相机钉死的形态】(飞船 / UFO / 波浪 / 球)生效:这几个形态 airHi/airLo 是钉死的 ✓
   *    方块 / 机器人 / 蜘蛛的相机跟着人走 ⇒ 拿它当框会变成一堵跟着人跑的墙 ✗ */
  private applyAirLimit() {
    if (this.mode === 'cube') return;                    // 源码:只夹【非方块】那一支 ✓
    if (this.airLo == null || this.airHi == null) return;   // 页面还没跑:不夹 ✓
    if (!FIXED_CAM_MODES.has(this.mode)) return;
    const f = frameOf(this.airLo as number, this.airHi as number);
    /* 下框面(这个形态的"地面"):贴回去 + hitGround + setYVel(0) —— 源码 `if (!isGravityFlipped()) hitGround(false)`
       ★ hitGround 必须照搬:原版【地面根本不是物件】,球能在地上跳靠的就是这一句把落地标记置上 ✓
         (我们这里也有真地面物件,但夹取先跑、人不陷进去 ⇒ 那套"踩实体"识别不到 ⇒ 球/机器人永远跳不起来 ✗ 实测过)
       ★ 坐标口径:我们的 this.y 是【脚底】不是中心(见落台那段 `this.y = b.y1`)⇒ 下框面直接用 ✓ */
    if (this.y < f.lo) {
      this.y = f.lo;
      if (this.gdir > 0) { this.onGround = true; this.airHold = true; }
      this.vy = 0;
    }
    /* 上框面(天花板):源码比较的是【人中心】⇒ 减半个判定盒(迷你 +6,源码 234 那一档) */
    const top = f.hi - 12 - this.box / 2 + (this.mini ? 6 : 0);
    /* 一行诊断(用户:"我都看不到限高框在哪,我怎么知道生没生效")—— 【顶到的那一刻】打一次 ✓ */
    if (this.y >= top - 0.001 && this.airDbg !== this.mode) {
      this.airDbg = this.mode;
      console.info('[gd] 限高:形态=' + this.mode + ' · 框=' + Math.round(f.lo) + '~' + Math.round(f.hi) +
        '(八格 ' + FLY_BAND + ') · 上框面=' + Math.round(f.hi) + ' · 上限(脚底)=' + Math.round(top));
    }
    if (this.y > top) {
      this.y = top;
      if (this.gdir < 0) { this.onGround = true; this.airHold = true; }
      this.vy = 0;
    }
  }

  /** ★★★ 2026-09 用户:"还是会被吸住无法跳起" —— 根因:夹在下框面时置的 onGround,
   *  会被【同一子步后面】那段"踩实体"扫描清掉(框面底下没有实体 ✗)⇒ 球站在框面上按不出跳 ✓
   *  ⇒ 夹取先照源码跑(位置 + setYVel(0) + hitGround),等踩实体扫完再把这次 hitGround 补回去 ✓
   *  每子步开头由 applyAirLimit 置 false,扫完由 reassertAirGround 收尾 ✓ */
  reassertAirGround() {
    if (this.airHold) { this.onGround = true; this.airHold = false; }
  }
  private airHold = false;

  /** 弹簧 / 跳环给的推力方向(0 = 没有推力飞行)。见 applyFallClamp */
  private boostDir: 1 | -1 | 0 = 0;

  /** 帧初的脚底高度(落台容错的两路判定要用,见 substep 里的说明) */
  private frameY0 = 0;

  /** ★ 只给【搜索工具】用的记账:哪些门在"越过的那一刻"已经算数了(碰到了,或者当时
   *  碰不碰都一样 —— 已经是那个形态/重力/速度/体积)。
   *  为什么必须记账、而且必须【在越过的那一刻】判:这个判定依赖当时的玩家状态,
   *  而状态会变 —— 实测反例:某重力门在越过时玩家重力正好是它要的那一档(算数 ✓),
   *  三十块之后玩家被球点翻成反重力,再回头按"当前状态"判,那个门就变成"没生效"了,
   *  于是搜索在那个节点上 16 个候选全被判"跳过门"、前沿直接枯死(日志里一排 K跳门)。
   *  这个集合只影响搜索的剪枝,不参与物理(和 god / padMul 一个性质)。 */
  readonly handledPortals = new Set<Box>();

  /* ---------------- 方块落块时的横向吸附 ----------------
   * 出处:gdp master `PlayerObject_checkSnapJumpToObject.cpp`(调用点在同文件的
   * collidedWithObjectInternal:`if (vType == Cube) checkSnapJumpToObject(object);`)。
   * 原版每落到一块新方块上,会看它和【上一次落的那块】差多少:
   *   littleStair / downStair / bigStair 三档(按 m_playerSpeed 与体积查表,单位 = 格 × 30),
   *   一旦正好差这么一档(±threshold 容差),就把人的 x 拉回"和上次落点相同的相对位置",
   *   最多挪 threshold(1~2 单位)。这就是原版连续跑台阶时落脚点特别一致的原因。
   * ★ 只有方块形态调(m_vehicleSize 决定 littleStair/threshold 那两档)。 */
  private snapObj: Obj | null = null;
  private snapDist = 0;
  private checkSnapJumpToObject(o: Obj) {
    if (this.mode !== 'cube') return;
    const objX = o.b * U, objY = o.r * U;
    const posX = this.x;
    const prev = this.snapObj;
    if (prev && prev !== o) {
      const sp = P.speedMul[this.speedIdx] ?? 1.1;      // m_playerSpeed
      const big = !this.mini;                           // m_vehicleSize == 1.0
      let threshold: number, bigStair: number, downStair: number, littleStair: number;
      if (sp === 0.9) { threshold = 1; bigStair = 90; downStair = 150; littleStair = big ? 120 : 90; }
      else if (sp === 0.7) { threshold = 1; bigStair = 60; downStair = 120; littleStair = 90; }
      else if (sp === 1.1) { threshold = 2; bigStair = 120; downStair = 195; littleStair = big ? 150 : 90; }
      else if (sp === 1.3) { threshold = 2; bigStair = 135; downStair = 225; littleStair = 90; }
      else if (big) { threshold = 2; bigStair = 135; downStair = 225; littleStair = 180; }
      else { threshold = 1; bigStair = 90; downStair = 150; littleStair = 120; }
      const bl = this.gdir * 30;                        // flipMod() * 30
      const dx = objX - prev.b * U, dy = objY - prev.r * U;
      if ((Math.abs(dx - littleStair) <= threshold && Math.abs(dy - bl) <= threshold)
        || (Math.abs(dx - downStair) <= threshold && Math.abs(dy + bl) <= threshold)
        || (Math.abs(dx - bigStair) <= threshold && Math.abs(dy - bl * 2) <= threshold)) {
        let nx = objX + this.snapDist;
        if (Math.abs(nx - posX) > threshold) nx = nx <= posX ? posX - threshold : posX + threshold;
        this.x = nx;
      }
    }
    this.snapObj = o;
    this.snapDist = posX - objX;
  }

  private substep(dt: number, hold: boolean) {
    const s = dt * 60;                     // 帧当量:表里的常量按"每帧"给
    const sY = s * Y_TIME_SCALE;           // ★ y 轴(含重力)按 dt×0.9 走 —— 原作就是这么积分的
    const prevX = this.x, prevY = this.y, prevVy = this.vy;

    this.x += this.vx * s;

    /* --- 冲刺箭头生效期间:重力关掉,纵向按箭头方向走 ---
     * ★★ 2026-09 按 PlayerObject::update 的 dash 分支修(用户:"绿色/粉色冲刺环,垂直方向的冲刺明显不对"):
     *       v31 = getCurrentXVelocity(a1) * a2;      // 本帧【水平位移】,不乘 0.9
     *       v34 = v31 * m_dashY;                     // 纵向位移 = 水平位移 × 箭头斜率
     *   两处差异:
     *     ① 位移不该过 y 轴那个 ×0.9 —— 我们原来走 sY ⇒ 冲刺距离少 10% ✗(和波浪那条同一个坑 ✓);
     *     ② m_dashY 是【斜率】(由 startDashing 按箭头角度算)⇒ 垂直冲刺时 vx 不变、纵向位移 = |水平位移|;
     *        我们这儿 `vy = |vx| × dir.y` 形状对,但仍要按①去掉 0.9。
     *   (d.t > 0.5 这个"0.5 秒上限"也待核:原版是 stopDashing / m_maxDuration 决定的。) */
    if (this.dash) {
      const d = this.dash;
      d.t += FRAME / 4;
      /* ★★★ 2026-09 dash 方向按源码原文(用户:"那个算式需要你自己去源码里找"):
         .tmp/GDsrc/asm/gd-ida-decomp.cpp:148608-148609
             v75 = ccpForAngle(v6 * 0.017453);                              // 单位向量 (cos,sin)
             CCPoint::operator*(&v73, v75, *((float*)a2 + 410) * 5.77);     // × (环字段 × 5.77)
         ⇒ dash 向量 = 单位向量 × (环字段 × 5.77);环字段默认 1.0 ⇒ 纵向基准 = 5.77
           (正是 1 档速度 5.7700018 这个常数 ✓)
         用户铁律:冲刺的【水平分量 = 当前移动速度】⇒ 横向永不改动 ✓(公共路径已按 this.vx 走) */
      const aRad = (d.ang * Math.PI) / 180;
      const cosA = Math.cos(aRad), sinA = -Math.sin(aRad);   // 世界坐标 y 向上
      /* ★★ 2026-09 实测验出来的大 bug(按住不放逐帧打印):冲刺期间 dx=0.000 / dy=0.000
         ⇒ 人【原地冻住】✗ —— 因为这一支只写了纵向,把【横向位移】整个吃掉了 ✗。
         原版(PlayerObject::update 的 dash 分支):横向照常走(v38 = v31),
         纵向 = 水平位移 × m_dashY ⇒ 冲刺期间必须【同时】推 x 和 y ✓。 */
      /* ★★ 2026-09 撤回"竖直冲刺横向停住"(那是我按用户描述猜的 ✗)。
         查了真源码(CallocGD/GD-2.206-Decompiled,asm/gd-ida-decomp.cpp:148504
         `PlayerObject::startDashing`):它只做两件事 ——
           ① 把环/箭头的【旋转角】换算成 m_dashX / m_dashY(旋转角 + 翻面时 +180°,再归一化 %360)
           ② 置 dash 标志 + 记下 dash 起始时间
         而 `PlayerObject::update`(用户贴过的那段)里,dash 期间的位移是:
               v38 = v31;                 // 横向 = 原速,【不变】✓
               v34 = v31 * m_dashY;       // 纵向 = 水平位移 × 斜率
         ⇒ 冲刺期间【横向永远照原速走】✓(竖直箭头也是 —— 所以竖直箭头是"斜着扎下去" ✓,
           不是横向停住 ✗)。我上一条把它改成"横向停住"是错的,这里改回来 ✓。 */
      /* ★★ 2026-09 找到"冲刺像是加速铺面速度"的真凶:横向被推进了【两次】✗
         公共路径 line 768 已经有 `this.x += this.vx * s;` ✓,我上一轮又在 dash 分支里加了
         `this.x += this.vx * sY;` ⇒ 冲刺期间横向速度翻倍 ⇒ 观感就是"铺面流速变快" ✓✓。
         源码依据(PlayerObject::update 的 dash 分支):它【只】算纵向位移 v34 = v31 × m_dashY,
         横向那步 v38 = v31 是在公共路径统一做的 ⇒ 这里不能再推一次 ✗。 */
      /* ★★★ 2026-09 回退(用户:"紫箭头又变成瞬移了,绿箭头一起被修坏"):
         我上一轮把【所有 dash】的方向都改成了 tan(环角)✗ —— 但这一关的 dash 通路里【只有箭头】
         (冲刺环 141/1022 早已还原成跳环 ✗)⇒ 我等于把本来正确的箭头方向改坏了 ✓✓
         ⇒ 恢复用 arrowDir(箭头语义:不许往后指,横向分量 ≥0.7)✓
         环的 tan 口径等真要做环时再单独走一条分支 ✗,不混用 */
      /* 水平:纵向 0 ✓ · 斜向 45°:纵向 = vx ✓ · 垂直:|cos|≈0 ⇒ 纵向 = 【固定 5.77】(源码常数)✓ */
      this.vy = (Math.abs(cosA) < 0.05)
        ? (sinA >= 0 ? 1 : -1) * 5.7700018
        : Math.abs(this.vx) * (sinA / cosA);
      this.y += this.vy * (sY / Y_TIME_SCALE);
      /* ★★ 2026-09 恢复时长上限(上一轮我删掉它是错的 ✗):用户实测"纵向冲刺像是把铺面流速加快了"
         ⇒ 就是【冲刺永不结束】的表现:按住不放就一直冲 ✗。
         依据仍是用户贴的 PlayerObject::update:
             if (m_maxDuration > 0.0 && m_totalTime - m_dashStartTime > m_maxDuration) stopDashing;
         环/箭头没有自带 m_maxDuration 时,原版的默认就是约 0.5 秒 ✓(这也是我最初写 0.5 的来源)。
         ⇒ 规则:松手即停,或到 0.5 秒上限即停 ✓。 */
      /* ★★ 2026-09 用户:"冲刺箭头逻辑还是错的,没有最大持续时间,按多久就冲刺多久" ⇒
         去掉 0.5 秒上限 ✓ —— 冲刺【只由按住/松开决定】:按住一直冲,松手立刻停 ✓
         (源码那行 `m_maxDuration > 0` 只在环自带时长时生效;本关的环/箭头没有 ⇒ 不限时 ✓)*/
      if (!hold) this.dash = null;
      /* ★★ 2026-09 修(用户:"bird 都没碰到就死了"):飞行类掉到地面线 y<0 时,
         原版是【有地面就落上去滑行】,只有真的掉进坑里才死 —— 我们以前一律 die() ✗。
         实测(改前):ufo/ship/wave 贴地飘十几帧就死 ✓ 就是这个。 */
      if (this.y < 0) {
        const g = this.floors.find((f) => this.x + this.box > f.x0 && this.x < f.x1);
        if (g) { this.y = 0; this.vy = 0; this.onGround = true; }
        else { this.die(); return; }
      }
      if (this.y + this.box > this.rows * U) { this.die(); return; }
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
      /* ★★ 2026-09 修(用户:"bird 都没碰到就死了"):飞行类掉到地面线 y<0 时,
         原版是【有地面就落上去滑行】,只有真的掉进坑里才死 —— 我们以前一律 die() ✗。
         实测(改前):ufo/ship/wave 贴地飘十几帧就死 ✓ 就是这个。 */
      if (this.y < 0) {
        const g = this.floors.find((f) => this.x + this.box > f.x0 && this.x < f.x1);
        if (g) { this.y = 0; this.vy = 0; this.onGround = true; }
        else { this.die(); return; }
      }
      if (this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'wave') {
      /* ★★ 2026-09 按 PlayerObject::update 的 Dart 分支修(用户贴的反编译):
             v31 = getCurrentXVelocity(a1) * a2;              // 本帧【水平位移】,不乘 0.9
             v33 = fabs(v31) * flipMod(a1);  v32 = m_jumpBuffered ? 1 : -1;  v34 = v33 * v32;
             if (m_vehicleSize != 1.0) v34 += v34;            // 迷你翻倍
         即:纵向位移 = ±水平位移(严格 45°),**不经过 y 轴那个 ×0.9**(以前我们走 sY ⇒ 斜率 42° ✗)。
         vy 这个字段仍旧记 ±vx(迷你/反重力时带上符号),这样别处读 vy 的语义不变 ✓ */
      /* ★★★ 2026-09 用户定位:"自由模式和 dart 组合导致的 bug" ✓✓ —— 完全正确:
         源码里波浪的纵向是 `v33 = fabs(v31) × flipMod` ⇒ 用【位移的绝对值】✓
         而我们写的是 `this.vx`(带符号 ✗)⇒ 自由移动往左走(freeDir=-1 ⇒ vx<0)时,
         纵向符号跟着翻 ✗;freeDir=0 时更是完全不动 ✗✓
         ⇒ 改成 Math.abs(vx) ✓(固定向前时两者等价,自由模式才正确 ✓) */
      this.vy = (hold ? 1 : -1) * Math.abs(this.vx) * this.gdir * (this.mini ? 2 : 1);
      this.y += this.vy * (sY / Y_TIME_SCALE);
      /* ★★ 2026-09 修(用户:"bird 都没碰到就死了"):飞行类掉到地面线 y<0 时,
         原版是【有地面就落上去滑行】,只有真的掉进坑里才死 —— 我们以前一律 die() ✗。
         实测(改前):ufo/ship/wave 贴地飘十几帧就死 ✓ 就是这个。 */
      if (this.y < 0) {
        const g = this.floors.find((f) => this.x + this.box > f.x0 && this.x < f.x1);
        if (g) { this.y = 0; this.vy = 0; this.onGround = true; }
        else { this.die(); return; }
      }
      if (this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'ufo') {
      /* UFO:照 OpenGD —— 点一下是【赋值】:newVel = flipMod × (迷你?8:7) × 体积;
         重力只有常重力的一半(上升 0.8 / 下落 1.2 再 ×0.5),所以飞着才跟手。 */
      const size = this.mini ? 0.85 : 1;
      if (hold && this.pressFresh) {
        this.pressFresh = false;
        this.pressAux = true;                  // 这一次按键仍然可以喂给跳环/冲刺箭头(见 pressAux 的说明)
        this.vy = this.gdir * (this.mini ? 8 : 7) * size;
      }
      const falling = this.vy * this.gdir < 0;
      this.vy -= P.gravity * this.gdir * (falling ? 0.8 : 1.2) * 0.5 / size * sY;
      this.vy = Math.max(P.flyDownMax / size, Math.min(P.flyUpMax / size, this.vy));
      this.y += this.vy * sY;
      /* ★★ 2026-09 修(用户:"bird 都没碰到就死了"):飞行类掉到地面线 y<0 时,
         原版是【有地面就落上去滑行】,只有真的掉进坑里才死 —— 我们以前一律 die() ✗。
         实测(改前):ufo/ship/wave 贴地飘十几帧就死 ✓ 就是这个。 */
      if (this.y < 0) {
        const g = this.floors.find((f) => this.x + this.box > f.x0 && this.x < f.x1);
        if (g) { this.y = 0; this.vy = 0; this.onGround = true; }
        else { this.die(); return; }
      }
      if (this.y + this.box > this.rows * U) { this.die(); return; }
    } else if (this.mode === 'ball') {
      /* 球:重力 ×0.6;★ 只有在【地面上】点一下才跳 —— 原版是
         "先按旧重力方向给起跳初速 → 翻重力(速度减半)→ 再 ×0.6"。
         以前我们写成"原地翻重力 + 当前速度 ×0.6",等于球不会跳(用户:形态性能要还原)。 */
      /* ★ 球:一次【按键】只翻一次重力 —— 用的是原版的"缓冲跳":按下的那一下记一个标记,
         落地时消费掉再翻重力。出处:gdp@2.11 updateJump 里球那一支明确写了
             yVelocityTmp = m_yVelocity;
             this->m_jumpBuffered = 0;        ← 翻完就把缓冲清掉
             this->m_yVelocity = yVelocityTmp * 0.6;
         所以【按住不放不会一直弹】:按住只会让它翻第一次(用户实测按住时"一直弹起落下鬼畜",
         就是这个 —— 我上一版为了让球不那么"铅球"改成"按住就翻",反而把这条弄丢了)。
         注意缓冲跳 ≠ 必须落地那一下按:空中按下的也算数(按下时标记,落地才消费)。 */
      const size = this.mini ? 0.8 : 1;
      if (hold && this.pressFresh && this.onGround) {
        this.pressFresh = false;
        this.vy = P.jump * size * this.gdir;    // 旧重力方向的起跳初速
        this.gdir = -this.gdir;                 // 翻重力
        this.vy *= this.flipMul;                // ★ 原版 flipGravity:m_yAccel *= 1.75
        this.vy *= P.ballFlipVelMul;            // ★ 再按球那一档 ×0.6(原版 updateJump)
        /* ★★★ 2026-09 球"一跳弹到 128 格"的根因:上面两个乘数每【落地翻转】一次就再乘一次,
           而终点速度的夹取在下面(918 行之后)⇒ 连续翻转会【复利式放大】(1.75^n)✗✓
           ⇒ 乘完立刻夹一次(源码的 max(-15, yAccel) 就是终端速度夹取 ✓),把复利掐断 ✓ */
        this.applyFallClamp();
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
        /* ★ 起跳初速按速度档查表(gdp master updateTimeMod.cpp:8-26 的 m_yStart)——
           以前固定用 11.1800318,在 0.7 档上差 5%(10.62)、1.1 档差 2%(11.42)。 */
        const power = this.mode === 'robot'
          ? jumpOf(this.speedIdx) * P.robotJumpMul : jumpOf(this.speedIdx);
        this.vy = power * this.gdir;
        this.onGround = false;
        this.pressFresh = false;
        if (this.mode === 'robot') this.floatT = 0;
      }
      if (this.mode === 'robot') {
        this.floatT += FRAME / 4;                       // 每次子步推进(4 步 = 一帧)
        const floating = hold && !this.onGround && this.floatT < P.robotFloat;
        /* ★ 机器人的重力倍率是 0.9 —— 出处 gdp master PlayerObject_updateJump.cpp:309-315:
             float_b = (isBall||isSpider||isSwing) ? 0.6 : (isRobot ? 0.9 : 1.0)
           ★ 而【基数】跟方块一样是逐档的 m_gravity —— master:112 写的是
             usedGravity = (isBall || isFlying() || isSpider) ? 0.9582 : m_gravity,
           机器人不在那个"固定 0.9582"的集合里,所以它吃速度档再 ×0.9。
           (gdp@2.11 的 :93 写的是 isCube ? gravity : 0.958199 —— 11 版把机器人也算成固定值。
            关卡是 2.2 的,按 master 走。) */
        if (!floating) this.vy -= cubeGravityOf(this.speedIdx) * P.robotGravityMul * this.gdir * sY;   // 浮着的时候重力被抵消
      } else {
        /* ★ 方块的重力也是【按速度档查表】的 m_gravity(updateTimeMod.cpp:8-26);
           其它形态(球/蜘蛛/飞船/UFO/波浪)用固定 0.958199 —— 见 constants 里那张表的注释。 */
        /* ★★ 2026-09 试过一次、已回退:按 updateJump.cpp:23-42 把这里改成
         `gravity × 0.4 × 1.2`(0.48×)并加"朝 gravity×2 收敛"——
         结果【一跳峰值 6.70 块】,而原作是 2.17 块(测试 `常量表:一跳峰值` 直接抓出来了 ✗)。
         结论:`updateJump` 里那个带 step/multiplier 的 `yAccel` 【不是】 m_yVelocity ——
         用户贴的 PlayerObject::update 里另有一个 `m_accelerationOrSpeed` 累加器,
         那套 0.4/1.2 的公式属于它;纵向速度走的是 addToYVelocity 那条路。
         ⇒ 在把这两条路的关系读清楚之前,这里保持原样(1.0×gravity,一跳 2.17 块吻合原作)。 */
      this.vy -= cubeGravityOf(this.speedIdx) * this.gdir * sY;
      }
      /* ★ 终端速度只夹【下落】方向(原作在 falling 分支里夹):
         所以黄弹簧的 16 能原样生效,峰值才有 4.45 块,而不是被夹到 3.9。
         ★ 而【弹簧/跳环刚推出去的那一段】连下落方向也不夹 —— 见 applyFallClamp。 */
      this.applyFallClamp();
      this.y += this.vy * sY;
    }

    /* ★★★ 2026-09 限高(限制框):照搬 PlayLayer::checkCollisions —— 位置推进【之后】、物件碰撞【之前】
       夹一次上下边(源码里 checkCollisions 也是每个子步跑一次 ✓) */
    this.applyAirLimit();

    /* --- 踩实体:顺着重力方向接住(正重力踩上面;反重力贴天花板与方块底面) ---
     * 方块 / 球 / 机器人 / 蜘蛛都走这段;飞机、UFO、波浪是"飞行类",碰到即死。 */
    if (this.mode !== 'ship' && this.mode !== 'ufo' && this.mode !== 'wave') {
      const boxTop = this.y + this.box, prevTop = prevY + this.box;
      let support: number | null = null;
      let supportBox: Box | null = null;
      /* ★ 同高时取【最靠左】的那块 —— 必须有个与列表顺序无关的判据:
         地面是几十块同高的方块拼起来的,以前"谁先被遍历到就算谁",而窗口裁剪后的
         nearSolids 列表顺序和完整列表不一样 → 落块吸附(用 supportBox 记"上次落的哪块")
         在裁剪模式和非裁剪模式下会分岔。踩过:搜索(裁剪)拼出来的输入卷,用完整物理回放
         只走到 270.1 块,而节点状态在 316.7 块 —— 存盘自检当场拦下。 */
      const better = (y: number, b: Box) => support === null || y > support
        || (Math.abs(y - support) < 1e-9 && supportBox !== null && b.x0 < supportBox.x0);
      if (this.gdir > 0) {
        for (const f of this.nearFloors) {
          if (this.x + this.box <= f.x0 || this.x >= f.x1) continue;
          if (prevY >= f.y1 - 0.01 && this.y <= f.y1 && better(f.y1, f)) { support = f.y1; supportBox = f; }
        }
        for (const b of this.nearSolids) {
          if (this.x + this.box <= b.x0 || this.x >= b.x1) continue;
          if (prevY >= b.y1 - 0.01 && this.y <= b.y1 && better(b.y1, b)) { support = b.y1; supportBox = b; }
        }
        if (support !== null && this.vy <= 0) {
          this.y = support; this.vy = 0; this.onGround = true;
          if (supportBox) this.checkSnapJumpToObject(supportBox.o);       // ★ 落块横向吸附
        } else this.onGround = false;

        // 掉出世界 = 死(坑)
        if (this.y < -2.5 * U) { this.die(); return; }
      } else {
        /* 反重力:只有【真的方块/平台底面】能贴住 —— ★ 关卡顶不是天花板(原版口径:
           反重力的人是往上"掉",撞到方块才停;一路飞出去就在关卡顶边界上判死)。
           以前我们把"关卡顶"当成实心天花板,反重力的人会直接吸在顶上(OpenGD 里顶是死区)。 */
        let sup: number | null = null;
        let supBox: Box | null = null;
        const betterUp = (y: number, b: Box) => sup === null || y < sup
          || (Math.abs(y - sup) < 1e-9 && supBox !== null && b.x0 < supBox.x0);      // 同上:同高取最靠左
        for (const f of this.nearFloors) {
          if (this.x + this.box <= f.x0 || this.x >= f.x1) continue;
          if (prevTop <= f.y0 + 0.01 && boxTop >= f.y0 && betterUp(f.y0, f)) { sup = f.y0; supBox = f; }
        }
        for (const b of this.nearSolids) {
          if (this.x + this.box <= b.x0 || this.x >= b.x1) continue;
          if (prevTop <= b.y0 + 0.01 && boxTop >= b.y0 && betterUp(b.y0, b)) { sup = b.y0; supBox = b; }
        }
        if (sup !== null && this.vy >= 0) {
          this.y = sup - this.box; this.vy = 0; this.onGround = true;
          if (supBox) this.checkSnapJumpToObject(supBox.o);               // ★ 反重力贴底也算落块
        } else this.onGround = false;
        if (this.y + this.box > this.rows * U + 2.5 * U) { this.die(); return; }
      }

      /* 实心方块:从侧面撞上就死(正重力时"落在顶面"、反重力时"贴住底面"都不算撞)
         ★ 可破坏砖块撞到是【碎掉】而不是死 —— 不实现它,玩家会直接撞死在这条铺面上。 */
      const inn = this.inner();
      for (const b of this.nearSolids) {
        if (this.traceSolid && b.o.kind === 'frame') {
          this.solidTrace.push('x-overlap y=' + (this.y / U).toFixed(3) + ' mode=' + this.mode
            + ' box y[' + (b.y0 / U).toFixed(3) + ',' + (b.y1 / U).toFixed(3) + ']'
            + ' innY[' + (inn.y0 / U).toFixed(3) + ',' + (inn.y1 / U).toFixed(3) + ']'
            + ' yOverlap=' + (inn.y1 > b.y0 && inn.y0 < b.y1));
        }
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
        /* ★ 原版落台容错有【两路】(PlayerObject::collidedWithObjectInternal):
             maxSnapY = playerBottom + snapUpThreshold;      ← 这一帧的位置
             floatG   = maxSnapY - adjustedYDelta;           ← 用【整帧位移】倒推回帧初的位置
             canSnap  = 两路任一越过物件顶面
           ★ 注意是【整帧】:GD 每帧只在 4 个子步之后判一次碰撞,m_lastPosition 记的是帧初位置。
             我们以前只看"当前子步的位置",高速下落时一帧就跨过容差、明明从顶面擦过去却判死 ——
             用户那个"第二个蓝跳点会弹到平台上、我们却卡死在平台里面"就死在这:
             蓝板把球往下压 19 单位(> 容差 15),但【帧初】脚底还在顶面附近,本该抬上去。 */
        const reachDown = Math.max(this.y, this.frameY0) + snapTol;              // 向下:取更高的那个脚底
        const reachUp = Math.min(this.y + this.box, this.frameY0 + this.box) - snapTol;   // 向上:取更低的那个头顶
        /* ★ 原版对这两种擦碰的处理是【不一样】的(PlayerObject::collidedWithObjectInternal):
             · 往下擦到砖【顶面】(canSnap):不分重力方向,一律把人放到顶面上站住
               —— 位置 = objRect 顶面,+ 保留一点原来的纵向速度;
             · 往上擦到砖【底面】:只有反重力时才贴到那个面上;正重力时什么也不做(擦过去)。
           所以下面第一支【不管 gdir】都抬上去,第二支才分方向。 */
        const clearTop = reachDown >= b.y1;               // 擦到砖顶面附近
        const clearBot = reachUp <= b.y0;                 // 擦到砖底面附近
        /* ★★ 飞行类(飞机/UFO/波浪):碰到实心就是死 —— 原版里"飞进砖里"必死(波浪段的墙就是靠这条)。
           ★ 以前这一整段写在 `if (mode !== ship/ufo/wave)` 的 guard 里,结果是飞行类【穿墙不死】:
             实测(2026-09,tools/fly-solid.ts):
               · 合成关卡里 UFO/飞机/波浪 从 y=6 落下,穿过 6 格厚实心,一路掉到世界底边 y<0 才死;
               · 真关卡里波浪从 x=540 一路穿过塔段那堵竖墙(x=546.97,y=0.5~6.5)飞到 x=552、y=14 还活着。
             容错口径仍按反编译:飞行类的 snapUpThreshold = gravityMult×6.0(6 单位 = 0.2 块),
             所以"擦着顶/底 6 单位以内"不算撞;超出就是撞死。 */
        /* ★ 临时定点用:把这一支的判断过程记下来(默认关;tools/probe-rod.ts / probe-fly-synth.ts 打它)。
            排查"UFO 穿过细杆 / 落不到台面上"时必须有这个 —— 光看帧末状态推不出走的是哪一支。
            ★ 2026-09:这一段以前排在飞行类分支【后面】,于是飞行类判死时 trace 是空的
            (上一轮就是这么白跑一遍的),现在挪到前面,并且把飞行类的结论也记进去。 */
        if (this.traceSolid) {
          this.solidTrace.push('sub y=' + (this.y / U).toFixed(3) + ' vy=' + (this.vy / U).toFixed(3)
            + ' mode=' + this.mode + ' box x[' + (b.x0 / U).toFixed(3) + ',' + (b.x1 / U).toFixed(3)
            + '] y[' + (b.y0 / U).toFixed(3) + ',' + (b.y1 / U).toFixed(3) + ']'
            + ' reachDown=' + (reachDown / U).toFixed(3) + ' clearTop=' + clearTop
            + ' reachUp=' + (reachUp / U).toFixed(3) + ' clearBot=' + clearBot
            + ' prevY=' + (prevY / U).toFixed(3) + ' gdir=' + this.gdir + ' fly=' + (this.flySolid && this.isFlyMode));
        }
        if (this.flySolid && this.isFlyMode) {
          /* ★★ 2026-09 修(用户:"UFO 不会踩上任何东西,碰到线框或者砖块直接穿过去"):
             原版里飞行类**可以踩在砖顶面上**贴着滑(贴着地面/平台飞是安全的),
             只有撞【侧面】和撞【底面】才死。我们以前是 `clearTop || clearBot → continue`:
             既不判死也不落地 ⇒ 人一路沉进砖里,下一帧内框已经不重叠 → 直接穿过去(合成场景实测:
             UFO/飞机从 y=8 落到顶面 y=4 的平台,都是"沉进去然后死",没有一次站住)。
             现在:擦到顶面就【落到顶面上】(和方块/球那一支同样的吸附),擦到底面才放行,其余判死。 */
          if (clearTop) { this.y = b.y1; this.vy = 0; this.onGround = true; continue; }
          if (clearBot) continue;
          this.die(); return;
        }
        if (this.vy <= 0 && clearTop) {
          this.y = b.y1; this.vy = 0; this.onGround = true;
          continue;                                      // 放到顶面站住(不判死)
        }
        if (this.vy >= 0 && clearBot) {
          if (this.gdir < 0) { this.y = b.y0 - this.box; this.vy = 0; this.onGround = true; }
          continue;                                      // 反重力贴底面;正重力擦过去
        }
        if (this.gdir > 0 && prevY >= b.y1 - 0.01 && this.y <= b.y1) continue;
        if (this.gdir < 0 && prevTop <= b.y0 + 0.01 && boxTop >= b.y0) continue;
        this.die(); return;
      }
    }

    /* ★★ 飞行类(飞机/UFO/波浪):碰到实心就是死 —— 原版里"飞进砖里"必死(波浪段的墙就是靠这条)。
       ★ 这一段必须写在上面 `if (mode !== 飞行类)` 那个 guard 的【外面】:以前整段实心判定都在里面,
         结果是飞行类【穿墙不死】。实测(2026-09,tools/fly-solid.ts):
           · 合成关卡:UFO/飞机/波浪 从 y=6 落下,穿过 6 格厚实心,一直掉到世界底边 y<0 才死;
           · 真关卡:波浪从 x=540 穿过塔段那堵竖墙(x=546.97,y=0.5~6.5),到 x=552、y=14 还活着。
       容错按反编译:飞行类 snapUpThreshold = gravityMult×6.0(6 单位 = 0.2 块)——
       "擦着顶/底 6 单位以内"不算撞,超出就是撞死。 */
    if (this.flySolid && this.isFlyMode) {
      /* ★★ 2026-09 修(用户:"UFO 不会踩上任何东西,碰到线框或者砖块直接穿过去"):两处都错了 ——
         ① 【要用外框判】出处 gdp master `PlayerObject::collidedWithObjectInternal`:
              `auto playerRect = getObjectRect();`,而 playerobject.cpp:86 写着
              `setTextureRect(Rect(0, 0, 30, 30)); // player hitbox lol`
              —— 玩家的实心判定盒就是 **30×30 外框**(7.5×7.5 那个内框是给尖刺这类"看着撞上却没死"用的)。
              以前这里用内框:检测晚 0.375 块,落地那一下永远赶不上吸附窗口。
         ② 【擦到顶面 = 落地】原版飞行类可以踩在砖顶上贴着滑(贴着地面/平台飞是安全的),
              只有撞侧面/底面才死。以前 `clearTop || clearBot → continue`:既不判死也不落地,
              于是人一路沉进砖里、下一帧外框/内框都不再重叠 → 直接穿过去。
         合成场景实测(tools/probe-fly-synth.ts,台面顶 y=4):修之前 UFO/飞机/波浪 全是"沉进去然后死",
         修之后三个形态都稳稳落在 y=4 上。 */
      const out = this.outer();
      const TOL = 6;
      for (const b of this.nearSolids) {
        if (out.x1 <= b.x0 || out.x0 >= b.x1 || out.y1 <= b.y0 || out.y0 >= b.y1) continue;
        const down = Math.max(this.y, this.frameY0) + TOL;
        const up = Math.min(this.y + this.box, this.frameY0 + this.box) - TOL;
        if (this.traceSolid) {
          this.solidTrace.push('fly y=' + (this.y / U).toFixed(3) + ' mode=' + this.mode
            + ' box y[' + (b.y0 / U).toFixed(3) + ',' + (b.y1 / U).toFixed(3) + ']'
            + ' down=' + (down / U).toFixed(3) + ' clearTop=' + (down >= b.y1)
            + ' up=' + (up / U).toFixed(3) + ' clearBot=' + (up <= b.y0));
        }
        if (down >= b.y1) { this.y = b.y1; this.vy = 0; this.onGround = true; continue; }
        if (up <= b.y0) continue;                                  // 擦着底面过去(6 单位容错)
        /* 可破坏砖块:飞行类撞上去也是【碎掉】而不是死(GD 里砖块对任何形态都是撞碎) */
        if (b.o.kind === 'breakable') { this.broken.add(b); continue; }
        this.die(); return;
      }
    }

    /* --- 尖刺:内框相交就死 ---
     * ★★ 2026-09 无敌模式关键修复(用户:"无敌模式永远莫名其妙会卡住"):
     *   以前是 `{ this.die(); return; }` —— 无敌时 die() 是空操作,可 return 照样执行 ✗
     *   ⇒ 一旦卡进刺里(无敌允许你进去),【每一帧】都命中这一支 ⇒ 帧逻辑全被跳过 ⇒ 一步也动不了 ✓✓
     *   现在:命中时若无敌就不进这一支 ⇒ 帧照常跑完(人会被推向别处,自己走出来)✓
     *   同样的问题存在于锯片(下面那段)与掉出世界(bounds)那几处 —— 逐处跟着改 ✓ */
    {
      const inn = this.hazBoxIsOuter ? this.outer() : this.inner();
      if (!this.god) {
        for (const hz of this.nearHazards) {
          if (inn.x1 > hz.x0 && inn.x0 < hz.x1 && inn.y1 > hz.y0 && inn.y0 < hz.y1) { this.die(); return; }
        }
      }
    }

    /* --- 锯片族(圆形判定):★ 用【外框】判 —— 出处 OpenGD playlayer.cpp:1494-1502
     *     `if (hazard->_radius > 0) playerOuterBounds.intersectsCircle(圆心, 半径)`
     *     圆心 = 物件中心,半径 = GD_HITBOX_RADIUS × 缩放(存的是它的外接方框,见 circles)。
     *     判定 = 圆心到【外框】的最近距离 < 半径。 */
    if (this.circles.length) {
      const out = this.outer();
      if (!this.god) for (const b of this.nearCircles) {
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = (b.x1 - b.x0) / 2;
        const dx = cx < out.x0 ? out.x0 - cx : (cx > out.x1 ? cx - out.x1 : 0);
        const dy = cy < out.y0 ? out.y0 - cy : (cy > out.y1 ? cy - out.y1 : 0);
        if (dx * dx + dy * dy < r * r) { this.die(); return; }
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
     * ★ 用【外框】判(原版 playerOuterBounds.intersectsRect)。
     * ★★ 蓝色重力跳点带【朝向】—— 出处 gdp@2.11 checkCollisions.cpp 的 kBlueBump 分支:
     *      if (player->isUpsideDown ^ !local_isPadUpsideDown(gameObj)) { …propellPlayer(0.8)…flipFravity… }
     *    也就是:正着装的板只对【正重力】的人生效,倒着装的(rot180)只对【反重力】的人生效;
     *    朝向不对时它【什么也不做,也不算被吃掉】。其它颜色的板没有这个条件(走的是 bumpPlayer)。
     *    我们以前不看朝向:反重力的人踩在地面板上会被"往下推"(板把他往自己那一侧的反方向打),
     *    倒装的板也会对着正重力的人乱开 —— 实测爬塔那一段(550/554/561/565/569 一串蓝板)
     *    前缀就是被这种"不该生效的板"打下去的。 */
    {
      const inn = this.outer();
      for (const b of this.nearPads) {
        if (this.armedPads.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        if (b.o.pad === 'blue') {
          const deg = (((b.o.rot ?? 0) % 360) + 360) % 360;
          const padUpsideDown = deg === 180;
          if ((this.gdir < 0) !== padUpsideDown) continue;   // 朝向不对:不生效、也不消耗
        }
        this.armedPads.add(b);
        /* 紫色地面跳点(3005):瞬移到头顶方块 + 翻重力 —— 射程同 tpReach(见 constants.ts) */
        if (b.o.tp) {
          /* 紫色地面跳点(3005):瞬移到头顶方块 + 翻重力 —— 射程同 tpReach(见 constants.ts)
             ★★ 2026-09 用户:"紫冲刺环不会反转重力" ⇒ 3005 同理,补上翻重力 + vy 归零 ✓ */
          this.spiderJump(P.tpReach, true);
          this.gdir = this.gdir === 1 ? -1 : 1;
          this.vy = 0;
        }
        else if (b.o.pad) this.applyTrigger({ ...PAD[b.o.pad], isPad: true });
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
    if (hold && (this.pressFresh || this.pressAux)) {
      const inn = this.outer();
      for (const b of this.nearArrows) {
        if (this.armedArrows.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.pressFresh = false; this.pressAux = false;
        if (b.o.tp) {
          /* 紫色(3004):瞬移到头顶那个方块 + 翻重力。★ 用 tpReach 而不是蜘蛛那套速度表 ——
             见 constants.ts 里 tpReach 的说明(用户实测"按了没反应"就是被那张表卡住的)。
             ★ 够不到面时【不消耗】这个箭头:这一次按键留在身上,人再飘几帧还会再试。 */
          this.spiderJump(P.tpReach, true);
          if (this.tpFailed) { this.pressFresh = true; this.pressAux = false; break; }
          /* ★★ 2026-09 用户:"紫冲刺环不会反转重力" —— 3004 的语义是【瞬移到头顶 + 翻重力】,
             我们以前只做了瞬移 ✗。这里补上翻重力,并把纵向速度清零(避免翻完立刻往回飞)。 */
          this.gdir = this.gdir === 1 ? -1 : 1;
          this.vy = 0;
        } else {
          this.dash = { ang: b.o.rot ?? 0, kind: b.o.arrow ?? 'green', t: 0 };
          /* ★★ 2026-09 冲刺箭头:粉色翻重力(用户口径"紫/粉色冲刺环不会反转重力")
             —— 以前限定了 mode==='cube' 才翻 ✗,现在【无条件翻】✓;
             紫色(3004)是【瞬移箭头】✓,走上面的 tp 分支,跟这条无关 ✓ */
          if (b.o.arrow === 'pink') this.gdir = -this.gdir;
        }
        this.armedArrows.add(b);
        break;
      }
    }

    /* --- 跳环:要一次【新的按键】才生效 —— 空中二段跳靠它,而"按住不放"串不起一串环(原作口径) ---
     * ★ 外框判(原版 playerOuterBounds)
     * ★★ 冲刺期间不生效 —— 出处 gdp@2.11 `ringJump.cpp:2`:
     *      `if (!isDead && hasQueuedHold && !isDashing && isHolding2) { … }`
     *    也就是 dash 状态下整个 ringJump 直接 return(环、冲刺环都不吃)。以前我们漏了这条:
     *    按住冲刺箭头飞过去时,沿途的环会被"顺手吃掉",落点全变。 */
    if (hold && (this.pressFresh || this.pressAux) && !this.dash) {
      const inn = this.outer();
      for (const b of this.nearOrbs) {
        if (this.armedOrbs.has(b)) continue;
        if (inn.x1 <= b.x0 || inn.x0 >= b.x1 || inn.y1 <= b.y0 || inn.y0 >= b.y1) continue;
        this.armedOrbs.add(b);
        this.pressFresh = false; this.pressAux = false;
        if (b.o.orb) {
          /* ★ 用分形态的力度(原版 ringJump 的倍率表),别再用"方块那一档"套所有形态 */
          /* ★★ 2026-09:冲刺环(141/1022)走原版的 startDashing —— 进入 dash 状态,
             不是"给一个纵向速度" ✗(用户:"绿色/粉色冲刺环,垂直方向的冲刺明显不对")。
             粉色按原版 kPinkDashRing:先翻重力 ✓。方向:有 rot 用 rot ✓;
             无 rot(这一关五个环都没有 ✓)时按【行进方向】—— 平地上就是水平 ✓,
             所以这里取 0°(arrowDir 的水平方向)✓。 */
          const spec = ORB[b.o.orb];
          if (b.o.dash) {
            if (b.o.dash === 'pink') this.gdir = (this.gdir === 1 ? -1 : 1);
            this.dash = { ang: b.o.rot ?? 0, kind: b.o.dash, t: 0 };
          } else {
            this.applyTrigger({ v: this.orbVel(b.o.orb), flip: spec.flip }, true);
          }
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
      /* ★★★ 2026-09 限制框(见 applyAirLimit):【进门这一刻的高度】就是这一屏的中心,
         之后人被夹在这一屏里 ⇒ 这就是"固定高度区间"的锁 ✓ */
      this.portalY = this.y;
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
         连吃两个同样的门不该把人翻回去,所以这里按 gdir 直接设,没有 gdir 才退回"翻转"。
         ★ 速度不清零,而是【减半】:重力门只是调 flipGravity(出处 gdp@2.11
           checkCollisions.cpp:194/204),倍率见文件头 FLIP_VEL_MUL(默认 ÷2);
           而且 flipGravity.cpp:2 是 `if (m_upsideDown != upsideDown)` —— 方向没变就什么都不做。
         以前我们写的是 `vy = 0`:进门那一刻纵向动量被抹掉,过门后的抛物线整个不对
         (进门时正在下落的话,原版会带着减半后的动量继续往下走,我们却从静止开始)。 */
      const want = b.o.gdir ?? -this.gdir;
      if (want !== this.gdir) {
        this.gdir = want;
        this.vy *= this.flipMul;
        this.onGround = false;
      }
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
    for (const b of this.clones) {
      if (this.armedClones.has(b)) continue;
      if (!this.hitEvent(b, prevX)) continue;
      this.armedClones.add(b);
      /* 收双人的是 287(克隆回收门)。★ 用【物件 id】判:Spec 上的 dualOff 没被搬进物件
         (level.ts 只白名单搬字段),而 id 是搬进来的(实测 x=516 那个 id=287 ✓) */
      if (b.o.id === 287 || b.o.dualOff) { this.dual = false; this.p2 = null; continue; }
      /* 286 = 开双人:玩家 2 在【进门那一点】生成(门洞 86 单位高,从任意高度进都行)✓ */
      if (!this.dual) { this.dual = true; this.p2 = this.takeState(); }
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
      /* ★★ 2026-09 用户:"复活点是从那个点开始,不是它的上面开始"。
         以前记的是【人跨过它时的 y】(this.y)⇒ 复活落在存档点上方一截 ✗。
         现在记【存档点自己那个点】:x 用它的 x0,y 用它的格子中心(y = r+0.5 格)再减去半个玩家高
         —— 这样复活时人的【脚底】正好落在存档点那一点上 ✓
         (注意不要用 b.y0:存档点的判定盒比一格高,盒底会比那个点低 10 格以上 ✗) */
      this.checkY = ((b.o.r ?? 0) + 0.5) * U - this.box / 2;
      this.checkMode = this.mode; this.checkSize = this.sizeMul;
      this.checkSpeed = this.speedIdx; this.checkGdir = this.gdir;   // ★ 速度档 + 重力方向一起存档
    }

    if (this.x >= this.level.length * U) { this.done = true; }
    /* ★★★ 2026-09 用户:"还是会被吸住无法跳起" —— 夹取的 hitGround 在这里补回去:
       它必须排在【踩实体扫描之后】(扫描会把 onGround 清掉,因为框面底下没有实体 ✗)✓ */
    this.reassertAirGround();
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

  private spiderJump(reachArg?: number, consumeOnFail = false) {
    const reach = reachArg ?? this.spiderReach();
    const top = () => this.y + this.box;
    /* ★ 横向用【整 1 格的外框】判 —— 上上版我按"碰撞箱太大、跨过一格"那句收窄成内框(7.5 单位),
       结果蜘蛛在蜘蛛段根本抓不住那些【一格宽】的线框平台了
       (用户:"原版一格宽的线框变成小于一格了" —— 说的就是这个)。
       原版口径:物体碰撞用的是 getObjectRect()(gdp@2.11 PlayLayer/checkCollisions.cpp:
       `playerTouchesObject(playerRect, loopObject->getObjectRect())`),线框物件的 sprite 是整格大小,
       所以它一格宽的顶面本来就该按一格算。改回外框。 */
    const hx0 = this.x, hx1 = this.x + this.box;
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
      if (best === null) { if (!consumeOnFail) this.tpFailed = true; return; }   // 够不到 → 不传送、不翻重力
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
      if (best === null) { if (!consumeOnFail) this.tpFailed = true; return; }
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
    /* ★★ 2026-09 用户口径:"把形态门、速度门、反转门等改成只要到达这一 x 位置就触发"。
       四类【门】(形态/重力/速度/尺寸)一律按"越过它的 x"判,不看高度 —— 和自铺面那套口径一致。
       为什么:这张图的玩家轨迹经常从门的上/下方擦过去(实测 x=768.5 那两扇门挂在 y=20,
       而卷子在地面 y≈0.2 跑),按"判定盒相交"判就永远不生效,分站驱动在那一站卡了一个多小时。
       其它事件物件(存档点/传送门/触发器)保持"必须碰到" —— 用户没提,而且它们本来就带位置语义。
       `doorByX` 是开关(构造函数 opts 可关,留着做 A/B)。 */
    if (this.doorByX && DOOR_KINDS.has(b.o.kind)) return !(prevX + this.box <= b.x0 || this.x >= b.x1);
    if (!this.strict) return !(prevX + this.box <= b.x0 || this.x >= b.x1);
    const u = this.outer();
    return u.x1 > b.x0 && u.x0 < b.x1 && u.y1 > b.y0 && u.y0 < b.y1;
  }

  /** ★ 无敌模式(测试用,页面按 G 切):不判死,撞到刺/侧面也照常穿过去。
   *  die() 直接返回,而调用点后面都是 `return` —— 于是那一帧的后续结算跳过,人继续往前走。
   *  掉出世界(坑)也死不了,所以下面加了一条兜底:掉到地面线以下就放回地面,免得一直往下掉。 */
  god = false;
  /** ★★ 2026-09 演示铺的【自由移动】模式(用户:"demo 做成自由移动,不再固定往前")——
   *  为 true 时:横向速度不再取自速度档,而是由 freeDir 决定(−1 左 / 0 停 / +1 右)✓
   *  页面侧只需要在每帧前设 freeDir(←/→ 或 A/D),并让相机双向跟随 ✓ */
  freeMove = false;
  freeDir = 0;

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
  private applyTrigger(spec: { v: number; flip: 'none' | 'before' | 'after' | 'dash'; isPad?: boolean }, consumePress = false) {
    const isPad = !!spec.isPad;
    let v = spec.v * this.triggerScale() * this.padMul;   // 迷你 ×0.8;padMul 是页面上的力度微调
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
    /* ★★ 球/蜘蛛的 0.6 折扣【只给弹簧】,不给跳环 —— 这是两条不同的代码路径:
         · 弹簧 `PlayerObject::propellPlayer`(gdp@2.11 `propellPlayer.cpp:8-10`):
             m_yAccel = 16×力度×重力方向×(迷你?0.8:1.0),然后 `if (isBall||isSpider) *= 0.6`
         · 跳环 `PlayerObject::ringJump`(gdp@2.11 `ringJump.cpp:115-130`):迷你的 0.8 一样有,
           但球/蜘蛛的折扣是 ×0.7(不是 0.6),而且是在分颜色倍率【之后】才乘。
       以前我们把 0.6 写在 applyTrigger 里 —— 于是球吃一次环要连挨 0.7 和 0.6 两刀(0.42),
       比原版小 40%。现在 0.6 只留在弹簧那条调用上(`isPad`)。 */
    if (isPad && (this.mode === 'ball' || this.mode === 'spider')) v *= 0.6;
    if (spec.flip === 'before') {
      this.vy = v * this.gdir;                    // 按【旧】重力方向给速度
      this.gdir = -this.gdir;                     // 然后才翻重力
      /* ★ 翻重力那一下把纵向速度【除以 2】(默认 0.5,理由见文件头 FLIP_VEL_MUL 的三条)。
         所以蓝板/蓝环是"先按旧重力方向给 12.8,再翻重力并减半" = 6.4。
         顺序也对得上两条路:
           · 蓝板 checkCollisions.cpp:239-240 = propellPlayer(0.8) 之后才 flipFravity → 先赋值再翻;
           · 蓝环 ringJump.cpp:117→132 = 先赋值 yAccel,最后才 kBlueRing 的 flipGravity。
         以前这里【故意不乘】,理由是"用户嫌蓝板力度太大" —— 但那是把 12.8 当成了全部;
         真正缺的是这一步:减半之后是 6.4,而不是 22.4。
         (OpenGD 的 playerobject.cpp:540 写的是 m_dYVel /= 2.f —— 两版源码在这一条上冲突,
          我们改取 OpenGD 的减半口径(关卡 A/B 实测:22.4 让 714~727 那段无解)。) */
      this.vy *= this.flipMul;
    } else if (spec.flip === 'after') {
      this.gdir = -this.gdir;                     // 先翻重力
      this.vy = v * this.gdir;                    // 再按【新】重力方向给速度
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
   *    用户说的"性能不对"里有一部分就是这里。表里的倍率是 × 起跳初速(jumpPower)。
   *  ★★ 两张源在【船的粉环】上冲突,已交叉核对过:
   *     · gdp@2.11 `ringJump.cpp:84-93` 写的是 `if (isShip) new_y_accel *= 1.37`
   *     · OpenGD `playerobject.cpp:476-491` 写的是 `case PlayerGamemodeShip: newYVel *= 0.37f`
   *     其余每一项(粉的 UFO 0.42 / 球 0.77 / 默认 0.72、红的船 1.4(迷你)/鸟 1.02/1.36、
   *     绿的船 0.7、黄 ×0.9(机器人)、蓝 0.8)两边完全一致。按"粉环 = 小跳"的语义取 OpenGD 的
   *     0.37(1.37 会让船的粉环比红环还猛,而且原版船的纵速上限只有 shipVyMax,
   *     1.37 会被钳成同一个值,分不出粉/红两档 —— 与实际手感不符)。
   *     ★ 本条只影响"船段里的粉环";本关(WATER)的 127 个环**没有一个在飞行形态段里**
   *       (统计:cube 121 / 机器人 5 / 球 1),所以这个取值对本关的通关卷没有任何影响。 */
  private orbVel(kind: OrbKind): number {
    const J = P.jump;
    const mini = this.mini;
    /* ★ 球 / 蜘蛛的跳环再打 7 折 —— 出处 gdp@2.11 ringJump.cpp:127-130
       `if (isBall || isSpider) { yAccel *= 0.7; isHolding = false; }`
       (OpenGD playerobject.cpp:522-526 同款)。注意它【只管普通环】:
       黑(冲刺)环走的是另一条分支(ringJump.cpp:32-58),不乘 0.7。 */
    const bs = (this.mode === 'ball' || this.mode === 'spider') ? 0.7 : 1;
    switch (kind) {
      case 'pink':
        return J * (this.mode === 'ship' ? 0.37 : this.mode === 'ufo' ? 0.42 : this.mode === 'ball' ? 0.77 : 0.72) * bs;
      case 'red':
        /* ★ 船的【迷你】红环是 ×1.4 而不是 ×1.0 —— 出处两边一致:
           gdp@2.11 `ringJump.cpp:66-68` / OpenGD `playerobject.cpp:455-457`
           `if (vehicleSize != 1.0f) newYVel *= 1.4;`(之后再乘迷你的 0.8)。 */
        return J * (this.mode === 'ship' ? (mini ? 1.4 : 1.0)
          : this.mode === 'ufo' ? (mini ? 1.36 : 1.02)
            : (this.mode === 'ball' || this.mode === 'spider') ? 1.34
              : this.mode === 'robot' ? 1.28 : 1.38) * bs;
      case 'yellow':
        return J * (this.mode === 'robot' ? 0.9 : 1.0) * bs;
      case 'green':
        return J * (this.mode === 'ship' ? 0.7 : 1.0) * bs;
      case 'blue':
        return J * 0.8 * bs;                              // 重力环:固定 ×0.8,不随形态(球/蜘蛛再 ×0.7)
      case 'black':                                       // 冲刺(黑)环:按形态给绝对值,不吃那 7 折
        return this.mode === 'ufo' ? 11.2
          : (this.mode === 'ship' || this.mode === 'wave') ? 14
            : this.mode === 'spider' ? 16.5 : 15;
      default:
        return J * bs;
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
  if (w.isFlyMode) {
    /* ★ 飞行类(飞机/UFO/波浪)统一走这一条:目标 =【前方 2.5 块处那一列】最大空隙的中心。
       ★ 2026-09 扩了两点:
         · 以前只有 ship 有这条规则,UFO/波浪会掉到方块那套"看到危险就跳"里 —— 对飞行类毫无意义;
         · 障碍从"只数实心"扩到【实心 + 刺 + 圆锯】:飞行类碰到实心现在会死(见实心判定那一段),
           光看实心会一头撞进刺里。 */
    const probeX = w.x + 2.5 * BL;
    const blocks = [...w.nearSolids, ...w.nearHazards, ...w.nearCircles]
      .filter((b) => probeX >= b.x0 - 4 && probeX <= b.x1 + 4)
      .sort((a, b) => a.y0 - b.y0);
    let bestGap = { a: 0, b: w.rows * U, size: w.rows * U };
    let cursor = 0;
    for (const b of blocks) {
      if (b.y0 - cursor > bestGap.size) bestGap = { a: cursor, b: b.y0, size: b.y0 - cursor };
      cursor = Math.max(cursor, b.y1);
    }
    if (w.rows * U - cursor > bestGap.size) bestGap = { a: cursor, b: w.rows * U, size: w.rows * U - cursor };
    const target = (bestGap.a + bestGap.b) / 2 - w.box / 2;
    return w.y < target - 2;
  }
  /* 方块:两条判据都要按【内框】算,不能按外框 ——
     实测教训:按"前缘到远边"算会早跳约 0.8 块,弧线顶点落在障碍之前,落地时正好压在尖刺上。
     内框左缘在 x + innerOff 处,所以起跳后它能前进的距离 = 一跳跨度 − innerOff − 余量。
     ★ 跨距必须跟着【当前速度档】走:速度越快,同样的滞空时间跑得越远。
       老版本这里写死了常速的跨距,在 1.24 倍速那段就会早跳(level.ts 的图案几何也用同一条公式)。 */
  const span = arcSpan(jumpOf(w.speedIdx), w.speedIdx) * U;
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
  for (const o of [...w.nearHazards.filter((h) => h.y0 < 2 * U),
    ...w.nearCircles.filter((h) => h.y0 < 2 * U),
    ...w.nearSolids.filter((s) => s.y1 <= 2 * U)]) {
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
