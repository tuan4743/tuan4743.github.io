/* 从 IDA 反编译里抠出【物件 id → 贴图帧名】表。
 * 做法:对每个 "xxx_01_001.png" 字符串,在【同一函数】范围内找 case N: / == N 的常量 ⇒ 配对。
 * 自证(不需要看画面):boost_* 必须落在弹簧板 id、checkpoint_* 必须落在存档点 id、GJ_arrow_* 必须落在箭头 id。
 * 跑法:cd tuagfey-blog/gd-web && node tools/extract-sprite-map.ts
 */
import fs from 'node:fs';

const FILE = '../../.tmp/GDsrc/asm/gd-ida-decomp.cpp';
const text = fs.readFileSync(FILE, 'utf8');
const lines = text.split('\n');
console.log('IDA 文件行数 ' + lines.length);

const NAME_RE = /"([A-Za-z_0-9]+_01_001\.png)"/g;
const FUNC_RE = /__fastcall\s+([A-Za-z_0-9:]+)\s*\(/;

type Hit = { line: number; name: string; func: string; ids: number[] };
const hits: Hit[] = [];

for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(NAME_RE);
  if (!m) continue;
  /* 往上找所在函数头 */
  let func = '?';
  for (let j = i; j > Math.max(0, i - 400); j--) {
    const fm = lines[j].match(FUNC_RE);
    if (fm) { func = fm[1]; break; }
  }
  /* 函数范围内收集 case N / == N(截到函数结束或 ±250 行) */
  const ids: number[] = [];
  for (let j = i; j < Math.min(lines.length, i + 250); j++) {
    if (j > i && /^\}/.test(lines[j])) break;
    const s = lines[j];
    for (const mm of s.matchAll(/(?:case\s+|==\s*)(\d{1,4})\b/g)) ids.push(Number(mm[1]));
  }
  for (const name of m) hits.push({ line: i + 1, name: name.slice(1, -1), func, ids: [...new Set(ids)] });
}

console.log('找到帧名出现处 ' + hits.length + ' 个,涉及 ' + new Set(hits.map((h) => h.name)).size + ' 个唯一帧名\n');

const rows = hits.map((h) => '  line ' + String(h.line).padStart(6) + '  ' + h.name.padEnd(30) + ' ids=' + (h.ids.slice(0, 6).join(',') || '-') + '  @' + h.func);
console.log('=== 全部命中(前 30)===');
rows.slice(0, 30).forEach((r) => console.log(r));

console.log('\n=== 自证三项 ===');
const check = (kw: string, expect: number[]) => {
  const hs = hits.filter((h) => h.name.includes(kw));
  const allIds = [...new Set(hs.flatMap((h) => h.ids))];
  const ok = allIds.some((i) => expect.includes(i));
  console.log('  ' + kw.padEnd(12) + ' 出现 ' + hs.length + ' 处,函数内 id=' + (allIds.join(',') || '-')
    + ' ⇒ ' + (ok ? '✓ 落在预期 id ' + expect.join('/') : '✗ 没落在预期 id ' + expect.join('/')));
};
check('boost', [35, 36, 67, 140]);
check('checkpoint', [31, 2016]);
check('arrow', [1331, 1332, 1333, 1334, 3004, 3005]);
