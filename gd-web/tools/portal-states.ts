/* 形态门进门状态表:每次【形态变化】的那一帧前后,把 vy / 位置 / 速度档 / 重力 / 体积 打出来。
 *
 * 判据(反编译 gdp@2.11):
 *   · 形态门【只改形态】—— 速度档、重力方向、位置都不该动;
 *   · 唯一例外:进【飞机】形态时 m_dYVel /= 2(playerobject.cpp:540)。
 * ★ 坑:进门那一帧重力照样在积分 ⇒ 不能拿 dvy != 0 当"门改了速度"(第一版就这么误判了)。
 *   这里把"这一帧本该有的重力增量"扣掉,剩下的才归门管。
 *
 * 跑法:cd gd-web && node tools/portal-states.ts [秒数]
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink } from '../src/sim/world.ts';
import { U, cubeGravityOf } from '../src/sim/constants.ts';

const secs = Number(process.argv[2] ?? 400);
const w = new World(WATER_CHART);
w.god = true;
let prevMode = w.mode, prevVy = w.vy, prevSpeed = w.speedIdx, prevGdir = w.gdir;
let n = 0;
console.log('形态 从→到      进门x     vy 前 → 后        dvy      扣掉重力后   速度档 重力  判定');
for (let i = 0; i < 60 * secs && !w.done; i++) {
  w.frame(botThink(w));
  if (w.mode !== prevMode) {
    n++;
    const dvy = w.vy - prevVy;
    const gExpect = -cubeGravityOf(w.speedIdx, w.mode) * 0.9;
    const residual = dvy - gExpect;
    const ship = w.mode === 'ship';
    const expectHalf = ship && Math.abs(prevVy) > 1e-6;
    const okHalf = expectHalf ? Math.abs(w.vy - prevVy / 2) < Math.max(0.01, Math.abs(prevVy) * 0.02) : true;
    const okKeep = Math.abs(residual) < 0.35;
    console.log('  ' + (prevMode + '→' + w.mode).padEnd(11)
      + (w.x / U).toFixed(1).padStart(7)
      + '  ' + prevVy.toFixed(3).padStart(7) + ' → ' + w.vy.toFixed(3).padStart(7)
      + '  ' + dvy.toFixed(3).padStart(7)
      + '  ' + residual.toFixed(3).padStart(7)
      + '   ' + (w.speedIdx === prevSpeed ? '不变' : prevSpeed + '→' + w.speedIdx)
      + '  ' + (w.gdir === prevGdir ? '不变' : prevGdir + '→' + w.gdir)
      + '   ' + (ship ? (okHalf ? 'OK 飞机 vy 减半' : 'BAD 飞机 vy 没减半') : (okKeep ? 'OK 门没动 vy' : 'BAD 门改了 vy')));
    if (n >= 20) break;
  }
  prevMode = w.mode; prevVy = w.vy; prevSpeed = w.speedIdx; prevGdir = w.gdir;
}
console.log('共 ' + n + ' 次形态切换(只有 cube→ship 那一类允许 vy 减半,别的一律不许动 vy)');
