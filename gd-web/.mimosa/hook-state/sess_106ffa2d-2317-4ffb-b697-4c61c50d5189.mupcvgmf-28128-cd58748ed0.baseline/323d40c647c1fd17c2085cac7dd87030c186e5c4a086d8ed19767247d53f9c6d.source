/* 物件贴图第一步:把【本关用到的 id】与 OpenGD 的物件定义表、官方 GameSheet 帧名对账。
 * 数据源:
 *   本关 id          ← static/levels/CCLocalLevels.dat(经 tools/lib/dat.ts 读)
 *   id → texture_name ← .tmp/OpenGD-object.json(OpenGD 的 Content/Custom/object.json)
 *   可用帧名          ← static/icons/GameSheet.plist(官方物件图集,585 帧)
 * 跑法:cd gd-web && node tools/object-map.ts
 */
import fs from 'node:fs';
import { loadSave } from './lib/dat.ts';

const lv = loadSave('../static/levels/CCLocalLevels.dat').find((l) => l.name === 'WATER');
if (!lv) { console.log('没找到 WATER 关卡'); process.exit(1); }
const raw = (lv as unknown as { lines: string[] }).lines;

const cnt = new Map<number, number>();
for (const line of raw) {
  const f: Record<string, string> = {};
  const t = line.split(',');
  for (let i = 0; i + 1 < t.length; i += 2) f[t[i]] = t[i + 1];
  const id = Number(f['1']);
  if (Number.isFinite(id)) cnt.set(id, (cnt.get(id) ?? 0) + 1);
}
const ids = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
console.log('本关物件 ' + raw.length + ' 个 · id 种类 ' + ids.length + ' 种');

const open = JSON.parse(fs.readFileSync('../../.tmp/OpenGD-object.json', 'utf8')) as Record<string, { texture_name?: string }>;
const sheet = fs.readFileSync('../static/icons/GameSheet.plist', 'utf8');
const frames = new Set([...sheet.matchAll(/<key>([^<]+\.png)<\/key>/g)].map((m) => m[1]));

let hit = 0, missTex = 0, noFrame = 0;
const rows: string[] = [];
for (const [id, n] of ids) {
  const tex = open[String(id)]?.texture_name ?? '';
  if (!tex) { missTex++; rows.push('  id=' + String(id).padStart(5) + ' ×' + String(n).padStart(5) + '  ✗ OpenGD 表里没有'); continue; }
  const ok = frames.has(tex);
  if (ok) hit++; else noFrame++;
  rows.push('  id=' + String(id).padStart(5) + ' ×' + String(n).padStart(5) + '  ' + (ok ? '✓' : '✗图集无此帧') + '  ' + tex);
}
console.log('对账:✓ 命中 ' + hit + ' 种 · ✗ 表里没有 ' + missTex + ' 种 · ✗ 图集缺帧 ' + noFrame + ' 种');
console.log('=== 出现最多的 30 种 id ===');
rows.slice(0, 30).forEach((r) => console.log(r));
console.log('=== 未命中的(前 20)===');
rows.filter((r) => r.includes('✗')).slice(0, 20).forEach((r) => console.log(r));
