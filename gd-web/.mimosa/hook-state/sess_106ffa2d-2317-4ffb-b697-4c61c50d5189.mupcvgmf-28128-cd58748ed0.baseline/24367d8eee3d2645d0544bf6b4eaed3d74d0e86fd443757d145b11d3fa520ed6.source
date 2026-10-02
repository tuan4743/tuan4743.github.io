/* 图标几何审计:直接从 .plist 里解析出每个形态【主帧】的 frame / sourceSize / spriteOffset,
 * 并算出"按引擎现在的口径"它会显示成多少格 —— 用来判断"cube 图标太小"是换算问题还是美术留白。
 * 跑法:cd gd-web && node tools/icon-geometry.ts
 * 引擎口径(main.ts drawIconPlayer):
 *     k = B / (pxPerUnit * 30),pxPerUnit = REF_PX/30 = 4,B = 30(判定盒)
 *     ⇒ 显示尺寸 = bw * k,而 bw 是【画布宽】= sourceSize.w ⇒ 显示(格) = sourceSize.w / 120
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('..', 'static', 'icons');
const MODES = ['cube', 'ship', 'ball', 'bird', 'dart', 'robot', 'spider'];
const REF_PX = 120;

/* 极简 TexturePacker plist 解析:按 <key>名</key> 切块,块内取 frame/sourceSize/spriteOffset/rotated */
function parsePlist(xml: string) {
  const out: Record<string, { frame: [number, number, number, number]; source: [number, number]; off: [number, number]; rotated: boolean }> = {};
  const re = /<key>([^<]+\.png)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const name = m[1];
    const body = m[2];
    const g = (key: string) => {
      const r = new RegExp('<key>' + key + '</key>\\s*<string>\\{([-0-9.]+),([-0-9.]+)(?:,\\{([-0-9.]+),([-0-9.]+)\\})?\\}</string>').exec(body);
      return r ? [Number(r[1]), Number(r[2]), Number(r[3] ?? 0), Number(r[4] ?? 0)] : null;
    };
    /* ★ 实测这份 plist 用的是 TexturePacker 的老键名:spriteSize(裁切后) / spriteSourceSize(原画布) /
       spriteOffset / textureRect(在图集里的矩形)—— 不是 frame/sourceSize ✗ */
    const f = g('textureRect'), s = g('spriteSourceSize'), o = g('spriteOffset'), sz = g('spriteSize');
    if (!s) continue;
    out[name] = {
      frame: f ? [f[0], f[1], f[2], f[3]] : [0, 0, sz ? sz[0] : s[0], sz ? sz[1] : s[1]],
      source: [s[0], s[1]],
      off: [o ? o[0] : 0, o ? o[1] : 0],
      rotated: /<key>textureRotated<\/key>\s*<true\/>/.test(body),
    };
  }
  return out;
}

console.log('形态     主帧名                       画布(px)    帧矩形(px)        留白比例   现值(格)   按帧算(格)');
for (const mode of MODES) {
  const p = path.join(DIR, mode + '.plist');
  if (!fs.existsSync(p)) { console.log('  ' + mode + ' 缺 plist'); continue; }
  const F = parsePlist(fs.readFileSync(p, 'utf8'));
  const names = Object.keys(F).filter((n) => !/_2_|_3_|_extra_|_glow_/.test(n)).sort((a, b) => a.localeCompare(b));
  const name = names[0];
  if (!name) { console.log('  ' + mode + ' 没有基础帧'); continue; }
  const fr = F[name];
  const [fw, fh] = [fr.frame[2], fr.frame[3]];
  const [sw, sh] = fr.source;
  const fill = (fw * fh) / Math.max(1, sw * sh);
  const nowBlocks = sw / REF_PX;          // 引擎现在:按 sourceSize
  const frameBlocks = fw / REF_PX;        // 若改成按帧矩形(内容)算
  console.log('  ' + mode.padEnd(7) + name.padEnd(29) + (sw + 'x' + sh).padEnd(12)
    + (fw + 'x' + fh).padEnd(18) + (fill * 100).toFixed(0).padStart(6) + '%'
    + nowBlocks.toFixed(2).padStart(10) + frameBlocks.toFixed(2).padStart(12));
}
console.log('\n说明:留白比例 = 帧矩形面积 / 画布面积。若明显 < 100%,则"看着小"是美术留白(①),');
console.log('      此时按【帧矩形】定尺寸(frameBlocks)才是贴着内容的大小。');
