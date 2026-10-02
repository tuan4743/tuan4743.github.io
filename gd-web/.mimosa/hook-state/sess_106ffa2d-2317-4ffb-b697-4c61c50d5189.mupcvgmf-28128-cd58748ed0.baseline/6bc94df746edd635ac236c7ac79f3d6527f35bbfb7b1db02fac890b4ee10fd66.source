/* 生成"演示铺":把每一种物件顺着摆成一排,方便一次测完所有东西。
 * 跑法:cd gd-web && node tools/make-demo-level.ts
 * 产出:src/sim/charts/demo.ts(export const DEMO_CHART)
 * 用法(接线后):打开 ?level=demo 即可进这张铺面 ✓(接线见文件末尾说明)
 *
 * 设计:一条平地上,每 6 格放一类物件,顺序:
 *   方块 → 台阶 → 地刺/小刺/大刺 → 天花刺 → 锯片 → 五种弹簧板 → 六种跳环 → 三种冲刺箭头
 *   → 七种形态门 → 重力门(上下)/速度门(0~4)/迷你门 → 存档点 → 硬币 → 可破坏砖 → 线框
 *   顶部与地面各一条,保证球/蜘蛛有"对面"可瞬移 ✓
 */
import fs from 'node:fs';
import path from 'node:path';

type Obj = Record<string, unknown>;
const objs: Obj[] = [];
let x = 20;
const put = (o: Obj, gap = 6) => { objs.push({ b: x, r: 0, w: 1, h: 1, ...o }); x += gap; };
const section = (label: string) => { objs.push({ kind: 'text', b: x - 3, r: 6, text: '▼ ' + label, size: 0.6 } as Obj); };

/* 地面与天花板(球/蜘蛛要对面 ✓) */
objs.push({ kind: 'platform', b: -8, r: -1, w: 360, h: 1 });          // 地面
objs.push({ kind: 'platform', b: -8, r: 9, w: 360, h: 1 });           // 天花板(y=9)
objs.push({ kind: 'platform', b: -8, r: 3.6, w: 30, h: 1 });          // 一小段中层平台

section('方块/台阶');   put({ kind: 'block', r: 0 }); put({ kind: 'block', r: 0 }); put({ kind: 'block', r: 1 }); put({ kind: 'block', r: 2 });
section('刺');         put({ kind: 'spike', r: 0 }); put({ kind: 'spike', r: 0, h: 0.5 }); put({ kind: 'spike', r: 0, h: 1.5 });
section('天花刺');     put({ kind: 'spike', r: 8.5, flipY: true } as Obj);
section('锯片');       put({ kind: 'saw', r: 0.5 }); put({ kind: 'saw', r: 3 }); put({ kind: 'saw', r: 6 });
section('弹簧板');     for (const p of ['yellow', 'pink', 'red', 'blue', 'purple']) put({ kind: 'pad', pad: p, r: 0 });
section('跳环');       for (const o of ['yellow', 'pink', 'red', 'blue', 'green', 'black']) put({ kind: 'orb', orb: o, r: 3 });
section('冲刺箭头');   for (const a of ['green', 'pink', 'purple']) put({ kind: 'arrow', arrow: a, r: 3 });
section('形态门');     for (const m of ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider']) put({ kind: 'portal', to: m, r: 3 });
section('重力/速度/迷你门');
put({ kind: 'portal', gdir: -1, r: 3 } as Obj);        // 反重力门
put({ kind: 'portal', gdir: 1, r: 3 } as Obj);         // 正重力门
for (const s of [0, 1, 2, 3, 4]) put({ kind: 'speed', speed: s, r: 3 } as Obj);
/* ★★ 2026-09 修:尺寸门的 kind 是【size】不是 portal ✗ —— 我原来写成 portal ⇒ 演示铺里"迷你门没反应" ✓✓
   (用户实测"迷你门没反应"就是这条 ✓;引擎里它是好的:实测 x=1002 处 sizeMul 1.000→0.600 ✓) */
put({ kind: 'size', mini: true, r: 3 } as Obj);       // 缩小门
put({ kind: 'size', mini: false, r: 3 } as Obj);      // 恢复门
put({ kind: 'clone', r: 3 } as Obj);                  // 复制门(引擎暂时 inert,先摆上能看见 ✓)
section('存档点');     put({ kind: 'check', r: 0 }, 10);
section('硬币');       put({ kind: 'coin', r: 3 } as Obj);
section('可破坏砖');   put({ kind: 'breakable', r: 0 });
section('线框');       put({ kind: 'frame', frame: 'box', r: 0 }); put({ kind: 'frame', frame: 'edge', r: 0 });
section('结束');       x += 20;

const LENGTH = Math.ceil(x);
const chart = {
  name: 'DEMO',
  rows: 14,
  length: LENGTH,
  song: '/levels/WATER.mp3',
  start: { b: 2, r: 0 },
  segments: [{ from: 0, to: LENGTH, mode: 'cube', speed: 1, difficulty: 0, label: 'demo' }],
  objects: objs,
};

const out = path.resolve('src', 'sim', 'charts', 'demo.ts');
const head = `/* 生成物 —— 由 tools/make-demo-level.ts 生成,别手改。
 * 演示铺:每类物件顺着摆一排,共 ${objs.length} 个,长 ${LENGTH} 块。
 * 重新生成:cd gd-web && node tools/make-demo-level.ts
 */
import type { Level } from '../level.ts';

export const DEMO_CHART: Level = `;
fs.writeFileSync(out, head + JSON.stringify(chart, null, 1) + ' as unknown as Level;\n', 'utf8');
console.log('写到 ' + out + '(' + objs.length + ' 个物件,长 ' + LENGTH + ' 块)');
console.log('接线:在 main.ts 里把 LEVEL 换成 DEMO_CHART(?level=demo 时)即可进这张铺面 ✓');
