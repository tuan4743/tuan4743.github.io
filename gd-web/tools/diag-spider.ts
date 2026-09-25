/* 蜘蛛"一次空格多次生效"取证:一次按键到底瞬移了几次?
   跑法:cd gd-web && node tools/diag-spider.ts

   用户口径(两次):「瞬移蜘蛛出现空格多次判定生效的恶性bug」→「蜘蛛多判定问题还存在」。
   上一轮修的是紫箭头(3004)那条"够不到面就把按键还回去",用户说还在 ⇒ 这次直接数:
     ① 纯蜘蛛上跳(地板上站好,头顶 3 格处有可落面)按一次 → 计几次?
     ② 同位置叠一个紫箭头(3004,tp)再按一次 → 计几次?(怀疑:上跳 + 箭头 = 两次瞬移)
     ③ 同位置叠一个绿环(1022)→ 计几次?(怀疑 pressAux 让"形态动作"和"环"同帧都生效)
     ④ 同位置叠一个紫跳点(3005,碰到就触发)→ 按一次 → 计几次?
     ⑤ 低帧率:一次按下落在一批 4 个模拟步里(按浏览器那套 inputLog + tapPending 喂法)→ 计几次?
     ⑥ 对照组:按两次 → 应该正好 2 次(证明没修成"按了没用")
   计数来源:`world.spiderJumps`(spiderJump 成功后 +1,只数不做逻辑) */
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import type { Level, Obj } from '../src/sim/level.ts';

const FLOOR = 200;

function mkLevel(extra: Obj[], withCeiling = true): Level {
  return {
    name: 'spider-diag',
    rows: 40,
    length: FLOOR,
    segments: [{ from: 0, to: FLOOR, mode: 'spider', speed: 1, difficulty: 0 }],
    objects: [
      { kind: 'platform', b: 0, r: -1, w: FLOOR, h: 1 },        // 地板
      ...(withCeiling ? [{ kind: 'block' as const, b: 10, r: 4, w: 5, h: 1 }] : []),   // 头顶 3 格:蜘蛛可落面
      ...extra,
    ],
    song: 'x.mp3',
    songOffset: 0,
    fromGD: false,
    start: { b: 2, r: 0 },
  };
}

/** 浏览器那套:一次按下 = inputLog 里一条 down(+ 后面一条 up),tapPending 只喂第一步 */
function pressBatch(w: World, steps: number, logDownAt: number, logUpAt: number, clock0: number) {
  const log = [{ t: logDownAt, down: true }, { t: logUpAt, down: false }];
  const holdAt = (t: number) => { let d = false; for (const e of log) { if (e.t > t) break; d = e.down; } return d; };
  let clock = clock0;
  for (let s = 0; s < steps; s++) {
    const hold = holdAt(clock) || s === 0;          // s===0 那次 = tapPending 保底
    w.frame(hold);
    clock += 1000 / 60;
  }
  return clock;
}

/** 走到头顶那块砖下面(x ∈ [10,15] 格),期间不按 */
function walkInto(w: World, maxSteps = 600) {
  for (let i = 0; i < maxSteps; i++) {
    if (w.x / U >= 10.2 && w.x / U <= 14.0) return true;
    w.frame(false);
    if (w.dead) return false;
  }
  return false;
}

function scenario(name: string, extra: Obj[], steps: number, presses: number) {
  const w = new World(mkLevel(extra));
  w.mode = 'spider';
  const ok = walkInto(w);
  const before = w.spiderJumps;
  let clock = 0;
  for (let p = 0; p < presses; p++) {
    clock = pressBatch(w, steps, clock, clock + 1000 / 60, clock);
    // 两次按键之间留一点间隔,别让第二下落在同一步
    for (let i = 0; i < 10; i++) w.frame(false);
  }
  const after = w.spiderJumps;
  const extraDesc = extra.length ? extra.map((o) => o.kind + '/' + (o.id ?? '-')).join(',') : '无';
  console.log(
    '  ' + name.padEnd(34) +
    ' 走到位=' + (ok ? '是' : '否') +
    '  按下=' + presses + ' 次' +
    '  瞬移=' + (after - before) + ' 次' +
    '  (叠加物: ' + extraDesc + ')',
  );
  return after - before;
}

console.log('蜘蛛一次按键的瞬移次数(期望:按几次就几次)\n');
const r1 = scenario('① 纯蜘蛛上跳', [], 1, 1);
const r2 = scenario('② 叠紫箭头(3004)', [{ kind: 'arrow', b: 11, r: 1, w: 1, h: 1, arrow: 'purple', tp: true, id: 3004 }], 1, 1);
const r3 = scenario('③ 叠绿环(1022)', [{ kind: 'orb', b: 11, r: 1, w: 1, h: 1, orb: 'green', id: 1022 }], 1, 1);
const r4 = scenario('④ 叠紫跳点(3005)', [{ kind: 'pad', b: 11, r: 0, w: 1, h: 1, pad: 'purple', tp: true, id: 3005 }], 1, 1);
const r5 = scenario('⑤ 低帧率:一批 4 步', [], 4, 1);
const r6 = scenario('⑥ 对照组:按两次', [], 1, 2);
console.log('\n对照:④ 是"碰到就触发",所以正常就该多 1 次(不算按键重复)');
console.log('判定:①③⑤⑥ 必须 1/1/1/2;② 若 >1 说明箭头那条还能重复;④ 应 = 1(跳点算碰到)');
console.log('读数:①' + r1 + ' ②' + r2 + ' ③' + r3 + ' ④' + r4 + ' ⑤' + r5 + ' ⑥' + r6);

/* ⑦ 关键组合【够不到面 + 紫箭头】:
   蜘蛛那一跳够不到面时会 tpFailed=true(不消耗箭头那条会把按键【还回来】:pressFresh=true + tpRetry=箭头)
   ⇒ 下一步蜘蛛分支又看到 pressFresh ⇒ 再跳一次(还是够不到)⇒ 又还回来 …… 一直来回 ✗✗
   这正是"一次空格被多次判定生效"的形态。这里没有天花板 ⇒ 必然够不到。 */
{
  const arrow: Obj = { kind: 'arrow', b: 11, r: 1, w: 1, h: 1, arrow: 'purple', tp: true, id: 3004 };
  const w = new World(mkLevel([arrow], false));      // ★ 不放假天花板 ⇒ 蜘蛛这一跳必然"够不到面"
  w.mode = 'spider';
  walkInto(w);
  const before = w.spiderJumps;
  const log: string[] = [];
  let last = before;
  for (let i = 0; i < 40; i++) {
    const hold = i === 0;                       // 只按第一步
    w.frame(hold);
    if (w.spiderJumps !== last) { log.push('帧' + i + ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2)); last = w.spiderJumps; }
  }
  const n = w.spiderJumps - before;
  console.log('\n⑦ 够不到面 + 紫箭头：按 1 次 ⇒ 瞬移 ' + n + ' 次' + (n > 1 ? '  ✗✗ 复现!' : '  ✓'));
  if (log.length) console.log('   ' + log.slice(0, 10).join(' | '));
}

/* ---------------- 真关卡复现:WATER 的蜘蛛段 + 它自己的紫瞬移物件 ----------------
   合成场景里一次按键只瞬移 1 次 ⇒ 病要么在真铺面的物件叠放上,要么在"瞬移落地后又压到另一个瞬移件"这条链上。
   这里直接拿真铺面跑:找到蜘蛛段里的 3004/3005,把玩家放到它前面,按一次,数 60 步内的瞬移次数。 */
const { WATER_CHART } = await import('../src/sim/charts/water.ts');

const spiderSegs = WATER_CHART.segments.filter((s) => s.mode === 'spider');
console.log('\n真铺面 WATER:蜘蛛段 ' + spiderSegs.length + ' 段,合计 ' +
  spiderSegs.reduce((a, s) => a + (s.to - s.from), 0).toFixed(0) + ' 格');

const tps = WATER_CHART.objects.filter((o) => o.tp);
console.log('带 tp(瞬移)的物件 ' + tps.length + ' 个:' +
  [...new Set(tps.map((o) => o.id))].map((id) => ' id' + id + '×' + tps.filter((o) => o.id === id).length).join(''));

/* 每个瞬移件落在哪个段落里、离最近的蜘蛛段有多远 —— "够不到面时把按键还回去"那条路
   (world.ts 1618:tpFailed ⇒ pressFresh = true)必须有箭头叠在身上才会发生 ✓ 所以位置是关键 */
const segAt = (x: number) => WATER_CHART.segments.find((s) => x >= s.from && x <= s.to);
for (const o of tps) {
  const s = segAt(o.b);
  const near = WATER_CHART.segments.filter((q) => q.mode === 'spider')
    .map((q) => Math.min(Math.abs(o.b - q.from), Math.abs(o.b - q.to)))
    .sort((a, b) => a - b)[0];
  console.log('  id' + o.id + ' x=' + String(o.b).padStart(7) + ' y=' + String(o.r).padStart(5) +
    ' 形态段=' + String(s?.mode).padEnd(7) + ' 离最近蜘蛛段 ' + (near == null ? '-' : near.toFixed(1) + ' 格'));
}

/* 挑一个"落在蜘蛛段里"的瞬移件当靶子 */
const inSpider = tps.filter((o) => spiderSegs.some((s) => o.b >= s.from && o.b <= s.to));
console.log('其中落在蜘蛛段里的 ' + inSpider.length + ' 个');
const target = inSpider.sort((a, b) => a.b - b.b)[Math.min(3, inSpider.length - 1)];

if (!target) {
  console.log('⇒ 蜘蛛段里没有 tp 物件,真关卡这条无法复现');
}

/* ---------------- 走整段蜘蛛段:按一次,记录每一次瞬移发生在哪 ----------------
   上一轮修的紫箭头不在这几段里(读数见上)⇒ 真凶另有其人:直接把每一跳的 (tick,x,y,gdir) 打出来,
   看"多出来的那几次"发生在什么位置 —— 是踩到跳点、还是落地瞬间又跳、还是别的物件。 */
{
  const seg = spiderSegs[0];
  const ids = new Map<number, number>();
  for (const o of WATER_CHART.objects) {
    if (o.b >= seg.from && o.b <= seg.to) ids.set(o.id ?? -1, (ids.get(o.id ?? -1) ?? 0) + 1);
  }
  console.log('\n第一段蜘蛛段 x=' + seg.from + '~' + seg.to + '(速度档 ' + seg.speed + ')里的物件:');
  console.log('  ' + [...ids.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => 'id' + id + '×' + n).join(' · '));

  console.log('\n全部 ' + spiderSegs.length + ' 段蜘蛛段的构成(重点看有没有环/跳点/箭头):');
  for (const s of spiderSegs) {
    const m = new Map<number, number>();
    for (const o of WATER_CHART.objects) {
      if (o.b >= s.from && o.b <= s.to) m.set(o.id ?? -1, (m.get(o.id ?? -1) ?? 0) + 1);
    }
    const interesting = [...m.entries()].filter(([id]) => [36, 141, 1022, 84, 1330, 67, 35, 140, 3005, 1704, 1751, 3004].includes(id));
    console.log('  x=' + String(s.from).padStart(6) + '~' + String(s.to).padEnd(6) + ' 速度档' + s.speed +
      '  物件 ' + m.size + ' 种' +
      (interesting.length ? '  ★ 有可交互件: ' + interesting.map(([id, n]) => 'id' + id + '×' + n).join(' · ') : '  (只有方块/刺/装饰)'));
  }

  const w = new World(WATER_CHART);
  w.mode = 'spider';
  w.speedIdx = seg.speed;
  w.x = seg.from * U;
  w.y = 0;
  w.checkX = w.x;
  const log: string[] = [];
  let last = w.spiderJumps;
  let pressed = false;
  let guard = 0;
  while (w.x / U < seg.to + 2 && guard++ < 4000 && !w.dead) {
    /* 只按一次:一进段就按下去,持续 6 步(真人按一下大约 100ms) */
    const hold = !pressed && w.x / U >= seg.from + 1;
    w.frame(hold);
    if (hold) pressed = true;
    else if (pressed && guard % 20 === 0) pressed = false;   // 之后每 20 步再给一次(模拟玩家陆续点)
    if (w.spiderJumps !== last) {
      log.push('  tick' + w.tick + ' x=' + (w.x / U).toFixed(2) + '格 y=' + (w.y / U).toFixed(2) + '格 gdir=' + w.gdir);
      last = w.spiderJumps;
    }
  }
  console.log('整段走完:瞬移 ' + (w.spiderJumps) + ' 次 · 死亡=' + w.dead + ' · 走出 x=' + (w.x / U).toFixed(1) + ' 格');
  console.log('每次瞬移的位置(前 20 条):');
  console.log(log.slice(0, 20).join('\n') || '  (没有瞬移)');
}

/* ---------------- 用录好的 tape 跑真关卡,数"每一次瞬移有没有对应的新按键" ----------------
   `static/assets/gd-tape.json` 是整关的按键记录 ⇒ 逐帧喂给 sim,
   凡是【没有新按下】却发生瞬移的,就是用户说的"空格多次判定生效" ✗✓ */
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tapePath = path.resolve('..', 'static', 'assets', 'gd-tape.json');
  if (!fs.existsSync(tapePath)) {
    console.log('\ntape 不存在:' + tapePath + ' ⇒ 跳过');
  } else {
    const raw = JSON.parse(fs.readFileSync(tapePath, 'utf8'));
    /* 格式(见 tools/tape-pack.ts):rle = 交替的【段长】,首段的值是 raw.first ✓ */
    let tape: boolean[] = [];
    if (Array.isArray(raw)) tape = raw;
    else if (Array.isArray(raw.rle)) {
      let v = !!raw.first;
      for (const n of raw.rle as number[]) { for (let k = 0; k < n; k++) tape.push(v); v = !v; }
    }
    console.log('\ntape:' + tape.length + ' 帧 · 按下次数 ' + tape.filter((v, i) => v && !tape[i - 1]).length);

    const w = new World(WATER_CHART);
    let last = w.spiderJumps, prevHold = false;
    const jumps: Array<{ i: number; x: number; y: number; mode: string; edge: boolean }> = [];
    let i = 0;
    for (; i < tape.length && !w.dead; i++) {
      const hold = !!tape[i];
      const edge = hold && !prevHold;
      w.frame(hold);
      prevHold = hold;
      if (w.spiderJumps !== last) {
        jumps.push({ i, x: w.x / U, y: w.y / U, mode: w.mode, edge });
        last = w.spiderJumps;
      }
    }
    const spider = jumps.filter((j) => j.mode === 'spider');
    const noEdge = jumps.filter((j) => !j.edge);
    console.log('跑完 ' + i + ' 帧 · 死亡=' + w.dead + ' · 走到 x=' + (w.x / U).toFixed(1) + ' 格');
    console.log('瞬移合计 ' + jumps.length + ' 次,其中【蜘蛛形态】' + spider.length + ' 次');
    console.log('★ 没有新按下却瞬移的:' + noEdge.length + ' 次' + (noEdge.length ? '  ✗✗ 这就是"空格多次判定生效"' : '  ✓'));
    if (noEdge.length) {
      console.log('  明细(前 12 条):');
      for (const j of noEdge.slice(0, 12)) {
        console.log('   帧' + j.i + ' x=' + j.x.toFixed(2) + '格 y=' + j.y.toFixed(2) + '格 形态=' + j.mode);
      }
    }
    if (spider.length) {
      console.log('  蜘蛛瞬移明细(前 12 条):');
      for (const j of spider.slice(0, 12)) {
        console.log('   帧' + j.i + ' x=' + j.x.toFixed(2) + '格 y=' + j.y.toFixed(2) + '格 新按下=' + (j.edge ? '是' : '【否】'));
      }
    }
  }
}

if (target) {
  const seg = spiderSegs.find((s) => target.b >= s.from && target.b <= s.to)!;
  console.log('\n靶子: id' + target.id + ' 在 x=' + target.b + ' 格(y=' + target.r + '),所在蜘蛛段 x=' + seg.from + '~' + seg.to + '(速度档 ' + seg.speed + ')');

  const w = new World(WATER_CHART);
  w.mode = 'spider';
  w.speedIdx = seg.speed;
  w.x = (target.b - 6) * U;
  w.y = target.r * U;
  w.checkX = w.x;
  /* 先自由跑到靶子前一格(不按),再按一次,然后数 120 步 */
  let guard = 0;
  while (w.x < (target.b - 1.2) * U && guard++ < 900 && !w.dead) w.frame(false);
  const before = w.spiderJumps;
  const jy0 = w.y;
  w.frame(true);                       // ← 就按这一次
  for (let i = 0; i < 120; i++) w.frame(false);
  const jumps = w.spiderJumps - before;
  console.log('按一次空格 ⇒ 瞬移 ' + jumps + ' 次' + (jumps > 1 ? '  ✗✗ 复现到了!' : '  ✓'));
  console.log('  (按下前 y=' + jy0.toFixed(1) + ' → 120 步后 y=' + w.y.toFixed(1) + ' · 死亡=' + w.dead + ')');
}

