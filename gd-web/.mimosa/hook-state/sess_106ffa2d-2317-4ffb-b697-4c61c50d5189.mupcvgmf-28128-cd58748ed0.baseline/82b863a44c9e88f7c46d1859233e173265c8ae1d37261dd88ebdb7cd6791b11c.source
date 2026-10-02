/* 定点实验:改一卷输入卷里的指定帧,打印改前/改后逐帧轨迹(看"就差这一下"到底差在哪)。
 * 用法:cd gd-web && node tools/probe-frame.ts <卷子> <帧号> <改成0或1> [看帧数]
 * 例:node tools/probe-frame.ts ../../.tmp/gd/water-route.best.json 5533 0 40 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const AT = Number(process.argv[3] ?? 5533);
const TO = process.argv[4] === '1';
const SHOW = Number(process.argv[5] ?? 40);
const base: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;

function run(modAt: number | null): string[] {
  const w = new World(WATER_CHART);
  const out: string[] = [];
  let i = 0;
  for (const h of base) {
    if (w.dead || w.done) break;
    w.frame(i === modAt ? TO : h);
    if (i >= AT && i < AT + SHOW) {
      out.push(i + ': x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
        + ' vy=' + (w.vy / U).toFixed(2) + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓')
        + (w.dead ? ' 【死了】' : ''));
    }
    i++;
  }
  out.push('→ 结束 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' ' + w.mode
    + (w.dead ? ' 【死了】' : '') + ' · 门生效数 ' + w.armedPortals.size);
  return out;
}
console.log('=== 原卷 ===');
for (const l of run(null)) console.log('  ' + l);
console.log('=== 第 ' + AT + ' 帧改成 ' + (TO ? '按住' : '松手') + ' ===');
for (const l of run(AT)) console.log('  ' + l);
