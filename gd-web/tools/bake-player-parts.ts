import fs from 'node:fs';
const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';
const out: Record<string, unknown> = {};
for (const [mode, desc, sheet, frame] of [['robot','Robot','robot_01','Robot_run_001.png'],['spider','Spider','spider_13','Spider_run_001.png']] as const) {
  const x = fs.readFileSync(RES + '\\' + desc + '_AnimDesc.plist', 'utf8');
  const ac = x.indexOf('<key>animationContainer</key>');
  const scope = x.slice(ac);
  const fi = scope.indexOf('<key>' + frame + '</key>');
  const nk = scope.slice(fi + 10).search(/<key>[A-Za-z0-9_]+\.png<\/key>/);
  const block = scope.slice(fi, nk < 0 ? scope.length : fi + 10 + nk);
  const sprites: Array<Record<string, unknown>> = [];
  for (const m of block.matchAll(/<key>sprite_\d+<\/key>\s*<dict>([\s\S]*?)\n\s*<\/dict>/g)) {
    const b = m[1];
    const g = (k: string) => new RegExp('<key>' + k + '</key>\\s*<string>([^<]+)</string>').exec(b)?.[1] ?? '';
    const nums = (s: string) => s.replace(/[{}]/g, '').split(',').map((v) => Number(v.trim()) || 0);
    const tex = g('texture'); if (!tex) continue;
    const pos = nums(g('position')), sc = nums(g('scale'));
    sprites.push({ tex, x: pos[0], y: pos[1], sx: sc[0] || 1, sy: sc[1] || 1, z: Number(g('zValue')) || 0 });
  }
  /* 贴图表:每帧在图集里的矩形与内容尺寸 */
  const pl = fs.readFileSync(RES + '\\icons\\' + sheet + '.plist', 'utf8');
  const frames: Record<string, unknown> = {};
  for (const m of pl.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const b = m[2];
    const tr = /\{\{([-0-9.]+),([-0-9.]+)\},\{([-0-9.]+),([-0-9.]+)\}\}/.exec(b);
    const sp = /<key>spriteSize<\/key>\s*<string>\{([0-9]+),([0-9]+)\}/.exec(b);
    const of = /<key>spriteOffset<\/key>\s*<string>\{(-?[0-9.]+),(-?[0-9.]+)\}/.exec(b);
    if (!tr) continue;
    frames[m[1]] = { rect: [+tr[1], +tr[2], +tr[3], +tr[4]], w: sp ? +sp[1] : +tr[3], h: sp ? +sp[2] : +tr[4], ox: of ? +of[1] : 0, oy: of ? +of[2] : 0 };
  }
  out[mode] = { sheet, frame, atlas: sheet + '.png', sprites: sprites.sort((a, b) => (a.z as number) - (b.z as number)), frames };
  console.log('  ' + mode + ': ' + sprites.length + ' 个部件 · 图集 ' + sheet + '.png · 帧表 ' + Object.keys(frames).length + ' 条');
}
fs.writeFileSync('../static/assets/gd-player-parts.json', JSON.stringify(out, null, 1), 'utf8');
console.log('  ⇒ static/assets/gd-player-parts.json(' + Math.round(JSON.stringify(out).length / 1024) + ' KB)');

