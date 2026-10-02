/* 绿环可达性探测:玩家放在环左侧同一高度,纵向偏移逐档试 ⇒ 量"离环心多远还能激活"
   判据:激活 = gdir 翻成 −1(green 环 = 翻重力 + 跳;下方 id=10 门是 gd=1 不翻)
   跑法:cd gd-web && node tools/diag-green2.ts */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const lv = WATER_CHART;
const orb = lv.objects.find((o) => o.id === 1022 && o.b > 513 && o.b < 760)!;
const cx = orb.b + orb.w / 2, cy = orb.r + orb.h / 2;
console.log('绿环中心 (' + cx + ',' + cy + ') 格');

function probe(dx: number, dy: number, pressAt: number) {
  const w = new World(lv);
  w.god = true; w.mode = 'cube';
  w.x = (cx + dx) * U; w.y = (cy + dy) * U - 15;     // 玩家中心 = 该点(盒高 30,故 y 是中心−半高)
  w.vy = 0; w.gdir = 1; w.dead = false;
  let flipped = false, vyAt = 0, actX = 0, actY = 0;
  for (let f = 0; f < 12; f++) {
    w.frame(f === pressAt);
    if (!flipped && w.gdir === -1) { flipped = true; vyAt = w.vy; actX = w.x / U; actY = w.y / U; }
  }
  return { flipped, vyAt, actX, actY, gdir: w.gdir };
}

console.log('\n【激活 = gdir 翻成 −1】玩家从环左侧 0.8 格、同一高度起(空中按一次):');
for (const dy of [-1.5, -1.2, -1.0, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5]) {
  const r = probe(-0.8, dy, 1);
  console.log('  纵向偏移 ' + String(dy).padStart(5) + ' 格  ⇒ ' + (r.flipped ? '★ 激活 gdir→−1 vy=' + r.vyAt.toFixed(2) : '没激活') +
    '  (12 帧后 gdir=' + r.gdir + ')');
}
console.log('\n【对照】同一高度、只按不碰环(横向 −3 格):');
const far = probe(-3, 0, 1);
console.log('  ' + (far.flipped ? '★ 竟然翻了(异常)' : '没激活 ✓ (说明不是"按键就翻")'));
