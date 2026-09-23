/* 直接把官方图集里【点名要看的帧】抠出来放大拼一张 —— 用眼睛回答"这帧到底是什么" ✓
 * 用法:cd gd-web && node tools/sheet-peek.ts <每帧放大倍数> <帧名1> <帧名2> ...
 *   例:node tools/sheet-peek.ts 3 dashRing_01_001.png d_arrow_01_001.png ring_01_001.png
 * 产出:../../.tmp/sheet-peek.png + 控制台每帧的格子位置(用 read_image 看)
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
function readPlist(p: string) {
  const x = fs.readFileSync(p, 'utf8'), m = new Map<string, { x: number; y: number; w: number; h: number; rotated: boolean }>();
  for (const g of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const tr = /\{\{(-?[0-9.]+),(-?[0-9.]+)\},\{([0-9.]+),([0-9.]+)\}\}/.exec(g[2]);
    if (tr) m.set(g[1], { x: +tr[1], y: +tr[2], w: +tr[3], h: +tr[4], rotated: /<key>textureRotated<\/key>\s*<true\/>/.test(g[2]) });
  }
  return m;
}
const SCALE = Number(process.argv[2] ?? 3);
const NAMES = process.argv.slice(3);
if (!NAMES.length) { console.log('用法: node tools/sheet-peek.ts <放大倍数> <帧名...>'); process.exit(1); }
const SHEETS = [
  { plist: 'GJ_GameSheet-uhd.plist', png: 'GJ_GameSheet-uhd.png' },
  { plist: 'GJ_GameSheet02-uhd.plist', png: 'GJ_GameSheet02-uhd.png' },
];
const loaded = SHEETS.map((s) => ({ s, rec: readPlist(RES + '\\' + s.plist), img: decodePng(fs.readFileSync(RES + '\\' + s.png)) }));
const crops: Array<{ name: string; img: Img }> = [];
for (const n of NAMES) {
  let done = false;
  for (const L of loaded) {
    const r = L.rec.get(n);
    if (!r) continue;
    /* rotated 帧:像素块是 (x,y,h,w),先转正(逆时针) */
    let w = r.rotated ? r.h : r.w, h = r.rotated ? r.w : r.h;
    const out = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sxp = r.x + i, syp = r.y + j;
      let sx = sxp, sy = syp;
      if (r.rotated) { sx = r.x + (r.h - 1 - j); sy = r.y + i; }         // 转正
      const s = (sy * L.img.w + sx) * 4, d = (j * w + i) * 4;
      out[d] = L.img.data[s]; out[d + 1] = L.img.data[s + 1]; out[d + 2] = L.img.data[s + 2]; out[d + 3] = L.img.data[s + 3];
    }
    crops.push({ name: n + '  ' + w + '×' + h + (r.rotated ? ' (rotY⇒已转正)' : ''), img: { w, h, data: out } });
    done = true; break;
  }
  if (!done) console.log(n + ' 两张 uhd 图集里都没有 ✗');
}
const COLS = Math.min(4, crops.length), CELLW = Math.ceil(Math.max(...crops.map((c) => c.img.w * SCALE)) / 20) * 20 + 20;
const CELLH = Math.max(...crops.map((c) => c.img.h * SCALE)) + 40;
const ROWS = Math.ceil(crops.length / COLS);
const sheet: Img = { w: CELLW * COLS, h: CELLH * ROWS, data: new Uint8Array(CELLW * COLS * CELLH * ROWS * 4) };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 26; sheet.data[i + 1] = 26; sheet.data[i + 2] = 32; sheet.data[i + 3] = 255; }
crops.forEach((c, n) => {
  const col = n % COLS, row = Math.floor(n / COLS);
  const ox = col * CELLW + (CELLW - c.img.w * SCALE) / 2, oy = row * CELLH + 10;
  for (let j = 0; j < c.img.h * SCALE; j++) for (let i = 0; i < c.img.w * SCALE; i++) {
    const dx = Math.round(ox + i), dy = Math.round(oy + j);
    if (dx < 0 || dy < 0 || dx >= sheet.w || dy >= sheet.h) continue;
    const sx = Math.floor(i / SCALE), sy = Math.floor(j / SCALE), s = (sy * c.img.w + sx) * 4, d = (dy * sheet.w + dx) * 4;
    const a = c.img.data[s + 3] / 255;
    if (a === 0) continue;
    sheet.data[d] = Math.round(c.img.data[s] * a + sheet.data[d] * (1 - a));
    sheet.data[d + 1] = Math.round(c.img.data[s + 1] * a + sheet.data[d + 1] * (1 - a));
    sheet.data[d + 2] = Math.round(c.img.data[s + 2] * a + sheet.data[d + 2] * (1 - a));
    sheet.data[d + 3] = 255;
  }
  console.log('格子(' + col + ',' + row + ')  ' + c.name);
});
fs.mkdirSync('../../.tmp', { recursive: true });
fs.writeFileSync('../../.tmp/sheet-peek.png', encodePng(sheet));
console.log('⇒ .tmp/sheet-peek.png  ' + sheet.w + 'x' + sheet.h + '  (放大 ' + SCALE + '×)');
