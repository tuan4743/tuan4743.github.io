/* 定点:冲刺箭头 / 紫色上跳箭头到底能不能用。
 * 为什么:用户实测"紫色冲刺箭头没用,无法交互"。紫色(3004, tp=1)在我们的实现里走 `spiderJump()`
 *   —— 它只会往重力反方向【找 2~4.5 块内最近的面】贴上去;找不到面就什么都不做(而且箭头已经被消耗)。
 *   本工具把每个箭头周围的几何(上下最近的面各在多少块外)与"真按下去会怎样"都打出来,
 *   用来判定到底是【几何上够不到】还是【实现有 bug】。
 * 用法:cd gd-web && node tools/probe-arrow.ts [x0] [x1]             ← 只做几何体检
 *       node tools/probe-arrow.ts [x0] [x1] --try=<起点x,起点y,形态>  ← 从该状态跑 60 帧,第 1 帧就按
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const X0 = Number(process.argv[2] ?? 2100);
const X1 = Number(process.argv[3] ?? 2600);
const TRY = (process.argv.find((a) => a.startsWith('--try=')) ?? '').slice(6);

const w = new World(WATER_CHART);
const arrows = w.arrows.filter((b) => b.o.b + 1 >= X0 && b.o.b <= X1);
console.log('箭头 ' + arrows.length + ' 个(区间 ' + X0 + '~' + X1 + ')');

/** 从 (x,y) 往 gdir 的反方向找最近的面:返回距离(块) */
function nearestSurface(x: number, y: number, gdir: number) {
  const box = 30;
  const top = y + box;
  let up: number | null = null, down: number | null = null;
  for (const s of w.solids) {
    if (x + box <= s.x0 || x >= s.x1) continue;
    if (s.y0 >= top) up = up === null ? s.y0 : Math.min(up, s.y0);          // 头顶的面(底面)
    if (s.y1 <= y) down = down === null ? s.y1 : Math.max(down, s.y1);      // 脚下的面(顶面)
  }
  for (const f of w.floors) {
    if (x + box <= f.x0 || x >= f.x1) continue;
    if (f.y0 >= top) up = up === null ? f.y0 : Math.min(up, f.y0);
    if (f.y1 <= y) down = down === null ? f.y1 : Math.max(down, f.y1);
  }
  return {
    up: up === null ? null : (up - top) / U,
    down: down === null ? null : (y - down) / U,
    want: gdir > 0 ? (up === null ? null : (up - top) / U) : (down === null ? null : (y - down) / U),
  };
}

console.log('x(块)  y(块)  种类      rot   盒尺寸        头顶最近面  脚下最近面  spider 够得到吗(60~135 单位)');
for (const b of arrows) {
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const near = nearestSurface(cx, cy, 1);
  const reach = near.want === null ? null : near.want * U;
  const okReach = reach !== null && reach >= 60 && reach <= 135;
  console.log('  ' + (b.o.b).toFixed(0).padStart(5) + '  ' + (((b.o.r) + 0.5)).toFixed(1).padStart(6)
    + '  ' + String(b.o.arrow ?? '?').padEnd(8) + String(b.o.rot ?? 0).padStart(4)
    + '  ' + (((b.x1 - b.x0) / U)).toFixed(2) + '×' + (((b.y1 - b.y0) / U)).toFixed(2)
    + '   ' + (near.up === null ? '  —  ' : near.up.toFixed(2).padStart(5))
    + '      ' + (near.down === null ? '  —  ' : near.down.toFixed(2).padStart(5))
    + '   ' + (reach === null ? ' — ' : reach.toFixed(0).padStart(4)) + ' 单位  ' + (okReach ? '✓' : '✗'));
}

if (TRY) {
  const [tx, ty, mode] = TRY.split(',');
  const w2 = new World(WATER_CHART);
  w2.windowed = true;
  w2.reset(Number(tx) * U, (mode as 'cube') ?? 'cube', Number(ty) * U);
  w2.speedIdx = Number((process.argv.find((a) => a.startsWith('--speed=')) ?? '--speed=1').slice(8));
  w2.gdir = 1; w2.vy = 0;
  /* ★ 默认【空中起手】:第一版我把 onGround 设成 true,于是这一帧先被"方块起跳"吃掉了 pressFresh,
     箭头永远轮不到(实测 6 个起始高度全都"0 个生效"),差点误判成箭头坏了。 */
  w2.onGround = process.argv.includes('--ground');
  console.log('\n从 (' + tx + ',' + ty + ') 形态 ' + (mode ?? 'cube') + (w2.onGround ? ' 地面' : ' 空中') + ' 起跑,第 1 帧起按住:');
  const n0 = w2.arrows.length;
  let armed = 0;
  for (let f = 0; f < 90 && !w2.dead && !w2.done; f++) {
    w2.frame(true);
    const s = w2.snapshot();
    const armedNow = (s.sets[7] as unknown as unknown[]).length;      // sets[7] = armedArrows
    if (armedNow > armed) { armed = armedNow; console.log('   帧 ' + f + ' ★箭头生效 → x=' + (w2.x / U).toFixed(2) + ' y=' + (w2.y / U).toFixed(2) + ' vy=' + (w2.vy / U).toFixed(2) + ' gdir=' + w2.gdir); }
    if (f % 10 === 0 || w2.dead) console.log('   帧 ' + String(f).padStart(3) + ' x=' + (w2.x / U).toFixed(2) + ' y=' + (w2.y / U).toFixed(2) + ' vy=' + (w2.vy / U).toFixed(2) + ' gdir=' + w2.gdir + (w2.dead ? ' ✗死' : ''));
  }
  void n0;
  console.log('   → x=' + (w2.x / U).toFixed(2) + ' y=' + (w2.y / U).toFixed(2) + ' gdir=' + w2.gdir
    + (w2.dead ? ' 【死了】' : '') + ' · 生效箭头 ' + armed + ' 个');
}
