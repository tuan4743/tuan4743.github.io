/* 手搓波浪段:x=1052 之后必须【贴着锯片顶、从方块门底下钻过去】再吃 x=1060 的机器人门。
 * 为什么要有它:搜索从 1035/1040/1052 起都试过(硬走廊、软走廊、细步进),都只能"活着飞到 1061"
 *   却吃不到机器人门 —— 到底是我们物理里这条缝根本过不去,还是搜索没摸到,必须用手搓判定。
 * 用法:cd gd-web && node tools/hand-wave.ts <带子.json> <从哪块起手> <按键串> [跑多少帧]
 *   按键串 = H(按住)/R(松开)的序列,循环使用,例如 "RRHRHRHRHRHRHRHRHRH"。
 *   分号分隔可以一次试多串:  "RRH;RRRHH;RHRH"
 * 打印:每帧 x/y/mode/gdir + 所有事件(形态门/重力/板/环/存档),并汇总"机器人门到底吃了没有"。 */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const TAPE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const X0 = Number(process.argv[3] ?? 1052);
const PATS = (process.argv[4] ?? 'RHRHRHRHRHRHRHRHRHRH').split(';');
const N = Number(process.argv[5] ?? 80);

const raw = JSON.parse(fs.readFileSync(TAPE, 'utf8'));
const tape: boolean[] = raw.tape ?? raw;

for (const pat of PATS) {
  const w = new World(WATER_CHART);
  w.windowed = true;
  let i = 0;
  for (; i < tape.length; i++) { if (w.dead || w.done || w.x / U >= X0) break; w.frame(tape[i]); }
  const x0 = w.x / U, y0 = w.y / U;
  console.log('\n=== 按键串 "' + pat + '" · 起手 x=' + x0.toFixed(2) + ' y=' + y0.toFixed(2)
    + ' mode=' + w.mode + ' gdir=' + w.gdir + ' vy=' + (w.vy / U).toFixed(3) + ' 帧=' + w.tick);
  let nPort = 0, nGrav = 0;
  /* ★ 起手那一帧的已生效门数要【先记下来】:World 是从头回放的,前面几十个门早就在集合里,
     不扣掉就会把"历史账"当成"这一帧吃到的"(第一版就被这个坑了)。 */
  {
    const s0 = w.snapshot();
    nPort = (s0.sets[1] as unknown as unknown[]).length;
    nGrav = (s0.sets[4] as unknown as unknown[]).length;
  }
  const before = new Set<string>();
  let robot = false;
  for (let k = 0; k < N && !w.dead && !w.done; k++) {
    const c = pat[k % pat.length];
    w.frame(c === 'H');
    const s = w.snapshot();
    const ports = s.sets[1] as unknown as Array<{ o: { to?: string } }>;
    while (nPort < ports.length) {
      const t = ports[nPort].o.to ?? '?';
      if (t === 'robot') robot = true;
      console.log('   帧 ' + (k + 1) + ' ◆形态门→' + t + ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2));
      nPort++;
    }
    const gravs = s.sets[4] as unknown as unknown[];
    while (nGrav < gravs.length) { console.log('   帧 ' + (k + 1) + ' ◆重力门 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' →' + w.gdir); nGrav++; }
    void before;
    if (k % 2 === 0 || w.dead || w.mode !== 'wave') {
      console.log('   帧 ' + String(k + 1).padStart(3) + ' ' + c + ' x=' + (w.x / U).toFixed(2).padStart(8)
        + ' y=' + (w.y / U).toFixed(2).padStart(7) + ' vy=' + (w.vy / U).toFixed(2).padStart(6)
        + ' gdir=' + w.gdir + ' ' + w.mode + (w.dead ? ' ✗死' : ''));
    }
  }
  console.log('   → 结果 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' mode=' + w.mode
    + (w.dead ? ' 【死了】' : w.done ? ' 【通关】' : '') + ' · 机器人门 ' + (robot ? '★吃到了' : '没吃到'));
}
