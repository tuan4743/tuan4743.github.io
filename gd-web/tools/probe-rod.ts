/* 定点追查(第 19 轮):卷子里 UFO 在 x≈655 穿过细杆地板那几帧,到底哪一步判丢了?
 * 做法:回放卷子到指定帧,然后逐帧把"玩家内框/外框、窗口里的杆、内框与杆是否在 x/y 上重叠"打出来。
 * 用法:cd gd-web && node tools/probe-rod.ts <卷子.json> [起始帧=4150] [看几帧=30] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM = Number(process.argv[3] ?? 4150);
const N = Number(process.argv[4] ?? 30);
const tape: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;

const w = new World(WATER_CHART);
const f = (v: number) => v.toFixed(3);
for (let i = 0; i < tape.length && i < FROM; i++) {
  if (w.dead || w.done) break;
  w.frame(tape[i]);
}
console.log('回放到第 ' + FROM + ' 帧:x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' 形态=' + w.mode + ' 窗口裁剪=' + w.isWindowed);
w.traceSolid = true;
for (let i = FROM; i < Math.min(tape.length, FROM + N); i++) {
  const hold = tape[i];
  w.solidTrace.length = 0;
  w.frame(hold);
  /* ★ 把这一帧里"内框真的碰到杆"的那几支打出来 —— 只看帧末状态推不出走的是哪一支 */
  const hit = w.solidTrace.filter((s) => s.includes('yOverlap='));
  if (hit.length) {
    for (const s of hit.slice(0, 4)) console.log('  [实心支] 帧 ' + i + ' ' + s);
  }
  const inn = w.inner(), out = w.outer();
  /* 只找 x 方向重叠的杆(kind='frame'):把它们的 y 区间打出来
     ★ 别按 id 过滤 —— 紧凑铺面文本里 frame 类没有 id(id 只给锯片/刺带上了)。 */
  const isRod = (b: { o: { kind: string } }) => b.o.kind === 'frame';
  const rods = w.nearSolids.filter((b) => isRod(b) && inn.x1 > b.x0 && inn.x0 < b.x1);
  const info = rods.map((b) => '杆y[' + (b.y0 / U).toFixed(3) + ',' + (b.y1 / U).toFixed(3) + ']'
    + ((inn.y1 > b.y0 && inn.y0 < b.y1) ? '★内框重叠' : ' 内框差 ' + Math.min(Math.abs(inn.y0 - b.y1), Math.abs(b.y0 - inn.y1)).toFixed(3))).join(' ; ');
  /* 也看"外框在 x 上重叠"的杆(可能内框太窄,压根没进判定) */
  const rodsOut = w.nearSolids.filter((b) => isRod(b) && out.x1 > b.x0 && out.x0 < b.x1).length;
  console.log('  帧 ' + i + (hold ? ' H' : ' .') + ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
    + ' ' + w.mode + ' vy=' + (w.vy / U).toFixed(3) + (w.onGround ? ' 地' : '')
    + ' · 内框y[' + (inn.y0 / U).toFixed(3) + ',' + (inn.y1 / U).toFixed(3) + ']'
    + ' · 实心窗口 ' + w.nearSolids.length + ' 个(外框x重叠的杆 ' + rodsOut + ')'
    + (info ? ' · ' + info : ' · 内框 x 上没有杆'));
  if (w.dead) { console.log('  → 死了'); break; }
}
console.log('内部量:frameY0=' + f(w.frameY0 / U) + ' box=' + w.box + ' 单位 · innerOff=' + w.innerOff + ' · innerSize=' + w.innerSize);
