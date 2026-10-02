/* 真轨迹上的两张状态表(用户可以自己跑,输出就是证据):
 *   ① 形态 / 重力 / 速度 / 尺寸 门的【进门前后】状态
 *   ② 存档点触发时【存了什么】、以及当时玩家自己是什么状态
 *
 * 为什么这样测(踩过的坑):
 *   手工把玩家"摆"到物件附近是不可靠的 —— 我连着两次摆不进判定盒,探针全废 ✗。
 *   这里改成:开无敌(god)让机器人一路往前跑,【每帧轮询状态】,变了就打印 ✓
 *   —— 不需要"零死通关",只要真的路过那些物件就行;而且不改 sim 一行代码 ✓。
 *
 * 跑法:cd gd-web && node tools/state-tables.ts
 * 输出:门的状态变化(前 14 条)+ 存档点(前 8 个)+ 总次数 + 走到哪
 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World, botThink } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const w = new World(WATER_CHART);
w.god = true;
let prev = { mode: w.mode, gdir: w.gdir, speedIdx: w.speedIdx, size: w.sizeMul };
let pcp = { x: w.checkX, y: w.checkY, mode: w.checkMode };
console.log('=== 形态 / 重力 / 速度 / 尺寸 门 ===');
let doors = 0, cps = 0;
for (let i = 0; i < 60 * 400 && !w.done; i++) {
  w.frame(botThink(w));
  if (w.mode !== prev.mode || w.gdir !== prev.gdir || w.speedIdx !== prev.speedIdx || w.sizeMul !== prev.size) {
    doors++;
    if (doors <= 14) {
      console.log('  x=' + (w.x / U).toFixed(1).padStart(7) + '  '
        + (w.mode !== prev.mode ? '形态 ' + prev.mode + '→' + w.mode + '  ' : '')
        + (w.gdir !== prev.gdir ? '重力 ' + prev.gdir + '→' + w.gdir + '  ' : '')
        + (w.speedIdx !== prev.speedIdx ? '速度档 ' + prev.speedIdx + '→' + w.speedIdx + '  ' : '')
        + (w.sizeMul !== prev.size ? '体积 ' + prev.size + '→' + w.sizeMul : ''));
    }
  }
  prev = { mode: w.mode, gdir: w.gdir, speedIdx: w.speedIdx, size: w.sizeMul };
  if (w.checkX !== pcp.x || w.checkY !== pcp.y || w.checkMode !== pcp.mode) {
    cps++;
    if (cps <= 8) {
      console.log('=== 存档点 #' + cps + ' 触发于 x=' + (w.x / U).toFixed(1)
        + ' ⇒ 存下:x=' + (w.checkX / U).toFixed(2) + ' y=' + (w.checkY / U).toFixed(2)
        + ' 形态=' + w.checkMode + ' 重力=' + w.checkGdir + ' 速度档=' + w.checkSpeed + ' 体积=' + w.checkSize
        + '   (当时人:x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' 形态=' + w.mode
        + ' 重力=' + w.gdir + ' 速度档=' + w.speedIdx + ')');
    }
  }
  pcp = { x: w.checkX, y: w.checkY, mode: w.checkMode };
}
console.log('共:门类状态变化 ' + doors + ' 次 · 存档点触发 ' + cps + ' 次 · 走到 x='
  + (w.x / U).toFixed(1) + ' / ' + WATER_CHART.length);
