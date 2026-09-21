/* 判定盒表体检:OpenGD `_pHitboxes` 里每条 {h,w,x,y} 到底是不是"以物件原点为中心"?
 * 为什么要它:我们 world.ts 里一律按 (x,y) = (-w/2,-h/2) 建盒(见 gdids.ts 注释)。
 * 如果表里存在大量"不居中"的条目(尖刺就是有名的例子),那这条通式就是错的,
 * 关卡里靠边的锯片/尖刺就会整体错位半个身位 —— 正是 1052~1056 那段的可疑点。
 * 用法:cd gd-web && node tools/hb-audit.ts [--list] */
import fs from 'node:fs';

const SRC = '../../.tmp/longdata.cpp';
const txt = fs.readFileSync(SRC, 'utf8');
const re = /\{(\d+),\s*\{\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\}\s*\}/g;
type Row = { id: number; h: number; w: number; x: number; y: number };
const rows: Row[] = [];
let m: RegExpExecArray | null;
while ((m = re.exec(txt))) {
  rows.push({ id: Number(m[1]), h: Number(m[2]), w: Number(m[3]), x: Number(m[4]), y: Number(m[5]) });
}
console.log('表里共 ' + rows.length + ' 条(正则粗抓,可能含别处同形表)');

const centred = (r: Row) => Math.abs(r.x + r.w / 2) < 1e-6 && Math.abs(r.y + r.h / 2) < 1e-6;
const ok = rows.filter(centred);
console.log('居中(x=-w/2 且 y=-h/2):' + ok.length + ' / ' + rows.length
  + ' = ' + (100 * ok.length / rows.length).toFixed(1) + '%');

const bad = rows.filter((r) => !centred(r));
console.log('不居中 ' + bad.length + ' 条,前 20:');
for (const r of bad.slice(0, 20)) {
  console.log('  id=' + String(r.id).padEnd(6) + ' h=' + String(r.h).padEnd(7) + ' w=' + String(r.w).padEnd(7)
    + ' x=' + String(r.x).padEnd(8) + ' y=' + String(r.y).padEnd(8)
    + '  → 左= ' + r.x.toFixed(1) + ' 右= ' + (r.x + r.w).toFixed(1)
    + ' 下= ' + r.y.toFixed(1) + ' 上= ' + (r.y + r.h).toFixed(1));
}

const WANT = [1, 8, 39, 83, 103, 12, 13, 47, 111, 660, 745, 1331, 200, 201, 202, 203, 1334,
  10, 11, 99, 101, 1704, 1705, 1706, 2063, 2064, 35, 36, 67, 84, 141, 1022, 1333];
console.log('\n关键 ID:');
for (const id of WANT) {
  const r = rows.find((q) => q.id === id);
  if (!r) { console.log('  id=' + String(id).padEnd(6) + ' 表里没有'); continue; }
  console.log('  id=' + String(id).padEnd(6) + ' {h=' + r.h + ', w=' + r.w + ', x=' + r.x + ', y=' + r.y + '}'
    + ' 格数 ' + (r.w / 30).toFixed(3) + '×' + (r.h / 30).toFixed(3)
    + (centred(r) ? ' 居中' : ' ★不居中 → 左=' + r.x.toFixed(1) + ' 右=' + (r.x + r.w).toFixed(1)
      + ' 下=' + r.y.toFixed(1) + ' 上=' + (r.y + r.h).toFixed(1)));
}
if (process.argv.includes('--list')) {
  console.log('\n全部不居中条目:');
  for (const r of bad) console.log('  ' + JSON.stringify(r));
}
