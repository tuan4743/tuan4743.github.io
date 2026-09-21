/* 合成场景里的飞行类碰撞体检:一张干净的小关,只有一块宽实心 + 一个天花板,
 * 用来把"落顶面 / 撞侧面 / 撞底面"三件事分开量 —— 真关卡里到处是刺,量不准。
 * 用法:cd gd-web && node tools/probe-fly-synth.ts [形态] [起始y] [按键串]
 */
import { World } from '../src/sim/world.ts';
import type { Level } from '../src/sim/level.ts';
import { U } from '../src/sim/constants.ts';

const MODE = (process.argv[2] ?? 'ufo') as 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
const Y0 = Number(process.argv[3] ?? 8);
const PAT = process.argv[4] ?? '';

const lv: Level = {
  name: 'SYNTH', rows: 40, length: 60, song: '', songOffset: 0, segments: [],
  fromGD: true,
  start: { b: 0, r: 10 },
  objects: [
    /* 一块 20 格宽的实心台面,顶面 y=4(底 y=3);再放一个天花板在 y=12 处(底 y=12) */
    { kind: 'block', b: 8, r: 3, w: 20, h: 1 },
    { kind: 'block', b: 8, r: 12, w: 20, h: 1 },
  ],
} as unknown as Level;

const w = new World(lv);
w.reset(9 * U, MODE, Y0 * U);
w.gdir = 1; w.vy = 0; w.onGround = false;
w.traceSolid = process.argv.includes('--trace');
console.log('形态 ' + MODE + ' 起点 x=9 y=' + Y0 + ' · 台面顶 y=4 · 天花板底 y=12 · flySolid=' + w.flySolid);

for (let f = 0; f < 90 && !w.dead; f++) {
  const hold = PAT ? PAT[f % PAT.length] === 'H' : false;
  w.frame(hold);
  if (f < 12 || f % 6 === 0 || w.dead || w.onGround) {
    console.log('  帧 ' + String(f).padStart(3) + ' x=' + (w.x / U).toFixed(3) + ' y=' + (w.y / U).toFixed(3)
      + ' vy=' + (w.vy / U).toFixed(3) + (w.onGround ? ' 地' : '') + (w.dead ? ' ✗死' : ''));
  }
  if (w.onGround && f > 2) break;
}
console.log('结果:' + (w.dead ? '✗ 死' : '活着') + ' · x=' + (w.x / U).toFixed(3) + ' y=' + (w.y / U).toFixed(3)
  + (w.onGround ? ' 站在台面上' : ' 没落地'));
if (process.argv.includes('--trace')) {
  console.log('--- solidTrace 最后 14 行 ---');
  for (const l of w.solidTrace.slice(-14)) console.log('  ' + l);
}
