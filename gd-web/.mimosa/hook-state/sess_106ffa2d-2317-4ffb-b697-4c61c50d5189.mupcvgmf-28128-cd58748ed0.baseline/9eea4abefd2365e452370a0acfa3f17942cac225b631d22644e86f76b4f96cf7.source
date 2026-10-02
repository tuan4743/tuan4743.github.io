/* 诊断:盯住机器人第一次死亡 —— 逐帧轨迹 + 死亡点附近的物件清单。
 * 用法:node tools/diag-bot.ts [seed]
 * 铺面一改就一定要跑它:红色的是"必死处",红了就不许提交。
 */
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink } from '../src/sim/world.ts';
import { P, U } from '../src/sim/constants.ts';

const seed = Number(process.argv[2] ?? 20260913);
const lv = generateLevel({ seed });
const w = new World(lv);
const trace: string[] = [];
let deaths = 0;
let printed = 0;

for (let i = 0; i < 60 * 1200; i++) {
  if (w.dead) {
    deaths++;
    if (printed < 3) {
      printed++;
      const bx = w.x / U;
      console.log('--- 第 ' + deaths + ' 次死亡:x=' + bx.toFixed(2) + ' 块 y=' + (w.y / U).toFixed(3) + ' 块 vy=' + w.vy.toFixed(2));
      console.log('    死亡点 ±8 块内的物件:');
      for (const o of lv.objects) {
        if (o.b + o.w < bx - 8 || o.b > bx + 8) continue;
        const extra = [o.orb && 'orb:' + o.orb, o.pad && 'pad:' + o.pad, o.to && 'to:' + o.to, o.speed != null && o.kind === 'speed' ? 'speed:' + o.speed : '']
          .filter(Boolean).join(' ');
        console.log('      b=' + o.b.toFixed(2).padStart(7) + ' r=' + o.r + ' w=' + o.w + ' h=' + o.h + '  ' + o.kind + (o.need ? '(need)' : '') + ' ' + extra);
      }
      console.log('    最后 16 帧:');
      trace.slice(-16).forEach((t) => console.log('      ' + t));
    }
    w.respawn();
  }
  const front = w.x + P.box;
  const near = [...w.hazards.filter((h) => h.y0 < 2 * U), ...w.solids.filter((s) => s.y1 <= 2 * U)]
    .filter((o) => o.x1 > front - 60)
    .sort((a, b) => a.x0 - b.x0)[0];
  const hold = botThink(w);
  trace.push(
    'x=' + (w.x / U).toFixed(2).padStart(7) + ' y=' + (w.y / U).toFixed(2).padStart(5) +
    ' vy=' + w.vy.toFixed(1).padStart(5) + (w.onGround ? ' 地' : ' 空') + (hold ? ' 按' : ' 松') +
    ' 最近:' + (near ? (near.x0 / U).toFixed(1) + '~' + (near.x1 / U).toFixed(1) + ' Δ=' + ((near.x1 - front) / U).toFixed(2) : '无')
  );
  w.frame(hold);
  if (trace.length > 400) trace.shift();
  if (w.done) break;
}
console.log('总死亡 ' + deaths + ' 次;到达 x=' + (w.x / U).toFixed(1) + '/' + lv.length.toFixed(1) + ' 块;done=' + w.done);
