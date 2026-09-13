/* 物理常量表 —— 全游戏唯一的"手感数字"来源。
 *
 * 单位约定(照 GD 的口径):1 个方块 = 30 单位,速度/加速度都按"每 1/60 秒一帧"的量给。
 * 我们的模拟用固定步长跑(见 world.ts),但把每个子步换算成"帧当量"再乘,
 * 这样表里的数字可以直接和原版/反编译口径对照。
 *
 * 出处标注:
 *   [GDOpenGD] = OpenGD 源码里的常量(本仓库评估文档 §3.2 有出处;OpenGD 是 GD 2.1 口径的反编译重写)
 *   [社区]     = 社区长期口径(数值与 OpenGD 里的 (xVel, 倍率) 比值一致),最终以试玩为准
 *   [自定]     = 本站为了"科技风关卡"自己定的,不是原作值
 */

export const U = 30;          // 一个方块 = 30 单位
export const ROWS = 10;       // 关卡高度 = 10 块(和本站旧版一致)

/* y 轴的时间尺度:原作 PlayerObject::update 用 dt 积分 x、用 dt×0.9 积分 y(和重力)。
   后果:滞空时间比"不乘 0.9"长约 11%,但峰值不变(v²/2g)——水平跨距因此变大。
   这条是 [GDOpenGD] 级别的反编译事实,少了它"跳多远"就会差一成。 */
export const Y_TIME_SCALE = 0.9;

export const P = {
  /* ---- 数值:方块 ---- */
  gravity: 0.958199024,       // [GDOpenGD] 单位/帧²
  jump: 11.1800318,           // [GDOpenGD] 起跳初速(单位/帧)
                              //   峰值 = jump²/(2·gravity) ≈ 65.2 单位 ≈ 2.17 块
                              //   —— 和原作"跳约两块"一致,这条同时是常量表的自检(见 test)
  vyMax: 15,                  // [GDOpenGD] 终端速度:★只夹【下落】方向,上升不夹
                              //   (所以黄弹簧的 16 能原样生效,峰值才有 4.45 块)
  xVel: 5.19300170,           // [GDOpenGD] 常速档的每帧位移 = 5.77000189 × 0.9
  /* 速度门的真实口径(★之前那版理解错了):门给的是"速度值 × 倍率",不是直接的每帧位移。
     x 速度 = speedVal[i] × speedMul[i] → 4.186 / 5.193 / 6.457 / 7.8 / 9.6 单位/帧,
     对应 8.37 / 10.39 / 12.91 / 15.6 / 19.2 块/秒。 */
  speedVal: [5.980002, 5.77000189, 5.870002, 6.000002, 6.000002],   // [GDOpenGD]
  speedMul: [0.7, 0.9, 1.1, 1.3, 1.6],                             // [GDOpenGD]

  /* ---- 数值:飞机(按住上升 / 松开下落)---- */
  shipAccelUp: 0.8,           // [GDOpenGD] 按住时的上升加速度(单位/帧²)
  shipAccelDown: -1.0,        // [GDOpenGD] 松开时的下落加速度
  shipAccelUpBoost: 1.2,      // [GDOpenGD] 长按后的额外上升
  shipBoostAfter: 0.4,        // [GDOpenGD] 长按多少帧后开始额外上升
  shipVyMax: 8.0,             // [GDOpenGD] 飞机速度上限(反编译里上 8 / 下 -6.4,这里先对称)
  shipRotMax: 0.55,           // [自定] 贴图最大倾角(弧度),科技风里用

  /* ---- 数值:其它形态(口径同 §docs/gd-physics-triggers.md)---- */
  ballGravityMul: 0.6,        // [GDOpenGD] 球(以及蜘蛛/摇摆)的重力倍率
  ballFlipVelMul: 0.6,        // [GDOpenGD] 球点一下:翻重力 + 垂直速度 ×0.6
  ufoImpulse: 7.0,            // [待核] UFO 点一下的上冲。反编译里没找到"离散冲量"那条路径
                              //   (只有 UFO 环的 ±7.0),这里按社区口径取 7.0
  flyUpMax: 8.0,              // [GDOpenGD] 飞行类(UFO)的上限
  flyDownMax: -6.4,           // [GDOpenGD] 飞行类的下坠上限
  robotJumpMul: 0.5,          // [GDOpenGD] 机器人起跳 = 0.5 × jumpPower ≈ 5.59
  robotFloat: 0.27,           // [GDOpenGD] 按住时"抵消自身的重力"能维持多久(秒)≈ m_accelerationOrSpeed 走满 1.5
  spiderVel: 1.0,             // [GDOpenGD] 蜘蛛传送落地后的那一小点速度(∓1 每帧)
  spiderBand: 8,              // [GDOpenGD] 蜘蛛搜索带的厚度 = m_vehicleSize × 8(块)

  /* ---- 数值:碰撞盒 ---- */
  box: 30,                    // [GDOpenGD] 玩家外框 30×30
  inner: 7.5,                 // [GDOpenGD] 判定用内框只有 7.5×7.5(所以"看着撞上却没死")
  innerOff: 11.25,            // [GDOpenGD] 内框相对外框左上角的偏移
  spikeHitScale: 0.68,        // [自定] 尖刺判定宽度缩放(原作尖刺判定比贴图窄,这里取一个偏宽容的值)

  /* ---- 数值:玩法节奏 ---- */
  minGapBlocks: 6.2,          // [自定] 老版"固定间距"铺面用的最小间距。
                              //   现在铺面按 onset 走,间距由【图案几何】决定(见 level.ts),
                              //   这条只剩"结构自检"的参考意义
  deadPause: 0.55,            // [自定] 死后停多久再弹死亡菜单(秒)
  lead: 3.0,                  // [自定] 开场留给玩家的准备时间(秒)
} as const;

/** 某个速度档下每帧的 x 位移(单位/帧) */
export function vxOf(speedIdx: number): number {
  return P.speedVal[speedIdx] * P.speedMul[speedIdx];
}

/* ---------------- 弹簧(跳板)与跳环 ----------------
 *
 * 结构:
 *   v    —— 触发后给的垂直初速(单位/帧)。★是【赋值】不是叠加(原作 setYVelocity)。
 *   flip —— 重力翻转的时机,这是蓝/绿两种东西的关键区别:
 *           'none'   不翻重力(黄/粉/红)
 *           'before' 先按【旧】重力方向给速度,再翻重力(蓝环/蓝板,反编译口径)
 *           'after'  先翻重力,再按【新】重力方向给速度(绿环)
 * 出处:GD 2.2081 的 IDA 反编译(PlayerObject::ringJump / bumpPlayer / propellPlayer /
 *      GJBaseGameLayer::getBumpMod),数值都是"赋值给 yVelocity 的绝对速度"。
 */
export type OrbKind = 'yellow' | 'pink' | 'red' | 'blue' | 'green' | 'black';
export type PadKind = 'yellow' | 'pink' | 'red' | 'blue' | 'purple';
export type FlipWhen = 'none' | 'before' | 'after' | 'dash';

export const ORB: Record<OrbKind, { v: number; flip: FlipWhen; note: string }> = {
  yellow: { v: 11.1800318, flip: 'none', note: '[GDOpenGD] = jumpPower,原版黄环就是"空中再来一跳"(×1.0)' },
  pink: { v: 8.0496, flip: 'none', note: '[GDOpenGD] ×0.72,小跳' },
  red: { v: 15.428, flip: 'none', note: '[GDOpenGD] ×1.38,大跳' },
  blue: { v: 8.9442, flip: 'before', note: '[GDOpenGD] ×0.8,按旧重力方向给速度后再翻重力' },
  green: { v: 11.1800318, flip: 'after', note: '[GDOpenGD] ×1.0,先翻重力再按新重力方向给速度' },
  black: { v: 15, flip: 'dash', note: '[GDOpenGD] 冲刺环:把速度设成 15 并【朝重力方向】砸下去(常重力下是 -15),不看 jumpPower' },
};

export const PAD: Record<PadKind, { v: number; flip: FlipWhen; note: string }> = {
  yellow: { v: 16.0, flip: 'none', note: '[GDOpenGD] 1.0×16,全场最高的一跳(峰值 4.45 块)' },
  pink: { v: 10.4, flip: 'none', note: '[GDOpenGD] 0.65×16 = 10.4' },
  red: { v: 20.0, flip: 'none', note: '[GDOpenGD] 1.25×16 = 20(峰值约 7 块)' },
  blue: { v: 12.8, flip: 'before', note: '[GDOpenGD] propell(0.8)=12.8,然后翻转重力' },
  purple: { v: 16.0, flip: 'before', note: '[待核] 2.2 里没有独立分支,先按 1.0×16 处理' },
};

/** 初速 v 的一次起跳(平地出发)的滞空时间(秒)。★上升不夹终端速度 */
export const airtimeOf = (v: number): number => (2 * v / (P.gravity * Y_TIME_SCALE)) / 60;

/** 初速 v 的一次起跳能跨多少块。速度档越高,同样的滞空时间跑得越远 */
export function arcSpan(v: number, speedIdx = 1): number {
  return airtimeOf(v) * (vxOf(speedIdx) * 60 / U);
}

/** 初速 v 的一次起跳峰值(块)。注意它和 y 的时间尺度无关 */
export function arcPeak(v: number): number {
  return v * v / (2 * P.gravity) / U;
}

/** 一跳能跨过多少块(常速档)—— 自动铺面与自检都用它 */
export const JUMP_SPAN_BLOCKS = arcSpan(P.jump, 1);
/** 一跳的滞空时间(秒) */
export const JUMP_AIRTIME_S = airtimeOf(P.jump);
