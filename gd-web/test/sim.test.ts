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
import { decodeGmd, encodeGmdText, parseGmdText } from '../src/sim/gmd.ts';
import { coverage, formatReport } from '../src/sim/gdmap.ts';
import { gzipSync, gunzipSync } from 'node:zlib';

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

test('实心方块:★ 落台容错的容差是 15 单位(原版 snapUpThreshold)、撞侧面该死、从上面落下能站住', () => {
  /* 出处:gdp 反编译 PlayerObject_collidedWithObjectInternal ——
       snapUpThreshold:正常/大形态 15、迷你 10、飞行类 6;
       判定是 maxSnapY = playerBottom + snapUpThreshold 越过物件顶面。
     ★ 也就是说容错【只修脚底离顶面那一点点】:站地面上撞一格台阶(差 30 单位)在原版是撞死,
       不会"自动上台阶"。我们上一版按"外框顶越过砖中线"判,一格台阶能被整块抬上去 ——
       用户看到的"容错直接飞上平台"就是它。 */
  const lv1 = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 20, r: 1, w: 2, h: 2 },      // 顶面 = 3 块 = 90 单位
  ]);
  const near = new World(lv1);
  near.x = 20.6 * U; near.y = 3 * U - 12; near.vy = -1; near.onGround = false;   // 差 12 单位(容差内)
  near.frame(false);                                    // 只看第一帧:再往后人就跑出这块砖的右边掉下去了
  assert.equal(near.dead, false, '差 12 单位(容差内)不该死');
  assert.ok(Math.abs(near.y - 3 * U) < 1, '应该被抬到 3 块处,实际 ' + (near.y / U).toFixed(3));

  const far = new World(lv1);
  far.x = 20.6 * U; far.y = 3 * U - 25; far.vy = -1; far.onGround = false;       // 差 25 单位(超容差)
  for (let i = 0; i < 20 && !far.dead; i++) far.frame(false);
  assert.equal(far.dead, true, '差 25 单位(超出容差)应该撞死');

  const step = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 20, r: 0, w: 2, h: 1 },      // 一格高的台阶:跑过去差 30 单位
  ]);
  const walk = new World(step);
  for (let i = 0; i < 240 && !walk.dead; i++) walk.frame(false);
  assert.equal(walk.dead, true, '地面上撞一格台阶应该死(原版没有自动上台阶)');

  const wall = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 20, r: 0, w: 2, h: 3 },
  ]);
  const c = new World(wall);
  for (let i = 0; i < 240 && !c.dead; i++) c.frame(false);
  assert.equal(c.dead, true, '三格高的墙侧撞应该死');

  const top = solo([{ kind: 'block', b: 0, r: 0, w: 40, h: 1 }]);
  const b = new World(top);
  b.y = 4 * U; b.vy = 0; b.onGround = false;
  for (let i = 0; i < 120; i++) b.frame(false);
  assert.equal(b.dead, false, '落在方块顶上不该死');
  assert.ok(Math.abs(b.y - U) < 0.001, '应该站在方块顶面 1 块处,实际 ' + (b.y / U).toFixed(3));
});

test('落块吸附:连台阶时把 x 拉回上一次落点的相对位置(出处 gdp checkSnapJumpToObject)', () => {
  /* 原版每落到新方块上会看它和【上一次落的那块】差多少:速度档 1(0.9×)时
     littleStair = 120 单位 = 4 块右 + 1 块上,容差 threshold = 1 —— 正好差这一档就把人的 x
     拉回"和上次落点相同的相对位置",最多挪 1 单位。这里用两块方块验它:
       A(0,0) → B(4,1) 是标准台阶(吸附生效);B'(5,1) 差 150 单位(不匹配,作为对照)。 */
  const mk = (bx: number) => solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 0, r: 0, w: 1, h: 1 },
    { kind: 'block', b: bx, r: 1, w: 1, h: 1 },
  ]);
  const land = (bx: number, off: number) => {
    const w = new World(mk(bx));
    w.x = 5; w.y = U; w.vy = 0; w.onGround = true;
    for (let i = 0; i < 3; i++) w.frame(false);           // 先在 A 上落稳,记下相对位置
    w.x = bx * U + off;                                   // 摆到 B 正上方
    w.y = 2 * U; w.vy = -0.5; w.onGround = false;
    w.frame(false); w.frame(false);
    return w.x;
  };
  const snapped = land(4, 5);          // 标准台阶 → 吸附
  const control = land(5, 5);          // 差 150 单位 → 不吸附
  assert.ok(Math.abs((snapped - control) + 30) <= 1.5,
    '台阶那一档应该把 x 往右拉约 1 单位(相对对照),实测吸附 ' + snapped.toFixed(2)
    + ' vs 对照 ' + control.toFixed(2) + '(两者相差应≈−30+1)');
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
  for (let i = 0; i < 18; i++) up.frame(true);      // 别按太久:飞机会撞天花板(那也是设计内)
  assert.equal(up.mode, 'ship');
  assert.equal(up.dead, false, '28 帧还不该撞天花板');
  assert.ok(up.y > 3 * U, '按住应该往上爬,y = ' + (up.y / U).toFixed(2));
  const start = up.y, vy0 = up.vy;
  for (let i = 0; i < 10; i++) up.frame(false);        // 先减速:这一段还会往上滑
  const yTop = up.y, vyMid = up.vy;
  for (let i = 0; i < 60; i++) up.frame(false);        // 速度转负、并且真的掉下来(原版飞机加速度比旧版小)
  assert.ok(vyMid < vy0, "松手后上升速度应该变小(" + vy0.toFixed(1) + " → " + vyMid.toFixed(1) + ")");
  assert.ok(up.vy < vyMid && up.y < yTop, "松手后速度要往下走(y " + (yTop / U).toFixed(2) + " → " + (up.y / U).toFixed(2) + " 块, vy " + vyMid.toFixed(1) + " → " + up.vy.toFixed(1) + ")");
  assert.ok(up.y < start + 2.6 * U, "松手后不该一直往上爬(起点 " + (start / U).toFixed(2) + " 块,现在 " + (up.y / U).toFixed(2) + ")");
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

test('球:重力只有 0.6 倍;★ 只有站在地面上点一下才跳(跳=先给初速再翻重力,速度再减半 ×0.6)', () => {
  const w = new World(solo([floor60]));
  w.mode = 'ball'; w.y = 6 * U; w.onGround = false;
  for (let i = 0; i < 20; i++) w.frame(false);
  const fall = -w.vy;
  const cubeFall = P.gravity * 20;                       // 方块同样帧数掉出来的速度
  assert.ok(Math.abs(fall - cubeFall * P.ballGravityMul) < 2, '球的重力应该约 0.6 倍(20 帧后 vy=' + (-fall).toFixed(1) + ',方块同帧约 ' + cubeFall.toFixed(1) + ')');
  /* ★ 原版口径(OpenGD PlayerObject::updateJump 的 ball 分支):按下要"在地面上"才算跳,
     空中按不会翻重力(以前我们写成了"随时翻")。 */
  const gdir0 = w.gdir;
  w.frame(true);
  assert.equal(w.gdir, gdir0, '空中点一下不该翻重力(球只有落地才跳)');

  /* 落地,再点一下:应该翻重力 + 往上弹
     ★ 初速 = jump → 翻重力【÷2】→ ×0.6
       出处:OpenGD(2.2)`playerobject.cpp:540 m_dYVel /= 2.f`。
       (gdp@2.11 反编译写的是 `m_yAccel *= 1.75`,两张源直接冲突;
        最后按【关卡自己的证据】定案 = 减半:本关 x=714~727 那段垫板走廊
        在 ×1.75 下无解、在 ÷2 下过得去 —— 详见 src/sim/world.ts 里 FLIP_VEL_MUL 的注释。) */
  const w2 = new World(solo([floor60]));
  w2.mode = 'ball'; w2.y = 6 * U; w2.onGround = false;
  for (let i = 0; i < 120 && !w2.onGround; i++) w2.frame(false);
  assert.equal(w2.onGround, true, '应该落到地面上');
  w2.frame(true);
  assert.equal(w2.gdir, -1, '在地面上点一下应该翻重力');
  assert.ok(w2.vy > 0, '而且要给一个向上的初速,vy=' + w2.vy.toFixed(2));
  const expect = P.jump * 0.5 * P.ballFlipVelMul;
  assert.ok(Math.abs(w2.vy - expect) < 0.8,
    '初速应该是 jump÷2×0.6 ≈ ' + expect.toFixed(2) + ' 上下(实测 ' + w2.vy.toFixed(2) + ',含本帧已翻重力的那几步)');
  for (let i = 0; i < 20 && !w2.dead; i++) w2.frame(false);
  assert.ok(w2.y > 1.5 * U, '反重力应该一路往上飞,y=' + (w2.y / U).toFixed(2) + ' 块');

  /* ★ 按住不放【只翻一次】(原版:翻完就把 m_jumpBuffered 清掉)——
     用户实测过"按住时球在两个面之间一直弹、鬼畜",那就是"按住每个落点都翻"。 */
  const wHeld = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 0, r: 6, w: 60, h: 1 },       // 上面来一层"天花板",让它有落点
  ]));
  wHeld.mode = 'ball'; wHeld.y = 1 * U; wHeld.onGround = true;
  let flips = 0, g0 = wHeld.gdir;
  for (let i = 0; i < 180 && !wHeld.dead; i++) {
    wHeld.frame(true);                                 // ★ 全程按住
    if (wHeld.gdir !== g0) { flips++; g0 = wHeld.gdir; }
  }
  assert.equal(flips, 1, '按住 180 帧应该只翻一次重力,实际翻了 ' + flips + ' 次');

  /* ★ 关卡顶【不是】天花板(原版口径:反重力撞到真方块才停)。给它一层天花板方块,应该贴在它下面。 */
  const w3 = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 0, r: 8, w: 60, h: 1 },
  ]));
  w3.mode = 'ball'; w3.y = 6 * U; w3.onGround = false; w3.gdir = -1;   // 直接给反重力,看它会不会停在方块底面
  for (let i = 0; i < 200 && !w3.dead && !w3.onGround; i++) w3.frame(false);
  assert.equal(w3.dead, false, '不该死');
  assert.ok(Math.abs(w3.y + P.box - 8 * U) < 0.5, '应该贴在方块【底面】(y=' + (w3.y / U).toFixed(2) + ' + 1 块 = 8)');
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

test('蜘蛛:点一下传到对面(够得着的天花板),并翻重力;够不到就不动', () => {
  /* ★ 可达距离照原版 checkSnapJumpToObject:常速只有 3 格(90 单位),
     所以这里把天花板摆在伸手够得到的地方(3 格)。 */
  const w = new World(solo([floor60, { kind: 'platform', b: 0, r: 3, w: 60, h: 1 }]));
  w.mode = 'spider';
  for (let i = 0; i < 10; i++) w.frame(false);
  w.frame(true);
  assert.equal(w.gdir, -1, '蜘蛛点一下应该翻重力');
  assert.ok(w.y / U > 1.5, '应该被传到上面那层(y=' + (w.y / U).toFixed(2) + ' 块)');
  /* 够不到的天花板(r=6,离 5 格 > 3 格可达)→ 什么也不该发生 */
  const far = new World(solo([floor60, { kind: 'platform', b: 0, r: 8, w: 60, h: 1 }]));
  far.mode = 'spider';
  for (let i = 0; i < 10; i++) far.frame(false);
  const g0 = far.gdir;
  far.frame(true);
  assert.equal(far.gdir, g0, '天花板够不到时不该翻重力(原版就是"没得贴就继续掉")');
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
  assert.ok(Math.abs(hSmall - (5.6 / 30) * U) < 0.01, '小刺判定高 ' + (hSmall / U).toFixed(3) + ' 块(原版表 39 → h5.6 w6 单位 = 0.19 块高)');
  assert.ok(Math.abs(hBig - 0.7 * U) < 0.01, '大刺判定高 ' + (hBig / U).toFixed(2) + ' 块(表里没有 1.5 倍的大刺,按 12×21 单位估)');
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

test('锯片(真 ID 1705 + 缩放):判定是【圆】(半径查表),不是贴图盒', () => {
  /* 出处:OpenGD `LongData.cpp:461` 的 `_pHitboxRadius`(1705 → 32.3 单位 = 1.077 块)
     + `playlayer.cpp:1491-1503`(有半径的走 intersectsCircle,没半径的走矩形)。
     贴图盒是 44×85 单位(1.47×2.83 块)—— 拿它当判定会把这块"角"判死。 */
  const sawAt = (r: number) => new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'saw', id: 1705, b: 20, r, w: 44 / 30, h: 85 / 30 },
  ]));
  const w = sawAt(0);
  assert.equal(w.circles.length, 1, '带 1705 的锯片必须进圆形表');
  assert.ok(Math.abs(w.circles[0].r / U - 32.3 / 30) < 1e-6,
    '半径 = 表里的 32.3 单位(1.077 块),实测 ' + (w.circles[0].r / U).toFixed(3));
  assert.ok(Math.abs(w.circles[0].r / U - 1.077) < 0.01, '半径不是 85/2 单位(那才是矩形的一半)');

  /* 从旁边跑过去会死 —— 圆心就在路上 */
  for (let i = 0; i < 300 && !w.dead; i++) w.frame(false);
  assert.equal(w.dead, true, '贴着地面撞上锯片圆心当然死');

  /* ★ 关键 A/B:圆心 21.5、半径 = 32.3×1.52/30 = 1.636 块 → 圆顶 23.14;贴图盒顶 23.65。
     站在顶面 23.2 的台面上滚过去:圆顶比 23.2 还低 0.06 块 → 圆口径【活着】;
     旧口径(贴图盒 + 玩家内框:内框下沿 = 中心 − 0.125 = 23.575 < 23.653)= 【判死】。
     这 0.14 块就是这一段"以前搜不过去、现在能过"的全部原因(见 tools/check-wall.ts)。 */
  const SC = 1.52, TB = 23.2;
  const roll = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'platform', b: 0, r: TB - 1, w: 40, h: 1 },
    { kind: 'saw', id: 1705, b: 20, r: 21.5 - (85 / 30) * SC / 2, w: (44 / 30) * SC, h: (85 / 30) * SC },
  ]));
  const rc = roll.circles[0];
  assert.ok(Math.abs(rc.r - 32.3 * SC) < 0.01,
    '半径 = 32.3 × 1.52 = ' + (32.3 * SC).toFixed(2) + ' 单位,实测 ' + rc.r.toFixed(2));
  assert.ok(Math.abs(rc.cy / U - 21.5) < 0.001, '圆心在物件中心 y=21.5,实测 ' + (rc.cy / U).toFixed(3));
  const circleH = (2 * rc.r) / U, spriteH = (85 / 30) * SC, spriteW = (44 / 30) * SC;
  assert.ok(circleH < spriteH - 0.9, '圆高 ' + circleH.toFixed(2) + ' 块 < 贴图盒高 ' + spriteH.toFixed(2));
  assert.ok(circleH > spriteW + 0.9, '圆宽 ' + circleH.toFixed(2) + ' 块 > 贴图盒宽 ' + spriteW.toFixed(2));
  for (let i = 0; i < 300 && !roll.dead && roll.x < 30 * U; i++) roll.frame(false);
  assert.equal(roll.dead, false, '贴着圆顶 0.06 块滚过去是活的(y=' + (roll.y / U).toFixed(2) + ')');
  assert.ok(roll.x > 25 * U, '而且要真的滚过去,x=' + (roll.x / U).toFixed(1));
  const oldNeed = 21.5 + spriteH / 2 + 0.125;          // 旧口径:贴图盒顶 + 内框半高
  assert.ok(oldNeed > TB + 0.5, '旧口径要求中心 > ' + oldNeed.toFixed(3) + ',人在 ' + (TB + 0.5).toFixed(2) + ' → 旧口径判死');
});

test('球吃环 ×0.7、吃弹簧 ×0.6 —— 两条路径的折扣【不能叠着乘】', () => {
  /* 出处(gdp@2.11):
     · 跳环 `ringJump.cpp:127-130`:`if (isBall || isSpider) { yAccel *= 0.7; isHolding = false; }`
       —— 而且是在分颜色倍率【之后】乘,黄色环本身是 ×1.0。
     · 弹簧 `propellPlayer.cpp:6-10`:`m_yAccel = 16×力度×重力方向×(迷你?0.8:1.0)`,然后球/蜘蛛 ×0.6。
     以前我们把 0.6 写在两条路共用的 applyTrigger 里 → 球吃一个黄环只剩 11.18×0.7×0.6 = 4.7,
     比原版的 7.83 小 40%。 */
  const orbWorld = () => {
    const w = new World(solo([
      { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
      { kind: 'orb', b: 2, r: 1, w: 1, h: 1, orb: 'yellow' },
    ]));
    w.reset(2 * U, 'ball', 1 * U);
    w.vy = 0; w.onGround = false;
    return w;
  };
  const o = orbWorld();
  o.frame(true);
  /* 注意:一帧里环先生效、后面 3 个子步还要吃重力,所以读到的数会比纯冲量小 0.2~0.5 */
  assert.ok(Math.abs(o.vy) > 7.2 && Math.abs(o.vy) < 7.9,
    '球吃黄环 ≈ jumpPower×0.7 = ' + (P.jump * 0.7).toFixed(3) + '(帧内还要落一点),实测 '
    + Math.abs(o.vy).toFixed(3) + ';旧的"叠乘 0.6"只会有 ' + (P.jump * 0.7 * 0.6).toFixed(2));

  const padWorld = (mode: 'ball' | 'cube') => {
    const w = new World(solo([
      { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
      { kind: 'pad', b: 3, r: 0, w: 1, h: 1, pad: 'yellow' },
    ]));
    w.reset(0, mode, 0);
    return w;
  };
  const p = padWorld('ball');
  for (let i = 0; i < 400 && !p.dead && Math.abs(p.vy) < 1; i++) p.frame(false);
  assert.ok(Math.abs(p.vy) > 8.9 && Math.abs(p.vy) < 9.7,
    '球吃黄弹簧 = 16×0.6 = 9.6,实测 ' + Math.abs(p.vy).toFixed(3));

  /* 方块吃同一根弹簧不打折 */
  const c = padWorld('cube');
  for (let i = 0; i < 400 && !c.dead && Math.abs(c.vy) < 1; i++) c.frame(false);
  assert.ok(Math.abs(c.vy) > 15.3 && Math.abs(c.vy) < 16.05,
    '方块吃黄弹簧 = 16,实测 ' + Math.abs(c.vy).toFixed(3));
});

test('刺的判定盒按 ID 查表 —— 高度四舍五入(0.063 ≈ 0.0625)不会掉出表', () => {
  /* 出处 longdata.cpp `_pHitboxes`:id 8 {12,6}、39 {5.6,6}、103 {7.6,4}、392 {4.8,2.6}(原表字段序 {h,w,x,y})。
     踩过:铺面文本把高度四舍五入到 3 位(0.0625 → 0.063),精确字符串键查不到 → 退回"物件自己的包围盒"
     = 1 格宽(30 单位),那 17 根刺的判定比原版宽 11 倍。现在按 ID 查 + 高度最近邻兜底。 */
  const mk = (o: Record<string, unknown>) => new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    o as never,
  ]));
  const wOf = (w: World) => w.hazards[0].x1 - w.hazards[0].x0;
  const byId = mk({ kind: 'spike', id: 392, b: 20, r: 0, w: 1, h: 0.0625 });
  assert.ok(Math.abs(wOf(byId) - 2.6) < 0.01, 'id 392 → 宽 2.6 单位,实测 ' + wOf(byId).toFixed(2));
  const byH = mk({ kind: 'spike', b: 20, r: 0, w: 1, h: 0.063 });     // 没有 ID,靠高度最近邻
  assert.ok(Math.abs(wOf(byH) - 2.6) < 0.01, '高度 0.063 最近邻 → 宽 2.6 单位,实测 ' + wOf(byH).toFixed(2));
  const plain = mk({ kind: 'spike', b: 20, r: 0, w: 1, h: 1 });
  assert.ok(Math.abs(wOf(plain) - 6) < 0.01, '普通刺(id 8)→ 宽 6 单位,实测 ' + wOf(plain).toFixed(2));
  const byId39 = mk({ kind: 'spike', id: 39, b: 20, r: 0, w: 1, h: 0.5 });
  assert.ok(Math.abs(wOf(byId39) - 6) < 0.01, 'id 39 → 宽 6 单位,实测 ' + wOf(byId39).toFixed(2));
});

test('飞行类碰实心:撞侧面死、擦到顶面【落上去】(flySolid 开/关各验一遍)', () => {
  /* 出处:gdp@2.11 `checkCollisions.cpp:440-445` —— 实心判定对【所有形态】都跑,
     飞机/UFO/波浪飞进砖里就是死。我们以前把这一段写在 `mode !== 飞行类` 的 guard 里,
     于是飞行类穿墙不死(只会因"世界底边 y<0"死),这个 bug 藏了很久(见 HANDOVER §13.25)。
     ★ 2026-09 又修了两处(用户:"UFO 不会踩上任何东西,碰到线框或者砖块直接穿过去"):
       · 判定盒要用【外框】(playerobject.cpp:86 `setTextureRect(Rect(0,0,30,30))`);
       · 擦到【顶面】要落上去贴着滑 —— 原版飞行类贴着地面/平台飞是安全的,只有撞侧面/底面才死。
     所以这个测试现在要同时验三件事:落顶面 ✓、撞侧面 ✗死、flySolid=关时保持旧行为。 */
  const lv = solo([floor60, { kind: 'block', b: 18, r: 2, w: 6, h: 1 }]);   // 空中一块 6×1 的台面(顶面 y=3)+ 一条地面
  const run = (flySolid: boolean, mode: 'ufo' | 'ship', x0: number) => {
    const w = new World(lv, undefined, undefined, { flySolid });
    w.reset(x0 * U, mode, 3.5 * U);
    w.speedIdx = 1; w.gdir = 1; w.vy = 0; w.onGround = false;
    /* ★ 不能只看末态:飞行类落到台面上之后会继续往前滑,30 帧后就滑出 6 格宽的台面又掉下去了。
       这里要抓的是"有没有在顶面上站住过"这一刻。 */
    let landed = -1;
    for (let f = 0; f < 200 && !w.dead; f++) {
      w.frame(false);
      if (w.onGround && landed < 0) landed = w.y / U;
      if (landed >= 0 && f > landed + 2) break;
    }
    return { landed, y: w.y / U, dead: w.dead };
  };
  /* ① 从台面斜上方落下 —— 以前是"沉进去然后死",现在应该稳稳落在 y=3 上 */
  const land = run(true, 'ufo', 19);
  assert.ok(land.landed > 0 && Math.abs(land.landed - 3) < 0.05,
    'flySolid=开:应该落在方块顶面 y=3 上,实测落点 y=' + land.landed.toFixed(2));
  /* ② 地面线:★ 2026-09 —— 原版【地面根本不是物件,地面就是这条夹取】:
        PlayLayer::checkCollisions 非方块那一支 `y < 地面节点+相机 + (迷你?87:93) ⇒ 贴回 + setYVel(0)` ✓
        ⇒ 飞行类掉到地面线会【落上去停住】,不会一路穿到世界底边 ✗
        (见 src/sim/world.ts 的 applyAirLimit;机制源头 GJFlyGroundLayer : GJGroundLayer ✓) */
  const off = run(false, 'ufo', 19);
  assert.ok(!off.dead && Math.abs(off.y) < 0.05,
    'flySolid=关(自铺面):飞行类落到【地面】上停住(原版地面夹取),实测 y=' + off.y.toFixed(2));
  /* ③ 撞【侧面】必须死(平飞撞一堵从地面顶到关卡顶的竖墙 —— 墙矮了飞行类会从上面飞过去) */
  const wall = solo([{ kind: 'block', b: 12, r: 0, w: 1, h: 38 }]);
  for (const mode of ['ufo', 'ship'] as const) {
    const w = new World(wall);
    w.reset(8 * U, mode, 6 * U); w.gdir = 1; w.vy = 0; w.onGround = false;
    for (let f = 0; f < 80 && !w.dead; f++) w.frame(false);
    assert.ok(w.dead, mode + ' 平飞撞竖墙应该死,实测活着到了 x=' + (w.x / U).toFixed(2));
  }
  /* ④ ★★★ 2026-09 限高(限制框)= 照搬源码那一夹 —— 用户:"限高代码需要照搬""机制是类似创建上下两边的地面"
        源码 PlayLayer::checkCollisions 非方块那一支:
          y > 天花板 − (迷你 ? 234 : 240) + 视口中心 − 12  ⇒ 贴回 + setYVel(0) ✓
        换到我们的坐标(我们 = 原版 − 90;原版天花板节点 = 进场高度 + 148 = 视口上边 − 12;
        我们的 y 是【脚底】不是中心 ⇒ 再减半个判定盒):
          脚底上限 = 视口上边 − 24 − 半个判定盒 ✓ */
  const capW = new World(lv, undefined, undefined, { flySolid: true });
  capW.reset(19 * U, 'ufo', 3.5 * U);
  capW.speedIdx = 1; capW.gdir = 1; capW.vy = 0;
  /* ★ 视口上边要落在【关卡顶下面】(不然先撞上"超过关卡顶即死"那一条,测不到限高) */
  capW.airHi = capW.rows * U - 60; capW.airLo = capW.airHi - 320;   // 视口 = 一屏(320 单位)
  const cap = (capW.airHi as number) - 24 - capW.box / 2;
  for (let f = 0; f < 40 && !capW.dead; f++) capW.frame(f % 8 === 0);   // 一路往上顶(别飞过铺面尽头)
  /* 硬顶一次:必须【精确贴住】天花板,不能穿过去 —— 源码那一支同时 setYVel(0) ✓ */
  capW.vy = 20; capW.frame(false);
  assert.ok(!capW.dead && Math.abs(capW.y - cap) < 0.01 && capW.vy <= 0.5,
    '限高:UFO 硬顶天花板应该精确贴住 y=' + cap.toFixed(1) + '、纵向速度清零(实测 y=' + capW.y.toFixed(2) +
    ',vy=' + capW.vy.toFixed(2) + ',死=' + capW.dead + ',关卡顶=' + (capW.rows * U) + ',x=' + (capW.x / U).toFixed(1) +
    ';视口上边 ' + capW.airHi + ' ⇒ 天花板面 ' + ((capW.airHi as number) - 12) + ')');
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

/* ---------------- ③d 触发器:分组 + move / rotate / color / pulse ---------------- */
test('move 触发器:越过它就推【分组】里的物件,而且是逐帧确定的', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'spike', b: 30, r: 0, w: 1, h: 1, groups: [7] },              // 被推的刺
    { kind: 'trigger', b: 10, r: 0, w: 1, h: 1, trigger: 'move', groups: [7], dy: 3, dur: 0.5 },
  ]);
  const a = new World(lv);
  const spikeA = a.hazards[0];
  const y0 = spikeA.y1;
  while (a.x / U < 10.5) a.frame(false);               // 越过触发器
  assert.ok(a.x / U > 10, '先要走过触发器');
  for (let i = 0; i < 10; i++) a.frame(false);
  assert.ok(spikeA.y1 > y0 + 20, '刺应该已经在被推了(判定盒真的动了),y1 ' + (y0 / U).toFixed(2) + ' → ' + (spikeA.y1 / U).toFixed(2));
  const mid = a.state.moved;
  assert.ok(mid > 0, '指纹里的"移动量"此时应该非 0(实测 ' + mid + ')');
  for (let i = 0; i < 40; i++) a.frame(false);
  assert.ok(spikeA.y1 > y0 + 3 * U - 1, '0.5 秒之后应该到位(+3 块),y1=' + (spikeA.y1 / U).toFixed(2));
  assert.notEqual(a.state.moved, mid, '到位之后的移动量和中途不一样');

  /* 同一卷输入跑两遍,移动过程也必须逐帧一致 */
  const b = new World(lv);
  const ys: number[] = [];
  for (let i = 0; i < 200; i++) { b.frame(false); ys.push(b.hazards[0].y1); }
  const c = new World(lv);
  for (let i = 0; i < 200; i++) {
    c.frame(false);
    assert.equal(c.hazards[0].y1, ys[i], '第 ' + i + ' 帧的物件位置应该一模一样');
  }
});

test('move 触发器(loop):往复移动,到位会走回来', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'block', b: 30, r: 0, w: 2, h: 1, groups: [3] },
    { kind: 'trigger', b: 10, r: 0, w: 1, h: 1, trigger: 'move', groups: [3], dy: 4, dur: 0.5, loop: true },
  ]);
  const w = new World(lv);
  const blk = w.solids[0];
  const y0 = blk.y1;
  while (w.x / U < 11) w.frame(false);
  let peak = y0, low = y0;
  for (let i = 0; i < 240; i++) { w.frame(false); peak = Math.max(peak, blk.y1); low = Math.min(low, blk.y1); }
  assert.ok(peak > y0 + 3 * U, '应该被推上去过(峰值 +' + ((peak - y0) / U).toFixed(2) + ' 块)');
  assert.ok(low < y0 + 0.5 * U, '往复应该真的走回来过(最低 ' + ((low - y0) / U).toFixed(2) + ' 块)');
});

test('color / pulse 触发器:改全局色与闪光', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'trigger', b: 10, r: 0, w: 1, h: 1, trigger: 'color', color: 0xff0000 },
    { kind: 'trigger', b: 20, r: 0, w: 1, h: 1, trigger: 'pulse', color: 0x00ff00 },
  ]);
  const w = new World(lv);
  assert.equal(w.tint, null, '一开始没有额外颜色');
  while (w.x / U < 12) w.frame(false);
  assert.equal(w.tint, 0xff0000, 'color 触发器应该换掉全局色');
  while (w.x / U < 20.5) w.frame(false);
  assert.ok(w.flash > 0.2, 'pulse 触发器应该让画面闪一下(实测强度 ' + w.flash.toFixed(2) + ')');
  for (let i = 0; i < 30; i++) w.frame(false);
  assert.equal(w.flash, 0, '闪一下之后要衰减干净');
});

/* ---------------- ③e 尺寸门(迷你 / 放大) ---------------- */
test('迷你门:碰撞盒真的变小(0.6 倍),能钻过普通身材钻不过的缝', () => {
  /* 地面到天花板吊块之间只留 0.65 块缝:普通方块(1 块)过不去,迷你(0.6 块)过得去 */
  const mk = (withPortal: boolean) => solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    ...(withPortal ? [{ kind: 'size' as const, b: 10, r: 6, w: 1, h: 1 }] : []),
    { kind: 'platform', b: 20, r: 1, w: 4, h: 1 },        // 吊在 1 块高的板 → 底下只剩 1 块
  ]);
  const normal = new World(mk(false));
  assert.ok(Math.abs(normal.box - P.box) < 1e-6, '普通身材外框 = ' + normal.box);
  const mini = new World(mk(true));
  while (mini.x / U < 11) mini.frame(false);
  assert.ok(mini.mini, '过了迷你门应该变迷你');
  assert.ok(Math.abs(mini.box - P.box * P.miniSize) < 1e-6, '迷你外框应该 = ' + (P.box * P.miniSize) + ',实测 ' + mini.box);
  assert.ok(Math.abs(mini.innerOff - P.innerOff * P.miniSize) < 1e-6, '内框偏移也要跟着缩(否则判定和身体对不上)');
  /* 迷你时跳环力度 ×0.8 */
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'size', b: 5, r: 6, w: 1, h: 1 },
    { kind: 'orb', b: 30, r: 2, w: 1, h: 1, orb: 'yellow' },
  ]);
  const w = new World(lv);
  while (w.x / U < 6) w.frame(false);
  const full = new World(solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'orb', b: 30, r: 2, w: 1, h: 1, orb: 'yellow' },
  ]));
  full.x = 30 * U - 12; full.y = 2 * U; full.vy = 0; full.onGround = false;
  full.frame(true);
  w.x = 30 * U - 12; w.y = 2 * U; w.vy = 0; w.onGround = false;
  w.frame(true);
  assert.ok(Math.abs(w.vy - full.vy * P.miniTriggerMul) < 0.2, '迷你跳环力度应该是普通的 0.8 倍(迷你 ' + w.vy.toFixed(2) + ' vs 普通 ' + full.vy.toFixed(2) + ')');
});

test('放大门:迷你之后能变回普通身材', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },
    { kind: 'size', b: 10, r: 6, w: 1, h: 1 },
    { kind: 'size', b: 20, r: 6, w: 1, h: 1, mini: false },
  ]);
  const w = new World(lv);
  while (w.x / U < 11) w.frame(false);
  assert.ok(w.mini, '先变小');
  while (w.x / U < 21) w.frame(false);
  assert.equal(w.mini, false, '过了放大门应该变回来');
  assert.ok(Math.abs(w.box - P.box) < 1e-6, '外框回到 ' + P.box);
});

/* ---------------- ③f 单向传送门 ---------------- */
test('传送门:蓝(入口)→ 橙(出口)单向;只有入口没有出口时什么也不发生', () => {
  const lv = solo([
    { kind: 'platform', b: 0, r: -1, w: 300, h: 1 },
    { kind: 'teleport', b: 20, r: 4, w: 1, h: 1, channel: 1 },
    { kind: 'teleport', b: 45, r: 4, w: 1, h: 1, channel: 1, exit: true },
  ], { length: 300 });
  const w = new World(lv);
  /* ★ 传送门的判定盒是原版的 90×25(宽 3 格)—— 提前量比"一格"大得多,所以这里按盒子算边界 */
  while (w.x / U < 16.5) w.frame(false);
  assert.ok(w.x / U < 18.4, '还没跨过入口(x=' + (w.x / U).toFixed(1) + ')');
  for (let i = 0; i < 30 && w.x / U < 40; i++) w.frame(false);
  assert.ok(w.x / U >= 43 && w.x / U < 50, '跨过入口应该出现在出口那里(现在 x=' + (w.x / U).toFixed(1) + ')');
  /* 关键:出口不再把人送回入口(单向),否则会在两个门之间来回弹 */
  const x1 = w.x;
  for (let i = 0; i < 60; i++) w.frame(false);
  assert.ok(w.x > x1 && w.x / U < 70, '应该继续往右跑,而不是被弹回去(现在 x=' + (w.x / U).toFixed(1) + ')');
  assert.equal(w.dead, false, '传送不该致死');

  /* 只有蓝入口、没有橙出口(用户那关就是这样):按原版不生效,人应该正常跑过去 */
  const only = solo([
    { kind: 'platform', b: 0, r: -1, w: 300, h: 1 },
    { kind: 'teleport', b: 20, r: 4, w: 1, h: 1, channel: 1 },
  ], { length: 300 });
  const w2 = new World(only);
  for (let i = 0; i < 200; i++) w2.frame(false);
  assert.ok(w2.x / U > 30, '没有出口时不该被传送(x=' + (w2.x / U).toFixed(1) + ')');
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

/* ---------------- ⑤ .gmd 解码 + ID 映射表 ---------------- */
test('.gmd:编出来的关卡能原样解回来(物件数、坐标、翻转、分组都不丢)', async () => {
  const src = {
    name: '测试关 名字里有空格',
    objectCount: 0, header: {}, song: 'x.mp3', songOffset: 0,
    objects: [
      { id: 1, x: 30, y: 0, flipY: false, flipX: false, rot: 0, scale: 1, groups: [], raw: [] },
      { id: 8, x: 90, y: 0, flipY: true, flipX: false, rot: 0, scale: 1, groups: [7], raw: [] },
      { id: 1400, x: 120, y: 60, flipY: false, flipX: true, rot: 90, scale: 1, groups: [7, 9], raw: [] },
    ],
  };
  const text = encodeGmdText(src);
  const back = parseGmdText(text);
  assert.equal(back.name, src.name, '关卡名应该能原样读回来');
  assert.equal(back.song, 'x.mp3', '歌曲名也应该在');
  assert.equal(back.objects.length, 3, '物件数:实 ' + back.objects.length);
  assert.equal(back.objectCount, 3, '头部声明的物件数:' + back.objectCount);
  assert.deepEqual(back.objects.map((o) => [o.id, o.x, o.y]), [[1, 30, 0], [8, 90, 0], [1400, 120, 60]]);
  assert.equal(back.objects[1].flipY, true, '翻转要保住');
  assert.deepEqual(back.objects[2].groups, [7, 9], '分组要保住(触发器就靠它)');
  /* 走一遍真正的解码路径(base64 + 解压由调用方注入,这里用一个假装"压缩过"的 inflate) */
  const gz = gzipSync(Buffer.from(text, 'utf8'));
  const dec = await decodeGmd(gz.toString('base64'), async (b) => gunzipSync(Buffer.from(b)).toString('utf8'));
  assert.equal(dec.objects.length, 3, 'base64 → 解压 → 解析 也要对');
  assert.equal(dec.objects[0].id, 1);
});

test('ID 映射表:认识的算进覆盖率,不认识的按"缺什么"归类', () => {
  const objects = [
    { id: 1 }, { id: 1 }, { id: 1 }, { id: 8 },
    { id: 999 }, { id: 1400 }, { id: 1401 }, { id: 41 }, { id: 41 }, { id: 41 },
  ];
  const r = coverage(objects);
  assert.equal(r.total, 10);
  assert.equal(r.known, 4, '认得 4 个(3 个方块 + 1 个刺),实测 ' + r.known);
  assert.equal(r.unknown, 6);
  assert.equal(r.byKind['block'], 3);
  assert.equal(r.byKind['spike'], 1);
  assert.ok(r.gaps['trigger'] >= 2, '1000+ 应该被归到触发器(实测 ' + JSON.stringify(r.gaps) + ')');
  assert.ok(/物件总数 10/.test(formatReport(r)), '报告要能排成文字');
});

/* ---------------- ⑥ 架构约束 ---------------- */
/* ---------------- ⑥ 架构约束:核心不许依赖引擎/浏览器 ---------------- */
test('模拟核心零依赖:src/sim 里不许出现 phaser / window / document', () => {
  const root = join(HERE, '..', 'src', 'sim');
  /* 递归(现在有 charts/ 子目录了;以前只读顶层,遇到目录会 EISDIR 直接报错) */
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : (e.name.endsWith('.ts') ? [join(dir, e.name)] : []));
  for (const f of walk(root)) {
    const src = readFileSync(f, 'utf8');
    const name = f.slice(root.length + 1);
    assert.ok(!/from\s+['"]phaser['"]/.test(src), name + ' 不该 import phaser');
    assert.ok(!/\bwindow\.|\bdocument\./.test(src), name + ' 不该用浏览器 API');
  }
});
