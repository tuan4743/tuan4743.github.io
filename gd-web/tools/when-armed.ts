/* "这门是哪一帧生效的?" —— 回放一卷输入,把某类门的【生效瞬间】连人带盒子打出来。
 * 为什么要它:审计只说"生效/没生效";当一扇门在明显不该生效的位置生效时(实测:y=23 的重力门
 * 在玩家贴着地面 y=0 跑过去时被算作生效),必须看到"哪一帧、人在哪、盒子在哪"才能定位。
 * 用法:cd gd-web && node tools/when-armed.ts <卷子.json> [grav|portal|speed|size|check] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const KIND = process.argv[3] ?? 'grav';
const idx: Record<string, number> = { check: 0, portal: 1, speed: 2, size: 3, grav: 4 };
const slot = idx[KIND];
if (slot == null) { console.error('kind 只认 check/portal/speed/size/grav'); process.exit(1); }

const tape: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;
const w = new World(WATER_CHART);
const list = { check: w.checks, portal: w.portals, speed: w.speeds, size: w.sizes, grav: w.gravs }[KIND];
let f = 0, n = 0;
for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  f++;
  const armed = w.snapshot().sets[slot] as unknown[];
  while (n < armed.length) {
    const box = armed[n] as { x0: number; x1: number; y0: number; y1: number; o: { kind: string; to?: string; gdir?: number; speed?: number; mini?: boolean } };
    const out = w.outer();
    console.log('第 ' + String(f).padStart(5) + ' 帧 · 生效第 ' + (n + 1) + ' 个 ' + KIND
      + ' · 人 x=' + ((out.x0 + out.x1) / 2 / U).toFixed(2) + ' y=[' + (out.y0 / U).toFixed(2) + ',' + (out.y1 / U).toFixed(2) + ']'
      + ' 形态=' + w.mode
      + ' · 盒 x[' + (box.x0 / U).toFixed(2) + ',' + (box.x1 / U).toFixed(2) + '] y[' + (box.y0 / U).toFixed(2) + ',' + (box.y1 / U).toFixed(2) + ']'
      + (box.o.to ? ' →' + box.o.to : '') + (box.o.gdir != null ? ' gdir=' + box.o.gdir : '')
      + (box.o.speed != null ? ' spd=' + box.o.speed : ''));
    n++;
  }
}
console.log('共回放 ' + f + ' 帧;' + KIND + ' 生效 ' + n + ' / ' + list.length + ' 个');
