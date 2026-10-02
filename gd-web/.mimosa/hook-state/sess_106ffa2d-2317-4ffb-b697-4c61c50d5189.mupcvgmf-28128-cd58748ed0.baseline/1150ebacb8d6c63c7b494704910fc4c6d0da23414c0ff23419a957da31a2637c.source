/* 缩放键(128/129)审计:关卡里哪些物件被缩放了?我们的铺面有没有照做?
 * 为什么要它:我们的解析里"缩放"是按 ID 白名单开的(`spec.scaled`,目前只有锯片族)
 *   —— `w = spec.w * (spec.scaled ? key128 : 1)`。
 *   可原版的 128/129 是【所有物件通用】的属性。要是关卡里还有别的物件被缩放而我们没乘,
 *   那就是又一批"判定/贴图都比原版小一圈"的物件。
 * 用法:cd gd-web && node tools/scale-audit.ts [关卡名] */
import { loadSave, fieldsOf } from './lib/dat.ts';
import { GD_SPEC } from '../src/sim/gdids.ts';

const NAME = process.argv[2] ?? 'WATER';
const save = loadSave('../static/levels/CCLocalLevels.dat');
const lv = save.find((l) => l.name === NAME) ?? save.slice().sort((a, b) => b.lines.length - a.lines.length)[0];
console.log('关卡 ' + lv.name + ' · 物件 ' + lv.lines.length + ' 行');

const byId = new Map<number, { n: number; scaled: number; samples: string[] }>();
let total = 0, scaledTotal = 0;
for (const line of lv.lines) {
  const f = fieldsOf(line);
  const id = Math.round(Number(f['1'] ?? -1));
  const sx = Number(f['128'] ?? 1), sy = Number(f['129'] ?? 1);
  const isScaled = (isFinite(sx) && sx !== 1) || (isFinite(sy) && sy !== 1);
  total++;
  if (!isScaled) continue;
  scaledTotal++;
  const e = byId.get(id) ?? { n: 0, scaled: 0, samples: [] };
  e.n++; e.scaled++;
  if (e.samples.length < 2) e.samples.push('x=' + (Number(f['2']) / 30).toFixed(1) + ' sx=' + sx + ' sy=' + sy);
  byId.set(id, e);
}

console.log('带缩放键(128/129 ≠ 1)的物件:' + scaledTotal + ' / ' + total);
/* ② 旋转/翻转:我们的判定盒只在 rot 90/270 时对调宽高,其它角度一律当轴对齐;
   原版是 `RectApplyTransform(rec, rotate+flip+scale)` —— 任意角度会变成【斜盒子】(OBB,我们没做)。
   所以先看本关到底有没有"带判定的物件被摆成非 90 度倍数":有就是真缺口,没有就只是潜在风险。 */
const rotHist = new Map<string, number>();
const flipOdd: string[] = [];
for (const line of lv.lines) {
  const f = fieldsOf(line);
  const id = Math.round(Number(f['1'] ?? -1));
  const spec = GD_SPEC[id];
  const rot = ((Math.round(Number(f['6'] ?? 0)) % 360) + 360) % 360;
  const fx = f['5'] === '1', fy = f['4'] === '1';
  if (spec && (fx || fy)) flipOdd.push('id=' + id + '(' + spec.kind + ') x=' + (Number(f['2']) / 30).toFixed(1) + ' flipX=' + fx + ' flipY=' + fy);
  if (!spec || rot === 0) continue;
  const key = id + ' (' + spec.kind + ') rot=' + rot;
  rotHist.set(key, (rotHist.get(key) ?? 0) + 1);
}
console.log('\n带旋转的物件(按 ID + 角度):');
const odd = [...rotHist.entries()].filter(([k]) => !/rot=(90|180|270)$/.test(k));
for (const [k, n] of [...rotHist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + (odd.some(([kk]) => kk === k) ? '★ ' : '  ') + k.padEnd(28) + '×' + n);
}
console.log(odd.length ? '  ⇒ 有非 90 度倍数的旋转:判定盒按轴对齐会偏(OBB 未实现)'
  : '  ⇒ 全部是 90 的倍数:轴对齐盒 + 宽高对调就是精确的 ✓');
console.log('\n带翻转(4/5 键)的物件:' + (flipOdd.length ? '' : ' 没有 ✓'));
for (const s of flipOdd.slice(0, 10)) console.log('  ' + s);

for (const [id, e] of [...byId.entries()].sort((a, b) => b[1].n - a[1].n)) {
  const spec = GD_SPEC[id];
  const ours = spec ? (spec.scaled ? '我们乘缩放 ✓' : '★ 我们【不乘】缩放(白名单里没有它)') : '★ 我们【不认识】这个 ID';
  console.log('  id=' + String(id).padEnd(6) + '×' + String(e.n).padEnd(5)
    + (spec ? ('我们认作 ' + spec.kind).padEnd(14) : '?'.padEnd(14))
    + ours + '   ' + e.samples.join(' , '));
}
