/* 诊断:第三张盘的真实铺面(WATER)上,那个"看见危险就跳"的老机器人跑到哪儿就摔。
 * 用法:node tools/diag-water.ts [最大秒数] [死亡点数]
 * 铺面一改就一定要跑它:它到不了终点,就说明"这张图现在过不去"。
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink } from '../src/sim/world.ts';
import { P, U } from '../src/sim/constants.ts';

const SECS = Number(process.argv[2] ?? 900);
const SHOW = Number(process.argv[3] ?? 6);
const lv = WATER_CHART;
const w = new World(lv);
const trace: string[] = [];
let deaths = 0;
let printed = 0;
let maxX = 0;

for (let i = 0; i < 60 * SECS; i++) {
  if (w.dead) {
    deaths++;
    if (printed < SHOW) {
      printed++;
      const bx = w.x / U;
      console.log('--- 第 ' + deaths + ' 次死亡:x=' + bx.toFixed(2) + ' 块 y=' + (w.y / U).toFixed(2) + ' 块 '
        + w.mode + ' gdir=' + w.gdir + ' vy=' + w.vy.toFixed(2));
      console.log('    死亡点 ±6 块内的物件(按 x):');
      for (const o of lv.objects) {
        if (o.b + o.w < bx - 6 || o.b > bx + 6) continue;
        if (Math.abs(o.r - w.y / U) > 8 && o.kind !== 'portal' && o.kind !== 'speed') continue;
        const extra = [o.orb && 'orb:' + o.orb, o.pad && 'pad:' + o.pad, o.to && 'to:' + o.to,
          o.arrow && 'arrow:' + o.arrow, o.speed != null && o.kind === 'speed' ? 'speed:' + o.speed : '',
          o.rot ? 'rot:' + o.rot : '', o.frame ? o.frame : ''].filter(Boolean).join(' ');
        console.log('      b=' + o.b.toFixed(2).padStart(8) + ' r=' + o.r.toFixed(2).padStart(7) + ' w=' + o.w + ' h=' + o.h
          + '  ' + o.kind + ' ' + extra);
      }
      console.log('    最后 12 帧:');
      trace.slice(-12).forEach((t) => console.log('      ' + t));
    }
    w.respawn();
  }
  const hold = botThink(w);
  trace.push(
    'x=' + (w.x / U).toFixed(2).padStart(8) + ' y=' + (w.y / U).toFixed(2).padStart(7) +
    ' vy=' + w.vy.toFixed(1).padStart(6) + (w.onGround ? ' 地' : ' 空') + (hold ? ' 按' : ' 松') +
    ' ' + w.mode + ' gdir=' + w.gdir
  );
  w.frame(hold);
  maxX = Math.max(maxX, w.x);
  if (trace.length > 400) trace.shift();
  if (w.done) break;
}
console.log('\n总死亡 ' + deaths + ' 次;最远到 x=' + (maxX / U).toFixed(1) + '/' + lv.length + ' 块 ('
  + (maxX / (lv.length * U) * 100).toFixed(1) + '%);done=' + w.done + ';尝试 ' + w.attempts);
void P;
