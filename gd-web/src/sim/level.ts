/* 关卡模型 + 按段落/形态的自动铺面生成器。
 *
 * 关键设计(和旧那套的区别):
 *   1. 全程用【块】做单位,不涉及时间 —— 于是完全不需要"采音"。音乐只是从头播,
 *      关卡长度以块计,进度 = 已跑块数 / 总块数。(原作本身也没有严格的采音标准)
 *   2. 段落的形态(mode)是"这一段该长什么样"的说明,不负责切换形态 ——
 *      形态由段首【圆环】物件切换,和我们在旧版里定下的规则一致。
 *   3. 生成器带【可通关】约束:障碍间距不得小于一跳的距离(P.minGapBlocks),
 *      并且测试里有一个机器人从头跑到尾来验证"这一版铺面真的能过"。
 */

import { P, ROWS, JUMP_SPAN_BLOCKS } from './constants.ts';

export type Mode = 'cube' | 'ship';
export type ObjKind =
  | 'block'      // 实心方块:踩上面能站,撞侧面死
  | 'spike'      // 尖刺:碰到就死
  | 'platform'   // 可踩平台:只从上面接住,不致死
  | 'check'      // 存档点:跨过就更新重来位置
  | 'portal'     // 圆环:切换形态
  | 'speed'      // 速度门
  | 'gravity'    // 重力门
  | 'deco';      // 装饰(文字/光源,纯视觉)

export interface Obj {
  kind: ObjKind;
  b: number;        // 左边缘(块)
  r: number;        // 底边所在行(0 = 地面那行)
  w: number;        // 宽(块)
  h: number;        // 高(块)
  to?: Mode;        // portal:切成什么形态
  speed?: number;   // speed:速度档(0..4)
  deco?: string;    // deco:'text' | 'light'
  text?: string;
}

export interface Segment {
  from: number;     // 起始块
  to: number;       // 结束块
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

/* ---------------- 地面:整段一条地板(坑洞用"缺一块"表示:这里用 ground 物件分段铺) ---------------- */
function groundRun(out: Obj[], from: number, to: number, row = 0) {
  if (to - from <= 0) return;
  push(out, { kind: 'platform', b: from, r: row - 1, w: to - from, h: 1 });
}

/* ---------------- 方块段:障碍 + 平台 + 偶尔一个坑 ---------------- */
function genCube(out: Obj[], sg: Segment, rand: () => number, state: { check: number }) {
  const density = 0.5 + sg.difficulty * 0.5;
  let b = sg.from + P.minGapBlocks;      // 段首留出落地缓冲
  let lastPit = -99;
  while (b < sg.to - P.minGapBlocks) {
    const roll = rand();
    // 大约每 40 块一个坑(坑宽 2 块,一跳 4.5 块,能跨)
    if (roll < 0.10 && b - lastPit > 34 && b + 2 < sg.to - P.minGapBlocks) {
      out.push({ kind: 'deco', b: b, r: 0, w: 2, h: 1, deco: 'light' });   // 坑口给个警示光
      lastPit = b;
      b += 2 + P.minGapBlocks;
      continue;
    }
    if (roll < 0.10 + density * 0.42) {
      const wide = rand() < 0.28 ? 2 : 1;
      push(out, { kind: 'spike', b: b, r: 0, w: wide, h: 1 });
      b += wide + P.minGapBlocks;
      continue;
    }
    if (roll < 0.10 + density * 0.62) {
      // 两层方块塔:踩上去能站、撞侧面会死
      const hh = rand() < 0.4 ? 2 : 1;
      push(out, { kind: 'block', b: b, r: 0, w: 2, h: hh });
      b += 2 + P.minGapBlocks;
      continue;
    }
    // 高空平台(可踩,不致死)
    const row = 2 + Math.floor(rand() * 4);
    push(out, { kind: 'platform', b: b, r: row, w: 2 + Math.floor(rand() * 3), h: 1 });
    b += 3 + P.minGapBlocks;
  }
  if (sg.to - state.check > 26) {
    push(out, { kind: 'check', b: sg.to - 12, r: 0, w: 1, h: 1 });
    state.check = sg.to - 12;
  }
}

/* ---------------- 飞机段:上下留墙、中间留 3~4 块的缝,缝的位置缓慢移动 ---------------- */
function genShip(out: Obj[], sg: Segment, rand: () => number, state: { check: number }) {
  const len = sg.to - sg.from;
  const stepB = 6;                        // 每 6 块改一次缝的位置
  let gapRow = 3 + Math.floor(rand() * 2); // 缝的下沿所在行
  for (let b = sg.from; b < sg.to; b += stepB) {
    const w = Math.min(stepB, sg.to - b);
    const gapH = 3 + (rand() < 0.35 ? 1 : 0);
    // 缝往上/往下漂,但一次最多漂 1 行(飞机爬升率足够,不会变成必死)
    if (rand() < 0.5) gapRow = Math.max(1, Math.min(ROWS - gapH - 1, gapRow + (rand() < 0.5 ? 1 : -1)));
    for (let r = 0; r < ROWS; r++) {
      if (r >= gapRow && r < gapRow + gapH) continue;
      push(out, { kind: 'block', b: b, r: r, w: w, h: 1 });
    }
    if (sg.to - state.check > 40 && b > sg.from + 20) {
      push(out, { kind: 'check', b: b + 2, r: gapRow, w: 1, h: 1 });
      state.check = b + 2;
    }
  }
}

/* ---------------- 组装一整关 ---------------- */
export function generateLevel(opts: {
  seed?: number;
  segments?: Segment[];
  song?: string;
  songOffset?: number;
  length?: number;
} = {}): Level {
  const seed = opts.seed == null ? 20260913 : opts.seed;
  const rand = prng(seed);
  const segments: Segment[] = opts.segments ?? [
    { from: 0, to: 260, mode: 'cube', speed: 1, difficulty: 0.25, label: 'ST-01 复盘' },
    { from: 260, to: 320, mode: 'cube', speed: 1, difficulty: 0.0, label: '过渡' },
    { from: 320, to: 560, mode: 'ship', speed: 1, difficulty: 0.35, label: 'ST-02 求助' },
    { from: 560, to: 820, mode: 'cube', speed: 2, difficulty: 0.5, label: 'ST-03 呼吸' },
    { from: 820, to: 1080, mode: 'cube', speed: 1, difficulty: 0.65, label: 'ST-04 继续' },
  ];
  const length = opts.length ?? segments[segments.length - 1].to;

  const objects: Obj[] = [];
  const state = { check: -1e9 };
  // 整条地板:一整关都铺,坑用一个"没有地板"的缺口表示(生成器不铺那一段)
  let floorFrom = 0;
  const holes: Array<[number, number]> = [];

  for (const sg of segments) {
    /* ★ 顺序要紧:圆环必须在【本段内容之前】,否则方块会一头撞进飞机走廊 —— 那是必死关 */
    push(objects, { kind: 'portal', b: sg.from + 2, r: 4, w: 1, h: 1, to: sg.mode });
    push(objects, { kind: 'speed', b: sg.from + 6, r: 4, w: 1, h: 1, speed: sg.speed });
    /* 内容从 +10 开始、到 to-2 结束:段首留 10 块给玩家进形态,段尾留 2 块缓冲 */
    const inner: Segment = { ...sg, from: sg.from + 10, to: sg.to - 2 };
    if (sg.mode === 'cube') genCube(objects, inner, rand, state);
    else genShip(objects, inner, rand, state);
    // 段落交界处给一句旁白锚点(装饰)
    if (sg.label) push(objects, { kind: 'deco', b: sg.from + 12, r: 6, w: 4, h: 2, deco: 'text', text: sg.label });
  }
  // 收集坑(方块段里"警示光"后面那 2 块合成一个缺口)
  for (const o of objects) {
    if (o.kind === 'deco' && o.deco === 'light') holes.push([o.b, o.b + o.w]);
  }
  // 铺地板:遇到缺口就断开
  holes.sort((a, b) => a[0] - b[0]);
  for (const h of holes) {
    if (h[0] > floorFrom) groundRun(objects, floorFrom, h[0]);
    floorFrom = h[1];
  }
  if (floorFrom < length) groundRun(objects, floorFrom, length);

  // 终点
  push(objects, { kind: 'deco', b: length - 6, r: 0, w: 1, h: 1, deco: 'light' });

  objects.sort((a, b) => a.b - b.b || a.r - b.r);
  return {
    name: 'lost-rebuild-' + seed,
    rows: ROWS,
    length,
    segments,
    objects,
    song: opts.song ?? '/assets/cd/music/lost.mp3',
    songOffset: opts.songOffset ?? 0,
  };
}

/** 自检用的统计:最小障碍间距(块)。小于 JUMP_SPAN_BLOCKS 的地方意味着"跳不过去" */
export function tightestGap(level: Level): number {
  const cubeHazards = level.objects
    .filter((o) => (o.kind === 'spike' || o.kind === 'block') && o.r === 0)
    .sort((a, b) => a.b - b.b);
  let min = Infinity;
  for (let i = 1; i < cubeHazards.length; i++) {
    const prev = cubeHazards[i - 1];
    const d = cubeHazards[i].b - (prev.b + prev.w);
    // 只关心同一段(形态切换处不算)
    const segOf = (b: number) => level.segments.find((s) => b >= s.from && b < s.to);
    const s1 = segOf(prev.b), s2 = segOf(cubeHazards[i].b);
    if (s1 && s2 && s1 === s2 && s1.mode === 'cube') min = Math.min(min, d);
  }
  return min;
}

export { JUMP_SPAN_BLOCKS };
