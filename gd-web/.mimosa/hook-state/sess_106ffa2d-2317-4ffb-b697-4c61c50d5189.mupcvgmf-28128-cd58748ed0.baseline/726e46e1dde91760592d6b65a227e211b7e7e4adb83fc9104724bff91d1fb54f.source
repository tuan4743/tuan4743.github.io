/* 定点实验:把一卷输入卷在某个窗口里的按键【翻一下】,看"就差这一下"能不能让某个门生效。
 * 用法:cd gd-web && node tools/probe-flip.ts <卷子> <目标门 x> [起帧] [止帧]
 *
 * 为什么要它:搜索卡在"差 0.5 块"的地方时(实测 x=1060 的 robot 门:卷子进门前 y=25.4、
 * 门的上沿 24.93,差 0.5 块进不去),要回答的往往不是"重搜整段",而是
 * "把进门前某一帧的按键改一下,改成什么才过得去" —— 这个脚本一次扫完整个窗口。
 * ★ 实现上必须"先回放到窗口起点、存快照,再逐帧试":从头回放 5500 帧 × 几百次
 *   是分钟级的(第一版就是这么超时的),快照之后每次只跑几十帧。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, type WorldSnap } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const DOOR_X = Number(process.argv[3] ?? 1060);
const F0 = Number(process.argv[4] ?? 0);
const F1 = Number(process.argv[5] ?? 0);

const base: boolean[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).tape;
const probe = new World(WATER_CHART);
const box = [...probe.portals, ...probe.gravs, ...probe.speeds, ...probe.sizes]
  .find((b) => Math.abs(b.o.b - DOOR_X) < 0.01);
if (!box) throw new Error('没找到 x=' + DOOR_X + ' 的门');
console.log('目标门 x=' + box.o.b + ' ' + box.o.kind + (box.o.to ? '→' + box.o.to : '')
  + ' 盒 x[' + (box.x0 / U).toFixed(2) + ',' + (box.x1 / U).toFixed(2) + '] y['
  + (box.y0 / U).toFixed(2) + ',' + (box.y1 / U).toFixed(2) + ']');

const w = new World(WATER_CHART);
const lo = F0 || Math.max(0, base.length - 150);
/* 回放到窗口起点,存快照 */
for (let i = 0; i < lo && !w.dead && !w.done; i++) w.frame(base[i]);
const snap: WorldSnap = w.snapshot();
console.log('窗口起点(第 ' + lo + ' 帧):x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)
  + ' ' + w.mode + (w.gdir < 0 ? '↑' : '↓') + ' 速度档=' + w.speedIdx + ' 按着=' + (base[lo - 1] ? '是' : '否'));

/** 从快照起跑:窗口内按 mod 改写,窗口之后用原卷 */
function trial(mod: (i: number) => boolean | null) {
  w.restore(snap);
  let i = lo;
  for (; i < base.length; i++) {
    if (w.dead || w.done) break;
    const m = mod(i);
    w.frame(m === null ? base[i] : m);
  }
  return { armed: w.armedPortals.has(box!), x: w.x / U, y: w.y / U, dead: w.dead };
}
const baseRun = trial(() => null);
const hi = F1 || base.length - 1;
console.log('原样跑完:门' + (baseRun.armed ? '【已生效】' : '没生效') + ' · x=' + baseRun.x.toFixed(2)
  + ' y=' + baseRun.y.toFixed(2) + (baseRun.dead ? ' 死了' : ''));

const kind = (i: number) => (base[i] ? '按住' : '松手');
let hits = 0;
console.log('\n单帧改写扫描 ' + lo + '~' + hi + ':');
for (let i = lo; i <= hi; i++) {
  for (const [tag, v] of [['翻', !base[i]], ['按住', true], ['松手', false]] as const) {
    if (v === base[i] && tag !== '翻') continue;              // 和原来一样就没必要试
    const r = trial((k) => (k === i ? v : null));
    if (r.armed && !baseRun.armed) {
      hits++;
      if (hits <= 15) {
        console.log('  ✓ 第 ' + i + ' 帧改成【' + tag + '】(原来是' + kind(i) + ')→ 门生效 · 走到 x='
          + r.x.toFixed(2) + ' y=' + r.y.toFixed(2));
      }
    }
  }
}
console.log(hits ? '共 ' + hits + ' 个单帧改法能让门生效' : '单帧改写都不行');

/* 窗口改写:某一段【连续】全按住 / 全松手 —— 波浪段尤其需要这个:
   波浪的高度 = "按住/松开的帧数差"的积分,连松 4 帧和"单帧翻一下"是两回事。 */
console.log('\n窗口改写扫描(长度 1~14 帧):');
let wins = 0;
for (const want of [false, true]) {
  for (let len = 1; len <= 14; len++) {
    for (let s = lo; s + len - 1 <= hi; s++) {
      const r = trial((k) => (k >= s && k < s + len ? want : null));
      if (r.armed && !baseRun.armed) {
        wins++;
        if (wins <= 12) console.log('  ✓ 窗口 [' + s + ',' + (s + len - 1) + '] 全' + (want ? '按住' : '松手')
          + ' → 门生效 · 走到 x=' + r.x.toFixed(2) + ' y=' + r.y.toFixed(2));
      }
    }
  }
}
console.log(wins ? '共 ' + wins + ' 个窗口改法' : '窗口改写也不行');

/* ★ 两段式:先【松手 L1 帧】再【按住 L2 帧】,之后回原卷。
   为什么要这个:波浪段的"高度"是两段式的 —— 想停在一个具体高度上,
   必须先扎下去再抬一下头(实测 x=1053 那个门缝只有 0.15 块宽),
   单段"全松/全按"根本表达不了这种形状。 */
console.log('\n两段式(松 L1 帧 → 按 L2 帧):');
let seg = 0;
for (let s = lo; s <= hi - 2; s++) {
  for (let l1 = 2; l1 <= 16; l1++) {
    for (let l2 = 0; l2 <= 5; l2++) {
      const r = trial((k) => (k >= s && k < s + l1 ? false : (k >= s + l1 && k < s + l1 + l2 ? true : null)));
      if (r.armed && !baseRun.armed) {
        seg++;
        if (seg <= 12) console.log('  ✓ 第 ' + s + ' 帧起:松 ' + l1 + ' 帧 → 按 ' + l2 + ' 帧 → 门生效 · x='
          + r.x.toFixed(2) + ' y=' + r.y.toFixed(2));
      }
    }
  }
}
console.log(seg ? '共 ' + seg + ' 个两段式改法' : '两段式也不行');

