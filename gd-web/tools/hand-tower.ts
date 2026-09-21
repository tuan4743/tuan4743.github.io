/* 定点:塔段入口那一块蓝板到底能把人抬多高?(x=546.5 y=8.1 的蓝板 → 塔的第二层在 y=10)
 * 为什么:实测正规路线在 x=606 的 UFO 门前卡死 —— 它走的是地面那条死路;
 * 要上塔必须先靠这块蓝板从 y=8 抬到 y≥10(第二层楼板的【底面】)。抬升高度 = (12.8×flipMul)²/(2×g)。
 * 用法:cd gd-web && node tools/hand-tower.ts [flipmul] [起始x] [起始y] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const FM = Number(process.argv[2] ?? 0.5);
const X0 = Number(process.argv[3] ?? 541);
const Y0 = Number(process.argv[4] ?? 8);

const w = new World(WATER_CHART, X0 * U, Y0 * U);
w.reset(X0 * U, 'cube', Y0 * U);
w.speedIdx = 1;
w.flipMul = FM;
w.onGround = true;

console.log('flipMul = ' + FM + ' · 蓝板净力度 = ' + (12.8 * FM).toFixed(2) + ' 单位/帧 · 起跳前水平速度 = '
  + (5.193).toFixed(3));
let peak = -Infinity, peakX = 0, flipped = false, flipX = 0, flipY = 0;
for (let f = 0; f < 120 && !w.dead && !w.done; f++) {
  const before = w.gdir;
  w.frame(false);                       // 一路不按:靠蓝板自己生效
  if (w.gdir !== before && !flipped) { flipped = true; flipX = w.x / U; flipY = w.y / U; }
  if (w.y > peak) { peak = w.y; peakX = w.x / U; }
  if (f % 4 === 0 || (flipped && f < flipFrameMax(f))) {
    console.log('  帧 ' + String(f).padStart(3) + ' x=' + (w.x / U).toFixed(2).padStart(7)
      + ' y=' + (w.y / U).toFixed(2).padStart(7) + ' vy=' + (w.vy / U).toFixed(3).padStart(7)
      + ' gdir=' + w.gdir + (w.onGround ? ' 地' : ''));
  }
}
function flipFrameMax(_f: number) { return 0; }
console.log('结果:' + (w.dead ? '✗ 死了' : '活着') + ' · 最高 y=' + (peak / U).toFixed(2) + '(x=' + peakX.toFixed(2) + ')'
  + (flipped ? ' · 翻重力发生在 x=' + flipX.toFixed(2) + ' y=' + flipY.toFixed(2) : ' · ★ 蓝板根本没生效'));
console.log('塔的第二层楼板底面在 y=10.0 —— 抬不到 10 就上不去塔。');
