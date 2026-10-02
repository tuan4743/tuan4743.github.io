/* 定点:细杆地板(468,厚 1.5 单位)会不会被"高速下落"穿过去?
 * 背景:正规路线在 x≈657 处从 y≈19.9 落到细杆地板(顶面 19.005)【下面】去了 ——
 *   我们的落地用的是"帧初脚底 + snapTol(15 单位 = 0.5 块)";4 速下每帧能落 0.3~0.65 块,
 *   一旦超过 0.5 块就可能整帧跨过去 —— 那就是"该踩到的地板踩不到"。
 * 用法:cd gd-web && node tools/hand-thin.ts [x块] [起始y块] [速度档] */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U, vxOf } from '../src/sim/constants.ts';

const X = Number(process.argv[2] ?? 655);
const SPR = Number(process.argv[3] ?? 4);

console.log('细杆地板在 x=' + X + ' 附近(y≈19,顶面 19.005);每帧下落多少才穿过去?');
/* ★ 飞行类(UFO)也要测:实测正规路线在 x≈655 处正是【UFO】以 vy=-0.2 块/帧穿过这根细杆
   (帧 4163~4171:19.89 → 18.35,然后才变成方块)—— 飞行类碰到实心应该是死/被挡。 */
for (const mode of ['cube', 'ufo'] as const) {
  console.log('  形态 ' + mode + ':');
  for (const vy of [0.2, 0.5, 1.0]) {
    const w = new World(WATER_CHART, X * U, 21 * U);
    w.reset(X * U, mode, 21 * U);
    w.speedIdx = SPR;
    w.gdir = 1;
    w.vy = -vy * U;
    w.onGround = false;
    let out = '';
    for (let f = 0; f < 60 && !w.dead; f++) {
      w.frame(false);
      if (f % 10 === 0) out += ' ' + (w.y / U).toFixed(2);
      if (w.onGround) break;
    }
    console.log('    vy=-' + vy.toFixed(2) + ' → ' + (w.dead ? '✗ 死了' : (w.onGround ? '✓ 落在杆上' : '活着'))
      + ' y 序列' + out + ' 末 y=' + (w.y / U).toFixed(2));
  }
}
for (const vy of [0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
  const w = new World(WATER_CHART, X * U, 21 * U);
  w.reset(X * U, 'cube', 21 * U);
  w.speedIdx = SPR;
  w.gdir = 1;
  w.vy = -vy * U;                     // 下落速度(块/帧)
  w.onGround = false;
  let landed = false, minY = Infinity;
  for (let f = 0; f < 40 && !w.dead; f++) {
    w.frame(false);
    minY = Math.min(minY, w.y / U);
    if (w.onGround && w.y / U > 18.5 && w.y / U < 20) { landed = true; break; }
  }
  console.log('  vy=-' + vy.toFixed(2) + ' 块/帧(=' + (-vy * U).toFixed(1) + ' 单位/帧, 水平 ' + vxOf(SPR).toFixed(2)
    + ') → ' + (landed ? '✓ 落在杆上(y=' + (w.y / U).toFixed(2) + ')' : '✗ 穿过去了(最低到 y=' + minY.toFixed(2) + ')')
    + (w.dead ? ' 【死了】' : ''));
}
console.log('参考:终端速度 15 单位/帧 = 0.5 块/帧;snapTol = 15 单位 = 0.5 块');

/* ★★ 顺带查一件更要紧的事:飞行类(UFO/飞机/波浪)碰到【大块实心】到底会不会死?
   代码结构上,实心侧撞判定(撞侧面即死)整段写在 `if (mode !== ship/ufo/wave)` 里面 ——
   如果那样,飞行类就是"穿墙不死的"。这里用一个干净的复现问一遍(不经过 reset 的 onGround 陷阱)。 */
console.log('\n飞行类 vs 实心(干净复现:onGround=false,从空中往下撞地面方块):');
for (const mode of ['cube', 'ufo'] as const) {
  const w = new World(WATER_CHART);
  const X0 = 700;
  w.reset(X0 * U, mode, 6 * U);
  w.speedIdx = 1;
  w.gdir = 1;
  w.vy = 0;
  w.onGround = false;
  for (let f = 0; f < 200 && !w.dead && !w.onGround && w.y > -3 * U; f++) w.frame(false);
  console.log('  ' + mode.padEnd(5) + ' → ' + (w.dead ? '✗ 死了(正确)' : w.onGround ? '⚠ 落在实心上没死(y='
    + (w.y / U).toFixed(2) + ')' : '⚠ 还在掉(y=' + (w.y / U).toFixed(2) + ')')
    + ' · 死在 y=' + (w.y / U).toFixed(2) + '(撞方块应为 ≈0;掉出世界才是 ≈-2.5)');
}
