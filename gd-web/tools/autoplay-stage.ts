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
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { auditTape, doorBoxes, type Audit } from './audit.ts';
import type { Obj } from '../src/sim/level.ts';

const arg = (name: string, dflt: string) => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const PER = Number(process.argv[2] ?? 90);
const TOTAL = Number(process.argv[3] ?? 3600);
const FREE = process.argv.includes('--free');            // 允许"飞过去"的路线(不要求碰到每个门)
const WAY = Number(arg('way', 12));                      // 门之间每多少块插一个路标
/* --par=N —— 一个站的重试并发几个(机器 16 核,搜索本身是单进程的)。
   每一批从同一份 BEST 出发、各写各的文件,批完挑一个赢家提升成 BEST。 */
const PAR = Math.max(1, Number(arg('par', 4)));
const BEST = FREE ? '../../.tmp/gd/water-free.best.json' : '../../.tmp/gd/water-route.best.json';
const SOL = FREE ? '../../.tmp/gd/water-free.solution.json' : '../../.tmp/gd/water-route.solution.json';
const MAXB = BEST.replace(/\.json$/, '') + '.max.json';

/* ---------------- 必过门 + 路标 ---------------- */
const isDoor = (o: Obj) => o.kind === 'portal' || o.kind === 'gravity' || o.kind === 'speed' || o.kind === 'size';
const doors = WATER_CHART.objects.filter(isDoor).sort((a, b) => a.b - b.b);

/** 回放一卷输入,数出【真的生效了的门】和走到哪。
 *  ★ 审计逻辑在 tools/audit.ts —— 和 diag-tape 共用一份,不许两边各写一套。
 *    它做的事就是"独立复核":不信搜索进程自己记的账(handledPortals 是它算过的账),
 *    拿一份干净的 World 从头回放,在【越过那一刻】按"armed 或碰不碰都一样"判一次。
 *  ★ 结果要缓存:一次审计 = 从头回放几千帧 × 108 个门,而 337 个站里绝大多数是
 *    "早就过了、直接跳过" —— 每个站都重算两遍的话,光是空转就几十秒(实测 337 站要 70 秒)。 */
const auditCache = new Map<string, { key: string; a: Audit | null }>();
function audit(file: string): Audit | null {
  if (!file || !fs.existsSync(file)) return null;
  const st = fs.statSync(file);
  const key = st.mtimeMs + ':' + st.size;
  const hit = auditCache.get(file);
  if (hit && hit.key === key) return hit.a;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const a = auditTape(WATER_CHART, j.tape ?? []);
  auditCache.set(file, { key, a });
  return a;
}

const doorCount = doorBoxes(new World(WATER_CHART)).length;

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
let ctxSplits = 0;                                      // "劈半"次数(卡住时把路标劈成两半)
const at = (i: number) => '#' + (i + 1) + '/' + stations.length;
const st0 = stations[0];
let seed = fs.existsSync(BEST) ? BEST : '';
console.log('第 1 站:' + (st0.door >= 0 ? '门 x=' + st0.x.toFixed(1) : '路标 x=' + st0.x.toFixed(1)));

for (let i = 0; i < stations.length; i++) {
  const st = stations[i];
  const a = audit(BEST);
  const am = audit(MAXB);
  /* 到站判据:门站看"门生效了没有",路标看图卷走到哪(两条前缀都算) —— 见文件头 ①
     ★ free 模式例外:那条路线【本来就允许跳过门】(--noskip= 关掉了硬约束),
       所以对它只能用几何判据(x 走过去就算到站),否则驱动会一直等一个永远不会 armed 的门
       (踩过:free 重搜时在站 #37 卡了十几分钟,一直重试"退回 N 块重开")。 */
  const stPass = (aa: Audit | null, am: Audit | null) => (FREE || st.door < 0)
    ? Math.max(aa?.x ?? 0, am?.x ?? 0) >= st.x
    : !!(aa?.armed.has(doors[st.door]) || am?.armed.has(doors[st.door]));
  const passed = stPass(a, am);
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
  /* ★ 视界也要换着试:换个视界等于换一套宏动作,落点全变 ——
     实测同一条刺走廊,视界 12/16/20/24/28 块分别走到 349.4 / 345.2 / 341.1 / 336.9 / 350.4,
     不是"越长越好",而是"多试几个就有一个能过"。塔段更极端:从 543 起搜,
     视界 12 走到 567.9、16 只到 559.4、**20 一路到 622.1(过了 UFO 门)**。
     ★ 所以视界变体要【排在小退避旁边】先试:一批 4 个,头一批就该覆盖
     "接着搜 / 退 15 / 退 30 / 换视界" 这四种最可能中的走法,
     而不是把 20 个退避试完才轮到换视界(那要等 5 批 = 5 分钟)。 */
  const hzOf = (hz: number, off: number) => ({ hz, off });
  const earlyHz = [hzOf(20, -30), hzOf(16, -30), hzOf(12, -15), hzOf(36, -45)];
  const lateHz = [hzOf(16, -75), hzOf(12, -75), hzOf(20, -105), hzOf(36, -120)];
  const tries: Array<{ tag: string; extra: string[] }> = seed
    ? [
      { tag: near ? '离目标很近,给双倍时间' : '接着上次的卷子搜', extra: [] },
      ...back.slice(0, 2).filter((off) => seedX - off > 5).map((off) => ({
        tag: '退回 ' + off + ' 块重开前沿',
        extra: ['--startfrom=' + BEST + ',' + (seedX - off).toFixed(1)],
      })),
      ...earlyHz.map(({ hz, off }) => ({
        tag: '视界换 ' + hz + ' 块 + 退回 ' + Math.abs(off) + ' 块',
        extra: ['--horizon=' + hz, '--startfrom=' + BEST + ',' + Math.max(5, seedX + off).toFixed(1)],
      })),
      ...back.slice(2).filter((off) => seedX - off > 5).map((off) => ({
        tag: '退回 ' + off + ' 块重开前沿',
        extra: ['--startfrom=' + BEST + ',' + (seedX - off).toFixed(1)],
      })),
      ...(maxSeedX > 5 ? back.filter((off) => maxSeedX - off > 5).map((off) => ({
        tag: '从最远前沿退回 ' + off + ' 块重开',
        extra: ['--startfrom=' + MAXB + ',' + (maxSeedX - off).toFixed(1)],
      })) : []),
      ...lateHz.map(({ hz, off }) => ({
        tag: '视界换 ' + hz + ' 块 + 退回 ' + Math.abs(off) + ' 块',
        extra: ['--horizon=' + hz, '--startfrom=' + BEST + ',' + Math.max(5, seedX + off).toFixed(1)],
      })),
      { tag: '种子剪尾 20 块重规划', extra: ['--seedtrim=20'] },
      /* ★ 第二口气:前面那些都是"同一个搜索换个起点/换个视界"。
         真啃不动的时候得换【搜索本身的形状】—— 步进细一点、束宽一点、接近窗口长一点、
         前沿聚焦松一点、重启勤一点。这些参数各自都会大幅改变搜索的展开顺序,
         换一套等于"换一种摸法"(实测:整关搜索卡在 x=421 时,正是"前沿聚焦"和"分阶段重启"
         这两条把死局救回来的)。注意:这里【不碰】任何物理旋钮(--padmul 之类只在定点实验里用)。 */
      ...(seed ? [
        { tag: '细步进 step=2 beam=6', extra: ['--step=2', '--beam=6', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 30).toFixed(1)] },
        { tag: '粗步进 step=4 beam=3', extra: ['--step=4', '--beam=3', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 30).toFixed(1)] },
        { tag: '接近窗口拉到 220 块', extra: ['--approach=220', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 45).toFixed(1)] },
        { tag: '前沿聚焦放宽 window=80', extra: ['--window=80', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 60).toFixed(1)] },
        { tag: '勤重启 phase=18s', extra: ['--phase=18', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 60).toFixed(1)] },
        { tag: '长视界 44 块', extra: ['--horizon=44', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 90).toFixed(1)] },
        /* ★ 第三批:专治"门缝只有零点几块"的卡点(x=1060 的 robot 门就是):
           · 关宏落子 —— 宏一动就跳几十帧,缝隙里的时机根本没法微调;
           · step=1 束宽 16 —— 每一帧都能改主意;
           · 关掉"久不推进就回退"—— 回退阶梯在这种地方是反效果:它会把前沿一路砍回
             一百多块之前(实测砍到 x=760),搜索又从头摸一遍;
           · 接近容差压到 0.1 块 —— 让"贴着门缝"和"差半块"在分数上真的分得开。 */
        { tag: '★ 缝隙模式:无宏 + step1 + 不回退', extra: ['--step=1', '--beam=16', '--macro=0', '--rewindafter=999999', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 14).toFixed(1)] },
        { tag: '★ 缝隙模式 + 容差 0.1', extra: ['--step=1', '--beam=16', '--macro=0', '--rewindafter=999999', '--pulltol=0.1', '--startfrom=' + BEST + ',' + Math.max(5, seedX - 20).toFixed(1)] },
      ] : []),
    ]
    : [{ tag: '', extra: [] }];
  let okThis = false;
  let ti = 0;
  console.log('\n--- ' + at(i) + ':' + (st.door >= 0
    ? '目标 x=' + st.x.toFixed(1) + '(' + (doors[st.door].kind === 'portal' ? '形态→' + doors[st.door].to : doors[st.door].kind) + ')'
    : '路标 x=' + st.x.toFixed(1))
    + ' · 前缀走到 ' + routeX.toFixed(1) + '(最远活 ' + maxX.toFixed(1) + ')'
    + ' · 预算 ' + per.toFixed(0) + 's · 并发 ' + PAR + ' · 共 ' + tries.length + ' 次重试');
  /* ★ 一台机器 16 个核,而搜索是单进程的 —— 一个站一个站地等,等于把 15 个核晾着。
     现在把重试清单【按批并发】跑:同一批都从当前的 BEST 出发(各自写自己的 best/tape 文件),
     跑完按"生效的门更多 → 走得 x 更远"挑一个赢家,提升成新的 BEST,再开下一批。
     顺带把"最远活的那卷要提升成主种子"这件事自动化了 ——
     以前得人工判断(塔段那次:主种子 606.7 在地面,最远活的 622.1 才是真路线,
     手工 copy 进 water-route.best.json 之后才继续得下去)。 */
  while (ti < tries.length && !okThis) {
    const batch = tries.slice(ti, Math.min(ti + PAR, tries.length));
    ti += batch.length;
    const jobs = batch.map((tr, k) => {
      const partBest = BEST + '.p' + k;
      const partMax = partBest.replace(/\.json$/, '') + '.max.json';
      /* ★ 先把这一批的输出文件删掉:不删的话,某个参与者万一崩了,
         审计就会读到【上一批剩下的旧文件】,把旧成绩当成新成绩(踩过:批里出现 0.0 块的怪结果)。 */
      for (const f of [partBest, partMax, SOL + '.p' + k]) {
        try { fs.rmSync(f, { force: true }); } catch { /* 删不掉就算了 */ }
      }
      const args = ['tools/autoplay.ts', '--budget=' + per, '--quiet=1', '--goal=' + st.x.toFixed(1),
        '--best=' + partBest, '--tape=' + SOL + '.p' + k];
      if (seed && !tr.extra.some((e) => e.startsWith('--startfrom'))) args.push('--seed=' + seed);
      for (const e of tr.extra) args.push(e);
      if (FREE) args.push('--noskip=');
      console.log('  → 并发 ' + (k + 1) + '/' + batch.length + (tr.tag ? ' · ' + tr.tag : ' · 接着上次'));
      return spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd(), k });
    });
    const outs = await Promise.all(jobs.map((p, k) => new Promise<string>((res) => {
      let s = '';
      p.stdout?.on('data', (d) => { s += String(d); });
      p.stderr?.on('data', (d) => { s += String(d); });
      p.on('close', () => {
        /* 每个参与者的完整输出留一份 —— 出问题时"到底死在哪一块"要看它的死胡同直方图,
           只留一行摘要等于把线索丢了。 */
        try { fs.writeFileSync(BEST + '.p' + k + '.log', s); } catch { /* 磁盘满/占用就算了 */ }
        res(s);
      });
    })));

    /* 挑赢家:先看"这一站的目标达没达成",再看【有没有跳过门】(跳门的那卷对"铺面路线"没意义),
       然后比生效的门数,最后比走得远不远 */
    let win: { file: string; x: number; doors: number; skip: number; pass: boolean } | null = null;
    for (let k = 0; k < batch.length; k++) {
      /* ★ sidecar 的路径要和 autoplay 写的一致:`<best 去掉 .json> + .max.json`
         (踩过:这里原来写 MAXB + '.p' + k = "...best.max.json.p1",和实际文件名
          "…best.json.p1.max.json" 对不上 → 最远活的那卷根本没参与评选,
          赢家永远是"主种子那卷";而塔段那种段落里,真正的路线恰恰在最远活那卷里)。 */
      const partMax = (BEST + '.p' + k).replace(/\.json$/, '') + '.max.json';
      for (const f of [BEST + '.p' + k, partMax]) {
        const aa = audit(f);
        if (!aa) continue;
        const pass = (FREE || st.door < 0) ? aa.x >= st.x : aa.armed.has(doors[st.door]);
        const cur = { file: f, x: aa.x, doors: aa.armed.size, skip: aa.skipped.size, pass };
        /* ★ 排序:过站 → 【生效门数(路线走了多远)】 → 走得远 → 跳门少。
           跳门放到最后比:判据修好之后,一条【前十块就跳了门】的短卷子在"跳门少"这一条上
           会赢过真实推进到 1061 的长卷子 —— 实测驱动就是这么把路线从 1061 回退到 657.9 的。
           搜索本身有 gateOk 兜着(新卷子不会跳门),所以"跳门"只该当兜底判据。 */
        const better = !win
          || (cur.pass && !win.pass)
          || (cur.pass === win.pass && (
            cur.doors > win.doors
            || (cur.doors === win.doors && (cur.x > win.x
              || (cur.x === win.x && cur.skip < win.skip)))));
        if (better) win = cur;
      }
      const tail = outs[k].split('\n').filter((l) => /最远|到站|通关|指纹/.test(l)).slice(-2).join(' | ');
      console.log('    ' + (k + 1) + ') ' + tail.trim());
    }
    if (win) {
      /* 赢家提升成主种子,并且【两份都写成它】:
         · BEST 是下一批的 --seed;
         · .max.json 是下一次"从最远前沿退回"的起点。
         两份都指向同一个最好结果,下一次搜索会各自刷新它们(saveBest 里那两条线)。 */
      fs.copyFileSync(win.file, BEST);
      fs.copyFileSync(win.file, MAXB);
      auditCache.clear();
      const a2 = audit(BEST);
      console.log('    ★ 本批赢家 x=' + win.x.toFixed(1) + ' · 门生效 ' + win.doors + '/' + doorCount
        + ' · 跳门 ' + win.skip + ' · 形态=' + (a2?.mode ?? '?') + (win.pass ? ' ✓ 过站' : ' ✗ 没过'));
      if (win.pass) okThis = true;
    }
    seed = fs.existsSync(BEST) ? BEST : seed;
  }
  if (!okThis) {
    const aa = audit(BEST);
    const front = Math.max(aa?.x ?? 0, audit(MAXB)?.x ?? 0);
    /* ★ 一整条重试清单都没啃下来时,【别放弃 —— 把这一站劈成两半】。
       踩过的坑:站 #72(路标 727.5)在第 721.2 块卡死,而 721.2 到 727.5 之间是
       "落到台上 → 立刻起跳吃蓝板 → 反重力撞天花板板 → 打下来落在下一根蓝板上"这一串弹板链:
       每一下单看都能找到,连成一串就不在一个 12 块的路标里 —— 于是每次都在同一个前沿上重来,
       32 次重试全废,整个长程跑 8 分钟就"卡住"收工了。
       现在:卡住就把中间点插成一个新路标接着推(前沿往前挪多少就插多少),
       一段啃不动就啃半段 —— 这也是人打这种段落的方式(先过这一下,再想下一下)。 */
    const room = st.door >= 0 ? st.x - front : Math.min(st.x, front + WAY * 2) - front;
    if (!FREE && front > 5 && st.x - front > 2.5) {
      const mid = +(front + Math.max(2.5, (st.x - front) / 2)).toFixed(1);
      ctxSplits++;
      console.log('劈半:' + at(i) + ' 站目标 ' + st.x.toFixed(1) + ' 卡在前沿 ' + front.toFixed(1)
        + ' → 插入新路标 ' + mid.toFixed(1) + ' 接着推(第 ' + ctxSplits + ' 次)');
      stations.splice(i + 1, 0, { x: mid, door: -1 });
      seed = fs.existsSync(BEST) ? BEST : seed;
      continue;
    }
    void room;
    console.log('卡在 ' + at(i) + ' 站(目标 x=' + st.x.toFixed(1) + '),后面先不推了');
    if (aa) console.log('  前缀终点 x=' + aa.x.toFixed(2) + ' y=' + aa.y.toFixed(2) + ' ' + aa.mode
      + (aa.dead ? ' 【死了】' : '') + ' · 已生效的门 ' + aa.armed.size + '/' + doorCount);
    break;
  }
  seed = fs.existsSync(BEST) ? BEST : seed;
  if (audit(BEST)?.done) { console.log('\n★ 通关了'); break; }
}
const fin = audit(BEST);
console.log('\n用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's · 前缀 ' + BEST
  + (fin ? ' · 走到 x=' + fin.x.toFixed(2) + ' y=' + fin.y.toFixed(2) + ' ' + fin.mode
    + ' · 生效门 ' + fin.armed.size + '/' + doorCount
    + (fin.dead ? ' 【死了】' : '') + (fin.done ? ' 【通关】' : '') : ' · (无前缀文件)'));
