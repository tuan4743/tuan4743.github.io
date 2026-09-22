/* 按 GD 官方动画表合成玩家图标(robot / spider)。
 * 数据源:D:\SteamLibrary\...\Geometry Dash\Resources\<Robot|Spider>_AnimDesc.plist
 *   animationContainer → Robot_run_001.png → sprite_0..N { texture, position, scale, zValue }
 * 贴图源:同目录 icons/robot_01.png 等(或项目里的 static/icons/robot.png)
 * 跑法:cd gd-web && node tools/anim-compose.ts robot 01 Robot_run_001
 * 产出:../../.tmp/anim-<mode>-<frame>.png(用 read_image 自己看)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';

type Img = { w: number; h: number; data: Uint8Array };
function decodePng(buf: Buffer): Img {
  let pos = 8, w = 0, h = 0, bitDepth = 8, colorType = 6;
  const idat: Buffer[] = []; let palette: Buffer | null = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'PLTE') palette = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      if (palette) { const pi = cur[s] * 3; out[d] = palette[pi]; out[d + 1] = palette[pi + 1]; out[d + 2] = palette[pi + 2]; out[d + 3] = palette[pi] === 0 && palette[pi + 1] === 0 && palette[pi + 2] === 0 ? 0 : 255; }
      else { out[d] = cur[s]; out[d + 1] = cur[s + 1] ?? cur[s]; out[d + 2] = cur[s + 2] ?? cur[s]; out[d + 3] = ch === 4 ? cur[s + 3] : 255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}
function encodePng(img: Img): Buffer {
  const { w, h, data } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const t = Buffer.from(type, 'ascii'); let c = ~0;
    for (const byte of Buffer.concat([t, body])) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([len, t, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/* 读 plist 里某一帧的 sprite 列表
 * ★ 修正(上一版把 usedTextures 段也扫进来 ⇒ 每个 sprite 重复 3 次、pos 全 0 ✗):
 *   ① 只在 <key>animationContainer</key> 之后找帧 ✓
 *   ② 每个 sprite 的 <dict> 用【括号配对】截取,不用非贪婪正则跨块 ✗ */
function readFrame(descFile: string, frame: string) {
  const x = fs.readFileSync(descFile, 'utf8');
  const ac = x.indexOf('<key>animationContainer</key>');
  const scope = ac >= 0 ? x.slice(ac) : x;
  const fi = scope.indexOf('<key>' + frame + '</key>');
  if (fi < 0) throw new Error('动画表里没有 ' + frame);
  /* 该动画帧的范围 = 从这个 key 到【下一个动画帧的 key】为止 ✓(帧名都以 .png</key> 结尾 ✓) */
  const nextKey = scope.slice(fi + 10).search(/<key>[A-Za-z0-9_]+\.png<\/key>/);
  const end = nextKey < 0 ? scope.length : fi + 10 + nextKey;
  const block = scope.slice(fi, end);
  const out: Array<{ tex: string; px: number; py: number; sx: number; sy: number; z: number }> = [];
  for (const m of block.matchAll(/<key>sprite_\d+<\/key>\s*<dict>([\s\S]*?)\n\s*<\/dict>/g)) {
    const body = m[1];
    const g = (k: string) => new RegExp('<key>' + k + '</key>\\s*<string>([^<]+)</string>').exec(body)?.[1] ?? '';
    const tex = g('texture');
    if (!tex) continue;
    /* ★ 修正:position/scale 是 "{-7.5, -5.175}" 这种【带花括号】的字符串 ✗
       上一版直接 split(',') ⇒ Number('{-7.5') = NaN ⇒ || 0 ⇒ 全变 0 ✓(这就是 pos=(0,0) 的原因)*/
    const nums = (s: string) => s.replace(/[{}]/g, '').split(',').map((v) => Number(v.trim()) || 0);
    const pos = nums(g('position')), sc = nums(g('scale'));
    out.push({ tex, px: pos[0], py: pos[1], sx: sc[0] || 1, sy: sc[1] || 1, z: Number(g('zValue')) || 0 });
  }
  return out.sort((a, b) => a.z - b.z);
}
const [mode = 'robot', icon = '01', frame = 'Robot_run_001.png'] = process.argv.slice(2);
const desc = path.join(RES, (mode === 'robot' ? 'Robot' : 'Spider') + '_AnimDesc.plist');
const sprites = readFrame(desc, frame);
console.log('动画帧 ' + frame + ' : ' + sprites.length + ' 个 sprite');
/* 贴图:从真实资源 icons/<mode>_<icon>.png + plist 里取每一帧 */
const plist = fs.readFileSync(path.join(RES, 'icons', mode + '_' + icon + '.plist'), 'utf8');
const atlas = decodePng(fs.readFileSync(path.join(RES, 'icons', mode + '_' + icon + '.png')));
const frames: Record<string, { x: number; y: number; w: number; h: number; rot: boolean; cw: number; ch: number; ox: number; oy: number }> = {};
for (const m of plist.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
  const b = m[2];
  const tr = /\{?\{([-0-9.]+),([-0-9.]+)\},\{([-0-9.]+),([-0-9.]+)\}\}?/.exec(b);
  const cs = /<key>spriteSourceSize<\/key>\s*<string>\{([0-9]+),([0-9]+)\}/.exec(b);
  const sp = /<key>spriteSize<\/key>\s*<string>\{([0-9]+),([0-9]+)\}/.exec(b);
  const of = /<key>spriteOffset<\/key>\s*<string>\{(-?[0-9.]+),(-?[0-9.]+)\}/.exec(b);   // ★ 部件自己的偏移
  if (!tr) continue;
  const rot = /<key>textureRotated<\/key>\s*<true\/>/.test(b);
  frames[m[1]] = { x: +tr[1], y: +tr[2], w: +tr[3], h: +tr[4], rot, cw: sp ? +sp[1] : +cs?.[1], ch: sp ? +sp[2] : +cs?.[2], ox: of ? +of[1] : 0, oy: of ? +of[2] : 0 };
}
const W = 300, H = 300, ox = W / 2, oy = H / 2;
/* ★ 图标本身只有 ~40px 高(原版动画坐标就是这么小)⇒ 放大 SCALE 倍才看得清 ✓ */
const SC = Number(process.env.SCALE) || 8;
const cv = new Uint8Array(W * H * 4);
for (const s of sprites) {
  const fr = frames[s.tex];
  if (!fr) { console.log('  ! 找不到贴图 ' + s.tex); continue; }
  const cw = fr.rot ? fr.ch : fr.cw, chh = fr.rot ? fr.cw : fr.ch;
  console.log('  z=' + s.z + ' ' + s.tex.padEnd(24) + ' pos=(' + s.px + ',' + s.py + ') scale=(' + s.sx.toFixed(3) + ',' + s.sy.toFixed(3) + ') 内容 ' + cw + 'x' + chh);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const ax = fr.rot ? fr.x + y : fr.x + x, ay = fr.rot ? fr.y + (fr.h - 1 - x) : fr.y + y;
    if (ax >= atlas.w || ay >= atlas.h) continue;
    const si = (ay * atlas.w + ax) * 4;
    if (atlas.data[si + 3] < 8) continue;
    /* 放大 SC 倍:每个源像素画成 SC×SC 的方块 ✓
       ★ 位置 = AnimDesc.position + 该部件自己的 spriteOffset(x 向右、y 向上)✓ */
    for (let dy2 = 0; dy2 < SC; dy2++) for (let dx2 = 0; dx2 < SC; dx2++) {
      const dx = Math.round(ox + (s.px + fr.ox + (x - cw / 2) * s.sx) * SC) + dx2;
      const dy = Math.round(oy - (s.py + fr.oy + (y - chh / 2) * s.sy) * SC) - dy2;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      const di = (dy * W + dx) * 4;
      cv[di] = atlas.data[si]; cv[di + 1] = atlas.data[si + 1]; cv[di + 2] = atlas.data[si + 2]; cv[di + 3] = 255;
    }
  }
}
const out = path.resolve('..', '..', '.tmp', 'anim-' + mode + '-' + frame.replace('.png', '') + '.png');
fs.writeFileSync(out, encodePng({ w: W, h: H, data: cv }));
console.log('  ⇒ ' + out);
