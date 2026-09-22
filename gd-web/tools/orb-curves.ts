/* 跳环/冲刺环:逐【环种 × 形态】把"按下去那一刻拿到的 vy"和原版公式并排打出来。
 *
 * 原版出处:.tmp/gdp211/ringJump.cpp(反编译)
 *   yAccel = jumpPower × 形态倍率 × (upsideDown ? -1 : 1) × (mini ? 0.8 : 1)
 *   黑环例外:飞机/UFO/波浪 ±14(其中 UFO ×0.8)、其它 ±15(蜘蛛 ×1.10)
 *   普通环里 球/蜘蛛 再 ×0.7(ringJump.cpp:127-130)
 * 引擎侧:真的把玩家放进关卡里对应环的判定盒里按一下,读它实际给出的 vy ✓
 *
 * 跑法:cd gd-web && node tools/orb-curves.ts
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U, P } from '../src/sim/constants.ts';

type Form = 'cube' | 'ship' | 'ball' | 'ufo' | 'wave' | 'robot' | 'spider';
const FORMS: Form[] = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];
const KINDS = ['yellow', 'pink', 'red', 'blue', 'green', 'black'] as const;

/** 原版公式(照抄 ringJump.cpp) */
function refVy(kind: string, form: Form, gdir: 1 | -1, mini: boolean): number {
  const J = P.jump;
  let a: number;
  if (kind === 'black') {
    const flying = form === 'ship' || form === 'ufo' || form === 'wave';
    a = flying ? 14 : 15;
    if (form === 'ufo') a *= 0.8;
    if (form === 'spider') a *= 1.1;
  } else {
    a = J;
    if (kind === 'red') {
      if (form === 'ship') { if (mini) a *= 1.4; }
      else if (form === 'ufo') a *= mini ? 1.36 : 1.02;
      else if (form === 'ball') a *= 1.34;
      else if (form === 'robot') a *= 1.28;
      else if (form === 'spider') a *= 1.34;
      else a *= 1.38;
    } else if (kind === 'pink') {
      if (form === 'ship') a *= 1.37;
      else if (form === 'ufo') a *= 0.42;
      else if (form === 'ball') a *= 0.77;
      else a *= 0.72;
    } else if (kind === 'green') {
      if (form === 'ship') a *= 0.7;
    } else if (kind === 'blue') {
      a *= 0.8;
    } else {
      if (form === 'robot') a *= 0.9;
    }
    if (form === 'ball' || form === 'spider') a *= 0.7;
    a *= mini ? 0.8 : 1;
  }
  return a * (gdir < 0 ? -1 : 1);
}

/* 找一组可用的环:每种环取关卡里第一个 */
const orbs = new Map<string, { b: number; r: number; w: number; h: number }>();
for (const o of WATER_CHART.objects as Array<Record<string, unknown>>) {
  if (o.kind === 'orb' && o.orb && !orbs.has(o.orb as string)) {
    orbs.set(o.orb as string, { b: o.b as number, r: o.r as number, w: o.w as number, h: o.h as number });
  }
}
console.log('关卡里的环:' + [...orbs.entries()].map(([k, v]) => k + '@' + v.b).join(' · ') + '\n');
console.log('环种    形态    引擎实测     原版公式     差');
for (const kind of KINDS) {
  const o = orbs.get(kind);
  for (const form of FORMS) {
    const ref = refVy(kind, form, 1, false);
    let got: number | null = null;
    if (o) {
      const w = new World(WATER_CHART);
      w.reset((o.b + 0.5) * U, form, (o.r + 0.5) * U);
      w.mode = form; w.gdir = 1; w.sizeMul = 1; w.vy = 0;
      w.x = (o.b + 0.5) * U; w.y = (o.r + 0.5) * U - 15;      // 人放进环的判定盒里
      w.onGround = false;                                     // ★ 跳环只在【空中】生效 —— 忘了这一句的话探针永远测不到 ✗
      w.frame(true);                                          // 按一下
      got = w.vy;
      w.frame(false);
      got = w.vy;                                             // 下一帧读(避开当帧别的结算)
    }
    if (got === null) { console.log('  ' + kind.padEnd(7) + form.padEnd(7) + '(关卡里没有这种环)'); continue; }
    const d = got - ref;
    const bad = Math.abs(d) > 0.35;
    console.log('  ' + kind.padEnd(7) + form.padEnd(7) + got.toFixed(3).padStart(8) + '   ' + ref.toFixed(3).padStart(8)
      + '   ' + (bad ? '✗ ' + d.toFixed(3) : '✓'));
  }
}
