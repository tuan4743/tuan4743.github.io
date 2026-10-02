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

/** 块 → 秒(和 xAtTime 互逆:同一套"按速度分段累加" ✓) */
export function tAtX(x: number, segments: Segment[]): number {
  let acc = 0;
  for (const s of segments) {
    const bps = blocksPerSec(s.speed);
    if (x < s.to) return acc + (bps > 0 ? (x - s.from) / bps : 0);
    acc += bps > 0 ? (s.to - s.from) / bps : 0;
  }
  return acc;
}

/** 只有这些速度档才闪 —— 用户 2026-09-25:"pulse 改成只有三档速度和四档速度触发,不然太奇怪" ✓ */
export const PULSE_SPEEDS = [3, 4];

/** 注入结果(给日志/自检用:落在哪一块、那一段的速度档、注没注、用的什么周期)✓ */
export interface BpmInjection { x: number; t: number; speed: number; injected: boolean; bpm: number; period: number; firstBeat: number }

/** 按【速度档】注入 pulse(不再是"每个 BPM 段一个")✓
 *  ★★ 开关时刻必须落在【速度门的 x】上,不是歌曲分段边界上 ——
 *     用户要的是"只有三/四档才闪",而速度变更是【关卡结构】⇒ 跟它对齐才不奇怪 ✓
 *  每个速度段的起点放一个 loop pulse:
 *    速度 ∈ PULSE_SPEEDS ⇒ 开闪,周期/相位取【覆盖该时刻的 BPM 段】(音乐网格还是按歌走 ✓)
 *    否则             ⇒ dur=0 的 loop pulse = 【停闪】(sim 里 dur=0 ⇒ pulsePeriod 归零)✓
 *  连续同速的段只放第一个(否则会塞一堆重复触发器)✓ */
export function injectBpmSections(objs: Obj[], sections: BpmSection[], segments: Segment[], spawnRow: number, speeds: number[] = PULSE_SPEEDS): BpmInjection[] {
  const log: BpmInjection[] = [];
  let prevSpeed: number | null = null;
  for (const seg of segments) {
    if (prevSpeed === seg.speed) continue;              // 速度没变 ⇒ 不重复注入 ✓
    prevSpeed = seg.speed;
    const x = seg.from;
    const t = tAtX(x, segments);
    const bs = sections.find((s) => t >= s.t0 && t < s.t1) ?? sections[sections.length - 1];
    const on = speeds.includes(seg.speed) && !!bs;
    const period = on && bs ? bs.period : 0;
    const phase = on && bs ? bs.firstBeat : 0;
    objs.push({
      kind: 'trigger', trigger: 'pulse', id: 1006,
      b: x, r: spawnRow, w: 1, h: 1, dur: period, phase, loop: true,
    });
    log.push({ x, t, speed: seg.speed, injected: on, bpm: bs ? bs.bpm : 0, period, firstBeat: phase });
  }
  return log;
}
