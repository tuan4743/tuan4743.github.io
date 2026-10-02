/* 打印一条带子的【轨迹采样】:每 N 帧一行 x/y/mode/gdir/vy —— 用来手判某一站附近人到底在哪。
 * 为什么:第 49 站(机器人门 x=1060)卡住时,前缀终点是 x=1061.06 y=30.13(天花板),
 *   而门中心在 y≈23.5 —— 光看"走到 1061.1"根本发现不了"是飞过去了没吃到"。
 * 用法:cd gd-web && node tools/traj.ts <tape.json> [x0] [x1] [每N帧=6] */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const TAPE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const X0 = Number(process.argv[3] ?? -Infinity);
const X1 = Number(process.argv[4] ?? Infinity);
const EVERY = Math.max(1, Number(process.argv[5] ?? 6));

const raw = JSON.parse(fs.readFileSync(TAPE, 'utf8'));
const tape: boolean[] = raw.tape ?? raw;
const w = new World(WATER_CHART);
w.windowed = true;
let lastMode = '';
for (let i = 0; i < tape.length; i++) {
  w.frame(tape[i]);
  const x = w.x / U;
  if (x < X0 || x > X1) continue;
  const tag = w.mode !== lastMode ? ' ← 形态 ' + lastMode + '→' + w.mode : '';
  lastMode = w.mode;
  if (i % EVERY === 0 || tag) {
    console.log(String(i).padStart(5) + '  x=' + x.toFixed(2).padStart(8) + ' y=' + (w.y / U).toFixed(2).padStart(7)
      + ' vy=' + (w.vy / U).toFixed(2).padStart(6) + ' gdir=' + String(w.gdir).padStart(2)
      + ' ' + w.mode + (w.onGround ? ' 地' : '') + (w.dead ? ' ✗死' : '') + tag);
  }
  if (w.dead || w.done) break;
}
console.log('结束 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' mode=' + w.mode
  + (w.dead ? ' 【死了】' : w.done ? ' 【通关】' : ''));
