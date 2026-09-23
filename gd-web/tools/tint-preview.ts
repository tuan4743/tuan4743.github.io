/* 染色预览:把官方【纯白】的环/箭头按我们引擎的色值染一遍,拼成一张图给人看 ✓
 * 色值不在这里硬编码 —— 直接从 src/main.ts 里把 ORB_COL / ARROW_COL 抠出来(免得两边漂移 ✗)
 * 跑法:cd gd-web && node tools/tint-preview.ts
 * 产出:../../.tmp/tint-preview.png(用 read_image 看;也给用户看)
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
/* —— 从 main.ts 抠色表(唯一真源 ✓) —— */
const src = fs.readFileSync('src/main.ts', 'utf8');
function grab(name: string): Record<string, string> {
  const i = src.indexOf('const ' + name);
  const body = src.slice(src.indexOf('{', i), src.indexOf('}', i));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(\w+):\s*0x([0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}
const ORB = grab('ORB_COL'), ARR = grab('ARROW_COL');
console.log('main.ts 里的 ORB_COL: ' + JSON.stringify(ORB));
console.log('main.ts 里的 ARROW_COL: ' + JSON.stringify(ARR));

const atlas = JSON.parse(fs.readFileSync('../static/assets/gd-object-atlas.json', 'utf8')) as {
  textures: Array<{ image: string; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number } }> }>;
  ids: Record<string, string>;
};
const frames = new Map<string, Img>();
for (const p of atlas.textures) {
  const s = decodePng(fs.readFileSync('../static/icons/' + p.image));
  for (const f of p.frames) {
    const { x, y, w, h } = f.frame, out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const q = ((y + j) * s.w + (x + i)) * 4, d = (j * w + i) * 4;
      out[d] = s.data[q]; out[d + 1] = s.data[q + 1]; out[d + 2] = s.data[q + 2]; out[d + 3] = s.data[q + 3];
    }
    frames.set(f.filename, { w, h, data: out });
  }
}
/* 要展示的:id → (帧名, 色) */
const ITEMS: Array<{ id: string; label: string }> = [
  { id: '36', label: '36 黄环' }, { id: '84', label: '84 蓝环' }, { id: '141', label: '141 粉环' },
  { id: '1022', label: '1022 绿环' }, { id: '1330', label: '1330 黑环(冲刺)' },
  { id: '1704', label: '1704 绿箭头' }, { id: '1751', label: '1751 粉箭头' }, { id: '2063', label: '2063 存档点(白色=不染)' },
];
const tintOf = (id: string): number | null => {
  if (id === '1704') return parseInt(ARR['green'] ?? 'ffffff', 16);
  if (id === '1751') return parseInt(ARR['pink'] ?? 'ffffff', 16);
  const orbOf: Record<string, string> = { '36': 'yellow', '84': 'blue', '141': 'pink', '1022': 'green', '1330': 'black' };
  const k = orbOf[id];
  return k ? parseInt(ORB[k] ?? 'ffffff', 16) : null;
};
const CELL = 200, COLS = 4, ROWS = Math.ceil(ITEMS.length / COLS);
const sheet: Img = { w: CELL * COLS, h: CELL * ROWS, data: new Uint8Array(CELL * COLS * CELL * ROWS * 4) };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 26; sheet.data[i + 1] = 26; sheet.data[i + 2] = 32; sheet.data[i + 3] = 255; }
ITEMS.forEach((it, n) => {
  const name = atlas.ids[it.id];
  const img = name ? frames.get(name) : null;
  const col = i => i % COLS, row = i => Math.floor(i / COLS);
  const ox = col(n) * CELL + (CELL - (img?.w ?? 0)) / 2, oy = row(n) * CELL + (CELL - (img?.h ?? 0)) / 2;
  if (!img) { console.log(it.label + ' ⇒ 图集里没这帧 ✗'); return; }
  const t = tintOf(it.id);
  const tr = t == null ? 255 : (t >> 16) & 255, tg = t == null ? 255 : (t >> 8) & 255, tb = t == null ? 255 : t & 255;
  for (let j = 0; j < img.h; j++) for (let i = 0; i < img.w; i++) {
    const dx = Math.round(ox + i), dy = Math.round(oy + j);
    if (dx < 0 || dy < 0 || dx >= sheet.w || dy >= sheet.h) continue;
    const s = (j * img.w + i) * 4, d = (dy * sheet.w + dx) * 4, a = img.data[s + 3] / 255;
    if (a === 0) continue;
    const r = (img.data[s] * tr) / 255, g = (img.data[s + 1] * tg) / 255, b = (img.data[s + 2] * tb) / 255;
    sheet.data[d] = Math.round(r * a + sheet.data[d] * (1 - a));
    sheet.data[d + 1] = Math.round(g * a + sheet.data[d + 1] * (1 - a));
    sheet.data[d + 2] = Math.round(b * a + sheet.data[d + 2] * (1 - a));
    sheet.data[d + 3] = 255;
  }
  console.log(it.label.padEnd(22) + '帧 ' + name.padEnd(26) + '染色 rgb(' + tr + ',' + tg + ',' + tb + ')  格子(' + col(n) + ',' + row(n) + ')');
});
fs.mkdirSync('../../.tmp', { recursive: true });
fs.writeFileSync('../../.tmp/tint-preview.png', encodePng(sheet));
console.log('⇒ .tmp/tint-preview.png');
