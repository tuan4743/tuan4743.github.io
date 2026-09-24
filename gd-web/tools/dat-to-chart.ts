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
import { injectBpmSections, parseBpmSections, type BpmSection } from '../src/sim/bpmsections.ts';
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
/* ★ 第一拍的绝对时间(秒),由 BPM 分析给出(见 .tmp/bpm.json)—— 光有周期不够:
   玩家过线在开局约 0.19 秒处,音乐第一拍在 0.3335 秒 ⇒ 不补这个相位,闪光会整体早 0.14 秒 ✗ */
const PHASE = Number(arg('phase', '0')) || 0;
/* ★★ 分段 BPM 表(用户:"闪烁也做成分段的,因为歌曲每段 BPM 的差别挺大的")——
   由 BPM 分析产出(.tmp/bpm-sections.json):每段 { t0, t1, bpm, period, firstBeat }
   ⇒ 每段注入一个带 loop 的 pulse,段与段靠过线接力(新 pulse 覆盖周期 + 重算相位)✓ */
const SECTIONS_FILE = arg('bpmsections', '');
const SECTIONS: BpmSection[] = SECTIONS_FILE
  ? parseBpmSections(JSON.parse(fs.readFileSync(SECTIONS_FILE, 'utf8')))
  : [];
if (SECTIONS_FILE) console.log('分段 BPM 表 ' + SECTIONS_FILE + ' ⇒ ' + SECTIONS.length + ' 段 ✓');

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
const startMarkers: Array<{ b: number; r: number }> = [];
for (const line of lv.lines) {
  const f = fieldsOf(line);
  const id = Number(f['1']);
  byId.set(id, (byId.get(id) ?? 0) + 1);
  /* ★ 起点标记(31):只用来定出生点。用户那关的起点在 (0.5, 10.5) —— 左边缘 0、脚底 10 格,
     也就是"铺面第一段的上一层"。不认它的话,人会出生在关卡底下被压死。 */
  /* ★★ 用户 2026-09-24:"我忘记删掉中间的 start point 了" ——
     编辑器里放了多个起点标记时,以前是【后一个覆盖前一个】⇒ 出生点跑到关卡中间去 ✗
     现在改成取【最左边】那个(= 真正的关卡起点),并把有几个打出来提醒他删 ✓ */
  if (id === START_ID) {
    const cand = { b: Number(f['2']) / 30 - 0.5, r: Number(f['3']) / 30 - 0.5 };
    startMarkers.push(cand);
    if (!start || cand.b < start.b) start = cand;
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
if (startMarkers.length > 1) {
  console.log('⚠ 关卡里有 ' + startMarkers.length + ' 个起点标记,分别在 x = ' +
    startMarkers.map((m) => m.b.toFixed(1)).join(' / ') + ' 格 —— 按【最左边】那个当出生点 ✓' +
    '\n   (这是编辑器里多放的,中间那些建议删掉;不删也不会再顶掉出生点了 ✓)');
}
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

/* ★ pulse 的注入移到【切段之后】—— 秒 → 块 要用关卡真实速度分段换算,不能用固定常数硬套 ✓ */
if (BPM > 0 && !SECTIONS.length) {
  const beat = 60 / BPM;
  const sb = start ? start.b : 0.5, sr = start ? Math.floor(start.r) : 10;
  objs.push({
    kind: 'trigger', trigger: 'pulse', id: 1006,
    b: sb + 2, r: sr, w: 1, h: 1, dur: beat, loop: true, phase: PHASE,
  });
  console.log('\n★ 注入 1 个 pulse 触发器(BPM=' + BPM + ' ⇒ 每拍 ' + beat.toFixed(4) + ' 秒,loop=背景跟 BPM 闪)');
  console.log('   相位=' + PHASE + ' 秒(第一拍)⇒ 闪光落在拍点上,不是"过线就闪"✓');
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

/* ---------- BPM 背景闪:注入 pulse(每段一个,段间靠过线接力)----------
   ★ 用户口径:"闪烁也做成分段的,因为歌曲每段 BPM 的差别挺大的" +
     "pulse 不一个个放 ⇒ 背景跟 BPM 闪,只放一个在开头" ⇒ 合成一条:每段一个带 loop 的 pulse ✓
   ★ 秒 → 块 用【关卡真实速度】:本关有速度门、各段速度不同 ⇒ 拿刚切好的 segments 逐段累加时间反查 x ✓
     误差来源(如实写在 sim/bpmsections.ts 文件头):出生点在 start.b(≈0.5 格)不是 0、
     速度门自身宽度、段首速度取"第一个速度门的档"(dat-to-chart 既有口径)✓
   ★ 触发器的 y 现在无所谓了 —— 触发器按"越过 x"判(user 报"触发器都没生效"的 bug 已修),
     但仍旧放在出生行上,和编辑器里的观感一致 ✓ */
if (SECTIONS.length) {
  const sr = start ? Math.floor(start.r) : 10;
  const injected = injectBpmSections(objs, SECTIONS, segments, sr);
  console.log('\n★ 按分段 BPM 注入 ' + injected.length + ' 个 pulse(每段一个,带 loop=背景跟 BPM 闪):');
  for (const e of injected) {
    console.log('   t=' + e.t0.toFixed(2) + 's  BPM=' + (Math.round(e.bpm * 100) / 100) +
      '  每拍 ' + e.period.toFixed(4) + 's  相位=' + e.firstBeat.toFixed(3) + 's  ⇒ x=' + e.x.toFixed(2) + ' 格');
  }
  const notInc = injected.filter((e, i) => i > 0 && e.x <= injected[i - 1].x);
  console.log(notInc.length
    ? '   ⚠ 有 ' + notInc.length + ' 段的 x 没有递增(段太短 / 速度换算有误差)⇒ 接力顺序会乱,先查分段表 ✗'
    : '   x 严格递增 ⇒ 段与段会按顺序依次接力 ✓');
}

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
