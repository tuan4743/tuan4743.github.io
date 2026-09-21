/* 手工模式扫描:枚举"(0^a 1^b)^k + 收尾按住"这类按键串,找一条能进目标门、且不跳过别的门的尾段。
 * 用法:cd gd-web && node tools/hand-sweep.ts <卷子> <起帧> <目标门x> [--sawbase]
 *
 * 为什么要它:x=1060 那个 robot 门要求"先控制在 y≈24 过掉速度门,再下扎到平台面(22),
 * 落地那一刻按住(反重力下按住 = 往平台里压)就会被平台托着一路穿过门"。
 * 这条弧线手算很别扭(波浪每帧只能 ±0.32 块,高度是量化跳变的),直接枚举更快。
 * ★ 性能:必须"先回放到起点存快照,再逐条只跑尾段" —— 从头回放 5560 帧 × 几百条 = 分钟级,
 *   快照之后每条只跑 ~60 帧,秒级出结果(第一版就是没做这一步,直接超时)。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, type WorldSnap } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const SRC = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM = Number(process.argv[3] ?? 5524);
const DOOR_X = Number(process.argv[4] ?? 1060);
const SAWBASE = process.argv.includes('--sawbase');
const base: boolean[] = JSON.parse(fs.readFileSync(SRC, 'utf8')).tape;
if (SAWBASE) console.log('锯片判定盒:不缩放');

const w = new World(WATER_CHART, undefined, undefined, { sawUnscaled: SAWBASE });
const door = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes]
  .find((b) => Math.abs(b.o.b - DOOR_X) < 0.01);
if (!door) throw new Error('没找到门 x=' + DOOR_X);
const allDoors = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes].sort((a, b) => a.x1 - b.x1);

/** 越过了就算一次账(和 autoplay/audit 同一条判据) */
function auditStep(armed: Set<unknown>, skipped: Set<unknown>) {
  for (const b of allDoors) {
    if (armed.has(b) || skipped.has(b)) continue;
    if (w.x < b.x1) break;
    const o = b.o;
    const sat = o.kind === 'portal' ? w.mode === o.to
      : o.kind === 'gravity' ? w.gdir === (o.gdir ?? 1)
        : o.kind === 'speed' ? w.speedIdx === (o.speed ?? 1)
          : o.kind === 'size' ? (o.mini === false ? w.sizeMul === 1 : w.sizeMul !== 1) : false;
    (w.armedPortals.has(b) || sat ? armed : skipped).add(b);
  }
}

const rootArmed = new Set<unknown>(); const rootSkipped = new Set<unknown>();
/* ★ 回放阶段就要【每帧记账】:门的"生效"是越过那一刻判的(冗余门当时满足、过后就不满足了),
   只在起点问一次会把 19 个早就越过的门误判成"跳过"。 */
for (let i = 0; i < FROM && !w.dead && !w.done; i++) { w.frame(base[i]); auditStep(rootArmed, rootSkipped); }
const root: WorldSnap = w.snapshot();
console.log('起点:第 ' + FROM + ' 帧 x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓') + ' · 已生效 ' + rootArmed.size + ' 跳过 ' + rootSkipped.size);

let found = 0;
const t0 = Date.now();
let tried = 0;
for (let period = 3; period <= 10 && found < 8; period++) {
  for (let holds = 1; holds < period && found < 8; holds++) {
    for (let k = 1; k <= 6 && found < 8; k++) {
      for (const tail of [2, 6, 12, 20]) {
        const pat = Array.from({ length: k }, () =>
          new Array(period - holds).fill(false).concat(new Array(holds).fill(true))).flat()
          .concat(new Array(tail).fill(true));
        w.restore(root);
        const armed = new Set(rootArmed); const skipped = new Set(rootSkipped);
        for (const h of pat) {
          if (w.dead || w.done) break;
          w.frame(h);
          auditStep(armed, skipped);
        }
        tried++;
        if (w.armedPortals.has(door) && skipped.size === rootSkipped.size) {
          found++;
          console.log('★ 合法:每 ' + period + ' 帧按 ' + holds + ' 帧 × ' + k + ' 轮 + 收尾按住 ' + tail
            + ' → x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' ' + w.mode
            + ' · 生效 ' + armed.size + ' 跳过 ' + skipped.size);
          fs.writeFileSync('../../.tmp/gd/gap-hand.json', JSON.stringify({ from: FROM, inputs: pat }));
          console.log('   尾段(' + pat.length + ' 帧)写到 ../../.tmp/gd/gap-hand.json');
        }
      }
    }
  }
}
console.log((found ? '找到 ' + found + ' 条' : '没找到') + ' · 试了 ' + tried + ' 条 · 用时 '
  + ((Date.now() - t0) / 1000).toFixed(1) + 's');
