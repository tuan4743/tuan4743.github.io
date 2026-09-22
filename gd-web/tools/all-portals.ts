/* 逐门测试:把玩家摆到【每一扇形态门】的 x 左边一点点,跑几帧让它触发,
 * 打印进门前后 vy / 速度档 / 重力 / 体积 / 位置 —— 覆盖全部形态门(含飞机那条 vy 减半)。
 *
 * 为什么现在能这么做:门判定已改成"越过 x 就触发"(用户口径)⇒ 不用再摆进判定盒,
 * 摆到同一列就行 ✓(以前手摆探针连触发都触发不了 ✗)。
 *
 * 跑法:cd gd-web && node tools/all-portals.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const doors = (WATER_CHART.objects as Array<Record<string, unknown>>)
  .filter((o) => o.kind === 'portal' && o.to)
  .sort((a, b) => (a.b as number) - (b.b as number));
console.log('形态门 ' + doors.length + ' 扇\n');
console.log('目标形态   门x      进门vy    出门vy    vy比例   速度档 重力 体积  判定');
let bad = 0;
for (const d of doors) {
  const w = new World(WATER_CHART);
  const bx = (d.b as number) - 1.2;
  w.reset(bx * U, 'cube', ((d.r as number) + 0.4) * U);
  w.gdir = 1; w.speedIdx = 1; w.vy = -6;                 // 给一个"正在下落"的初态,便于看 vy 怎么变
  const before = { vy: w.vy, sp: w.speedIdx, g: w.gdir, size: w.sizeMul };
  let fired = false;
  for (let i = 0; i < 12; i++) {
    w.frame(false);
    if (w.mode !== 'cube') { fired = true; break; }
  }
  const after = { vy: w.vy, sp: w.speedIdx, g: w.gdir, size: w.sizeMul, mode: w.mode };
  const ratio = before.vy !== 0 ? after.vy / before.vy : NaN;
  const isShip = after.mode === 'ship';
  const ok = fired && (isShip ? Math.abs(ratio - 0.5) < 0.15 : Math.abs(after.vy - before.vy) < 1.2);
  if (!ok) bad++;
  console.log('  ' + String(d.to).padEnd(8) + String(d.b).padStart(6) + '  '
    + before.vy.toFixed(2).padStart(7) + '  ' + after.vy.toFixed(2).padStart(7) + '  '
    + (isNaN(ratio) ? '   -  ' : ratio.toFixed(2).padStart(5)) + '   '
    + (after.sp === before.sp ? '不变' : before.sp + '→' + after.sp) + '  '
    + (after.g === before.g ? '不变' : before.g + '→' + after.g) + '  '
    + (after.size === before.size ? '不变' : before.size + '→' + after.size) + '   '
    + (!fired ? '✗ 没触发' : isShip ? (Math.abs(ratio - 0.5) < 0.15 ? '✓ 飞机 vy 减半' : '✗ 飞机 vy 比例 ' + ratio.toFixed(2)) : '✓ vy 基本不变'));
}
console.log('\n不合格 ' + bad + ' / ' + doors.length);
