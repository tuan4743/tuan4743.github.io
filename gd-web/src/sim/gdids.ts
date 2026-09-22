/* GD 存档里的物件 ID → 我们引擎的物件(第三张盘 WATER 那张铺面用的映射表)。
 *
 * 这张表不是"凭记忆写死"的:每一条都对着用户真实的 CCLocalLevels.dat 校准过
 * (直方图 + 字段分布 + 几何对齐统计,见 docs/cd03-water-import.md)。
 * 校准出来的两条关键结论(错了整张图就散架):
 *
 *   ① 锚点是【物件包围盒的中心】:b = x/30 − w/2,r = y/30 − h/2。
 *      证据:id 83(3779 个)按这条换算之后,左边缘 3779/3779 都落在整数格线上;
 *      按"左下角"换算则一个都对不上。
 *   ② 每种 ID 有自己的【默认包围盒】。比如 662(线框平台)是 1×0.5、67(地面跳点)
 *      是 1×0.2、468(单边线框)是一条 1×0.05 的细杆 —— 用 1×1 去算,高度会整体偏 0.25 格。
 *
 * 尺寸以外的字段:
 *   6   = 旋转(度,顺时针为正)      → Obj.rot
 *   4/5 = 纵向/横向翻转              → Obj.flipY / Obj.flipX
 *   128/129 = scaleX / scaleY        → 乘进 w/h(锯片靠它变大小)
 *   155 = 图层(1..5 前景,8 背景)  → Obj.z
 *   24/57 = 分组(触发器用)          → Obj.groups
 *   21  = 颜色通道:只是配色,不参与判定(先丢)
 */

import type { Level, Mode, Obj, ObjKind, Segment } from './level.ts';
import type { OrbKind, PadKind } from './constants.ts';
import { U } from './constants.ts';

/** 单边线框(468)的杆厚(块)。GD 里线框是"细杆",不是整格 —— 按细杆做,蜘蛛才踩得对。 */
export const FRAME_THICK = 0.05;

/* ---------------- 原版判定盒表(照搬) ----------------
 * 出处:OpenGD `Source/LongData.cpp` 的 `GameObject::_pHitboxes`(按 ID 写死的表),
 * 值是【单位】(1 格 = 30 单位),格式 {w, h, x, y}。我们只取【宽高】,
 * 并且把盒子放在物件【中心】—— 原表里那对 (x,y) 是相对贴图锚点的偏移,
 * 口径依赖各家贴图,拿不准的就不猜(这一条已在文档里标注,等用户核对)。
 *
 * 为什么必须照搬:之前我按"贴图盒/整格/向外 0.5 格"猜,跳板宽了 5~7 倍、跳环大了近一倍、
 * 尖刺判高一倍 —— 弹簧与跳环一律【提前触发】,整条弧线的落点全错
 * (用户:"有些地方原本应该能过去,现在过不去")。 */
export const GD_HITBOX: {
  spike: Record<string, [number, number]>;     // 按刺的尺寸档(h)
  pad: Record<string, [number, number]>;       // 按颜色
  orb: [number, number];
  arrow: [number, number];
  saw: [number, number];
  coin: [number, number];
  portal: [number, number];
  gravity: [number, number];
  size: [number, number];
  speed: Record<number, [number, number]>;     // 按速度档
  teleport: [number, number];
  check: [number, number];
  block: [number, number];
} = {
  /* 尖刺:id 8 → h12 w6、39 → h5.6 w6、103 → h7.6 w4、392 → h4.8 w2.6
   * ★ 这里存的是 [宽, 高]。原表 LongData.cpp 的排法是 {高, 宽, x, y}(见下面 140 那条注释),
   *   所以"原表 id 8 = {12, 6}"对应的是【6 宽 12 高】—— 不要把它当成转置 bug"修"一遍:
   *   拿形状一对就明白 —— 门是 {86,34} 竖高的、跳板是 {6,25} 横扁的、刺是 {12,6} 竖高的。 */
  spike: { '1': [6, 12], '1.5': [12, 21], '0.5': [6, 5.6], '0.25': [4, 7.6], '0.0625': [2.6, 4.8] },
  /* 跳板:35 黄 h4 w25、67 蓝 h6 w25、140 粉 h5 w25、1332 红 h7 w29(都是"横着的薄板",不是竖条!)
   * ★ 140 的原始数据:LongData.cpp `{140, {5, 25, -12.5, -2.5}}`(结构体是 {h,c,w,x,y}) */
  pad: { yellow: [25, 4], blue: [25, 6], purple: [25, 5], red: [29, 7], pink: [25, 5] },
  /* 跳环与冲刺箭头:36/84/141/1022/1330 → 36×36;1704/1751 → 36×36 */
  orb: [36, 36],
  arrow: [36, 36],
  /* 锯片:★ 真正的判定不是矩形 —— 见下面的 GD_HITBOX_RADIUS(圆)。
     `_pHitboxes` 表里 1705 → 44×85、1706 → 60×60 是【贴图外框】,拿它当判定会偏高:
     本关 x=1053.5 那个 scale=1.52 的锯片,危险盒顶部 23.65 → 23.14(低 0.52 块),玩家中心门槛 23.78 → 23.64;真正的差别在"方块跳过这个坑"上:旧口径需要 10.0 帧净空而窗口只有 10.1 帧(差一点点就判死),新口径需要 16.1 帧、窗口 13.4 帧(留 2.7 帧余量)。 */
  saw: [44, 85],
  coin: [40, 40],
  /* 形态门 12/13/47/111/660/745/1331 → h86 w34(竖高的门) */
  portal: [34, 86],
  gravity: [25, 75],
  size: [31, 90],
  /* 速度门:200 → h44 w35、201 → 56×33、202 → 56×51、203 → 56×65、1334 → 56×69 */
  speed: { 0: [35, 44], 1: [33, 56], 2: [51, 56], 3: [65, 56], 4: [69, 56] },
  teleport: [25, 90],
  check: [30, 30],
  block: [30, 30],
};

/** 锯片的【基础判定盒】(单位,不乘缩放)。定点实验用:原版到底会不会把判定盒一起放大,
 *  缺直接证据 —— 见 world.ts 的 `sawUnscaled` 与 HANDOVER §13.15。
 *  ★ 注意:这条是【旧口径】。锯片真正的判定是圆,见 GD_HITBOX_RADIUS。 */
export const GD_SAW_BASE: [number, number] = [GD_HITBOX.saw[0], GD_HITBOX.saw[1]];

/* ★★ 圆形判定半径表 —— 出处 OpenGD `Source/LongData.cpp:461-466`
 *    `GameObject::_pHitboxRadius`(和 `_pHitboxes` 并列的第二张表),单位同上(1 块 = 30 单位)。
 *    圆表里的物件【不是】用矩形判定的:OpenGD `PlayLayer::update`(playlayer.cpp:1491-1503)写得很直白 ——
 *        if (hazard->_radius > 0)
 *            playerOuterBounds.intersectsCircle(hazard->getPosition() + Vec2(15,15), hazard->_radius) → 死
 *        else if (playerOuterBounds.intersectsRect(hazard->getOuterBounds()))                   → 死
 *    也就是:锯片族 = 【玩家外框(30×30) vs 圆心在物件中心、半径查表的圆】。
 *    我们以前拿 `_pHitboxes` 的矩形当判定,还把缩放乘上去 —— 圆表里的锯片全是"细高"矩形(85×44),
 *    缩放后竖直方向能有 4 块多,于是整关所有锯片都比原版【高一倍】,该过的门缝全被吃掉。
 *    例:1705 半径 32.3 单位 = 1.08 块(直径 2.15 块),而矩形盒是 2.83 块高。 */
export const GD_HITBOX_RADIUS: Record<number, number> = {
  88: 32.3, 89: 21.6, 98: 12, 183: 15.48, 184: 20.4, 185: 3, 186: 32.3, 187: 21.96, 188: 12.6,
  397: 28.9, 398: 17.6, 399: 12.9, 675: 32, 676: 17.68, 677: 12.48, 678: 30.4, 679: 18.72, 680: 10.8,
  740: 32.3, 741: 21.96, 742: 12.6, 918: 24, 1582: 4, 1583: 4, 1619: 25, 1620: 15,
  1701: 6, 1702: 6, 1703: 6, 1705: 32.3, 1706: 21.6, 1707: 12, 1708: 28.9, 1709: 17.6, 1710: 12.9,
  1734: 32, 1735: 17.68, 1736: 12.48,
};

/** 某个 ID 的圆形判定半径(单位);不是圆表物件就返回 null */
export function circleRadiusOf(id: number | undefined): number | null {
  if (id == null) return null;
  return GD_HITBOX_RADIUS[id] ?? null;
}

/** 判定盒的【锚点偏移】(单位;相对物件中心)。
 *  ★ 通式:`_pHitboxes` 里 420/435 条的 (x,y) 就是 (-w/2, -h/2),也就是【以物件中心为心】——
 *    本关用到的 45 个可查 ID 里 44 个都居中(`tools/hb-audit.ts` 直接按 .dat 的 ID 直方图核)。
 *  ★ 例外只有传送门 747:`{h:90, w:25, x:-0.5, y:-45}`(longdata.cpp:47)= 竖直居中、
 *    横向【右移 12 单位(0.4 块)】:盒子 x∈[-0.5, 24.5]。本关有 7 个 747。
 *    (审计文档里那三条"刺/跳板整体偏高 0.07~0.13 格"是把 (x,y) 当成了盒中心 —— 是误报。) */
export const GD_HITBOX_OFFSET: Record<string, [number, number]> = {
  teleport: [-0.5, -45],
};

/** ★ 刺的判定盒【按 ID】查(单位,[宽,高])—— 出处 `longdata.cpp` 的 `_pHitboxes`:
 *    id 8   {12,6,-3,-6}   → 6×12 单位(0.2×0.4 块)… 注意原表字段序是 {h,w,x,y}
 *    id 39  {5.6,6,-3,-2.8}→ 6×5.6
 *    id 103 {7.6,4,-2,-3.8}→ 4×7.6
 *    id 392 {4.8,2.6,-1.3,-2.4} → 2.6×4.8(那根"贴地矮刺")
 *  为什么要按 ID:以前是按 `o.h`(刺的高度)查字符串键,而铺面文本里的高度是**四舍五入到 3 位**的
 *  (0.0625 → 0.063),于是 id 392 那 17 根刺查不到表值 → 退回"物件自己的包围盒"= 1 格宽,
 *  判定比原版宽 11 倍。`tools/hitbox-coverage.ts` 就是把这 17 个揪出来的那张表。 */
export const GD_SPIKE_BY_ID: Record<number, [number, number]> = {
  8: [6, 12], 39: [6, 5.6], 103: [4, 7.6], 392: [2.6, 4.8],
};

/** 按刺的【高度】查表(合成关卡没有 ID 时的兜底)。
 *  ★ 要做最近邻匹配:铺面文本里的高度是四舍五入到 3 位的(0.0625 存成 0.063),
 *    以前用精确字符串键查 → 查不到 → 退回 1 格宽的包围盒(实测那 17 根刺判定宽了 11 倍)。 */
function spikeByHeight(h: number): [number, number] | null {
  let best: [number, number] | null = null, bd = Infinity;
  for (const [k, v] of Object.entries(GD_HITBOX.spike)) {
    const d = Math.abs(Number(k) - h);
    if (d < bd) { bd = d; best = v; }
  }
  return bd <= Math.max(0.02, h * 0.2) ? best : null;      // 差太远就别硬套
}

/** 取某个物件的原版判定盒(单位);表里没有的返回 null(调用方按原来的几何算) */
export function hitboxOf(o: Obj): [number, number] | null {
  switch (o.kind) {
    case 'spike': return (o.id != null ? GD_SPIKE_BY_ID[o.id] : undefined) ?? spikeByHeight(o.h);
    case 'pad': return GD_HITBOX.pad[o.pad ?? 'yellow'] ?? null;
    case 'orb': return GD_HITBOX.orb;
    case 'arrow': return GD_HITBOX.arrow;
    case 'saw': return null;                                      // 判定 = 自己的包围盒(见上面注释)
    case 'coin': return GD_HITBOX.coin;
    case 'portal': return GD_HITBOX.portal;
    case 'gravity': return GD_HITBOX.gravity;
    case 'size': return GD_HITBOX.size;
    case 'speed': return GD_HITBOX.speed[o.speed ?? 1] ?? null;
    case 'teleport': return GD_HITBOX.teleport;
    case 'check': return GD_HITBOX.check;
    /* ★ 线框族:判定盒 = 【物件自己的包围盒】,不要套 block 那张 30×30。
       原版 LongData 表给的值,正好就是每个成员的包围盒:
         468 / 475(edge,1×0.05)  → 30×1.5   ← 细杆
         469 / 470(corner/u,1×1)  → 30×30    ← 整格
         661(corner,0.5×0.5)      → 15×15
         662(box,1×0.5)           → 30×15
       以前这里返回 GD_HITBOX.block(=30×30),于是【细杆全变成了整格实心的隐形墙】:
       x=517 那一段"地面细杆 + 倒挂细杆"之间明明有一格的空当,却被判成只剩 1.5 单位,
       怎么都过不去(分站搜到 x=512.9 就再也推不动,死胡同 99 次都堆在那儿)。
       用户当初说的"原版一格宽的线框变成小于一格"针对的是【1×1 的 L/U 形】——
       那条按包围盒判也是整格 ✓ 两边都对。 */
    case 'frame': return null;
    case 'block': case 'breakable': return GD_HITBOX.block;
    default: return null;
  }
}

/** 线框的实心外框(块坐标)。
 *  468 单边:物件自己就是那根杆(横杆 1×0.05 / 竖杆 0.05×1),直接用它的包围盒;
 *  469 邻边(L)/ 470 三边(U):整格包围盒 + 旋转决定是哪几条边(顺时针:0 = 上,90 = 右);
 *  662 整框(box):整个包围盒就是一圈边框(1×0.5)。
 *  ★ 这只是【画法】:判定一律用物件自己的包围盒
 *    —— 原版 LongData 那张表就是这么给的(见 sim/world.ts 的 case 'frame')。 */
export function frameRects(o: Obj): Array<{ x0: number; x1: number; y0: number; y1: number }> {
  const X0 = o.b * U, X1 = (o.b + o.w) * U, Y0 = o.r * U, Y1 = (o.r + o.h) * U;
  if (!o.frame || o.frame === 'edge' || o.frame === 'box') return [{ x0: X0, x1: X1, y0: Y0, y1: Y1 }];
  const base = o.frame === 'corner' ? ['N', 'W'] : ['N', 'W', 'S'];
  const seq = ['N', 'E', 'S', 'W'];
  const k = ((Math.round((o.rot ?? 0) / 90) % 4) + 4) % 4;
  const t = FRAME_THICK * U;
  return base.map((e) => {
    const dir = seq[(seq.indexOf(e) + k) % 4];
    if (dir === 'N') return { x0: X0, x1: X1, y0: Y1 - t, y1: Y1 };
    if (dir === 'S') return { x0: X0, x1: X1, y0: Y0, y1: Y0 + t };
    if (dir === 'W') return { x0: X0, x1: X0 + t, y0: Y0, y1: Y1 };
    return { x0: X1 - t, x1: X1, y0: Y0, y1: Y1 };
  });
}

export interface Spec {
  kind: ObjKind;
  w?: number; h?: number;       // 默认包围盒(块),缺省 1×1;刺的 h 同时就是【刺的高度】
  scaled?: boolean;             // 128/129 是不是缩放(锯片这类)
  orb?: OrbKind; pad?: PadKind; to?: Mode; speed?: number; gdir?: 1 | -1;
  /** ★★ 冲刺环(用户口径:"绿色/粉色冲刺环"):这两个 id 原版走的是 startDashing ——
   *  进入 dash 状态(方向由 m_dashX/m_dashY 决定,之后每帧 纵向位移 = 水平位移 × m_dashY),
   *  【不是】给一个纵向速度 ✗。以前 141/1022 被当成普通跳环 ⇒ "冲刺大错特错" ✓。 */
  dash?: 'pink' | 'green';
  frame?: 'edge' | 'corner' | 'u' | 'box';
  arrow?: 'green' | 'pink' | 'purple';
  art?: number;                 // 装饰图号(绘制时按它挑画法)
  tp?: boolean;                 // 瞬移到头顶的那个方块 + 翻重力(3004 / 3005)
  inert?: boolean;              // 只标记、不生效(克隆门 286/287)
  mini?: boolean;               // 尺寸门:true = 缩小,false = 恢复
  exit?: boolean;               // 传送门:出口(橙)
  col?: number;                 // 显示色覆盖(用户说 141 是紫的,物理仍按粉色环)
  note: string;
}

/** 用户逐个在"展示所有物件"的关卡里确认过的对照表(57 种,覆盖 WATER 全部物件)。 */
export const GD_SPEC: Record<number, Spec> = {
  /* ---- 砖块 / 可破坏 ---- */
  83: { kind: 'block', note: '砖块(主力,3779 个)' },
  1: { kind: 'block', note: '基础方块(误放 2 个)' },
  143: { kind: 'breakable', note: '可破坏砖块(撞到即碎,不能当实心否则必死)' },

  /* ---- 线框:468 一条边 / 469 邻边 / 470 三边 / 662 平台 / 661 小方块 ---- */
  468: { kind: 'frame', frame: 'edge', note: '单边线框(细杆;rot 0=上边 90=右边 180=下边 270=左边)。原版表 468 = 30×1.5,和我们的包围盒一致' },
  469: { kind: 'frame', frame: 'corner', note: '邻边线框(L 形贴图;★ 原版表给的是【整格 30×30】,判定按整格实心)' },
  470: { kind: 'frame', frame: 'u', note: '三边线框(U 形贴图;★ 原版表同样是【整格 30×30】实心)' },
  /* 467/471/475 这关没用上,补进来只为"以后别的铺面用到时不静默丢"。
     467/471 原版是整格实心,用 'u' 是为了让包围盒真的是 1×1(画法差一条边,判定是对的) */
  467: { kind: 'frame', frame: 'u', note: '(未在本关出现)整格线框,原版表 30×30' },
  471: { kind: 'frame', frame: 'u', note: '(未在本关出现)整格线框,原版表 30×30' },
  475: { kind: 'frame', frame: 'edge', note: '(未在本关出现)单边线框,原版表 30×1.5' },
  /* 662 = 半格线框块(blockOutline_11):原版表给的外框是 30×15 = 1×0.5 格,而且它是【实心】的
     —— 不是"只踩顶面的单向平台"。我们上一版把它当 platform(单向)+画成 0.34 格厚的薄板,
     于是用户看到的是"四分之一砖",而且踩上去不算数、下半截还能穿过去。
     现在走 frame/box:判定 = 整个 1×0.5 的实心盒,画法 = 这个盒子的整圈线框。 */
  662: { kind: 'frame', frame: 'box', w: 1, h: 0.5, note: '半格线框块(1×0.5,实心)' },
  661: { kind: 'frame', frame: 'corner', w: 0.5, h: 0.5, note: '小线框方块(半格;原版表 15×15,判定按整块实心)' },

  /* ---- 尖刺:高度差就是"大/小刺" ---- */
  8: { kind: 'spike', note: '普通尖刺' },
  39: { kind: 'spike', h: 0.5, note: '矮刺(1/2)' },
  103: { kind: 'spike', h: 0.25, note: '小刺(1/4)' },
  392: { kind: 'spike', h: 0.0625, note: '迷你刺(1/16)' },

  /* ---- 锯片 ----
   * ★ 尺寸是【基础块 × 缩放(128/129)】,不是"缩放值本身"。原版 LongData 给 1705 的外框是
   *   44(宽)×85(高)单位 = 1.47×2.83 格 —— 我们以前把 spec.w/h 留空(默认 1 格)再乘缩放,
   *   于是 scale=1 的大锯片被画成 1×1 格、判定也只有 1×1:用户实测"锯片小了可能有三倍"。
   *   (本关 550 个锯片里 1705 有 550-8-2... 总之主力就是 1705。) */
  1704: { kind: 'saw', w: 36 / 30, h: 36 / 30, scaled: true, note: '小锯片(基础 1.2×1.2 格,再乘缩放)' },
  1705: { kind: 'saw', w: 44 / 30, h: 85 / 30, scaled: true, note: '大锯片(基础 1.47×2.83 格,再乘缩放;本关 550 个)' },
  1706: { kind: 'saw', w: 2, h: 2, scaled: true, note: '圆锯(基础 2×2 格,再乘缩放)' },

  /* ---- 跳环(空中要按一下)---- */
  36: { kind: 'orb', orb: 'yellow', note: '黄色跳环' },
  /* ★★ 2026-09 回退:141/1022 是【粉/绿跳环】,不是冲刺环 ✗ —— 我把 dash 标到了它们身上,
     结果铺面里 45 个跳环全变成冲刺 ✗(用户:"你为什么把跳环全改成了冲刺")。
     冲刺环要用它自己的 id(待确认后单独标),不能拿跳环的 id 顶 ✗。 */
  141: { kind: 'orb', orb: 'pink', col: 0xc6a0ff, note: '紫/粉色跳环(×0.72 小跳)' },
  1022: { kind: 'orb', orb: 'green', note: '绿色跳环(翻重力+跳)' },
  84: { kind: 'orb', orb: 'blue', note: '蓝色跳环(翻重力)' },
  1330: { kind: 'orb', orb: 'black', note: '黑色冲刺环' },

  /* ---- 地面跳点(碰到就生效)---- */
  67: { kind: 'pad', pad: 'blue', h: 0.2, note: '蓝色地面跳点' },
  35: { kind: 'pad', pad: 'yellow', h: 0.2, note: '黄色地面跳点' },
  140: { kind: 'pad', pad: 'pink', h: 0.2, note: '粉色地面跳点(小跳 —— 低走廊用)' },
  3005: { kind: 'pad', pad: 'purple', h: 0.2, tp: true, note: '紫色地面跳点(瞬移到头顶方块 + 翻重力)' },

  /* ---- 冲刺箭头(长按)---- */
  1704: { kind: 'arrow', arrow: 'green', note: '绿色冲刺箭头(长按给冲量,不改重力)' },
  1751: { kind: 'arrow', arrow: 'pink', note: '粉色冲刺箭头(长按 + 翻重力)' },
  3004: { kind: 'arrow', arrow: 'purple', tp: true, note: '紫色上跳箭头(瞬移到头顶方块 + 翻重力)' },

  /* ---- 形态门 / 重力门 / 尺寸门 / 速度门 ---- */
  12: { kind: 'portal', to: 'cube', note: '方块形态门' },
  13: { kind: 'portal', to: 'ship', note: '飞机形态门' },
  47: { kind: 'portal', to: 'ball', note: '球形态门' },
  111: { kind: 'portal', to: 'ufo', note: 'UFO 形态门' },
  660: { kind: 'portal', to: 'wave', note: '波浪形态门' },
  745: { kind: 'portal', to: 'robot', note: '机器人形态门' },
  1331: { kind: 'portal', to: 'spider', note: '蜘蛛形态门' },
  10: { kind: 'gravity', gdir: 1, note: '重力门(向下 = 常重力)' },
  11: { kind: 'gravity', gdir: -1, note: '重力门(向上 = 反重力)' },
  99: { kind: 'size', mini: false, note: '恢复大小门' },
  101: { kind: 'size', mini: true, note: '缩小门' },
  200: { kind: 'speed', speed: 0, note: '速度门(降档)' },
  201: { kind: 'speed', speed: 1, note: '速度门(一档)' },
  202: { kind: 'speed', speed: 2, note: '速度门(二档)' },
  203: { kind: 'speed', speed: 3, note: '速度门(三档)' },
  1334: { kind: 'speed', speed: 4, note: '速度门(四档)' },

  /* ---- 传送 / 克隆 / 存档 / 硬币 ---- */
  747: { kind: 'teleport', note: '传送门入口(蓝)。原版要配 748 出口;这关只有入口 → 不生效(见文档)' },
  748: { kind: 'teleport', exit: true, note: '传送门出口(橙)' },
  286: { kind: 'clone', inert: true, note: '克隆门(先只标记,不做克隆)' },
  287: { kind: 'clone', inert: true, note: '克隆回收门(先只标记)' },
  2063: { kind: 'check', note: '存档点' },
  1329: { kind: 'coin', note: '硬币(收集)' },

  /* ---- 装饰(只画,不判定)---- */
  3638: { kind: 'deco', art: 3638, note: '黑色背景块(用户拿它做"画面逐渐清晰"的遮罩)' },
  3810: { kind: 'deco', art: 3810, note: '感叹号' },
  3812: { kind: 'deco', art: 3812, note: '箭头' },
  3823: { kind: 'deco', art: 3823, note: '笑脸' },
  3818: { kind: 'deco', art: 3818, note: '叉' },
  3848: { kind: 'deco', art: 3848, note: '点赞' },
  41: { kind: 'deco', art: 41, note: '锁链' },
  106: { kind: 'deco', art: 106, note: '锁链(长)' },

  /* ---- 出生点 / 无用占位 ---- */
  /* ★ 31 = 起点标记(Start Pos)。用户确认:出生点就摆在这个物件的位置(那关是 x=0.5 y=10.5 →
     左边缘 0、脚底 10 格,站在第一段铺面的【上一层】上面)。它不是游戏物件,不进 objects,
     由 dat-to-chart.ts 提出来写进 Level.start。 */
  1007: { kind: 'deco', art: 1007, inert: true, note: '不明占位(1 个)' },
};

/** 起点标记(Start Pos)的 ID —— 只用来定出生点,不生成物件 */
export const START_ID = 31;

/** 记录:一行物件字符串 → 字段表(键值交替,GD 的老格式) */
export function fieldsOf(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const f = line.split(',');
  for (let i = 0; i + 1 < f.length; i += 2) out[f[i]] = f[i + 1];
  return out;
}

const num = (s: string | undefined, dflt = 0) => (s == null || s === '' ? dflt : Number(s));
const ints = (s: string | undefined): number[] =>
  s == null || s === '' ? [] : s.split('.').map((v) => Number(v)).filter((v) => isFinite(v));

/** 一行物件 → 我们的 Obj(不认识的 ID 返回 null,调用方负责统计) */export function mapRecord(f: Record<string, string>): Obj | null {
  const id = Math.round(num(f['1'], -1));
  const spec = GD_SPEC[id];
  if (!spec) return null;

  const x = num(f['2']) / 30, y = num(f['3']) / 30;
  const rot = num(f['6'], 0);
  const flipX = f['5'] === '1';
  const flipY = f['4'] === '1';
  const z = num(f['155'], 1);

  /* 尺寸:默认包围盒 × 缩放;468 单边线框按旋转决定是"横杆"还是"竖杆" */
  let w = (spec.w ?? 1) * (spec.scaled ? num(f['128'], 1) : 1);
  let h = (spec.h ?? 1) * (spec.scaled ? num(f['129'], 1) : 1);
  if (spec.frame === 'edge') {
    const vertical = Math.abs(((rot % 180) + 180) % 180 - 90) < 1;      // 90 / 270 = 竖杆
    if (vertical) { w = FRAME_THICK; h = 1; } else { w = 1; h = FRAME_THICK; }
  }

  const o: Obj = {
    kind: spec.kind,
    b: x - w / 2,
    r: y - h / 2,
    w, h,
    id,
  };
  /* ★ 圆表物件(锯片族):判定是圆,半径查 `_pHitboxRadius`,圆心 = 物件中心。
     缩放这一层原版没有直接证据(OpenGD 的 `_radius` 不乘缩放),所以两个值都留着:
     默认按缩放(和贴图一致),`--sawbase=1` 走不缩放(OpenGD 原样)。 */
  const rr = GD_HITBOX_RADIUS[id];
  if (rr != null) {
    const sx = num(f['128'], 1), sy = num(f['129'], 1);
    o.rad0 = rr;
    o.rad = rr * (Math.abs(sx) + Math.abs(sy)) / 2;
  }
  if (spec.orb) o.orb = spec.orb;
  if (spec.dash) o.dash = spec.dash;        // ★ 冲刺环(141/1022):以前这一行漏了
                                            //   ⇒ 对象身上没有 dash ⇒ 编码器也写不出 dash=
                                            //   ⇒ 引擎永远走不到 dash 分支(用户:"冲刺大错特错")
  if (spec.pad) o.pad = spec.pad;
  if (spec.exit) o.exit = true;
  if (spec.to) o.to = spec.to;
  if (spec.speed != null) o.speed = spec.speed;
  if (spec.gdir != null) o.gdir = spec.gdir;
  if (spec.frame) o.frame = spec.frame;
  if (spec.arrow) o.arrow = spec.arrow;
  if (spec.art != null) o.art = spec.art;
  if (spec.tp) o.tp = true;
  if (spec.inert) o.inert = true;
  if (spec.col != null) o.col = spec.col;
  if (spec.mini != null) o.mini = spec.mini;
  /* ★ 传送门(747)自带的纵向偏移:键 54。用户口径:"出口就在传送门纵向方向上的某个位置,
     偏移量是传送门自己的一个参数" —— 所以不用另放一个橙色出口物件。 */
  if (spec.kind === 'teleport') {
    const off = num(f['54'], 0);
    if (off) o.tpy = off / 30;
  }
  if (rot) o.rot = rot;
  if (flipX) o.flipX = true;
  if (flipY) o.flipY = true;
  if (z && z !== 1) o.z = z;
  const gs = ints(f['57']);
  if (gs.length) o.groups = gs;
  return o;
}

/* ---------------- 铺面文本:一行一个物件,默认值省略 ----------------
 * 8980 个物体要是写成对象字面量,光文件就 500 KB;写成这种紧凑文本大约 90 KB。
 * 格式: code b r [w] [h] [key=value …]   (w/h 缺省 = 1)
 * 例:   B 686 26            → 砖块 b=686 r=26 w=1 h=1
 *       S 203 0 1 1 rot=180 → 尖刺(头顶倒挂的)
 *       O 218 1 orb=yellow
 */
const CODE: Record<string, ObjKind> = {
  B: 'block', S: 'spike', W: 'saw', P: 'platform', C: 'check', R: 'portal', V: 'speed',
  G: 'gravity', O: 'orb', D: 'pad', Y: 'force', T: 'teleport', Z: 'size', X: 'breakable',
  N: 'coin', A: 'arrow', E: 'deco', K: 'clone', H: 'frame',
};
const CODE_BACK: Record<string, string> = {
  block: 'B', spike: 'S', saw: 'W', platform: 'P', check: 'C', portal: 'R', speed: 'V',
  gravity: 'G', orb: 'O', pad: 'D', force: 'Y', teleport: 'T', size: 'Z', breakable: 'X',
  coin: 'N', arrow: 'A', deco: 'E', clone: 'K', frame: 'H',
};

/** 数字最短写法:686.500 → 686.5、0.050 → 0.05、2.000 → 2 */
const n = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000));

export function encodeObjects(objs: Obj[]): string {
  const lines: string[] = [];
  for (const o of objs) {
    const code = CODE_BACK[o.kind];
    if (!code) continue;
    const f: string[] = [code, n(o.b), n(o.r)];
    if (o.w !== 1 || o.h !== 1) { f.push(n(o.w), n(o.h)); }
    const ex: string[] = [];
    if (o.to) ex.push('to=' + o.to);
    if (o.orb) ex.push('orb=' + o.orb);
    if (o.dash) ex.push('dash=' + o.dash);          // ★ 冲刺环(141/1022):让铺面带上这个字段
    if (o.pad) ex.push('pad=' + o.pad);
    if (o.speed != null) ex.push('spd=' + o.speed);
    if (o.gdir != null) ex.push('gd=' + o.gdir);
    if (o.sh != null) ex.push('sh=' + n(o.sh));
    if (o.rot) ex.push('rot=' + n(o.rot));
    if (o.flipX) ex.push('fx=1');
    if (o.flipY) ex.push('fy=1');
    if (o.frame) ex.push('fm=' + o.frame);
    if (o.arrow) ex.push('ar=' + o.arrow);
    if (o.art != null) ex.push('art=' + o.art);
    if (o.tp) ex.push('tp=1');
    if (o.inert) ex.push('inert=1');
    if (o.exit) ex.push('exit=1');
    if (o.tpy != null) ex.push('tpy=' + n(o.tpy));
    if (o.mini != null) ex.push('mini=' + (o.mini ? 1 : 0));
    /* ★ 圆判定物件(锯片族)与刺族都要带上 ID —— 半径/判定盒是按 ID 查表的,
       紧凑文本里丢了 ID 就只能退回猜的包围盒(踩过:整关照旧按矩形判 + 37 根刺查不到表值)。 */
    if (o.id != null && (GD_HITBOX_RADIUS[o.id] != null || o.kind === 'spike')) ex.push('id=' + o.id);
    if (o.col != null) ex.push('col=' + o.col);
    if (o.z != null) ex.push('z=' + o.z);
    if (o.groups?.length) ex.push('g=' + o.groups.join('.'));
    f.push(...ex);
    lines.push(f.join(' '));
  }
  return lines.join('\n');
}

export function decodeObjects(text: string): Obj[] {
  const out: Obj[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const p = t.split(/\s+/);
    const kind = CODE[p[0]];
    if (!kind) continue;
    const o: Obj = { kind, b: Number(p[1]), r: Number(p[2]), w: 1, h: 1 };
    let i = 3;
    if (p[3] != null && !p[3].includes('=')) { o.w = Number(p[3]); i = 4; }
    if (p[4] != null && !p[4].includes('=')) { o.h = Number(p[4]); i = 5; }
    for (; i < p.length; i++) {
      const [k, v] = p[i].split('=');
      switch (k) {
        case 'to': o.to = v as Mode; break;
        case 'orb': o.orb = v as OrbKind; break;
        case 'dash': o.dash = v as 'pink' | 'green'; break;   // ★ 冲刺环:解码这一环以前也漏了
        case 'pad': o.pad = v as PadKind; break;
        case 'spd': o.speed = Number(v); break;
        case 'gd': o.gdir = Number(v) as 1 | -1; break;
        case 'rot': o.rot = Number(v); break;
        case 'fx': o.flipX = true; break;
        case 'fy': o.flipY = true; break;
        case 'fm': o.frame = v as 'edge' | 'corner' | 'u' | 'box'; break;
        case 'ar': o.arrow = v as 'green' | 'pink' | 'purple'; break;
        case 'art': o.art = Number(v); break;
        case 'tp': o.tp = true; break;
        case 'inert': o.inert = true; break;
        case 'exit': o.exit = true; break;
        case 'tpy': o.tpy = Number(v); break;
        case 'mini': o.mini = v === '1'; break;
        /* 圆判定 / 刺族:ID 够了 —— 半径、判定盒、缩放都从表里现算 */
        case 'id': {
          o.id = Number(v);
          const rr = GD_HITBOX_RADIUS[o.id];
          if (rr != null) {
            const spec = GD_SPEC[o.id];
            const sx = spec?.w ? o.w / spec.w : 1, sy = spec?.h ? o.h / spec.h : 1;
            o.rad0 = rr;
            o.rad = rr * (Math.abs(sx) + Math.abs(sy)) / 2;
          }
          break;
        }
        case 'col': o.col = Number(v); break;
        case 'z': o.z = Number(v); break;
        case 'g': o.groups = v.split('.').map(Number); break;
      }
    }
    out.push(o);
  }
  return out;
}

/* ---------------- 生成好的铺面 → Level ----------------
 * charts/*.ts 是 tools/dat-to-chart.ts 生成的:头部(名字/高度/段)是字面量,
 * 物件表是上面那种紧凑文本 —— 之所以不写成对象字面量,是因为 9000 个物件那样要 500 KB。 */
export interface ChartMeta {
  name: string;
  rows: number;                 // 关卡高度(行):世界边界与镜头夹取都按它
  length: number;               // 关卡长(块)
  song: string;
  songOffset?: number;
  start?: { b: number; r: number };   // 出生点(块);不写就是 (0,0)
  segments: Array<Omit<Segment, 'difficulty'> & { difficulty?: number }>;
}

export function makeChart(meta: ChartMeta, table: string): Level {
  return {
    name: meta.name,
    rows: meta.rows,
    length: meta.length,
    segments: meta.segments.map((s) => ({ ...s, difficulty: s.difficulty ?? 0 })),
    objects: decodeObjects(table),
    song: meta.song,
    songOffset: meta.songOffset ?? 0,
    start: meta.start,
    fromGD: true,          // ★ 真实铺面:事件物件按原版"外框相交"判触发(见 world.hitEvent)
  };
}
