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

import { P, U, ROWS, JUMP_SPAN_BLOCKS, JUMP_AIRTIME_S } from '../src/sim/constants.ts';
import { generateLevel, tightestGap, type Level, type Segment } from '../src/sim/level.ts';
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
test('常量表:一跳峰值约 2.17 块,滞空约 0.39 秒(和原作"跳两块"一致)', () => {
  const peak = (P.jump * P.jump) / (2 * P.gravity) / U;
  assert.ok(Math.abs(peak - 2.17) < 0.05, '解析峰值 = ' + peak.toFixed(3) + ' 块');
  assert.ok(Math.abs(JUMP_AIRTIME_S - 0.389) < 0.01, '滞空 = ' + JUMP_AIRTIME_S.toFixed(3) + ' 秒');
  assert.ok(JUMP_SPAN_BLOCKS > 4.2 && JUMP_SPAN_BLOCKS < 4.8, '一跳跨 ' + JUMP_SPAN_BLOCKS.toFixed(2) + ' 块');

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

/* ---------------- ③ 自动铺面 ---------------- */
test('自动铺面:障碍最小间距不小于一跳的距离(不会生成必死关)', () => {
  for (const seed of [1, 7, 20260913, 424242]) {
    const lv = generateLevel({ seed });
    const gap = tightestGap(lv);
    assert.ok(gap >= P.minGapBlocks - 1e-9, 'seed ' + seed + ' 的最小间距 ' + gap.toFixed(2) + ' 块 < ' + P.minGapBlocks);
  }
});

test('自动铺面:每个段落都有对应形态的圆环与速度门', () => {
  const lv = generateLevel({ seed: 20260913 });
  for (const sg of lv.segments) {
    const portal = lv.objects.find((o) => o.kind === 'portal' && Math.abs(o.b - (sg.from + 2)) < 0.001);
    assert.ok(portal, sg.label + ' 段首应有圆环');
    assert.equal(portal!.to, sg.mode, sg.label + ' 的圆环应切成 ' + sg.mode);
    assert.ok(lv.objects.some((o) => o.kind === 'speed' && Math.abs(o.b - (sg.from + 6)) < 0.001), sg.label + ' 段首应有速度门');
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
