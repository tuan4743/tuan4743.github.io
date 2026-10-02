/* 定点核对:把 .dat 里某个 x 附近的物件【原样】打出来(逐字段),用来核对坐标与判定盒锚点。
 * 用法:cd gd-web && node tools/dat-dump.ts <块x> [附近多少块] [关卡名]
 * 例:node tools/dat-dump.ts 1055 6 WATER */
import { loadSave, fieldsOf } from './lib/dat.ts';

const X = Number(process.argv[2] ?? 1055);
const SPAN = Number(process.argv[3] ?? 6);
const NAME = process.argv[4] ?? 'WATER';
const FILE = process.argv[5] ?? '../static/levels/CCLocalLevels.dat';
const save = loadSave(FILE);
const lv = save.find((l) => l.name === NAME) ?? save[0];
console.log('关卡 ' + lv.name + ' · 物件行 ' + lv.lines.length);
let n = 0;
for (const line of lv.lines) {
  const f = fieldsOf(line);
  const bx = Number(f['2']) / 30;
  if (!(bx >= X - SPAN && bx <= X + SPAN)) continue;
  n++;
  const y = Number(f['3']) / 30;
  const id = f['1'];
  console.log('  id=' + String(id).padEnd(5) + ' x=' + bx.toFixed(2).padStart(8)
    + '(原始 ' + f['2'] + ') y=' + y.toFixed(2).padStart(7) + '(原始 ' + f['3'] + ')'
    + (f['6'] ? ' rot=' + f['6'] : '') + (f['128'] ? ' scaleX=' + f['128'] : '')
    + (f['129'] ? ' scaleY=' + f['129'] : '') + ' | ' + line.slice(0, 90));
}
console.log('共 ' + n + ' 条');
