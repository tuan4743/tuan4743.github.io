/* 四联蓝跳点 + 反转重力门(x=714)那一段的逐帧取证 —— 用户要的"原版能飞到砖块上方"这条判据。
 *
 * 用法:cd gd-web && node tools/probe-brick4.ts [入口vy(格/帧)] [输入: idle|hold|hold:N|pat=01] [帧数] [每几帧打] [起点x] [起点中心y]
 *   默认 = 用户给的进入状态:cube 中心在【门下那一格的左上角】(714, 22.5) 格、vy=0、gdir=1、速度档 4
 *
 * 为什么单独写:①diag-run.ts 会设 windowed,而现在的铺面带触发器 ⇒ 直接抛错 ✗
 *              ②这一段要的是"死因"读数 —— 死的那一帧到底压着哪些物件、压在哪一面
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const VY = Number(process.argv[2] ?? 0);
const INPUT = process.argv[3] ?? 'idle';
const FRAMES = Number(process.argv[4] ?? 300);
const EVERY = Number(process.argv[5] ?? 2);
const CX = Number(process.argv[6] ?? 714);          // 玩家【中心】x(格)
const CY = Number(process.argv[7] ?? 22.5);         // 玩家【中心】y(格)

type B = { x0: number; y0: number; x1: number; y1: number; o: Record<string, unknown> };
const w = new World(WATER_CHART);
const box = w.box;
w.x = CX * U - box / 2; w.y = CY * U - box / 2; w.vy = VY * U;
w.onGround = false; w.mode = 'cube'; w.gdir = 1; w.speedIdx = 4;
w.checkX = w.x; w.checkY = w.y; w.checkGdir = w.gdir; w.checkSpeed = w.speedIdx; w.checkMode = w.mode;

const rd = (v: number) => Math.round(v * 10) / 10;
const who = (b: B) => {
  const o = b.o as { kind?: string; pad?: string; orb?: string; id?: number; gdir?: number; to?: string };
  return (o.kind ?? '?') + (o.pad ? ':' + o.pad : '') + (o.orb ? ':' + o.orb : '') +
    (o.gdir != null ? ':gd' + o.gdir : '') + (o.to ? ':→' + o.to : '') + ' id=' + (o.id ?? '-');
};
const lists: Array<[string, B[]]> = [
  ['砖', w.solids as unknown as B[]], ['可破坏', w.breakables as unknown as B[]], ['地板', w.floors as unknown as B[]],
  ['刺', w.hazards as unknown as B[]], ['线框', w.frames as unknown as B[]], ['板', w.pads as unknown as B[]],
  ['环', w.orbs as unknown as B[]], ['门', w.portals as unknown as B[]], ['重力', w.gravs as unknown as B[]],
  ['速度', w.speeds as unknown as B[]], ['箭头', w.arrows as unknown as B[]], ['力场', w.forces as unknown as B[]],
  /* ★ 锯片在 circles 里,但它是 {cx,cy,r} 结构(不是 x0/y0/x1/y1),塞进来会打出 NaN ✗ ⇒ 单独判:
     查"圆判定致死"请用 deathCause 那一行 + 手算圆心距(或 tools/probe-rod.ts) */
];
const hits = () => {
  const out: Array<{ tag: string; who: string; box: B; faces: string }> = [];
  for (const [tag, list] of lists) for (const b of list) {
    if (w.x + box <= b.x0 || w.x >= b.x1 || w.y + box <= b.y0 || w.y >= b.y1) continue;
    /* 玩家是从哪一面压上去的:比较两组中心的相对位置 */
    const pcx = w.x + box / 2, pcy = w.y + box / 2;
    const bcx = (b.x0 + b.x1) / 2, bcy = (b.y0 + b.y1) / 2;
    const faces = 'dx=' + rd((pcx - bcx) / U) + ' dy=' + rd((pcy - bcy) / U) +
      '(物件盒 ' + rd(b.x0 / U) + '~' + rd(b.x1 / U) + ' × ' + rd(b.y0 / U) + '~' + rd(b.y1 / U) + ')';
    out.push({ tag, who: who(b), box: b, faces });
  }
  return out;
};

console.log('起点: 中心 (' + CX + ', ' + CY + ') 格 · vy=' + VY + ' · 输入=' + INPUT + ' · speed=4 · gdir=1 · box=' + box + ' 单位');
let apex = { up: -1e9, dn: 1e9 };
let died = -1;
for (let i = 0; i < FRAMES; i++) {
  if (w.dead || w.done) { died = died < 0 ? i : died; break; }
  const hold = INPUT === 'hold' ? true : INPUT.startsWith('hold:') ? i < Number(INPUT.slice(5)) : INPUT.startsWith('pat=') ? INPUT.slice(4)[i % INPUT.slice(4).length] === '1' : false;
  w.frame(hold);
  apex.up = Math.max(apex.up, w.y / U); apex.dn = Math.min(apex.dn, w.y / U);
  if (w.dead || w.done || i % EVERY === 0) {
    const hs = hits();
    console.log('[' + i + '] x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) +
      ' vy=' + (w.vy / U).toFixed(2) + (w.gdir < 0 ? ' ↑' : ' ↓') + (w.onGround ? ' G' : '') +
      (hs.length ? ' 压着:' + hs.map((h) => h.tag + '{' + h.who + '}').join(' ') : '') +
      (w.dead ? ' 【死】' : w.done ? ' 【通关】' : ''));
    if (w.dead) {
      console.log('  ★ 死因候选(玩家盒 ' + rd(w.x / U) + '~' + rd((w.x + box) / U) + ' × ' + rd(w.y / U) + '~' + rd((w.y + box) / U) + ' 格):');
      for (const h of hs) console.log('     ' + h.tag + ' · ' + h.who + ' · ' + h.faces);
      died = i; break;
    }
  }
  if (w.y < -20 * U) break;
}
console.log('末态: x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) +
  ' 顶点(最大 y)=' + rd(apex.up) + ' 最低 y=' + rd(apex.dn) +
  (died >= 0 ? ' 【第 ' + died + ' 帧死】' : w.done ? ' 【通关】' : ' 【活着】'));
