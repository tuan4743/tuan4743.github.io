/* 黑环"从上方掠过"验证(只读诊断,不改游戏代码)
   跑法: cd gd-web && node tools/probe-orb-above.ts
   目的(接 probe-orb-height 的发现):
     我们的链顶点 ≈27.2~27.3,而黑环中心 27.5、窗口 ±1.1 ⇒ 我们【上升中一进窗口就按】,
     黑环 dash 会把 vy 清零 ⇒ 上升被砍断,顶点就卡在 27.2~27.3 ✗
     原版是【从上方掠过再往下】⇒ 应该是【下落中(vy<0)才按】,那时人已经在窗口上部(≈28.3)✓
   本探针扫【黑环按压时机:早按 / 只在下落时按 / 不按】×【按住帧数】,
     量:dash 起点 y、在锯片区(x 674~684)玩家盒【最低底边】、是否吃到蓝环、死在哪个 x ✓
   判据:玩家盒底 > 27.75(上方锯片圆带上沿)才算【从上方越过】✓ */
import { U } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';

const { WATER_CHART } = await import('../src/sim/charts/water.ts');

const ENTRY_X = 665.0, ENTRY_Y = 21.0;
const BLACK_X = 674.5, BLACK_Y = 27.5;
const SAW_X = 678.5, SAW_Y = 26.5, SAW_R = 1.249, SAW_TOP = SAW_Y + SAW_R;   // 27.749
const BLUE_X = 681.5, BLUE_Y = 17.5;

const orbs = WATER_CHART.objects.filter((o) => o.kind === 'orb');
type O = { cx: number; cy: number; kind: string };
const LIST: O[] = orbs.map((o) => ({ cx: o.b + o.w / 2, cy: o.r + o.h / 2, kind: o.orb ?? '?' }));
const YELLOWS = LIST.filter((o) => o.kind === 'yellow' && o.cx > 660 && o.cx < 674).sort((a, b) => a.cx - b.cx);
const BLACK = LIST.filter((o) => o.kind === 'black').sort((a, b) => Math.abs(a.cx - BLACK_X) - Math.abs(b.cx - BLACK_X))[0];

const pcx = (w: World) => w.x / U + 0.5;
const pcy = (w: World) => (w.y + 15) / U;

function fresh(entryVy: number): World {
  const log = console.log; console.log = () => {};
  const w = new World(WATER_CHART);
  console.log = log;
  w.mode = 'cube'; w.speedIdx = 4; w.gdir = 1; w.dead = false; w.god = false;
  w.x = ENTRY_X * U; w.y = ENTRY_Y * U; w.vy = entryVy; w.onGround = false;
  (w as { checkX?: number }).checkX = w.x;
  return w;
}

type Mode = 'early' | 'desc' | 'none';
type Row = { mode: Mode; hold: number; trigY: number | null; trigVy: number | null; dashY: number | null; minBottomSaw: number | null; blue: boolean; deadX: number | null; peak: number };

function run(entryVy: number, dy: number, mode: Mode, holdFrames: number, blackDy = 0): Row {
  const w = fresh(entryVy);
  const done = new Set<number>();
  const row: Row = { mode, hold: holdFrames, trigY: null, trigVy: null, dashY: null, minBottomSaw: null, blue: false, deadX: null, peak: -1e9 };
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
      const inBlack = BLACK && Math.abs(cx - BLACK.cx) <= 1.1 && Math.abs(cyc - BLACK.cy) <= 1.1;
      const blackOk = mode === 'early' ? true : mode === 'desc' ? w.vy < 0 : (cyc - BLACK_Y) >= blackDy;
      if (!hold && inBlack && mode !== 'none' && blackOk) {
        hold = true; blackF = f; held = 0;
        row.trigY = cyc; row.trigVy = w.vy; row.dashY = w.y / U;
      }
    } else if (held < holdFrames) { hold = true; held++; }
    w.frame(hold);
    row.peak = Math.max(row.peak, pcy(w));
    const bot = w.y / U, cxNow = pcx(w);
    if (cxNow > 673.5 && cxNow < 685 && (row.minBottomSaw === null || bot < row.minBottomSaw)) row.minBottomSaw = bot;
    if (Math.abs(cxNow - BLUE_X) <= 0.6 && Math.abs(pcy(w) - BLUE_Y) <= 0.6) row.blue = true;
    if (w.dead) { row.deadX = cxNow; break; }
  }
  return row;
}

const f2 = (v: number | null) => (v === null ? '-' : v.toFixed(2));
console.log('黄环按压高度 yDy × 黑环按压门槛 bDy(窗口内中心须高出环心多少才按)× 按住帧数');
console.log(' yDy  bDy hold  黑环触发(中心y, vy)  dash起点y  锯片区最低盒底  越过锯片?  吃到蓝环  死在x   峰值');
let bestRow: Row | null = null, bestCfg = '';
const score = (r: Row) => ((r.minBottomSaw !== null && r.minBottomSaw > SAW_TOP) ? 100 : 0) + (r.blue ? 10 : 0) + (r.minBottomSaw ?? 0) - (r.deadX !== null ? 1 : 0);
for (const entryVy of [9]) {
  for (const yDy of [0.4, 0.6, 0.8, 1.0]) {
    for (const bDy of [0, 0.4, 0.6, 0.8]) {
      for (const hold of [6, 10, 14]) {
        const r = run(entryVy, yDy, 'late', hold, bDy);
        const clear = r.minBottomSaw !== null && r.minBottomSaw > SAW_TOP;
        console.log(
          String(yDy).padStart(5) + ' ' + String(bDy).padStart(4) + ' ' + String(hold).padStart(4) + '  ' +
          ((f2(r.trigY) + ', ' + f2(r.trigVy)).padEnd(24)) + '  ' + f2(r.dashY).padStart(9) + '  ' +
          f2(r.minBottomSaw).padStart(14) + '  ' + String(clear).padStart(8) + '  ' + String(r.blue).padStart(8) + '  ' +
          f2(r.deadX).padStart(6) + '  ' + r.peak.toFixed(2).padStart(6));
        if (!bestRow || score(r) > score(bestRow)) { bestRow = r; bestCfg = `yDy=${yDy} bDy=${bDy} hold=${hold}`; }
      }
    }
  }
}
console.log('\n最好的一条:' + (bestRow ? `${bestCfg} · 黑环触发y=${f2(bestRow.trigY)} vy=${f2(bestRow.trigVy)} · dash起点脚底y=${f2(bestRow.dashY)} · 锯片区最低盒底=${f2(bestRow.minBottomSaw)}(带顶 ${SAW_TOP.toFixed(2)}) · 越过锯片=${bestRow.minBottomSaw !== null && bestRow.minBottomSaw > SAW_TOP} · 吃到蓝环=${bestRow.blue} · 死在x=${f2(bestRow.deadX)} · 峰值=${bestRow.peak.toFixed(2)}` : '无'));
