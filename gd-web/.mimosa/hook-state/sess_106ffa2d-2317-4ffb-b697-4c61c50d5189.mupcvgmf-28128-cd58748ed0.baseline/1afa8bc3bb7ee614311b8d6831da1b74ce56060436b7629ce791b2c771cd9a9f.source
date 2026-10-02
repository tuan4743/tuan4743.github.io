/* 关卡原始 ID 体检:①圆形判定(锯片族)用了哪些 ID ②哪些 ID 我们的铺面【根本没认】。
 * 为什么要它:OpenGD `LongData.cpp` 有两张表 —— `_pHitboxes`(矩形)和 `_pHitboxRadius`(圆,锯片族)。
 * 圆表里的 ID 有 39 个,我们 GD_SPEC 只认 1705/1706;要是关卡里用了圆表的别的 ID(88/89/98/740…),
 * 那就是"一片没判定的装饰锯片" —— 原本会死人的地方现在能直接飞过去。
 * 用法:cd gd-web && node tools/id-audit.ts [关卡名] */
import { loadSave, fieldsOf } from './lib/dat.ts';
import { GD_HITBOX_RADIUS } from '../src/sim/gdids.ts';
import { GD_SPEC } from '../src/sim/gdids.ts';

const NAME = process.argv[2] ?? 'WATER';
const save = loadSave('../static/levels/CCLocalLevels.dat');
const lv = save.find((l) => l.name === NAME) ?? save.slice().sort((a, b) => b.lines.length - a.lines.length)[0];
console.log('关卡 ' + lv.name + ' · 物件 ' + lv.lines.length + ' 行');

const hist = new Map<number, number>();
for (const line of lv.lines) {
  const id = Math.round(Number(fieldsOf(line)['1'] ?? -1));
  hist.set(id, (hist.get(id) ?? 0) + 1);
}

console.log('\n① 圆表 ID 在本关的用量(有量 = 该走圆形判定):');
let anyCircle = 0;
for (const [id, r] of Object.entries(GD_HITBOX_RADIUS)) {
  const n = hist.get(Number(id)) ?? 0;
  if (!n) continue;
  anyCircle += n;
  const spec = GD_SPEC[Number(id)];
  console.log('  id=' + String(id).padEnd(6) + ' 半径 ' + String(r).padEnd(7) + '×' + String(n).padEnd(6)
    + (spec ? '我们认作 ' + spec.kind : '★ 我们【没认】这个 ID'));
}
if (!anyCircle) console.log('  (没有)');

console.log('\n② 我们不认识的 ID(物件会被整条丢掉):');
const ids = [...hist.entries()].sort((a, b) => b[1] - a[1]);
let unknown = 0;
for (const [id, n] of ids) {
  if (GD_SPEC[id]) continue;
  unknown += n;
  console.log('  id=' + String(id).padEnd(6) + ' ×' + n
    + (GD_HITBOX_RADIUS[id] ? '  ← 圆表里有(半径 ' + GD_HITBOX_RADIUS[id] + ')' : ''));
}
console.log('  合计丢掉 ' + unknown + ' / ' + lv.lines.length + ' 个物件');
