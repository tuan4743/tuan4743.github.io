/* 【查色】官方图集里那些"环/箭头"帧本身是不是已经有颜色(而不是一张白图靠染色)?
 *   ring_01 / ring_02 / ring_03 / ring_custom_01 / gravring_01 / gravJumpRing_01
 *   dashRing_01/02 · dropRing_01 · d_arrow_01/02/03 · teleportRing · spiderRing
 * 跑法:cd gd-web && node tools/ring-colors.ts
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';
type Img = { w: number; h: number; data: Uint8Array };
function decodePng(buf: Buffer): Img {
  let pos = 8, w = 0, h = 0, colorType = 6;
  const idat: Buffer[] = []; let palette: Buffer | null = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); colorType = d[9]; }
    else if (type === 'PLTE') palette = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, dd = (y * w + x) * 4;
      if (palette) { const pi = cur[s] * 3; out[dd] = palette[pi]; out[dd + 1] = palette[pi + 1]; out[dd + 2] = palette[pi + 2]; out[dd + 3] = 255; }
      else { out[dd] = cur[s]; out[dd + 1] = cur[s + 1] ?? cur[s]; out[dd + 2] = cur[s + 2] ?? cur[s]; out[dd + 3] = ch === 4 ? cur[s + 3] : 255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}
function readPlist(p: string) {
  const x = fs.readFileSync(p, 'utf8'), m = new Map<string, { x: number; y: number; w: number; h: number; rotated: boolean }>();
  for (const g of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const tr = /\{\{(-?[0-9.]+),(-?[0-9.]+)\},\{([0-9.]+),([0-9.]+)\}\}/.exec(g[2]);
    if (tr) m.set(g[1], { x: +tr[1], y: +tr[2], w: +tr[3], h: +tr[4], rotated: /<key>textureRotated<\/key>\s*<true\/>/.test(g[2]) });
  }
  return m;
}
const NAMES = ['ring_01_001.png', 'ring_02_001.png', 'ring_03_001.png', 'ring_custom_01_001.png', 'ring_custom_01_color_001.png',
  'gravring_01_001.png', 'gravJumpRing_01_001.png', 'dashRing_01_001.png', 'dashRing_02_001.png', 'dropRing_01_001.png',
  'd_arrow_01_001.png', 'd_arrow_02_001.png', 'd_arrow_03_001.png', 'teleportRing_001.png', 'spiderRing_001.png',
  'd_flashRing_01_001.png', 'd_ringSeg_01_001.png', 'd_scaleFadeRing_01_001.png'];
for (const sheet of [{ p: 'GJ_GameSheet.plist', i: 'GJ_GameSheet-uhd.png' }, { p: 'GJ_GameSheet02-uhd.plist', i: 'GJ_GameSheet02-uhd.png' }]) {
  if (!fs.existsSync(RES + '\\' + sheet.p)) continue;
  const rec = readPlist(RES + '\\' + sheet.p), img = decodePng(fs.readFileSync(RES + '\\' + sheet.i));
  for (const n of NAMES) {
    const r = rec.get(n);
    if (!r) continue;
    const rw = r.rotated ? r.h : r.w, rh = r.rotated ? r.w : r.h;
    /* 透明像素不算;只统计 alpha>200 的"实体"像素 */
    let R = 0, G = 0, B = 0, n2 = 0; const hist = new Map<string, number>();
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
      const s = ((r.y + j) * img.w + (r.x + i)) * 4;
      if (img.data[s + 3] < 200) continue;
      const rr = img.data[s], gg = img.data[s + 1], bb = img.data[s + 2];
      R += rr; G += gg; B += bb; n2++;
      const q = `${rr >> 5}-${gg >> 5}-${bb >> 5}`;
      hist.set(q, (hist.get(q) ?? 0) + 1);
    }
    if (!n2) { console.log(n.padEnd(28) + sheet.i + ' 全透明?'); continue; }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([q, c]) => { const [r5, g5, b5] = q.split('-').map(Number); return `(~${r5 * 32 + 16},${g5 * 32 + 16},${b5 * 32 + 16})×${(c / n2 * 100).toFixed(0)}%`; }).join(' ');
    console.log(n.padEnd(28) + (rw + 'x' + rh).padEnd(11) + '平均(' + Math.round(R / n2) + ',' + Math.round(G / n2) + ',' + Math.round(B / n2) + ')  主色:' + top);
  }
}
