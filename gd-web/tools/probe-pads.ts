/* 定点:塔段(540 起)一路不按时,到底哪块蓝板在什么时候生效、重力什么时候翻。
 * 为什么:round-17 的手放轨迹里,人在 x≈553.6 / y≈15.5 时重力翻回了 +1,
 *   而按我们给 (554.5,16.9) rot=180 那块蓝板的盒子(25×6 单位)y 上并不该相交 ——
 *   这条直接决定"塔能不能按设计爬上去",必须逐帧核。
 * 用法:cd gd-web && node tools/probe-pads.ts [起始x] [起始y] [看多少帧] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const X0 = Number(process.argv[2] ?? 540);
const Y0 = Number(process.argv[3] ?? 8);
const N = Number(process.argv[4] ?? 140);

const w = new World(WATER_CHART, X0 * U, Y0 * U);
w.reset(X0 * U, 'cube', Y0 * U);
w.speedIdx = 1; w.gdir = 1; w.vy = 0; w.onGround = true;

console.log('附近的蓝板(id 67)与其它 pad:');
for (const b of w.pads) {
  const bx = (b.x0 + b.x1) / 2 / U;
  if (bx < X0 - 2 || bx > X0 + 25) continue;
  console.log('  pad x=' + bx.toFixed(2) + ' y=' + ((b.y0 + b.y1) / 2 / U).toFixed(2)
    + ' 盒 x[' + (b.x0 / U).toFixed(2) + ',' + (b.x1 / U).toFixed(2) + '] y['
    + (b.y0 / U).toFixed(2) + ',' + (b.y1 / U).toFixed(2) + '] rot=' + (b.o.rot ?? 0)
    + ' pad=' + (b.o.pad ?? '?'));
}

let armedPads = 0, lastGdir = w.gdir, armedPorts = 0;
/* ★ 可选:在 x ≥ JUMPAT 时按住 JUMPLEN 帧(用来手搓"垫板链里那一下起跳")。
   实测塔段一路不按会在 x≈559.39 死掉 —— 那一下必须跳。
   第 5 个参数支持逗号列表("555:6,576:8"),按顺序各起跳一次,用于多段手搓。 */
const jumps: Array<{ x: number; len: number; done: boolean }> =
  String(process.argv[5] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split(':');
      return { x: Number(a), len: Number(b ?? process.argv[6] ?? 6), done: false };
    })
    .filter((j) => Number.isFinite(j.x) && j.x > 0);
let jumpFrames = 0, jumpIdx = 0;
/* 死前轨迹环:判断"撞侧面死"还是"扎尖刺",靠最后十几帧的 vy/onGround 就够了 */
const trail: string[] = [];
for (let f = 0; f < N && !w.dead && !w.done; f++) {
  /* 起跳状态机:上一次按满(或还没起跳)时,才轮到下一段阈值。
     注意 jumpIdx 只在"确实起跳"时前进,否则会被同一段重复触发。 */
  if (jumpFrames <= 0 && jumpIdx < jumps.length && w.x / U >= jumps[jumpIdx].x) {
    jumpFrames = jumps[jumpIdx].len; jumpIdx++;
  }
  const hold = jumpFrames-- > 0;
  w.frame(hold);
  trail.push('  帧 ' + String(f).padStart(3) + ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
    + ' vy=' + (w.vy / U).toFixed(2) + (w.onGround ? ' 地' : '') + (hold ? ' [按]' : '')
    + (w.dead ? ' ← 死' : ''));
  if (trail.length > 14) trail.shift();
  const s = w.snapshot();
  const pads = s.sets[6] as unknown as Array<{ x0: number; x1: number; y0: number; y1: number; o: { rot?: number; pad?: string } }>;
  const grads = (s.sets[4] as unknown as unknown[]).length;
  while (armedPads < pads.length) {
    const b = pads[armedPads];
    console.log('  帧 ' + String(f).padStart(3) + ' ★板生效 x=' + (((b.x0 + b.x1) / 2) / U).toFixed(2)
      + ' y=' + (((b.y0 + b.y1) / 2) / U).toFixed(2) + ' rot=' + (b.o.rot ?? 0) + ' pad=' + (b.o.pad ?? '?')
      + ' · 人 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' → gdir ' + lastGdir + '→' + w.gdir);
    armedPads++;
  }
  /* ★ 形态门(方块/飞船/UFO/波浪)是否吃到 —— 塔顶那个 UFO 门是正规路线的卡点 */
  const ports = s.sets[1] as unknown as Array<{ x0: number; x1: number; y0: number; y1: number; o: { to?: string } }>;
  while (armedPorts < ports.length) {
    const b = ports[armedPorts];
    console.log('  帧 ' + String(f).padStart(3) + ' ◆形态门生效 to=' + (b.o.to ?? '?')
      + ' x=' + (((b.x0 + b.x1) / 2) / U).toFixed(2) + ' y=' + (((b.y0 + b.y1) / 2) / U).toFixed(2)
      + ' · 人 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' mode=' + w.mode);
    armedPorts++;
  }
  if (w.gdir !== lastGdir) {
    console.log('  帧 ' + String(f).padStart(3) + ' ◆重力翻转 → ' + w.gdir
      + ' · 人 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' vy=' + (w.vy / U).toFixed(2)
      + ' · 已生效重力门 ' + grads);
    lastGdir = w.gdir;
  }
}
console.log('结束:x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' gdir=' + w.gdir
  + (w.dead ? ' 【死了】' : w.onGround ? ' 地' : '') + ' · 生效板 ' + armedPads + ' 个');

/* ★ 死了就报凶手:x±3 / y±3 格内的实心、尖刺、圆锯。
   为什么:塔段垫板链停在 x≈579.81 一直死,不查清是谁挡的就只能瞎扫。 */
function near(b: { x0: number; x1: number; y0: number; y1: number }) {
  return b.x1 / U > w.x / U - 3 && b.x0 / U < w.x / U + 3
    && b.y1 / U > w.y / U - 3 && b.y0 / U < w.y / U + 3;
}
if (w.dead) {
  console.log('死前轨迹:');
  for (const t of trail) console.log(t);

  const show = (tag: string, b: { x0: number; x1: number; y0: number; y1: number; o: { id?: number; rot?: number } }) =>
    console.log('  ' + tag + ' id=' + (b.o.id ?? '?') + ' rot=' + (b.o.rot ?? 0)
      + ' x[' + (b.x0 / U).toFixed(2) + ',' + (b.x1 / U).toFixed(2) + '] y['
      + (b.y0 / U).toFixed(2) + ',' + (b.y1 / U).toFixed(2) + ']');
  for (const b of w.solids) if (near(b)) show('实心', b);
  for (const b of w.hazards) if (near(b)) show('尖刺', b);
  for (const c of w.circles) if (near(c.box)) console.log('  圆锯 id=' + (c.o.id ?? '?')
    + ' 圆心(' + (c.cx / U).toFixed(2) + ',' + (c.cy / U).toFixed(2) + ') r=' + (c.r / U).toFixed(2));
  for (const b of w.floors) if (near(b)) show('地面', b);
}

