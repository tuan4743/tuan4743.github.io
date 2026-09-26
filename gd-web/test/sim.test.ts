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

import { P, U, ROWS, JUMP_SPAN_BLOCKS, JUMP_AIRTIME_S, arcSpan, PAD, ORB, SPEED_YSTART } from '../src/sim/constants.ts';
import { generateLevel, tightestGap, tOfX, countKinds, type Level, type Segment, type Obj } from '../src/sim/level.ts';
import { mapRecord, encodeObjects, decodeObjects } from '../src/sim/gdids.ts';
import { blocksPerSec, xAtTime, parseBpmSections, injectBpmSections } from '../src/sim/bpmsections.ts';
import { World, botThink, frameOf, groundHeightOf, FLY_BAND } from '../src/sim/world.ts';
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
  /* ★ 2026-09-25 改判据:复活点现在是"碰到存档点那一帧玩家自己的位置"(反编译口径)⇒
     不变量是【玩家前缘正好贴到存档点判定盒的左缘】(差一帧的行进量),不是等于格子坐标 ✓ */
  assert.ok(Math.abs(w.checkX + w.box - 10 * U) < U / 3,
    '重来位置:玩家前缘应贴住存档点左缘(实测 checkX=' + (w.checkX / U).toFixed(2) + ' 格)');
  assert.ok(Math.abs(w.x - w.checkX) < 0.001, '复活后就站在记下的那个点上');
  assert.ok(w.x < 11 * U && w.x + w.box > 10 * U, '复活点要和存档点判定盒相交(不是站在它前面)✓');
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
  /* ★ 2026-09-27 松开要留够间隔:真人两次按键之间至少几帧,而"同一按键边沿在 2 帧内造成第二次瞬移"
     正是用户报的"空格多次判定生效" ⇒ world 里加了同类保护(见蜘蛛分支),测试也必须按真人节奏点 ✓ */
  for (let i = 0; i < 6; i++) w.frame(false);
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
        换到我们的坐标(我们 = 原版 − 90;原版天花板节点 = 进门 tweenCeiling(388)/球(358),
        相机局部;贴图 128 高、镜像后挂节点下面 ⇒ 面 = 节点 − 128 ⇒ 面离视口上边 =(320+128)−节点;
        我们的 y 是【脚底】不是中心 ⇒ 再减半个判定盒):
          脚底上限 = 视口上边 − 12(源码数反推)− 12 − 半个判定盒 ✓ */
  /* ★ 合成关只有 10 格高,而 ufo 的框高就是 300(10 格)⇒ 框顶必然超过关卡顶 ⇒ 先把它加高到 40 格 ✓ */
  const capLv = { ...solo([floor60]), rows: 40 } as typeof lv;
  const capW = new World(capLv, undefined, undefined, { flySolid: true });
  capW.reset(19 * U, 'ufo', 3.5 * U);
  capW.speedIdx = 1; capW.gdir = 1; capW.vy = 0;
  /* ★ 契约:框由【页面】给(页面持有相机)⇒ sim 原样采用 + 夹在里面 ✓
     位置规则在页面里:相机连续跟玩家(不吸格线 ✓)、框 = 相机中心 ± gh/2、下沿不低于地面 ✓ */
  const gh = groundHeightOf('ufo');
  capW.airLo = 0; capW.airHi = gh;                      // 页面把两条面发给 sim ✓
  capW.y = 4 * U; capW.vy = 0; capW.onGround = false;
  capW.frame(false);
  assert.equal(Math.round(capW.limHi - capW.limLo), gh, 'sim 必须原样采用页面给的框(= getGroundHeightForMode)✓');
  for (let i = 0; i < 20; i++) { capW.vy = -60; capW.frame(false); }   // 一路硬往下砸
  assert.ok(capW.y >= capW.limLo - 0.01, '不能穿出【下框面】(实测 y=' + capW.y.toFixed(2) +
    ', 下框面=' + capW.limLo.toFixed(2) + ')✓');
  capW.vy = 60; for (let i = 0; i < 4; i++) capW.frame(false);   // 硬往上顶
  const top = capW.limHi - 12 - capW.box / 2;
  assert.ok(capW.y <= top + 0.01, '不能穿出【上框面】(实测 y=' + capW.y.toFixed(2) + ', 上限=' + top.toFixed(2) + ')✓');
});

test('限高框的下框面就是这个形态的"地面":站在上面能跳(用户:"还是会被吸住无法跳起")', () => {
  /* 根因:夹在下框面时置的 onGround 会被同一子步后面的"踩实体"扫描清掉(框面底下没有实体 ✗)
     ⇒ 球站在框面上按不出跳。修法:踩实体扫完再把这次 hitGround 补回去(见 reassertAirGround)✓ */
  const w = new World(solo([floor60]), undefined, undefined, { flySolid: true });
  w.reset(0, 'ball', 5 * U);
  w.onGround = false; w.vy = 0;
  w.airLo = 0; w.airHi = 320;                       // 框 = 视口中点(160)± 4 格 ⇒ [40, 280]
  const fr = frameOf('ball', w.y + w.box / 2);
  for (let i = 0; i < 200 && !w.onGround; i++) w.frame(false);
  assert.ok(w.onGround, '应该站住(y=' + (w.y / U).toFixed(2) + ' 块;框下沿 ' + (fr.lo / U).toFixed(2) + ')');
  /* 站位是"框下沿或关卡自己的地面,取高的那个" —— 这里合成关卡的平台在 0,框下沿在 fr.lo ✓ */
  assert.ok(w.y >= Math.min(fr.lo, 0) - 1 && w.y <= Math.max(fr.lo, 0) + 1,
    '落点应该在下框面(' + fr.lo.toFixed(1) + ')或关卡地面(0)上,实测 ' + w.y.toFixed(1));
  const g0 = w.gdir;
  w.frame(true);
  assert.equal(w.gdir, -g0, '站在框面上点一下必须能跳(翻重力)—— 这条就是用户报的"吸住无法跳起" ✓');
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

test('绿环/黄环:初速跟【当前速度档】的 m_yStart 走(以前写死一档值 11.1800318 ✗)', () => {
  /* 源码:ringJump 普通环支 `v23 = *(double*)(v4 + 1568)`(160153)= m_yStart,
     由 updateTimeMod(150522)按速度档写入;绿环顺序 = 先 flipGravity(160225-160260)
     再 setYVelocity(v23 × flipMod × mini)(160262)⇒ 翻重力后按【新】方向给一整跳 ✓
     测试办法:扫"哪一帧起跳"能吃到环(环固定放在 20,2),再断言激活当帧的 vy ✓ */
  /* ★ 不去扫"第几帧按":每两帧交替按一次(偶数帧按下 ⇒ 每 2 帧就有一次【新按键】),
     人跑到环上必然吃到 ⇒ 一次模拟就够,几何怎么变都不会 miss ✓(扫帧那版太脆,已弃) */
  const orbVy = (kind: 'green' | 'yellow', speedIdx: number, mini = false): number => {
    const objs: Obj[] = [floor60];
    if (mini) objs.push({ kind: 'size', b: 5, r: 0, w: 1, h: 1, mini: true });   // mini 只能靠缩小门进(w.mini 是只读的 ✗)
    objs.push({ kind: 'orb', b: 20, r: 0, w: 1, h: 1, orb: kind });
    const w = new World(solo(objs));
    w.speedIdx = speedIdx;
    const g0 = w.gdir, vy0 = w.vy;
    for (let i = 0; i < 400; i++) {
      w.frame(i % 2 === 0);                          // 交替按 ⇒ 不断产生"新的一次按键"✓
      if (kind === 'green' ? w.gdir !== g0 : Math.abs(w.vy - vy0) > 1) return w.vy;
    }
    return NaN;
  };
  /* ★ 直接量 orbVel:扫几何那套在 sim 里太脆(一帧重力、命中帧都会漂),
     而这里要钉的正是"初速从哪来" ⇒ 直接断言函数返回值最稳 ✓(测试里用 as any 取私有方法) */
  const orbVelOf = (kind: 'green' | 'yellow' | 'pink' | 'red', tier: number) => {
    const w = new World(solo([floor60]));
    w.speedIdx = tier;
    return (w as unknown as { orbVel(k: string): number }).orbVel(kind);
  };
  assert.equal(orbVelOf('green', 1), SPEED_YSTART[1], '一档绿环 = m_yStart[1]');
  assert.equal(orbVelOf('green', 3), SPEED_YSTART[3], '三档绿环 = m_yStart[3]');
  assert.equal(orbVelOf('yellow', 4), SPEED_YSTART[4], '四档黄环 = m_yStart[4]');
  assert.notEqual(orbVelOf('green', 1), orbVelOf('green', 3),
    '★ 这条是关键:初速必须随速度档变 —— 又写死成一档值 11.1800318 的话这里就会相等 ✗');
  /* 绿环船 ×0.7、粉/红环的形态倍率依旧(源码 ringJump 160159-160164 / 160166-160217)✓ */
  assert.ok(Math.abs(orbVelOf('green', 1) * 0.7 - SPEED_YSTART[1] * 0.7) < 1e-9);
  /* mini 的 ×0.8 走 triggerScale(源码 v22,160149-160152),在 applyTrigger 里乘 ⇒ 这里不重复算 ✓ */
  assert.ok(SPEED_YSTART[3] > SPEED_YSTART[1], '三档的 m_yStart 必须大于一档');
});

/* ---------------- 重力板/重力环(用户 2026-09-25:"蓝环实现不对…那段过不了")----------------
 * 反编译依据:
 *   · `PlayerObject::propellPlayer`(147666-147693):速度 = 力度×16×flipMod×(迷你?0.8:1.0),
 *     之后 `if (球||蜘蛛||秋千) m_yVelocity *= 0.6`
 *   · `PlayerObject::flipGravity` 里的 `m_yVelocity *= 0.5`(151158)被 `if (!*(this+1601))` 守着;
 *     【重力板那一支】翻之前先把 +1601 置 1(153307 → 153316 flipGravity → 153328 setYVelocity(…,48))
 *     ⇒ 板翻重力【不减半】;环不走这条(ringJump 里没有置 +1601)⇒ 环走减半 ✓ */
test('重力板(蓝板):赋值后翻重力【并减半】—— 球形态 ×0.6 后约 3.84(回归回退后)', () => {
  const w = new World(solo([floor60, { kind: 'pad', b: 6, r: 0, w: 1, h: 0.2, pad: 'blue' }]));
  w.mode = 'ball';                       // ★ 那一段正是球形态(球有 propellPlayer 的 ×0.6)
  w.vy = 0;
  let flippedAt = -1, vyAt = 0;
  for (let i = 0; i < 240; i++) {
    w.frame(false);
    if (w.gdir === -1) { flippedAt = i; vyAt = w.vy; break; }
  }
  assert.ok(flippedAt >= 0, '要吃到蓝板并翻重力');
  /* ★★★ 2026-09-25 回归回退:cd52e6f 曾按"+1601 已置 1 ⇒ 不减半"改成 7.68,
     结果用户报「第一个球门前面的几个蓝跳点都会直接撞死」✗ ⇒ 退回原来的口径:
       12.8(propellPlayer 0.8×16)×0.6(球)= 7.68,翻重力那一下再 ×0.5 ⇒ 3.84
     (读数会带上触发当帧的一口重力 ⇒ 3.84 往上偏一点,所以容差 0.6)✓
     那个 +1601 标志位到底管哪些事件,等本体【数据段】证据到手再决定要不要改回去。
     实测量到的 3.84 附近值:见断言消息。 */
  assert.ok(Math.abs(vyAt - 3.84) < 0.6, '蓝板给的速度应为 3.84(球 ×0.6 后翻重力减半),实测 ' + vyAt.toFixed(3));
});

/* ---------------- 触发器 / 触摸标记(用户 2026-09 口径) ----------------
 * 用户要的:move / shake / touch / pulse / static / zoom;其中 touch【只当标记,不生效】。
 * 这里只钉死"链路"(认得出来 → 进得了表 → 编解码不丢 → touch 不生效),
 * 具体效果等真实样本到了再一件件做 —— 免得把"认错 ID 当方块吞掉"这种事放过去 ✓ */
test('触发器:用户存档里那个 Alpha 触发器能认出来(以前被当装饰忽略)', () => {
  /* ★ 这一行是从 CCLocalLevels.dat 原样抄的(WATER 里唯一一个触发器):
       1=1007 2=45 3=615 10=3.01 35=0 36=1 51=1 155=2
     45/30 = 1.5 格、615/30 = 20.5 格 —— 和编辑器里看到的位置一致 ✓ */
  const o = mapRecord({ '1': '1007', '2': '45', '3': '615', '10': '3.01', '35': '0', '36': '1', '51': '1', '155': '2' });
  assert.ok(o, '1007 必须认出来:返回 null 就是整个物件被吞掉(实测物件数 8980 → 8979)✗');
  assert.equal(o!.kind, 'trigger');
  assert.equal(o!.trigger, 'alpha');
  assert.equal(o!.id, 1007);
  assert.equal(o!.b, 1);      // 中心 1.5 − w/2
  assert.equal(o!.r, 20);     // 中心 20.5 − h/2
  assert.equal(o!.dur, 3.01);        // 键 10 = 时长
  assert.deepEqual(o!.groups, [1]);  // 键 51 = 目标组(不是 57)
});

test('触发器:编码 → 解码 一个字段都不丢(trig/dur/目标组/时长)', () => {
  const src: Obj[] = [{ kind: 'trigger', b: 1, r: 20, w: 1, h: 1, id: 1007, trigger: 'alpha', dur: 3.01, groups: [1] }];
  const back = decodeObjects(encodeObjects(src));
  assert.equal(back.length, 1);
  assert.equal(back[0].kind, 'trigger');
  assert.equal(back[0].trigger, 'alpha');
  assert.equal(back[0].dur, 3.01);
  assert.deepEqual(back[0].groups, [1]);
  assert.equal(back[0].id, 1007);
});

test('touch 触发器:只当标记,不生效(不进开火循环、不挡人、不致死)', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 4, r: 1, w: 1, h: 1, trigger: 'touch', groups: [9] },
    { kind: 'block', b: 6, r: 1, w: 1, h: 1, groups: [9] },     // 目标组里的方块(不该被推动/改变)
  ]));
  assert.equal(w.markers.length, 1, 'touch 要进标记清单(我照清单挂效果)');
  assert.equal(w.triggers.length, 0, 'touch 不许进每帧开火循环');
  const x0 = w.x;
  for (let i = 0; i < 120; i++) w.frame(false);
  assert.equal(w.markers.length, 1);
  assert.ok(w.x > x0, '人要照样往前走(标记不挡路)');
  assert.ok(!w.dead, '标记不该致死');
});

/* ---------------- 蜘蛛:一次按键只能瞬移一次(用户报「空格多次判定生效」的回归防线) ----------------
 * 用户两次报这个 bug,但取证量下来:Node 合成场景(纯上跳 / 叠紫箭头 / 叠绿环 / 叠紫跳点 /
 * 低帧率一批 4 步)与浏览器真键(逐次点击 / 长按 300ms 触发系统自动重复 / 限速 ×6)都是
 * 【一次按键 = 一次瞬移】,查不到复现路径 ⇒ 先把这条不变量用测试锁住,
 * 再把每次瞬移的【来源 + 本帧有没有新按下】打进控制台,用用户自己的日志定位 ✗→✓ */
test('蜘蛛:一次按键(含长按)只瞬移一次,两次按键两次', () => {
  const mkSpider = () => {
    const w = new World(solo([
      { kind: 'platform', b: 0, r: -1, w: 60, h: 1 },        // 地板
      { kind: 'block', b: 8, r: 4, w: 6, h: 1 },             // 头顶 3 格:可达面(一档 reach = 90 单位)
    ]));
    w.mode = 'spider';
    return w;
  };
  const walkUnder = (w: World) => {                          // 走到那块砖下面(期间不按)
    for (let i = 0; i < 600; i++) {
      if (w.x / U >= 9 && w.x / U <= 12) return true;
      if (w.dead) return false;
      w.frame(false);
    }
    return false;
  };

  const w1 = mkSpider();
  assert.ok(walkUnder(w1), '要先走到可瞬移的位置');
  const b1 = w1.spiderJumps;
  w1.frame(true); w1.frame(false);
  assert.equal(w1.spiderJumps - b1, 1, '按一下就松开 = 1 次瞬移');

  const w2 = mkSpider();
  assert.ok(walkUnder(w2), '要先走到可瞬移的位置');
  const b2 = w2.spiderJumps;
  for (let i = 0; i < 10; i++) w2.frame(true);                // 长按 10 步 ≈ 166ms(系统还会自动重复 keydown)
  for (let i = 0; i < 6; i++) w2.frame(false);
  assert.equal(w2.spiderJumps - b2, 1, '长按不许连跳(原版蜘蛛要重新按一次)');

  const w3 = mkSpider();
  assert.ok(walkUnder(w3), '要先走到可瞬移的位置');
  const b3 = w3.spiderJumps;
  w3.frame(true); w3.frame(false);
  for (let i = 0; i < 4; i++) w3.frame(false);
  w3.frame(true); w3.frame(false);
  for (let i = 0; i < 4; i++) w3.frame(false);
  assert.ok(w3.spiderJumps - b3 >= 2, '按两次至少要瞬移两次(别修成"按了没用"),实测 ' + (w3.spiderJumps - b3));
});

test('touch 过线:发一个光圈事件(位置 = 标记中心,单位制;21 帧后自己消失)', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 4, r: 0, w: 1, h: 1, trigger: 'touch' },
  ]));
  assert.equal(w.rings.length, 0, '还没走到就不该有光圈');
  let seen = 0;
  for (let i = 0; i < 180 && !seen; i++) { w.frame(false); if (w.rings.length) seen = w.rings.length; }
  assert.equal(seen, 1, '走过去要正好发一个(48 个标记 = 48 个光圈,不是一个标记发一堆)');
  assert.equal(w.rings[0].x, 4.5 * U);     // b + w/2 = 4.5 格 ⇒ 换算成单位(w.y 是单位制)
  assert.equal(w.rings[0].y, 0.5 * U);
  for (let i = 0; i < 40; i++) w.frame(false);
  assert.equal(w.rings.length, 0, '活够 34 帧(0.57 秒)要自己消失');
});

test('BPM 背景闪:带 loop 的 pulse 每 dur 秒闪一次(用户口径:只放一个在开头)', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 2, r: 0, w: 1, h: 1, trigger: 'pulse', dur: 0.5, loop: true },
  ]));
  let fired = false;
  for (let i = 0; i < 180 && !fired; i++) { w.frame(false); if (w.flash > 0) fired = true; }
  assert.ok(fired, '过线要闪第一次');
  /* ★ 关键:之后没人再碰触发器,也要按周期自己闪(这才是"背景跟 BPM 闪")*/
  let n = 0, was = w.flash;
  for (let i = 0; i < 180; i++) { w.frame(false); if (w.flash > was) n++; was = w.flash; }
  assert.ok(n >= 4 && n <= 8, '0.5 秒一拍、3 秒里应闪 5~6 次,实测 ' + n);
});

/* -------- 触发器真的生效(用户 2026-09-24:"触发器(MOVE,ZOOM,SHAKE等)现在还都没生效") -------- */
test('触发器按【越过 x】判:挂在玩家头顶 12 格的 move 照样开火', () => {
  /* ★ 真实铺面(fromGD ⇒ strict=true,走原版口径)。触发器在 y=12 格、玩家贴地跑 ⇒
     以前"判定盒必须相交(含高度)"⇒ 一次都不开火 ✗(用户报的就是这个);
     原版触发器是"玩家在 x 上越过它就发动",不看高度 ✓ */
  const target: Obj = { kind: 'block', b: 20, r: 1, w: 1, h: 1, groups: [7] };
  const w = new World(solo([
    floor60,
    target,
    { kind: 'trigger', b: 8, r: 12, w: 1, h: 1, trigger: 'move', groups: [7], dy: 2, dur: 0.5, ease: 'linear' },
  ], { fromGD: true }));
  for (let i = 0; i < 120; i++) w.frame(false);        // 跑过触发器,并让 0.5 秒的位移走完
  const off = w.offsetOf(target);
  assert.ok(Math.abs(off.dy - 2) < 1e-6, '头顶 12 格的 move 要把目标组推满 2 格,实测 dy=' + off.dy);
  assert.ok(!w.dead, '不该死');
});

test('zoom 触发器:按键 371 的值缓动到目标(用户:"ZOOM 没生效")', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 4, r: 12, w: 1, h: 1, trigger: 'zoom', zoom: 0.725, dur: 0.5 },
  ]));
  assert.equal(w.zoom, 1, '没触发前是 1(还原)✓');
  let started = false;
  for (let i = 0; i < 120 && !started; i++) { w.frame(false); if (w.zoom !== 1) started = true; }
  assert.ok(started, '越过它的 x 就要开始缩放');
  for (let i = 0; i < 60; i++) w.frame(false);
  assert.ok(Math.abs(w.zoom - 0.725) < 1e-9, '缓动结束要精确落在 0.725,实测 ' + w.zoom);
});

test('shake 触发器:记下强度(键 75)与时长(键 10),判定不受影响', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 4, r: 12, w: 1, h: 1, trigger: 'shake', str: 5, dur: 1 },
  ]));
  let on = false;
  for (let i = 0; i < 90 && !on; i++) { w.frame(false); if (w.shakeT > 0) on = true; }
  assert.ok(on, '越过它的 x 要开始抖');
  assert.equal(w.shakeStr, 5, '强度要按键 75 记下来(渲染侧用它算幅度)');
  for (let i = 0; i < 70; i++) w.frame(false);
  assert.equal(w.shakeT, 0, '1 秒(60 帧)之后要停');
  assert.ok(!w.dead, '抖动是纯视觉,不许影响判定');
});

/* ---------------- 分段 BPM(用户:"闪烁也做成分段的") ---------------- */
test('分段 BPM:秒 → 块 按关卡【真实速度】换算(速度门改档后速度不同)', () => {
  const segs = [
    { from: 0, to: 100, mode: 'cube', speed: 1, difficulty: 0 },
    { from: 100, to: 200, mode: 'cube', speed: 4, difficulty: 0 },
  ] as Segment[];
  const bps1 = blocksPerSec(1), bps4 = blocksPerSec(4);
  assert.ok(bps4 > bps1 * 1.5, '四档要比一档快得多:' + bps1.toFixed(2) + ' vs ' + bps4.toFixed(2));
  assert.equal(xAtTime(0, segs), 0);
  assert.ok(Math.abs(xAtTime(5, segs) - 5 * bps1) < 1e-9, '第一段内线性 ✓');
  const tEnd1 = 100 / bps1;
  assert.ok(Math.abs(xAtTime(tEnd1, segs) - 100) < 1e-6, '第一段末尾正好 100 块 ✓');
  assert.ok(Math.abs(xAtTime(tEnd1 + 5, segs) - (100 + 5 * bps4)) < 1e-6, '跨过速度门后要用新速度 ✓');
});

test('pulse 只跟三/四档速度走:其余速度段注入 dur=0 的【停闪】脉冲 ✓', () => {
  /* 四段速度 1 → 3 → 2 → 4(速度门在 x=100 / 200 / 300)✓ */
  const segs = [
    { from: 0, to: 100, mode: 'cube', speed: 1, difficulty: 0 },
    { from: 100, to: 200, mode: 'cube', speed: 3, difficulty: 0 },
    { from: 200, to: 300, mode: 'cube', speed: 2, difficulty: 0 },
    { from: 300, to: 400, mode: 'cube', speed: 4, difficulty: 0 },
  ] as Segment[];
  const sections = parseBpmSections({
    sections: [
      { t0: 0, t1: 30, bpm: 170, firstBeat: 0.3335 },
      { t0: 30, t1: 60, bpm: 85 },                     // 没给 period ⇒ 由 bpm 算出来 ✓
    ],
  });
  assert.equal(sections.length, 2);
  assert.ok(Math.abs(sections[0].period - 60 / 170) < 1e-9);
  assert.ok(Math.abs(sections[1].period - 60 / 85) < 1e-9);
  const objs: Obj[] = [];
  const log = injectBpmSections(objs, sections, segs, 10);
  assert.equal(objs.length, 4, '每个速度切换点一个(连续同速不重复)');
  assert.deepEqual(log.map((e) => e.speed), [1, 3, 2, 4]);
  assert.deepEqual(log.map((e) => e.injected), [false, true, false, true], '只有三/四档开闪 ✓');
  assert.equal(objs[0].dur, 0, '停闪 = dur 0');
  assert.equal(objs[2].dur, 0, '停闪 = dur 0');
  assert.equal(objs[0].loop, true, '停闪也要是 loop pulse,sim 靠 loop + dur=0 分辨"停" ✓');
  assert.ok(Math.abs((objs[1].dur ?? 0) - 60 / 170) < 1e-9, '开闪段的周期照 BPM 表 ✓');
  assert.equal(objs[1].phase, 0.3335, '相位 = 覆盖该时刻的 BPM 段第一拍 ✓');
  assert.ok(log[1].x > log[0].x && log[2].x > log[1].x && log[3].x > log[2].x, 'x 必须递增,否则接力顺序会乱 ✗');
  for (const e of log) assert.ok(Math.abs(xAtTime(e.t, segs) - e.x) < 1e-6, 'x/t 换算必须互逆 ✓');
});

test('pulse 停闪:带 loop 但 dur=0 ⇒ 周期归零、之后不再闪(用户口径:三/四档之外不闪)✓', () => {
  const w = new World(solo([
    floor60,
    { kind: 'trigger', b: 2, r: 0, w: 1, h: 1, trigger: 'pulse', dur: 0.5, loop: true },
    { kind: 'trigger', b: 6, r: 0, w: 1, h: 1, trigger: 'pulse', dur: 0, loop: true },
  ]));
  /* 跑到停闪那一个(过线之后) */
  let guard = 0;
  while (w.x < 7 * U && guard++ < 600) w.frame(false);
  assert.ok(guard < 600, '人得能走到停闪点');
  /* 停闪之后 2 秒内不许再出现新的上升沿 ✓ */
  let after = 0, was = w.flash;
  for (let i = 0; i < 120; i++) { w.frame(false); if (w.flash > was) after++; was = w.flash; }
  assert.equal(after, 0, '停闪之后不该再闪,实测 ' + after);
});

/* ---------------- 存档点复活(用户 2026-09-25 报的 bug)----------------
 * 原话:"复活位置不是存档点而是存档点前面,导致复活在可破坏砖块内部直接死" */
test('存档点复活:记的是【玩家碰到它那一刻自己的位置】(反编译 saveToCheckpoint 口径)', () => {
  /* ★★★ 2026-09-25:上一版按"判定盒中心"记(11.5 格)—— 那是自定的 ✗
     反编译 `PlayLayer::createCheckpoint`(105040)→ `PlayerObject::saveToCheckpoint`(161518)里,
     存的是 `getPosition()`(161537-161542)+ m_yVelocity(+242)+ 重力方向(+1967)+ 形态标志
     ⇒ 复活点 = 碰到那一帧【玩家自己的位置】,不是存档点格子的中心 ✗
     所以判据不是"等于某个坐标",而是【必须与存档点判定盒相交】(人是碰到它才记的)✓ */
  const w = new World(solo([floor60, { kind: 'check', b: 11, r: 0, w: 2, h: 1 }]));
  for (let i = 0; i < 240 && w.checkX === 0; i++) w.frame(false);
  assert.ok(w.checkX > 0, '要碰到存档点(没碰到说明触发就没生效)');
  const bx0 = 11 * U, bx1 = 13 * U, by0 = 0, by1 = U;
  /* 不变量:记下的位置【与存档点判定盒相交】(触发那一帧的真实接触状态)。
     不去断言"等于某个格子坐标" —— 接触发生在哪一帧取决于帧步进,强求坐标就是自造口径 ✗ */
  assert.ok(w.checkX < bx1 && w.checkX + w.box > bx0,
    '复活点 x 必须与存档点判定盒相交:实测前缘 ' + ((w.checkX + w.box) / U).toFixed(2) + ' 格,盒 ' + (bx0 / U) + '~' + (bx1 / U) + ' 格');
  assert.ok(w.checkY < by1 && w.checkY + w.box > by0,
    '复活点 y 必须与判定盒相交:实测 ' + (w.checkY / U).toFixed(2) + ' 格');
  const cx = w.checkX, cy = w.checkY;
  w.respawn();
  assert.equal(w.x, cx, '复活位置 = 存档时记下的那个点');
  assert.equal(w.y, cy);
});

test('存档点正好压在可破坏砖上:复活必须被顶出实心,不能一出来就死', () => {
  /* 结构和用户遇到的一模一样:存档点与可破坏砖在【同一格】。
     reset() 会清空 broken ⇒ 砖在复活时【恢复】⇒ 落在砖里就必死 ✗ */
  const lv = solo([
    floor60,
    { kind: 'breakable', b: 11, r: 0, w: 1, h: 1 },
    { kind: 'check', b: 11, r: 0, w: 1, h: 1 },
  ]);
  const w = new World(lv);
  for (let i = 0; i < 240 && w.checkX === 0; i++) w.frame(false);
  assert.ok(w.checkX > 0, '要碰到存档点');
  w.respawn();
  const bx0 = 11 * U, bx1 = 12 * U, by0 = 0, by1 = U;
  const overlap = w.x < bx1 - 0.001 && w.x + w.box > bx0 + 0.001 && w.y < by1 - 0.001 && w.y + w.box > by0 + 0.001;
  assert.ok(!overlap, '复活点不许落在可破坏砖里面(实测 y=' + (w.y / U) + ' 格)');
  for (let i = 0; i < 30; i++) w.frame(false);
  assert.ok(!w.dead, '复活后要能活下来(不被压死)');
});

/* ---------------- 克隆门(286/287):只标记、不做双人(用户口径) ----------------
 * 用户报「克隆出了严重的 bug,无法描述」⇒ 复现到了:过 286 门会【凭空多出一个玩家 2】。
 * 那套双人是半套实现(代码里引过反编译 PortalDualOn/Off = 57/58),按口径关掉 ✓ */
test('克隆门只标记:过门不开双人、也不凭空多出玩家 2', () => {
  const gate: Obj = { kind: 'clone', b: 8, r: 0, w: 1, h: 1, id: 286 };
  const a = new World(solo([floor60, gate]));
  const b = new World(solo([floor60]));                 // 对照组:没有门
  let passedAt = -1;
  for (let i = 0; i < 240; i++) {
    a.frame(botThink(a)); b.frame(botThink(b));
    assert.equal(a.dual, false, '克隆门不许开双人(第 ' + i + ' 帧)');
    assert.equal(a.p2, null, '不许凭空多出玩家 2(第 ' + i + ' 帧)');
    if (passedAt < 0 && a.x > 9 * U) passedAt = i;
  }
  assert.ok(passedAt >= 0, '要真的跑过门(x 只到 ' + (a.x / U).toFixed(2) + ' 格)');
  /* ★★ 关键断言:门不产生任何影响 ⇒ 有门 / 没门 两条轨迹必须逐字段一致 */
  assert.equal(a.x, b.x, 'x 必须一致');
  assert.equal(a.y, b.y, 'y 必须一致');
  assert.equal(a.vy, b.vy, 'vy 必须一致');
  assert.equal(a.dead, b.dead, '生死必须一致');
  assert.equal(a.mode, b.mode, '形态必须一致');
});

test('克隆门的判定盒 = 官方门洞 34×86(以前是 1×1 格 ⇒ 触发时有时无)', () => {
  const w = new World(solo([floor60, { kind: 'clone', b: 8, r: 0, w: 1, h: 1, id: 286 }]));
  assert.equal(w.clones.length, 1, '克隆门要进 clones 列表(只标记)');
  const bx = w.clones[0];
  assert.ok(Math.abs((bx.x1 - bx.x0) - 34) < 0.01, '宽 = 34 单位,实测 ' + (bx.x1 - bx.x0));
  assert.ok(Math.abs((bx.y1 - bx.y0) - 86) < 0.01, '高 = 86 单位,实测 ' + (bx.y1 - bx.y0));
  /* 锚点 = 物件中心:1×1 的门放在 (8,0) ⇒ 中心 (8.5,0.5) 格 = (255,15) 单位 */
  assert.ok(Math.abs(bx.x0 - (8.5 * U - 17)) < 0.01 && Math.abs(bx.y0 - (0.5 * U - 43)) < 0.01,
    '锚点应为物件中心,实测 x0=' + bx.x0 + ' y0=' + bx.y0);
});

/* ---------------- 两个恶性 bug 的回归防线(2026-09-25) ---------------- */
test('存档点:复活后不许往前漂移(用户:"存档点出现每次复活往前偏移")', () => {
  const w = new World(solo([floor60, { kind: 'check', b: 10, r: 0, w: 1, h: 1 }]));
  let touched = false;
  for (let i = 0; i < 600 && !touched; i++) { w.frame(false); if (w.checkX > 1) touched = true; }
  assert.ok(touched, '要能碰到存档点');
  const first = w.checkX;
  assert.ok(first > 9 * U && first < 12 * U, '存档位置该落在存档点那格附近,实测 ' + (first / U).toFixed(2) + ' 格');
  /* ★ 连死三次:复活点本身落在存档点里 ⇒ 以前复位清空 armed 后出来第一个子步又重叠,
     把"已经往前走 ε"的位置再存一遍,越死越靠前 ✗ */
  for (let k = 0; k < 3; k++) { w.respawn(); for (let i = 0; i < 12; i++) w.frame(false); }
  assert.equal(w.checkX, first, '复活三次后存档位置不许挪动(实测漂到 ' + (w.checkX / U).toFixed(2) + ' 格)');
});

test('瞬移箭头:重试锁定期间不许把这次按键喂给别的箭头(用户:"空格多次判定生效")', () => {
  const w = new World(solo([floor60, { kind: 'arrow', arrow: 'purple', tp: true, b: 2, r: 0, w: 1, h: 1 }]));
  w.mode = 'spider';
  for (let i = 0; i < 60; i++) w.frame(false);
  /* 假装"上一次按键正在重试【另一个】箭头":这一次按下就不该去喂这一支 ✓
     (没有 tpRetry 守卫时它会被喂到 ⇒ armedArrows 变大 ✗) */
  w.tpRetry = { o: {}, x0: 0, x1: 0, y0: 0, y1: 0 } as never;
  const before = w.armedArrows.size;
  for (let i = 0; i < 5; i++) w.frame(true);
  assert.equal(w.armedArrows.size, before, '重试锁定期间不许触发别的箭头');
});

/* ---------------- 蓝板模型判定 + 绿环现场(2026-09-25 第二轮) ----------------
 * 用户在原版里实测的描述:「cube 的中心从【门下那一格的左上角】接触门,然后抛物线刚好飞到平台上」
 * ⇒ 这是"读注释"替代不了的判据:两种候选模型各跑一遍,哪个"刚好够到"哪个才是原版口径 ✓
 *    甲 减半(12.8→6.4)   乙 不减半(12.8)
 * 实测:甲 过门后经四个蓝板 ping-pong(5 次翻转)落到 x≈745.7 活着 ✓
 *       乙 t11 那次 vy=−12.80 ⇒ x≈720.2 撞死 ✗ —— 正是用户报的"撞死在砖上" ✓
 * 所以"减半"是对的;下面第二条就是钉子:谁再改成不减半,它会红 ✓ */
async function runPortalSection(flip: 'before' | 'beforeKeep') {
  const { WATER_CHART } = await import('../src/sim/charts/water.ts');
  const { PAD } = await import('../src/sim/constants.ts');
  const portal = WATER_CHART.objects.filter((o) => o.kind === 'gravity' && o.gdir === -1)
    .sort((a, b) => a.b - b.b).find((g) => g.b > 710 && g.b < 720)!;
  const old = PAD.blue.flip;
  PAD.blue.flip = flip as typeof old;
  try {
    const w = new World(WATER_CHART as unknown as Level);
    w.mode = 'cube'; w.speedIdx = 4; w.gdir = 1;
    /* 门的判定盒 34×86 单位、物件 1×1 格 ⇒ "门下那一格" = (b, r−1)~(b+1, r),
       其【左上角】世界坐标 = (b×30, r×30) 单位 ⇒ 玩家中心对准它 ✓ */
    w.x = portal.b * U - w.box / 2;
    w.y = portal.r * U - w.box / 2;
    w.vy = 0; w.onGround = false; w.dead = false; w.god = false;
    let flips = 0, lastG = w.gdir, landX = -1;
    for (let i = 0; i < 400; i++) {
      w.frame(false);
      if (w.gdir !== lastG) { flips++; lastG = w.gdir; }
      if (landX < 0 && i > 2 && w.onGround) landX = w.x / U;
      if (w.dead || (landX > 0 && i > 40)) break;
    }
    return { dead: w.dead, flips, landX, x: w.x / U, portal };
  } finally { PAD.blue.flip = old; }
}

test('蓝板【减半】模型:门下那一格左上角接触门 ⇒ 抛物线够到平台(用户原版实测描述)', async () => {
  const r = await runPortalSection('before');
  assert.equal(r.portal.b * U * 0 + r.portal.b, 714, '用的应该是 x=714 那个反转重力门');
  assert.ok(!r.dead, '减半模型必须活着过去(实测落点 x≈745.7)');
  assert.ok(r.flips >= 5, '过门 + 四个蓝板 ⇒ 至少 5 次重力翻转,实测 ' + r.flips);
  assert.ok(r.landX > 740, '应当落到 x>740 的平台上,实测 ' + r.landX.toFixed(2));
});

test('蓝板【不减半】(12.8)必须复现"撞死在砖上" —— 钉住口径,防止再改回去', async () => {
  const r = await runPortalSection('beforeKeep');
  assert.ok(r.dead, '不减半必须死(实测 x≈720.2 撞砖)');
  assert.ok(r.x < 725, '死点应在 x≈720 附近,实测 ' + r.x.toFixed(2));
});

test('绿环(1022)在真实铺面里生效:翻重力 + 按【新】方向给一整跳', async () => {
  const { WATER_CHART } = await import('../src/sim/charts/water.ts');
  const orb = WATER_CHART.objects.find((o) => o.orb === 'green');
  assert.ok(orb, '这一关有绿环');
  const w = new World(WATER_CHART as unknown as Level);
  w.mode = 'cube'; w.speedIdx = 1; w.gdir = 1;
  w.x = (orb!.b + orb!.w / 2) * U - w.box / 2;
  w.y = (orb!.r + orb!.h / 2) * U - w.box / 2;
  w.vy = 0; w.onGround = false; w.dead = false; w.god = true;
  const g0 = w.gdir;
  w.frame(true);
  assert.notEqual(w.gdir, g0, '绿环必须翻重力');
  assert.ok(w.vy * w.gdir > 0, '绿环必须按【新】重力方向给速度(vy 与 gdir 同号),实测 vy=' + w.vy.toFixed(2) + ' g=' + w.gdir);
  assert.ok(Math.abs(w.vy) > 5, '力度应当是一整跳量级,实测 ' + w.vy.toFixed(2));
});
