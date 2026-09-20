/* 输入卷审计:回放一卷输入,数出【每个必过门到底生效了没有】。
 *
 * 为什么要有这个独立模块:
 *   搜索进程内部记了一份账(handledPortals),但"这卷输入到底过没过门"是验收问题,
 *   不能让被验的人自己出报告 —— 这里拿一份干净的 World 从头回放,物理是唯一裁判。
 *   (和 tools/verify-run.ts 同一个口径,所以两边的结论必须一致。)
 *
 * ★ 判据和 autoplay 的 gateOk 一字不差,而且必须在【越过那一刻】判:
 *   · armedPortals —— 门真的开火了(物理自己记的);
 *   · 或者"碰不碰都一样" —— 原版的门只在你状态真的变了时才起作用:
 *     已经是球了再从球门滚过去什么都不会发生,这不算"跳过门"。
 *   这两条都依赖【当时的形态/重力/速度】,过后再问就变味了:
 *   重力门在越过时重力正好对得上(算过),三十块之后被球点翻成反重力,
 *   回头按"当前状态"判就变成"没生效" —— 以前搜索就是这么冤枉掉整条路的。
 *
 * ★ 四类门分散在四个表里(portals / gravs / speeds / sizes):
 *   只拿 w.portals 会漏掉 62 个门(108 → 46),而打印出来的标题还写着
 *   "portal/gravity/speed/size" —— 看着像都管了,其实后三类一个都没查。
 */
import { World } from '../src/sim/world.ts';
import type { Level, Obj } from '../src/sim/level.ts';
import { U } from '../src/sim/constants.ts';

export interface Audit {
  x: number;              // 走到的位置(块)
  y: number;
  mode: string;
  gdir: number;
  speedIdx: number;
  dead: boolean;
  done: boolean;
  frames: number;         // 回放了多少帧(中途死掉就少于卷长)
  total: number;          // 门总数
  armed: Set<Obj>;        // 越过时确实生效了的门
  skipped: Set<Obj>;      // 越过了却没生效 —— 这条路不算"按铺面路线走的"
  order: Obj[];           // 门的顺序(按右沿 x1)
}

/** 门生效的判据(和 autoplay.ts 的 portalSatisfied 一字不差,改一处必须改两处) */
export function satisfied(o: Obj, w: World): boolean {
  if (o.kind === 'portal') return w.mode === o.to;
  if (o.kind === 'gravity') return w.gdir === (o.gdir ?? 1);
  if (o.kind === 'speed') return w.speedIdx === (o.speed ?? 1);
  if (o.kind === 'size') return w.sizeMul !== 1;
  return false;
}

/** 四类门的判定盒,按右沿排(和搜索里的 mustPass 同序) */
export function doorBoxes(w: World) {
  return [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes].sort((a, b) => a.x1 - b.x1);
}

export function auditTape(lv: Level, tape: boolean[]): Audit {
  const w = new World(lv);
  const boxes = doorBoxes(w);
  const state = new Map<Obj, boolean>();         // 越过那一刻定下来的结果
  let frames = 0;
  for (const h of tape) {
    if (w.dead || w.done) break;
    w.frame(h);
    frames++;
    for (const b of boxes) {
      if (state.has(b.o)) continue;
      if (w.x < b.x1) continue;                   // 还没完全越过这个门
      state.set(b.o, w.armedPortals.has(b) || satisfied(b.o, w));
    }
  }
  const armed = new Set<Obj>(), skipped = new Set<Obj>();
  for (const [o, ok] of state) (ok ? armed : skipped).add(o);
  return {
    x: w.x / U, y: w.y / U, mode: w.mode, gdir: w.gdir, speedIdx: w.speedIdx,
    dead: w.dead, done: w.done, frames, total: boxes.length, armed, skipped,
    order: boxes.map((b) => b.o),
  };
}
