/* 离线合成预览:直接解码图集 PNG,按"每个部件自己的画布中心 + spriteOffset"把各部件叠起来,
 * 再把结果写成一张 PNG,用 read_image 看看到底对不对(不用上线、不用麻烦用户看画面)。
 * 跑法:cd gd-web && node tools/icon-preview.ts cube robot spider bird
 * 产出:../../.tmp/icon-preview-<mode>.png
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

/* ---------- 极简 PNG 解码(只支持 8bit RGBA / RGB,非隔行) ---------- */
type Img = { w: number; h: number; data: Uint8Array };
function decodePng(buf: Buffer): Img {
  let pos = 8;
  let w = 0, h = 0, bitDepth = 8, colorType = 6;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('只支持 8bit');
  /* ★ 支持索引色(colorType 3 ⇒ 需要 PLTE 调色板)—— robot.png 就是这种,上一版解码出空白 ✗ */
  let palette: Buffer | null = null;
  { let p = 8; while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
      if (type === 'PLTE') { palette = buf.subarray(p + 8, p + 8 + len); break; }
      if (type === 'IEND') break; p += 12 + len; } }
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 0 ? 1 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = new Uint8Array(w * h * 4);
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
      if (palette) {                       // 索引色:用调色板取 RGB,a 由 tRNS 决定(这里近似为不透明,除非索引 0)
        const pi = cur[s] * 3;
        out[d] = palette[pi]; out[d + 1] = palette[pi + 1]; out[d + 2] = palette[pi + 2];
        out[d + 3] = cur[s] === 0 && palette[pi] === 0 && palette[pi + 1] === 0 ? 0 : 255;
      } else {
        out[d] = cur[s]; out[d + 1] = cur[s + 1] ?? cur[s]; out[d + 2] = cur[s + 2] ?? cur[s];
        out[d + 3] = ch === 4 ? cur[s + 3] : 255;
      }
    }
    prev = cur;
  }
  return { w, h, data: out };
}
function encodePng(img: Img): Buffer {
  const { w, h, data } = img;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(data.subarray(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const t = Buffer.from(type, 'ascii'); const crcBuf = Buffer.concat([t, body]);
    let c = ~0; for (const byte of crcBuf) { c ^= byte; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
    const crc = Buffer.alloc(4); crc.writeUInt32BE((~c) >>> 0);
    return Buffer.concat([len, t, body, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- plist 解析 ---------- */
function parse(f: string) {
  const x = fs.readFileSync(path.resolve('..', 'static', 'icons', f + '.plist'), 'utf8');
  const out: Record<string, { frame: [number, number, number, number]; cs: [number, number]; off: [number, number]; rot: boolean }> = {};
  const re = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(x))) {
    const b = m[2];
    const g = (k: string) => { const r = new RegExp('<key>' + k + '</key>\\s*<string>\\{([-0-9.]+),([-0-9.]+)(?:,\\{([-0-9.]+),([-0-9.]+)\\})?\\}').exec(b); return r ? [Number(r[1]), Number(r[2]), Number(r[3] ?? 0), Number(r[4] ?? 0)] as [number, number, number, number] : null; };
    /* ★ textureRect 是 {{x,y},{w,h}} 这种【嵌套花括号】格式 ✗ 我上一版当 {x,y} 解析 ⇒ 全 0 ⇒ 预览空白 ✓
       (spriteSize / spriteSourceSize / spriteOffset 是 {x,y} 单层 ✓) */
    const tr = /<key>textureRect<\/key>\s*<string>\{\{([-0-9.]+),([-0-9.]+)\},\{([-0-9.]+),([-0-9.]+)\}\}<\/string>/.exec(b);
    const fr = tr ? [Number(tr[1]), Number(tr[2]), Number(tr[3]), Number(tr[4])] as [number, number, number, number] : null;
    const cs = g('spriteSourceSize'), of = g('spriteOffset');
    if (!cs || !fr) continue;
    out[m[1]] = { frame: fr, cs: [cs[0], cs[1]], off: of ? [of[0], of[1]] : [0, 0], rot: /<key>textureRotated<\/key>\s*<true\/>/.test(b) };
  }
  return out;
}

for (const mode of process.argv.slice(2)) {
  const F = parse(mode);
  /* ★ SHEET=1:把这张 sheet 里的每一帧【单独】画到一张大图上(接触印相)
     —— 用来一眼看清"这套 sheet 里到底有哪些部件"(robot.png 到底是腿还是别的 ✓) */
  if (process.env.SHEET) {
    const atlas = decodePng(fs.readFileSync(path.resolve('..', 'static', 'icons', mode + '.png')));
    const keys = Object.keys(F).filter((k) => !/_glow_/.test(k));
    const cols = 4, cell = 90, rows = Math.ceil(keys.length / cols);
    const W = cols * cell, H = rows * cell;
    const cv = new Uint8Array(W * H * 4);
    keys.forEach((k, i) => {
      const fr = F[k];
      const [fx, fy, fw, fh] = fr.frame;
      const cw = fr.rot ? fh : fw, chh = fr.rot ? fw : fh;
      const ox = (i % cols) * cell + cell / 2, oy = Math.floor(i / cols) * cell + cell / 2;
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        const sx = fr.rot ? fx + y : fx + x, sy = fr.rot ? fy + (fh - 1 - x) : fy + y;
        if (sx >= atlas.w || sy >= atlas.h) continue;
        const si = (sy * atlas.w + sx) * 4;
        if (atlas.data[si + 3] < 8) continue;
        const dx = Math.round(ox - cw / 2 + x), dy = Math.round(oy - chh / 2 + y);
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
        const di = (dy * W + dx) * 4;
        cv[di] = atlas.data[si]; cv[di + 1] = atlas.data[si + 1]; cv[di + 2] = atlas.data[si + 2]; cv[di + 3] = 255;
      }
    });
    const out2 = path.resolve('..', '..', '.tmp', 'sheet-' + mode + '.png');
    fs.writeFileSync(out2, encodePng({ w: W, h: H, data: cv }));
    console.log('  ' + mode.padEnd(7) + ' 接触印相 ' + keys.length + ' 帧 ⇒ ' + out2);
    continue;
  }
  const names = Object.keys(F);
  const base = names.filter((n) => !/_2_|_3_|_extra_|_glow_/.test(n)).sort((a, b) => a.localeCompare(b))[0];
  /* ★★★ 2026-09 照源码的规则(用户:"照搬源码"):
       robot 的腿 / spider 的腿 = GJRobotSprite / GJSpiderSprite 这两个【命名动画 sprite】✓
       (headers: class GJSpiderSprite : public GJRobotSprite; GJRobotSprite::init(id, name) ⇒ 按名字加载一整套动画 ✓)
       ⇒ 腿来自【另一张 sheet】(static/icons/robot.png / spider.png ✓),不是本 sheet 的 _2_ 帧 ✗
     用法:EXTRA=robot node tools/icon-preview.ts robot   ⇒ 身体(robot.png? 不,是本 sheet 基础帧)+ robot sheet 的全部帧
     本版先做:把 EXTRA 那张 sheet 的所有非 glow 帧都当成"部件"叠上去 ✓ */
  const extra = process.env.EXTRA;
  const layers = [base];
  if (!extra) {
    for (const part of ['02', '03', '04']) {
      const cand = names.filter((n) => !/_2_|_3_|_extra_|_glow_/.test(n) && n.includes('_' + part + '_')).sort((a, b) => a.localeCompare(b))[0];
      if (cand && !layers.includes(cand)) layers.push(cand);
    }
  }
  const atlas = decodePng(fs.readFileSync(path.resolve('..', 'static', 'icons', mode + '.png')));
  const W = 260, H = 260, ox = W / 2, oy = H / 2;
  const cv = new Uint8Array(W * H * 4);
  const blend = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a === 0) return;
    const i = (y * W + x) * 4, ia = a / 255, na = 1 - ia;
    cv[i] = r * ia + cv[i] * na; cv[i + 1] = g * ia + cv[i + 1] * na; cv[i + 2] = b * ia + cv[i + 2] * na;
    cv[i + 3] = Math.min(255, a + cv[i + 3] * na);
  };
  for (const ln of layers) {
    const fr = F[ln];
    const [fx, fy, fw, fh] = fr.frame;
    const cw = fr.rot ? fh : fw, chh = fr.rot ? fw : fh;               // 转正后的显示尺寸
    /* ★ 对齐规则可以切换:
         A = 画布中心 + 各层自己的 spriteOffset(上一版,实测【两层上下分开】✗)
         B = 只按【画布中心】对齐(不加偏移)← 本版试这个 ✓
         C = 画布中心 + 偏移,但偏移取【反号】(y 轴方向搞反的情况)
       用法:node tools/icon-preview.ts robot spider cube bird [B|C] */
    const mode = (process.env.ALIGN || 'B').toUpperCase();   // ★ 用环境变量传,别和"形态名"抢参数位 ✗
    const sx = mode === 'C' ? -fr.off[0] : (mode === 'A' ? fr.off[0] : 0);
    const sy = mode === 'C' ? -fr.off[1] : (mode === 'A' ? fr.off[1] : 0);
    const cx = ox + sx, cy = oy - sy;
    for (let y = 0; y < chh; y++) {
      for (let x = 0; x < cw; x++) {
        /* 旋转帧:图集里躺着,取像素时交换坐标 */
        const sx = fr.rot ? fx + y : fx + x;
        const sy = fr.rot ? fy + (fh - 1 - x) : fy + y;
        if (sx >= atlas.w || sy >= atlas.h) continue;
        const si = (sy * atlas.w + sx) * 4;
        /* 显示位置:以该层中心为准 */
        const dx = Math.round(cx - cw / 2 + x), dy = Math.round(cy - chh / 2 + y);
        blend(dx, dy, atlas.data[si], atlas.data[si + 1], atlas.data[si + 2], atlas.data[si + 3]);
      }
    }
  }
  const out = path.resolve('..', '..', '.tmp', 'icon-preview-' + mode + '.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng({ w: W, h: H, data: cv }));
  console.log('  ' + mode.padEnd(7) + ' 层 ' + layers.length + ' ⇒ ' + out);
}
