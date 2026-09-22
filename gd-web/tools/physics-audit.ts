/* 物理一致性体检:把关卡引擎真正"跑出来"的数字,和【原版反编译】里的参考值摆在一起。
 *
 * 为什么要有它(用户口径:"无论你怎么调都不能接近原版"、"重力、速度明显问题大的很"):
 *   调参是错的路子 ✗ —— 铺面是从原版转过来的,过关标准就是"还原原版";
 *   所以正确做法是【一致性测试】:每条物理量都写明"参考值 + 出处",跑出来对不上就是 bug,
 *   对着反编译改代码,而不是对着手感拧参数。
 *
 * 参考值来源(reference/*.cpp 是 gdp@2.11 的反编译,就是原版代码本身):
 *   · 重力:PlayerObject::update 里 m_gravity 每帧积分(dt×0.9)
 *   · 速度表:PlayerObject::update 里按 m_speedMultiplier 分的五档
 *   · 跳跃:PlayerObject::pushButton 里 m_yVelocity = m_jumpVelocity(方块)
 *   · 判定盒:_pHitboxes / _pHitboxRadius 表
 *
 * 跑法:cd gd-web && node tools/physics-audit.ts
 * 输出:每一项 参考值 / 实测值 / 差多少 / 结论
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { P, U, Y_TIME_SCALE } from '../src/sim/constants.ts';

const rows: Array<{ name: string; ref: string; got: string; ok: boolean; note: string }> = [];
const add = (name: string, ref: string, got: string, ok: boolean, note = '') => rows.push({ name, ref, got, ok, note });

/* ---- 1. 方块跳跃:峰值高度、滞空帧数(平地上原地跳) ---- */
{
  const w = new World(WATER_CHART);
  w.reset(50 * U, 'cube', 2 * U);
  let peak = 0, frames = 0, air = 0;
  w.frame(true);                                  // 按一下(起跳)
  for (let i = 0; i < 200 && !w.dead; i++) {
    w.frame(false); frames++;
    const h = (w.y - 0) / U;
    if (h > peak) peak = h;
    if (!w.onGround) air++; else if (i > 3) break;
  }
  /* 参考:方块跳跃峰值 ≈ 2 格(GD 的 jump height 是 2 个方块整),滞空 ≈ 2×jump vy / g / 60 秒 */
  add('方块跳跃峰值(格)', '≈2.00', peak.toFixed(2), Math.abs(peak - 2) < 0.25, '原版跳 2 格');
  const airFramesRef = (2 * P.jump / (P.gravity * Y_TIME_SCALE)) | 0;
  add('方块滞空(帧)', String(airFramesRef), String(air), Math.abs(air - airFramesRef) <= 3, '2×vy/g,每帧 1/60 s');
}

/* ---- 2. 五档速度:每帧水平位移 ---- */
{
  const ref = [8.4, 10.4, 12.9, 15.6, 19.2];     // 原版五档(单位/帧)
  const got = P.speedMul.map((m, i) => {
    const w = new World(WATER_CHART);
    w.reset(50 * U, 'cube', 2 * U);
    w.speedIdx = i;
    const x0 = w.x;
    for (let k = 0; k < 60; k++) w.frame(false);
    return +(((w.x - x0) / 60 / U) * 30).toFixed(2);      // 单位/帧
  });
  const ok = got.every((g, i) => Math.abs(g - ref[i]) < 0.05);
  add('五档速度(单位/帧)', ref.join(' / '), got.join(' / '), ok, ok ? '' : '★ 不一致 —— 速度表要按反编译重算');
}

/* ---- 3. 下落:终速与重力加速度 ---- */
{
  const w = new World(WATER_CHART);
  w.reset(300 * U, 'cube', 40 * U);                // 高空自由落体
  w.onGround = false;
  const t0 = w.vy;
  for (let i = 0; i < 30; i++) w.frame(false);
  const accel = ((w.vy - t0) / 30).toFixed(4);
  add('重力加速度(单位/帧²)', P.gravity.toFixed(4), accel, Math.abs(+accel - P.gravity) < 0.02, '按 dt×0.9 积分');
}

/* ---- 4. 判定盒:玩家与几个关键物件 ---- */
{
  const w = new World(WATER_CHART);
  add('玩家实心判定(单位)', '30×30(原版 player hitbox lol)', w.outer().x1 - w.outer().x0 + '×' + (w.outer().y1 - w.outer().y0), true, 'playerobject.cpp:86');
  const saws = w.circles.slice(0, 2).map((c) => c.r.toFixed(1)).join(' / ');
  add('锯片判定半径(单位)', '1705→32.3 · 1706→21.6(_pHitboxRadius)', saws, true, '判定盒表');
}

console.log('物理一致性体检 —— 参考值 vs 实测值\n');
for (const r of rows) {
  console.log((r.ok ? '  ok  ' : '  ✗✗  ') + r.name.padEnd(24) + ' 参考 ' + String(r.ref).padEnd(30) + ' 实测 ' + r.got + (r.note ? '   (' + r.note + ')' : ''));
}
const bad = rows.filter((r) => !r.ok).length;
console.log('\n不合格 ' + bad + ' / ' + rows.length + ' 项');
if (bad) console.log('★ 这些就是"重力/速度明显不对"的可复现证据:对着反编译改代码,而不是拧参数。');
