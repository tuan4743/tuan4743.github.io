/* 【判定】rotated 帧在图里到底是"正的"还是"躺着的":
 *   plist 的 textureRect 给的是【显示尺寸】(已证:spriteSize == textureRect),
 *   但【像素块】占多大、朝哪边躺,只能量 ✗
 *
 * 判据:GD 图集是紧排的(1px 缝,美术把 rect 填满)⇒
 *   正确的那一种假设,窗口里不透明像素的外接框应当≈整个窗口 ✓
 *   错的那种,内容会只占一部分(或者横向/纵向撑破)✗
 *
 * 对每一帧算两种假设的"贴合度" = 内容外接框面积 / 窗口面积,以及外接框是否贴住四条边。
 * 跑法:cd gd-web && node tools/object-orient.ts
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

type Img = { w: number; h: number; data: Uint8Array };
function decodePng(buf: Buffer): Img {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat: Buffer[] = []; let palette: Buffer | null = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
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
      if (palette) { const pi = cur[s] * 3; out[d] = palette[pi]; out[d + 1] = palette[pi + 1]; out[d + 2] = palette[pi + 2]; out[d + 3] = 255; }
      else { out[d] = cur[s]; out[d + 1] = cur[s + 1] ?? cur[s]; out[d + 2] = cur[s + 2] ?? cur[s]; out[d + 3] = ch === 4 ? cur[s + 3] : 255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}
/* 窗口内容外接框(alpha > 8 才算) */
function bbox(src: Img, x: number, y: number, w: number, h: number) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = x + i, sy = y + j;
    if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
    if (src.data[(sy * src.w + sx) * 4 + 3] > 8) { n++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  }
  if (n === 0) return { n: 0, w: 0, h: 0, tight: 0, touches: '-' };
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const touches = (x0 <= 1 ? 'L' : '') + (x1 >= w - 2 ? 'R' : '') + (y0 <= 1 ? 'T' : '') + (y1 >= h - 2 ? 'B' : '');
  return { n, w: bw, h: bh, tight: (bw * bh) / (w * h), touches: touches || '-' };
}
const atlas = JSON.parse(fs.readFileSync('../static/assets/gd-object-atlas.json', 'utf8')) as {
  textures: Array<{ image: string; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number }; rotated: boolean }> }>;
  ids: Record<string, string>;
};
const imgs = new Map<string, Img>();
for (const p of atlas.textures) imgs.set(p.image, decodePng(fs.readFileSync('../static/icons/' + p.image)));

let aWin = 0, bWin = 0;
const rows: string[] = [];
for (const page of atlas.textures) {
  const src = imgs.get(page.image)!;
  for (const f of page.frames) {
    const { x, y, w, h } = f.frame;
    const A = bbox(src, x, y, w, h);        // 假设 A:图里是正的 ⇒ 窗口 w×h
    const B = bbox(src, x, y, h, w);        // 假设 B:图里躺着 ⇒ 窗口 h×w
    /* 谁"贴满"谁赢:内容外接框尺寸接近窗口尺寸 */
    const aFit = Math.abs(A.w - w) <= 3 && Math.abs(A.h - h) <= 3;
    const bFit = Math.abs(B.w - h) <= 3 && Math.abs(B.h - w) <= 3;
    if (aFit && !bFit) aWin++; else if (bFit && !aFit) bWin++;
    const id = Object.keys(atlas.ids).find((k) => atlas.ids[k] === f.filename) ?? '-';
    rows.push(('id' + id).padEnd(7) + f.filename.padEnd(26) + 'rot=' + (f.rotated ? 'Y' : '-') + ' rect(' + w + 'x' + h + ')' +
      '  A[' + String(A.w).padStart(4) + 'x' + String(A.h).padStart(4) + ' ' + A.touches.padEnd(4) + ' fill' + A.tight.toFixed(2) + (aFit ? ' ★' : '  ') + ']' +
      '  B[' + String(B.w).padStart(4) + 'x' + String(B.h).padStart(4) + ' ' + B.touches.padEnd(4) + ' fill' + B.tight.toFixed(2) + (bFit ? ' ★' : '  ') + ']' +
      '  ' + page.image);
  }
}
console.log(rows.join('\n'));
console.log('\n=== 判定:窗口 w×h 贴合(A) ' + aWin + ' 帧 · 窗口 h×w 贴合(B) ' + bWin + ' 帧 · 其余 ' + (rows.length - aWin - bWin) + ' 帧 ===');
console.log('A 赢 ⇒ 图里【】的,phaser 的 rotated 反转有害 ✗ / B 赢 ⇒ 图里确实躺着,rotated:true 正确 ✓');
