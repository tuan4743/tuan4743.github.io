/* 复活后音乐时间对不对:把每个存档点的 x 按"块→秒"时间轴算一遍,并和"朴素积分"对照。
 * 背景:main.ts 复活时用 tAtX(checkX) 去 seek 音乐;用户报"复活后音乐位置错误、采音全乱"。
 * 判据:两个独立算法必须给出同一个时间;差得多 = 时间轴本身有问题。
 * 跑法:cd gd-web && node tools/music-axis.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { makeRealTimeAxis } from '../src/sim/level.ts';
import { vxOf, U } from '../src/sim/constants.ts';

const axis = makeRealTimeAxis(WATER_CHART);
const TOTAL = axis(WATER_CHART.length);

/* 朴素法:按 x 逐格扫,遇到速度门就换档,累加 dx/v */
function naive(xBlocks: number): number {
  const speeds = (WATER_CHART.objects as Array<Record<string, unknown>>)
    .filter((o) => o.kind === 'speed')
    .map((o) => ({ b: o.b as number, spd: (o.speed as number) ?? 1 }))
    .sort((a, b) => a.b - b.b);
  let t = 0, cur = 1;
  for (let x = 0; x < xBlocks; x += 0.5) {
    for (const s of speeds) if (x >= s.b && s.b > x - 0.5) cur = s.spd;
    const v = vxOf(Math.max(0, Math.min(4, cur))) * 60;     // 单位/秒
    t += (0.5 * U) / v;
  }
  return t;
}

console.log('关卡长 ' + WATER_CHART.length + ' 格 · 时间轴全长 ' + TOTAL.toFixed(2) + ' 秒');
console.log('朴素积分全长 ' + naive(WATER_CHART.length).toFixed(2) + ' 秒\n');
console.log('存档点     x        时间轴t     朴素t      差(秒)');
const chks = (WATER_CHART.objects as Array<Record<string, unknown>>)
  .filter((o) => o.kind === 'check').sort((a, b) => (a.b as number) - (b.b as number));
for (const c of chks) {
  const x = c.b as number;
  const a = axis(x), n = naive(x);
  console.log('   #' + String(chks.indexOf(c) + 1).padEnd(2) + String(x).padStart(8)
    + a.toFixed(2).padStart(11) + n.toFixed(2).padStart(11) + (a - n).toFixed(2).padStart(10)
    + (Math.abs(a - n) < 0.5 ? '  ✓' : '  ✗ 差得多'));
}
console.log('\n速度门位置:' + (WATER_CHART.objects as Array<Record<string, unknown>>)
  .filter((o) => o.kind === 'speed').map((o) => 'x=' + o.b + '(spd=' + o.speed + ')').join(' · '));
