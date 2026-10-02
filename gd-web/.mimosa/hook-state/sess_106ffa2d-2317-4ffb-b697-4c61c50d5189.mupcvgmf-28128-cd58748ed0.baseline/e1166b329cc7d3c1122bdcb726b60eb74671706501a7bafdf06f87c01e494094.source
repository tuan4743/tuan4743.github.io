/* 黑环 dash 诊断(只读):走真实输入路径 —— 找 id=1330,把玩家放在它左边同高,
   分别用【到环那一帧才按下(有新边沿)】和【一路按住(到环时没有新边沿)】两种输入,
   逐帧打印 tick/x/y/vx/vy/dash/gdir ⇒ 看 dash 到底活了几帧、有没有位移。 */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const orbs = WATER_CHART.objects.filter((o) => o.id === 1330);
console.log('黑环(1330)' + orbs.length + ' 个:' + orbs.map((o) => '(' + (o.b + o.w / 2) + ',' + (o.r + o.h / 2) + ')格 rot=' + (o.rot ?? 0)).join(' '));

function run(label: string, holdFromStart: boolean) {
  const w = new World(WATER_CHART);
  const orb = orbs[0];
  const cx = (orb.b + orb.w / 2) * U, cy = (orb.r + orb.h / 2) * U;
  /* 玩家中心放在环【左边 1 格】、同一高度:一帧走 ~5.77 单位,几帧内就能碰到环 */
  w.mode = 'cube'; w.gdir = 1; w.dead = false;
  w.x = cx - U * 1.0 - w.box / 2; w.y = cy - w.box / 2; w.vy = 0; w.onGround = false;
  console.log('\n== ' + label + ' ==  起点 (' + (w.x / U).toFixed(2) + ',' + (w.y / U).toFixed(2) + ') 格;环心 (' + (cx / U).toFixed(2) + ',' + (cy / U).toFixed(2) + ')');
  let armed = false, dashFrames = 0, firstDash = -1, lastDash = -1;
  for (let f = 0; f < 40; f++) {
    const x0 = w.x, y0 = w.y;
    /* 真实输入:holdFromStart ⇒ 全程按住(到环时无新边沿);否则"到环那一帧才按下" */
    const hold = holdFromStart ? true : (f >= 6);
    w.frame(hold);
    const hit = w['armedOrbs'] instanceof Set && [...(w as unknown as { armedOrbs: Set<unknown> }).armedOrbs].length > 0;
    if (hit) armed = true;
    if (w.dash) { dashFrames++; if (firstDash < 0) firstDash = f; lastDash = f; }
    if (f >= 4 && f <= 20) {
      console.log('  f' + String(f).padStart(2) + ' hold=' + (hold ? '1' : '0') +
        ' x=' + (w.x / U).toFixed(2) + ' y=' + (w.y / U).toFixed(2) +
        ' dx=' + ((w.x - x0) / U).toFixed(3) + ' dy=' + ((w.y - y0) / U).toFixed(3) +
        ' vx=' + w.vx.toFixed(2) + ' vy=' + w.vy.toFixed(2) +
        ' dash=' + (w.dash ? w.dash.kind + '@' + w.dash.ang + '°' : '-') + ' gdir=' + w.gdir + (hit ? ' [环已吃]' : ''));
    }
  }
  console.log('  ⇒ 环被吃=' + armed + ' · dash 帧数=' + dashFrames + (firstDash >= 0 ? ' (f' + firstDash + '~f' + lastDash + ')' : '') +
    ' · 40 帧总位移 dx=' + ((w.x - (cx - U * 1.0 - w.box / 2)) / U).toFixed(2) + ' 格 dy=' + ((w.y - (cy - w.box / 2)) / U).toFixed(2) + ' 格 · dead=' + w.dead);
}

run('A:到环那一帧才按下(有新边沿)+ 按住', false);
run('B:一路按住(到环时无新边沿)', true);
