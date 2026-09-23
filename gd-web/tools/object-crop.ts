/* 【诊断】图集里 rotated 帧到底怎么存的:把两种可能都切出来看一眼 ✓
 *
 * 背景:plist 的 textureRect 对 rotated 帧给的是【显示尺寸】(已证:spriteSize == textureRect ✓),
 *   但【图里那块像素】是按什么方向存的、多大,plist 没写 ⇒ 只能切出来看 ✗
 *
 * 每一行三格(顺序固定,下面控制台会打印每行的 y 坐标):
 *   A = 切 (x, y, w, h)          ← Phaser 现在采样的区域(rotated=true 时它按 w,h 做 UV 反转)
 *   B = 切 (x, y, h, w)          ← 如果图里是"躺着的",这一块才是完整的精灵
 *   C = B 顺时针转回来 90°        ← 如果 B 是躺着的,C 就应该是一个【正的】物件
 *
 * 判读:
 *   ① A 是完整的正物件 ⇒ 图里【没躺】⇒ 我们应该发 rotated:false(Phaser 的 UV 反转才是 bug ✓)
 *   ② A 是碎的/混了邻居,B 是躺着的完整物件,C 是正的 ⇒ 图里确实躺了 ⇒ rotated:true 正确,
 *      那"门横躺"的病根在别处(锚点/尺寸)✗
 *
 * 跑法:cd gd-web && node tools/object-crop.ts
 * 产出:../../.tmp/object-crop.png(用 read_image 自己看)
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
/* 从大图里抠一块(w×h),越界补透明 */
function crop(src: Img, x: number, y: number, w: number, h: number): Img {
  const out = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = x + i, sy = y + j;
    if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
    const s = (sy * src.w + sx) * 4, d = (j * w + i) * 4;
    out[d] = src.data[s]; out[d + 1] = src.data[s + 1]; out[d + 2] = src.data[s + 2]; out[d + 3] = src.data[s + 3];
  }
  return { w, h, data: out };
}
/* 顺时针 90°(结果 = 高×宽) */
function rot90(img: Img): Img {
  const out = new Uint8Array(img.w * img.h * 4), W = img.h, H = img.w;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const nx = img.h - 1 - y, ny = x;
    const s = (y * img.w + x) * 4, d = (ny * W + nx) * 4;
    out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
  }
  return { w: W, h: H, data: out };
}
function paste(dst: Img, src: Img, ox: number, oy: number) {
  for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) {
    const dx = ox + i, dy = oy + j;
    if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const s = (j * src.w + i) * 4, d = (dy * dst.w + dx) * 4;
    const a = src.data[s + 3] / 255;
    if (a === 0) continue;
    dst.data[d] = Math.round(src.data[s] * a + dst.data[d] * (1 - a));
    dst.data[d + 1] = Math.round(src.data[s + 1] * a + dst.data[d + 1] * (1 - a));
    dst.data[d + 2] = Math.round(src.data[s + 2] * a + dst.data[d + 2] * (1 - a));
    dst.data[d + 3] = 255;
  }
}

const atlas = JSON.parse(fs.readFileSync('../static/assets/gd-object-atlas.json', 'utf8')) as {
  textures: Array<{ image: string; frames: Array<{ filename: string; frame: { x: number; y: number; w: number; h: number }; rotated: boolean }> }>;
  ids: Record<string, string>;
};
const WANT = ['portal_01_front_001.png', 'portal_02_front_001.png', 'portal_03_front_001.png', 'portal_04_front_001.png',
  'portal_09_front_001.png', 'portal_11_front_001.png', 'portal_12_front_001.png', 'boost_01_001.png', 'boost_02_001.png',
  'chain_01_001.png', 'sawblade_01_001.png', 'd_arrow_01_001.png'];
const imgs = new Map<string, Img>();
for (const page of atlas.textures) {
  const p = '../static/icons/' + page.image;
  if (!fs.existsSync(p)) { console.log('缺图 ' + p); continue; }
  imgs.set(page.image, decodePng(fs.readFileSync(p)));
}

console.log('解出图集: ' + [...imgs.keys()].map((k) => k + '(' + imgs.get(k)!.w + 'x' + imgs.get(k)!.h + ')').join(' · '));
const rows = atlas.textures.flatMap((page) => page.frames.filter((f) => WANT.includes(f.filename)).map((f) => ({ page: page.image, f })));
const ROWH = 340, GAP = 8, COLX = [10, 330, 650], W = 1000, H = 10 + rows.length * (ROWH + GAP);
const sheet: Img = { w: W, h: H, data: new Uint8Array(W * H * 4) };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 30; sheet.data[i + 1] = 30; sheet.data[i + 2] = 36; sheet.data[i + 3] = 255; }
console.log('图幅 ' + W + 'x' + H + ';每行三格 x = ' + COLX.join(' / ') + ',行高 ' + ROWH + ',行距 ' + (ROWH + GAP));
rows.forEach((r, i) => {
  const { page: image, f } = r, src = imgs.get(image)!;
  const { x, y, w, h } = f.frame;
  const oy = 10 + i * (ROWH + GAP);
  const A = crop(src, x, y, w, h);
  const B = crop(src, x, y, h, w);
  const C = rot90(B);
  paste(sheet, A, COLX[0], oy);
  paste(sheet, B, COLX[1], oy);
  paste(sheet, C, COLX[2], oy);
  const id = Object.keys(atlas.ids).find((k) => atlas.ids[k] === f.filename) ?? '-';
  console.log(('行' + i).padEnd(5) + f.filename.padEnd(26) + ' id=' + String(id).padStart(4) + ' rot=' + (f.rotated ? 'Y' : '-') +
    ' rect(' + x + ',' + y + ',' + w + ',' + h + ')  A=' + A.w + 'x' + A.h + ' B=' + B.w + 'x' + B.h + ' C=' + C.w + 'x' + C.h +
    '  y=' + oy + '  ' + image);
});
fs.mkdirSync('../../.tmp', { recursive: true });
fs.writeFileSync('../../.tmp/object-crop.png', encodePng(sheet));
console.log('⇒ .tmp/object-crop.png');
