/* 分站推进:一站一站把"按铺面路线走过整关"啃下来。
 * ─────────────────────────────────────────────────────────────
 * 背景(为什么不能一次搜完):整关一次性搜"必须碰到每一个门"的路线时,每到一个门就是一道卡口 ——
 * 实测 x=421(第一个 cube 门)卡住 7 万节点、x=512 又卡一次;而把搜索根挪到卡口前面单独搜,
 * 几十秒就过去了。分站就是把这件手工活自动化:
 *
 *   每一站的目标 = 下一个必过门 / 或者两门之间的一个路标。到了就存下输入卷前缀,
 *   拿它当下一站的种子(--seed),接着往下一站推。
 *
 * 跑法:cd gd-web && node tools/autoplay-stage.ts [每站预算秒] [总预算秒] [--free] [--way=12]
 *   默认每站 50 秒、总共 3600 秒;输入卷写在 ../../.tmp/gd/water-route.best.json
 *
 * ★ v2 的三处改动(都是被站 22「UFO 门 x=606 y=23」卡了半天之后查出来的):
 *
 *  ①【判"到站"必须问"这个门生效了没有",不能问"x 走过去了没有"】。
 *    旧版用 maxX ≥ 门右沿+0.5 判到站。塔段那条地面路线一路跑到 607.1 就被 UFO 门挡住,
 *    可它把 maxX 顶到了 607 —— 于是驱动认为"607 之前的站全过了",包括那座塔上的
 *    重力门(605)和 UFO 门(606):一次都不再搜。实际那卷输入在 y=0 的地面上,
 *    离门(y=23)差 23 格,永远不可能生效。
 *    现在:每个门站到不到,靠【自己回放一遍前缀、数哪些门真的 armed 了】判定(见 audit)。
 *
 *  ②【两门之间插路标】。站 20 的重力门(572)到站 22 的 UFO 门(606)之间隔着 34 块塔身,
 *    一次啃 34 块 + 一堆弹板/尖刺,搜索 50 秒铺不出干净前沿。每 12 块插一个路标之后,
 *    搜索每走十几块就能"存一次前沿"再接着搜 —— 塔段 543→567.9 就是这么一步步上去的。
 *
 *  ③【退避档加密】。旧档位 140/90/72/45/30/15 太粗:塔段的错在 549~552(从 607 往回退
 *    55~58 块),旧档位只给 45 和 72,一个退到错误之后、一个退到错误之前 17 块。
 *    现在按 15 块一档退,先试离前沿近的。
 * ============================================================ */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import type { Obj } from '../src/sim/level.ts';

const arg = (name: string, dflt: string) => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const PER = Number(process.argv[2] ?? 90);
const TOTAL = Number(process.argv[3] ?? 3600);
const FREE = process.argv.includes('--free');            // 允许"飞过去"的路线(不要求碰到每个门)
const WAY = Number(arg('way', 12));                      // 门之间每多少块插一个路标
const BEST = FREE ? '../../.tmp/gd/water-free.best.json' : '../../.tmp/gd/water-route.best.json';
const SOL = FREE ? '../../.tmp/gd/water-free.solution.json' : '../../.tmp/gd/water-route.solution.json';
const MAXB = BEST.replace(/\.json$/, '') + '.max.json';

/* ---------------- 必过门 + 路标 ---------------- */
const isDoor = (o: Obj) => o.kind === 'portal' || o.kind === 'gravity' || o.kind === 'speed' || o.kind === 'size';
const doors = WATER_CHART.objects.filter(isDoor).sort((a, b) => a.b - b.b);
/** 门 → "生效"判据(和 autoplay 的 portalSatisfied 一字不差):
 *  门只在你【状态真的变了】的时候才算生效,已经是那个状态时滚过去什么都不会发生。 */
const satisfied = (o: Obj, w: World): boolean => {
  if (o.kind === 'portal') return w.mode === o.to;
  if (o.kind === 'gravity') return w.gdir === (o.gdir ?? 1);
  if (o.kind === 'speed') return w.speedIdx === (o.speed ?? 1);
  if (o.kind === 'size') return w.sizeMul !== 1;
  return false;
};

/** 回放一卷输入,数出【真的生效了的门】和走到哪。
 *  ★ 这是独立复核:不信搜索进程自己记的账(handledPortals 在搜索里是"算过的账"),
 *    自己拿一份干净的 World 从头回放 —— 物理是唯一裁判,和 verify-run 同一个口径。 */
function audit(file: string) {
  if (!file || !fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tape: boolean[] = j.tape ?? [];
  const w = new World(WATER_CHART);
  const armed = new Set<number>();
  let frames = 0;
  for (const h of tape) {
    if (w.dead || w.done) break;
    w.frame(h);
    frames++;
    for (let i = 0; i < boxes.length; i++) {
      if (armed.has(i)) continue;
      const b = boxes[i];
      if (w.x < b.x1) continue;                       // 还没完全越过这个门
      if (w.armedPortals.has(b) || satisfied(b.o, w)) armed.add(i);
    }
  }
  return { x: w.x / U, y: w.y / U, mode: w.mode, dead: w.dead, done: w.done, armed, frames };
}

const probe = new World(WATER_CHART);
const boxes = probe.portals
  .filter((b) => isDoor(b.o))
  .sort((a, b) => a.x1 - b.x1);
const doorIdx = new Map<Obj, number>();
doors.forEach((o, i) => doorIdx.set(o, i));

interface Station { x: number; door: number }         // door = -1 表示"路标"
const stations: Station[] = [];
{
  let prev = 0, di = 0;
  for (const o of doors) {
    const goal = o.b + o.w + 0.5;
    for (let x = prev + WAY; x < goal - 1; x += WAY) stations.push({ x, door: -1 });
    stations.push({ x: goal, door: di++ });
    prev = goal;
  }
}
console.log('分站推进 v2:必过门 ' + doors.length + ' 个 + 路标 → 共 ' + stations.length
  + ' 站(路标间距 ' + WAY + ' 块)· 每站 ' + PER + 's · 总预算 ' + TOTAL + 's');

const t0 = Date.now();
const at = (i: number) => '#' + (i + 1) + '/' + stations.length;
const st0 = stations[0];
let seed = fs.existsSync(BEST) ? BEST : '';
console.log('第 1 站:' + (st0.door >= 0 ? '门 x=' + st0.x.toFixed(1) : '路标 x=' + st0.x.toFixed(1)));

for (let i = 0; i < stations.length; i++) {
  const st = stations[i];
  const a = audit(BEST);
  const am = audit(MAXB);
  /* 到站判据:门站看"门生效了没有",路标看图卷走到哪(两条前缀都算) —— 见文件头 ① */
  const passed = st.door >= 0
    ? !!(a?.armed.has(st.door) || am?.armed.has(st.door))
    : Math.max(a?.x ?? 0, am?.x ?? 0) >= st.x;
  if (passed) continue;
  const left = TOTAL - (Date.now() - t0) / 1000;
  if (left <= 5) {
    console.log('总预算用完,停在第 ' + at(i) + ' 站(目标 x=' + st.x.toFixed(1) + ')');
    break;
  }
  const budget = Math.min(PER, left);
  /* 离目标很近(差 ≤6 块)时给双倍时间:这种时候往往"就差一点点时机" */
  const routeX = Math.max(a?.x ?? 0, 0);
  const maxX = Math.max(am?.x ?? 0, 0);
  const near = st.x - Math.max(routeX, maxX) <= 6;
  const per = near ? budget * 2 : budget;
  const seedX = a ? a.x : (seed && fs.existsSync(seed) ? (JSON.parse(fs.readFileSync(seed, 'utf8')).x ?? 0) : 0);
  const maxSeedX = am ? am.x : 0;
  /* 退避档:15 块一档,从离前沿最近的开始 —— 见文件头 ③ */
  const back: number[] = [];
  for (let off = 15; off <= 150; off += 15) back.push(off);
  const horizonVariants: Array<[number, number]> = [[16, -30], [12, -30], [20, -45], [36, -60]];
  const tries: Array<{ tag: string; extra: string[] }> = seed
    ? [
      { tag: near ? '离目标很近,给双倍时间' : '', extra: [] },
      ...back.filter((off) => seedX - off > 5).map((off) => ({
        tag: '退回 ' + off + ' 块重开前沿',
        extra: ['--startfrom=' + BEST + ',' + (seedX - off).toFixed(1)],
      })),
      ...(maxSeedX > 5 ? back.filter((off) => maxSeedX - off > 5).map((off) => ({
        tag: '从最远前沿退回 ' + off + ' 块重开',
        extra: ['--startfrom=' + MAXB + ',' + (maxSeedX - off).toFixed(1)],
      })) : []),
      /* ★ 视界也要换着试:换个视界等于换一套宏动作,落点全变 ——
         实测同一条刺走廊,视界 12/16/20/24/28 块分别走到 349.4 / 345.2 / 341.1 / 336.9 / 350.4,
         不是"越长越好",而是"多试几个就有一个能过"。塔段也是:从 543 起搜,
         视界 12 走到 567.9(上了塔),视界 16 只到 559.4。 */
      ...horizonVariants.map(([hz, off]) => ({
        tag: '视界换 ' + hz + ' 块 + 退回 ' + Math.abs(off) + ' 块',
        extra: ['--horizon=' + hz, '--startfrom=' + BEST + ',' + Math.max(5, seedX + off).toFixed(1)],
      })),
      { tag: '种子剪尾 20 块重规划', extra: ['--seedtrim=20'] },
    ]
    : [{ tag: '', extra: [] }];
  let okThis = false;
  for (const tr of tries) {
    const args = ['tools/autoplay.ts', '--budget=' + per, '--quiet=1', '--goal=' + st.x.toFixed(1),
      '--best=' + BEST, '--tape=' + SOL];
    if (seed && !tr.extra.some((e) => e.startsWith('--startfrom'))) args.push('--seed=' + seed);
    for (const e of tr.extra) args.push(e);
    if (FREE) args.push('--noskip=');
    console.log('\n--- ' + at(i) + ':' + (st.door >= 0
      ? '目标 x=' + st.x.toFixed(1) + '(' + (doors[st.door].kind === 'portal' ? '形态→' + doors[st.door].to : doors[st.door].kind) + ')'
      : '路标 x=' + st.x.toFixed(1))
      + ' · 前缀走到 ' + routeX.toFixed(1) + '(最远活 ' + maxX.toFixed(1) + ')'
      + ' · 预算 ' + budget.toFixed(0) + 's' + (tr.tag ? ' · ' + tr.tag : ''));
    spawnSync(process.execPath, args, { stdio: 'inherit', cwd: process.cwd() });
    const a2 = audit(BEST);
    const am2 = audit(MAXB);
    const pass2 = st.door >= 0
      ? !!(a2?.armed.has(st.door) || am2?.armed.has(st.door))
      : Math.max(a2?.x ?? 0, am2?.x ?? 0) >= st.x;
    const where = a2 ? ('前缀 ' + a2.x.toFixed(1) + ' y=' + a2.y.toFixed(1) + ' ' + a2.mode
      + ' · 门生效 ' + a2.armed.size + ' 个') : '前缀没了';
    if (pass2) { console.log('    ✓ 过站(' + where + ')'); okThis = true; break; }
    console.log('    ✗ 没过(' + where + ')');
    seed = fs.existsSync(BEST) ? BEST : seed;
  }
  if (!okThis) {
    const aa = audit(BEST);
    console.log('卡在 ' + at(i) + ' 站(目标 x=' + st.x.toFixed(1) + '),后面先不推了');
    if (aa) console.log('  前缀终点 x=' + aa.x.toFixed(2) + ' y=' + aa.y.toFixed(2) + ' ' + aa.mode
      + (aa.dead ? ' 【死了】' : '') + ' · 已生效的门 ' + aa.armed.size + '/' + boxes.length);
    break;
  }
  seed = fs.existsSync(BEST) ? BEST : seed;
  if (audit(BEST)?.done) { console.log('\n★ 通关了'); break; }
}
const fin = audit(BEST);
console.log('\n用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's · 前缀 ' + BEST
  + (fin ? ' · 走到 x=' + fin.x.toFixed(2) + ' y=' + fin.y.toFixed(2) + ' ' + fin.mode
    + ' · 生效门 ' + fin.armed.size + '/' + boxes.length
    + (fin.dead ? ' 【死了】' : '') + (fin.done ? ' 【通关】' : '') : ' · (无前缀文件)'));
