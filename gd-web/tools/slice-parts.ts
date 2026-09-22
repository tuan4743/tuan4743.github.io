/* 把官方部件图集按【烘好的部件表】切成独立小图(robot / spider)。
 * 用法:cd gd-web && node tools/slice-parts.ts
 * 关键规则(本轮查明):
 *   官方 Robot_AnimDesc / Spider_AnimDesc 只描述【01 号图标】的布局(全是 robot_01_* / spider_01_*)
 *   ⇒ 其它图标 = 同一套布局 + 换贴图(正对源码 GJSpiderSprite::init(id, name) 的"编号+名字")
 *   ⇒ 查矩形要用【原始帧名】✓,写文件要用【换成我们图集编号的名字】✓(这两件事不能混 ✗)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources\\icons';
type Img = { w: number; h: number; data: Uint8Array };

function dec(buf: Buffer): Img {
  let pos = 8, w = 0, h = 0, ct = 6;
  const idat: Buffer[] = [];
  let pal: Buffer | null = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), t = buf.toString('ascii', pos + 4, pos + 8), d = buf.subarray(pos + 8, pos + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; }
    else if (t === 'PLTE') pal = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    pos += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(st);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (st + 1)];
    const line = raw.subarray(y * (st + 1) + 1, y * (st + 1) + 1 + st);
    const cur = new Uint8Array(st);
    for (let i = 0; i < st; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d2 = (y * w + x) * 4;
      if (pal) { const pi = cur[s] * 3; out[d2] = pal[pi]; out[d2 + 1] = pal[pi + 1]; out[d2 + 2] = pal[pi + 2]; out[d2 + 3] = (pal[pi] === 0 && pal[pi + 1] === 0 && pal[pi + 2] === 0) ? 0 : 255; }
      else { out[d2] = cur[s]; out[d2 + 1] = cur[s + 1] ?? cur[s]; out[d2 + 2] = cur[s + 2] ?? cur[s]; out[d2 + 3] = ch === 4 ? cur[s + 3] : 255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}

function enc(img: Img): Buffer {
  const { w, h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (t: string, b: Buffer) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(b.length);
    const tb = Buffer.from(t, 'ascii');
    let c = ~0;
    for (const by of Buffer.concat([tb, b])) { c ^= by; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    const cr = Buffer.alloc(4); cr.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([l, tb, b, cr]);
  };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

type Parts = Record<string, {
  sheet: string;
  sprites: Array<{ tex: string; x: number; y: number; sx: number; sy: number; z: number }>;
  frames: Record<string, { rect: [number, number, number, number]; w: number; h: number; ox: number; oy: number }>;
}>;

const baked = JSON.parse(fs.readFileSync('../static/assets/gd-player-parts.json', 'utf8')) as Parts;
for (const mode of Object.keys(baked)) {
  const info = baked[mode];
  const iconNo = info.sheet.replace(/^(robot|spider)_/, '');          // 我们这张图集的编号(01 / 13)
  const atlas = dec(fs.readFileSync(RES + '\\' + info.sheet + '.png'));
  const used = [...new Set(info.sprites.map((s) => s.tex))];
  let n = 0;
  for (const texRaw of used) {
    /* ★ 查表的键要【换成我们图集的编号】✓(烘好的帧表是按 spider_13_* / robot_01_* 建的 ✓,
       而 AnimDesc 引用的是 spider_01_* ✗ —— 上一版就是这样查空的 ✓) */
    const key = texRaw.replace(/^(robot|spider)_\d+_/, (_m, p1: string) => p1 + '_' + iconNo + '_');
    const fr = info.frames[key];
    if (!fr) { console.log('  ! 表里缺 ' + key); continue; }
    const [rx, ry, rw, rh] = fr.rect;
    const img: Img = { w: rw, h: rh, data: new Uint8Array(rw * rh * 4) };
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      const si = ((ry + y) * atlas.w + (rx + x)) * 4, di = (y * rw + x) * 4;
      img.data[di] = atlas.data[si]; img.data[di + 1] = atlas.data[si + 1];
      img.data[di + 2] = atlas.data[si + 2]; img.data[di + 3] = atlas.data[si + 3];
    }
    const outName = texRaw.replace(/^(robot|spider)_\d+_/, (_m, p1: string) => p1 + '_' + iconNo + '_');   // ★ 写文件用换前缀名
    fs.writeFileSync('../static/icons/part-' + mode + '-' + outName, enc(img));
    n++;
  }
  console.log('  ' + mode + '(' + info.sheet + ', ' + info.sprites.length + ' 部件)⇒ 切出 ' + n + ' 张小图');
}
