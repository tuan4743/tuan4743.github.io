/* 定点核验:x≈1040~1062 那段"波浪贴着方块门下沿过"的走廊。
 * 为什么要它:用户在原版编辑器里实测 —— 4 速下贴着方块传送门最下面过,速度门生效、锯片不碰;
 * 而我们的模拟以前判"无解"(门缝 0.29 块)。原因是锯片判定用错了表:
 * 锯片族的判定是【圆】(OpenGD `_pHitboxRadius` + `playlayer.cpp:1491-1503`),不是 85×44 矩形。
 * 这个脚本做三件事:
 *   ① 把这一段走廊按列算出来(圆的禁区取补集),直观看到门缝有多宽;
 *   ② 用手写的"瞄准器"飞一条波浪路线(构造解,不是搜出来的),看速度门到底生不生效;
 *   ③ 换几种"进场姿态"各飞一次 —— 窗口宽不宽、什么姿态会被锯片咬到,一眼能看出来。
 * 用法:cd gd-web && node tools/check-wall.ts [--sawbase=1] [--from=1040] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import { circleRadiusOf } from '../src/sim/gdids.ts';

const arg = (k: string, d: string) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const FROM = Number(arg('from', '1040'));
const SAWBASE = arg('sawbase', '0') === '1';
const OPTS = { sawUnscaled: SAWBASE };

const w0 = new World(WATER_CHART, undefined, undefined, OPTS);
console.log('圆判定:' + (SAWBASE ? '不乘缩放(OpenGD 原样)' : '乘缩放(默认)') + ' · 本关圆 ' + w0.circles.length + ' 个');
for (const c of w0.circles) {
  const bx = c.cx / U;
  if (bx < 1048 || bx > 1058) continue;
  console.log('  圆 x=' + bx.toFixed(2) + ' y=' + (c.cy / U).toFixed(2)
    + ' r=' + (c.r / U).toFixed(3) + ' 块(id=' + c.o.id + ')'
    + ' → 上下 ' + ((c.cy - c.r) / U).toFixed(2) + ' ~ ' + ((c.cy + c.r) / U).toFixed(2));
}

/* ② 手写瞄准器:波浪的 vy = ±vx(反编译口径),所以"按住/松开"就是选上/下,
   一个 bang-bang 控制器盯住目标高度线就能贴线飞。过了方块门就撒手交给物理。 */
function fly(targetY: (x: number) => number, startY: number, label: string) {
  const w = new World(WATER_CHART, FROM * U, startY * U, OPTS);
  w.reset(FROM * U, 'wave', startY * U);
  w.speedIdx = 4;                                  // 4 速(968 那个速度门)
  const trace: string[] = [];
  let armedSpeed = false, armedCube = false, minSawGap = Infinity;
  for (let f = 0; f < 1500 && !w.dead && !w.done; f++) {
    const hold = w.mode === 'wave' ? w.y / U < targetY(w.x / U) : w.vy * w.gdir < 0;
    const before = w.speedIdx;
    w.frame(hold);
    if (before !== 2 && w.speedIdx === 2) armedSpeed = true;
    if (w.mode === 'cube') armedCube = true;
    for (const c of w.circles) {
      if (Math.abs(c.cx - w.x) > 6 * U) continue;
      const out = w.outer();
      const dx = c.cx < out.x0 ? out.x0 - c.cx : (c.cx > out.x1 ? c.cx - out.x1 : 0);
      const dy = c.cy < out.y0 ? out.y0 - c.cy : (c.cy > out.y1 ? c.cy - out.y1 : 0);
      const gap = (Math.hypot(dx, dy) - c.r) / U;
      if (gap < minSawGap) minSawGap = gap;
    }
    const bx = w.x / U;
    if (bx >= 1044 && trace.length < 90) {
      trace.push(bx.toFixed(2) + ',' + (w.y / U).toFixed(2) + w.mode[0] + (hold ? 'H' : '.') + '速' + w.speedIdx);
    }
  }
  console.log('\n【' + label + '】起于 y=' + startY + ' 目标 ' + targetY(FROM).toFixed(2) + '→' + targetY(1054.6).toFixed(2)
    + ' → ' + (w.dead ? '✗ 死了' : w.done ? '✓ 通关' : '活着')
    + ' 走到 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
    + ' 形态=' + w.mode + ' 速度档=' + w.speedIdx
    + ' | 方块门' + (armedCube ? '✓' : '✗') + ' 速度门(2 档)' + (armedSpeed ? '✓' : '✗')
    + ' | 离锯片最近 ' + (minSawGap === Infinity ? '—' : minSawGap.toFixed(3) + ' 块'));
  console.log('  逐帧(x,y底边,形态,H=按住,速N):' + trace.join(' '));
  return { alive: !w.dead, armedSpeed, armedCube, minSawGap };
}

/* ③ 换几种"进场姿态":平飞(进门时在下坠) vs 上升中撞门(进门后还会先升一段) */
const aims: Array<[string, (x: number) => number, number]> = [
  ['平飞 24.4(进门在下坠)', () => 24.4, 24.4],
  ['平飞 25.2', () => 25.2, 25.2],
  ['缓升 24.5→25.8', (x) => 24.5 + (x - FROM) * 0.086, 24.5],
  ['陡升 24.5→26.6', (x) => 24.5 + (x - FROM) * 0.14, 24.5],
];
let ok = 0;
for (const [label, fn, sy] of aims) {
  const r = fly(fn, sy, label);
  if (r.alive && r.armedSpeed && r.armedCube) ok++;
}
console.log('\n结论:' + ok + '/' + aims.length + ' 条进场姿态做到【方块门生效 + 速度门生效 + 活着】');

/* ① 走廊:逐列算【玩家中心合法 y 区间】。禁区 = 圆心到玩家外框最近距离 < r,
   玩家中心 (px,py)、外框半宽/半高 0.5:对 |px−cx| = dx 的列,禁区是 |py−cy| < sqrt(r²−max(0,dx−0.5)²)+0.5。 */
console.log('\n走廊(玩家【中心】的合法区间,只算圆;x=1051~1056):');
for (let i = 0; i <= 10; i++) {
  const bx = 1051 + i * 0.5;
  const bands: Array<[number, number]> = [];
  for (const c of w0.circles) {
    const cxB = c.cx / U, cyB = c.cy / U, rB = c.r / U;
    const dxEff = Math.max(0, Math.abs(bx - cxB) - 0.5);
    if (dxEff >= rB) continue;
    const m = Math.sqrt(rB * rB - dxEff * dxEff) + 0.5;
    bands.push([cyB - m, cyB + m]);
  }
  bands.sort((a, b) => a[0] - b[0]);
  const free: string[] = [];
  let cur = 16;
  for (const [lo, hi] of bands) {
    if (lo > cur) free.push(cur.toFixed(2) + '~' + Math.min(lo, 32).toFixed(2));
    cur = Math.max(cur, hi);
    if (cur >= 32) break;
  }
  if (cur < 32) free.push(cur.toFixed(2) + '~32');
  const tall = free.map((s) => Number(s.split('~')[1]) - Number(s.split('~')[0])).reduce((a, b) => Math.max(a, b), 0);
  console.log('  x=' + bx.toFixed(1) + '  合法中心 y:' + (free.length ? ' ' + free.join(' , ') : ' 全被挡')
    + '   最宽 ' + tall.toFixed(2) + ' 块');
}
console.log('\n圆表关键行:1705→' + circleRadiusOf(1705) + ' 单位 = ' + (circleRadiusOf(1705)! / 30).toFixed(3)
  + ' 块;1706→' + circleRadiusOf(1706) + ' 单位 = ' + (circleRadiusOf(1706)! / 30).toFixed(3) + ' 块');
