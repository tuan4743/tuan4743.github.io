/* 诊断 2:盯住第一次死亡前后的逐帧轨迹(看清"跳没跳、什么时候落的") */
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink } from '../src/sim/world.ts';
import { P, U } from '../src/sim/constants.ts';

const lv = generateLevel({ seed: 20260913 });
// 只留起点附近那一段,方便盯着看
const w = new World(lv);
const trace: string[] = [];
for (let i = 0; i < 60 * 60; i++) {
  const front = w.x + P.box;
  const near = [...w.hazards.filter((h) => h.y0 < 2 * U), ...w.solids.filter((s) => s.y1 <= 2 * U)]
    .filter((o) => o.x1 > front - 60)
    .sort((a, b) => a.x0 - b.x0)[0];
  const hold = botThink(w);
  trace.push(
    'x=' + (w.x / U).toFixed(2).padStart(6) + ' y=' + (w.y / U).toFixed(2).padStart(5) +
    ' vy=' + w.vy.toFixed(1).padStart(5) + (w.onGround ? ' 地' : ' 空') + (hold ? ' 按' : ' 松') +
    ' 最近障碍:' + (near ? (near.x0 / U).toFixed(1) + '~' + (near.x1 / U).toFixed(1) + ' Δ远=' + ((near.x1 - front) / U).toFixed(2) : '无')
  );
  w.frame(hold);
  if (w.dead) {
    console.log('第一次死亡:x=' + (w.x / U).toFixed(2) + ' 块 y=' + (w.y / U).toFixed(3) + ' 块');
    console.log('死亡前 26 帧:');
    trace.slice(-26).forEach((t) => console.log('  ' + t));
    break;
  }
  if (trace.length > 400) trace.shift();
}
