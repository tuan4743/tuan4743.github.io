/* 取景改成用相机 API(centerOn),绘制范围用 camX 自算 —— 不再手搓 scrollX/scrollY。
   根因:之前自己算的 scroll 和相机真实可视矩形(worldView {x:570,y:-90,533x300})对不上,
   画的区域与看的区域只重叠一部分,画面就成了"左边一条"。 */
const fs = require('fs');
const path = require('path');
const F = path.resolve(__dirname, '..', 'src', 'main.ts');
let s = fs.readFileSync(F, 'utf8');
const before = s;
const done = [];

/* ① 字段:记录相机中心 x */
if (!/camX = 0/.test(s)) { s = s.replace('  fixed = false;', '  fixed = false;\n  camX = 0;'); done.push('camX 字段'); }

/* ② update 里的取景 */
s = s.replace(
  /    const w = this\.world;\n[\s\S]*?this\.cameras\.main\.scrollX = Math\.max\(0, w\.x - viewW \* 0\.28\);/,
  `    const w = this.world;
    /* 取景交给相机 API:横向让玩家落在左侧 22% 处,纵向固定居中于场地 */
    const cam = this.cameras.main;
    const vw = cam.width / cam.zoom;
    this.camX = Math.max(vw / 2, w.x + vw * 0.22);
    cam.centerOn(this.camX, ROWS * U / 2);`);
if (s !== before && /centerOn/.test(s)) done.push('update 取景'); else console.log('✗ update 段没替换成功');

/* ③ draw 里的绘制范围:用 camX 与相机尺寸自己算(不读 worldView,避免一帧延迟)*/
s = s.replace(
  /    cam\.setScroll\(cam\.scrollX, -ROWS \* U\);\n    const vw = cam\.width \/ cam\.zoom, vh = cam\.height \/ cam\.zoom;\n    const x0 = cam\.scrollX, x1 = x0 \+ vw, y0 = -ROWS \* U, y1 = y0 \+ vh;/,
  `    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const x0 = this.camX - vw / 2, x1 = x0 + vw;
    const y0 = ROWS * U / 2 - vh / 2, y1 = y0 + vh;`);
if (/const x0 = this\.camX/.test(s)) done.push('draw 范围'); else console.log('✗ draw 段没替换成功');

fs.writeFileSync(F, s);
console.log('✓ 已写盘;应用:', done.join(' / '));
