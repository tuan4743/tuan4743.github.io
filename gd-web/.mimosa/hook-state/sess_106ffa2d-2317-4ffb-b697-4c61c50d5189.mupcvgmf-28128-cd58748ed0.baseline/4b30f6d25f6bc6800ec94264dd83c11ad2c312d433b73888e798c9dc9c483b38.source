/* 一次性分析:把某一段的物件按 x 列出来(看清"这块地方到底是哪个图案") */
import { generateLevel, tOfX } from '../src/sim/level.ts';

const lv = generateLevel({ seed: Number(process.argv[2] ?? 20260913) });
const a = Number(process.argv[3] ?? 28), b = Number(process.argv[4] ?? 50);
console.log('段:', lv.segments.map((s) => s.from.toFixed(1) + '~' + s.to.toFixed(1) + ' ' + s.mode + ' sp' + s.speed).join(' | '));
for (const o of lv.objects) {
  if (o.b + o.w < a || o.b > b) continue;
  console.log(
    'b=' + o.b.toFixed(2).padStart(8) + ' t=' + tOfX(lv, o.b).toFixed(3).padStart(7) +
    ' r=' + String(o.r).padStart(2) + ' w=' + o.w + ' ' + o.kind +
    (o.need ? '(need)' : '') + (o.orb ? ' ' + o.orb : '') + (o.pad ? ' ' + o.pad : ''));
}
