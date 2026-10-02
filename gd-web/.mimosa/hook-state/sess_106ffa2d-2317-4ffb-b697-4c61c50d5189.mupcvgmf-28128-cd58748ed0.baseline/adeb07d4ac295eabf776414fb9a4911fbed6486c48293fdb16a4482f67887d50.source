/* 绿环细扫(绿环收尾)· 修正版:
   ★ 第一版两个错:①激活判据用 vy<−6 ⇒ 把玩家自己的跳当成激活 ✗;②按键条件按"高度"判 ⇒
     人一开始下落就永不满足,整段根本没按到环 ✗。现在:激活判据 = 【重力被翻 gdir→−1】(绿环必然翻重力),
     按键时机 = 玩家中心越过环心 x 那一帧(这才是真实玩法)✓
   绿环 O 557 8 orb=green id=1022;下格 G 559 5 gd=1 id=10
   跑法:cd gd-web && node tools/diag-green3.ts */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const say = (s: string) => process.stdout.write(s + '\n');
console.log = () => {}; const realWarn = console.warn; console.warn = () => {};

const lv = WATER_CHART;
const orb = lv.objects.find((o) => o.id === 1022 && o.b > 513 && o.b < 760)!;
const orbCx = orb.b + orb.w / 2, orbCy = orb.r + orb.h / 2;
const door = lv.objects.find((o) => o.id === 10 && Math.abs(o.b - orb.b) < 6);
const seg = lv.segments.find((s) => orb.b >= s.from && orb.b < s.to);
say('绿环 id=' + orb.id + ' 中心=(' + orbCx + ',' + orbCy + ') 格 · 铺面给的盒=' + (orb.w * 30) + 'x' + (orb.h * 30) + ' 单位');
if (door) say('下格门 id=' + door.id + ' 中心=(' + (door.b + door.w / 2) + ',' + (door.r + door.h / 2) + ') gdir=' + door.gdir);
say('段落 speed=' + seg?.speed + ' mode=' + seg?.mode);

const mk = () => { const w = new World(lv); w.god = true; w.mode = 'cube'; w.dead = false; w.gdir = 1; return w; };
/** 中心摆到 (orbCx+dx, orbCy+dy),第一帧按一次 ⇒ 是否【翻重力】
    ★ w.y 是【脚底】不是中心(player 盒高 1 格)⇒ 要减 0.5 格才是"中心在 orbCy+dy" */
function pressAt(dx: number, dy: number) {
  const w = mk();
  w.x = (orbCx + dx) * U; w.y = (orbCy + dy - 0.5) * U; w.vy = 0; w.onGround = false;
  let act = false;
  for (let f = 0; f < 4; f++) { w.frame(f === 0); if (w.gdir === -1) { act = true; break; } }
  return { act, vy: w.vy, cy: w.y / U + 0.5 };
}

say('\n① 纵向触达(0.1 格,中心摆到该高度、按一次;● = 翻重力了):');
const vm: string[] = []; let vlo: number | null = null, vhi: number | null = null;
for (let i = -20; i <= 20; i++) { const dy = i / 10, r = pressAt(0, dy); if (r.act) { if (vlo === null) vlo = dy; vhi = dy; } vm.push((r.act ? '●' : '·') + dy.toFixed(1)); }
say('  ' + vm.join(' '));
say('  ⇒ 纵向激活 dy ∈ [' + vlo + ', ' + vhi + '] 格 · 中心偏 ' + (((vhi ?? 0) + (vlo ?? 0)) / 2).toFixed(2) + ' · 半高 ' + (((vhi ?? 0) - (vlo ?? 0)) / 2).toFixed(2) + ' 格');

say('\n② 横向触达(0.1 格,同一高度):');
const hm: string[] = []; let hlo: number | null = null, hhi: number | null = null;
for (let i = -25; i <= 25; i++) { const dx = i / 10, r = pressAt(dx, 0); if (r.act) { if (hlo === null) hlo = dx; hhi = dx; } hm.push((r.act ? '●' : '·') + dx.toFixed(1)); }
say('  ' + hm.join(' '));
say('  ⇒ 横向激活 dx ∈ [' + hlo + ', ' + hhi + '] 格 · 中心偏 ' + (((hhi ?? 0) + (hlo ?? 0)) / 2).toFixed(2) + ' · 半宽 ' + (((hhi ?? 0) - (hlo ?? 0)) / 2).toFixed(2) + ' 格');

/** 从环前 1 格、从"环心 + startDy"(玩家【中心】的高度)起跑,一路落;按键 = 中心越过环心 x 那一帧按一次 */
function run(startDy: number, hold: boolean) {
  const w = mk();
  w.x = (orb.b - 1) * U; w.y = (orbCy + startDy - 0.5) * U; w.vy = 0;
  let act: { dy: number; vy: number } | null = null, pressed = false, pressY = 0, held = false;
  let maxY = -999, inDoor = false, minY = 999;
  for (let f = 0; f < 260; f++) {
    const cx = w.x / U, cy = w.y / U;
    let press = held;
    if (!pressed && cx >= orbCx - 0.3) { pressed = true; press = true; pressY = cy; }
    if (hold && cy <= orbCy + startDy) held = true;
    if (held) press = true;
    w.frame(press);
    if (!act && w.gdir === -1) act = { dy: w.y / U - orbCy, vy: w.vy };
    maxY = Math.max(maxY, cy); minY = Math.min(minY, cy);
    if (door && cx > door.b - 1 && cx < door.b + door.w + 1 && cy > door.r - 2 && cy < door.r + 3) inDoor = true;
    if (w.dead) break;
  }
  const route = act ? (act.vy < -6 ? '上路(翻重力+跳)' : '翻重力但没跳') : (inDoor ? '下路(进重力门)' : '都没走');
  return { act, route, pressY, maxY, minY, endX: w.x / U, endY: w.y / U, gdir: w.gdir, dead: w.dead, inDoor };
}

say('\n③ 分流(从环前 4 格、不同起始高度起跑;按键 = 中心越过环心那一帧):');
for (const dy of [1.5, 1.0, 0.5, 0, -0.5, -1.0]) {
  const r = run(dy, false);
  say('  起始高度 环心' + (dy >= 0 ? '+' : '') + dy.toFixed(1) + ' ⇒ 按在 dy=' + (r.pressY - orbCy).toFixed(2) +
    ' ⇒ ' + r.route.padEnd(16) + ' 激活于 dy=' + (r.act ? r.act.dy.toFixed(2) : '  — ').padStart(5) +
    ' vy=' + (r.act ? r.act.vy.toFixed(2) : '  — ').padStart(6) + ' gdir=' + r.gdir +
    ' 顶点 y=' + r.maxY.toFixed(2) + ' 最低 y=' + r.minY.toFixed(2) + ' 终态 x=' + r.endX.toFixed(1) + (r.dead ? ' 【死】' : ''));
}
say('\n④ 按键语义:');
const fresh = run(0, false);
say('  【新按一次】(越环心那帧按)⇒ ' + (fresh.act ? '翻重力 ✓ dy=' + fresh.act.dy.toFixed(2) + ' vy=' + fresh.act.vy.toFixed(2) : '【没翻】✗') + ' · ' + fresh.route);
const holdR = run(1.5, true);
say('  【一直按住】(从环心上方 1.5 格起按住)⇒ ' + (holdR.act ? '翻重力 ✓ dy=' + holdR.act.dy.toFixed(2) + ' vy=' + holdR.act.vy.toFixed(2) : '【没翻】✗') + ' · ' + holdR.route);
const noPress = (() => { const w = mk(); w.x = (orb.b - 4) * U; w.y = orbCy * U; w.vy = 0; for (let f = 0; f < 260; f++) { w.frame(false); if (w.dead) break; } return { gdir: w.gdir, x: w.x / U, y: w.y / U, dead: w.dead }; })();
say('  【完全不按】⇒ gdir=' + noPress.gdir + ' 终态 x=' + noPress.x.toFixed(1) + ' y=' + noPress.y.toFixed(2) + (noPress.dead ? ' 【死】' : ''));
