/* 物理成绩单:把"手感数字"连同出处、单位换算、以及【模拟实测】一起打出来,方便和原版对齐。
 * 为什么要它:用户问"重力加速度是不是 2727.35 单位/s²""1 块 = 30 像素的比例还在不在"——
 * 这类问题不能靠嘴答,得有一条可复现的命令:表里的数字 × 单位换算 + 定点模拟跑出来的实测。
 *
 * 单位约定(照 GD 自己):1 块 = 30 单位;表里的重力/初速都是【每 1/60 秒一帧】的量;
 * 原作 y 轴按 dt×0.9 积分(OpenGD playerobject.cpp:320 `dtSlow = dt*0.9`),
 * 所以"眼睛看到的"下落加速度 = 表里的值 × 0.81。
 *
 * 用法:cd gd-web && node tools/phys-report.ts
 */
import { P, U, Y_TIME_SCALE, SPEED_YSTART, SPEED_CUBE_GRAVITY, vxOf, jumpOf, cubeGravityOf } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';
import type { Level } from '../src/sim/level.ts';

const G = 60 * 60;                      // 帧 → 秒
const OBS = Y_TIME_SCALE * Y_TIME_SCALE; // 观测系数(速度与位置各乘一次 0.9)
const perS = (v: number) => v * G;
const fmt = (v: number, n = 2) => v.toFixed(n);

/* 平地合成关卡:一长条地板,用来做定点实测 */
const flat = (len = 200): Level => ({
  name: 'flat', rows: 30, length: len,
  segments: [{ from: 0, to: len, mode: 'cube', speed: 1, difficulty: 0 }],
  objects: [{ kind: 'platform', b: 0, r: -1, w: len, h: 1 }],
  song: '', songOffset: 0, start: { b: 0, r: 0 },
});

console.log('=== ① 单位与比例 ===');
console.log('  1 块 = ' + U + ' 单位(.dat 的 k2/k3 也是这个单位:一个方块 = 30)');
console.log('  y 轴时间尺度 Y_TIME_SCALE = ' + Y_TIME_SCALE + '(反编译:updateJump 吃 dt×0.9)');
console.log('  屏幕比例:页面按【一屏 ' + 11 + ' 格】取景(原版设计分辨率 480×320 → 10.67 格),');
console.log('    每块像素 = 缓冲高度 ÷ 11;x/y 同倍率,不会拉扁(见 main.ts zoomOf)');

console.log('\n=== ② 重力(每帧² / 每秒² / 每块每秒²) ===');
console.log('  速度档      m_gravity(原始)   ×0.81 后(眼睛看到的)    块/s²    备注');
const names = ['0.5速(0.7)', '1速(0.9)', '2速(1.1)', '3速(1.3)', '4速(1.6)'];
for (let i = 0; i < 5; i++) {
  const g = cubeGravityOf(i);
  console.log('  ' + names[i].padEnd(11) + fmt(g, 6).padStart(9)
    + fmt(perS(g), 1).padStart(18) + fmt(perS(g * OBS), 1).padStart(18)
    + fmt(perS(g * OBS) / U, 1).padStart(10) + '   ' + (i === 1 ? '← 默认档(出生档)' : ''));
}
console.log('  ★ 逐档表给【方块(×1.0)与机器人(×0.9)】用:master updateJump.cpp:112 是'
  + ' usedGravity = (isBall||isFlying||isSpider) ? 0.9582 : m_gravity。');
console.log('  ★ 用户提到的 2727.35 单位/s² 对应每帧² = ' + fmt(2727.35 / G, 6)
  + ',总系数(相对原始值)= ' + fmt(2727.35 / perS(P.gravity), 4)
  + ';我们的 0.81(= 0.9²)→ ' + fmt(perS(P.gravity * OBS), 1) + ' 单位/s²');
console.log('    只乘一次 0.9 是 ' + fmt(perS(P.gravity * Y_TIME_SCALE), 1)
  + ';不乘 0.9 是 ' + fmt(perS(P.gravity), 1) + ' 单位/s² —— 三个数都对不上 2727.35,');

console.log('\n=== ③ 各形态的重力(出处见 constants.ts 注释) ===');
const forms: Array<[string, string, number]> = [
  ['方块(cube)', 'm_gravity(按速度档) × 1.0', cubeGravityOf(1)],
  ['机器人(robot)', 'm_gravity(按速度档) × 0.9', cubeGravityOf(1) * P.robotGravityMul],
  ['球(ball)', '0.958199(固定) × 0.6', P.gravity * P.ballGravityMul],
  ['蜘蛛(spider)', '0.958199(固定) × 0.6', P.gravity * P.ballGravityMul],
  ['飞船(ship)', '飞行类:按住 +0.4g / 松开 -0.32~-0.48g(有速度上限 ±8/-6.4)', NaN],
  ['UFO', '同飞行类;点一下给 ±7(迷你 8)冲量', NaN],
  ['波浪(wave)', '没有重力:vy 直接 = ±水平速度(45° 折线)', 0],
];
for (const [k, src, g] of forms) {
  console.log('  ' + k.padEnd(13) + (Number.isNaN(g) ? '(见速度上限)' : fmt(perS(g * OBS), 1).padStart(9) + ' 单位/s²').padStart(22)
    + '   ' + src);
}
console.log('  ★ 注意:球/蜘蛛用【固定】的 0.958199 再 ×0.6,不吃速度档;机器人吃速度档再 ×0.9。');

console.log('\n=== ④ 定点实测(合成平地,和上面的表逐条对照) ===');
for (let i = 0; i < 5; i++) {
  const w = new World(flat());
  w.speedIdx = i;
  /* 起跳:按 1 帧(方块是"按住=落地连跳",这里只在第 0 帧按) */
  let hold = true;
  let frames = 0, peak = -Infinity, x0 = w.x, landX = NaN;
  for (let f = 0; f < 600; f++) {
    w.frame(hold);
    frames++;
    if (f === 0) hold = false;
    peak = Math.max(peak, w.y);
    if (frames > 3 && w.onGround && Number.isNaN(landX)) { landX = w.x; break; }
  }
  const apex = peak / U;
  const span = (landX - x0) / U;
  console.log('  ' + names[i].padEnd(11) + ' vx=' + fmt(vxOf(i), 3).padStart(7) + ' 单位/帧'
    + ' 起跳初速=' + fmt(jumpOf(i), 4).padStart(9)
    + ' → 峰值 ' + fmt(apex, 2) + ' 块 · 滞空 ' + fmt(frames / 60, 3) + ' 秒 · 跨 ' + fmt(span, 2) + ' 块');
}
/* 自由落体:从高处松手,拟合 a = 2·Δy / t²(单位/帧²),再换成 单位/s² */
{
  const w = new World(flat(), 5 * U, 20 * U);
  w.reset(5 * U, 'cube', 20 * U);
  w.vy = 0; w.onGround = false;              // reset 会把人标成"站着的",这里要真落体
  const y0 = w.y, v0 = w.vy;
  let f = 0;
  /* ★ 只量【没到终端速度】的那一段:15 单位/帧的上限大约 19 帧后碰到,量长了会把 a 拉低。 */
  for (; f < 10 && !w.dead; f++) w.frame(false);
  const dvy = Math.abs(w.vy - v0);            // 这 10 帧里 vy 涨了多少(取绝对值,掉落是负方向)
  const perFrameV = dvy / f;                  // 每帧涨的速度 = 表里的重力 × 0.9
  const aPos = perFrameV * Y_TIME_SCALE;      // 位置上的观测加速度(每帧²)
  const dy = y0 - w.y;
  console.log('  自由落体(前 ' + f + ' 帧,未到终端速度):vy 每帧 +' + fmt(perFrameV, 6)
    + ' 单位/帧(= 表里 ' + fmt(P.gravity, 6) + ' × 0.9)');
  console.log('    位置观测量:2·Δy/t² = ' + fmt((2 * dy) / (f * f), 6)
    + ';由 Δvy 推 = ' + fmt(aPos, 6) + ' 单位/帧² = ' + fmt(perS(aPos), 1) + ' 单位/s² = '
    + fmt(perS(aPos) / U, 1) + ' 块/s²');
  console.log('    (表里的 0.958199 × 0.81 = ' + fmt(P.gravity * OBS, 6) + ' —— 离散化差零点几个百分点属正常)');
}

console.log('\n=== ⑥ 量法陷阱:终端速度会把"表观重力"拖低 ===');
console.log('  P.vyMax = ' + P.vyMax + ' 单位/帧(1 速下落大约 ' + fmt(P.vyMax / (P.gravity * OBS * Y_TIME_SCALE), 1)
  + ' 帧后到顶),所以"落一段再用 2·Δy/t² 反推"量得越久越偏小:');
{
  const w = new World(flat(), 5 * U, 60 * U);
  w.reset(5 * U, 'cube', 60 * U);
  w.vy = 0; w.onGround = false;
  const y0 = w.y;
  const acc: string[] = [];
  for (let f = 1; f <= 40; f++) {
    w.frame(false);
    if ([10, 15, 20, 25, 30, 40].includes(f)) {
      const a = (2 * (y0 - w.y)) / (f * f);
      acc.push(f + ' 帧 → ' + fmt(perS(a), 0) + ' 单位/s²');
    }
  }
  console.log('  ' + acc.join(' · '));
  console.log('  ★ 用户给的 2727.35 单位/s² 落在"落 20~22 帧反推"那一档(20 帧 2777、25 帧 2555)——');
  console.log('    说明那是被终端速度截过的【表观】量法,不是瞬时重力。瞬时值只有 '
    + fmt(perS(P.gravity * OBS), 0) + ' 单位/s²(见 ④ 的自由落体那一行)。');
}

console.log('\n=== ⑤ 一次跳跃的解析量(用来跟原版实测对表) ===');
console.log('  峰值 = v²/(2g) = ' + fmt(P.jump * P.jump / (2 * P.gravity) / U, 3) + ' 块(与 y 时间尺度无关)');
console.log('  滞空 = 2v/(g×0.9) = ' + fmt((2 * P.jump / (P.gravity * Y_TIME_SCALE)) / 60, 3) + ' 秒');
console.log('  1 速跨距 = 滞空 × 1 速水平速度 = ' + fmt(((2 * P.jump / (P.gravity * Y_TIME_SCALE)) / 60) * (vxOf(1) * 60 / U), 2) + ' 块');
console.log('  ★ 若原版没有 dt×0.9(滞空 0.389 秒),1 速跨距会是 '
  + fmt((2 * P.jump / P.gravity / 60) * (vxOf(1) * 60 / U), 2) + ' 块 —— 差 0.45 块,编辑器里数格子就能分辨');
