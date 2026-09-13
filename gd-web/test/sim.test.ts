/* 模拟核心的验收(Node 原生 test runner,不需要任何依赖):
 *   node --test test/
 *
 * 这些用例是"手感与铺面"的地基:常量表自检、机制逐条验证、
 * 自动铺面的可通过性(机器人 0 死亡通关)、以及确定性回放指纹。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { P, U, ROWS, JUMP_SPAN_BLOCKS, JUMP_AIRTIME_S, arcSpan, PAD, ORB } from '../src/sim/constants.ts';
import { generateLevel, tightestGap, tOfX, countKinds, type Level, type Segment } from '../src/sim/level.ts';
import { World, botThink } from '../src/sim/world.ts';
import { recordBot, replay, fingerprint } from '../src/sim/replay.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function solo(objects: Level['objects'], extra: Partial<Level> = {}): Level {
  return {
    name: 'test',
    rows: ROWS,
    length: 60,
    segments: [{ from: 0, to: 60, mode: 'cube', speed: 1, difficulty: 0.2 }] as Segment[],
    objects,
    song: 'x.mp3',
    songOffset: 0,
    ...extra,
  };
}

/* ---------------- ① 常量表自检 ---------------- */
test('常量表:一跳峰值 2.17 块、滞空 0.43 秒、跨 4.49 块(和原作"跳两块"一致)', () => {
  const peak = (P.jump * P.jump) / (2 * P.gravity) / U;
  assert.ok(Math.abs(peak - 2.17) < 0.05, '解析峰值 = ' + peak.toFixed(3) + ' 块');
  /* 滞空是 0.432 秒而不是 2v/g/60 = 0.389 —— 因为原作 y 轴按 dt×0.9 积分(见 constants 的
     Y_TIME_SCALE),时间轴拉长 11%,但峰值不变;水平跨距因此是 4.49 块。 */
  assert.ok(Math.abs(JUMP_AIRTIME_S - 0.432) < 0.015, '滞空 = ' + JUMP_AIRTIME_S.toFixed(3) + ' 秒');
  assert.ok(JUMP_SPAN_BLOCKS > 4.3 && JUMP_SPAN_BLOCKS < 4.7, '一跳跨 ' + JUMP_SPAN_BLOCKS.toFixed(2) + ' 块');

  // 模拟出来的峰值也要对得上(证明定点步长没有把手感跑偏)
  const w = new World(solo([]));
  let hold = true, peakY = 0;
  for (let i = 0; i < 60; i++) { if (i > 2) hold = false; w.frame(hold); peakY = Math.max(peakY, w.y); }
  assert.ok(Math.abs(peakY / U - peak) < 0.12, '模拟峰值 ' + (peakY / U).toFixed(2) + ' 块 vs 解析 ' + peak.toFixed(2));
});

/* ---------------- ② 基本机制 ---------------- */
test('尖刺:不跳就死;跳过去就不死', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'spike', b: 20, r: 0, w: 1, h: 1 },
  ]);
  const dead = new World(lv);
  for (let i = 0; i < 240 && !dead.dead; i++) dead.frame(false);
  assert.equal(dead.dead, true, '不跳应该撞死');

  const alive = new World(lv);
  for (let i = 0; i < 240 && !alive.dead; i++) {
    // 提前 ~1.6 块起跳
    const near = 20 * U - (alive.x + P.box);
    alive.frame(near < 1.6 * U && near > 0);
  }
  assert.equal(alive.dead, false, '跳过去不该死');
  assert.ok(alive.x > 26 * U, '应该已经越过尖刺,x = ' + (alive.x / U).toFixed(1) + ' 块');
});

test('平台:从上面落下会站住(脚底 = 台面),而且不致死', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: 1, w: 40, h: 1 },     // 必须铺在玩家的下落路径上,否则他会直接落到地面
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
  ]);
  const w = new World(lv);
  w.y = 4 * U; w.vy = 0; w.onGround = false;
  for (let i = 0; i < 120; i++) w.frame(false);
  assert.equal(w.dead, false, '平台不该致死');
  assert.ok(Math.abs(w.y - 2 * U) < 0.001, '脚底应该停在台面 2 块处,实际 ' + (w.y / U).toFixed(3));
});

test('实心方块:撞侧面死,从上面落下能站住', () => {
  const side = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 20, r: 0, w: 2, h: 1 },
  ]);
  const a = new World(side);
  for (let i = 0; i < 240 && !a.dead; i++) a.frame(false);
  assert.equal(a.dead, true, '侧撞方块应该死');

  const top = solo([{ kind: 'block', b: 0, r: 0, w: 40, h: 1 }]);
  const b = new World(top);
  b.y = 4 * U; b.vy = 0; b.onGround = false;
  for (let i = 0; i < 120; i++) b.frame(false);
  assert.equal(b.dead, false, '落在方块顶上不该死');
  assert.ok(Math.abs(b.y - U) < 0.001, '应该站在方块顶面 1 块处,实际 ' + (b.y / U).toFixed(3));
});

test('坑:没有地板就掉下去,掉出世界算死', () => {
  const lv = solo([{ kind: 'platform', b: 0, r: -1, w: 18, h: 1 }]);   // 18 块之后是坑
  const w = new World(lv);
  for (let i = 0; i < 600 && !w.dead; i++) w.frame(false);
  assert.equal(w.dead, true, '掉坑应该死');
});

test('存档点:跨过之后死亡从存档点重来,而且会记住形态', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'check', b: 10, r: 0, w: 1, h: 1 },
    { kind: 'spike', b: 30, r: 0, w: 1, h: 1 },
  ]);
  const w = new World(lv);
  for (let i = 0; i < 400 && !w.dead; i++) w.frame(false);
  assert.equal(w.dead, true);
  w.respawn();
  assert.ok(Math.abs(w.checkX - 10 * U) < 0.001, '重来位置应在第 10 块,实际 ' + (w.checkX / U).toFixed(1));
  assert.ok(Math.abs(w.x - 10 * U) < 0.001, '复活后就站在存档点');
  assert.equal(w.checkMode, 'cube');
});

test('圆环:跨过去切形态;已经在它右边时不会误触发', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'portal', b: 10, r: 4, w: 1, h: 1, to: 'ship' },
  ]);
  const w = new World(lv);
  for (let i = 0; i < 200; i++) w.frame(false);
  assert.equal(w.mode, 'ship', '跨过圆环应该切成飞机');

  const past = new World(lv);
  past.x = 20 * U;                     // 直接站在圆环右边
  for (let i = 0; i < 10; i++) past.frame(false);
  assert.equal(past.mode, 'cube', '已经在右边了,不该被切形态');
});

test('飞机:按住上升、松手下落', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 90, h: 1 },
    { kind: 'portal', b: 2, r: 4, w: 1, h: 1, to: 'ship' },
  ]);
  const up = new World(lv);
  for (let i = 0; i < 28; i++) up.frame(true);      // 别按太久:飞机会撞天花板(那也是设计内)
  assert.equal(up.mode, 'ship');
  assert.equal(up.dead, false, '28 帧还不该撞天花板');
  assert.ok(up.y > 3 * U, '按住应该往上爬,y = ' + (up.y / U).toFixed(2));
  const start = up.y, vy0 = up.vy;
  for (let i = 0; i < 10; i++) up.frame(false);        // 先减速:这一段还会往上滑
  const yTop = up.y, vyMid = up.vy;
  for (let i = 0; i < 24; i++) up.frame(false);        // 速度转负之后才是真的下落
  assert.ok(vyMid < vy0, "松手后上升速度应该变小(" + vy0.toFixed(1) + " → " + vyMid.toFixed(1) + ")");
  assert.ok(up.vy < 0 && up.y < yTop, "松手后应该转为下落(y " + (yTop / U).toFixed(2) + " → " + (up.y / U).toFixed(2) + " 块, vy " + up.vy.toFixed(1) + ")");
  assert.ok(up.y < start + 1.2 * U, "松手后不该继续爬升(起点 " + (start / U).toFixed(2) + " 块)");
});

/* ---------------- ③ 弹簧 / 跳环(用户点名要的玩法) ---------------- */
test('弹簧:碰到就弹,不用按任何键(峰值约 3.9 块,比普通起跳高一倍)', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 90, h: 1 },
    { kind: 'pad', b: 20, r: 0, w: 1, h: 1, pad: 'yellow' },
  ]);
  const w = new World(lv);
  let peak = 0;
  for (let i = 0; i < 60 * 6 && !w.dead; i++) { w.frame(false); peak = Math.max(peak, w.y); }
  assert.equal(w.dead, false, '弹簧不该致死');
  assert.ok(peak / U > 3.4, '完全不按键也应该被弹起来,实测峰值 ' + (peak / U).toFixed(2) + ' 块');
  assert.ok(w.x > 26 * U, '应该被弹过弹簧,x = ' + (w.x / U).toFixed(1));
});

test('弹簧连:一整段"零输入"也能过去 —— 连续鼓点直接交给弹簧,人不用打', () => {
  const span = arcSpan(PAD.yellow.v, 1);
  const pads = [10, 10 + span, 10 + 2 * span];
  const objects: Level['objects'] = [{ kind: 'platform', b: 0, r: -1, w: 120, h: 1 }];
  for (const b of pads) {
    objects.push({ kind: 'pad', b, r: 0, w: 1, h: 1, pad: 'yellow' });
    /* 弹簧弧线【最高点】下方摆两根刺:玩家此刻离地 3.9 块,踩不到 —— 纯白送的鼓点。
       用最高点而不是窗口边缘,是为了不受数值误差影响。 */
    objects.push({ kind: 'spike', b: b - 0.6 + span / 2 - 0.6, r: 0, w: 1, h: 1 });
    objects.push({ kind: 'spike', b: b - 0.6 + span / 2 + 0.6, r: 0, w: 1, h: 1 });
  }
  const w = new World(solo(objects));
  for (let i = 0; i < 60 * 4 && !w.dead; i++) w.frame(false);      // 一次都没按
  assert.equal(w.dead, false, '零输入不该死(死在第 ' + (w.x / U).toFixed(1) + ' 块)');
  assert.ok(w.x / U > pads[2] + 2, '应该被三根弹簧一路弹过去,x = ' + (w.x / U).toFixed(1) + ' / 最后一根在 ' + pads[2].toFixed(1));
});

test('跳环:要一次【新的按键】才生效 —— 按住不放串不起环(原作口径)', () => {
  const mk = () => new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'orb', b: 20, r: 2, w: 1, h: 1, orb: 'yellow' },
  ]));
  const place = (w: World) => { w.x = 20 * U - 12; w.y = 2 * U; w.vy = 0; w.onGround = false; };

  /* ① 一直按住:第一次"按"会被空中用掉……这里玩家从空中开始,所以第一帧就是新的一下 → 环生效。
        于是换个更贴近实战的比法:先按一下(消耗掉),再按住不放 → 环不该生效。 */
  const held = mk();
  place(held);
  held.frame(true);                       // 这一次按下被环用掉
  const vyAfterRing = held.vy;
  assert.ok(vyAfterRing > ORB.yellow.v * 0.8, '第一次按就该吃到环,vy = ' + vyAfterRing.toFixed(2));
  /* 环只能用一次:同一个环不会再触发 */
  place(held);
  const before = held.vy;
  held.frame(true);
  assert.ok(Math.abs(held.vy - before) < 0.9, '同一个环不该反复触发,vy ' + before.toFixed(2) + ' → ' + held.vy.toFixed(2));

  /* ② 不按:环当没看见,自由落体 */
  const idle = mk();
  place(idle);
  for (let i = 0; i < 8; i++) idle.frame(false);
  assert.ok(idle.vy < 0, '不按 → 应该在下落,vy = ' + idle.vy.toFixed(2));

  /* ③ 松一帧再按 = 新的一下 → 生效(这正是 botThink 的做法) */
  const repress = mk();
  place(repress);
  repress.frame(false);
  repress.frame(true);
  repress.frame(true);
  assert.ok(repress.vy > ORB.yellow.v * 0.8, '松一帧再按应该拿到新的一下,vy = ' + repress.vy.toFixed(2));
});

test('蓝环:翻转重力 —— 之后是"往上掉"', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'orb', b: 20, r: 2, w: 1, h: 1, orb: 'blue' },
  ]);
  const w = new World(lv);
  w.x = 20 * U - 12; w.y = 2 * U; w.vy = 0; w.onGround = false;
  for (let i = 0; i < 3; i++) w.frame(true);
  assert.equal(w.gdir, -1, '蓝环应该把重力翻过来');
  const y0 = w.y;
  for (let i = 0; i < 40; i++) w.frame(false);
  assert.ok(w.y > y0, '重力翻过来之后应该往上"掉",y ' + (y0 / U).toFixed(2) + ' → ' + (w.y / U).toFixed(2));
});

/* ---------------- ③b 其它形态(球 / UFO / 波浪 / 机器人 / 蜘蛛) ---------------- */
const floor60 = { kind: 'platform' as const, b: 0, r: -1, w: 60, h: 1 };

test('球:点一下翻重力、重力只有 0.6 倍,而且会贴着天花板跑', () => {
  const w = new World(solo([floor60]));
  w.mode = 'ball'; w.y = 6 * U; w.onGround = false;
  for (let i = 0; i < 20; i++) w.frame(false);
  const fall = -w.vy;
  const cubeFall = P.gravity * 20;                       // 方块同样帧数掉出来的速度
  assert.ok(Math.abs(fall - cubeFall * P.ballGravityMul) < 2, '球的重力应该约 0.6 倍(20 帧后 vy=' + (-fall).toFixed(1) + ',方块同帧约 ' + cubeFall.toFixed(1) + ')');
  w.frame(true);                                          // 点一下 → 翻重力
  assert.equal(w.gdir, -1, '球点一下应该翻重力');
  for (let i = 0; i < 90 && !w.dead; i++) w.frame(false);
  assert.equal(w.dead, false, '翻重力之后不该摔死');
  assert.ok(Math.abs(w.y - (ROWS * U - P.box)) < 0.5, '球应该贴到天花板上,y=' + (w.y / U).toFixed(2) + ' 块');
});

test('UFO:点一下给一次上冲,松手会掉;上下限是 8 / -6.4', () => {
  const w = new World(solo([floor60]));
  w.mode = 'ufo'; w.y = 2 * U; w.onGround = false;
  w.frame(true);
  assert.ok(w.vy > 5, '点一下应该有明显上冲,vy=' + w.vy.toFixed(1));
  let peak = w.y;
  for (let i = 0; i < 30; i++) { w.frame(false); peak = Math.max(peak, w.y); }
  assert.ok(peak > 2 * U + 20, '按完之后应该继续往上滑一段(峰值 ' + (peak / U).toFixed(2) + ' 块)');
  assert.ok(w.vy < 0, '然后转为下坠(vy=' + w.vy.toFixed(2) + ')');
  const w2 = new World(solo([floor60]));
  w2.mode = 'ufo'; w2.y = 8 * U; w2.onGround = false;
  for (let i = 0; i < 60; i++) w2.frame(false);
  assert.ok(w2.vy >= P.flyDownMax - 1e-6, '下坠不该超过 ' + P.flyDownMax + '(实际 ' + w2.vy.toFixed(2) + ')');
});

test('波浪:按住就上、松开就下,而且永远是 45 度(垂直速度 = 水平速度)', () => {
  const w = new World(solo([floor60]));
  w.mode = 'wave'; w.y = 3 * U; w.onGround = false;
  for (let i = 0; i < 4; i++) w.frame(true);
  assert.ok(Math.abs(w.vy - w.vx) < 1e-6, '按住时 vy 应该正好等于 vx(45°),vy=' + w.vy.toFixed(3) + ' vx=' + w.vx.toFixed(3));
  const yTop = w.y;
  for (let i = 0; i < 6; i++) w.frame(false);
  assert.ok(Math.abs(w.vy + w.vx) < 1e-6, '松开时 vy = −vx');
  assert.ok(w.y < yTop, '松开应该往下走');
});

test('机器人:起跳只有方块的一半,但按住不放能"浮"一段(抵消自身重力)', () => {
  const mk = () => { const w = new World(solo([floor60])); w.mode = 'robot'; return w; };
  const tap = mk();
  let peakTap = 0;
  for (let i = 0; i < 60; i++) { tap.frame(i < 1); peakTap = Math.max(peakTap, tap.y); }
  const hold = mk();
  let peakHold = 0;
  for (let i = 0; i < 60; i++) { hold.frame(true); peakHold = Math.max(peakHold, hold.y); }
  assert.ok(peakTap / U > 0.4 && peakTap / U < 0.85, '机器人轻点峰值约 0.5~0.8 块(实测 ' + (peakTap / U).toFixed(2) + ')');
  assert.ok(peakHold > peakTap * 1.6, '按住应该浮得更高(轻点 ' + (peakTap / U).toFixed(2) + ' 块 → 按住 ' + (peakHold / U).toFixed(2) + ' 块)');
});

test('蜘蛛:点一下传到对面(地板 ↔ 天花板),并翻重力', () => {
  const w = new World(solo([floor60, { kind: 'platform', b: 0, r: 6, w: 60, h: 1 }]));
  w.mode = 'spider';
  for (let i = 0; i < 10; i++) w.frame(false);
  w.frame(true);
  assert.equal(w.gdir, -1, '蜘蛛点一下应该翻重力');
  assert.ok(w.y / U > 4, '应该被传到上面那层(y=' + (w.y / U).toFixed(2) + ' 块)');
  w.frame(false);
  w.frame(true);
  assert.equal(w.gdir, 1, '再点一下应该翻回来');
  assert.ok(w.y / U < 1, '应该回到地面上(y=' + (w.y / U).toFixed(2) + ' 块)');
});

/* ---------------- ③c 物件补全:刺的档位 / 锯片 / 黑环 ---------------- */
test('小刺与大刺:判定高度跟着 h 走(小刺 0.5、大刺 1.5)', () => {
  const mk = (h: number) => new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'spike', b: 20, r: 0, w: 1, h },
  ]));
  const small = mk(0.5);
  const hSmall = small.hazards[0].y1 - small.hazards[0].y0;
  const big = mk(1.5);
  const hBig = big.hazards[0].y1 - big.hazards[0].y0;
  assert.ok(Math.abs(hSmall - 0.35 * U) < 0.01, '小刺判定高 ' + (hSmall / U).toFixed(2) + ' 块(应 0.35)');
  assert.ok(Math.abs(hBig - 1.05 * U) < 0.01, '大刺判定高 ' + (hBig / U).toFixed(2) + ' 块(应 1.05)');
  /* 大刺跳不过去(一跳峰值 2.17 块,内框够得着 1.05 块的大刺),小刺一跳就过 */
  const run = (w: World) => { for (let i = 0; i < 300 && !w.dead && w.x < 30 * U; i++) w.frame(i > 60 && i < 70); return w; };
  assert.equal(run(mk(0.5)).dead, false, '小刺应该跳得过去');
  assert.equal(run(mk(1.5)).dead, true, '大刺一跳是过不去的(它就是拿来封路的)');
});

test('锯片:整格吃人 —— 从旁边跑过去会死,从下面钻过去没事', () => {
  const low = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'saw', b: 20, r: 0, w: 1, h: 1 },
  ]));
  for (let i = 0; i < 300 && !low.dead; i++) low.frame(false);
  assert.equal(low.dead, true, '贴着地面撞上锯片应该死');

  const hi = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'saw', b: 20, r: 3, w: 1, h: 1 },     // 吊在高处
  ]));
  for (let i = 0; i < 300 && !hi.dead && hi.x < 30 * U; i++) hi.frame(false);
  assert.equal(hi.dead, false, '从下面跑过去不该死(锯片只在它自己那格里吃人)');
  assert.ok(hi.x > 25 * U, '应该跑过去了');
});

test('黑环(冲刺):不管当前速度,直接把垂直速度设成 15 并朝重力方向', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'orb', b: 20, r: 2, w: 1, h: 1, orb: 'black' },
  ]);
  const w = new World(lv);
  w.x = 20 * U - 12; w.y = 2 * U; w.vy = 6; w.onGround = false;   // 本来在往上飞
  w.frame(true);
  assert.ok(Math.abs(w.vy + ORB.black.v) < 1.2, '黑环应该把速度设成朝下的 15,实测 vy=' + w.vy.toFixed(2));
});

test('力场:人进到里面会被推 —— 往上推得比重力狠就能托住人', () => {
  /* fy = +2.0 单位/帧² 大于重力 0.958 → 在力场里应该被托着往上走 */
  const lift = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'force', b: 16, r: 0, w: 6, h: 6, fy: 2.0 },
  ]));
  let maxY = 0;
  for (let i = 0; i < 60 * 6 && !lift.dead; i++) { lift.frame(false); maxY = Math.max(maxY, lift.y); }
  assert.equal(lift.dead, false, '力场里不该死(它是往上托的)');
  assert.ok(maxY / U > 3, '上升气流应该把人托到高处,实测峰值 ' + (maxY / U).toFixed(2) + ' 块');

  /* 反过来的力场(往下压)会把人按在地上 */
  const push = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'force', b: 16, r: 0, w: 6, h: 6, fy: -4.0 },
  ]));
  for (let i = 0; i < 60 * 6 && !push.dead; i++) push.frame(i > 100 && i < 140);   // 跳一下试试
  assert.equal(push.dead, false, '向下压的力场不该致死');
  assert.ok(push.y < 0.2 * U, '被压着应该起不来,实测 y=' + (push.y / U).toFixed(2) + ' 块');
});

test('功能块(text):纯视觉物件,不影响判定', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'text', b: 10, r: 5, w: 2, h: 1, text: '按住 = 连跳' },
  ]);
  const w = new World(lv);
  for (let i = 0; i < 300 && !w.dead && w.x < 30 * U; i++) w.frame(false);
  assert.equal(w.dead, false, '功能块不该致死不挡路');
  assert.equal(w.decos.length >= 0, true);
  assert.equal(lv.objects.filter((o) => o.kind === 'text').length, 1);
});

/* ---------------- ④ 自动铺面 ---------------- */
test('自动铺面:两次"出手"之间留够落地的余量(不会生成必死关)', () => {
  for (const seed of [1, 7, 20260913, 424242]) {
    const lv = generateLevel({ seed });
    const gap = tightestGap(lv);
    /* 铺面现在按 onset 走,间距由图案几何决定(见 level.ts):一次出手之后必然有一段落地的量,
       所以"两次出手"最近也不会重叠。真正的地基还是下面的机器人 0 死亡。 */
    assert.ok(gap >= 1.4, 'seed ' + seed + ' 的最小间距 ' + gap.toFixed(2) + ' 块 —— 太挤了');
  }
});

test('自动铺面:障碍真的落在鼓点上(不是"每 6 块放一个")', () => {
  const lv = generateLevel({ seed: 20260913 });
  const beats = lv.beats!;
  assert.ok(beats && beats.length > 500, '应该带着采音数据');
  let onBeat = 0, total = 0;
  for (const o of lv.objects) {
    /* 环是"弧线上的第二段",故意不吸到 beat 上(按一次键就同时触发跳和环),所以不算它 */
    if (!(o.kind === 'spike' || o.kind === 'pad' || o.kind === 'pit')) continue;
    const t = tOfX(lv, o.b);
    let near = Infinity;
    for (const b of beats) { const d = Math.abs(b - t); if (d < near) near = d; }
    total++;
    if (near < 0.12) onBeat++;
  }
  const ratio = onBeat / total;
  assert.ok(total > 250, '地面物件太少,铺面不够密:' + total);
  assert.ok(ratio > 0.8, '只有 ' + (ratio * 100).toFixed(1) + '% 的障碍踩在鼓点上(需要 > 80%)');
});

test('自动铺面:用上了弹簧与跳环,而且长度贴着歌曲时长', () => {
  const lv = generateLevel({ seed: 20260913 });
  const c = countKinds(lv);
  assert.ok((c['pad:yellow'] ?? 0) >= 30, '弹簧太少:' + JSON.stringify(c));
  assert.ok((c['orb:yellow'] ?? 0) >= 12, '跳环太少:' + JSON.stringify(c));
  assert.ok((c['spike'] ?? 0) >= 150, '尖刺太少:' + JSON.stringify(c));
  assert.ok(lv.objects.length > 450, '物件总数太少:' + lv.objects.length);
  const end = tOfX(lv, lv.length);
  assert.ok(Math.abs(end - 156.76) < 0.3, '关卡结束时间 ' + end.toFixed(2) + 's 应该贴着歌曲时长 156.76s');
});

test('自动铺面:每个段落都有对应形态的圆环与速度门', () => {
  const lv = generateLevel({ seed: 20260913 });
  for (const sg of lv.segments) {
    const portal = lv.objects.find((o) => o.kind === 'portal' && Math.abs(o.b - (sg.from + 0.25)) < 0.001);
    assert.ok(portal, (sg.label || sg.mode) + ' 段首应有圆环');
    assert.equal(portal!.to, sg.mode, (sg.label || sg.mode) + ' 的圆环应切成 ' + sg.mode);
    assert.ok(lv.objects.some((o) => o.kind === 'speed' && Math.abs(o.b - sg.from) < 0.001),
      (sg.label || sg.mode) + ' 段首应有速度门(而且必须在段首【正好】的位置,否则 x(t) 对不上节拍)');
  }
});

test('自动铺面:机器人能 0 死亡跑完整关(这是"铺面真的能过"的证明)', () => {
  const lv = generateLevel({ seed: 20260913 });
  const run = recordBot(lv, 60 * 900);
  assert.equal(run.deaths, 0, '机器人死了 ' + run.deaths + ' 次(铺面有必死处)');
  assert.equal(run.done, true, '机器人没跑到终点,x = ' + (run.states[run.states.length - 1].x / U).toFixed(1) + '/' + lv.length + ' 块');
  assert.equal(run.states[run.states.length - 1].progress, 1, '进度应该是 100%');
});

/* ---------------- ④ 确定性 ---------------- */
test('回放:同一卷输入两次跑出来完全一致(定点步长的地基)', () => {
  const lv = generateLevel({ seed: 20260913 });
  const rec = recordBot(lv, 60 * 900);
  const a = replay(lv, rec.tape);
  const b = replay(lv, rec.tape);
  assert.equal(fingerprint(a.states), fingerprint(b.states), '两次回放指纹应一致');
  assert.equal(fingerprint(a.states), fingerprint(rec.states), '回放应该复现机器人那一遍');
});

test('回放:换一卷输入(或换一关)指纹就不同 —— 指纹真的在起作用', () => {
  const lv = generateLevel({ seed: 20260913 });
  const rec = recordBot(lv, 60 * 900);
  const flipped = rec.tape.map((h, i) => (i % 7 === 0 ? !h : h));
  assert.notEqual(fingerprint(replay(lv, flipped).states), fingerprint(rec.states), '改了输入指纹应该变');
  const other = generateLevel({ seed: 999 });
  assert.notEqual(fingerprint(recordBot(other, 60 * 900).states), fingerprint(rec.states), '换了关卡指纹应该变');
});

/* ---------------- ⑤ 架构约束:核心不许依赖引擎/浏览器 ---------------- */
test('模拟核心零依赖:src/sim 里不许出现 phaser / window / document', () => {
  const dir = join(HERE, '..', 'src', 'sim');
  for (const f of readdirSync(dir)) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.ok(!/from\s+['"]phaser['"]/.test(src), f + ' 不该 import phaser');
    assert.ok(!/\bwindow\.|\bdocument\./.test(src), f + ' 不该用浏览器 API');
  }
});
