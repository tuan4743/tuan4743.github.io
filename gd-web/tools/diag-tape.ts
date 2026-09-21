/* 诊断:回放一卷输入,把"它到底过没过每一个必过门"逐条列出来,顺带打轨迹。
 * 用法:cd gd-web && node tools/diag-tape.ts <卷子.json> [只看 x>=多少块] [逐帧窗口的终点块]
 *
 * 为什么要它:分站驱动判"到没到站"以前用的是几何阈值(门右沿 +0.5 块),
 * 而真正该问的是"这一卷有没有让这个门生效" —— 塔段那卷走在地面 y=0 却把 maxX 顶到 607,
 * 于是"607 之前全过了"的假象让驱动器一整轮都没再去搜塔上的门。
 * 审计逻辑在 tools/audit.ts,和分站驱动共用一份,不许两边各写一套。
 * 给了第三个参数就打【逐帧窗口】—— 塔段要看清"哪一帧哪个弹簧生效",4 块一抽根本看不清。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { auditTape } from './audit.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const FILE = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM = Number(process.argv[3] ?? 0);
const TO = process.argv[4] != null ? Number(process.argv[4]) : null;
const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const tape: boolean[] = j.tape;
const a = auditTape(WATER_CHART, tape);
console.log('卷子 ' + FILE + ':写了 x=' + j.x + ' maxX=' + j.maxX);
console.log('回放 ' + a.frames + '/' + tape.length + ' 帧 → x=' + a.x.toFixed(2) + ' y=' + a.y.toFixed(2)
  + ' 形态=' + a.mode + ' gdir=' + a.gdir + ' 速度档=' + a.speedIdx
  + (a.dead ? ' 【死了】' : a.done ? ' 【通关】' : ''));
console.log('必过门 ' + a.total + ' 个:生效 ' + a.armed.size + ' · 跳过 ' + a.skipped.size
  + (a.skipped.size ? ' ← 有门没生效,这条路不算按铺面路线走' : ' ✓ 全部生效'));

/* 轨迹:每前进 4 块记一次(或者打 FROM~TO 的逐帧窗口) */
const w = new World(WATER_CHART);
const trace: string[] = [];
const fine: string[] = [];
let lastX = -1e9, fi = 0;
for (const h of tape) {
  if (w.dead || w.done) break;
  w.frame(h);
  fi++;
  const bx = w.x / U;
  if (TO != null) {
    if (bx >= FROM && bx <= TO) {
      fine.push(fi + ':' + bx.toFixed(2) + ',' + (w.y / U).toFixed(2) + w.mode[0]
        + (w.gdir < 0 ? '↑' : '↓') + 'vy' + (w.vy / U).toFixed(1) + (h ? 'H' : '.') + (w.onGround ? 'G' : ''));
    }
  } else if (bx >= lastX + 4) {
    lastX = bx;
    trace.push(bx.toFixed(0) + ':' + (w.y / U).toFixed(1) + w.mode[0] + (w.gdir < 0 ? '↑' : ''));
  }
}
if (TO != null) console.log('窗口 ' + FROM + '~' + TO + ' 逐帧(帧:x,y形态方向 vy 按键 G=贴地):\n  ' + fine.join('\n  '));
else console.log('轨迹(x:y形态,↑=反重力): ' + trace.join(' '));

console.log('\n门逐条(按右沿排,只看 x≥' + FROM + '):');
for (const o of a.order) {
  if (o.b < FROM) continue;
  const ok = a.armed.has(o) ? '✓生效' : a.skipped.has(o) ? '✗跳过了' : '—没走到';
  const what = o.kind === 'portal' ? '→' + o.to
    : o.kind === 'speed' ? 'speed=' + o.speed
      : o.kind === 'gravity' ? 'gdir=' + o.gdir
        : o.kind === 'size' ? 'size=' + (o.mini === false ? 'normal' : 'mini') : '';
  console.log('  b=' + o.b.toFixed(2).padStart(8) + '  ' + o.kind.padEnd(8) + what.padEnd(12) + ok);
}
