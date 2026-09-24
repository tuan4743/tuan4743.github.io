/* ============================================================
   CCLocalLevels.dat → 我们的铺面(src/sim/charts/<名字>.ts)
   ─────────────────────────────────────────────────────────────
   跑法:
     cd gd-web
     node tools/dat-to-chart.ts --file=../static/levels/CCLocalLevels.dat --level=WATER
       [--out=src/sim/charts/water.ts] [--song=/levels/WATER.mp3]

   干的事:
     ① 解包 .dat → 取指定那一关的物件行;
     ② 每行按 sim/gdids.ts 的映射表变成我们的物件(不认识的 ID 会列出来,绝不静默丢);
     ③ 补一条地面(原版的地面是隐含的,不会出现在物件表里);
     ④ 按"形态门 / 速度门"切段(段只影响配色与音乐换算,判定还是靠门);
     ⑤ 把物件写成紧凑文本表,连同头部一起写成 TS 模块。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSave, fieldsOf } from './lib/dat.ts';
import { mapRecord, START_ID } from '../src/sim/gdids.ts';
import type { Obj, Segment, Mode } from '../src/sim/level.ts';
import { U } from '../src/sim/constants.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name: string, dflt = '') => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};

const FILE = arg('file', path.resolve(HERE, '..', '..', 'static', 'levels', 'CCLocalLevels.dat'));
const WANT = arg('level', 'WATER');
const SONG = arg('song', '/levels/WATER.mp3');
const OUT = arg('out', path.resolve(HERE, '..', 'src', 'sim', 'charts', 'water.ts'));
/* ★ 用户口径(2026-09):pulse 不一个个放,【背景跟 BPM 闪】——
   所以这里按 --bpm= 注入【唯一一个】pulse 触发器在开头,它带 loop ⇒ sim 每 dur 秒把背景闪一次 ✓
   dur = 60 / BPM(一拍的长度,秒)。BPM 由 tools/../.tmp/bpm.json 的分析结果给,不猜 ✓ */
const BPM = Number(arg('bpm', '0')) || 0;

const levels = loadSave(FILE);
console.log('存档 ' + FILE);
levels.forEach((l, i) => console.log('  [' + (i + 1) + '] ' + l.name + ' · ' + l.lines.length + ' 物件'));
const lv = levels.find((l) => l.name === WANT);
if (!lv) {
  console.error('找不到关卡 ' + JSON.stringify(WANT) + '(可选:' + levels.map((l) => l.name).join(' / ') + ')');
  process.exit(1);
}

/* ---------- 逐行映射 ---------- */
const objs: Obj[] = [];
const unknownIds = new Map<number, number>();
const rawSample = new Map<number, string>();     // 未映射 ID 的原始行(≥1000 的大概率是触发器,要照抄)
const byId = new Map<number, number>();
let start: { b: number; r: number } | undefined;
for (const line of lv.lines) {
  const f = fieldsOf(line);
  const id = Number(f['1']);
  byId.set(id, (byId.get(id) ?? 0) + 1);
  /* ★ 起点标记(31):只用来定出生点。用户那关的起点在 (0.5, 10.5) —— 左边缘 0、脚底 10 格,
     也就是"铺面第一段的上一层"。不认它的话,人会出生在关卡底下被压死。 */
  if (id === START_ID) {
    const w = 1, h = 1;
    start = { b: Number(f['2']) / 30 - w / 2, r: Number(f['3']) / 30 - h / 2 };
    continue;
  }
  const o = mapRecord(f);
  if (!o) {
    unknownIds.set(id, (unknownIds.get(id) ?? 0) + 1);
    /* ★ 未映射的 ID≥1000:把【原始整行】留一份 —— 触发器 ID 表不凭记忆写死,
       用户放一个真样本(zoom / static 之类),这里就能直接照抄它的真实键 ✓ */
    if (id >= 1000 && !rawSample.has(id)) {
      rawSample.set(id, Object.entries(f).sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0))
        .map(([k, v]) => k + '=' + v).join(' '));
    }
    continue;
  }
  objs.push(o);
}
if (start) console.log('\n起点标记(31):出生点 = (' + start.b.toFixed(2) + ', ' + start.r.toFixed(2) + ') 块');
if (unknownIds.size) {
  console.log('\n⚠ 有 ' + unknownIds.size + ' 种 ID 没有映射(已跳过,请补 sim/gdids.ts):');
  for (const [id, n] of [...unknownIds.entries()].sort((a, b) => b[1] - a[1])) {
    console.log('   id ' + id + ' × ' + n + (rawSample.has(id) ? '\n       原始: ' + rawSample.get(id) + '   ← 照这一行补表,不用猜 ✓' : ''));
  }
}

/* ★ 触发器 / 触摸标记清单:转换时就打出来,别等进游戏才发现"加了没用" ✓
   用户口径:touch【只当标记,不生效】—— 他标位置,再告诉我那里要挂什么特效 */
const trigs = objs.filter((o) => o.kind === 'trigger');
console.log('\n触发器 ' + trigs.length + ' 个' + (trigs.length ? '(按 x 排):' : ' —— 这一版铺面里还没有'));
for (const t of trigs.slice().sort((a, b) => a.b - b.b)) {
  console.log('   x=' + (t.b + t.w / 2).toFixed(1) + ' y=' + (t.r + t.h / 2).toFixed(1) +
    '  ' + String(t.trigger).padEnd(7) + ' id=' + t.id +
    (t.groups?.length ? '  目标组=' + t.groups.join('.') : '  目标组=【没设 —— 触发器要靠组点名物件】') +
    (t.dur != null ? '  时长=' + t.dur + 's' : ''));
}
const marks = trigs.filter((t) => t.trigger === 'touch');
if (marks.length) {
  console.log('  其中触摸标记(touch · 只标记不生效)' + marks.length + ' 个 —— 按位置点名要什么特效:');
  marks.sort((a, b) => a.b - b.b).forEach((t, i) => console.log('    #' + (i + 1) + '  x=' + (t.b + t.w / 2).toFixed(1) + ' 格  y=' + (t.r + t.h / 2).toFixed(1) + ' 格'));
}

/* ---------- 边界:高度、长度 ---------- */
let maxX = 0, maxY = 0;
for (const o of objs) { maxX = Math.max(maxX, o.b + o.w); maxY = Math.max(maxY, o.r + o.h); }
const LENGTH = Math.ceil(maxX + 16);
const ROWS = Math.ceil(maxY + 4);

/* 地面:原版的地面是隐含的(不占物件),我们得自己补一条 —— 顺便往外各铺 16 块 */
objs.push({ kind: 'platform', b: -16, r: -1, w: LENGTH + 32, h: 1 });

/* ★ 按 BPM 注入唯一那个 pulse(见文件头 --bpm 说明)——
   放在出生点往右 2 格、和出生点同一行:触发器是【外框相交】判过线的,
   放到别的高度(比如 r=1)玩家一辈子碰不到 ⇒ 一次都不闪 ✗(别照抄编辑器里"随手放开头"的位置) */
if (BPM > 0) {
  const beat = 60 / BPM;
  const sb = start ? start.b : 0.5, sr = start ? Math.floor(start.r) : 10;
  objs.push({
    kind: 'trigger', trigger: 'pulse', id: 1006,
    b: sb + 2, r: sr, w: 1, h: 1, dur: beat, loop: true,
  });
  console.log('\n★ 注入 1 个 pulse 触发器(BPM=' + BPM + ' ⇒ 每拍 ' + beat.toFixed(4) + ' 秒,带 loop=背景跟 BPM 闪)');
  console.log('   位置 x=' + (sb + 2).toFixed(2) + ' 格(出生点右边 2 格)、y=' + sr + ' 格 —— 和出生点同一行才碰得到 ✓');
}

/* ---------- 切段:形态门 / 速度门 ---------- */
const events = objs.filter((o) => o.kind === 'portal' || o.kind === 'speed').sort((a, b) => a.b - b.b);
const firstSpeed = objs.filter((o) => o.kind === 'speed').sort((a, b) => a.b - b.b)[0];
const segments: Segment[] = [];
let cur: { from: number; mode: Mode; speed: number } = {
  from: 0, mode: 'cube', speed: firstSpeed?.speed ?? 1,
};
for (const e of events) {
  if (e.b <= cur.from + 1e-6) {
    if (e.kind === 'speed') cur.speed = e.speed ?? cur.speed;
    else cur.mode = e.to ?? cur.mode;
    continue;
  }
  segments.push({ from: cur.from, to: e.b, mode: cur.mode, speed: cur.speed, difficulty: 0, label: cur.mode });
  cur = { from: e.b, mode: e.kind === 'portal' ? (e.to ?? cur.mode) : cur.mode, speed: e.kind === 'speed' ? (e.speed ?? cur.speed) : cur.speed };
}
segments.push({ from: cur.from, to: LENGTH, mode: cur.mode, speed: cur.speed, difficulty: 0, label: cur.mode });

/* ---------- 统计 ---------- */
const kinds = new Map<string, number>();
for (const o of objs) {
  const key = o.kind === 'orb' ? 'orb:' + o.orb : o.kind === 'pad' ? 'pad:' + o.pad : o.kind === 'arrow' ? 'arrow:' + o.arrow : o.kind === 'deco' ? 'deco' : o.kind;
  kinds.set(key, (kinds.get(key) ?? 0) + 1);
}
console.log('\n关卡 ' + lv.name + ' · 物件 ' + (objs.length) + ' 个(含补的地面 1 条) · 长 ' + LENGTH + ' 块 · 高 ' + ROWS + ' 格');
console.log('  按我们的物件归类:');
for (const [k, n] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) console.log('    ' + k.padEnd(12) + String(n).padStart(6));
console.log('  段 ' + segments.length + ' 个:' + segments.slice(0, 12).map((s) => s.from.toFixed(0) + '→' + s.to.toFixed(0) + ' ' + s.mode).join(' | ') + (segments.length > 12 ? ' …' : ''));

/* ---------- 写成 TS ---------- */
const { encodeObjects, decodeObjects } = await import('../src/sim/gdids.ts');
const table = encodeObjects(objs);
/* ★ 往返自检:编码 → 解码 之后物件数必须一个不少 —— 少的那次就是"code 撞车"了
   (踩过:frame 和 force 都用 'F',1869 根线框在解码时全变成了力场) */
const back = decodeObjects(table);
if (back.length !== objs.length) {
  console.error('✗ 往返自检失败:写进去 ' + objs.length + ' 个,读回来 ' + back.length + ' 个');
  const cnt = (list: Obj[]) => {
    const m = new Map<string, number>();
    for (const o of list) m.set(o.kind, (m.get(o.kind) ?? 0) + 1);
    return m;
  };
  const a = cnt(objs), b = cnt(back);
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if ((a.get(k) ?? 0) !== (b.get(k) ?? 0)) console.error('   ' + k + ': 写 ' + (a.get(k) ?? 0) + ' → 读 ' + (b.get(k) ?? 0));
  }
  process.exit(1);
}
console.log('\n往返自检:编码 → 解码 ' + back.length + ' 个物件,一个不少 ✓');
const segLit = segments.map((s) => `  { from: ${+s.from.toFixed(2)}, to: ${+s.to.toFixed(2)}, mode: '${s.mode}', speed: ${s.speed}, label: '${s.label ?? ''}' },`).join('\n');
const head = `/* 生成物 —— 由 tools/dat-to-chart.ts 从 ${path.basename(FILE)} 生成,别手改。
 * 关卡:${lv.name} · 物件 ${objs.length} 个(含 1 条补的地面)· 长 ${LENGTH} 块 · 高 ${ROWS} 格
 * 段:按形态门/速度门切,共 ${segments.length} 段
 * 重新生成:cd gd-web && node tools/dat-to-chart.ts --level=${lv.name}
 *
 * 物件表格式:每行 "code b r [w] [h] [key=value …]",默认 w=h=1 —— 见 sim/gdids.ts 的文件头。
 */
import { makeChart } from '../gdids.ts';

const TABLE = \``;
const tail = `\`;

export const ${ident(lv.name)}_CHART = makeChart({
  name: ${JSON.stringify(lv.name)},
  rows: ${ROWS},
  length: ${LENGTH},
  song: ${JSON.stringify(SONG)},${start ? `\n  start: { b: ${+start.b.toFixed(2)}, r: ${+start.r.toFixed(2)} },` : ''}
  segments: [
${segLit}
  ],
}, TABLE);
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, head + '\n' + table + '\n' + tail, 'utf8');
console.log('\n写到 ' + OUT + '(' + Math.round(fs.statSync(OUT).size / 1024) + ' KB,物件表 ' + Math.round(table.length / 1024) + ' KB)');
console.log('tiles/单位换算自检:1 格 = ' + U + ' 单位;物件的 b 全部落在 ' + objs.filter((o) => o.kind !== 'deco').length + ' 个可判定物件上');

function ident(name: string) {
  return name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() || 'LEVEL';
}
