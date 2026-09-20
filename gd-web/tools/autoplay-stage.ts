/* 分站推进:一站一站把"按铺面路线走过整关"啃下来。
 * ─────────────────────────────────────────────────────────────
 * 背景(为什么不能一次搜完):整关一次性搜"必须碰到每一个门"的路线时,每到一个门就是一道卡口 ——
 * 实测 x=421(第一个 cube 门)卡住 7 万节点、x=512 又卡一次;而把搜索根挪到卡口前面单独搜,
 * 几十秒就过去了。分站就是把这件手工活自动化:
 *
 *   每一站的目标 = 下一个必过门的 x + 2 块。到了就存下输入卷前缀,拿它当下一站的种子(--seed),
 *   接着往下一站推。到站了就"温启动接着搜",不到站就报出来是哪一站卡住的(那一段就是要查的段落)。
 *
 * 跑法:cd gd-web && node tools/autoplay-stage.ts [每站预算秒] [总预算秒]
 *   默认每站 90 秒、总共 3600 秒;输入卷写在 ../../.tmp/gd/water-route.best.json
 * ============================================================ */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const PER = Number(process.argv[2] ?? 90);
const TOTAL = Number(process.argv[3] ?? 3600);
const FREE = process.argv.includes('--free');            // 允许"飞过去"的路线(不要求碰到每个门)
const BEST = FREE ? '../../.tmp/gd/water-free.best.json' : '../../.tmp/gd/water-route.best.json';
const SOL = FREE ? '../../.tmp/gd/water-free.solution.json' : '../../.tmp/gd/water-route.solution.json';

/* 从铺面里取必过门(和 autoplay 的 --noskip 同一套),按 x 排序 */
const mod = await import('../src/sim/charts/water.ts');
const chart = mod.WATER_CHART;
const doors = chart.objects
  .filter((o) => o.kind === 'portal' || o.kind === 'gravity' || o.kind === 'speed' || o.kind === 'size')
  .sort((a, b) => a.b - b.b);

const t0 = Date.now();
let seed = fs.existsSync(BEST) ? BEST : '';
const reached = () => {
  if (!fs.existsSync(BEST)) return 0;
  const j = JSON.parse(fs.readFileSync(BEST, 'utf8'));
  /* 判"这一站到没到"用 maxX(活着走到的最远),不用 x(要写进种子的那条路的终点)——
     两者在门口附近可能差好几块(见 autoplay.ts 里那段注释) */
  return j.maxX ?? j.x ?? 0;
};
console.log('分站推进:必过门 ' + doors.length + ' 个 · 每站 ' + PER + 's · 总预算 ' + TOTAL + 's');

for (let i = 0; i < doors.length; i++) {
  const door = doors[i];
  const goal = door.b + door.w / 2 + 2;                    // 到门口再往前 2 块就算过站
  let have = reached();
  if (have >= goal) continue;                             // 种子已经过了这一站
  const left = TOTAL - (Date.now() - t0) / 1000;
  if (left <= 5) { console.log('总预算用完,停在第 ' + i + ' 站(x=' + have.toFixed(1) + ')'); break; }
  const budget = Math.min(PER, left);
  /* 一站最多试几次:先按种子接着搜,失败就【退到岔路口重开前沿】(--startfrom),
     再失败才剪种子尾巴。顺序有讲究:实测卡住多半是"前缀末端是死状态",重开前沿最有效。 */
  const tries: Array<{ tag: string; extra: string[] }> = seed
    ? [
      { tag: '', extra: [] },
      { tag: '退回 45 块重开前沿', extra: ['--startfrom=' + seed + ',' + Math.max(1, door.b - 45).toFixed(1)] },
      { tag: '退回 15 块重开前沿', extra: ['--startfrom=' + seed + ',' + Math.max(1, door.b - 15).toFixed(1)] },
      { tag: '种子剪尾 20 块重规划', extra: ['--seedtrim=20'] },
    ]
    : [{ tag: '', extra: [] }];
  let okThis = false;
  for (const tr of tries) {
    const args = ['tools/autoplay.ts', '--budget=' + budget, '--quiet=1', '--goal=' + goal.toFixed(1),
      '--best=' + BEST, '--tape=' + SOL];
    if (seed && !tr.extra.some((e) => e.startsWith('--startfrom'))) args.push('--seed=' + seed);
    for (const e of tr.extra) args.push(e);
    if (FREE) args.push('--noskip=');
    console.log('\n--- 第 ' + (i + 1) + '/' + doors.length + ' 站:目标 x=' + goal.toFixed(1)
      + '(' + (door.kind === 'portal' ? '形态→' + door.to : door.kind) + ')· 现在 ' + have.toFixed(1)
      + ' · 预算 ' + budget.toFixed(0) + 's' + (tr.tag ? ' · ' + tr.tag : ''));
    spawnSync(process.execPath, args, { stdio: 'inherit', cwd: process.cwd() });
    const reached2 = reached();
    if (reached2 >= goal) { console.log('    这一站走到 ' + reached2.toFixed(1) + ' 块 ✓ 过站'); okThis = true; break; }
    console.log('    走到 ' + reached2.toFixed(1) + ' 块 ✗ 没过');
    if (reached2 > have) have = reached2;
    seed = fs.existsSync(BEST) ? BEST : seed;
  }
  if (!okThis) { console.log('卡在第 ' + (i + 1) + ' 站(目标 ' + goal.toFixed(1) + '),后面先不推了'); break; }
  seed = fs.existsSync(BEST) ? BEST : seed;
  if (reached() >= chart.length - 2) { console.log('\n★ 走到终点附近了(x=' + reached().toFixed(1) + '/' + chart.length + ')'); break; }
}
console.log('\n用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's · 前缀 ' + BEST + ' · 最远 '
  + reached().toFixed(1) + '/' + chart.length + ' 块');
