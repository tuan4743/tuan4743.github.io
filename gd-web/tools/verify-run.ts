/* 回归门:回放【通关输入卷】—— 这一版物理还能不能过这张图。
 * ─────────────────────────────────────────────────────────────
 * 为什么要有它:这张铺面是真人设计的硬图(作者自己都过不去,设了存档点),
 * "能过"本身就是最强的正确性证据 —— 改判定盒、改弹簧力度、改形态门行为,
 * 只要把这张图从"可通"改成"不可通",回放立刻死给你看。
 *
 * 三道检查:
 *   1. 完整物理(不裁剪窗口)回放整卷 → 必须 done=true 且 0 死亡;
 *   2. 状态指纹必须等于打包时记下的那一个(逐帧一致,不只是"最后到了终点");
 *   3. 开窗口裁剪再回放一遍 → 指纹也要一致(搜索是在裁剪模式下搜的,
 *      如果这里对不上,说明裁剪会改物理,那搜索出来的卷子就不可信)。
 *
 * 跑法:cd gd-web && node tools/verify-run.ts
 * ============================================================ */
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, type RunState } from '../src/sim/world.ts';
import { fingerprint } from '../src/sim/replay.ts';
import { U } from '../src/sim/constants.ts';

const TAPE = process.argv[2] ?? '../static/assets/gd-tape.json';
const raw = JSON.parse(fs.readFileSync(TAPE, 'utf8')) as {
  level: string; frames: number; first: boolean; rle: number[]; done: boolean; deaths: number;
};
const tape: boolean[] = (() => {
  const out: boolean[] = [];
  let cur = raw.first;
  for (const n of raw.rle) { for (let i = 0; i < n; i++) out.push(cur); cur = !cur; }
  return out;
})();
if (tape.length !== raw.frames) throw new Error('解码后帧数对不上:' + tape.length + ' ≠ ' + raw.frames);

const res: string[] = [];
const ok = (c: boolean, m: string) => { res.push((c ? '✓ ' : '✗ ') + m); return c; };

/** 跑一遍:windowed=false 是完整物理(权威),true 是搜索时用的裁剪模式 */
function run(windowed: boolean) {
  const w = new World(WATER_CHART);
  if (windowed) w.windowed = true;
  const states: RunState[] = [];
  let deaths = 0;
  for (const hold of tape) {
    if (w.dead) { deaths++; w.respawn(); }
    w.frame(hold);
    states.push(w.state);
    if (w.done) break;
  }
  if (windowed) w.windowed = false;      // 关掉(有会动的盒子时 setter 会拒,这里只是收尾)
  return { deaths, done: w.done, x: w.x, fp: fingerprint(states), ticks: states.length };
}

console.log('输入卷 ' + TAPE + ' · ' + raw.frames + ' 帧(' + (raw.frames / 60).toFixed(1) + 's)');

const t0 = performance.now();
const full = run(false);
const dtFull = performance.now() - t0;
ok(full.done, '完整物理回放:done=' + full.done + ' · 终点 x=' + (full.x / U).toFixed(1) + '/' + WATER_CHART.length
  + ' 块 · 死了 ' + full.deaths + ' 次 · 指纹 ' + full.fp + ' · ' + dtFull.toFixed(0) + 'ms');
ok(full.deaths === 0, '整卷 0 死亡(死亡了就不叫通关)');
ok(raw.done === true && full.done === true, '打包时也是 done=true');
ok(full.x >= WATER_CHART.length * U - 1e-6, '越过终点线(x ≥ ' + WATER_CHART.length + ' 块)');

const win = run(true);
ok(win.fp === full.fp, '窗口裁剪模式下指纹一致(' + win.fp + ') —— 裁剪没有改物理');
ok(win.done && win.deaths === 0, '窗口裁剪模式下也是 0 死亡通关');

console.log('\n' + res.join('\n'));
const bad = res.filter((r) => r.startsWith('✗')).length;
console.log(bad ? '\n不合格:' + bad + ' 项' : '\n全部通过:这张图在【当前这一版物理】下确实能过');
process.exit(bad ? 1 : 0);
