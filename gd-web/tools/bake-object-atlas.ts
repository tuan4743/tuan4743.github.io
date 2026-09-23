/* 物件贴图:从官方 GJ_GameSheet*.plist 里抽出【本关用得到的帧】,生成 Phaser multiatlas JSON,
 * 并把对应图集拷进 static/icons/。
 * 数据源:
 *   本关 id            ← static/levels/CCLocalLevels.dat
 *   id → texture_name  ← .tmp/OpenGD-object.json(OpenGD 的 object.json)
 *   帧矩形             ← D:\...\Geometry Dash\Resources\GJ_GameSheet{02}[-uhd].plist
 * 产出:
 *   static/assets/gd-object-atlas.json  (Phaser multiatlas ✓)
 *   static/icons/GJ_GameSheet-uhd.png · GJ_GameSheet02-uhd.png(只在首次拷贝 ✓)
 * 跑法:cd gd-web && node tools/bake-object-atlas.ts
 */
import fs from 'node:fs';
import { loadSave } from './lib/dat.ts';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';
const SOURCES = [
  { image: 'GJ_GameSheet-uhd.png', plist: 'GJ_GameSheet-uhd.plist' },
  { image: 'GJ_GameSheet02-uhd.png', plist: 'GJ_GameSheet02-uhd.plist' },
];

/* 1) 本关用到的 id */
const lv = loadSave('../static/levels/CCLocalLevels.dat').find((l) => l.name === 'WATER');
if (!lv) throw new Error('没找到 WATER');
const ids = new Set<number>();
for (const line of (lv as unknown as { lines: string[] }).lines) {
  const t = line.split(',');
  const f: Record<string, string> = {};
  for (let i = 0; i + 1 < t.length; i += 2) f[t[i]] = t[i + 1];
  const id = Number(f['1']);
  if (Number.isFinite(id)) ids.add(id);
}
/* 2) id → texture_name */
const table = JSON.parse(fs.readFileSync('../../.tmp/OpenGD-object.json', 'utf8')) as Record<string, { texture_name?: string }>;
const want = new Set<string>();
for (const id of ids) {
  const t = table[String(id)]?.texture_name;
  if (t) want.add(t);
}
console.log('本关 id ' + ids.size + ' 种 ⇒ 需要的贴图帧 ' + want.size + ' 个');

/* 3) 从官方图集里找这些帧的矩形 */
type Frame = { filename: string; frame: { x: number; y: number; w: number; h: number }; rotated: boolean };
const textures: Array<{ image: string; format: string; size: { w: number; h: number }; scale: number; frames: Frame[] }> = [];
let found = 0;
for (const src of SOURCES) {
  const p = RES + '\\' + src.plist;
  if (!fs.existsSync(p)) continue;
  const x = fs.readFileSync(p, 'utf8');
  const frames: Frame[] = [];
  for (const m of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const name = m[1];
    if (!want.has(name)) continue;
    const b = m[2];
    const tr = /\{\{(-?[0-9.]+),(-?[0-9.]+)\},\{([0-9.]+),([0-9.]+)\}\}/.exec(b);
    if (!tr) continue;
    frames.push({
      filename: name,
      frame: { x: +tr[1], y: +tr[2], w: +tr[3], h: +tr[4] },
      rotated: /<key>textureRotated<\/key>\s*<true\/>/.test(b),
    });
  }
  if (!frames.length) continue;
  found += frames.length;
  textures.push({ image: src.image, format: 'RGBA8888', size: { w: 0, h: 0 }, scale: 1, frames });
  const dst = '../static/icons/' + src.image;
  if (!fs.existsSync(dst)) { fs.copyFileSync(RES + '\\' + src.image, dst); console.log('  拷入 static/icons/' + src.image); }
  console.log('  ' + src.image + ': 命中 ' + frames.length + ' 帧');
}
console.log('合计命中 ' + found + ' / ' + want.size + (found === want.size ? '  ✓ 全中' : '  (缺 ' + (want.size - found) + ' 个,那些 id 继续矢量 ✓)'));
fs.writeFileSync('../static/assets/gd-object-atlas.json', JSON.stringify({ textures, meta: { app: 'gd-decomp-bake-objects', scale: '1' } }, null, 1), 'utf8');
console.log('  ⇒ static/assets/gd-object-atlas.json(' + Math.round(fs.statSync('../static/assets/gd-object-atlas.json').size / 1024) + ' KB)');
