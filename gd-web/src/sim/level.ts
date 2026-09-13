/* 关卡模型 + 按【音乐时间】自动铺面。
 *
 * 和上一版最大的区别:铺面不再"每 6 块放一个障碍",而是**踩在 onset 上**:
 *   1. 段落先用【秒】定义(t0..t1 + 速度档),再用 x(t) = 分段线性积分换算成【块】;
 *      速度门正好放在段首,所以 x(t) 精确可逆 —— 障碍放在哪个 onset 上,就真的在那一拍上;
 *   2. 每个 onset 落到"该不该出手"的判定里:需要出手的排成图案(单刺/双刺/环),
 *      不需要出手的(玩家此刻必然悬空、或者被弹簧弹着)**照样放刺** —— 于是鼓点密的地方
 *      画面也密,但玩家不用额外按键;
 *   3. 连续密鼓点优先用**弹簧连**:弹簧自动触发,玩家一路被弹着走,
 *      这是用户点名要的"连续鼓点直接弹簧连上就不用人打";
 *   4. 每条图案都记下"玩家必然悬空的区间",后面的 onset 只有落在这个区间里才敢补刺。
 *
 * 仍然保留的老规矩:测试里有机器人从头跑到尾 —— 它不知道哪些刺是"白送"的,
 * 看到危险就按住,所以它跑得过 = 这张铺面真的能过。
 */

import {
  P, U, ROWS, JUMP_SPAN_BLOCKS, Y_TIME_SCALE, vxOf, arcSpan, arcPeak,
  ORB, PAD, type OrbKind, type PadKind,
} from './constants.ts';
import { LOST_BEATS, type BeatData } from './beats.ts';

export type Mode = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
export type ObjKind =
  | 'block'      // 实心方块:踩上面能站,撞侧面死
  | 'spike'      // 尖刺:碰到就死(h 决定大小:0.5 = 小刺,1.0 = 普通,1.5 = 大刺)
  | 'saw'        // 锯片:整格吃人的旋转圆锯
  | 'platform'   // 可踩平台:只从上面接住,不致死
  | 'check'      // 存档点:跨过就更新重来位置
  | 'portal'     // 圆环:切换形态
  | 'speed'      // 速度门
  | 'gravity'    // 重力门
  | 'orb'        // 空中跳环:要一次【新的按键】才生效(黄=跳/粉=小跳/红=大跳/蓝=翻重力/绿=翻重力+跳/黑=冲刺)
  | 'pad'        // 弹簧/跳板:碰到就生效,不用按键(黄/粉/红=弹起,蓝/紫=翻重力)
  | 'force'      // 力场:人进到里面就被推(现在只做垂直方向,口径见 P.forceNote)
  | 'text'       // 功能块:显示字母/符号,做关卡内提示用(纯视觉)
  | 'trigger'    // 触发器:玩家越过它的 x 时,对【分组】里的物件做事(move/rotate/color/pulse)
  | 'pit'        // 坑:地板断口(纯标记,地板在生成时跳过这一段)
  | 'deco';      // 装饰(文字/光源,纯视觉)

export type TriggerKind = 'move' | 'rotate' | 'color' | 'pulse';

export interface Obj {
  kind: ObjKind;
  b: number;        // 左边缘(块)
  r: number;        // 底边所在行(0 = 地面那行)
  w: number;        // 宽(块)
  h: number;        // 高(块)
  to?: Mode;        // portal:切成什么形态
  speed?: number;   // speed:速度档(0..4)
  orb?: OrbKind;    // orb:是哪种环
  pad?: PadKind;    // pad:是哪种弹簧
  fy?: number;      // force:垂直加速度(单位/帧²,正 = 往上推)。正数大于 gravity 就是"上升气流"
  text?: string;    // text:显示什么字(功能块)
  size?: number;    // text:字号缩放
  groups?: number[];   // ★ 所属分组:触发器靠它挑目标(一个物件可以在多个组里)
  trigger?: TriggerKind; // trigger:哪种触发器
  dx?: number; dy?: number;  // move:位移(块)
  deg?: number;              // rotate:转多少度
  dur?: number;              // move/rotate/pulse:时长(秒);0 = 瞬移(原版的"立即到位")
  ease?: 'linear' | 'sine';
  loop?: boolean;            // 到位之后再走回去(往复)—— 移动平台最常见的形态
  color?: number;            // color/pulse:颜色
  hold?: boolean;            // pulse:闪完是否留色
  need?: boolean;   // 这个物件需要玩家出手(跳/按环)才过得去 —— 只有它进"间距"约束
  deco?: 'text' | 'light';
}

export interface Segment {
  from: number;     // 起始块(由 t0 换算得到)
  to: number;       // 结束块
  t0?: number;      // 起始时间(秒)
  t1?: number;      // 结束时间(秒)
  mode: Mode;
  speed: number;    // 速度档 0..4
  difficulty: number; // 0..1,越大障碍越密
  label?: string;   // 旁白/段落名(和本站四段设定对应)
}

export interface Level {
  name: string;
  rows: number;
  length: number;   // 总长(块)
  segments: Segment[];
  objects: Obj[];
  song: string;
  songOffset: number;
  beats?: number[]; // 生成时用的 onset 列表(秒),留着给调试/对齐用
}

/* ---------------- 时间 ↔ 位置 ---------------- */

/** 某个速度档下每秒跑多少块 */
export function blocksPerSec(speedIdx: number): number {
  return (vxOf(speedIdx) * 60) / U;
}

/** 段内:秒 → 块 */
export function xAt(sg: Segment, t: number): number {
  return sg.from + (t - (sg.t0 ?? 0)) * blocksPerSec(sg.speed);
}

/** 段内:块 → 秒 */
export function tAt(sg: Segment, x: number): number {
  return (sg.t0 ?? 0) + (x - sg.from) / blocksPerSec(sg.speed);
}

/** 关卡级:块 → 秒(死亡复活时要把音乐拉到对应时间,这条是"铺面贴着音乐"的保证) */
export function tOfX(level: Level, x: number): number {
  const sg = level.segments.find((s) => x >= s.from && x < s.to) ?? level.segments[level.segments.length - 1];
  return tAt(sg, x);
}

/* ---------------- 有种子随机:同一个种子 → 同一张铺面(可复现是硬要求) ---------------- */
export function prng(seed: number) {
  let s = (seed >>> 0) || 1;
  return function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const push = (out: Obj[], o: Obj) => out.push(o);

/* ---------------- 弧线几何(把"一次出手能跨多远"算准) ----------------
 *
 * 机器人(以及任何玩家)对地面危险的反应是"危险进了一跳的距离就起跳",于是:
 *   起跳点 = 危险右边缘 − jumpLead,落地点 = 起跳点 + 一跳跨距。
 * 这些图案把这条几何写死,再据此推出"玩家此刻必然悬空、可以白送尖刺"的窗口。
 * 引擎里没有任何"特殊标记"让机器人免疫这些刺 —— 它一样会看到、一样会躲,躲不掉就死。
 */

/** 起跳点离危险【右边缘】多少块(与 world.ts 的 botThink 用同一条公式,两边必须一致) */
function jumpLead(speed: number): number {
  return arcSpan(P.jump, speed) - (P.innerOff + 6) / U;
}

/** 内框右缘碰到物件左缘的位置:玩家其实提前 0.625 块就"碰"到了它(弹簧/环都按这个算) */
const TOUCH_LEAD = (P.innerOff + P.inner) / U;      // = 0.625 块

/** 内判定框此刻脚底在哪个格子里 —— 环就放这一行,保证一定碰得到 */
function orbRow(yUnits: number): number {
  return Math.floor((yUnits + P.innerOff) / U);
}

const CLEAR_H = 1.5;          // "白送"门槛:玩家脚底至少 1.5 块高,底下才敢放刺

interface ArcInfo {
  land: number;               // 从触发点起,落地还要飞多少块
  c0: number; c1: number;     // 净空 ≥ CLEAR_H 的窗口(相对触发点,块)
  peak: number;               // 最高点(块)
}

/** 从高度 h0(块)、初速 v(单位/帧)出发,飞了 d 块之后的脚底高度(块)。
 *  ★ 时间要按 y 轴尺度(×0.9)算 —— 少了这一步,所有弧线的落点都会偏前,机器人当场撞死。 */
function heightAt(d: number, h0: number, v: number, speed: number): number {
  const vx = vxOf(speed);                           // 单位/帧
  const t = ((d * U) / vx) * Y_TIME_SCALE;          // 帧(y 轴时间尺度)
  return (h0 * U + v * t - 0.5 * P.gravity * t * t) / U;
}

/** 一条弧线的几何 —— 数值扫出来,不靠手算(手算过一次,差了 0.6 块,机器人当场撞死) */
function arcOf(h0: number, v: number, speed: number): ArcInfo {
  const yAt = (d: number) => heightAt(d, h0, v, speed);
  let land = 60;
  for (let d = 0.02; d < 60; d += 0.02) { if (yAt(d) <= 0) { land = d; break; } }
  let c0 = -1, c1 = -1, peak = 0;
  for (let d = 0; d <= land; d += 0.02) {
    const h = yAt(d);
    if (h > peak) peak = h;
    if (h >= CLEAR_H) { if (c0 < 0) c0 = d; c1 = d; }
  }
  if (c0 < 0) { c0 = c1 = land; }
  return { land, c0, c1, peak };
}

export interface Pattern {
  objs: Obj[];
  x: number;      // 需要出手的那个物件的左边缘
  end: number;    // 图案占用到哪儿:下一个"出手"必须排在它右边
  land: number;   // 落地点
}

/** 图案的结束位置。
 *  ★ 这条规则是踩出来的:下一个"要出手"的障碍,右边缘必须【超出落地后一跳够得到的距离】,
 *    否则玩家一落地就被动起跳(按住不放 = 落地连跳),而那一跳的落点正好压在这个障碍上 —— 必死。
 *    实测那一次:刺在 34.61 与 37.81,机器人被迫在 33.37 起跳,落点 37.86 = 直接坐进第二根刺。 */
function safeEnd(land: number, speed: number): number {
  return land + jumpLead(speed) - 1 + 0.6;
}

/** 单刺(可选双刺):一次起跳跨过去。孤立的刺底下没有净空窗口,所以不放"白送"刺 ——
 *  放了反而会让机器人把这个更近的刺当成目标、提前起跳(实测过的坑)。 */
function patSpike(x: number, wide: boolean, speed: number): Pattern {
  const w = wide ? 2 : 1;
  const jumpStart = x + w - jumpLead(speed);
  const land = jumpStart + arcSpan(P.jump, speed);
  return { objs: [{ kind: 'spike', b: x, r: 0, w, h: 1, need: true }], x, end: safeEnd(land, speed), land };
}

/** 尖刺 + 头顶跳环(黄环 1~2 个):按一下跳、再按一下踩环,环把弧线接长之后,
 *  底下那一大段全是白送的鼓点 —— 这是密度和手感的关键图案。
 *  注意环要"新的一下"(原作口径),所以机器人在这里会主动松一帧再按(见 world.ts)。 */
function patSpikeOrb(x: number, onsets: number[], speed: number, orbs: number): Pattern {
  const objs: Obj[] = [{ kind: 'spike', b: x, r: 0, w: 1, h: 1, need: true }];
  const jumpStart = x + 1 - jumpLead(speed);
  const hop = arcSpan(P.jump, speed) / 2;              // 顶点永远在起跳后半个跨距处
  let from = jumpStart, h0 = 0;                        // 当前这一跳的起点与起始高度
  let land = jumpStart + arcSpan(P.jump, speed);
  const clear: Array<[number, number]> = [];
  for (let k = 0; k < orbs; k++) {
    const at = from + hop;                             // 环摆在顶点上
    const trig = at - TOUCH_LEAD;                      // 真正的触发位置(内框右缘先碰到)
    const h = heightAt(trig - from, h0, P.jump, speed);
    push(objs, { kind: 'orb', b: at, r: orbRow(h * U), w: 1, h: 1, orb: 'yellow' });
    const next = arcOf(h, P.jump, speed);
    clear.push([trig + next.c0, trig + next.c1]);
    land = trig + next.land;
    from = trig; h0 = h;
  }
  for (const o of onsets) {
    for (const [a, b] of clear) {
      if (o > Math.max(a, x + 1.3) && o < Math.min(b, land - 0.6)) {
        push(objs, { kind: 'spike', b: o, r: 0, w: 1, h: 1 });
        break;
      }
    }
  }
  return { objs, x, end: safeEnd(land, speed), land };
}

/** 坑 + 坑上方的黄环:起跳跨坑口、在空中踩环续一跳 —— 原版里最常见的长距离处理 */
function patPitOrb(x: number, pwidth: number, speed: number, holes: Array<[number, number]>): Pattern {
  const far = x + pwidth;
  const jumpStart = far - arcSpan(P.jump, speed) + 0.8;   // 与 botThink 的坑判定一致
  const objs: Obj[] = [{ kind: 'pit', b: x, r: 0, w: pwidth, h: 1, need: true }];
  const hop = arcSpan(P.jump, speed) / 2;
  const at = jumpStart + hop;
  const trig = at - TOUCH_LEAD;
  const h = heightAt(trig - jumpStart, 0, P.jump, speed);
  push(objs, { kind: 'orb', b: at, r: orbRow(h * U), w: 1, h: 1, orb: 'yellow' });
  const land = trig + arcOf(h, P.jump, speed).land;
  holes.push([x, far]);
  return { objs, x, end: safeEnd(land, speed), land };
}

/** 弹簧连:连续鼓点交给弹簧,玩家一路上不用按任何键(用户点名要的玩法)。
 *
 *  两条实测出来的硬约束(破了机器人当场撞死,都是"提前起跳、从弹簧头顶飞过去"):
 *   ① 第一个弧线里【什么都不放】—— 否则机器人在离弹簧 2 块时就看见那根刺,提前起跳;
 *   ② 弹簧间距必须 ≤ 一跳的跨距 —— 玩家落地的瞬间就该碰到下一根弹簧。
 *      只要中间留出"在地上跑"的一小段,他脚下那一段里的刺就进了起跳判定,又会提前跳。 */
function patPadRun(x: number, onsets: number[], speed: number, rnd: () => number, difficulty: number): Pattern {
  const pv = PAD.yellow.v;
  const arc = arcOf(0, pv, speed);
  const span = arc.land;                                // 黄弹簧一跳的跨距 = 弹簧连的间距
  const n = 2 + (rnd() < 0.6 ? 1 : 0) + (difficulty > 0.5 && rnd() < 0.4 ? 1 : 0);   // 2~4 个
  /* 弹簧只有在玩家已经落到 0.625 块以下时才会被踩到 —— 算出这个临界距离。
     ★ 要取【下落时穿过 0.625 块】的最后一处:从 0 开始扫的话 d=0.02 就"低于 0.625"了,
       会把临界值算成 0.02,弹簧间距直接乱掉(实测:算错之后 5.25 块的间距让玩家从弹簧头顶飞过)。 */
  let armAt = 0;
  for (let d = 0.02; d < span; d += 0.02) { if (heightAt(d, 0, pv, speed) >= TOUCH_LEAD) armAt = d; }
  const lo = Math.max(armAt - 0.4, span * 0.8), hi = span;   // 上界 = 跨距:中间不留"在地上跑"的空档
  const pads: number[] = [x];
  for (let k = 1; k < n; k++) {
    /* 尽量吸到最近的 onset(让"被弹起来"也踩在鼓点上),但必须落在 [lo, hi] 里 */
    const prev = pads[k - 1];
    let best = prev + hi, bestD = Infinity;
    for (const o of onsets) {
      if (o < prev + lo || o > prev + hi) continue;
      const d = Math.abs(o - (prev + span * 0.95));
      if (d < bestD) { bestD = d; best = o; }
    }
    pads.push(best);
  }
  const objs: Obj[] = [];
  for (let k = 0; k < n; k++) {
    push(objs, { kind: 'pad', b: pads[k], r: 0, w: 1, h: 1, pad: 'yellow' });
    if (k === 0) continue;                              // 约束①
    const c0 = pads[k] - TOUCH_LEAD + arc.c0, c1 = pads[k] - TOUCH_LEAD + arc.c1;
    for (const o of onsets) {
      if (o < Math.max(c0, pads[k] + 1.2) || o > c1) continue;   // 别压在自己这根弹簧上
      if (k + 1 < n && o > pads[k + 1] - 1.4) continue;          // 也别贴着下一根
      /* ★ 弧线下面只放【尖刺】,不放方块:方块会把地面抬高 1 块,玩家会落在方块顶上,
         之后从方块上起跳就够不到下一根弹簧了(实测:整串弹簧就是这么断的)。 */
      push(objs, { kind: 'spike', b: o, r: 0, w: 1, h: 1 });
    }
  }
  const land = pads[pads.length - 1] - TOUCH_LEAD + span;
  return { objs, x, end: safeEnd(land, speed), land };
}

/* ---------------- 方块段:按 onset 走一遍 ---------------- */
function genCube(
  out: Obj[], sg: Segment, onsets: number[], rnd: () => number,
  holes: Array<[number, number]>, state: { lastHit: number },
) {
  const x0 = sg.from + 12;             // 段首留白:进形态、看清场面
  const x1 = sg.to - 8;                // 段尾留白:下一个圆环/速度门前不许有障碍
  let lastHit = Math.max(state.lastHit, -1e9);
  let lastPit = -1e9;
  let lastRun = -1e9;
  let pitWanted = false;               // 想放坑的时候先"预约",等助跑道空出来
  let i = 0;
  while (i < onsets.length) {
    const x = onsets[i];
    if (x < x0) { i++; continue; }
    if (x > x1) break;
    if (x < lastHit) { i++; continue; }          // 上一个图案还没结束,这个 onset 先让开
    if (!pitWanted && x - lastPit > 34 && x + 16 < x1 && rnd() < 0.18) pitWanted = true;

    /* 局部密度:往后 17 块(约 1.5 秒)里 onset 够多 → 这一段交给弹簧连 */
    let dense = 0;
    for (let k = i; k < onsets.length && onsets[k] < x + 17; k++) dense++;
    const wantRun = dense >= 6 || rnd() < 0.15 + 0.25 * sg.difficulty;
    const runOk = x - lastRun > 38 && x + 26 < x1;

    if (wantRun && runOk) {
      /* 弹簧还需要【落地之后跑一段】的助跑道:第一根弹簧必须在玩家已经在平地上跑的时候触发,
         这样"触发点 = 弹簧左缘 − 0.625 块"才成立,后面每一根的间距才算得准。
         助跑道还没空出来时,这个 onset 直接【让开】(先不放东西),等空出来了再放弹簧连 ——
         于是铺面自然形成"弹簧段 / 跳跃段"交替的样子。 */
      if (x - lastHit > 4) {
        const p = patPadRun(x, onsets, sg.speed, rnd, sg.difficulty);
        if (p.end < x1) {
          for (const o of p.objs) push(out, o);
          lastRun = p.x;
          lastHit = p.end;
          while (i < onsets.length && onsets[i] < p.end) i++;
          continue;
        }
      } else { i++; continue; }
    }

    /* 坑 + 环:跨得远、好看,单独一种图案。★ 也要"预约 + 腾助跑道":
       不预约的话,每次循环都会先被普通图案占掉,k - lastHit > 16 永远不成立 —— 实测一个坑都放不出来。 */
    if (pitWanted) {
      if (x - lastHit > 6) {
        const p = patPitOrb(x, 3, sg.speed, holes);
        if (p.end < x1) {
          for (const o of p.objs) push(out, o);
          lastPit = x;
          lastHit = p.end;
          pitWanted = false;
          while (i < onsets.length && onsets[i] < p.end) i++;
          continue;
        }
        pitWanted = false;                             // 放不下就算了,别一直惦记
      } else { i++; continue; }
    }

    /* 普通出手:难度越高越常出"环"图案(它跨得远、手下得重、底下白送的刺更多) */
    const useOrb = rnd() < 0.22 + 0.45 * sg.difficulty;
    const p = useOrb
      ? patSpikeOrb(x, onsets, sg.speed, rnd() < 0.45 ? 2 : 1)
      : patSpike(x, rnd() < 0.3, sg.speed);
    if (p.end > x1) break;
    for (const o of p.objs) push(out, o);
    lastHit = p.end;
    while (i < onsets.length && onsets[i] < p.end) i++;
  }
  state.lastHit = lastHit;
}

/* ---------------- 飞机段:上下留墙、中间留缝,缝的位置按节拍挪 ---------------- */
function genShip(out: Obj[], sg: Segment, rnd: () => number, state: { lastHit: number }) {
  const from = sg.from + 10, to = sg.to - 6;
  const step = 2 * (LOST_BEATS.period * blocksPerSec(sg.speed));   // 每 2 拍换一次缝
  let gapRow = 3 + Math.floor(rnd() * 2);
  for (let b = from; b < to; b += step) {
    const w = Math.min(step, to - b);
    const gapH = 3 + (rnd() < 0.35 ? 1 : 0);
    if (rnd() < 0.55) gapRow = Math.max(1, Math.min(ROWS - gapH - 1, gapRow + (rnd() < 0.5 ? 1 : -1)));
    for (let r = 0; r < ROWS; r++) {
      if (r >= gapRow && r < gapRow + gapH) continue;
      push(out, { kind: 'block', b, r, w, h: 1 });
    }
  }
  state.lastHit = to;
}

/* ---------------- 组装一整关 ---------------- */

export interface SegmentSpec {
  t0: number; t1: number; mode: Mode; speed: number; difficulty: number; label?: string;
}

/* 段落切在音乐安静处(见 data/lost-beats.json 的 onset 密度):
   28.5s / 33.5s / 58s / 82s / 105s 都是密度洼地,所以"换形态"听起来像"换段" */
export const DEFAULT_SPECS: SegmentSpec[] = [
  { t0: 0.0, t1: 28.5, mode: 'cube', speed: 1, difficulty: 0.22, label: 'ST-01 复盘' },
  { t0: 28.5, t1: 33.5, mode: 'cube', speed: 1, difficulty: 0.05 },
  { t0: 33.5, t1: 58.0, mode: 'ship', speed: 1, difficulty: 0.30, label: 'ST-02 求助' },
  { t0: 58.0, t1: 82.0, mode: 'cube', speed: 1, difficulty: 0.40 },
  { t0: 82.0, t1: 105.0, mode: 'cube', speed: 2, difficulty: 0.55, label: 'ST-03 呼吸' },
  { t0: 105.0, t1: 156.76, mode: 'cube', speed: 1, difficulty: 0.65, label: 'ST-04 继续' },
];

export function buildSegments(specs: SegmentSpec[]): Segment[] {
  let x = 0;
  return specs.map((sp) => {
    const seg: Segment = {
      from: x, to: x + (sp.t1 - sp.t0) * blocksPerSec(sp.speed),
      t0: sp.t0, t1: sp.t1, mode: sp.mode, speed: sp.speed, difficulty: sp.difficulty, label: sp.label,
    };
    x = seg.to;
    return seg;
  });
}

export function generateLevel(opts: {
  seed?: number;
  beats?: BeatData;
  specs?: SegmentSpec[];
} = {}): Level {
  const seed = opts.seed == null ? 20260913 : opts.seed;
  const bd = opts.beats ?? LOST_BEATS;
  const rand = prng(seed);
  const segments = buildSegments(opts.specs ?? DEFAULT_SPECS);
  const length = segments[segments.length - 1].to;

  const objects: Obj[] = [];
  const holes: Array<[number, number]> = [];
  const state = { lastHit: -1e9 };

  for (const sg of segments) {
    /* ★ 顺序要紧:圆环必须在【本段内容之前】,否则方块会一头撞进飞机走廊 —— 那是必死关。
       速度门放在段首【正好】的位置:换挡那一刻 = 段落开始那一刻,x(t) 才对得上。 */
    push(objects, { kind: 'speed', b: sg.from, r: 6, w: 1, h: 1, speed: sg.speed });
    push(objects, { kind: 'portal', b: sg.from + 0.25, r: 3, w: 1, h: 1, to: sg.mode });
    const onsets = bd.beats
      .filter((t) => t >= (sg.t0 ?? 0) && t < (sg.t1 ?? 0))
      .map((t) => xAt(sg, t));
    if (sg.mode === 'cube') genCube(objects, sg, onsets, rand, holes, state);
    else genShip(objects, sg, rand, state);
    if (sg.label) push(objects, { kind: 'deco', b: sg.from + 13, r: 7, w: 5, h: 1, deco: 'text', text: sg.label });
  }

  /* 地板:整条铺,遇到坑就断开(坑的标记由图案写进 holes) */
  holes.sort((a, b) => a[0] - b[0]);
  let floorFrom = 0;
  for (const h of holes) {
    if (h[0] > floorFrom) push(objects, { kind: 'platform', b: floorFrom, r: -1, w: h[0] - floorFrom, h: 1 });
    floorFrom = Math.max(floorFrom, h[1]);
  }
  if (floorFrom < length) push(objects, { kind: 'platform', b: floorFrom, r: -1, w: length - floorFrom, h: 1 });

  /* 存档点:关卡最开头一个(死了不至于"直接跳到下一段"),之后【每 120 块】一个 ——
     摔一次最多重跑 120 块(约 11 秒),而不是"一口气退回上一段"。
     位置必须【就近】找:以前的 findSafeX 只会往后扫,第一个存档点被弹簧连挡着,
     一路扫到 40 块开外 —— 玩家在开头摔了,复活点却在前方,体验就是"开局没有存档点"。 */
  push(objects, { kind: 'check', b: findSafeX(objects, 2, 6), r: 0, w: 1, h: 1 });
  for (const sg of segments) {
    for (let b = sg.from + 14; b < sg.to - 12; b += 120) {
      push(objects, { kind: 'check', b: findSafeX(objects, b, 6), r: 0, w: 1, h: 1 });
    }
  }

  push(objects, { kind: 'deco', b: length - 8, r: 0, w: 1, h: 1, deco: 'light' });
  objects.sort((a, b) => a.b - b.b || a.r - b.r);
  return {
    name: 'lost-beat-' + seed,
    rows: ROWS,
    length,
    segments,
    objects,
    song: bd.song,
    songOffset: 0,
    beats: bd.beats,
  };
}

/** 在 near 附近找一处"左右 margin 块内没有任何危险"的落点(给存档点用)。
 *  ★ 前后都扫,而且**先往后只扫一小段**:存档点必须落在它该在的地方附近,
 *    否则"复活点跑到玩家前面去"比没有存档点还糟。 */
export function findSafeX(objects: Obj[], near: number, margin: number): number {
  const bad = (x: number) => objects.some((o) =>
    (o.kind === 'spike' || o.kind === 'block' || o.kind === 'orb' || o.kind === 'pit' || o.kind === 'pad') &&
    x + margin > o.b && x - margin < o.b + o.w);
  for (let d = 0; d <= 14; d += 0.5) {
    if (!bad(near + d)) return near + d;
    if (d > 0 && !bad(near - d)) return near - d;
  }
  return near;
}

/** 自检用的统计:两次"出手"之间的最小间距(块)。小于约 1.4 块就说明两个图案叠在一起了 */
export function tightestGap(level: Level): number {
  const need = level.objects
    .filter((o) => o.need && (o.kind === 'spike' || o.kind === 'block' || o.kind === 'pit') && o.r === 0)
    .sort((a, b) => a.b - b.b);
  const segOf = (b: number) => level.segments.find((s) => b >= s.from && b < s.to);
  let min = Infinity;
  for (let i = 1; i < need.length; i++) {
    const prev = need[i - 1], cur = need[i];
    const s1 = segOf(prev.b), s2 = segOf(cur.b);
    if (!s1 || !s2 || s1 !== s2 || s1.mode !== 'cube') continue;   // 形态切换处不算
    min = Math.min(min, cur.b - (prev.b + prev.w));
  }
  return min;
}

/** 物件统计:给验收脚本/HUD 看"这一版到底铺了多少东西" */
export function countKinds(level: Level): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of level.objects) {
    const k = o.kind === 'orb' ? 'orb:' + o.orb : o.kind === 'pad' ? 'pad:' + o.pad : o.kind;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export { JUMP_SPAN_BLOCKS, arcSpan, arcPeak, ORB, PAD };
export type { OrbKind, PadKind };
