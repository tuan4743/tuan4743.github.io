/* 诊断:铺面里【每一个跳点】到底把人弹多高,以及弹起来之后会不会撞到头顶的东西。
 * 用法:cd gd-web && node tools/diag-pad.ts [关卡 water|gen]
 *
 * 为什么要它:用户报"粉跳点性能大错特错"。跳点的力度在原版里是
 *   PlayerObject::propellPlayer(force)  →  vy = flipMod() * 16 * force
 * (见 OpenGD PlayLayer.cpp 的 kGameObjectType*JumpPad 分支),所以判断标准很硬:
 *   峰值抬升 = v² / (2·gravity) 块。
 * 这里就在真铺面上把每个跳点跑一遍,把"理论值 / 实测峰值 / 有没有撞死"并排打出来 ——
 * 数字对不上或者固定撞死,一眼就能看出是哪一种错。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { generateLevel } from '../src/sim/level.ts';
import { World } from '../src/sim/world.ts';
import { P, PAD, U } from '../src/sim/constants.ts';

const WANT = process.argv[2] ?? 'water';
const lv = WANT === 'gen' ? generateLevel({ seed: 20260913 }) : WATER_CHART;
const lvAny = lv as unknown as { objects: Array<Record<string, unknown>> };

/** 理论峰值抬升(块):v² / (2g) */
const peakOf = (v: number) => (v * v) / (2 * P.gravity) / U;

const pads = lvAny.objects.filter((o) => o.kind === 'pad') as Array<{
  kind: string; pad?: string; tp?: boolean; rot?: number; b: number; r: number; w: number; h: number;
}>;

console.log('铺面 ' + lv.name + ' · 跳点 ' + pads.length + ' 个 · gravity=' + P.gravity + ' 单位/帧²');
console.log('物件 140(粉跳板)在表里的力度 = ' + PAD.pink.v + ' → 理论峰值 ' + peakOf(PAD.pink.v).toFixed(2) + ' 块');
console.log('物件 35(黄跳板)   = ' + PAD.yellow.v + ' → 理论峰值 ' + peakOf(PAD.yellow.v).toFixed(2) + ' 块');
console.log('物件 67(蓝跳板)   = ' + PAD.blue.v + ' → 理论峰值 ' + peakOf(PAD.blue.v).toFixed(2) + ' 块(还会翻重力)');
console.log('');
console.log('  x        r    物件        理论峰值  实测抬升  弹后最高   结果');
for (const p of pads) {
  const w = new World(lv);
  /* 放在跳点左边 3 块的地面上:和"人在地面走过去踩到它"完全一样,不按任何键 */
  w.x = (p.b - 3) * U;
  w.y = 0.5 * U;
  w.vy = 0;
  w.onGround = true;
  w.dead = false;
  const y0 = w.y;
  let peak = w.y;
  let died = -1;
  let killer = '';
  for (let i = 0; i < 150; i++) {
    w.frame(false);
    if (w.y > peak) peak = w.y;
    if (w.dead) {
      died = i;
      const i0 = w.x + w.innerOff, i1 = i0 + w.innerSize;
      const j0 = w.y + w.innerOff, j1 = j0 + w.innerSize;
      const hit = [...w.nearHazards, ...w.nearSolids].find((b) => i1 > b.x0 && i0 < b.x1 && j1 > b.y0 && j0 < b.y1);
      if (hit) killer = hit.o.kind + ' b=' + hit.o.b.toFixed(2) + ' r=' + hit.o.r.toFixed(2);
      break;
    }
  }
  const spec = p.tp ? null : PAD[(p.pad ?? 'yellow') as keyof typeof PAD];
  const theory = spec ? peakOf(spec.v).toFixed(2) : '— (tp:蜘蛛式瞬移)';
  const rise = ((peak - y0) / U).toFixed(2);
  const label = (p.pad ?? '?') + (p.tp ? '+tp' : '') + (p.rot ? ' rot' + p.rot : '');
  console.log('  ' + String(p.b).padStart(6) + '  ' + String(p.r).padStart(7) + '  ' + label.padEnd(12)
    + String(theory).padStart(8) + String(rise).padStart(10) + String((peak / U).toFixed(2)).padStart(11)
    + '   ' + (died < 0 ? '活着走完 150 帧' : '第 ' + died + ' 帧撞死:' + killer));
}
