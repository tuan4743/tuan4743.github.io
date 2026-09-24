/* ============================================================
   触发器 / 触摸标记 清单:把 CCLocalLevels.dat 里的触发器物件【原样】掏出来
   ─────────────────────────────────────────────────────────────
   跑法:
     cd gd-web
     node tools/trigger-report.ts                     # 默认 ../static/levels/CCLocalLevels.dat,列全部关卡
     node tools/trigger-report.ts --level=WATER
     node tools/trigger-report.ts --file=别的存档.dat --level=WATER 2

   为什么要有这个工具(用户 2026-09 要加铺面特效:move / shake / touch / pulse / static / zoom):
     触发器 ID 表和字段键我【不凭记忆写死】—— 记错一位的代价是把触发器当方块吞掉,
     比"不认识"糟得多(不认识的会被打印出来,认错的会静默变成别的东西 ✗)。
     所以流程定死:用户在编辑器里各放一个样本 → 存一次档 → 跑这个工具:
       ① 认出来的触发器:类型 + 目标组(键 51)+ 时长(键 10)+ 【全部原始键】
       ② 没认出来但 ID≥1000 的物件:连整行原样打出来 ⇒ 那就是真实 ID 和真实键
     拿到这两样,补 TRIGGER_IDS / 键映射就是照抄,不用猜 ✓

     它同时就是【触摸标记清单】:touch 按 x 排好,用户按位置点名"这里要什么特效" ✓
   ============================================================ */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSave, fieldsOf } from './lib/dat.ts';
import { TRIGGER_IDS, mapRecord } from '../src/sim/gdids.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name: string, dflt = '') => {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const FILE = arg('file', path.resolve(HERE, '..', '..', 'static', 'levels', 'CCLocalLevels.dat'));
const WANT = arg('level', '');

const levels = loadSave(FILE);
console.log('存档 ' + FILE + ' · ' + levels.length + ' 关');
const pick = WANT ? levels.filter((l) => l.name === WANT) : levels;
if (WANT && !pick.length) {
  console.error('找不到关卡 ' + JSON.stringify(WANT) + '(可选:' + levels.map((l) => l.name).join(' / ') + ')');
  process.exit(1);
}

const rd = (v: number) => Math.round(v * 10) / 10;
/** 把一行物件的键按数字顺序排开 —— 校准要的就是这个原文 */
const rawLine = (f: Record<string, string>) =>
  Object.entries(f).sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0)).map(([k, v]) => k + '=' + v).join(' ');

for (const lv of pick) {
  const trig: Array<{ id: number; kind: string; x: number; y: number; tg: string; dur: string; raw: string }> = [];
  const unknown = new Map<number, { n: number; sample: string }>();
  const otherIds = new Map<number, number>();
  for (const line of lv.lines) {
    const f = fieldsOf(line);
    const id = Math.round(Number(f['1']));
    const x = Number(f['2']) / 30, y = Number(f['3']) / 30;
    const spec = TRIGGER_IDS[id];
    if (spec) {
      trig.push({
        id, kind: spec.trigger, x, y,
        tg: f['51'] ?? '-', dur: f['10'] ?? '-', raw: rawLine(f),
      });
      continue;
    }
    otherIds.set(id, (otherIds.get(id) ?? 0) + 1);
    /* ★ 只把【引擎真的不认】的算进来 —— 引擎认得的(锯片/装饰/存档点/跳环…)不属于这一类。
       第一版没做这个过滤,结果 1705/3812/2063 全被列成"没认的",吓人一跳 ✗ */
    if (id >= 1000 && mapRecord(f) == null) {
      const u = unknown.get(id);
      if (u) u.n++; else unknown.set(id, { n: 1, sample: rawLine(f) });
    }
  }

  console.log('\n===== ' + lv.name + ' · ' + lv.lines.length + ' 物件 =====');
  const touch = trig.filter((t) => t.kind === 'touch');
  console.log('【触发器】认出来 ' + trig.length + ' 个' + (trig.length ? '(按 x 排):' : ' —— 这关现在一个都没有'));
  for (const t of trig.sort((a, b) => a.x - b.x)) {
    console.log('   x=' + String(rd(t.x)).padStart(8) + '  y=' + String(rd(t.y)).padStart(7) +
      '  ' + t.kind.padEnd(7) + ' id=' + String(t.id).padStart(5) +
      '  目标组(51)=' + t.tg + '  时长(10)=' + t.dur);
    console.log('        原始键: ' + t.raw);
  }
  console.log('\n【触摸标记清单】' + (touch.length ? touch.length + ' 个 —— 你按位置点名要什么特效:' : '0 个'));
  touch.sort((a, b) => a.x - b.x).forEach((t, i) => {
    console.log('   #' + (i + 1) + '  x=' + rd(t.x) + ' 格(第 ' + Math.floor(t.x) + ' 块)  y=' + rd(t.y) + ' 格' +
      (t.tg !== '-' ? '  你给它标的组=' + t.tg : ''));
  });
  if (unknown.size) {
    console.log('\n【ID≥1000 但我还没认的】' + unknown.size + ' 种 —— 这里就有真实 ID 和真实键(样本一放就能照抄):');
    for (const [id, u] of [...unknown.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log('   id ' + String(id).padStart(5) + ' ×' + String(u.n).padStart(4) + '  ' + u.sample);
    }
  } else {
    console.log('\n【ID≥1000 但我还没认的】0 种(铺面里没放触发器样本,或全认出来了)');
  }
  const top = [...otherIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, n]) => 'id' + id + '×' + n).join(' · ');
  console.log('(本关物件最多的几个 ID:' + top + ')');
}
