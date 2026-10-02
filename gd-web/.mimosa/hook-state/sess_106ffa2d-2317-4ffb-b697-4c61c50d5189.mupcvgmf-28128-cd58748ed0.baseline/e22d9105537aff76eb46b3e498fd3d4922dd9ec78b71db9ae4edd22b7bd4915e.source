/* 回放一条带子,只打【事件】:形态门、重力翻转、弹簧板、跳环、存档点、死亡。
 * 为什么:正规前缀已经从 x=606.8 推到 x=1061,但"它到底有没有吃到塔顶那个 UFO 门"必须逐条核 ——
 *   门生效数(41/108)只是个总数,看不出哪一扇。
 * 用法:cd gd-web && node tools/tape-events.ts <tape.json> [x0] [x1]
 *   给了 x0/x1 就只打这一段里的事件(块坐标)。 */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const TAPE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const X0 = Number(process.argv[3] ?? -Infinity);
const X1 = Number(process.argv[4] ?? Infinity);

const raw = JSON.parse(fs.readFileSync(TAPE, 'utf8'));
const tape: boolean[] = raw.tape ?? raw;
const w = new World(WATER_CHART);
w.windowed = true;

const inWin = () => w.x / U >= X0 && w.x / U <= X1;
const show = (tag: string, extra: string) =>
  console.log(String(w.tick).padStart(5) + ' 帧 ' + tag + ' x=' + (w.x / U).toFixed(2)
    + ' y=' + (w.y / U).toFixed(2) + ' mode=' + w.mode + ' gdir=' + w.gdir
    + ' vx=' + (w.x / U).toFixed(2) + (extra ? '  ' + extra : ''));

let nPads = 0, nPorts = 0, nGravs = 0, nOrbs = 0, nChecks = 0, lastMode = w.mode, lastGdir = w.gdir;
for (let i = 0; i < tape.length; i++) {
  w.frame(tape[i]);
  const s = w.snapshot();
  const box = (b: { x0: number; x1: number; y0: number; y1: number }) =>
    '(' + (((b.x0 + b.x1) / 2) / U).toFixed(2) + ',' + (((b.y0 + b.y1) / 2) / U).toFixed(2) + ')';
  const pads = s.sets[6], ports = s.sets[1], gravs = s.sets[4], orbs = s.sets[5], checks = s.sets[0];
  while (nPorts < ports.length) {
    const b = ports[nPorts] as unknown as { o: { to?: string } } & Parameters<typeof box>[0];
    show('◆形态门→' + (b.o.to ?? '?') + ' ' + box(b), inWin() ? '' : '');
    nPorts++;
  }
  while (nGravs < gravs.length) {
    const b = gravs[nGravs] as unknown as Parameters<typeof box>[0];
    show('◆重力门 ' + box(b) + ' → gdir=' + w.gdir, '');
    nGravs++;
  }
  while (nPads < pads.length) {
    const b = pads[nPads] as unknown as { o: { rot?: number; pad?: string } } & Parameters<typeof box>[0];
    show('★弹簧板 ' + box(b) + ' rot=' + (b.o.rot ?? 0) + ' ' + (b.o.pad ?? ''), '');
    nPads++;
  }
  while (nOrbs < orbs.length) {
    const b = orbs[nOrbs] as unknown as { o: { orb?: string } } & Parameters<typeof box>[0];
    show('☆跳环 ' + box(b) + ' ' + (b.o.orb ?? ''), '');
    nOrbs++;
  }
  while (nChecks < checks.length) {
    const b = checks[nChecks] as unknown as Parameters<typeof box>[0];
    show('▣存档点 ' + box(b), '');
    nChecks++;
  }
  if (w.mode !== lastMode) { show('·形态 ' + lastMode + '→' + w.mode, ''); lastMode = w.mode; }
  if (w.gdir !== lastGdir) { show('·重力 ' + lastGdir + '→' + w.gdir, ''); lastGdir = w.gdir; }
  if (w.dead) { show('✗ 死', ''); break; }
  if (w.done) { show('✓ 通关', ''); break; }
}
console.log('回放结束:x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' mode=' + w.mode + ' gdir=' + w.gdir + ' 帧=' + w.tick
  + (w.dead ? ' 【死了】' : w.done ? ' 【通关】' : '')
  + ' · 门 ' + nPorts + ' 重力 ' + nGravs + ' 板 ' + nPads + ' 环 ' + nOrbs + ' 存档 ' + nChecks);
