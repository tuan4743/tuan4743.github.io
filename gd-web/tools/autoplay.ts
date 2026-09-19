/* ============================================================
   搜索式自动通关(第三张盘:用户自己铺的 WATER)
   ─────────────────────────────────────────────────────────────
   为什么不用"看见危险就跳"的老机器人:那张铺面是真人设计的关卡 ——
   弹簧连、跳环链、重力翻转、UFO/波浪/蜘蛛段都要求"在对的那一帧按下/松开",
   反应式规则写不出来。这里换成【向前试算】:

     每一小段(STEP 帧)只做一件事:在当前状态上试几种"接下来怎么按",
     每种按法之后交给反应式机器人兜底跑一段(HORIZON 帧),
     活下来、而且走得最远的那个,就采用它的头 STEP 帧。

   于是"什么时候按"由穷举试出来,"按完怎么办"由兜底策略顶着 ——
   铺面一改就重跑一遍,0 死亡 = 这张图真的能过。

   跑法:
     cd gd-web
     node tools/autoplay.ts                 # 跑 WATER,报告进度/死亡
     node tools/autoplay.ts --secs=1200 --step=3 --horizon=75
     node tools/autoplay.ts --tape=.tmp/water.tape.json    # 存下输入卷(可回放校验)
   ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink, type WorldSnap } from '../src/sim/world.ts';
import { replay, fingerprint } from '../src/sim/replay.ts';
import { U } from '../src/sim/constants.ts';
import type { Level } from '../src/sim/level.ts';
import fs from 'node:fs';

const arg = (name: string, dflt = '') => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const STEP = Number(arg('step', 3));            // 每次决定推进多少帧
const HORIZON = Number(arg('horizon', 75));     // 试算时兜底跑多久(帧)
const SECS = Number(arg('secs', 1800));
const TAPE = arg('tape', '');
const WANT = arg('level', 'water');
const lv: Level = WANT === 'gen' ? generateLevel({ seed: 20260913 }) : WATER_CHART;

/* 候选按法:按住 k 帧(然后交给兜底),外加"什么都不按" */
const HOLDS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 26, 34, 44, 60, 90];

const w = new World(lv);
w.windowed = true;                     // 窗口裁剪:搜索一帧要回放几百遍,必须裁

const tape: boolean[] = [];
let dead = 0;
const deathsAt: number[] = [];
let best = 0;
let snap: WorldSnap = w.snapshot();
const t0 = performance.now();

/** 从 snap 出发:先按 holdFrames 帧,再交给兜底策略跑 rest 帧,返回结果。
 *  兜底有两种:"什么都不按"和"反应式机器人" —— 隧道里必须选前者(一按就撞天花板上的刺),
 *  弹簧连/跳环链上必须选后者,所以两种都试。 */
function trial(s: WorldSnap, holdFrames: number, rest: number, mode: 'idle' | 'bot') {
  w.restore(s);
  for (let i = 0; i < holdFrames; i++) {
    if (w.dead || w.done) break;
    w.frame(true);
  }
  for (let i = 0; i < rest; i++) {
    if (w.dead || w.done) break;
    w.frame(mode === 'bot' ? botThink(w) : false);
  }
  return { x: w.x, y: w.y, dead: w.dead, done: w.done };
}

/** 试一遍所有候选,返回"活下来而且走得最远"的按法;全都活不下来就把视界拉长再试。 */
function decide(s: WorldSnap) {
  for (let horizon = HORIZON; horizon <= HORIZON * 4; horizon *= 2) {
    let best: { hold: number; x: number; done: boolean } | null = null;
    let farDead: { hold: number; x: number } = { hold: 0, x: s.x };
    const consider = (hold: number, mode: 'idle' | 'bot') => {
      const r = trial(s, hold, horizon, mode);
      if (r.dead) { if (r.x > farDead.x) farDead = { hold, x: r.x }; return; }
      if (!best || r.x > best.x + 1e-6) best = { hold, x: r.x, done: r.done };
    };
    consider(0, 'idle');
    for (const k of HOLDS) {
      consider(k, 'idle');
      if (!best) consider(k, 'bot');
    }
    if (best) return { hold: best.hold, x: best.x, done: best.done, hopeful: true };
    if (horizon === HORIZON * 4) return { hold: farDead.hold, x: farDead.x, done: false, hopeful: false };
  }
  return { hold: 0, x: s.x, done: false, hopeful: false };
}

const maxTicks = 60 * SECS;
let decisions = 0;
const SHOW = Number(arg('show', 5));
while (w.tick < maxTicks && !w.done) {
  if (w.dead) {
    dead++;
    deathsAt.push(Math.round(w.x / U));
    if (deathsAt.length <= SHOW) {
      const bx = w.x / U, by = w.y / U;
      console.log('--- 第 ' + dead + ' 次死亡:x=' + bx.toFixed(2) + ' y=' + by.toFixed(2) + ' ' + w.mode
        + ' gdir=' + w.gdir + ' vy=' + w.vy.toFixed(2) + (w.dash ? ' 冲刺中' : ''));
      /* 谁杀的:内框和谁相交 */
      const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize, j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
      const hit = [...w.nearHazards, ...w.nearSolids].filter((b) => i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1);
      for (const b of hit.slice(0, 6)) {
        const o = b.o;
        console.log('    撞到 ' + o.kind + (o.rot ? ' rot' + o.rot : '') + (o.flipY ? ' flipY' : '')
          + ' b=' + o.b.toFixed(2) + ' r=' + o.r.toFixed(2) + ' w=' + o.w + ' h=' + o.h
          + ' 盒=[' + (b.x0 / U).toFixed(2) + ',' + (b.x1 / U).toFixed(2) + ']x[' + (b.y0 / U).toFixed(2) + ',' + (b.y1 / U).toFixed(2) + ']');
      }
      if (!hit.length) console.log('    (没有相交的盒子:掉出世界 / 飞行类撞上下边界?)');
    }
    w.respawn();
    snap = w.snapshot();
    continue;
  }
  snap = w.snapshot();
  decisions++;

  const plan = decide(snap);

  /* 采用:先按 plan.hold 帧,剩下的 STEP 帧用兜底(活下来就继续,活不下来也照走 —— 下一轮会重新算) */
  const holdFrames = Math.min(plan.hold, STEP);
  for (let i = 0; i < holdFrames; i++) { tape.push(true); w.frame(true); }
  for (let i = holdFrames; i < STEP; i++) { const h = botThink(w); tape.push(h); w.frame(h); }
  best = Math.max(best, w.x);
  if (decisions % 400 === 0) {
    const dt = (performance.now() - t0) / 1000;
    console.log('  x=' + (w.x / U).toFixed(0) + '/' + lv.length + ' 块 (' + (w.x / (lv.length * U) * 100).toFixed(0)
      + '%) · 死亡 ' + dead + ' · ' + w.mode + ' · 用了 ' + dt.toFixed(0) + 's(' + decisions + ' 次决定)');
  }
}

const secs = (performance.now() - t0) / 1000;
console.log('\n=== 结果 ===');
console.log('铺面 ' + lv.name + ' · ' + lv.objects.length + ' 物件 · 长 ' + lv.length + ' 块 · 高 ' + lv.rows + ' 格');
console.log('跑到 x=' + (w.x / U).toFixed(1) + ' 块 (' + (w.x / (lv.length * U) * 100).toFixed(1) + '%) · done=' + w.done);
console.log('死亡 ' + dead + ' 次' + (deathsAt.length ? '(前 20 处:' + deathsAt.slice(0, 20).join(', ') + ' 块)' : ''));
console.log('决定 ' + decisions + ' 次 · 用时 ' + secs.toFixed(1) + 's');
if (TAPE) {
  const f = replay(lv, tape);
  console.log('\n回放校验:同一条输入卷再跑一遍 → 死亡 ' + f.deaths + ' 次 · done=' + f.done
    + ' · 终点 x=' + (f.states[f.states.length - 1].x / U).toFixed(1) + ' · 指纹 ' + fingerprint(f.states));
  fs.writeFileSync(TAPE, JSON.stringify({ level: lv.name, tape, done: f.done, deaths: f.deaths }));
  console.log('输入卷写到 ' + TAPE);
}
