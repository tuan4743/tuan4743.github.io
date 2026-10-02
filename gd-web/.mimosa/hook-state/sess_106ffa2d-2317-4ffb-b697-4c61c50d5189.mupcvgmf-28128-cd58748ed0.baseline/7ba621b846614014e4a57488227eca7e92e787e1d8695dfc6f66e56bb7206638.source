/* 【诊断】门的 front/back 两层叠起来到底对没对齐:
 *   我们的画法 = 两层都【以物件中心为心】画 back(下) + front(上)✓
 *   ⇒ 这里就按同样规矩叠一张预览,同时量每层【不透明内容的】外接框(相对帧中心)★
 *   若两层内容中心不重合,差值就是"前后层差一点"的量 ✓
 * 跑法:cd gd-web && node tools/portal-pair.ts
 * 产出:../../.tmp/portal-pair.png(用 read_image 看)
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
  textures: Array<{ image: string; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number } }> }>;
  ids: Record<string, string>;
};
const frames = new Map<string, Img>();
for (const p of atlas.textures) {
  const src = decodePng(fs.readFileSync('../static/icons/' + p.image));
  for (const f of p.frames) {
    const { x, y, w, h } = f.frame, out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const s = ((y + j) * src.w + (x + i)) * 4, d = (j * w + i) * 4;
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1]; out[d + 2] = src.data[s + 2]; out[d + 3] = src.data[s + 3];
    }
    frames.set(f.filename, { w, h, data: out });
  }
}
/** 内容外接框,坐标以【帧中心】为原点(单位 px,uhd ⇒ 4px = 1 单位) */
function box(img: Img) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const cx = (x0 + x1 + 1) / 2 - img.w / 2, cy = (y0 + y1 + 1) / 2 - img.h / 2;
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, cx, cy };
}
const pairs: Array<{ id: string; front: string; back: string }> = [];
for (const [id, name] of Object.entries(atlas.ids)) {
  const back = name.replace('_front_', '_back_');
  if (back !== name && frames.has(back)) pairs.push({ id, front: name, back });
}
const CW = 260, CH = 400, COLS = 4, ROWS = Math.ceil(pairs.length / COLS);
const sheet: Img = { w: CW * COLS, h: CH * ROWS, data: new Uint8Array(CW * COLS * CH * ROWS * 4) };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 24; sheet.data[i + 1] = 24; sheet.data[i + 2] = 30; sheet.data[i + 3] = 255; }
console.log('id    front(帧尺寸 / 内容 w×h / 内容中心相对帧中心)      back(同)                         内容中心差(单位)');
pairs.forEach((p, i) => {
  const f = frames.get(p.front)!, b = frames.get(p.back)!;
  const fb = box(f)!, bb = box(b)!;
  const col = i % COLS, row = Math.floor(i / COLS);
  const cx = col * CW + CW / 2, cy = row * CH + CH / 2;
  /* 先画 back 再画 front,两层都居中 ⇒ 就是我们的画法 ✓ */
  for (const img of [b, f]) {
    const ox = Math.round(cx - img.w / 2), oy = Math.round(cy - img.h / 2);
    for (let j = 0; j < img.h; j++) for (let k = 0; k < img.w; k++) {
      const dx = ox + k, dy = oy + j;
      if (dx < 0 || dy < 0 || dx >= sheet.w || dy >= sheet.h) continue;
      const s = (j * img.w + k) * 4, d = (dy * sheet.w + dx) * 4, a = img.data[s + 3] / 255;
      if (a === 0) continue;
      sheet.data[d] = Math.round(img.data[s] * a + sheet.data[d] * (1 - a));
      sheet.data[d + 1] = Math.round(img.data[s + 1] * a + sheet.data[d + 1] * (1 - a));
      sheet.data[d + 2] = Math.round(img.data[s + 2] * a + sheet.data[d + 2] * (1 - a));
      sheet.data[d + 3] = 255;
    }
  }
  const dxu = (bb.cx - fb.cx) / 4, dyu = (bb.cy - fb.cy) / 4;   // uhd 4px = 1 单位
  console.log(('id' + p.id).padEnd(7) + (f.w + 'x' + f.h).padEnd(9) + '/' + (fb.w + 'x' + fb.h).padEnd(9) + ('(' + fb.cx.toFixed(1) + ',' + fb.cy.toFixed(1) + ')').padEnd(15) +
    (b.w + 'x' + b.h).padEnd(9) + '/' + (bb.w + 'x' + bb.h).padEnd(9) + ('(' + bb.cx.toFixed(1) + ',' + bb.cy.toFixed(1) + ')').padEnd(15) +
    'Δ(' + dxu.toFixed(2) + ',' + dyu.toFixed(2) + ') 单位  ' + (Math.abs(dxu) > 0.5 || Math.abs(dyu) > 0.5 ? '★ 差得多' : ''));
});
fs.mkdirSync('../../.tmp', { recursive: true });
fs.writeFileSync('../../.tmp/portal-pair.png', encodePng(sheet));
console.log('⇒ .tmp/portal-pair.png');
