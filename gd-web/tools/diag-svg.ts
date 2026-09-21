/* 出图:把某一段的【判定盒】画成 SVG(用户看编辑器时没有 x 坐标,得给张图对得上)。
 * 用法:cd gd-web && node tools/diag-svg.ts <x0块> <x1块> [y0格] [y1格] [卷子.json] [输出.svg]
 *   给了卷子就把它的轨迹也画上(只画落在窗口里的那段)。
 *
 * 图例:实心方块=灰、线框(虚)=深灰、尖刺/锯片=红、弹簧=绿、跳环=橙、
 *       形态门=紫(实线框)、速度门=青、重力门=蓝、尺寸门=黄、机器人门=紫红、
 *       平台=浅灰、玩家轨迹=白线。
 * ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const X0 = Number(process.argv[2] ?? 1048);
const X1 = Number(process.argv[3] ?? 1070);
const Y0 = Number(process.argv[4] ?? 16);
const Y1 = Number(process.argv[5] ?? 34);
const TAPE = process.argv[6] ?? '';
const OUT = process.argv[7] ?? '../../.tmp/gd/section.svg';
const SC = 46;                                   // 每块多少像素
const W = (X1 - X0) * SC, H = (Y1 - Y0) * SC;
const px = (bx: number) => (bx - X0) * SC;
const py = (by: number) => H - (by - Y0) * SC;   // y 向上

const w = new World(WATER_CHART);
const colorOf = (kind: string, o: { to?: string; pad?: string; orb?: string; mini?: boolean }): [string, string] => {
  if (kind === 'spike' || kind === 'saw') return ['#7f1d1d', '#ef4444'];
  if (kind === 'pad') return ['#064e3b', '#34d399'];
  if (kind === 'orb') return ['#7c2d12', '#fb923c'];
  if (kind === 'portal') {
    if (o.to === 'robot') return ['#500724', '#f472b6'];
    return ['#3b0764', '#c084fc'];
  }
  if (kind === 'speed') return ['#083344', '#22d3ee'];
  if (kind === 'gravity') return ['#172554', '#60a5fa'];
  if (kind === 'size') return ['#422006', '#facc15'];
  if (kind === 'platform') return ['#1f2937', '#9ca3af'];
  if (kind === 'frame') return ['#111827', '#6b7280'];
  if (kind === 'breakable') return ['#3f2d1a', '#d97706'];
  return ['#111827', '#e5e7eb'];
};

const parts: string[] = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 70}" height="${H + 50}" font-family="monospace">`);
parts.push(`<rect width="100%" height="100%" fill="#05070d"/>`);
/* 网格:每块一条淡线,每 5 块一条亮线并标 x */
for (let bx = X0; bx <= X1; bx++) {
  const big = bx % 5 === 0;
  parts.push(`<line x1="${px(bx)}" y1="0" x2="${px(bx)}" y2="${H}" stroke="${big ? '#1f2a3a' : '#0d1420'}"/>`);
  if (big) parts.push(`<text x="${px(bx) + 2}" y="${H + 14}" fill="#64748b" font-size="11">x=${bx}</text>`);
}
for (let by = Y0; by <= Y1; by++) {
  const big = by % 2 === 0;
  parts.push(`<line x1="0" y1="${py(by)}" x2="${W}" y2="${py(by)}" stroke="${big ? '#1f2a3a' : '#0d1420'}"/>`);
  if (big) parts.push(`<text x="${W + 4}" y="${py(by) + 4}" fill="#64748b" font-size="11">y=${by}</text>`);
}

/* 画判定盒(用 World 里真实的 Box,和物理完全一致) */
const lists: Array<[string, typeof w.solids]> = [
  ['platform', w.floors], ['block', w.solids], ['spike', w.hazards],
  ['pad', w.pads], ['orb', w.orbs], ['portal', w.portals],
  ['speed', w.speeds], ['gravity', w.gravs], ['size', w.sizes],
];
for (const [kind, list] of lists) {
  for (const b of list) {
    const bx0 = b.x0 / U, bx1 = b.x1 / U, by0 = b.y0 / U, by1 = b.y1 / U;
    if (bx1 < X0 || bx0 > X1 || by1 < Y0 || by0 > Y1) continue;
    const [fill, stroke] = colorOf(kind, b.o as never);
    const dash = kind === 'frame' ? ' stroke-dasharray="3,3"' : '';
    parts.push(`<rect x="${px(bx0)}" y="${py(by1)}" width="${Math.max(1, (bx1 - bx0) * SC)}"`
      + ` height="${Math.max(1, (by1 - by0) * SC)}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dash}/>`);
    if (kind === 'portal' || kind === 'speed' || kind === 'gravity' || kind === 'size' || kind === 'pad' || kind === 'orb') {
      const label = kind === 'portal' ? ('→' + (b.o.to ?? '?')) : kind === 'pad' ? ('板' + (b.o.pad ?? ''))
        : kind === 'orb' ? ('环' + (b.o.orb ?? '')) : kind === 'speed' ? ('速' + (b.o.speed ?? ''))
          : kind === 'gravity' ? ('重' + (b.o.gdir ?? 1)) : ('尺' + (b.o.mini === false ? '大' : '小'));
      parts.push(`<text x="${px(bx0)}" y="${py(by1) - 3}" fill="${stroke}" font-size="10">${label}</text>`);
    }
  }
}

/* ★ 圆形危险物(锯片族):画【真判定圆】—— 以前这里画的是贴图矩形,和物理不一致
   (见 HANDOVER §13.18:1705 的判定是半径 32.3×缩放的圆,不是 85×44 的方盒)。
   浅色圆 = 圆的判定;外面那圈虚线方框 = 贴图外框(只作参考,不参与判定)。 */
for (const c of w.circles) {
  const cbx = c.cx / U, cby = c.cy / U, cr = c.r / U;
  if (cbx + cr < X0 || cbx - cr > X1 || cby + cr < Y0 || cby - cr > Y1) continue;
  const bx0 = c.box.x0 / U, bx1 = c.box.x1 / U, by0 = c.box.y0 / U, by1 = c.box.y1 / U;
  parts.push(`<rect x="${px(bx0)}" y="${py(by1)}" width="${(bx1 - bx0) * SC}" height="${(by1 - by0) * SC}"`
    + ` fill="none" stroke="#7f1d1d" stroke-width="1" stroke-dasharray="3,3"/>`);
  parts.push(`<circle cx="${px(cbx)}" cy="${py(cby)}" r="${cr * SC}" fill="#ef444433" stroke="#ef4444" stroke-width="1.5"/>`);
  parts.push(`<text x="${px(bx0)}" y="${py(by1) - 3}" fill="#ef4444" font-size="10">锯${c.o.id ?? ''} r=${cr.toFixed(2)}</text>`);
}

/* 轨迹 */
if (TAPE && fs.existsSync(TAPE)) {
  const tape: boolean[] = JSON.parse(fs.readFileSync(TAPE, 'utf8')).tape;
  const w2 = new World(WATER_CHART);
  const pts: string[] = [];
  for (const h of tape) {
    if (w2.dead || w2.done) break;
    w2.frame(h);
    const bx = w2.x / U, by = w2.y / U;
    if (bx >= X0 - 1 && bx <= X1 + 1) pts.push(px(bx).toFixed(1) + ',' + py(by).toFixed(1));
  }
  if (pts.length) parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9"/>`);
  parts.push(`<text x="6" y="16" fill="#e5e7eb" font-size="12">白线 = 机器人当前前缀的轨迹</text>`);
}
parts.push(`<text x="6" y="${H + 32}" fill="#94a3b8" font-size="12">x ${X0}~${X1} 格 · y ${Y0}~${Y1} 格 · 图里 1 格 = ${SC} 像素(示意;游戏里 1 格 = 30 单位)· 虚线方框 = 贴图外框,红圆 = 真判定</text>`);
parts.push('</svg>');
fs.mkdirSync(OUT.replace(/[/\\][^/\\]*$/, ''), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'));
console.log('写到 ' + OUT + '(' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB · '
  + (W + 70) + '×' + (H + 50) + ')');
