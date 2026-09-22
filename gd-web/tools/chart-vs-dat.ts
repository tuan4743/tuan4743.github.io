/* chart 与 .dat 的逐条比对:位置(x/y)必须一一对应 —— 转换错位的话,引擎就会"凭空多出平台"。
 * 跑法:cd gd-web && node tools/chart-vs-dat.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { loadSave } from './lib/dat.ts';
import { U } from '../src/sim/constants.ts';

const lv = loadSave('../static/levels/CCLocalLevels.dat').find((l) => l.name === 'WATER');
if (!lv) { console.log('没找到 WATER 关卡'); process.exit(1); }
const raw = (lv as unknown as { lines: string[] }).lines;
console.log('.dat 物件行 ' + raw.length + ' · chart 物件 ' + WATER_CHART.objects.length);

type P = { id: number; x: number; y: number };
const dat: P[] = [];
for (const line of raw) {
  const f: Record<string, string> = {};
  const t = line.split(',');
  for (let i = 0; i + 1 < t.length; i += 2) f[t[i]] = t[i + 1];
  const id = Number(f['1']);
  if (!Number.isFinite(id)) continue;
  dat.push({ id, x: Number(f['2']) / U - 0.5, y: Number(f['3']) / U - 0.5 });   // .dat 给的是【中心】,chart 的 b/r 是【左下角】⇒ 各减 0.5
}
console.log('能解析出 id/x/y 的 .dat 物件 ' + dat.length);

/* chart 侧:id 可能缺(事件物件),那就只按坐标比 */
const byPos = new Map<string, number>();
for (const p of dat) byPos.set(p.x.toFixed(2) + '/' + p.y.toFixed(2), (byPos.get(p.x.toFixed(2) + '/' + p.y.toFixed(2)) ?? 0) + 1);

let miss = 0, checked = 0;
const missIds = new Map<number, number>();
for (const o of WATER_CHART.objects as Array<Record<string, unknown>>) {
  const key = (o.b as number).toFixed(2) + '/' + (o.r as number).toFixed(2);
  checked++;
  if (!byPos.has(key)) {
    miss++;
    const id = Number(o.id ?? -1);
    missIds.set(id, (missIds.get(id) ?? 0) + 1);
  }
}
console.log('chart 物件 ' + checked + ' 个,在 .dat 里找不到同坐标的:' + miss
  + '(' + ((miss / checked) * 100).toFixed(2) + '%)');
if (miss) console.log('按 id 统计:' + [...missIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + '=' + v).join(' · '));
