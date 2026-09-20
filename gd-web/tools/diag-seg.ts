/* 诊断:从铺面中间某一块【地面上】出发,用搜索式机器人往前试算,看到底能走到哪。
 * 用法:cd gd-web && node tools/diag-seg.ts <起始块x> [决定次数] [静默]
 *
 * 为什么要它:整关从头跑一遍太慢,而"某一段过不过得去"才是改判定时真正要问的问题
 * (比如把线框改成实心之后,x=216~250 那一段还走不走得通)。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink, type WorldSnap } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const START = Number(process.argv[2] ?? 210);
const DEC = Number(process.argv[3] ?? 600);
const QUIET = process.argv[4] === '1';
const HOLDS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 26, 34, 44, 60, 90];
const HORIZON = 75;

const lv = WATER_CHART;
const w = new World(lv);
w.windowed = true;
w.x = START * U;
w.y = 0.5 * U;
w.vy = 0;
w.onGround = true;
w.dead = false;
w.checkX = w.x;
w.checkY = w.y;

function trial(s: WorldSnap, holdFrames: number, rest: number, mode: 'idle' | 'bot') {
  w.restore(s);
  for (let i = 0; i < holdFrames; i++) { if (w.dead || w.done) break; w.frame(true); }
  for (let i = 0; i < rest; i++) { if (w.dead || w.done) break; w.frame(mode === 'bot' ? botThink(w) : false); }
  return { x: w.x, dead: w.dead, done: w.done };
}
function decide(s: WorldSnap) {
  for (let horizon = HORIZON; horizon <= HORIZON * 4; horizon *= 2) {
    let best: { hold: number; mode: 'idle' | 'bot'; x: number } | null = null;
    let farDead = { hold: 0, mode: 'idle' as const, x: s.x };
    const consider = (hold: number, mode: 'idle' | 'bot') => {
      const r = trial(s, hold, horizon, mode);
      if (r.dead) { if (r.x > farDead.x) farDead = { hold, mode, x: r.x }; return; }
      if (!best || r.x > best.x + 1e-6) best = { hold, mode, x: r.x };
    };
    consider(0, 'idle');
    for (const k of HOLDS) { consider(k, 'idle'); if (!best) consider(k, 'bot'); }
    if (best) return best;
    if (horizon === HORIZON * 4) return farDead;
  }
  return { hold: 0, mode: 'idle' as const, x: s.x };
}

let dead = 0;
let maxX = w.x;
const deaths: number[] = [];
for (let d = 0; d < DEC; d++) {
  if (w.dead) {
    dead++;
    deaths.push(Math.round(w.x / U * 10) / 10);
    if (deaths.length <= 4 && !QUIET) {
      const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize, j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
      const hit = [...w.nearHazards, ...w.nearSolids].find((b) => i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1);
      console.log('  第 ' + dead + ' 次死亡 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
        + (hit ? '  撞到 ' + hit.o.kind + ' b=' + hit.o.b.toFixed(2) + ' r=' + hit.o.r.toFixed(2) : '  没有相交盒子'));
    }
    w.respawn();
    continue;
  }
  const snap = w.snapshot();
  const plan = decide(snap);
  w.restore(snap);
  const holdFrames = Math.min(plan.hold, 3);
  for (let i = 0; i < holdFrames; i++) w.frame(true);
  for (let i = holdFrames; i < 3; i++) w.frame(plan.mode === 'bot' ? botThink(w) : false);
  maxX = Math.max(maxX, w.x);
}
console.log('从 x=' + START + ' 出发:' + DEC + ' 次决定 → 最远 x=' + (maxX / U).toFixed(1) + ' 块,死亡 ' + dead + ' 次'
  + (deaths.length ? '(前几处:' + deaths.slice(0, 6).join(', ') + ')' : ''));
