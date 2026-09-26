/* 只读调试:为什么激光测试里"环没被吃到"?
   跑法:cd gd-web && node tools/probe-beam-dbg.ts
   ★ 只能用编辑工具改本文件(PowerShell 文本替换会弄坏中文编码 ✗) */
import { U } from '../src/sim/constants.ts';
import { World } from '../src/sim/world.ts';
import { WATER_CHART } from '../src/sim/charts/water.ts';

const lv = { ...WATER_CHART, objects: WATER_CHART.objects.filter((o) => o.kind === 'orb' && o.b > 2640 && o.b < 2650) };
console.log('这一段里的环:' + lv.objects.map((o) => o.orb + '@(' + o.b + ',' + o.r + ') w=' + o.w + ' h=' + o.h).join('  '));

const w = new World(lv as any);
w.x = 2647 * U; w.y = 84 * U; w.vy = 0; w.onGround = false; w.god = true;
console.log('放好后: x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) + ' box=' + w.box + ' onGround=' + w.onGround);
console.log('环命中表: ' + w.orbs.map((b) => '[' + b.x0 + ',' + b.x1 + ']×[' + b.y0 + ',' + b.y1 + ']').join(' '));
const inn = (w as any).outer ? (w as any).outer() : null;
console.log('玩家外盒: ' + JSON.stringify(inn));
console.log('pressFresh(前)=' + w.pressFresh + ' prevHold=' + w.prevHold);
w.frame(true);
console.log('一帧后: x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) +
  ' dead=' + w.dead + ' armedOrbs=' + w.armedOrbs.size + ' beams=' + w.beams.length +
  ' pressFresh=' + w.pressFresh + ' prevHold=' + w.prevHold + ' tick=' + w.tick);
