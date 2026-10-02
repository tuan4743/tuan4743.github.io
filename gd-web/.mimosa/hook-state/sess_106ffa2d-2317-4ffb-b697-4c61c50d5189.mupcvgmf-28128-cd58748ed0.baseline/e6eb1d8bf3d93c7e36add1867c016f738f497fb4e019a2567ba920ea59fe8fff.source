/* 判定盒表体检:OpenGD `_pHitboxes` 里每条 {h,w,x,y} 到底是不是"以物件原点为中心"?
 * 为什么要它:我们 world.ts 里一律按 (x,y) = (-w/2,-h/2) 建盒(见 gdids.ts 注释)。
 * 如果表里存在大量"不居中"的条目(尖刺就是有名的例子),那这条通式就是错的,
 * 关卡里靠边的锯片/尖刺就会整体错位半个身位 —— 正是 1052~1056 那段的可疑点。
 * 用法:cd gd-web && node tools/hb-audit.ts [--list] */
import fs from 'node:fs';
import { loadSave, fieldsOf } from './lib/dat.ts';

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

/* ★★ 只问"本关真正用到的 ID 居不居中" —— 这才是我们那条通式 (x,y)=(-w/2,-h/2) 的适用范围。
   (审计文档里有三条"待办"说我们的刺/跳板盒子比原版高了 0.07~0.13 格,
    那是把表里的 (x,y) 当成了"盒中心的偏移";其实它是【左下角】的偏移,所以 y=-h/2 就是居中。) */
{
  const save = loadSave('../static/levels/CCLocalLevels.dat');
  const lv = save.find((l) => l.name === 'WATER') ?? save.slice().sort((a, b) => b.lines.length - a.lines.length)[0];
  const hist = new Map<number, number>();
  for (const line of lv.lines) {
    const id = Math.round(Number(fieldsOf(line)['1'] ?? -1));
    hist.set(id, (hist.get(id) ?? 0) + 1);
  }
  console.log('\n本关用到的 ID(' + hist.size + ' 种)在判定盒表里的居中情况:');
  let used = 0, usedCentred = 0;
  const odd: string[] = [];
  for (const [id, n] of [...hist.entries()].sort((a, b) => b[1] - a[1])) {
    const r = rows.find((q) => q.id === id);
    if (!r) continue;                       // 表里没有(圆表 / 2.2 新物件 / 触发器)另算
    used++;
    if (centred(r)) usedCentred++;
    else odd.push('  id=' + id + ' ×' + n + ' {h=' + r.h + ', w=' + r.w + ', x=' + r.x + ', y=' + r.y + '}'
      + ' → 盒 左=' + r.x + ' 右=' + (r.x + r.w) + ' 下=' + r.y + ' 上=' + (r.y + r.h));
  }
  console.log('  表里能查到的 ' + used + ' 种里,居中的 ' + usedCentred + ' 种'
    + (odd.length ? ';不居中 ' + odd.length + ' 种:' : ' —— 通式 (x,y)=(-w/2,-h/2) 对本关全部成立 ✓'));
  for (const s of odd) console.log(s);
}

