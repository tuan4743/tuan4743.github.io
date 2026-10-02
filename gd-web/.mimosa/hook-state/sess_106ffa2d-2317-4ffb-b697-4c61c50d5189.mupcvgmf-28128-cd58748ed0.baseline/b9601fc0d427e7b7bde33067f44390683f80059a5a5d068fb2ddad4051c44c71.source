/* 绿环现场诊断:WATER 里第二个存档点之后那个绿环(O 557 8 orb=green id=1022,下方 G 559 5 gd=1 id=10)
   目的:用户口径是"按上半边 ⇒ 翻重力+跳(上路);按下半/不按 ⇒ 掉进下面的重力门(另一路)"。
   我们扫【按键落在哪一帧】⇒ 看哪一段能激活、激活时玩家中心相对环心在什么位置 ⇒ 定位"按了没生效"。
   跑法:cd gd-web && node tools/diag-green.ts */
import { WATER_CHART } from '../src/sim/charts/water.ts';
import { World } from '../src/sim/world.ts';
import { U } from '../src/sim/constants.ts';

const lv = WATER_CHART;
const orb = lv.objects.find((o) => o.id === 1022 && o.b > 513 && o.b < 760);
if (!orb) { console.error('没找到绿环'); process.exit(1); }
const orbCx = orb.b + orb.w / 2, orbCy = orb.r + orb.h / 2;
const door = lv.objects.find((o) => (o.id === 10 || o.id === 11) && Math.abs(o.b - orb.b) < 5);
const seg = lv.segments.find((s) => orb.b >= s.from && orb.b < s.to);
console.log('绿环 中心=(' + orbCx + ',' + orbCy + ') 格 · 盒=' + orb.w + 'x' + orb.h);
console.log('下方重力门 id=' + door?.id + ' 中心=(' + (door!.b + door!.w / 2) + ',' + (door!.r + door!.h / 2) + ') 格 gdir=' + door?.gdir);
console.log('该处段落 speed=' + seg?.speed + ' mode=' + seg?.mode);

const START_BACK = 6;                       // 从环前 6 格起跑
function trial(pressFrame: number) {
  const w = new World(lv);
  w.god = true;
  w.mode = 'cube';
  w.x = (orb!.b - START_BACK) * U;
  w.y = orb!.r * U - 1;                     // 与环同一层高一点:让物理自己落到平台/掉下去
  w.vy = 0; w.gdir = 1; w.dead = false;
  let activatedAt: { y: number; x: number; gdir: number; vy: number } | null = null;
  const g0 = w.gdir;
  for (let f = 0; f < 200; f++) {
    const hold = f === pressFrame;
    w.frame(hold);
    if (!activatedAt && (w.gdir !== g0 || (w.vy > 6 && f > 0))) {
      activatedAt = { y: w.y / U, x: w.x / U, gdir: w.gdir, vy: w.vy };
    }
  }
  return { activatedAt, endX: w.x / U, endY: w.y / U, endG: w.gdir, dead: w.dead };
}

const rows: string[] = [];
let firstAct = -1, lastAct = -1;
for (let pf = 0; pf <= 150; pf += 1) {
  const r = trial(pf);
  if (r.activatedAt) {
    if (firstAct < 0) firstAct = pf;
    lastAct = pf;
    rows.push('  按键帧 ' + String(pf).padStart(3) + '  ★ 激活于 (' + r.activatedAt.x.toFixed(2) + ',' + r.activatedAt.y.toFixed(2) +
      ') 格 · 环心高度差 ' + (r.activatedAt.y - orbCy).toFixed(2) + ' 格 · gdir→' + r.activatedAt.gdir + ' · vy=' + r.activatedAt.vy.toFixed(2));
  }
}
const none = trial(-1);
console.log('\n【不按】终态 x=' + none.endX.toFixed(2) + ' y=' + none.endY.toFixed(2) + ' gdir=' + none.endG + ' 死=' + none.dead);
console.log('【按一次】可激活的按键帧区间: ' + (firstAct < 0 ? '【一次都激活不了】✗' : firstAct + ' ~ ' + lastAct));
console.log('（下面只列前 6 行 + 末 6 行,完整区间见上面的 firstAct~lastAct）');
rows.slice(0, 6).forEach((s) => console.log(s));
if (rows.length > 12) { console.log('  …中间省略…'); rows.slice(-6).forEach((s) => console.log(s)); }
else rows.slice(6).forEach((s) => console.log(s));
