/* 诊断:回放一卷输入,把"它到底过没过每一个必过门"逐条列出来。
 * 用法:cd gd-web && node tools/diag-tape.ts <卷子.json> [只看 x>=多少块]
 *
 * 为什么要它:分站驱动判"到没到站"用的是几何阈值(门右沿 +0.5 块),
 * 而真正该问的是"这一卷有没有让这个门生效" —— 这两件事在门口附近会差 0.4 块,
 * 结果可能明明过了门却被判"没过",白白重搜一整站。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM = Number(process.argv[3] ?? 0);
const TO = process.argv[4] != null ? Number(process.argv[4]) : null;
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const tape: boolean[] = j.tape;
const lv = WATER_CHART;
const w = new World(lv);
const mustPass = w.portals
  .filter((b) => ['portal', 'gravity', 'speed', 'size'].includes(b.o.kind))
  .sort((a, b) => a.x1 - b.x1);

let frames = 0;
const trace: string[] = [];
const fine: string[] = [];
let lastX = -1e9;
let fi = 0;
for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  frames++; fi++;
  /* 窗口内逐帧打(塔段要看"哪一帧哪个弹簧生效",4 块一抽根本看不清) */
  if (TO != null) {
    const bx = w.x / U;
    if (bx >= FROM && bx <= TO) {
      fine.push(fi + ':' + bx.toFixed(2) + ',' + (w.y / U).toFixed(2) + w.mode[0]
        + (w.gdir < 0 ? '↑' : '↓') + 'vy' + (w.vy / U).toFixed(1) + (h ? 'H' : '.') + (w.onGround ? 'G' : ''));
    }
    continue;
  }
  /* 轨迹抽样:每前进 4 块记一次 —— "这一卷是在塔上还是在底下跑"必须看得见 */
  if (w.x / U >= lastX + 4) {
    lastX = w.x / U;
    trace.push((w.x / U).toFixed(0) + ':' + (w.y / U).toFixed(1) + w.mode[0] + (w.gdir < 0 ? '↑' : ''));
  }
}
console.log('卷子 ' + FILE + ':写了 x=' + j.x + ' maxX=' + j.maxX);
console.log('回放 ' + frames + '/' + tape.length + ' 帧 → x=' + (w.x / U).toFixed(2)
  + ' y=' + (w.y / U).toFixed(2) + ' 形态=' + w.mode + ' gdir=' + w.gdir
  + ' 速度档=' + w.speedIdx + (w.dead ? ' 【死了】' : w.done ? ' 【通关】' : ''));
console.log('轨迹(x:y形态,↑=反重力): ' + trace.join(' '));
if (TO != null) console.log('窗口 ' + FROM + '~' + TO + ' 逐帧(帧:x,y形态方向 vy 按键 G=贴地):\n  ' + fine.join('\n  '));

console.log('\n必过门逐条(门 x 右沿 → 回放结果):');
for (const b of mustPass) {
  const bx = b.x0 / U;
  if (bx < FROM) continue;
  const armed = w.armedPortals.has(b);
  const handled = w.handledPortals.has(b);
  const passed = w.x >= b.x1;
  const mark = !passed ? '没走到' : handled ? '★生效(越过时记下的)' : armed ? '生效(armed)' : '✗跳过了';
  console.log('  x0=' + (b.x0 / U).toFixed(2).padStart(8) + ' x1=' + (b.x1 / U).toFixed(2)
    + ' y0=' + (b.y0 / U).toFixed(2) + ' y1=' + (b.y1 / U).toFixed(2) + '  ' + String(b.o.kind).padEnd(8)
    + (b.o.kind === 'portal' ? '→' + b.o.to : b.o.kind === 'speed' ? 'speed=' + b.o.speed
      : b.o.kind === 'gravity' ? 'gdir=' + b.o.gdir : b.o.kind === 'size' ? 'size=' + b.o.size : '')
    + '  ' + mark);
}
