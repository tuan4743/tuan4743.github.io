/* 由烘好的部件表生成【Phaser 图集 JSON】—— 让浏览器直接加载 uhd 图集并取帧
   (Node 解不了 uhd 的 PNG ✗ ⇒ 交给 Phaser 解 ✓)
   产出:static/assets/gd-player-atlas.json —— 形如 { textures:[{image, frames:[{filename,frame}]}] } */
import fs from 'node:fs';
const parts = JSON.parse(fs.readFileSync('../static/assets/gd-player-parts.json', 'utf8'));
const textures: unknown[] = [];
for (const mode of ['robot', 'spider']) {
  const info = parts[mode];
  const image = mode === 'robot' ? 'robot-parts-uhd.png' : 'spider-parts-uhd.png';
  const frames = Object.entries(info.frames).map(([name, f]: [string, any]) => ({
    filename: name,
    frame: { x: f.rect[0], y: f.rect[1], w: f.rect[2], h: f.rect[3] },
    rotated: false, trimmed: false,
    sourceSize: { w: f.rect[2], h: f.rect[3] },
    spriteSourceSize: { x: 0, y: 0, w: f.rect[2], h: f.rect[3] },
  }));
  textures.push({ image, format: 'RGBA8888', size: { w: 0, h: 0 }, scale: 1, frames });
  console.log('  ' + mode + ': 图集 ' + image + ' · 帧 ' + frames.length + ' 条');
}
fs.writeFileSync('../static/assets/gd-player-atlas.json', JSON.stringify({ textures, meta: { app: 'gd-decomp-bake', scale: '1' } }, null, 1), 'utf8');
console.log('  ⇒ static/assets/gd-player-atlas.json(' + Math.round(fs.statSync('../static/assets/gd-player-atlas.json').size / 1024) + ' KB)');

