/* 【判定·硬证据】图集是打包出来的 ⇒ 任何两块【不能重叠】✓
 *   于是:对每个 rotated 帧,两种假设哪个和邻居不重叠,哪个就是真的 ✗
 *     A: 存储块 = (x, y, w, h)   ← plist 的 textureRect 原样(显示尺寸)
 *     B: 存储块 = (x, y, h, w)   ← 转置(真·躺着)
 *   判据只用【不重叠】这一条,不看画面 ⇒ 不依赖眼力 ✓
 * 跑法:cd gd-web && node tools/object-pack.ts
 */
import fs from 'node:fs';

type F = { filename: string; frame: { x: number; y: number; w: number; h: number }; rotated: boolean };
const atlas = JSON.parse(fs.readFileSync('../static/assets/gd-object-atlas.json', 'utf8')) as {
  textures: Array<{ image: string; frames: F[] }>; ids: Record<string, string>;
};
const all: Array<{ image: string; f: F }> = atlas.textures.flatMap((p) => p.frames.map((f) => ({ image: p.image, f })));
const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rect = (f: F, transposed: boolean) => ({ x: f.frame.x, y: f.frame.y, w: transposed ? f.frame.h : f.frame.w, h: transposed ? f.frame.w : f.frame.h });

/* 1) 用【原样】尺寸:整张表内部有没有重叠? */
let clashA = 0, clashB = 0;
const pairsA: string[] = [], pairsB: string[] = [];
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  if (all[i].image !== all[j].image) continue;
  if (hit(rect(all[i].f, false), rect(all[j].f, false))) { clashA++; pairsA.push(all[i].f.filename + ' ∩ ' + all[j].f.filename); }
  if (hit(rect(all[i].f, all[i].f.rotated), rect(all[j].f, all[j].f.rotated))) { clashB++; pairsB.push(all[i].f.filename + ' ∩ ' + all[j].f.filename); }
}
console.log('假设 A(原样,忽略 rotated 标志):重叠对 ' + clashA + (pairsA.length ? '\n  ' + pairsA.slice(0, 12).join('\n  ') : ' ✓ 全表无重叠'));
console.log('假设 B(rotated 帧转置):       重叠对 ' + clashB + (pairsB.length ? '\n  ' + pairsB.slice(0, 12).join('\n  ') : ' ✓ 全表无重叠'));

/* 2) 逐帧:只把这一帧转置,和其余(先按原样)比,会不会撞?—— 看 rotated 帧自己 */
console.log('\n逐帧(rotated 帧):转置后是否和【原样】的其它帧相撞');
for (const { image, f } of all) {
  if (!f.rotated) continue;
  const id = Object.keys(atlas.ids).find((k) => atlas.ids[k] === f.filename) ?? '-';
  const others = all.filter((o) => o.image === image && o.f !== f);
  const clashAsIs = others.filter((o) => hit(rect(f, false), rect(o.f, o.f.rotated))).map((o) => o.f.filename);
  const clashT = others.filter((o) => hit(rect(f, true), rect(o.f, o.f.rotated))).map((o) => o.f.filename);
  console.log(('id' + id).padEnd(8) + f.filename.padEnd(26) + 'rect(' + f.frame.w + 'x' + f.frame.h + ')  原样撞[' + clashAsIs.length + '] ' + clashAsIs.slice(0, 3).join(',') +
    '   转置撞[' + clashT.length + '] ' + clashT.slice(0, 3).join(','));
}
