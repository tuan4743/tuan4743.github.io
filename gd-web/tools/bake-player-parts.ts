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

function readAnims(descFile: string, prefix: string, iconNo: string) {
  const x = fs.readFileSync(descFile, 'utf8');
  const ac = x.indexOf('<key>animationContainer</key>');
  const scope = ac >= 0 ? x.slice(ac) : x;
  /* ★ 官方 AnimDesc 只描述 01 号图标(名字全是 robot_01_* / spider_01_* ✗)
     ⇒ 贴图名要【换成我们图集的编号】,否则引擎在 uhd 图集里找不到帧 ✓
     ★ 同时把每一类动画都收进来(run / skip / jump / idle …),不只是 run ✓ —— 用户:"robot 还有一个跳跃动画" */
  const anims: Record<string, Array<Array<{ tex: string; x: number; y: number; z: number }>>> = {};
  const names: Record<string, string[]> = {};
  const kinds = [...new Set([...scope.matchAll(new RegExp('<key>' + prefix + '_([a-z]+)_(\\d+)\\.png</key>', 'g'))].map((m) => m[1]))];
  for (const kind of kinds) {
    const keys = [...scope.matchAll(new RegExp('<key>(' + prefix + '_' + kind + '_(\\d+)\\.png)</key>', 'g'))]
      .map((m) => ({ name: m[1], n: Number(m[2]) })).sort((a, b) => a.n - b.n);
    const frames: Array<Array<{ tex: string; x: number; y: number; z: number }>> = [];
    for (const k of keys) {
      const fi = scope.indexOf('<key>' + k.name + '</key>');
      const nk = scope.slice(fi + 10).search(/<key>[A-Za-z0-9_]+\.png<\/key>/);
      const block = scope.slice(fi, nk < 0 ? scope.length : fi + 10 + nk);
      const sprites: Array<{ tex: string; x: number; y: number; z: number }> = [];
      for (const m of block.matchAll(/<key>sprite_\d+<\/key>\s*<dict>([\s\S]*?)\n\s*<\/dict>/g)) {
        const b = m[1];
        const g = (s: string) => new RegExp('<key>' + s + '</key>\\s*<string>([^<]+)</string>').exec(b)?.[1] ?? '';
        const nums = (s: string) => s.replace(/[{}]/g, '').split(',').map((v) => Number(v.trim()) || 0);
        const texRaw = g('texture');
        if (!texRaw) continue;
        const tex = texRaw.replace(/^(robot|spider)_\d+_/, (_m, p1: string) => p1 + '_' + iconNo + '_');   // ★ 换成本图集编号
        const pos = nums(g('position'));
        sprites.push({ tex, x: pos[0], y: pos[1], z: Number(g('zValue')) || 0 });
      }
      frames.push(sprites.sort((a, b) => a.z - b.z));
    }
    anims[kind] = frames;
    names[kind] = keys.map((k) => k.name);
  }
  return { anims, names, kinds };
}

function readFrames(sheet: string) {
  const x = fs.readFileSync(ICONS + '\\' + sheet + '-uhd.plist', 'utf8');
  const frames: Record<string, { rect: [number, number, number, number]; w: number; h: number }> = {};
  for (const m of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const b = m[2];
    const tr = /\{\{([-0-9.]+),([-0-9.]+)\},\{([-0-9.]+),([-0-9.]+)\}\}/.exec(b);
    const sp = /<key>spriteSize<\/key>\s*<string>\{([0-9]+),([0-9]+)\}/.exec(b);
    /* ★ 部件自己的 spriteOffset(用户:"蜘蛛腿的位置太高了,robot 也有点" ⇒ 就是缺这一项 ✓)
       —— 它表示"内容在自己画布里的位置",叠加到 AnimDesc 的 position 上才是最终落点 ✓ */
    const of = /<key>spriteOffset<\/key>\s*<string>\{(-?[0-9.]+),(-?[0-9.]+)\}/.exec(b);
    if (!tr) continue;
    frames[m[1]] = {
      rect: [+tr[1], +tr[2], +tr[3], +tr[4]],
      w: sp ? +sp[1] : +tr[3], h: sp ? +sp[2] : +tr[4],
      ox: of ? +of[1] : 0, oy: of ? +of[2] : 0,
    };
  }
  return frames;
}

const out: Record<string, unknown> = {};
for (const [mode, desc, sheet, prefix] of [['robot', 'Robot', 'robot_01', 'Robot'], ['spider', 'Spider', 'spider_13', 'Spider']] as const) {
  const iconNo = sheet.replace(/^(robot|spider)_/, '');
  const res = readAnims(RES + '\\' + desc + '_AnimDesc.plist', prefix, iconNo);
  const frames = readFrames(sheet);
  const total = Object.values(res.anims).reduce((n, a) => n + a.length, 0);
  out[mode] = { sheet, uhd: true, scale: 0.25, frames, anims: res.anims, animNames: res.names };
  console.log('  ' + mode + ': 动画种类 [' + res.kinds.join(', ') + '] · 共 ' + total + ' 帧 · uhd 帧表 ' + Object.keys(frames).length + ' 条');
  for (const k of res.kinds) console.log('      ' + k + ': ' + res.anims[k].length + ' 帧');
}
fs.writeFileSync('../static/assets/gd-player-parts.json', JSON.stringify(out, null, 1), 'utf8');
console.log('  ⇒ static/assets/gd-player-parts.json(' + Math.round(fs.statSync('../static/assets/gd-player-parts.json').size / 1024) + ' KB)');
