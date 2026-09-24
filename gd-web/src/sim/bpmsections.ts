/* 分段 BPM → pulse 触发器注入(用户 2026-09-24 口径)
 * ─────────────────────────────────────────────────────────────
 * 用户原话:"闪烁也做成分段的,因为歌曲每段 BPM 的差别挺大的" + "pulse 不一个个放,做成背景跟 BPM 闪,
 *          只放一个在开头" ⇒ 现在合成一条:【每一段各放一个带 loop 的 pulse】,段与段之间靠过线接力 ✓
 *
 * 接力的原理(已核对 sim 的 fire/stepAnims):带 loop 的 pulse 会把 pulsePeriod 换成自己的 dur,
 *   并按 phase(该段第一拍绝对时间)重算"离下一拍还有多久" ⇒ 新段触发时旧周期被覆盖,闪光自动对齐新段拍点 ✓
 *
 * 秒 → 块 的换算【必须用关卡真实速度】:本关有速度门,各段速度不同 ⇒
 *   按 dat-to-chart 切好的 segments(每段 from/to/speed)逐段累加时间,再反查 x ✓
 *   ★ 已知误差来源(注释写明,别假装精确):
 *     ① 出生点在 start.b(约 0.5 格)而不是 x=0 ⇒ 起步那 0.05 秒的偏差;
 *     ② 速度门本身的宽度/玩家穿过它需要的几帧;③ 段首速度取"第一个速度门的档"(dat-to-chart 既有口径)。
 */
import { U, vxOf } from './constants.ts';
import type { Obj, Segment } from './level.ts';

/** 分段表里的一段(由 tools/verify 的 BPM 分析产出) */
export interface BpmSection {
  t0: number;          // 该段起始时间(秒)
  t1: number;          // 该段结束时间(秒)
  bpm: number;
  period: number;      // 一拍多少秒(= 60/bpm;表里给了就用表里的)
  firstBeat: number;   // 该段第一拍的绝对时间(秒)= pulse 的 phase ✓
}

/** 该速度档:每秒走多少块 */
export function blocksPerSec(speed: number): number {
  return (vxOf(speed) * 60) / U;      // vxOf = 单位/帧 ⇒ ×60 单位/秒 ÷ 30 单位/块 = 块/秒 ✓
}

/** 秒 → 块(按关卡真实速度分段累加)✓ */
export function xAtTime(t: number, segments: Segment[]): number {
  if (!segments.length) return 0;
  let acc = 0;                                            // 已经走过的时间
  for (const s of segments) {
    const span = Math.max(0, s.to - s.from);
    const bps = blocksPerSec(s.speed);
    const dur = bps > 0 ? span / bps : 0;
    if (t <= acc + dur) return s.from + (t - acc) * bps;
    acc += dur;
  }
  const last = segments[segments.length - 1];
  return last ? last.to + (t - acc) * blocksPerSec(last.speed) : 0;
}

/** 容错解析:接受 数组 / { sections: [...] };字段名兼容 period|beatPeriod、firstBeat|first_beat|phase ✓ */
export function parseBpmSections(raw: unknown): BpmSection[] {
  const arr = Array.isArray(raw) ? raw
    : (raw && typeof raw === 'object' && Array.isArray((raw as { sections?: unknown }).sections))
      ? (raw as { sections: unknown[] }).sections
      : null;
  if (!arr) return [];
  const out: BpmSection[] = [];
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
    const bpm = num(o.bpm);
    const period = num(o.period) ?? num(o.beatPeriod) ?? (bpm && bpm > 0 ? 60 / bpm : null);
    const t0 = num(o.t0) ?? num(o.start) ?? 0;
    const t1 = num(o.t1) ?? num(o.end) ?? t0;
    const firstBeat = num(o.firstBeat) ?? num(o.first_beat) ?? num(o.phase) ?? t0;
    if (!period || period <= 0) continue;                 // 没有 bpm 也没有周期 ⇒ 这段跳过(不猜 ✗)
    out.push({ t0, t1, bpm: bpm ?? 60 / period, period, firstBeat });
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

/** 注入结果(给日志/自检用:每段落在哪一块上)✓ */
export interface BpmInjection { t0: number; bpm: number; x: number; period: number; firstBeat: number }

/** 按分段表注入 pulse 触发器(每段一个;回到 Obj 数组末尾追加)✓ */
export function injectBpmSections(objs: Obj[], sections: BpmSection[], segments: Segment[], spawnRow: number): BpmInjection[] {
  const log: BpmInjection[] = [];
  for (const s of sections) {
    const x = xAtTime(s.t0, segments);
    objs.push({
      kind: 'trigger', trigger: 'pulse', id: 1006,
      b: x, r: spawnRow, w: 1, h: 1,
      dur: s.period, phase: s.firstBeat, loop: true,
    });
    log.push({ t0: s.t0, bpm: s.bpm, x, period: s.period, firstBeat: s.firstBeat });
  }
  return log;
}
