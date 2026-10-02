/* 黄环按压高度扫描(只读诊断,不改游戏代码)
   跑法: cd gd-web && node tools/probe-orb-height.ts
   目的(接上一轮的发现):我们过黑环的方式是【从下方、上升中】(顶点 26.88 < 环 y=27.5),
     而原版是【从上方掠过再往下】⇒ 怀疑我们【在窗口最下沿就按】,把环的发射点压低了,
     导致整条链顶点低 1~2.5 格 ✗ —— 这个探针就量这一件事。
   做法:
     A 相位:扫【按压相对高度 targetDy(格,正=在环心上方按)】× 【入口 vy】,
             用 god=true 只量几何:每环触发帧/触发时 y/vy、链顶点、到黑环 x 时的 (y, vy)
     B 相位:取"顶点 > 27.5 且从上方(vy<0)触黑环"的配置,god=false,
             用【现行水平 dash】(不加任何 override)、按住帧数扫一遍,量:
             是否越过上方锯片(玩家盒底 > 27.75)、死在哪个 x、有没有吃到蓝环 ✓
   单位: w.x/w.y 世界单位(脚底);w.vy/w.vx 单位/帧;1 格 = 30 单位 */
import { U } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const { WATER_CHART } = await import('../src/sim/charts/water.ts');

const ENTRY_X = 665.0, ENTRY_Y = 21.0;
const BLACK_X = 674.5, BLACK_Y = 27.5;          // 黑环 1330 中心
const SAW_X = 678.5, SAW_Y = 26.5, SAW_R = 1.249;
const BLUE_X = 681.5, BLUE_Y = 17.5, BOX_L = 680.9, BOX_R = 682.1;

const orbs = WATER_CHART.objects.filter((o) => o.kind === 'orb');
type O = { cx: number; cy: number; kind: string };
const LIST: O[] = orbs.map((o) => ({ cx: o.b + o.w / 2, cy: o.r + o.h / 2, kind: o.orb ?? '?' }));
const YELLOWS = LIST.filter((o) => o.kind === 'yellow' && o.cx > 660 && o.cx < 674).sort((a, b) => a.cx - b.cx);
const BLACK = LIST.filter((o) => o.kind === 'black').sort((a, b) => Math.abs(a.cx - BLACK_X) - Math.abs(b.cx - BLACK_X))[0];

function fresh(entryVy: number, god: boolean): World {
  const log = console.log; console.log = () => {};
  const w = new World(WATER_CHART);
  console.log = log;
  w.mode = 'cube'; w.speedIdx = 4; w.gdir = 1; w.dead = false; w.god = god;
  w.x = ENTRY_X * U; w.y = ENTRY_Y * U; w.vy = entryVy; w.onGround = false;
  (w as { checkX?: number }).checkX = w.x;
  return w;
}
/* 玩家中心(世界单位):x 用 w.x 近似(玩家盒宽 1 格,中心 = w.x + 15);y 中心 = w.y + 15 */
const pcx = (w: World) => w.x / U + 0.5;
const pcy = (w: World) => (w.y + 15) / U;

type Rec = {
  entryVy: number; dy: number;
  trig: Array<{ cx: number; f: number; y: number; vy: number }>;
  apex: number; apexX: number;
  atBlack: { y: number; vy: number } | null;   // 到黑环 x 时(脚底 y、vy)
  dead: number | null;
};
type Out = { rows: Rec[]; best: Rec | null };

/* ── A:按压高度扫描(god=true,只看几何) ── */
function sweep(): Out {
  const rows: Rec[] = [];
  for (const entryVy of [5, 7, 9, 11]) {
    for (const dy of [-0.8, -0.4, 0, 0.4, 0.8]) {
      const w = fresh(entryVy, true);
      const rec: Rec = { entryVy, dy, trig: [], apex: -1e9, apexX: 0, atBlack: null, dead: null };
      const done = new Set<number>();
      let touchedBlack: number | null = null;
      for (let f = 0; f < 200 && !w.dead; f++) {
        const cx = pcx(w), cy = pcy(w);
        const cyc = cy - 0.5 + 0.5;                       // 保持可读:玩家中心(格)
        let hold = false;
        /* 黄环:窗口内且【已升到 targetDy 以上】才按(正 = 环心上方) */
        for (const o of YELLOWS) {
          if (done.has(o.cx)) continue;
          const dx = cx - o.cx, dyy = cyc - o.cy;
          if (Math.abs(dx) <= 1.1 && Math.abs(dyy) <= 1.1 && dyy >= dy) {
            hold = true; done.add(o.cx);
            rec.trig.push({ cx: o.cx, f, y: cyc, vy: w.vy });
            break;
          }
        }
        /* 黑环:碰到就按一次(不按住 —— A 相位只要触发) */
        if (!hold && BLACK) {
          const dx = cx - BLACK.cx, dyy = cyc - BLACK.cy;
          if (Math.abs(dx) <= 1.1 && Math.abs(dyy) <= 1.1 && touchedBlack === null) {
            hold = true; touchedBlack = f;
            rec.trig.push({ cx: BLACK.cx, f, y: cyc, vy: w.vy });
          }
        }
        w.frame(hold);
        const cyNow = pcy(w);
        if (cyNow > rec.apex) { rec.apex = cyNow; rec.apexX = pcx(w); }
        if (!rec.atBlack && pcx(w) >= BLACK_X) rec.atBlack = { y: w.y / U, vy: w.vy };
      }
      if (w.dead) rec.dead = w.x / U;
      rows.push(rec);
    }
  }
  /* 选"顶点 > 27.5 且从上方触黑环(vy<0)且三环都吃到"的最好一条 */
  const ok = rows.filter((r) => r.apex > 27.5 && r.trig.length >= 4 && r.atBlack && r.atBlack.vy < 0);
  ok.sort((a, b) => b.apex - a.apex);
  return { rows, best: ok[0] ?? null };
}

/* ── B:用现行水平 dash 从最好入口跑,扫按住帧数(god=false,真死亡) ── */
type BRow = { entryVy: number; dy: number; hold: number; dashF: number; yAtSaw: number | null; minBottom: number | null; blue: boolean; deadX: number | null; sawKill: boolean };
function runB(entryVy: number, dy: number, holdFrames: number): BRow {
  const w = fresh(entryVy, false);
  const done = new Set<number>();
  const row: BRow = { entryVy, dy, hold: holdFrames, dashF: 0, yAtSaw: null, minBottom: null, blue: false, deadX: null, sawKill: false };
  let blackF: number | null = null, held = 0;
  for (let f = 0; f < 300; f++) {
    const cx = pcx(w), cyc = pcy(w);
    let hold = false;
    if (blackF === null) {
      for (const o of YELLOWS) {
        if (done.has(o.cx)) continue;
        const dx = cx - o.cx, dyy = cyc - o.cy;
        if (Math.abs(dx) <= 1.1 && Math.abs(dyy) <= 1.1 && dyy >= dy) { hold = true; done.add(o.cx); break; }
      }
      if (!hold && BLACK && Math.abs(cx - BLACK.cx) <= 1.1 && Math.abs(cyc - BLACK.cy) <= 1.1) {
        hold = true; blackF = f; row.dashF = f; held = 0;
      }
    } else if (held < holdFrames) { hold = true; held++; }
    w.frame(hold);
    const bottom = w.y / U;                       // 脚底(格)
    if (bottom > SAW_Y - 2 && bottom < SAW_Y + 4 && Math.abs(pcx(w) - SAW_X) < 2) {
      if (row.minBottom === null || bottom < row.minBottom) row.minBottom = bottom;
      if (row.yAtSaw === null && Math.abs(pcx(w) - SAW_X) < 0.6) row.yAtSaw = bottom;
    }
    if (Math.abs(pcx(w) - BLUE_X) <= 0.6 && Math.abs(pcy(w) - BLUE_Y) <= 0.6) row.blue = true;
    if (w.dead) {
      row.deadX = w.x / U;
      /* 死因:玩家盒与上方锯片圆是否相交(盒宽 1 格 ⇒ 用盒最近点判) */
      const bx0 = w.x / U, bx1 = bx0 + 1, by0 = w.y / U, by1 = by0 + 1;
      const nx = Math.max(bx0, Math.min(SAW_X, bx1)), ny = Math.max(by0, Math.min(SAW_Y, by1));
      row.sawKill = Math.hypot(nx - SAW_X, ny - SAW_Y) < SAW_R;
      break;
    }
  }
  return row;
}

const n = (v: number | null, d = 2) => (v === null ? '-' : v.toFixed(d));
const A = sweep();
console.log('=== A 相位:按压高度 × 入口 vy(god=true,只看几何)===');
console.log('entryVy  dy    触发数  每环触发(帧/中心y/vy)                          顶点(y@x)         到黑环x时(脚底y, vy)');
for (const r of A.rows) {
  const t = r.trig.map((x) => `${x.f}/${x.y.toFixed(2)}/${x.vy.toFixed(1)}`).join(' ');
  console.log(
    String(r.entryVy).padStart(6) + '  ' + String(r.dy).padStart(4) + '  ' + String(r.trig.length).padStart(4) + '   ' +
    t.padEnd(52) + '  ' + (r.apex.toFixed(2) + '@' + r.apexX.toFixed(1)).padEnd(16) + '  ' +
    (r.atBlack ? n(r.atBlack.y) + ', ' + n(r.atBlack.vy) : '-') + (r.dead !== null ? '   死@' + n(r.dead) : ''));
}
console.log('\n最好的一条(顶点>27.5 且从上方触黑环 且 4 环全吃):' + (A.best ? `entryVy=${A.best.entryVy} dy=${A.best.dy} 顶点=${A.best.apex.toFixed(2)} 到黑环时 vy=${n(A.best.atBlack?.vy)}` : '【没有】'));

if (A.best) {
  console.log('\n=== B 相位:现行水平 dash(无 override)+ 按住帧数扫描(god=false,真死亡)===');
  console.log('hold  到锯片x时(脚底y)  最低脚底  吃到蓝环  死在x    死因=上方锯片');
  for (let h = 0; h <= 14; h++) {
    const r = runB(A.best.entryVy, A.best.dy, h);
    console.log(String(h).padStart(4) + '  ' + n(r.yAtSaw).padStart(17) + '  ' + n(r.minBottom).padStart(8) + '  ' +
      String(r.blue).padStart(8) + '  ' + n(r.deadX).padStart(7) + '  ' + String(r.sawKill).padStart(14));
  }
} else {
  console.log('\n⇒ A 相位没有任何配置能达到"顶点>27.5 且从上方触黑环" ⇒ 说明低的不是按压高度');
  const bestApex = A.rows.slice().sort((a, b) => b.apex - a.apex)[0];
  console.log('   全场最高顶点 = ' + bestApex.apex.toFixed(2) + '(entryVy=' + bestApex.entryVy + ', dy=' + bestApex.dy + ', 环数=' + bestApex.trig.length + ')');
}
