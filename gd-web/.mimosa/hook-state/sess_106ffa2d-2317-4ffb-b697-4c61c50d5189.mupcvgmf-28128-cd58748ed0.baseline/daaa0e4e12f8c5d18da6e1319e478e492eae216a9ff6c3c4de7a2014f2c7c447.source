/* 诊断:验证"冲刺方向 = 触环那一刻玩家速度方向"这条 2.2 假设(只读,不改玩法)
   跑法: cd gd-web && node tools/probe-dash-velrule.ts
   做法:
     · 触环前逐帧记住 (vx, vy);dash 启动当帧用 atan2(-vy_prev, vx_prev) 算角度
       (该处算式 sinA = −sin(ang) ⇒ 【正角 = 下斜】,所以下坠给正角 ✓)
     · 通过【诊断开关】globalThis.__dashOverride = { ang } 逐帧覆盖 —— 玩法代码不变 ✓
     · 触环相位可分:上升中触环 / 【下落中触环】(→ 后者才可能得到 ~55° 下斜)
   单位: w.x/w.y 世界单位;w.vy/w.vx 单位/帧;1 格 = 30 单位 */
import { U } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const { WATER_CHART } = await import('../src/sim/charts/water.ts');

const ENTRY_X = 665.0, ENTRY_Y = 21.0, ENTRY_VY = 5.0;
const SAW_X = 678.5;

const orbs = WATER_CHART.objects.filter((o) => o.kind === 'orb');
const blackOrb = orbs.filter((o) => o.id === 1330).sort((a, b) =>
  Math.abs((a.b + a.w / 2) - 674.5) - Math.abs((b.b + b.w / 2) - 674.5))[0];
const BKX = blackOrb.b + blackOrb.w / 2, BKY = blackOrb.r + blackOrb.h / 2;

const blueOrb = orbs.filter((o) => o.orb === 'blue').sort((a, b) =>
  Math.abs((a.b + a.w / 2) - 681.5) - Math.abs((b.b + b.w / 2) - 681.5))[0];
const BCX = blueOrb.b + blueOrb.w / 2, BCY = blueOrb.r + blueOrb.h / 2;

const near = (o: { b: number; w: number; r: number; h: number }, w: World, dx = 1.1, dy = 1.3) =>
  Math.abs((o.b + o.w / 2) - w.x / U) < dx && Math.abs((o.r + o.h / 2) - w.y / U) < dy;

type Row = {
  phase: string; rel: number; ang: number | null; dashLen: number;
  ySaw: number | null; hitBlue: boolean; alive: boolean; deadX: number | null; note: string;
};

/** phase: 'rise' = 上升中触环(只要进窗口就按);'fall' = 只在【下落中】按黑环 */
function run(phase: string, rel: number): Row {
  const log = console.log; console.log = () => {};
  const w = new World(WATER_CHART);
  console.log = log;
  w.mode = 'cube'; w.speedIdx = 4; w.gdir = 1; w.dead = false; w.god = false;
  w.x = ENTRY_X * U; w.y = ENTRY_Y * U; w.vy = ENTRY_VY; w.onGround = false;
  (w as { checkX?: number }).checkX = w.x;

  const row: Row = { phase, rel, ang: null, dashLen: 0, ySaw: null, hitBlue: false, alive: false, deadX: null, note: '' };
  const g = globalThis as { __dashOverride?: { ang?: number; vxAbs?: number } };
  g.__dashOverride = { ang: 0 };

  let prevVx = w.vx ?? 0, prevVy = w.vy, held = 0, dashStartX: number | null = null;
  let sawDone = false, blueDone = false, angSet = false;

  for (let f = 0; f < 400; f++) {
    const inDash = !!(w as { dash?: unknown }).dash;
    if (inDash && dashStartX == null) {
      dashStartX = w.x;
      /* ★ 用触环前一帧的速度方向当冲刺角(正值 = 下斜) */
      const a = Math.atan2(-prevVy, prevVx) * 180 / Math.PI;
      row.ang = +a.toFixed(2);
      g.__dashOverride = { ang: a };
      angSet = true;
    }
    /* 按键:靠近环就按;黑环按 phase 区分"上升/下落中"触环 */
    let hold = orbs.some((o) => (o.id === 1330 ? false : near(o, w)));
    if (near(blackOrb, w)) {
      const descending = prevVy < 0;
      hold = hold || (phase === 'fall' ? descending : true);
    }
    if (inDash) { held++; hold = held <= rel; }

    prevVx = w.vx ?? prevVx;
    prevVy = w.vy;
    w.frame(hold);

    if (inDash && dashStartX != null) row.dashLen = +((w.x - dashStartX) / U).toFixed(2);
    if (!sawDone && w.x / U >= SAW_X) { row.ySaw = +(w.y / U).toFixed(2); sawDone = true; }
    if (!blueDone && Math.abs(w.x / U - BCX) <= 0.6 && Math.abs(w.y / U - BCY) <= 0.6) {
      blueDone = true; row.hitBlue = true; row.alive = !w.dead;
      break;
    }
    if (w.dead) { row.deadX = +(w.x / U).toFixed(2); row.alive = false; break; }
  }
  if (!angSet) row.note = 'never dashed';
  g.__dashOverride = undefined;
  return row;
}

console.log('黑环 @(%s,%s)  蓝环 @(%s,%s)', BKX.toFixed(1), BKY.toFixed(1), BCX.toFixed(1), BCY.toFixed(1));
for (const phase of ['rise', 'fall']) {
  for (const rel of [1, 3, 6, 9, 12, 15, 18]) {
    const r = run(phase, rel);
    console.log('%-5s rel=%-3d ang=%-8s dashLen=%-6s ySaw=%-6s hitBlue=%-5s alive=%-5s deadX=%-7s %s',
      r.phase, r.rel, r.ang == null ? '-' : r.ang, r.dashLen, r.ySaw == null ? '-' : r.ySaw,
      r.hitBlue, r.alive, r.deadX == null ? '-' : r.deadX, r.note);
  }
}
