/* 一次性:打印某一段的逐帧状态(看清"跳在哪、环有没有被踩到") */
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink } from '../src/sim/world.ts';
import { P, U } from '../src/sim/constants.ts';

const lv = generateLevel({ seed: Number(process.argv[2] ?? 20260913) });
const a = Number(process.argv[3] ?? 765), b = Number(process.argv[4] ?? 783);
const w = new World(lv);
let prevGround = w.onGround, prevFresh = w.pressFresh, prevVy = w.vy;
for (let i = 0; i < 60 * 200 && !w.done; i++) {
  if (w.dead) { console.log('DEAD at x=' + (w.x / U).toFixed(2)); w.respawn(); }
  const hold = botThink(w);
  const inWin = w.x / U >= a && w.x / U <= b;
  if (inWin) {
    const events: string[] = [];
    if (prevGround && !w.onGround) events.push('起跳');
    if (!prevGround && w.onGround) events.push('落地');
    if (!prevFresh && w.pressFresh) events.push('按下');
    for (const o of w.orbs) {
      if (Math.abs(o.x0 / U - (w.x / U)) < 0.2 && !events.includes('过环')) events.push('过环@' + (o.x0 / U).toFixed(2));
    }
    console.log(
      'x=' + (w.x / U).toFixed(2).padStart(7) + ' y=' + (w.y / U).toFixed(2).padStart(6) +
      ' vy=' + w.vy.toFixed(1).padStart(5) + (w.onGround ? ' 地' : ' 空') + (hold ? ' 按' : ' 松') +
      (w.pressFresh ? ' [fresh]' : '') + '  ' + events.join(' ')
    );
  }
  prevGround = w.onGround; prevFresh = w.pressFresh; prevVy = w.vy;
  w.frame(hold);
  void prevVy;
}
