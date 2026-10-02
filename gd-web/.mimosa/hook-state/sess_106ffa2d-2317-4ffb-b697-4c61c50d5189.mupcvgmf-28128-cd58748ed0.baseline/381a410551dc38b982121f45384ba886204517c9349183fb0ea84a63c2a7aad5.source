/* 黑环 dash 参数扫描(只读诊断,不改游戏代码)
   跑法: cd gd-web && node tools/probe-dash-sweep.ts [relMax] [debug]
        relMax 默认 20(按住帧数上限);debug = 只跑一条并逐帧打印
   说明:
     · dash 方向/横向速度通过【诊断开关】逐帧覆盖 —— globalThis.__dashOverride = { ang, vxAbs }
       (见 src/sim/world.ts:1211-1221;未设置时玩法逐字段不变 ✓)
       ⚠ ang 的符号:该处算式是 sinA = −sin(ang) ⇒ 【正角 = 下斜】;但注释写的是"负=下斜" ✗
         ⇒ 两个符号都扫,别信注释 ✓
     · 按键策略 = 真人式:靠近环就按下,按下后【持续按住 rel 帧】再松手(不走"离开窗口就自动松手" ✗)
   单位: w.x/w.y 世界单位;w.vy/w.vx 单位/帧;1 格 = 30 单位 */
import { U } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const { WATER_CHART } = await import('../src/sim/charts/water.ts');

const REL_MAX = Number(process.argv[2] ?? 20);
const DEBUG = process.argv.includes('debug');

const ENTRY_X = 665.0, ENTRY_Y = 21.0, ENTRY_VY = 5.0;      // 真实入口(三连黄环之前)
const SAW_X = 678.5;                                        // 上方锯片所在 x
const BLUE_Y = 17.5, BOX_L = 680.9, BOX_R = 682.1;          // 蓝环 84 (681.5,17.5) 判定盒

const orbs = WATER_CHART.objects.filter((o) => o.kind === 'orb');
const nearOrb = (w: World) => orbs.some((o) =>
  Math.abs((o.b + o.w / 2) - w.x / U) < 1.1 && Math.abs((o.r + o.h / 2) - w.y / U) < 1.3);

/* ★ 成功判据 = 【下面那枚蓝环被吃到】,不是"y 掉到 17.5 以下" ✗
   (调试跑里蓝环是在 (682.92, 18.39) 被吃到的 —— 玩家中心进入它 1.2 格的盒子即可 ✓) */
const blueOrb = orbs
  .filter((o) => o.orb === 'blue')
  .sort((a, b) => Math.abs((a.b + a.w / 2) - 681.5) - Math.abs((b.b + b.w / 2) - 681.5))[0];
const BCX = blueOrb.b + blueOrb.w / 2, BCY = blueOrb.r + blueOrb.h / 2;
const inBlue = (w: World) => Math.abs(w.x / U - BCX) <= 0.6 && Math.abs(w.y / U - BCY) <= 0.6;

function fresh(): World {
  /* 静音:每建一个 World 都会打一遍 [gd] 触摸标记 48 个… ⇒ 上千次扫描会把输出淹掉 ✗ */
  const log = console.log;
  console.log = () => {};
  const w = new World(WATER_CHART);
  console.log = log;
  w.mode = 'cube'; w.speedIdx = 4; w.gdir = 1; w.dead = false; w.god = false;
  w.x = ENTRY_X * U; w.y = ENTRY_Y * U; w.vy = ENTRY_VY; w.onGround = false;
  (w as { checkX?: number }).checkX = w.x;
  return w;
}

type Row = {
  ang: number; vxAbs: number; rel: number;
  dashF: number; dashLen: number; ySaw: number | null;
  xBlue: number | null; hit: boolean; alive: boolean; deadX: number | null;
};

/** 一条:给定位姿起跑,靠近环按下并按住 rel 帧 */
function run(ang: number, vxAbs: number, rel: number): Row {
  const w = fresh();
  const row: Row = { ang, vxAbs, rel, dashF: 0, dashLen: 0, ySaw: null, xBlue: null, hit: false, alive: false, deadX: null };
  (globalThis as { __dashOverride?: { ang?: number; vxAbs?: number } }).__dashOverride = { ang, vxAbs };
  let dashF = 0, held = 0, dashStartX: number | null = null, sawDone = false, blueDone = false;

  for (let f = 0; f < 400; f++) {
    const inDash = !!(w as { dash?: unknown }).dash;
    if (inDash && dashStartX == null) dashStartX = w.x;
    /* 真人式:靠近环就按下;按下之后按 rel 帧数保持 */
    let hold = nearOrb(w);
    if (inDash) { dashF++; held++; hold = held <= rel; }
    w.frame(hold);

    if (!sawDone && w.x / U >= SAW_X) { row.ySaw = +(w.y / U).toFixed(2); sawDone = true; }
    /* 蓝环被吃到 ⇒ 记下当帧状态;此后死不死不算这条路成败(后面还有别的危险物)✓ */
    if (!blueDone && inBlue(w)) {
      row.xBlue = +(w.x / U).toFixed(2);
      row.hit = !w.dead;
      blueDone = true;
      row.alive = !w.dead;
      break;
    }
    if (w.dead) { row.deadX = +(w.x / U).toFixed(2); break; }
    if (w.x / U > 700) break;
  }
  delete (globalThis as { __dashOverride?: unknown }).__dashOverride;
  row.dashF = dashF;
  if (dashStartX != null) row.dashLen = +((w.x - dashStartX) / U).toFixed(2);
  row.alive = !w.dead;
  return row;
}

if (DEBUG) {
  const ang = Number(process.argv[3] ?? 55.7), vxAbs = Number(process.argv[4] ?? 9.6), rel = Number(process.argv[5] ?? 8);
  console.log(`debug: ang=${ang} vxAbs=${vxAbs} rel=${rel}`);
  const w = fresh();
  (globalThis as { __dashOverride?: unknown }).__dashOverride = { ang, vxAbs };
  let held = 0, dashF = 0;
  for (let f = 0; f < 120; f++) {
    const inDash = !!(w as { dash?: unknown }).dash;
    let hold = nearOrb(w);
    if (inDash) { dashF++; held++; hold = held <= rel; }
    w.frame(hold);
    console.log(`f=${String(f).padStart(3)} x=${(w.x / U).toFixed(2)} y=${(w.y / U).toFixed(2)} vy=${w.vy.toFixed(2)} vx=${w.vx.toFixed(2)} g=${w.gdir} hold=${hold ? 1 : 0} dash=${inDash ? 'Y' : '-'} dead=${w.dead}`);
    if (w.dead) break;
  }
  process.exit(0);
}

/* 方向:两个符号都扫(该处算式 sinA = −sin(ang) ⇒ 正角才是下斜,注释反了 ✗) */
const mags = [0, 40, 45, 50, 52.5, 55, 55.7, 57.5, 60];
const angs = [...new Set(mags.flatMap((m) => (m === 0 ? [0] : [m, -m])))];
const vxList = [9.6, 5.77, 7.8];
const rows: Row[] = [];
for (const ang of angs) for (const vxAbs of vxList) for (let rel = 0; rel <= REL_MAX; rel++) rows.push(run(ang, vxAbs, rel));

console.log(`入口 x=${ENTRY_X} y=${ENTRY_Y} vy=${ENTRY_VY} · speed=4 · 方向 ${angs.length} 档 × 横向速度 ${vxList.length} 档 × 按住 0~${REL_MAX} 帧 = ${rows.length} 组\n`);

const live = rows.filter((r) => r.alive && r.hit);
console.log(`★ 落进蓝环判定盒(${BOX_L}~${BOX_R})且活着:${live.length} 组`);
for (const r of live) {
  console.log(`   ang=${String(r.ang).padStart(6)}° vx=${r.vxAbs} 按住=${String(r.rel).padStart(2)} 帧 · dash=${r.dashF} 帧 / ${r.dashLen} 格 · 过 x678.5 时 y=${r.ySaw} · 落点 x=${r.xBlue}`);
}

/* 参考图那一档:方向 ≈55.7°(取正负两种)、冲刺段 ≈8.4 格、之后下落补 ~2.3 格 */
console.log('\n—— 最接近参考图(冲刺段 8.4 格、方向 55.7°)的若干组 ——');
const ref = rows.filter((r) => Math.abs(Math.abs(r.ang) - 55.7) < 0.01 && r.dashLen > 0)
  .sort((a, b) => Math.abs(a.dashLen - 8.4) - Math.abs(b.dashLen - 8.4)).slice(0, 6);
for (const r of ref) {
  console.log(`   ang=${r.ang}° vx=${r.vxAbs} 按住=${r.rel} · dash=${r.dashLen} 格 · 过 x678.5 时 y=${r.ySaw} · 落点 x=${r.xBlue} · 活=${r.alive} ${r.hit ? '★盒内' : ''} ${r.deadX != null ? '死@' + r.deadX : ''}`);
}

console.log('\n—— 每档方向的最好结果(横向速度 9.6,当前速) ——');
for (const ang of angs) {
  const sub = rows.filter((r) => r.ang === ang && r.vxAbs === 9.6);
  const alive = sub.filter((r) => r.alive).length;
  const ys = sub.map((r) => r.ySaw).filter((v): v is number => v != null);
  const best = sub.filter((r) => r.xBlue != null).sort((a, b) => Math.abs((a.xBlue ?? 0) - 681.5) - Math.abs((b.xBlue ?? 0) - 681.5))[0];
  console.log(`   ang=${String(ang).padStart(6)}° 活 ${String(alive).padStart(2)}/${sub.length}` +
    ` · 过 x678.5 时 y∈[${ys.length ? Math.min(...ys) : '-'},${ys.length ? Math.max(...ys) : '-'}]` +
    (best ? ` · 最接近蓝环的落点 x=${best.xBlue}(按住 ${best.rel}) 差 ${Math.abs((best.xBlue ?? 0) - 681.5).toFixed(2)} 格${best.hit ? ' ★盒内' : ''}` : ' · 无落点'));
}

/* 最接近"能过"的一组(落点离蓝环中心最近且活着) */
const nearMiss = rows.filter((r) => r.alive && r.xBlue != null)
  .sort((a, b) => Math.abs((a.xBlue ?? 0) - 681.5) - Math.abs((b.xBlue ?? 0) - 681.5))[0];
console.log('\n最接近成功的一组(活着且有落点):' + (nearMiss
  ? ` ang=${nearMiss.ang}° vx=${nearMiss.vxAbs} 按住=${nearMiss.rel} · 落点 x=${nearMiss.xBlue}(差 ${Math.abs((nearMiss.xBlue ?? 0) - 681.5).toFixed(2)} 格) · 过 x678.5 时 y=${nearMiss.ySaw} · dash=${nearMiss.dashLen} 格`
  : ' 无(所有组合都没活到落点 ✗)'));
