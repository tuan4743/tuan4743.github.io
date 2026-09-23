/* 把烘焙出来的图集【离线看一眼】:按 JSON 里的矩形把每帧贴到一张预览图上 ✓
 * 跑法:cd gd-web && node tools/atlas-preview.ts [最多宽]
 * 产出:../../.tmp/atlas-preview.png(用 read_image 自己看)+ 控制台行列表
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

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
function encodePng(img: Img): Buffer {
  const { w, h, data } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.from(t, 'ascii'); let c = ~0;
    for (const byte of Buffer.concat([tb, body])) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([len, tb, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const atlas = JSON.parse(fs.readFileSync('../static/assets/gd-object-atlas.json', 'utf8')) as {
  textures: Array<{ image: string; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number }; rotated: boolean }> }>;
  ids: Record<string, string>;
};
const MAXW = Number(process.argv[2] ?? 1000), COLS = 5, CELLW = Math.floor(MAXW / COLS), PAD = 6;
const items: Array<{ name: string; id: string; img: Img }> = [];
for (const p of atlas.textures) {
  const src = decodePng(fs.readFileSync('../static/icons/' + p.image));
  for (const f of p.frames) {
    const { x, y, w, h } = f.frame, out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const s = ((y + j) * src.w + (x + i)) * 4, d = (j * w + i) * 4;
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1]; out[d + 2] = src.data[s + 2]; out[d + 3] = src.data[s + 3];
    }
    items.push({ name: f.filename, id: Object.keys(atlas.ids).find((k) => atlas.ids[k] === f.filename) ?? '-', img: { w, h, data: out } });
  }
}
items.sort((a, b) => b.img.h - a.img.h);
const rows = Math.ceil(items.length / COLS), ROWH = 380, H = rows * ROWH;
const sheet: Img = { w: MAXW, h: H, data: new Uint8Array(MAXW * H * 4) };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 26; sheet.data[i + 1] = 26; sheet.data[i + 2] = 32; sheet.data[i + 3] = 255; }
items.forEach((it, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  const ox = col * CELLW + PAD, oy = row * ROWH + PAD;
  for (let j = 0; j < it.img.h; j++) for (let k = 0; k < it.img.w; k++) {
    const dx = ox + k, dy = oy + j;
    if (dx >= MAXW || dy >= H) continue;
    const s = (j * it.img.w + k) * 4, d = (dy * MAXW + dx) * 4, a = it.img.data[s + 3] / 255;
    if (a === 0) continue;
    sheet.data[d] = Math.round(it.img.data[s] * a + sheet.data[d] * (1 - a));
    sheet.data[d + 1] = Math.round(it.img.data[s + 1] * a + sheet.data[d + 1] * (1 - a));
    sheet.data[d + 2] = Math.round(it.img.data[s + 2] * a + sheet.data[d + 2] * (1 - a));
    sheet.data[d + 3] = 255;
  }
  console.log(('r' + row + 'c' + col).padEnd(7) + 'id=' + String(it.id).padStart(4) + '  ' + it.name.padEnd(28) + it.img.w + 'x' + it.img.h + '  左上角(' + ox + ',' + oy + ')');
});
fs.mkdirSync('../../.tmp', { recursive: true });
fs.writeFileSync('../../.tmp/atlas-preview.png', encodePng(sheet));
console.log('⇒ .tmp/atlas-preview.png  ' + MAXW + 'x' + H);
