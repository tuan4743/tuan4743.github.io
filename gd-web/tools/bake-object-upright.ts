/* 物件贴图 · 直立版(替代 bake-object-atlas.ts)
 *
 * 为什么重做(硬证据 ✓ 见 tools/object-pack.ts):
 *   官方 plist 里 textureRotated=true 的帧,【像素块在图里是躺着的】:
 *     假设 A 原样尺寸 → 全表 4 处重叠(打包不可能重叠 ✗)
 *     假设 B 转置(h,w) → 全表 0 处重叠 ✓✓
 *   而 plist 的 textureRect w/h 是【显示尺寸】(rotate 帧 spriteSize==textureRect ✓)
 *   ⇒ 正确读法:显示 w×h,但像素块在 (x, y, h, w),内容旋转 90°。
 *
 * Phaser 的 rotated 帧只靠 updateUVsInverted() 改 UV(渲染器里没有任何 rotated 分支 ✓
 * node_modules/phaser/src/renderer/** 里搜不到 rotated),而它的 UV 映射方向和 cocos 不是一回事,
 * 我无法在无 WebGL 的环境里证明它对 ✗ ⇒ 【干脆不用 rotated】:
 * 烘焙时把躺着的帧【转正】,自己拼一张新图集,rotated 全 false ✓
 * 这样渲染路径和已经确认没问题的帧(方砖/尖刺/环,rot 全是 -)完全一样 ✓
 *
 * 转正方向(CW 还是 CCW)不靠猜:官方【标准分辨率】图集里同一帧大多 rot=-(见 object-pack 输出),
 * 那就是【正的参照】✓ 两个候选各降采样到参照尺寸比像素差,谁像谁赢 ✓ 分数打印出来给人看。
 *
 * 跑法:cd gd-web && node tools/bake-object-upright.ts
 * 产出:static/icons/gd-art-<i>.png + static/assets/gd-object-atlas.json(rotated 全 false ✓)
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { loadSave } from './lib/dat.ts';

const RES = 'D:\\SteamLibrary\\steamapps\\common\\Geometry Dash\\Resources';
const UHD = [
  { uhd: 'GJ_GameSheet-uhd.plist', uhdPng: 'GJ_GameSheet-uhd.png', std: 'GJ_GameSheet.plist', stdPng: 'GJ_GameSheet.png' },
  { uhd: 'GJ_GameSheet02-uhd.plist', uhdPng: 'GJ_GameSheet02-uhd.png', std: 'GJ_GameSheet02.plist', stdPng: 'GJ_GameSheet02.png' },
];
const PACK_W = 4096, GAP = 2;

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
/* 顺时针 90°:结果 w=原h, h=原w */
function rot90(img: Img): Img {
  const W = img.h, H = img.w, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const nx = img.h - 1 - y, ny = x;
    const s = (y * img.w + x) * 4, d = (ny * W + nx) * 4;
    out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
  }
  return { w: W, h: H, data: out };
}
function rot270(img: Img): Img {
  const W = img.h, H = img.w, out = new Uint8Array(W * H * 4);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const nx = y, ny = img.w - 1 - x;
    const s = (y * img.w + x) * 4, d = (ny * W + nx) * 4;
    out[d] = img.data[s]; out[d + 1] = img.data[s + 1]; out[d + 2] = img.data[s + 2]; out[d + 3] = img.data[s + 3];
  }
  return { w: W, h: H, data: out };
}
/* 盒式降采样(带 alpha 预乘 ⇒ 透明像素不干扰比较 ✓) */
function resize(img: Img, W: number, H: number): Img {
  const out = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x0 = Math.floor((i * img.w) / W), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * img.w) / W));
    const y0 = Math.floor((j * img.h) / H), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * img.h) / H));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = y0; y < Math.min(y1, img.h); y++) for (let x = x0; x < Math.min(x1, img.w); x++) {
      const s = (y * img.w + x) * 4, al = img.data[s + 3] / 255;
      r += img.data[s] * al; g += img.data[s + 1] * al; b += img.data[s + 2] * al; a += al; n++;
    }
    if (!n) continue;
    const d = (j * W + i) * 4;
    const aa = a / n;
    out[d] = aa > 0 ? Math.round(r / a) : 0; out[d + 1] = aa > 0 ? Math.round(g / a) : 0; out[d + 2] = aa > 0 ? Math.round(b / a) : 0;
    out[d + 3] = Math.round(aa * 255);
  }
  return { w: W, h: H, data: out };
}
/* 两图差(按 alpha 加权,只看有不透明内容的像素 ✓) */
function diff(a: Img, b: Img): number {
  const n = Math.min(a.data.length, b.data.length);
  let s = 0, wsum = 0;
  for (let i = 0; i < n; i += 4) {
    const aa = a.data[i + 3] / 255, ba = b.data[i + 3] / 255;
    const w = Math.max(aa, ba);
    if (w < 0.15) continue;
    s += w * (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
    wsum += w;
  }
  return wsum > 0 ? s / wsum : 999;
}

/* 读 plist → name ⇒ {x,y,w,h,rotated} */
type Rec = { x: number; y: number; w: number; h: number; rotated: boolean };
function readPlist(p: string): Map<string, Rec> {
  const x = fs.readFileSync(p, 'utf8'), m = new Map<string, Rec>();
  for (const g of x.matchAll(/<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g)) {
    const tr = /\{\{(-?[0-9.]+),(-?[0-9.]+)\},\{([0-9.]+),([0-9.]+)\}\}/.exec(g[2]);
    if (!tr) continue;
    m.set(g[1], { x: +tr[1], y: +tr[2], w: +tr[3], h: +tr[4], rotated: /<key>textureRotated<\/key>\s*<true\/>/.test(g[2]) });
  }
  return m;
}

/* 1) 本关用到的帧名(和旧 baker 同一套规则 ✓) */
const lv = loadSave('../static/levels/CCLocalLevels.dat').find((l) => l.name === 'WATER');
if (!lv) throw new Error('没找到 WATER');
const ids = new Set<number>();
for (const line of (lv as unknown as { lines: string[] }).lines) {
  const t = line.split(','), f: Record<string, string> = {};
  for (let i = 0; i + 1 < t.length; i += 2) f[t[i]] = t[i + 1];
  const id = Number(f['1']);
  if (Number.isFinite(id)) ids.add(id);
}
const ORB_MAP: Record<string, string> = {
  '36': 'ring_01_001.png', '84': 'ring_01_001.png', '141': 'ring_01_001.png', '1022': 'ring_01_001.png',
  '1330': 'ring_01_001.png', '1333': 'gravring_01_001.png', '1704': 'd_arrow_01_001.png',
  '1751': 'd_arrow_01_001.png',
  /* ★ 修正:2063 在我们引擎里是【存档点】(gdids.ts `2063: kind 'check'`),以前也当环画了 ✗
     ⇒ 换官方存档点旗帜 checkpoint_01_001.png(68×126 标准 px,GameSheet 里有 ✓) */
  '2063': 'checkpoint_01_001.png',
};
const table = JSON.parse(fs.readFileSync('../../.tmp/OpenGD-object.json', 'utf8')) as Record<string, { texture_name?: string }>;
const want = new Set<string>(Object.values(ORB_MAP));
for (const id of ids) { const t = table[String(id)]?.texture_name; if (t) want.add(t); }
/* ★ 门的 back 层也要(用户:"补 back 层")—— 原名是 portal_XX_front_001.png ⇒ 换成 _back_ ✓
   反编译:GD 给门建 back/front 两个精灵,位置都取物件自己的 getPosition() ⇒ 同位置不同层 ✓ */
for (const n of [...want]) if (n.includes('_front_')) want.add(n.replace('_front_', '_back_'));
console.log('本关 id ' + ids.size + ' 种 ⇒ 需要的贴图帧 ' + want.size + ' 个(含门的 back 层 ✓)');

/* 2) 逐帧:取出【直立】的大图块(必要时转正,方向用标准图集当参照 ✓) */
type OutFrame = { filename: string; img: Img };
const pages: Array<{ image: string; frames: OutFrame[] }> = [];
let cwN = 0, ccwN = 0, plainN = 0, noOracle = 0;
for (let si = 0; si < UHD.length; si++) {
  const src = UHD[si];
  const up = RES + '\\' + src.uhd, sp = RES + '\\' + src.std;
  if (!fs.existsSync(up)) { console.log('缺 ' + src.uhd); continue; }
  const recU = readPlist(up), recS = fs.existsSync(sp) ? readPlist(sp) : new Map<string, Rec>();
  const imgU = decodePng(fs.readFileSync(RES + '\\' + src.uhdPng));
  const imgS = fs.existsSync(RES + '\\' + src.stdPng) ? decodePng(fs.readFileSync(RES + '\\' + src.stdPng)) : null;
  const frames: OutFrame[] = [];
  for (const name of want) {
    const r = recU.get(name);
    if (!r) continue;
    let img: Img, how: string;
    if (!r.rotated) { img = crop(imgU, r.x, r.y, r.w, r.h); how = '原样'; plainN++; }
    else {
      /* 像素块 = (x, y, h, w) 躺着 ⇒ 转正 */
      const lying = crop(imgU, r.x, r.y, r.h, r.w);
      const cand = [rot90(lying), rot270(lying)];   // [顺时针转回来的, 逆时针转回来的]
      const ref = recS.get(name);
      let pick = 0, s0 = 999, s1 = 999;
      if (ref && imgS) {
        let refImg = crop(imgS, ref.x, ref.y, ref.rotated ? ref.h : ref.w, ref.rotated ? ref.w : ref.h);
        if (ref.rotated) refImg = rot90(refImg);
        const W = refImg.w, H = refImg.h;
        s0 = diff(resize(cand[0], W, H), refImg);
        s1 = diff(resize(cand[1], W, H), refImg);
        pick = s1 < s0 ? 1 : 0;
        how = '躺⇒转' + (pick ? '逆' : '顺') + '90°(参照 顺' + s0.toFixed(1) + ' vs 逆' + s1.toFixed(1) + ')';
      } else { pick = 0; noOracle++; how = '躺⇒转顺90°(标准图集里没有这帧,没法比 ✗ 按多数派)'; }
      img = cand[pick];
      if (pick) ccwN++; else cwN++;
    }
    frames.push({ filename: name, img });
    console.log('  ' + name.padEnd(28) + 'uhd(' + r.w + 'x' + r.h + (r.rotated ? ' 躺)' : ' 正)') + ' ⇒ ' + img.w + 'x' + img.h + '  ' + how);
  }
  if (!frames.length) continue;
  /* 3) 简单行打包(高→矮),宽度 ≤ PACK_W */
  frames.sort((a, b) => b.img.h - a.img.h);
  const placed: Array<{ f: OutFrame; x: number; y: number }> = [];
  let cx = 0, cy = 0, rowH = 0;
  for (const f of frames) {
    if (cx + f.img.w > PACK_W) { cx = 0; cy += rowH + GAP; rowH = 0; }
    placed.push({ f, x: cx, y: cy });
    cx += f.img.w + GAP; rowH = Math.max(rowH, f.img.h);
  }
  const H = cy + rowH + GAP;
  const sheet: Img = { w: PACK_W, h: H, data: new Uint8Array(PACK_W * H * 4) };
  for (const p of placed) {
    for (let j = 0; j < p.f.img.h; j++) for (let i = 0; i < p.f.img.w; i++) {
      const s = (j * p.f.img.w + i) * 4, d = ((p.y + j) * PACK_W + (p.x + i)) * 4;
      sheet.data[d] = p.f.img.data[s]; sheet.data[d + 1] = p.f.img.data[s + 1];
      sheet.data[d + 2] = p.f.img.data[s + 2]; sheet.data[d + 3] = p.f.img.data[s + 3];
    }
  }
  const outPng = 'gd-art-' + si + '.png';
  fs.writeFileSync('../static/icons/' + outPng, encodePng(sheet));
  pages.push({
    image: outPng,
    frames: placed.map((p) => ({ filename: p.f.filename, img: p.f.img, x: p.x, y: p.y })),
  } as never);
  console.log('  页 ' + si + ' ⇒ ' + outPng + ' ' + PACK_W + 'x' + H + ' (' + placed.length + ' 帧)');
}
/* 4) 写 Phaser multiatlas JSON(rotated 全 false ✓) */
const json = {
  textures: pages.map((p) => ({
    image: (p as unknown as { image: string }).image,
    format: 'RGBA8888', size: { w: PACK_W, h: 0 }, scale: 1,
    frames: (p as unknown as { frames: Array<{ filename: string; img: Img; x: number; y: number }> }).frames.map((f) => ({
      filename: f.filename, frame: { x: f.x, y: f.y, w: f.img.w, h: f.img.h }, rotated: false,
    })),
  })),
  ids: Object.fromEntries(Object.entries(table).filter(([id, o]) => ids.has(Number(id)) && o.texture_name && want.has(o.texture_name)).map(([id, o]) => [id, o.texture_name!])
    .concat(Object.entries(ORB_MAP).filter(([id]) => ids.has(Number(id))))),
  meta: { app: 'gd-decomp-bake-objects-upright', scale: '1', uw: PACK_W },
};
fs.writeFileSync('../static/assets/gd-object-atlas.json', JSON.stringify(json));
console.log('\n统计:原样 ' + plainN + ' 帧 · 由躺转正(顺/逆) ' + cwN + '/' + ccwN + ' 帧 · 无参照 ' + noOracle + ' 帧');
console.log('⇒ static/assets/gd-object-atlas.json + static/icons/gd-art-*.png');
