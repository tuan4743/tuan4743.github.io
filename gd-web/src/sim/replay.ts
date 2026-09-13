/* 回放:同一卷输入 → 同一串状态。这是整个项目的地基 ——
 * 之后每加一个物件、每调一个常量,都靠它证明"手感改动是有意的、不是撞出来的"。
 *
 * 同时也用来证明"自动铺面真的能过":机器人跑一遍录下输入,
 * 再把这卷输入原样回放,两次的状态必须逐帧一致。
 */

import { World, botThink, type RunState } from './world.ts';
import type { Level } from './level.ts';

export type Tape = boolean[];

export interface RunResult {
  states: RunState[];
  deaths: number;
  done: boolean;
  ticks: number;
}

/** 用机器人跑一遍,顺便录下它的输入 */
export function recordBot(level: Level, maxTicks = 60 * 600): RunResult & { tape: Tape } {
  const w = new World(level);
  const tape: Tape = [];
  const states: RunState[] = [];
  let deaths = 0;
  for (let i = 0; i < maxTicks; i++) {
    if (w.dead) { deaths++; w.respawn(); }
    const hold = botThink(w);
    tape.push(hold);
    w.frame(hold);
    states.push(w.state);
    if (w.done) break;
  }
  return { tape, states, deaths, done: w.done, ticks: states.length };
}

/** 原样回放一卷输入。
 *  注意:这里和 recordBot 一样,死亡后按同一策略自动复活 ——
 *  "一卷输入 + 一套复活策略"才构成完整的一次跑动;少了这一步,两次跑就会分岔。 */
export function replay(level: Level, tape: Tape): RunResult {
  const w = new World(level);
  const states: RunState[] = [];
  let deaths = 0;
  for (const hold of tape) {
    if (w.dead) { deaths++; w.respawn(); }
    w.frame(hold);
    states.push(w.state);
    if (w.done) break;
  }
  return { states, deaths, done: w.done, ticks: states.length };
}

/** 状态指纹:量化到 1e-4 再算 FNV-1a,避免把浮点末位噪声当成"不一样" */
export function fingerprint(states: RunState[]): string {
  let h = 0x811c9dc5;
  const q = (v: number) => Math.round(v * 1e4);
  const push = (n: number) => {
    for (let i = 0; i < 4; i++) { h ^= (n >>> (i * 8)) & 0xff; h = Math.imul(h, 0x01000193) >>> 0; }
  };
  for (const s of states) {
    push(q(s.x)); push(q(s.y)); push(q(s.vy));
    push(s.mode === 'ship' ? 1 : 0); push(s.gdir); push(s.speed);
    push(s.dead ? 1 : 0); push(s.done ? 1 : 0); push(s.attempts); push(q(s.checkX));
  }
  return ('00000000' + h.toString(16)).slice(-8);
}
