/* 微搜索:在【一小段】里把输入穷举到"能过"为止 —— 用来判定"这条缝到底过不过得去",并给出按键串。
 * 为什么不用 autoplay:整关搜索带门禁、宏动作、前沿聚焦,参数一变行为就变;
 *   而 x=1050~1062 这段的难点是"贴着锯片(r=1.64)顶、从方块门(下沿 24.07)底下钻过去"——
 *   自由度过窄(约 0.6 块),需要的是【同一 x 上所有 y 都不漏】的穷举,不是启发式。
 *   ★ 关键性质:这一段 vx 固定(速度门已把速度锁在 4 档,0.32 块/帧),
 *     所以第 k 帧的 x 是定值 —— 状态空间退化成"y 谁活着",束宽开到几千就是真穷举。
 * 用法:cd gd-web && node tools/micro-search.ts <带子.json> <起手x> [帧数] [束宽] [目标门形态=robot]
 *   --avoid=<形态>  碰到这个形态门就当死(用来逼它钻门底,例如 --avoid=cube) */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, type WorldSnap } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const arg = (n: string, d: string) => {
  const hit = process.argv.find((a) => a.startsWith('--' + n + '='));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const TAPE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const X0 = Number(process.argv[3] ?? 1049);
const FRAMES = Number(process.argv[4] ?? 60);
const BEAM = Number(process.argv[5] ?? 4000);
const WANT = process.argv[6] ?? 'robot';
const AVOID = arg('avoid', '');

const raw = JSON.parse(fs.readFileSync(TAPE, 'utf8'));
const tape: boolean[] = raw.tape ?? raw;

const w0 = new World(WATER_CHART);
w0.windowed = true;
let consumed = 0;
for (const h of tape) { if (w0.dead || w0.done || w0.x / U >= X0) break; w0.frame(h); consumed++; }
const start = w0.snapshot();
console.log('起手 x=' + (start.x / U).toFixed(2) + ' y=' + (start.y / U).toFixed(2)
  + ' mode=' + start.mode + ' gdir=' + start.gdir + ' · 已吃 ' + consumed + ' 帧(带子下标从 ' + consumed + ' 起)'
  + ' · 找 door=' + WANT + (AVOID ? ' · 躲 door=' + AVOID : ''));

interface Node { s: WorldSnap; inp: string; armed: boolean }
const key = (s: WorldSnap, armed: boolean) =>
  Math.round(s.y) + '|' + Math.round(s.vy) + '|' + s.mode + '|' + s.gdir + '|' + (s.dead ? 1 : 0) + '|' + (armed ? 1 : 0);

const probe = new World(WATER_CHART);
let nodes: Node[] = [{ s: start, inp: '', armed: false }];
const basePorts = (start.sets[1] as unknown as unknown[]).length;
/* ★ 两条最好线要分开记:吃门的那条(bestArmed)和纯粹走得远的那条(bestAny)。
   第一版把两者混在一个 best 里,并且加了 `!best.armed` 守卫 —— 结果"第一次吃到门"就把 best 冻住了,
   后面走得更远的 armed 状态再也刷不进去(实测 bestArmed 一直停在 x=1059.21)。 */
let bestArmed = { x: -Infinity, inp: '' };
let bestAny = { x: start.x, inp: '' };

for (let f = 0; f < FRAMES; f++) {
  const next: Node[] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    for (const hold of [false, true]) {
      probe.restore(n.s);
      probe.frame(hold);
      const s = probe.snapshot();
      let armed = n.armed;
      const ports = s.sets[1] as unknown as Array<{ o: { to?: string } }>;
      for (let i = basePorts; i < ports.length; i++) {
        const to = ports[i].o.to;
        if (to === WANT) armed = true;
        if (AVOID && to === AVOID && !n.armed) { (s as { dead: boolean }).dead = true; }
      }
      if (s.dead) continue;
      const k = key(s, armed);
      if (seen.has(k)) continue;
      seen.add(k);
      const kid: Node = { s, inp: n.inp + (hold ? 'H' : 'R'), armed };
      next.push(kid);
      if (armed && s.x > bestArmed.x) bestArmed = { x: s.x, inp: kid.inp };
      if (s.x > bestAny.x) bestAny = { x: s.x, inp: kid.inp };
    }
  }
  if (!next.length) { console.log('第 ' + (f + 1) + ' 帧全灭'); break; }
  /* 剪枝:同一帧 x 相同,按 y 均匀保留(宁可留远的、也别把窄缝里的路剪掉) */
  if (next.length > BEAM) {
    next.sort((a, b) => b.s.y - a.s.y);
    const keep: Node[] = [];
    const stride = next.length / BEAM;
    for (let i = 0; i < BEAM; i++) keep.push(next[Math.floor(i * stride)]);
    nodes = keep;
  } else nodes = next;
  if (f % 10 === 9 || f === FRAMES - 1) {
    const xs = nodes.map((n) => n.s.x / U);
    const ys = nodes.map((n) => n.s.y / U);
    console.log('第 ' + String(f + 1).padStart(3) + ' 帧 · 状态 ' + nodes.length
      + ' · x ' + Math.min(...xs).toFixed(2) + '~' + Math.max(...xs).toFixed(2)
      + ' · y ' + Math.min(...ys).toFixed(2) + '~' + Math.max(...ys).toFixed(2));
  }
}
console.log('吃得门的最远 ' + (Number.isFinite(bestArmed.x) ? (bestArmed.x / U).toFixed(2) + ' 块' : '(没有一条吃到门)')
  + ' · 纯走得远 ' + (bestAny.x / U).toFixed(2) + ' 块');
const USE = Number.isFinite(bestArmed.x) ? bestArmed : bestAny;
console.log('按键串(' + USE.inp.length + ' 帧,从 x=' + (start.x / U).toFixed(2) + ' 起):' + USE.inp.slice(0, 200));
const TAIL = arg('tail', '');
if (TAIL) {
  fs.writeFileSync(TAIL, JSON.stringify({ from: consumed, inputs: [...USE.inp].map((c) => c === 'H') }));
  console.log('尾段已写:' + TAIL + '(from=' + consumed + ' + ' + USE.inp.length + ' 帧'
    + (Number.isFinite(bestArmed.x) ? ',吃到门' : ',没吃到门') + ')');
}
