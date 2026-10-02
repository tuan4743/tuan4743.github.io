/* 手工微调:在某个起点帧之后接一段"先松 D 帧(波浪下扎)+ 交替按住/松开(稳住高度)"的尾段,
 * 看不同 D 能不能让目标门生效、并且不跳过别的必过门。
 * 用法:cd gd-web && node tools/hand-dive.ts <卷子> <起帧> <目标门x> <D...> [--sawbase]
 *
 * 为什么要它:到了"门缝只有零点几块"的地方,通用搜索给不出答案,
 * 手工算一条弧线再验证反而更快 —— 而且这个脚本会把【生效/跳过的门数】一并报出来,
 * 所以手接的尾段是不是合法(有没有从别的门旁边飞过去)一眼就能看到。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';
import fs from 'node:fs';

const SRC = process.argv[2] ?? '../../.tmp/gd/water-route.best.json';
const FROM = Number(process.argv[3] ?? 5524);
const DOOR_X = Number(process.argv[4] ?? 1060);
const DS = process.argv.slice(5).filter((a) => /^\d+$/.test(a)).map(Number);
const SAWBASE = process.argv.includes('--sawbase');
const base: boolean[] = JSON.parse(fs.readFileSync(SRC, 'utf8')).tape;
if (SAWBASE) console.log('锯片判定盒:不缩放(基础尺寸)');

function run(inputs: boolean[]) {
  const w = new World(WATER_CHART, undefined, undefined, { sawUnscaled: SAWBASE });
  /* ★ 目标门的 Box 必须从这个 World 里取(每个 World 各建一套 Box 实例)。 */
  const door = [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes]
    .find((b) => Math.abs(b.o.b - DOOR_X) < 0.01);
  if (!door) throw new Error('没找到门 x=' + DOOR_X);
  const all = base.slice(0, FROM).concat(inputs);
  const armed = new Set<unknown>(); const skipped = new Set<unknown>();
  for (const h of all) {
    if (w.dead || w.done) break;
    w.frame(h);
    for (const b of [...w.portals, ...w.gravs, ...w.speeds, ...w.sizes]) {
      if (armed.has(b) || skipped.has(b)) continue;
      if (w.x < b.x1) continue;
      const o = b.o;
      const sat = o.kind === 'portal' ? w.mode === o.to
        : o.kind === 'gravity' ? w.gdir === (o.gdir ?? 1)
          : o.kind === 'speed' ? w.speedIdx === (o.speed ?? 1)
            : o.kind === 'size' ? (o.mini === false ? w.sizeMul === 1 : w.sizeMul !== 1) : false;
      (w.armedPortals.has(b) || sat ? armed : skipped).add(b);
    }
  }
  return {
    x: w.x / U, y: w.y / U, mode: w.mode, dead: w.dead,
    armed: armed.size, skipped: skipped.size, doorOn: w.armedPortals.has(door),
  };
}

const d0 = run([]);
console.log('原样(不补尾段):x=' + d0.x.toFixed(2) + ' y=' + d0.y.toFixed(2)
  + ' · 门' + (d0.doorOn ? '生效' : '没生效') + ' · 生效 ' + d0.armed + ' 跳过 ' + d0.skipped);

/* --pat=xxxx —— 直接给按键串(0=松手 1=按住),后面的帧一律松手。
   到了这种"门缝零点几块"的地方,与其让脚本枚举,不如人把弧线算出来再让脚本验证。 */
const patArg = process.argv.find((a) => a.startsWith('--pat='));
if (patArg) {
  const s = patArg.slice(6);
  const inputs = s.split('').map((c) => c === '1').concat(new Array(40).fill(false));
  const r = run(inputs);
  console.log('pat=' + s + ' → x=' + r.x.toFixed(2) + ' y=' + r.y.toFixed(2) + ' ' + r.mode
    + (r.dead ? ' 死' : '') + ' · 门' + (r.doorOn ? '★生效' : '没生效')
    + ' · 生效 ' + r.armed + ' 跳过 ' + r.skipped
    + (r.skipped === 0 && r.doorOn ? '  ✓ 合法' : ''));
  if (r.skipped === 0 && r.doorOn) {
    fs.writeFileSync('../../.tmp/gd/gap-hand.json', JSON.stringify({ from: FROM, inputs }));
    console.log('   ↑ 已写到 ../../.tmp/gd/gap-hand.json(可用 tape-splice 拼成新前缀)');
  }
}

for (const D of DS) {
  for (const zig of [0, 2, 4, 6]) {
    const inputs = new Array(D).fill(false)
      .concat(Array.from({ length: zig }, (_, k) => k % 2 === 0))
      .concat(new Array(40).fill(false));
    const r = run(inputs);
    const okAll = r.skipped === 0 && r.doorOn;
    console.log('松 ' + D + ' 帧 + 交替 ' + zig + ' 帧 → x=' + r.x.toFixed(2) + ' y=' + r.y.toFixed(2)
      + ' ' + r.mode + (r.dead ? ' 死' : '') + ' · 门' + (r.doorOn ? '★生效' : '没生效')
      + ' · 生效 ' + r.armed + ' 跳过 ' + r.skipped + (okAll ? '  ✓ 合法' : ''));
    if (okAll) {
      fs.writeFileSync('../../.tmp/gd/gap-hand.json',
        JSON.stringify({ from: FROM, inputs }));
      console.log('   ↑ 把这段写到 ../../.tmp/gd/gap-hand.json,可用 tape-splice 拼成新前缀');
    }
  }
}
