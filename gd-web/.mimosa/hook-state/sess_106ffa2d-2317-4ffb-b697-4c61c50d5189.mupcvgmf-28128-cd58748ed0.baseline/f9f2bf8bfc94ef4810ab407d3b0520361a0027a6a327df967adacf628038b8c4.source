/* black-orb dash probe 2 (read-only): sweep the hold length.
 * User's spec: the black orb should just barely carry the player to the blue orb below.
 * Blue orb 84 is at (681.5,17.5) blocks; the saw 1705 sits at x~678.5, y~26.5, r=2.15 blocks.
 * NOTE: edit this file only with the edit/write tools - PowerShell text replacement corrupts the encoding (seen). */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const black = WATER_CHART.objects.filter((o) => o.id === 1330)[0];
const blue = WATER_CHART.objects.filter((o) => o.orb === 'blue').map((o) => ({ o, cx: (o.b + o.w / 2) * U, cy: (o.r + o.h / 2) * U }))
  .filter((b) => Math.abs(b.cx / U - 681.5) < 3)[0];
console.log('black orb (' + (black.b + black.w / 2) + ',' + (black.r + black.h / 2) + ') - blue orb 84 (' + (blue.cx / U) + ',' + (blue.cy / U) + ')');

interface Row {
  holdFrames: number; ateOrb: boolean; dashFrames: number; yAt678: number; touchedBlue: boolean;
  deathX: number; minY: number; maxY: number; endX: number; endY: number; dead: boolean; hits: string[];
}

function sim(holdFrames: number, sp: number): Row {
  const w = new World(WATER_CHART);
  const cx = (black.b + black.w / 2) * U, cy = (black.r + black.h / 2) * U;
  w.mode = 'cube'; w.gdir = 1; w.dead = false; w.speedIdx = sp;
  w.x = cx - U * 1.0 - w.box / 2; w.y = cy - w.box / 2; w.vy = 0; w.onGround = false;
  let ateOrb = false, dashFrames = 0, yAt678 = NaN, touchedBlue = false, deathX = NaN, minY = 1e9, maxY = -1e9;
  for (let f = 0; f < 200; f++) {
    const hold = f >= 6 && f < 6 + holdFrames;
    w.frame(hold);
    if (w.dash) dashFrames++;
    if ([...(w as unknown as { armedOrbs: Set<unknown> }).armedOrbs].length > 0) ateOrb = true;
    const bx = w.x + w.box / 2;
    if (isNaN(yAt678) && bx >= 678.5 * U) yAt678 = w.y / U;
    minY = Math.min(minY, w.y / U); maxY = Math.max(maxY, w.y / U);
    if (Math.abs(w.x + w.box / 2 - blue.cx) < U * 0.5 + w.box / 2 && Math.abs(w.y + w.box / 2 - blue.cy) < U * 0.5 + w.box / 2) touchedBlue = true;
    if (w.dead) { deathX = w.x / U; break; }
  }
  /* death cause: walk every object list + the circle list (saws live in circles, not in the rect lists) */
  const W = w as unknown as Record<string, Array<Record<string, unknown>>>;
  const box = { x0: w.x, x1: w.x + w.box, y0: w.y, y1: w.y + w.box };
  const hits: string[] = [];
  for (const key of ['solids', 'breakables', 'floors', 'hazards', 'frames', 'pads', 'orbs', 'portals', 'gravs', 'arrows', 'forces', 'coins', 'checks']) {
    for (const b of (W[key] ?? [])) {
      const b0 = b.x0 as number, b1 = b.x1 as number, b2 = b.y0 as number, b3 = b.y1 as number;
      if (box.x1 > b0 && box.x0 < b1 && box.y1 > b2 && box.y0 < b3) {
        const o = b.o as { id?: number } | undefined;
        hits.push(key + '#' + (o?.id ?? '?') + '@(' + (b0 / U).toFixed(1) + ',' + (b2 / U).toFixed(1) + ')');
      }
    }
  }
  for (const c of ((W.circles ?? []) as unknown as Array<{ cx: number; cy: number; r: number; o?: { id?: number } }>)) {
    const dx = Math.max(box.x0 - c.cx, 0, c.cx - box.x1), dy = Math.max(box.y0 - c.cy, 0, c.cy - box.y1);
    if (dx * dx + dy * dy < c.r * c.r) hits.push('saw#' + (c.o?.id ?? '?') + '@(' + (c.cx / U).toFixed(1) + ',' + (c.cy / U).toFixed(1) + ')r=' + (c.r / U).toFixed(2));
  }
  return { holdFrames, ateOrb, dashFrames, yAt678, touchedBlue, deathX, minY, maxY, endX: w.x / U, endY: w.y / U, dead: w.dead, hits };
}

/* route test: do NOT eat the black orb, press exactly while the blue orb's box is overlapped */
function route(sp: number, pressWindow: number) {
  const w = new World(WATER_CHART);
  const cx = (black.b + black.w / 2) * U, cy = (black.r + black.h / 2) * U;
  w.mode = 'cube'; w.gdir = 1; w.dead = false; w.speedIdx = sp;
  w.x = cx - U * 1.0 - w.box / 2; w.y = cy - w.box / 2; w.vy = 0; w.onGround = false;
  let framesInBlue = 0, pressed = false, alive = true, endX = 0, endY = 0;
  for (let f = 0; f < 200; f++) {
    const overBlue = Math.abs(w.x + w.box / 2 - blue.cx) < U * 0.5 + w.box / 2 && Math.abs(w.y + w.box / 2 - blue.cy) < U * 0.5 + w.box / 2;
    if (overBlue) framesInBlue++;
    const hold = overBlue && framesInBlue <= pressWindow;
    w.frame(hold);
    if (hold) pressed = true;
    if (w.dead) { alive = false; break; }
    endX = w.x / U; endY = w.y / U;
  }
  return { sp, pressWindow, framesInBlue, pressed, alive, endX, endY };
}
console.log('\nroute: skip black orb, press while over the blue orb');
for (const sp of [2, 3, 4]) for (const pw of [1, 2, 3, 6]) {
  const r = route(sp, pw);
  console.log('  sp=' + r.sp + ' pressFrames=' + String(r.pressWindow).padStart(2) +
    ' | 落在蓝环里 ' + String(r.framesInBlue).padStart(2) + ' 帧 | 按过=' + (r.pressed ? 'Y' : 'N') +
    ' | ' + (r.alive ? 'ALIVE 到 (' + r.endX.toFixed(2) + ',' + r.endY.toFixed(2) + ')' : 'dead @ ' + r.endX.toFixed(2)));
}

const rows: Array<Row & { sp: number }> = [];
for (const sp of [1, 3, 4]) for (const n of [0, 1, 2, 3, 4, 5, 6, 8]) rows.push({ ...sim(n, sp), sp });
console.log('\nsp | holdN | ate dashF | y@678.5 | blue | deathX | minY | outcome | cause');
for (const r of rows) {
  console.log('  ' + r.sp + ' |  ' + String(r.holdFrames).padStart(3) + '  |  ' + (r.ateOrb ? 'Y' : 'N') + '   ' + String(r.dashFrames).padStart(3) +
    '  | ' + (isNaN(r.yAt678) ? '  n/a ' : r.yAt678.toFixed(2).padStart(7)) +
    ' | ' + (r.touchedBlue ? 'HIT' : ' - ') +
    ' | ' + (isNaN(r.deathX) ? ' live' : r.deathX.toFixed(2)) +
    ' | ' + r.minY.toFixed(2).padStart(6) +
    ' | ' + (r.dead ? 'dead' : 'live@(' + r.endX.toFixed(2) + ',' + r.endY.toFixed(2) + ')') +
    ' | ' + (r.hits.length ? r.hits.join(' ') : '-'));
}
