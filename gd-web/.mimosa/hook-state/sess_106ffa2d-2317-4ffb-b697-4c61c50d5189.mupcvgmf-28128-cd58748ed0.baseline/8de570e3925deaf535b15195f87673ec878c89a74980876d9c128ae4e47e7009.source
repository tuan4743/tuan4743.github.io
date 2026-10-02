/* 判定盒覆盖率:本关每个物件到底有没有【原表值】,还是退回了我们自己猜的包围盒?
 * 为什么要它:`hitboxOf()` 返回 null 时,world.ts 会退回"物件自己的包围盒"——那是猜的。
 *   以前踩过的所有"该过过不去/该死死不了"基本都是这一类(刺判高一倍、跳板宽 5~7 倍、线框整格化)。
 *   所以这张表要能随时打出来:哪些 kind / 哪个 ID 还在猜,一眼看到。
 * 用法:cd gd-web && node tools/hitbox-coverage.ts [--list] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { hitboxOf } from '../src/sim/gdids.ts';
import { circleRadiusOf } from '../src/sim/gdids.ts';

const all = WATER_CHART.objects;
const byKind = new Map<string, { n: number; miss: number }>();
const missKey = new Map<string, number>();
let table = 0, circle = 0, guessed = 0;

for (const o of all) {
  const e = byKind.get(o.kind) ?? { n: 0, miss: 0 };
  e.n++;
  const hasRect = hitboxOf(o) != null;
  const hasCircle = circleRadiusOf(o.id) != null;
  if (hasCircle) circle++;
  else if (hasRect) table++;
  else { guessed++; e.miss++; }
  byKind.set(o.kind, e);
  if (!hasRect && !hasCircle) {
    const k = o.kind + ' id=' + (o.id ?? '?') + ' h=' + o.h + ' w=' + o.w;
    missKey.set(k, (missKey.get(k) ?? 0) + 1);
  }
}

console.log('铺面 ' + WATER_CHART.name + ' · 物件 ' + all.length + ' 个');
console.log('  查原表(矩形):' + table + ' · 圆形判定(锯片族):' + circle + ' · ★ 退回自己猜的包围盒:' + guessed
  + '(' + (100 * guessed / all.length).toFixed(2) + '%)');
console.log('\n按 kind:');
for (const [k, e] of [...byKind.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const mark = e.miss ? '★ ' + e.miss + ' 个在猜' : '✓ 全有出处';
  console.log('  ' + k.padEnd(11) + String(e.n).padStart(6) + '  ' + mark);
}
if (process.argv.includes('--list') && missKey.size) {
  console.log('\n退回包围盒的分组(按数量):');
  for (const [k, n] of [...missKey.entries()].sort((a, b) => b[1] - a[1])) console.log('  ×' + String(n).padStart(5) + '  ' + k);
}
