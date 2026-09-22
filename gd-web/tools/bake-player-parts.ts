/* 烘玩家图标的【部件动画表】—— v2:UHD 贴图 + 全部 run 帧(供引擎按帧轮播)
 * 用法:cd gd-web && node tools/bake-player-parts.ts
 * 产出:static/assets/gd-player-parts.json
 *   { robot: { sheet, uhd:true, scale:0.25, frames:{ <贴图名>:{rect,w,h} }, anims:{ run:[ [ {tex,x,y,z} … ] … ] } }, spider: {…} }
 * 关键(实测):
 *   robot_01  普通 28x20  vs uhd 112x78  ⇒ 4×
 *   spider_13 普通 43x31  vs uhd 172x124 ⇒ 4×
 *   AnimDesc 的 position 是【普通尺寸那一套单位】⇒ 引擎用 uhd 贴图时尺寸要 ÷4(scale=0.25 ✓)
 *   Robot_run_* 16 帧 · Spider_run_* 7 帧 ⇒ 逐帧轮播就是动画 ✓
 */
import fs from 'node:fs';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';
const ICONS = RES + '\\icons';

function readAnims(descFile: string, prefix: string) {
  const x = fs.readFileSync(descFile, 'utf8');
  const ac = x.indexOf('<key>animationContainer</key>');
  const scope = ac >= 0 ? x.slice(ac) : x;
  const keys = [...scope.matchAll(new RegExp('<key>(' + prefix + '_run_(\\d+)\\.png)</key>', 'g'))]
    .map((m) => ({ name: m[1], n: Number(m[2]) }))
    .sort((a, b) => a.n - b.n);
  const out: Array<Array<{ tex: string; x: number; y: number; z: number }>> = [];
  for (const k of keys) {
    const fi = scope.indexOf('<key>' + k.name + '</key>');
    const nk = scope.slice(fi + 10).search(/<key>[A-Za-z0-9_]+\.png<\/key>/);
    const block = scope.slice(fi, nk < 0 ? scope.length : fi + 10 + nk);
    const sprites: Array<{ tex: string; x: number; y: number; z: number }> = [];
    for (const m of block.matchAll(/<key>sprite_\d+<\/key>\s*<dict>([\s\S]*?)\n\s*<\/dict>/g)) {
      const b = m[1];
      const g = (s: string) => new RegExp('<key>' + s + '</key>\\s*<string>([^<]+)</string>').exec(b)?.[1] ?? '';
      const nums = (s: string) => s.replace(/[{}]/g, '').split(',').map((v) => Number(v.trim()) || 0);
      const tex = g('texture');
      if (!tex) continue;
      const pos = nums(g('position'));
      sprites.push({ tex, x: pos[0], y: pos[1], z: Number(g('zValue')) || 0 });
    }
    out.push(sprites.sort((a, b) => a.z - b.z));
  }
  return { names: keys.map((k) => k.name), frames: out };
}

function readFrames(sheet: string) {
  const x = fs.readFileSync(ICONS + '\\' + sheet + '-uhd.plist', 'utf8');
  const frames: Record<string, { rect: [number, number, number, number]; w: number; h: number }> = {};
  for (const m of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const b = m[2];
    const tr = /\{\{([-0-9.]+),([-0-9.]+)\},\{([-0-9.]+),([-0-9.]+)\}\}/.exec(b);
    const sp = /<key>spriteSize<\/key>\s*<string>\{([0-9]+),([0-9]+)\}/.exec(b);
    if (!tr) continue;
    frames[m[1]] = { rect: [+tr[1], +tr[2], +tr[3], +tr[4]], w: sp ? +sp[1] : +tr[3], h: sp ? +sp[2] : +tr[4] };
  }
  return frames;
}

const out: Record<string, unknown> = {};
for (const [mode, desc, sheet, prefix] of [['robot', 'Robot', 'robot_01', 'Robot'], ['spider', 'Spider', 'spider_13', 'Spider']] as const) {
  const anims = readAnims(RES + '\\' + desc + '_AnimDesc.plist', prefix);
  const frames = readFrames(sheet);
  out[mode] = { sheet, uhd: true, scale: 0.25, frames, anims: { run: anims.frames }, animNames: anims.names };
  const usedTex = new Set(anims.frames.flat().map((s) => s.tex));
  console.log('  ' + mode + ': ' + anims.frames.length + ' 帧动画 · 用到部件 ' + usedTex.size + ' 个 · uhd 帧表 ' + Object.keys(frames).length + ' 条');
}
fs.writeFileSync('../static/assets/gd-player-parts.json', JSON.stringify(out, null, 1), 'utf8');
console.log('  ⇒ static/assets/gd-player-parts.json(' + Math.round(fs.statSync('../static/assets/gd-player-parts.json').size / 1024) + ' KB)');
