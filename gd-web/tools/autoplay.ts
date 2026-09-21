/* ============================================================
   搜索式自动通关 v3 —— 【带宏动作的最优优先树搜索】(第三张盘:用户自己铺的 WATER)
   ─────────────────────────────────────────────────────────────
   两代人的教训都写在代码里:

   v1(autoplay-greedy.ts,见 git 9b63d6d)每次决定都"从当前状态试几种按法",**没有记忆**——
     全候选都活不下来时退化成"选死得最远的那个",而那恰好是确定性的同一套动作,
     于是每次死后从 x=0 重跑、又在同一根刺上死一次。实测 240 秒全花在 x=216 那一处
     (四次死亡坐标一位不差:x=216.09 y=0.22 vy=-10.38)。

   v2 把它改成搜索树:节点 = 世界快照 + 父指针 + 走过来的 3 帧按键,边 = 按键模式,
     启发 = 交给兜底策略试算能拱多远,按启发值排序的最大堆做最优优先。
     死循环从结构上消失,实测 60 秒走到 15.7%(v1 是 240 秒 6%)。
     但每个节点只推进 3 帧 —— 全关 13500 帧要展开 4500 次,**平坦路段也在烧算力**。

   v3 加【宏动作】:试算时兜底策略要是能活着走完整个视界,那就把这一整段(90 帧)当成
     一个动作直接落子 —— 平地上一次展开顶 30 次。硬路段上兜底会死,宏动作就不成立,
     节点自动退回 3 帧粒度,beam 保留多个分叉做回溯。一句话:
     **能闭眼冲的地方就冲,冲不过去的地方才逐帧搜。**

   跑法:
     cd gd-web
     node tools/autoplay.ts                                   # 默认 600 秒预算
     node tools/autoplay.ts --budget=7200 --log=60            # 两小时
     node tools/autoplay.ts --seed=../../.tmp/gd/water.best.tape.json   # 热启动:接着上次的最优前缀搜
     node tools/autoplay.ts --macro=0                         # 关掉宏动作(v2 行为,做对照)
   ============================================================ */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { generateLevel } from '../src/sim/level.ts';
import { World, botThink, type WorldSnap } from '../src/sim/world.ts';
import { replay, fingerprint } from '../src/sim/replay.ts';
import { U, vxOf } from '../src/sim/constants.ts';
import type { Level } from '../src/sim/level.ts';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name: string, dflt = '') => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const STEP = Number(arg('step', 3));            // 一次精细决定推进几帧(候选 = 2^STEP 种按键模式)
/* ★ 视界按【块】给,不是按帧 —— 帧数要按当前速度档换算。
 *  踩过的坑:固定 90 帧在速度档 4 能盖 14 块,在速度档 0(4.19 单位/帧)只盖 6.3 块;
 *  于是慢速段的"一整段走廊"根本落不进一个宏里,搜索只能靠一串 3 帧的小步往前摸,
 *  在 x=345 那条刺走廊上卡了几万个节点。改成按块给(默认 28 块):速度 0 时 ≈200 帧、
 *  速度 4 时 ≈87 帧 —— 实测同一段从 340.5 直接过到 350.4。
 *  ★ 但这条不是单调的:12/16/20/24/28 块分别走到 349.4 / 345.2 / 341.1 / 336.9 / 350.4 ——
 *  换个视界等于换一套宏动作,落点会变。所以分站驱动的重试清单里也要换视界(见 autoplay-stage)。 */
const HORIZON_BLOCKS = Number(arg('horizon', 28));
const BEAM = Number(arg('beam', 4));            // 一个节点最多推出几个子节点
const MACRO = arg('macro', '1') === '1';        // 宏动作:兜底活着走完视界就整段落子
const MINMACRO = Number(arg('minmacro', 2)) * U;// 宏动作至少要前进这么多(单位)
const BUDGET = Number(arg('budget', 600));      // 时间预算(秒)
const MAXNODES = Number(arg('maxnodes', 4000000));
const HEAPCAP = Number(arg('heapcap', 200000));
const SEED = arg('seed', '');
const TAPE = arg('tape', '../../.tmp/gd/water.solution.json');
const BESTTAPE = arg('best', '../../.tmp/gd/water.best.tape.json');
const WANT = arg('level', 'water');
const QUIET = arg('quiet', '0') === '1';
const TRACE = Number(arg('trace', 0));      // --trace=N:打印前 N 次展开的候选情况(调搜索用)
const DBG = arg('dbg', '0') === '1';        // --dbg=1:每次存盘打印"选中的那条路凭多少分当选"
let dbgW: World | null = null;              // --dbg 用的替身世界(见 saveBest 里的说明)
const lv: Level = WANT === 'gen' ? generateLevel({ seed: 20260913 }) : WATER_CHART;

/* --sawbase=1 —— 锯片判定盒用【不缩放的基础尺寸】(定点实验:原版会不会把判定盒一起放大)。
   ★ 必须传进构造函数:锯片的判定盒是构造时算好的,建完再改字段没用。 */
const w = new World(lv, undefined, undefined, {
  sawUnscaled: arg('sawbase', '0') === '1',
  hazOuter: arg('hazbox', 'inner') === 'outer',
});
if (w.sawUnscaled) console.log('锯片判定盒:不缩放(基础尺寸)');
if (w.hazBoxIsOuter) console.log('刺的判定:用【外框 30×30】(默认是内框 7.5×7.5)');
w.windowed = true;                    // 窗口裁剪:搜索要回放上千万帧,必须裁
/* --padmul=N —— 弹簧/跳环力度微调(和页面上的 [ / ] 同一个旋钮),用来做定点实验:
   "这一段到底要多大力度才过得去"比"猜一个常数"靠谱得多。 */
const PADMUL = Number(arg('padmul', 1));
/** ★ 门口高度提示(--goaly=<块>,只给"这一站的门挂在不同高度"的定点重试用):
 *  离目标 x 还剩 10 块以内时,中心离门中心 y 超过 4 块的状态一律不留。
 *  为什么要它:实测正规路线第 13 站(x=345 的重力门)门在缝的地板高度(y≈5.5),
 *  而卷子从缝的上方 y=13.5 飞过去 —— 门永远吃不到,搜索还会一遍遍展开"飞得高、x 走得远"的路。
 *  ★ 生效距离一开始写的 25 块,结果反而更差(实测:走到 330.5 vs 不带它 337.6)——
 *    因为这一段的"合理接近路线"本来就在 y≈9~11(缝里),离门中心 4~5 块,被提前剪掉了。
 *    现在只压最后 10 块:那一段人必须已经在门的高度上,剪掉"还在飞高"的状态才是对的。
 *  这不是物理(不改 World),只约束"留下的状态";不带它的物理上输入卷照样成立。 */
const GOALY = arg('goaly', '') ? Number(arg('goaly')) : null;
let goalLimitX: number | null = null;      // 由 --goal 推出(在 GOAL 定义之后赋值)
if (GOALY != null) console.log('门口高度提示:y = ' + GOALY + ' 块(±4 块以内才留状态)');
if (PADMUL !== 1) { w.padMul = PADMUL; console.log('弹簧力度 ×' + PADMUL); }
/* --flipmul=N —— 翻重力那一下的纵向速度倍率(默认 1.75 = gdp@2.11)。
   和 --padmul 一样是【定点实验】旋钮:用来回答"这一段到底按哪一版语义才过得去"。
   (源冲突:gdp@2.11 `flipGravity.cpp:19 m_yAccel *= 1.75` vs OpenGD `playerobject.cpp:540 m_dYVel /= 2`。) */
const FLIPMUL = Number(arg('flipmul', 0));
if (FLIPMUL > 0 && FLIPMUL !== w.flipMul) { w.flipMul = FLIPMUL; console.log('翻重力速度倍率 ×' + FLIPMUL); }
/* --sawbase 见上面新建 World 的地方(必须走构造函数) */

/* ---------------- ★ 不许跳过事件门(否则搜出来的"通关"是飞过去的,证明不了任何东西) ----------------
 * 踩过的坑:第一版搜索报"通关",可回放一看 —— 玩家在第 2000 帧左右进了 UFO,
 * 然后一路贴着天花板(y≈110~124 块)飞完全关,46 个门【一个都没碰到】:
 *    门 x=439.5 → 想去 spider · 跨过时 y=121.46,门中心 y=7.50 · 当时形态=ufo
 * 这不是物理错(GD 里门是"外框相交"才算碰到,飞得高确实碰不到),但它意味着
 * 那次"通关"没有验证飞机/蜘蛛/波浪/机器人任何一段 —— 而这张图里那几个门本来就是
 * 关卡设计的一部分(作者自己设了存档点,说明他指望玩家按这条路线走)。
 * 所以给搜索加一条约束:任何必过门(形态/重力/速度/尺寸)完全过去之后,
 * 它在世界里的 armed 标记必须已经置位,否则这条路判死(只在搜索里生效,不改物理)。
 * 约束只做剪枝:搜出来的输入卷在【不带约束】的物理上照样成立(verify-run 就是不带约束验的)。 */
const MUSTPASS = (arg('noskip', 'portal,gravity,speed,size') || '').split(',').filter(Boolean);
/* --start=395,8,ufo —— 从半路起搜(诊断用:整关搜不动时,把搜索根挪到某一段单独啃)。
   起点之前的必过门自动算"已经过了",不然一开局就被判跳过。 */
const START = arg('start', '');
const startAt = START ? START.split(',').map(Number) : null;
const startX = startAt ? startAt[0] * U : 0;
/* ---------------- ★ 必过门清单:四类门【分散在四个表里】,别只拿 portals ----------------
 * 踩过的坑(很隐蔽):这里原来写的是 `w.portals.filter(...)`,而仿真把四类门分开放 ——
 *   portal 在 w.portals(46 个)、重力门在 w.gravs、速度门在 w.speeds、尺寸门在 w.sizes。
 *   于是 "必过门 46 个(portal/gravity/speed/size)" 这句提示里的后三类【一个都没在查】:
 *   搜索可以随便跳过重力门/速度门,而打印出来的清单看着像是都管了。
 *   (发现它的路径也很绕:分站驱动按铺面表数出 108 个门,却永远等不到 speed 门"生效",
 *    在 x=1.5 那一站空转 —— 因为仿真那边根本没把它放进必过门。)
 * 门的【顺序】按右沿 x1 排,gateOk 里那句 `if (w.x < b.x1) break` 依赖这个顺序。 */
const isDoorObj = (o: { kind: string }) => o.kind === 'portal' || o.kind === 'gravity' || o.kind === 'speed' || o.kind === 'size';
const allDoors: Box[] = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes].sort((a, b) => a.x1 - b.x1);
const mustPass = allDoors
  .filter((b) => MUSTPASS.includes(b.o.kind) && b.x1 > startX);
const armedOf = (world: World) => (world as unknown as { armedPortals: Set<unknown> }).armedPortals;
const NOSKIP = mustPass.length > 0;
console.log('必过门 ' + mustPass.length + ' 个(' + MUSTPASS.join('/') + ')· 跳过即判死');

/** ★ 局部天花板(--roof=auto,默认开):
 *  这张图里到处是"开口的竖井" —— 球/蜘蛛/飞机翻个重力就能一路飞到 y=75、120 去,
 *  而原版是让你在走廊里弹来弹去的。于是搜索的"最远活着"永远是那条飞天路:
 *     实测 max 种子在 x=495/505/515 的状态分别是 ball y=17.96 / 50.36 / 75.56,
 *     到 x=526 就被"没碰到 cube 门"判死 —— 搜了几万节点全是在给这条死路做无用功。
 *  对策:算一条【局部天花板】—— 右边 25 块、左边 10 块内的最高物件 +4 块;
 *  超过它的状态一律不留。它不是物理(不改 World),只是搜索的"别飞出去"约束;
 *  输入卷在不带它的物理上照样成立。--roof=off 关掉,或给具体块数。 */
/* 默认:只有"必须按铺面路线走"(--noskip)时才开天花板 —— 自由路线本来就是允许飞过去的,
   给它加天花板等于把它唯一的走法堵死。要单独控制就 --roof=off / --roof=<块数>。 */
const ROOFARG = arg('roof', NOSKIP ? 'auto' : 'off');
let roofAt: ((x: number) => number) | null = null;
if (ROOFARG === 'auto') {
  const N = Math.ceil(lv.length) + 4;
  const arr = new Float64Array(N);
  for (const o of lv.objects) {
    if (o.kind === 'deco' || o.kind === 'text') continue;
    const top = (o.r ?? 0) + (o.h ?? 0);
    const x0 = Math.max(0, Math.floor(o.b - 10)), x1 = Math.min(N - 1, Math.ceil(o.b + o.w + 25));
    for (let i = x0; i <= x1; i++) if (top > arr[i]) arr[i] = top;
  }
  for (let i = 0; i < N; i++) arr[i] += 4;
  roofAt = (x: number) => arr[Math.max(0, Math.min(N - 1, Math.floor(x / U)))];
  console.log('局部天花板:开(物件最高点 +4 块,超出即判死)');
} else if (ROOFARG !== 'off') {
  const lvl = Number(ROOFARG) * U;
  roofAt = () => lvl;
  console.log('天花板:y = ' + ROOFARG + ' 块');
}
/** 推进一帧(种子回放用:带约束,能在种子坏掉时第一时间发现)
 *  ★ 判据必须和 constraintOk 的【门口那一半】完全一致(armed 或"碰不碰都一样")——
 *    踩过:这里少了 portalSatisfied,于是种子回放比搜索更严:一卷本来合法的输入卷
 *    (球贴着地面滚过 y=10 那个冗余球门)在回放时被当场判死,而文件里写着它到 523.4 块。
 *    后果是"热启动只铺到 493.1"、搜索从上一站重新摸,分站推进几乎原地打转。
 *    天花板(roof)【不】在这里判:它只约束"留下的状态",帧与帧之间的抛物线允许过顶。 */
function step(hold: boolean) {
  w.frame(hold);
  if (w.dead || w.done) return;
  if (!gateOk()) w.dead = true;                    // 越过了门却没让它生效 → 这条路作废
}

/** ★ 约束只在【要留下的状态】上判,不在试算途中判。
 *  踩过的坑:约束写在 per-frame 的推进里,于是"跳过了门"的【试算】会被当场判死 ——
 *  可试算本来就是在探路(它跳过去、发现不行、于是不再往那边走),判死它等于把
 *  宏动作和长视界一起掐掉:实测从 x=481 起搜,关掉约束能走到 497.7,开着只剩 481.4
 *  (50 个节点就把前沿耗干了)。现在试算一律用 w.frame 自由跑,
 *  只在"这个状态要不要留下"时用本函数判一次 —— 留下了却跳过门的,下一帧照样被 step 判死。 */
/** 这个门"碰不碰都一样"吗 —— 是的话不算跳过。
 *  ★ 原版的门只在【会改变状态】时才起作用:你已经是球了,再从球门里滚过去什么都不会发生。
 *    这条不是放水,是改正我自己写严了的约束:实测球态走廊那截,489 那个球门把人变成球之后,
 *    492 那个【高高挂在 y=10 的】冗余球门根本碰不到(球贴着地面 y=6 滚过去),
 *    于是整条路被判"跳过门" —— 前沿在 x=492.77 就全灭了,而实际上这一段无输入都能滚过去。 */
function portalSatisfied(b: Box, world: World): boolean {
  const o = b.o;
  if (o.kind === 'portal') return world.mode === o.to;
  if (o.kind === 'gravity') return world.gdir === (o.gdir ?? 1);
  if (o.kind === 'speed') return world.speedIdx === (o.speed ?? 1);
  /* ★ 尺寸门要分两种,别一句"已经是迷你就够了"糊过去 —— 这一条以前是错的:
     放大门(物件 99 / mini:false)要求的是【变回普通大小】,而旧写法 `sizeMul !== 1`
     在玩家还是迷你时也返回 true → 搜索以为"这个门办过了",于是【贴着它飞过去】、
     人保持迷你一路走到 x=1060,而那段关卡是照普通大小设计的
     (1054 那个 wave→cube 门 + 1060 的 robot 门,出门窗口只有 0.3 块宽;
      普通大小实测能进,迷你进不去 —— 见 HANDOVER §13.15)。 */
  if (o.kind === 'size') return o.mini === false ? world.sizeMul === 1 : world.sizeMul !== 1;
  return false;
}

/** 门口约束的核心判据(step 与 constraintOk 共用,规则必须完全一致)。
 *  ★ "算数"要在【越过的那一刻】记进 handledPortals:这个判定依赖当时的玩家状态,
 *    而状态会变 —— 重力门在越过时重力正好对得上(算数 ✓),三十块之后被球点翻成反重力,
 *    再按"当前状态"回头判就变成"没生效",于是那个节点上 16 个候选全被判跳过门、前沿枯死。
 *    记进 handledPortals 之后,后面再问就一律放行,而且【不碰物理】的 armedPortals。 */
function gateOk(): boolean {
  if (!NOSKIP) return true;
  const armed = armedOf(w);
  for (const b of mustPass) {
    if (w.x < b.x1) break;                                  // 还没完全越过这个门
    if (armed.has(b) || w.handledPortals.has(b)) continue;
    if (portalSatisfied(b, w)) { w.handledPortals.add(b); continue; }
    return false;                                           // 越过了却没让它生效 → 作废
  }
  return true;
}

function constraintOk(): boolean {
  if (roofAt && w.y + w.box > roofAt(w.x) * U) return false;    // 飞出了局部天花板
  if (GOALY != null && goalLimitX != null && w.x > goalLimitX) {  // 门口高度提示(--goaly)
    const cy = w.y + w.box / 2;
    if (Math.abs(cy - GOALY * U) > 4 * U) return false;
  }
  return gateOk();
}

/* ---------------- ★ 朝门口的梯度(只有"跳过就判死"是不够的) ----------------
 * 光加硬约束,搜索会一直卡在门口:贴天花板那条路 x 走得最远,**分数最高**,
 * 可它在剩下几十块里根本降不到门口的 y —— 于是最优优先一遍遍展开这些"走得远但到不了门"的路,
 * 7 万节点、6 次重启都卡在 x=421(整关搜索),而从 x=390 起搜(前沿干净)90 秒就过去了。
 * 加一条启发:快到下一个必过门时(窗口内),按【玩家盒子到门盒子的纵向距离】扣分 ——
 * 离门口越近的路越优先,"飞得高"的路自然沉下去。
 * ★ 窗口默认从 60 块改成 **120 块**:实测站 7(重力门 337,挂在 y=9)那一段,前缀是个
 *   翻着重力的 UFO、在 y≈16 一路飞 —— 60 块的窗口来不及把它压回门口高度,搜索卡在 333.3;
 *   改成 120 块同一段直接过到 340.1。慢速/纵向落差大的段落需要更早开始"往门口凑"。 */
const APPROACH = Number(arg('approach', 120)) * U;
/** 朝门口靠拢那条启发留的纵向容差(块)。见 portalPull 里的说明:0.5 是"门缝很窄"的段落需要的粒度。 */
const PULLTOL = Number(arg('pulltol', 0.5));
function vertGap(u: { y0: number; y1: number }, b: { y0: number; y1: number }): number {
  return Math.max(0, Math.max(b.y0 - u.y1, u.y0 - b.y1));
}
function portalPull(): number {
  if (!NOSKIP) return 0;
  const armed = armedOf(w);
  let next: (typeof mustPass)[number] | null = null;
  for (const b of mustPass) {
    if (armed.has(b) || w.handledPortals.has(b)) continue;
    /* ★ 还要跳过【越过了、而且"碰不碰都一样"】的门 —— 和 gateOk 同一条判据。
       踩过的坑:只看 armed 的话,一个【冗余门】会把指针永远钉在它身上:
       本关 x≈492 有个球门,玩家进 489 那个门之后本来就是球了,492 那个"碰不碰都一样",
       于是它【永远不会 armed】—— 于是 portalPull 认的"下一门"永远是 492,
       而 w.x > 492.x1 + 2 块之后函数直接 return 0:整条关卡【再也没有朝门口的引力】。
       后果很实在:塔段那卷走在地面 y=0 的 584 分=586,把真正上了塔的 567.9 分=563 顶掉,
       存进种子的永远是地面路线,分站推进在原地打转(实测站 22 卡了一整轮)。
       判据里的状态检查只对【已经越过的门】做 —— 前面的门不能拿"当前形态"去蒙。 */
    if (b.x1 <= w.x && portalSatisfied(b, w)) continue;
    next = b; break;
  }
  if (!next) return 0;
  if (w.x < next.x0 - APPROACH || w.x > next.x1 + 2 * U) return 0;   // 还没进入"最后这一段"就不管
  /* ★ 权重必须压过"横向领先":贴天花板那条路比贴地路多走了 30 块,可它纵向差着 117 块 ——
     如果只按"离门口多高"扣一点点,它照样排第一。所以留 2 块容差,超出部分【平方】扣:
       差 10 块 ≈ 扣 128 块的分;差 19 块 ≈ 扣 578 块 ——
     "掉到下面去了"这种路会被立刻压下去,而"就在门口附近差一点"几乎不扣。
     (线性权重实测不够:掉下塔的前缀照样以 556 分排在"留在塔上"的 551 分前面,
      于是搜索一路沿着地面路线走到死胡同 x=607,而那个 UFO 门挂在 y=23。) */
  const gap = vertGap({ x0: w.x, x1: w.x + w.box, y0: w.y, y1: w.y + w.box }, next);
  /* ★ 容差(默认 0.5 块)—— 以前是 2 块,那是为了"别把'就在门口附近差一点'的路罚得太狠"。
     可到了"门缝只有零点几块"的地方,2 块容差等于【梯度是平的】:
     实测 x=1060 的 robot 门(盒 y[22.07,24.93]),玩家在 y=25 和 y=26 拿到的扣分【都是 0】,
     搜索完全没有"往下贴"的动力 —— 而它需要的是精确到 0.3 块的高度。
     现在默认 0.5;`--pulltol=N` 还能调(整关搜索那种"只求大致对齐"的场合可以放大)。 */
  const gapB = Math.max(0, gap / U - PULLTOL);
  return Math.min(gapB * gapB * 2, 900) * U;
}

/* ---------------- 候选:2^STEP 种按键模式 × 两种兜底 ---------------- */
interface Cand { pat: number; mode: 'idle' | 'bot'; }
const CANDS: Cand[] = [];
for (let p = 0; p < (1 << STEP); p++) {
  CANDS.push({ pat: p, mode: 'idle' });
  CANDS.push({ pat: p, mode: 'bot' });
}
const bit = (pat: number, i: number) => ((pat >> i) & 1) === 1;

/* ---------------- 节点与最大堆 ---------------- */
interface Node {
  snap: WorldSnap;
  parent: Node | null;
  inputs: boolean[];            // 父节点 → 本节点之间落子的按键(精细 3 帧,或一整段宏)
  score: number;                // 启发值:优先扩张谁
  gen: number;
}
const heap: Node[] = [];
function siftUp(i: number) {
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p].score >= heap[i].score) break;
    const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
  }
}
function siftDown(i: number) {
  for (;;) {
    const l = 2 * i + 1, r = l + 1;
    let m = i;
    if (l < heap.length && heap[l].score > heap[m].score) m = l;
    if (r < heap.length && heap[r].score > heap[m].score) m = r;
    if (m === i) break;
    const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
  }
}
function pushHeap(n: Node) { heap.push(n); siftUp(heap.length - 1); }
function popHeap(): Node | null {
  if (!heap.length) return null;
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length) { heap[0] = last; siftDown(0); }
  return top;
}
/** 堆太大就砍掉最差的一半(跑到几十万节点时内存会咬人) */
function pruneHeap() {
  if (heap.length <= HEAPCAP) return;
  heap.sort((a, b) => b.score - a.score);
  heap.length = Math.floor(HEAPCAP / 2);
  for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i);
}

/* ---------------- ★ 前沿聚焦(不加这条,搜索会在一处死磕到天荒地老) ----------------
 * 现象:加"必过门"约束后,整关搜索卡在 x=421 那一处 6 万节点也过不去;
 * 而把搜索根直接挪到 x=390 单独搜,同一段 90 秒就过了(x=526)。
 * 原因不是那一段没法过,而是【前沿里堆满了同一个岔路口的近似状态】(分数全是 421.x),
 * 最优优先退化成"把所有平局状态挨个展开一遍"。
 * 对策:前沿只保留"离已到达的最远进度 WINDOW 块以内"的节点 —— 备选分支还在(同一段里的
 * 其它走法都留着),但不会再去啃几十块之前的老岔路。 */
const WINDOW = Number(arg('window', 30)) * U;
let frontierBest = 0, focused = 0;
function focusFrontier() {
  if (heap.length <= 800) return;
  const cut = frontierBest - WINDOW;
  let kept = 0;
  for (let i = 0; i < heap.length; i++) if (heap[i].score >= cut) heap[kept++] = heap[i];
  if (kept === heap.length) return;
  focused += heap.length - kept;
  heap.length = Math.max(kept, 64);              // 至少留一点,别把路走绝
  for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i);
}

/* ---------------- 试算 ---------------- */
const rollTape: boolean[] = [];        // 兜底那一段的按键(通关 / 宏动作都要它)
/** 视界(块)→ 帧:跟着当前速度档走。速度档越高,同样的帧数盖得越远。 */
const horizonFrames = () => {
  const vx = vxOf(w.speedIdx) || 5.2;
  return Math.max(30, Math.min(420, Math.round(HORIZON_BLOCKS * U / vx)));
};
const HORIZON = 90;                    // 兜底值(种子回放按段切分时用)
interface Roll { maxX: number; alive: boolean; done: boolean; stalled: boolean; frames: number; overRoof: boolean }
function rollout(mode: 'idle' | 'bot', frames: number, collect: boolean): Roll {
  let maxX = w.x, still = 0, i = 0, overRoof = false;
  for (; i < frames; i++) {
    if (w.dead || w.done) break;
    const h = mode === 'bot' ? botThink(w) : false;
    if (collect) rollTape.push(h);
    w.frame(h);                          // ★ 试算自由跑:约束只在"留下状态"时判(constraintOk)
    if (roofAt && w.y + w.box > roofAt(w.x) * U) overRoof = true;      // 这一趟飞出了局部天花板
    if (w.x > maxX + 1e-9) { maxX = w.x; still = 0; } else still++;
    /* 卡住不动(既没前进也没死)= 这条兜底没意义,提前收工省算力 */
    if (still > 40) return { maxX, alive: !w.dead, done: w.done, stalled: !w.dead, frames: i + 1, overRoof };
  }
  return { maxX: Math.max(maxX, w.x), alive: !w.dead, done: w.done, stalled: false, frames: i, overRoof };
}

interface EdgeOut {
  snap: WorldSnap | null;      // 精细落子:走完 STEP 帧之后的状态
  endSnap: WorldSnap | null;   // 宏落子:兜底活着走完视界之后的状态
  tap: boolean[];              // 兜底那一段的按键(只有宏落子 / 通关时才需要带走)
  score: number;               // 启发值
  done: boolean;
}
/** 走一条边:先按 pat 的 STEP 帧,再交给 mode 兜底最多 HORIZON 帧。
 *  ★ 按键【总是要记】的:宏落子要把这 90 帧的输入一起带走,不记的话拼出来的输入卷是错的
 *    (宏节点只带 STEP 帧的按键、状态却在 90 帧之后 —— 回放立刻分岔)。 */
function walkEdge(c: Cand): EdgeOut {
  rollTape.length = 0;
  for (let i = 0; i < STEP; i++) {
    if (w.dead || w.done) return { snap: null, endSnap: null, tap: [], score: w.x, done: w.done };
    w.frame(bit(c.pat, i));
  }
  if (w.done) return { snap: w.snapshot(), endSnap: null, tap: [], score: w.x, done: true };
  if (w.dead) return { snap: null, endSnap: null, tap: [], score: w.x, done: false, why: 'edge' };
  if (!constraintOk()) return { snap: null, endSnap: null, tap: [], score: w.x, done: false, why: (roofAt && w.y + w.box > roofAt(w.x) * U) ? 'roof' : 'skip' };   // 过顶 / 跳过了必过门
  const snap = w.snapshot();

  const hz = horizonFrames();          // ★ 视界按块换算成帧(见 horizonFrames 的说明)
  let r = rollout(c.mode, hz, true);
  /* 选中的兜底活不下去 → 换另一种兜底再试一次(松手不行就请反应式机器人,反之亦然) */
  if (!r.alive && !r.done) {
    const other: 'idle' | 'bot' = c.mode === 'idle' ? 'bot' : 'idle';
    const first = rollTape.slice();
    rollTape.length = 0;
    const r2 = rollout(other, hz, true);
    if (r2.maxX > r.maxX || r2.done) r = r2;
    else { rollTape.length = 0; for (const h of first) rollTape.push(h); }
  }
  /* 宏落子:活着走完整个视界(没卡住)、而且真的前进了 → 这一整段可以直接落子。
     ★ 宏这一段里要是跳过了必过门,这个落子不能要(见 constraintOk 的说明)。 */
  const endSnap = (MACRO && r.alive && !r.done && !r.stalled && w.x - snap.x >= MINMACRO && constraintOk())
    ? w.snapshot() : null;
  /* 活着走到视界尽头 → 给一点"活着"的奖励(2 块):同样远的两个分支,先扩张没死的那个。
     ★ 飞出局部天花板的试算要【重罚】:以前只有"要不要留下"时才判天花板,于是
       "一变方块就朝天上掉"的那条路在试算里 x 最远、分还不低,搜索一直往那边走
       —— 实测球态走廊尽头的 cube 门(525)就是这么卡住的:进门后重力是向上的,
       方块一路飞到 y=49,而所有试算都"看起来很远"。 */
  const score = Math.max(r.maxX, snap.x) + (r.alive && !r.stalled ? 2 * U : 0)
    - portalPull() - (r.overRoof ? 300 * U : 0);
  const needTap = endSnap !== null || r.done;
  return { snap, endSnap, tap: needTap ? rollTape.slice() : [], score, done: r.done };
}

/* ---------------- ★ 分阶段重启(整关搜索卡住时的救命招) ----------------
 * 现象:加了"必过门"约束后,整关搜索 7 万节点卡在 x=421(那个 cube 门);可从 x=390 起搜,
 * 同一段 90 秒就过去了。差别不在算力,在【前沿的位置】:
 *   贴天花板那条路(x=390 时 y≈120)在 31 块的距离内根本降不到门口(y=5),
 *   而分数只按 x 排 —— 天花板路和贴地路同分,搜索在成千上万个"同分不同高度"的状态里打转。
 * 对策:每跑 PHASE 秒,把前沿清空、只留【活着走到最远】那条路的节点链,重新展开。
 *   重启后 = 换一局心态从那里接着搜:同样的动作试过就跳过(seen 还在),于是自动换下一个走法。
 *   —— 这就是从 x=390 起搜为什么会成功:前沿是干净的,没有几十块之前的老岔路拖后腿。 */
const PHASE = Number(arg('phase', 45)) * 1000;
let nextPhase = PHASE, restarts = 0;
function restartFromBest() {
  if (!bestNode) return;
  const chain: Node[] = [];
  for (let p: Node | null = bestNode; p; p = p.parent) chain.push(p);
  heap.length = 0;
  for (let i = chain.length - 1; i >= 0; i--) pushHeap(chain[i]);
  frontierBest = bestNode.score;
  restarts++;
}

/* ---------------- 状态去重(同 tick 同状态的节点没必要重复展开) ---------------- */
const seen = new Set<string>();
function stateKey(s: WorldSnap): string {
  return s.tick + '|' + s.mode + '|' + s.gdir + '|' + s.sizeMul.toFixed(3) + '|' + (s.onGround ? 1 : 0)
    + '|' + s.x.toFixed(2) + '|' + s.y.toFixed(2) + '|' + s.vy.toFixed(2)
    + '|' + s.boostDir + '|' + (s.dash ? s.dash.kind + s.dash.t : '-')
    + '|' + s.sets[5].length + ',' + s.sets[6].length + ',' + s.sets[1].length;
}

/* ---------------- 输入卷拼装:沿父指针把每段落子的按键接起来 ----------------
 * ★ 这里踩过一个很贵的坑:`for (p = n; p && p.parent; ...)` 会把【链根】那一段按键丢掉。
 *   出生点是根时它的 inputs 本来是空的,看不出问题;可 --seed 热启动时根是半路的一个节点,
 *   它的 inputs 是一整段前缀 —— 丢掉的后果是【存下来的卷子自己回放不出来】:
 *   分站搜到 x=512.9 的那一卷,重新回放第 182 帧就死了(少了一整段)。所以根也要算。 */
function tapeOf(n: Node): boolean[] {
  const segs: boolean[][] = [];
  let total = 0;
  for (let p: Node | null = n; p; p = p.parent) { segs.push(p.inputs); total += p.inputs.length; }
  const out: boolean[] = new Array(total);
  let k = 0;
  for (let i = segs.length - 1; i >= 0; i--) for (const h of segs[i]) out[k++] = h;
  return out;
}

let nodes = 0, deadEnds = 0, dups = 0, bestAlive = 0, macros = 0, bestNode: Node | null = null;
let fineKept = 0;             // 额外留下的"宏内部精细节点"个数(见主循环)
let bestScore = -Infinity, maxAliveX = 0, maxNode: Node | null = null;
/** 种子链上【还没推进堆】的老节点(从前到后)。前沿空了才逐个补进去当"退回岔路口"。 */
const seedBack: Node[] = [];
/** 把一卷输入从头回放、沿路切成一条节点链;链尾推进前沿,老节点扣进 seedBack。
 *  热启动和"局部回退"(见主循环)共用这一份。 */
function replayInto(t: boolean[], label: string): number {
  w.resetToStart();
  let seg: boolean[] = [], parent: Node | null = null, made = 0;
  const chain: Node[] = [];
  const flush = () => {
    if (!seg.length) return;
    /* ★ 种子节点的分必须和 walkEdge 算出来的分【同口径】:以前这里写的是 `score: w.x`,
       于是种子链上的老节点(塔段那卷里 x=430~510 有几十个)分数虚高,
       而塔上那个 567.9 的子节点因为要扣"离 UFO 门还差 11 块"的引力分,只拿 384 ——
       堆按分排序,搜索就一路跑回几十块之前的老岔路去展开了(实测:45 秒里 438 个死胡同
       全挤在 430~510,塔上新铺的节点一个都没展开)。这里补上同一项扣分即可。 */
    const n: Node = { snap: w.snapshot(), parent, inputs: seg, score: w.x - portalPull(), gen: -1 };
    seen.add(stateKey(n.snap));
    chain.push(n); parent = n; made++; seg = [];
  };
  for (let i = 0; i < t.length; i++) {
    if (w.dead || w.done) break;
    step(t[i]);
    seg.push(t[i]);
    /* 沿路按 HORIZON 切段:切出来的每一段都是一个可落子的宏,热启动之后能直接复用 */
    if (seg.length >= HORIZON) flush();
  }
  flush();
  /* ★ 只把【链尾】推进堆;老节点扣在 seedBack 里,前沿枯了再补(见上面的说明) */
  seedBack.length = 0;
  if (chain.length) {
    for (let i = 0; i < chain.length - 1; i++) seedBack.push(chain[i]);
    pushHeap(chain[chain.length - 1]);
  }
  console.log(label + ':铺了 ' + made + ' 个节点,最远 ' + (w.x / U).toFixed(1)
    + ' 块(前沿只放链尾,另 ' + seedBack.length + ' 个老节点扣着等前沿枯)');
  if (parent) { bestAlive = w.x; bestNode = parent; bestScore = parent.score; }
  return made;
}

/* ---------------- 热启动:把一条已知可行的输入卷铺成一条链,推进堆 ---------------- */
if (SEED && fs.existsSync(SEED)) {
  let t: boolean[] = JSON.parse(fs.readFileSync(SEED, 'utf8')).tape;
  /* --seedtrim=块 —— 把种子的尾巴剪掉这么多块再接着搜。
     为什么要它:分站搜有时会"卡在自己的尾巴上" —— 上一次的最优前缀末端是个死状态
     (实测 x=512.9 那一步是个在天上 75 格往上飞的球),从那一点往后怎么搜都没有出路,
     而重新规划必须【退回到岔路口】。剪掉尾巴 = 把搜索根往前挪一点,换一条微路线重来。 */
  const trimBlocks = Number(arg('seedtrim', 0));
  if (trimBlocks > 0 && t.length > 60) {
    const rawX = JSON.parse(fs.readFileSync(SEED, 'utf8')).x ?? 0;
    const perBlock = rawX > 1 ? t.length / rawX : 6.5;
    const cut = Math.min(t.length - 60, Math.round(trimBlocks * perBlock));
    t = t.slice(0, t.length - cut);
    console.log('种子剪尾 ' + trimBlocks + ' 块(约 ' + cut + ' 帧)→ 从 ' + t.length + ' 帧重新规划');
  }
  replayInto(t, '热启动 ' + SEED);
}

if (!heap.length) {
  /* --startfrom=<卷子文件>,<块> —— 沿着这条卷子走到指定 x,【用那个真实状态】当搜索根,
     并且开一个干净的前沿。为什么需要它:分站搜卡住的真正原因常常不是"那一段过不去",
     而是"前缀末端的那个状态是个死状态"(实测站 14:前缀末端是个在空中翻着重力的球,
     从它往后怎么搜都没出路),而同一段从 x=478 的地面状态起搜,几秒就过到 547。
     它和 --seed 的区别:--seed 把整条链都塞进堆里(前沿还带着旧的包袱),
     --startfrom 只塞一个根节点 —— 相当于"退到岔路口、重新开一局心态"。 */
  const SF = arg('startfrom', '');
  if (SF) {
    const cut = SF.lastIndexOf(',');
    const file = SF.slice(0, cut), bx = Number(SF.slice(cut + 1));
    const t: boolean[] = JSON.parse(fs.readFileSync(file, 'utf8')).tape;
    w.resetToStart();
    const prefix: boolean[] = [];
    for (const h of t) {
      if (w.dead || w.done || w.x >= bx * U) break;
      step(h);
      prefix.push(h);
    }
    console.log('从卷子里起搜:' + file + ' 走到 x=' + (w.x / U).toFixed(1) + ' 块(' + prefix.length
      + ' 帧)· 形态=' + w.mode + ' y=' + (w.y / U).toFixed(2) + ' · 干净前沿');
    pushHeap({ snap: w.snapshot(), parent: null, inputs: prefix, score: w.x, gen: -1 });
  } else {
    w.resetToStart();
    if (startAt) {
      /* 半路起搜:把人放到指定位置/形态(诊断用)。y 用块、x 用块。 */
      w.x = startAt[0] * U; w.y = startAt[1] * U; w.vy = Number(arg('startvy', 0)) * U; w.onGround = false;
      w.mode = (arg('startmode', 'cube') as typeof w.mode);
      w.speedIdx = Number(arg('startspeed', 1));      // 诊断用:指定速度档(0 最慢 … 4 最快)
      w.gdir = Number(arg('startgdir', 1)) < 0 ? -1 : 1;   // 诊断用:指定重力方向(反重力段要它)
      w.checkX = w.x; w.checkY = w.y;
      console.log('半路起搜:x=' + startAt[0] + ' y=' + startAt[1] + ' 形态=' + w.mode
        + ' · 之后的必过门 ' + mustPass.length + ' 个(最近一个 x=' + (mustPass[0] ? (mustPass[0].x1 / U).toFixed(1) : '-') + ')');
    }
    pushHeap({ snap: w.snapshot(), parent: null, inputs: [], score: w.x, gen: -1 });   // 根
  }
}

/* ---------------- 主循环 ---------------- */
const t0 = performance.now();
/** 局部回退的档位(帧):前沿枯了 / 久不推进时,逐级剪尾巴重放。见主循环里的说明。 */
const REWIND = [8, 16, 32, 64, 128, 256, 512, 1024];
const REWIND_AFTER = Number(arg('rewindafter', 400));   // 连续多少次展开没刷新最远记录就回退一档
let rewinds = 0, lastProgressX = 0, sinceProgress = 0;
const endX = lv.length * U;
const GOAL = arg('goal', '') ? Number(arg('goal')) * U : Infinity;
/* --goaly 的生效范围:离目标 25 块以内(见文件上方 GOALY 的说明) */
if (GOALY != null && GOAL !== Infinity) goalLimitX = GOAL - 10 * U;
let goalHit = false;
let solution: boolean[] | null = null;
let lastLog = 0;
const stuckAt = new Map<number, number>();     // 死胡同的 x 直方图(按 10 块一格)
const LOGSTEP = Number(arg('log', 15));

function saveBest() {
  if (!bestNode) return;
  /* --dbg=1 —— 调搜索用:把"选中的那条路到底凭多少分当选"打出来。
     踩过的坑:塔段的搜索明明有个"上了塔"的高分状态,存下来的却是地面路线 ——
     分数是怎么算出来的、下一次必过门是哪一个,不打印就只能猜。 */
  if (DBG && !dbgW) dbgW = new World(lv);
  if (DBG && dbgW) {
    /* ★ 必须拿 bestNode 的状态去算 —— 直接用 w 是错的:w 停在上一次试算的末端,
       它的 handledPortals 未必是 bestNode 那一条路的(踩过:打印出来的"下一门"
       永远是几十块之前的冗余门,而真正的原因只是 w 的状态不对)。 */
    dbgW.restore(bestNode.snap);
    const armed = dbgW.armedPortals;
    const undone: string[] = [];
    for (const b of mustPass) {
      if (armed.has(b) || dbgW.handledPortals.has(b)) continue;
      if (b.x1 <= dbgW.x && portalSatisfied(b, dbgW)) continue;
      undone.push('x' + (b.x0 / U).toFixed(1) + ' y' + (b.y0 / U).toFixed(1) + '~' + (b.y1 / U).toFixed(1)
        + '/' + b.o.kind + (b.o.to ? '→' + b.o.to : '') + ' [前=' + (b.x1 <= dbgW.x ? 1 : 0)
        + ' armed=' + (armed.has(b) ? 1 : 0) + ' 记=' + (dbgW.handledPortals.has(b) ? 1 : 0) + ']');
      if (undone.length >= 3) break;
    }
    const s = bestNode.snap;
    console.log('  [选] x=' + (s.x / U).toFixed(2) + ' y=' + (s.y / U).toFixed(2) + ' ' + s.mode
      + (s.gdir < 0 ? '↑' : '↓') + ' 分=' + (bestScore / U).toFixed(1)
      + ' · 未办的门:' + (undone.length ? undone.join(' | ') : '无')
      + ' · 最远活=' + (maxAliveX / U).toFixed(1));
  }
  fs.mkdirSync(path.dirname(BESTTAPE), { recursive: true });
  const tape = tapeOf(bestNode);
  /* ★ 存之前先自检:这一卷输入从出生点原样回放,必须走到 bestNode 那个 x。
     不查这一条的话,一卷"走不通的输入卷"会被写进文件,而分站搜下一站时用它当种子 ——
     错误会一路滚下去(踩过:文件写着 512.9 块,回放 182 帧就死)。 */
  const check = new World(lv);
  for (const h of tape) { if (check.dead || check.done) break; check.frame(h); }
  const drift = Math.abs(check.x - bestNode.snap.x);
  if (drift > 1) {
    /* 调搜索用:逐帧比对,找出【第一帧分岔】在哪 —— 只说"差 46 块"是不够的 */
    const a = new World(lv), b = new World(lv);
    const step = (world: World, dead: boolean): boolean => dead;
    let firstBad = -1;
    for (let i = 0; i < tape.length; i++) {
      if (a.dead || b.dead) break;
      a.frame(tape[i]); b.frame(tape[i]);
      if (Math.abs(a.x - b.x) > 1e-6 || Math.abs(a.y - b.y) > 1e-6 || a.dead !== b.dead) { firstBad = i; break; }
    }
    void step;
    fs.writeFileSync(BESTTAPE.replace(/\.json$/, '') + '.bad.json',
      JSON.stringify({ level: lv.name, tape, x: bestNode.snap.x / U }));
    console.log('⚠ 存盘自检不过:回放走到 ' + (check.x / U).toFixed(1) + ' 块,节点状态是 '
      + (bestNode.snap.x / U).toFixed(1) + ' 块(差 ' + (drift / U).toFixed(2) + ' 块)'
      + (firstBad >= 0 ? ' · 两个同样的 World 回放同一卷在第 ' + firstBad + ' 帧就分岔(说明 World 本身不确定!)' : '')
      + ' —— 输入卷拼错了,不写文件');
    return;
  }
  /* ★ 进度(可以走得更远)和卷子(要留最好的那条)是两件事,得分开写:
     · maxX —— 这一局活着走到的最远 x,只要更远就记下来,【不受卷子好坏影响】;
     · tape —— 只在分数变好时才换(分数含"朝门口对齐"的扣分,是"走在正路上"的度量)。
     踩过的坑:以前只有一个"x 不许变小"的闸门,于是一次"走到 523.6 但最佳卷子在 488.0"的尝试
     被上一局的 488.3 挡掉 —— 进度明明推进了 11 块,文件里却什么都没记,分站搜据此判"没过"。 */
  const prev: { tape?: boolean[]; x?: number; maxX?: number; score?: number } | null =
    fs.existsSync(BESTTAPE) ? JSON.parse(fs.readFileSync(BESTTAPE, 'utf8')) : null;
  const newX = bestNode.snap.x / U;
  const newMax = Math.max(maxAliveX, bestNode.snap.x) / U;
  /* ★ 另外把【活着走到最远】那条路也单独存一份(<best>.max.json):
     它未必"走在正路上"(所以不当主种子),但它是真正的搜索前沿 ——
     主种子常常落后它几十块(实测卷子 488.3、进度 525.8),
     分站搜要重开前沿时,从"前沿再往回退"比从"主种子再往回退"有用得多。 */
  if (maxNode && maxAliveX / U >= newMax - 1e-6) {
    const mt = tapeOf(maxNode);
    const chk = new World(lv);
    for (const h of mt) { if (chk.dead || chk.done) break; chk.frame(h); }
    if (Math.abs(chk.x - maxNode.snap.x) <= 1) {
      fs.writeFileSync(BESTTAPE.replace(/\.json$/, '') + '.max.json',
        JSON.stringify({ level: lv.name, tape: mt, x: maxNode.snap.x / U, maxX: newMax }));
    }
  }
  if (prev && typeof prev.score === 'number' && bestScore < prev.score - 1e-6) {
    if (newMax > (prev.maxX ?? 0)) { prev.maxX = newMax; fs.writeFileSync(BESTTAPE, JSON.stringify(prev)); }
    return;
  }
  fs.writeFileSync(BESTTAPE, JSON.stringify({
    level: lv.name, tape, x: newX, score: bestScore,
    maxX: Math.max(newMax, prev?.maxX ?? 0),
  }));
}

while (nodes < MAXNODES) {
  const el = (performance.now() - t0) / 1000;
  if (el > BUDGET) break;
  /* --goal=块 —— 分站搜:到了这一站就收工(外面套一层循环,一站一站往终点推)。
     为什么要分站:整关一次性搜时,每到一个门就是一个"卡口"(实测 x=421 / 512 各卡住几万节点),
     而把根挪到卡口前面单独搜,几十秒就过去了 —— 分站等于自动做这件事。 */
  if (maxAliveX >= GOAL) { goalHit = true; break; }
  const node = popHeap();
  if (!node) {
    /* ★ 前沿枯了,两级退路:
       ① 先把种子链上扣着的老节点放一个进去当"退回岔路口";
       ② 老节点也用完了,就【局部回退】—— 把当前最好那卷的尾巴剪掉几帧重放一遍再搜。
       ② 是这一轮补上的关键一环:种子链是按 HORIZON(90 帧≈29 块)切段的,
       所以"退一步"一次就退 29 块 —— 而弹板链那种段落里,错的是【最后十几帧】
       (实测站 #72:在 721.2 落台后正好贴着 722 那块平台的左脸,再往前一帧就撞死;
        要重新规划的不是"29 块之前",而是"弹簧触发前那一下按不按"),
       退 29 块等于把整段重摸一遍,退 8~32 帧才是对的粒度。
       档位逐级加大(8/16/32/64/128/256/512 帧),每档只花一次回放的钱。 */
    if (seedBack.length) { pushHeap(seedBack.pop()!); continue; }
    if (rewinds < REWIND.length && (maxNode ?? bestNode)) {
      const from = maxNode ?? bestNode!;
      const full = tapeOf(from);
      const cut = REWIND[rewinds];
      if (full.length > cut + 60) {
        rewinds++;
        const kept = full.slice(0, full.length - cut);
        console.log('局部回退:前沿枯了 → 剪掉最后 ' + cut + ' 帧(第 ' + rewinds + ' 档),从 '
          + (kept.length) + ' 帧重放接着搜');
        replayInto(kept, '回退重放');
        if (heap.length) continue;
      }
    }
    break;
  }
  node.gen = nodes++;

  /* 展开:每个候选先自己走 STEP 帧(便宜),活下来的才花算力试算 */
  const kids: Array<{ inputs: boolean[]; snap: WorldSnap; score: number }> = [];
  /** ★ 宏落子之外,还要留一个【只走 STEP 帧】的精细子节点 —— 见下面那段说明。 */
  let bestFine: { inputs: boolean[]; snap: WorldSnap; score: number } | null = null;
  let solved = false;
  for (const c of CANDS) {
    w.restore(node.snap);
    const out = walkEdge(c);
    if (out.done) {                                // 试算走到终点 = 通关
      const tape = tapeOf(node);
      for (let i = 0; i < STEP; i++) tape.push(bit(c.pat, i));
      for (const h of out.tap) tape.push(h);
      solution = tape;
      solved = true;
      break;
    }
    if (!out.snap) continue;                       // 边内就死:这个候选作废
    const fine: boolean[] = [];
    for (let i = 0; i < STEP; i++) fine.push(bit(c.pat, i));
    /* 宏落子优先(它一次顶 30 次精细落子),没有宏就退成精细落子。
       ★★ 但【两个都要留】—— 这一条是这一轮最关键的搜索修正:
       以前有宏就【只】留宏(一次跳 60~90 帧 ≈ 20~29 块),于是宏内部那几十帧从来没有被精细展开过。
       在"时机定生死"的段落里这是致命的:实测 x=718 那个天花板蓝板,
       卷子在 718.6 那一帧的 y=24.03、盒子顶 24.03+1=25.03 > 板的 24.8 → 板开火 → 打下去撞死;
       而正确答案只需要【在 718 之前早 1~3 帧起跳】、让那一帧低 0.2 块(23.8 就刚好不碰板)。
       这种 1~3 帧的差别,宏一旦落子就再也调不了了 —— 所以宏的每一个候选,
       都额外留一个"只走 STEP 帧、不提交宏"的兄弟节点,分给成和宏一样高(差 1 单位),
       于是它紧跟宏节点之后被展开,搜索就获得了"在宏内部改主意"的能力。
       代价:节点数大约翻倍(实测 45 秒里 6000 → 1.1 万节点),换来的是时机可调。 */
    if (out.endSnap) {
      kids.push({ inputs: fine.concat(out.tap), snap: out.endSnap, score: out.score });
      macros++;
      if (!bestFine || out.score > bestFine.score) {
        bestFine = { inputs: fine, snap: out.snap, score: out.score - 1 };
      }
    } else {
      kids.push({ inputs: fine, snap: out.snap, score: out.score });
    }
  }
  if (solved) break;
  if (!kids.length) {                              // 死胡同 → 回溯到堆里下一个分支
    if (TRACE && nodes <= TRACE) {                 // 调搜索用:把每个候选为什么没留下打出来
      const why: string[] = [];
      for (const c of CANDS) {
        w.restore(node.snap);
        const o = walkEdge(c);
        why.push('pat' + c.pat + '/' + c.mode + '→'
          + (o.done ? '通关' : o.snap ? (o.endSnap ? '宏' : '细')
            : (o.why === 'edge' ? 'X边内' : o.why === 'roof' ? 'B过顶' : 'K跳门')));
      }
      console.log('  #' + nodes + ' 无子节点 x=' + (node.snap.x / U).toFixed(2) + ' y=' + (node.snap.y / U).toFixed(2) + ' g=' + node.snap.gdir + (node.snap.onGround ? '地' : '空')
        + ' 天花板=' + (roofAt ? roofAt(node.snap.x).toFixed(1) : '-') + ' · ' + why.join(' '));
    }
    deadEnds++;
    const bx = Math.floor(node.snap.x / U / 10) * 10;
    stuckAt.set(bx, (stuckAt.get(bx) ?? 0) + 1);
    continue;
  }

  kids.sort((a, b) => b.score - a.score);
  let pushed = 0, kidDup = 0;
  if (TRACE && nodes <= TRACE) {
    console.log('  #' + nodes + ' 展开 x=' + (node.snap.x / U).toFixed(2) + ' y=' + (node.snap.y / U).toFixed(2)
      + ' ' + node.snap.mode + ' 分=' + (node.score / U).toFixed(1) + ' · 候选活 ' + kids.length
      + ' · 边内死 ' + (CANDS.length - kids.length));
  }
  for (const k of kids) {
    if (pushed >= BEAM) break;
    const key = stateKey(k.snap);
    if (seen.has(key)) { dups++; kidDup++; continue; }
    seen.add(key);
    const n: Node = { snap: k.snap, parent: node, inputs: k.inputs, score: k.score, gen: nodes };
    pushHeap(n);
    pushed++;
    if (k.score > frontierBest) frontierBest = k.score;
    /* ★ 两个"最远"要分开记:
       · maxAliveX —— 【活着走到的最远 x】,只用来报进度 / 判"这一站到没到";
       · bestNode  —— 按【分数】选出来、要写进种子文件的那条路。
       为什么必须分开:分数里含"朝门口对齐"的扣分,所以一条"走到 x=490 但偏离门口 3.5 块"的路,
       分数可能低于"走到 485 但正好对着门口"的路。要是拿分数最高的那条的 x 当进度,
       就会误判"这一站没过"(实测卡在站 14:实际已经过了 x=490,却一直报 485.2)。 */
    if (k.snap.x > maxAliveX) { maxAliveX = k.snap.x; maxNode = n; }
    /* ★ 同分时取更远的那个:分数在一整段路上是【平台期】(朝门口对齐的扣分不变),
       只认 `>` 的话最佳节点会永远停在平台期的第一个节点上 ——
       实测"从 x=481 起搜"明明走到了 484.8,报出来却是 481.4,写进种子的也是 481.4。 */
    if (k.score > bestScore + 1e-6
      || (Math.abs(k.score - bestScore) <= 1e-6 && k.snap.x > bestAlive)) {
      bestScore = k.score; bestAlive = k.snap.x; bestNode = n;
    }
  }
  /* ★ 那个"只走 STEP 帧"的精细兄弟节点:哪怕束宽把宏节点都塞满了,它也要进前沿 ——
     它就是"宏内部还能改主意"的唯一入口(见 walkEdge 后面那段说明)。 */
  if (bestFine && !solved) {
    const key = stateKey(bestFine.snap);
    if (!seen.has(key)) {
      seen.add(key);
      const fn: Node = { snap: bestFine.snap, parent: node, inputs: bestFine.inputs, score: bestFine.score, gen: nodes };
      pushHeap(fn);
      fineKept++;
      if (fn.snap.x > maxAliveX) { maxAliveX = fn.snap.x; maxNode = fn; }
    }
  }
  if (!pushed) deadEnds++;
  pruneHeap();
  focusFrontier();
  if (performance.now() - t0 > nextPhase) { nextPhase += PHASE; restartFromBest(); }
  /* ★ 局部回退(主动版):前沿没枯、但【已经很久没有推进】时也要退。
     踩过的坑:弹板走廊那段(站 #72,x=721 的台子)里,前沿一直有节点可展开(老岔路 + 回退链),
     于是"前沿枯了才回退"这条永远不触发 —— 50 秒 6922 个节点全在原地打转,
     而死胡同直方图明明白白写着 700→359 / 710→188。
     正确的粒度是【最后十几帧】:玩家在 721.2 落台时贴上了 722 平台的左脸,
     要重规划的是"蓝板触发前那一下按不按",不是"29 块之前怎么走"。
     所以:连续 REWIND_AFTER 次展开没有刷新最远记录 → 主动剪尾巴重放一档。 */
  if (maxAliveX > lastProgressX + 1e-6) { lastProgressX = maxAliveX; sinceProgress = 0; }
  else if (++sinceProgress > REWIND_AFTER && rewinds < REWIND.length && (maxNode ?? bestNode)) {
    const from = maxNode ?? bestNode!;
    const full = tapeOf(from);
    const cut = REWIND[rewinds];
    if (full.length > cut + 60) {
      rewinds++;
      sinceProgress = 0;
      console.log('[' + el.toFixed(0) + 's] 局部回退(第 ' + rewinds + ' 档):最远 ' + (maxAliveX / U).toFixed(1)
        + ' 块卡住 ' + REWIND_AFTER + ' 次展开 → 剪掉最后 ' + cut + ' 帧重放接着搜');
      replayInto(full.slice(0, full.length - cut), '回退重放');
      continue;
    }
  }

  if (!QUIET && LOGSTEP > 0 && el - lastLog >= LOGSTEP) {
    lastLog = el;
    console.log('[' + el.toFixed(0) + 's] 展开 ' + nodes + ' · 堆 ' + heap.length + ' · 死胡同 ' + deadEnds
      + ' · 宏 ' + macros + ' · 重复 ' + dups + ' · 聚焦丢 ' + focused + ' · 重启 ' + restarts
      + ' · 最远(活) ' + (maxAliveX / U).toFixed(1) + '(存 ' + (bestAlive / U).toFixed(1) + ')'
      + '/' + lv.length + ' 块 = ' + (bestAlive / endX * 100).toFixed(1) + '%');
    saveBest();
  }
}

/* ---------------- 收尾 ---------------- */
const el = (performance.now() - t0) / 1000;
console.log('\n=== 搜索结束 ===');
console.log('铺面 ' + lv.name + ' · ' + lv.objects.length + ' 物件 · 长 ' + lv.length + ' 块 · 高 ' + lv.rows + ' 格');
console.log('展开 ' + nodes + ' 节点 · 死胡同 ' + deadEnds + ' · 宏落子 ' + macros + ' · 重复剪枝 ' + dups
  + ' · 堆剩 ' + heap.length + ' · 用时 ' + el.toFixed(1) + 's · ' + (nodes / Math.max(el, 1e-9)).toFixed(1) + ' 节点/秒');
console.log('最远(活着走到) ' + (maxAliveX / U).toFixed(1) + ' 块 = ' + (maxAliveX / endX * 100).toFixed(1)
  + '% · 存下的前缀到 ' + (bestAlive / U).toFixed(1) + ' 块');
if (goalHit) console.log('★ 到站:--goal=' + (GOAL / U).toFixed(1) + ' 块(前缀已写进 best 文件,可以接着下一站)');
if (stuckAt.size) {
  const top = [...stuckAt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('死胡同最密的地方(块 → 次数):' + top.map(([x, n]) => x + '→' + n).join(' · '));
}

if (solution) {
  const f = replay(lv, solution);
  const endXs = f.states[f.states.length - 1].x;
  console.log('\n★ 通关!输入卷 ' + solution.length + ' 帧 = ' + (solution.length / 60).toFixed(1) + ' 秒');
  console.log('回放校验:死亡 ' + f.deaths + ' 次 · done=' + f.done + ' · 终点 x=' + (endXs / U).toFixed(1)
    + ' 块 · 指纹 ' + fingerprint(f.states));
  fs.mkdirSync(path.dirname(TAPE), { recursive: true });
  fs.writeFileSync(TAPE, JSON.stringify({ level: lv.name, tape: solution, done: f.done, deaths: f.deaths }));
  console.log('输入卷写到 ' + TAPE);
} else {
  saveBest();
  console.log('没通关 —— 已把【活着走到的最远前缀】写到 ' + BESTTAPE + '(下次 --seed 接着搜)');
}
